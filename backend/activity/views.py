import json
from datetime import timedelta

from auditlog.models import LogEntry

from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import (
    Organization,
    OrganizationMembership,
    Company,
    CompanyAccess,
)

from vehicles.models import (
    Vehicle,
    ServiceRecord,
    VehicleDocument,
)

from drivers.models import (
    Driver,
    DriverVehicleAssignment,
)


User = get_user_model()


ACTION_LABELS = {
    LogEntry.Action.CREATE: "Dodano",
    LogEntry.Action.UPDATE: "Zmieniono",
    LogEntry.Action.DELETE: "Usunięto",
    LogEntry.Action.ACCESS: "Wyświetlono",
}


MODEL_LABELS = {
    "vehicle": "Pojazd",
    "driver": "Kierowca",
    "servicerecord": "Wpis serwisowy",
    "vehicledocument": "Dokument pojazdu",
    "company": "Spółka",
    "organization": "Organizacja",
    "organizationmembership": "Użytkownik",
    "companyaccess": "Dostęp do spółki",
    "drivervehicleassignment": "Przypisanie kierowcy",
    "user": "Użytkownik",
}


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


def is_system_administrator(actor):
    if actor is None:
        return False

    return bool(
        getattr(
            actor,
            "is_superuser",
            False,
        )
    )


def get_actor_name(actor):
    if actor is None:
        return "System"

    if is_system_administrator(
        actor
    ):
        return "Administrator systemu"

    full_name = (
        f"{actor.first_name or ''} "
        f"{actor.last_name or ''}"
    ).strip()

    if full_name:
        return full_name

    if getattr(
        actor,
        "email",
        None,
    ):
        return actor.email

    return actor.get_username()


def get_model_label(log_entry):
    model_name = (
        log_entry.content_type.model
        if log_entry.content_type
        else ""
    )

    return MODEL_LABELS.get(
        model_name,
        model_name
        .replace("_", " ")
        .title()
        or "Inny",
    )


def get_changes_dict(log_entry):
    changes = log_entry.changes

    if not changes:
        return {}

    if isinstance(
        changes,
        str,
    ):
        try:
            changes = json.loads(
                changes
            )

        except json.JSONDecodeError:
            return {}

    if not isinstance(
        changes,
        dict,
    ):
        return {}

    return changes


def normalize_id(value):
    if value in (
        None,
        "",
        "None",
        "null",
    ):
        return None

    try:
        return int(value)

    except (
        TypeError,
        ValueError,
    ):
        return None


def get_company_name(value):
    company_id = normalize_id(
        value
    )

    if company_id is None:
        return "brak"

    company = (
        Company.objects
        .filter(
            id=company_id
        )
        .only(
            "name"
        )
        .first()
    )

    if company:
        return company.name

    return f"Spółka #{company_id}"


def parse_changes(log_entry):
    changes = get_changes_dict(
        log_entry
    )

    parsed = []

    for (
        field,
        values,
    ) in changes.items():
        old_value = None
        new_value = None

        if (
            isinstance(
                values,
                (list, tuple),
            )
            and len(values) >= 2
        ):
            old_value = values[0]
            new_value = values[1]

        if field == "company":
            old_value = get_company_name(
                old_value
            )

            new_value = get_company_name(
                new_value
            )

        parsed.append(
            {
                "field": field,
                "old": old_value,
                "new": new_value,
            }
        )

    return parsed


def get_changed_id(
    log_entry,
    field_name,
):
    changes = get_changes_dict(
        log_entry
    )

    values = changes.get(
        field_name
    )

    if not isinstance(
        values,
        (list, tuple),
    ):
        return None

    if len(values) < 2:
        return None

    old_value = normalize_id(
        values[0]
    )

    new_value = normalize_id(
        values[1]
    )

    if (
        log_entry.action
        == LogEntry.Action.DELETE
    ):
        return old_value

    return (
        new_value
        or old_value
    )


def log_belongs_to_organization(
    log_entry,
    organization,
):
    if not log_entry.content_type:
        return False

    app_label = (
        log_entry.content_type.app_label
    )

    model_name = (
        log_entry.content_type.model
    )

    object_id = normalize_id(
        log_entry.object_pk
    )

    organization_id = (
        organization.id
    )

    if (
        app_label == "organizations"
        and model_name == "organization"
    ):
        return (
            object_id
            == organization_id
        )

    if (
        app_label == "organizations"
        and model_name == "company"
    ):
        company = (
            Company.objects
            .filter(
                id=object_id
            )
            .only(
                "organization_id"
            )
            .first()
        )

        if company:
            return (
                company.organization_id
                == organization_id
            )

        changed_organization_id = (
            get_changed_id(
                log_entry,
                "organization",
            )
        )

        return (
            changed_organization_id
            == organization_id
        )

    if (
        app_label == "organizations"
        and model_name
        == "organizationmembership"
    ):
        membership = (
            OrganizationMembership.objects
            .filter(
                id=object_id
            )
            .only(
                "organization_id"
            )
            .first()
        )

        if membership:
            return (
                membership.organization_id
                == organization_id
            )

        changed_organization_id = (
            get_changed_id(
                log_entry,
                "organization",
            )
        )

        return (
            changed_organization_id
            == organization_id
        )

    if (
        app_label == "organizations"
        and model_name
        == "companyaccess"
    ):
        access = (
            CompanyAccess.objects
            .select_related(
                "membership"
            )
            .filter(
                id=object_id
            )
            .first()
        )

        if access:
            return (
                access
                .membership
                .organization_id
                == organization_id
            )

        membership_id = (
            get_changed_id(
                log_entry,
                "membership",
            )
        )

        if membership_id:
            return (
                OrganizationMembership.objects
                .filter(
                    id=membership_id,
                    organization_id=(
                        organization_id
                    ),
                )
                .exists()
            )

        return False

    if (
        app_label == "vehicles"
        and model_name == "vehicle"
    ):
        vehicle = (
            Vehicle.objects
            .filter(
                id=object_id
            )
            .only(
                "organization_id"
            )
            .first()
        )

        if vehicle:
            return (
                vehicle.organization_id
                == organization_id
            )

        changed_organization_id = (
            get_changed_id(
                log_entry,
                "organization",
            )
        )

        return (
            changed_organization_id
            == organization_id
        )

    if (
        app_label == "vehicles"
        and model_name
        == "servicerecord"
    ):
        service = (
            ServiceRecord.objects
            .select_related(
                "vehicle"
            )
            .filter(
                id=object_id
            )
            .first()
        )

        if service:
            return (
                service
                .vehicle
                .organization_id
                == organization_id
            )

        vehicle_id = (
            get_changed_id(
                log_entry,
                "vehicle",
            )
        )

        if vehicle_id:
            return (
                Vehicle.objects
                .filter(
                    id=vehicle_id,
                    organization_id=(
                        organization_id
                    ),
                )
                .exists()
            )

        return False

    if (
        app_label == "vehicles"
        and model_name
        == "vehicledocument"
    ):
        document = (
            VehicleDocument.objects
            .select_related(
                "vehicle"
            )
            .filter(
                id=object_id
            )
            .first()
        )

        if document:
            return (
                document
                .vehicle
                .organization_id
                == organization_id
            )

        vehicle_id = (
            get_changed_id(
                log_entry,
                "vehicle",
            )
        )

        if vehicle_id:
            return (
                Vehicle.objects
                .filter(
                    id=vehicle_id,
                    organization_id=(
                        organization_id
                    ),
                )
                .exists()
            )

        return False

    if (
        app_label == "drivers"
        and model_name == "driver"
    ):
        driver = (
            Driver.objects
            .filter(
                id=object_id
            )
            .only(
                "organization_id"
            )
            .first()
        )

        if driver:
            return (
                driver.organization_id
                == organization_id
            )

        changed_organization_id = (
            get_changed_id(
                log_entry,
                "organization",
            )
        )

        return (
            changed_organization_id
            == organization_id
        )

    if (
        app_label == "drivers"
        and model_name
        == "drivervehicleassignment"
    ):
        assignment = (
            DriverVehicleAssignment.objects
            .select_related(
                "vehicle",
                "driver",
            )
            .filter(
                id=object_id
            )
            .first()
        )

        if assignment:
            if (
                assignment.vehicle
                and assignment.vehicle.organization_id
                == organization_id
            ):
                return True

            if (
                assignment.driver
                and assignment.driver.organization_id
                == organization_id
            ):
                return True

            return False

        vehicle_id = (
            get_changed_id(
                log_entry,
                "vehicle",
            )
        )

        if (
            vehicle_id
            and Vehicle.objects
            .filter(
                id=vehicle_id,
                organization_id=(
                    organization_id
                ),
            )
            .exists()
        ):
            return True

        driver_id = (
            get_changed_id(
                log_entry,
                "driver",
            )
        )

        if (
            driver_id
            and Driver.objects
            .filter(
                id=driver_id,
                organization_id=(
                    organization_id
                ),
            )
            .exists()
        ):
            return True

        return False

    if model_name == "user":
        if not object_id:
            return False

        return (
            OrganizationMembership.objects
            .filter(
                user_id=object_id,
                organization_id=(
                    organization_id
                ),
            )
            .exists()
        )

    return False


class OrganizationActivityView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(
        self,
        request,
    ):
        membership = get_membership(
            request.user
        )

        if membership is None:
            return Response(
                {
                    "detail": (
                        "Użytkownik nie jest przypisany "
                        "do żadnej organizacji."
                    )
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        if membership.role != "admin":
            return Response(
                {
                    "detail": (
                        "Tylko administrator organizacji "
                        "ma dostęp do logu aktywności."
                    )
                },
                status=(
                    status.HTTP_403_FORBIDDEN
                ),
            )

        organization = (
            membership.organization
        )

        date_from = (
            timezone.now()
            - timedelta(days=30)
        )

        queryset = (
            LogEntry.objects
            .select_related(
                "actor",
                "content_type",
            )
            .filter(
                timestamp__gte=date_from
            )
            .order_by(
                "-timestamp"
            )
        )

        organization_logs = []

        for log_entry in queryset:
            if log_belongs_to_organization(
                log_entry,
                organization,
            ):
                organization_logs.append(
                    log_entry
                )

        total_count = len(
            organization_logs
        )

        model_options_map = {}

        for log_entry in organization_logs:
            if not log_entry.content_type:
                continue

            model_name = (
                log_entry
                .content_type
                .model
            )

            model_options_map[
                model_name
            ] = get_model_label(
                log_entry
            )

        model_options = [
            {
                "value": model,
                "label": label,
            }
            for model, label in sorted(
                model_options_map.items(),
                key=lambda item: (
                    item[1].casefold()
                ),
            )
        ]

        action_filter = (
            request.query_params
            .get(
                "action",
                "",
            )
            .strip()
            .lower()
        )

        user_filter = (
            request.query_params
            .get(
                "user",
                "",
            )
            .strip()
        )

        model_filter = (
            request.query_params
            .get(
                "model",
                "",
            )
            .strip()
            .lower()
        )

        search = (
            request.query_params
            .get(
                "search",
                "",
            )
            .strip()
            .lower()
        )

        action_mapping = {
            "0": LogEntry.Action.CREATE,
            "1": LogEntry.Action.UPDATE,
            "2": LogEntry.Action.DELETE,
            "3": LogEntry.Action.ACCESS,
            "create": LogEntry.Action.CREATE,
            "update": LogEntry.Action.UPDATE,
            "delete": LogEntry.Action.DELETE,
            "access": LogEntry.Action.ACCESS,
        }

        if action_filter in action_mapping:
            organization_logs = [
                log_entry
                for log_entry
                in organization_logs
                if (
                    log_entry.action
                    == action_mapping[
                        action_filter
                    ]
                )
            ]

        if user_filter:
            organization_logs = [
                log_entry
                for log_entry
                in organization_logs
                if (
                    str(
                        log_entry.actor_id
                    )
                    == user_filter
                )
            ]

        if model_filter:
            organization_logs = [
                log_entry
                for log_entry
                in organization_logs
                if (
                    log_entry.content_type
                    and
                    log_entry
                    .content_type
                    .model
                    == model_filter
                )
            ]

        if search:
            organization_logs = [
                log_entry
                for log_entry
                in organization_logs
                if (
                    search
                    in (
                        log_entry.object_repr
                        or ""
                    ).lower()
                    or search
                    in get_actor_name(
                        log_entry.actor
                    ).lower()
                    or search
                    in get_model_label(
                        log_entry
                    ).lower()
                    or search
                    in ACTION_LABELS.get(
                        log_entry.action,
                        "Inna akcja",
                    ).lower()
                )
            ]

        filtered_count = len(
            organization_logs
        )

        try:
            page = int(
                request.query_params.get(
                    "page",
                    1,
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            page = 1

        try:
            page_size = int(
                request.query_params.get(
                    "page_size",
                    20,
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            page_size = 20

        page = max(
            page,
            1,
        )

        page_size = min(
            max(
                page_size,
                1,
            ),
            100,
        )

        total_pages = max(
            1,
            (
                filtered_count
                + page_size
                - 1
            )
            // page_size,
        )

        if page > total_pages:
            page = total_pages

        start_index = (
            (page - 1)
            * page_size
        )

        end_index = (
            start_index
            + page_size
        )

        page_logs = (
            organization_logs[
                start_index:end_index
            ]
        )

        logs = []

        for log_entry in page_logs:
            actor = (
                log_entry.actor
            )

            logs.append(
                {
                    "id": (
                        log_entry.id
                    ),

                    "timestamp": (
                        log_entry.timestamp
                    ),

                    "action": (
                        log_entry.action
                    ),

                    "action_label": (
                        ACTION_LABELS.get(
                            log_entry.action,
                            "Inna akcja",
                        )
                    ),

                    "actor": {
                        "id": (
                            actor.id
                            if actor
                            else None
                        ),

                        "name": (
                            get_actor_name(
                                actor
                            )
                        ),

                        "is_system_admin": (
                            is_system_administrator(
                                actor
                            )
                        ),
                    },

                    "model": (
                        log_entry
                        .content_type
                        .model
                        if log_entry.content_type
                        else None
                    ),

                    "model_label": (
                        get_model_label(
                            log_entry
                        )
                    ),

                    "object_id": (
                        log_entry.object_pk
                    ),

                    "object_repr": (
                        log_entry.object_repr
                    ),

                    "changes": (
                        parse_changes(
                            log_entry
                        )
                    ),
                }
            )

        users = []

        memberships = (
            OrganizationMembership.objects
            .select_related(
                "user"
            )
            .filter(
                organization=(
                    organization
                )
            )
            .order_by(
                "user__first_name",
                "user__last_name",
                "user__username",
            )
        )

        for item in memberships:
            users.append(
                {
                    "id": (
                        item.user_id
                    ),

                    "name": (
                        get_actor_name(
                            item.user
                        )
                    ),
                }
            )

        return Response(
            {
                "period_days": 30,

                "date_from": (
                    date_from
                ),

                "date_to": (
                    timezone.now()
                ),

                "count": (
                    filtered_count
                ),

                "total_count": (
                    total_count
                ),

                "page": (
                    page
                ),

                "page_size": (
                    page_size
                ),

                "total_pages": (
                    total_pages
                ),

                "has_previous": (
                    page > 1
                ),

                "has_next": (
                    page < total_pages
                ),

                "logs": (
                    logs
                ),

                "users": (
                    users
                ),

                "model_options": (
                    model_options
                ),
            },
            status=(
                status.HTTP_200_OK
            ),
        )