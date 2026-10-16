import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./StatisticsPage.css";

function StatisticsPage({ onLogout }) {
  const [vehicles, setVehicles] = useState([]);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showVehicleFilter, setShowVehicleFilter] = useState(false);
  const [error, setError] = useState(null);

  const vehicleFilterRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [vehiclesResponse, serviceResponse] = await Promise.all([
          apiClient.get("vehicles/"),
          apiClient.get("service-records/"),
        ]);

        setVehicles(vehiclesResponse.data);
        setServiceRecords(serviceResponse.data);
      } catch (err) {
        console.error("Błąd pobierania danych statystyk:", err);
        setError("Nie udało się pobrać danych do statystyk.");
      }
    };

    loadData();
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

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const normalizedVehicleSearch = vehicleSearch.toLowerCase().trim();

  const visibleVehicles = vehicles.filter((vehicle) => {
    if (!normalizedVehicleSearch) {
      return true;
    }

    const brand = vehicle.brand?.toLowerCase() || "";
    const model = vehicle.model?.toLowerCase() || "";
    const registration = vehicle.registration_number?.toLowerCase() || "";

    return (
      brand.includes(normalizedVehicleSearch) ||
      model.includes(normalizedVehicleSearch) ||
      registration.includes(normalizedVehicleSearch)
    );
  });

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

  const totalCost = useMemo(() => {
    return filteredRecords.reduce(
      (sum, record) => sum + Number(record.cost || 0),
      0,
    );
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

    return [...filteredRecords].sort(
      (a, b) => Number(b.cost || 0) - Number(a.cost || 0),
    )[0];
  }, [filteredRecords]);

  const getVehicle = (vehicleId) => {
    return vehicles.find((vehicle) => Number(vehicle.id) === Number(vehicleId));
  };

  const getVehicleFilterText = () => {
    if (selectedVehicleIds.length === 0) {
      return "Wszystkie pojazdy";
    }

    if (selectedVehicleIds.length === 1) {
      const vehicle = getVehicle(selectedVehicleIds[0]);

      if (!vehicle) {
        return "1 pojazd";
      }

      return `${vehicle.brand} ${vehicle.model}`;
    }

    return `${selectedVehicleIds.length} wybrane`;
  };

  const formatCost = (value) => {
    return `${Number(value).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  };

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
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
        </div>

        {error && <p className="statistics-error">{error}</p>}

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
                    type="text"
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

                <div className="statistics-filter-divider"></div>

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
                        <span>
                          {vehicle.brand} {vehicle.model}
                        </span>

                        <strong>{vehicle.registration_number}</strong>
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
            <strong>{formatCost(totalCost)}</strong>
          </div>

          <div className="statistics-card">
            <span>Liczba napraw</span>
            <strong>{filteredRecords.length}</strong>
          </div>

          <div className="statistics-card">
            <span>Średni koszt naprawy</span>
            <strong>{formatCost(averageCost)}</strong>
          </div>

          <div className="statistics-card">
            <span>Najdroższa naprawa</span>

            <strong>
              {mostExpensiveRecord
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
          </div>

          <div className="statistics-table">
            <div className="statistics-table-header">
              <span>Pojazd</span>
              <span>Naprawa</span>
              <span>Data</span>
              <span>Koszt</span>
            </div>

            {filteredRecords.map((record) => {
              const vehicle = getVehicle(record.vehicle);

              return (
                <div className="statistics-table-row" key={record.id}>
                  <div>
                    <strong>
                      {vehicle
                        ? `${vehicle.brand} ${vehicle.model}`
                        : "Nieznany pojazd"}
                    </strong>

                    <span>{vehicle?.registration_number || ""}</span>
                  </div>

                  <span>{record.title}</span>

                  <span>{formatDate(record.service_date)}</span>

                  <strong>{formatCost(record.cost)}</strong>
                </div>
              );
            })}

            {filteredRecords.length === 0 && (
              <div className="statistics-empty">
                Brak danych do wyświetlenia.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default StatisticsPage;
