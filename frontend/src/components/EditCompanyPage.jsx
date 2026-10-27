import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./CompanyFormPage.css";

function EditCompanyPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    name: "",
    tax_id: "",
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get(`admin/companies/${id}/`);

        setFormData({
          name: response.data.name || "",
          tax_id: response.data.tax_id || "",
          is_active: response.data.is_active,
        });
      } catch (err) {
        console.error("Błąd pobierania spółki:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych spółki.");
      } finally {
        setLoading(false);
      }
    };

    loadCompany();
  }, [id]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!formData.name.trim()) {
      setError("Podaj nazwę spółki.");
      return;
    }

    setSaving(true);

    try {
      await apiClient.put(`admin/companies/${id}/`, formData);

      navigate("/admin-panel/companies");
    } catch (err) {
      console.error("Błąd zapisu spółki:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      const backendData = err.response?.data;

      if (backendData?.name?.[0]) {
        setError(backendData.name[0]);
      } else if (backendData?.tax_id?.[0]) {
        setError(backendData.tax_id[0]);
      } else if (backendData?.detail) {
        setError(backendData.detail);
      } else {
        setError("Nie udało się zapisać zmian.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie danych spółki...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="company-form-header">
          <button
            className="company-form-back"
            onClick={() => navigate("/admin-panel/companies")}
          >
            ← Wróć do spółek
          </button>

          <h1>Edytuj spółkę</h1>

          <p>Zmień dane wybranej spółki.</p>
        </div>

        <div className="company-form-card">
          <form onSubmit={handleSubmit}>
            <div className="company-form-field">
              <label htmlFor="name">Nazwa spółki *</label>

              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="company-form-field">
              <label htmlFor="tax_id">NIP</label>

              <input
                id="tax_id"
                name="tax_id"
                type="text"
                value={formData.tax_id}
                onChange={handleChange}
                maxLength="30"
              />
            </div>

            <label className="company-form-checkbox">
              <input
                name="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={handleChange}
              />

              <span>Spółka aktywna</span>
            </label>

            {error && <p className="company-form-error">{error}</p>}

            <div className="company-form-actions">
              <button
                type="button"
                className="company-form-cancel"
                onClick={() => navigate("/admin-panel/companies")}
              >
                Anuluj
              </button>

              <button
                type="submit"
                className="company-form-submit"
                disabled={saving}
              >
                {saving ? "Zapisywanie..." : "Zapisz zmiany"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default EditCompanyPage;
