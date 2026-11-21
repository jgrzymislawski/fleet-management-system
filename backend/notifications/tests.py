from django.contrib.auth.models import User

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Organization,
    OrganizationMembership,
)

from .models import (
    NotificationPreference,
    NotificationSettings,
)


class NotificationSecurityTests(
    APITestCase
):
    def setUp(self):
        self.organization = (
            Organization.objects.create(
                name="Organizacja A"
            )
        )

        self.admin = (
            User.objects.create_user(
                username="admin",
                email="admin@example.com",
                password="TestPassword123!",
            )
        )

        self.member = (
            User.objects.create_user(
                username="member",
                email="member@example.com",
                password="TestPassword123!",
            )
        )

        self.admin_membership = (
            OrganizationMembership.objects.create(
                user=self.admin,
                organization=(
                    self.organization
                ),
                role="admin",
            )
        )

        self.member_membership = (
            OrganizationMembership.objects.create(
                user=self.member,
                organization=(
                    self.organization
                ),
                role="member",
            )
        )

    def authenticate(
        self,
        user,
    ):
        self.client.force_authenticate(
            user=user
        )

    def test_user_can_read_own_preferences(
        self,
    ):
        self.authenticate(
            self.member
        )

        response = self.client.get(
            "/api/notifications/preferences/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["email"],
            "member@example.com",
        )

        self.assertTrue(
            NotificationPreference.objects
            .filter(
                user=self.member
            )
            .exists()
        )

    def test_user_updates_only_own_preferences(
        self,
    ):
        NotificationPreference.objects.create(
            user=self.admin,
            email_enabled=True,
        )

        self.authenticate(
            self.member
        )

        response = self.client.patch(
            "/api/notifications/preferences/",
            {
                "email_enabled": False,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        member_preference = (
            NotificationPreference.objects.get(
                user=self.member
            )
        )

        admin_preference = (
            NotificationPreference.objects.get(
                user=self.admin
            )
        )

        self.assertFalse(
            member_preference.email_enabled
        )

        self.assertTrue(
            admin_preference.email_enabled
        )

    def test_member_cannot_access_admin_settings(
        self,
    ):
        self.authenticate(
            self.member
        )

        response = self.client.get(
            "/api/notifications/admin/settings/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_can_update_organization_settings(
        self,
    ):
        self.authenticate(
            self.admin
        )

        response = self.client.patch(
            "/api/notifications/admin/settings/",
            {
                "notify_30_days": False,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        settings_object = (
            NotificationSettings.objects.get(
                organization=(
                    self.organization
                )
            )
        )

        self.assertFalse(
            settings_object.notify_30_days
        )

    def test_inactive_organization_blocks_preferences(
        self,
    ):
        self.organization.is_active = False
        self.organization.save(
            update_fields=[
                "is_active",
            ]
        )

        self.authenticate(
            self.member
        )

        response = self.client.get(
            "/api/notifications/preferences/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_inactive_organization_blocks_admin_settings(
        self,
    ):
        self.organization.is_active = False
        self.organization.save(
            update_fields=[
                "is_active",
            ]
        )

        self.authenticate(
            self.admin
        )

        response = self.client.get(
            "/api/notifications/admin/settings/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_settings_require_at_least_one_notification_day(
        self,
    ):
        self.authenticate(
            self.admin
        )

        response = self.client.put(
            "/api/notifications/admin/settings/",
            {
                "insurance_enabled": True,
                "inspection_enabled": True,
                "documents_enabled": True,
                "driver_license_enabled": True,
                "medical_exam_enabled": True,
                "notify_30_days": False,
                "notify_14_days": False,
                "notify_7_days": False,
                "notify_1_day": False,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
