from rest_framework import serializers

from .models import (
    NotificationPreference,
    NotificationSettings,
)


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    class Meta:
        model = NotificationPreference
        fields = [
            "email",
            "email_enabled",
            "insurance_enabled",
            "inspection_enabled",
            "documents_enabled",
            "driver_license_enabled",
            "medical_exam_enabled",
        ]


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = [
            "insurance_enabled",
            "inspection_enabled",
            "documents_enabled",
            "driver_license_enabled",
            "medical_exam_enabled",
            "notify_30_days",
            "notify_14_days",
            "notify_7_days",
            "notify_1_day",
        ]

    def validate(self, attrs):
        instance = self.instance

        notify_30_days = attrs.get(
            "notify_30_days",
            getattr(
                instance,
                "notify_30_days",
                True,
            ),
        )

        notify_14_days = attrs.get(
            "notify_14_days",
            getattr(
                instance,
                "notify_14_days",
                True,
            ),
        )

        notify_7_days = attrs.get(
            "notify_7_days",
            getattr(
                instance,
                "notify_7_days",
                True,
            ),
        )

        notify_1_day = attrs.get(
            "notify_1_day",
            getattr(
                instance,
                "notify_1_day",
                True,
            ),
        )

        if not any(
            [
                notify_30_days,
                notify_14_days,
                notify_7_days,
                notify_1_day,
            ]
        ):
            raise serializers.ValidationError(
                {
                    "notification_days": (
                        "Musi być włączony przynajmniej "
                        "jeden termin powiadomienia."
                    )
                }
            )

        return attrs