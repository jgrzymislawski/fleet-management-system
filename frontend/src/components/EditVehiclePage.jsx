import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import VehicleForm from "./VehicleForm";
import apiClient from "../api/client";
import "./AddVehiclePage.css";

function EditVehiclePage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [drivers, setDrivers] = useState([]);

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    registration_number: "",
    vin: "",
    year: "",
    vehicle_type: "passenger",
    fuel_type: "",
    mileage: "",
    status: "active",
    inspection_expiry_date: "",
    insurance_expiry_date: "",
    driver: "",
    driver_name: "",
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("drivers/")
      .then((response) => {
        setDrivers(response.data);
      })
      .catch((err) => {
        console.error("Błąd pobierania kierowców:", err);
      });

    apiClient
      .get(`vehicles/${id}/`)
      .then((response) => {
        const vehicle = response.data;

        setFormData({
          brand: vehicle.brand,
          model: vehicle.model,
          registration_number: vehicle.registration_number,
          vin: vehicle.vin || "",
          year: vehicle.year,
          vehicle_type: vehicle.vehicle_type,
          fuel_type: vehicle.fuel_type || "",
          mileage: vehicle.mileage,
          status: vehicle.status,
          inspection_expiry_date: vehicle.inspection_expiry_date || "",
          insurance_expiry_date: vehicle.insurance_expiry_date || "",
          driver: vehicle.driver || "",
          driver_name: vehicle.driver_name || "",
        });

        setLoading(false);
      })
      .catch((err) => {
        console.error("Błąd pobierania pojazdu:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych pojazdu.");
        setLoading(false);
      });
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setError(null);

    const dataToSend = {
      ...formData,
      vin: formData.vin || null,
      fuel_type: formData.fuel_type || null,
      inspection_expiry_date: formData.inspection_expiry_date || null,
      insurance_expiry_date: formData.insurance_expiry_date || null,
      driver: formData.driver || null,
      driver_name: formData.driver_name || null,
    };

    apiClient
      .put(`vehicles/${id}/`, dataToSend)
      .then(() => {
        navigate(`/vehicles/${id}`);
      })
      .catch((err) => {
        console.error("Błąd zapisu:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się zapisać zmian.");
      });
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="add-vehicle-header">
          <div>
            <h1>Edytuj pojazd</h1>
            <p>Zmień dane wybranego pojazdu.</p>
          </div>
        </div>

        {loading ? (
          <p>Ładowanie danych pojazdu...</p>
        ) : (
          <VehicleForm
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={() => navigate(`/vehicles/${id}`)}
            submitText="Zapisz zmiany"
            error={error}
            drivers={drivers}
          />
        )}
      </main>
    </div>
  );
}

export default EditVehiclePage;
