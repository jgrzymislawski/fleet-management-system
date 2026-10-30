from io import BytesIO
from decimal import Decimal
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


def format_money(value):
    value = Decimal(value or 0)

    formatted = f"{value:,.2f}".replace(",", " ")

    return f"{formatted} zł"


def format_date(value):
    if not value:
        return "Nie podano"

    return value.strftime("%d.%m.%Y")


def create_statistics_pdf(
    vehicles,
    service_records,
):
    register_fonts()

    vehicles = list(vehicles)
    service_records = list(service_records)

    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Flotivo - raport statystyczny",
        author="Flotivo",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "StatisticsTitle",
        parent=styles["Title"],
        fontName="DejaVuSans-Bold",
        fontSize=20,
        leading=25,
        textColor=colors.HexColor("#1A1A1A"),
        spaceAfter=4 * mm,
    )

    subtitle_style = ParagraphStyle(
        "StatisticsSubtitle",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#666666"),
        spaceAfter=7 * mm,
    )

    section_style = ParagraphStyle(
        "StatisticsSection",
        parent=styles["Heading2"],
        fontName="DejaVuSans-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#1A1A1A"),
        spaceBefore=5 * mm,
        spaceAfter=3 * mm,
    )

    normal_style = ParagraphStyle(
        "StatisticsNormal",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1A1A1A"),
    )

    footer_style = ParagraphStyle(
        "StatisticsFooter",
        parent=normal_style,
        alignment=TA_CENTER,
        fontSize=8,
        textColor=colors.HexColor("#777777"),
    )

    story = []

    total_cost = sum(
        (
            record.cost
            for record in service_records
        ),
        Decimal("0"),
    )

    record_count = len(service_records)

    average_cost = (
        total_cost / record_count
        if record_count
        else Decimal("0")
    )

    most_expensive = (
        max(
            service_records,
            key=lambda record: record.cost,
        )
        if service_records
        else None
    )

    story.append(
        Paragraph(
            "FLOTIVO - RAPORT STATYSTYCZNY",
            title_style,
        )
    )

    generated_at = timezone.localtime(
        timezone.now()
    )

    story.append(
        Paragraph(
            (
                "Raport floty wygenerowany "
                f"{generated_at.strftime('%d.%m.%Y %H:%M')}"
            ),
            subtitle_style,
        )
    )

    story.append(
        Paragraph(
            "Podsumowanie",
            section_style,
        )
    )

    summary_data = [
        [
            "Liczba pojazdów",
            str(len(vehicles)),
        ],
        [
            "Liczba napraw / serwisów",
            str(record_count),
        ],
        [
            "Łączny koszt serwisów",
            format_money(total_cost),
        ],
        [
            "Średni koszt serwisu",
            format_money(average_cost),
        ],
    ]

    if most_expensive:
        summary_data.append(
            [
                "Najdroższa naprawa",
                (
                    f"{most_expensive.title} - "
                    f"{format_money(most_expensive.cost)}"
                ),
            ]
        )
    else:
        summary_data.append(
            [
                "Najdroższa naprawa",
                "Brak danych",
            ]
        )

    summary_table = Table(
        summary_data,
        colWidths=[
            70 * mm,
            105 * mm,
        ],
    )

    summary_table.setStyle(
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

    story.append(summary_table)

    story.append(
        Paragraph(
            "Statystyki według pojazdów",
            section_style,
        )
    )

    vehicle_rows = [
        [
            "Pojazd",
            "Rejestracja",
            "Liczba napraw",
            "Łączny koszt",
        ]
    ]

    for vehicle in vehicles:
        vehicle_records = [
            record
            for record in service_records
            if record.vehicle_id == vehicle.id
        ]

        vehicle_cost = sum(
            (
                record.cost
                for record in vehicle_records
            ),
            Decimal("0"),
        )

        vehicle_rows.append(
            [
                f"{vehicle.brand} {vehicle.model}",
                vehicle.registration_number,
                str(len(vehicle_records)),
                format_money(vehicle_cost),
            ]
        )

    vehicle_table = Table(
        vehicle_rows,
        repeatRows=1,
        colWidths=[
            62 * mm,
            40 * mm,
            35 * mm,
            40 * mm,
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

    story.append(vehicle_table)

    story.append(
        Paragraph(
            "Historia napraw uwzględniona w raporcie",
            section_style,
        )
    )

    if service_records:
        repair_rows = [
            [
                "Pojazd",
                "Naprawa",
                "Data",
                "Koszt",
            ]
        ]

        for record in service_records:
            repair_rows.append(
                [
                    (
                        f"{record.vehicle.brand} "
                        f"{record.vehicle.model}"
                    ),
                    record.title,
                    format_date(
                        record.service_date
                    ),
                    format_money(
                        record.cost
                    ),
                ]
            )

        repair_table = Table(
            repair_rows,
            repeatRows=1,
            colWidths=[
                55 * mm,
                67 * mm,
                28 * mm,
                28 * mm,
            ],
        )

        repair_table.setStyle(
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

        story.append(repair_table)

    else:
        story.append(
            Paragraph(
                "Brak historii napraw dla wybranych pojazdów.",
                normal_style,
            )
        )

    story.append(
        Spacer(
            1,
            12 * mm,
        )
    )

    story.append(
        Paragraph(
            "Raport wygenerowano w systemie Flotivo.",
            footer_style,
        )
    )

    document.build(story)

    output.seek(0)

    return output