from io import BytesIO
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.http import HttpResponse
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from auditlog.context import set_actor

from organizations.models import (
    OrganizationMembership,
    CompanyAccess,
)

from drivers.models import DriverVehicleAssignment

from alerts.services import build_alerts

from .models import (
    Vehicle,
    ServiceRecord,
    VehicleDocument,
)

from .serializers import (
    VehicleSerializer,
    ServiceRecordSerializer,
    VehicleDocumentSerializer,
)

from .export_utils import (
    create_vehicle_workbook,
    create_service_workbook,
)

from .pdf_utils import create_vehicle_card_pdf

from .statistics_pdf_utils import (
    create_statistics_pdf,
)

from .alerts_export_utils import (
    create_alerts_workbook,
    create_alerts_pdf,
)


def user_is_superuser(user):
    return bool(
        getattr(
            user,
            "is_superuser",
            False,
        )
    )


def get_membership(user):
    if not getattr(
        user,
        "is_authenticated",
        False,
    ):
        return None

    membership = (
        OrganizationMembership.objects
        .select_related("organization")
        .filter(user=user)
        .first()
    )

    if (
        membership is not None
        and not membership.organization.is_active
    ):
        raise PermissionDenied(
            (
                "Organizacja użytkownika "
                "jest nieaktywna."
            )
        )

    return membership


def get_accessible_vehicles(user):
    membership = get_membership(user)

    if membership is not None:
        if membership.role == "admin":
            return Vehicle.active_objects.filter(
                organization=membership.organization,
            )

        company_ids = (
            CompanyAccess.objects
            .filter(
                membership=membership,
                company__organization=(
                    membership.organization
                ),
                company__is_active=True,
            )
            .values_list(
                "company_id",
                flat=True,
            )
        )

        return Vehicle.active_objects.filter(
            organization=membership.organization,
            company_id__in=company_ids,
            company__is_active=True,
        )

    if user_is_superuser(user):
        return (
            Vehicle.active_objects
            .filter(
                organization__is_active=True
            )
        )

    return Vehicle.active_objects.none()


def can_edit_company(
    membership,
    company,
):
    if membership is None:
        return False

    if membership.role == "admin":
        if company is None:
            return True

        return (
            company.organization_id
            == membership.organization_id
        )

    if company is None:
        return False

    if not company.is_active:
        return False

    return CompanyAccess.objects.filter(
        membership=membership,
        company=company,
        company__is_active=True,
        role="editor",
    ).exists()


def ensure_vehicle_edit_permission(
    user,
    vehicle,
):
    membership = get_membership(user)

    if membership is not None:
        if (
            vehicle.organization_id
            != membership.organization_id
        ):
            raise PermissionDenied(
                "Nie masz dostępu do tego pojazdu."
            )

        if membership.role == "admin":
            return

        if not can_edit_company(
            membership,
            vehicle.company,
        ):
            raise PermissionDenied(
                "Nie masz uprawnień do edycji tego pojazdu."
            )

        return

    if user_is_superuser(user):
        return

    raise PermissionDenied(
        "Nie masz dostępu do tej organizacji."
    )


def validate_company_for_vehicle(
    membership,
    company,
):
    if membership is None:
        raise PermissionDenied(
            "Nie masz dostępu do żadnej organizacji."
        )

    if company is None:
        if membership.role != "admin":
            raise PermissionDenied(
                "Użytkownik musi przypisać pojazd do spółki."
            )

        return

    if (
        company.organization_id
        != membership.organization_id
    ):
        raise PermissionDenied(
            "Nie możesz przypisać pojazdu do spółki z innej organizacji."
        )

    if not company.is_active:
        raise PermissionDenied(
            "Nie możesz przypisać pojazdu do nieaktywnej spółki."
        )

    if (
        membership.role != "admin"
        and not can_edit_company(
            membership,
            company,
        )
    ):
        raise PermissionDenied(
            "Nie masz uprawnień do edycji wybranej spółki."
        )


def parse_id_list(
    raw_ids,
    field_name,
    max_items=5000,
):
    if not isinstance(
        raw_ids,
        list,
    ):
        raise ValueError(
            f"{field_name} musi być listą."
        )

    if len(raw_ids) > max_items:
        raise ValueError(
            (
                f"{field_name} może zawierać "
                f"maksymalnie {max_items} elementów."
            )
        )

    parsed_ids = []

    try:
        for item_id in raw_ids:
            parsed_id = int(
                item_id
            )

            if parsed_id <= 0:
                raise ValueError

            parsed_ids.append(
                parsed_id
            )

    except (
        TypeError,
        ValueError,
    ) as exc:
        raise ValueError(
            "Lista zawiera nieprawidłowe ID."
        ) from exc

    return list(
        dict.fromkeys(
            parsed_ids
        )
    )


def parse_query_integer(
    raw_value,
    field_name,
):
    if raw_value in (
        None,
        "",
    ):
        return None

    try:
        value = int(
            raw_value
        )
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise ValidationError(
            {
                field_name: [
                    "Podaj prawidłową liczbę całkowitą."
                ]
            }
        ) from exc

    if value <= 0:
        raise ValidationError(
            {
                field_name: [
                    "Wartość musi być większa od zera."
                ]
            }
        )

    return value


def parse_query_date(
    raw_value,
    field_name,
):
    if raw_value in (
        None,
        "",
    ):
        return None

    value = parse_date(
        str(raw_value)
    )

    if value is None:
        raise ValidationError(
            {
                field_name: [
                    "Podaj datę w formacie RRRR-MM-DD."
                ]
            }
        )

    return value


def parse_query_decimal(
    raw_value,
    field_name,
):
    if raw_value in (
        None,
        "",
    ):
        return None

    try:
        value = Decimal(
            str(raw_value)
        )
    except (
        InvalidOperation,
        TypeError,
        ValueError,
    ) as exc:
        raise ValidationError(
            {
                field_name: [
                    "Podaj prawidłową wartość liczbową."
                ]
            }
        ) from exc

    if not value.is_finite():
        raise ValidationError(
            {
                field_name: [
                    "Podaj prawidłową wartość liczbową."
                ]
            }
        )

    if value < 0:
        raise ValidationError(
            {
                field_name: [
                    "Wartość nie może być ujemna."
                ]
            }
        )

    return value


def create_xlsx_response(
    workbook,
    filename,
):
    output = BytesIO()

    workbook.save(output)
    output.seek(0)

    response = HttpResponse(
        output.getvalue(),
        content_type=(
            "application/"
            "vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
    )

    response[
        "Content-Disposition"
    ] = (
        f'attachment; filename="{filename}"'
    )

    return response


class VehiclePagination(
    PageNumberPagination
):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class VehicleViewSet(
    viewsets.ModelViewSet
):
    queryset = Vehicle.active_objects.all()
    serializer_class = VehicleSerializer
    pagination_class = VehiclePagination

    def get_queryset(self):
        queryset = (
            get_accessible_vehicles(
                self.request.user
            )
            .select_related(
                "company",
                "driver",
            )
        )

        search = (
            self.request.query_params
            .get(
                "search",
                "",
            )
            .strip()
        )

        if search:
            queryset = queryset.filter(
                Q(
                    brand__icontains=search
                )
                | Q(
                    model__icontains=search
                )
                | Q(
                    registration_number__icontains=search
                )
                | Q(
                    vin__icontains=search
                )
                | Q(
                    branch__icontains=search
                )
            )

        brands = self._get_csv_values(
            "brand"
        )

        if brands:
            queryset = queryset.filter(
                brand__in=brands
            )

        years = self._get_csv_values(
            "year"
        )

        if years:
            valid_years = []

            for year in years:
                try:
                    parsed_year = int(
                        year
                    )
                except (
                    TypeError,
                    ValueError,
                ) as exc:
                    raise ValidationError(
                        {
                            "year": [
                                (
                                    "Filtr roku zawiera "
                                    "nieprawidłową wartość."
                                )
                            ]
                        }
                    ) from exc

                if parsed_year < 1900:
                    raise ValidationError(
                        {
                            "year": [
                                (
                                    "Rok w filtrze nie może "
                                    "być wcześniejszy niż 1900."
                                )
                            ]
                        }
                    )

                valid_years.append(
                    parsed_year
                )

            queryset = queryset.filter(
                year__in=valid_years
            )

        vehicle_types = (
            self._get_csv_values(
                "vehicle_type"
            )
        )

        if vehicle_types:
            queryset = queryset.filter(
                vehicle_type__in=(
                    vehicle_types
                )
            )

        statuses = self._get_csv_values(
            "status"
        )

        if statuses:
            queryset = queryset.filter(
                status__in=statuses
            )

        branches = self._get_csv_values(
            "branch"
        )

        if branches:
            include_empty_branch = (
                "Brak oddziału"
                in branches
            )

            actual_branches = [
                branch
                for branch in branches
                if branch
                != "Brak oddziału"
            ]

            branch_query = Q()

            if actual_branches:
                branch_query |= Q(
                    branch__in=(
                        actual_branches
                    )
                )

            if include_empty_branch:
                branch_query |= (
                    Q(branch__isnull=True)
                    | Q(branch="")
                )

            queryset = queryset.filter(
                branch_query
            )

        if (
            self.request.query_params
            .get(
                "recent"
            )
            == "1"
        ):
            recent_date = (
                timezone.localdate()
                - timedelta(
                    days=30
                )
            )

            queryset = queryset.filter(
                created_at__date__gte=(
                    recent_date
                )
            )

        ordering = (
            self.request.query_params
            .get(
                "ordering",
                "",
            )
            .strip()
        )

        ordering_map = {
            "vehicle": (
                "brand",
                "model",
            ),
            "registration_number": (
                "registration_number",
            ),
            "vehicle_type": (
                "vehicle_type",
            ),
            "branch": (
                "branch",
            ),
            "year": (
                "year",
            ),
            "mileage": (
                "mileage",
            ),
            "status": (
                "status",
            ),
            "inspection_expiry_date":(
                "inspection_expiry_date",
            ),
            "insurance_expiry_date":(
                "insurance_expiry_date",
            ),
        }

        descending = ordering.startswith(
            "-"
        )

        ordering_key = (
            ordering[1:]
            if descending
            else ordering
        )

        fields = ordering_map.get(
            ordering_key
        )

        if fields:
            if descending:
                fields = tuple(
                    f"-{field}"
                    for field in fields
                )

            queryset = queryset.order_by(
                *fields
            )

        else:
            queryset = queryset.order_by(
                "brand",
                "model",
                "registration_number",
            )

        return queryset

    def _get_csv_values(
        self,
        parameter_name,
    ):
        raw_value = (
            self.request.query_params
            .get(
                parameter_name,
                "",
            )
        )

        if not raw_value:
            return []

        return [
            value.strip()
            for value
            in raw_value.split(",")
            if value.strip()
        ]

    @action(
        detail=False,
        methods=["get"],
        url_path="filter-options",
    )
    def filter_options(
        self,
        request,
    ):
        queryset = (
            get_accessible_vehicles(
                request.user
            )
        )

        brands = list(
            queryset
            .exclude(
                brand__isnull=True
            )
            .exclude(
                brand=""
            )
            .values_list(
                "brand",
                flat=True,
            )
            .distinct()
            .order_by(
                "brand"
            )
        )

        years = list(
            queryset
            .values_list(
                "year",
                flat=True,
            )
            .distinct()
            .order_by(
                "-year"
            )
        )

        vehicle_types = list(
            queryset
            .values_list(
                "vehicle_type",
                flat=True,
            )
            .distinct()
            .order_by(
                "vehicle_type"
            )
        )

        statuses = list(
            queryset
            .values_list(
                "status",
                flat=True,
            )
            .distinct()
            .order_by(
                "status"
            )
        )

        raw_branches = list(
            queryset
            .values_list(
                "branch",
                flat=True,
            )
            .distinct()
        )

        branches = sorted(
            {
                (
                    branch.strip()
                    if isinstance(
                        branch,
                        str,
                    )
                    and branch.strip()
                    else "Brak oddziału"
                )
                for branch in raw_branches
            },
            key=lambda value: (
                value.casefold()
            ),
        )

        return Response(
            {
                "brands": brands,
                "years": years,
                "vehicle_types": (
                    vehicle_types
                ),
                "statuses": statuses,
                "branches": branches,
            }
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="export",
    )
    def export(
        self,
        request,
    ):
        try:
            vehicle_ids = parse_id_list(
                request.data.get(
                    "vehicle_ids",
                    [],
                ),
                "vehicle_ids",
            )
        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = (
            self.get_queryset()
            .select_related(
                "company",
                "driver",
            )
        )

        if vehicle_ids:
            queryset = queryset.filter(
                id__in=vehicle_ids
            )

        vehicles_by_id = {
            vehicle.id: vehicle
            for vehicle in queryset
        }

        if vehicle_ids:
            vehicles = [
                vehicles_by_id[vehicle_id]
                for vehicle_id in vehicle_ids
                if vehicle_id in vehicles_by_id
            ]
        else:
            vehicles = list(
                queryset.order_by(
                    "brand",
                    "model",
                )
            )

        workbook = create_vehicle_workbook(
            vehicles
        )

        filename = (
            "flotivo-pojazdy-"
            f"{timezone.localdate()}.xlsx"
        )

        return create_xlsx_response(
            workbook,
            filename,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="card-pdf",
    )
    def card_pdf(
        self,
        request,
        pk=None,
    ):
        vehicle = (
            self.get_queryset()
            .select_related(
                "company",
                "driver",
            )
            .filter(pk=pk)
            .first()
        )

        if vehicle is None:
            return Response(
                {
                    "detail": "Nie znaleziono pojazdu."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        service_records = (
            ServiceRecord.objects
            .filter(vehicle=vehicle)
            .order_by(
                "-service_date",
                "-created_at",
            )
        )

        documents = (
            VehicleDocument.objects
            .filter(vehicle=vehicle)
            .order_by("-created_at")
        )

        assignments = (
            DriverVehicleAssignment.objects
            .filter(vehicle=vehicle)
            .select_related("driver")
            .order_by(
                "-start_date",
                "-created_at",
            )
        )

        pdf = create_vehicle_card_pdf(
            vehicle=vehicle,
            service_records=service_records,
            documents=documents,
            assignments=assignments,
        )

        filename = (
            "flotivo-karta-"
            f"{vehicle.registration_number}-"
            f"{timezone.localdate()}.pdf"
        )

        response = HttpResponse(
            pdf.getvalue(),
            content_type="application/pdf",
        )

        response[
            "Content-Disposition"
        ] = (
            f'attachment; filename="{filename}"'
        )

        return response

    @action(
        detail=False,
        methods=["post"],
        url_path="statistics-pdf",
    )
    def statistics_pdf(
        self,
        request,
    ):
        try:
            vehicle_ids = parse_id_list(
                request.data.get(
                    "vehicle_ids",
                    [],
                ),
                "vehicle_ids",
            )
        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = (
            self.get_queryset()
            .select_related(
                "company",
                "driver",
            )
            .order_by(
                "brand",
                "model",
            )
        )

        if vehicle_ids:
            queryset = queryset.filter(
                id__in=vehicle_ids
            )

        vehicles = list(queryset)

        accessible_vehicle_ids = [
            vehicle.id
            for vehicle in vehicles
        ]

        service_records = (
            ServiceRecord.objects
            .filter(
                vehicle_id__in=accessible_vehicle_ids
            )
            .select_related("vehicle")
            .order_by(
                "-service_date",
                "-created_at",
            )
        )

        pdf = create_statistics_pdf(
            vehicles=vehicles,
            service_records=service_records,
        )

        filename = (
            "flotivo-raport-statystyczny-"
            f"{timezone.localdate()}.pdf"
        )

        response = HttpResponse(
            pdf.getvalue(),
            content_type="application/pdf",
        )

        response[
            "Content-Disposition"
        ] = (
            f'attachment; filename="{filename}"'
        )

        return response

    @action(
        detail=False,
        methods=["post"],
        url_path="alerts-export",
    )
    def alerts_export(
        self,
        request,
    ):
        category = request.data.get(
            "category",
            "all",
        )

        if category not in (
            "all",
            "vehicles",
            "drivers",
        ):
            return Response(
                {
                    "detail": "Nieprawidłowa kategoria."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        alerts = build_alerts(
            user=request.user,
            category=category,
        )

        workbook = create_alerts_workbook(
            alerts
        )

        filename = (
            "flotivo-alerty-"
            f"{timezone.localdate()}.xlsx"
        )

        return create_xlsx_response(
            workbook,
            filename,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="alerts-pdf",
    )
    def alerts_pdf(
        self,
        request,
    ):
        category = request.data.get(
            "category",
            "all",
        )

        if category not in (
            "all",
            "vehicles",
            "drivers",
        ):
            return Response(
                {
                    "detail": "Nieprawidłowa kategoria."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        alerts = build_alerts(
            user=request.user,
            category=category,
        )

        filter_names = {
            "all": "Wszystkie",
            "vehicles": "Pojazdy",
            "drivers": "Kierowcy",
        }

        pdf = create_alerts_pdf(
            alerts=alerts,
            filter_name=(
                filter_names[category]
            ),
        )

        filename = (
            "flotivo-alerty-"
            f"{timezone.localdate()}.pdf"
        )

        response = HttpResponse(
            pdf.getvalue(),
            content_type="application/pdf",
        )

        response[
            "Content-Disposition"
        ] = (
            f'attachment; filename="{filename}"'
        )

        return response

    def perform_create(
        self,
        serializer,
    ):
        membership = get_membership(
            self.request.user
        )

        company = (
            serializer.validated_data.get(
                "company"
            )
        )

        if membership is not None:
            validate_company_for_vehicle(
                membership,
                company,
            )

            with set_actor(
                self.request.user
            ):
                serializer.save(
                    organization=(
                        membership.organization
                    )
                )

            return

        if user_is_superuser(
            self.request.user
        ):
            if company is None:
                raise PermissionDenied(
                    (
                        "Superuser bez przypisanej organizacji "
                        "musi wybrać spółkę."
                    )
                )

            with set_actor(
                self.request.user
            ):
                serializer.save(
                    organization=(
                        company.organization
                    )
                )

            return

        raise PermissionDenied(
            "Nie masz dostępu do żadnej organizacji."
        )

    def perform_update(
        self,
        serializer,
    ):
        vehicle = self.get_object()

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle,
        )

        membership = get_membership(
            self.request.user
        )

        new_company = (
            serializer.validated_data.get(
                "company",
                vehicle.company,
            )
        )

        if membership is not None:
            company_was_changed = (
                "company"
                in serializer.validated_data
                and (
                    serializer.validated_data[
                        "company"
                    ]
                    != vehicle.company
                )
            )

            if company_was_changed:
                validate_company_for_vehicle(
                    membership,
                    new_company,
                )

            elif (
                new_company is not None
                and (
                    new_company.organization_id
                    != membership.organization_id
                )
            ):
                raise PermissionDenied(
                    (
                        "Nie możesz przypisać pojazdu "
                        "do spółki z innej organizacji."
                    )
                )

            with set_actor(
                self.request.user
            ):
                serializer.save(
                    organization=(
                        membership.organization
                    )
                )

            return

        if user_is_superuser(
            self.request.user
        ):
            if new_company is not None:
                organization = (
                    new_company.organization
                )
            else:
                organization = (
                    vehicle.organization
                )

            if organization is None:
                raise PermissionDenied(
                    (
                        "Nie można zapisać pojazdu "
                        "bez organizacji."
                    )
                )

            with set_actor(
                self.request.user
            ):
                serializer.save(
                    organization=organization
                )

            return

        raise PermissionDenied(
            "Nie masz dostępu do żadnej organizacji."
        )

    def perform_destroy(
        self,
        instance,
    ):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance,
        )

        with set_actor(
            self.request.user
        ):
            instance.soft_delete()

class ServiceRecordPagination(
    PageNumberPagination
):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

class ServiceRecordViewSet(
    viewsets.ModelViewSet
):
    queryset = ServiceRecord.objects.all()
    serializer_class = ServiceRecordSerializer
    pagination_class = ServiceRecordPagination

    def get_queryset(self):
        vehicles = get_accessible_vehicles(
            self.request.user
        )

        queryset = (
            ServiceRecord.objects
            .filter(
                vehicle__in=vehicles
            )
            .select_related(
                "vehicle"
            )
        )

        vehicle_id = parse_query_integer(
            self.request.query_params.get(
                "vehicle",
                "",
            ),
            "vehicle",
        )

        if vehicle_id is not None:
            queryset = queryset.filter(
                vehicle_id=vehicle_id
            )

        search = (
            self.request.query_params
            .get(
                "search",
                "",
            )
            .strip()
        )

        if search:
            queryset = queryset.filter(
                Q(
                    vehicle__brand__icontains=search
                )
                | Q(
                    vehicle__model__icontains=search
                )
                | Q(
                    vehicle__registration_number__icontains=search
                )
                | Q(
                    title__icontains=search
                )
                | Q(
                    description__icontains=search
                )
            )

        date_from = parse_query_date(
            self.request.query_params.get(
                "date_from",
                "",
            ),
            "date_from",
        )

        date_to = parse_query_date(
            self.request.query_params.get(
                "date_to",
                "",
            ),
            "date_to",
        )

        if (
            date_from is not None
            and date_to is not None
            and date_from > date_to
        ):
            raise ValidationError(
                {
                    "date_to": [
                        (
                            "Data końcowa nie może być "
                            "wcześniejsza niż początkowa."
                        )
                    ]
                }
            )

        if date_from is not None:
            queryset = queryset.filter(
                service_date__gte=date_from
            )

        if date_to is not None:
            queryset = queryset.filter(
                service_date__lte=date_to
            )

        cost_min = parse_query_decimal(
            self.request.query_params.get(
                "cost_min",
                "",
            ),
            "cost_min",
        )

        cost_max = parse_query_decimal(
            self.request.query_params.get(
                "cost_max",
                "",
            ),
            "cost_max",
        )

        if (
            cost_min is not None
            and cost_max is not None
            and cost_min > cost_max
        ):
            raise ValidationError(
                {
                    "cost_max": [
                        (
                            "Maksymalny koszt nie może być "
                            "mniejszy niż minimalny."
                        )
                    ]
                }
            )

        if cost_min is not None:
            queryset = queryset.filter(
                cost__gte=cost_min
            )

        if cost_max is not None:
            queryset = queryset.filter(
                cost__lte=cost_max
            )

        ordering = (
            self.request.query_params
            .get(
                "ordering",
                "",
            )
            .strip()
        )

        ordering_map = {
            "vehicle": (
                "vehicle__brand",
                "vehicle__model",
                "vehicle__registration_number",
            ),
            "service_date": (
                "service_date",
                "created_at",
            ),
            "mileage": (
                "mileage",
            ),
            "cost": (
                "cost",
            ),
        }

        descending = ordering.startswith(
            "-"
        )

        ordering_key = (
            ordering[1:]
            if descending
            else ordering
        )

        fields = ordering_map.get(
            ordering_key
        )

        if fields:
            if descending:
                fields = tuple(
                    f"-{field}"
                    for field in fields
                )

            queryset = queryset.order_by(
                *fields
            )

        else:
            queryset = queryset.order_by(
                "-service_date",
                "-created_at",
            )

        return queryset

    @action(
        detail=False,
        methods=["post"],
        url_path="export",
    )
    def export(
        self,
        request,
    ):
        try:
            service_record_ids = (
                parse_id_list(
                    request.data.get(
                        "service_record_ids",
                        [],
                    ),
                    "service_record_ids",
                )
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = (
            self.get_queryset()
            .select_related(
                "vehicle"
            )
        )

        if service_record_ids:
            queryset = queryset.filter(
                id__in=service_record_ids
            )

        records_by_id = {
            record.id: record
            for record in queryset
        }

        if service_record_ids:
            service_records = [
                records_by_id[
                    record_id
                ]
                for record_id
                in service_record_ids
                if record_id
                in records_by_id
            ]

        else:
            service_records = list(
                queryset
            )

        workbook = (
            create_service_workbook(
                service_records
            )
        )

        filename = (
            "flotivo-historia-serwisowa-"
            f"{timezone.localdate()}.xlsx"
        )

        return create_xlsx_response(
            workbook,
            filename,
        )

    def perform_create(
        self,
        serializer,
    ):
        vehicle = (
            serializer.validated_data
            .get(
                "vehicle"
            )
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle,
        )

        with set_actor(
            self.request.user
        ):
            serializer.save()

    def perform_update(
        self,
        serializer,
    ):
        service_record = (
            self.get_object()
        )

        old_vehicle = (
            service_record.vehicle
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            old_vehicle,
        )

        new_vehicle = (
            serializer.validated_data
            .get(
                "vehicle",
                old_vehicle,
            )
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            new_vehicle,
        )

        with set_actor(
            self.request.user
        ):
            serializer.save()

    def perform_destroy(
        self,
        instance,
    ):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance.vehicle,
        )

        with set_actor(
            self.request.user
        ):
            instance.delete()


class VehicleDocumentPagination(
    PageNumberPagination
):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class VehicleDocumentViewSet(
    viewsets.ModelViewSet
):
    queryset = VehicleDocument.objects.all()
    serializer_class = VehicleDocumentSerializer
    pagination_class = VehicleDocumentPagination

    def get_queryset(self):
        vehicles = get_accessible_vehicles(
            self.request.user
        )

        queryset = (
            VehicleDocument.objects
            .filter(
                vehicle__in=vehicles
            )
            .select_related(
                "vehicle"
            )
        )

        vehicle_id = (
            self.request.query_params.get(
                "vehicle"
            )
        )

        if vehicle_id:
            queryset = queryset.filter(
                vehicle_id=vehicle_id
            )

        return queryset.order_by(
            "-created_at"
        )

    def perform_create(
        self,
        serializer,
    ):
        vehicle = (
            serializer.validated_data.get(
                "vehicle"
            )
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle,
        )

        with set_actor(
            self.request.user
        ):
            serializer.save()

    def perform_update(
        self,
        serializer,
    ):
        document = self.get_object()

        old_vehicle = (
            document.vehicle
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            old_vehicle,
        )

        new_vehicle = (
            serializer.validated_data.get(
                "vehicle",
                old_vehicle,
            )
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            new_vehicle,
        )

        with set_actor(
            self.request.user
        ):
            serializer.save()

    def perform_destroy(
        self,
        instance,
    ):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance.vehicle,
        )

        with set_actor(
            self.request.user
        ):
            instance.delete()
