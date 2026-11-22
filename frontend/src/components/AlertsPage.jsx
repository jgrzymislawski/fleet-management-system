import { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AlertsPage.css";

function AlertsPage({ onLogout }) {
  const { user } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState(null);

  const canViewDriverAlerts = user?.role === "admin";

  useEffect(() => {
    let isMounted = true;

    const loadAlerts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get("alerts/", {
          params: {
            category: filter,
          },
        });

        if (!isMounted) {
          return;
        }

        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];

        setAlerts(data);
      } catch (loadError) {
        console.error(loadError);

        if (isMounted) {
          setError("Nie udało się pobrać alertów.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAlerts();

    return () => {
      isMounted = false;
    };
  }, [filter]);

  const filteredAlerts = useMemo(() => {
    if (canViewDriverAlerts) {
      return alerts;
    }

    return alerts.filter((alert) => alert.category !== "drivers");
  }, [alerts, canViewDriverAlerts]);

  const expiredCount = useMemo(
    () => filteredAlerts.filter((alert) => alert.status === "expired").length,
    [filteredAlerts],
  );

  const sevenDaysCount = useMemo(
    () => filteredAlerts.filter((alert) => alert.status === "7_days").length,
    [filteredAlerts],
  );

  const thirtyDaysCount = useMemo(
    () => filteredAlerts.filter((alert) => alert.status === "30_days").length,
    [filteredAlerts],
  );

  const totalCount = filteredAlerts.length;

  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat("pl-PL").format(
      new Date(`${value}T00:00:00`),
    );
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "expired":
        return "Po terminie";
      case "7_days":
        return "Do 7 dni";
      case "30_days":
        return "Do 30 dni";
      default:
        return "Termin";
    }
  };

  const getCategoryLabel = (category) => {
    if (category === "drivers") {
      return "Kierowca";
    }

    return "Pojazd";
  };

  const downloadBlob = (data, filename, mimeType) => {
    const blob = new Blob([data], {
      type: mimeType,
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const handleExportXlsx = async () => {
    if (totalCount === 0) {
      return;
    }

    try {
      setExportingXlsx(true);
      setError(null);

      const response = await apiClient.post(
        "reports/alerts/",
        {
          format: "xlsx",
          category: filter,
          status: "all",
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(
        response.data,
        "flotivo-alerty.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    } catch (exportError) {
      console.error(exportError);
      setError("Nie udało się wyeksportować alertów do XLSX.");
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleExportPdf = async () => {
    if (totalCount === 0) {
      return;
    }

    try {
      setExportingPdf(true);
      setError(null);

      const response = await apiClient.post(
        "reports/alerts/",
        {
          format: "pdf",
          category: filter,
          status: "all",
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(response.data, "flotivo-alerty.pdf", "application/pdf");
    } catch (exportError) {
      console.error(exportError);
      setError("Nie udało się wygenerować raportu PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="alerts-layout">
      <Sidebar onLogout={onLogout} />

      <main className="alerts-content">
        <div className="alerts-page-header">
          <div>
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

        {error && <div className="alerts-error">{error}</div>}

        <div className="alerts-summary">
          <div className="alerts-summary-card">
            <span>Wszystkie</span>
            <strong>{loading ? "—" : totalCount}</strong>
          </div>

          <div className="alerts-summary-card alerts-summary-expired">
            <span>Po terminie</span>
            <strong>{loading ? "—" : expiredCount}</strong>
          </div>

          <div className="alerts-summary-card alerts-summary-warning">
            <span>Do 7 dni</span>
            <strong>{loading ? "—" : sevenDaysCount}</strong>
          </div>

          <div className="alerts-summary-card alerts-summary-upcoming">
            <span>Do 30 dni</span>
            <strong>{loading ? "—" : thirtyDaysCount}</strong>
          </div>
        </div>

        <div className="alerts-toolbar">
          <div className="alerts-filters">
            <button
              type="button"
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              Wszystkie
            </button>

            <button
              type="button"
              className={filter === "vehicles" ? "active" : ""}
              onClick={() => setFilter("vehicles")}
            >
              Pojazdy
            </button>

            {canViewDriverAlerts && (
              <button
                type="button"
                className={filter === "drivers" ? "active" : ""}
                onClick={() => setFilter("drivers")}
              >
                Kierowcy
              </button>
            )}
          </div>
        </div>

        <section className="alerts-table-wrapper">
          <div className="alerts-table-header">
            <span>Typ</span>
            <span>Element</span>
            <span>Termin</span>
            <span>Status</span>
          </div>

          {loading ? (
            <div className="alerts-empty">Ładowanie alertów...</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="alerts-empty">Brak alertów wymagających uwagi.</div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                className="alerts-table-row"
                key={`${alert.category}-${alert.type}-${alert.id}`}
              >
                <span>{getCategoryLabel(alert.category)}</span>

                <span>
                  <strong>{alert.title || "—"}</strong>

                  {alert.subtitle && <small>{alert.subtitle}</small>}
                </span>

                <span>{formatDate(alert.expiry_date)}</span>

                <span>
                  <span className={`alert-status alert-status-${alert.status}`}>
                    {getStatusLabel(alert.status)}
                  </span>
                </span>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

export default AlertsPage;
