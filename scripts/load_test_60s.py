
import argparse
import json
import math
import ssl
import statistics
import time

from concurrent.futures import ThreadPoolExecutor
from collections import Counter

from diagnose_https import IPv4HTTPSConnection, HOST, PORT
from load_test_https import ENDPOINTS, load_accounts


def percentile(values, percentage):
    ordered = sorted(values)
    index = max(
        0,
        math.ceil(len(ordered) * percentage / 100) - 1,
    )
    return ordered[index]


def create_connection(context):
    return IPv4HTTPSConnection(
        HOST,
        PORT,
        timeout=15,
        context=context,
    )


def perform_request(connection, account, index):
    name, path, expected_count = ENDPOINTS[
        index % len(ENDPOINTS)
    ]

    connection_ms = None

    if connection.sock is None:
        started = time.perf_counter()
        connection.connect()
        connection_ms = (
            time.perf_counter() - started
        ) * 1000

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

    latency_ms = (
        time.perf_counter() - started
    ) * 1000

    if response.status != 200:
        raise RuntimeError(f"HTTP {response.status}")

    data = json.loads(content)

    if data.get("count") != expected_count:
        raise RuntimeError(
            f"Niepoprawna liczba rekordow: "
            f"{data.get('count')}"
        )

    for row in data.get("results", []):
        if (
            "organization" in row
            and row["organization"] != account["org"]
        ):
            raise RuntimeError(
                "BLAD IZOLACJI ORGANIZACJI"
            )

    return name, latency_ms, connection_ms


def worker(account, context, deadline, pause):
    connection = create_connection(context)

    samples = []
    connections = []
    errors = []
    error_count = 0
    index = account["number"] % len(ENDPOINTS)

    try:
        try:
            perform_request(connection, account, index)
            index += 1
        except Exception as exc:
            return {
                "samples": [],
                "connections": [],
                "errors": [str(exc)],
                "error_count": 1,
            }

        time.sleep(
            (account["number"] % 10) * 0.01
        )

        while time.perf_counter() < deadline:
            try:
                name, elapsed, connection_ms = (
                    perform_request(
                        connection,
                        account,
                        index,
                    )
                )

                samples.append((name, elapsed))

                if connection_ms is not None:
                    connections.append(connection_ms)

            except Exception as exc:
                error_count += 1

                if len(errors) < 3:
                    errors.append(
                        f"{type(exc).__name__}: {exc}"
                    )

                connection.close()
                connection = create_connection(context)

            index += 1
            time.sleep(pause)

    finally:
        connection.close()

    return {
        "samples": samples,
        "connections": connections,
        "errors": errors,
        "error_count": error_count,
    }


def print_metrics(label, values):
    if not values:
        print(f"{label}: brak udanych probek")
        return

    print(
        f"{label}: "
        f"mediana={statistics.median(values):.2f} ms, "
        f"P95={percentile(values, 95):.2f} ms, "
        f"P99={percentile(values, 99):.2f} ms, "
        f"max={max(values):.2f} ms"
    )


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
        default=60,
        choices=(30, 60, 120),
    )

    parser.add_argument(
        "--pause",
        type=float,
        default=0.25,
    )

    args = parser.parse_args()

    if not 0.1 <= args.pause <= 2.0:
        parser.error(
            "--pause musi byc pomiedzy 0.1 a 2.0"
        )

    accounts = load_accounts(args.users)

    context = ssl.SSLContext(
        ssl.PROTOCOL_TLS_CLIENT
    )
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    print("=== FLOTIVO LOAD TEST ===")
    print("Srodowisko: flotivo-smoke")
    print(f"Uzytkownicy: {args.users}")
    print(f"Czas: {args.seconds} s")
    print(f"Przerwa miedzy zadaniami: {args.pause} s")

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
                    args.pause,
                ),
                accounts,
            )
        )

    duration = time.perf_counter() - started

    samples = [
        item
        for result in results
        for item in result["samples"]
    ]

    connections = [
        value
        for result in results
        for value in result["connections"]
    ]

    errors = [
        error
        for result in results
        for error in result["errors"]
    ]

    error_count = sum(
        result["error_count"]
        for result in results
    )

    successful = [ms for _, ms in samples]
    total = len(samples) + error_count

    print()
    print("=== PODSUMOWANIE ===")
    print(f"Czas rzeczywisty: {duration:.2f} s")
    print(f"Liczba zadan: {total}")
    print(f"Udane: {len(samples)}")
    print(f"Bledy: {error_count}")

    if total:
        print(
            f"Odsetek bledow: "
            f"{100 * error_count / total:.2f}%"
        )

    print(
        f"Udane zadania/s: "
        f"{len(samples) / duration:.2f}"
    )

    print_metrics("HTTP", successful)
    print_metrics("Ponowne TCP/TLS", connections)

    print()
    print("=== ENDPOINTY ===")

    counts = Counter(name for name, _ in samples)

    for name, _, _ in ENDPOINTS:
        values = [
            ms
            for label, ms in samples
            if label == name
        ]

        print(f"{name}: {counts[name]} udanych")
        print_metrics("  Czasy", values)

    if errors:
        print()
        print("=== PRZYKLADY BLEDOW ===")

        for error in errors[:10]:
            print(error)

        raise SystemExit(1)

    print()
    print("TEST ZAKONCZONY BEZ BLEDOW")


if __name__ == "__main__":
    main()
