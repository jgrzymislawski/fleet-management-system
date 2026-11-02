from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter


VEHICLE_IMPORT_HEADERS = [
    "Marka",
    "Model",
    "Numer rejestracyjny",
    "VIN",
    "Rok",
    "Typ pojazdu",
    "Rodzaj paliwa",
    "Przebieg",
    "Status",
    "Spółka",
    "Oddział",
    "Termin przeglądu",
    "Termin OC",
]


VEHICLE_TYPE_MAPPING = {
    "samochód osobowy": "passenger",
    "samochod osobowy": "passenger",
    "osobowy": "passenger",
    "passenger": "passenger",

    "bus": "van",
    "samochód dostawczy": "van",
    "samochod dostawczy": "van",
    "bus / samochód dostawczy": "van",
    "bus / samochod dostawczy": "van",
    "dostawczy": "van",
    "van": "van",

    "samochód ciężarowy": "truck",
    "samochod ciezarowy": "truck",
    "ciężarowy": "truck",
    "ciezarowy": "truck",
    "truck": "truck",

    "pojazd specjalny": "special",
    "specjalny": "special",
    "special": "special",

    "inny": "other",
    "other": "other",
}


FUEL_TYPE_MAPPING = {
    "benzyna": "petrol",
    "petrol": "petrol",

    "diesel": "diesel",
    "olej napędowy": "diesel",
    "olej napedowy": "diesel",

    "lpg": "lpg",
    "gaz": "lpg",

    "hybryda": "hybrid",
    "hybrid": "hybrid",

    "elektryczny": "electric",
    "electric": "electric",
}


STATUS_MAPPING = {
    "aktywny": "active",
    "active": "active",

    "w serwisie": "maintenance",
    "serwis": "maintenance",
    "maintenance": "maintenance",

    "nieaktywny": "inactive",
    "inactive": "inactive",
}


def normalize_text(value):
    if value is None:
        return ""

    return str(value).strip()


def normalize_registration_number(value):
    return (
        normalize_text(value)
        .upper()
        .replace(" ", "")
    )


def normalize_vin(value):
    return (
        normalize_text(value)
        .upper()
        .replace(" ", "")
    )


def parse_integer(
    value,
    field_name,
    required=False,
    minimum=None,
    maximum=None,
):
    if value in (
        None,
        "",
    ):
        if required:
            raise ValueError(
                f"Pole „{field_name}” jest wymagane."
            )

        return None

    try:
        if isinstance(
            value,
            float,
        ):
            if not value.is_integer():
                raise ValueError

        result = int(value)

    except (
        TypeError,
        ValueError,
    ):
        raise ValueError(
            f"Pole „{field_name}” musi być liczbą całkowitą."
        )

    if (
        minimum is not None
        and result < minimum
    ):
        raise ValueError(
            f"Pole „{field_name}” nie może być mniejsze niż {minimum}."
        )

    if (
        maximum is not None
        and result > maximum
    ):
        raise ValueError(
            f"Pole „{field_name}” nie może być większe niż {maximum}."
        )

    return result


def parse_date(
    value,
    field_name,
):
    if value in (
        None,
        "",
    ):
        return None

    if isinstance(
        value,
        datetime,
    ):
        return value.date()

    if isinstance(
        value,
        date,
    ):
        return value

    text = normalize_text(
        value
    )

    formats = [
        "%Y-%m-%d",
        "%d.%m.%Y",
        "%d-%m-%Y",
        "%d/%m/%Y",
    ]

    for date_format in formats:
        try:
            return datetime.strptime(
                text,
                date_format,
            ).date()

        except ValueError:
            continue

    raise ValueError(
        f"Nieprawidłowa data w polu „{field_name}”. "
        "Użyj formatu RRRR-MM-DD lub DD.MM.RRRR."
    )


def parse_choice(
    value,
    field_name,
    mapping,
    required=False,
):
    text = normalize_text(
        value
    )

    if not text:
        if required:
            raise ValueError(
                f"Pole „{field_name}” jest wymagane."
            )

        return None

    normalized = text.lower()

    result = mapping.get(
        normalized
    )

    if result is None:
        raise ValueError(
            f"Nieprawidłowa wartość pola „{field_name}”: {text}."
        )

    return result


def create_vehicle_import_template():
    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Import pojazdów"

    for column_index, header in enumerate(
        VEHICLE_IMPORT_HEADERS,
        start=1,
    ):
        cell = worksheet.cell(
            row=1,
            column=column_index,
            value=header,
        )

        cell.font = Font(
            bold=True,
        )

        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    example = [
        "Ford",
        "Focus",
        "DL12345",
        "WF012345678901234",
        2020,
        "Samochód osobowy",
        "Benzyna",
        85000,
        "Aktywny",
        "Firma A",
        "Legnica",
        "2027-05-20",
        "2027-03-15",
    ]

    for column_index, value in enumerate(
        example,
        start=1,
    ):
        worksheet.cell(
            row=2,
            column=column_index,
            value=value,
        )

    widths = [
        18,
        18,
        24,
        24,
        12,
        28,
        22,
        16,
        18,
        28,
        22,
        22,
        22,
    ]

    for index, width in enumerate(
        widths,
        start=1,
    ):
        worksheet.column_dimensions[
            get_column_letter(
                index
            )
        ].width = width

    worksheet.freeze_panes = "A2"

    instructions = workbook.create_sheet(
        "Instrukcja"
    )

    instructions["A1"] = (
        "Instrukcja importu pojazdów"
    )

    instructions["A1"].font = Font(
        bold=True,
        size=16,
    )

    instructions_rows = [
        (
            "Marka",
            "Pole wymagane.",
        ),
        (
            "Model",
            "Pole wymagane.",
        ),
        (
            "Numer rejestracyjny",
            "Pole wymagane i unikalne.",
        ),
        (
            "VIN",
            "Pole opcjonalne. Jeśli podany, musi być unikalny.",
        ),
        (
            "Rok",
            "Pole wymagane. Liczba całkowita.",
        ),
        (
            "Typ pojazdu",
            (
                "Samochód osobowy, Bus / samochód dostawczy, "
                "Samochód ciężarowy, Pojazd specjalny lub Inny."
            ),
        ),
        (
            "Rodzaj paliwa",
            (
                "Benzyna, Diesel, LPG, Hybryda lub Elektryczny. "
                "Pole opcjonalne."
            ),
        ),
        (
            "Przebieg",
            "Liczba całkowita, minimum 0.",
        ),
        (
            "Status",
            "Aktywny, W serwisie lub Nieaktywny.",
        ),
        (
            "Spółka",
            (
                "Dokładna nazwa spółki istniejącej w systemie. "
                "Użytkownik musi mieć do niej uprawnienia."
            ),
        ),
        (
            "Oddział",
            "Pole opcjonalne.",
        ),
        (
            "Termin przeglądu",
            "RRRR-MM-DD lub DD.MM.RRRR.",
        ),
        (
            "Termin OC",
            "RRRR-MM-DD lub DD.MM.RRRR.",
        ),
    ]

    instructions.append(
        [
            "Kolumna",
            "Opis",
        ]
    )

    for cell in instructions[2]:
        cell.font = Font(
            bold=True,
        )

    for name, description in instructions_rows:
        instructions.append(
            [
                name,
                description,
            ]
        )

    instructions.column_dimensions[
        "A"
    ].width = 28

    instructions.column_dimensions[
        "B"
    ].width = 80

    output = BytesIO()

    workbook.save(
        output
    )

    output.seek(0)

    return output