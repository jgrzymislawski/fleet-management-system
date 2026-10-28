from rest_framework import serializers

from .models import DriverVehicleAssignment


class DriverVehicleAssignmentSerializer(serializers.ModelSerializer):
    is_active = serializers.ReadOnlyField()
    driver_display_name = serializers.ReadOnlyField()

    vehicle_registration_number = serializers.CharField(
        source="vehicle.registration_number",
        read_only=True,
    )

    vehicle_name = serializers.SerializerMethodField()

    class Meta:
        model = DriverVehicleAssignment

        fields = [
            "id",
            "vehicle",
            "vehicle_name",
            "vehicle_registration_number",
            "driver",
            "driver_name",
            "driver_display_name",
            "start_date",
            "end_date",
            "is_active",
            "notes",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "is_active",
            "driver_display_name",
            "vehicle_name",
            "vehicle_registration_number",
        ]

    def get_vehicle_name(self, obj):
        return f"{obj.vehicle.brand} {obj.vehicle.model}"

    def validate(self, data):
        driver = data.get(
            "driver",
            getattr(self.instance, "driver", None),
        )

        driver_name = data.get(
            "driver_name",
            getattr(self.instance, "driver_name", ""),
        )

        vehicle = data.get(
            "vehicle",
            getattr(self.instance, "vehicle", None),
        )

        start_date = data.get(
            "start_date",
            getattr(self.instance, "start_date", None),
        )

        end_date = data.get(
            "end_date",
            getattr(self.instance, "end_date", None),
        )

        if driver and driver_name:
            raise serializers.ValidationError(
                {
                    "driver": (
                        "Wybierz kierowcę z listy albo "
                        "wpisz osobę ręcznie."
                    )
                }
            )

        if not driver and not driver_name:
            raise serializers.ValidationError(
                {
                    "driver": (
                        "Musisz wybrać kierowcę albo "
                        "wpisać osobę ręcznie."
                    )
                }
            )

        if (
            start_date
            and end_date
            and end_date < start_date
        ):
            raise serializers.ValidationError(
                {
                    "end_date": (
                        "Data zakończenia nie może być "
                        "wcześniejsza niż data rozpoczęcia."
                    )
                }
            )

        if driver and vehicle:
            if (
                driver.organization_id
                and vehicle.organization_id
                and driver.organization_id
                != vehicle.organization_id
            ):
                raise serializers.ValidationError(
                    {
                        "driver": (
                            "Kierowca i pojazd muszą należeć "
                            "do tej samej organizacji."
                        )
                    }
                )

        return data