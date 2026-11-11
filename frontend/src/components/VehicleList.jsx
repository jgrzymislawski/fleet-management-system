import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import VehicleImportModal from "./VehicleImportModal";
import "./VehicleList.css";

function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [error, setError] = useState(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);

  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedBranches, setSelectedBranches] = useState([]);

  const [filterOptions, setFilterOptions] = useState({
    brands: [],
    years: [],
    vehicle_types: [],
    statuses: [],
    branches: [],
  });

  const [searchText, setSearchText] = useState("");

  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const [exporting, setExporting] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);

  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const [vehicleToDelete, setVehicleToDelete] = useState(null);
  const [deletingVehicle, setDeletingVehicle] = useState(false);

  const navigate = useNavigate();

  const { user, canEditCompany } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const recentOnly = searchParams.get("recent") === "1";

  const filtersRef = useRef(null);

  const canAddVehicle =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  const buildVehicleParams = (page = currentPage) => {
    const params = {
      page,
      page_size: pageSize,
    };

    const normalizedSearchText = searchText.trim();

    if (normalizedSearchText) {
      params.search = normalizedSearchText;
    }

    if (selectedBrands.length > 0) {
      params.brand = selectedBrands.join(",");
    }

    if (selectedYears.length > 0) {
      params.year = selectedYears.join(",");
    }

    if (selectedTypes.length > 0) {
      params.vehicle_type = selectedTypes.join(",");
    }

    if (selectedStatuses.length > 0) {
      params.status = selectedStatuses.join(",");
    }

    if (selectedBranches.length > 0) {
      params.branch = selectedBranches.join(",");
    }

    if (recentOnly) {
      params.recent = "1";
    }

    if (sortField) {
      params.ordering = sortDirection === "desc" ? `-${sortField}` : sortField;
    }

    return params;
  };

  const loadVehicles = async (page = currentPage) => {
    try {
      const response = await apiClient.get("vehicles/", {
        params: buildVehicleParams(page),
      });

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];

      const count = Array.isArray(response.data)
        ? response.data.length
        : response.data.count || 0;

      setVehicles(data);
      setTotalVehicles(count);
      setError(null);
    } catch (err) {
      console.error(err);

      setError("Nie udało się pobrać listy pojazdów");
    }
  };

  const loadFilterOptions = async () => {
    try {
      const response = await apiClient.get("vehicles/filter-options/");

      setFilterOptions({
        brands: response.data.brands || [],
        years: response.data.years || [],
        vehicle_types: response.data.vehicle_types || [],
        statuses: response.data.statuses || [],
        branches: response.data.branches || [],
      });
    } catch (err) {
      console.error("Nie udało się pobrać opcji filtrów:", err);
    }
  };

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadVehicles(currentPage);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentPage,
    searchText,
    selectedBrands,
    selectedYears,
    selectedTypes,
    selectedStatuses,
    selectedBranches,
    sortField,
    sortDirection,
    recentOnly,
  ]);

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
    setOpenMenuId(null);
    setVehicleToDelete(vehicle);
  };

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) {
      return;
    }

    try {
      setDeletingVehicle(true);
      setError(null);

      await apiClient.delete(`vehicles/${vehicleToDelete.id}/`);

      setVehicleToDelete(null);

      if (vehicles.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadVehicles(currentPage);
      }
    } catch (err) {
      console.error("Błąd usuwania pojazdu:", err);
      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się usunąć pojazdu.");
    } finally {
      setDeletingVehicle(false);
    }
  };

  const toggleSelectedValue = (value, selectedValues, setSelectedValues) => {
    setCurrentPage(1);

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

  const formatExpiryDate = (date) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  const getExpiryStatus = (date) => {
    if (!date) {
      return {
        text: "Brak terminu",
        className: "vehicle-expiry-none",
      };
    }

    const today = new Date();
    const expiryDate = new Date(date);

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const difference = expiryDate - today;
    const daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return {
        text: "Po terminie",
        className: "vehicle-expiry-expired",
      };
    }

    if (daysLeft === 0) {
      return {
        text: "Dzisiaj",
        className: "vehicle-expiry-warning",
      };
    }

    if (daysLeft <= 30) {
      return {
        text: `Za ${daysLeft} dni`,
        className: "vehicle-expiry-warning",
      };
    }

    return {
      text: "Ważne",
      className: "vehicle-expiry-valid",
    };
  };

  const handleSort = (field) => {
    setCurrentPage(1);

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

  const brands = filterOptions.brands;

  const years = filterOptions.years.map((year) => String(year));

  const types = filterOptions.vehicle_types;

  const statuses = filterOptions.statuses;

  const branches = filterOptions.branches;

  const sortedVehicles = vehicles;

  const totalPages = Math.max(1, Math.ceil(totalVehicles / pageSize));

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setSelectedVehicleIds([]);
      setCurrentPage((page) => page - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setSelectedVehicleIds([]);
      setCurrentPage((page) => page + 1);
    }
  };

  const editableVisibleVehicleIds = sortedVehicles
    .filter((vehicle) => canEditCompany(vehicle.company))
    .map((vehicle) => vehicle.id);

  const allVisibleEditableSelected =
    editableVisibleVehicleIds.length > 0 &&
    editableVisibleVehicleIds.every((vehicleId) =>
      selectedVehicleIds.includes(vehicleId),
    );

  const editableCompanies = (user?.companies || [])
    .filter((company) => user?.role === "admin" || company.role === "editor")
    .sort((a, b) =>
      a.name.localeCompare(b.name, "pl", {
        sensitivity: "base",
      }),
    );

  const toggleVehicleSelection = (vehicleId) => {
    setBulkResult(null);

    setSelectedVehicleIds((currentIds) => {
      if (currentIds.includes(vehicleId)) {
        return currentIds.filter((id) => id !== vehicleId);
      }

      return [...currentIds, vehicleId];
    });
  };

  const toggleAllVisibleVehicles = () => {
    setBulkResult(null);

    setSelectedVehicleIds((currentIds) => {
      if (allVisibleEditableSelected) {
        return currentIds.filter(
          (id) => !editableVisibleVehicleIds.includes(id),
        );
      }

      return [...new Set([...currentIds, ...editableVisibleVehicleIds])];
    });
  };

  const clearVehicleSelection = () => {
    setSelectedVehicleIds([]);
    setBulkResult(null);
  };

  const openBulkModal = (action) => {
    setBulkResult(null);
    setBulkAction(action);

    if (action === "change_status") {
      setBulkValue("active");
    } else {
      setBulkValue("");
    }
  };

  const closeBulkModal = () => {
    if (bulkUpdating) {
      return;
    }

    setBulkAction(null);
    setBulkValue("");
  };

  const getBulkModalTitle = () => {
    if (bulkAction === "change_status") {
      return "Masowa zmiana statusu";
    }

    if (bulkAction === "change_company") {
      return "Masowa zmiana spółki";
    }

    if (bulkAction === "change_branch") {
      return "Masowa zmiana oddziału";
    }

    if (bulkAction === "delete") {
      return "Usuń zaznaczone pojazdy";
    }

    return "Operacja masowa";
  };

  const handleBulkUpdate = async () => {
    if (selectedVehicleIds.length === 0 || !bulkAction) {
      return;
    }

    if (bulkAction === "change_company" && bulkValue === "") {
      setError("Wybierz spółkę.");
      return;
    }

    try {
      setBulkUpdating(true);
      setError(null);
      setBulkResult(null);

      let value = bulkValue;

      if (bulkAction === "change_company") {
        value = bulkValue === "none" ? null : Number(bulkValue);
      }

      const response = await apiClient.post("vehicles/bulk-update/", {
        vehicle_ids: selectedVehicleIds,
        action: bulkAction,
        value,
      });

      setBulkResult(response.data);
      setBulkAction(null);
      setBulkValue("");
      setSelectedVehicleIds([]);

      if (
        bulkAction === "delete" &&
        vehicles.length > 0 &&
        response.data.deleted >= vehicles.length &&
        currentPage > 1
      ) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadVehicles(currentPage);
      }
    } catch (err) {
      console.error("Błąd operacji masowej:", err);
      console.error("Odpowiedź backendu:", err.response?.data);

      setError(
        err.response?.data?.detail || "Nie udało się wykonać operacji masowej.",
      );
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedVehicleIds.length === 0) {
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const response = await apiClient.post(
        "vehicles/export/",
        {
          vehicle_ids: selectedVehicleIds,
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
      console.error("Błąd eksportu zaznaczonych pojazdów:", err);
      setError("Nie udało się wyeksportować zaznaczonych pojazdów.");
    } finally {
      setExporting(false);
    }
  };

  const clearAllFilters = () => {
    setCurrentPage(1);

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
    if (totalVehicles === 0) {
      setError("Brak pojazdów do wyeksportowania.");

      return;
    }

    try {
      setExporting(true);
      setError(null);

      const exportParams = buildVehicleParams(1);

      delete exportParams.page;
      delete exportParams.page_size;

      const response = await apiClient.post(
        "vehicles/export/",
        {
          vehicle_ids: [],
        },
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
            disabled={exporting || totalVehicles === 0}
          >
            {exporting ? "Eksportowanie..." : "Eksportuj"}
          </button>

          {canAddVehicle && (
            <button
              className="export-vehicles-button"
              onClick={() => setImportModalOpen(true)}
            >
              Importuj
            </button>
          )}

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
          onChange={(event) => {
            setCurrentPage(1);
            setSearchText(event.target.value);
          }}
        />

        {searchText && (
          <button
            className="vehicles-search-clear"
            onClick={() => {
              setCurrentPage(1);
              setSearchText("");
            }}
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
                      onClick={() => {
                        setCurrentPage(1);
                        setSelectedBrands([]);
                      }}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedBrands.length === 0}
                    onChange={() => {
                      setCurrentPage(1);
                      setSelectedBrands([]);
                    }}
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
                      onClick={() => {
                        setCurrentPage(1);
                        setSelectedYears([]);
                      }}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedYears.length === 0}
                    onChange={() => {
                      setCurrentPage(1);
                      setSelectedYears([]);
                    }}
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
                      onClick={() => {
                        setCurrentPage(1);
                        setSelectedTypes([]);
                      }}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedTypes.length === 0}
                    onChange={() => {
                      setCurrentPage(1);
                      setSelectedTypes([]);
                    }}
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
                {selectedBranches.length === 0
                  ? "Wszystkie oddziały"
                  : selectedBranches.length === 1
                    ? selectedBranches[0]
                    : `${selectedBranches.length} wybrane`}
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
                      onClick={() => {
                        setCurrentPage(1);
                        setSelectedBranches([]);
                      }}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedBranches.length === 0}
                    onChange={() => {
                      setCurrentPage(1);
                      setSelectedBranches([]);
                    }}
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
                      onClick={() => {
                        setCurrentPage(1);
                        setSelectedStatuses([]);
                      }}
                    >
                      Wyczyść
                    </button>
                  )}
                </div>

                <label className="filter-checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.length === 0}
                    onChange={() => {
                      setCurrentPage(1);
                      setSelectedStatuses([]);
                    }}
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

          <button
            onClick={() => {
              setCurrentPage(1);
              setSearchParams({});
            }}
          >
            Pokaż wszystkie
          </button>
        </div>
      )}

      {selectedVehicleIds.length > 0 && (
        <div className="vehicles-bulk-toolbar">
          <div className="vehicles-bulk-count">
            Zaznaczono: <strong>{selectedVehicleIds.length}</strong>
          </div>

          <div className="vehicles-bulk-actions">
            <button onClick={() => openBulkModal("change_status")}>
              Zmień status
            </button>

            <button onClick={() => openBulkModal("change_company")}>
              Zmień spółkę
            </button>

            <button onClick={() => openBulkModal("change_branch")}>
              Zmień oddział
            </button>

            <button
              className="vehicles-bulk-delete"
              onClick={() => openBulkModal("delete")}
            >
              Usuń zaznaczone
            </button>

            <button onClick={handleExportSelected} disabled={exporting}>
              {exporting ? "Eksportowanie..." : "Eksportuj zaznaczone"}
            </button>

            <button
              className="vehicles-bulk-clear"
              onClick={clearVehicleSelection}
            >
              Odznacz
            </button>
          </div>
        </div>
      )}

      {bulkResult && (
        <div className="vehicles-bulk-result">
          <strong>Operacja zakończona.</strong>

          {bulkResult.deleted > 0 && <> Usunięto: {bulkResult.deleted}.</>}

          {bulkResult.updated > 0 && <> Zmieniono: {bulkResult.updated}.</>}

          {bulkResult.unchanged > 0 && <> Bez zmian: {bulkResult.unchanged}.</>}

          {bulkResult.skipped > 0 && <> Pominięto: {bulkResult.skipped}.</>}
        </div>
      )}

      <div className="vehicles-results-info">
        Na tej stronie: {vehicles.length} • Znaleziono: {totalVehicles}
      </div>

      <div className="vehicles-table">
        <div className="vehicles-table-header vehicles-table-header-bulk">
          <label
            className="vehicles-select-cell"
            title="Zaznacz wszystkie widoczne pojazdy, które możesz edytować"
          >
            <input
              type="checkbox"
              checked={allVisibleEditableSelected}
              disabled={editableVisibleVehicleIds.length === 0}
              onChange={toggleAllVisibleVehicles}
            />
          </label>

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
              sortField === "inspection_expiry_date" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("inspection_expiry_date")}
          >
            Przegląd
            <span>{getSortArrow("inspection_expiry_date")}</span>
          </button>

          <button
            className={`table-sort-button ${
              sortField === "insurance_expiry_date" ? "table-sort-active" : ""
            }`}
            onClick={() => handleSort("insurance_expiry_date")}
          >
            OC
            <span>{getSortArrow("insurance_expiry_date")}</span>
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
          <div
            className={`vehicles-table-row vehicles-table-row-bulk ${
              selectedVehicleIds.includes(vehicle.id)
                ? "vehicles-table-row-selected"
                : ""
            }`}
            key={vehicle.id}
          >
            <label
              className="vehicles-select-cell"
              title={
                canEditCompany(vehicle.company)
                  ? "Zaznacz pojazd"
                  : "Brak uprawnień do edycji tego pojazdu"
              }
            >
              <input
                type="checkbox"
                checked={selectedVehicleIds.includes(vehicle.id)}
                disabled={!canEditCompany(vehicle.company)}
                onChange={() => toggleVehicleSelection(vehicle.id)}
              />
            </label>

            <span className="vehicle-name">
              {vehicle.brand} {vehicle.model}
            </span>

            <span>{vehicle.registration_number}</span>

            <span>{getVehicleTypeName(vehicle.vehicle_type)}</span>

            <span>{getBranchName(vehicle.branch)}</span>

            <span>{vehicle.year}</span>

            <span>{formatMileage(vehicle.mileage)}</span>

            <div className="vehicle-expiry-cell">
              <span
                className={`vehicle-expiry-badge ${
                  getExpiryStatus(vehicle.inspection_expiry_date).className
                }`}
              >
                {getExpiryStatus(vehicle.inspection_expiry_date).text}
              </span>

              <span className="vehicle-expiry-date">
                {formatExpiryDate(vehicle.inspection_expiry_date)}
              </span>
            </div>

            <div className="vehicle-expiry-cell">
              <span
                className={`vehicle-expiry-badge ${
                  getExpiryStatus(vehicle.insurance_expiry_date).className
                }`}
              >
                {getExpiryStatus(vehicle.insurance_expiry_date).text}
              </span>

              <span className="vehicle-expiry-date">
                {formatExpiryDate(vehicle.insurance_expiry_date)}
              </span>
            </div>

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

      {totalPages > 1 && (
        <div className="vehicles-pagination">
          <button
            type="button"
            className="vehicles-pagination-button"
            onClick={handlePreviousPage}
            disabled={currentPage <= 1}
          >
            ← Poprzednia
          </button>

          <span className="vehicles-pagination-info">
            Strona {currentPage} z {totalPages}
          </span>

          <button
            type="button"
            className="vehicles-pagination-button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            Następna →
          </button>
        </div>
      )}

      {bulkAction && (
        <div className="vehicles-bulk-overlay">
          <div className="vehicles-bulk-modal">
            <div className="vehicles-bulk-modal-header">
              <div>
                <h2>{getBulkModalTitle()}</h2>
                <p>
                  Operacja obejmie {selectedVehicleIds.length} zaznaczonych
                  pojazdów.
                </p>
              </div>

              <button
                className="vehicles-bulk-modal-close"
                onClick={closeBulkModal}
                disabled={bulkUpdating}
              >
                ×
              </button>
            </div>

            {bulkAction === "change_status" && (
              <div className="vehicles-bulk-field">
                <label>Nowy status</label>

                <select
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                >
                  <option value="active">Aktywny</option>
                  <option value="maintenance">W serwisie</option>
                  <option value="inactive">Nieaktywny</option>
                </select>
              </div>
            )}

            {bulkAction === "change_company" && (
              <div className="vehicles-bulk-field">
                <label>Nowa spółka</label>

                <select
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                >
                  <option value="">Wybierz spółkę</option>

                  {user?.role === "admin" && (
                    <option value="none">Brak spółki</option>
                  )}

                  {editableCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {bulkAction === "change_branch" && (
              <div className="vehicles-bulk-field">
                <label>Nowy oddział</label>

                <input
                  type="text"
                  maxLength={150}
                  placeholder="Np. Legnica"
                  value={bulkValue}
                  onChange={(event) => setBulkValue(event.target.value)}
                />

                <span className="vehicles-bulk-help">
                  Pozostaw puste pole, jeśli chcesz usunąć oddział.
                </span>
              </div>
            )}

            {bulkAction === "delete" && (
              <div className="vehicles-bulk-delete-warning">
                <strong>
                  Czy na pewno chcesz usunąć {selectedVehicleIds.length}{" "}
                  zaznaczonych pojazdów?
                </strong>
              </div>
            )}

            <div className="vehicles-bulk-modal-actions">
              <button
                className="vehicles-bulk-cancel"
                onClick={closeBulkModal}
                disabled={bulkUpdating}
              >
                Anuluj
              </button>

              <button
                className="vehicles-bulk-submit"
                onClick={handleBulkUpdate}
                disabled={
                  bulkUpdating ||
                  (bulkAction === "change_company" && bulkValue === "")
                }
              >
                {bulkUpdating
                  ? bulkAction === "delete"
                    ? "Usuwanie..."
                    : "Zapisywanie..."
                  : bulkAction === "delete"
                    ? "Usuń zaznaczone"
                    : "Zastosuj zmiany"}
              </button>
            </div>
          </div>
        </div>
      )}

      {vehicleToDelete && (
        <div className="vehicle-delete-overlay">
          <div
            className="vehicle-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-delete-title"
          >
            <div className="vehicle-delete-icon" aria-hidden="true">
              !
            </div>

            <h2 id="vehicle-delete-title">Usunąć pojazd?</h2>

            <p>
              Czy na pewno chcesz usunąć
              <strong>
                {" "}
                {vehicleToDelete.brand} {vehicleToDelete.model}
              </strong>
              ?
            </p>

            <span className="vehicle-delete-registration">
              {vehicleToDelete.registration_number}
            </span>

            <p className="vehicle-delete-warning">
              Pojazd zostanie usunięty z listy.
            </p>

            <div className="vehicle-delete-actions">
              <button
                type="button"
                className="vehicle-delete-cancel"
                onClick={() => setVehicleToDelete(null)}
                disabled={deletingVehicle}
              >
                Anuluj
              </button>

              <button
                type="button"
                className="vehicle-delete-confirm"
                onClick={confirmDeleteVehicle}
                disabled={deletingVehicle}
              >
                {deletingVehicle ? "Usuwanie..." : "Usuń pojazd"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <VehicleImportModal
          onClose={() => setImportModalOpen(false)}
          onImported={async () => {
            await loadFilterOptions();

            if (currentPage === 1) {
              loadVehicles(1);
            } else {
              setCurrentPage(1);
            }
          }}
        />
      )}
    </div>
  );
}

export default VehicleList;
