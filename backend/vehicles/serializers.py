from rest_framework import serializers
from .models import Vehicle, ServiceRecord, VehicleDocument
import mimetypes
from pathlib import Path

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'

    def validate(self, attrs):
        driver = attrs.get('driver')
        driver_name = attrs.get('driver_name')

        if driver and driver_name:
            raise serializers.ValidationError(
                'Wybierz kierowcę z listy albo wpisz kierowcę ręcznie, nie można użyć obu opcji jednocześnie.'
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

        if guessed_mime_type and guessed_mime_type not in allowed_mime_types:
            raise serializers.ValidationError(
                "Nieprawidłowe rozszerzenie lub typ pliku."
            )

        return file