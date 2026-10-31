import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./DriverDetailsPage.css";

function DriverDetailsPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [driver, setDriver] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [exportingPdf, setExportingPdf] = useState(false);

  const canManageDrivers = user?.role === "admin";

  useEffect(() => {
    const loadDriverData = async () => {
      try {
        const driverResponse = await apiClient.get(`drivers/${id}/`);

        setDriver(driverResponse.data);

        const vehiclesResponse = await apiClient.get("vehicles/");

        const vehiclesData = Array.isArray(vehiclesResponse.data)
          ? vehiclesResponse.data
          : vehiclesResponse.data.results || [];

        const driverVehicles = vehiclesData.filter(
          (vehicle) => Number(vehicle.driver) === Number(id),
        );

        setVehicles(driverVehicles);

        try {
          const assignmentsResponse = await apiClient.get(
            "driver-assignments/",
          );

          const assignmentsData = Array.isArray(assignmentsResponse.data)
            ? assignmentsResponse.data
            : assignmentsResponse.data.results || [];

          const driverAssignments = assignmentsData.filter(
            (assignment) => Number(assignment.driver) === Number(id),
          );

          setAssignments(driverAssignments);
        } catch (assignmentsError) {
          console.error(
            "Błąd pobierania historii przypisań:",
            assignmentsError,
          );
        }
      } catch (err) {
        console.error("Błąd pobierania danych kierowcy:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych kierowcy.");
      } finally {
        setLoading(false);
      }
    };

    loadDriverData();
  }, [id]);

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
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
        text: "Wygasa dzisiaj",
        className: "driver-expiry-warning",
      };
    }

    if (daysLeft <= 30) {
      return {
        text: `Wygasa za ${daysLeft} dni`,
        className: "driver-expiry-warning",
      };
    }

    return {
      text: "Ważne",
      className: "driver-expiry-valid",
    };
  };

  const getExportFilename = (response) => {
    const contentDisposition = response.headers["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);

      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
      }
    }

    return (
      `flotivo-kierowca-` + `${driver.first_name}-` + `${driver.last_name}.pdf`
    );
  };

  const handleExportPdf = async () => {
    if (!driver) {
      return;
    }

    try {
      setExportingPdf(true);

      setError(null);

      const response = await apiClient.get(`drivers/${id}/card-pdf/`, {
        responseType: "blob",
      });

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
      console.error("Błąd eksportu karty kierowcy:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się wygenerować karty kierowcy.");
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie danych kierowcy...</p>
        </main>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p className="driver-details-error">
            {error || "Nie znaleziono kierowcy."}
          </p>
        </main>
      </div>
    );
  }

  const licenseStatus = getExpiryStatus(driver.license_expiry_date);

  const medicalStatus = getExpiryStatus(driver.medical_exam_expiry_date);

  const activeAssignments = assignments.filter(
    (assignment) => assignment.is_active,
  );

  const historicalAssignments = assignments.filter(
    (assignment) => !assignment.is_active,
  );

  const uniqueVehicleIds = new Set(
    assignments.map((assignment) => assignment.vehicle),
  );

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="driver-details-header">
          <div>
            <button
              className="driver-details-back"
              onClick={() => navigate("/drivers")}
            >
              ← Wróć do kierowców
            </button>

            <h1>
              {driver.first_name} {driver.last_name}
            </h1>

            <div className="driver-details-subtitle">
              <span>Kierowca</span>

              {activeAssignments.length > 0 ? (
                <span className="driver-profile-active">
                  Aktualnie przypisany
                </span>
              ) : (
                <span className="driver-profile-inactive">
                  Brak aktualnego pojazdu
                </span>
              )}
            </div>
          </div>

          <div className="driver-details-header-actions">
            <button
              type="button"
              className="driver-details-export"
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? "Generowanie..." : "Eksportuj kartę PDF"}
            </button>

            {canManageDrivers && (
              <button
                className="driver-details-edit"
                onClick={() => navigate(`/drivers/${driver.id}/edit`)}
              >
                Edytuj kierowcę
              </button>
            )}
          </div>
        </div>

        <div className="driver-details-card">
          <h2>Dane kierowcy</h2>

          <div className="driver-details-grid">
            <div className="driver-detail">
              <span className="driver-detail-label">Imię</span>

              <span className="driver-detail-value">{driver.first_name}</span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Nazwisko</span>

              <span className="driver-detail-value">{driver.last_name}</span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Numer telefonu</span>

              <span className="driver-detail-value">{driver.phone_number}</span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Data zatrudnienia</span>

              <span className="driver-detail-value">
                {formatDate(driver.hired_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="driver-license-card">
          <div className="driver-license-header">
            <div>
              <h2>Prawo jazdy i uprawnienia</h2>

              <p>
                Informacje o prawie jazdy oraz badaniach lekarskich kierowcy.
              </p>
            </div>
          </div>

          <div className="driver-details-grid">
            <div className="driver-detail">
              <span className="driver-detail-label">Numer prawa jazdy</span>

              <span className="driver-detail-value">
                {driver.license_number}
              </span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Kategorie</span>

              {driver.license_categories?.length > 0 ? (
                <div className="driver-license-categories">
                  {driver.license_categories.map((category) => (
                    <span className="driver-license-category" key={category}>
                      {category}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="driver-detail-value">Nie podano</span>
              )}
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Prawo jazdy ważne do</span>

              <span className="driver-detail-value">
                {formatDate(driver.license_expiry_date)}
              </span>

              <span
                className={`driver-expiry-status ${licenseStatus.className}`}
              >
                {licenseStatus.text}
              </span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">
                Badania lekarskie ważne do
              </span>

              <span className="driver-detail-value">
                {formatDate(driver.medical_exam_expiry_date)}
              </span>

              <span
                className={`driver-expiry-status ${medicalStatus.className}`}
              >
                {medicalStatus.text}
              </span>
            </div>
          </div>
        </div>

        <div className="driver-stats-grid">
          <div className="driver-stat-card">
            <span className="driver-stat-label">
              Aktualnie przypisane pojazdy
            </span>

            <strong className="driver-stat-value">
              {activeAssignments.length}
            </strong>
          </div>

          <div className="driver-stat-card">
            <span className="driver-stat-label">Pojazdy w historii</span>

            <strong className="driver-stat-value">
              {uniqueVehicleIds.size}
            </strong>
          </div>

          <div className="driver-stat-card">
            <span className="driver-stat-label">Zakończone przypisania</span>

            <strong className="driver-stat-value">
              {historicalAssignments.length}
            </strong>
          </div>
        </div>

        <div className="driver-vehicles-card">
          <div className="driver-vehicles-header">
            <div>
              <h2>Aktualnie przypisane pojazdy</h2>

              <p>Pojazdy, do których kierowca jest aktualnie przypisany.</p>
            </div>

            <span>Liczba pojazdów: {vehicles.length}</span>
          </div>

          {vehicles.length > 0 ? (
            <div className="driver-vehicles-list">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  className="driver-vehicle-item"
                  onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                >
                  <div>
                    <span className="driver-vehicle-name">
                      {vehicle.brand} {vehicle.model}
                    </span>

                    <span className="driver-vehicle-registration">
                      {vehicle.registration_number}
                    </span>
                  </div>

                  <span
                    className={`vehicle-status vehicle-status-${vehicle.status}`}
                  >
                    {getStatusName(vehicle.status)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="driver-vehicles-empty">
              Ten kierowca nie ma aktualnie przypisanego pojazdu.
            </p>
          )}
        </div>

        <div className="driver-history-card">
          <div className="driver-history-header">
            <div>
              <h2>Historia pojazdów</h2>

              <p>Historia przypisań kierowcy do pojazdów.</p>
            </div>

            <span>Wpisy: {assignments.length}</span>
          </div>

          {assignments.length > 0 ? (
            <div className="driver-history-list">
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  className="driver-history-item"
                  onClick={() => navigate(`/vehicles/${assignment.vehicle}`)}
                >
                  <div className="driver-history-main">
                    <div className="driver-history-title-row">
                      <span className="driver-history-name">
                        {assignment.vehicle_name}
                      </span>

                      {assignment.is_active && (
                        <span className="driver-history-active">Aktualne</span>
                      )}
                    </div>

                    <span className="driver-history-registration">
                      {assignment.vehicle_registration_number}
                    </span>

                    {assignment.notes && (
                      <span className="driver-history-notes">
                        {assignment.notes}
                      </span>
                    )}
                  </div>

                  <div className="driver-history-dates">
                    <div>
                      <span className="driver-history-date-label">Od</span>

                      <strong>{formatDate(assignment.start_date)}</strong>
                    </div>

                    <span className="driver-history-arrow">→</span>

                    <div>
                      <span className="driver-history-date-label">Do</span>

                      <strong>
                        {assignment.end_date
                          ? formatDate(assignment.end_date)
                          : "Obecnie"}
                      </strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="driver-vehicles-empty">
              Brak historii przypisań tego kierowcy.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

export default DriverDetailsPage;
