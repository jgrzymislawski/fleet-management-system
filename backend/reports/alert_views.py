from datetime import timedelta
from io import BytesIO

from django.http import HttpResponse
from django.utils import timezone

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
    VehicleDocument,
)

from drivers.models import Driver

from .alerts_utils import (
    create_alerts_report_pdf,
    create_alerts_report_workbook,
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

    membership = get_membership(
        user
    )

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


def get_accessible_drivers(
    user,
):
    if user_is_superuser(user):
        return Driver.objects.all()

    membership = get_membership(
        user
    )

    if membership is None:
        return Driver.objects.none()

    # Zachowujemy tę samą zasadę,
    # co na obecnej stronie Alerts:
    # alerty kierowców widzi admin.
    if membership.role != "admin":
        return Driver.objects.none()

    return Driver.objects.filter(
        organization=(
            membership.organization
        )
    )


def get_document_type_name(
    document,
):
    try:
        return (
            document
            .get_document_type_display()
        )

    except Exception:
        return document.document_type


def get_alert_status(
    expiry_date,
    today,
):
    days_left = (
        expiry_date - today
    ).days

    if days_left < 0:
        days_after = abs(
            days_left
        )

        if days_after == 1:
            days_text = (
                "1 dzień po terminie"
            )
        else:
            days_text = (
                f"{days_after} dni po terminie"
            )

        return {
            "days_left": days_left,
            "days_text": days_text,
            "status": "Po terminie",
        }

    if days_left == 0:
        return {
            "days_left": 0,
            "days_text": (
                "Wygasa dzisiaj"
            ),
            "status": (
                "Wygasa dzisiaj"
            ),
        }

    if days_left == 1:
        return {
            "days_left": 1,
            "days_text": (
                "Wygasa za 1 dzień"
            ),
            "status": (
                "Wygasa wkrótce"
            ),
        }

    return {
        "days_left": days_left,
        "days_text": (
            f"Wygasa za {days_left} dni"
        ),
        "status": (
            "Wygasa wkrótce"
        ),
    }


def build_vehicle_alerts(
    vehicles,
    today,
    warning_limit,
):
    vehicle_list = list(
        vehicles
    )

    vehicle_ids = [
        vehicle.id
        for vehicle
        in vehicle_list
    ]

    alerts = []

    for vehicle in vehicle_list:
        dates = [
            (
                "Przegląd techniczny",
                vehicle
                .inspection_expiry_date,
            ),
            (
                "Polisa OC",
                vehicle
                .insurance_expiry_date,
            ),
        ]

        for (
            alert_type,
            expiry_date,
        ) in dates:
            if not expiry_date:
                continue

            if (
                expiry_date
                > warning_limit
            ):
                continue

            status_data = (
                get_alert_status(
                    expiry_date,
                    today,
                )
            )

            alerts.append(
                {
                    "category": "vehicle",
                    "target_id": (
                        vehicle.id
                    ),
                    "name": (
                        f"{vehicle.brand} "
                        f"{vehicle.model}"
                    ),
                    "secondary": (
                        vehicle
                        .registration_number
                    ),
                    "type": alert_type,
                    "date": expiry_date,
                    "days_left": (
                        status_data[
                            "days_left"
                        ]
                    ),
                    "days_text": (
                        status_data[
                            "days_text"
                        ]
                    ),
                    "status": (
                        status_data[
                            "status"
                        ]
                    ),
                    "company_id": (
                        vehicle.company_id
                    ),
                    "company_name": (
                        vehicle.company.name
                        if vehicle.company
                        else None
                    ),
                    "branch": (
                        vehicle.branch
                        or None
                    ),
                }
            )

    documents = (
        VehicleDocument.objects
        .filter(
            vehicle_id__in=(
                vehicle_ids
            ),
            expiry_date__isnull=False,
            expiry_date__lte=(
                warning_limit
            ),
        )
        .exclude(
            document_type__in=[
                "oc",
                "inspection",
            ]
        )
        .select_related(
            "vehicle",
            "vehicle__company",
        )
    )

    for document in documents:
        vehicle = (
            document.vehicle
        )

        expiry_date = (
            document.expiry_date
        )

        status_data = (
            get_alert_status(
                expiry_date,
                today,
            )
        )

        alerts.append(
            {
                "category": "vehicle",
                "target_id": (
                    vehicle.id
                ),
                "name": (
                    f"{vehicle.brand} "
                    f"{vehicle.model}"
                ),
                "secondary": (
                    vehicle
                    .registration_number
                ),
                "type": (
                    get_document_type_name(
                        document
                    )
                ),
                "date": expiry_date,
                "days_left": (
                    status_data[
                        "days_left"
                    ]
                ),
                "days_text": (
                    status_data[
                        "days_text"
                    ]
                ),
                "status": (
                    status_data[
                        "status"
                    ]
                ),
                "company_id": (
                    vehicle.company_id
                ),
                "company_name": (
                    vehicle.company.name
                    if vehicle.company
                    else None
                ),
                "branch": (
                    vehicle.branch
                    or None
                ),
            }
        )

    return alerts


def build_driver_alerts(
    drivers,
    today,
    warning_limit,
):
    alerts = []

    for driver in drivers:
        dates = [
            (
                "Ważność prawa jazdy",
                driver
                .license_expiry_date,
            ),
            (
                "Badania lekarskie",
                driver
                .medical_exam_expiry_date,
            ),
        ]

        for (
            alert_type,
            expiry_date,
        ) in dates:
            if not expiry_date:
                continue

            if (
                expiry_date
                > warning_limit
            ):
                continue

            status_data = (
                get_alert_status(
                    expiry_date,
                    today,
                )
            )

            alerts.append(
                {
                    "category": "driver",
                    "target_id": (
                        driver.id
                    ),
                    "name": (
                        f"{driver.first_name} "
                        f"{driver.last_name}"
                    ),
                    "secondary": (
                        "Kierowca"
                    ),
                    "type": alert_type,
                    "date": expiry_date,
                    "days_left": (
                        status_data[
                            "days_left"
                        ]
                    ),
                    "days_text": (
                        status_data[
                            "days_text"
                        ]
                    ),
                    "status": (
                        status_data[
                            "status"
                        ]
                    ),
                    "company_id": None,
                    "company_name": None,
                    "branch": None,
                }
            )

    return alerts


def filter_alerts_by_status(
    alerts,
    alert_status,
):
    if alert_status == "all":
        return alerts

    if alert_status == "expired":
        return [
            alert
            for alert in alerts
            if (
                alert["days_left"]
                < 0
            )
        ]

    if alert_status == "7_days":
        return [
            alert
            for alert in alerts
            if (
                0
                <= alert["days_left"]
                <= 7
            )
        ]

    if alert_status == "30_days":
        return [
            alert
            for alert in alerts
            if (
                0
                <= alert["days_left"]
                <= 30
            )
        ]

    return alerts


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

        vehicles = (
            get_accessible_vehicles(
                request.user
            )
            .select_related(
                "company"
            )
        )

        selected_company_name = None

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

            vehicles = (
                vehicles.filter(
                    company_id=(
                        company_id
                    )
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
                        status
                        .HTTP_400_BAD_REQUEST
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
                        status
                        .HTTP_404_NOT_FOUND
                    ),
                )

            selected_vehicle = (
                vehicle_list[0]
            )

        if company_id:
            company = next(
                (
                    vehicle.company
                    for vehicle
                    in vehicle_list
                    if (
                        vehicle.company_id
                        == company_id
                        and vehicle.company
                    )
                ),
                None,
            )

            if company:
                selected_company_name = (
                    company.name
                )

        today = (
            timezone.localdate()
        )

        warning_limit = (
            today
            + timedelta(
                days=30
            )
        )

        alerts = []

        if category in (
            "all",
            "vehicles",
        ):
            alerts.extend(
                build_vehicle_alerts(
                    vehicle_list,
                    today,
                    warning_limit,
                )
            )

        # Filtry spółki/oddziału/pojazdu
        # nie mają jednoznacznego znaczenia
        # dla kierowcy, bo Driver należy
        # do Organization, a nie Company.
        driver_filters_active = bool(
            company_id
            or branch
            or vehicle_id
        )

        if (
            category
            in (
                "all",
                "drivers",
            )
            and not driver_filters_active
        ):
            drivers = (
                get_accessible_drivers(
                    request.user
                )
            )

            alerts.extend(
                build_driver_alerts(
                    drivers,
                    today,
                    warning_limit,
                )
            )

        alerts = (
            filter_alerts_by_status(
                alerts,
                alert_status,
            )
        )

        alerts.sort(
            key=lambda alert: (
                alert["date"]
            )
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
                selected_company_name
            ),
            "branch": (
                branch
                or None
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
            'filename="flotivo-raport-alertow.xlsx"'
        )

        return response