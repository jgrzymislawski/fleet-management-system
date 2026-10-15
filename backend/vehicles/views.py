from rest_framework import viewsets
from .models import Vehicle, ServiceRecord
from .serializers import VehicleSerializer, ServiceRecordSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer


class ServiceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceRecordSerializer

    def get_queryset(self):
        queryset = ServiceRecord.objects.all()

        vehicle_id = self.request.query_params.get("vehicle")

        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)

        return queryset