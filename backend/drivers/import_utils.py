from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter


DRIVER_IMPORT_HEADERS = [
    "Imię",
    "Nazwisko",
    "Numer prawa jazdy",
    "Kategorie prawa jazdy",
    "Ważność prawa jazdy",
    "Badania lekarskie",
    "Telefon",
    "Data zatrudnienia",
]


def normalize_text(value):
    if value is None:
        return ""

    return str(value).strip()


def normalize_license_number(value):
    return (
        normalize_text(value)
        .upper()
        .replace(" ", "")
    )


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


def parse_license_categories(
    value,
):
    text = normalize_text(
        value
    )

    if not text:
        return []

    text = (
        text
        .replace(";", ",")
        .replace("/", ",")
    )

    categories = []

    for item in text.split(","):
        category = (
            item
            .strip()
            .upper()
        )

        if not category:
            continue

        if category not in categories:
            categories.append(
                category
            )

    return categories


def create_driver_import_template():
    workbook = Workbook()

    worksheet = workbook.active

    worksheet.title = (
        "Import kierowców"
    )

    for (
        column_index,
        header,
    ) in enumerate(
        DRIVER_IMPORT_HEADERS,
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
        "Jan",
        "Kowalski",
        "ABC123456",
        "B, C, CE",
        "2028-05-20",
        "2027-11-15",
        "500600700",
        "2024-01-15",
    ]

    for (
        column_index,
        value,
    ) in enumerate(
        example,
        start=1,
    ):
        worksheet.cell(
            row=2,
            column=column_index,
            value=value,
        )

    widths = [
        22,
        24,
        25,
        30,
        25,
        25,
        22,
        22,
    ]

    for (
        index,
        width,
    ) in enumerate(
        widths,
        start=1,
    ):
        worksheet.column_dimensions[
            get_column_letter(
                index
            )
        ].width = width

    worksheet.freeze_panes = "A2"

    instructions = (
        workbook.create_sheet(
            "Instrukcja"
        )
    )

    instructions["A1"] = (
        "Instrukcja importu kierowców"
    )

    instructions["A1"].font = Font(
        bold=True,
        size=16,
    )

    instructions.append([])

    instructions.append(
        [
            "Kolumna",
            "Opis",
        ]
    )

    for cell in instructions[3]:
        cell.font = Font(
            bold=True,
        )

    instructions_rows = [
        (
            "Imię",
            "Pole wymagane.",
        ),
        (
            "Nazwisko",
            "Pole wymagane.",
        ),
        (
            "Numer prawa jazdy",
            (
                "Pole wymagane. "
                "Numer musi być unikalny."
            ),
        ),
        (
            "Kategorie prawa jazdy",
            (
                "Kategorie oddziel przecinkiem, "
                "np. B, C, CE."
            ),
        ),
        (
            "Ważność prawa jazdy",
            (
                "Format RRRR-MM-DD "
                "lub DD.MM.RRRR."
            ),
        ),
        (
            "Badania lekarskie",
            (
                "Format RRRR-MM-DD "
                "lub DD.MM.RRRR."
            ),
        ),
        (
            "Telefon",
            "Pole opcjonalne.",
        ),
        (
            "Data zatrudnienia",
            (
                "Format RRRR-MM-DD "
                "lub DD.MM.RRRR."
            ),
        ),
    ]

    for (
        name,
        description,
    ) in instructions_rows:
        instructions.append(
            [
                name,
                description,
            ]
        )

    instructions.column_dimensions[
        "A"
    ].width = 30

    instructions.column_dimensions[
        "B"
    ].width = 80

    output = BytesIO()

    workbook.save(
        output
    )

    output.seek(0)

    return output