from io import BytesIO

from django.utils import timezone

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from .pdf_utils import register_fonts


def create_alerts_workbook(alerts):
    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Wymagają uwagi"

    headers = [
        "Kategoria",
        "Pojazd / kierowca",
        "Dodatkowe informacje",
        "Typ alertu",
        "Termin",
        "Status",
    ]

    worksheet.append(headers)

    for cell in worksheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    for alert in alerts:
        worksheet.append(
            [
                (
                    "Kierowca"
                    if alert["category"] == "driver"
                    else "Pojazd"
                ),
                alert["name"],
                alert["secondary"],
                alert["type"],
                alert["date"],
                alert["status"],
            ]
        )

    widths = {
        "A": 18,
        "B": 30,
        "C": 25,
        "D": 30,
        "E": 16,
        "F": 22,
    }

    for column, width in widths.items():
        worksheet.column_dimensions[column].width = width

    worksheet.freeze_panes = "A2"

    worksheet.auto_filter.ref = worksheet.dimensions

    return workbook


def create_alerts_pdf(alerts, filter_name):
    register_fonts()

    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Flotivo - wymagają uwagi",
        author="Flotivo",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "AlertsTitle",
        parent=styles["Title"],
        fontName="DejaVuSans-Bold",
        fontSize=20,
        leading=25,
        textColor=colors.HexColor("#1A1A1A"),
        spaceAfter=4 * mm,
    )

    subtitle_style = ParagraphStyle(
        "AlertsSubtitle",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#666666"),
        spaceAfter=7 * mm,
    )

    normal_style = ParagraphStyle(
        "AlertsNormal",
        parent=styles["Normal"],
        fontName="DejaVuSans",
        fontSize=9,
        leading=13,
    )

    story = []

    story.append(
        Paragraph(
            "FLOTIVO - WYMAGAJĄ UWAGI",
            title_style,
        )
    )

    generated_at = timezone.localtime(
        timezone.now()
    )

    story.append(
        Paragraph(
            (
                f"Kategoria: {filter_name}<br/>"
                f"Wygenerowano: "
                f"{generated_at.strftime('%d.%m.%Y %H:%M')}<br/>"
                f"Liczba alertów: {len(alerts)}"
            ),
            subtitle_style,
        )
    )

    if alerts:
        rows = [
            [
                "Kategoria",
                "Pojazd / kierowca",
                "Typ",
                "Termin",
                "Status",
            ]
        ]

        for alert in alerts:
            rows.append(
                [
                    (
                        "Kierowca"
                        if alert["category"] == "driver"
                        else "Pojazd"
                    ),
                    Paragraph(
                        (
                            f"<b>{alert['name']}</b><br/>"
                            f"{alert['secondary']}"
                        ),
                        normal_style,
                    ),
                    Paragraph(
                        alert["type"],
                        normal_style,
                    ),
                    alert["date"].strftime(
                        "%d.%m.%Y"
                    ),
                    alert["status"],
                ]
            )

        table = Table(
            rows,
            repeatRows=1,
            colWidths=[
                25 * mm,
                54 * mm,
                42 * mm,
                27 * mm,
                30 * mm,
            ],
        )

        table.setStyle(
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

        story.append(table)

    else:
        story.append(
            Paragraph(
                "Brak terminów wymagających uwagi.",
                normal_style,
            )
        )

    story.append(
        Spacer(
            1,
            10 * mm,
        )
    )

    story.append(
        Paragraph(
            (
                "Raport obejmuje terminy po terminie "
                "oraz wygasające w ciągu 30 dni."
            ),
            subtitle_style,
        )
    )

    document.build(story)

    output.seek(0)

    return output