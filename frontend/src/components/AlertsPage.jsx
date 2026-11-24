import { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AlertsPage.css";

const PAGE_SIZE = 20;

function AlertsPage({ onLogout }) {
  const { user } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const canViewDriverAlerts =
    user?.role === "admin" || user?.is_superuser === true;

  useEffect(() => {
    let active = true;

    async function loadAlerts() {
      setLoading(true);
      setError("");

      try {
        const response = await apiClient.get("alerts/", {
          params: {
            category: filter,
            page,
            page_size: PAGE_SIZE,
          },
        });

        if (!active) return;

        const data = response.data;

        const results = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];

        setAlerts(results);

        setTotalCount(
          Array.isArray(data) ? results.length : Number(data?.count ?? 0),
        );

        setTotalPages(Math.max(1, Number(data?.total_pages ?? 1)));
      } catch (err) {
        if (!active) return;

        setAlerts([]);
        setTotalCount(0);
        setTotalPages(1);

        if (err.response?.status === 403) {
          setError("Nie masz dostępu do tych alertów.");
        } else {
          setError("Nie udało się pobrać alertów.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAlerts();

    return () => {
      active = false;
    };
  }, [filter, page]);

  const summary = useMemo(() => {
    const result = {
      expired: 0,
      sevenDays: 0,
      thirtyDays: 0,
    };

    for (const alert of alerts) {
      const days = Number(alert.daysLeft);

      if (!Number.isFinite(days)) continue;

      if (days < 0) {
        result.expired += 1;
      } else if (days <= 7) {
        result.sevenDays += 1;
      } else if (days <= 30) {
        result.thirtyDays += 1;
      }
    }

    return result;
  }, [alerts]);

  const changeFilter = (nextFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      return `${match[3]}.${match[2]}.${match[1]}`;
    }

    return String(value);
  };

  const getCategoryLabel = (category) => {
    return category === "driver" ? "Kierowca" : "Pojazd";
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

    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleExport = async (format) => {
    if (loading || totalCount === 0) return;

    const setExporting = format === "xlsx" ? setExportingXlsx : setExportingPdf;

    setExporting(true);
    setError("");

    try {
      const response = await apiClient.post(
        "reports/alerts/",
        {
          format,
          category: filter,
          status: "all",
        },
        {
          responseType: "blob",
        },
      );

      if (format === "xlsx") {
        downloadBlob(
          response.data,
          "flotivo-alerty.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      } else {
        downloadBlob(response.data, "flotivo-alerty.pdf", "application/pdf");
      }
    } catch {
      setError(
        format === "xlsx"
          ? "Nie udało się wyeksportować pliku XLSX."
          : "Nie udało się wygenerować raportu PDF.",
      );
    } finally {
      setExporting(false);
    }
  };

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="alerts-layout">
      <Sidebar onLogout={onLogout} />

      <main className="alerts-content">
        <header className="alerts-page-header">
          <div className="alerts-heading">
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
              onClick={() => handleExport("xlsx")}
              disabled={
                loading || exportingXlsx || exportingPdf || totalCount === 0
              }
            >
              {exportingXlsx ? "Eksportowanie..." : "Eksportuj XLSX"}
            </button>

            <button
              type="button"
              className="alerts-export-button alerts-export-pdf"
              onClick={() => handleExport("pdf")}
              disabled={
                loading || exportingXlsx || exportingPdf || totalCount === 0
              }
            >
              {exportingPdf ? "Generowanie..." : "Eksportuj raport PDF"}
            </button>
          </div>
        </header>

        {error && (
          <div className="alerts-error" role="alert">
            {error}
          </div>
        )}

        <section className="alerts-summary">
          <div className="alerts-summary-card">
            <span>Wszystkie alerty</span>
            <strong>{loading ? "—" : totalCount}</strong>
            <small>Wybrana kategoria</small>
          </div>

          <div className="alerts-summary-card alerts-summary-expired">
            <span>Po terminie</span>
            <strong>{loading ? "—" : summary.expired}</strong>
            <small>Na tej stronie</small>
          </div>

          <div className="alerts-summary-card alerts-summary-warning">
            <span>Do 7 dni</span>
            <strong>{loading ? "—" : summary.sevenDays}</strong>
            <small>Na tej stronie, w tym dzisiaj</small>
          </div>

          <div className="alerts-summary-card alerts-summary-upcoming">
            <span>Za 8–30 dni</span>
            <strong>{loading ? "—" : summary.thirtyDays}</strong>
            <small>Na tej stronie</small>
          </div>
        </section>

        <div className="alerts-toolbar">
          <div className="alerts-filters" aria-label="Filtr kategorii alertów">
            <button
              type="button"
              className={`alerts-filter ${filter === "all" ? "active" : ""}`}
              aria-pressed={filter === "all"}
              onClick={() => changeFilter("all")}
            >
              Wszystkie
            </button>

            <button
              type="button"
              className={`alerts-filter ${
                filter === "vehicles" ? "active" : ""
              }`}
              aria-pressed={filter === "vehicles"}
              onClick={() => changeFilter("vehicles")}
            >
              Pojazdy
            </button>

            {canViewDriverAlerts && (
              <button
                type="button"
                className={`alerts-filter ${
                  filter === "drivers" ? "active" : ""
                }`}
                aria-pressed={filter === "drivers"}
                onClick={() => changeFilter("drivers")}
              >
                Kierowcy
              </button>
            )}
          </div>

          <span className="alerts-results-count">
            {loading
              ? "Ładowanie..."
              : `Pozycje ${rangeStart}–${rangeEnd} z ${totalCount}`}
          </span>
        </div>

        <section className="alerts-table-wrapper" aria-label="Lista alertów">
          <div className="alerts-table-header">
            <span>Typ</span>
            <span>Element</span>
            <span>Termin</span>
            <span>Status</span>
          </div>

          {loading ? (
            <div className="alerts-empty">Ładowanie alertów...</div>
          ) : alerts.length === 0 ? (
            <div className="alerts-empty">
              {error
                ? "Lista alertów jest niedostępna."
                : "Brak alertów wymagających uwagi."}
            </div>
          ) : (
            alerts.map((alert) => {
              const days = Number(alert.daysLeft);
              const isExpired = Number.isFinite(days) && days < 0;

              return (
                <div className="alerts-table-row" key={alert.id}>
                  <div className="alerts-table-cell" data-label="Typ">
                    <span
                      className={`alerts-category ${
                        alert.category === "driver"
                          ? "alerts-category-driver"
                          : "alerts-category-vehicle"
                      }`}
                    >
                      {getCategoryLabel(alert.category)}
                    </span>
                  </div>

                  <div
                    className="alerts-table-cell alerts-element"
                    data-label="Element"
                  >
                    <strong>{alert.name || "—"}</strong>

                    {alert.secondary && <span>{alert.secondary}</span>}

                    <span className="alerts-element-type">
                      {alert.type || "—"}
                    </span>

                    {(alert.company || alert.branch) && (
                      <small>
                        {[alert.company, alert.branch]
                          .filter(Boolean)
                          .join(" • ")}
                      </small>
                    )}
                  </div>

                  <div
                    className="alerts-table-cell alerts-date"
                    data-label="Termin"
                  >
                    <strong>{formatDate(alert.date)}</strong>

                    {alert.daysText && <small>{alert.daysText}</small>}
                  </div>

                  <div className="alerts-table-cell" data-label="Status">
                    <span
                      className={`alerts-status ${
                        isExpired
                          ? "alerts-status-expired"
                          : "alerts-status-warning"
                      }`}
                    >
                      {alert.status?.text ||
                        (isExpired ? "Po terminie" : "Wygasa wkrótce")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {!loading && !error && totalPages > 1 && (
          <nav className="alerts-pagination" aria-label="Strony alertów">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Poprzednia
            </button>

            <span>
              Strona {page} z {totalPages}
            </span>

            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
            >
              Następna
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}

export default AlertsPage;
