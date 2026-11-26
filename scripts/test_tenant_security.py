
import secrets
import ssl
import sys

from load_test_https import load_accounts
from load_test_write import call, connect


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def main():
    owner, foreign = load_accounts(2)

    require(
        owner["org"] != foreign["org"],
        "Konta naleza do tej samej organizacji",
    )

    context = ssl.SSLContext(
        ssl.PROTOCOL_TLS_CLIENT
    )
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    owner_conn = connect(context)
    foreign_conn = connect(context)

    registration = (
        "BMS" + secrets.token_hex(6).upper()
    )

    vehicle_id = None
    deleted = False
    success = False
    cleanup_ok = True

    print("=== FLOTIVO - IZOLACJA ORGANIZACJI ===")
    print("Srodowisko: flotivo-smoke")
    print(f"Organizacja A: {owner['org']}")
    print(f"Organizacja B: {foreign['org']}")
    print(f"Pojazd testowy: {registration}")

    try:
        status, data, _ = call(
            owner_conn,
            owner["token"],
            "POST",
            "/api/vehicles/",
            {
                "brand": "Ford",
                "model": "SecurityTest",
                "registration_number": registration,
                "year": 2024,
                "vehicle_type": "passenger",
                "fuel_type": "petrol",
                "mileage": 10,
                "status": "active",
            },
        )

        require(
            status == 201 and isinstance(data, dict),
            f"Tworzenie pojazdu: HTTP {status}, {data}",
        )

        vehicle_id = data.get("id")

        require(
            isinstance(vehicle_id, int),
            "Brak ID utworzonego pojazdu",
        )

        require(
            str(data.get("organization"))
            == str(owner["org"]),
            "Pojazd przypisany do zlej organizacji",
        )

        path = f"/api/vehicles/{vehicle_id}/"

        print("POST firmy A: HTTP 201")

        status, _, _ = call(
            foreign_conn,
            foreign["token"],
            "GET",
            path,
        )

        print(f"GET firmy B: HTTP {status}")

        require(
            status in (403, 404),
            "Firma B moze odczytac cudzy pojazd",
        )

        status, _, _ = call(
            foreign_conn,
            foreign["token"],
            "PATCH",
            path,
            {"mileage": 987654},
        )

        print(f"PATCH firmy B: HTTP {status}")

        require(
            status in (403, 404),
            "Firma B moze edytowac cudzy pojazd",
        )

        status, data, _ = call(
            owner_conn,
            owner["token"],
            "GET",
            path,
        )

        require(
            status == 200 and isinstance(data, dict),
            "Firma A nie moze odczytac pojazdu",
        )

        require(
            data.get("mileage") == 10,
            "Firma B zmienila przebieg pojazdu",
        )

        print("Weryfikacja przebiegu: OK")

        status, _, _ = call(
            foreign_conn,
            foreign["token"],
            "DELETE",
            path,
        )

        print(f"DELETE firmy B: HTTP {status}")

        require(
            status in (403, 404),
            "Firma B moze usunac cudzy pojazd",
        )

        status, data, _ = call(
            owner_conn,
            owner["token"],
            "GET",
            path,
        )

        require(
            status == 200 and isinstance(data, dict),
            "Pojazd zniknal po probie usuniecia",
        )

        require(
            data.get("mileage") == 10,
            "Dane pojazdu zostaly zmienione",
        )

        print("Pojazd firmy A nadal istnieje: OK")

        status, _, _ = call(
            owner_conn,
            owner["token"],
            "DELETE",
            path,
        )

        require(
            status == 204,
            f"Usuwanie przez wlasciciela: HTTP {status}",
        )

        deleted = True

        status, _, _ = call(
            owner_conn,
            owner["token"],
            "GET",
            path,
        )

        require(
            status == 404,
            "Usuniety pojazd nadal jest widoczny",
        )

        print("DELETE firmy A: HTTP 204")
        print("GET po usunieciu: HTTP 404")

        success = True

    except Exception as exc:
        print()
        print(f"BLAD TESTU: {type(exc).__name__}: {exc}")

    finally:
        if vehicle_id is not None and not deleted:
            print("Proba sprzatania pojazdu testowego")

            try:
                status, _, _ = call(
                    owner_conn,
                    owner["token"],
                    "DELETE",
                    f"/api/vehicles/{vehicle_id}/",
                )

                print(f"Cleanup: HTTP {status}")

                if status not in (204, 404):
                    cleanup_ok = False

            except Exception as exc:
                cleanup_ok = False
                print(f"Cleanup nieudany: {exc}")

        owner_conn.close()
        foreign_conn.close()

    print()

    if success and cleanup_ok:
        print("WSZYSTKIE TESTY BEZPIECZENSTWA OK")
    else:
        print(
            "TEST NIEZALICZONY - SPRAWDZ "
            f"POJAZD {registration}"
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
