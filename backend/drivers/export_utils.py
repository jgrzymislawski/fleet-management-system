from openpyxl import Workbook
from openpyxl.styles import Alignment, Font


def get_license_categories(driver):
    categories = driver.license_categories or []

    if not categories:
        return ""

    return ", ".join(categories)


def create_driver_workbook(drivers):
    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Kierowcy"

    headers = [
        "Imię",
        "Nazwisko",
        "Numer prawa jazdy",
        "Kategorie prawa jazdy",
        "Ważność prawa jazdy",
        "Ważność badań lekarskich",
        "Numer telefonu",
        "Data zatrudnienia",
    ]

    worksheet.append(headers)

    for cell in worksheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    for driver in drivers:
        worksheet.append([
            driver.first_name,
            driver.last_name,
            driver.license_number,
            get_license_categories(driver),
            driver.license_expiry_date,
            driver.medical_exam_expiry_date,
            driver.phone_number or "",
            driver.hired_at,
        ])

    column_widths = {
        "A": 18,
        "B": 22,
        "C": 24,
        "D": 24,
        "E": 22,
        "F": 25,
        "G": 20,
        "H": 18,
    }

    for column, width in column_widths.items():
        worksheet.column_dimensions[column].width = width

    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions

    return workbook