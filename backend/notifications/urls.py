from django.urls import path

from .views import (
    AdminNotificationSettingsView,
    NotificationPreferenceView,
)


urlpatterns = [
    path(
        "preferences/",
        NotificationPreferenceView.as_view(),
        name="notification-preferences",
    ),

    path(
        "admin/settings/",
        AdminNotificationSettingsView.as_view(),
        name="admin-notification-settings",
    ),
]