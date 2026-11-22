from django.urls import path

from .views import (
    AdminCompanyDetailView,
    AdminCompanyListCreateView,
    AdminUserDetailView,
    AdminUserListView,
    CompanyListView,
)


urlpatterns = [
    path(
        "companies/",
        CompanyListView.as_view(),
        name="company-list",
    ),
    path(
        "admin/companies/",
        AdminCompanyListCreateView.as_view(),
        name="admin-company-list-create",
    ),
    path(
        "admin/companies/<int:company_id>/",
        AdminCompanyDetailView.as_view(),
        name="admin-company-detail",
    ),
    path(
        "admin/users/",
        AdminUserListView.as_view(),
        name="admin-user-list",
    ),
    path(
        "admin/users/<int:membership_id>/",
        AdminUserDetailView.as_view(),
        name="admin-user-detail",
    ),
]