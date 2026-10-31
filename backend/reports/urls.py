from django.urls import path

from .views import (
    ReportOptionsView,
    ServiceCostsReportView,
)

from .alert_views import (
    AlertsReportView,
)


urlpatterns = [
    path(
        "options/",
        ReportOptionsView.as_view(),
        name="report-options",
    ),

    path(
        "service-costs/",
        ServiceCostsReportView.as_view(),
        name="service-costs-report",
    ),

    path(
        "alerts/",
        AlertsReportView.as_view(),
        name="alerts-report",
    ),
]