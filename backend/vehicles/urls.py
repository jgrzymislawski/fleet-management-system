from django.urls import (
    path,
    include,
)

from rest_framework.routers import DefaultRouter

from .views import (
    VehicleViewSet,
    ServiceRecordViewSet,
    VehicleDocumentViewSet,
)

from .import_views import (
    VehicleImportView,
    VehicleImportTemplateView,
)

from .bulk_views import (
    VehicleBulkUpdateView,
)


router = DefaultRouter()

router.register(
    r"vehicles",
    VehicleViewSet,
)

router.register(
    r"service-records",
    ServiceRecordViewSet,
)

router.register(
    "vehicle-documents",
    VehicleDocumentViewSet,
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
        name="vehicle-bulk-update",
    ),

    path(
        "",
        include(
            router.urls
        ),
    ),
]