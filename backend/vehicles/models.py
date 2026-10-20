from django.db import models
from organizations.models import Organization, Company


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

    driver = models.ForeignKey(
        'drivers.Driver',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vehicles'
    )

    driver_name = models.CharField(
        max_length=200,
        null=True,
        blank=True
    )

    inspection_expiry_date = models.DateField(
        null=True,
        blank=True
    )

    insurance_expiry_date = models.DateField(
        null=True,
        blank=True
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="vehicles",
        null=True,
        blank=True
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        related_name="vehicles",
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.brand} {self.model} ({self.registration_number})"

class ServiceRecord(models.Model):
    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="service_records"
    )
    service_date = models.DateField()
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    mileage = models.PositiveIntegerField(null=True, blank=True)
    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-service_date", "-created_at"]

    def __str__(self):
        return f"{self.vehicle} - {self.title}"

class VehicleDocument(models.Model):
    DOCUMENT_TYPES = [
        ("oc", "OC"),
        ("ac", "AC"),
        ("registration", "Dowód rejestracyjny"),
        ("inspection", "Przegląd techniczny"),
        ("leasing", "Umowa leasingowa"),
        ("warranty", "Gwarancja"),
        ("assistance", "Assistance"),
        ("other", "Inny"),
    ]

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name="documents"
    )

    document_type = models.CharField(
        max_length=30,
        choices=DOCUMENT_TYPES
    )

    document_number = models.CharField(
        max_length=100,
        blank=True
    )

    issue_date = models.DateField(
        null=True,
        blank=True
    )

    expiry_date = models.DateField(
        null=True,
        blank=True
    )

    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    notes = models.TextField(
        blank=True
    )

    file = models.FileField(
        upload_to="vehicle_documents/",
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.vehicle} - {self.get_document_type_display()}"