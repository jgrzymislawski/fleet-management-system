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
  const pageSize = 20;

  const [error, setError] = useState(null);
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

  const navigate = useNavigate();

  const { user } = useAuth();

  const canManageDrivers = user?.role === "admin";

  const buildDriverParams = (page = currentPage) => {
    const params = {
      page,
      page_size: pageSize,
    };

    const normalizedSearchText = searchText.trim();

    if (normalizedSearchText) {
      params.search = normalizedSearchText;
    }

    if (sortField) {
      params.ordering = sortDirection === "desc" ? `-${sortField}` : sortField;
    }

    return params;
  };

  const loadDrivers = async (page = currentPage) => {
    try {
      const response = await apiClient.get("drivers/", {
        params: buildDriverParams(page),
      });

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];

      const count = Array.isArray(response.data)
        ? response.data.length
        : response.data.count || 0;

      setDrivers(data);
      setTotalDrivers(count);
      setError(null);
    } catch (err) {
      console.error(err);

      setError("Nie udało się pobrać listy kierowców");
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

  const handleMenuClick = (driverId) => {
    if (openMenuId === driverId) {
      setOpenMenuId(null);
    } else {
      setOpenMenuId(driverId);
    }
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

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się usunąć kierowcy.");
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

    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const formatDate = (date) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString("pl-PL");
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

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const difference = expiryDate - today;

    const daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24));

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

  const sortedDrivers = drivers;

  const totalPages = Math.max(1, Math.ceil(totalDrivers / pageSize));

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
    ? sortedDrivers.map((driver) => driver.id)
    : [];

  const allVisibleDriversSelected =
    visibleDriverIds.length > 0 &&
    visibleDriverIds.every((driverId) => selectedDriverIds.includes(driverId));

  const toggleDriverSelection = (driverId) => {
    setBulkResult(null);

    setSelectedDriverIds((currentIds) => {
      if (currentIds.includes(driverId)) {
        return currentIds.filter((id) => id !== driverId);
      }

      return [...currentIds, driverId];
    });
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
        response.data.deleted >= drivers.length &&
        drivers.length > 0 &&
        currentPage > 1
      ) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadDrivers(currentPage);
      }
    } catch (err) {
      console.error("Błąd masowego usuwania kierowców:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError(
        err.response?.data?.detail ||
          "Nie udało się usunąć zaznaczonych kierowców.",
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const getExportFilename = (response) => {
    const contentDisposition = response.headers["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);

      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    return `flotivo-kierowcy-${today}.xlsx`;
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

      console.error("Odpowiedź backendu:", err.response?.data);

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

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się wyeksportować zaznaczonych kierowców.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="drivers">
      <div className="drivers-header">
        <div>
          <h1>Kierowcy</h1>

          <p>Zarządzaj kierowcami znajdującymi się w Twojej flocie.</p>
        </div>

        <div className="drivers-header-actions">
          <button
            className="export-drivers-button"
            onClick={handleExport}
            disabled={exporting || totalDrivers === 0}
          >
            {exporting ? "Eksportowanie..." : "Eksportuj"}
          </button>

          {canManageDrivers && (
            <button
              className="export-drivers-button"
              onClick={() => setImportModalOpen(true)}
            >
              Importuj
            </button>
          )}

          {canManageDrivers && (
            <button
              className="add-driver-button"
              onClick={() => navigate("/drivers/add")}
            >
              + Dodaj kierowcę
            </button>
          )}
        </div>
      </div>

      {error && <p className="drivers-error">{error}</p>}

      <div className="drivers-toolbar">
        <input
          className="drivers-search"
          type="text"
          placeholder="Szukaj kierowcy..."
          value={searchText}
          onChange={(event) => {
            setCurrentPage(1);

            setSearchText(event.target.value);
          }}
        />
      </div>

      {selectedDriverIds.length > 0 && (
        <div className="drivers-bulk-toolbar">
          <div className="drivers-bulk-count">
            Zaznaczono: <strong>{selectedDriverIds.length}</strong>
          </div>

          <div className="drivers-bulk-actions">
            <button onClick={handleExportSelected} disabled={exporting}>
              {exporting ? "Eksportowanie..." : "Eksportuj zaznaczone"}
            </button>

            {canManageDrivers && (
              <button
                className="drivers-bulk-delete"
                onClick={openBulkDeleteModal}
              >
                Usuń zaznaczone
              </button>
            )}

            <button
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
        Na tej stronie: {drivers.length} • Znaleziono: {totalDrivers}
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
              disabled={!canManageDrivers || visibleDriverIds.length === 0}
              onChange={toggleAllVisibleDrivers}
            />
          </label>

          <button
            className="drivers-sort-button"
            onClick={() => handleSort("first_name")}
          >
            Imię
            {getSortArrow("first_name")}
          </button>

          <button
            className="drivers-sort-button"
            onClick={() => handleSort("last_name")}
          >
            Nazwisko
            {getSortArrow("last_name")}
          </button>

          <button
            className="drivers-sort-button"
            onClick={() => handleSort("license_number")}
          >
            Numer prawa jazdy
            {getSortArrow("license_number")}
          </button>

          <button
            className="drivers-sort-button"
            onClick={() => handleSort("license_expiry_date")}
          >
            Prawo jazdy
            {getSortArrow("license_expiry_date")}
          </button>

          <button
            className="drivers-sort-button"
            onClick={() => handleSort("medical_exam_expiry_date")}
          >
            Badania
            {getSortArrow("medical_exam_expiry_date")}
          </button>

          <button
            className="drivers-sort-button"
            onClick={() => handleSort("phone_number")}
          >
            Telefon
            {getSortArrow("phone_number")}
          </button>

          <button
            className="drivers-sort-button"
            onClick={() => handleSort("hired_at")}
          >
            Data zatrudnienia
            {getSortArrow("hired_at")}
          </button>

          <span>Akcje</span>
        </div>

        {sortedDrivers.map((driver) => {
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

              <span>{driver.first_name}</span>

              <span className="driver-name">{driver.last_name}</span>

              <span>{driver.license_number}</span>

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
                  className="driver-actions-button"
                  onClick={() => handleMenuClick(driver.id)}
                >
                  •••
                </button>

                {openMenuId === driver.id && (
                  <div className="driver-actions-menu">
                    <button onClick={() => navigate(`/drivers/${driver.id}`)}>
                      Szczegóły
                    </button>

                    {canManageDrivers && (
                      <>
                        <button
                          onClick={() => navigate(`/drivers/${driver.id}/edit`)}
                        >
                          Edytuj
                        </button>

                        <div className="driver-actions-divider"></div>

                        <button
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

        {sortedDrivers.length === 0 && !error && (
          <div className="drivers-empty">Nie znaleziono kierowców.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="drivers-pagination">
          <button
            type="button"
            className="drivers-pagination-button"
            onClick={handlePreviousPage}
            disabled={currentPage <= 1}
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
            disabled={currentPage >= totalPages}
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
            <div className="driver-delete-icon">!</div>

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
          <div className="drivers-bulk-modal">
            <div className="drivers-bulk-modal-header">
              <div>
                <h2>Usuń zaznaczonych kierowców</h2>

                <p>
                  Operacja obejmie {selectedDriverIds.length} zaznaczonych
                  kierowców.
                </p>
              </div>

              <button
                className="drivers-bulk-modal-close"
                onClick={closeBulkDeleteModal}
                disabled={bulkDeleting}
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
                className="drivers-bulk-cancel"
                onClick={closeBulkDeleteModal}
                disabled={bulkDeleting}
              >
                Anuluj
              </button>

              <button
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
