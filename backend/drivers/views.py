from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from auditlog.context import set_actor

from organizations.models import OrganizationMembership

from .models import (
    Driver,
    DriverVehicleAssignment,
)

from .serializers import DriverSerializer
from .assignment_serializers import DriverVehicleAssignmentSerializer
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
        .select_related("organization")
        .filter(user=user)
        .first()
    )


def ensure_driver_management_permission(user):
    if user_is_superuser(user):
        return

    membership = get_membership(user)

    if membership is None:
        raise PermissionDenied(
            "Nie jesteś przypisany do żadnej organizacji."
        )

    if membership.role != "admin":
        raise PermissionDenied(
            "Nie masz uprawnień do zarządzania kierowcami."
        )


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user_is_superuser(user):
            return Driver.objects.all()

        membership = get_membership(user)

        if membership is None:
            return Driver.objects.none()

        return Driver.objects.filter(
            organization=membership.organization
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="export",
    )
    def export(self, request):
        driver_ids = request.data.get(
            "driver_ids",
            [],
        )

        if not isinstance(driver_ids, list):
            return Response(
                {
                    "detail": "driver_ids musi być listą."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            driver_ids = [
                int(driver_id)
                for driver_id in driver_ids
            ]
        except (TypeError, ValueError):
            return Response(
                {
                    "detail": "Nieprawidłowe ID kierowcy."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset()

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
                drivers_by_id[driver_id]
                for driver_id in driver_ids
                if driver_id in drivers_by_id
            ]
        else:
            drivers = list(
                queryset.order_by(
                    "last_name",
                    "first_name",
                )
            )

        workbook = create_driver_workbook(
            drivers
        )

        output = BytesIO()

        workbook.save(output)

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
            .filter(pk=pk)
            .first()
        )

        if driver is None:
            return Response(
                {
                    "detail": "Nie znaleziono kierowcy."
                },
                status=status.HTTP_404_NOT_FOUND,
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
            content_type="application/pdf",
        )

        response[
            "Content-Disposition"
        ] = (
            f'attachment; filename="{filename}"'
        )

        return response

    def perform_create(self, serializer):
        user = self.request.user

        if user_is_superuser(user):
            with set_actor(user):
                serializer.save()

            return

        membership = get_membership(user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
            )

        if membership.role != "admin":
            raise PermissionDenied(
                "Nie masz uprawnień do dodawania kierowców."
            )

        with set_actor(user):
            serializer.save(
                organization=membership.organization
            )

    def perform_update(self, serializer):
        user = self.request.user

        ensure_driver_management_permission(user)

        driver = self.get_object()

        if user_is_superuser(user):
            with set_actor(user):
                serializer.save()

            return

        membership = get_membership(user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
            )

        if (
            driver.organization_id
            != membership.organization_id
        ):
            raise PermissionDenied(
                "Nie masz dostępu do tego kierowcy."
            )

        with set_actor(user):
            serializer.save(
                organization=membership.organization
            )

    def perform_destroy(self, instance):
        user = self.request.user

        ensure_driver_management_permission(user)

        if user_is_superuser(user):
            with set_actor(user):
                instance.delete()

            return

        membership = get_membership(user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
            )

        if (
            instance.organization_id
            != membership.organization_id
        ):
            raise PermissionDenied(
                "Nie masz dostępu do tego kierowcy."
            )

        with set_actor(user):
            instance.delete()


class DriverVehicleAssignmentViewSet(
    viewsets.ModelViewSet
):
    queryset = DriverVehicleAssignment.objects.all()
    serializer_class = DriverVehicleAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            DriverVehicleAssignment.objects
            .select_related(
                "vehicle",
                "vehicle__company",
                "vehicle__organization",
                "driver",
            )
        )

        if user_is_superuser(user):
            return queryset

        membership = get_membership(user)

        if membership is None:
            return DriverVehicleAssignment.objects.none()

        queryset = queryset.filter(
            vehicle__organization=membership.organization
        )

        if membership.role == "admin":
            return queryset

        company_ids = (
            membership.company_accesses
            .values_list(
                "company_id",
                flat=True,
            )
        )

        return queryset.filter(
            vehicle__company_id__in=company_ids,
            vehicle__company__is_active=True,
        )

    def check_write_access(self, vehicle):
        user = self.request.user

        if user_is_superuser(user):
            return

        membership = get_membership(user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
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

        if not vehicle.company_id:
            raise PermissionDenied(
                "Nie masz uprawnień do zarządzania przypisaniami tego pojazdu."
            )

        if not vehicle.company.is_active:
            raise PermissionDenied(
                "Nie można zmieniać przypisań w nieaktywnej spółce."
            )

        access = (
            membership.company_accesses
            .filter(
                company_id=vehicle.company_id
            )
            .first()
        )

        if access is None:
            raise PermissionDenied(
                "Nie masz dostępu do tej spółki."
            )

        if access.role != "editor":
            raise PermissionDenied(
                "Masz tylko uprawnienia do odczytu."
            )

    def validate_driver_access(
        self,
        vehicle,
        driver,
    ):
        if driver is None:
            return

        if (
            vehicle.organization_id
            and driver.organization_id
            and vehicle.organization_id
            != driver.organization_id
        ):
            raise PermissionDenied(
                "Kierowca i pojazd muszą należeć do tej samej organizacji."
            )

    def perform_create(self, serializer):
        vehicle = serializer.validated_data[
            "vehicle"
        ]

        driver = (
            serializer.validated_data
            .get("driver")
        )

        self.check_write_access(vehicle)

        self.validate_driver_access(
            vehicle,
            driver,
        )

        with set_actor(self.request.user):
            serializer.save()

    def perform_update(self, serializer):
        assignment = self.get_object()

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

        self.check_write_access(vehicle)

        self.validate_driver_access(
            vehicle,
            driver,
        )

        with set_actor(self.request.user):
            serializer.save()

    def perform_destroy(self, instance):
        self.check_write_access(
            instance.vehicle
        )

        with set_actor(self.request.user):
            instance.delete()