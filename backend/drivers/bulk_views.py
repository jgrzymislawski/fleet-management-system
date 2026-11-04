from django.db import transaction

from auditlog.context import set_actor

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Driver

from .views import (
    ensure_driver_management_permission,
    get_membership,
    user_is_superuser,
)


class DriverBulkUpdateView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(
        self,
        request,
    ):
        driver_ids = request.data.get(
            "driver_ids",
            [],
        )

        action = request.data.get(
            "action",
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

        if not driver_ids:
            return Response(
                {
                    "detail": (
                        "Nie wybrano żadnych kierowców."
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
                        "Lista zawiera nieprawidłowe "
                        "ID kierowcy."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        driver_ids = list(
            dict.fromkeys(
                driver_ids
            )
        )

        allowed_actions = {
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

        try:
            ensure_driver_management_permission(
                request.user
            )

        except PermissionDenied as exc:
            return Response(
                {
                    "detail": str(
                        exc.detail
                    )
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        membership = get_membership(
            request.user
        )

        drivers = (
            Driver.active_objects
            .select_related(
                "organization"
            )
            .filter(
                id__in=driver_ids
            )
        )

        if membership is not None:
            drivers = drivers.filter(
                organization=(
                    membership.organization
                )
            )

        elif not user_is_superuser(
            request.user
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

        drivers_by_id = {
            driver.id: driver
            for driver in drivers
        }

        deleted = 0
        skipped = 0
        errors = []

        for driver_id in driver_ids:
            driver = (
                drivers_by_id.get(
                    driver_id
                )
            )

            if driver is None:
                skipped += 1

                errors.append(
                    {
                        "driver_id": (
                            driver_id
                        ),
                        "message": (
                            "Nie znaleziono kierowcy "
                            "lub nie masz do niego dostępu."
                        ),
                    }
                )

                continue

            try:
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

                driver_name = (
                    f"{driver.first_name} "
                    f"{driver.last_name}"
                ).strip()

                with transaction.atomic():
                    with set_actor(
                        request.user
                    ):
                        vehicles = (
                            driver.vehicles
                            .filter(
                                is_deleted=False
                            )
                        )

                        for vehicle in vehicles:
                            if (
                                vehicle.driver_id
                                != driver.id
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

                        driver.soft_delete()

                deleted += 1

            except PermissionDenied as exc:
                skipped += 1

                errors.append(
                    {
                        "driver_id": (
                            driver.id
                        ),
                        "driver": (
                            str(driver)
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
                        "driver_id": (
                            driver.id
                        ),
                        "driver": (
                            str(driver)
                        ),
                        "message": (
                            str(exc)
                        ),
                    }
                )

        return Response(
            {
                "deleted": deleted,
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