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

        all_alerts = build_alerts(
            user=request.user,
            category="all",
        )

        vehicle_count = sum(
            1
            for alert in all_alerts
            if alert["category"] == "vehicle"
        )

        driver_count = sum(
            1
            for alert in all_alerts
            if alert["category"] == "driver"
        )

        if category == "vehicles":
            alerts = [
                alert
                for alert in all_alerts
                if (
                    alert["category"]
                    == "vehicle"
                )
            ]

        elif category == "drivers":
            alerts = [
                alert
                for alert in all_alerts
                if (
                    alert["category"]
                    == "driver"
                )
            ]

        else:
            alerts = all_alerts

        total_count = len(
            alerts
        )

        total_pages = max(
            1,
            (
                total_count
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

        page_alerts = alerts[
            start_index:end_index
        ]

        data = []

        for alert in page_alerts:
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

        return Response(
            {
                "count": (
                    total_count
                ),
                "total_count": (
                    len(all_alerts)
                ),
                "vehicle_count": (
                    vehicle_count
                ),
                "driver_count": (
                    driver_count
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
                "results": (
                    data
                ),
            }
        )