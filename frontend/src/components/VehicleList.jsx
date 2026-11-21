import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import VehicleImportModal from "./VehicleImportModal";
import "./VehicleList.css";

function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const pageSize = 20;
  const navigate = useNavigate();
  const { user, canEditCompany } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const recentOnly = searchParams.get("recent") === "1";

  const canAddVehicle =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  const getStatusName = (status) => {
    if (status === "active") return "Aktywny";
    if (status === "maintenance") return "W serwisie";
    if (status === "inactive") return "Nieaktywny";
    return status || "Brak danych";
  };

  const getVehicleTypeName = (type) => {
    if (type === "passenger") return "Osobowy";
    if (type === "van") return "Bus / dostawczy";
    if (type === "truck") return "Ciężarowy";
    if (type === "special") return "Specjalny";
    if (type === "other") return "Inny";
    return type || "Brak danych";
  };

  const getBranchName = (branch) => {
    const value = branch?.trim();
    return value || "Brak oddziału";
  };

  const formatMileage = (mileage) => {
    const value = Number(mileage);
    return Number.isFinite(value) ? `${value.toLocaleString("pl-PL")} km` : "-";
  };

  const formatExpiryDate = (date) => {
    if (!date) return "-";
    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime())
      ? "-"
      : parsedDate.toLocaleDateString("pl-PL");
  };

  const getExpiryStatus = (date) => {
    if (!date) {
      return { text: "Brak terminu", className: "vehicle-expiry-none" };
    }

    const today = new Date();
    const expiryDate = new Date(date);

    if (Number.isNaN(expiryDate.getTime())) {
      return { text: "Brak terminu", className: "vehicle-expiry-none" };
    }

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft < 0) {
      return { text: "Po terminie", className: "vehicle-expiry-expired" };
    }

    if (daysLeft === 0) {
      return { text: "Dzisiaj", className: "vehicle-expiry-warning" };
    }

    if (daysLeft <= 30) {
      return {
        text: `Za ${daysLeft} dni`,
        className: "vehicle-expiry-warning",
      };
    }

    return { text: "Ważne", className: "vehicle-expiry-valid" };
  };

  const buildVehicleParams = (page = currentPage) => {
    const params = { page, page_size: pageSize };
    const search = searchText.trim();

    if (search) params.search = search;
    if (selectedBrands.length) params.brand = selectedBrands.join(",");
    if (selectedYears.length) params.year = selectedYears.join(",");
    if (selectedTypes.length) params.vehicle_type = selectedTypes.join(",");
    if (selectedStatuses.length) params.status = selectedStatuses.join(",");
    if (selectedBranches.length) params.branch = selectedBranches.join(",");
    if (recentOnly) params.recent = "1";

    if (sortField) {
      params.ordering = sortDirection === "desc" ? `-${sortField}` : sortField;
    }

    return params;
  };

  const loadVehicles = async (page = currentPage) => {
    try {
      setLoading(true);

      const response = await apiClient.get("vehicles/", {
        params: buildVehicleParams(page),
      });

      const responseData = response.data;
      const data = Array.isArray(responseData)
        ? responseData
        : responseData?.results || [];
      const count = Array.isArray(responseData)
        ? responseData.length
        : responseData?.count || 0;

      setVehicles(data);
      setTotalVehicles(count);
      setError(null);
    } catch (err) {
      console.error("Nie udało się pobrać listy pojazdów:", err);
      setVehicles([]);
      setTotalVehicles(0);
      setError("Nie udało się pobrać listy pojazdów.");
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const response = await apiClient.get("vehicles/filter-options/");
      setFilterOptions({
        brands: response.data?.brands || [],
        years: response.data?.years || [],
        vehicle_types: response.data?.vehicle_types || [],
        statuses: response.data?.statuses || [],
        branches: response.data?.branches || [],
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

    return () => window.clearTimeout(timeoutId);
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
      if (!event.target.closest(".filter-dropdown")) {
        setOpenFilter(null);
      }

      if (!event.target.closest(".vehicle-actions")) {
        setOpenMenuId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpenFilter(null);
        setOpenMenuId(null);

        if (!bulkUpdating) setBulkAction(null);
        if (!deletingVehicle) setVehicleToDelete(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [bulkUpdating, deletingVehicle]);

  const toggleSelectedValue = (value, selectedValues, setSelectedValues) => {
    setCurrentPage(1);

    setSelectedValues((currentValues) =>
      currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value],
    );
  };

  const getFilterText = (selectedValues, defaultText, formatter) => {
    if (!selectedValues.length) return defaultText;
    if (selectedValues.length === 1) {
      return formatter ? formatter(selectedValues[0]) : selectedValues[0];
    }
    return `${selectedValues.length} wybrane`;
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

  const filterDefinitions = [
    {
      key: "brand",
      label: "Marka",
      defaultText: "Wszystkie marki",
      header: "Wybierz marki",
      allText: "Wszystkie marki",
      values: filterOptions.brands,
      selected: selectedBrands,
      setSelected: setSelectedBrands,
    },
    {
      key: "year",
      label: "Rok",
      defaultText: "Wszystkie lata",
      header: "Wybierz lata",
      allText: "Wszystkie lata",
      values: filterOptions.years.map(String),
      selected: selectedYears,
      setSelected: setSelectedYears,
    },
    {
      key: "type",
      label: "Typ",
      defaultText: "Wszystkie typy",
      header: "Wybierz typy",
      allText: "Wszystkie typy",
      values: filterOptions.vehicle_types,
      selected: selectedTypes,
      setSelected: setSelectedTypes,
      formatter: getVehicleTypeName,
    },
    {
      key: "branch",
      label: "Oddział",
      defaultText: "Wszystkie oddziały",
      header: "Wybierz oddziały",
      allText: "Wszystkie oddziały",
      values: filterOptions.branches,
      selected: selectedBranches,
      setSelected: setSelectedBranches,
    },
    {
      key: "status",
      label: "Status",
      defaultText: "Wszystkie statusy",
      header: "Wybierz statusy",
      allText: "Wszystkie statusy",
      values: filterOptions.statuses,
      selected: selectedStatuses,
      setSelected: setSelectedStatuses,
      formatter: getStatusName,
    },
  ];

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

  const totalPages = Math.max(1, Math.ceil(totalVehicles / pageSize));

  useEffect(() => {
    if (currentPage > totalPages && totalVehicles > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, totalVehicles]);

  const editableVisibleVehicleIds = vehicles
    .filter((vehicle) => canEditCompany(vehicle.company))
    .map((vehicle) => vehicle.id);

  const allVisibleEditableSelected =
    editableVisibleVehicleIds.length > 0 &&
    editableVisibleVehicleIds.every((id) => selectedVehicleIds.includes(id));

  const editableCompanies = [...(user?.companies || [])]
    .filter((company) => user?.role === "admin" || company.role === "editor")
    .sort((a, b) =>
      a.name.localeCompare(b.name, "pl", { sensitivity: "base" }),
    );

  const toggleVehicleSelection = (vehicleId) => {
    setBulkResult(null);

    setSelectedVehicleIds((ids) =>
      ids.includes(vehicleId)
        ? ids.filter((id) => id !== vehicleId)
        : [...ids, vehicleId],
    );
  };

  const toggleAllVisibleVehicles = () => {
    setBulkResult(null);

    setSelectedVehicleIds((ids) => {
      if (allVisibleEditableSelected) {
        return ids.filter((id) => !editableVisibleVehicleIds.includes(id));
      }

      return [...new Set([...ids, ...editableVisibleVehicleIds])];
    });
  };

  const clearVehicleSelection = () => {
    setSelectedVehicleIds([]);
    setBulkResult(null);
  };

  const openBulkModal = (action) => {
    setBulkResult(null);
    setBulkAction(action);
    setBulkValue(action === "change_status" ? "active" : "");
  };

  const closeBulkModal = () => {
    if (bulkUpdating) return;
    setBulkAction(null);
    setBulkValue("");
  };

  const getBulkModalTitle = () => {
    if (bulkAction === "change_status") return "Masowa zmiana statusu";
    if (bulkAction === "change_company") return "Masowa zmiana spółki";
    if (bulkAction === "change_branch") return "Masowa zmiana oddziału";
    if (bulkAction === "delete") return "Usuń zaznaczone pojazdy";
    return "Operacja masowa";
  };

  const handleBulkUpdate = async () => {
    if (!selectedVehicleIds.length || !bulkAction) return;

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

      const action = bulkAction;
      const response = await apiClient.post("vehicles/bulk-update/", {
        vehicle_ids: selectedVehicleIds,
        action,
        value,
      });

      setBulkResult(response.data);
      setBulkAction(null);
      setBulkValue("");
      setSelectedVehicleIds([]);

      if (
        action === "delete" &&
        response.data?.deleted >= vehicles.length &&
        currentPage > 1
      ) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadVehicles(currentPage);
      }
    } catch (err) {
      console.error("Błąd operacji masowej:", err);
      setError(
        err.response?.data?.detail || "Nie udało się wykonać operacji masowej.",
      );
    } finally {
      setBulkUpdating(false);
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

    return `flotivo-pojazdy-${new Date().toISOString().slice(0, 10)}.xlsx`;
  };

  const downloadExport = (response) => {
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
  };

  const handleExportSelected = async () => {
    if (!selectedVehicleIds.length) return;

    try {
      setExporting(true);
      setError(null);

      const response = await apiClient.post(
        "vehicles/export/",
        { vehicle_ids: selectedVehicleIds },
        { responseType: "blob" },
      );

      downloadExport(response);
    } catch (err) {
      console.error("Błąd eksportu zaznaczonych pojazdów:", err);
      setError("Nie udało się wyeksportować zaznaczonych pojazdów.");
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async () => {
    if (!totalVehicles) {
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
        { vehicle_ids: [] },
        { responseType: "blob", params: exportParams },
      );

      downloadExport(response);
    } catch (err) {
      console.error("Błąd eksportu pojazdów:", err);
      setError("Nie udało się wyeksportować pojazdów.");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = (vehicle) => {
    setOpenMenuId(null);
    setVehicleToDelete(vehicle);
  };

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return;

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
      setError("Nie udało się usunąć pojazdu.");
    } finally {
      setDeletingVehicle(false);
    }
  };

  const tableColumns = [
    ["vehicle", "Pojazd"],
    ["registration_number", "Rejestracja"],
    ["vehicle_type", "Typ"],
    ["branch", "Oddział"],
    ["year", "Rok"],
    ["mileage", "Przebieg"],
    ["inspection_expiry_date", "Przegląd"],
    ["insurance_expiry_date", "OC"],
    ["status", "Status"],
  ];

  return (
    <div className="vehicles">
      <div className="vehicles-header">
        <div>
          <h1>Pojazdy</h1>
          <p>Zarządzaj pojazdami znajdującymi się w Twojej flocie.</p>
        </div>
        <div className="vehicles-header-actions">
          <button
            type="button"
            className="export-vehicles-button"
            onClick={handleExport}
            disabled={exporting || totalVehicles === 0}
          >
            {exporting ? "Eksportowanie..." : "Eksportuj"}
          </button>
          {canAddVehicle && (
            <button
              type="button"
              className="export-vehicles-button"
              onClick={() => setImportModalOpen(true)}
            >
              Importuj
            </button>
          )}
          {canAddVehicle && (
            <button
              type="button"
              className="add-vehicle-button"
              onClick={() => navigate("/vehicles/add")}
            >
              + Dodaj pojazd
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="vehicles-error" role="alert">
          {error}
        </div>
      )}

      <div className="vehicles-search">
        <input
          type="search"
          placeholder="Szukaj po marce, modelu, rejestracji, VIN lub oddziale..."
          value={searchText}
          onChange={(event) => {
            setCurrentPage(1);
            setSearchText(event.target.value);
          }}
        />
        {searchText && (
          <button
            type="button"
            className="vehicles-search-clear"
            onClick={() => {
              setCurrentPage(1);
              setSearchText("");
            }}
            aria-label="Wyczyść wyszukiwanie"
            title="Wyczyść wyszukiwanie"
          >
            ×
          </button>
        )}
      </div>

      <div className="vehicles-filters">
        {filterDefinitions.map((filter) => (
          <div className="vehicles-filter" key={filter.key}>
            <span className="vehicles-filter-label">{filter.label}</span>
            <div className="filter-dropdown">
              <button
                type="button"
                className={`filter-dropdown-button ${
                  filter.selected.length ? "filter-active" : ""
                }`}
                onClick={() =>
                  setOpenFilter((current) =>
                    current === filter.key ? null : filter.key,
                  )
                }
              >
                <span>
                  {getFilterText(
                    filter.selected,
                    filter.defaultText,
                    filter.formatter,
                  )}
                </span>
                <span className="filter-arrow">
                  {openFilter === filter.key ? "▲" : "▼"}
                </span>
              </button>

              {openFilter === filter.key && (
                <div className="filter-dropdown-menu">
                  <div className="filter-dropdown-header">
                    <span>{filter.header}</span>
                    {filter.selected.length > 0 && (
                      <button
                        type="button"
                        className="filter-clear-button"
                        onClick={() => {
                          setCurrentPage(1);
                          filter.setSelected([]);
                        }}
                      >
                        Wyczyść
                      </button>
                    )}
                  </div>

                  <label className="filter-checkbox-row">
                    <input
                      type="checkbox"
                      checked={filter.selected.length === 0}
                      onChange={() => {
                        setCurrentPage(1);
                        filter.setSelected([]);
                      }}
                    />
                    <span>{filter.allText}</span>
                  </label>

                  <div className="filter-divider" />

                  {filter.values.map((value) => (
                    <label className="filter-checkbox-row" key={value}>
                      <input
                        type="checkbox"
                        checked={filter.selected.includes(value)}
                        onChange={() =>
                          toggleSelectedValue(
                            value,
                            filter.selected,
                            filter.setSelected,
                          )
                        }
                      />
                      <span>
                        {filter.formatter ? filter.formatter(value) : value}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {filtersAreActive && (
          <button
            type="button"
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
            type="button"
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
            <button
              type="button"
              onClick={() => openBulkModal("change_status")}
            >
              Zmień status
            </button>
            <button
              type="button"
              onClick={() => openBulkModal("change_company")}
            >
              Zmień spółkę
            </button>
            <button
              type="button"
              onClick={() => openBulkModal("change_branch")}
            >
              Zmień oddział
            </button>
            <button
              type="button"
              className="vehicles-bulk-delete"
              onClick={() => openBulkModal("delete")}
            >
              Usuń zaznaczone
            </button>
            <button
              type="button"
              onClick={handleExportSelected}
              disabled={exporting}
            >
              {exporting ? "Eksportowanie..." : "Eksportuj zaznaczone"}
            </button>
            <button
              type="button"
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
        {loading
          ? "Ładowanie pojazdów..."
          : `Na tej stronie: ${vehicles.length} • Znaleziono: ${totalVehicles}`}
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
              disabled={!editableVisibleVehicleIds.length || loading}
              onChange={toggleAllVisibleVehicles}
            />
          </label>

          {tableColumns.map(([field, label]) => (
            <button
              type="button"
              key={field}
              className={`table-sort-button ${
                sortField === field ? "table-sort-active" : ""
              }`}
              onClick={() => handleSort(field)}
            >
              {label}
              <span>{getSortArrow(field)}</span>
            </button>
          ))}

          <span>Akcje</span>
        </div>

        {!loading &&
          vehicles.map((vehicle) => {
            const inspectionStatus = getExpiryStatus(
              vehicle.inspection_expiry_date,
            );
            const insuranceStatus = getExpiryStatus(
              vehicle.insurance_expiry_date,
            );
            const editable = canEditCompany(vehicle.company);

            return (
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
                    editable
                      ? "Zaznacz pojazd"
                      : "Brak uprawnień do edycji tego pojazdu"
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedVehicleIds.includes(vehicle.id)}
                    disabled={!editable}
                    onChange={() => toggleVehicleSelection(vehicle.id)}
                  />
                </label>

                <span className="vehicle-name">
                  {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
                    "Brak danych"}
                </span>
                <span>{vehicle.registration_number || "-"}</span>
                <span>{getVehicleTypeName(vehicle.vehicle_type)}</span>
                <span>{getBranchName(vehicle.branch)}</span>
                <span>{vehicle.year || "-"}</span>
                <span>{formatMileage(vehicle.mileage)}</span>

                <div className="vehicle-expiry-cell">
                  <span
                    className={`vehicle-expiry-badge ${inspectionStatus.className}`}
                  >
                    {inspectionStatus.text}
                  </span>
                  <span className="vehicle-expiry-date">
                    {formatExpiryDate(vehicle.inspection_expiry_date)}
                  </span>
                </div>

                <div className="vehicle-expiry-cell">
                  <span
                    className={`vehicle-expiry-badge ${insuranceStatus.className}`}
                  >
                    {insuranceStatus.text}
                  </span>
                  <span className="vehicle-expiry-date">
                    {formatExpiryDate(vehicle.insurance_expiry_date)}
                  </span>
                </div>

                <span
                  className={`vehicle-status vehicle-status-${
                    ["active", "maintenance", "inactive"].includes(
                      vehicle.status,
                    )
                      ? vehicle.status
                      : "unknown"
                  }`}
                >
                  {getStatusName(vehicle.status)}
                </span>

                <div className="vehicle-actions">
                  <button
                    type="button"
                    className="vehicle-actions-button"
                    onClick={() =>
                      setOpenMenuId((current) =>
                        current === vehicle.id ? null : vehicle.id,
                      )
                    }
                    aria-label="Akcje pojazdu"
                  >
                    •••
                  </button>

                  {openMenuId === vehicle.id && (
                    <div className="vehicle-actions-menu">
                      <button
                        type="button"
                        onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                      >
                        Szczegóły
                      </button>

                      {editable && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/vehicles/${vehicle.id}/edit`)
                            }
                          >
                            Edytuj
                          </button>
                          <div className="vehicle-actions-divider" />
                          <button
                            type="button"
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
            );
          })}

        {loading && (
          <div className="vehicles-empty">Ładowanie listy pojazdów...</div>
        )}

        {!loading && vehicles.length === 0 && (
          <div className="vehicles-empty">
            {error
              ? "Nie udało się wyświetlić pojazdów."
              : filtersAreActive || recentOnly
                ? "Brak pojazdów spełniających wybrane kryteria."
                : "Brak pojazdów w systemie."}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="vehicles-pagination">
          <button
            type="button"
            className="vehicles-pagination-button"
            onClick={() => {
              if (currentPage > 1) {
                setSelectedVehicleIds([]);
                setCurrentPage((page) => page - 1);
              }
            }}
            disabled={currentPage <= 1 || loading}
          >
            ← Poprzednia
          </button>
          <span className="vehicles-pagination-info">
            Strona {currentPage} z {totalPages}
          </span>
          <button
            type="button"
            className="vehicles-pagination-button"
            onClick={() => {
              if (currentPage < totalPages) {
                setSelectedVehicleIds([]);
                setCurrentPage((page) => page + 1);
              }
            }}
            disabled={currentPage >= totalPages || loading}
          >
            Następna →
          </button>
        </div>
      )}

      {bulkAction && (
        <div className="vehicles-bulk-overlay" role="dialog" aria-modal="true">
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
                type="button"
                className="vehicles-bulk-modal-close"
                onClick={closeBulkModal}
                disabled={bulkUpdating}
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>

            {bulkAction === "change_status" && (
              <div className="vehicles-bulk-field">
                <label htmlFor="bulk-status">Nowy status</label>
                <select
                  id="bulk-status"
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
                <label htmlFor="bulk-company">Nowa spółka</label>
                <select
                  id="bulk-company"
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
                <label htmlFor="bulk-branch">Nowy oddział</label>
                <input
                  id="bulk-branch"
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
                type="button"
                className="vehicles-bulk-cancel"
                onClick={closeBulkModal}
                disabled={bulkUpdating}
              >
                Anuluj
              </button>
              <button
                type="button"
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
                {[vehicleToDelete.brand, vehicleToDelete.model]
                  .filter(Boolean)
                  .join(" ")}
              </strong>
              ?
            </p>
            <span className="vehicle-delete-registration">
              {vehicleToDelete.registration_number || "Brak rejestracji"}
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
              await loadVehicles(1);
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
