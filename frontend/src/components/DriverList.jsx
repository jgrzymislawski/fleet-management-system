import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import "./DriverList.css";

function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    apiClient
      .get("drivers/")
      .then((response) => {
        setDrivers(response.data);
      })
      .catch((err) => {
        console.error(err);
        setError("Nie udało się pobrać listy kierowców");
      });
  }, []);

  const handleMenuClick = (driverId) => {
    if (openMenuId === driverId) {
      setOpenMenuId(null);
    } else {
      setOpenMenuId(driverId);
    }
  };

  const handleDelete = (driver) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć kierowcę ${driver.first_name} ${driver.last_name}?`,
    );

    if (!confirmed) {
      return;
    }

    apiClient
      .delete(`drivers/${driver.id}/`)
      .then(() => {
        setDrivers((currentDrivers) =>
          currentDrivers.filter(
            (currentDriver) => currentDriver.id !== driver.id,
          ),
        );

        setOpenMenuId(null);
      })
      .catch((err) => {
        console.error("Błąd usuwania kierowcy:", err);
        console.error("Odpowiedź backendu:", err.response?.data);
        setError("Nie udało się usunąć kierowcy.");
      });
  };

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  return (
    <div className="drivers">
      <div className="drivers-header">
        <div>
          <h1>Kierowcy</h1>
          <p>Zarządzaj kierowcami znajdującymi się w Twojej flocie.</p>
        </div>

        <button
          className="add-driver-button"
          onClick={() => navigate("/drivers/add")}
        >
          + Dodaj kierowcę
        </button>
      </div>

      {error && <p className="drivers-error">{error}</p>}

      <div className="drivers-results-info">
        Liczba kierowców: {drivers.length}
      </div>

      <div className="drivers-table">
        <div className="drivers-table-header">
          <span>Kierowca</span>
          <span>Numer prawa jazdy</span>
          <span>Telefon</span>
          <span>Data zatrudnienia</span>
          <span>Akcje</span>
        </div>

        {drivers.map((driver) => (
          <div className="drivers-table-row" key={driver.id}>
            <span className="driver-name">
              {driver.first_name} {driver.last_name}
            </span>

            <span>{driver.license_number}</span>

            <span>{driver.phone_number}</span>

            <span>{formatDate(driver.hired_at)}</span>

            <div className="driver-actions">
              <button
                className="driver-actions-button"
                onClick={() => handleMenuClick(driver.id)}
              >
                •••
              </button>

              {openMenuId === driver.id && (
                <div className="driver-actions-menu">
                  <button onClick={() => navigate(`/drivers/${driver.id}`)}>
                    Szczegóły
                  </button>

                  <button
                    onClick={() => navigate(`/drivers/${driver.id}/edit`)}
                  >
                    Edytuj
                  </button>

                  <div className="driver-actions-divider"></div>

                  <button
                    className="driver-actions-delete"
                    onClick={() => handleDelete(driver)}
                  >
                    Usuń
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {drivers.length === 0 && !error && (
          <div className="drivers-empty">Brak kierowców.</div>
        )}
      </div>
    </div>
  );
}

export default DriverList;
