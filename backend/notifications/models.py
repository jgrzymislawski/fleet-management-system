from django.conf import settings
from django.db import models

from organizations.models import Organization
from vehicles.models import Vehicle


class NotificationSettings(models.Model):
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name="notification_settings",
    )

    insurance_enabled = models.BooleanField(
        default=True,
    )

    inspection_enabled = models.BooleanField(
        default=True,
    )

    documents_enabled = models.BooleanField(
        default=True,
    )

    notify_30_days = models.BooleanField(
        default=True,
    )

    notify_14_days = models.BooleanField(
        default=True,
    )

    notify_7_days = models.BooleanField(
        default=True,
    )

    notify_1_day = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return (
            f"Ustawienia powiadomień - "
            f"{self.organization.name}"
        )


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preference",
    )

    email_enabled = models.BooleanField(
        default=True,
    )

    insurance_enabled = models.BooleanField(
        default=True,
    )

    inspection_enabled = models.BooleanField(
        default=True,
    )

    documents_enabled = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return (
            f"Preferencje powiadomień - "
            f"{self.user.username}"
        )


class NotificationLog(models.Model):
    TYPE_CHOICES = [
        ("insurance", "Polisa OC"),
        ("inspection", "Przegląd techniczny"),
        ("document", "Dokument pojazdu"),
    ]

    notification_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="notification_logs",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_logs",
    )

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="notification_logs",
    )

    days_before = models.PositiveIntegerField()

    recipient_email = models.EmailField()

    subject = models.CharField(
        max_length=255,
    )

    sent_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-sent_at",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "notification_type",
                    "user",
                    "vehicle",
                    "days_before",
                ],
                name="unique_vehicle_notification",
            )
        ]

    def __str__(self):
        return (
            f"{self.get_notification_type_display()} - "
            f"{self.vehicle} - "
            f"{self.user.username}"
        )