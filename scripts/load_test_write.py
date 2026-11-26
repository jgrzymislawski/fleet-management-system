
import argparse
import json
import secrets
import ssl
import statistics
import time
from concurrent.futures import ThreadPoolExecutor

from diagnose_https import HOST, PORT, IPv4HTTPSConnection
from load_test_https import load_accounts


def connect(context):
    return IPv4HTTPSConnection(
        HOST, PORT, timeout=15, context=context
    )


def call(conn, token, method, path, payload=None):
    body = (
        None
        if payload is None
        else json.dumps(payload).encode("utf-8")
    )

    headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
        "Cache-Control": "no-store",
    }

    if body is not None:
        headers["Content-Type"] = "application/json"

    started = time.perf_counter()

    conn.request(
        method,
        path,
        body=body,
        headers=headers,
    )

    response = conn.getresponse()
    content = response.read()

    duration_ms = (
        time.perf_counter() - started
    ) * 1000

    try:
        data = json.loads(content) if content else None
    except json.JSONDecodeError:
        data = content[:200].decode(
            "utf-8", errors="replace"
        )

    return response.status, data, duration_ms


def require_status(label, actual, expected, data):
    if actual != expected:
        raise RuntimeError(
            f"{label}: HTTP {actual}, "
            f"oczekiwano {expected}, "
            f"body={str(data)[:250]}"
        )


def worker(account, foreign, context):
    registration = (
        "BMK" + secrets.token_hex(6).upper()
    )

    created_id = None
    deleted = False
    samples = []
    errors = []

    conn = connect(context)

    try:
        conn.connect()

        status, data, ms = call(
            conn,
            account["token"],
            "POST",
            "/api/vehicles/",
            {
                "brand": "Ford",
                "model": "Benchmark",
                "registration_number": registration,
                "year": 2024,
                "vehicle_type": "passenger",
                "fuel_type": "petrol",
                "mileage": 10,
                "status": "active",
            },
        )

        require_status(
            "POST", status, 201, data
        )

        created_id = data.get("id")

        if (
            not isinstance(created_id, int)
            or data.get("organization") != account["org"]
        ):
            raise RuntimeError(
                "POST: nieprawidlowa organizacja lub ID"
            )

        samples.append(("POST", ms))

        path = f"/api/vehicles/{created_id}/"

        status, data, ms = call(
            conn,
            account["token"],
            "PATCH",
            path,
            {"mileage": 12345},
        )

        require_status(
            "PATCH", status, 200, data
        )

        if data.get("mileage") != 12345:
            raise RuntimeError(
                "PATCH: nie zapisano przebiegu"
            )

        samples.append(("PATCH", ms))

        status, data, _ = call(
            conn,
            account["token"],
            "GET",
            path,
        )

        require_status(
            "GET", status, 200, data
        )

        if (
            data.get("mileage") != 12345
            or data.get("organization") != account["org"]
        ):
            raise RuntimeError(
                "GET: nieprawidlowe dane"
            )

        if foreign is not None:
            status, data, _ = call(
                conn,
                foreign["token"],
                "GET",
                path,
            )

            require_status(
                "Izolacja", status, 404, data
            )

        status, data, ms = call(
            conn,
            account["token"],
            "DELETE",
            path,
        )

        require_status(
            "DELETE", status, 204, data
        )

        deleted = True
        samples.append(("DELETE", ms))

        status, data, _ = call(
            conn,
            account["token"],
            "GET",
            path,
        )

        require_status(
            "GET po DELETE", status, 404, data
        )

    except Exception as exc:
        errors.append(
            f"Konto {account['number']}, "
            f"rejestracja {registration}: "
            f"{type(exc).__name__}: {exc}"
        )

    finally:
        conn.close()

        if created_id is not None and not deleted:
            cleanup = connect(context)

            try:
                status, data, _ = call(
                    cleanup,
                    account["token"],
                    "DELETE",
                    f"/api/vehicles/{created_id}/",
                )

                if status not in (204, 404):
                    errors.append(
                        f"Cleanup {registration}: HTTP {status}"
                    )

            except Exception as exc:
                errors.append(
                    f"Cleanup {registration}: "
                    f"{type(exc).__name__}: {exc}"
                )

            finally:
                cleanup.close()

    return samples, errors


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

    started = time.perf_counter()

    with ThreadPoolExecutor(
        max_workers=args.users
    ) as pool:
        results = list(
            pool.map(
                lambda i: worker(
                    accounts[i],
                    (
                        accounts[(i + 1) % args.users]
                        if args.users > 1
                        else None
                    ),
                    context,
                ),
                range(args.users),
            )
        )

    duration = time.perf_counter() - started

    samples = [
        item
        for done, _ in results
        for item in done
    ]

    errors = [
        item
        for _, failures in results
        for item in failures
    ]

    print("=== FLOTIVO SMOKE - ZAPIS POJAZDOW ===")
    print(f"Rownolegli uzytkownicy: {args.users}")
    print(f"Czas: {duration:.2f} s")
    print(
        f"Udane operacje zapisu: "
        f"{len(samples)}/{args.users * 3}"
    )
    print(f"Bledy: {len(errors)}")

    for operation in ("POST", "PATCH", "DELETE"):
        values = [
            ms
            for name, ms in samples
            if name == operation
        ]

        if values:
            print(
                f"{operation}: "
                f"mediana={statistics.median(values):.2f} ms, "
                f"max={max(values):.2f} ms"
            )

    if errors:
        for error in errors[:10]:
            print(error)

        raise SystemExit(1)

    print("ZAKONCZONO BEZ BLEDOW")


if __name__ == "__main__":
    main()
