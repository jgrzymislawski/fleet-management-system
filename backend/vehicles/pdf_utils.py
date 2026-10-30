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
    PageBreak,
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
            "Nie znaleziono czcionki DejaVu Sans. "
            "Zainstaluj fonts-dejavu-core w obrazie backendu."
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


def format_money(value):
    if value is None:
        return "Nie podano"

    return f"{value:.2f} zł"


def format_mileage(value):
    if value is None:
        return "Nie podano"

    return f"{value:,}".replace(",", " ") + " km"


def get_driver_name(vehicle):
    if vehicle.driver:
        return (
            f"{vehicle.driver.first_name} "
            f"{vehicle.driver.last_name}"
        )

    if vehicle.driver_name:
        return vehicle.driver_name

    return "Brak przypisanego kierowcy"


def get_assignment_driver_name(assignment):
    if assignment.driver:
        return (
            f"{assignment.driver.first_name} "
            f"{assignment.driver.last_name}"
        )

    if assignment.driver_name:
        return assignment.driver_name

    return "Nieznany kierowca"


def create_vehicle_card_pdf(
    vehicle,
    service_records,
    documents,
    assignments,
):
    register_fonts()

    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=(
            f"Karta pojazdu - "
            f"{vehicle.registration_number}"
        ),
        author="Flotivo",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "TitleFlotivo",
        parent=styles["Title"],
        fontName="DejaVuSans-Bold",
        fontSize=20,
        leading=25,
        textColor=colors.HexColor("#1A1A1A"),
        spaceAfter=4 * mm,
    )

    subtitle_style = ParagraphStyle(
        "SubtitleFlotivo",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#666666"),
        spaceAfter=7 * mm,
    )

    section_style = ParagraphStyle(
        "SectionFlotivo",
        parent=styles["Heading2"],
        fontName="DejaVuSans-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#1A1A1A"),
        spaceBefore=5 * mm,
        spaceAfter=3 * mm,
    )

    normal_style = ParagraphStyle(
        "NormalFlotivo",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1A1A"),
    )

    small_style = ParagraphStyle(
        "SmallFlotivo",
        parent=normal_style,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#555555"),
    )

    footer_style = ParagraphStyle(
        "FooterFlotivo",
        parent=small_style,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#777777"),
    )

    story = []

    story.append(
        Paragraph(
            "KARTA POJAZDU",
            title_style,
        )
    )

    story.append(
        Paragraph(
            (
                f"{vehicle.brand} {vehicle.model} "
                f"- {vehicle.registration_number}"
            ),
            subtitle_style,
        )
    )

    story.append(
        Paragraph(
            "Dane pojazdu",
            section_style,
        )
    )

    vehicle_data = [
        [
            "Marka",
            vehicle.brand,
            "Model",
            vehicle.model,
        ],
        [
            "Numer rejestracyjny",
            vehicle.registration_number,
            "VIN",
            vehicle.vin or "Nie podano",
        ],
        [
            "Rok produkcji",
            str(vehicle.year),
            "Typ pojazdu",
            vehicle.get_vehicle_type_display(),
        ],
        [
            "Rodzaj paliwa",
            (
                vehicle.get_fuel_type_display()
                if vehicle.fuel_type
                else "Nie podano"
            ),
            "Przebieg",
            format_mileage(vehicle.mileage),
        ],
        [
            "Status",
            vehicle.get_status_display(),
            "Oddział",
            vehicle.branch or "Nie podano",
        ],
        [
            "Spółka",
            (
                vehicle.company.name
                if vehicle.company
                else "Bez przypisanej spółki"
            ),
            "Kierowca",
            get_driver_name(vehicle),
        ],
    ]

    vehicle_table = Table(
        vehicle_data,
        colWidths=[
            37 * mm,
            52 * mm,
            37 * mm,
            52 * mm,
        ],
    )

    vehicle_table.setStyle(
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
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8,
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
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
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

    story.append(vehicle_table)

    story.append(
        Paragraph(
            "Terminy",
            section_style,
        )
    )

    expiry_data = [
        [
            "Przegląd techniczny",
            format_date(
                vehicle.inspection_expiry_date
            ),
        ],
        [
            "Polisa OC",
            format_date(
                vehicle.insurance_expiry_date
            ),
        ],
    ]

    expiry_table = Table(
        expiry_data,
        colWidths=[
            65 * mm,
            65 * mm,
        ],
    )

    expiry_table.setStyle(
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
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    9,
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

    story.append(expiry_table)

    story.append(
        Paragraph(
            "Historia przypisań kierowców",
            section_style,
        )
    )

    if assignments:
        assignment_data = [
            [
                "Kierowca",
                "Od",
                "Do",
                "Uwagi",
            ]
        ]

        for assignment in assignments:
            assignment_data.append(
                [
                    get_assignment_driver_name(
                        assignment
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
                    assignment.notes or "",
                ]
            )

        assignment_table = Table(
            assignment_data,
            repeatRows=1,
            colWidths=[
                45 * mm,
                27 * mm,
                27 * mm,
                77 * mm,
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
                        "FONTSIZE",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.4,
                        colors.HexColor("#D8D1CA"),
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

        story.append(assignment_table)
    else:
        story.append(
            Paragraph(
                "Brak historii przypisań kierowców.",
                normal_style,
            )
        )

    story.append(
        Paragraph(
            "Historia napraw",
            section_style,
        )
    )

    if service_records:
        service_data = [
            [
                "Data",
                "Naprawa",
                "Przebieg",
                "Koszt",
            ]
        ]

        total_service_cost = 0

        for record in service_records:
            total_service_cost += record.cost

            title = record.title

            if record.description:
                title += (
                    f"<br/><font size='7'>"
                    f"{record.description}"
                    f"</font>"
                )

            service_data.append(
                [
                    format_date(
                        record.service_date
                    ),
                    Paragraph(
                        title,
                        small_style,
                    ),
                    format_mileage(
                        record.mileage
                    ),
                    format_money(
                        record.cost
                    ),
                ]
            )

        service_table = Table(
            service_data,
            repeatRows=1,
            colWidths=[
                27 * mm,
                91 * mm,
                32 * mm,
                28 * mm,
            ],
        )

        service_table.setStyle(
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
                        "FONTSIZE",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.4,
                        colors.HexColor("#D8D1CA"),
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

        story.append(service_table)

        story.append(
            Spacer(
                1,
                3 * mm,
            )
        )

        story.append(
            Paragraph(
                (
                    "<b>Łączny koszt napraw i serwisów:</b> "
                    f"{format_money(total_service_cost)}"
                ),
                normal_style,
            )
        )
    else:
        story.append(
            Paragraph(
                "Brak wpisów w historii napraw.",
                normal_style,
            )
        )

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "Dokumenty pojazdu",
            section_style,
        )
    )

    if documents:
        document_data = [
            [
                "Typ",
                "Numer",
                "Wystawiono",
                "Ważny do",
                "Koszt",
            ]
        ]

        for vehicle_document in documents:
            document_data.append(
                [
                    vehicle_document.get_document_type_display(),
                    (
                        vehicle_document.document_number
                        or "Brak"
                    ),
                    format_date(
                        vehicle_document.issue_date
                    ),
                    format_date(
                        vehicle_document.expiry_date
                    ),
                    (
                        format_money(
                            vehicle_document.cost
                        )
                        if vehicle_document.cost
                        is not None
                        else "Brak"
                    ),
                ]
            )

        documents_table = Table(
            document_data,
            repeatRows=1,
            colWidths=[
                42 * mm,
                45 * mm,
                31 * mm,
                31 * mm,
                29 * mm,
            ],
        )

        documents_table.setStyle(
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
                        "FONTSIZE",
                        (0, 0),
                        (-1, -1),
                        8,
                    ),
                    (
                        "GRID",
                        (0, 0),
                        (-1, -1),
                        0.4,
                        colors.HexColor("#D8D1CA"),
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

        story.append(documents_table)

        for vehicle_document in documents:
            if vehicle_document.notes:
                story.append(
                    Spacer(
                        1,
                        3 * mm,
                    )
                )

                story.append(
                    Paragraph(
                        (
                            "<b>"
                            f"{vehicle_document.get_document_type_display()}"
                            " - notatki:</b> "
                            f"{vehicle_document.notes}"
                        ),
                        small_style,
                    )
                )
    else:
        story.append(
            Paragraph(
                "Brak dokumentów dla tego pojazdu.",
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