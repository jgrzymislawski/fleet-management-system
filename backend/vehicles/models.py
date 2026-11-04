from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from organizations.models import (
    Organization,
    Company,
)

from auditlog.registry import auditlog


class ActiveVehicleManager(models.Manager):
    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(
                is_deleted=False
            )
        )


class Vehicle(models.Model):
    STATUS_CHOICES = [
        ("active", "Aktywny"),
        ("maintenance", "W serwisie"),
        ("inactive", "Nieaktywny"),
    ]

    FUEL_CHOICES = [
        ("petrol", "Benzyna"),
        ("diesel", "Diesel"),
        ("lpg", "LPG"),
        ("hybrid", "Hybryda"),
        ("electric", "Elektryczny"),
    ]

    VEHICLE_TYPE_CHOICES = [
        ("passenger", "Samochód osobowy"),
        ("van", "Bus / samochód dostawczy"),
        ("truck", "Samochód ciężarowy"),
        ("special", "Pojazd specjalny"),
        ("other", "Inny"),
    ]

    brand = models.CharField(
        max_length=100,
    )

    model = models.CharField(
        max_length=100,
    )

    registration_number = models.CharField(
        max_length=20,
    )

    vin = models.CharField(
        max_length=17,
        null=True,
        blank=True,
    )

    year = models.IntegerField()

    vehicle_type = models.CharField(
        max_length=20,
        choices=VEHICLE_TYPE_CHOICES,
        default="passenger",
    )

    fuel_type = models.CharField(
        max_length=20,
        choices=FUEL_CHOICES,
        null=True,
        blank=True,
    )

    mileage = models.PositiveIntegerField(
        default=0,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active",
    )

    driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vehicles",
    )

    driver_name = models.CharField(
        max_length=200,
        null=True,
        blank=True,
    )

    inspection_expiry_date = models.DateField(
        null=True,
        blank=True,
    )

    insurance_expiry_date = models.DateField(
        null=True,
        blank=True,
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="vehicles",
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        related_name="vehicles",
        null=True,
        blank=True,
    )

    branch = models.CharField(
        max_length=150,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    is_deleted = models.BooleanField(
        default=False,
    )

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = models.Manager()

    active_objects = (
        ActiveVehicleManager()
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "registration_number",
                ],
                condition=Q(
                    is_deleted=False
                ),
                name=(
                    "unique_active_vehicle_registration_"
                    "per_organization"
                ),
            ),
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "vin",
                ],
                condition=(
                    Q(
                        is_deleted=False,
                    )
                    & Q(
                        vin__isnull=False,
                    )
                    & ~Q(
                        vin="",
                    )
                ),
                name=(
                    "unique_active_vehicle_vin_"
                    "per_organization"
                ),
            ),
        ]

    def save(
        self,
        *args,
        **kwargs,
    ):
        if self.registration_number:
            self.registration_number = (
                str(
                    self.registration_number
                )
                .strip()
                .upper()
                .replace(
                    " ",
                    "",
                )
            )

        if self.vin:
            self.vin = (
                str(
                    self.vin
                )
                .strip()
                .upper()
                .replace(
                    " ",
                    "",
                )
            )
        else:
            self.vin = None

        if isinstance(
            self.driver_name,
            str,
        ):
            self.driver_name = (
                self.driver_name.strip()
            )

        if (
            self.driver
            and self.driver.is_deleted
        ):
            raise ValidationError(
                {
                    "driver": (
                        "Nie można przypisać "
                        "usuniętego kierowcy."
                    )
                }
            )

        if (
            self.driver
            and self.driver_name
        ):
            raise ValidationError(
                (
                    "Wybierz kierowcę z listy "
                    "albo wpisz kierowcę ręcznie."
                )
            )

        if self.company_id:
            company_organization_id = (
                self.company.organization_id
            )

            if self.organization_id is None:
                self.organization_id = (
                    company_organization_id
                )

            elif (
                self.organization_id
                != company_organization_id
            ):
                raise ValidationError(
                    {
                        "company": (
                            "Pojazd i spółka muszą "
                            "należeć do tej samej "
                            "organizacji."
                        )
                    }
                )

        if self.organization_id is None:
            raise ValidationError(
                {
                    "organization": (
                        "Pojazd musi należeć "
                        "do organizacji."
                    )
                }
            )

        if self.driver_id:
            if (
                self.driver.organization_id
                is None
            ):
                raise ValidationError(
                    {
                        "driver": (
                            "Kierowca nie ma "
                            "przypisanej organizacji."
                        )
                    }
                )

            if (
                self.driver.organization_id
                != self.organization_id
            ):
                raise ValidationError(
                    {
                        "driver": (
                            "Kierowca i pojazd muszą "
                            "należeć do tej samej "
                            "organizacji."
                        )
                    }
                )

        update_fields = kwargs.get(
            "update_fields"
        )

        if update_fields is not None:
            update_fields = set(
                update_fields
            )

            if self.company_id:
                update_fields.add(
                    "organization"
                )

            kwargs[
                "update_fields"
            ] = list(
                update_fields
            )

        super().save(
            *args,
            **kwargs,
        )

    def soft_delete(self):
        if self.is_deleted:
            return

        self.is_deleted = True
        self.deleted_at = (
            timezone.now()
        )

        self.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
            ]
        )

    def restore(self):
        if not self.is_deleted:
            return

        registration_exists = (
            Vehicle.objects
            .filter(
                organization=(
                    self.organization
                ),
                registration_number__iexact=(
                    self.registration_number
                ),
                is_deleted=False,
            )
            .exclude(
                pk=self.pk
            )
            .exists()
        )

        if registration_exists:
            raise ValidationError(
                {
                    "registration_number": (
                        "Nie można przywrócić "
                        "pojazdu, ponieważ aktywny "
                        "pojazd z tym numerem "
                        "rejestracyjnym już istnieje "
                        "w tej organizacji."
                    )
                }
            )

        if self.vin:
            vin_exists = (
                Vehicle.objects
                .filter(
                    organization=(
                        self.organization
                    ),
                    vin__iexact=self.vin,
                    is_deleted=False,
                )
                .exclude(
                    pk=self.pk
                )
                .exists()
            )

            if vin_exists:
                raise ValidationError(
                    {
                        "vin": (
                            "Nie można przywrócić "
                            "pojazdu, ponieważ aktywny "
                            "pojazd z tym VIN-em już "
                            "istnieje w tej organizacji."
                        )
                    }
                )

        self.is_deleted = False
        self.deleted_at = None

        self.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
            ]
        )

    def __str__(self):
        return (
            f"{self.brand} "
            f"{self.model} "
            f"({self.registration_number})"
        )


class ServiceRecord(models.Model):
    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="service_records",
    )

    service_date = models.DateField()

    title = models.CharField(
        max_length=150,
    )

    description = models.TextField(
        blank=True,
    )

    mileage = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-service_date",
            "-created_at",
        ]

    def __str__(self):
        return (
            f"{self.vehicle} - "
            f"{self.title}"
        )


class VehicleDocument(models.Model):
    DOCUMENT_TYPES = [
        ("oc", "OC"),
        ("ac", "AC"),
        (
            "registration",
            "Dowód rejestracyjny",
        ),
        (
            "inspection",
            "Przegląd techniczny",
        ),
        (
            "leasing",
            "Umowa leasingowa",
        ),
        (
            "warranty",
            "Gwarancja",
        ),
        (
            "assistance",
            "Assistance",
        ),
        (
            "other",
            "Inny",
        ),
    ]

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="documents",
    )

    document_type = models.CharField(
        max_length=30,
        choices=DOCUMENT_TYPES,
    )

    document_number = models.CharField(
        max_length=100,
        blank=True,
    )

    issue_date = models.DateField(
        null=True,
        blank=True,
    )

    expiry_date = models.DateField(
        null=True,
        blank=True,
    )

    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    file = models.FileField(
        upload_to="vehicle_documents/",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

    def __str__(self):
        return (
            f"{self.vehicle} - "
            f"{self.get_document_type_display()}"
        )


auditlog.register(
    Vehicle
)

auditlog.register(
    ServiceRecord
)

auditlog.register(
    VehicleDocument
)