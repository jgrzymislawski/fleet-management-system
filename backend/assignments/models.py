from django.db import models
from django.core.exceptions import ValidationError
from vehicles.models import Vehicle
from drivers.models import Driver


class Assignment(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='assignments')
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments')
    driver_name = models.CharField(max_length=150, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.driver and self.driver_name:
            raise ValidationError('Wybierz kierowcę z listy ALBO wpisz imię i nazwisko, nie oba naraz.')
        if not self.driver and not self.driver_name:
            raise ValidationError('Musisz wybrać kierowcę z listy albo wpisać imię i nazwisko.')

    @property
    def driver_display_name(self):
        if self.driver:
            return f"{self.driver.first_name} {self.driver.last_name}"
        return self.driver_name

    def __str__(self):
        return f"{self.vehicle} → {self.driver_display_name} ({self.start_date})"