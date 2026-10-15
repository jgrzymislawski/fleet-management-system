from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VehicleViewSet, ServiceRecordViewSet

router = DefaultRouter()
router.register(r"vehicles", VehicleViewSet)
router.register(r"service-records", ServiceRecordViewSet)

urlpatterns = [
    path("", include(router.urls)),
]