from django.db import models


class Vehicle(models.Model):
    STATUS_CHOICES = [
        ('active', 'Aktywny'),
        ('maintenance', 'W serwisie'),
        ('inactive', 'Nieaktywny'),
    ]

    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    registration_number = models.CharField(max_length=20, unique=True)
    year = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.brand} {self.model} ({self.registration_number})"