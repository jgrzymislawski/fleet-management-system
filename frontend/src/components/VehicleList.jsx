import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import "./VehicleList.css";

function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    apiClient
      .get("vehicles/")
      .then((response) => {
        setVehicles(response.data);
      })
      .catch((err) => {
        console.error(err);
        setError("Nie udało się pobrać listy pojazdów");
      });
  }, []);

  const handleMenuClick = (vehicleId) => {
    if (openMenuId === vehicleId) {
      setOpenMenuId(null);
    } else {
      setOpenMenuId(vehicleId);
    }
  };

  const handleDelete = (vehicle) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć pojazd ${vehicle.brand} ${vehicle.model} (${vehicle.registration_number})?`,
    );

    if (!confirmed) {
      return;
    }

    apiClient
      .delete(`vehicles/${vehicle.id}/`)
      .then(() => {
        setVehicles((currentVehicles) =>
          currentVehicles.filter(
            (currentVehicle) => currentVehicle.id !== vehicle.id,
          ),
        );

        setOpenMenuId(null);
      })
      .catch((err) => {
        console.error("Błąd usuwania pojazdu:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się usunąć pojazdu.");
      });
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

  const getVehicleTypeName = (type) => {
    if (type === "passenger") {
      return "Osobowy";
    }

    if (type === "van") {
      return "Bus / dostawczy";
    }

    if (type === "truck") {
      return "Ciężarowy";
    }

    if (type === "special") {
      return "Specjalny";
    }

    if (type === "other") {
      return "Inny";
    }

    return type;
  };

  const formatMileage = (mileage) => {
    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  return (
    <div className="vehicles">
      <div className="vehicles-header">
        <div>
          <h1>Pojazdy</h1>
          <p>Zarządzaj pojazdami znajdującymi się w Twojej flocie.</p>
        </div>

        <button
          className="add-vehicle-button"
          onClick={() => navigate("/vehicles/add")}
        >
          + Dodaj pojazd
        </button>
      </div>

      {error && <p className="vehicles-error">{error}</p>}

      <div className="vehicles-table">
        <div className="vehicles-table-header">
          <span>Pojazd</span>
          <span>Rejestracja</span>
          <span>Typ</span>
          <span>Rok</span>
          <span>Przebieg</span>
          <span>Status</span>
          <span>Akcje</span>
        </div>

        {vehicles.map((vehicle) => (
          <div className="vehicles-table-row" key={vehicle.id}>
            <span className="vehicle-name">
              {vehicle.brand} {vehicle.model}
            </span>

            <span>{vehicle.registration_number}</span>

            <span>{getVehicleTypeName(vehicle.vehicle_type)}</span>

            <span>{vehicle.year}</span>

            <span>{formatMileage(vehicle.mileage)}</span>

            <span className={`vehicle-status vehicle-status-${vehicle.status}`}>
              {getStatusName(vehicle.status)}
            </span>

            <div className="vehicle-actions">
              <button
                className="vehicle-actions-button"
                onClick={() => handleMenuClick(vehicle.id)}
              >
                •••
              </button>

              {openMenuId === vehicle.id && (
                <div className="vehicle-actions-menu">
                  <button onClick={() => navigate(`/vehicles/${vehicle.id}`)}>
                    Szczegóły
                  </button>

                  <button
                    onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
                  >
                    Edytuj
                  </button>

                  <div className="vehicle-actions-divider"></div>

                  <button
                    className="vehicle-actions-delete"
                    onClick={() => handleDelete(vehicle)}
                  >
                    Usuń
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VehicleList;
