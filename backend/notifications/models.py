from django.conf import settings
from django.db import models

from drivers.models import Driver
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

    driver_license_enabled = models.BooleanField(
        default=True,
    )

    medical_exam_enabled = models.BooleanField(
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

    driver_license_enabled = models.BooleanField(
        default=True,
    )

    medical_exam_enabled = models.BooleanField(
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
        (
            "insurance",
            "Polisa OC",
        ),
        (
            "inspection",
            "Przegląd techniczny",
        ),
        (
            "document",
            "Dokument pojazdu",
        ),
        (
            "driver_license",
            "Prawo jazdy kierowcy",
        ),
        (
            "medical_exam",
            "Badania lekarskie kierowcy",
        ),
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
        null=True,
        blank=True,
    )

    driver = models.ForeignKey(
        Driver,
        on_delete=models.CASCADE,
        related_name="notification_logs",
        null=True,
        blank=True,
    )

    source_id = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    expiry_date = models.DateField(
        null=True,
        blank=True,
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
                    "source_id",
                    "expiry_date",
                    "days_before",
                ],
                name="unique_notification_event",
            )
        ]

    def __str__(self):
        subject_name = ""

        if self.vehicle:
            subject_name = str(self.vehicle)

        elif self.driver:
            subject_name = str(self.driver)

        return (
            f"{self.get_notification_type_display()} - "
            f"{subject_name} - "
            f"{self.user.username}"
        )