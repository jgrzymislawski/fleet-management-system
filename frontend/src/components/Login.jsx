import { useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";

import cars from "../assets/cars.jpg";

import "./Login.css";

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const { loadUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post("token/", {
        username,
        password,
      });

      localStorage.setItem("access_token", response.data.access);

      localStorage.setItem("refresh_token", response.data.refresh);

      await loadUser();

      onLoginSuccess();
    } catch (err) {
      console.error("Błąd logowania:", err.response?.status);

      setError("Nieprawidłowy login lub hasło.");
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
      <div className="login-overlay"></div>

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
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Wprowadź login"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Hasło</label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wprowadź hasło"
              autoComplete="current-password"
              required
              disabled={loading}
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
