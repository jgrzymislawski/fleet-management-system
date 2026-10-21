from django.urls import path

from .views import (
    CurrentUserView,
    CompanyListView,
    ChangePasswordView,
    AdminCompanyListCreateView,
    AdminCompanyDetailView,
    AdminUserListView,
    AdminUserDetailView,
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
    path(
        "change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
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