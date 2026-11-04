from django.urls import (
    path,
    include,
)

from rest_framework.routers import (
    DefaultRouter,
)

from .views import (
    DriverViewSet,
    DriverVehicleAssignmentViewSet,
)

from .import_views import (
    DriverImportView,
    DriverImportTemplateView,
)
from .bulk_views import DriverBulkUpdateView

router = DefaultRouter()

router.register(
    "drivers",
    DriverViewSet,
    basename="drivers",
)

router.register(
    "driver-assignments",
    DriverVehicleAssignmentViewSet,
    basename="driver-assignments",
)


urlpatterns = [
    path(
        "drivers/import/",
        DriverImportView.as_view(),
        name="driver-import",
    ),

    path(
        "drivers/import-template/",
        DriverImportTemplateView.as_view(),
        name="driver-import-template",
    ),

    path(
        "",
        include(
            router.urls
        ),
    ),
path(
    "drivers/bulk-update/",
    DriverBulkUpdateView.as_view(),
    name="drivers-bulk-update",
),
]