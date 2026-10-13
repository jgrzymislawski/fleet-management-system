import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";

function Dashboard({ onLogout }) {
  const navigate = useNavigate();

  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [recentVehicleCount, setRecentVehicleCount] = useState(0);
  const [recentVehicles, setRecentVehicles] = useState([]);

  useEffect(() => {
    apiClient
      .get("vehicles/")
      .then((response) => {
        const vehicles = response.data;

        setVehicleCount(vehicles.length);

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
      })
      .catch((error) => {
        console.error("Nie udało się pobrać pojazdów:", error);
      });

    apiClient
      .get("drivers/")
      .then((response) => {
        setDriverCount(response.data.length);
      })
      .catch((error) => {
        console.error("Nie udało się pobrać kierowców:", error);
      });
  }, []);

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
              OC i przeglądy po terminie lub do 30 dni
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
