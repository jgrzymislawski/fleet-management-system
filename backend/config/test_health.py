
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse


class HealthViewTests(SimpleTestCase):

    def test_live_is_public(self):
        response = self.client.get(
            reverse("health-live"),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok"},
        )

        self.assertIn(
            "no-store",
            response["Cache-Control"],
        )

    def test_live_rejects_post(self):
        response = self.client.post(
            reverse("health-live"),
            secure=True,
        )

        self.assertEqual(response.status_code, 405)

    @patch("config.health_views._check_redis")
    @patch("config.health_views._check_database")
    def test_ready_when_dependencies_work(
        self,
        database_check,
        redis_check,
    ):
        response = self.client.get(
            reverse("health-ready"),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "ok"},
        )

        database_check.assert_called_once_with()
        redis_check.assert_called_once_with()

    @patch(
        "config.health_views._check_database",
        side_effect=RuntimeError("private detail"),
    )
    def test_ready_when_database_fails(
        self,
        database_check,
    ):
        response = self.client.get(
            reverse("health-ready"),
            secure=True,
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"status": "unavailable"},
        )

        self.assertNotIn(
            b"private detail",
            response.content,
        )

    @patch(
        "config.health_views._check_redis",
        side_effect=RuntimeError("private detail"),
    )
    @patch("config.health_views._check_database")
    def test_ready_when_redis_fails(
        self,
        database_check,
        redis_check,
    ):
        response = self.client.get(
            reverse("health-ready"),
            secure=True,
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {"status": "unavailable"},
        )
