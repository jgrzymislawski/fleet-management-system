import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import DriverForm from "./DriverForm";
import apiClient from "../api/client";
import "./AddDriverPage.css";

function AddDriverPage({ onLogout }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    license_number: "",
    phone_number: "",
    hired_at: "",
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

    apiClient
      .post("drivers/", formData)
      .then(() => {
        navigate("/drivers");
      })
      .catch((err) => {
        console.error("Błąd dodawania kierowcy:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się dodać kierowcy.");
      });
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="add-driver-header">
          <div>
            <h1>Dodaj kierowcę</h1>
            <p>Wprowadź dane nowego kierowcy.</p>
          </div>
        </div>

        <DriverForm
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/drivers")}
          submitText="Dodaj kierowcę"
          error={error}
        />
      </main>
    </div>
  );
}

export default AddDriverPage;
