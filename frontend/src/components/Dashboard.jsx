import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [recentVehicleCount, setRecentVehicleCount] = useState(0);
  const [recentVehicles, setRecentVehicles] = useState([]);

  const canViewDriverAlerts = user?.role === "admin";

  const getResponseData = (response) => {
    if (Array.isArray(response.data)) {
      return response.data;
    }

    return response.data.results || [];
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [vehiclesResponse, driversResponse, documentsResponse] =
          await Promise.all([
            apiClient.get("vehicles/"),
            apiClient.get("drivers/"),
            apiClient.get("vehicle-documents/"),
          ]);

        const vehicles = getResponseData(vehiclesResponse);

        const drivers = getResponseData(driversResponse);

        const documents = getResponseData(documentsResponse);

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

            if (inspectionDate <= warningLimit) {
              attentionItems += 1;
            }
          }

          if (vehicle.insurance_expiry_date) {
            const insuranceDate = new Date(vehicle.insurance_expiry_date);

            insuranceDate.setHours(0, 0, 0, 0);

            if (insuranceDate <= warningLimit) {
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

          if (expiryDate <= warningLimit) {
            attentionItems += 1;
          }
        });

        if (canViewDriverAlerts) {
          drivers.forEach((driver) => {
            if (driver.license_expiry_date) {
              const licenseDate = new Date(driver.license_expiry_date);

              licenseDate.setHours(0, 0, 0, 0);

              if (licenseDate <= warningLimit) {
                attentionItems += 1;
              }
            }

            if (driver.medical_exam_expiry_date) {
              const medicalDate = new Date(driver.medical_exam_expiry_date);

              medicalDate.setHours(0, 0, 0, 0);

              if (medicalDate <= warningLimit) {
                attentionItems += 1;
              }
            }
          });
        }

        setAttentionCount(attentionItems);

        const thirtyDaysAgo = new Date(today);

        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentlyAdded = vehicles.filter((vehicle) => {
          const createdAt = new Date(vehicle.created_at);

          return createdAt >= thirtyDaysAgo;
        });

        setRecentVehicleCount(recentlyAdded.length);

        const recent = [...vehicles]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);

        setRecentVehicles(recent);
      } catch (error) {
        console.error("Nie udało się pobrać danych dashboardu:", error);
      }
    };

    loadDashboard();
  }, [canViewDriverAlerts]);

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <h1>Dashboard</h1>

        <p>Witaj w panelu zarządzania flotą Flotivo.</p>

        <div className="dashboard-stats">
          <button
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/vehicles")}
          >
            <span className="dashboard-card-label">Pojazdy</span>

            <strong className="dashboard-card-value">{vehicleCount}</strong>

            <span className="dashboard-card-description">
              Wszystkie pojazdy w systemie
            </span>
          </button>

          <button
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/drivers")}
          >
            <span className="dashboard-card-label">Kierowcy</span>

            <strong className="dashboard-card-value">{driverCount}</strong>

            <span className="dashboard-card-description">
              Kierowcy w systemie
            </span>
          </button>

          <button
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/alerts")}
          >
            <span className="dashboard-card-label">Wymagają uwagi</span>

            <strong className="dashboard-card-value">{attentionCount}</strong>

            <span className="dashboard-card-description">
              Terminy pojazdów i kierowców po terminie lub do 30 dni
            </span>
          </button>

          <button
            className="dashboard-card dashboard-card-button"
            onClick={() => navigate("/vehicles?recent=1")}
          >
            <span className="dashboard-card-label">Ostatnio dodane</span>

            <strong className="dashboard-card-value">
              {recentVehicleCount}
            </strong>

            <span className="dashboard-card-description">
              Pojazdy dodane w ostatnich 30 dniach
            </span>
          </button>
        </div>

        <section className="dashboard-recent">
          <div className="dashboard-section-header">
            <h2>Ostatnio dodane pojazdy</h2>

            <span>Ostatnie {recentVehicles.length} pojazdów</span>
          </div>

          <div className="dashboard-table">
            <div className="dashboard-table-header">
              <span>Pojazd</span>
              <span>Numer rejestracyjny</span>
              <span>Rok produkcji</span>
              <span>Status</span>
            </div>

            {recentVehicles.map((vehicle) => (
              <div className="dashboard-table-row" key={vehicle.id}>
                <span>
                  {vehicle.brand} {vehicle.model}
                </span>

                <span>{vehicle.registration_number}</span>

                <span>{vehicle.year}</span>

                <span
                  className={`vehicle-status vehicle-status-${vehicle.status}`}
                >
                  {vehicle.status === "active" && "Aktywny"}

                  {vehicle.status === "maintenance" && "W serwisie"}

                  {vehicle.status === "inactive" && "Nieaktywny"}
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
