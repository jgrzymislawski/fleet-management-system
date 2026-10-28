from rest_framework.routers import DefaultRouter

from .views import (
    DriverViewSet,
    DriverVehicleAssignmentViewSet,
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

urlpatterns = router.urls