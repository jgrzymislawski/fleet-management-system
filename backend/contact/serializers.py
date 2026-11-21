import re

from rest_framework import serializers


CONTROL_CHARACTERS = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]"
)


def normalize_single_line(
    value,
):
    value = " ".join(
        str(value)
        .strip()
        .split()
    )

    return value


def reject_control_characters(
    value,
):
    if CONTROL_CHARACTERS.search(
        value
    ):
        raise serializers.ValidationError(
            (
                "Pole zawiera niedozwolone "
                "znaki sterujące."
            )
        )

    return value


class ContactFormSerializer(
    serializers.Serializer
):
    name = serializers.CharField(
        max_length=150,
        min_length=2,
    )

    email = serializers.EmailField(
        max_length=254,
    )

    company = serializers.CharField(
        max_length=200,
        required=False,
        allow_blank=True,
    )

    phone = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
    )

    message = serializers.CharField(
        max_length=5000,
        min_length=10,
        trim_whitespace=True,
    )

    def validate_name(
        self,
        value,
    ):
        value = normalize_single_line(
            value
        )

        value = reject_control_characters(
            value
        )

        if len(value) < 2:
            raise serializers.ValidationError(
                (
                    "Imię i nazwisko musi mieć "
                    "co najmniej 2 znaki."
                )
            )

        return value

    def validate_email(
        self,
        value,
    ):
        return (
            value
            .strip()
            .lower()
        )

    def validate_company(
        self,
        value,
    ):
        value = normalize_single_line(
            value
        )

        return reject_control_characters(
            value
        )

    def validate_phone(
        self,
        value,
    ):
        value = normalize_single_line(
            value
        )

        value = reject_control_characters(
            value
        )

        if not value:
            return ""

        if not re.fullmatch(
            r"[0-9+()\-\s.]{5,50}",
            value,
        ):
            raise serializers.ValidationError(
                (
                    "Numer telefonu zawiera "
                    "nieprawidłowe znaki."
                )
            )

        digits = re.sub(
            r"\D",
            "",
            value,
        )

        if len(digits) < 5:
            raise serializers.ValidationError(
                (
                    "Numer telefonu jest "
                    "zbyt krótki."
                )
            )

        return value

    def validate_message(
        self,
        value,
    ):
        value = value.strip()

        value = reject_control_characters(
            value
        )

        if len(value) < 10:
            raise serializers.ValidationError(
                (
                    "Wiadomość musi mieć "
                    "co najmniej 10 znaków."
                )
            )

        return value
