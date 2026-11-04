from django.contrib import admin, messages
from django.db import transaction

from auditlog.context import set_actor

from .models import Driver


class DriverDeletedStatusFilter(
    admin.SimpleListFilter
):
    title = "stan rekordu"
    parameter_name = "deleted_status"

    def lookups(
        self,
        request,
        model_admin,
    ):
        return (
            (
                "active",
                "Aktywni",
            ),
            (
                "deleted",
                "Usunięci",
            ),
        )

    def queryset(
        self,
        request,
        queryset,
    ):
        if self.value() == "active":
            return queryset.filter(
                is_deleted=False
            )

        if self.value() == "deleted":
            return queryset.filter(
                is_deleted=True
            )

        return queryset


@admin.register(Driver)
class DriverAdmin(
    admin.ModelAdmin
):
    list_display = (
        "id",
        "first_name",
        "last_name",
        "license_number",
        "organization",
        "is_deleted",
        "deleted_at",
    )

    list_filter = (
        DriverDeletedStatusFilter,
        "organization",
    )

    search_fields = (
        "first_name",
        "last_name",
        "license_number",
        "phone_number",
    )

    ordering = (
        "last_name",
        "first_name",
    )

    readonly_fields = (
        "deleted_at",
    )

    actions = (
        "soft_delete_selected",
        "restore_selected",
    )

    def soft_delete_driver(
        self,
        request,
        driver,
    ):
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

    @admin.action(
        description=(
            "Przenieś zaznaczonych kierowców do kosza"
        )
    )
    def soft_delete_selected(
        self,
        request,
        queryset,
    ):
        deleted = 0
        skipped = 0

        for driver in queryset:
            if driver.is_deleted:
                skipped += 1
                continue

            self.soft_delete_driver(
                request,
                driver,
            )

            deleted += 1

        if deleted:
            self.message_user(
                request,
                (
                    "Przeniesiono kierowców "
                    f"do kosza: {deleted}."
                ),
                level=messages.SUCCESS,
            )

        if skipped:
            self.message_user(
                request,
                (
                    "Pominięto kierowców już "
                    f"usuniętych: {skipped}."
                ),
                level=messages.WARNING,
            )

    @admin.action(
        description=(
            "Przywróć zaznaczonych kierowców"
        )
    )
    def restore_selected(
        self,
        request,
        queryset,
    ):
        restored = 0
        skipped = 0
        errors = []

        with set_actor(
            request.user
        ):
            for driver in queryset:
                if not driver.is_deleted:
                    skipped += 1
                    continue

                try:
                    driver.restore()

                    restored += 1

                except Exception as exc:
                    errors.append(
                        (
                            f"{driver}: "
                            f"{exc}"
                        )
                    )

        if restored:
            self.message_user(
                request,
                (
                    "Przywrócono kierowców: "
                    f"{restored}."
                ),
                level=messages.SUCCESS,
            )

        if skipped:
            self.message_user(
                request,
                (
                    "Pominięto aktywnych "
                    f"kierowców: {skipped}."
                ),
                level=messages.WARNING,
            )

        for error in errors:
            self.message_user(
                request,
                error,
                level=messages.ERROR,
            )

    def delete_model(
        self,
        request,
        obj,
    ):
        if obj.is_deleted:
            return

        self.soft_delete_driver(
            request,
            obj,
        )

    def delete_queryset(
        self,
        request,
        queryset,
    ):
        for driver in queryset:
            if driver.is_deleted:
                continue

            self.soft_delete_driver(
                request,
                driver,
            )