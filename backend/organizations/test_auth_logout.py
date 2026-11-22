from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient, APITestCase


class CookieAuthenticationTests(APITestCase):

    def setUp(self):
        cache.clear()

        self.client = APIClient(
            enforce_csrf_checks=True
        )

        self.user = get_user_model().objects.create_user(
            username="cookie_auth_user",
            password="TestPassword123!",
        )

        self.login_url = reverse(
            "token_obtain_pair"
        )
        self.refresh_url = reverse(
            "token_refresh"
        )
        self.logout_url = reverse(
            "token_blacklist"
        )
        self.csrf_url = reverse(
            "auth_csrf"
        )

    def tearDown(self):
        cache.clear()

    def get_csrf(self):
        response = self.client.get(
            self.csrf_url
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        return self.client.cookies[
            "csrftoken"
        ].value

    def login(self, csrf):
        return self.client.post(
            self.login_url,
            {
                "username": "cookie_auth_user",
                "password": "TestPassword123!",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

    def test_login_requires_csrf(self):
        response = self.client.post(
            self.login_url,
            {
                "username": "cookie_auth_user",
                "password": "TestPassword123!",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_login_sets_httponly_cookie(self):
        csrf = self.get_csrf()

        response = self.login(csrf)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn(
            "access",
            response.data,
        )

        self.assertNotIn(
            "refresh",
            response.data,
        )

        cookie = response.cookies[
            "flotivo_refresh"
        ]

        self.assertTrue(
            cookie["httponly"]
        )

        self.assertEqual(
            cookie["samesite"],
            "Lax",
        )

    def test_refresh_rotates_cookie(self):
        csrf = self.get_csrf()

        login_response = self.login(csrf)

        self.assertEqual(
            login_response.status_code,
            status.HTTP_200_OK,
        )

        old_refresh = self.client.cookies[
            "flotivo_refresh"
        ].value

        response = self.client.post(
            self.refresh_url,
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn(
            "access",
            response.data,
        )

        self.assertNotIn(
            "refresh",
            response.data,
        )

        new_refresh = self.client.cookies[
            "flotivo_refresh"
        ].value

        self.assertNotEqual(
            old_refresh,
            new_refresh,
        )

    def test_refresh_without_csrf_is_blocked(self):
        csrf = self.get_csrf()

        login_response = self.login(csrf)

        self.assertEqual(
            login_response.status_code,
            status.HTTP_200_OK,
        )

        response = self.client.post(
            self.refresh_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_logout_revokes_refresh_token(self):
        csrf = self.get_csrf()

        login_response = self.login(csrf)

        self.assertEqual(
            login_response.status_code,
            status.HTTP_200_OK,
        )

        old_refresh = self.client.cookies[
            "flotivo_refresh"
        ].value

        response = self.client.post(
            self.logout_url,
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.client.cookies[
            "flotivo_refresh"
        ] = old_refresh

        refresh_response = self.client.post(
            self.refresh_url,
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )

        self.assertEqual(
            refresh_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
