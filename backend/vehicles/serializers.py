from rest_framework import serializers
from .models import Vehicle, ServiceRecord


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'

    def validate(self, attrs):
        driver = attrs.get('driver')
        driver_name = attrs.get('driver_name')

        if driver and driver_name:
            raise serializers.ValidationError(
                'Wybierz kierowcę z listy albo wpisz kierowcę ręcznie, nie można użyć obu opcji jednocześnie.'
            )

        return attrs

class ServiceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRecord
        fields = "__all__"