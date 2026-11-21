import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AdminNotificationSettingsPage.css";

function AdminNotificationSettingsPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();

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

  const canManageNotifications = user?.role === "admin";

  useEffect(() => {
    if (loadingUser || !canManageNotifications) {
      if (!loadingUser) {
        setLoading(false);
      }

      return;
    }

    let active = true;

    const loadSettings = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get("notifications/admin/settings/");

        if (!active) return;

        setFormData({
          insurance_enabled: Boolean(response.data?.insurance_enabled),
          inspection_enabled: Boolean(response.data?.inspection_enabled),
          documents_enabled: Boolean(response.data?.documents_enabled),
          notify_30_days: Boolean(response.data?.notify_30_days),
          notify_14_days: Boolean(response.data?.notify_14_days),
          notify_7_days: Boolean(response.data?.notify_7_days),
          notify_1_day: Boolean(response.data?.notify_1_day),
        });
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania ustawień powiadomień organizacji:", err);

        if (err.response?.status === 403) {
          setError(
            "Nie masz uprawnień do zarządzania powiadomieniami organizacji.",
          );
        } else {
          setError("Nie udało się pobrać ustawień powiadomień organizacji.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      active = false;
    };
  }, [loadingUser, canManageNotifications]);

  const handleChange = (event) => {
    const { name, checked } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: checked,
    }));

    setSuccess("");
    setError("");
  };

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) {
      return "Nie udało się zapisać ustawień powiadomień organizacji.";
    }

    if (typeof data === "string") {
      return data;
    }

    if (data.detail) {
      return data.detail;
    }

    if (data.non_field_errors?.[0]) {
      return data.non_field_errors[0];
    }

    const firstError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    return (
      firstError?.[0] ||
      "Nie udało się zapisać ustawień powiadomień organizacji."
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    const anyNotificationTypeEnabled =
      formData.insurance_enabled ||
      formData.inspection_enabled ||
      formData.documents_enabled;

    const anyNotificationDayEnabled =
      formData.notify_30_days ||
      formData.notify_14_days ||
      formData.notify_7_days ||
      formData.notify_1_day;

    if (anyNotificationTypeEnabled && !anyNotificationDayEnabled) {
      setSuccess("");
      setError("Wybierz przynajmniej jeden termin przypomnienia.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await apiClient.put(
        "notifications/admin/settings/",
        formData,
      );

      setFormData({
        insurance_enabled: Boolean(response.data?.insurance_enabled),
        inspection_enabled: Boolean(response.data?.inspection_enabled),
        documents_enabled: Boolean(response.data?.documents_enabled),
        notify_30_days: Boolean(response.data?.notify_30_days),
        notify_14_days: Boolean(response.data?.notify_14_days),
        notify_7_days: Boolean(response.data?.notify_7_days),
        notify_1_day: Boolean(response.data?.notify_1_day),
      });

      setSuccess("Ustawienia powiadomień organizacji zostały zapisane.");
    } catch (err) {
      console.error("Błąd zapisywania ustawień powiadomień organizacji:", err);

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
          <p>Ładowanie ustawień...</p>
        </main>
      </div>
    );
  }

  if (!canManageNotifications) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <div className="admin-notification-message admin-notification-error">
            Nie masz uprawnień do zarządzania powiadomieniami organizacji.
          </div>
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
          <div
            className="admin-notification-message admin-notification-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="admin-notification-message admin-notification-success"
            role="status"
          >
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
              />

              <span>30 dni przed</span>
            </label>

            <label className="admin-notification-day">
              <input
                type="checkbox"
                name="notify_14_days"
                checked={formData.notify_14_days}
                onChange={handleChange}
                disabled={saving}
              />

              <span>14 dni przed</span>
            </label>

            <label className="admin-notification-day">
              <input
                type="checkbox"
                name="notify_7_days"
                checked={formData.notify_7_days}
                onChange={handleChange}
                disabled={saving}
              />

              <span>7 dni przed</span>
            </label>

            <label className="admin-notification-day">
              <input
                type="checkbox"
                name="notify_1_day"
                checked={formData.notify_1_day}
                onChange={handleChange}
                disabled={saving}
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
