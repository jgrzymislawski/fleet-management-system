from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)
from vehicles.models import Vehicle


@override_settings(SECURE_SSL_REDIRECT=False)
class AccessRevocationTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(
            name="Revocation test organization"
        )
        self.company_a = Company.objects.create(
            organization=self.organization,
            name="Company A",
        )
        self.company_b = Company.objects.create(
            organization=self.organization,
            name="Company B",
        )

        self.admin = User.objects.create_user(
            username="revocation_admin",
            password="TestPassword123!",
        )
        self.employee = User.objects.create_user(
            username="revocation_employee",
            password="TestPassword123!",
        )
        self.second_admin = User.objects.create_user(
            username="revocation_second_admin",
            password="TestPassword123!",
        )

        OrganizationMembership.objects.create(
            user=self.admin,
            organization=self.organization,
            role="admin",
        )
        self.employee_membership = OrganizationMembership.objects.create(
            user=self.employee,
            organization=self.organization,
            role="member",
        )
        self.second_admin_membership = OrganizationMembership.objects.create(
            user=self.second_admin,
            organization=self.organization,
            role="admin",
        )
        CompanyAccess.objects.create(
            membership=self.employee_membership,
            company=self.company_a,
            role="editor",
        )

        self.vehicle_a = Vehicle.objects.create(
            organization=self.organization,
            company=self.company_a,
            brand="Ford",
            model="Focus",
            registration_number="REV1001",
            year=2020,
        )
        self.vehicle_b = Vehicle.objects.create(
            organization=self.organization,
            company=self.company_b,
            brand="Toyota",
            model="Corolla",
            registration_number="REV1002",
            year=2021,
        )
        self.admin_client = self.jwt_client(self.admin)
        self.employee_client = self.jwt_client(self.employee)
        self.second_admin_client = self.jwt_client(self.second_admin)

    def jwt_client(self, user):
        token = RefreshToken.for_user(user)
        client = APIClient()
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token.access_token}"
        )
        return client

    def user_detail_url(self, membership):
        return reverse(
            "admin-user-detail",
            kwargs={"membership_id": membership.id},
        )

    def vehicle_url(self, vehicle):
        return reverse(
            "vehicles-detail",
            kwargs={"pk": vehicle.id},
        )

    def test_deactivation_blocks_existing_access_token(self):
        self.assertEqual(
            self.employee_client.get(reverse("current-user")).status_code,
            status.HTTP_200_OK,
        )

        response = self.admin_client.patch(
            self.user_detail_url(self.employee_membership),
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.is_active)

        response = self.employee_client.get(reverse("current-user"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        response = self.employee_client.get(self.vehicle_url(self.vehicle_a))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_deactivation_blocks_existing_refresh_token(self):
        csrf_client = APIClient(enforce_csrf_checks=True)
        csrf_response = csrf_client.get(reverse("auth_csrf"))
        self.assertEqual(csrf_response.status_code, status.HTTP_200_OK)
        csrf = csrf_client.cookies["csrftoken"].value

        login_response = csrf_client.post(
            reverse("token_obtain_pair"),
            {
                "username": "revocation_employee",
                "password": "TestPassword123!",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("flotivo_refresh", csrf_client.cookies)

        response = self.admin_client.patch(
            self.user_detail_url(self.employee_membership),
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        refresh_response = csrf_client.post(
            reverse("token_refresh"),
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(
            refresh_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertNotIn("access", refresh_response.data)

    def test_role_demotion_takes_effect_for_existing_token(self):
        self.assertEqual(
            self.second_admin_client.get(
                reverse("admin-user-list")
            ).status_code,
            status.HTTP_200_OK,
        )

        response = self.admin_client.patch(
            self.user_detail_url(self.second_admin_membership),
            {"role": "member", "companies": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.second_admin_membership.refresh_from_db()
        self.assertEqual(self.second_admin_membership.role, "member")

        response = self.second_admin_client.get(reverse("admin-user-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_removed_company_grant_takes_effect_for_existing_token(self):
        self.assertEqual(
            self.employee_client.get(self.vehicle_url(self.vehicle_a)).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.employee_client.get(self.vehicle_url(self.vehicle_b)).status_code,
            status.HTTP_404_NOT_FOUND,
        )

        response = self.admin_client.patch(
            self.user_detail_url(self.employee_membership),
            {"companies": []},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            CompanyAccess.objects.filter(
                membership=self.employee_membership
            ).exists()
        )
        response = self.employee_client.get(self.vehicle_url(self.vehicle_a))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_editor_to_viewer_downgrade_blocks_write_with_old_token(self):
        url = self.vehicle_url(self.vehicle_a)
        response = self.employee_client.patch(
            url, {"mileage": 12}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.admin_client.patch(
            self.user_detail_url(self.employee_membership),
            {
                "companies": [
                    {"company_id": self.company_a.id, "role": "viewer"}
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.assertEqual(
            self.employee_client.get(url).status_code,
            status.HTTP_200_OK,
        )
        response = self.employee_client.patch(
            url, {"mileage": 99}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.mileage, 12)
