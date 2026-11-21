import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import "./StatisticsPage.css";

function StatisticsPage({ onLogout }) {
  const [vehicles, setVehicles] = useState([]);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showVehicleFilter, setShowVehicleFilter] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  const vehicleFilterRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [vehiclesData, serviceData] = await Promise.all([
          fetchAllPages(apiClient, "vehicles/"),
          fetchAllPages(apiClient, "service-records/"),
        ]);

        if (!active) return;

        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
        setServiceRecords(Array.isArray(serviceData) ? serviceData : []);
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania danych statystyk:", err);
        setVehicles([]);
        setServiceRecords([]);
        setError("Nie udało się pobrać danych do statystyk.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        vehicleFilterRef.current &&
        !vehicleFilterRef.current.contains(event.target)
      ) {
        setShowVehicleFilter(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowVehicleFilter(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const normalizedVehicleSearch = vehicleSearch.toLowerCase().trim();

  const visibleVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      if (!normalizedVehicleSearch) {
        return true;
      }

      const searchValue = [
        vehicle.brand,
        vehicle.model,
        vehicle.registration_number,
        vehicle.vin,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchValue.includes(normalizedVehicleSearch);
    });
  }, [vehicles, normalizedVehicleSearch]);

  const toggleVehicle = (vehicleId) => {
    setSelectedVehicleIds((currentIds) => {
      if (currentIds.includes(vehicleId)) {
        return currentIds.filter((id) => id !== vehicleId);
      }

      return [...currentIds, vehicleId];
    });
  };

  const clearSelectedVehicles = () => {
    setSelectedVehicleIds([]);
  };

  const filteredRecords = useMemo(() => {
    if (selectedVehicleIds.length === 0) {
      return serviceRecords;
    }

    return serviceRecords.filter((record) =>
      selectedVehicleIds.some(
        (vehicleId) => Number(vehicleId) === Number(record.vehicle),
      ),
    );
  }, [serviceRecords, selectedVehicleIds]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const dateA = new Date(a.service_date || 0);
      const dateB = new Date(b.service_date || 0);

      const timeA = Number.isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const timeB = Number.isNaN(dateB.getTime()) ? 0 : dateB.getTime();

      return timeB - timeA;
    });
  }, [filteredRecords]);

  const totalCost = useMemo(() => {
    return filteredRecords.reduce((sum, record) => {
      const cost = Number(record.cost);

      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
  }, [filteredRecords]);

  const averageCost = useMemo(() => {
    if (filteredRecords.length === 0) {
      return 0;
    }

    return totalCost / filteredRecords.length;
  }, [filteredRecords, totalCost]);

  const mostExpensiveRecord = useMemo(() => {
    if (filteredRecords.length === 0) {
      return null;
    }

    return filteredRecords.reduce((mostExpensive, record) => {
      const currentCost = Number(record.cost);
      const mostExpensiveCost = Number(mostExpensive?.cost);

      const safeCurrentCost = Number.isFinite(currentCost) ? currentCost : 0;
      const safeMostExpensiveCost = Number.isFinite(mostExpensiveCost)
        ? mostExpensiveCost
        : 0;

      return safeCurrentCost > safeMostExpensiveCost ? record : mostExpensive;
    }, filteredRecords[0]);
  }, [filteredRecords]);

  const getVehicle = (vehicleId) => {
    return vehicles.find((vehicle) => Number(vehicle.id) === Number(vehicleId));
  };

  const getVehicleName = (vehicle) => {
    if (!vehicle) {
      return "Nieznany pojazd";
    }

    return (
      [vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
      "Nieznany pojazd"
    );
  };

  const getVehicleFilterText = () => {
    if (selectedVehicleIds.length === 0) {
      return "Wszystkie pojazdy";
    }

    if (selectedVehicleIds.length === 1) {
      const vehicle = getVehicle(selectedVehicleIds[0]);

      return vehicle ? getVehicleName(vehicle) : "1 pojazd";
    }

    return `${selectedVehicleIds.length} wybrane`;
  };

  const formatCost = (value) => {
    const number = Number(value);

    return `${(Number.isFinite(number) ? number : 0).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  };

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Nie podano";
    }

    return parsedDate.toLocaleDateString("pl-PL");
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

    return `flotivo-raport-statystyczny-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
  };

  const handleExportPdf = async () => {
    if (exportingPdf || loading) {
      return;
    }

    if (filteredRecords.length === 0) {
      setError("Brak danych do wygenerowania raportu statystycznego.");
      return;
    }

    try {
      setExportingPdf(true);
      setError(null);

      const response = await apiClient.post(
        "vehicles/statistics-pdf/",
        {
          vehicle_ids: selectedVehicleIds,
        },
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: "application/pdf",
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
      console.error("Błąd eksportu statystyk:", err);
      setError("Nie udało się wygenerować raportu statystycznego.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="statistics-header">
          <div>
            <h1>Statystyki</h1>
            <p>Analiza kosztów napraw i serwisów pojazdów.</p>
          </div>

          <button
            type="button"
            className="statistics-export-button"
            onClick={handleExportPdf}
            disabled={exportingPdf || loading || filteredRecords.length === 0}
          >
            {exportingPdf ? "Generowanie..." : "Eksportuj raport PDF"}
          </button>
        </div>

        {error && (
          <div className="statistics-error" role="alert">
            {error}
          </div>
        )}

        <div className="statistics-filter-card">
          <span className="statistics-filter-label">Pojazdy</span>

          <div className="statistics-vehicle-filter" ref={vehicleFilterRef}>
            <button
              type="button"
              className={`statistics-filter-button ${
                selectedVehicleIds.length > 0 ? "statistics-filter-active" : ""
              }`}
              onClick={() =>
                setShowVehicleFilter((currentValue) => !currentValue)
              }
              disabled={loading}
            >
              <span>{getVehicleFilterText()}</span>
              <span>{showVehicleFilter ? "▲" : "▼"}</span>
            </button>

            {showVehicleFilter && (
              <div className="statistics-filter-menu">
                <div className="statistics-filter-menu-header">
                  <span>Wybierz pojazdy</span>

                  {selectedVehicleIds.length > 0 && (
                    <button type="button" onClick={clearSelectedVehicles}>
                      Wyczyść
                    </button>
                  )}
                </div>

                <div className="statistics-filter-search">
                  <input
                    type="search"
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder="Szukaj po marce, modelu lub rejestracji..."
                    autoComplete="off"
                  />
                </div>

                <label className="statistics-filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedVehicleIds.length === 0}
                    onChange={clearSelectedVehicles}
                  />
                  <span>Wszystkie pojazdy</span>
                </label>

                <div className="statistics-filter-divider" />

                <div className="statistics-filter-options">
                  {visibleVehicles.map((vehicle) => (
                    <label
                      className="statistics-filter-checkbox-row"
                      key={vehicle.id}
                    >
                      <input
                        type="checkbox"
                        checked={selectedVehicleIds.includes(vehicle.id)}
                        onChange={() => toggleVehicle(vehicle.id)}
                      />

                      <div className="statistics-filter-vehicle-info">
                        <span>{getVehicleName(vehicle)}</span>
                        <strong>
                          {vehicle.registration_number || "Brak rejestracji"}
                        </strong>
                      </div>
                    </label>
                  ))}

                  {visibleVehicles.length === 0 && (
                    <div className="statistics-filter-empty">
                      Nie znaleziono pojazdu.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="statistics-cards">
          <div className="statistics-card">
            <span>Łączny koszt napraw</span>
            <strong>{loading ? "–" : formatCost(totalCost)}</strong>
          </div>

          <div className="statistics-card">
            <span>Liczba napraw</span>
            <strong>{loading ? "–" : filteredRecords.length}</strong>
          </div>

          <div className="statistics-card">
            <span>Średni koszt naprawy</span>
            <strong>{loading ? "–" : formatCost(averageCost)}</strong>
          </div>

          <div className="statistics-card">
            <span>Najdroższa naprawa</span>
            <strong>
              {loading
                ? "–"
                : mostExpensiveRecord
                  ? formatCost(mostExpensiveRecord.cost)
                  : formatCost(0)}
            </strong>
          </div>
        </div>

        <div className="statistics-table-card">
          <div className="statistics-table-header-top">
            <div>
              <h2>Historia kosztów</h2>
              <p>Naprawy uwzględnione w aktualnych statystykach.</p>
            </div>

            <span>
              {loading
                ? "Ładowanie..."
                : `Liczba wpisów: ${filteredRecords.length}`}
            </span>
          </div>

          <div className="statistics-table">
            <div className="statistics-table-header">
              <span>Pojazd</span>
              <span>Naprawa</span>
              <span>Data</span>
              <span>Koszt</span>
            </div>

            {!loading &&
              sortedRecords.map((record) => {
                const vehicle = getVehicle(record.vehicle);

                return (
                  <div className="statistics-table-row" key={record.id}>
                    <div>
                      <strong>{getVehicleName(vehicle)}</strong>

                      <span>
                        {vehicle?.registration_number || "Brak rejestracji"}
                      </span>
                    </div>

                    <span>{record.title || "Bez nazwy"}</span>
                    <span>{formatDate(record.service_date)}</span>
                    <strong>{formatCost(record.cost)}</strong>
                  </div>
                );
              })}

            {loading && (
              <div className="statistics-empty">
                Ładowanie danych statystycznych...
              </div>
            )}

            {!loading && filteredRecords.length === 0 && (
              <div className="statistics-empty">
                {selectedVehicleIds.length > 0
                  ? "Brak danych dla wybranych pojazdów."
                  : "Brak danych do wyświetlenia."}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default StatisticsPage;
