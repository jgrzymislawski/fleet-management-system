from datetime import datetime
from io import BytesIO

from django.http import HttpResponse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from vehicles.access import get_accessible_vehicles
from vehicles.models import ServiceRecord

from .export_utils import (
    create_service_costs_pdf,
    create_service_costs_workbook,
)


MAX_REPORT_RECORDS = 20000


def parse_date(value):
    if value in (
        None,
        "",
    ):
        return None

    if not isinstance(
        value,
        str,
    ):
        return None

    try:
        return datetime.strptime(
            value.strip(),
            "%Y-%m-%d",
        ).date()

    except ValueError:
        return None


def parse_positive_id(value):
    if value in (
        None,
        "",
    ):
        return None

    try:
        parsed_value = int(
            value
        )
    except (
        TypeError,
        ValueError,
    ):
        return None

    if parsed_value <= 0:
        return None

    return parsed_value


class ReportOptionsView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(
        self,
        request,
    ):
        vehicles = (
            get_accessible_vehicles(
                request.user
            )
            .select_related(
                "company"
            )
            .order_by(
                "brand",
                "model",
                "registration_number",
            )
        )

        companies_by_id = {}
        branches = set()
        vehicle_options = []

        for vehicle in vehicles:
            vehicle_options.append(
                {
                    "id": vehicle.id,
                    "name": (
                        f"{vehicle.brand} "
                        f"{vehicle.model}"
                    ),
                    "registration_number": (
                        vehicle.registration_number
                    ),
                    "company_id": (
                        vehicle.company_id
                    ),
                    "branch": (
                        vehicle.branch or ""
                    ),
                }
            )

            if vehicle.company:
                companies_by_id[
                    vehicle.company.id
                ] = (
                    vehicle.company.name
                )

            if vehicle.branch:
                branches.add(
                    vehicle.branch
                )

        companies = [
            {
                "id": company_id,
                "name": company_name,
            }
            for (
                company_id,
                company_name,
            )
            in sorted(
                companies_by_id.items(),
                key=lambda item: (
                    item[1].lower()
                ),
            )
        ]

        return Response(
            {
                "companies": companies,
                "branches": sorted(
                    branches,
                    key=str.lower,
                ),
                "vehicles": (
                    vehicle_options
                ),
            }
        )


class ServiceCostsReportView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def post(
        self,
        request,
    ):
        report_format = request.data.get(
            "format",
            "pdf",
        )

        if not isinstance(
            report_format,
            str,
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowy format raportu."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        report_format = (
            report_format
            .strip()
            .lower()
        )

        if report_format not in (
            "pdf",
            "xlsx",
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowy format raportu."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        date_from_raw = request.data.get(
            "date_from"
        )

        date_to_raw = request.data.get(
            "date_to"
        )

        date_from = parse_date(
            date_from_raw
        )

        date_to = parse_date(
            date_to_raw
        )

        if (
            date_from_raw not in (
                None,
                "",
            )
            and date_from is None
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowa data początkowa."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        if (
            date_to_raw not in (
                None,
                "",
            )
            and date_to is None
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowa data końcowa."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        if (
            date_from
            and date_to
            and date_from > date_to
        ):
            return Response(
                {
                    "detail": (
                        "Data początkowa nie może być "
                        "późniejsza od końcowej."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        company_id_raw = request.data.get(
            "company_id"
        )

        vehicle_id_raw = request.data.get(
            "vehicle_id"
        )

        branch = request.data.get(
            "branch",
            "",
        )

        if not isinstance(
            branch,
            str,
        ):
            return Response(
                {
                    "detail": (
                        "Oddział musi być tekstem."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        branch = branch.strip()

        if len(branch) > 120:
            return Response(
                {
                    "detail": (
                        "Nazwa oddziału jest zbyt długa."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        company_id = parse_positive_id(
            company_id_raw
        )

        if (
            company_id_raw not in (
                None,
                "",
            )
            and company_id is None
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowe ID spółki."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        vehicle_id = parse_positive_id(
            vehicle_id_raw
        )

        if (
            vehicle_id_raw not in (
                None,
                "",
            )
            and vehicle_id is None
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowe ID pojazdu."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        accessible_vehicles = (
            get_accessible_vehicles(
                request.user
            )
            .select_related(
                "company"
            )
        )

        selected_company = None

        if company_id is not None:
            selected_company = (
                accessible_vehicles
                .filter(
                    company_id=company_id
                )
                .exclude(
                    company__isnull=True
                )
                .values(
                    "company_id",
                    "company__name",
                )
                .first()
            )

            if selected_company is None:
                return Response(
                    {
                        "detail": (
                            "Nie znaleziono spółki "
                            "lub nie masz do niej dostępu."
                        )
                    },
                    status=(
                        status.HTTP_404_NOT_FOUND
                    ),
                )

        selected_vehicle = None

        if vehicle_id is not None:
            selected_vehicle = (
                accessible_vehicles
                .filter(
                    id=vehicle_id
                )
                .first()
            )

            if selected_vehicle is None:
                return Response(
                    {
                        "detail": (
                            "Nie znaleziono pojazdu "
                            "lub nie masz do niego dostępu."
                        )
                    },
                    status=(
                        status.HTTP_404_NOT_FOUND
                    ),
                )

            if (
                company_id is not None
                and selected_vehicle.company_id
                != company_id
            ):
                return Response(
                    {
                        "detail": (
                            "Wybrany pojazd nie należy "
                            "do wybranej spółki."
                        )
                    },
                    status=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

            if (
                branch
                and (
                    selected_vehicle.branch
                    or ""
                ) != branch
            ):
                return Response(
                    {
                        "detail": (
                            "Wybrany pojazd nie należy "
                            "do wybranego oddziału."
                        )
                    },
                    status=(
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

        vehicles = accessible_vehicles

        if company_id is not None:
            vehicles = vehicles.filter(
                company_id=company_id
            )

        if branch:
            vehicles = vehicles.filter(
                branch=branch
            )

        if vehicle_id is not None:
            vehicles = vehicles.filter(
                id=vehicle_id
            )

        vehicle_list = list(
            vehicles.order_by(
                "brand",
                "model",
                "registration_number",
            )
        )

        vehicle_ids = [
            vehicle.id
            for vehicle
            in vehicle_list
        ]

        service_records = (
            ServiceRecord.objects
            .filter(
                vehicle_id__in=(
                    vehicle_ids
                )
            )
            .select_related(
                "vehicle",
                "vehicle__company",
            )
            .order_by(
                "-service_date",
                "-created_at",
            )
        )

        if date_from:
            service_records = (
                service_records.filter(
                    service_date__gte=(
                        date_from
                    )
                )
            )

        if date_to:
            service_records = (
                service_records.filter(
                    service_date__lte=(
                        date_to
                    )
                )
            )

        if (
            service_records[
                MAX_REPORT_RECORDS:
                MAX_REPORT_RECORDS + 1
            ].exists()
        ):
            return Response(
                {
                    "detail": (
                        "Raport zawiera zbyt dużo wpisów. "
                        "Zawęź zakres dat lub wybierz "
                        "spółkę, oddział albo pojazd."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        service_records = list(
            service_records[
                :MAX_REPORT_RECORDS
            ]
        )

        company_name = None

        if selected_company:
            company_name = (
                selected_company[
                    "company__name"
                ]
            )

        vehicle_name = None

        if selected_vehicle:
            vehicle_name = (
                f"{selected_vehicle.brand} "
                f"{selected_vehicle.model} "
                "("
                f"{selected_vehicle.registration_number}"
                ")"
            )

        filters = {
            "date_from": (
                date_from.strftime(
                    "%d.%m.%Y"
                )
                if date_from
                else None
            ),
            "date_to": (
                date_to.strftime(
                    "%d.%m.%Y"
                )
                if date_to
                else None
            ),
            "company_name": (
                company_name
            ),
            "branch": (
                branch or None
            ),
            "vehicle_name": (
                vehicle_name
            ),
        }

        if report_format == "pdf":
            pdf = create_service_costs_pdf(
                service_records=(
                    service_records
                ),
                filters=filters,
            )

            response = HttpResponse(
                pdf.getvalue(),
                content_type=(
                    "application/pdf"
                ),
            )

            response[
                "Content-Disposition"
            ] = (
                'attachment; '
                'filename="flotivo-koszty-serwisowe.pdf"'
            )

            return response

        workbook = (
            create_service_costs_workbook(
                service_records=(
                    service_records
                ),
                filters=filters,
            )
        )

        output = BytesIO()

        workbook.save(
            output
        )

        output.seek(
            0
        )

        response = HttpResponse(
            output.getvalue(),
            content_type=(
                "application/"
                "vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            ),
        )

        response[
            "Content-Disposition"
        ] = (
            'attachment; '
            'filename="flotivo-koszty-serwisowe.xlsx"'
        )

        return response
