
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from config.throttles import LoginAccountThrottle


class LoginThrottleTests(APITestCase):

    def setUp(self):
        cache.clear()

        self.url = reverse("token_obtain_pair")

        self.user = get_user_model().objects.create_user(
            username="throttle_test_user",
            password="TestPassword123!",
        )

    def tearDown(self):
        cache.clear()

    def test_correct_login_works(self):
        response = self.client.post(
            self.url,
            {
                "username": "throttle_test_user",
                "password": "TestPassword123!",
            },
            format="json",
            REMOTE_ADDR="192.0.2.10",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)

        self.assertIn(
            "flotivo_refresh",
            response.cookies,
        )

        self.assertTrue(
            response.cookies["flotivo_refresh"]["httponly"]
        )

    def test_ip_limit_returns_429(self):
        credentials = {
            "username": "throttle_test_user",
            "password": "WrongPassword123!",
        }

        for _ in range(10):
            response = self.client.post(
                self.url,
                credentials,
                format="json",
                REMOTE_ADDR="192.0.2.20",
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED,
            )

        response = self.client.post(
            self.url,
            credentials,
            format="json",
            REMOTE_ADDR="192.0.2.20",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    def test_account_limit_across_different_ips(self):
        credentials = {
            "username": "throttle_test_user",
            "password": "WrongPassword123!",
        }

        with patch.object(
            LoginAccountThrottle,
            "rate",
            "3/min",
        ):
            for index in range(3):
                response = self.client.post(
                    self.url,
                    credentials,
                    format="json",
                    REMOTE_ADDR=f"192.0.2.{30 + index}",
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_401_UNAUTHORIZED,
                )

            response = self.client.post(
                self.url,
                credentials,
                format="json",
                REMOTE_ADDR="192.0.2.40",
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_429_TOO_MANY_REQUESTS,
            )
