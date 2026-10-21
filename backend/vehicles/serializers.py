import mimetypes
from pathlib import Path

from rest_framework import serializers

from organizations.models import OrganizationMembership
from .models import Vehicle, ServiceRecord, VehicleDocument


class VehicleSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(
        source="company.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Vehicle
        fields = "__all__"
        read_only_fields = [
            "organization",
            "company_name",
        ]

    def validate(self, attrs):
        driver = attrs.get("driver")
        driver_name = attrs.get("driver_name")

        if self.instance:
            if "driver" not in attrs:
                driver = self.instance.driver

            if "driver_name" not in attrs:
                driver_name = self.instance.driver_name

        if driver and driver_name:
            raise serializers.ValidationError(
                "Wybierz kierowcę z listy albo wpisz kierowcę ręcznie, "
                "nie można użyć obu opcji jednocześnie."
            )

        request = self.context.get("request")

        if request and driver:
            user = request.user

            if not getattr(user, "is_superuser", False):
                membership = (
                    OrganizationMembership.objects
                    .filter(user=user)
                    .first()
                )

                if membership is None:
                    raise serializers.ValidationError(
                        {
                            "driver": (
                                "Użytkownik nie jest przypisany "
                                "do żadnej organizacji."
                            )
                        }
                    )

                if driver.organization_id != membership.organization_id:
                    raise serializers.ValidationError(
                        {
                            "driver": (
                                "Nie możesz przypisać kierowcy "
                                "z innej organizacji."
                            )
                        }
                    )

        return attrs


class ServiceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRecord
        fields = "__all__"


class VehicleDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleDocument
        fields = "__all__"

    def validate_file(self, file):
        max_size = 10 * 1024 * 1024

        if file.size > max_size:
            raise serializers.ValidationError(
                "Maksymalny rozmiar pliku to 10 MB."
            )

        allowed_extensions = {
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png",
        }

        extension = Path(file.name).suffix.lower()

        if extension not in allowed_extensions:
            raise serializers.ValidationError(
                "Dozwolone formaty plików: PDF, JPG, JPEG, PNG."
            )

        allowed_mime_types = {
            "application/pdf",
            "image/jpeg",
            "image/png",
        }

        mime_type = getattr(file, "content_type", None)

        if mime_type and mime_type not in allowed_mime_types:
            raise serializers.ValidationError(
                "Nieprawidłowy typ pliku."
            )

        guessed_mime_type, _ = mimetypes.guess_type(file.name)

        if (
            guessed_mime_type
            and guessed_mime_type not in allowed_mime_types
        ):
            raise serializers.ValidationError(
                "Nieprawidłowe rozszerzenie lub typ pliku."
            )

        return file