import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./CompanyFormPage.css";

function EditCompanyPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loadingUser } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    tax_id: "",
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManageCompanies = user?.role === "admin";

  useEffect(() => {
    if (loadingUser || !canManageCompanies) {
      if (!loadingUser) {
        setLoading(false);
      }

      return;
    }

    let active = true;

    const loadCompany = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get(`admin/companies/${id}/`);

        if (!active) return;

        setFormData({
          name: response.data?.name || "",
          tax_id: response.data?.tax_id || "",
          is_active: Boolean(response.data?.is_active),
        });
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania spółki:", err);

        if (err.response?.status === 404) {
          setError("Nie znaleziono spółki.");
        } else if (err.response?.status === 403) {
          setError("Nie masz uprawnień do edycji tej spółki.");
        } else {
          setError("Nie udało się pobrać danych spółki.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCompany();

    return () => {
      active = false;
    };
  }, [id, loadingUser, canManageCompanies]);

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

    if (!data) return "Nie udało się zapisać zmian.";
    if (typeof data === "string") return data;
    if (data.name?.[0]) return data.name[0];
    if (data.tax_id?.[0]) return data.tax_id[0];
    if (data.detail) return data.detail;

    return "Nie udało się zapisać zmian.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    setError("");

    const name = formData.name.trim();

    if (!name) {
      setError("Podaj nazwę spółki.");
      return;
    }

    try {
      setSaving(true);

      await apiClient.put(`admin/companies/${id}/`, {
        name,
        tax_id: formData.tax_id.trim(),
        is_active: formData.is_active,
      });

      navigate("/admin-panel/companies");
    } catch (err) {
      console.error("Błąd zapisu spółki:", err);
      setError(getBackendError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser || loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie danych spółki...</p>
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
            Nie masz uprawnień do edycji spółek.
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
