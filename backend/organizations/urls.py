from django.urls import path
from .views import (
    CurrentUserView,
    CompanyListView,
)


urlpatterns = [
    path(
        "me/",
        CurrentUserView.as_view(),
        name="current-user",
    ),
    path(
        "companies/",
        CompanyListView.as_view(),
        name="company-list",
    ),
]