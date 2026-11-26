
import os
import statistics
import time

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from drivers.models import Driver
from drivers.views import DriverViewSet
from organizations.models import OrganizationMembership
from vehicles.models import Vehicle
from vehicles.views import ServiceRecordViewSet, VehicleViewSet


if os.getenv("FLOTIVO_BENCH_CONFIRM") != "flotivo-smoke":
    raise SystemExit("Profilowanie dozwolone tylko w flotivo-smoke.")


User = get_user_model()
factory = APIRequestFactory()

vehicle_list = VehicleViewSet.as_view({"get": "list"})
vehicle_detail = VehicleViewSet.as_view({"get": "retrieve"})
driver_list = DriverViewSet.as_view({"get": "list"})
service_list = ServiceRecordViewSet.as_view({"get": "list"})


def get_benchmark_user(number):
    username = f"flotivo_bench_admin_{number:03d}"

    user = User.objects.get(
        username=username,
        is_active=True,
    )

    membership = OrganizationMembership.objects.get(user=user)

    if membership.role != "admin":
        raise RuntimeError(f"Nieprawidlowa rola: {username}")

    return user, membership.organization_id


def execute(view, url, user, pk=None):
    request = factory.get(url, secure=True)
    force_authenticate(request, user=user)

    if pk is None:
        response = view(request)
    else:
        response = view(request, pk=pk)

    response.render()
    return response


def verify_list(view, url, user, org_id, expected_count=None):
    response = execute(view, url, user)

    if response.status_code != 200:
        raise RuntimeError(
            f"HTTP {response.status_code}: {url}"
        )

    data = response.data
    rows = data.get("results", [])
    count = data.get("count")

    if expected_count is not None and count != expected_count:
        raise RuntimeError(
            f"Nieoczekiwana liczba rekordow: "
            f"{url}, otrzymano {count}, "
            f"oczekiwano {expected_count}"
        )

    permitted_vehicles = None

    for row in rows:
        if "organization" in row:
            if row["organization"] != org_id:
                raise RuntimeError(
                    f"BLAD IZOLACJI ORGANIZACJI: {url}"
                )

        elif "vehicle" in row:
            if permitted_vehicles is None:
                permitted_vehicles = set(
                    Vehicle.active_objects.filter(
                        organization_id=org_id
                    ).values_list("id", flat=True)
                )

            if row["vehicle"] not in permitted_vehicles:
                raise RuntimeError(
                    f"BLAD IZOLACJI HISTORII SERWISOWEJ: {url}"
                )

    return count


def measure(label, view, url, user):
    execute(view, url, user)

    measurements = []

    for _ in range(5):
        request = factory.get(url, secure=True)
        force_authenticate(request, user=user)

        with CaptureQueriesContext(connection) as queries:
            started = time.perf_counter()

            response = view(request)
            response.render()

            elapsed_ms = (
                time.perf_counter() - started
            ) * 1000

        if response.status_code != 200:
            raise RuntimeError(
                f"Blad HTTP {response.status_code}: {label}"
            )

        measurements.append(
            (elapsed_ms, len(queries.captured_queries))
        )

    times = [entry[0] for entry in measurements]
    counts = [entry[1] for entry in measurements]

    print(label)
    print(f"  Mediana: {statistics.median(times):.2f} ms")
    print(f"  Minimum: {min(times):.2f} ms")
    print(f"  Maksimum: {max(times):.2f} ms")
    print(f"  SQL: {statistics.median(counts):.0f} zapytan")
    print()


user1, org1 = get_benchmark_user(1)
user2, org2 = get_benchmark_user(2)

if org1 == org2:
    raise RuntimeError("Konta testowe maja te sama organizacje.")

print("=== FLOTIVO BENCHMARK - 10 FIRM ===")
print(f"Pojazdy ogolem: {Vehicle.active_objects.count()}")
print(f"Kierowcy ogolem: {Driver.active_objects.count()}")
print(f"Organizacja testowa: {org1}")
print()

cases = [
    (
        "Pojazdy - 20 rekordow",
        vehicle_list,
        "/api/vehicles/?page_size=20",
        200,
    ),
    (
        "Pojazdy - 100 rekordow",
        vehicle_list,
        "/api/vehicles/?page_size=100",
        200,
    ),
    (
        "Pojazdy - wyszukiwanie Ford",
        vehicle_list,
        "/api/vehicles/?search=Ford&page_size=20",
        None,
    ),
    (
        "Pojazdy - aktywne",
        vehicle_list,
        "/api/vehicles/?status=active&page_size=20",
        None,
    ),
    (
        "Kierowcy - 20 rekordow",
        driver_list,
        "/api/drivers/?page_size=20",
        40,
    ),
    (
        "Kierowcy - 100 rekordow",
        driver_list,
        "/api/drivers/?page_size=100",
        40,
    ),
    (
        "Historia serwisowa",
        service_list,
        "/api/service-records/?page_size=20",
        20,
    ),
]

print("=== KONTROLA DANYCH I IZOLACJI ===")

for label, view, url, expected in cases:
    count1 = verify_list(
        view, url, user1, org1, expected
    )

    count2 = verify_list(
        view, url, user2, org2, expected
    )

    print(f"OK: {label} | firma 1: {count1}, firma 2: {count2}")


foreign_vehicle = (
    Vehicle.active_objects
    .filter(organization_id=org2)
    .first()
)

if foreign_vehicle is None:
    raise RuntimeError("Brak pojazdu drugiej organizacji.")

foreign_response = execute(
    vehicle_detail,
    f"/api/vehicles/{foreign_vehicle.pk}/",
    user1,
    pk=foreign_vehicle.pk,
)

if foreign_response.status_code != 404:
    raise RuntimeError(
        "BLAD IZOLACJI: mozna odczytac cudzy pojazd. "
        f"HTTP {foreign_response.status_code}"
    )

print("OK: odczyt pojazdu innej firmy zwraca HTTP 404")
print()

print("=== POMIARY WYDAJNOSCI ===")

for label, view, url, _ in cases:
    measure(label, view, url, user1)

print("=== KONIEC ===")
