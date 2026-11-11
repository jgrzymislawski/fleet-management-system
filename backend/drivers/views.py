from io import BytesIO

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from auditlog.context import set_actor

from organizations.models import OrganizationMembership

from .models import (
    Driver,
    DriverVehicleAssignment,
)

from .serializers import DriverSerializer
from .assignment_serializers import (
    DriverVehicleAssignmentSerializer,
)
from .export_utils import create_driver_workbook
from .pdf_utils import create_driver_card_pdf


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
        .select_related(
            "organization"
        )
        .filter(
            user=user
        )
        .first()
    )


def ensure_driver_management_permission(user):
    membership = get_membership(user)

    if membership is not None:
        if membership.role != "admin":
            raise PermissionDenied(
                (
                    "Nie masz uprawnień "
                    "do zarządzania kierowcami."
                )
            )

        return

    if user_is_superuser(user):
        return

    raise PermissionDenied(
        (
            "Nie jesteś przypisany "
            "do żadnej organizacji."
        )
    )


class DriverPagination(
    PageNumberPagination
):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class DriverViewSet(
    viewsets.ModelViewSet
):
    queryset = Driver.active_objects.all()
    serializer_class = DriverSerializer
    permission_classes = [
        IsAuthenticated,
    ]
    pagination_class = DriverPagination

    def get_queryset(self):
        user = self.request.user

        membership = get_membership(
            user
        )

        if membership is not None:
            queryset = (
                Driver.active_objects
                .filter(
                    organization=(
                        membership.organization
                    )
                )
            )

        elif user_is_superuser(user):
            queryset = (
                Driver.active_objects
                .all()
            )

        else:
            return (
                Driver.active_objects
                .none()
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
                    first_name__icontains=search
                )
                | Q(
                    last_name__icontains=search
                )
                | Q(
                    license_number__icontains=search
                )
                | Q(
                    phone_number__icontains=search
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
            "first_name": (
                "first_name",
                "last_name",
            ),
            "last_name": (
                "last_name",
                "first_name",
            ),
            "license_number": (
                "license_number",
            ),
            "license_expiry_date": (
                "license_expiry_date",
            ),
            "medical_exam_expiry_date": (
                "medical_exam_expiry_date",
            ),
            "phone_number": (
                "phone_number",
            ),
            "hired_at": (
                "hired_at",
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
                "last_name",
                "first_name",
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
        driver_ids = request.data.get(
            "driver_ids",
            [],
        )

        if not isinstance(
            driver_ids,
            list,
        ):
            return Response(
                {
                    "detail": (
                        "driver_ids musi być listą."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        try:
            driver_ids = [
                int(driver_id)
                for driver_id
                in driver_ids
            ]

        except (
            TypeError,
            ValueError,
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowe ID kierowcy."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        queryset = (
            self.get_queryset()
        )

        if driver_ids:
            queryset = queryset.filter(
                id__in=driver_ids
            )

        drivers_by_id = {
            driver.id: driver
            for driver in queryset
        }

        if driver_ids:
            drivers = [
                drivers_by_id[
                    driver_id
                ]
                for driver_id
                in driver_ids
                if driver_id
                in drivers_by_id
            ]
        else:
            drivers = list(
                queryset.order_by(
                    "last_name",
                    "first_name",
                )
            )

        workbook = (
            create_driver_workbook(
                drivers
            )
        )

        output = BytesIO()

        workbook.save(
            output
        )

        output.seek(0)

        filename = (
            "flotivo-kierowcy-"
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
        driver = (
            self.get_queryset()
            .filter(
                pk=pk
            )
            .first()
        )

        if driver is None:
            return Response(
                {
                    "detail": (
                        "Nie znaleziono kierowcy."
                    )
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        assignments = (
            DriverVehicleAssignment.objects
            .filter(
                driver=driver
            )
            .select_related(
                "vehicle",
                "vehicle__company",
                "vehicle__organization",
            )
            .order_by(
                "-start_date",
                "-id",
            )
        )

        pdf = create_driver_card_pdf(
            driver=driver,
            assignments=assignments,
        )

        filename = (
            "flotivo-kierowca-"
            f"{driver.first_name}-"
            f"{driver.last_name}-"
            f"{timezone.localdate()}.pdf"
        )

        response = HttpResponse(
            pdf.getvalue(),
            content_type=(
                "application/pdf"
            ),
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
        user = self.request.user

        membership = get_membership(
            user
        )

        if membership is not None:
            if membership.role != "admin":
                raise PermissionDenied(
                    (
                        "Nie masz uprawnień "
                        "do dodawania kierowców."
                    )
                )

            with set_actor(
                user
            ):
                serializer.save(
                    organization=(
                        membership.organization
                    )
                )

            return

        if user_is_superuser(user):
            organization = (
                serializer.validated_data.get(
                    "organization"
                )
            )

            if organization is None:
                raise PermissionDenied(
                    (
                        "Superadministrator bez "
                        "przypisanej organizacji "
                        "musi wskazać organizację."
                    )
                )

            with set_actor(
                user
            ):
                serializer.save(
                    organization=organization
                )

            return

        raise PermissionDenied(
            (
                "Nie jesteś przypisany "
                "do żadnej organizacji."
            )
        )

    def perform_update(
        self,
        serializer,
    ):
        user = self.request.user
        driver = self.get_object()

        ensure_driver_management_permission(
            user
        )

        membership = get_membership(
            user
        )

        if membership is not None:
            if (
                driver.organization_id
                != membership.organization_id
            ):
                raise PermissionDenied(
                    (
                        "Nie masz dostępu "
                        "do tego kierowcy."
                    )
                )

            with set_actor(
                user
            ):
                serializer.save(
                    organization=(
                        membership.organization
                    )
                )

            return

        if user_is_superuser(user):
            organization = (
                serializer.validated_data.get(
                    "organization",
                    driver.organization,
                )
            )

            if organization is None:
                raise PermissionDenied(
                    (
                        "Nie można zapisać kierowcy "
                        "bez organizacji."
                    )
                )

            with set_actor(
                user
            ):
                serializer.save(
                    organization=organization
                )

            return

        raise PermissionDenied(
            (
                "Nie jesteś przypisany "
                "do żadnej organizacji."
            )
        )

    def perform_destroy(
        self,
        instance,
    ):
        user = self.request.user

        ensure_driver_management_permission(
            user
        )

        membership = get_membership(
            user
        )

        if membership is not None:
            if (
                instance.organization_id
                != membership.organization_id
            ):
                raise PermissionDenied(
                    (
                        "Nie masz dostępu "
                        "do tego kierowcy."
                    )
                )

        elif not user_is_superuser(
            user
        ):
            raise PermissionDenied(
                (
                    "Nie jesteś przypisany "
                    "do żadnej organizacji."
                )
            )

        driver_name = (
            f"{instance.first_name} "
            f"{instance.last_name}"
        ).strip()

        with transaction.atomic():
            with set_actor(
                user
            ):
                vehicles = (
                    instance.vehicles
                    .filter(
                        is_deleted=False
                    )
                )

                for vehicle in vehicles:
                    if (
                        vehicle.driver_id
                        != instance.id
                    ):
                        continue

                    vehicle.driver = None
                    vehicle.driver_name = (
                        driver_name
                    )

                    vehicle.save(
                        update_fields=[
                            "driver",
                            "driver_name",
                        ]
                    )

                instance.soft_delete()

class DriverVehicleAssignmentPagination(
    PageNumberPagination
):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

class DriverVehicleAssignmentViewSet(
    viewsets.ModelViewSet
):
    queryset = (
        DriverVehicleAssignment.objects.all()
    )

    serializer_class = (
        DriverVehicleAssignmentSerializer
    )

    permission_classes = [
        IsAuthenticated,
    ]
    pagination_class = (
        DriverVehicleAssignmentPagination
    )

    def get_queryset(self):
        user = self.request.user

        queryset = (
            DriverVehicleAssignment.objects
            .select_related(
                "vehicle",
                "vehicle__company",
                "vehicle__organization",
                "driver",
                "driver__organization",
            )
            .filter(
                vehicle__is_deleted=False,
            )
        )

        membership = get_membership(
            user
        )

        if membership is not None:
            queryset = queryset.filter(
                vehicle__organization=(
                    membership.organization
                ),
            )

            if membership.role != "admin":
                company_ids = (
                    membership
                    .company_accesses
                    .filter(
                        company__is_active=True
                    )
                    .values_list(
                        "company_id",
                        flat=True,
                    )
                )

                queryset = queryset.filter(
                    vehicle__company_id__in=(
                        company_ids
                    ),
                    vehicle__company__is_active=True,
                )

        elif not user_is_superuser(user):
            return (
                DriverVehicleAssignment.objects
                .none()
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

        driver_id = (
            self.request.query_params.get(
                "driver"
            )
        )

        if driver_id:
            queryset = queryset.filter(
                driver_id=driver_id
            )

        return queryset.order_by(
            "-start_date",
            "-created_at",
        )

    def check_write_access(
        self,
        vehicle,
    ):
        if vehicle.is_deleted:
            raise PermissionDenied(
                (
                    "Nie można zarządzać "
                    "przypisaniami usuniętego "
                    "pojazdu."
                )
            )

        user = self.request.user

        membership = get_membership(
            user
        )

        if membership is not None:
            if vehicle.organization_id is None:
                raise PermissionDenied(
                    (
                        "Pojazd nie ma przypisanej "
                        "organizacji."
                    )
                )

            if (
                vehicle.organization_id
                != membership.organization_id
            ):
                raise PermissionDenied(
                    (
                        "Nie masz dostępu "
                        "do tego pojazdu."
                    )
                )

            if membership.role == "admin":
                return

            if not vehicle.company_id:
                raise PermissionDenied(
                    (
                        "Nie masz uprawnień do "
                        "zarządzania przypisaniami "
                        "tego pojazdu."
                    )
                )

            if not vehicle.company.is_active:
                raise PermissionDenied(
                    (
                        "Nie można zmieniać "
                        "przypisań w nieaktywnej "
                        "spółce."
                    )
                )

            access = (
                membership
                .company_accesses
                .filter(
                    company_id=(
                        vehicle.company_id
                    ),
                    company__is_active=True,
                )
                .first()
            )

            if access is None:
                raise PermissionDenied(
                    (
                        "Nie masz dostępu "
                        "do tej spółki."
                    )
                )

            if access.role != "editor":
                raise PermissionDenied(
                    (
                        "Masz tylko uprawnienia "
                        "do odczytu."
                    )
                )

            return

        if user_is_superuser(user):
            return

        raise PermissionDenied(
            (
                "Nie jesteś przypisany "
                "do żadnej organizacji."
            )
        )

    def validate_driver_access(
        self,
        vehicle,
        driver,
    ):
        if driver is None:
            return

        if driver.is_deleted:
            raise PermissionDenied(
                (
                    "Nie można przypisać "
                    "usuniętego kierowcy."
                )
            )

        if vehicle.is_deleted:
            raise PermissionDenied(
                (
                    "Nie można przypisać "
                    "kierowcy do usuniętego "
                    "pojazdu."
                )
            )

        if vehicle.organization_id is None:
            raise PermissionDenied(
                (
                    "Pojazd nie ma przypisanej "
                    "organizacji."
                )
            )

        if driver.organization_id is None:
            raise PermissionDenied(
                (
                    "Kierowca nie ma przypisanej "
                    "organizacji."
                )
            )

        if (
            vehicle.organization_id
            != driver.organization_id
        ):
            raise PermissionDenied(
                (
                    "Kierowca i pojazd muszą "
                    "należeć do tej samej "
                    "organizacji."
                )
            )

        membership = get_membership(
            self.request.user
        )

        if (
            membership is not None
            and (
                driver.organization_id
                != membership.organization_id
            )
        ):
            raise PermissionDenied(
                (
                    "Nie masz dostępu "
                    "do tego kierowcy."
                )
            )

    def perform_create(
        self,
        serializer,
    ):
        vehicle = (
            serializer.validated_data[
                "vehicle"
            ]
        )

        driver = (
            serializer.validated_data
            .get(
                "driver"
            )
        )

        self.check_write_access(
            vehicle
        )

        self.validate_driver_access(
            vehicle,
            driver,
        )

        with set_actor(
            self.request.user
        ):
            serializer.save()

    def perform_update(
        self,
        serializer,
    ):
        assignment = (
            self.get_object()
        )

        self.check_write_access(
            assignment.vehicle
        )

        vehicle = (
            serializer.validated_data
            .get(
                "vehicle",
                assignment.vehicle,
            )
        )

        driver = (
            serializer.validated_data
            .get(
                "driver",
                assignment.driver,
            )
        )

        self.check_write_access(
            vehicle
        )

        self.validate_driver_access(
            vehicle,
            driver,
        )

        with set_actor(
            self.request.user
        ):
            serializer.save()

    def perform_destroy(
        self,
        instance,
    ):
        self.check_write_access(
            instance.vehicle
        )

        with set_actor(
            self.request.user
        ):
            instance.delete()