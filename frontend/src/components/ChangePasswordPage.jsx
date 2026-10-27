import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./ChangePasswordPage.css";

function ChangePasswordPage({ onLogout }) {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    });

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !formData.current_password ||
      !formData.new_password ||
      !formData.confirm_password
    ) {
      setError("Wypełnij wszystkie pola.");
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setError("Nowe hasła nie są takie same.");
      return;
    }

    setSaving(true);

    try {
      const response = await apiClient.post("change-password/", formData);

      setSuccess(response.data.detail || "Hasło zostało zmienione.");

      setFormData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      console.error("Błąd zmiany hasła:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      const backendData = err.response?.data;

      if (backendData?.current_password?.[0]) {
        setError(backendData.current_password[0]);
      } else if (backendData?.new_password?.[0]) {
        setError(backendData.new_password[0]);
      } else if (backendData?.confirm_password?.[0]) {
        setError(backendData.confirm_password[0]);
      } else if (backendData?.detail) {
        setError(backendData.detail);
      } else {
        setError("Nie udało się zmienić hasła.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="change-password-header">
          <button
            className="change-password-back"
            onClick={() => navigate("/account")}
          >
            ← Wróć do konta
          </button>

          <h1>Zmiana hasła</h1>

          <p>Ustaw nowe hasło do swojego konta Flotivo.</p>
        </div>

        <div className="change-password-card">
          <form className="change-password-form" onSubmit={handleSubmit}>
            <div className="change-password-field">
              <label htmlFor="current_password">Aktualne hasło</label>

              <input
                id="current_password"
                name="current_password"
                type="password"
                value={formData.current_password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="change-password-field">
              <label htmlFor="new_password">Nowe hasło</label>

              <input
                id="new_password"
                name="new_password"
                type="password"
                value={formData.new_password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="change-password-field">
              <label htmlFor="confirm_password">Powtórz nowe hasło</label>

              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                value={formData.confirm_password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="change-password-error">{error}</p>}

            {success && <p className="change-password-success">{success}</p>}

            <div className="change-password-actions">
              <button
                type="button"
                className="change-password-cancel"
                onClick={() => navigate("/account")}
              >
                Anuluj
              </button>

              <button
                type="submit"
                className="change-password-submit"
                disabled={saving}
              >
                {saving ? "Zapisywanie..." : "Zmień hasło"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default ChangePasswordPage;
