import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import DriverImportModal from "./DriverImportModal";
import "./DriverList.css";

function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [exporting, setExporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedDriverIds, setSelectedDriverIds] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [driverToDelete, setDriverToDelete] = useState(null);
  const [deletingDriver, setDeletingDriver] = useState(false);

  const pageSize = 20;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageDrivers = user?.role === "admin";

  const buildDriverParams = (page = currentPage) => {
    const params = {
      page,
      page_size: pageSize,
    };

    const search = searchText.trim();

    if (search) {
      params.search = search;
    }

    if (sortField) {
      params.ordering = sortDirection === "desc" ? `-${sortField}` : sortField;
    }

    return params;
  };

  const loadDrivers = async (page = currentPage) => {
    try {
      setLoading(true);

      const response = await apiClient.get("drivers/", {
        params: buildDriverParams(page),
      });

      const responseData = response.data;

      const data = Array.isArray(responseData)
        ? responseData
        : responseData?.results || [];

      const count = Array.isArray(responseData)
        ? responseData.length
        : responseData?.count || 0;

      setDrivers(data);
      setTotalDrivers(count);
      setError(null);
    } catch (err) {
      console.error("Nie udało się pobrać listy kierowców:", err);
      setDrivers([]);
      setTotalDrivers(0);
      setError("Nie udało się pobrać listy kierowców.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadDrivers(currentPage);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentPage, searchText, sortField, sortDirection]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".driver-actions")) {
        setOpenMenuId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);

        if (!deletingDriver) {
          setDriverToDelete(null);
        }

        if (!bulkDeleting) {
          setBulkDeleteOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [deletingDriver, bulkDeleting]);

  const handleMenuClick = (driverId) => {
    setOpenMenuId((currentId) => (currentId === driverId ? null : driverId));
  };

  const handleDelete = (driver) => {
    setOpenMenuId(null);
    setDriverToDelete(driver);
  };

  const confirmDeleteDriver = async () => {
    if (!driverToDelete) {
      return;
    }

    try {
      setDeletingDriver(true);
      setError(null);

      await apiClient.delete(`drivers/${driverToDelete.id}/`);

      setSelectedDriverIds((currentIds) =>
        currentIds.filter((driverId) => driverId !== driverToDelete.id),
      );

      setDriverToDelete(null);

      if (drivers.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadDrivers(currentPage);
      }
    } catch (err) {
      console.error("Błąd usuwania kierowcy:", err);
      setError(err.response?.data?.detail || "Nie udało się usunąć kierowcy.");
    } finally {
      setDeletingDriver(false);
    }
  };

  const handleSort = (field) => {
    setCurrentPage(1);

    if (sortField === field) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
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

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("pl-PL");
  };

  const getExpiryStatus = (date) => {
    if (!date) {
      return {
        text: "Brak terminu",
        className: "driver-expiry-none",
      };
    }

    const today = new Date();
    const expiryDate = new Date(date);

    if (Number.isNaN(expiryDate.getTime())) {
      return {
        text: "Brak terminu",
        className: "driver-expiry-none",
      };
    }

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft < 0) {
      return {
        text: "Po terminie",
        className: "driver-expiry-expired",
      };
    }

    if (daysLeft === 0) {
      return {
        text: "Dzisiaj",
        className: "driver-expiry-warning",
      };
    }

    if (daysLeft <= 30) {
      return {
        text: `Za ${daysLeft} dni`,
        className: "driver-expiry-warning",
      };
    }

    return {
      text: "Ważne",
      className: "driver-expiry-valid",
    };
  };

  const totalPages = Math.max(1, Math.ceil(totalDrivers / pageSize));

  useEffect(() => {
    if (currentPage > totalPages && totalDrivers > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, totalDrivers]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setSelectedDriverIds([]);
      setCurrentPage((page) => page - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setSelectedDriverIds([]);
      setCurrentPage((page) => page + 1);
    }
  };

  const visibleDriverIds = canManageDrivers
    ? drivers.map((driver) => driver.id)
    : [];

  const allVisibleDriversSelected =
    visibleDriverIds.length > 0 &&
    visibleDriverIds.every((driverId) => selectedDriverIds.includes(driverId));

  const toggleDriverSelection = (driverId) => {
    if (!canManageDrivers) {
      return;
    }

    setBulkResult(null);

    setSelectedDriverIds((currentIds) =>
      currentIds.includes(driverId)
        ? currentIds.filter((id) => id !== driverId)
        : [...currentIds, driverId],
    );
  };

  const toggleAllVisibleDrivers = () => {
    if (!canManageDrivers) {
      return;
    }

    setBulkResult(null);

    setSelectedDriverIds((currentIds) => {
      if (allVisibleDriversSelected) {
        return currentIds.filter((id) => !visibleDriverIds.includes(id));
      }

      return [...new Set([...currentIds, ...visibleDriverIds])];
    });
  };

  const clearDriverSelection = () => {
    setSelectedDriverIds([]);
    setBulkResult(null);
  };

  const openBulkDeleteModal = () => {
    if (!canManageDrivers || selectedDriverIds.length === 0) {
      return;
    }

    setBulkResult(null);
    setBulkDeleteOpen(true);
  };

  const closeBulkDeleteModal = () => {
    if (bulkDeleting) {
      return;
    }

    setBulkDeleteOpen(false);
  };

  const handleBulkDelete = async () => {
    if (!canManageDrivers || selectedDriverIds.length === 0) {
      return;
    }

    try {
      setBulkDeleting(true);
      setError(null);
      setBulkResult(null);

      const response = await apiClient.post("drivers/bulk-update/", {
        driver_ids: selectedDriverIds,
        action: "delete",
      });

      setBulkResult(response.data);
      setSelectedDriverIds([]);
      setBulkDeleteOpen(false);

      if (
        response.data?.deleted >= drivers.length &&
        drivers.length > 0 &&
        currentPage > 1
      ) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadDrivers(currentPage);
      }
    } catch (err) {
      console.error("Błąd masowego usuwania kierowców:", err);

      setError(
        err.response?.data?.detail ||
          "Nie udało się usunąć zaznaczonych kierowców.",
      );
    } finally {
      setBulkDeleting(false);
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

    return `flotivo-kierowcy-${new Date().toISOString().slice(0, 10)}.xlsx`;
  };

  const downloadDriverExport = async (driverIds, params = {}) => {
    const response = await apiClient.post(
      "drivers/export/",
      {
        driver_ids: driverIds,
      },
      {
        responseType: "blob",
        params,
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
  };

  const handleExport = async () => {
    if (totalDrivers === 0) {
      setError("Brak kierowców do wyeksportowania.");
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const exportParams = buildDriverParams(1);

      delete exportParams.page;
      delete exportParams.page_size;

      await downloadDriverExport([], exportParams);
    } catch (err) {
      console.error("Błąd eksportu kierowców:", err);
      setError("Nie udało się wyeksportować kierowców.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedDriverIds.length === 0) {
      return;
    }

    try {
      setExporting(true);
      setError(null);

      await downloadDriverExport(selectedDriverIds);
    } catch (err) {
      console.error("Błąd eksportu zaznaczonych kierowców:", err);
      setError("Nie udało się wyeksportować zaznaczonych kierowców.");
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    ["first_name", "Imię"],
    ["last_name", "Nazwisko"],
    ["license_number", "Numer prawa jazdy"],
    ["license_expiry_date", "Prawo jazdy"],
    ["medical_exam_expiry_date", "Badania"],
    ["phone_number", "Telefon"],
    ["hired_at", "Data zatrudnienia"],
  ];

  return (
    <div className="drivers">
      <div className="drivers-header">
        <div>
          <h1>Kierowcy</h1>
          <p>Zarządzaj kierowcami znajdującymi się w Twojej flocie.</p>
        </div>

        <div className="drivers-header-actions">
          <button
            type="button"
            className="export-drivers-button"
            onClick={handleExport}
            disabled={exporting || totalDrivers === 0}
          >
            {exporting ? "Eksportowanie..." : "Eksportuj"}
          </button>

          {canManageDrivers && (
            <button
              type="button"
              className="export-drivers-button"
              onClick={() => setImportModalOpen(true)}
            >
              Importuj
            </button>
          )}

          {canManageDrivers && (
            <button
              type="button"
              className="add-driver-button"
              onClick={() => navigate("/drivers/add")}
            >
              + Dodaj kierowcę
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="drivers-error" role="alert">
          {error}
        </div>
      )}

      <div className="drivers-toolbar">
        <div className="drivers-search-wrapper">
          <input
            className="drivers-search"
            type="search"
            placeholder="Szukaj kierowcy..."
            value={searchText}
            onChange={(event) => {
              setCurrentPage(1);
              setSearchText(event.target.value);
            }}
          />

          {searchText && (
            <button
              type="button"
              className="drivers-search-clear"
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
      </div>

      {selectedDriverIds.length > 0 && (
        <div className="drivers-bulk-toolbar">
          <div className="drivers-bulk-count">
            Zaznaczono: <strong>{selectedDriverIds.length}</strong>
          </div>

          <div className="drivers-bulk-actions">
            <button
              type="button"
              onClick={handleExportSelected}
              disabled={exporting}
            >
              {exporting ? "Eksportowanie..." : "Eksportuj zaznaczone"}
            </button>

            {canManageDrivers && (
              <button
                type="button"
                className="drivers-bulk-delete"
                onClick={openBulkDeleteModal}
              >
                Usuń zaznaczone
              </button>
            )}

            <button
              type="button"
              className="drivers-bulk-clear"
              onClick={clearDriverSelection}
            >
              Odznacz
            </button>
          </div>
        </div>
      )}

      {bulkResult && (
        <div className="drivers-bulk-result">
          <strong>Operacja zakończona.</strong>
          {bulkResult.deleted > 0 && <> Usunięto: {bulkResult.deleted}.</>}
          {bulkResult.skipped > 0 && <> Pominięto: {bulkResult.skipped}.</>}
        </div>
      )}

      <div className="drivers-results-info">
        {loading
          ? "Ładowanie kierowców..."
          : `Na tej stronie: ${drivers.length} • Znaleziono: ${totalDrivers}`}
      </div>

      <div className="drivers-table">
        <div className="drivers-table-header drivers-table-header-bulk">
          <label
            className="drivers-select-cell"
            title={
              canManageDrivers
                ? "Zaznacz wszystkich widocznych kierowców"
                : "Tylko administrator może zarządzać kierowcami"
            }
          >
            <input
              type="checkbox"
              checked={allVisibleDriversSelected}
              disabled={
                !canManageDrivers || visibleDriverIds.length === 0 || loading
              }
              onChange={toggleAllVisibleDrivers}
            />
          </label>

          {columns.map(([field, label]) => (
            <button
              type="button"
              className={`drivers-sort-button ${
                sortField === field ? "drivers-sort-active" : ""
              }`}
              key={field}
              onClick={() => handleSort(field)}
            >
              {label}
              <span>{getSortArrow(field)}</span>
            </button>
          ))}

          <span>Akcje</span>
        </div>

        {!loading &&
          drivers.map((driver) => {
            const licenseStatus = getExpiryStatus(driver.license_expiry_date);
            const medicalStatus = getExpiryStatus(
              driver.medical_exam_expiry_date,
            );

            return (
              <div
                className={`drivers-table-row drivers-table-row-bulk ${
                  selectedDriverIds.includes(driver.id)
                    ? "drivers-table-row-selected"
                    : ""
                }`}
                key={driver.id}
              >
                <label
                  className="drivers-select-cell"
                  title={
                    canManageDrivers
                      ? "Zaznacz kierowcę"
                      : "Tylko administrator może zarządzać kierowcami"
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedDriverIds.includes(driver.id)}
                    disabled={!canManageDrivers}
                    onChange={() => toggleDriverSelection(driver.id)}
                  />
                </label>

                <span>{driver.first_name || "Nie podano"}</span>

                <span className="driver-name">
                  {driver.last_name || "Nie podano"}
                </span>

                <span>{driver.license_number || "Nie podano"}</span>

                <div className="driver-expiry-cell">
                  <span
                    className={`driver-expiry-badge ${licenseStatus.className}`}
                  >
                    {licenseStatus.text}
                  </span>

                  <span className="driver-expiry-date">
                    {formatDate(driver.license_expiry_date)}
                  </span>
                </div>

                <div className="driver-expiry-cell">
                  <span
                    className={`driver-expiry-badge ${medicalStatus.className}`}
                  >
                    {medicalStatus.text}
                  </span>

                  <span className="driver-expiry-date">
                    {formatDate(driver.medical_exam_expiry_date)}
                  </span>
                </div>

                <span>{driver.phone_number || "Nie podano"}</span>

                <span>{formatDate(driver.hired_at)}</span>

                <div className="driver-actions">
                  <button
                    type="button"
                    className="driver-actions-button"
                    onClick={() => handleMenuClick(driver.id)}
                    aria-label="Akcje kierowcy"
                  >
                    •••
                  </button>

                  {openMenuId === driver.id && (
                    <div className="driver-actions-menu">
                      <button
                        type="button"
                        onClick={() => navigate(`/drivers/${driver.id}`)}
                      >
                        Szczegóły
                      </button>

                      {canManageDrivers && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/drivers/${driver.id}/edit`)
                            }
                          >
                            Edytuj
                          </button>

                          <div className="driver-actions-divider" />

                          <button
                            type="button"
                            className="driver-actions-delete"
                            onClick={() => handleDelete(driver)}
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
          <div className="drivers-empty">Ładowanie listy kierowców...</div>
        )}

        {!loading && drivers.length === 0 && (
          <div className="drivers-empty">
            {error
              ? "Nie udało się wyświetlić kierowców."
              : searchText.trim()
                ? "Nie znaleziono kierowców pasujących do wyszukiwania."
                : "Brak kierowców w systemie."}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="drivers-pagination">
          <button
            type="button"
            className="drivers-pagination-button"
            onClick={handlePreviousPage}
            disabled={currentPage <= 1 || loading}
          >
            ← Poprzednia
          </button>

          <span className="drivers-pagination-info">
            Strona {currentPage} z {totalPages}
          </span>

          <button
            type="button"
            className="drivers-pagination-button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || loading}
          >
            Następna →
          </button>
        </div>
      )}

      {driverToDelete && (
        <div className="driver-delete-overlay">
          <div
            className="driver-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="driver-delete-title"
          >
            <div className="driver-delete-icon" aria-hidden="true">
              !
            </div>

            <h2 id="driver-delete-title">Usunąć kierowcę?</h2>

            <p>
              Czy na pewno chcesz usunąć
              <strong>
                {" "}
                {driverToDelete.first_name} {driverToDelete.last_name}
              </strong>
              ?
            </p>

            <p className="driver-delete-warning">
              Kierowca zostanie usunięty z listy.
            </p>

            <div className="driver-delete-actions">
              <button
                type="button"
                className="driver-delete-cancel"
                onClick={() => setDriverToDelete(null)}
                disabled={deletingDriver}
              >
                Anuluj
              </button>

              <button
                type="button"
                className="driver-delete-confirm"
                onClick={confirmDeleteDriver}
                disabled={deletingDriver}
              >
                {deletingDriver ? "Usuwanie..." : "Usuń kierowcę"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className="drivers-bulk-overlay">
          <div
            className="drivers-bulk-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drivers-bulk-delete-title"
          >
            <div className="drivers-bulk-modal-header">
              <div>
                <h2 id="drivers-bulk-delete-title">
                  Usuń zaznaczonych kierowców
                </h2>

                <p>
                  Operacja obejmie {selectedDriverIds.length} zaznaczonych
                  kierowców.
                </p>
              </div>

              <button
                type="button"
                className="drivers-bulk-modal-close"
                onClick={closeBulkDeleteModal}
                disabled={bulkDeleting}
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>

            <div className="drivers-bulk-delete-warning">
              <strong>
                Czy na pewno chcesz usunąć {selectedDriverIds.length}{" "}
                zaznaczonych kierowców?
              </strong>
            </div>

            <div className="drivers-bulk-modal-actions">
              <button
                type="button"
                className="drivers-bulk-cancel"
                onClick={closeBulkDeleteModal}
                disabled={bulkDeleting}
              >
                Anuluj
              </button>

              <button
                type="button"
                className="drivers-bulk-submit"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Usuwanie..." : "Usuń zaznaczone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <DriverImportModal
          onClose={() => setImportModalOpen(false)}
          onImported={() => {
            if (currentPage === 1) {
              loadDrivers(1);
            } else {
              setCurrentPage(1);
            }
          }}
        />
      )}
    </div>
  );
}

export default DriverList;
