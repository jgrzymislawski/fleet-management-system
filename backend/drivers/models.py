from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from auditlog.registry import auditlog

from organizations.models import Organization


class ActiveDriverManager(models.Manager):
    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(
                is_deleted=False
            )
        )


class Driver(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="drivers",
    )

    first_name = models.CharField(
        max_length=100,
    )

    last_name = models.CharField(
        max_length=100,
    )

    license_number = models.CharField(
        max_length=30,
    )

    license_categories = models.JSONField(
        default=list,
        blank=True,
    )

    license_expiry_date = models.DateField(
        null=True,
        blank=True,
    )

    medical_exam_expiry_date = models.DateField(
        null=True,
        blank=True,
    )

    phone_number = models.CharField(
        max_length=20,
    )

    hired_at = models.DateField()

    is_deleted = models.BooleanField(
        default=False,
    )

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    objects = models.Manager()

    active_objects = (
        ActiveDriverManager()
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "license_number",
                ],
                condition=Q(
                    is_deleted=False
                ),
                name=(
                    "unique_active_driver_license_"
                    "per_organization"
                ),
            )
        ]

    def clean(self):
        if self.organization_id is None:
            raise ValidationError(
                {
                    "organization": (
                        "Kierowca musi należeć "
                        "do organizacji."
                    )
                }
            )

    def save(
        self,
        *args,
        **kwargs,
    ):
        if self.license_number:
            self.license_number = (
                str(
                    self.license_number
                )
                .strip()
                .upper()
            )

        self.full_clean()

        super().save(
            *args,
            **kwargs,
        )

    def soft_delete(self):
        if self.is_deleted:
            return

        driver_name = (
            f"{self.first_name} "
            f"{self.last_name}"
        ).strip()

        current_vehicles = (
            self.vehicles
            .filter(
                is_deleted=False,
                driver_id=self.id,
            )
        )

        for vehicle in current_vehicles:
            vehicle.driver = None
            vehicle.driver_name = (
                driver_name
            )

            vehicle.save(
                update_fields=[
                    "driver",
                    "driver_name",
                ]
            )

        (
            self.vehicle_assignments
            .filter(
                end_date__isnull=True,
            )
            .update(
                end_date=(
                    timezone.localdate()
                )
            )
        )

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

        duplicate_exists = (
            Driver.objects
            .filter(
                organization=(
                    self.organization
                ),
                license_number__iexact=(
                    self.license_number
                ),
                is_deleted=False,
            )
            .exclude(
                pk=self.pk
            )
            .exists()
        )

        if duplicate_exists:
            raise ValidationError(
                {
                    "license_number": (
                        "Nie można przywrócić "
                        "kierowcy, ponieważ aktywny "
                        "kierowca z tym numerem "
                        "prawa jazdy już istnieje "
                        "w tej organizacji."
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
            f"{self.first_name} "
            f"{self.last_name}"
        )


class DriverVehicleAssignment(models.Model):
    vehicle = models.ForeignKey(
        "vehicles.Vehicle",
        on_delete=models.CASCADE,
        related_name="driver_assignments",
    )

    driver = models.ForeignKey(
        Driver,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vehicle_assignments",
    )

    driver_name = models.CharField(
        max_length=150,
        blank=True,
    )

    start_date = models.DateField()

    end_date = models.DateField(
        null=True,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = [
            "-start_date",
            "-created_at",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "vehicle",
                ],
                condition=Q(
                    end_date__isnull=True,
                ),
                name=(
                    "unique_active_"
                    "driver_assignment_"
                    "per_vehicle"
                ),
            )
        ]

    def clean(self):
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
            self.vehicle
            and self.vehicle.is_deleted
        ):
            raise ValidationError(
                {
                    "vehicle": (
                        "Nie można przypisać "
                        "kierowcy do usuniętego "
                        "pojazdu."
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
                    "albo wpisz osobę ręcznie."
                )
            )

        if (
            not self.driver
            and not self.driver_name
        ):
            raise ValidationError(
                (
                    "Musisz wybrać kierowcę "
                    "albo wpisać osobę ręcznie."
                )
            )

        if (
            self.end_date
            and self.end_date
            < self.start_date
        ):
            raise ValidationError(
                {
                    "end_date": (
                        "Data zakończenia nie może "
                        "być wcześniejsza niż "
                        "data rozpoczęcia."
                    )
                }
            )

        if (
            self.vehicle.organization_id
            is None
        ):
            raise ValidationError(
                {
                    "vehicle": (
                        "Pojazd nie ma przypisanej "
                        "organizacji."
                    )
                }
            )

        if self.driver:
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
                self.vehicle.organization_id
                != self.driver.organization_id
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

    def save(
        self,
        *args,
        **kwargs,
    ):
        self.full_clean()

        super().save(
            *args,
            **kwargs,
        )

    @property
    def is_active(self):
        return self.end_date is None

    @property
    def driver_display_name(self):
        if self.driver:
            return (
                f"{self.driver.first_name} "
                f"{self.driver.last_name}"
            )

        return self.driver_name

    def __str__(self):
        status = (
            "aktualne"
            if self.is_active
            else "zakończone"
        )

        return (
            f"{self.vehicle} - "
            f"{self.driver_display_name} - "
            f"{status}"
        )


auditlog.register(
    Driver
)

auditlog.register(
    DriverVehicleAssignment
)