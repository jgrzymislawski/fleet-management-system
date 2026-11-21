from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import override_settings

from rest_framework import status
from rest_framework.test import APITestCase


@override_settings(
    EMAIL_BACKEND=(
        "django.core.mail.backends."
        "locmem.EmailBackend"
    ),
    DEFAULT_FROM_EMAIL=(
        "Flotivo <no-reply@flotivo.test>"
    ),
    CONTACT_EMAIL=(
        "kontakt@flotivo.test"
    ),
)
class ContactFormTests(
    APITestCase
):
    def setUp(self):
        cache.clear()

        self.url = (
            "/api/contact/"
        )

        self.valid_data = {
            "name": "Jan Kowalski",
            "email": (
                "jan@example.com"
            ),
            "company": "Firma Test",
            "phone": "+48 500 600 700",
            "message": (
                "Chciałbym dowiedzieć się "
                "więcej o systemie Flotivo."
            ),
        }

    def tearDown(self):
        cache.clear()

    def test_contact_form_is_public(
        self,
    ):
        response = self.client.post(
            self.url,
            self.valid_data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_contact_form_sends_email(
        self,
    ):
        response = self.client.post(
            self.url,
            self.valid_data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(mail.outbox),
            1,
        )

        message = mail.outbox[0]

        self.assertEqual(
            message.to,
            [
                "kontakt@flotivo.test",
            ],
        )

        self.assertEqual(
            message.reply_to,
            [
                "jan@example.com",
            ],
        )

        self.assertIn(
            "Jan Kowalski",
            message.body,
        )

    def test_email_is_normalized(
        self,
    ):
        data = {
            **self.valid_data,
            "email": (
                "  JAN@EXAMPLE.COM  "
            ),
        }

        response = self.client.post(
            self.url,
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            mail.outbox[0].reply_to,
            [
                "jan@example.com",
            ],
        )

    def test_short_message_is_rejected(
        self,
    ):
        data = {
            **self.valid_data,
            "message": "Hej",
        }

        response = self.client.post(
            self.url,
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_phone_is_rejected(
        self,
    ):
        data = {
            **self.valid_data,
            "phone": (
                "javascript:alert(1)"
            ),
        }

        response = self.client.post(
            self.url,
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_control_characters_are_rejected(
        self,
    ):
        data = {
            **self.valid_data,
            "name": "Jan\x00Kowalski",
        }

        response = self.client.post(
            self.url,
            data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_rate_limit_blocks_sixth_request(
        self,
    ):
        for _ in range(5):
            response = (
                self.client.post(
                    self.url,
                    self.valid_data,
                    format="json",
                    REMOTE_ADDR=(
                        "203.0.113.10"
                    ),
                )
            )

            self.assertEqual(
                response.status_code,
                status.HTTP_200_OK,
            )

        response = self.client.post(
            self.url,
            self.valid_data,
            format="json",
            REMOTE_ADDR=(
                "203.0.113.10"
            ),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    def test_different_ip_has_separate_rate_limit(
        self,
    ):
        for _ in range(5):
            self.client.post(
                self.url,
                self.valid_data,
                format="json",
                REMOTE_ADDR=(
                    "203.0.113.10"
                ),
            )

        response = self.client.post(
            self.url,
            self.valid_data,
            format="json",
            REMOTE_ADDR=(
                "203.0.113.11"
            ),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    @override_settings(
        CONTACT_EMAIL=""
    )
    def test_missing_contact_email_returns_503(
        self,
    ):
        response = self.client.post(
            self.url,
            self.valid_data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @patch(
        "contact.views.EmailMessage.send"
    )
    def test_email_failure_returns_503(
        self,
        mocked_send,
    ):
        mocked_send.side_effect = (
            RuntimeError(
                "SMTP error"
            )
        )

        response = self.client.post(
            self.url,
            self.valid_data,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
