from django.db import models


class Driver(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    license_number = models.CharField(max_length=30, unique=True)
    phone_number = models.CharField(max_length=20)
    hired_at = models.DateField()

    def __str__(self):
        return f"{self.first_name} {self.last_name}"