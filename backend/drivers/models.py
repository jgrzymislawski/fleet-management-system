from django.db import models
from organizations.models import Organization

class Driver(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="drivers",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    license_number = models.CharField(max_length=30, unique=True)
    phone_number = models.CharField(max_length=20)
    hired_at = models.DateField()

    def __str__(self):
        return f"{self.first_name} {self.last_name}"