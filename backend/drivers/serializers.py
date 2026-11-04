from rest_framework import serializers

from .models import Driver


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
        )

        if not value:
            raise serializers.ValidationError(
                "Numer prawa jazdy jest wymagany."
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
                not in categories
            ):
                categories.append(
                    normalized_category
                )

        return categories