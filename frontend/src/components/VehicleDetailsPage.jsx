import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./VehicleDetailsPage.css";

function VehicleDetailsPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [vehicle, setVehicle] = useState(null);
  const [driver, setDriver] = useState(null);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadVehicle = async () => {
      try {
        const vehicleResponse = await apiClient.get(`vehicles/${id}/`);
        const vehicleData = vehicleResponse.data;

        setVehicle(vehicleData);

        if (vehicleData.driver) {
          try {
            const driverResponse = await apiClient.get(
              `drivers/${vehicleData.driver}/`,
            );

            setDriver(driverResponse.data);
          } catch (driverError) {
            console.error("Błąd pobierania kierowcy:", driverError);
          }
        }

        try {
          const serviceResponse = await apiClient.get(
            `service-records/?vehicle=${id}`,
          );

          setServiceRecords(serviceResponse.data);
        } catch (serviceError) {
          console.error("Błąd pobierania historii serwisowej:", serviceError);
        }
      } catch (err) {
        console.error("Błąd pobierania pojazdu:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych pojazdu.");
      } finally {
        setLoading(false);
      }
    };

    loadVehicle();
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
    if (mileage === null || mileage === undefined) {
      return "Nie podano";
    }

    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  const formatCost = (cost) => {
    return `${Number(cost).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  };

  const getExpiryStatus = (date) => {
    if (!date) {
      return {
        text: "Brak terminu",
        className: "expiry-status-none",
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
        className: "expiry-status-expired",
      };
    }

    if (daysLeft <= 30) {
      return {
        text: daysLeft === 0 ? "Wygasa dzisiaj" : `Wygasa za ${daysLeft} dni`,
        className: "expiry-status-warning",
      };
    }

    return {
      text: "Ważne",
      className: "expiry-status-valid",
    };
  };

  const getDriverName = () => {
    if (driver) {
      return `${driver.first_name} ${driver.last_name}`;
    }

    if (vehicle.driver_name) {
      return vehicle.driver_name;
    }

    return "Brak przypisanego kierowcy";
  };

  const handleDeleteServiceRecord = async (record) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć wpis "${record.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(`service-records/${record.id}/`);

      setServiceRecords((currentRecords) =>
        currentRecords.filter(
          (currentRecord) => currentRecord.id !== record.id,
        ),
      );
    } catch (err) {
      console.error("Błąd usuwania wpisu serwisowego:", err);

      setError("Nie udało się usunąć wpisu serwisowego.");
    }
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

  const inspectionStatus = getExpiryStatus(vehicle.inspection_expiry_date);

  const insuranceStatus = getExpiryStatus(vehicle.insurance_expiry_date);

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

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Kierowca</span>

              {driver ? (
                <button
                  className="vehicle-driver-link"
                  onClick={() => navigate(`/drivers/${driver.id}`)}
                >
                  {getDriverName()}
                </button>
              ) : (
                <span className="vehicle-detail-value">{getDriverName()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="vehicle-expiry-card">
          <h2>Terminy</h2>

          <div className="vehicle-expiry-grid">
            <div className="vehicle-expiry-item">
              <span className="vehicle-detail-label">Przegląd techniczny</span>

              <span className="vehicle-expiry-date">
                {formatDate(vehicle.inspection_expiry_date)}
              </span>

              <span className={`expiry-status ${inspectionStatus.className}`}>
                {inspectionStatus.text}
              </span>
            </div>

            <div className="vehicle-expiry-item">
              <span className="vehicle-detail-label">Polisa OC</span>

              <span className="vehicle-expiry-date">
                {formatDate(vehicle.insurance_expiry_date)}
              </span>

              <span className={`expiry-status ${insuranceStatus.className}`}>
                {insuranceStatus.text}
              </span>
            </div>
          </div>
        </div>

        <div className="vehicle-service-card">
          <div className="vehicle-service-header">
            <div>
              <h2>Historia napraw</h2>

              <p>Historia serwisów i napraw tego pojazdu.</p>
            </div>

            <button
              className="vehicle-service-add"
              onClick={() =>
                navigate(`/service-history/add?vehicle=${vehicle.id}`)
              }
            >
              + Dodaj wpis
            </button>
          </div>

          {serviceRecords.length > 0 ? (
            <div className="vehicle-service-list">
              {serviceRecords.map((record) => (
                <div className="vehicle-service-item" key={record.id}>
                  <div className="vehicle-service-main">
                    <span className="vehicle-service-title">
                      {record.title}
                    </span>

                    <span className="vehicle-service-description">
                      {record.description || "Brak dodatkowego opisu"}
                    </span>
                  </div>

                  <div className="vehicle-service-data">
                    <span>{formatDate(record.service_date)}</span>

                    <span>{formatMileage(record.mileage)}</span>

                    <strong>{formatCost(record.cost)}</strong>
                  </div>

                  <div className="vehicle-service-actions">
                    <button
                      type="button"
                      className="vehicle-service-edit"
                      onClick={() =>
                        navigate(`/service-history/${record.id}/edit`)
                      }
                    >
                      Edytuj
                    </button>

                    <button
                      type="button"
                      className="vehicle-service-delete"
                      onClick={() => handleDeleteServiceRecord(record)}
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="vehicle-service-empty">
              Brak wpisów w historii napraw.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default VehicleDetailsPage;
