import mimetypes
from pathlib import Path

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from drivers.models import DriverVehicleAssignment
from organizations.models import OrganizationMembership
from .models import Vehicle, ServiceRecord, VehicleDocument


class VehicleSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(
        source="company.name",
        read_only=True,
        allow_null=True,
    )

    company_is_active = serializers.BooleanField(
        source="company.is_active",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Vehicle
        fields = "__all__"
        read_only_fields = [
            "organization",
            "company_name",
            "company_is_active",
        ]

    def validate(self, attrs):
        driver = attrs.get("driver")
        driver_name = attrs.get("driver_name")

        if self.instance:
            if "driver" not in attrs:
                driver = self.instance.driver

            if "driver_name" not in attrs:
                driver_name = self.instance.driver_name

        if isinstance(driver_name, str):
            driver_name = driver_name.strip()

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

                if (
                    driver.organization_id
                    != membership.organization_id
                ):
                    raise serializers.ValidationError(
                        {
                            "driver": (
                                "Nie możesz przypisać kierowcy "
                                "z innej organizacji."
                            )
                        }
                    )

        return attrs

    def _assignment_changed(
        self,
        old_driver,
        old_driver_name,
        new_driver,
        new_driver_name,
    ):
        old_driver_id = (
            old_driver.id
            if old_driver
            else None
        )

        new_driver_id = (
            new_driver.id
            if new_driver
            else None
        )

        old_name = (
            old_driver_name or ""
        ).strip()

        new_name = (
            new_driver_name or ""
        ).strip()

        return (
            old_driver_id != new_driver_id
            or old_name != new_name
        )

    def _create_assignment(
        self,
        vehicle,
        driver,
        driver_name,
        start_date,
    ):
        driver_name = (
            driver_name or ""
        ).strip()

        if not driver and not driver_name:
            return

        DriverVehicleAssignment.objects.create(
            vehicle=vehicle,
            driver=driver,
            driver_name=driver_name,
            start_date=start_date,
        )

    @transaction.atomic
    def create(self, validated_data):
        vehicle = super().create(
            validated_data
        )

        self._create_assignment(
            vehicle=vehicle,
            driver=vehicle.driver,
            driver_name=vehicle.driver_name,
            start_date=timezone.localdate(),
        )

        return vehicle

    @transaction.atomic
    def update(self, instance, validated_data):
        old_driver = instance.driver
        old_driver_name = instance.driver_name

        new_driver = validated_data.get(
            "driver",
            instance.driver,
        )

        new_driver_name = validated_data.get(
            "driver_name",
            instance.driver_name,
        )

        changed = self._assignment_changed(
            old_driver=old_driver,
            old_driver_name=old_driver_name,
            new_driver=new_driver,
            new_driver_name=new_driver_name,
        )

        vehicle = super().update(
            instance,
            validated_data,
        )

        if not changed:
            return vehicle

        today = timezone.localdate()

        DriverVehicleAssignment.objects.filter(
            vehicle=vehicle,
            end_date__isnull=True,
        ).update(
            end_date=today,
        )

        self._create_assignment(
            vehicle=vehicle,
            driver=vehicle.driver,
            driver_name=vehicle.driver_name,
            start_date=today,
        )

        return vehicle


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

        extension = Path(
            file.name
        ).suffix.lower()

        if extension not in allowed_extensions:
            raise serializers.ValidationError(
                "Dozwolone formaty plików: PDF, JPG, JPEG, PNG."
            )

        allowed_mime_types = {
            "application/pdf",
            "image/jpeg",
            "image/png",
        }

        mime_type = getattr(
            file,
            "content_type",
            None,
        )

        if (
            mime_type
            and mime_type not in allowed_mime_types
        ):
            raise serializers.ValidationError(
                "Nieprawidłowy typ pliku."
            )

        guessed_mime_type, _ = (
            mimetypes.guess_type(
                file.name
            )
        )

        if (
            guessed_mime_type
            and guessed_mime_type
            not in allowed_mime_types
        ):
            raise serializers.ValidationError(
                "Nieprawidłowe rozszerzenie lub typ pliku."
            )

        return file