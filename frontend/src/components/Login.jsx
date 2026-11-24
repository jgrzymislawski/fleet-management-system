import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient, {
  getCsrfToken,
  logoutSession,
  setAuthenticatedSession,
} from "../api/client";
import cars from "../assets/cars.webp";
import "./Login.css";

function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getLoginError = (err) => {
    if (!err.response) {
      return "Nie udało się potwierdzić logowania. Sprawdź połączenie z serwerem.";
    }

    if (err.response.status === 429) {
      return "Zbyt wiele prób logowania. Spróbuj ponownie później.";
    }

    if (err.response.status === 403) {
      return "Nie udało się zweryfikować żądania. Odśwież stronę i spróbuj ponownie.";
    }

    if (err.response.status === 400 || err.response.status === 401) {
      return "Nieprawidłowy login lub hasło.";
    }

    if (err.response.status >= 500) {
      return "Wystąpił błąd serwera. Spróbuj ponownie później.";
    }

    return "Nie udało się zalogować. Spróbuj ponownie.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError("Wprowadź login i hasło.");
      return;
    }

    let sessionStarted = false;

    try {
      setLoading(true);
      setError("");

      const csrfToken = await getCsrfToken();
      const response = await apiClient.post(
        "auth/token/",
        { username: normalizedUsername, password },
        { headers: { "X-CSRFToken": csrfToken } },
      );

      const token = response.data?.access;
      if (!token) throw new Error("Serwer nie zwrócił access tokenu.");

      setAuthenticatedSession(token);
      sessionStarted = true;

      // App pobiera /auth/me i dopiero po sukcesie otwiera panel.
      await onLoginSuccess();
    } catch (err) {
      if (sessionStarted) {
        await logoutSession().catch(() => {});
      }
      setError(getLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundImage: `url(${cars})` }}>
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
              onChange={(event) => {
                setUsername(event.target.value);
                setError("");
              }}
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
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
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
