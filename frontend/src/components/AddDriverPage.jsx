import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import DriverForm from "./DriverForm";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AddDriverPage.css";

function AddDriverPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    license_number: "",
    license_categories: [],
    license_expiry_date: "",
    medical_exam_expiry_date: "",
    phone_number: "",
    hired_at: "",
  });

  const canManageDrivers = user?.role === "admin";

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) {
      return "Nie udało się dodać kierowcy.";
    }

    if (typeof data === "string") {
      return data;
    }

    if (data.detail) {
      return data.detail;
    }

    const firstFieldError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    if (firstFieldError) {
      return firstFieldError[0];
    }

    return "Nie udało się dodać kierowcy.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError(null);

    const payload = {
      ...formData,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      license_number: formData.license_number.trim(),
      phone_number: formData.phone_number.trim(),
      license_expiry_date: formData.license_expiry_date || null,
      medical_exam_expiry_date: formData.medical_exam_expiry_date || null,
    };

    try {
      setSubmitting(true);

      await apiClient.post("drivers/", payload);

      navigate("/drivers");
    } catch (err) {
      console.error("Błąd dodawania kierowcy:", err);
      setError(getBackendError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie...</p>
        </main>
      </div>
    );
  }

  if (!canManageDrivers) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Nie masz uprawnień do dodawania kierowców.</p>
        </main>
      </div>
    );
  }

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
          submitting={submitting}
        />
      </main>
    </div>
  );
}

export default AddDriverPage;
