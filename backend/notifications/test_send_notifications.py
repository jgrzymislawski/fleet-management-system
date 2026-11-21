from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from organizations.models import (
    Company,
    Organization,
    OrganizationMembership,
)
from vehicles.models import Vehicle

from .models import (
    NotificationLog,
    NotificationPreference,
    NotificationSettings,
)


class SendNotificationsCommandTests(
    TestCase
):
    def setUp(self):
        self.organization = (
            Organization.objects.create(
                name="Organizacja A"
            )
        )

        self.company = (
            Company.objects.create(
                organization=(
                    self.organization
                ),
                name="Spółka A",
                tax_id="1111111111",
            )
        )

        self.user = (
            User.objects.create_user(
                username="admin",
                email="admin@example.com",
                password="TestPassword123!",
            )
        )

        OrganizationMembership.objects.create(
            user=self.user,
            organization=(
                self.organization
            ),
            role="admin",
        )

        NotificationPreference.objects.create(
            user=self.user,
        )

        NotificationSettings.objects.create(
            organization=(
                self.organization
            ),
            insurance_enabled=True,
            inspection_enabled=False,
            documents_enabled=False,
            driver_license_enabled=False,
            medical_exam_enabled=False,
            notify_30_days=False,
            notify_14_days=False,
            notify_7_days=True,
            notify_1_day=False,
        )

        self.vehicle = (
            Vehicle.objects.create(
                organization=(
                    self.organization
                ),
                company=self.company,
                brand="Ford",
                model="Focus",
                registration_number="DL11111",
                vin="WF0AAA11111111111",
                year=2020,
                insurance_expiry_date=(
                    timezone.localdate()
                    + timedelta(
                        days=7,
                    )
                ),
            )
        )

    @override_settings(
        EMAIL_BACKEND=(
            "django.core.mail.backends."
            "locmem.EmailBackend"
        )
    )
    def test_command_does_not_send_duplicate_notification(
        self,
    ):
        call_command(
            "send_notifications"
        )

        call_command(
            "send_notifications"
        )

        self.assertEqual(
            NotificationLog.objects.count(),
            1,
        )

    @patch(
        "notifications.management.commands."
        "send_notifications.send_mail"
    )
    def test_failed_send_releases_notification_reservation(
        self,
        mocked_send_mail,
    ):
        mocked_send_mail.side_effect = (
            RuntimeError(
                "SMTP error"
            )
        )

        call_command(
            "send_notifications"
        )

        self.assertEqual(
            NotificationLog.objects.count(),
            0,
        )
