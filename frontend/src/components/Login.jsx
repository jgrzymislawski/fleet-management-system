import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import cars from "../assets/cars.jpg";
import "./Login.css";

function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const { loadUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);

    if (error) {
      setError("");
    }
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);

    if (error) {
      setError("");
    }
  };

  const getLoginError = (err) => {
    if (!err.response) {
      return "Nie udało się połączyć z serwerem. Spróbuj ponownie.";
    }

    if (err.response.status === 401 || err.response.status === 400) {
      return "Nieprawidłowy login lub hasło.";
    }

    if (err.response.status >= 500) {
      return "Wystąpił błąd serwera. Spróbuj ponownie później.";
    }

    return "Nie udało się zalogować. Spróbuj ponownie.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password) {
      setError("Wprowadź login i hasło.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      const response = await apiClient.post("token/", {
        username: normalizedUsername,
        password,
      });

      if (!response.data?.access || !response.data?.refresh) {
        throw new Error("Brak tokenów uwierzytelniających.");
      }

      localStorage.setItem("access_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);

      await loadUser();
      onLoginSuccess();
    } catch (err) {
      console.error("Błąd logowania:", err);

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      setError(getLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{
        backgroundImage: `url(${cars})`,
      }}
    >
      <div className="login-overlay" />

      <main className="login-card">
        <div className="login-brand">
          <span className="login-brand-name">Flotivo</span>
          <span className="login-brand-description">
            System zarządzania flotą
          </span>
        </div>

        <div className="login-heading">
          <h1>Zaloguj się</h1>
          <p>Wprowadź dane dostępowe do swojego konta.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">Login</label>

            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Wprowadź login"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              disabled={loading}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Hasło</label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Wprowadź hasło"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="login-button" type="submit" disabled={loading}>
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>
        </form>

        <button
          className="login-back"
          type="button"
          onClick={() => navigate("/")}
          disabled={loading}
        >
          ← Wróć na stronę główną
        </button>
      </main>
    </div>
  );
}

export default Login;
