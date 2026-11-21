from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    Organization,
    OrganizationMembership,
)
from vehicles.models import Vehicle

from .alerts_utils import (
    create_alerts_report_pdf,
    create_alerts_report_workbook,
)


class AlertsReportSecurityTests(
    APITestCase
):
    def setUp(self):
        self.organization = (
            Organization.objects.create(
                name="Organizacja A"
            )
        )

        self.other_organization = (
            Organization.objects.create(
                name="Organizacja B"
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

        self.other_company = (
            Company.objects.create(
                organization=(
                    self.other_organization
                ),
                name="Spółka B",
                tax_id="2222222222",
            )
        )

        self.admin = (
            User.objects.create_user(
                username="admin",
                password="TestPassword123!",
            )
        )

        OrganizationMembership.objects.create(
            user=self.admin,
            organization=(
                self.organization
            ),
            role="admin",
        )

        today = timezone.localdate()

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
                    today
                    + timedelta(
                        days=7,
                    )
                ),
            )
        )

        self.other_vehicle = (
            Vehicle.objects.create(
                organization=(
                    self.other_organization
                ),
                company=self.other_company,
                brand="Toyota",
                model="Corolla",
                registration_number="DW22222",
                vin="JTDBBB22222222222",
                year=2021,
            )
        )

    def authenticate(self):
        self.client.force_authenticate(
            user=self.admin
        )

    def test_report_rejects_foreign_company(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/alerts/",
            {
                "format": "pdf",
                "category": "all",
                "status": "all",
                "company_id": (
                    self.other_company.id
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_report_rejects_foreign_vehicle(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/alerts/",
            {
                "format": "pdf",
                "category": "all",
                "status": "all",
                "vehicle_id": (
                    self.other_vehicle.id
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_report_rejects_invalid_ids(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/alerts/",
            {
                "format": "pdf",
                "company_id": -1,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_workbook_neutralizes_formula_injection(
        self,
    ):
        alerts = [
            {
                "category": "vehicle",
                "name": "=1+1",
                "secondary": "@SUM(A1:A2)",
                "type": "+CMD",
                "date": timezone.localdate(),
                "days_text": "-1",
                "status": "=danger",
                "days_left": 7,
                "company_name": "@company",
                "branch": "+branch",
            }
        ]

        workbook = (
            create_alerts_report_workbook(
                alerts=alerts,
                filters={
                    "category_name": "=all",
                    "status_name": "@all",
                    "company_name": "+company",
                    "branch": "-branch",
                    "vehicle_name": "=vehicle",
                },
            )
        )

        summary = workbook[
            "Podsumowanie"
        ]

        details = workbook[
            "Alerty"
        ]

        self.assertTrue(
            str(
                summary["B3"].value
            ).startswith("'")
        )

        self.assertTrue(
            str(
                details["B2"].value
            ).startswith("'")
        )

        self.assertTrue(
            str(
                details["C2"].value
            ).startswith("'")
        )

    def test_pdf_accepts_special_characters(
        self,
    ):
        alerts = [
            {
                "category": "vehicle",
                "name": "Auto <test> & firma",
                "secondary": "ABC & <123>",
                "type": "OC & przegląd",
                "date": timezone.localdate(),
                "days_text": "7 dni",
                "status": "Wkrótce",
                "days_left": 7,
                "company_name": "A&B <Sp.>",
                "branch": "Oddział <1>",
            }
        ]

        pdf = create_alerts_report_pdf(
            alerts=alerts,
            filters={
                "category_name": "Wszystkie",
                "status_name": "Wszystkie",
                "company_name": "A&B <Sp.>",
                "branch": "Oddział <1>",
                "vehicle_name": "Auto <test>",
            },
        )

        self.assertGreater(
            len(
                pdf.getvalue()
            ),
            0,
        )

class ServiceCostsReportSecurityTests(
    APITestCase
):
    def setUp(self):
        self.organization = Organization.objects.create(
            name="Koszty A"
        )
        self.other_organization = Organization.objects.create(
            name="Koszty B"
        )

        self.company = Company.objects.create(
            organization=self.organization,
            name="Kosztowa A",
            tax_id="3333333333",
        )
        self.other_company = Company.objects.create(
            organization=self.other_organization,
            name="Kosztowa B",
            tax_id="4444444444",
        )

        self.user = User.objects.create_user(
            username="cost_admin",
            password="TestPassword123!",
        )

        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.organization,
            role="admin",
        )

        self.vehicle = Vehicle.objects.create(
            organization=self.organization,
            company=self.company,
            brand="Ford",
            model="Focus",
            registration_number="DL33333",
            vin="WF0DDD44444444444",
            year=2020,
            branch="Legnica",
        )

        self.other_vehicle = Vehicle.objects.create(
            organization=self.other_organization,
            company=self.other_company,
            brand="Toyota",
            model="Yaris",
            registration_number="DW44444",
            vin="JTDEEE55555555555",
            year=2021,
        )

        from vehicles.models import ServiceRecord

        ServiceRecord.objects.create(
            vehicle=self.vehicle,
            service_date=timezone.localdate(),
            title="Serwis <A> & test",
            description="=1+1",
            cost="100.00",
        )

    def authenticate(self):
        self.client.force_authenticate(
            user=self.user
        )

    def test_service_report_rejects_foreign_company(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/service-costs/",
            {
                "format": "pdf",
                "company_id": self.other_company.id,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_service_report_rejects_foreign_vehicle(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/service-costs/",
            {
                "format": "pdf",
                "vehicle_id": self.other_vehicle.id,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_service_report_rejects_invalid_date_type(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/service-costs/",
            {
                "format": "pdf",
                "date_from": 123,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_service_report_rejects_reversed_dates(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/service-costs/",
            {
                "format": "pdf",
                "date_from": "2026-12-31",
                "date_to": "2026-01-01",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_service_report_rejects_vehicle_from_other_branch(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/service-costs/",
            {
                "format": "pdf",
                "vehicle_id": self.vehicle.id,
                "branch": "Jawor",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_inactive_organization_cannot_use_report_options(
        self,
    ):
        self.organization.is_active = False
        self.organization.save(
            update_fields=[
                "is_active",
            ]
        )

        self.authenticate()

        response = self.client.get(
            "/api/reports/options/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_service_xlsx_neutralizes_formula_injection(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/service-costs/",
            {
                "format": "xlsx",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        from io import BytesIO
        from openpyxl import load_workbook

        workbook = load_workbook(
            BytesIO(response.content),
            data_only=False,
        )

        sheet = workbook[
            "Historia serwisowa"
        ]

        self.assertTrue(
            str(
                sheet["G2"].value
            ).startswith("'")
        )

        workbook.close()

    def test_service_pdf_accepts_special_characters(
        self,
    ):
        self.authenticate()

        response = self.client.post(
            "/api/reports/service-costs/",
            {
                "format": "pdf",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertGreater(
            len(response.content),
            0,
        )

