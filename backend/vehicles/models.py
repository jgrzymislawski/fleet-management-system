from django.db import models


class Vehicle(models.Model):
    STATUS_CHOICES = [
        ('active', 'Aktywny'),
        ('maintenance', 'W serwisie'),
        ('inactive', 'Nieaktywny'),
    ]

    FUEL_CHOICES = [
        ('petrol', 'Benzyna'),
        ('diesel', 'Diesel'),
        ('lpg', 'LPG'),
        ('hybrid', 'Hybryda'),
        ('electric', 'Elektryczny'),
    ]

    VEHICLE_TYPE_CHOICES = [
        ('passenger', 'Samochód osobowy'),
        ('van', 'Bus / samochód dostawczy'),
        ('truck', 'Samochód ciężarowy'),
        ('special', 'Pojazd specjalny'),
        ('other', 'Inny'),
    ]

    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)

    registration_number = models.CharField(
        max_length=20,
        unique=True
    )

    vin = models.CharField(
        max_length=17,
        unique=True,
        null=True,
        blank=True
    )

    year = models.IntegerField()

    vehicle_type = models.CharField(
        max_length=20,
        choices=VEHICLE_TYPE_CHOICES,
        default='passenger'
    )

    fuel_type = models.CharField(
        max_length=20,
        choices=FUEL_CHOICES,
        null=True,
        blank=True
    )

    mileage = models.PositiveIntegerField(default=0)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.brand} {self.model} ({self.registration_number})"