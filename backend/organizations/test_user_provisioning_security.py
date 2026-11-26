from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)


@override_settings(SECURE_SSL_REDIRECT=False)
class UserProvisioningSecurityTests(APITestCase):
    def setUp(self):
        self.organization_a = Organization.objects.create(
            name="Provisioning Organization A"
        )
        self.organization_b = Organization.objects.create(
            name="Provisioning Organization B"
        )

        self.company_a = Company.objects.create(
            organization=self.organization_a,
            name="Active Company A",
        )
        self.inactive_company = Company.objects.create(
            organization=self.organization_a,
            name="Inactive Company A",
            is_active=False,
        )
        self.company_b = Company.objects.create(
            organization=self.organization_b,
            name="Company B",
        )

        User = get_user_model()
        self.admin_a = User.objects.create_user(
            username="provisioning_admin_a",
            password="AdminPassword123!",
        )
        self.member_a = User.objects.create_user(
            username="provisioning_member_a",
            password="MemberPassword123!",
        )

        OrganizationMembership.objects.create(
            user=self.admin_a,
            organization=self.organization_a,
            role="admin",
        )
        self.member_membership = OrganizationMembership.objects.create(
            user=self.member_a,
            organization=self.organization_a,
            role="member",
        )
        CompanyAccess.objects.create(
            membership=self.member_membership,
            company=self.company_a,
            role="viewer",
        )

        self.list_url = reverse("admin-user-list")
        self.detail_url = reverse(
            "admin-user-detail",
            kwargs={"membership_id": self.member_membership.pk},
        )

    def payload(self, companies=None, username="provisioning_new_user"):
        return {
            "username": username,
            "password": "NewUserPassword123!",
            "confirm_password": "NewUserPassword123!",
            "role": "member",
            "companies": [] if companies is None else companies,
        }

    def post_as(self, user, payload):
        self.client.force_authenticate(user=user)
        return self.client.post(self.list_url, payload, format="json")

    def company_grant(self, company_id, role="viewer"):
        return {"company_id": company_id, "role": role}

    def test_admin_can_create_user_for_own_company(self):
        payload = self.payload([
            self.company_grant(self.company_a.pk, "editor")
        ])
        response = self.post_as(self.admin_a, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        User = get_user_model()
        user = User.objects.get(username=payload["username"])
        self.assertTrue(user.check_password(payload["password"]))
        self.assertNotEqual(user.password, payload["password"])

        membership = OrganizationMembership.objects.get(user=user)
        self.assertEqual(membership.organization_id, self.organization_a.pk)
        self.assertEqual(membership.role, "member")
        self.assertTrue(
            CompanyAccess.objects.filter(
                membership=membership,
                company=self.company_a,
                role="editor",
            ).exists()
        )

    def test_member_cannot_create_accounts(self):
        response = self.post_as(self.member_a, self.payload())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(
            get_user_model().objects.filter(username="provisioning_new_user").exists()
        )

    def test_admin_cannot_create_account_with_foreign_company(self):
        payload = self.payload([
            self.company_grant(self.company_b.pk)
        ])
        response = self.post_as(self.admin_a, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            get_user_model().objects.filter(username=payload["username"]).exists()
        )

    def test_admin_cannot_assign_inactive_company(self):
        payload = self.payload([
            self.company_grant(self.inactive_company.pk)
        ])
        response = self.post_as(self.admin_a, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            get_user_model().objects.filter(username=payload["username"]).exists()
        )

    def test_duplicate_company_grants_are_rejected(self):
        payload = self.payload([
            self.company_grant(self.company_a.pk),
            self.company_grant(self.company_a.pk, "editor"),
        ])
        response = self.post_as(self.admin_a, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            get_user_model().objects.filter(username=payload["username"]).exists()
        )

    def test_invalid_company_id_returns_400_not_500(self):
        payload = self.payload([
            self.company_grant("not-a-number")
        ])
        response = self.post_as(self.admin_a, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            get_user_model().objects.filter(username=payload["username"]).exists()
        )

    def test_mixed_string_integer_duplicate_is_rejected(self):
        payload = self.payload([
            self.company_grant(self.company_a.pk),
            self.company_grant(str(self.company_a.pk), "editor"),
        ])
        response = self.post_as(self.admin_a, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            get_user_model().objects.filter(username=payload["username"]).exists()
        )

    def test_admin_cannot_assign_foreign_company_on_update(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            self.detail_url,
            {"companies": [self.company_grant(self.company_b.pk, "editor")]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            list(
                CompanyAccess.objects.filter(
                    membership=self.member_membership
                ).values_list("company_id", "role")
            ),
            [(self.company_a.pk, "viewer")],
        )

    def test_invalid_company_id_on_update_returns_400_not_500(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            self.detail_url,
            {"companies": [self.company_grant("not-a-number", "editor")]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            list(
                CompanyAccess.objects.filter(
                    membership=self.member_membership
                ).values_list("company_id", "role")
            ),
            [(self.company_a.pk, "viewer")],
        )

    def test_duplicate_company_ids_on_update_are_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            self.detail_url,
            {
                "companies": [
                    self.company_grant(self.company_a.pk, "viewer"),
                    self.company_grant(str(self.company_a.pk), "editor"),
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            list(
                CompanyAccess.objects.filter(
                    membership=self.member_membership
                ).values_list("company_id", "role")
            ),
            [(self.company_a.pk, "viewer")],
        )
