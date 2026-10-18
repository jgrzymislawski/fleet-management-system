from rest_framework import viewsets
from .models import Vehicle, ServiceRecord, VehicleDocument
from .serializers import VehicleSerializer, ServiceRecordSerializer, VehicleDocumentSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer


class ServiceRecordViewSet(viewsets.ModelViewSet):
    queryset = ServiceRecord.objects.all()
    serializer_class = ServiceRecordSerializer

    def get_queryset(self):
        queryset = ServiceRecord.objects.all()

        vehicle_id = self.request.query_params.get("vehicle")

        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)

        return queryset

class VehicleDocumentViewSet(viewsets.ModelViewSet):
    queryset = VehicleDocument.objects.all()
    serializer_class = VehicleDocumentSerializer

    def get_queryset(self):
        queryset = VehicleDocument.objects.all()

        vehicle_id = self.request.query_params.get("vehicle")

        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)

        return queryset