
from django.test import SimpleTestCase
from django.urls import Resolver404, resolve, reverse
from rest_framework.test import APIClient


class DocumentRouteSecurityTests(SimpleTestCase):

    def setUp(self):
        self.client = APIClient()

    def test_media_files_are_not_served_directly(self):
        with self.assertRaises(Resolver404):
            resolve(
                "/media/vehicle_documents/test.pdf"
            )

    def test_download_requires_authentication(self):
        url = reverse(
            "vehicle-document-download",
            kwargs={"pk": 999999},
        )

        response = self.client.get(url)

        self.assertEqual(
            response.status_code,
            401,
        )
