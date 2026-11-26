
import argparse
import json
import math
import ssl
import statistics
import time
from concurrent.futures import ThreadPoolExecutor

from diagnose_https import HOST, PORT, IPv4HTTPSConnection
from load_test_https import load_accounts


CASES = (
    ("Alerty", "/api/alerts/?page_size=20"),
    ("Opcje raportow", "/api/reports/options/"),
)


def p95(values):
    ordered = sorted(values)
    index = max(
        0,
        math.ceil(len(ordered) * 0.95) - 1,
    )
    return ordered[index]


def make_connection(context):
    return IPv4HTTPSConnection(
        HOST,
        PORT,
        timeout=15,
        context=context,
    )


def request_one(connection, account, case):
    label, path = case

    if connection.sock is None:
        connection.connect()

    started = time.perf_counter()

    connection.request(
        "GET",
        path,
        headers={
            "Authorization": "Bearer " + account["token"],
            "Accept": "application/json",
            "Cache-Control": "no-store",
        },
    )

    response = connection.getresponse()
    content = response.read()

    elapsed = (
        time.perf_counter() - started
    ) * 1000

    if response.status != 200:
        raise RuntimeError(
            f"{label}: HTTP {response.status}"
        )

    data = json.loads(content)

    if label == "Alerty":
        results = data.get("results")
        count = data.get("count")

        if not isinstance(results, list):
            raise RuntimeError(
                "Alerty: brak listy results"
            )

        if not isinstance(count, int):
            raise RuntimeError(
                "Alerty: brak count"
            )

        if len(results) > 20:
            raise RuntimeError(
                "Alerty: nieprawidlowa paginacja"
            )

    else:
        vehicles = data.get("vehicles")

        if not isinstance(vehicles, list):
            raise RuntimeError(
                "Opcje raportow: brak pojazdow"
            )

        if len(vehicles) != 200:
            raise RuntimeError(
                "Opcje raportow: nieoczekiwana "
                "liczba pojazdow"
            )

        prefix = (
            f"BENCH{account['number']:03d}"
        )

        for vehicle in vehicles:
            registration = str(
                vehicle.get(
                    "registration_number",
                    "",
                )
            )

            if not registration.startswith(prefix):
                raise RuntimeError(
                    "Mozliwy blad izolacji danych"
                )

    return label, elapsed


def worker(account, context, deadline):
    connection = make_connection(context)

    samples = []
    errors = []
    error_count = 0
    index = 0

    try:
        try:
            request_one(
                connection,
                account,
                CASES[0],
            )
        except Exception as exc:
            error_count += 1
            errors.append(
                f"Rozgrzewka: {type(exc).__name__}: {exc}"
            )
            connection.close()
            connection = make_connection(context)

        while time.perf_counter() < deadline:
            case = CASES[
                (index + account["number"])
                % len(CASES)
            ]

            try:
                result = request_one(
                    connection,
                    account,
                    case,
                )
                samples.append(result)

            except Exception as exc:
                error_count += 1

                if len(errors) < 5:
                    errors.append(
                        f"{type(exc).__name__}: {exc}"
                    )

                connection.close()
                connection = make_connection(context)

            index += 1
            time.sleep(0.25)

    finally:
        connection.close()

    return samples, error_count, errors


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--users",
        type=int,
        required=True,
        choices=(10, 25, 50),
    )

    parser.add_argument(
        "--seconds",
        type=int,
        default=30,
        choices=(30, 60),
    )

    args = parser.parse_args()

    accounts = load_accounts(args.users)

    context = ssl.SSLContext(
        ssl.PROTOCOL_TLS_CLIENT
    )
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    started = time.perf_counter()
    deadline = started + args.seconds

    with ThreadPoolExecutor(
        max_workers=args.users
    ) as pool:
        results = list(
            pool.map(
                lambda account: worker(
                    account,
                    context,
                    deadline,
                ),
                accounts,
            )
        )

    duration = time.perf_counter() - started

    samples = [
        item
        for items, _, _ in results
        for item in items
    ]

    error_count = sum(
        count
        for _, count, _ in results
    )

    errors = [
        error
        for _, _, examples in results
        for error in examples
    ]

    print()
    print("=== FLOTIVO RAPORTY I ALERTY ===")
    print(f"Uzytkownicy: {args.users}")
    print(f"Czas: {duration:.2f} s")
    print(f"Udane zadania: {len(samples)}")
    print(f"Bledy: {error_count}")
    print(
        f"Udane zadania/s: "
        f"{len(samples) / duration:.2f}"
    )

    for label, _ in CASES:
        values = [
            ms
            for name, ms in samples
            if name == label
        ]

        if values:
            print()
            print(label)
            print(f"  Probki: {len(values)}")
            print(
                f"  Mediana: "
                f"{statistics.median(values):.2f} ms"
            )
            print(
                f"  P95: {p95(values):.2f} ms"
            )
            print(
                f"  Maks: {max(values):.2f} ms"
            )

    if error_count:
        print()
        print("PRZYKLADY BLEDOW")

        for error in errors[:5]:
            print(error)

        raise SystemExit(1)

    print()
    print("TEST ZAKONCZONY BEZ BLEDOW")


if __name__ == "__main__":
    main()
