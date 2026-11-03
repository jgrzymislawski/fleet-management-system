from django.urls import path

from .views import (
    OrganizationActivityView,
)


urlpatterns = [
    path(
        "",
        OrganizationActivityView.as_view(),
        name="organization-activity",
    ),
]