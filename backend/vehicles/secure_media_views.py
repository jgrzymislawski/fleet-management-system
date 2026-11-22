import mimetypes

from pathlib import Path

from django.http import FileResponse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import VehicleDocument
from .views import get_accessible_vehicles


class VehicleDocumentDownloadView(
    APIView
):
    permission_classes = [
        IsAuthenticated,
    ]

    def get(
        self,
        request,
        pk,
    ):
        accessible_vehicles = (
            get_accessible_vehicles(
                request.user
            )
        )

        document = (
            VehicleDocument.objects
            .filter(
                pk=pk,
                vehicle__in=(
                    accessible_vehicles
                ),
            )
            .select_related(
                "vehicle",
            )
            .first()
        )

        if document is None:
            return Response(
                {
                    "detail": (
                        "Nie znaleziono dokumentu "
                        "lub nie masz do niego dostępu."
                    )
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        if not document.file:
            return Response(
                {
                    "detail": (
                        "Ten dokument nie posiada "
                        "załącznika."
                    )
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        storage = (
            document.file.storage
        )

        file_name = (
            document.file.name
        )

        if not storage.exists(
            file_name
        ):
            return Response(
                {
                    "detail": (
                        "Plik dokumentu nie istnieje "
                        "na serwerze."
                    )
                },
                status=(
                    status.HTTP_404_NOT_FOUND
                ),
            )

        download_name = Path(
            file_name
        ).name

        content_type, _ = (
            mimetypes.guess_type(
                download_name
            )
        )

        file_handle = (
            document.file.open(
                "rb"
            )
        )

        response = FileResponse(
            file_handle,
            as_attachment=False,
            filename=download_name,
            content_type=(
                content_type
                or "application/octet-stream"
            ),
        )

        response[
            "X-Content-Type-Options"
        ] = "nosniff"

        response[
            "Cache-Control"
        ] = (
            "private, no-store, "
            "max-age=0"
        )

        return response