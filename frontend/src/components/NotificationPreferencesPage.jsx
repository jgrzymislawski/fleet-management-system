import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import api from "../api/client";
import "./NotificationPreferencesPage.css";

function NotificationPreferencesPage({ onLogout }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    email_enabled: true,
    insurance_enabled: true,
    inspection_enabled: true,
    documents_enabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setError("");

        const response = await api.get("notifications/preferences/");

        setFormData(response.data);
      } catch (err) {
        console.error("Błąd pobierania ustawień powiadomień:", err);

        setError("Nie udało się pobrać ustawień powiadomień.");
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleChange = (event) => {
    const { name, checked } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: checked,
    }));

    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await api.put("notifications/preferences/", {
        email_enabled: formData.email_enabled,
        insurance_enabled: formData.insurance_enabled,
        inspection_enabled: formData.inspection_enabled,
        documents_enabled: formData.documents_enabled,
      });

      setFormData(response.data);

      setSuccess("Ustawienia powiadomień zostały zapisane.");
    } catch (err) {
      console.error("Błąd zapisywania ustawień powiadomień:", err);

      setError("Nie udało się zapisać ustawień powiadomień.");
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
        <div className="notification-page-header">
          <div>
            <button
              type="button"
              className="notification-back"
              onClick={() => navigate("/account")}
            >
              ← Wróć do konta
            </button>

            <h1>Powiadomienia</h1>

            <p>Wybierz, jakie wiadomości e-mail chcesz otrzymywać.</p>
          </div>
        </div>

        {error && (
          <div className="notification-message notification-message-error">
            {error}
          </div>
        )}

        {success && (
          <div className="notification-message notification-message-success">
            {success}
          </div>
        )}

        <form className="notification-card" onSubmit={handleSubmit}>
          <div className="notification-email-section">
            <span className="notification-label">Adres e-mail</span>

            <strong>
              {formData.email || "Brak przypisanego adresu e-mail"}
            </strong>

            {!formData.email && (
              <p className="notification-warning">
                Aby otrzymywać powiadomienia, konto musi mieć przypisany adres
                e-mail.
              </p>
            )}
          </div>

          <div className="notification-option notification-main-option">
            <div>
              <strong>Powiadomienia e-mail</strong>

              <p>
                Włącz lub wyłącz wszystkie wiadomości wysyłane przez Flotivo.
              </p>
            </div>

            <label className="notification-switch">
              <input
                type="checkbox"
                name="email_enabled"
                checked={formData.email_enabled}
                onChange={handleChange}
                disabled={!formData.email}
              />

              <span className="notification-slider" />
            </label>
          </div>

          <div className="notification-divider" />

          <h2>Rodzaje powiadomień</h2>

          <div className="notification-option">
            <div>
              <strong>Polisy OC</strong>

              <p>
                Otrzymuj przypomnienia o zbliżającym się terminie polisy OC.
              </p>
            </div>

            <label className="notification-switch">
              <input
                type="checkbox"
                name="insurance_enabled"
                checked={formData.insurance_enabled}
                onChange={handleChange}
                disabled={!formData.email || !formData.email_enabled}
              />

              <span className="notification-slider" />
            </label>
          </div>

          <div className="notification-option">
            <div>
              <strong>Przeglądy techniczne</strong>

              <p>Otrzymuj przypomnienia o zbliżającym się przeglądzie.</p>
            </div>

            <label className="notification-switch">
              <input
                type="checkbox"
                name="inspection_enabled"
                checked={formData.inspection_enabled}
                onChange={handleChange}
                disabled={!formData.email || !formData.email_enabled}
              />

              <span className="notification-slider" />
            </label>
          </div>

          <div className="notification-option">
            <div>
              <strong>Dokumenty pojazdów</strong>

              <p>Otrzymuj przypomnienia o wygasających dokumentach.</p>
            </div>

            <label className="notification-switch">
              <input
                type="checkbox"
                name="documents_enabled"
                checked={formData.documents_enabled}
                onChange={handleChange}
                disabled={!formData.email || !formData.email_enabled}
              />

              <span className="notification-slider" />
            </label>
          </div>

          <div className="notification-actions">
            <button
              type="submit"
              className="notification-save"
              disabled={saving || !formData.email}
            >
              {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default NotificationPreferencesPage;
