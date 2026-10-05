import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./DriverDetailsPage.css";

function DriverDetailsPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get(`drivers/${id}/`)
      .then((response) => {
        setDriver(response.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Błąd pobierania kierowcy:", err);
        console.error("Odpowiedź backendu:", err.response?.data);
        setError("Nie udało się pobrać danych kierowcy.");
        setLoading(false);
      });
  }, [id]);

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie danych kierowcy...</p>
        </main>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p className="driver-details-error">
            {error || "Nie znaleziono kierowcy."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="driver-details-header">
          <div>
            <button
              className="driver-details-back"
              onClick={() => navigate("/drivers")}
            >
              ← Wróć do kierowców
            </button>

            <h1>
              {driver.first_name} {driver.last_name}
            </h1>

            <p className="driver-details-subtitle">Kierowca</p>
          </div>

          <button
            className="driver-details-edit"
            onClick={() => navigate(`/drivers/${driver.id}/edit`)}
          >
            Edytuj kierowcę
          </button>
        </div>

        <div className="driver-details-card">
          <h2>Dane kierowcy</h2>

          <div className="driver-details-grid">
            <div className="driver-detail">
              <span className="driver-detail-label">Imię</span>

              <span className="driver-detail-value">{driver.first_name}</span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Nazwisko</span>

              <span className="driver-detail-value">{driver.last_name}</span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Numer prawa jazdy</span>

              <span className="driver-detail-value">
                {driver.license_number}
              </span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Numer telefonu</span>

              <span className="driver-detail-value">{driver.phone_number}</span>
            </div>

            <div className="driver-detail">
              <span className="driver-detail-label">Data zatrudnienia</span>

              <span className="driver-detail-value">
                {formatDate(driver.hired_at)}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DriverDetailsPage;
