from datetime import datetime
from io import BytesIO

from django.http import HttpResponse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import (
    OrganizationMembership,
    CompanyAccess,
)

from vehicles.models import (
    Vehicle,
    ServiceRecord,
)

from .export_utils import (
    create_service_costs_pdf,
    create_service_costs_workbook,
)


def user_is_superuser(user):
    return bool(
        getattr(
            user,
            "is_superuser",
            False,
        )
    )


def get_membership(user):
    if not getattr(
        user,
        "is_authenticated",
        False,
    ):
        return None

    return (
        OrganizationMembership.objects
        .select_related(
            "organization"
        )
        .filter(
            user=user
        )
        .first()
    )


def get_accessible_vehicles(user):
    if user_is_superuser(user):
        return Vehicle.objects.all()

    membership = get_membership(user)

    if membership is None:
        return Vehicle.objects.none()

    if membership.role == "admin":
        return Vehicle.objects.filter(
            organization=(
                membership.organization
            )
        )

    company_ids = (
        CompanyAccess.objects
        .filter(
            membership=membership,
            company__is_active=True,
        )
        .values_list(
            "company_id",
            flat=True,
        )
    )

    return Vehicle.objects.filter(
        organization=(
            membership.organization
        ),
        company_id__in=company_ids,
        company__is_active=True,
    )


def parse_date(value):
    if not value:
        return None

    try:
        return datetime.strptime(
            value,
            "%Y-%m-%d",
        ).date()

    except ValueError:
        return None


class ReportOptionsView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(self, request):
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
        IsAuthenticated
    ]

    def post(self, request):
        report_format = (
            request.data.get(
                "format",
                "pdf",
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
                    status.HTTP_400_BAD_REQUEST
                ),
            )

        date_from_raw = (
            request.data.get(
                "date_from"
            )
        )

        date_to_raw = (
            request.data.get(
                "date_to"
            )
        )

        date_from = parse_date(
            date_from_raw
        )

        date_to = parse_date(
            date_to_raw
        )

        if (
            date_from_raw
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
            date_to_raw
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
                        "Data początkowa nie może być późniejsza od końcowej."
                    )
                },
                status=(
                    status.HTTP_400_BAD_REQUEST
                ),
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

        vehicles = (
            get_accessible_vehicles(
                request.user
            )
            .select_related(
                "company"
            )
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
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

            vehicles = (
                vehicles.filter(
                    company_id=company_id
                )
            )

        if branch:
            vehicles = (
                vehicles.filter(
                    branch=branch
                )
            )

        selected_vehicle = None

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
                        status.HTTP_400_BAD_REQUEST
                    ),
                )

            vehicles = (
                vehicles.filter(
                    id=vehicle_id
                )
            )

        vehicle_list = list(
            vehicles.order_by(
                "brand",
                "model",
            )
        )

        if vehicle_id:
            if not vehicle_list:
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

            selected_vehicle = (
                vehicle_list[0]
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

        service_records = list(
            service_records.order_by(
                "-service_date",
                "-created_at",
            )
        )

        company_name = None

        if company_id:
            company = next(
                (
                    vehicle.company
                    for vehicle
                    in vehicle_list
                    if (
                        vehicle.company
                        and (
                            vehicle.company_id
                            == company_id
                        )
                    )
                ),
                None,
            )

            if company:
                company_name = (
                    company.name
                )

        vehicle_name = None

        if selected_vehicle:
            vehicle_name = (
                f"{selected_vehicle.brand} "
                f"{selected_vehicle.model} "
                f"({selected_vehicle.registration_number})"
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
            pdf = (
                create_service_costs_pdf(
                    service_records=(
                        service_records
                    ),
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
            'filename="flotivo-koszty-serwisowe.xlsx"'
        )

        return response