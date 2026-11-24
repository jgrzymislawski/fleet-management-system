from datetime import date
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace
from unittest import TestCase

from openpyxl import Workbook, load_workbook

from config.spreadsheet_security import (
    sanitize_spreadsheet_value,
    sanitize_workbook,
)
from drivers.export_utils import create_driver_workbook
from reports.alerts_utils import create_alerts_report_workbook
from reports.export_utils import create_service_costs_workbook
from vehicles.alerts_export_utils import create_alerts_workbook
from vehicles.export_utils import (
    create_service_workbook,
    create_vehicle_workbook,
)


class SpreadsheetSecurityTests(TestCase):
    def assert_no_formulas(self, workbook):
        for sheet in workbook.worksheets:
            for row in sheet.iter_rows():
                for cell in row:
                    self.assertNotEqual(
                        cell.data_type, "f",
                        f"Formula w {sheet.title}!{cell.coordinate}",
                    )

    def assert_safe_after_save(self, workbook):
        self.assert_no_formulas(workbook)
        output = BytesIO()
        workbook.save(output)
        output.seek(0)
        reopened = load_workbook(output)
        self.assert_no_formulas(reopened)
        return reopened

    def test_plain_text_and_numeric_values(self):
        values = [
            "=1+1", "+CMD", "-HYPERLINK()", "@SUM(A1:A2)",
            "  =2+2", "\t=3+3", "\r=4+4", "\n=5+5",
            "\ufeff=6+6", "\u200b=7+7",
        ]
        for value in values:
            with self.subTest(value=value):
                self.assertEqual(
                    sanitize_spreadsheet_value(value), "'" + value
                )
        for value in ["Ford", "1234", "' =1+1", -50, 3.5,
                      Decimal("17.10"), date(2026, 11, 23), None]:
            with self.subTest(value=value):
                self.assertEqual(sanitize_spreadsheet_value(value), value)

    def test_workbook_filter_without_changing_numbers_and_dates(self):
        book = Workbook()
        sheet = book.active
        sample_date = date(2026, 11, 23)
        sheet.append(["=1+1", "  @SUM(A1:A2)", -25, sample_date, "Ford"])
        book = sanitize_workbook(book)
        reopened = self.assert_safe_after_save(book)
        self.assertEqual(reopened.active["A1"].value, "'=1+1")
        self.assertEqual(reopened.active["B1"].value, "'  @SUM(A1:A2)")
        self.assertEqual(reopened.active["C1"].value, -25)
        self.assertEqual(reopened.active["D1"].value.date(), sample_date)
        self.assertEqual(reopened.active["E1"].value, "Ford")

    def test_all_six_export_builders(self):
        vehicle = SimpleNamespace(
            brand="=1+1", model="Focus", registration_number="+ABC",
            vin="VIN123", year=2020, vehicle_type="passenger",
            get_vehicle_type_display=lambda: "Osobowy",
            fuel_type="petrol", get_fuel_type_display=lambda: "Benzyna",
            mileage=1200, get_status_display=lambda: "Aktywny",
            company=SimpleNamespace(name="@Spolka"),
            branch="  =oddzial", driver=None, driver_name="-Kierowca",
            inspection_expiry_date=date(2027, 1, 1),
            insurance_expiry_date=date(2027, 1, 2),
        )
        record = SimpleNamespace(
            vehicle=vehicle, service_date=date(2026, 11, 23),
            title="=1+1", description="@Opis", mileage=2000,
            cost=Decimal("99.50"),
        )
        driver = SimpleNamespace(
            first_name="=1+1", last_name="Kowalski",
            license_number="@123", license_categories=["B"],
            license_expiry_date=date(2027, 1, 1),
            medical_exam_expiry_date=date(2027, 2, 1),
            phone_number="+48123456789", hired_at=date(2026, 1, 1),
        )
        alert = {
            "category": "vehicle", "name": "=1+1",
            "secondary": "@Opis", "type": "+Badanie",
            "date": date(2026, 11, 23), "status": "-Status",
            "days_left": -1, "days_text": "-1",
            "company_name": "@Spolka", "branch": " =Oddzial",
        }
        filters = {
            "date_from": "=2026", "company_name": "=Firma",
            "branch": "@Oddzial", "vehicle_name": "+Pojazd",
            "category_name": "=Wszystkie", "status_name": "@Pilne",
        }

        cases = [
            ("pojazdy", create_vehicle_workbook([vehicle]), "Pojazdy", "A2"),
            ("serwisy", create_service_workbook([record]), "Historia serwisowa", "D2"),
            ("alerty", create_alerts_workbook([alert]), "Wymagają uwagi", "B2"),
            ("kierowcy", create_driver_workbook([driver]), "Kierowcy", "A2"),
            ("raport serwisowy", create_service_costs_workbook([record], filters),
             "Historia serwisowa", "F2"),
            ("raport alertow", create_alerts_report_workbook([alert], filters),
             "Alerty", "B2"),
        ]
        for name, workbook, sheet, coord in cases:
            with self.subTest(export=name):
                result = self.assert_safe_after_save(workbook)
                self.assertTrue(result[sheet][coord].value.startswith("'"))
