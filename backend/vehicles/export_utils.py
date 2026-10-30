from openpyxl import Workbook
from openpyxl.styles import Alignment, Font


def get_driver_name(vehicle):
    if vehicle.driver:
        return (
            f"{vehicle.driver.first_name} "
            f"{vehicle.driver.last_name}"
        )

    if vehicle.driver_name:
        return vehicle.driver_name

    return "Brak"


def get_company_name(vehicle):
    if vehicle.company:
        return vehicle.company.name

    return "Brak"


def create_vehicle_workbook(vehicles):
    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Pojazdy"

    headers = [
        "Marka",
        "Model",
        "Numer rejestracyjny",
        "VIN",
        "Rok produkcji",
        "Typ pojazdu",
        "Rodzaj paliwa",
        "Przebieg [km]",
        "Status",
        "Spółka",
        "Oddział",
        "Kierowca",
        "Ważność przeglądu",
        "Ważność OC",
    ]

    worksheet.append(headers)

    for cell in worksheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    for vehicle in vehicles:
        worksheet.append([
            vehicle.brand,
            vehicle.model,
            vehicle.registration_number,
            vehicle.vin or "",
            vehicle.year,
            vehicle.get_vehicle_type_display(),
            (
                vehicle.get_fuel_type_display()
                if vehicle.fuel_type
                else ""
            ),
            vehicle.mileage,
            vehicle.get_status_display(),
            get_company_name(vehicle),
            vehicle.branch or "",
            get_driver_name(vehicle),
            vehicle.inspection_expiry_date,
            vehicle.insurance_expiry_date,
        ])

    column_widths = {
        "A": 18,
        "B": 18,
        "C": 20,
        "D": 22,
        "E": 16,
        "F": 24,
        "G": 18,
        "H": 16,
        "I": 18,
        "J": 25,
        "K": 22,
        "L": 25,
        "M": 20,
        "N": 20,
    }

    for column, width in column_widths.items():
        worksheet.column_dimensions[column].width = width

    worksheet.freeze_panes = "A2"

    worksheet.auto_filter.ref = worksheet.dimensions

    return workbook

def create_service_workbook(service_records):
    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Historia serwisowa"

    headers = [
        "Pojazd",
        "Numer rejestracyjny",
        "Data serwisu",
        "Tytuł",
        "Opis",
        "Przebieg [km]",
        "Koszt [zł]",
    ]

    worksheet.append(headers)

    for cell in worksheet[1]:
        cell.font = Font(bold=True)
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
        )

    for record in service_records:
        vehicle = record.vehicle

        worksheet.append([
            f"{vehicle.brand} {vehicle.model}",
            vehicle.registration_number,
            record.service_date,
            record.title,
            record.description or "",
            record.mileage,
            float(record.cost),
        ])

    column_widths = {
        "A": 25,
        "B": 20,
        "C": 18,
        "D": 28,
        "E": 50,
        "F": 18,
        "G": 16,
    }

    for column, width in column_widths.items():
        worksheet.column_dimensions[column].width = width

    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions

    return workbook