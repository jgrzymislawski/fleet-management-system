from django.urls import path

from .views import (
    AlertsListView,
)


urlpatterns = [
    path(
        "",
        AlertsListView.as_view(),
        name="alerts-list",
    ),
]