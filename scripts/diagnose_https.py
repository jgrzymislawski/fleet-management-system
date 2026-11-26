
import argparse
import http.client
import json
import math
import socket
import ssl
import statistics
import time

from concurrent.futures import ThreadPoolExecutor
from load_test_https import ENDPOINTS, load_accounts


HOST = "localhost"
IPV4_ADDRESS = "127.0.0.1"
PORT = 18443
REQUESTS_PER_USER = 12


class IPv4HTTPSConnection(http.client.HTTPSConnection):
    def connect(self):
        raw_socket = socket.create_connection(
            (IPV4_ADDRESS, self.port),
            timeout=self.timeout,
            source_address=self.source_address,
        )

        try:
            self.sock = self._context.wrap_socket(
                raw_socket,
                server_hostname=HOST,
            )
        except Exception:
            raw_socket.close()
            raise


def percentile_95(values):
    ordered = sorted(values)

    index = max(
        0,
        math.ceil(len(ordered) * 0.95) - 1,
    )

    return ordered[index]


def report(label, values):
    print(f"{label}: {len(values)} probek")

    if values:
        print(
            f"  Mediana: {statistics.median(values):.2f} ms"
        )
        print(
            f"  P95:     {percentile_95(values):.2f} ms"
        )
        print(
            f"  Maks:    {max(values):.2f} ms"
        )


def create_connection(context):
    return IPv4HTTPSConnection(
        HOST,
        PORT,
        timeout=15,
        context=context,
    )


def worker(account, context):
    connection = create_connection(context)

    connects = []
    requests = []
    failures = []

    try:
        for i in range(REQUESTS_PER_USER):
            name, path, expected = ENDPOINTS[
                (i + account["number"]) % len(ENDPOINTS)
            ]

            try:
                if connection.sock is None:
                    started = time.perf_counter()

                    connection.connect()

                    connects.append(
                        (time.perf_counter() - started)
                        * 1000
                    )

                started = time.perf_counter()

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
                body = response.read()

                elapsed = (
                    time.perf_counter() - started
                ) * 1000

                if response.status != 200:
                    raise RuntimeError(
                        f"HTTP {response.status}"
                    )

                data = json.loads(body)

                if data.get("count") != expected:
                    raise RuntimeError(
                        "Nieoczekiwana liczba rekordow: "
                        f"{data.get('count')}"
                    )

                for record in data.get("results", []):
                    if (
                        "organization" in record
                        and record["organization"]
                        != account["org"]
                    ):
                        raise RuntimeError(
                            "BLAD IZOLACJI ORGANIZACJI"
                        )

                requests.append(
                    (i == 0, name, elapsed)
                )

            except Exception as exc:
                failures.append(
                    f"{name}: "
                    f"{type(exc).__name__}: {exc}"
                )

                connection.close()
                connection = create_connection(context)

            time.sleep(0.15)

    finally:
        connection.close()

    return connects, requests, failures


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--users",
        type=int,
        required=True,
        choices=(10, 25, 50),
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
                lambda account: worker(
                    account,
                    context,
                ),
                accounts,
            )
        )

    duration = time.perf_counter() - started

    connections = [
        ms
        for conn, _, _ in runs
        for ms in conn
    ]

    requests = [
        item
        for _, reqs, _ in runs
        for item in reqs
    ]

    errors = [
        error
        for _, _, failures in runs
        for error in failures
    ]

    first = [
        ms
        for is_first, _, ms in requests
        if is_first
    ]

    repeats = [
        ms
        for is_first, _, ms in requests
        if not is_first
    ]

    print()
    print(
        f"=== HTTPS IPV4: "
        f"{args.users} UZYTKOWNIKOW ==="
    )

    print(f"Adres sieciowy: {IPV4_ADDRESS}")
    print(f"Nazwa HTTPS: {HOST}")

    print(
        "Zadania: "
        f"{args.users * REQUESTS_PER_USER}"
    )

    print(f"Sukces: {len(requests)}")
    print(f"Bledy: {len(errors)}")
    print(f"Czas calego testu: {duration:.2f} s")

    report(
        "Zestawienie polaczenia TCP/TLS",
        connections,
    )

    report(
        "Pierwsze zadanie po polaczeniu",
        first,
    )

    report(
        "Kolejne zadania na polaczeniu",
        repeats,
    )

    for name, _, _ in ENDPOINTS:
        values = [
            ms
            for is_first, label, ms in requests
            if not is_first and label == name
        ]

        report(
            name + " (powtorzenia)",
            values,
        )

    if errors:
        print()
        print("Przyklady bledow:")

        for error in errors[:5]:
            print("  " + error)

        raise SystemExit(1)

    print()
    print("DIAGNOSTYKA ZAKONCZONA BEZ BLEDOW")


if __name__ == "__main__":
    main()
