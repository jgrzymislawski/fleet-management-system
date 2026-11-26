
import argparse
import io
import json
import math
import ssl
import statistics
import time
import zipfile

from concurrent.futures import ThreadPoolExecutor

from diagnose_https import HOST, PORT, IPv4HTTPSConnection
from load_test_https import load_accounts


MAX_BYTES = 20 * 1024 * 1024

CASES = (
    (
        "Koszty PDF",
        "/api/reports/service-costs/",
        {"format": "pdf"},
        "pdf",
    ),
    (
        "Koszty XLSX",
        "/api/reports/service-costs/",
        {"format": "xlsx"},
        "xlsx",
    ),
    (
        "Alerty PDF",
        "/api/reports/alerts/",
        {"format": "pdf"},
        "pdf",
    ),
    (
        "Alerty XLSX",
        "/api/reports/alerts/",
        {"format": "xlsx"},
        "xlsx",
    ),
    (
        "Statystyki PDF",
        "/api/reports/statistics/",
        {"vehicle_ids": []},
        "pdf",
    ),
)


def percentile(values, rate):
    ordered = sorted(values)

    position = max(
        0,
        math.ceil(len(ordered) * rate) - 1,
    )

    return ordered[position]


def make_connection(context):
    return IPv4HTTPSConnection(
        HOST,
        PORT,
        timeout=30,
        context=context,
    )


def run_one(connection, account, case):
    label, path, payload, kind = case

    body = json.dumps(payload).encode("utf-8")

    started = time.perf_counter()

    connection.request(
        "POST",
        path,
        body=body,
        headers={
            "Authorization": (
                "Bearer " + account["token"]
            ),
            "Content-Type": "application/json",
            "Accept": "*/*",
            "Cache-Control": "no-store",
        },
    )

    response = connection.getresponse()
    content = response.read(MAX_BYTES + 1)

    duration_ms = (
        time.perf_counter() - started
    ) * 1000

    if response.status != 200:
        raise RuntimeError(
            f"{label}: HTTP {response.status}, "
            f"{content[:200]!r}"
        )

    if len(content) > MAX_BYTES:
        raise RuntimeError(
            f"{label}: raport przekroczyl limit 20 MiB"
        )

    media_type = (
        response.getheader("Content-Type", "")
        .split(";")[0]
    )

    disposition = response.getheader(
        "Content-Disposition",
        "",
    )

    if "attachment" not in disposition.lower():
        raise RuntimeError(
            f"{label}: brak Content-Disposition attachment"
        )

    if kind == "pdf":
        if (
            media_type != "application/pdf"
            or not content.startswith(b"%PDF-")
        ):
            raise RuntimeError(
                f"{label}: nieprawidlowy PDF"
            )

    else:
        expected = (
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        )

        if (
            media_type != expected
            or not zipfile.is_zipfile(io.BytesIO(content))
        ):
            raise RuntimeError(
                f"{label}: nieprawidlowy XLSX"
            )

    return label, duration_ms, len(content)


def worker(account, context):
    connection = make_connection(context)

    completed = []
    errors = []
    connection_ms = None

    try:
        started = time.perf_counter()
        connection.connect()

        connection_ms = (
            time.perf_counter() - started
        ) * 1000

        for case in CASES:
            try:
                completed.append(
                    run_one(connection, account, case)
                )

            except Exception as exc:
                errors.append(
                    f"Uzytkownik {account['number']}, "
                    f"{case[0]}: "
                    f"{type(exc).__name__}: {exc}"
                )

                connection.close()
                connection = make_connection(context)

    except Exception as exc:
        errors.append(
            f"Uzytkownik {account['number']}: "
            f"{type(exc).__name__}: {exc}"
        )

    finally:
        connection.close()

    return completed, errors, connection_ms


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--users",
        type=int,
        required=True,
        choices=(1, 5, 10),
    )

    args = parser.parse_args()

    accounts = load_accounts(args.users)

    context = ssl.SSLContext(
        ssl.PROTOCOL_TLS_CLIENT
    )

    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    print("=== FLOTIVO - TEST EKSPORTOW HTTPS ===")
    print("Srodowisko: flotivo-smoke")
    print(f"Rownolegli uzytkownicy: {args.users}")

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

    successes = [
        entry
        for completed, _, _ in runs
        for entry in completed
    ]

    errors = [
        entry
        for _, failures, _ in runs
        for entry in failures
    ]

    connections = [
        ms
        for _, _, ms in runs
        if ms is not None
    ]

    print(f"Czas testu: {duration:.2f} s")
    print(
        f"Poprawne pliki: "
        f"{len(successes)}/{args.users * len(CASES)}"
    )
    print(f"Bledy: {len(errors)}")

    print(
        f"Udane eksporty/s: "
        f"{len(successes) / duration:.2f}"
    )

    if connections:
        print(
            "Polaczenie TCP/TLS, mediana: "
            f"{statistics.median(connections):.2f} ms"
        )

    print()
    print("=== WYNIKI EKSPORTOW ===")

    for label, _, _, _ in CASES:
        samples = [
            (ms, size)
            for name, ms, size in successes
            if name == label
        ]

        if samples:
            values = [
                ms
                for ms, _ in samples
            ]

            max_size = max(
                size
                for _, size in samples
            ) / 1024

            print(
                f"{label}: "
                f"n={len(values)}, "
                f"mediana={statistics.median(values):.2f} ms, "
                f"P95={percentile(values, 0.95):.2f} ms, "
                f"max={max(values):.2f} ms, "
                f"rozmiar={max_size:.1f} KiB"
            )

    if errors:
        print()
        print("=== BLEDY ===")

        for entry in errors[:10]:
            print(entry)

        raise SystemExit(1)

    print()
    print("TEST ZAKONCZONY BEZ BLEDOW")


if __name__ == "__main__":
    main()
