import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./VehicleDetailsPage.css";

function VehicleDetailsPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get(`vehicles/${id}/`)
      .then((response) => {
        setVehicle(response.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Błąd pobierania pojazdu:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych pojazdu.");
        setLoading(false);
      });
  }, [id]);

  const getStatusName = (status) => {
    if (status === "active") return "Aktywny";
    if (status === "maintenance") return "W serwisie";
    if (status === "inactive") return "Nieaktywny";

    return status;
  };

  const getVehicleTypeName = (type) => {
    if (type === "passenger") return "Samochód osobowy";
    if (type === "van") return "Bus / samochód dostawczy";
    if (type === "truck") return "Samochód ciężarowy";
    if (type === "special") return "Pojazd specjalny";
    if (type === "other") return "Inny";

    return type;
  };

  const getFuelTypeName = (fuelType) => {
    if (fuelType === "petrol") return "Benzyna";
    if (fuelType === "diesel") return "Diesel";
    if (fuelType === "lpg") return "LPG";
    if (fuelType === "hybrid") return "Hybryda";
    if (fuelType === "electric") return "Elektryczny";

    return "Nie podano";
  };

  const formatMileage = (mileage) => {
    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie danych pojazdu...</p>
        </main>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p className="vehicle-details-error">
            {error || "Nie znaleziono pojazdu."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="vehicle-details-header">
          <div>
            <button
              className="vehicle-details-back"
              onClick={() => navigate("/vehicles")}
            >
              ← Wróć do pojazdów
            </button>

            <h1>
              {vehicle.brand} {vehicle.model}
            </h1>

            <div className="vehicle-details-subtitle">
              <span>{vehicle.registration_number}</span>

              <span
                className={`vehicle-status vehicle-status-${vehicle.status}`}
              >
                {getStatusName(vehicle.status)}
              </span>
            </div>
          </div>

          <button
            className="vehicle-details-edit"
            onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
          >
            Edytuj pojazd
          </button>
        </div>

        <div className="vehicle-details-card">
          <h2>Dane pojazdu</h2>

          <div className="vehicle-details-grid">
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Marka</span>
              <span className="vehicle-detail-value">{vehicle.brand}</span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Model</span>
              <span className="vehicle-detail-value">{vehicle.model}</span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Numer rejestracyjny</span>
              <span className="vehicle-detail-value">
                {vehicle.registration_number}
              </span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">VIN</span>
              <span className="vehicle-detail-value">
                {vehicle.vin || "Nie podano"}
              </span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Rok produkcji</span>
              <span className="vehicle-detail-value">{vehicle.year}</span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Typ pojazdu</span>
              <span className="vehicle-detail-value">
                {getVehicleTypeName(vehicle.vehicle_type)}
              </span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Rodzaj paliwa</span>
              <span className="vehicle-detail-value">
                {getFuelTypeName(vehicle.fuel_type)}
              </span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Przebieg</span>
              <span className="vehicle-detail-value">
                {formatMileage(vehicle.mileage)}
              </span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Status</span>
              <span className="vehicle-detail-value">
                {getStatusName(vehicle.status)}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default VehicleDetailsPage;
