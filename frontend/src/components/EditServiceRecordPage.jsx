import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./AddServiceRecordPage.css";

function EditServiceRecordPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    vehicle: "",
    service_date: "",
    title: "",
    description: "",
    mileage: "",
    cost: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [recordResponse, vehiclesResponse] = await Promise.all([
          apiClient.get(`service-records/${id}/`),
          apiClient.get("vehicles/"),
        ]);

        const record = recordResponse.data;

        setVehicles(vehiclesResponse.data);

        setFormData({
          vehicle: String(record.vehicle),
          service_date: record.service_date || "",
          title: record.title || "",
          description: record.description || "",
          mileage: record.mileage ?? "",
          cost: record.cost ?? "",
        });
      } catch (err) {
        console.error("Błąd pobierania wpisu:", err);
        setError("Nie udało się pobrać wpisu serwisowego.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError(null);

    try {
      const dataToSend = {
        vehicle: Number(formData.vehicle),
        service_date: formData.service_date,
        title: formData.title,
        description: formData.description,
        mileage: formData.mileage ? Number(formData.mileage) : null,
        cost: formData.cost || "0.00",
      };

      await apiClient.put(`service-records/${id}/`, dataToSend);

      navigate("/service-history");
    } catch (err) {
      console.error("Błąd edycji wpisu:", err);
      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się zapisać zmian.");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie wpisu...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="service-record-form-header">
          <button
            className="service-record-back"
            onClick={() => navigate("/service-history")}
          >
            ← Wróć
          </button>

          <h1>Edytuj wpis serwisowy</h1>

          <p>Zmień dane dotyczące naprawy lub serwisu pojazdu.</p>
        </div>

        <form className="service-record-form" onSubmit={handleSubmit}>
          {error && <p className="service-record-error">{error}</p>}

          <div className="service-record-field">
            <label htmlFor="vehicle">Pojazd</label>

            <select
              id="vehicle"
              name="vehicle"
              value={formData.vehicle}
              onChange={handleChange}
              required
            >
              <option value="">Wybierz pojazd</option>

              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model} -{" "}
                  {vehicle.registration_number}
                </option>
              ))}
            </select>
          </div>

          <div className="service-record-grid">
            <div className="service-record-field">
              <label htmlFor="service_date">Data serwisu</label>

              <input
                id="service_date"
                name="service_date"
                type="date"
                value={formData.service_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="service-record-field">
              <label htmlFor="title">Rodzaj naprawy / serwisu</label>

              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="service-record-field">
              <label htmlFor="mileage">Przebieg</label>

              <input
                id="mileage"
                name="mileage"
                type="number"
                min="0"
                value={formData.mileage}
                onChange={handleChange}
              />
            </div>

            <div className="service-record-field">
              <label htmlFor="cost">Koszt</label>

              <input
                id="cost"
                name="cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="service-record-field">
            <label htmlFor="description">Opis</label>

            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="5"
            />
          </div>

          <div className="service-record-actions">
            <button
              type="button"
              className="service-record-cancel"
              onClick={() => navigate("/service-history")}
            >
              Anuluj
            </button>

            <button type="submit" className="service-record-submit">
              Zapisz zmiany
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default EditServiceRecordPage;
