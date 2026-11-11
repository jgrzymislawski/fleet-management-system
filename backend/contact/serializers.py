from rest_framework import serializers


class ContactFormSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=150,
    )

    email = serializers.EmailField()

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
    )