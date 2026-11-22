from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from organizations.views import (
    ChangePasswordView,
    CurrentUserView,
)


urlpatterns = [
    path(
        "admin/",
        admin.site.urls,
    ),
    path(
        "api/auth/token/",
        TokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "api/auth/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "api/auth/me/",
        CurrentUserView.as_view(),
        name="current-user",
    ),
    path(
        "api/auth/change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),
    path(
        "api/",
        include("vehicles.urls"),
    ),
    path(
        "api/",
        include("drivers.urls"),
    ),
    path(
        "api/",
        include("organizations.urls"),
    ),
    path(
        "api/notifications/",
        include("notifications.urls"),
    ),
    path(
        "api/reports/",
        include("reports.urls"),
    ),
    path(
        "api/alerts/",
        include("alerts.urls"),
    ),
    path(
        "api/activity/",
        include("activity.urls"),
    ),
    path(
        "api/contact/",
        include("contact.urls"),
    ),
]


if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )