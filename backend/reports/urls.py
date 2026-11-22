from django.urls import path

from .alert_views import AlertsReportView
from .statistics_views import StatisticsReportView
from .views import ReportOptionsView, ServiceCostsReportView


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
    path(
        "statistics/",
        StatisticsReportView.as_view(),
        name="statistics-report",
    ),
]