import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import (
    SimpleUploadedFile,
)
from django.test import override_settings

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)

from .models import (
    Vehicle,
    VehicleDocument,
)


class VehicleDocumentDownloadTests(
    APITestCase
):
    def setUp(self):
        self.temp_media = (
            tempfile.TemporaryDirectory()
        )

        self.media_override = (
            override_settings(
                MEDIA_ROOT=(
                    self.temp_media.name
                )
            )
        )

        self.media_override.enable()

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

        self.viewer_a = (
            User.objects.create_user(
                username="viewer_a",
                password="TestPassword123!",
            )
        )

        self.admin_b = (
            User.objects.create_user(
                username="admin_b",
                password="TestPassword123!",
            )
        )

        viewer_membership = (
            OrganizationMembership.objects
            .create(
                user=self.viewer_a,
                organization=(
                    self.organization_a
                ),
                role="member",
            )
        )

        OrganizationMembership.objects.create(
            user=self.admin_b,
            organization=(
                self.organization_b
            ),
            role="admin",
        )

        CompanyAccess.objects.create(
            membership=(
                viewer_membership
            ),
            company=self.company_a,
            role="viewer",
        )

        self.vehicle_a = (
            Vehicle.objects.create(
                organization=(
                    self.organization_a
                ),
                company=self.company_a,
                brand="Ford",
                model="Focus",
                registration_number=(
                    "DL11111"
                ),
                vin=(
                    "WF0AAA11111111111"
                ),
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
                registration_number=(
                    "DW22222"
                ),
                vin=(
                    "JTDBBB22222222222"
                ),
                year=2021,
            )
        )

        self.document_a = (
            VehicleDocument.objects.create(
                vehicle=self.vehicle_a,
                document_type="oc",
                document_number="OC-1",
                file=SimpleUploadedFile(
                    "polisa.pdf",
                    (
                        b"%PDF-1.4\n"
                        b"Flotivo test\n"
                    ),
                    content_type=(
                        "application/pdf"
                    ),
                ),
            )
        )

        self.document_b = (
            VehicleDocument.objects.create(
                vehicle=self.vehicle_b,
                document_type="oc",
                document_number="OC-2",
                file=SimpleUploadedFile(
                    "polisa-b.pdf",
                    (
                        b"%PDF-1.4\n"
                        b"Flotivo test B\n"
                    ),
                    content_type=(
                        "application/pdf"
                    ),
                ),
            )
        )

        self.document_without_file = (
            VehicleDocument.objects.create(
                vehicle=self.vehicle_a,
                document_type="other",
                document_number="BRAK",
            )
        )

    def tearDown(self):
        self.media_override.disable()

        self.temp_media.cleanup()

    def authenticate(
        self,
        user,
    ):
        self.client.force_authenticate(
            user=user
        )

    def test_authenticated_viewer_can_download_accessible_document(
        self,
    ):
        self.authenticate(
            self.viewer_a
        )

        response = self.client.get(
            (
                "/api/vehicle-documents/"
                f"{self.document_a.id}/"
                "download/"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response[
                "Content-Type"
            ],
            "application/pdf",
        )

        content = b"".join(
            response.streaming_content
        )

        self.assertTrue(
            content.startswith(
                b"%PDF-"
            )
        )

    def test_user_cannot_download_document_from_other_organization(
        self,
    ):
        self.authenticate(
            self.viewer_a
        )

        response = self.client.get(
            (
                "/api/vehicle-documents/"
                f"{self.document_b.id}/"
                "download/"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_document_without_file_returns_404(
        self,
    ):
        self.authenticate(
            self.viewer_a
        )

        response = self.client.get(
            (
                "/api/vehicle-documents/"
                f"{self.document_without_file.id}/"
                "download/"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
    def test_document_api_does_not_expose_file_path(
        self,
    ):
        self.authenticate(
            self.viewer_a
        )

        response = self.client.get(
            (
                "/api/vehicle-documents/"
                f"{self.document_a.id}/"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertNotIn(
            "file",
            response.data,
        )

        self.assertTrue(
            response.data["has_file"]
        )

    def test_document_api_reports_missing_file_without_exposing_path(
        self,
    ):
        self.authenticate(
            self.viewer_a
        )

        response = self.client.get(
            (
                "/api/vehicle-documents/"
                f"{self.document_without_file.id}/"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertNotIn(
            "file",
            response.data,
        )

        self.assertFalse(
            response.data["has_file"]
        )

    def test_unauthenticated_user_cannot_download_document(
        self,
    ):
        response = self.client.get(
            (
                "/api/vehicle-documents/"
                f"{self.document_a.id}/"
                "download/"
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )