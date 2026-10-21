from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from organizations.models import OrganizationMembership
from .models import Driver
from .serializers import DriverSerializer


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