from io import BytesIO

from django.http import HttpResponse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from alerts.services import (
    build_alerts,
    get_accessible_vehicles,
)

from .alerts_utils import (
    create_alerts_report_pdf,
    create_alerts_report_workbook,
)


class AlertsReportView(
    APIView
):
    permission_classes = [
        IsAuthenticated
    ]

    def post(
        self,
        request,
    ):
        report_format = (
            request.data.get(
                "format",
                "pdf",
            )
        )

        category = (
            request.data.get(
                "category",
                "all",
            )
        )

        alert_status = (
            request.data.get(
                "status",
                "all",
            )
        )

        company_id = (
            request.data.get(
                "company_id"
            )
        )

        branch = (
            request.data.get(
                "branch",
                "",
            )
        )

        vehicle_id = (
            request.data.get(
                "vehicle_id"
            )
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
                    status
                    .HTTP_400_BAD_REQUEST
                ),
            )

        if category not in (
            "all",
            "vehicles",
            "drivers",
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowa kategoria."
                    )
                },
                status=(
                    status
                    .HTTP_400_BAD_REQUEST
                ),
            )

        if alert_status not in (
            "all",
            "expired",
            "7_days",
            "30_days",
        ):
            return Response(
                {
                    "detail": (
                        "Nieprawidłowy filtr pilności."
                    )
                },
                status=(
                    status
                    .HTTP_400_BAD_REQUEST
                ),
            )

        if company_id:
            try:
                company_id = int(
                    company_id
                )

            except (
                TypeError,
                ValueError,
            ):
                return Response(
                    {
                        "detail": (
                            "Nieprawidłowe ID spółki."
                        )
                    },
                    status=(
                        status
                        .HTTP_400_BAD_REQUEST
                    ),
                )

        if vehicle_id:
            try:
                vehicle_id = int(
                    vehicle_id
                )

            except (
                TypeError,
                ValueError,
            ):
                return Response(
                    {
                        "detail": (
                            "Nieprawidłowe ID pojazdu."
                        )
                    },
                    status=(
                        status
                        .HTTP_400_BAD_REQUEST
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

        if company_id:
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

        selected_vehicle = None

        if vehicle_id:
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
                        status
                        .HTTP_404_NOT_FOUND
                    ),
                )

        alerts = build_alerts(
            user=request.user,
            category=category,
            alert_status=(
                alert_status
            ),
            company_id=(
                company_id
            ),
            branch=branch,
            vehicle_id=(
                vehicle_id
            ),
        )

        category_names = {
            "all": "Wszystkie",
            "vehicles": "Pojazdy",
            "drivers": "Kierowcy",
        }

        status_names = {
            "all": "Wszystkie",
            "expired": (
                "Po terminie"
            ),
            "7_days": (
                "Wygasa w ciągu 7 dni"
            ),
            "30_days": (
                "Wygasa w ciągu 30 dni"
            ),
        }

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
                f"("
                f"{selected_vehicle.registration_number}"
                f")"
            )

        filters = {
            "category_name": (
                category_names[
                    category
                ]
            ),
            "status_name": (
                status_names[
                    alert_status
                ]
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
            pdf = (
                create_alerts_report_pdf(
                    alerts=alerts,
                    filters=filters,
                )
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
                'filename="flotivo-raport-alertow.pdf"'
            )

            return response

        workbook = (
            create_alerts_report_workbook(
                alerts=alerts,
                filters=filters,
            )
        )

        output = BytesIO()

        workbook.save(output)

        output.seek(0)

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
            'filename="flotivo-raport-alertow.xlsx"'
        )

        return response