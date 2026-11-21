from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)
from vehicles.models import Vehicle

from .models import (
    Driver,
    DriverVehicleAssignment,
)
from .export_utils import create_driver_workbook


class DriverSecurityTests(
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
                password="TestPassword123!",
            )
        )

        self.admin_b = (
            User.objects.create_user(
                username="admin_b",
                password="TestPassword123!",
            )
        )

        self.viewer_a = (
            User.objects.create_user(
                username="viewer_a",
                password="TestPassword123!",
            )
        )

        self.editor_a = (
            User.objects.create_user(
                username="editor_a",
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

        OrganizationMembership.objects.create(
            user=self.admin_b,
            organization=(
                self.organization_b
            ),
            role="admin",
        )

        self.viewer_membership_a = (
            OrganizationMembership.objects.create(
                user=self.viewer_a,
                organization=(
                    self.organization_a
                ),
                role="member",
            )
        )

        self.editor_membership_a = (
            OrganizationMembership.objects.create(
                user=self.editor_a,
                organization=(
                    self.organization_a
                ),
                role="member",
            )
        )

        CompanyAccess.objects.create(
            membership=(
                self.viewer_membership_a
            ),
            company=self.company_a,
            role="viewer",
        )

        CompanyAccess.objects.create(
            membership=(
                self.editor_membership_a
            ),
            company=self.company_a,
            role="editor",
        )

        today = timezone.localdate()

        self.driver_a = (
            Driver.objects.create(
                organization=(
                    self.organization_a
                ),
                first_name="Jan",
                last_name="Kowalski",
                license_number="A111",
                license_categories=[
                    "B",
                ],
                phone_number="500600700",
                hired_at=(
                    today
                    - timedelta(
                        days=365,
                    )
                ),
            )
        )

        self.driver_b = (
            Driver.objects.create(
                organization=(
                    self.organization_b
                ),
                first_name="Adam",
                last_name="Nowak",
                license_number="B222",
                license_categories=[
                    "B",
                ],
                phone_number="500600701",
                hired_at=(
                    today
                    - timedelta(
                        days=365,
                    )
                ),
            )
        )

        self.vehicle_a = (
            Vehicle.objects.create(
                organization=(
                    self.organization_a
                ),
                company=self.company_a,
                brand="Ford",
                model="Focus",
                registration_number="DL11111",
                vin="WF0AAA11111111111",
                year=2020,
            )
        )

        self.vehicle_b = (
            Vehicle.objects.create(
                organization=(
                    self.organization_b
                ),
                company=self.company_b,
                brand="Toyota",
                model="Corolla",
                registration_number="DW22222",
                vin="JTDBBB22222222222",
                year=2021,
            )
        )

    def authenticate(
        self,
        user,
    ):
        self.client.force_authenticate(
            user=user
        )

    def test_admin_sees_only_own_organization_drivers(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/drivers/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        results = response.data.get(
            "results",
            response.data,
        )

        ids = {
            item["id"]
            for item in results
        }

        self.assertIn(
            self.driver_a.id,
            ids,
        )

        self.assertNotIn(
            self.driver_b.id,
            ids,
        )

    def test_admin_cannot_read_driver_from_other_organization(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            f"/api/drivers/{self.driver_b.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_member_cannot_create_driver(
        self,
    ):
        self.authenticate(
            self.editor_a
        )

        response = self.client.post(
            "/api/drivers/",
            {
                "first_name": "Piotr",
                "last_name": "Test",
                "license_number": "NEW123",
                "license_categories": [
                    "B",
                ],
                "phone_number": "123456789",
                "hired_at": (
                    timezone.localdate()
                    .isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_can_create_driver(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/drivers/",
            {
                "first_name": "Piotr",
                "last_name": "Test",
                "license_number": "NEW123",
                "license_categories": [
                    "B",
                    "C+E",
                ],
                "phone_number": "123456789",
                "hired_at": (
                    timezone.localdate()
                    .isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

    def test_invalid_license_category_is_rejected(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/drivers/",
            {
                "first_name": "Piotr",
                "last_name": "Test",
                "license_number": "NEW124",
                "license_categories": [
                    "XYZ",
                ],
                "phone_number": "123456789",
                "hired_at": (
                    timezone.localdate()
                    .isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_future_hired_date_is_rejected(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/drivers/",
            {
                "first_name": "Piotr",
                "last_name": "Test",
                "license_number": "NEW125",
                "license_categories": [
                    "B",
                ],
                "phone_number": "123456789",
                "hired_at": (
                    timezone.localdate()
                    + timedelta(
                        days=1,
                    )
                ).isoformat(),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_soft_delete_driver(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.delete(
            f"/api/drivers/{self.driver_a.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.driver_a.refresh_from_db()

        self.assertTrue(
            self.driver_a.is_deleted
        )

        self.assertIsNotNone(
            self.driver_a.deleted_at
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
            self.admin_a
        )

        response = self.client.get(
            "/api/drivers/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_assignment_cannot_cross_organizations(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/driver-assignments/",
            {
                "vehicle": (
                    self.vehicle_a.id
                ),
                "driver": (
                    self.driver_b.id
                ),
                "driver_name": "",
                "start_date": (
                    timezone.localdate()
                    .isoformat()
                ),
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

    def test_editor_can_create_assignment_for_own_company(
        self,
    ):
        self.authenticate(
            self.editor_a
        )

        response = self.client.post(
            "/api/driver-assignments/",
            {
                "vehicle": (
                    self.vehicle_a.id
                ),
                "driver": (
                    self.driver_a.id
                ),
                "driver_name": "",
                "start_date": (
                    timezone.localdate()
                    .isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

    def test_viewer_cannot_create_assignment(
        self,
    ):
        self.authenticate(
            self.viewer_a
        )

        response = self.client.post(
            "/api/driver-assignments/",
            {
                "vehicle": (
                    self.vehicle_a.id
                ),
                "driver": (
                    self.driver_a.id
                ),
                "driver_name": "",
                "start_date": (
                    timezone.localdate()
                    .isoformat()
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_assignment_filter_rejects_invalid_vehicle_id(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/driver-assignments/?vehicle=abc"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_assignment_filter_rejects_invalid_driver_id(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            "/api/driver-assignments/?driver=abc"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_export_rejects_too_many_ids(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/drivers/export/",
            {
                "driver_ids": list(
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

    def test_bulk_delete_rejects_too_many_ids(
        self,
    ):
        self.authenticate(
            self.admin_a
        )

        response = self.client.post(
            "/api/drivers/bulk-update/",
            {
                "driver_ids": list(
                    range(
                        1,
                        502,
                    )
                ),
                "action": "delete",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_assignment_model_rejects_end_before_start(
        self,
    ):
        assignment = (
            DriverVehicleAssignment(
                vehicle=self.vehicle_a,
                driver=self.driver_a,
                start_date=(
                    timezone.localdate()
                ),
                end_date=(
                    timezone.localdate()
                    - timedelta(
                        days=1,
                    )
                ),
            )
        )

        with self.assertRaises(
            Exception
        ):
            assignment.full_clean()

    def test_driver_export_neutralizes_formula_injection(
        self,
    ):
        self.driver_a.first_name = "=1+1"
        self.driver_a.phone_number = "@SUM(A1:A2)"
        self.driver_a.save(
            update_fields=[
                "first_name",
                "phone_number",
            ]
        )

        workbook = create_driver_workbook(
            [
                self.driver_a,
            ]
        )

        worksheet = workbook.active

        self.assertEqual(
            worksheet["A2"].value,
            "'=1+1",
        )

        self.assertEqual(
            worksheet["G2"].value,
            "'@SUM(A1:A2)",
        )

    def test_driver_card_pdf_uses_safe_filename(
        self,
    ):
        self.driver_a.first_name = "Jan"
        self.driver_a.last_name = "Kowalski/test"
        self.driver_a.save(
            update_fields=[
                "first_name",
                "last_name",
            ]
        )

        self.authenticate(
            self.admin_a
        )

        response = self.client.get(
            (
                f"/api/drivers/{self.driver_a.id}/"
                "card-pdf/"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        disposition = response[
            "Content-Disposition"
        ]

        self.assertNotIn(
            "/",
            disposition,
        )

        self.assertIn(
            "flotivo-kierowca-Jan-Kowalski-test-",
            disposition,
        )

