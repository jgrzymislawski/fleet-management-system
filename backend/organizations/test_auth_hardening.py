
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient, APITestCase


@override_settings(SECURE_SSL_REDIRECT=False)
class AuthenticationHardeningTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = get_user_model().objects.create_user(
            username="hardening_user",
            password="TestPassword123!",
        )
        self.csrf_url = reverse("auth_csrf")
        self.login_url = reverse("token_obtain_pair")
        self.refresh_url = reverse("token_refresh")
        self.logout_url = reverse("token_blacklist")
        self.password_url = reverse("change-password")

    def tearDown(self):
        cache.clear()

    def get_csrf(self):
        response = self.client.get(self.csrf_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return self.client.cookies["csrftoken"].value

    def login(self, csrf):
        response = self.client.post(
            self.login_url,
            {
                "username": "hardening_user",
                "password": "TestPassword123!",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def test_logout_without_csrf_does_not_invalidate_session(self):
        csrf = self.get_csrf()
        self.login(csrf)
        old_refresh = self.client.cookies["flotivo_refresh"].value

        response = self.client.post(
            self.logout_url,
            {},
            format="json",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.cookies["flotivo_refresh"].value,
            old_refresh,
        )

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

    def test_logout_removes_refresh_cookie(self):
        csrf = self.get_csrf()
        self.login(csrf)

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
        self.assertIn("flotivo_refresh", response.cookies)
        self.assertEqual(
            response.cookies["flotivo_refresh"].value,
            "",
        )
        self.assertEqual(
            int(response.cookies["flotivo_refresh"]["max-age"]),
            0,
        )

    def test_logout_does_not_accept_get(self):
        csrf = self.get_csrf()
        self.login(csrf)

        response = self.client.get(self.logout_url)
        self.assertEqual(
            response.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @override_settings(DEBUG=False)
    def test_refresh_cookie_is_secure_outside_debug(self):
        csrf = self.get_csrf()
        response = self.login(csrf)
        cookie = response.cookies["flotivo_refresh"]

        self.assertTrue(cookie["secure"])
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")

    def test_password_change_invalidates_old_tokens(self):
        csrf = self.get_csrf()
        response = self.login(csrf)

        old_access = response.data["access"]
        old_refresh = self.client.cookies["flotivo_refresh"].value
        new_password = "ChangedPassword789!"

        response = self.client.post(
            self.password_url,
            {
                "current_password": "TestPassword123!",
                "new_password": new_password,
                "confirm_password": new_password,
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {old_access}",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))

        response = self.client.post(
            self.password_url,
            {
                "current_password": new_password,
                "new_password": "AnotherPassword789!",
                "confirm_password": "AnotherPassword789!",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {old_access}",
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.client.cookies["flotivo_refresh"] = old_refresh

        response = self.client.post(
            self.refresh_url,
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
