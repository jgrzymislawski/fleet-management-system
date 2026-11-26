
import argparse
import http.client
import json
import math
import ssl
import statistics
import subprocess
import time

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HOST = "localhost"
PORT = 18443
REQUESTS_PER_USER = 12

ENDPOINTS = (
    ("Pojazdy 20", "/api/vehicles/?page_size=20", 200),
    ("Pojazdy 100", "/api/vehicles/?page_size=100", 200),
    ("Kierowcy 20", "/api/drivers/?page_size=20", 40),
    (
        "Historia serwisowa",
        "/api/service-records/?page_size=20",
        20,
    ),
)


def load_accounts(users):
    django_code = f"""
import json
import os

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken

if os.getenv('FLOTIVO_BENCH_CONFIRM') != 'flotivo-smoke':
    raise RuntimeError('Nieprawidlowe srodowisko testowe')

accounts = []

for i in range(1, {users} + 1):
    user = get_user_model().objects.get(
        username=f'flotivo_bench_admin_{{i:03d}}',
        is_active=True,
    )

    membership = user.organization_membership

    if not membership.organization.name.startswith(
        'FLOTIVO_BENCH_ORG_'
    ):
        raise RuntimeError('Konto spoza danych testowych')

    accounts.append({{
        'number': i,
        'org': membership.organization_id,
        'token': str(AccessToken.for_user(user)),
    }})

print('BENCH_ACCOUNTS=' + json.dumps(accounts))
"""

    command = [
        "docker",
        "compose",
        "-p",
        "flotivo-smoke",
        "-f",
        "docker-compose.smoke.yml",
        "exec",
        "-T",
        "-e",
        "FLOTIVO_BENCH_CONFIRM=flotivo-smoke",
        "backend",
        "python",
        "manage.py",
        "shell",
        "-c",
        django_code,
    ]

    result = subprocess.run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(
            "Nie udalo sie pobrac kont testowych.\n"
            + result.stderr[-1500:]
        )

    marker = "BENCH_ACCOUNTS="

    for line in result.stdout.splitlines():
        if line.startswith(marker):
            return json.loads(line[len(marker):])

    raise RuntimeError(
        "Brak listy kont w odpowiedzi Django."
    )


def run_user(account, ssl_context):
    results = []

    connection = http.client.HTTPSConnection(
        HOST,
        PORT,
        timeout=15,
        context=ssl_context,
    )

    try:
        for i in range(REQUESTS_PER_USER):
            index = (
                i + account["number"]
            ) % len(ENDPOINTS)

            name, path, expected_count = ENDPOINTS[index]

            started = time.perf_counter()

            try:
                connection.request(
                    "GET",
                    path,
                    headers={
                        "Authorization": (
                            "Bearer " + account["token"]
                        ),
                        "Accept": "application/json",
                        "Cache-Control": "no-store",
                    },
                )

                response = connection.getresponse()
                payload = response.read()

                latency = (
                    time.perf_counter() - started
                ) * 1000

                if response.status != 200:
                    raise RuntimeError(
                        f"HTTP {response.status}"
                    )

                data = json.loads(payload)

                if data.get("count") != expected_count:
                    raise RuntimeError(
                        "Nieoczekiwana liczba rekordow"
                    )

                for row in data.get("results", []):
                    if (
                        "organization" in row
                        and row["organization"]
                        != account["org"]
                    ):
                        raise RuntimeError(
                            "BLAD IZOLACJI ORGANIZACJI"
                        )

                results.append(
                    (name, latency, None)
                )

            except Exception as exc:
                results.append(
                    (
                        name,
                        None,
                        type(exc).__name__ + ": " + str(exc),
                    )
                )

                connection.close()

                connection = http.client.HTTPSConnection(
                    HOST,
                    PORT,
                    timeout=15,
                    context=ssl_context,
                )

            time.sleep(0.15)

    finally:
        connection.close()

    return results


def p95(values):
    ordered = sorted(values)

    index = max(
        0,
        math.ceil(len(ordered) * 0.95) - 1,
    )

    return ordered[index]


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--users",
        type=int,
        required=True,
        choices=(10, 25, 50),
    )

    args = parser.parse_args()

    print("FLOTIVO - TEST HTTPS")
    print("Srodowisko: flotivo-smoke")
    print(
        "Pobieranie tokenow kont testowych..."
    )

    accounts = load_accounts(args.users)

    ssl_context = ssl._create_unverified_context()

    started = time.perf_counter()

    with ThreadPoolExecutor(
        max_workers=args.users
    ) as pool:
        futures = [
            pool.submit(
                run_user,
                account,
                ssl_context,
            )
            for account in accounts
        ]

        results = [
            sample
            for future in futures
            for sample in future.result()
        ]

    duration = time.perf_counter() - started

    successful = [
        ms
        for _, ms, error in results
        if error is None
    ]

    errors = [
        (name, error)
        for name, _, error in results
        if error is not None
    ]

    print()
    print("=== PODSUMOWANIE ===")
    print(f"Uzytkownicy: {args.users}")
    print(f"Zadania HTTPS: {len(results)}")
    print(f"Sukces: {len(successful)}")
    print(f"Bledy: {len(errors)}")
    print(f"Czas testu: {duration:.2f} s")
    print(
        f"Zadania/s: {len(results) / duration:.2f}"
    )

    if successful:
        print(
            "Mediana: "
            f"{statistics.median(successful):.2f} ms"
        )

        print(
            f"P95: {p95(successful):.2f} ms"
        )

    print()
    print("=== ENDPOINTY ===")

    for name, _, _ in ENDPOINTS:
        values = [
            ms
            for label, ms, error in results
            if label == name and error is None
        ]

        if values:
            print(
                f"{name}: "
                f"mediana {statistics.median(values):.2f} ms"
                f" | P95 {p95(values):.2f} ms"
            )

    if errors:
        print()
        print("=== PRZYKLADY BLEDOW ===")

        for name, error in errors[:5]:
            print(f"{name}: {error}")

        raise SystemExit(1)

    print()
    print("TEST ZAKONCZONY BEZ BLEDOW")


if __name__ == "__main__":
    main()
