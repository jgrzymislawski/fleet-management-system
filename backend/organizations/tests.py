from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)


class OrganizationSecurityTests(
    APITestCase
):
    def setUp(self):
        self.organization_a = (
            Organization.objects.create(
                name="Organizacja A"
            )
        )

        self.organization_b = (
            Organization.objects.create(
                name="Organizacja B"
            )
        )

        self.company_a = (
            Company.objects.create(
                organization=(
                    self.organization_a
                ),
                name="Spółka A",
                tax_id="1111111111",
            )
        )

        self.company_b = (
            Company.objects.create(
                organization=(
                    self.organization_b
                ),
                name="Spółka B",
                tax_id="2222222222",
            )
        )

        self.admin_a = (
            User.objects.create_user(
                username="admin_a",
                email="admin_a@example.com",
                password="TestPassword123!",
            )
        )

        self.admin_b = (
            User.objects.create_user(
                username="admin_b",
                email="admin_b@example.com",
                password="TestPassword123!",
            )
        )

        self.member_a = (
            User.objects.create_user(
                username="member_a",
                email="member_a@example.com",
                password="TestPassword123!",
            )
        )

        self.admin_membership_a = (
            OrganizationMembership.objects.create(
                user=self.admin_a,
                organization=(
                    self.organization_a
                ),
                role="admin",
            )
        )

        self.admin_membership_b = (
            OrganizationMembership.objects.create(
                user=self.admin_b,
                organization=(
                    self.organization_b
                ),
                role="admin",
            )
        )

        self.member_membership_a = (
            OrganizationMembership.objects.create(
                user=self.member_a,
                organization=(
                    self.organization_a
                ),
                role="member",
            )
        )

        CompanyAccess.objects.create(
            membership=(
                self.member_membership_a
            ),
            company=self.company_a,
            role="viewer",
        )

    def authenticate(
        self,
        user,
    ):
        self.client.force_authenticate(
            user=user
        )

    def test_admin_sees_only_own_organization_companies(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            reverse(
                "admin-company-list-create"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        company_ids = {
            item["id"]
            for item in response.data
        }

        self.assertIn(
            self.company_a.id,
            company_ids,
        )

        self.assertNotIn(
            self.company_b.id,
            company_ids,
        )

    def test_admin_cannot_read_company_from_other_organization(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            reverse(
                "admin-company-detail",
                kwargs={
                    "company_id": (
                        self.company_b.id
                    ),
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_admin_cannot_edit_company_from_other_organization(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.patch(
            reverse(
                "admin-company-detail",
                kwargs={
                    "company_id": (
                        self.company_b.id
                    ),
                },
            ),
            {
                "name": "Zmieniona nazwa",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.company_b.refresh_from_db()

        self.assertEqual(
            self.company_b.name,
            "Spółka B",
        )

    def test_admin_cannot_read_user_from_other_organization(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            reverse(
                "admin-user-detail",
                kwargs={
                    "membership_id": (
                        self.admin_membership_b.id
                    ),
                },
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_member_cannot_access_admin_companies(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.get(
            reverse(
                "admin-company-list-create"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_member_cannot_access_admin_users(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.get(
            reverse(
                "admin-user-list"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_member_sees_only_assigned_companies(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.get(
            reverse(
                "company-list"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        company_ids = {
            item["id"]
            for item in response.data
        }

        self.assertEqual(
            company_ids,
            {
                self.company_a.id,
            },
        )

    def test_company_access_cannot_cross_organizations(
        self,
    ):
        access = CompanyAccess(
            membership=(
                self.member_membership_a
            ),
            company=self.company_b,
            role="viewer",
        )

        with self.assertRaises(
            ValidationError
        ):
            access.full_clean()

    def test_current_user_contains_only_own_organization(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.get(
            reverse(
                "current-user"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data[
                "organization"
            ][
                "id"
            ],
            self.organization_a.id,
        )

        company_ids = {
            item["id"]
            for item in response.data[
                "companies"
            ]
        }

        self.assertEqual(
            company_ids,
            {
                self.company_a.id,
            },
        )

    def test_inactive_organization_is_blocked(
        self,
    ):
        self.organization_a.is_active = False

        self.organization_a.save(
            update_fields=[
                "is_active",
            ]
        )

        self.authenticate(
            self.member_a
        )

        response = self.client.get(
            reverse(
                "current-user"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_cannot_deactivate_self(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.patch(
            reverse(
                "admin-user-detail",
                kwargs={
                    "membership_id": (
                        self.admin_membership_a.id
                    ),
                },
            ),
            {
                "is_active": False,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.admin_a.refresh_from_db()

        self.assertTrue(
            self.admin_a.is_active
        )

    def test_admin_cannot_remove_own_admin_role(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.patch(
            reverse(
                "admin-user-detail",
                kwargs={
                    "membership_id": (
                        self.admin_membership_a.id
                    ),
                },
            ),
            {
                "role": "member",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.admin_membership_a.refresh_from_db()

        self.assertEqual(
            self.admin_membership_a.role,
            "admin",
        )

    def test_change_password_rejects_weak_password(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.post(
            reverse(
                "change-password"
            ),
            {
                "current_password": (
                    "TestPassword123!"
                ),
                "new_password": "123",
                "confirm_password": "123",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.member_a.refresh_from_db()

        self.assertTrue(
            self.member_a.check_password(
                "TestPassword123!"
            )
        )

    def test_change_password_accepts_valid_password(
        self,
    ):
        self.authenticate(
            self.member_a
        )

        response = self.client.post(
            reverse(
                "change-password"
            ),
            {
                "current_password": (
                    "TestPassword123!"
                ),
                "new_password": (
                    "AnotherSecurePassword456!"
                ),
                "confirm_password": (
                    "AnotherSecurePassword456!"
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.member_a.refresh_from_db()

        self.assertTrue(
            self.member_a.check_password(
                "AnotherSecurePassword456!"
            )
        )