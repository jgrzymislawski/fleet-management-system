import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import DriverForm from "./DriverForm";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AddDriverPage.css";

function EditDriverPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loadingUser } = useAuth();

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

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canManageDrivers = user?.role === "admin";

  useEffect(() => {
    if (loadingUser || !canManageDrivers) {
      return;
    }

    let active = true;

    const loadDriver = async () => {
      try {
        setLoading(true);

        const response = await apiClient.get(`drivers/${id}/`);

        if (!active) {
          return;
        }

        const driver = response.data;

        setFormData({
          first_name: driver.first_name || "",
          last_name: driver.last_name || "",
          license_number: driver.license_number || "",
          license_categories: Array.isArray(driver.license_categories)
            ? driver.license_categories
            : [],
          license_expiry_date: driver.license_expiry_date || "",
          medical_exam_expiry_date: driver.medical_exam_expiry_date || "",
          phone_number: driver.phone_number || "",
          hired_at: driver.hired_at || "",
        });

        setError(null);
      } catch (err) {
        if (!active) {
          return;
        }

        console.error("Błąd pobierania kierowcy:", err);

        if (err.response?.status === 404) {
          setError("Nie znaleziono kierowcy.");
        } else if (err.response?.status === 403) {
          setError("Nie masz uprawnień do edycji tego kierowcy.");
        } else {
          setError("Nie udało się pobrać danych kierowcy.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDriver();

    return () => {
      active = false;
    };
  }, [id, loadingUser, canManageDrivers]);

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
      return "Nie udało się zapisać zmian.";
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

    return "Nie udało się zapisać zmian.";
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

      await apiClient.put(`drivers/${id}/`, payload);

      navigate(`/drivers/${id}`);
    } catch (err) {
      console.error("Błąd zapisu kierowcy:", err);
      setError(getBackendError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser || loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie danych kierowcy...</p>
        </main>
      </div>
    );
  }

  if (!canManageDrivers) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Nie masz uprawnień do edycji kierowców.</p>
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
            <h1>Edytuj kierowcę</h1>
            <p>Zmień dane wybranego kierowcy.</p>
          </div>
        </div>

        <DriverForm
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/drivers/${id}`)}
          submitText="Zapisz zmiany"
          error={error}
          submitting={submitting}
        />
      </main>
    </div>
  );
}

export default EditDriverPage;
