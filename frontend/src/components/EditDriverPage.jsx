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
    phone_number: "",
    hired_at: "",
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(`drivers/${id}/`)
      .then((response) => {
        const driver = response.data;

        setFormData({
          first_name: driver.first_name,
          last_name: driver.last_name,
          license_number: driver.license_number,
          phone_number: driver.phone_number,
          hired_at: driver.hired_at,
        });

        setLoading(false);
      })
      .catch((err) => {
        console.error("Błąd pobierania kierowcy:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych kierowcy.");
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

    apiClient
      .put(`drivers/${id}/`, formData)
      .then(() => {
        navigate(`/drivers/${id}`);
      })
      .catch((err) => {
        console.error("Błąd zapisu kierowcy:", err);
        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się zapisać zmian.");
      });
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
