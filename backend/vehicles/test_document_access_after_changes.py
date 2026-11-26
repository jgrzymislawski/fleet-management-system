import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)
from vehicles.models import Vehicle, VehicleDocument


@override_settings(SECURE_SSL_REDIRECT=False)
class DocumentAccessAfterChangesTests(APITestCase):
    def setUp(self):
        self.temp_media = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_media.cleanup)

        media_override = override_settings(MEDIA_ROOT=self.temp_media.name)
        media_override.enable()
        self.addCleanup(media_override.disable)

        self.organization = Organization.objects.create(name="Document Access Org")
        self.company = Company.objects.create(
            organization=self.organization,
            name="Document Access Company",
        )
        self.viewer = User.objects.create_user(
            username="document_access_viewer",
            password="StrongPassword123!",
        )
        self.admin = User.objects.create_user(
            username="document_access_admin",
            password="StrongPassword123!",
        )
        self.membership = OrganizationMembership.objects.create(
            user=self.viewer,
            organization=self.organization,
            role="member",
        )
        OrganizationMembership.objects.create(
            user=self.admin,
            organization=self.organization,
            role="admin",
        )
        self.grant = CompanyAccess.objects.create(
            membership=self.membership,
            company=self.company,
            role="viewer",
        )
        self.vehicle = Vehicle.objects.create(
            organization=self.organization,
            company=self.company,
            brand="Ford",
            model="Focus",
            registration_number="DLSEC123",
            year=2020,
        )
        self.document = VehicleDocument.objects.create(
            vehicle=self.vehicle,
            document_type="oc",
            document_number="POLISA-123",
            file=SimpleUploadedFile(
                "policy.pdf",
                b"%PDF-1.4\nFlotivo security regression\n%%EOF\n",
                content_type="application/pdf",
            ),
        )
        self.download_url = reverse(
            "vehicle-document-download",
            kwargs={"pk": self.document.pk},
        )

    def authenticated_client(self, user):
        token = TokenObtainPairSerializer.get_token(user)
        client = APIClient()
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token.access_token}"
        )
        return client

    def assert_file_unavailable(self, client, expected_status):
        response = client.get(self.download_url)
        self.assertEqual(response.status_code, expected_status)
        self.assertNotIn("vehicle_documents/", str(response.data))
        self.assertTrue(
            VehicleDocument.objects.filter(pk=self.document.pk).exists()
        )

    def test_download_has_private_headers_and_attachment_disposition(self):
        client = self.authenticated_client(self.viewer)
        response = client.get(self.download_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("private", response["Cache-Control"])
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertNotIn("vehicle_documents/", response["Content-Disposition"])
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF-"))

    def test_existing_token_loses_document_after_company_grant_revoked(self):
        client = self.authenticated_client(self.viewer)
        self.assertEqual(client.get(self.download_url).status_code, 200)
        self.grant.delete()
        self.assert_file_unavailable(client, status.HTTP_404_NOT_FOUND)

    def test_existing_token_loses_document_after_company_deactivated(self):
        client = self.authenticated_client(self.viewer)
        self.assertEqual(client.get(self.download_url).status_code, 200)
        self.company.is_active = False
        self.company.save(update_fields=["is_active"])
        self.assert_file_unavailable(client, status.HTTP_404_NOT_FOUND)

    def test_existing_token_loses_document_after_vehicle_soft_deleted(self):
        client = self.authenticated_client(self.viewer)
        self.assertEqual(client.get(self.download_url).status_code, 200)
        self.vehicle.soft_delete()
        self.assert_file_unavailable(client, status.HTTP_404_NOT_FOUND)

    def test_existing_token_loses_document_after_organization_deactivated(self):
        client = self.authenticated_client(self.viewer)
        self.assertEqual(client.get(self.download_url).status_code, 200)
        self.organization.is_active = False
        self.organization.save(update_fields=["is_active"])
        self.assert_file_unavailable(client, status.HTTP_403_FORBIDDEN)

    def test_admin_can_download_historical_file_from_inactive_company(self):
        client = self.authenticated_client(self.admin)
        self.company.is_active = False
        self.company.save(update_fields=["is_active"])
        response = client.get(self.download_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(b"".join(response.streaming_content).startswith(b"%PDF-"))
