
import os
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from organizations.models import (
    Organization,
    Company,
    OrganizationMembership,
)
from drivers.models import Driver
from vehicles.models import Vehicle, ServiceRecord


if os.getenv("FLOTIVO_BENCH_CONFIRM") != "flotivo-smoke":
    raise SystemExit("Brak potwierdzenia srodowiska smoke.")

target = int(os.getenv("FLOTIVO_BENCH_TARGET", "0"))

if target not in (10, 25, 50):
    raise SystemExit("Dozwolone: 10, 25 albo 50 organizacji.")

today = timezone.localdate()
User = get_user_model()

for i in range(1, target + 1):
    with transaction.atomic():
        organization, _ = Organization.objects.get_or_create(
            name=f"FLOTIVO_BENCH_ORG_{i:03d}",
            defaults={"is_active": True},
        )

        company, _ = Company.objects.get_or_create(
            organization=organization,
            name=f"FLOTIVO_BENCH_COMPANY_{i:03d}",
        )

        username = f"flotivo_bench_admin_{i:03d}"

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"is_active": True},
        )

        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        membership = OrganizationMembership.objects.filter(
            user=user
        ).first()

        if membership is not None:
            if membership.organization_id != organization.id:
                raise RuntimeError(
                    f"Nieoczekiwane konto: {username}"
                )
        else:
            OrganizationMembership.objects.create(
                user=user,
                organization=organization,
                role="admin",
            )

        existing_licenses = set(
            Driver.objects.filter(
                organization=organization,
                license_number__startswith="BENCH",
            ).values_list("license_number", flat=True)
        )

        new_drivers = []

        for j in range(1, 41):
            license_number = f"BENCH{i:03d}{j:04d}"

            if license_number in existing_licenses:
                continue

            new_drivers.append(
                Driver(
                    organization=organization,
                    first_name=f"Test{i:03d}",
                    last_name=f"Kierowca{j:03d}",
                    license_number=license_number,
                    license_categories=["B"],
                    phone_number=f"500{i:03d}{j:03d}",
                    hired_at=date(2023, 1, 1),
                    license_expiry_date=(
                        today + timedelta(days=45 + j * 3)
                    ),
                )
            )

        Driver.objects.bulk_create(
            new_drivers,
            batch_size=200,
        )

        drivers = list(
            Driver.active_objects.filter(
                organization=organization,
                license_number__startswith="BENCH",
            ).order_by("id")
        )

        existing_registrations = set(
            Vehicle.objects.filter(
                organization=organization,
                registration_number__startswith="BENCH",
            ).values_list("registration_number", flat=True)
        )

        new_vehicles = []

        for j in range(1, 201):
            registration = f"BENCH{i:03d}{j:04d}"

            if registration in existing_registrations:
                continue

            driver = (
                drivers[(j - 1) % len(drivers)]
                if j % 5
                else None
            )

            new_vehicles.append(
                Vehicle(
                    organization=organization,
                    company=company,
                    driver=driver,
                    brand=(
                        "Ford",
                        "Toyota",
                        "Volkswagen",
                        "Renault",
                    )[j % 4],
                    model=f"Test {j % 12}",
                    registration_number=registration,
                    year=2016 + (j % 10),
                    vehicle_type=(
                        "van" if j % 4 == 0 else "passenger"
                    ),
                    fuel_type=(
                        "diesel" if j % 3 == 0 else "petrol"
                    ),
                    mileage=10000 + j * 271,
                    status=(
                        "maintenance" if j % 15 == 0 else "active"
                    ),
                    inspection_expiry_date=(
                        today + timedelta(days=(j % 365) - 25)
                    ),
                    insurance_expiry_date=(
                        today + timedelta(days=(j * 3) % 365)
                    ),
                )
            )

        Vehicle.objects.bulk_create(
            new_vehicles,
            batch_size=200,
        )

        selected_vehicles = list(
            Vehicle.active_objects.filter(
                organization=organization,
                registration_number__startswith="BENCH",
            ).order_by("id")
        )[::10]

        existing_service_ids = set(
            ServiceRecord.objects.filter(
                vehicle__in=selected_vehicles,
                title="Przeglad testowy",
            ).values_list("vehicle_id", flat=True)
        )

        new_services = [
            ServiceRecord(
                vehicle=vehicle,
                service_date=today - timedelta(days=30),
                title="Przeglad testowy",
                description="Dane syntetyczne.",
                mileage=vehicle.mileage - 1000,
                cost=450,
            )
            for vehicle in selected_vehicles
            if vehicle.id not in existing_service_ids
        ]

        ServiceRecord.objects.bulk_create(
            new_services,
            batch_size=200,
        )

    print(f"Organizacja {i}/{target}: OK")

print()
print("=== PODSUMOWANIE ===")
print(
    "Organizacje:",
    Organization.objects.filter(
        name__startswith="FLOTIVO_BENCH_ORG_"
    ).count(),
)
print(
    "Pojazdy:",
    Vehicle.objects.filter(
        registration_number__startswith="BENCH"
    ).count(),
)
print(
    "Kierowcy:",
    Driver.objects.filter(
        license_number__startswith="BENCH"
    ).count(),
)
print("Konto profilowania: flotivo_bench_admin_001")
