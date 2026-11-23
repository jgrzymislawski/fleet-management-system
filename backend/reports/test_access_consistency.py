"""Regresja wspolnej izolacji pojazdow w API, raportach i alertach."""

from io import BytesIO

from django.contrib.auth.models import User
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from alerts.services import get_accessible_vehicles as alerts_access
from organizations.models import (
    Company, CompanyAccess, Organization, OrganizationMembership,
)
from reports.views import get_accessible_vehicles as reports_access
from vehicles.access import get_accessible_vehicles
from vehicles.models import ServiceRecord, Vehicle
from vehicles.views import get_accessible_vehicles as vehicles_access


class SharedVehicleAccessTests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name="Test organizacja A")
        self.org_b = Organization.objects.create(name="Test organizacja B")

        self.company_active = Company.objects.create(
            organization=self.org_a, name="Spolka aktywna", tax_id="1231231231",
        )
        self.company_inactive = Company.objects.create(
            organization=self.org_a, name="Spolka nieaktywna",
            tax_id="1231231232", is_active=False,
        )
        self.company_foreign = Company.objects.create(
            organization=self.org_b, name="Spolka B", tax_id="1231231233",
        )

        self.admin = User.objects.create_user(
            username="shared_admin", password="TestPassword123!",
        )
        self.viewer = User.objects.create_user(
            username="shared_viewer", password="TestPassword123!",
        )
        self.outsider = User.objects.create_user(
            username="shared_outsider", password="TestPassword123!",
        )
        self.superuser = User.objects.create_superuser(
            username="shared_superuser", email="super@example.com",
            password="TestPassword123!",
        )

        OrganizationMembership.objects.create(
            user=self.admin, organization=self.org_a, role="admin",
        )
        viewer_membership = OrganizationMembership.objects.create(
            user=self.viewer, organization=self.org_a, role="member",
        )
        for company in (self.company_active, self.company_inactive):
            CompanyAccess.objects.create(
                membership=viewer_membership, company=company, role="viewer",
            )

        self.vehicle_active = Vehicle.objects.create(
            organization=self.org_a, company=self.company_active,
            brand="Ford", model="Focus", registration_number="DL11111",
            year=2020,
        )
        self.vehicle_inactive = Vehicle.objects.create(
            organization=self.org_a, company=self.company_inactive,
            brand="Opel", model="Astra", registration_number="DL22222",
            year=2021,
        )
        self.vehicle_foreign = Vehicle.objects.create(
            organization=self.org_b, company=self.company_foreign,
            brand="Toyota", model="Yaris", registration_number="DW33333",
            year=2022,
        )
        self.vehicle_deleted = Vehicle.objects.create(
            organization=self.org_a, company=self.company_active,
            brand="Skoda", model="Fabia", registration_number="DL44444",
            year=2019, is_deleted=True,
        )
        ServiceRecord.objects.create(
            vehicle=self.vehicle_inactive,
            service_date=timezone.localdate(),
            title="Serwis archiwalnej spolki", cost="250.00",
        )

    @staticmethod
    def ids_for(access_func, user):
        return set(access_func(user).values_list("id", flat=True))

    def test_all_modules_use_the_same_helper(self):
        self.assertIs(vehicles_access, get_accessible_vehicles)
        self.assertIs(reports_access, get_accessible_vehicles)
        self.assertIs(alerts_access, get_accessible_vehicles)

    def test_admin_can_access_inactive_own_company_not_foreign(self):
        expected = {self.vehicle_active.pk, self.vehicle_inactive.pk}
        self.assertEqual(self.ids_for(get_accessible_vehicles, self.admin), expected)

    def test_report_options_match_admin_vehicle_scope(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/reports/options/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        actual = {item["id"] for item in response.data["vehicles"]}
        self.assertEqual(actual, {self.vehicle_active.pk, self.vehicle_inactive.pk})

        response_vehicles = self.client.get("/api/vehicles/")
        self.assertEqual(response_vehicles.status_code, status.HTTP_200_OK)
        data = response_vehicles.data
        results = data["results"] if isinstance(data, dict) else data
        self.assertEqual({item["id"] for item in results}, actual)

    def test_service_costs_report_accepts_inactive_own_company(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/reports/service-costs/",
            {"format": "xlsx", "company_id": self.company_inactive.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        workbook = load_workbook(BytesIO(response.content), read_only=True)
        try:
            values = [
                cell for row in workbook["Historia serwisowa"].iter_rows(values_only=True)
                for cell in row
            ]
            self.assertIn("Serwis archiwalnej spolki", values)
        finally:
            workbook.close()

    def test_viewer_sees_only_active_assigned_company(self):
        expected = {self.vehicle_active.pk}
        self.assertEqual(self.ids_for(get_accessible_vehicles, self.viewer), expected)
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get("/api/reports/options/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({item["id"] for item in response.data["vehicles"]}, expected)

    def test_user_without_membership_has_no_vehicles(self):
        self.assertEqual(self.ids_for(get_accessible_vehicles, self.outsider), set())
        self.client.force_authenticate(user=self.outsider)
        response = self.client.get("/api/reports/options/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["vehicles"], [])

    def test_inactive_organization_is_denied(self):
        self.org_a.is_active = False
        self.org_a.save(update_fields=["is_active"])
        with self.assertRaises(PermissionDenied):
            list(get_accessible_vehicles(self.admin))
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/reports/options/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_without_membership_only_active_organizations(self):
        self.org_b.is_active = False
        self.org_b.save(update_fields=["is_active"])
        expected = {self.vehicle_active.pk, self.vehicle_inactive.pk}
        self.assertEqual(self.ids_for(get_accessible_vehicles, self.superuser), expected)

    def test_soft_deleted_vehicle_is_always_hidden(self):
        for user in (self.admin, self.viewer, self.superuser):
            self.assertNotIn(
                self.vehicle_deleted.pk,
                self.ids_for(get_accessible_vehicles, user),
            )
