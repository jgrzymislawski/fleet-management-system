import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import DriverForm from "./DriverForm";
import apiClient from "../api/client";
import "./AddDriverPage.css";

function EditDriverPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

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

  useEffect(() => {
    const loadDriver = async () => {
      try {
        const response = await apiClient.get(`drivers/${id}/`);

        const driver = response.data;

        setFormData({
          first_name: driver.first_name || "",
          last_name: driver.last_name || "",
          license_number: driver.license_number || "",
          license_categories: driver.license_categories || [],
          license_expiry_date: driver.license_expiry_date || "",
          medical_exam_expiry_date: driver.medical_exam_expiry_date || "",
          phone_number: driver.phone_number || "",
          hired_at: driver.hired_at || "",
        });
      } catch (err) {
        console.error("Błąd pobierania kierowcy:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych kierowcy.");
      } finally {
        setLoading(false);
      }
    };

    loadDriver();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError(null);

    try {
      const payload = {
        ...formData,
        license_expiry_date: formData.license_expiry_date || null,
        medical_exam_expiry_date: formData.medical_exam_expiry_date || null,
      };

      await apiClient.put(`drivers/${id}/`, payload);

      navigate(`/drivers/${id}`);
    } catch (err) {
      console.error("Błąd zapisu kierowcy:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się zapisać zmian.");
    }
  };

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

        {loading ? (
          <p>Ładowanie danych kierowcy...</p>
        ) : (
          <DriverForm
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={() => navigate(`/drivers/${id}`)}
            submitText="Zapisz zmiany"
            error={error}
          />
        )}
      </main>
    </div>
  );
}

export default EditDriverPage;
