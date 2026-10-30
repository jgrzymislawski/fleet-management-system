import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./DriverList.css";

function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [exporting, setExporting] = useState(false);

  const navigate = useNavigate();

  const { user } = useAuth();

  const canManageDrivers = user?.role === "admin";

  useEffect(() => {
    apiClient
      .get("drivers/")
      .then((response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : response.data.results || [];

        setDrivers(data);
      })
      .catch((err) => {
        console.error(err);
        setError("Nie udało się pobrać listy kierowców");
      });
  }, []);

  const handleMenuClick = (driverId) => {
    if (openMenuId === driverId) {
      setOpenMenuId(null);
    } else {
      setOpenMenuId(driverId);
    }
  };

  const handleDelete = (driver) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć kierowcę ${driver.first_name} ${driver.last_name}?`,
    );

    if (!confirmed) {
      return;
    }

    apiClient
      .delete(`drivers/${driver.id}/`)
      .then(() => {
        setDrivers((currentDrivers) =>
          currentDrivers.filter(
            (currentDriver) => currentDriver.id !== driver.id,
          ),
        );

        setOpenMenuId(null);
      })
      .catch((err) => {
        console.error("Błąd usuwania kierowcy:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się usunąć kierowcy.");
      });
  };

  const handleSort = (field) => {
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
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  const normalizedSearchText = searchText.toLowerCase().trim();

  const filteredDrivers = drivers.filter((driver) => {
    if (!normalizedSearchText) {
      return true;
    }

    const firstName = driver.first_name?.toLowerCase() || "";
    const lastName = driver.last_name?.toLowerCase() || "";
    const licenseNumber = driver.license_number?.toLowerCase() || "";
    const phoneNumber = driver.phone_number?.toLowerCase() || "";

    const fullName = `${firstName} ${lastName}`;

    return (
      fullName.includes(normalizedSearchText) ||
      firstName.includes(normalizedSearchText) ||
      lastName.includes(normalizedSearchText) ||
      licenseNumber.includes(normalizedSearchText) ||
      phoneNumber.includes(normalizedSearchText)
    );
  });

  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (!sortField) {
      return 0;
    }

    let valueA;
    let valueB;

    if (sortField === "first_name") {
      valueA = a.first_name || "";
      valueB = b.first_name || "";
    }

    if (sortField === "last_name") {
      valueA = a.last_name || "";
      valueB = b.last_name || "";
    }

    if (sortField === "license_number") {
      valueA = a.license_number || "";
      valueB = b.license_number || "";
    }

    if (sortField === "phone_number") {
      valueA = a.phone_number || "";
      valueB = b.phone_number || "";
    }

    if (sortField === "hired_at") {
      valueA = a.hired_at ? new Date(a.hired_at) : new Date(0);

      valueB = b.hired_at ? new Date(b.hired_at) : new Date(0);
    }

    if (sortField === "hired_at") {
      if (sortDirection === "asc") {
        return valueA - valueB;
      }

      return valueB - valueA;
    }

    const comparison = String(valueA).localeCompare(String(valueB), "pl", {
      sensitivity: "base",
    });

    return sortDirection === "asc" ? comparison : -comparison;
  });

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

  const handleExport = async () => {
    if (sortedDrivers.length === 0) {
      setError("Brak kierowców do wyeksportowania.");

      return;
    }

    try {
      setExporting(true);
      setError(null);

      const driverIds = sortedDrivers.map((driver) => driver.id);

      const response = await apiClient.post(
        "drivers/export/",
        {
          driver_ids: driverIds,
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
      console.error("Błąd eksportu kierowców:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się wyeksportować kierowców.");
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
            disabled={exporting || sortedDrivers.length === 0}
          >
            {exporting ? "Eksportowanie..." : "Eksportuj"}
          </button>

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
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>

      <div className="drivers-results-info">
        Wyświetlono: {sortedDrivers.length} z {drivers.length}
      </div>

      <div className="drivers-table">
        <div className="drivers-table-header">
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

        {sortedDrivers.map((driver) => (
          <div className="drivers-table-row" key={driver.id}>
            <span>{driver.first_name}</span>

            <span className="driver-name">{driver.last_name}</span>

            <span>{driver.license_number}</span>

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
        ))}

        {sortedDrivers.length === 0 && !error && (
          <div className="drivers-empty">Nie znaleziono kierowców.</div>
        )}
      </div>
    </div>
  );
}

export default DriverList;
