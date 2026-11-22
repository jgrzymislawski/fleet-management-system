import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./ReportsPage.css";

function ReportsPage({ onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [generating, setGenerating] = useState("");
  const [error, setError] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [reportType, setReportType] = useState("service-costs");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branch, setBranch] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [reportFormat, setReportFormat] = useState("pdf");
  const [alertCategory, setAlertCategory] = useState("all");
  const [alertStatus, setAlertStatus] = useState("all");

  const canViewDriverReports = user?.role === "admin";

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      try {
        setOptionsLoading(true);
        setError(null);

        const response = await apiClient.get("reports/options/");

        if (!active) return;

        setCompanies(
          Array.isArray(response.data?.companies)
            ? response.data.companies
            : [],
        );

        setBranches(
          Array.isArray(response.data?.branches) ? response.data.branches : [],
        );

        setVehicles(
          Array.isArray(response.data?.vehicles) ? response.data.vehicles : [],
        );
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania opcji raportów:", err);
        setCompanies([]);
        setBranches([]);
        setVehicles([]);
        setError("Nie udało się pobrać danych generatora raportów.");
      } finally {
        if (active) {
          setOptionsLoading(false);
        }
      }
    };

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!canViewDriverReports && alertCategory === "drivers") {
      setAlertCategory("all");
    }
  }, [canViewDriverReports, alertCategory]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      if (companyId && Number(vehicle.company_id) !== Number(companyId)) {
        return false;
      }

      if (branch && vehicle.branch !== branch) {
        return false;
      }

      return true;
    });
  }, [vehicles, companyId, branch]);

  useEffect(() => {
    if (!vehicleId) return;

    const available = filteredVehicles.some(
      (vehicle) => Number(vehicle.id) === Number(vehicleId),
    );

    if (!available) {
      setVehicleId("");
    }
  }, [filteredVehicles, vehicleId]);

  useEffect(() => {
    if (reportType === "service-costs") {
      setAlertCategory("all");
      setAlertStatus("all");
    }

    if (reportType === "alerts") {
      setDateFrom("");
      setDateTo("");
    }
  }, [reportType]);

  useEffect(() => {
    if (reportType !== "alerts") return;

    if (alertCategory === "drivers") {
      setCompanyId("");
      setBranch("");
      setVehicleId("");
    }
  }, [reportType, alertCategory]);

  const getFilename = (response, fallbackFilename) => {
    const contentDisposition = response.headers?.["content-disposition"];

    if (!contentDisposition) {
      return fallbackFilename;
    }

    const filenameMatch = contentDisposition.match(
      /filename\*?=(?:UTF-8''|")?([^";]+)/i,
    );

    if (!filenameMatch?.[1]) {
      return fallbackFilename;
    }

    try {
      return decodeURIComponent(filenameMatch[1].replace(/"/g, ""));
    } catch {
      return filenameMatch[1].replace(/"/g, "");
    }
  };

  const downloadBlob = (response, mimeType, fallbackFilename) => {
    const blob = new Blob([response.data], {
      type: mimeType,
    });

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = getFilename(response, fallbackFilename);

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
  };

  const getBackendError = (err, fallback) => {
    const data = err.response?.data;

    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;

    return fallback;
  };

  const handleGenerateReport = async () => {
    if (
      reportType === "service-costs" &&
      dateFrom &&
      dateTo &&
      dateFrom > dateTo
    ) {
      setError("Data początkowa nie może być późniejsza od końcowej.");
      return;
    }

    if (
      reportType === "alerts" &&
      alertCategory === "drivers" &&
      !canViewDriverReports
    ) {
      setError("Nie masz uprawnień do raportów kierowców.");
      return;
    }

    try {
      setGenerating("advanced-report");
      setError(null);

      if (reportType === "service-costs") {
        const response = await apiClient.post(
          "reports/service-costs/",
          {
            format: reportFormat,
            date_from: dateFrom || null,
            date_to: dateTo || null,
            company_id: companyId || null,
            branch: branch || "",
            vehicle_id: vehicleId || null,
          },
          {
            responseType: "blob",
          },
        );

        if (reportFormat === "pdf") {
          downloadBlob(
            response,
            "application/pdf",
            "flotivo-koszty-serwisowe.pdf",
          );
        } else {
          downloadBlob(
            response,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "flotivo-koszty-serwisowe.xlsx",
          );
        }

        return;
      }

      const response = await apiClient.post(
        "reports/alerts/",
        {
          format: reportFormat,
          category: alertCategory,
          status: alertStatus,
          company_id: companyId || null,
          branch: branch || "",
          vehicle_id: vehicleId || null,
        },
        {
          responseType: "blob",
        },
      );

      if (reportFormat === "pdf") {
        downloadBlob(response, "application/pdf", "flotivo-raport-alertow.pdf");
      } else {
        downloadBlob(
          response,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "flotivo-raport-alertow.xlsx",
        );
      }
    } catch (err) {
      console.error("Błąd generowania raportu:", err);
      setError(getBackendError(err, "Nie udało się wygenerować raportu."));
    } finally {
      setGenerating("");
    }
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCompanyId("");
    setBranch("");
    setVehicleId("");
    setAlertCategory("all");
    setAlertStatus("all");
    setError(null);
  };

  const generateVehicleXlsx = async () => {
    try {
      setGenerating("vehicles-xlsx");
      setError(null);

      const response = await apiClient.post(
        "vehicles/export/",
        {
          vehicle_ids: [],
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(
        response,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "flotivo-pojazdy.xlsx",
      );
    } catch (err) {
      console.error("Błąd eksportu pojazdów:", err);
      setError("Nie udało się wygenerować raportu pojazdów.");
    } finally {
      setGenerating("");
    }
  };

  const generateDriversXlsx = async () => {
    if (!canViewDriverReports) return;

    try {
      setGenerating("drivers-xlsx");
      setError(null);

      const response = await apiClient.post(
        "drivers/export/",
        {
          driver_ids: [],
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(
        response,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "flotivo-kierowcy.xlsx",
      );
    } catch (err) {
      console.error("Błąd eksportu kierowców:", err);
      setError("Nie udało się wygenerować raportu kierowców.");
    } finally {
      setGenerating("");
    }
  };

  const generateServiceXlsx = async () => {
    try {
      setGenerating("service-xlsx");
      setError(null);

      const response = await apiClient.post(
        "service-records/export/",
        {
          service_record_ids: [],
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(
        response,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "flotivo-historia-serwisowa.xlsx",
      );
    } catch (err) {
      console.error("Błąd eksportu historii serwisowej:", err);
      setError("Nie udało się wygenerować historii serwisowej.");
    } finally {
      setGenerating("");
    }
  };

  const generateStatisticsPdf = async () => {
    try {
      setGenerating("statistics-pdf");
      setError(null);

      const response = await apiClient.post(
        "reports/statistics/",
        {
          vehicle_ids: [],
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(
        response,
        "application/pdf",
        "flotivo-raport-statystyczny.pdf",
      );
    } catch (err) {
      console.error("Błąd generowania raportu statystycznego:", err);
      setError("Nie udało się wygenerować raportu statystycznego.");
    } finally {
      setGenerating("");
    }
  };

  const generateAlertsPdf = async () => {
    try {
      setGenerating("alerts-pdf");
      setError(null);

      const response = await apiClient.post(
        "reports/alerts/",
        {
          format: "pdf",
          category: "all",
          status: "all",
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(response, "application/pdf", "flotivo-alerty.pdf");
    } catch (err) {
      console.error("Błąd generowania raportu alertów:", err);
      setError("Nie udało się wygenerować raportu alertów.");
    } finally {
      setGenerating("");
    }
  };

  const generateAlertsXlsx = async () => {
    try {
      setGenerating("alerts-xlsx");
      setError(null);

      const response = await apiClient.post(
        "reports/alerts/",
        {
          format: "xlsx",
          category: "all",
          status: "all",
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(
        response,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "flotivo-alerty.xlsx",
      );
    } catch (err) {
      console.error("Błąd eksportu alertów:", err);
      setError("Nie udało się wygenerować raportu alertów.");
    } finally {
      setGenerating("");
    }
  };

  const filtersDisabled =
    reportType === "alerts" && alertCategory === "drivers";

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="reports-header">
          <div>
            <h1>Raporty</h1>
            <p>Generuj szczegółowe raporty i zestawienia dotyczące floty.</p>
          </div>
        </div>

        {error && (
          <div className="reports-error" role="alert">
            {error}
          </div>
        )}

        <section className="report-generator">
          <div className="report-generator-header">
            <div>
              <h2>Generator raportu</h2>
              <p>Wybierz typ raportu oraz kryteria.</p>
            </div>
          </div>

          {optionsLoading ? (
            <div className="reports-loading">
              Ładowanie danych generatora...
            </div>
          ) : (
            <>
              <div className="report-generator-grid">
                <div className="report-field">
                  <label htmlFor="report-type">Typ raportu</label>
                  <select
                    id="report-type"
                    value={reportType}
                    onChange={(event) => setReportType(event.target.value)}
                  >
                    <option value="service-costs">Koszty serwisowe</option>
                    <option value="alerts">Terminy i alerty</option>
                  </select>
                </div>

                <div className="report-field">
                  <label htmlFor="report-format">Format</label>
                  <select
                    id="report-format"
                    value={reportFormat}
                    onChange={(event) => setReportFormat(event.target.value)}
                  >
                    <option value="pdf">PDF</option>
                    <option value="xlsx">Excel</option>
                  </select>
                </div>

                {reportType === "service-costs" && (
                  <>
                    <div className="report-field">
                      <label htmlFor="report-date-from">Data od</label>
                      <input
                        id="report-date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                      />
                    </div>

                    <div className="report-field">
                      <label htmlFor="report-date-to">Data do</label>
                      <input
                        id="report-date-to"
                        type="date"
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                      />
                    </div>
                  </>
                )}

                {reportType === "alerts" && (
                  <>
                    <div className="report-field">
                      <label htmlFor="alert-category">Kategoria</label>
                      <select
                        id="alert-category"
                        value={alertCategory}
                        onChange={(event) =>
                          setAlertCategory(event.target.value)
                        }
                      >
                        <option value="all">Wszystkie</option>
                        <option value="vehicles">Pojazdy</option>
                        {canViewDriverReports && (
                          <option value="drivers">Kierowcy</option>
                        )}
                      </select>
                    </div>

                    <div className="report-field">
                      <label htmlFor="alert-status">Pilność</label>
                      <select
                        id="alert-status"
                        value={alertStatus}
                        onChange={(event) => setAlertStatus(event.target.value)}
                      >
                        <option value="all">Wszystkie</option>
                        <option value="expired">Po terminie</option>
                        <option value="7_days">Wygasa w ciągu 7 dni</option>
                        <option value="30_days">Wygasa w ciągu 30 dni</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="report-field">
                  <label htmlFor="report-company">Spółka</label>
                  <select
                    id="report-company"
                    value={companyId}
                    disabled={filtersDisabled}
                    onChange={(event) => {
                      setCompanyId(event.target.value);
                      setVehicleId("");
                    }}
                  >
                    <option value="">Wszystkie spółki</option>

                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="report-field">
                  <label htmlFor="report-branch">Oddział</label>
                  <select
                    id="report-branch"
                    value={branch}
                    disabled={filtersDisabled}
                    onChange={(event) => {
                      setBranch(event.target.value);
                      setVehicleId("");
                    }}
                  >
                    <option value="">Wszystkie oddziały</option>

                    {branches.map((branchItem) => (
                      <option key={branchItem} value={branchItem}>
                        {branchItem}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="report-field report-field-wide">
                  <label htmlFor="report-vehicle">Pojazd</label>
                  <select
                    id="report-vehicle"
                    value={vehicleId}
                    disabled={filtersDisabled}
                    onChange={(event) => setVehicleId(event.target.value)}
                  >
                    <option value="">Wszystkie pojazdy</option>

                    {filteredVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name || "Pojazd"} -{" "}
                        {vehicle.registration_number || "Brak rejestracji"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="report-generator-actions">
                <button
                  type="button"
                  className="report-reset-button"
                  onClick={resetFilters}
                  disabled={generating !== ""}
                >
                  Wyczyść filtry
                </button>

                <button
                  type="button"
                  className="report-generate-button"
                  onClick={handleGenerateReport}
                  disabled={generating !== ""}
                >
                  {generating === "advanced-report"
                    ? "Generowanie..."
                    : reportFormat === "pdf"
                      ? "Generuj PDF"
                      : "Generuj Excel"}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="reports-section">
          <div className="reports-section-header">
            <div>
              <h2>Szybkie raporty</h2>
              <p>Gotowe zestawienia całej dostępnej floty.</p>
            </div>
          </div>

          <div className="reports-grid">
            <div className="report-card">
              <div>
                <span className="report-card-type">PDF</span>
                <h3>Raport statystyczny</h3>
                <p>Podsumowanie kosztów serwisowych całej dostępnej floty.</p>
              </div>

              <button
                type="button"
                onClick={generateStatisticsPdf}
                disabled={generating !== ""}
              >
                {generating === "statistics-pdf"
                  ? "Generowanie..."
                  : "Generuj PDF"}
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">XLSX</span>
                <h3>Lista pojazdów</h3>
                <p>Pełna lista dostępnych pojazdów.</p>
              </div>

              <button
                type="button"
                onClick={generateVehicleXlsx}
                disabled={generating !== ""}
              >
                {generating === "vehicles-xlsx"
                  ? "Generowanie..."
                  : "Generuj Excel"}
              </button>
            </div>

            {canViewDriverReports && (
              <div className="report-card">
                <div>
                  <span className="report-card-type">XLSX</span>
                  <h3>Lista kierowców</h3>
                  <p>Kierowcy, uprawnienia i terminy ważności.</p>
                </div>

                <button
                  type="button"
                  onClick={generateDriversXlsx}
                  disabled={generating !== ""}
                >
                  {generating === "drivers-xlsx"
                    ? "Generowanie..."
                    : "Generuj Excel"}
                </button>
              </div>
            )}

            <div className="report-card">
              <div>
                <span className="report-card-type">XLSX</span>
                <h3>Historia serwisowa</h3>
                <p>Wszystkie wpisy dotyczące serwisów i napraw.</p>
              </div>

              <button
                type="button"
                onClick={generateServiceXlsx}
                disabled={generating !== ""}
              >
                {generating === "service-xlsx"
                  ? "Generowanie..."
                  : "Generuj Excel"}
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">PDF</span>
                <h3>Wymagają uwagi</h3>
                <p>Szybki raport wszystkich aktualnych alertów.</p>
              </div>

              <button
                type="button"
                onClick={generateAlertsPdf}
                disabled={generating !== ""}
              >
                {generating === "alerts-pdf" ? "Generowanie..." : "Generuj PDF"}
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">XLSX</span>
                <h3>Alerty</h3>
                <p>Wszystkie aktualne alerty w Excelu.</p>
              </div>

              <button
                type="button"
                onClick={generateAlertsXlsx}
                disabled={generating !== ""}
              >
                {generating === "alerts-xlsx"
                  ? "Generowanie..."
                  : "Generuj Excel"}
              </button>
            </div>

            <div className="report-card report-card-navigation">
              <div>
                <span className="report-card-type">PDF</span>
                <h3>Karta pojazdu</h3>
                <p>Szczegółowy raport konkretnego pojazdu.</p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/vehicles")}
                disabled={generating !== ""}
              >
                Wybierz pojazd
              </button>
            </div>

            {canViewDriverReports && (
              <div className="report-card report-card-navigation">
                <div>
                  <span className="report-card-type">PDF</span>
                  <h3>Karta kierowcy</h3>
                  <p>Szczegółowy raport konkretnego kierowcy.</p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/drivers")}
                  disabled={generating !== ""}
                >
                  Wybierz kierowcę
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default ReportsPage;
