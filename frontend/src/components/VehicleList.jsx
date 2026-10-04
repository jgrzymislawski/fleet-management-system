import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import "./VehicleList.css";

function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  const navigate = useNavigate();
  const filtersRef = useRef(null);
  useEffect(() => {
    apiClient
      .get("vehicles/")
      .then((response) => {
        setVehicles(response.data);
      })
      .catch((err) => {
        console.error(err);
        setError("Nie udało się pobrać listy pojazdów");
      });
  }, []);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setOpenFilter(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const handleMenuClick = (vehicleId) => {
    if (openMenuId === vehicleId) {
      setOpenMenuId(null);
    } else {
      setOpenMenuId(vehicleId);
    }
  };

  const handleFilterClick = (filterName) => {
    if (openFilter === filterName) {
      setOpenFilter(null);
    } else {
      setOpenFilter(filterName);
    }
  };

  const handleDelete = (vehicle) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć pojazd ${vehicle.brand} ${vehicle.model} (${vehicle.registration_number})?`,
    );

    if (!confirmed) {
      return;
    }

    apiClient
      .delete(`vehicles/${vehicle.id}/`)
      .then(() => {
        setVehicles((currentVehicles) =>
          currentVehicles.filter(
            (currentVehicle) => currentVehicle.id !== vehicle.id,
          ),
        );

        setOpenMenuId(null);
      })
      .catch((err) => {
        console.error("Błąd usuwania pojazdu:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się usunąć pojazdu.");
      });
  };

  const toggleSelectedValue = (value, selectedValues, setSelectedValues) => {
    if (selectedValues.includes(value)) {
      setSelectedValues(
        selectedValues.filter((selectedValue) => selectedValue !== value),
      );
    } else {
      setSelectedValues([...selectedValues, value]);
    }
  };

  const getFilterText = (selectedValues, defaultText) => {
    if (selectedValues.length === 0) {
      return defaultText;
    }

    if (selectedValues.length === 1) {
      return selectedValues[0];
    }

    return `${selectedValues.length} wybrane`;
  };

  const getStatusName = (status) => {
    if (status === "active") {
      return "Aktywny";
    }

    if (status === "maintenance") {
      return "W serwisie";
    }

    if (status === "inactive") {
      return "Nieaktywny";
    }

    return status;
  };

  const getVehicleTypeName = (type) => {
    if (type === "passenger") {
      return "Osobowy";
    }

    if (type === "van") {
      return "Bus / dostawczy";
    }

    if (type === "truck") {
      return "Ciężarowy";
    }

    if (type === "special") {
      return "Specjalny";
    }

    if (type === "other") {
      return "Inny";
    }

    return type;
  };

  const formatMileage = (mileage) => {
    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  const brands = [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort();
  const years = [
    ...new Set(vehicles.map((vehicle) => String(vehicle.year))),
  ].sort((a, b) => Number(b) - Number(a));

  const types = [...new Set(vehicles.map((vehicle) => vehicle.vehicle_type))];
  const statuses = [...new Set(vehicles.map((vehicle) => vehicle.status))];

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesBrand =
      selectedBrands.length === 0 || selectedBrands.includes(vehicle.brand);

    const matchesYear =
      selectedYears.length === 0 ||
      selectedYears.includes(String(vehicle.year));

    const matchesType =
      selectedTypes.length === 0 ||
      selectedTypes.includes(vehicle.vehicle_type);

    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(vehicle.status);

    return matchesBrand && matchesYear && matchesType && matchesStatus;
  });

  const clearAllFilters = () => {
    setSelectedBrands([]);
    setSelectedYears([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
  };

  const filtersAreActive =
    selectedBrands.length > 0 ||
    selectedYears.length > 0 ||
    selectedTypes.length > 0 ||
    selectedStatuses.length > 0;

  return (
    <div className="vehicles">
      <div className="vehicles-header">
        <div>
          <h1>Pojazdy</h1>
          <p>Zarządzaj pojazdami znajdującymi się w Twojej flocie.</p>
        </div>

        <button
          className="add-vehicle-button"
          onClick={() => navigate("/vehicles/add")}
        >
          + Dodaj pojazd
        </button>
      </div>

      {error && <p className="vehicles-error">{error}</p>}

      <div className="vehicles-filters" ref={filtersRef}>
        <div className="vehicles-filter">
          <span className="vehicles-filter-label">Marka</span>

          <div className="filter-dropdown">
            <button
              className={`filter-dropdown-button ${
                selectedBrands.length > 0 ? "filter-active" : ""
              }`}
              onClick={() => handleFilterClick("brand")}
            >
              <span>{getFilterText(selectedBrands, "Wszystkie marki")}</span>

              <span className="filter-arrow">
                {openFilter === "brand" ? "▲" : "▼"}
              </span>
            </button>

            {openFilter === "brand" && (
              <div className="filter-dropdown-menu">
                <div className="filter-dropdown-header">
                  <span>Wybierz marki</span>

                  {selectedBrands.length > 0 && (
                    <button
                      className="filter-clear-button"
                      onClick={() => setSelectedBrands([])}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedBrands.length === 0}
                    onChange={() => setSelectedBrands([])}
                  />
                  <span>Wszystkie marki</span>
                </label>

                <div className="filter-divider"></div>

                {brands.map((brand) => (
                  <label className="filter-checkbox-row" key={brand}>
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand)}
                      onChange={() =>
                        toggleSelectedValue(
                          brand,
                          selectedBrands,
                          setSelectedBrands,
                        )
                      }
                    />

                    <span>{brand}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="vehicles-filter">
          <span className="vehicles-filter-label">Rok</span>

          <div className="filter-dropdown">
            <button
              className={`filter-dropdown-button ${
                selectedYears.length > 0 ? "filter-active" : ""
              }`}
              onClick={() => handleFilterClick("year")}
            >
              <span>{getFilterText(selectedYears, "Wszystkie lata")}</span>

              <span className="filter-arrow">
                {openFilter === "year" ? "▲" : "▼"}
              </span>
            </button>

            {openFilter === "year" && (
              <div className="filter-dropdown-menu">
                <div className="filter-dropdown-header">
                  <span>Wybierz lata</span>

                  {selectedYears.length > 0 && (
                    <button
                      className="filter-clear-button"
                      onClick={() => setSelectedYears([])}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedYears.length === 0}
                    onChange={() => setSelectedYears([])}
                  />
                  <span>Wszystkie lata</span>
                </label>

                <div className="filter-divider"></div>

                {years.map((year) => (
                  <label className="filter-checkbox-row" key={year}>
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(year)}
                      onChange={() =>
                        toggleSelectedValue(
                          year,
                          selectedYears,
                          setSelectedYears,
                        )
                      }
                    />

                    <span>{year}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="vehicles-filter">
          <span className="vehicles-filter-label">Typ</span>

          <div className="filter-dropdown">
            <button
              className={`filter-dropdown-button ${
                selectedTypes.length > 0 ? "filter-active" : ""
              }`}
              onClick={() => handleFilterClick("type")}
            >
              <span>
                {selectedTypes.length === 0
                  ? "Wszystkie typy"
                  : selectedTypes.length === 1
                    ? getVehicleTypeName(selectedTypes[0])
                    : `${selectedTypes.length} wybrane`}
              </span>

              <span className="filter-arrow">
                {openFilter === "type" ? "▲" : "▼"}
              </span>
            </button>

            {openFilter === "type" && (
              <div className="filter-dropdown-menu">
                <div className="filter-dropdown-header">
                  <span>Wybierz typy</span>

                  {selectedTypes.length > 0 && (
                    <button
                      className="filter-clear-button"
                      onClick={() => setSelectedTypes([])}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedTypes.length === 0}
                    onChange={() => setSelectedTypes([])}
                  />
                  <span>Wszystkie typy</span>
                </label>

                <div className="filter-divider"></div>

                {types.map((type) => (
                  <label className="filter-checkbox-row" key={type}>
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() =>
                        toggleSelectedValue(
                          type,
                          selectedTypes,
                          setSelectedTypes,
                        )
                      }
                    />

                    <span>{getVehicleTypeName(type)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="vehicles-filter">
          <span className="vehicles-filter-label">Status</span>

          <div className="filter-dropdown">
            <button
              className={`filter-dropdown-button ${
                selectedStatuses.length > 0 ? "filter-active" : ""
              }`}
              onClick={() => handleFilterClick("status")}
            >
              <span>
                {selectedStatuses.length === 0
                  ? "Wszystkie statusy"
                  : selectedStatuses.length === 1
                    ? getStatusName(selectedStatuses[0])
                    : `${selectedStatuses.length} wybrane`}
              </span>

              <span className="filter-arrow">
                {openFilter === "status" ? "▲" : "▼"}
              </span>
            </button>

            {openFilter === "status" && (
              <div className="filter-dropdown-menu">
                <div className="filter-dropdown-header">
                  <span>Wybierz statusy</span>

                  {selectedStatuses.length > 0 && (
                    <button
                      className="filter-clear-button"
                      onClick={() => setSelectedStatuses([])}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.length === 0}
                    onChange={() => setSelectedStatuses([])}
                  />
                  <span>Wszystkie statusy</span>
                </label>

                <div className="filter-divider"></div>

                {statuses.map((status) => (
                  <label className="filter-checkbox-row" key={status}>
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() =>
                        toggleSelectedValue(
                          status,
                          selectedStatuses,
                          setSelectedStatuses,
                        )
                      }
                    />

                    <span>{getStatusName(status)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {filtersAreActive && (
          <button
            className="clear-all-filters-button"
            onClick={clearAllFilters}
          >
            Wyczyść filtry
          </button>
        )}
      </div>

      <div className="vehicles-results-info">
        Wyświetlono {filteredVehicles.length} z {vehicles.length} pojazdów
      </div>

      <div className="vehicles-table">
        <div className="vehicles-table-header">
          <span>Pojazd</span>
          <span>Rejestracja</span>
          <span>Typ</span>
          <span>Rok</span>
          <span>Przebieg</span>
          <span>Status</span>
          <span>Akcje</span>
        </div>

        {filteredVehicles.map((vehicle) => (
          <div className="vehicles-table-row" key={vehicle.id}>
            <span className="vehicle-name">
              {vehicle.brand} {vehicle.model}
            </span>

            <span>{vehicle.registration_number}</span>

            <span>{getVehicleTypeName(vehicle.vehicle_type)}</span>

            <span>{vehicle.year}</span>

            <span>{formatMileage(vehicle.mileage)}</span>

            <span className={`vehicle-status vehicle-status-${vehicle.status}`}>
              {getStatusName(vehicle.status)}
            </span>

            <div className="vehicle-actions">
              <button
                className="vehicle-actions-button"
                onClick={() => handleMenuClick(vehicle.id)}
              >
                •••
              </button>

              {openMenuId === vehicle.id && (
                <div className="vehicle-actions-menu">
                  <button onClick={() => navigate(`/vehicles/${vehicle.id}`)}>
                    Szczegóły
                  </button>

                  <button
                    onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
                  >
                    Edytuj
                  </button>

                  <div className="vehicle-actions-divider"></div>

                  <button
                    className="vehicle-actions-delete"
                    onClick={() => handleDelete(vehicle)}
                  >
                    Usuń
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredVehicles.length === 0 && (
          <div className="vehicles-empty">
            Brak pojazdów spełniających wybrane kryteria.
          </div>
        )}
      </div>
    </div>
  );
}

export default VehicleList;
