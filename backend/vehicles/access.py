"""Wspolne reguly dostepu do pojazdow Flotivo.

Administrator organizacji widzi rowniez historyczne pojazdy nieaktywnych
spolek. Zwykli uzytkownicy widza tylko aktywne przypisane spolki.
Pojazdy usuniete logicznie sa zawsze wykluczane.
"""

from rest_framework.exceptions import PermissionDenied

from organizations.models import CompanyAccess, OrganizationMembership

from .models import Vehicle


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
