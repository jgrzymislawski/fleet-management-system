from django.contrib import admin
from django.utils.html import format_html, format_html_join

from auditlog import get_logentry_model
from auditlog.admin import LogEntryAdmin

from .models import (
    Vehicle,
    ServiceRecord,
    VehicleDocument,
)


admin.site.register(Vehicle)
admin.site.register(ServiceRecord)
admin.site.register(VehicleDocument)


LogEntry = get_logentry_model()


try:
    admin.site.unregister(LogEntry)
except admin.sites.NotRegistered:
    pass


@admin.register(LogEntry)
class FlotivoLogEntryAdmin(LogEntryAdmin):
    list_display = [
        "created",
        "object_name",
        "action_name",
        "changes_summary",
        "actor_name",
    ]

    list_filter = [
        "action",
        "content_type",
        "timestamp",
    ]

    search_fields = [
        "object_repr",
        "changes",
        "actor__username",
        "actor__first_name",
        "actor__last_name",
        "actor__email",
    ]

    readonly_fields = [
        "created",
        "actor_name",
        "object_name",
        "action_name",
        "changes_details",
    ]

    fieldsets = [
        (
            "Informacje",
            {
                "fields": [
                    "created",
                    "actor_name",
                    "object_name",
                    "action_name",
                ]
            },
        ),
        (
            "Wprowadzone zmiany",
            {
                "fields": [
                    "changes_details",
                ]
            },
        ),
    ]

    @admin.display(
        description="Data",
        ordering="timestamp",
    )
    def created(self, obj):
        return obj.timestamp

    @admin.display(description="Obiekt")
    def object_name(self, obj):
        return obj.object_repr

    @admin.display(description="Użytkownik")
    def actor_name(self, obj):
        if not obj.actor:
            return "System"

        full_name = obj.actor.get_full_name()

        if full_name:
            return f"{full_name} ({obj.actor.username})"

        return obj.actor.username

    @admin.display(description="Akcja")
    def action_name(self, obj):
        if obj.action == LogEntry.Action.CREATE:
            return "Dodano"

        if obj.action == LogEntry.Action.UPDATE:
            return "Zmieniono"

        if obj.action == LogEntry.Action.DELETE:
            return "Usunięto"

        if obj.action == LogEntry.Action.ACCESS:
            return "Wyświetlono"

        return obj.get_action_display()

    @admin.display(description="Zmiany")
    def changes_summary(self, obj):
        changes = obj.changes_display_dict

        if not changes:
            return "-"

        parts = []

        for field_name, values in changes.items():
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
                f"{field_name}: "
                f"{self.format_value(old_value)} "
                f"→ "
                f"{self.format_value(new_value)}"
            )

        return " | ".join(parts)

    @admin.display(
        description="Szczegółowe zmiany"
    )
    def changes_details(self, obj):
        changes = obj.changes_display_dict

        if not changes:
            return "Brak zapisanych zmian."

        rows = []

        for field_name, values in changes.items():
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
                    self.format_value(old_value),
                    self.format_value(new_value),
                )
            )

        table_rows = format_html_join(
            "",
            """
            <tr>
                <td style="
                    padding: 10px;
                    font-weight: 600;
                    border-bottom: 1px solid #444;
                ">
                    {}
                </td>

                <td style="
                    padding: 10px;
                    border-bottom: 1px solid #444;
                ">
                    {}
                </td>

                <td style="
                    padding: 10px;
                    text-align: center;
                    border-bottom: 1px solid #444;
                ">
                    →
                </td>

                <td style="
                    padding: 10px;
                    border-bottom: 1px solid #444;
                ">
                    {}
                </td>
            </tr>
            """,
            rows,
        )

        return format_html(
            """
            <table style="
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #555;
            ">
                <thead>
                    <tr>
                        <th style="
                            padding: 10px;
                            text-align: left;
                        ">
                            Pole
                        </th>

                        <th style="
                            padding: 10px;
                            text-align: left;
                        ">
                            Przed zmianą
                        </th>

                        <th style="
                            padding: 10px;
                        ">
                        </th>

                        <th style="
                            padding: 10px;
                            text-align: left;
                        ">
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

    def format_value(self, value):
        if value is None:
            return "Brak"

        value = str(value)

        if value == "None":
            return "Brak"

        if value == "":
            return "Puste"

        return value

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(
        self,
        request,
        obj=None,
    ):
        return request.user.is_superuser

    def has_add_permission(self, request):
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