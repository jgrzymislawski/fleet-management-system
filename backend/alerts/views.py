from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import build_alerts


class AlertsListView(APIView):
    permission_classes = [
        IsAuthenticated
    ]

    def get(
        self,
        request,
    ):
        category = (
            request.query_params.get(
                "category",
                "all",
            )
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

        alerts = build_alerts(
            user=request.user,
            category=category,
        )

        data = []

        for alert in alerts:
            data.append(
                {
                    "id": alert["id"],
                    "category": (
                        alert["category"]
                    ),
                    "targetId": (
                        alert["target_id"]
                    ),
                    "name": (
                        alert["name"]
                    ),
                    "secondary": (
                        alert["secondary"]
                    ),
                    "type": (
                        alert["type"]
                    ),
                    "date": (
                        alert["date"]
                    ),
                    "daysLeft": (
                        alert["days_left"]
                    ),
                    "daysText": (
                        alert["days_text"]
                    ),
                    "status": {
                        "text": (
                            alert["status"]
                        ),
                        "className": (
                            (
                                "alert-status-expired"
                            )
                            if (
                                alert[
                                    "status_code"
                                ]
                                == "expired"
                            )
                            else (
                                "alert-status-warning"
                            )
                        ),
                    },
                    "company": (
                        alert[
                            "company_name"
                        ]
                    ),
                    "branch": (
                        alert["branch"]
                    ),
                }
            )

        return Response(data)