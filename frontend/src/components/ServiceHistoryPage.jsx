import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./ServiceHistoryPage.css";

function ServiceHistoryPage({ onLogout }) {
  const navigate = useNavigate();

  const { user, canEditCompany } = useAuth();

  const [serviceRecords, setServiceRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);

  const canAddServiceRecord =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [serviceResponse, vehiclesResponse] = await Promise.all([
          apiClient.get("service-records/"),
          apiClient.get("vehicles/"),
        ]);

        setServiceRecords(serviceResponse.data);
        setVehicles(vehiclesResponse.data);
      } catch (err) {
        console.error("Błąd pobierania historii napraw:", err);

        setError("Nie udało się pobrać historii napraw.");
      }
    };

    loadData();
  }, []);

  const getVehicle = (vehicleId) => {
    return vehicles.find((vehicle) => Number(vehicle.id) === Number(vehicleId));
  };

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  const formatMileage = (mileage) => {
    if (mileage === null || mileage === undefined) {
      return "Nie podano";
    }

    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  const formatCost = (cost) => {
    return `${Number(cost).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  };

  const handleDelete = async (record) => {
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
      console.error("Błąd usuwania wpisu:", err);

      setError("Nie udało się usunąć wpisu.");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="service-history-header">
          <div>
            <h1>Historia napraw</h1>

            <p>
              Wszystkie naprawy i serwisy pojazdów znajdujących się we flocie.
            </p>
          </div>

          {canAddServiceRecord && (
            <button
              className="service-history-add"
              onClick={() => navigate("/service-history/add")}
            >
              + Dodaj wpis
            </button>
          )}
        </div>

        {error && <p className="service-history-error">{error}</p>}

        <div className="service-history-count">
          Liczba wpisów: {serviceRecords.length}
        </div>

        <div className="service-history-table">
          <div className="service-history-table-header">
            <span>Pojazd</span>
            <span>Naprawa</span>
            <span>Data</span>
            <span>Przebieg</span>
            <span>Koszt</span>
            <span>Akcje</span>
          </div>

          {serviceRecords.map((record) => {
            const vehicle = getVehicle(record.vehicle);

            const canEditRecord = vehicle && canEditCompany(vehicle.company);

            return (
              <div
                className="service-history-row"
                key={record.id}
                onClick={() => navigate(`/vehicles/${record.vehicle}`)}
              >
                <div className="service-history-vehicle">
                  <span className="service-history-vehicle-name">
                    {vehicle
                      ? `${vehicle.brand} ${vehicle.model}`
                      : "Nieznany pojazd"}
                  </span>

                  <span className="service-history-registration">
                    {vehicle?.registration_number || ""}
                  </span>
                </div>

                <div className="service-history-repair">
                  <span className="service-history-title">{record.title}</span>

                  <span className="service-history-description">
                    {record.description || "Brak opisu"}
                  </span>
                </div>

                <span>{formatDate(record.service_date)}</span>

                <span>{formatMileage(record.mileage)}</span>

                <strong>{formatCost(record.cost)}</strong>

                <div className="service-history-actions">
                  {canEditRecord && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();

                          navigate(`/service-history/${record.id}/edit`);
                        }}
                      >
                        Edytuj
                      </button>

                      <button
                        type="button"
                        className="service-history-delete"
                        onClick={(event) => {
                          event.stopPropagation();

                          handleDelete(record);
                        }}
                      >
                        Usuń
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {serviceRecords.length === 0 && !error && (
            <div className="service-history-empty">
              Brak wpisów w historii napraw.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ServiceHistoryPage;
