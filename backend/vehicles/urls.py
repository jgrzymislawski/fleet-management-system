from django.urls import (
    include,
    path,
)

from rest_framework.routers import (
    DefaultRouter,
)

from .bulk_views import (
    VehicleBulkUpdateView,
)
from .import_views import (
    VehicleImportTemplateView,
    VehicleImportView,
)
from .secure_media_views import (
    VehicleDocumentDownloadView,
)
from .views import (
    ServiceRecordViewSet,
    VehicleDocumentViewSet,
    VehicleViewSet,
)


router = DefaultRouter()

router.register(
    "vehicles",
    VehicleViewSet,
    basename="vehicles",
)

router.register(
    "service-records",
    ServiceRecordViewSet,
    basename="service-records",
)

router.register(
    "vehicle-documents",
    VehicleDocumentViewSet,
    basename="vehicle-documents",
)


urlpatterns = [
    path(
        "vehicles/import/",
        VehicleImportView.as_view(),
        name="vehicle-import",
    ),
    path(
        "vehicles/import-template/",
        VehicleImportTemplateView.as_view(),
        name="vehicle-import-template",
    ),
    path(
        "vehicles/bulk-update/",
        VehicleBulkUpdateView.as_view(),
        name="vehicles-bulk-update",
    ),
    path(
        (
            "vehicle-documents/"
            "<int:pk>/download/"
        ),
        VehicleDocumentDownloadView.as_view(),
        name="vehicle-document-download",
    ),
    path(
        "",
        include(
            router.urls
        ),
    ),
]