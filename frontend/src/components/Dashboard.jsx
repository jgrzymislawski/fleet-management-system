import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [recentVehicleCount, setRecentVehicleCount] = useState(0);
  const [recentVehicles, setRecentVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const canViewDriverAlerts = user?.role === "admin";

  useEffect(() => {
    let isMounted = true;

    const parseDate = (value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const isWithinWarningPeriod = (value, warningLimit) => {
      const date = parseDate(value);
      if (!date) return false;
      date.setHours(0, 0, 0, 0);
      return date <= warningLimit;
    };

    const loadDashboard = async () => {
      setIsLoading(true);
      setLoadError(false);

      try {
        const [vehicles, drivers, documents] = await Promise.all([
          fetchAllPages(apiClient, "vehicles/"),
          fetchAllPages(apiClient, "drivers/"),
          fetchAllPages(apiClient, "vehicle-documents/"),
        ]);

        if (!isMounted) return;

        const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
        const safeDrivers = Array.isArray(drivers) ? drivers : [];
        const safeDocuments = Array.isArray(documents) ? documents : [];

        setVehicleCount(safeVehicles.length);
        setDriverCount(safeDrivers.length);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const warningLimit = new Date(today);
        warningLimit.setDate(warningLimit.getDate() + 30);

        let attentionItems = 0;

        safeVehicles.forEach((vehicle) => {
          if (
            isWithinWarningPeriod(vehicle.inspection_expiry_date, warningLimit)
          ) {
            attentionItems += 1;
          }

          if (
            isWithinWarningPeriod(vehicle.insurance_expiry_date, warningLimit)
          ) {
            attentionItems += 1;
          }
        });

        safeDocuments.forEach((document) => {
          if (
            !document.expiry_date ||
            document.document_type === "oc" ||
            document.document_type === "inspection"
          ) {
            return;
          }

          if (isWithinWarningPeriod(document.expiry_date, warningLimit)) {
            attentionItems += 1;
          }
        });

        if (canViewDriverAlerts) {
          safeDrivers.forEach((driver) => {
            if (
              isWithinWarningPeriod(driver.license_expiry_date, warningLimit)
            ) {
              attentionItems += 1;
            }

            if (
              isWithinWarningPeriod(
                driver.medical_exam_expiry_date,
                warningLimit,
              )
            ) {
              attentionItems += 1;
            }
          });
        }

        setAttentionCount(attentionItems);

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentlyAdded = safeVehicles.filter((vehicle) => {
          const createdAt = parseDate(vehicle.created_at);
          return createdAt && createdAt >= thirtyDaysAgo;
        });

        setRecentVehicleCount(recentlyAdded.length);

        const recent = [...safeVehicles]
          .sort((a, b) => {
            const dateA = parseDate(a.created_at);
            const dateB = parseDate(b.created_at);

            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;

            return dateB - dateA;
          })
          .slice(0, 5);

        setRecentVehicles(recent);
      } catch (error) {
        if (!isMounted) return;

        console.error("Nie udało się pobrać danych pulpitu:", error);
        setLoadError(true);
        setVehicleCount(0);
        setDriverCount(0);
        setAttentionCount(0);
        setRecentVehicleCount(0);
        setRecentVehicles([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [canViewDriverAlerts]);

  const getStatusLabel = (status) => {
    if (status === "active") return "Aktywny";
    if (status === "maintenance") return "W serwisie";
    if (status === "inactive") return "Nieaktywny";
    return "Brak danych";
  };

  const getStatusClass = (status) => {
    if (
      status === "active" ||
      status === "maintenance" ||
      status === "inactive"
    ) {
      return `vehicle-status vehicle-status-${status}`;
    }

    return "vehicle-status vehicle-status-unknown";
  };

  const displayValue = (value) => (isLoading ? "–" : value);

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <h1>Pulpit</h1>
        <p>Witaj w panelu zarządzania flotą Flotivo.</p>

        {loadError && (
          <div className="dashboard-error" role="alert">
            Nie udało się pobrać danych pulpitu. Odśwież stronę i spróbuj
            ponownie.
          </div>
        )}

        <div className="dashboard-stats">
          <button
            type="button"
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/vehicles")}
          >
            <span className="dashboard-card-label">Pojazdy</span>
            <strong className="dashboard-card-value">
              {displayValue(vehicleCount)}
            </strong>
            <span className="dashboard-card-description">
              Wszystkie pojazdy w systemie
            </span>
          </button>

          <button
            type="button"
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/drivers")}
          >
            <span className="dashboard-card-label">Kierowcy</span>
            <strong className="dashboard-card-value">
              {displayValue(driverCount)}
            </strong>
            <span className="dashboard-card-description">
              Kierowcy w systemie
            </span>
          </button>

          <button
            type="button"
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/alerts")}
          >
            <span className="dashboard-card-label">Wymagają uwagi</span>
            <strong className="dashboard-card-value">
              {displayValue(attentionCount)}
            </strong>
            <span className="dashboard-card-description">
              Terminy pojazdów i kierowców po terminie lub do 30 dni
            </span>
          </button>

          <button
            type="button"
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/vehicles?recent=1")}
          >
            <span className="dashboard-card-label">Ostatnio dodane</span>
            <strong className="dashboard-card-value">
              {displayValue(recentVehicleCount)}
            </strong>
            <span className="dashboard-card-description">
              Pojazdy dodane w ostatnich 30 dniach
            </span>
          </button>
        </div>

        <section className="dashboard-recent">
          <div className="dashboard-section-header">
            <h2>Ostatnio dodane pojazdy</h2>
            <span>
              {isLoading
                ? "Ładowanie..."
                : `Ostatnie ${recentVehicles.length} pojazdów`}
            </span>
          </div>

          <div className="dashboard-table">
            <div className="dashboard-table-header">
              <span>Pojazd</span>
              <span>Numer rejestracyjny</span>
              <span>Rok produkcji</span>
              <span>Status</span>
            </div>

            {!isLoading && recentVehicles.length === 0 && (
              <div className="dashboard-table-empty">
                {loadError
                  ? "Nie udało się pobrać listy pojazdów."
                  : "Brak pojazdów do wyświetlenia."}
              </div>
            )}

            {recentVehicles.map((vehicle) => (
              <div className="dashboard-table-row" key={vehicle.id}>
                <span>
                  {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
                    "Brak danych"}
                </span>
                <span>{vehicle.registration_number || "Brak danych"}</span>
                <span>{vehicle.year || "Brak danych"}</span>
                <span className={getStatusClass(vehicle.status)}>
                  {getStatusLabel(vehicle.status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
