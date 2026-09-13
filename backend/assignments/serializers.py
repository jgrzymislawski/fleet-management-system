from rest_framework import serializers
from .models import Assignment


class AssignmentSerializer(serializers.ModelSerializer):
    driver_display_name = serializers.ReadOnlyField()

    class Meta:
        model = Assignment
        fields = '__all__'

    def validate(self, data):
        driver = data.get('driver')
        driver_name = data.get('driver_name')

        if driver and driver_name:
            raise serializers.ValidationError(
                'Wybierz kierowcę z listy ALBO wpisz imię i nazwisko, nie oba naraz.'
            )
        if not driver and not driver_name:
            raise serializers.ValidationError(
                'Musisz wybrać kierowcę z listy albo wpisać imię i nazwisko.'
            )
        return data