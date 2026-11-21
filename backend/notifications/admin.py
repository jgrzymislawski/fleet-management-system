from django.contrib import admin

from .models import (
    NotificationLog,
    NotificationPreference,
    NotificationSettings,
)


@admin.register(NotificationSettings)
class NotificationSettingsAdmin(
    admin.ModelAdmin
):
    list_display = (
        "organization",
        "insurance_enabled",
        "inspection_enabled",
        "documents_enabled",
        "driver_license_enabled",
        "medical_exam_enabled",
        "updated_at",
    )

    list_filter = (
        "insurance_enabled",
        "inspection_enabled",
        "documents_enabled",
        "driver_license_enabled",
        "medical_exam_enabled",
    )

    search_fields = (
        "organization__name",
    )

    list_select_related = (
        "organization",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(
    admin.ModelAdmin
):
    list_display = (
        "user",
        "email_enabled",
        "insurance_enabled",
        "inspection_enabled",
        "documents_enabled",
        "driver_license_enabled",
        "medical_exam_enabled",
        "updated_at",
    )

    list_filter = (
        "email_enabled",
        "insurance_enabled",
        "inspection_enabled",
        "documents_enabled",
        "driver_license_enabled",
        "medical_exam_enabled",
    )

    search_fields = (
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
    )

    list_select_related = (
        "user",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(NotificationLog)
class NotificationLogAdmin(
    admin.ModelAdmin
):
    list_display = (
        "sent_at",
        "notification_type",
        "organization",
        "user",
        "vehicle",
        "driver",
        "recipient_email",
        "days_before",
    )

    list_filter = (
        "notification_type",
        "organization",
        "days_before",
        "sent_at",
    )

    search_fields = (
        "user__username",
        "user__email",
        "recipient_email",
        "subject",
        "vehicle__registration_number",
        "driver__first_name",
        "driver__last_name",
    )

    list_select_related = (
        "organization",
        "user",
        "vehicle",
        "driver",
    )

    readonly_fields = (
        "notification_type",
        "organization",
        "user",
        "vehicle",
        "driver",
        "source_id",
        "expiry_date",
        "days_before",
        "recipient_email",
        "subject",
        "sent_at",
    )

    ordering = (
        "-sent_at",
    )

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
        return request.user.is_superuser