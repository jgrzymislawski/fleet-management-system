import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./AddServiceRecordPage.css";

function EditServiceRecordPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEditCompany } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    vehicle: "",
    service_date: "",
    title: "",
    description: "",
    mileage: "",
    cost: "",
  });

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);

        const [recordResponse, vehiclesData] = await Promise.all([
          apiClient.get(`service-records/${id}/`),
          fetchAllPages(apiClient, "vehicles/"),
        ]);

        if (!active) return;

        const record = recordResponse.data;
        const allVehicles = Array.isArray(vehiclesData) ? vehiclesData : [];

        const recordVehicle = allVehicles.find(
          (vehicle) => Number(vehicle.id) === Number(record.vehicle),
        );

        if (!recordVehicle || !canEditCompany(recordVehicle.company)) {
          setError("Nie masz uprawnień do edycji tego wpisu.");
          return;
        }

        setVehicles(
          allVehicles.filter((vehicle) => canEditCompany(vehicle.company)),
        );

        setFormData({
          vehicle: String(record.vehicle),
          service_date: record.service_date || "",
          title: record.title || "",
          description: record.description || "",
          mileage: record.mileage ?? "",
          cost: record.cost ?? "",
        });

        setError(null);
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania wpisu:", err);

        if (err.response?.status === 404) {
          setError("Nie znaleziono wpisu serwisowego.");
        } else if (err.response?.status === 403) {
          setError("Nie masz uprawnień do edycji tego wpisu.");
        } else {
          setError("Nie udało się pobrać wpisu serwisowego.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [id, canEditCompany]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) return "Nie udało się zapisać zmian.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;

    const firstError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    return firstError?.[0] || "Nie udało się zapisać zmian.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError(null);

    try {
      setSubmitting(true);

      await apiClient.put(`service-records/${id}/`, {
        vehicle: Number(formData.vehicle),
        service_date: formData.service_date,
        title: formData.title.trim(),
        description: formData.description.trim(),
        mileage: formData.mileage ? Number(formData.mileage) : null,
        cost: formData.cost || "0.00",
      });

      navigate(`/vehicles/${formData.vehicle}`);
    } catch (err) {
      console.error("Błąd edycji wpisu:", err);
      setError(getBackendError(err));
    } finally {
      setSubmitting(false);
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
            type="button"
            className="service-record-back"
            onClick={() =>
              formData.vehicle
                ? navigate(`/vehicles/${formData.vehicle}`)
                : navigate("/service-history")
            }
          >
            ← Wróć
          </button>

          <h1>Edytuj wpis serwisowy</h1>
          <p>Zmień dane dotyczące naprawy lub serwisu pojazdu.</p>
        </div>

        <form className="service-record-form" onSubmit={handleSubmit}>
          {error && (
            <p className="service-record-error" role="alert">
              {error}
            </p>
          )}

          <div className="service-record-field">
            <label htmlFor="vehicle">Pojazd *</label>

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
                  {[vehicle.brand, vehicle.model].filter(Boolean).join(" ")} -{" "}
                  {vehicle.registration_number || "Brak rejestracji"}
                </option>
              ))}
            </select>
          </div>

          <div className="service-record-grid">
            <div className="service-record-field">
              <label htmlFor="service_date">Data serwisu *</label>
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
              <label htmlFor="title">Rodzaj naprawy / serwisu *</label>
              <input
                id="title"
                name="title"
                type="text"
                maxLength={255}
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
                step="1"
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
              onClick={() =>
                formData.vehicle
                  ? navigate(`/vehicles/${formData.vehicle}`)
                  : navigate("/service-history")
              }
              disabled={submitting}
            >
              Anuluj
            </button>

            <button
              type="submit"
              className="service-record-submit"
              disabled={submitting}
            >
              {submitting ? "Zapisywanie..." : "Zapisz zmiany"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default EditServiceRecordPage;
