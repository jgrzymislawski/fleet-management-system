from django.http import HttpResponse
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from vehicles.models import ServiceRecord
from vehicles.statistics_pdf_utils import create_statistics_pdf
from vehicles.views import get_accessible_vehicles


MAX_VEHICLE_IDS = 5000
MAX_SERVICE_RECORDS = 20000


def parse_vehicle_ids(raw_ids):
    if not isinstance(raw_ids, list):
        raise ValueError("vehicle_ids musi być listą.")

    if len(raw_ids) > MAX_VEHICLE_IDS:
        raise ValueError(
            f"vehicle_ids może zawierać maksymalnie {MAX_VEHICLE_IDS} elementów."
        )

    parsed_ids = []

    try:
        for vehicle_id in raw_ids:
            parsed_id = int(vehicle_id)

            if parsed_id <= 0:
                raise ValueError

            parsed_ids.append(parsed_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("Lista zawiera nieprawidłowe ID.") from exc

    return list(dict.fromkeys(parsed_ids))


class StatisticsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            vehicle_ids = parse_vehicle_ids(
                request.data.get("vehicle_ids", [])
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = (
            get_accessible_vehicles(request.user)
            .select_related("company", "driver")
            .order_by("brand", "model")
        )

        if vehicle_ids:
            queryset = queryset.filter(id__in=vehicle_ids)

        vehicles = list(queryset)

        if vehicle_ids:
            accessible_ids = {vehicle.id for vehicle in vehicles}

            if accessible_ids != set(vehicle_ids):
                return Response(
                    {
                        "detail": (
                            "Nie znaleziono jednego z pojazdów "
                            "lub nie masz do niego dostępu."
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

        vehicle_ids_for_services = [
            vehicle.id
            for vehicle in vehicles
        ]

        service_records = list(
            ServiceRecord.objects
            .filter(vehicle_id__in=vehicle_ids_for_services)
            .select_related("vehicle")
            .order_by("-service_date", "-created_at")[:MAX_SERVICE_RECORDS + 1]
        )

        if len(service_records) > MAX_SERVICE_RECORDS:
            return Response(
                {
                    "detail": (
                        "Raport zawiera zbyt wiele wpisów serwisowych. "
                        "Zawęź zakres danych."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        pdf = create_statistics_pdf(
            vehicles=vehicles,
            service_records=service_records,
        )

        filename = (
            "flotivo-raport-statystyczny-"
            f"{timezone.localdate()}.pdf"
        )

        response = HttpResponse(
            pdf.getvalue(),
            content_type="application/pdf",
        )

        response["Content-Disposition"] = (
            f'attachment; filename="{filename}"'
        )

        return response