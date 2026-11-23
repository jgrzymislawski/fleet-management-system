
from django.contrib.auth.models import User
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from organizations.models import (
    Company,
    CompanyAccess,
    Organization,
    OrganizationMembership,
)

from .models import Vehicle, VehicleDocument


class VehicleDocumentTenantIsolationTests(APITestCase):

    def setUp(self):
        # Dwie niezalezne organizacje
        self.org_a = Organization.objects.create(
            name="Organizacja A"
        )
        self.org_b = Organization.objects.create(
            name="Organizacja B"
        )

        # Dwie spolki w organizacji A
        self.company_a1 = Company.objects.create(
            organization=self.org_a,
            name="Spolka A1",
            tax_id="1111111111",
        )
        self.company_a2 = Company.objects.create(
            organization=self.org_a,
            name="Spolka A2",
            tax_id="2222222222",
        )

        # Spolka w organizacji B
        self.company_b = Company.objects.create(
            organization=self.org_b,
            name="Spolka B",
            tax_id="3333333333",
        )

        # Uzytkownicy
        self.admin_a = User.objects.create_user(
            username="isolation_admin_a",
            password="TestPassword123!",
        )
        self.viewer_a = User.objects.create_user(
            username="isolation_viewer_a",
            password="TestPassword123!",
        )
        self.admin_b = User.objects.create_user(
            username="isolation_admin_b",
            password="TestPassword123!",
        )

        OrganizationMembership.objects.create(
            user=self.admin_a,
            organization=self.org_a,
            role="admin",
        )

        viewer_membership = (
            OrganizationMembership.objects.create(
                user=self.viewer_a,
                organization=self.org_a,
                role="member",
            )
        )

        OrganizationMembership.objects.create(
            user=self.admin_b,
            organization=self.org_b,
            role="admin",
        )

        # Viewer widzi tylko spolke A1
        CompanyAccess.objects.create(
            membership=viewer_membership,
            company=self.company_a1,
            role="viewer",
        )

        # Pojazdy
        self.vehicle_a1 = Vehicle.objects.create(
            organization=self.org_a,
            company=self.company_a1,
            brand="Ford",
            model="Focus",
            registration_number="DL11111",
            vin="WF0AAA11111111111",
            year=2020,
        )

        self.vehicle_a2 = Vehicle.objects.create(
            organization=self.org_a,
            company=self.company_a2,
            brand="Opel",
            model="Astra",
            registration_number="DL22222",
            vin="W0LBBB22222222222",
            year=2021,
        )

        self.vehicle_b = Vehicle.objects.create(
            organization=self.org_b,
            company=self.company_b,
            brand="Toyota",
            model="Corolla",
            registration_number="DW33333",
            vin="JTDBBB33333333333",
            year=2022,
        )

        # Dokumenty
        self.document_a1 = VehicleDocument.objects.create(
            vehicle=self.vehicle_a1,
            document_type="oc",
            document_number="OC-A1",
        )

        self.document_a2 = VehicleDocument.objects.create(
            vehicle=self.vehicle_a2,
            document_type="oc",
            document_number="OC-A2",
        )

        self.document_b = VehicleDocument.objects.create(
            vehicle=self.vehicle_b,
            document_type="oc",
            document_number="OC-B",
        )

        self.list_url = reverse(
            "vehicle-documents-list"
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def document_url(self, document):
        return reverse(
            "vehicle-documents-detail",
            kwargs={"pk": document.pk},
        )

    def document_ids(self, response):
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        data = response.data

        if isinstance(data, dict):
            data = data["results"]

        return {
            item["id"]
            for item in data
        }

    # 1. Admin A nie widzi dokumentow B
    def test_admin_list_isolated_by_organization(self):
        self.authenticate(self.admin_a)

        response = self.client.get(self.list_url)

        ids = self.document_ids(response)

        self.assertIn(self.document_a1.pk, ids)
        self.assertIn(self.document_a2.pk, ids)
        self.assertNotIn(self.document_b.pk, ids)

    # 2. Viewer widzi tylko przyznana spolke
    def test_viewer_list_isolated_by_company(self):
        self.authenticate(self.viewer_a)

        response = self.client.get(self.list_url)

        ids = self.document_ids(response)

        self.assertEqual(
            ids,
            {self.document_a1.pk},
        )

    # 3. Admin A nie moze odczytac dokumentu B
    def test_admin_cannot_read_foreign_document(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            self.document_url(self.document_b)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    # 4. Viewer nie widzi innej spolki w tej samej org
    def test_viewer_cannot_read_other_company(self):
        self.authenticate(self.viewer_a)

        response = self.client.get(
            self.document_url(self.document_a2)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    # 5. Admin A nie moze dodac dokumentu do B
    def test_admin_cannot_create_foreign_document(self):
        self.authenticate(self.admin_a)

        count_before = VehicleDocument.objects.count()

        response = self.client.post(
            self.list_url,
            {
                "vehicle": self.vehicle_b.pk,
                "document_type": "oc",
                "document_number": "FOREIGN",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            VehicleDocument.objects.count(),
            count_before,
        )

    # 6. Viewer nie moze tworzyc dokumentow
    def test_viewer_cannot_create_document(self):
        self.authenticate(self.viewer_a)

        response = self.client.post(
            self.list_url,
            {
                "vehicle": self.vehicle_a1.pk,
                "document_type": "oc",
                "document_number": "VIEWER",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    # 7. Admin A nie moze przeniesc dokumentu do B
    def test_admin_cannot_move_document_to_foreign_org(self):
        self.authenticate(self.admin_a)

        response = self.client.patch(
            self.document_url(self.document_a1),
            {"vehicle": self.vehicle_b.pk},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.document_a1.refresh_from_db()

        self.assertEqual(
            self.document_a1.vehicle_id,
            self.vehicle_a1.pk,
        )

    # 8. Admin A nie moze edytowac dokumentu B
    def test_admin_cannot_update_foreign_document(self):
        self.authenticate(self.admin_a)

        response = self.client.patch(
            self.document_url(self.document_b),
            {"document_number": "CHANGED"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.document_b.refresh_from_db()

        self.assertEqual(
            self.document_b.document_number,
            "OC-B",
        )

    # 9. Admin A nie moze usunac dokumentu B
    def test_admin_cannot_delete_foreign_document(self):
        self.authenticate(self.admin_a)

        response = self.client.delete(
            self.document_url(self.document_b)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertTrue(
            VehicleDocument.objects.filter(
                pk=self.document_b.pk
            ).exists()
        )

    # 10. Viewer nie moze edytowac swojego dokumentu
    def test_viewer_cannot_update_own_document(self):
        self.authenticate(self.viewer_a)

        response = self.client.patch(
            self.document_url(self.document_a1),
            {"document_number": "CHANGED"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    # 11. Viewer nie moze usunac swojego dokumentu
    def test_viewer_cannot_delete_own_document(self):
        self.authenticate(self.viewer_a)

        response = self.client.delete(
            self.document_url(self.document_a1)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.assertTrue(
            VehicleDocument.objects.filter(
                pk=self.document_a1.pk
            ).exists()
        )

    # 12. Admin A moze tworzyc dokumenty u siebie
    def test_admin_can_create_own_document(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            self.list_url,
            {
                "vehicle": self.vehicle_a1.pk,
                "document_type": "oc",
                "document_number": "NEW-OC",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertTrue(
            VehicleDocument.objects.filter(
                vehicle=self.vehicle_a1,
                document_number="NEW-OC",
            ).exists()
        )

    # 13. Admin B ma dostep do dokumentow B
    def test_admin_b_can_read_own_document(self):
        self.authenticate(self.admin_b)

        response = self.client.get(
            self.document_url(self.document_b)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    # 14. Anonimowy uzytkownik nie widzi listy
    def test_anonymous_cannot_list_documents(self):
        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
