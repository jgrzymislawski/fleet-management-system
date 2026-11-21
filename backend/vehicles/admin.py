from django.contrib import (
    admin,
    messages,
)
from django.utils.html import (
    format_html,
    format_html_join,
)

from auditlog import (
    get_logentry_model,
)
from auditlog.admin import (
    LogEntryAdmin,
)
from auditlog.context import (
    set_actor,
)

from .models import (
    ServiceRecord,
    Vehicle,
    VehicleDocument,
)


SENSITIVE_FIELD_FRAGMENTS = (
    "password",
    "token",
    "secret",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
)


def is_sensitive_field(
    field_name,
):
    normalized = (
        str(
            field_name or ""
        )
        .strip()
        .lower()
        .replace(
            "-",
            "_",
        )
    )

    return any(
        fragment in normalized
        for fragment
        in SENSITIVE_FIELD_FRAGMENTS
    )


class VehicleDeletedStatusFilter(
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
                "Aktywne",
            ),
            (
                "deleted",
                "Usunięte",
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


@admin.register(Vehicle)
class VehicleAdmin(
    admin.ModelAdmin
):
    list_display = (
        "id",
        "registration_number",
        "brand",
        "model",
        "organization",
        "company",
        "status",
        "is_deleted",
        "deleted_at",
    )

    list_filter = (
        VehicleDeletedStatusFilter,
        "status",
        "organization",
        "company",
    )

    search_fields = (
        "registration_number",
        "vin",
        "brand",
        "model",
    )

    list_select_related = (
        "organization",
        "company",
        "driver",
    )

    ordering = (
        "-id",
    )

    readonly_fields = (
        "deleted_at",
    )

    actions = (
        "soft_delete_selected",
        "restore_selected",
    )

    @admin.action(
        description=(
            "Przenieś zaznaczone pojazdy do kosza"
        )
    )
    def soft_delete_selected(
        self,
        request,
        queryset,
    ):
        deleted = 0
        skipped = 0

        with set_actor(
            request.user
        ):
            for vehicle in queryset:
                if vehicle.is_deleted:
                    skipped += 1
                    continue

                vehicle.soft_delete()
                deleted += 1

        if deleted:
            self.message_user(
                request,
                (
                    "Przeniesiono pojazdy "
                    f"do kosza: {deleted}."
                ),
                level=messages.SUCCESS,
            )

        if skipped:
            self.message_user(
                request,
                (
                    "Pominięto pojazdy już "
                    f"usunięte: {skipped}."
                ),
                level=messages.WARNING,
            )

    @admin.action(
        description=(
            "Przywróć zaznaczone pojazdy"
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
            for vehicle in queryset:
                if not vehicle.is_deleted:
                    skipped += 1
                    continue

                try:
                    vehicle.restore()
                    restored += 1

                except Exception as exc:
                    errors.append(
                        (
                            f"{vehicle}: "
                            f"{exc}"
                        )
                    )

        if restored:
            self.message_user(
                request,
                (
                    "Przywrócono pojazdy: "
                    f"{restored}."
                ),
                level=messages.SUCCESS,
            )

        if skipped:
            self.message_user(
                request,
                (
                    "Pominięto aktywnych "
                    f"pojazdów: {skipped}."
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

        with set_actor(
            request.user
        ):
            obj.soft_delete()

    def delete_queryset(
        self,
        request,
        queryset,
    ):
        with set_actor(
            request.user
        ):
            for vehicle in queryset:
                if vehicle.is_deleted:
                    continue

                vehicle.soft_delete()


@admin.register(ServiceRecord)
class ServiceRecordAdmin(
    admin.ModelAdmin
):
    list_display = (
        "id",
        "vehicle",
        "service_date",
        "title",
        "mileage",
        "cost",
        "created_at",
    )

    list_filter = (
        "service_date",
        "vehicle__organization",
        "vehicle__company",
    )

    search_fields = (
        "vehicle__registration_number",
        "vehicle__brand",
        "vehicle__model",
        "title",
        "description",
    )

    list_select_related = (
        "vehicle",
        "vehicle__organization",
        "vehicle__company",
    )

    ordering = (
        "-service_date",
        "-created_at",
    )

    readonly_fields = (
        "created_at",
    )


@admin.register(VehicleDocument)
class VehicleDocumentAdmin(
    admin.ModelAdmin
):
    list_display = (
        "id",
        "vehicle",
        "document_type",
        "document_number",
        "issue_date",
        "expiry_date",
        "cost",
        "created_at",
    )

    list_filter = (
        "document_type",
        "expiry_date",
        "vehicle__organization",
        "vehicle__company",
    )

    search_fields = (
        "vehicle__registration_number",
        "document_number",
        "notes",
    )

    list_select_related = (
        "vehicle",
        "vehicle__organization",
        "vehicle__company",
    )

    ordering = (
        "-created_at",
    )

    readonly_fields = (
        "created_at",
    )


LogEntry = get_logentry_model()


try:
    admin.site.unregister(
        LogEntry
    )

except admin.sites.NotRegistered:
    pass


@admin.register(LogEntry)
class FlotivoLogEntryAdmin(
    LogEntryAdmin
):
    list_display = (
        "created",
        "object_name",
        "action_name",
        "changes_summary",
        "actor_name",
    )

    list_filter = (
        "action",
        "content_type",
        "timestamp",
    )

    search_fields = (
        "object_repr",
        "actor__username",
        "actor__first_name",
        "actor__last_name",
        "actor__email",
    )

    readonly_fields = (
        "created",
        "actor_name",
        "object_name",
        "action_name",
        "changes_details",
    )

    fieldsets = (
        (
            "Informacje",
            {
                "fields": (
                    "created",
                    "actor_name",
                    "object_name",
                    "action_name",
                )
            },
        ),
        (
            "Wprowadzone zmiany",
            {
                "fields": (
                    "changes_details",
                )
            },
        ),
    )

    @admin.display(
        description="Data",
        ordering="timestamp",
    )
    def created(
        self,
        obj,
    ):
        return obj.timestamp

    @admin.display(
        description="Obiekt",
    )
    def object_name(
        self,
        obj,
    ):
        return obj.object_repr

    @admin.display(
        description="Użytkownik",
    )
    def actor_name(
        self,
        obj,
    ):
        if not obj.actor:
            return "System"

        full_name = (
            obj.actor.get_full_name()
        )

        if full_name:
            return (
                f"{full_name} "
                f"({obj.actor.username})"
            )

        return obj.actor.username

    @admin.display(
        description="Akcja",
    )
    def action_name(
        self,
        obj,
    ):
        if (
            obj.action
            == LogEntry.Action.CREATE
        ):
            return "Dodano"

        if (
            obj.action
            == LogEntry.Action.UPDATE
        ):
            return "Zmieniono"

        if (
            obj.action
            == LogEntry.Action.DELETE
        ):
            return "Usunięto"

        if (
            obj.action
            == LogEntry.Action.ACCESS
        ):
            return "Wyświetlono"

        return obj.get_action_display()

    def format_value(
        self,
        field_name,
        value,
    ):
        if is_sensitive_field(
            field_name
        ):
            return "********"

        if value is None:
            return "Brak"

        value = str(
            value
        )

        if value == "None":
            return "Brak"

        if value == "":
            return "Puste"

        return value

    @admin.display(
        description="Zmiany",
    )
    def changes_summary(
        self,
        obj,
    ):
        changes = (
            obj.changes_display_dict
        )

        if not changes:
            return "-"

        parts = []

        for (
            field_name,
            values,
        ) in changes.items():
            old_value = (
                values[0]
                if len(values) > 0
                else None
            )

            new_value = (
                values[1]
                if len(values) > 1
                else None
            )

            parts.append(
                (
                    f"{field_name}: "
                    f"{self.format_value(field_name, old_value)} "
                    "→ "
                    f"{self.format_value(field_name, new_value)}"
                )
            )

        return " | ".join(
            parts
        )

    @admin.display(
        description="Szczegółowe zmiany",
    )
    def changes_details(
        self,
        obj,
    ):
        changes = (
            obj.changes_display_dict
        )

        if not changes:
            return (
                "Brak zapisanych zmian."
            )

        rows = []

        for (
            field_name,
            values,
        ) in changes.items():
            old_value = (
                values[0]
                if len(values) > 0
                else None
            )

            new_value = (
                values[1]
                if len(values) > 1
                else None
            )

            rows.append(
                (
                    field_name,
                    self.format_value(
                        field_name,
                        old_value,
                    ),
                    self.format_value(
                        field_name,
                        new_value,
                    ),
                )
            )

        table_rows = format_html_join(
            "",
            """
            <tr>
                <td style="padding:10px;font-weight:600;border-bottom:1px solid #444;">
                    {}
                </td>
                <td style="padding:10px;border-bottom:1px solid #444;">
                    {}
                </td>
                <td style="padding:10px;text-align:center;border-bottom:1px solid #444;">
                    →
                </td>
                <td style="padding:10px;border-bottom:1px solid #444;">
                    {}
                </td>
            </tr>
            """,
            rows,
        )

        return format_html(
            """
            <table style="width:100%;border-collapse:collapse;border:1px solid #555;">
                <thead>
                    <tr>
                        <th style="padding:10px;text-align:left;">
                            Pole
                        </th>
                        <th style="padding:10px;text-align:left;">
                            Przed zmianą
                        </th>
                        <th style="padding:10px;">
                        </th>
                        <th style="padding:10px;text-align:left;">
                            Po zmianie
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {}
                </tbody>
            </table>
            """,
            table_rows,
        )

    def has_module_permission(
        self,
        request,
    ):
        return request.user.is_superuser

    def has_view_permission(
        self,
        request,
        obj=None,
    ):
        return request.user.is_superuser

    def has_add_permission(
        self,
        request,
    ):
        return False

    def has_change_permission(
        self,
        request,
        obj=None,
    ):
        return False

    def has_delete_permission(
        self,
        request,
        obj=None,
    ):
        return False