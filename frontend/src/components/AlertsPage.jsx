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

  const loadAlerts = async (page = currentPage, selectedFilter = filter) => {
    try {
      setLoading(true);

      setError(null);

      const response = await apiClient.get("alerts/", {
        params: {
          category: selectedFilter,
          page,
          page_size: pageSize,
        },
      });

      setAlerts(response.data.results || []);

      setTotalCount(response.data.total_count || 0);

      setVehicleCount(response.data.vehicle_count || 0);

      setDriverCount(response.data.driver_count || 0);

      setTotalPages(response.data.total_pages || 1);

      if (response.data.page && response.data.page !== currentPage) {
        setCurrentPage(response.data.page);
      }
    } catch (err) {
      console.error("Błąd pobierania alertów:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się pobrać alertów.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts(currentPage, filter);
  }, [currentPage, filter]);

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  const handleFilterChange = (newFilter) => {
    setCurrentPage(1);

    setFilter(newFilter);
  };

  const handleAlertClick = (alert) => {
    if (alert.category === "driver") {
      navigate(`/drivers/${alert.targetId}`);

      return;
    }

    navigate(`/vehicles/${alert.targetId}`);
  };

  const getExportFilename = (response, fallback) => {
    const contentDisposition = response.headers["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);

      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
      }
    }

    return fallback;
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
        "application/" +
          "vnd.openxmlformats-officedocument." +
          "spreadsheetml.sheet",
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
    if (currentPage > 1) {
      setCurrentPage((page) => page - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((page) => page + 1);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="alerts-header">
          <div>
            <button
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
              disabled={exportingXlsx}
            >
              {exportingXlsx ? "Eksportowanie..." : "Eksportuj XLSX"}
            </button>

            <button
              type="button"
              className="alerts-export-button alerts-export-pdf"
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? "Generowanie..." : "Eksportuj raport PDF"}
            </button>
          </div>
        </div>

        {error && <p className="alerts-error">{error}</p>}

        <div className="alerts-toolbar">
          <div className="alerts-filters">
            <button
              type="button"
              className={
                filter === "all"
                  ? "alerts-filter " + "alerts-filter-active"
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
                  ? "alerts-filter " + "alerts-filter-active"
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
                    ? "alerts-filter " + "alerts-filter-active"
                    : "alerts-filter"
                }
                onClick={() => handleFilterChange("drivers")}
              >
                Kierowcy
                <span>{driverCount}</span>
              </button>
            )}
          </div>

          <div className="alerts-count">Na tej stronie: {alerts.length}</div>
        </div>

        {loading ? (
          <div className="alerts-empty">Ładowanie alertów...</div>
        ) : (
          <>
            <div className="alerts-list">
              {alerts.map((alert) => (
                <button
                  key={alert.id}
                  className="alert-item"
                  onClick={() => handleAlertClick(alert)}
                >
                  <div className="alert-item-main">
                    <div className="alert-name-row">
                      <span className="alert-vehicle-name">{alert.name}</span>

                      <span
                        className={
                          alert.category === "driver"
                            ? "alert-category " + "alert-category-driver"
                            : "alert-category " + "alert-category-vehicle"
                        }
                      >
                        {alert.category === "driver" ? "Kierowca" : "Pojazd"}
                      </span>
                    </div>

                    <span className="alert-registration">
                      {alert.secondary}
                    </span>
                  </div>

                  <div className="alert-type">{alert.type}</div>

                  <div className="alert-date">{formatDate(alert.date)}</div>

                  <span className={`alert-status ${alert.status.className}`}>
                    {alert.status.text}
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
