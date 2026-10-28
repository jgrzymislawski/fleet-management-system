from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from organizations.models import OrganizationMembership

from .models import Driver, DriverVehicleAssignment
from .serializers import DriverSerializer
from .assignment_serializers import DriverVehicleAssignmentSerializer


def user_is_superuser(user):
    return bool(getattr(user, "is_superuser", False))


def get_membership(user):
    if not getattr(user, "is_authenticated", False):
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

    def perform_create(self, serializer):
        user = self.request.user

        if user_is_superuser(user):
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

        serializer.save(
            organization=membership.organization
        )

    def perform_update(self, serializer):
        ensure_driver_management_permission(
            self.request.user
        )

        driver = self.get_object()

        if user_is_superuser(self.request.user):
            serializer.save()
            return

        membership = get_membership(self.request.user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
            )

        if driver.organization_id != membership.organization_id:
            raise PermissionDenied(
                "Nie masz dostępu do tego kierowcy."
            )

        serializer.save(
            organization=membership.organization
        )

    def perform_destroy(self, instance):
        ensure_driver_management_permission(
            self.request.user
        )

        if user_is_superuser(self.request.user):
            instance.delete()
            return

        membership = get_membership(self.request.user)

        if membership is None:
            raise PermissionDenied(
                "Nie jesteś przypisany do żadnej organizacji."
            )

        if instance.organization_id != membership.organization_id:
            raise PermissionDenied(
                "Nie masz dostępu do tego kierowcy."
            )

        instance.delete()


class DriverVehicleAssignmentViewSet(viewsets.ModelViewSet):
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

        company_ids = membership.company_accesses.values_list(
            "company_id",
            flat=True,
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

        if vehicle.organization_id != membership.organization_id:
            raise PermissionDenied(
                "Nie masz dostępu do tego pojazdu."
            )

        if membership.role == "admin":
            return

        if not vehicle.company_id:
            raise PermissionDenied(
                "Nie masz uprawnień do zarządzania "
                "przypisaniami tego pojazdu."
            )

        if not vehicle.company.is_active:
            raise PermissionDenied(
                "Nie można zmieniać przypisań "
                "w nieaktywnej spółce."
            )

        access = membership.company_accesses.filter(
            company_id=vehicle.company_id
        ).first()

        if access is None:
            raise PermissionDenied(
                "Nie masz dostępu do tej spółki."
            )

        if access.role != "editor":
            raise PermissionDenied(
                "Masz tylko uprawnienia do odczytu."
            )

    def validate_driver_access(self, vehicle, driver):
        if driver is None:
            return

        if (
            vehicle.organization_id
            and driver.organization_id
            and vehicle.organization_id
            != driver.organization_id
        ):
            raise PermissionDenied(
                "Kierowca i pojazd muszą należeć "
                "do tej samej organizacji."
            )

    def perform_create(self, serializer):
        vehicle = serializer.validated_data["vehicle"]
        driver = serializer.validated_data.get("driver")

        self.check_write_access(vehicle)
        self.validate_driver_access(
            vehicle,
            driver,
        )

        serializer.save()

    def perform_update(self, serializer):
        assignment = self.get_object()

        vehicle = serializer.validated_data.get(
            "vehicle",
            assignment.vehicle,
        )

        driver = serializer.validated_data.get(
            "driver",
            assignment.driver,
        )

        self.check_write_access(vehicle)
        self.validate_driver_access(
            vehicle,
            driver,
        )

        serializer.save()

    def perform_destroy(self, instance):
        self.check_write_access(
            instance.vehicle
        )

        instance.delete()