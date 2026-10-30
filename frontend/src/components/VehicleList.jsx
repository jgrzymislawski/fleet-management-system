import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
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
  const [selectedBranches, setSelectedBranches] = useState([]);

  const [searchText, setSearchText] = useState("");

  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const [exporting, setExporting] = useState(false);

  const navigate = useNavigate();

  const { user, canEditCompany } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const recentOnly = searchParams.get("recent") === "1";

  const filtersRef = useRef(null);

  const canAddVehicle =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  useEffect(() => {
    apiClient
      .get("vehicles/")
      .then((response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : response.data.results || [];

        setVehicles(data);
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

  const getBranchName = (branch) => {
    const normalizedBranch = branch?.trim();

    if (!normalizedBranch) {
      return "Brak oddziału";
    }

    return normalizedBranch;
  };

  const formatMileage = (mileage) => {
    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortArrow = (field) => {
    if (sortField !== field) {
      return "";
    }

    return sortDirection === "asc" ? "↑" : "↓";
  };

  const brands = [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort(
    (a, b) =>
      a.localeCompare(b, "pl", {
        sensitivity: "base",
      }),
  );

  const years = [
    ...new Set(vehicles.map((vehicle) => String(vehicle.year))),
  ].sort((a, b) => Number(b) - Number(a));

  const types = [...new Set(vehicles.map((vehicle) => vehicle.vehicle_type))];

  const statuses = [...new Set(vehicles.map((vehicle) => vehicle.status))];

  const branches = [
    ...new Set(vehicles.map((vehicle) => getBranchName(vehicle.branch))),
  ].sort((a, b) =>
    a.localeCompare(b, "pl", {
      sensitivity: "base",
    }),
  );

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

    const vehicleBranch = getBranchName(vehicle.branch);

    const matchesBranch =
      selectedBranches.length === 0 || selectedBranches.includes(vehicleBranch);

    const normalizedSearchText = searchText.toLowerCase().trim();

    const brand = vehicle.brand?.toLowerCase() || "";

    const model = vehicle.model?.toLowerCase() || "";

    const registrationNumber = vehicle.registration_number?.toLowerCase() || "";

    const vin = vehicle.vin?.toLowerCase() || "";

    const branch = vehicle.branch?.toLowerCase().trim() || "";

    const matchesSearch =
      normalizedSearchText === "" ||
      brand.includes(normalizedSearchText) ||
      model.includes(normalizedSearchText) ||
      registrationNumber.includes(normalizedSearchText) ||
      vin.includes(normalizedSearchText) ||
      branch.includes(normalizedSearchText);

    const thirtyDaysAgo = new Date();

    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const createdAt = new Date(vehicle.created_at);

    const matchesRecent = !recentOnly || createdAt >= thirtyDaysAgo;

    return (
      matchesBrand &&
      matchesYear &&
      matchesType &&
      matchesStatus &&
      matchesBranch &&
      matchesSearch &&
      matchesRecent
    );
  });

  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    if (!sortField) {
      return 0;
    }

    let valueA;
    let valueB;

    if (sortField === "vehicle") {
      valueA = `${a.brand} ${a.model}`;
      valueB = `${b.brand} ${b.model}`;
    } else if (sortField === "registration_number") {
      valueA = a.registration_number;
      valueB = b.registration_number;
    } else if (sortField === "vehicle_type") {
      valueA = getVehicleTypeName(a.vehicle_type);

      valueB = getVehicleTypeName(b.vehicle_type);
    } else if (sortField === "branch") {
      valueA = getBranchName(a.branch);
      valueB = getBranchName(b.branch);
    } else if (sortField === "year") {
      valueA = Number(a.year);
      valueB = Number(b.year);
    } else if (sortField === "mileage") {
      valueA = Number(a.mileage);
      valueB = Number(b.mileage);
    } else if (sortField === "status") {
      valueA = getStatusName(a.status);
      valueB = getStatusName(b.status);
    }

    if (sortField === "year" || sortField === "mileage") {
      if (sortDirection === "asc") {
        return valueA - valueB;
      }

      return valueB - valueA;
    }

    const comparison = String(valueA).localeCompare(String(valueB), "pl", {
      sensitivity: "base",
    });

    if (sortDirection === "asc") {
      return comparison;
    }

    return -comparison;
  });

  const clearAllFilters = () => {
    setSelectedBrands([]);
    setSelectedYears([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedBranches([]);
    setSearchText("");
  };

  const filtersAreActive =
    selectedBrands.length > 0 ||
    selectedYears.length > 0 ||
    selectedTypes.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedBranches.length > 0 ||
    searchText.trim() !== "";

  const getExportFilename = (response) => {
    const contentDisposition = response.headers["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);

      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    return `flotivo-pojazdy-${today}.xlsx`;
  };

  const handleExport = async () => {
    if (sortedVehicles.length === 0) {
      setError("Brak pojazdów do wyeksportowania.");

      return;
    }

    try {
      setExporting(true);
      setError(null);

      const vehicleIds = sortedVehicles.map((vehicle) => vehicle.id);

      const response = await apiClient.post(
        "vehicles/export/",
        {
          vehicle_ids: vehicleIds,
        },
        {
          responseType: "blob",
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
      console.error("Błąd eksportu pojazdów:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się wyeksportować pojazdów.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="vehicles">
      <div className="vehicles-header">
        <div>
          <h1>Pojazdy</h1>

          <p>Zarządzaj pojazdami znajdującymi się w Twojej flocie.</p>
        </div>

        <div className="vehicles-header-actions">
          <button
            className="export-vehicles-button"
            onClick={handleExport}
            disabled={exporting || sortedVehicles.length === 0}
          >
            {exporting ? "Eksportowanie..." : "Eksportuj"}
          </button>

          {canAddVehicle && (
            <button
              className="add-vehicle-button"
              onClick={() => navigate("/vehicles/add")}
            >
              + Dodaj pojazd
            </button>
          )}
        </div>
      </div>

      {error && <p className="vehicles-error">{error}</p>}

      <div className="vehicles-search">
        <input
          type="text"
          placeholder="Szukaj po marce, modelu, rejestracji, VIN lub oddziale..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />

        {searchText && (
          <button
            className="vehicles-search-clear"
            onClick={() => setSearchText("")}
            title="Wyczyść wyszukiwanie"
          >
            ×
          </button>
        )}
      </div>

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
          <span className="vehicles-filter-label">Oddział</span>

          <div className="filter-dropdown">
            <button
              className={`filter-dropdown-button ${
                selectedBranches.length > 0 ? "filter-active" : ""
              }`}
              onClick={() => handleFilterClick("branch")}
            >
              <span>
                {getFilterText(selectedBranches, "Wszystkie oddziały")}
              </span>

              <span className="filter-arrow">
                {openFilter === "branch" ? "▲" : "▼"}
              </span>
            </button>

            {openFilter === "branch" && (
              <div className="filter-dropdown-menu">
                <div className="filter-dropdown-header">
                  <span>Wybierz oddziały</span>

                  {selectedBranches.length > 0 && (
                    <button
                      className="filter-clear-button"
                      onClick={() => setSelectedBranches([])}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedBranches.length === 0}
                    onChange={() => setSelectedBranches([])}
                  />

                  <span>Wszystkie oddziały</span>
                </label>

                <div className="filter-divider"></div>

                {branches.map((branch) => (
                  <label className="filter-checkbox-row" key={branch}>
                    <input
                      type="checkbox"
                      checked={selectedBranches.includes(branch)}
                      onChange={() =>
                        toggleSelectedValue(
                          branch,
                          selectedBranches,
                          setSelectedBranches,
                        )
                      }
                    />

                    <span>{branch}</span>
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

      {recentOnly && (
        <div className="vehicles-recent-filter">
          <span>Pojazdy dodane w ostatnich 30 dniach</span>

          <button onClick={() => setSearchParams({})}>Pokaż wszystkie</button>
        </div>
      )}

      <div className="vehicles-results-info">
        Wyświetlono {filteredVehicles.length} z {vehicles.length} pojazdów
      </div>

      <div className="vehicles-table">
        <div className="vehicles-table-header">
          <button
            className={`table-sort-button ${
              sortField === "vehicle" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("vehicle")}
          >
            Pojazd
            <span>{getSortArrow("vehicle")}</span>
          </button>

          <button
            className={`table-sort-button ${
              sortField === "registration_number" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("registration_number")}
          >
            Rejestracja
            <span>{getSortArrow("registration_number")}</span>
          </button>

          <button
            className={`table-sort-button ${
              sortField === "vehicle_type" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("vehicle_type")}
          >
            Typ
            <span>{getSortArrow("vehicle_type")}</span>
          </button>

          <button
            className={`table-sort-button ${
              sortField === "branch" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("branch")}
          >
            Oddział
            <span>{getSortArrow("branch")}</span>
          </button>

          <button
            className={`table-sort-button ${
              sortField === "year" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("year")}
          >
            Rok
            <span>{getSortArrow("year")}</span>
          </button>

          <button
            className={`table-sort-button ${
              sortField === "mileage" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("mileage")}
          >
            Przebieg
            <span>{getSortArrow("mileage")}</span>
          </button>

          <button
            className={`table-sort-button ${
              sortField === "status" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("status")}
          >
            Status
            <span>{getSortArrow("status")}</span>
          </button>

          <span>Akcje</span>
        </div>

        {sortedVehicles.map((vehicle) => (
          <div className="vehicles-table-row" key={vehicle.id}>
            <span className="vehicle-name">
              {vehicle.brand} {vehicle.model}
            </span>

            <span>{vehicle.registration_number}</span>

            <span>{getVehicleTypeName(vehicle.vehicle_type)}</span>

            <span>{getBranchName(vehicle.branch)}</span>

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

                  {canEditCompany(vehicle.company) && (
                    <>
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
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {sortedVehicles.length === 0 && (
          <div className="vehicles-empty">
            Brak pojazdów spełniających wybrane kryteria.
          </div>
        )}
      </div>
    </div>
  );
}

export default VehicleList;
