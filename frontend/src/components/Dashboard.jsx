import { useEffect, useState } from "react";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";

function Dashboard({ onLogout }) {
  const [vehicleCount, setVehicleCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);
  const [activeVehicleCount, setActiveVehicleCount] = useState(0);
  const [recentVehicles, setRecentVehicles] = useState([]);

  useEffect(() => {
    apiClient
      .get("vehicles/")
      .then((response) => {
        const vehicles = response.data;

        setVehicleCount(vehicles.length);

        const activeVehicles = vehicles.filter(
          (vehicle) => vehicle.status === "active",
        );

        setActiveVehicleCount(activeVehicles.length);

        const recent = [...vehicles].sort((a, b) => b.id - a.id).slice(0, 5);

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
          <div className="dashboard-card">
            <span className="dashboard-card-label">Pojazdy</span>

            <strong className="dashboard-card-value">{vehicleCount}</strong>

            <span className="dashboard-card-description">
              Wszystkie pojazdy w systemie
            </span>
          </div>

          <div className="dashboard-card">
            <span className="dashboard-card-label">Kierowcy</span>

            <strong className="dashboard-card-value">{driverCount}</strong>

            <span className="dashboard-card-description">
              Kierowcy w systemie
            </span>
          </div>

          <div className="dashboard-card">
            <span className="dashboard-card-label">Aktywne pojazdy</span>

            <strong className="dashboard-card-value">
              {activeVehicleCount}
            </strong>

            <span className="dashboard-card-description">
              Pojazdy ze statusem aktywnym
            </span>
          </div>
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
