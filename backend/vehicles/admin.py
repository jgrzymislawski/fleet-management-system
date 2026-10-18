from django.contrib import admin

from .models import Vehicle, ServiceRecord, VehicleDocument


admin.site.register(Vehicle)
admin.site.register(ServiceRecord)
admin.site.register(VehicleDocument)