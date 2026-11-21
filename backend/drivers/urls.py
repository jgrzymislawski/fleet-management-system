from django.urls import (
    include,
    path,
)

from rest_framework.routers import (
    DefaultRouter,
)

from .bulk_views import (
    DriverBulkUpdateView,
)
from .import_views import (
    DriverImportTemplateView,
    DriverImportView,
)
from .views import (
    DriverVehicleAssignmentViewSet,
    DriverViewSet,
)


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
        "drivers/bulk-update/",
        DriverBulkUpdateView.as_view(),
        name="drivers-bulk-update",
    ),
    path(
        "",
        include(
            router.urls
        ),
    ),
]