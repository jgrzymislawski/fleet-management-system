from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from organizations.models import Organization


class Driver(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="drivers",
        null=True,
        blank=True,
    )

    first_name = models.CharField(
        max_length=100,
    )

    last_name = models.CharField(
        max_length=100,
    )

    license_number = models.CharField(
        max_length=30,
        unique=True,
    )

    phone_number = models.CharField(
        max_length=20,
    )

    hired_at = models.DateField()

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


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
                name="unique_active_driver_assignment_per_vehicle",
            )
        ]

    def clean(self):
        if self.driver and self.driver_name:
            raise ValidationError(
                "Wybierz kierowcę z listy albo wpisz osobę ręcznie."
            )

        if not self.driver and not self.driver_name:
            raise ValidationError(
                "Musisz wybrać kierowcę albo wpisać osobę ręcznie."
            )

        if (
            self.end_date
            and self.end_date < self.start_date
        ):
            raise ValidationError(
                {
                    "end_date": (
                        "Data zakończenia nie może być "
                        "wcześniejsza niż data rozpoczęcia."
                    )
                }
            )

        if self.driver:
            vehicle_organization_id = (
                self.vehicle.organization_id
            )

            driver_organization_id = (
                self.driver.organization_id
            )

            if (
                vehicle_organization_id
                and driver_organization_id
                and vehicle_organization_id
                != driver_organization_id
            ):
                raise ValidationError(
                    {
                        "driver": (
                            "Kierowca i pojazd muszą należeć "
                            "do tej samej organizacji."
                        )
                    }
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