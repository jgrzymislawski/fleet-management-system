
from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Organization,
    OrganizationMembership,
)


@override_settings(SECURE_SSL_REDIRECT=False)
class AdminAccountHardeningTests(APITestCase):

    def setUp(self):
        self.org_a = Organization.objects.create(
            name="Security Organization A"
        )

        self.org_b = Organization.objects.create(
            name="Security Organization B"
        )

        self.admin_a = User.objects.create_user(
            username="security_admin_a",
            password="TestPassword123!",
        )

        self.admin_b = User.objects.create_user(
            username="security_admin_b",
            password="TestPassword123!",
        )

        self.member_a = User.objects.create_user(
            username="security_member_a",
            password="TestPassword123!",
        )

        self.admin_membership_a = (
            OrganizationMembership.objects.create(
                user=self.admin_a,
                organization=self.org_a,
                role="admin",
            )
        )

        OrganizationMembership.objects.create(
            user=self.admin_b,
            organization=self.org_b,
            role="admin",
        )

        self.member_membership_a = (
            OrganizationMembership.objects.create(
                user=self.member_a,
                organization=self.org_a,
                role="member",
            )
        )

        self.admin_url = reverse(
            "admin-user-detail",
            kwargs={
                "membership_id": self.admin_membership_a.id
            },
        )

        self.member_url = reverse(
            "admin-user-detail",
            kwargs={
                "membership_id": self.member_membership_a.id
            },
        )

    def test_admin_cannot_deactivate_self_boolean(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.patch(
            self.admin_url,
            {"is_active": False},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.admin_a.refresh_from_db()
        self.assertTrue(self.admin_a.is_active)

    def test_admin_cannot_deactivate_self_string_false(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.patch(
            self.admin_url,
            {"is_active": "false"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.admin_a.refresh_from_db()
        self.assertTrue(self.admin_a.is_active)

    def test_admin_cannot_deactivate_self_string_zero(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.patch(
            self.admin_url,
            {"is_active": "0"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.admin_a.refresh_from_db()
        self.assertTrue(self.admin_a.is_active)

    def test_member_cannot_change_own_role(self):
        self.client.force_authenticate(user=self.member_a)

        response = self.client.patch(
            self.member_url,
            {"role": "admin"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.member_membership_a.refresh_from_db()
        self.assertEqual(
            self.member_membership_a.role,
            "member",
        )

    def test_foreign_admin_cannot_edit_member(self):
        self.client.force_authenticate(user=self.admin_b)

        response = self.client.patch(
            self.member_url,
            {"role": "admin"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.member_membership_a.refresh_from_db()
        self.assertEqual(
            self.member_membership_a.role,
            "member",
        )
