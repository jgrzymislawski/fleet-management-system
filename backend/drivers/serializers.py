from django.utils import timezone
from rest_framework import serializers

from .models import Driver


ALLOWED_LICENSE_CATEGORIES = {
    "AM",
    "A1",
    "A2",
    "A",
    "B1",
    "B",
    "B+E",
    "C1",
    "C1+E",
    "C",
    "C+E",
    "D1",
    "D1+E",
    "D",
    "D+E",
    "T",
}


class DriverSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = Driver
        fields = "__all__"

        read_only_fields = [
            "organization",
            "is_deleted",
            "deleted_at",
        ]

    def validate_first_name(
        self,
        value,
    ):
        value = str(
            value
        ).strip()

        if not value:
            raise serializers.ValidationError(
                "Imię jest wymagane."
            )

        return value

    def validate_last_name(
        self,
        value,
    ):
        value = str(
            value
        ).strip()

        if not value:
            raise serializers.ValidationError(
                "Nazwisko jest wymagane."
            )

        return value

    def validate_license_number(
        self,
        value,
    ):
        if value is None:
            raise serializers.ValidationError(
                "Numer prawa jazdy jest wymagany."
            )

        value = (
            str(value)
            .strip()
            .upper()
            .replace(
                " ",
                "",
            )
        )

        if not value:
            raise serializers.ValidationError(
                "Numer prawa jazdy jest wymagany."
            )

        if len(value) > 30:
            raise serializers.ValidationError(
                (
                    "Numer prawa jazdy może mieć "
                    "maksymalnie 30 znaków."
                )
            )

        return value

    def validate_license_categories(
        self,
        value,
    ):
        if value is None:
            return []

        if not isinstance(
            value,
            list,
        ):
            raise serializers.ValidationError(
                (
                    "Kategorie prawa jazdy "
                    "muszą być listą."
                )
            )

        categories = []

        for category in value:
            if not isinstance(
                category,
                str,
            ):
                raise serializers.ValidationError(
                    (
                        "Każda kategoria prawa "
                        "jazdy musi być tekstem."
                    )
                )

            normalized_category = (
                category
                .strip()
                .upper()
            )

            if not normalized_category:
                continue

            if (
                normalized_category
                not in ALLOWED_LICENSE_CATEGORIES
            ):
                raise serializers.ValidationError(
                    (
                        "Nieprawidłowa kategoria "
                        f"prawa jazdy: {normalized_category}."
                    )
                )

            if (
                normalized_category
                not in categories
            ):
                categories.append(
                    normalized_category
                )

        return categories

    def validate_phone_number(
        self,
        value,
    ):
        value = (
            str(value).strip()
            if value is not None
            else ""
        )

        if len(value) > 20:
            raise serializers.ValidationError(
                (
                    "Numer telefonu może mieć "
                    "maksymalnie 20 znaków."
                )
            )

        return value

    def validate_hired_at(
        self,
        value,
    ):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                (
                    "Data zatrudnienia nie może "
                    "być datą przyszłą."
                )
            )

        return value
