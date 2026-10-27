import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import api from "../api/client";
import "./AdminNotificationSettingsPage.css";

function AdminNotificationSettingsPage({ onLogout }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    insurance_enabled: true,
    inspection_enabled: true,
    documents_enabled: true,
    notify_30_days: true,
    notify_14_days: true,
    notify_7_days: true,
    notify_1_day: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setError("");

        const response = await api.get("notifications/admin/settings/");

        setFormData(response.data);
      } catch (err) {
        console.error("Błąd pobierania ustawień powiadomień organizacji:", err);

        setError("Nie udało się pobrać ustawień powiadomień organizacji.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (event) => {
    const { name, checked } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: checked,
    }));

    setSuccess("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.put("notifications/admin/settings/", formData);

      setFormData(response.data);

      setSuccess("Ustawienia powiadomień organizacji zostały zapisane.");
    } catch (err) {
      console.error("Błąd zapisywania ustawień powiadomień organizacji:", err);

      const backendError = err.response?.data?.non_field_errors?.[0];

      setError(
        backendError ||
          "Nie udało się zapisać ustawień powiadomień organizacji.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie ustawień...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="admin-notification-header">
          <div>
            <button
              type="button"
              className="admin-notification-back"
              onClick={() => navigate("/admin-panel")}
            >
              ← Wróć do administracji
            </button>

            <h1>Powiadomienia organizacji</h1>

            <p>
              Ustaw, jakie przypomnienia mają być wysyłane użytkownikom oraz ile
              dni wcześniej.
            </p>
          </div>
        </div>

        {error && (
          <div className="admin-notification-message admin-notification-error">
            {error}
          </div>
        )}

        {success && (
          <div className="admin-notification-message admin-notification-success">
            {success}
          </div>
        )}

        <form className="admin-notification-card" onSubmit={handleSubmit}>
          <h2>Rodzaje powiadomień</h2>

          <div className="admin-notification-option">
            <div>
              <strong>Polisy OC</strong>

              <p>
                Wysyłaj użytkownikom przypomnienia o zbliżającym się terminie
                polisy OC.
              </p>
            </div>

            <label className="admin-notification-switch">
              <input
                type="checkbox"
                name="insurance_enabled"
                checked={formData.insurance_enabled}
                onChange={handleChange}
              />

              <span className="admin-notification-slider" />
            </label>
          </div>

          <div className="admin-notification-option">
            <div>
              <strong>Przeglądy techniczne</strong>

              <p>
                Wysyłaj przypomnienia o zbliżających się przeglądach
                technicznych pojazdów.
              </p>
            </div>

            <label className="admin-notification-switch">
              <input
                type="checkbox"
                name="inspection_enabled"
                checked={formData.inspection_enabled}
                onChange={handleChange}
              />

              <span className="admin-notification-slider" />
            </label>
          </div>

          <div className="admin-notification-option">
            <div>
              <strong>Dokumenty pojazdów</strong>

              <p>Wysyłaj przypomnienia o wygasających dokumentach pojazdów.</p>
            </div>

            <label className="admin-notification-switch">
              <input
                type="checkbox"
                name="documents_enabled"
                checked={formData.documents_enabled}
                onChange={handleChange}
              />

              <span className="admin-notification-slider" />
            </label>
          </div>

          <div className="admin-notification-divider" />

          <h2>Terminy przypomnień</h2>

          <p className="admin-notification-description">
            Wybierz, ile dni przed terminem system ma wysłać wiadomość.
          </p>

          <div className="admin-notification-days">
            <label className="admin-notification-day">
              <input
                type="checkbox"
                name="notify_30_days"
                checked={formData.notify_30_days}
                onChange={handleChange}
              />

              <span>30 dni przed</span>
            </label>

            <label className="admin-notification-day">
              <input
                type="checkbox"
                name="notify_14_days"
                checked={formData.notify_14_days}
                onChange={handleChange}
              />

              <span>14 dni przed</span>
            </label>

            <label className="admin-notification-day">
              <input
                type="checkbox"
                name="notify_7_days"
                checked={formData.notify_7_days}
                onChange={handleChange}
              />

              <span>7 dni przed</span>
            </label>

            <label className="admin-notification-day">
              <input
                type="checkbox"
                name="notify_1_day"
                checked={formData.notify_1_day}
                onChange={handleChange}
              />

              <span>1 dzień przed</span>
            </label>
          </div>

          <div className="admin-notification-actions">
            <button
              type="submit"
              className="admin-notification-save"
              disabled={saving}
            >
              {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default AdminNotificationSettingsPage;
