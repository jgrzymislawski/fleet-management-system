from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from auditlog.context import set_actor

from organizations.models import (
    OrganizationMembership,
    CompanyAccess,
)

from drivers.models import DriverVehicleAssignment

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
from .statistics_pdf_utils import create_statistics_pdf


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

    return (
        OrganizationMembership.objects
        .select_related("organization")
        .filter(user=user)
        .first()
    )


def get_accessible_vehicles(user):
    if user_is_superuser(user):
        return Vehicle.objects.all()

    membership = get_membership(user)

    if membership is None:
        return Vehicle.objects.none()

    if membership.role == "admin":
        return Vehicle.objects.filter(
            organization=membership.organization,
        )

    company_ids = (
        CompanyAccess.objects
        .filter(
            membership=membership,
            company__is_active=True,
        )
        .values_list(
            "company_id",
            flat=True,
        )
    )

    return Vehicle.objects.filter(
        organization=membership.organization,
        company_id__in=company_ids,
        company__is_active=True,
    )


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
    if user_is_superuser(user):
        return

    membership = get_membership(user)

    if membership is None:
        raise PermissionDenied(
            "Nie masz dostępu do tej organizacji."
        )

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


def validate_company_for_vehicle(
    membership,
    company,
):
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

    if membership.role != "admin":
        if not can_edit_company(
            membership,
            company,
        ):
            raise PermissionDenied(
                "Nie masz uprawnień do edycji wybranej spółki."
            )


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer

    def get_queryset(self):
        return get_accessible_vehicles(
            self.request.user
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="export",
    )
    def export(self, request):
        vehicle_ids = request.data.get(
            "vehicle_ids",
            [],
        )

        if not isinstance(vehicle_ids, list):
            return Response(
                {
                    "detail": "vehicle_ids musi być listą."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            vehicle_ids = [
                int(vehicle_id)
                for vehicle_id in vehicle_ids
            ]
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": "Nieprawidłowe ID pojazdu."
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

        output = BytesIO()

        workbook.save(output)

        output.seek(0)

        filename = (
            "flotivo-pojazdy-"
            f"{timezone.localdate()}.xlsx"
        )

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
            .filter(
                vehicle=vehicle
            )
            .order_by(
                "-service_date",
                "-created_at",
            )
        )

        documents = (
            VehicleDocument.objects
            .filter(
                vehicle=vehicle
            )
            .order_by(
                "-created_at",
            )
        )

        assignments = (
            DriverVehicleAssignment.objects
            .filter(
                vehicle=vehicle
            )
            .select_related(
                "driver"
            )
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
        vehicle_ids = request.data.get(
            "vehicle_ids",
            [],
        )

        if not isinstance(vehicle_ids, list):
            return Response(
                {
                    "detail": "vehicle_ids musi być listą."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            vehicle_ids = [
                int(vehicle_id)
                for vehicle_id in vehicle_ids
            ]
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": "Nieprawidłowe ID pojazdu."
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
            .select_related(
                "vehicle"
            )
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

    def perform_create(self, serializer):
        if user_is_superuser(
            self.request.user
        ):
            with set_actor(self.request.user):
                serializer.save()

            return

        membership = get_membership(
            self.request.user
        )

        if membership is None:
            raise PermissionDenied(
                "Nie masz dostępu do żadnej organizacji."
            )

        company = (
            serializer.validated_data.get(
                "company"
            )
        )

        validate_company_for_vehicle(
            membership,
            company,
        )

        with set_actor(self.request.user):
            serializer.save(
                organization=membership.organization
            )

    def perform_update(self, serializer):
        vehicle = self.get_object()

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle,
        )

        if user_is_superuser(
            self.request.user
        ):
            with set_actor(self.request.user):
                serializer.save()

            return

        membership = get_membership(
            self.request.user
        )

        new_company = (
            serializer.validated_data.get(
                "company",
                vehicle.company,
            )
        )

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
            and new_company.organization_id
            != membership.organization_id
        ):
            raise PermissionDenied(
                "Nie możesz przypisać pojazdu do spółki z innej organizacji."
            )

        with set_actor(self.request.user):
            serializer.save(
                organization=membership.organization
            )

    def perform_destroy(self, instance):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance,
        )

        with set_actor(self.request.user):
            instance.delete()


class ServiceRecordViewSet(
    viewsets.ModelViewSet
):
    queryset = ServiceRecord.objects.all()
    serializer_class = ServiceRecordSerializer

    def get_queryset(self):
        vehicles = get_accessible_vehicles(
            self.request.user
        )

        queryset = (
            ServiceRecord.objects
            .filter(
                vehicle__in=vehicles
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

        return queryset

    @action(
        detail=False,
        methods=["post"],
        url_path="export",
    )
    def export(self, request):
        service_record_ids = request.data.get(
            "service_record_ids",
            [],
        )

        if not isinstance(
            service_record_ids,
            list,
        ):
            return Response(
                {
                    "detail": (
                        "service_record_ids musi być listą."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service_record_ids = [
                int(record_id)
                for record_id in service_record_ids
            ]
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowe ID wpisu serwisowego."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = (
            self.get_queryset()
            .select_related("vehicle")
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
                records_by_id[record_id]
                for record_id in service_record_ids
                if record_id in records_by_id
            ]
        else:
            service_records = list(
                queryset.order_by(
                    "-service_date",
                    "-created_at",
                )
            )

        workbook = create_service_workbook(
            service_records
        )

        output = BytesIO()

        workbook.save(output)

        output.seek(0)

        filename = (
            "flotivo-historia-serwisowa-"
            f"{timezone.localdate()}.xlsx"
        )

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

    def perform_create(self, serializer):
        vehicle = (
            serializer.validated_data.get(
                "vehicle"
            )
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle,
        )

        with set_actor(self.request.user):
            serializer.save()

    def perform_update(self, serializer):
        service_record = self.get_object()

        old_vehicle = service_record.vehicle

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

        with set_actor(self.request.user):
            serializer.save()

    def perform_destroy(self, instance):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance.vehicle,
        )

        with set_actor(self.request.user):
            instance.delete()


class VehicleDocumentViewSet(
    viewsets.ModelViewSet
):
    queryset = VehicleDocument.objects.all()
    serializer_class = VehicleDocumentSerializer

    def get_queryset(self):
        vehicles = get_accessible_vehicles(
            self.request.user
        )

        queryset = (
            VehicleDocument.objects
            .filter(
                vehicle__in=vehicles
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

        return queryset

    def perform_create(self, serializer):
        vehicle = (
            serializer.validated_data.get(
                "vehicle"
            )
        )

        ensure_vehicle_edit_permission(
            self.request.user,
            vehicle,
        )

        with set_actor(self.request.user):
            serializer.save()

    def perform_update(self, serializer):
        document = self.get_object()

        old_vehicle = document.vehicle

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

        with set_actor(self.request.user):
            serializer.save()

    def perform_destroy(self, instance):
        ensure_vehicle_edit_permission(
            self.request.user,
            instance.vehicle,
        )

        with set_actor(self.request.user):
            instance.delete()