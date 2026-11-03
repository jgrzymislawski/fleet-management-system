import json
from datetime import timedelta

from auditlog.models import LogEntry

from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from organizations.models import OrganizationMembership


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
        .select_related("organization")
        .filter(user=user)
        .first()
    )


def get_actor_name(actor):
    if actor is None:
        return "System"

    full_name = (
        f"{actor.first_name or ''} "
        f"{actor.last_name or ''}"
    ).strip()

    if full_name:
        return full_name

    if getattr(actor, "email", None):
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
        model_name.replace("_", " ").title()
        or "Inny",
    )


def parse_changes(log_entry):
    changes = log_entry.changes

    if not changes:
        return []

    if isinstance(changes, str):
        try:
            changes = json.loads(changes)
        except json.JSONDecodeError:
            return []

    if not isinstance(changes, dict):
        return []

    parsed = []

    for field, values in changes.items():
        old_value = None
        new_value = None

        if (
            isinstance(values, (list, tuple))
            and len(values) >= 2
        ):
            old_value = values[0]
            new_value = values[1]

        parsed.append(
            {
                "field": field,
                "old": old_value,
                "new": new_value,
            }
        )

    return parsed


class OrganizationActivityView(APIView):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):
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
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            membership.role != "admin"
            and not request.user.is_superuser
        ):
            return Response(
                {
                    "detail": (
                        "Tylko administrator organizacji "
                        "ma dostęp do logu aktywności."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        organization = (
            membership.organization
        )

        organization_user_ids = list(
            OrganizationMembership.objects
            .filter(
                organization=organization
            )
            .values_list(
                "user_id",
                flat=True,
            )
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
                actor_id__in=(
                    organization_user_ids
                ),
                timestamp__gte=date_from,
            )
            .order_by(
                "-timestamp"
            )
        )

        action_filter = (
            request.query_params
            .get("action", "")
            .strip()
            .lower()
        )

        user_filter = (
            request.query_params
            .get("user", "")
            .strip()
        )

        model_filter = (
            request.query_params
            .get("model", "")
            .strip()
            .lower()
        )

        search = (
            request.query_params
            .get("search", "")
            .strip()
        )

        action_mapping = {
            "create": (
                LogEntry.Action.CREATE
            ),
            "update": (
                LogEntry.Action.UPDATE
            ),
            "delete": (
                LogEntry.Action.DELETE
            ),
            "access": (
                LogEntry.Action.ACCESS
            ),
        }

        if (
            action_filter
            in action_mapping
        ):
            queryset = (
                queryset.filter(
                    action=(
                        action_mapping[
                            action_filter
                        ]
                    )
                )
            )

        if user_filter:
            queryset = (
                queryset.filter(
                    actor_id=user_filter
                )
            )

        if model_filter:
            queryset = (
                queryset.filter(
                    content_type__model=(
                        model_filter
                    )
                )
            )

        if search:
            queryset = (
                queryset.filter(
                    object_repr__icontains=(
                        search
                    )
                )
            )

        logs = []

        for log_entry in queryset:
            actor = log_entry.actor

            logs.append(
                {
                    "id": log_entry.id,

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
                    },

                    "model": (
                        log_entry.content_type.model
                        if (
                            log_entry.content_type
                        )
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
            .select_related("user")
            .filter(
                organization=organization
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
                    "id": item.user_id,
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
                "date_from": date_from,
                "date_to": timezone.now(),
                "count": len(logs),
                "logs": logs,
                "users": users,
            },
            status=status.HTTP_200_OK,
        )