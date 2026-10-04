import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import VehicleForm from "./VehicleForm";
import apiClient from "../api/client";
import "./AddVehiclePage.css";

function AddVehiclePage({ onLogout }) {
  const navigate = useNavigate();

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
  });

  const [error, setError] = useState(null);

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
    };

    apiClient
      .post("vehicles/", dataToSend)
      .then(() => {
        navigate("/vehicles");
      })
      .catch((err) => {
        console.error("Błąd dodawania pojazdu:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się dodać pojazdu.");
      });
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="add-vehicle-header">
          <div>
            <h1>Dodaj pojazd</h1>
            <p>Wprowadź dane nowego pojazdu.</p>
          </div>
        </div>

        <VehicleForm
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/vehicles")}
          submitText="Dodaj pojazd"
          error={error}
        />
      </main>
    </div>
  );
}

export default AddVehiclePage;
