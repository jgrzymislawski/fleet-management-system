from django.db import transaction

from auditlog.context import set_actor

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import Company

from .models import Vehicle

from .views import (
    ensure_vehicle_edit_permission,
    get_membership,
    user_is_superuser,
    validate_company_for_vehicle,
)


class VehicleBulkUpdateView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(
        self,
        request,
    ):
        vehicle_ids = request.data.get(
            "vehicle_ids",
            [],
        )

        action = request.data.get(
            "action",
        )

        value = request.data.get(
            "value",
        )

        if not isinstance(
            vehicle_ids,
            list,
        ):
            return Response(
                {
                    "detail": (
                        "vehicle_ids musi być listą."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        if not vehicle_ids:
            return Response(
                {
                    "detail": (
                        "Nie wybrano żadnych pojazdów."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        try:
            vehicle_ids = [
                int(vehicle_id)
                for vehicle_id
                in vehicle_ids
            ]

        except (
            TypeError,
            ValueError,
        ):
            return Response(
                {
                    "detail": (
                        "Lista zawiera nieprawidłowe "
                        "ID pojazdu."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        vehicle_ids = list(
            dict.fromkeys(
                vehicle_ids
            )
        )

        allowed_actions = {
            "change_status",
            "change_company",
            "change_branch",
            "delete",
        }

        if action not in allowed_actions:
            return Response(
                {
                    "detail": (
                        "Nieprawidłowa operacja masowa."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        membership = get_membership(
            request.user
        )

        if (
            membership is None
            and not user_is_superuser(
                request.user
            )
        ):
            return Response(
                {
                    "detail": (
                        "Użytkownik nie jest przypisany "
                        "do żadnej organizacji."
                    )
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        company = None

        if action == "change_status":
            valid_statuses = {
                choice[0]
                for choice
                in Vehicle.STATUS_CHOICES
            }

            if value not in valid_statuses:
                return Response(
                    {
                        "detail": (
                            "Nieprawidłowy status pojazdu."
                        )
                    },
                    status=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

        if action == "change_branch":
            if value is None:
                value = ""

            if not isinstance(
                value,
                str,
            ):
                return Response(
                    {
                        "detail": (
                            "Oddział musi być tekstem."
                        )
                    },
                    status=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

            value = value.strip()

            if len(value) > 150:
                return Response(
                    {
                        "detail": (
                            "Nazwa oddziału może mieć "
                            "maksymalnie 150 znaków."
                        )
                    },
                    status=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

        if action == "change_company":
            if value in (
                None,
                "",
                "null",
            ):
                company = None

                if (
                    membership is not None
                    and membership.role
                    != "admin"
                ):
                    return Response(
                        {
                            "detail": (
                                "Tylko administrator może "
                                "usunąć przypisanie pojazdu "
                                "do spółki."
                            )
                        },
                        status=(
                            status.HTTP_403_FORBIDDEN
                        ),
                    )

                if (
                    membership is None
                    and not user_is_superuser(
                        request.user
                    )
                ):
                    return Response(
                        {
                            "detail": (
                                "Nie masz uprawnień "
                                "do tej operacji."
                            )
                        },
                        status=(
                            status.HTTP_403_FORBIDDEN
                        ),
                    )

            else:
                try:
                    company_id = int(
                        value
                    )

                except (
                    TypeError,
                    ValueError,
                ):
                    return Response(
                        {
                            "detail": (
                                "Nieprawidłowe ID spółki."
                            )
                        },
                        status=(
                            status.HTTP_400_BAD_REQUEST
                        ),
                    )

                if membership is not None:
                    company = (
                        Company.objects
                        .filter(
                            id=company_id,
                            organization=(
                                membership.organization
                            ),
                            is_active=True,
                        )
                        .first()
                    )

                    if company is None:
                        return Response(
                            {
                                "detail": (
                                    "Nie znaleziono aktywnej "
                                    "spółki w Twojej organizacji."
                                )
                            },
                            status=(
                                status.HTTP_404_NOT_FOUND
                            ),
                        )

                    try:
                        validate_company_for_vehicle(
                            membership,
                            company,
                        )

                    except PermissionDenied as exc:
                        return Response(
                            {
                                "detail": (
                                    str(
                                        exc.detail
                                    )
                                )
                            },
                            status=(
                                status.HTTP_403_FORBIDDEN
                            ),
                        )

                elif user_is_superuser(
                    request.user
                ):
                    company = (
                        Company.objects
                        .filter(
                            id=company_id,
                            is_active=True,
                            organization__is_active=True,
                        )
                        .first()
                    )

                    if company is None:
                        return Response(
                            {
                                "detail": (
                                    "Nie znaleziono aktywnej "
                                    "spółki."
                                )
                            },
                            status=(
                                status.HTTP_404_NOT_FOUND
                            ),
                        )

                else:
                    return Response(
                        {
                            "detail": (
                                "Nie masz uprawnień "
                                "do tej operacji."
                            )
                        },
                        status=(
                            status.HTTP_403_FORBIDDEN
                        ),
                    )

        vehicles = (
            Vehicle.active_objects
            .select_related(
                "company",
                "organization",
            )
            .filter(
                id__in=vehicle_ids
            )
        )

        if membership is not None:
            vehicles = vehicles.filter(
                organization=(
                    membership.organization
                )
            )

        vehicles_by_id = {
            vehicle.id: vehicle
            for vehicle in vehicles
        }

        updated = 0
        deleted = 0
        unchanged = 0
        skipped = 0
        errors = []

        for vehicle_id in vehicle_ids:
            vehicle = (
                vehicles_by_id.get(
                    vehicle_id
                )
            )

            if vehicle is None:
                skipped += 1

                errors.append(
                    {
                        "vehicle_id": (
                            vehicle_id
                        ),
                        "message": (
                            "Nie znaleziono pojazdu "
                            "lub nie masz do niego dostępu."
                        ),
                    }
                )

                continue

            try:
                ensure_vehicle_edit_permission(
                    request.user,
                    vehicle,
                )

                if action == "change_company":
                    if (
                        company is not None
                        and (
                            vehicle.organization_id
                            is None
                        )
                    ):
                        raise PermissionDenied(
                            (
                                "Pojazd nie ma przypisanej "
                                "organizacji."
                            )
                        )

                    if (
                        company is not None
                        and (
                            company.organization_id
                            != vehicle.organization_id
                        )
                    ):
                        raise PermissionDenied(
                            (
                                "Nie można przypisać pojazdu "
                                "do spółki z innej organizacji."
                            )
                        )

                changed = False

                with transaction.atomic():
                    with set_actor(
                        request.user
                    ):
                        if action == "change_status":
                            if (
                                vehicle.status
                                != value
                            ):
                                vehicle.status = value

                                vehicle.save(
                                    update_fields=[
                                        "status",
                                    ]
                                )

                                changed = True

                        elif action == "change_branch":
                            if (
                                vehicle.branch
                                != value
                            ):
                                vehicle.branch = value

                                vehicle.save(
                                    update_fields=[
                                        "branch",
                                    ]
                                )

                                changed = True

                        elif action == "change_company":
                            new_company_id = (
                                company.id
                                if company
                                else None
                            )

                            if (
                                vehicle.company_id
                                != new_company_id
                            ):
                                vehicle.company = (
                                    company
                                )

                                vehicle.save(
                                    update_fields=[
                                        "company",
                                    ]
                                )

                                changed = True

                        elif action == "delete":
                            vehicle.soft_delete()
                            changed = True

                if changed:
                    if action == "delete":
                        deleted += 1
                    else:
                        updated += 1

                else:
                    unchanged += 1

            except PermissionDenied as exc:
                skipped += 1

                errors.append(
                    {
                        "vehicle_id": (
                            vehicle.id
                        ),
                        "vehicle": (
                            str(vehicle)
                        ),
                        "message": (
                            str(
                                exc.detail
                            )
                        ),
                    }
                )

            except Exception as exc:
                skipped += 1

                errors.append(
                    {
                        "vehicle_id": (
                            vehicle.id
                        ),
                        "vehicle": (
                            str(vehicle)
                        ),
                        "message": (
                            str(exc)
                        ),
                    }
                )

        return Response(
            {
                "updated": updated,
                "deleted": deleted,
                "unchanged": unchanged,
                "skipped": skipped,
                "errors_count": (
                    len(errors)
                ),
                "errors": errors,
            },
            status=(
                status.HTTP_200_OK
            ),
        )