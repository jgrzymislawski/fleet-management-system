import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
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
from vehicles.models import Vehicle, VehicleDocument


@override_settings(SECURE_SSL_REDIRECT=False)
class DocumentUploadHardeningTests(APITestCase):
    def setUp(self):
        self.temp_media = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_media.cleanup)
        self.media_settings = override_settings(MEDIA_ROOT=self.temp_media.name)
        self.media_settings.enable()
        self.addCleanup(self.media_settings.disable)

        self.org_a = Organization.objects.create(name="Upload Organization A")
        self.org_b = Organization.objects.create(name="Upload Organization B")

        self.company_a = Company.objects.create(
            organization=self.org_a,
            name="Upload Company A",
        )
        self.company_b = Company.objects.create(
            organization=self.org_b,
            name="Upload Company B",
        )

        self.admin_a = User.objects.create_user(
            username="upload_admin_a",
            password="TestPassword123!",
        )
        self.admin_b = User.objects.create_user(
            username="upload_admin_b",
            password="TestPassword123!",
        )
        self.viewer_a = User.objects.create_user(
            username="upload_viewer_a",
            password="TestPassword123!",
        )

        OrganizationMembership.objects.create(
            user=self.admin_a,
            organization=self.org_a,
            role="admin",
        )
        OrganizationMembership.objects.create(
            user=self.admin_b,
            organization=self.org_b,
            role="admin",
        )
        viewer_membership = OrganizationMembership.objects.create(
            user=self.viewer_a,
            organization=self.org_a,
            role="member",
        )
        CompanyAccess.objects.create(
            membership=viewer_membership,
            company=self.company_a,
            role="viewer",
        )

        self.vehicle_a = Vehicle.objects.create(
            organization=self.org_a,
            company=self.company_a,
            brand="Ford",
            model="Focus",
            registration_number="DLUP101",
            year=2020,
        )
        self.vehicle_b = Vehicle.objects.create(
            organization=self.org_b,
            company=self.company_b,
            brand="Toyota",
            model="Corolla",
            registration_number="DWUP202",
            year=2021,
        )

        self.url = reverse("vehicle-documents-list")

    @staticmethod
    def upload_file(name="proof.pdf", content=None, mime="application/pdf"):
        if content is None:
            content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
        return SimpleUploadedFile(name, content, content_type=mime)

    def send_upload(self, file, vehicle=None):
        return self.client.post(
            self.url,
            {
                "vehicle": vehicle or self.vehicle_a.pk,
                "document_type": "oc",
                "document_number": "UPLOAD-TEST",
                "file": file,
            },
            format="multipart",
        )

    def assert_rejected_without_record(self, response, expected_status):
        self.assertEqual(response.status_code, expected_status)
        self.assertEqual(VehicleDocument.objects.count(), 0)

    def test_admin_can_upload_pdf_without_exposing_file_path(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.send_upload(self.upload_file())

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(VehicleDocument.objects.count(), 1)
        self.assertTrue(response.data["has_file"])
        self.assertNotIn("file", response.data)

        document = VehicleDocument.objects.get()
        self.assertEqual(document.vehicle_id, self.vehicle_a.pk)
        self.assertTrue(document.file.storage.exists(document.file.name))

    def test_executable_extension_is_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.send_upload(
            self.upload_file("malware.exe", b"MZ1234", "application/octet-stream")
        )
        self.assert_rejected_without_record(response, status.HTTP_400_BAD_REQUEST)

    def test_pdf_extension_with_html_content_is_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.send_upload(
            self.upload_file("forged.pdf", b"<html>not a PDF</html>")
        )
        self.assert_rejected_without_record(response, status.HTTP_400_BAD_REQUEST)

    def test_png_extension_with_gif_content_is_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.send_upload(
            self.upload_file("forged.png", b"GIF89a123456", "image/png")
        )
        self.assert_rejected_without_record(response, status.HTTP_400_BAD_REQUEST)

    def test_pdf_with_wrong_mime_type_is_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.send_upload(
            self.upload_file("document.pdf", mime="image/png")
        )
        self.assert_rejected_without_record(response, status.HTTP_400_BAD_REQUEST)

    def test_empty_file_is_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.send_upload(self.upload_file("empty.pdf", b""))
        self.assert_rejected_without_record(response, status.HTTP_400_BAD_REQUEST)

    def test_file_over_10_mib_is_rejected(self):
        self.client.force_authenticate(user=self.admin_a)
        content = b"%PDF-" + (b"X" * (10 * 1024 * 1024))
        response = self.send_upload(self.upload_file("large.pdf", content))
        self.assert_rejected_without_record(response, status.HTTP_400_BAD_REQUEST)

    def test_foreign_admin_cannot_upload_to_another_organization(self):
        self.client.force_authenticate(user=self.admin_b)
        response = self.send_upload(self.upload_file(), vehicle=self.vehicle_a.pk)
        self.assert_rejected_without_record(response, status.HTTP_403_FORBIDDEN)

    def test_viewer_cannot_upload_to_own_company(self):
        self.client.force_authenticate(user=self.viewer_a)
        response = self.send_upload(self.upload_file())
        self.assert_rejected_without_record(response, status.HTTP_403_FORBIDDEN)

    def test_anonymous_user_cannot_upload_document(self):
        response = self.send_upload(self.upload_file())
        self.assert_rejected_without_record(response, status.HTTP_401_UNAUTHORIZED)
