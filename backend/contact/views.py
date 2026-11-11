import logging

from django.conf import settings
from django.core.mail import EmailMessage

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from .serializers import ContactFormSerializer


logger = logging.getLogger(__name__)


class ContactFormRateThrottle(
    SimpleRateThrottle
):
    scope = "contact"
    rate = "5/hour"

    def get_cache_key(
        self,
        request,
        view,
    ):
        ident = self.get_ident(
            request
        )

        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }


class ContactFormView(APIView):
    permission_classes = [
        AllowAny
    ]

    throttle_classes = [
        ContactFormRateThrottle
    ]

    authentication_classes = []

    def post(
        self,
        request,
    ):
        serializer = ContactFormSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        data = serializer.validated_data

        name = data["name"]
        email = data["email"]

        company = data.get(
            "company",
            "",
        )

        phone = data.get(
            "phone",
            "",
        )

        message = data["message"]

        email_body = (
            "Nowe zgłoszenie z formularza Flotivo\n\n"
            f"Imię i nazwisko: {name}\n"
            f"Adres e-mail: {email}\n"
            f"Firma: {company or '-'}\n"
            f"Telefon: {phone or '-'}\n\n"
            "Wiadomość:\n"
            f"{message}\n"
        )

        try:
            contact_email = EmailMessage(
                subject=(
                    "Nowe zgłoszenie "
                    "z formularza Flotivo"
                ),
                body=email_body,
                from_email=(
                    settings.DEFAULT_FROM_EMAIL
                ),
                to=[
                    settings.CONTACT_EMAIL
                ],
                reply_to=[
                    email
                ],
            )

            contact_email.send(
                fail_silently=False,
            )

        except Exception:
            logger.exception(
                "Nie udało się wysłać "
                "wiadomości z formularza "
                "kontaktowego."
            )

            return Response(
                {
                    "detail": (
                        "Nie udało się wysłać "
                        "wiadomości. "
                        "Spróbuj ponownie później."
                    )
                },
                status=(
                    status
                    .HTTP_503_SERVICE_UNAVAILABLE
                ),
            )

        return Response(
            {
                "detail": (
                    "Wiadomość została "
                    "wysłana."
                )
            },
            status=status.HTTP_200_OK,
        )