import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./AlertsPage.css";

function AlertsPage({ onLogout }) {
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get("vehicles/")
      .then((response) => {
        const vehicles = response.data;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const warningLimit = new Date(today);
        warningLimit.setDate(warningLimit.getDate() + 30);

        const generatedAlerts = [];

        vehicles.forEach((vehicle) => {
          if (vehicle.inspection_expiry_date) {
            const inspectionDate = new Date(vehicle.inspection_expiry_date);

            inspectionDate.setHours(0, 0, 0, 0);

            if (inspectionDate <= warningLimit) {
              generatedAlerts.push({
                id: `inspection-${vehicle.id}`,
                vehicleId: vehicle.id,
                vehicleName: `${vehicle.brand} ${vehicle.model}`,
                registrationNumber: vehicle.registration_number,
                type: "Przegląd techniczny",
                date: vehicle.inspection_expiry_date,
                status: getExpiryStatus(vehicle.inspection_expiry_date),
              });
            }
          }

          if (vehicle.insurance_expiry_date) {
            const insuranceDate = new Date(vehicle.insurance_expiry_date);

            insuranceDate.setHours(0, 0, 0, 0);

            if (insuranceDate <= warningLimit) {
              generatedAlerts.push({
                id: `insurance-${vehicle.id}`,
                vehicleId: vehicle.id,
                vehicleName: `${vehicle.brand} ${vehicle.model}`,
                registrationNumber: vehicle.registration_number,
                type: "Polisa OC",
                date: vehicle.insurance_expiry_date,
                status: getExpiryStatus(vehicle.insurance_expiry_date),
              });
            }
          }
        });

        generatedAlerts.sort((a, b) => new Date(a.date) - new Date(b.date));

        setAlerts(generatedAlerts);
      })
      .catch((err) => {
        console.error("Błąd pobierania alertów:", err);
        setError("Nie udało się pobrać alertów.");
      });
  }, []);

  const getExpiryStatus = (date) => {
    const today = new Date();
    const expiryDate = new Date(date);

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const difference = expiryDate - today;
    const daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return {
        text: "Po terminie",
        className: "alert-status-expired",
      };
    }

    if (daysLeft === 0) {
      return {
        text: "Wygasa dzisiaj",
        className: "alert-status-warning",
      };
    }

    return {
      text: `Wygasa za ${daysLeft} dni`,
      className: "alert-status-warning",
    };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("pl-PL");
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="alerts-header">
          <div>
            <button
              className="alerts-back"
              onClick={() => navigate("/dashboard")}
            >
              ← Wróć do dashboardu
            </button>

            <h1>Wymagają uwagi</h1>

            <p>
              Przeglądy techniczne i polisy OC po terminie lub wygasające w
              ciągu 30 dni.
            </p>
          </div>
        </div>

        {error && <p className="alerts-error">{error}</p>}

        <div className="alerts-count">Liczba alertów: {alerts.length}</div>

        <div className="alerts-list">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              className="alert-item"
              onClick={() => navigate(`/vehicles/${alert.vehicleId}`)}
            >
              <div className="alert-item-main">
                <span className="alert-vehicle-name">{alert.vehicleName}</span>

                <span className="alert-registration">
                  {alert.registrationNumber}
                </span>
              </div>

              <div className="alert-type">{alert.type}</div>

              <div className="alert-date">{formatDate(alert.date)}</div>

              <span className={`alert-status ${alert.status.className}`}>
                {alert.status.text}
              </span>
            </button>
          ))}

          {alerts.length === 0 && !error && (
            <div className="alerts-empty">
              Brak terminów wymagających uwagi.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AlertsPage;
