from datetime import timedelta

from django.utils import timezone

from organizations.models import (
    OrganizationMembership,
    CompanyAccess,
)

from vehicles.models import (
    Vehicle,
    VehicleDocument,
)

from drivers.models import Driver


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
        .select_related("organization")
        .filter(user=user)
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
            organization=membership.organization
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
        organization=membership.organization,
        company_id__in=company_ids,
        company__is_active=True,
    )


def get_accessible_drivers(user):
    if user_is_superuser(user):
        return Driver.objects.all()

    membership = get_membership(user)

    if membership is None:
        return Driver.objects.none()

    if membership.role != "admin":
        return Driver.objects.none()

    return Driver.objects.filter(
        organization=membership.organization
    )


def get_alert_status(
    expiry_date,
    today,
):
    days_left = (
        expiry_date - today
    ).days

    if days_left < 0:
        days_after = abs(days_left)

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
            "status_code": "expired",
        }

    if days_left == 0:
        return {
            "days_left": 0,
            "days_text": "Wygasa dzisiaj",
            "status": "Wygasa dzisiaj",
            "status_code": "warning",
        }

    if days_left == 1:
        return {
            "days_left": 1,
            "days_text": "Wygasa za 1 dzień",
            "status": "Wygasa wkrótce",
            "status_code": "warning",
        }

    return {
        "days_left": days_left,
        "days_text": (
            f"Wygasa za {days_left} dni"
        ),
        "status": "Wygasa wkrótce",
        "status_code": "warning",
    }


def build_vehicle_alerts(
    vehicles,
    today,
    warning_limit,
):
    vehicle_list = list(vehicles)

    vehicle_ids = [
        vehicle.id
        for vehicle in vehicle_list
    ]

    alerts = []

    for vehicle in vehicle_list:
        vehicle_dates = [
            (
                "inspection",
                "Przegląd techniczny",
                vehicle.inspection_expiry_date,
            ),
            (
                "insurance",
                "Polisa OC",
                vehicle.insurance_expiry_date,
            ),
        ]

        for (
            alert_key,
            alert_type,
            expiry_date,
        ) in vehicle_dates:
            if not expiry_date:
                continue

            if expiry_date > warning_limit:
                continue

            status_data = get_alert_status(
                expiry_date,
                today,
            )

            alerts.append(
                {
                    "id": (
                        f"{alert_key}-"
                        f"{vehicle.id}"
                    ),
                    "category": "vehicle",
                    "target_id": vehicle.id,
                    "name": (
                        f"{vehicle.brand} "
                        f"{vehicle.model}"
                    ),
                    "secondary": (
                        vehicle.registration_number
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
                        status_data["status"]
                    ),
                    "status_code": (
                        status_data[
                            "status_code"
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
                        vehicle.branch or None
                    ),
                }
            )

    documents = (
        VehicleDocument.objects
        .filter(
            vehicle_id__in=vehicle_ids,
            expiry_date__isnull=False,
            expiry_date__lte=warning_limit,
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
        vehicle = document.vehicle

        status_data = get_alert_status(
            document.expiry_date,
            today,
        )

        alerts.append(
            {
                "id": (
                    f"document-{document.id}"
                ),
                "category": "vehicle",
                "target_id": vehicle.id,
                "name": (
                    f"{vehicle.brand} "
                    f"{vehicle.model}"
                ),
                "secondary": (
                    vehicle.registration_number
                ),
                "type": (
                    document
                    .get_document_type_display()
                ),
                "date": (
                    document.expiry_date
                ),
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
                    status_data["status"]
                ),
                "status_code": (
                    status_data[
                        "status_code"
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
                    vehicle.branch or None
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
        driver_dates = [
            (
                "driver-license",
                "Ważność prawa jazdy",
                driver.license_expiry_date,
            ),
            (
                "medical-exam",
                "Badania lekarskie",
                driver.medical_exam_expiry_date,
            ),
        ]

        for (
            alert_key,
            alert_type,
            expiry_date,
        ) in driver_dates:
            if not expiry_date:
                continue

            if expiry_date > warning_limit:
                continue

            status_data = get_alert_status(
                expiry_date,
                today,
            )

            alerts.append(
                {
                    "id": (
                        f"{alert_key}-"
                        f"{driver.id}"
                    ),
                    "category": "driver",
                    "target_id": driver.id,
                    "name": (
                        f"{driver.first_name} "
                        f"{driver.last_name}"
                    ),
                    "secondary": "Kierowca",
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
                        status_data["status"]
                    ),
                    "status_code": (
                        status_data[
                            "status_code"
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
            if alert["days_left"] < 0
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


def build_alerts(
    user,
    category="all",
    alert_status="all",
    company_id=None,
    branch="",
    vehicle_id=None,
):
    today = timezone.localdate()

    warning_limit = (
        today
        + timedelta(days=30)
    )

    vehicles = (
        get_accessible_vehicles(user)
        .select_related("company")
    )

    if company_id:
        vehicles = vehicles.filter(
            company_id=company_id
        )

    if branch:
        vehicles = vehicles.filter(
            branch=branch
        )

    if vehicle_id:
        vehicles = vehicles.filter(
            id=vehicle_id
        )

    vehicle_list = list(
        vehicles.order_by(
            "brand",
            "model",
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

    vehicle_filters_active = bool(
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
        and not vehicle_filters_active
    ):
        drivers = (
            get_accessible_drivers(
                user
            )
            .order_by(
                "last_name",
                "first_name",
            )
        )

        alerts.extend(
            build_driver_alerts(
                drivers,
                today,
                warning_limit,
            )
        )

    alerts = filter_alerts_by_status(
        alerts,
        alert_status,
    )

    alerts.sort(
        key=lambda alert: (
            alert["date"]
        )
    )

    return alerts