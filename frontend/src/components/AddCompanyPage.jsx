import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./CompanyFormPage.css";

function AddCompanyPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    tax_id: "",
    is_active: true,
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canManageCompanies = user?.role === "admin";

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
  };

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) return "Nie udało się dodać spółki.";
    if (typeof data === "string") return data;
    if (data.name?.[0]) return data.name[0];
    if (data.tax_id?.[0]) return data.tax_id[0];
    if (data.detail) return data.detail;

    return "Nie udało się dodać spółki.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    setError("");

    const name = formData.name.trim();
    const taxId = formData.tax_id.trim();

    if (!name) {
      setError("Podaj nazwę spółki.");
      return;
    }

    try {
      setSaving(true);

      await apiClient.post("admin/companies/", {
        name,
        tax_id: taxId,
        is_active: formData.is_active,
      });

      navigate("/admin-panel/companies");
    } catch (err) {
      console.error("Błąd dodawania spółki:", err);
      setError(getBackendError(err));
    } finally {
      setSaving(false);
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

  if (!canManageCompanies) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p className="company-form-error">
            Nie masz uprawnień do dodawania spółek.
          </p>
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
            type="button"
            className="company-form-back"
            onClick={() => navigate("/admin-panel/companies")}
          >
            ← Wróć do spółek
          </button>

          <h1>Dodaj spółkę</h1>
          <p>Dodaj nową spółkę do swojej organizacji.</p>
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
                maxLength={255}
                disabled={saving}
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
                maxLength={30}
                disabled={saving}
              />
            </div>

            <label className="company-form-checkbox">
              <input
                name="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={handleChange}
                disabled={saving}
              />

              <span>Spółka aktywna</span>
            </label>

            {error && (
              <p className="company-form-error" role="alert">
                {error}
              </p>
            )}

            <div className="company-form-actions">
              <button
                type="button"
                className="company-form-cancel"
                onClick={() => navigate("/admin-panel/companies")}
                disabled={saving}
              >
                Anuluj
              </button>

              <button
                type="submit"
                className="company-form-submit"
                disabled={saving}
              >
                {saving ? "Zapisywanie..." : "Dodaj spółkę"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default AddCompanyPage;
