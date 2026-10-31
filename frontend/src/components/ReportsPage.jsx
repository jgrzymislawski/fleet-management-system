import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";

import "./ReportsPage.css";

function ReportsPage({ onLogout }) {
  const navigate = useNavigate();

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

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setOptionsLoading(true);

        const response = await apiClient.get("reports/options/");

        setCompanies(response.data.companies || []);

        setBranches(response.data.branches || []);

        setVehicles(response.data.vehicles || []);
      } catch (err) {
        console.error("Błąd pobierania opcji raportów:", err);

        setError("Nie udało się pobrać danych generatora raportów.");
      } finally {
        setOptionsLoading(false);
      }
    };

    loadOptions();
  }, []);

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
    if (!vehicleId) {
      return;
    }

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
    if (reportType !== "alerts") {
      return;
    }

    if (alertCategory === "drivers") {
      setCompanyId("");
      setBranch("");
      setVehicleId("");
    }
  }, [reportType, alertCategory]);

  const downloadBlob = (response, mimeType, fallbackFilename) => {
    const blob = new Blob([response.data], {
      type: mimeType,
    });

    const downloadUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    const contentDisposition = response.headers["content-disposition"];

    let filename = fallbackFilename;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);

      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    link.href = downloadUrl;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
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
            "application/" +
              "vnd.openxmlformats-officedocument." +
              "spreadsheetml.sheet",
            "flotivo-koszty-serwisowe.xlsx",
          );
        }

        return;
      }

      if (reportType === "alerts") {
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
          downloadBlob(
            response,
            "application/pdf",
            "flotivo-raport-alertow.pdf",
          );
        } else {
          downloadBlob(
            response,
            "application/" +
              "vnd.openxmlformats-officedocument." +
              "spreadsheetml.sheet",
            "flotivo-raport-alertow.xlsx",
          );
        }
      }
    } catch (err) {
      console.error("Błąd generowania raportu:", err);

      setError("Nie udało się wygenerować raportu.");
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
        "application/" +
          "vnd.openxmlformats-officedocument." +
          "spreadsheetml.sheet",
        "flotivo-pojazdy.xlsx",
      );
    } catch (err) {
      console.error(err);

      setError("Nie udało się wygenerować raportu pojazdów.");
    } finally {
      setGenerating("");
    }
  };

  const generateDriversXlsx = async () => {
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
        "application/" +
          "vnd.openxmlformats-officedocument." +
          "spreadsheetml.sheet",
        "flotivo-kierowcy.xlsx",
      );
    } catch (err) {
      console.error(err);

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
        "application/" +
          "vnd.openxmlformats-officedocument." +
          "spreadsheetml.sheet",
        "flotivo-historia-serwisowa.xlsx",
      );
    } catch (err) {
      console.error(err);

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
        "vehicles/statistics-pdf/",
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
      console.error(err);

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
        "vehicles/alerts-pdf/",
        {
          category: "all",
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(response, "application/pdf", "flotivo-alerty.pdf");
    } catch (err) {
      console.error(err);

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
        "vehicles/alerts-export/",
        {
          category: "all",
        },
        {
          responseType: "blob",
        },
      );

      downloadBlob(
        response,
        "application/" +
          "vnd.openxmlformats-officedocument." +
          "spreadsheetml.sheet",
        "flotivo-alerty.xlsx",
      );
    } catch (err) {
      console.error(err);

      setError("Nie udało się wygenerować raportu alertów.");
    } finally {
      setGenerating("");
    }
  };

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

        {error && <p className="reports-error">{error}</p>}

        <section className="report-generator">
          <div className="report-generator-header">
            <div>
              <h2>Generator raportu</h2>

              <p>Wybierz typ raportu oraz kryteria.</p>
            </div>
          </div>

          {optionsLoading ? (
            <p>Ładowanie danych...</p>
          ) : (
            <>
              <div className="report-generator-grid">
                <div className="report-field">
                  <label>Typ raportu</label>

                  <select
                    value={reportType}
                    onChange={(event) => setReportType(event.target.value)}
                  >
                    <option value="service-costs">Koszty serwisowe</option>

                    <option value="alerts">Terminy i alerty</option>
                  </select>
                </div>

                <div className="report-field">
                  <label>Format</label>

                  <select
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
                      <label>Data od</label>

                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                      />
                    </div>

                    <div className="report-field">
                      <label>Data do</label>

                      <input
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
                      <label>Kategoria</label>

                      <select
                        value={alertCategory}
                        onChange={(event) =>
                          setAlertCategory(event.target.value)
                        }
                      >
                        <option value="all">Wszystkie</option>

                        <option value="vehicles">Pojazdy</option>

                        <option value="drivers">Kierowcy</option>
                      </select>
                    </div>

                    <div className="report-field">
                      <label>Pilność</label>

                      <select
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
                  <label>Spółka</label>

                  <select
                    value={companyId}
                    disabled={
                      reportType === "alerts" && alertCategory === "drivers"
                    }
                    onChange={(event) => setCompanyId(event.target.value)}
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
                  <label>Oddział</label>

                  <select
                    value={branch}
                    disabled={
                      reportType === "alerts" && alertCategory === "drivers"
                    }
                    onChange={(event) => setBranch(event.target.value)}
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
                  <label>Pojazd</label>

                  <select
                    value={vehicleId}
                    disabled={
                      reportType === "alerts" && alertCategory === "drivers"
                    }
                    onChange={(event) => setVehicleId(event.target.value)}
                  >
                    <option value="">Wszystkie pojazdy</option>

                    {filteredVehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name}
                        {" - "}
                        {vehicle.registration_number}
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
                onClick={generateStatisticsPdf}
                disabled={generating !== ""}
              >
                Generuj PDF
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">XLSX</span>

                <h3>Lista pojazdów</h3>

                <p>Pełna lista dostępnych pojazdów.</p>
              </div>

              <button
                onClick={generateVehicleXlsx}
                disabled={generating !== ""}
              >
                Generuj Excel
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">XLSX</span>

                <h3>Lista kierowców</h3>

                <p>Kierowcy, uprawnienia i terminy ważności.</p>
              </div>

              <button
                onClick={generateDriversXlsx}
                disabled={generating !== ""}
              >
                Generuj Excel
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">XLSX</span>

                <h3>Historia serwisowa</h3>

                <p>Wszystkie wpisy dotyczące serwisów i napraw.</p>
              </div>

              <button
                onClick={generateServiceXlsx}
                disabled={generating !== ""}
              >
                Generuj Excel
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">PDF</span>

                <h3>Wymagają uwagi</h3>

                <p>Szybki raport wszystkich aktualnych alertów.</p>
              </div>

              <button onClick={generateAlertsPdf} disabled={generating !== ""}>
                Generuj PDF
              </button>
            </div>

            <div className="report-card">
              <div>
                <span className="report-card-type">XLSX</span>

                <h3>Alerty</h3>

                <p>Wszystkie aktualne alerty w Excelu.</p>
              </div>

              <button onClick={generateAlertsXlsx} disabled={generating !== ""}>
                Generuj Excel
              </button>
            </div>

            <div className="report-card report-card-navigation">
              <div>
                <span className="report-card-type">PDF</span>

                <h3>Karta pojazdu</h3>

                <p>Szczegółowy raport konkretnego pojazdu.</p>
              </div>

              <button onClick={() => navigate("/vehicles")}>
                Wybierz pojazd
              </button>
            </div>

            <div className="report-card report-card-navigation">
              <div>
                <span className="report-card-type">PDF</span>

                <h3>Karta kierowcy</h3>

                <p>Szczegółowy raport konkretnego kierowcy.</p>
              </div>

              <button onClick={() => navigate("/drivers")}>
                Wybierz kierowcę
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ReportsPage;
