from io import BytesIO
from pathlib import Path

from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]

FONT_BOLD_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]


def find_font(paths):
    for path in paths:
        if Path(path).exists():
            return path

    return None


def register_fonts():
    regular_font = find_font(FONT_PATHS)
    bold_font = find_font(FONT_BOLD_PATHS)

    if not regular_font or not bold_font:
        raise RuntimeError(
            "Nie znaleziono czcionki DejaVu Sans."
        )

    if "DejaVuSans" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(
            TTFont(
                "DejaVuSans",
                regular_font,
            )
        )

    if "DejaVuSans-Bold" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(
            TTFont(
                "DejaVuSans-Bold",
                bold_font,
            )
        )


def format_date(value):
    if not value:
        return "Nie podano"

    return value.strftime("%d.%m.%Y")


def get_categories(driver):
    categories = driver.license_categories or []

    if not categories:
        return "Nie podano"

    return ", ".join(categories)


def get_vehicle_name(assignment):
    vehicle = assignment.vehicle

    return (
        f"{vehicle.brand} {vehicle.model}"
    )


def create_driver_card_pdf(
    driver,
    assignments,
):
    register_fonts()

    assignments = list(assignments)

    active_assignments = [
        assignment
        for assignment in assignments
        if assignment.is_active
    ]

    historical_assignments = [
        assignment
        for assignment in assignments
        if not assignment.is_active
    ]

    unique_vehicle_ids = {
        assignment.vehicle_id
        for assignment in assignments
    }

    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=(
            "Karta kierowcy - "
            f"{driver.first_name} {driver.last_name}"
        ),
        author="Flotivo",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DriverTitle",
        parent=styles["Title"],
        fontName="DejaVuSans-Bold",
        fontSize=20,
        leading=25,
        textColor=colors.HexColor("#1A1A1A"),
        spaceAfter=4 * mm,
    )

    subtitle_style = ParagraphStyle(
        "DriverSubtitle",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#666666"),
        spaceAfter=7 * mm,
    )

    section_style = ParagraphStyle(
        "DriverSection",
        parent=styles["Heading2"],
        fontName="DejaVuSans-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#1A1A1A"),
        spaceBefore=5 * mm,
        spaceAfter=3 * mm,
    )

    normal_style = ParagraphStyle(
        "DriverNormal",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1A1A"),
    )

    footer_style = ParagraphStyle(
        "DriverFooter",
        parent=normal_style,
        alignment=TA_CENTER,
        fontSize=8,
        textColor=colors.HexColor("#777777"),
    )

    story = []

    story.append(
        Paragraph(
            "KARTA KIEROWCY",
            title_style,
        )
    )

    story.append(
        Paragraph(
            f"{driver.first_name} {driver.last_name}",
            subtitle_style,
        )
    )

    story.append(
        Paragraph(
            "Dane kierowcy",
            section_style,
        )
    )

    driver_data = [
        [
            "Imię",
            driver.first_name,
            "Nazwisko",
            driver.last_name,
        ],
        [
            "Numer telefonu",
            driver.phone_number or "Nie podano",
            "Data zatrudnienia",
            format_date(driver.hired_at),
        ],
        [
            "Numer prawa jazdy",
            driver.license_number,
            "Kategorie",
            get_categories(driver),
        ],
        [
            "Prawo jazdy ważne do",
            format_date(
                driver.license_expiry_date
            ),
            "Badania ważne do",
            format_date(
                driver.medical_exam_expiry_date
            ),
        ],
    ]

    driver_table = Table(
        driver_data,
        colWidths=[
            38 * mm,
            50 * mm,
            38 * mm,
            50 * mm,
        ],
    )

    driver_table.setStyle(
        TableStyle(
            [
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, -1),
                    "DejaVuSans",
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "DejaVuSans-Bold",
                ),
                (
                    "FONTNAME",
                    (2, 0),
                    (2, -1),
                    "DejaVuSans-Bold",
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (0, -1),
                    colors.HexColor("#EEE8E2"),
                ),
                (
                    "BACKGROUND",
                    (2, 0),
                    (2, -1),
                    colors.HexColor("#EEE8E2"),
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.HexColor("#D8D1CA"),
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
            ]
        )
    )

    story.append(driver_table)

    story.append(
        Paragraph(
            "Podsumowanie",
            section_style,
        )
    )

    stats_data = [
        [
            "Aktualnie przypisane pojazdy",
            str(len(active_assignments)),
        ],
        [
            "Pojazdy w historii",
            str(len(unique_vehicle_ids)),
        ],
        [
            "Zakończone przypisania",
            str(len(historical_assignments)),
        ],
    ]

    stats_table = Table(
        stats_data,
        colWidths=[
            95 * mm,
            40 * mm,
        ],
    )

    stats_table.setStyle(
        TableStyle(
            [
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, -1),
                    "DejaVuSans",
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "DejaVuSans-Bold",
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (0, -1),
                    colors.HexColor("#EEE8E2"),
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.HexColor("#D8D1CA"),
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    9,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
            ]
        )
    )

    story.append(stats_table)

    story.append(
        Paragraph(
            "Aktualnie przypisane pojazdy",
            section_style,
        )
    )

    if active_assignments:
        active_rows = [
            [
                "Pojazd",
                "Numer rejestracyjny",
                "Od",
            ]
        ]

        for assignment in active_assignments:
            active_rows.append(
                [
                    get_vehicle_name(
                        assignment
                    ),
                    (
                        assignment.vehicle
                        .registration_number
                    ),
                    format_date(
                        assignment.start_date
                    ),
                ]
            )

        active_table = Table(
            active_rows,
            repeatRows=1,
            colWidths=[
                70 * mm,
                58 * mm,
                48 * mm,
            ],
        )

        active_table.setStyle(
            TableStyle(
                [
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, -1),
                        "DejaVuSans",
                    ),
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, 0),
                        "DejaVuSans-Bold",
                    ),
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.HexColor("#EEE8E2"),
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.4,
                        colors.HexColor("#D8D1CA"),
                    ),
                    (
                        "FONTSIZE",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        6,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        6,
                    ),
                ]
            )
        )

        story.append(active_table)

    else:
        story.append(
            Paragraph(
                "Kierowca nie ma aktualnie przypisanego pojazdu.",
                normal_style,
            )
        )

    story.append(
        Paragraph(
            "Historia pojazdów",
            section_style,
        )
    )

    if assignments:
        assignment_rows = [
            [
                "Pojazd",
                "Rejestracja",
                "Od",
                "Do",
                "Uwagi",
            ]
        ]

        for assignment in assignments:
            assignment_rows.append(
                [
                    get_vehicle_name(
                        assignment
                    ),
                    (
                        assignment.vehicle
                        .registration_number
                    ),
                    format_date(
                        assignment.start_date
                    ),
                    (
                        format_date(
                            assignment.end_date
                        )
                        if assignment.end_date
                        else "Obecnie"
                    ),
                    Paragraph(
                        assignment.notes or "",
                        normal_style,
                    ),
                ]
            )

        assignment_table = Table(
            assignment_rows,
            repeatRows=1,
            colWidths=[
                42 * mm,
                34 * mm,
                26 * mm,
                26 * mm,
                48 * mm,
            ],
        )

        assignment_table.setStyle(
            TableStyle(
                [
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, -1),
                        "DejaVuSans",
                    ),
                    (
                        "FONTNAME",
                        (0, 0),
                        (-1, 0),
                        "DejaVuSans-Bold",
                    ),
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, 0),
                        colors.HexColor("#EEE8E2"),
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.4,
                        colors.HexColor("#D8D1CA"),
                    ),
                    (
                        "FONTSIZE",
                        (0, 0),
                        (-1, -1),
                        7,
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "TOP",
                    ),
                    (
                        "TOPPADDING",
                        (0, 0),
                        (-1, -1),
                        6,
                    ),
                    (
                        "BOTTOMPADDING",
                        (0, 0),
                        (-1, -1),
                        6,
                    ),
                ]
            )
        )

        story.append(
            assignment_table
        )

    else:
        story.append(
            Paragraph(
                "Brak historii przypisań pojazdów.",
                normal_style,
            )
        )

    story.append(
        Spacer(
            1,
            12 * mm,
        )
    )

    generated_at = timezone.localtime(
        timezone.now()
    )

    story.append(
        Paragraph(
            (
                "Raport wygenerowano w systemie Flotivo: "
                f"{generated_at.strftime('%d.%m.%Y %H:%M')}"
            ),
            footer_style,
        )
    )

    document.build(story)

    output.seek(0)

    return output