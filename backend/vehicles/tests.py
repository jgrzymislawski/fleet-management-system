from django.contrib.auth.models import User

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)

from .models import (
    ServiceRecord,
    Vehicle,
    VehicleDocument,
)


class VehicleSecurityTests(APITestCase):
    def setUp(self):
        self.organization_a = Organization.objects.create(
            name="Organizacja A"
        )
        self.organization_b = Organization.objects.create(
            name="Organizacja B"
        )

        self.company_a = Company.objects.create(
            organization=self.organization_a,
            name="Spółka A",
            tax_id="1111111111",
        )
        self.company_b = Company.objects.create(
            organization=self.organization_b,
            name="Spółka B",
            tax_id="2222222222",
        )

        self.admin_a = User.objects.create_user(
            username="admin_a",
            password="TestPassword123!",
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            password="TestPassword123!",
        )
        self.viewer_a = User.objects.create_user(
            username="viewer_a",
            password="TestPassword123!",
        )
        self.editor_a = User.objects.create_user(
            username="editor_a",
            password="TestPassword123!",
        )

        self.admin_membership_a = OrganizationMembership.objects.create(
            user=self.admin_a,
            organization=self.organization_a,
            role="admin",
        )
        self.admin_membership_b = OrganizationMembership.objects.create(
            user=self.admin_b,
            organization=self.organization_b,
            role="admin",
        )
        self.viewer_membership_a = OrganizationMembership.objects.create(
            user=self.viewer_a,
            organization=self.organization_a,
            role="member",
        )
        self.editor_membership_a = OrganizationMembership.objects.create(
            user=self.editor_a,
            organization=self.organization_a,
            role="member",
        )

        CompanyAccess.objects.create(
            membership=self.viewer_membership_a,
            company=self.company_a,
            role="viewer",
        )
        CompanyAccess.objects.create(
            membership=self.editor_membership_a,
            company=self.company_a,
            role="editor",
        )

        self.vehicle_a = Vehicle.objects.create(
            organization=self.organization_a,
            company=self.company_a,
            brand="Ford",
            model="Focus",
            registration_number="DL11111",
            vin="WF0AAA11111111111",
            year=2020,
        )
        self.vehicle_b = Vehicle.objects.create(
            organization=self.organization_b,
            company=self.company_b,
            brand="Toyota",
            model="Corolla",
            registration_number="DW22222",
            vin="JTDBBB22222222222",
            year=2021,
        )

        self.service_a = ServiceRecord.objects.create(
            vehicle=self.vehicle_a,
            service_date="2026-01-10",
            title="Wymiana oleju",
            cost="500.00",
        )
        self.service_b = ServiceRecord.objects.create(
            vehicle=self.vehicle_b,
            service_date="2026-01-11",
            title="Serwis",
            cost="700.00",
        )

        self.document_a = VehicleDocument.objects.create(
            vehicle=self.vehicle_a,
            document_type="oc",
            document_number="OC-A",
        )
        self.document_b = VehicleDocument.objects.create(
            vehicle=self.vehicle_b,
            document_type="oc",
            document_number="OC-B",
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def response_results(self, response):
        if isinstance(response.data, dict):
            return response.data.get("results", [])
        return response.data

    def test_admin_sees_only_own_organization_vehicles(self):
        self.authenticate(self.admin_a)
        response = self.client.get("/api/vehicles/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        vehicle_ids = {
            vehicle["id"]
            for vehicle in self.response_results(response)
        }

        self.assertIn(self.vehicle_a.id, vehicle_ids)
        self.assertNotIn(self.vehicle_b.id, vehicle_ids)

    def test_admin_cannot_read_vehicle_from_other_organization(self):
        self.authenticate(self.admin_a)
        response = self.client.get(
            f"/api/vehicles/{self.vehicle_b.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_cannot_edit_vehicle_from_other_organization(self):
        self.authenticate(self.admin_a)
        response = self.client.patch(
            f"/api/vehicles/{self.vehicle_b.id}/",
            {"brand": "Zmieniona marka"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.vehicle_b.refresh_from_db()
        self.assertEqual(self.vehicle_b.brand, "Toyota")

    def test_admin_cannot_delete_vehicle_from_other_organization(self):
        self.authenticate(self.admin_a)
        response = self.client.delete(
            f"/api/vehicles/{self.vehicle_b.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.vehicle_b.refresh_from_db()
        self.assertFalse(self.vehicle_b.is_deleted)

    def test_viewer_can_read_vehicle(self):
        self.authenticate(self.viewer_a)
        response = self.client.get(
            f"/api/vehicles/{self.vehicle_a.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_viewer_cannot_edit_vehicle(self):
        self.authenticate(self.viewer_a)
        response = self.client.patch(
            f"/api/vehicles/{self.vehicle_a.id}/",
            {"brand": "Volkswagen"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.brand, "Ford")

    def test_editor_can_edit_vehicle(self):
        self.authenticate(self.editor_a)
        response = self.client.patch(
            f"/api/vehicles/{self.vehicle_a.id}/",
            {"brand": "Volkswagen"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.brand, "Volkswagen")

    def test_viewer_cannot_delete_vehicle(self):
        self.authenticate(self.viewer_a)
        response = self.client.delete(
            f"/api/vehicles/{self.vehicle_a.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.vehicle_a.refresh_from_db()
        self.assertFalse(self.vehicle_a.is_deleted)

    def test_delete_vehicle_uses_soft_delete(self):
        self.authenticate(self.admin_a)
        response = self.client.delete(
            f"/api/vehicles/{self.vehicle_a.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.vehicle_a.refresh_from_db()
        self.assertTrue(self.vehicle_a.is_deleted)
        self.assertIsNotNone(self.vehicle_a.deleted_at)
        self.assertFalse(
            Vehicle.active_objects.filter(id=self.vehicle_a.id).exists()
        )
        self.assertTrue(
            Vehicle.objects.filter(id=self.vehicle_a.id).exists()
        )

    def test_user_cannot_see_service_record_from_other_organization(self):
        self.authenticate(self.admin_a)
        response = self.client.get(
            f"/api/service-records/{self.service_b.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_edit_service_record_from_other_organization(self):
        self.authenticate(self.admin_a)
        response = self.client.patch(
            f"/api/service-records/{self.service_b.id}/",
            {"title": "Nieautoryzowana zmiana"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.service_b.refresh_from_db()
        self.assertEqual(self.service_b.title, "Serwis")

    def test_viewer_cannot_create_service_record(self):
        self.authenticate(self.viewer_a)
        response = self.client.post(
            "/api/service-records/",
            {
                "vehicle": self.vehicle_a.id,
                "service_date": "2026-02-01",
                "title": "Nowy wpis",
                "cost": "250.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_editor_can_create_service_record(self):
        self.authenticate(self.editor_a)
        response = self.client.post(
            "/api/service-records/",
            {
                "vehicle": self.vehicle_a.id,
                "service_date": "2026-02-01",
                "title": "Nowy wpis",
                "cost": "250.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_user_cannot_see_document_from_other_organization(self):
        self.authenticate(self.admin_a)
        response = self.client.get(
            f"/api/vehicle-documents/{self.document_b.id}/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_viewer_cannot_create_document(self):
        self.authenticate(self.viewer_a)
        response = self.client.post(
            "/api/vehicle-documents/",
            {
                "vehicle": self.vehicle_a.id,
                "document_type": "oc",
                "document_number": "TEST",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_editor_can_create_document(self):
        self.authenticate(self.editor_a)
        response = self.client.post(
            "/api/vehicle-documents/",
            {
                "vehicle": self.vehicle_a.id,
                "document_type": "oc",
                "document_number": "TEST",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_inactive_organization_cannot_access_vehicles(self):
        self.organization_a.is_active = False
        self.organization_a.save(update_fields=["is_active"])

        self.authenticate(self.admin_a)
        response = self.client.get("/api/vehicles/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_editor_cannot_assign_vehicle_to_other_organization_company(self):
        self.authenticate(self.editor_a)
        response = self.client.patch(
            f"/api/vehicles/{self.vehicle_a.id}/",
            {"company": self.company_b.id},
            format="json",
        )

        self.assertIn(
            response.status_code,
            {
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            },
        )

        self.vehicle_a.refresh_from_db()
        self.assertEqual(self.vehicle_a.company_id, self.company_a.id)

    def test_admin_cannot_create_vehicle_in_other_organization_company(self):
        self.authenticate(self.admin_a)
        response = self.client.post(
            "/api/vehicles/",
            {
                "brand": "Audi",
                "model": "A4",
                "registration_number": "DL99999",
                "vin": "WAUCCC33333333333",
                "year": 2022,
                "company": self.company_b.id,
                "vehicle_type": "passenger",
                "mileage": 0,
                "status": "active",
            },
            format="json",
        )

        self.assertIn(
            response.status_code,
            {
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            },
        )
        self.assertFalse(
            Vehicle.objects.filter(
                registration_number="DL99999"
            ).exists()
        )

    def test_service_filter_rejects_invalid_vehicle_id(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/service-records/?vehicle=abc"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_service_filter_rejects_invalid_date(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/service-records/?date_from=nie-data"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_service_filter_rejects_invalid_cost(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/service-records/?cost_min=abc"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_service_filter_rejects_reversed_date_range(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            (
                "/api/service-records/"
                "?date_from=2026-12-31"
                "&date_to=2026-01-01"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_service_filter_rejects_reversed_cost_range(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            (
                "/api/service-records/"
                "?cost_min=1000"
                "&cost_max=100"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_vehicle_filter_rejects_invalid_year(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/vehicles/?year=abc"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_vehicle_export_rejects_too_many_ids(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/vehicles/export/",
            {
                "vehicle_ids": list(
                    range(
                        1,
                        5002,
                    )
                )
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_bulk_update_rejects_too_many_ids(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/vehicles/bulk-update/",
            {
                "vehicle_ids": list(
                    range(
                        1,
                        502,
                    )
                ),
                "action": "change_status",
                "value": "active",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

