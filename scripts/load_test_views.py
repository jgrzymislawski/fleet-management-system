
import argparse
import json
import math
import ssl
import statistics
import time
from concurrent.futures import ThreadPoolExecutor

from diagnose_https import HOST, PORT, IPv4HTTPSConnection
from load_test_https import load_accounts


SCENARIOS = {
    "dashboard": (
        ("vehicles", 200),
        ("drivers", 40),
        ("vehicle-documents", None),
    ),
    "statistics": (
        ("vehicles", 200),
        ("service-records", 20),
    ),
}


def p95(values):
    values = sorted(values)
    index = max(0, math.ceil(len(values) * 0.95) - 1)
    return values[index]


def fetch_all(account, endpoint, expected, context):
    connection = IPv4HTTPSConnection(
        HOST, PORT, timeout=20, context=context
    )

    started = time.perf_counter()
    total_records = 0
    total_bytes = 0
    requests = 0
    declared_count = None

    try:
        for page in range(1, 1001):
            path = (
                f"/api/{endpoint}/"
                f"?page={page}&page_size=100"
            )

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
            content = response.read()

            requests += 1
            total_bytes += len(content)

            if response.status != 200:
                raise RuntimeError(
                    f"{endpoint}: HTTP {response.status}, "
                    f"{content[:150]!r}"
                )

            data = json.loads(content)

            if isinstance(data, list):
                rows = data
                next_page = False
            elif isinstance(data, dict):
                rows = data.get("results")

                if not isinstance(rows, list):
                    raise RuntimeError(
                        f"{endpoint}: brak results"
                    )

                if isinstance(data.get("count"), int):
                    declared_count = data["count"]

                next_page = bool(data.get("next"))
            else:
                raise RuntimeError(
                    f"{endpoint}: nieprawidlowa odpowiedz"
                )

            for row in rows:
                if not isinstance(row, dict):
                    continue

                if (
                    "organization" in row
                    and str(row["organization"])
                    != str(account["org"])
                ):
                    raise RuntimeError(
                        f"{endpoint}: blad izolacji organizacji"
                    )

            total_records += len(rows)

            if not next_page:
                break
        else:
            raise RuntimeError(
                f"{endpoint}: przekroczono 1000 stron"
            )

        if expected is not None and total_records != expected:
            raise RuntimeError(
                f"{endpoint}: oczekiwano {expected}, "
                f"otrzymano {total_records}"
            )

        if (
            declared_count is not None
            and declared_count != total_records
        ):
            raise RuntimeError(
                f"{endpoint}: niekompletna paginacja "
                f"{total_records}/{declared_count}"
            )

        elapsed = (
            time.perf_counter() - started
        ) * 1000

        return {
            "endpoint": endpoint,
            "ms": elapsed,
            "requests": requests,
            "records": total_records,
            "bytes": total_bytes,
        }

    finally:
        connection.close()


def run_user(account, scenario, context):
    started = time.perf_counter()
    results = []
    errors = []

    with ThreadPoolExecutor(
        max_workers=len(SCENARIOS[scenario])
    ) as pool:
        futures = [
            pool.submit(
                fetch_all,
                account,
                endpoint,
                expected,
                context,
            )
            for endpoint, expected in SCENARIOS[scenario]
        ]

        for future in futures:
            try:
                results.append(future.result())
            except Exception as exc:
                errors.append(
                    f"Konto {account['number']}: "
                    f"{type(exc).__name__}: {exc}"
                )

    elapsed = (
        time.perf_counter() - started
    ) * 1000

    return elapsed, results, errors


def print_metrics(label, values):
    if not values:
        return

    print(
        f"{label}: "
        f"mediana={statistics.median(values):.2f} ms, "
        f"P95={p95(values):.2f} ms, "
        f"max={max(values):.2f} ms"
    )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--page",
        required=True,
        choices=tuple(SCENARIOS),
    )

    parser.add_argument(
        "--users",
        type=int,
        required=True,
        choices=(1, 10, 25, 50),
    )

    args = parser.parse_args()
    accounts = load_accounts(args.users)

    context = ssl.SSLContext(
        ssl.PROTOCOL_TLS_CLIENT
    )
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    started = time.perf_counter()

    with ThreadPoolExecutor(
        max_workers=args.users
    ) as pool:
        runs = list(
            pool.map(
                lambda account: run_user(
                    account,
                    args.page,
                    context,
                ),
                accounts,
            )
        )

    duration = time.perf_counter() - started

    errors = [
        error
        for _, _, failures in runs
        for error in failures
    ]

    successful = [
        elapsed
        for elapsed, _, failures in runs
        if not failures
    ]

    responses = [
        result
        for _, results, _ in runs
        for result in results
    ]

    total_requests = sum(
        item["requests"] for item in responses
    )

    total_bytes = sum(
        item["bytes"] for item in responses
    )

    print()
    print("=== FLOTIVO - TEST CALYCH WIDOKOW ===")
    print(f"Strona: {args.page}")
    print(f"Uzytkownicy: {args.users}")
    print(f"Czas calego testu: {duration:.2f} s")
    print(f"Udane zaladowania: {len(successful)}")
    print(f"Bledy: {len(errors)}")
    print(f"Liczba zadan HTTPS: {total_requests}")
    print(f"Pobrane dane: {total_bytes / 1024:.1f} KiB")

    print_metrics("Caly widok", successful)

    for endpoint, _ in SCENARIOS[args.page]:
        values = [
            item["ms"]
            for item in responses
            if item["endpoint"] == endpoint
        ]

        request_counts = [
            item["requests"]
            for item in responses
            if item["endpoint"] == endpoint
        ]

        print()
        print(endpoint)

        if request_counts:
            print(
                f"  Zapytania na uzytkownika: "
                f"{min(request_counts)}"
                f"-{max(request_counts)}"
            )

        print_metrics("  Czas pobierania", values)

    if errors:
        print()
        print("=== BLEDY ===")

        for error in errors[:10]:
            print(error)

        raise SystemExit(1)

    print()
    print("TEST ZAKONCZONY BEZ BLEDOW")


if __name__ == "__main__":
    main()
