import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from organizations.models import (
    Company,
    Organization,
    OrganizationMembership,
)

from .models import Vehicle, VehicleDocument


class VehicleDocumentFileLifecycleTests(TestCase):
    def setUp(self):
        self.temp_media = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_media.cleanup)
        self.media_override = override_settings(
            MEDIA_ROOT=self.temp_media.name
        )
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)

        self.organization = Organization.objects.create(name="Lifecycle test")
        self.company = Company.objects.create(
            organization=self.organization,
            name="Lifecycle company",
            tax_id="7012345678",
        )
        self.vehicle = Vehicle.objects.create(
            organization=self.organization,
            company=self.company,
            brand="Ford",
            model="Focus",
            registration_number="TESTLC1",
            vin="WF0LC000000000001",
            year=2020,
        )

    def make_document(self, filename="old.pdf"):
        return VehicleDocument.objects.create(
            vehicle=self.vehicle,
            document_type="oc",
            file=SimpleUploadedFile(
                filename, b"%PDF-1.4\nFlotivo test\n",
                content_type="application/pdf",
            ),
        )

    def test_deleting_document_removes_file_after_commit(self):
        document = self.make_document()
        storage = document.file.storage
        old_name = document.file.name

        with self.captureOnCommitCallbacks(execute=True):
            document.delete()
            self.assertTrue(storage.exists(old_name))

        self.assertFalse(storage.exists(old_name))

    def test_replacing_document_preserves_new_file_and_removes_old(self):
        document = self.make_document()
        storage = document.file.storage
        old_name = document.file.name

        with self.captureOnCommitCallbacks(execute=True):
            document.file = SimpleUploadedFile(
                "new.pdf", b"%PDF-1.4\nReplacement\n",
                content_type="application/pdf",
            )
            document.save()
            new_name = document.file.name
            self.assertNotEqual(old_name, new_name)
            self.assertTrue(storage.exists(old_name))
            self.assertTrue(storage.exists(new_name))

        self.assertFalse(storage.exists(old_name))
        self.assertTrue(storage.exists(new_name))
        document.refresh_from_db()
        self.assertEqual(document.file.name, new_name)

    def test_shared_file_is_not_deleted_until_last_reference_is_removed(self):
        document = self.make_document()
        storage = document.file.storage
        filename = document.file.name
        other = VehicleDocument.objects.create(
            vehicle=self.vehicle,
            document_type="inspection",
            file=filename,
        )

        with self.captureOnCommitCallbacks(execute=True):
            document.delete()
        self.assertTrue(storage.exists(filename))

        with self.captureOnCommitCallbacks(execute=True):
            other.delete()
        self.assertFalse(storage.exists(filename))

    def test_rolled_back_deletion_keeps_file_and_database_record(self):
        document = self.make_document()
        storage = document.file.storage
        filename = document.file.name
        pk = document.pk

        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    document.delete()
                    raise RuntimeError("Rollback test")

        self.assertTrue(storage.exists(filename))
        self.assertTrue(VehicleDocument.objects.filter(pk=pk).exists())

    def test_hard_delete_of_vehicle_removes_document_file(self):
        document = self.make_document()
        storage = document.file.storage
        filename = document.file.name

        with self.captureOnCommitCallbacks(execute=True):
            self.vehicle.delete()

        self.assertFalse(storage.exists(filename))

    def test_saving_other_fields_does_not_remove_attachment(self):
        document = self.make_document()
        storage = document.file.storage
        filename = document.file.name

        with self.captureOnCommitCallbacks(execute=True):
            document.document_number = "NEW-NUMBER"
            document.save(update_fields=["document_number"])

        self.assertTrue(storage.exists(filename))

    def test_api_deletion_removes_attachment_only_after_commit(self):
        user = User.objects.create_user(
            username="file_lifecycle_admin", password="StrongTestPassword!"
        )
        OrganizationMembership.objects.create(
            user=user, organization=self.organization, role="admin"
        )
        document = self.make_document()
        storage = document.file.storage
        filename = document.file.name
        client = APIClient()
        client.force_authenticate(user=user)

        with self.captureOnCommitCallbacks(execute=True):
            response = client.delete(
                reverse(
                    "vehicle-documents-detail",
                    kwargs={"pk": document.pk},
                )
            )
            self.assertEqual(response.status_code, 204)
            self.assertTrue(storage.exists(filename))

        self.assertFalse(storage.exists(filename))
