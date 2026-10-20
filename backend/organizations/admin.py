from django.contrib import admin

from .models import (
    Organization,
    Company,
    OrganizationMembership,
    CompanyAccess,
)

admin.site.register(Organization)
admin.site.register(Company)
admin.site.register(OrganizationMembership)
admin.site.register(CompanyAccess)