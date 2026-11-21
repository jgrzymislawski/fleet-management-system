import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AlertsPage.css";

function AlertsPage({ onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const pageSize = 20;
  const canViewDriverAlerts = user?.role === "admin";

  useEffect(() => {
    if (!canViewDriverAlerts && filter === "drivers") {
      setFilter("all");
      setCurrentPage(1);
    }
  }, [canViewDriverAlerts, filter]);

  useEffect(() => {
    let active = true;

    const loadAlerts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get("alerts/", {
          params: {
            category: filter,
            page: currentPage,
            page_size: pageSize,
          },
        });

        if (!active) return;

        const data = response.data || {};

        setAlerts(Array.isArray(data.results) ? data.results : []);
        setTotalCount(Number(data.total_count) || 0);
        setVehicleCount(Number(data.vehicle_count) || 0);
        setDriverCount(Number(data.driver_count) || 0);
        setTotalPages(Math.max(1, Number(data.total_pages) || 1));

        if (
          data.page &&
          Number(data.page) !== currentPage &&
          Number(data.page) > 0
        ) {
          setCurrentPage(Number(data.page));
        }
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania alertów:", err);
        setAlerts([]);
        setTotalCount(0);
        setVehicleCount(0);
        setDriverCount(0);
        setTotalPages(1);
        setError("Nie udało się pobrać alertów.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAlerts();

    return () => {
      active = false;
    };
  }, [currentPage, filter]);

  const formatDate = (date) => {
    if (!date) return "-";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("pl-PL");
  };

  const handleFilterChange = (newFilter) => {
    if (newFilter === "drivers" && !canViewDriverAlerts) {
      return;
    }

    setCurrentPage(1);
    setFilter(newFilter);
  };

  const handleAlertClick = (alert) => {
    if (!alert?.targetId) return;

    if (alert.category === "driver") {
      if (canViewDriverAlerts) {
        navigate(`/drivers/${alert.targetId}`);
      }

      return;
    }

    navigate(`/vehicles/${alert.targetId}`);
  };

  const getExportFilename = (response, fallback) => {
    const contentDisposition = response.headers?.["content-disposition"];

    if (!contentDisposition) {
      return fallback;
    }

    const filenameMatch = contentDisposition.match(
      /filename\*?=(?:UTF-8''|")?([^";]+)/i,
    );

    if (!filenameMatch?.[1]) {
      return fallback;
    }

    try {
      return decodeURIComponent(filenameMatch[1].replace(/"/g, ""));
    } catch {
      return filenameMatch[1].replace(/"/g, "");
    }
  };

  const downloadFile = (response, mimeType, fallbackFilename) => {
    const blob = new Blob([response.data], {
      type: mimeType,
    });

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = getExportFilename(response, fallbackFilename);

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleExportXlsx = async () => {
    if (totalCount === 0) {
      setError("Brak alertów do wyeksportowania.");
      return;
    }

    try {
      setExportingXlsx(true);
      setError(null);

      const response = await apiClient.post(
        "vehicles/alerts-export/",
        {
          category: filter,
        },
        {
          responseType: "blob",
        },
      );

      downloadFile(
        response,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "flotivo-alerty.xlsx",
      );
    } catch (err) {
      console.error("Błąd eksportu alertów:", err);
      setError("Nie udało się wyeksportować alertów.");
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleExportPdf = async () => {
    if (totalCount === 0) {
      setError("Brak alertów do wygenerowania raportu.");
      return;
    }

    try {
      setExportingPdf(true);
      setError(null);

      const response = await apiClient.post(
        "vehicles/alerts-pdf/",
        {
          category: filter,
        },
        {
          responseType: "blob",
        },
      );

      downloadFile(response, "application/pdf", "flotivo-alerty.pdf");
    } catch (err) {
      console.error("Błąd eksportu raportu alertów:", err);
      setError("Nie udało się wygenerować raportu alertów.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1 && !loading) {
      setCurrentPage((page) => page - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages && !loading) {
      setCurrentPage((page) => page + 1);
    }
  };

  const getAlertCategoryName = (category) =>
    category === "driver" ? "Kierowca" : "Pojazd";

  const getAlertCategoryClass = (category) =>
    category === "driver"
      ? "alert-category alert-category-driver"
      : "alert-category alert-category-vehicle";

  const getAlertStatusClass = (alert) => {
    const className = alert?.status?.className;

    if (
      className === "alert-status-warning" ||
      className === "alert-status-expired"
    ) {
      return className;
    }

    return "alert-status-warning";
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="alerts-header">
          <div>
            <button
              type="button"
              className="alerts-back"
              onClick={() => navigate("/dashboard")}
            >
              ← Wróć do dashboardu
            </button>

            <h1>Wymagają uwagi</h1>

            <p>
              Terminy pojazdów i kierowców po terminie lub wygasające w ciągu 30
              dni.
            </p>
          </div>

          <div className="alerts-export-actions">
            <button
              type="button"
              className="alerts-export-button"
              onClick={handleExportXlsx}
              disabled={exportingXlsx || loading || totalCount === 0}
            >
              {exportingXlsx ? "Eksportowanie..." : "Eksportuj XLSX"}
            </button>

            <button
              type="button"
              className="alerts-export-button alerts-export-pdf"
              onClick={handleExportPdf}
              disabled={exportingPdf || loading || totalCount === 0}
            >
              {exportingPdf ? "Generowanie..." : "Eksportuj raport PDF"}
            </button>
          </div>
        </div>

        {error && (
          <div className="alerts-error" role="alert">
            {error}
          </div>
        )}

        <div className="alerts-toolbar">
          <div className="alerts-filters">
            <button
              type="button"
              className={
                filter === "all"
                  ? "alerts-filter alerts-filter-active"
                  : "alerts-filter"
              }
              onClick={() => handleFilterChange("all")}
            >
              Wszystkie
              <span>{totalCount}</span>
            </button>

            <button
              type="button"
              className={
                filter === "vehicles"
                  ? "alerts-filter alerts-filter-active"
                  : "alerts-filter"
              }
              onClick={() => handleFilterChange("vehicles")}
            >
              Pojazdy
              <span>{vehicleCount}</span>
            </button>

            {canViewDriverAlerts && (
              <button
                type="button"
                className={
                  filter === "drivers"
                    ? "alerts-filter alerts-filter-active"
                    : "alerts-filter"
                }
                onClick={() => handleFilterChange("drivers")}
              >
                Kierowcy
                <span>{driverCount}</span>
              </button>
            )}
          </div>

          <div className="alerts-count">
            {loading ? "Ładowanie..." : `Na tej stronie: ${alerts.length}`}
          </div>
        </div>

        {loading ? (
          <div className="alerts-empty">Ładowanie alertów...</div>
        ) : (
          <>
            <div className="alerts-list">
              {alerts.map((alert) => (
                <button
                  type="button"
                  key={alert.id}
                  className="alert-item"
                  onClick={() => handleAlertClick(alert)}
                  disabled={!alert.targetId}
                >
                  <div className="alert-item-main">
                    <div className="alert-name-row">
                      <span className="alert-vehicle-name">
                        {alert.name || "Brak danych"}
                      </span>

                      <span className={getAlertCategoryClass(alert.category)}>
                        {getAlertCategoryName(alert.category)}
                      </span>
                    </div>

                    <span className="alert-registration">
                      {alert.secondary || "Brak dodatkowych danych"}
                    </span>
                  </div>

                  <div className="alert-type">
                    {alert.type || "Brak typu alertu"}
                  </div>

                  <div className="alert-date">{formatDate(alert.date)}</div>

                  <span
                    className={`alert-status ${getAlertStatusClass(alert)}`}
                  >
                    {alert.status?.text || "Wymaga uwagi"}
                  </span>
                </button>
              ))}

              {alerts.length === 0 && !error && (
                <div className="alerts-empty">
                  Brak terminów wymagających uwagi w wybranej kategorii.
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="alerts-pagination">
                <button
                  type="button"
                  className="alerts-pagination-button"
                  onClick={handlePreviousPage}
                  disabled={currentPage <= 1 || loading}
                >
                  ← Poprzednia
                </button>

                <span className="alerts-pagination-info">
                  Strona {currentPage} z {totalPages}
                </span>

                <button
                  type="button"
                  className="alerts-pagination-button"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages || loading}
                >
                  Następna →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default AlertsPage;
