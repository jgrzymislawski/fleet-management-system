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
  const [error, setError] = useState("");

  const canViewDriverAlerts = user?.role === "admin";

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [vehicles, drivers, documents] = await Promise.all([
          fetchAllPages(apiClient, "vehicles/"),
          fetchAllPages(apiClient, "drivers/"),
          fetchAllPages(apiClient, "vehicle-documents/"),
        ]);

        if (!isMounted) {
          return;
        }

        setVehicleCount(vehicles.length);
        setDriverCount(drivers.length);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const warningLimit = new Date(today);
        warningLimit.setDate(warningLimit.getDate() + 30);

        let attentionItems = 0;

        vehicles.forEach((vehicle) => {
          if (vehicle.inspection_expiry_date) {
            const inspectionDate = new Date(vehicle.inspection_expiry_date);
            inspectionDate.setHours(0, 0, 0, 0);

            if (
              !Number.isNaN(inspectionDate.getTime()) &&
              inspectionDate <= warningLimit
            ) {
              attentionItems += 1;
            }
          }

          if (vehicle.insurance_expiry_date) {
            const insuranceDate = new Date(vehicle.insurance_expiry_date);
            insuranceDate.setHours(0, 0, 0, 0);

            if (
              !Number.isNaN(insuranceDate.getTime()) &&
              insuranceDate <= warningLimit
            ) {
              attentionItems += 1;
            }
          }
        });

        documents.forEach((document) => {
          if (!document.expiry_date) {
            return;
          }

          if (
            document.document_type === "oc" ||
            document.document_type === "inspection"
          ) {
            return;
          }

          const expiryDate = new Date(document.expiry_date);
          expiryDate.setHours(0, 0, 0, 0);

          if (
            !Number.isNaN(expiryDate.getTime()) &&
            expiryDate <= warningLimit
          ) {
            attentionItems += 1;
          }
        });

        if (canViewDriverAlerts) {
          drivers.forEach((driver) => {
            if (driver.license_expiry_date) {
              const licenseDate = new Date(driver.license_expiry_date);
              licenseDate.setHours(0, 0, 0, 0);

              if (
                !Number.isNaN(licenseDate.getTime()) &&
                licenseDate <= warningLimit
              ) {
                attentionItems += 1;
              }
            }

            if (driver.medical_exam_expiry_date) {
              const medicalDate = new Date(driver.medical_exam_expiry_date);
              medicalDate.setHours(0, 0, 0, 0);

              if (
                !Number.isNaN(medicalDate.getTime()) &&
                medicalDate <= warningLimit
              ) {
                attentionItems += 1;
              }
            }
          });
        }

        setAttentionCount(attentionItems);

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentlyAdded = vehicles.filter((vehicle) => {
          if (!vehicle.created_at) {
            return false;
          }

          const createdAt = new Date(vehicle.created_at);

          return (
            !Number.isNaN(createdAt.getTime()) && createdAt >= thirtyDaysAgo
          );
        });

        setRecentVehicleCount(recentlyAdded.length);

        const recent = [...vehicles]
          .sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();

            if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
              return 0;
            }

            if (Number.isNaN(dateA)) {
              return 1;
            }

            if (Number.isNaN(dateB)) {
              return -1;
            }

            return dateB - dateA;
          })
          .slice(0, 5);

        setRecentVehicles(recent);
      } catch (loadError) {
        console.error("Nie udało się pobrać danych pulpitu:", loadError);

        if (isMounted) {
          setError(
            "Nie udało się pobrać danych pulpitu. Spróbuj ponownie później.",
          );
        }
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

  const getVehicleStatusLabel = (status) => {
    switch (status) {
      case "active":
        return "Aktywny";
      case "maintenance":
        return "W serwisie";
      case "inactive":
        return "Nieaktywny";
      default:
        return "Nieznany";
    }
  };

  const getVehicleStatusClass = (status) => {
    if (["active", "maintenance", "inactive"].includes(status)) {
      return `vehicle-status vehicle-status-${status}`;
    }

    return "vehicle-status vehicle-status-inactive";
  };

  const displayValue = (value) => (isLoading ? "—" : value);

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <h1>Pulpit</h1>

        <p>Witaj w panelu zarządzania flotą Flotivo.</p>

        {error && <div className="dashboard-error">{error}</div>}

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
              {canViewDriverAlerts
                ? "Terminy pojazdów i kierowców po terminie lub do 30 dni"
                : "Terminy pojazdów po terminie lub do 30 dni"}
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

            {!isLoading && recentVehicles.length === 0 ? (
              <div className="dashboard-table-empty">
                <div className="dashboard-table-empty-icon">🚗</div>

                <h3>Brak pojazdów</h3>

                <p>
                  Nie masz jeszcze żadnych pojazdów w systemie. Dodaj pierwszy,
                  aby rozpocząć zarządzanie flotą.
                </p>

                <button type="button" onClick={() => navigate("/vehicles/add")}>
                  Dodaj pierwszy pojazd
                </button>
              </div>
            ) : (
              recentVehicles.map((vehicle) => (
                <div className="dashboard-table-row" key={vehicle.id}>
                  <span>
                    {vehicle.brand || "—"} {vehicle.model || ""}
                  </span>

                  <span>{vehicle.registration_number || "—"}</span>

                  <span>{vehicle.year || "—"}</span>

                  <span className={getVehicleStatusClass(vehicle.status)}>
                    {getVehicleStatusLabel(vehicle.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
