import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./ServiceHistoryPage.css";

function ServiceHistoryPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, canEditCompany } = useAuth();

  const [serviceRecords, setServiceRecords] = useState([]);
  const [totalServiceRecords, setTotalServiceRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [costMin, setCostMin] = useState("");
  const [costMax, setCostMax] = useState("");
  const [sortField, setSortField] = useState("service_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(false);

  const pageSize = 20;

  const canAddServiceRecord =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  const buildServiceParams = (page = currentPage) => {
    const params = {
      page,
      page_size: pageSize,
    };

    const search = searchText.trim();

    if (search) params.search = search;
    if (selectedVehicle) params.vehicle = selectedVehicle;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (costMin !== "") params.cost_min = costMin;
    if (costMax !== "") params.cost_max = costMax;

    if (sortField) {
      params.ordering = sortDirection === "desc" ? `-${sortField}` : sortField;
    }

    return params;
  };

  const loadServiceRecords = async (page = currentPage) => {
    try {
      setLoading(true);

      const response = await apiClient.get("service-records/", {
        params: buildServiceParams(page),
      });

      const responseData = response.data;

      const data = Array.isArray(responseData)
        ? responseData
        : responseData?.results || [];

      const count = Array.isArray(responseData)
        ? responseData.length
        : responseData?.count || 0;

      setServiceRecords(data);
      setTotalServiceRecords(count);
      setError(null);
    } catch (err) {
      console.error("Błąd pobierania historii napraw:", err);
      setServiceRecords([]);
      setTotalServiceRecords(0);
      setError("Nie udało się pobrać historii napraw.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadVehicles = async () => {
      try {
        const vehiclesData = await fetchAllPages(apiClient, "vehicles/");

        if (!active) return;

        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania pojazdów:", err);
        setVehicles([]);
      }
    };

    loadVehicles();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadServiceRecords(currentPage);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentPage,
    searchText,
    selectedVehicle,
    dateFrom,
    dateTo,
    costMin,
    costMax,
    sortField,
    sortDirection,
  ]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !deletingRecord) {
        setRecordToDelete(null);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [deletingRecord]);

  const getVehicle = (vehicleId) =>
    vehicles.find((vehicle) => Number(vehicle.id) === Number(vehicleId));

  const formatDate = (date) => {
    if (!date) return "Nie podano";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Nie podano";
    }

    return parsedDate.toLocaleDateString("pl-PL");
  };

  const formatMileage = (mileage) => {
    if (mileage === null || mileage === undefined || mileage === "") {
      return "Nie podano";
    }

    const value = Number(mileage);

    if (!Number.isFinite(value)) {
      return "Nie podano";
    }

    return `${value.toLocaleString("pl-PL")} km`;
  };

  const formatCost = (cost) => {
    const value = Number(cost);

    if (!Number.isFinite(value)) {
      return "0,00 zł";
    }

    return `${value.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  };

  const handleSort = (field) => {
    setCurrentPage(1);

    if (sortField === field) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortArrow = (field) => {
    if (sortField !== field) return "";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const clearFilters = () => {
    setCurrentPage(1);
    setSearchText("");
    setSelectedVehicle("");
    setDateFrom("");
    setDateTo("");
    setCostMin("");
    setCostMax("");
  };

  const filtersActive =
    searchText.trim() !== "" ||
    selectedVehicle !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    costMin !== "" ||
    costMax !== "";

  const confirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      setDeletingRecord(true);
      setError(null);

      await apiClient.delete(`service-records/${recordToDelete.id}/`);

      setRecordToDelete(null);

      if (serviceRecords.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadServiceRecords(currentPage);
      }
    } catch (err) {
      console.error("Błąd usuwania wpisu:", err);
      setError("Nie udało się usunąć wpisu.");
    } finally {
      setDeletingRecord(false);
    }
  };

  const getExportFilename = (response) => {
    const contentDisposition = response.headers?.["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i,
      );

      if (filenameMatch?.[1]) {
        try {
          return decodeURIComponent(filenameMatch[1].replace(/"/g, ""));
        } catch {
          return filenameMatch[1].replace(/"/g, "");
        }
      }
    }

    return `flotivo-historia-serwisowa-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
  };

  const handleExport = async () => {
    if (totalServiceRecords === 0) {
      setError("Brak wpisów do wyeksportowania.");
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const exportParams = buildServiceParams(1);

      delete exportParams.page;
      delete exportParams.page_size;

      const response = await apiClient.post(
        "service-records/export/",
        { service_record_ids: [] },
        {
          responseType: "blob",
          params: exportParams,
        },
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = getExportFilename(response);

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Błąd eksportu historii napraw:", err);
      setError("Nie udało się wyeksportować historii napraw.");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalServiceRecords / pageSize));

  useEffect(() => {
    if (currentPage > totalPages && totalServiceRecords > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, totalServiceRecords]);

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="service-history-header">
          <div>
            <h1>Historia napraw</h1>
            <p>
              Wszystkie naprawy i serwisy pojazdów znajdujących się we flocie.
            </p>
          </div>

          <div className="service-history-header-actions">
            <button
              type="button"
              className="service-history-export"
              onClick={handleExport}
              disabled={exporting || totalServiceRecords === 0}
            >
              {exporting ? "Eksportowanie..." : "Eksportuj"}
            </button>

            {canAddServiceRecord && (
              <button
                type="button"
                className="service-history-add"
                onClick={() => navigate("/service-history/add")}
              >
                + Dodaj wpis
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="service-history-error" role="alert">
            {error}
          </div>
        )}

        <div className="service-history-tools">
          <div className="service-history-search-row">
            <div className="service-history-search-wrapper">
              <input
                className="service-history-search"
                type="search"
                value={searchText}
                onChange={(event) => {
                  setCurrentPage(1);
                  setSearchText(event.target.value);
                }}
                placeholder="Szukaj po pojeździe, rejestracji, naprawie lub opisie..."
              />

              {searchText && (
                <button
                  type="button"
                  className="service-history-search-clear"
                  onClick={() => {
                    setCurrentPage(1);
                    setSearchText("");
                  }}
                  aria-label="Wyczyść wyszukiwanie"
                >
                  ×
                </button>
              )}
            </div>

            <select
              className="service-history-vehicle-filter"
              value={selectedVehicle}
              onChange={(event) => {
                setCurrentPage(1);
                setSelectedVehicle(event.target.value);
              }}
            >
              <option value="">Wszystkie pojazdy</option>

              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")} -{" "}
                  {vehicle.registration_number || "Brak rejestracji"}
                </option>
              ))}
            </select>

            {filtersActive && (
              <button
                type="button"
                className="service-history-clear"
                onClick={clearFilters}
              >
                Wyczyść filtry
              </button>
            )}
          </div>

          <div className="service-history-filters">
            <div className="service-history-filter-group">
              <label htmlFor="service-date-from">Data od</label>
              <input
                id="service-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setCurrentPage(1);
                  setDateFrom(event.target.value);
                }}
              />
            </div>

            <div className="service-history-filter-group">
              <label htmlFor="service-date-to">Data do</label>
              <input
                id="service-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setCurrentPage(1);
                  setDateTo(event.target.value);
                }}
              />
            </div>

            <div className="service-history-filter-group">
              <label htmlFor="service-cost-min">Koszt od</label>
              <input
                id="service-cost-min"
                type="number"
                min="0"
                step="0.01"
                value={costMin}
                onChange={(event) => {
                  setCurrentPage(1);
                  setCostMin(event.target.value);
                }}
                placeholder="0,00"
              />
            </div>

            <div className="service-history-filter-group">
              <label htmlFor="service-cost-max">Koszt do</label>
              <input
                id="service-cost-max"
                type="number"
                min="0"
                step="0.01"
                value={costMax}
                onChange={(event) => {
                  setCurrentPage(1);
                  setCostMax(event.target.value);
                }}
                placeholder="np. 5000"
              />
            </div>
          </div>
        </div>

        <div className="service-history-count">
          {loading
            ? "Ładowanie historii napraw..."
            : `Na tej stronie: ${serviceRecords.length} • Znaleziono: ${totalServiceRecords}`}
        </div>

        <div className="service-history-table">
          <div className="service-history-table-header">
            <button
              type="button"
              className="service-history-sort-button"
              onClick={() => handleSort("vehicle")}
            >
              Pojazd <span>{getSortArrow("vehicle")}</span>
            </button>

            <span>Naprawa</span>

            <button
              type="button"
              className="service-history-sort-button"
              onClick={() => handleSort("service_date")}
            >
              Data <span>{getSortArrow("service_date")}</span>
            </button>

            <button
              type="button"
              className="service-history-sort-button"
              onClick={() => handleSort("mileage")}
            >
              Przebieg <span>{getSortArrow("mileage")}</span>
            </button>

            <button
              type="button"
              className="service-history-sort-button"
              onClick={() => handleSort("cost")}
            >
              Koszt <span>{getSortArrow("cost")}</span>
            </button>

            <span>Akcje</span>
          </div>

          {!loading &&
            serviceRecords.map((record) => {
              const vehicle = getVehicle(record.vehicle);
              const canEditRecord = vehicle && canEditCompany(vehicle.company);

              return (
                <div
                  className="service-history-row"
                  key={record.id}
                  onClick={() => navigate(`/vehicles/${record.vehicle}`)}
                >
                  <div className="service-history-vehicle">
                    <span className="service-history-vehicle-name">
                      {vehicle
                        ? [vehicle.brand, vehicle.model]
                            .filter(Boolean)
                            .join(" ") || "Nieznany pojazd"
                        : "Nieznany pojazd"}
                    </span>

                    <span className="service-history-registration">
                      {vehicle?.registration_number || "Brak rejestracji"}
                    </span>
                  </div>

                  <div className="service-history-repair">
                    <span className="service-history-title">
                      {record.title || "Bez nazwy"}
                    </span>

                    <span className="service-history-description">
                      {record.description || "Brak opisu"}
                    </span>
                  </div>

                  <span>{formatDate(record.service_date)}</span>
                  <span>{formatMileage(record.mileage)}</span>
                  <strong>{formatCost(record.cost)}</strong>

                  <div className="service-history-actions">
                    {canEditRecord && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/service-history/${record.id}/edit`);
                          }}
                        >
                          Edytuj
                        </button>

                        <button
                          type="button"
                          className="service-history-delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            setRecordToDelete(record);
                          }}
                        >
                          Usuń
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

          {loading && (
            <div className="service-history-empty">
              Ładowanie historii napraw...
            </div>
          )}

          {!loading && serviceRecords.length === 0 && (
            <div className="service-history-empty">
              {filtersActive
                ? "Nie znaleziono wpisów spełniających wybrane kryteria."
                : "Brak wpisów w historii napraw."}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="service-history-pagination">
            <button
              type="button"
              className="service-history-pagination-button"
              onClick={() => setCurrentPage((page) => page - 1)}
              disabled={currentPage <= 1 || loading}
            >
              ← Poprzednia
            </button>

            <span className="service-history-pagination-info">
              Strona {currentPage} z {totalPages}
            </span>

            <button
              type="button"
              className="service-history-pagination-button"
              onClick={() => setCurrentPage((page) => page + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              Następna →
            </button>
          </div>
        )}

        {recordToDelete && (
          <div className="service-delete-overlay">
            <div
              className="service-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="service-delete-title"
            >
              <div className="service-delete-icon">!</div>

              <h2 id="service-delete-title">Usunąć wpis?</h2>

              <p>
                Czy na pewno chcesz usunąć wpis
                <strong> {recordToDelete.title || "serwisowy"}</strong>?
              </p>

              <p className="service-delete-warning">
                Wpis zostanie usunięty z historii napraw.
              </p>

              <div className="service-delete-actions">
                <button
                  type="button"
                  className="service-delete-cancel"
                  onClick={() => setRecordToDelete(null)}
                  disabled={deletingRecord}
                >
                  Anuluj
                </button>

                <button
                  type="button"
                  className="service-delete-confirm"
                  onClick={confirmDelete}
                  disabled={deletingRecord}
                >
                  {deletingRecord ? "Usuwanie..." : "Usuń wpis"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ServiceHistoryPage;
