import mimetypes
import re
from pathlib import Path

from django.db import transaction
from django.utils import timezone

from rest_framework import serializers

from drivers.models import DriverVehicleAssignment
from organizations.models import OrganizationMembership

from .models import (
    Vehicle,
    ServiceRecord,
    VehicleDocument,
)


VIN_PATTERN = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
REGISTRATION_PATTERN = re.compile(r"^[A-Z0-9-]{2,20}$")


class VehicleSerializer(
    serializers.ModelSerializer
):
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
            "is_deleted",
            "deleted_at",
        ]

    def validate_brand(
        self,
        value,
    ):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Marka pojazdu jest wymagana."
            )

        return value

    def validate_model(
        self,
        value,
    ):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Model pojazdu jest wymagany."
            )

        return value

    def validate_registration_number(
        self,
        value,
    ):
        value = (
            value.strip()
            .upper()
            .replace(" ", "")
        )

        if not value:
            raise serializers.ValidationError(
                "Numer rejestracyjny jest wymagany."
            )

        if not REGISTRATION_PATTERN.fullmatch(
            value
        ):
            raise serializers.ValidationError(
                (
                    "Numer rejestracyjny może zawierać "
                    "wyłącznie litery, cyfry i myślnik."
                )
            )

        return value

    def validate_vin(
        self,
        value,
    ):
        if value in (
            None,
            "",
        ):
            return None

        value = (
            str(value)
            .strip()
            .upper()
            .replace(" ", "")
        )

        if not VIN_PATTERN.fullmatch(
            value
        ):
            raise serializers.ValidationError(
                (
                    "VIN musi mieć dokładnie 17 znaków, "
                    "składać się z cyfr i liter oraz nie "
                    "może zawierać liter I, O ani Q."
                )
            )

        return value

    def validate_year(
        self,
        value,
    ):
        maximum_year = (
            timezone.localdate().year
            + 1
        )

        if value < 1900:
            raise serializers.ValidationError(
                "Rok produkcji nie może być wcześniejszy niż 1900."
            )

        if value > maximum_year:
            raise serializers.ValidationError(
                (
                    "Rok produkcji nie może być późniejszy "
                    f"niż {maximum_year}."
                )
            )

        return value

    def validate_branch(
        self,
        value,
    ):
        return value.strip()

    def _get_target_organization(
        self,
        company,
    ):
        request = self.context.get(
            "request"
        )

        if request is None:
            if self.instance:
                return (
                    self.instance.organization
                )

            return None

        membership = (
            OrganizationMembership.objects
            .select_related(
                "organization"
            )
            .filter(
                user=request.user
            )
            .first()
        )

        if membership is not None:
            return membership.organization

        if getattr(
            request.user,
            "is_superuser",
            False,
        ):
            if company is not None:
                return company.organization

            if self.instance:
                return (
                    self.instance.organization
                )

        return None

    def validate(
        self,
        attrs,
    ):
        driver = attrs.get(
            "driver"
        )

        driver_name = attrs.get(
            "driver_name"
        )

        company = attrs.get(
            "company"
        )

        registration_number = attrs.get(
            "registration_number"
        )

        vin = attrs.get(
            "vin"
        )

        if self.instance:
            if "driver" not in attrs:
                driver = (
                    self.instance.driver
                )

            if "driver_name" not in attrs:
                driver_name = (
                    self.instance.driver_name
                )

            if "company" not in attrs:
                company = (
                    self.instance.company
                )

            if "registration_number" not in attrs:
                registration_number = (
                    self.instance.registration_number
                )

            if "vin" not in attrs:
                vin = self.instance.vin

        if isinstance(
            driver_name,
            str,
        ):
            driver_name = (
                driver_name.strip()
            )

            attrs[
                "driver_name"
            ] = driver_name

        if driver and driver_name:
            raise serializers.ValidationError(
                (
                    "Wybierz kierowcę z listy "
                    "albo wpisz kierowcę ręcznie, "
                    "nie można użyć obu opcji "
                    "jednocześnie."
                )
            )

        if (
            driver
            and driver.is_deleted
        ):
            raise serializers.ValidationError(
                {
                    "driver": (
                        "Nie można przypisać "
                        "usuniętego kierowcy."
                    )
                }
            )

        request = self.context.get(
            "request"
        )

        if (
            request
            and driver
        ):
            user = request.user

            membership = (
                OrganizationMembership.objects
                .select_related(
                    "organization"
                )
                .filter(
                    user=user
                )
                .first()
            )

            if membership is not None:
                if (
                    driver.organization_id
                    is None
                ):
                    raise serializers.ValidationError(
                        {
                            "driver": (
                                "Kierowca nie ma "
                                "przypisanej organizacji."
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
                                "Nie możesz przypisać "
                                "kierowcy z innej "
                                "organizacji."
                            )
                        }
                    )

            elif getattr(
                user,
                "is_superuser",
                False,
            ):
                if company is None:
                    raise serializers.ValidationError(
                        {
                            "company": (
                                "Superadministrator bez "
                                "przypisanej organizacji "
                                "musi wskazać spółkę."
                            )
                        }
                    )

                if (
                    driver.organization_id
                    is None
                ):
                    raise serializers.ValidationError(
                        {
                            "driver": (
                                "Kierowca nie ma "
                                "przypisanej organizacji."
                            )
                        }
                    )

                if (
                    driver.organization_id
                    != company.organization_id
                ):
                    raise serializers.ValidationError(
                        {
                            "driver": (
                                "Kierowca i spółka "
                                "pojazdu muszą należeć "
                                "do tej samej organizacji."
                            )
                        }
                    )

            else:
                raise serializers.ValidationError(
                    {
                        "driver": (
                            "Użytkownik nie jest "
                            "przypisany do żadnej "
                            "organizacji."
                        )
                    }
                )

        organization = (
            self._get_target_organization(
                company
            )
        )

        if (
            organization is not None
            and registration_number
        ):
            duplicate_registration = (
                Vehicle.active_objects
                .filter(
                    organization=organization,
                    registration_number__iexact=(
                        registration_number
                    ),
                )
            )

            if self.instance:
                duplicate_registration = (
                    duplicate_registration.exclude(
                        pk=self.instance.pk
                    )
                )

            if duplicate_registration.exists():
                raise serializers.ValidationError(
                    {
                        "registration_number": (
                            "Aktywny pojazd z tym numerem "
                            "rejestracyjnym już istnieje "
                            "w tej organizacji."
                        )
                    }
                )

        if (
            organization is not None
            and vin
        ):
            duplicate_vin = (
                Vehicle.active_objects
                .filter(
                    organization=organization,
                    vin__iexact=vin,
                )
            )

            if self.instance:
                duplicate_vin = (
                    duplicate_vin.exclude(
                        pk=self.instance.pk
                    )
                )

            if duplicate_vin.exists():
                raise serializers.ValidationError(
                    {
                        "vin": (
                            "Aktywny pojazd z tym VIN-em "
                            "już istnieje w tej organizacji."
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
            old_driver_id
            != new_driver_id
            or old_name
            != new_name
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

        if (
            not driver
            and not driver_name
        ):
            return

        DriverVehicleAssignment.objects.create(
            vehicle=vehicle,
            driver=driver,
            driver_name=driver_name,
            start_date=start_date,
        )

    @transaction.atomic
    def create(
        self,
        validated_data,
    ):
        vehicle = super().create(
            validated_data
        )

        self._create_assignment(
            vehicle=vehicle,
            driver=vehicle.driver,
            driver_name=(
                vehicle.driver_name
            ),
            start_date=(
                timezone.localdate()
            ),
        )

        return vehicle

    @transaction.atomic
    def update(
        self,
        instance,
        validated_data,
    ):
        old_driver = (
            instance.driver
        )

        old_driver_name = (
            instance.driver_name
        )

        new_driver = (
            validated_data.get(
                "driver",
                instance.driver,
            )
        )

        new_driver_name = (
            validated_data.get(
                "driver_name",
                instance.driver_name,
            )
        )

        changed = (
            self._assignment_changed(
                old_driver=old_driver,
                old_driver_name=(
                    old_driver_name
                ),
                new_driver=new_driver,
                new_driver_name=(
                    new_driver_name
                ),
            )
        )

        vehicle = super().update(
            instance,
            validated_data,
        )

        if not changed:
            return vehicle

        today = (
            timezone.localdate()
        )

        (
            DriverVehicleAssignment.objects
            .filter(
                vehicle=vehicle,
                end_date__isnull=True,
            )
            .update(
                end_date=today,
            )
        )

        self._create_assignment(
            vehicle=vehicle,
            driver=vehicle.driver,
            driver_name=(
                vehicle.driver_name
            ),
            start_date=today,
        )

        return vehicle


class ServiceRecordSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = ServiceRecord
        fields = "__all__"

    def validate_vehicle(
        self,
        vehicle,
    ):
        if vehicle.is_deleted:
            raise serializers.ValidationError(
                (
                    "Nie można dodać wpisu serwisowego "
                    "do usuniętego pojazdu."
                )
            )

        return vehicle

    def validate_title(
        self,
        value,
    ):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Tytuł wpisu serwisowego jest wymagany."
            )

        return value

    def validate_description(
        self,
        value,
    ):
        return value.strip()

    def validate_cost(
        self,
        value,
    ):
        if value < 0:
            raise serializers.ValidationError(
                "Koszt nie może być ujemny."
            )

        return value

    def validate_service_date(
        self,
        value,
    ):
        if value > timezone.localdate():
            raise serializers.ValidationError(
                (
                    "Data wykonanej usługi nie może "
                    "być datą przyszłą."
                )
            )

        return value


class VehicleDocumentSerializer(
    serializers.ModelSerializer
):
    has_file = serializers.SerializerMethodField()

    class Meta:
        model = VehicleDocument
        fields = "__all__"
        extra_kwargs = {
            "file": {
                "write_only": True,
            },
        }

    def get_has_file(
        self,
        obj,
    ):
        return bool(obj.file)

    def validate_vehicle(
        self,
        vehicle,
    ):
        if vehicle.is_deleted:
            raise serializers.ValidationError(
                (
                    "Nie można dodać dokumentu "
                    "do usuniętego pojazdu."
                )
            )

        return vehicle

    def validate_document_number(
        self,
        value,
    ):
        return value.strip()

    def validate_notes(
        self,
        value,
    ):
        return value.strip()

    def validate_cost(
        self,
        value,
    ):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "Koszt dokumentu nie może być ujemny."
            )

        return value

    def validate_file(
        self,
        file,
    ):
        max_size = (
            10
            * 1024
            * 1024
        )

        if file.size > max_size:
            raise serializers.ValidationError(
                (
                    "Maksymalny rozmiar "
                    "pliku to 10 MB."
                )
            )

        if file.size == 0:
            raise serializers.ValidationError(
                "Przesłany plik jest pusty."
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

        if (
            extension
            not in allowed_extensions
        ):
            raise serializers.ValidationError(
                (
                    "Dozwolone formaty plików: "
                    "PDF, JPG, JPEG, PNG."
                )
            )

        expected_mime_types = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        }

        expected_mime_type = expected_mime_types[
            extension
        ]

        mime_type = getattr(
            file,
            "content_type",
            None,
        )

        if mime_type and mime_type != expected_mime_type:
            raise serializers.ValidationError(
                (
                    "Typ MIME pliku nie odpowiada "
                    "jego rozszerzeniu."
                )
            )

        guessed_mime_type, _ = (
            mimetypes.guess_type(
                file.name
            )
        )

        if (
            guessed_mime_type
            and guessed_mime_type
            != expected_mime_type
        ):
            raise serializers.ValidationError(
                (
                    "Nieprawidłowe rozszerzenie "
                    "lub typ pliku."
                )
            )

        position = file.tell()
        header = file.read(16)
        file.seek(position)

        valid_signature = False

        if extension == ".pdf":
            valid_signature = (
                header.startswith(
                    b"%PDF-"
                )
            )

        elif extension in {
            ".jpg",
            ".jpeg",
        }:
            valid_signature = (
                header.startswith(
                    b"\xff\xd8\xff"
                )
            )

        elif extension == ".png":
            valid_signature = (
                header.startswith(
                    b"\x89PNG\r\n\x1a\n"
                )
            )

        if not valid_signature:
            raise serializers.ValidationError(
                (
                    "Zawartość pliku nie odpowiada "
                    "jego rozszerzeniu."
                )
            )

        return file

    def validate(
        self,
        attrs,
    ):
        issue_date = attrs.get(
            "issue_date"
        )

        expiry_date = attrs.get(
            "expiry_date"
        )

        if self.instance:
            if "issue_date" not in attrs:
                issue_date = (
                    self.instance.issue_date
                )

            if "expiry_date" not in attrs:
                expiry_date = (
                    self.instance.expiry_date
                )

        if (
            issue_date
            and expiry_date
            and issue_date > expiry_date
        ):
            raise serializers.ValidationError(
                {
                    "expiry_date": (
                        "Data ważności nie może być "
                        "wcześniejsza niż data wystawienia."
                    )
                }
            )

        return attrs