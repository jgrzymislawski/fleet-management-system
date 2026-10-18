from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VehicleViewSet, ServiceRecordViewSet, VehicleDocumentViewSet

router = DefaultRouter()
router.register(r"vehicles", VehicleViewSet)
router.register(r"service-records", ServiceRecordViewSet)
router.register("vehicle-documents", VehicleDocumentViewSet)

urlpatterns = [
    path("", include(router.urls)),
]