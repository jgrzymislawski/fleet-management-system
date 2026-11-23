
from django.contrib import admin
from django.urls import include, path

from config.auth_views import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    CookieTokenLogoutView,
    csrf_cookie,
)

from config.throttles import (
    LoginAccountThrottle,
    LoginIPThrottle,
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
        "api/auth/csrf/",
        csrf_cookie,
        name="auth_csrf",
    ),
    path(
        "api/auth/token/",
        CookieTokenObtainPairView.as_view(
            throttle_classes=[
                LoginIPThrottle,
                LoginAccountThrottle,
            ],
        ),
        name="token_obtain_pair",
    ),
    path(
        "api/auth/token/refresh/",
        CookieTokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "api/auth/token/blacklist/",
        CookieTokenLogoutView.as_view(),
        name="token_blacklist",
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
