import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import logo from '../assets/logofull.png';
import cars from '../assets/cars.jpg';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post('token/', {
        username,
        password,
      });

      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);

      onLoginSuccess();
    } catch (err) {
      console.error(err);
      setError('Nieprawidłowy login lub hasło');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page"
      style={{ backgroundImage: `url(${cars})` }}
    >
      <div className="login-overlay"></div>

      <div className="login-card">
        <img
          src={logo}
          alt="Flotivo"
          className="login-logo"
        />

        <h1>Zaloguj się</h1>

        <p className="login-subtitle">
          Zaloguj się do systemu zarządzania flotą.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">Login</label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Hasło</label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="login-error">
              {error}
            </p>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <button
          className="login-back"
          type="button"
          onClick={() => navigate('/')}
        >
          ← Wróć na stronę główną
        </button>
      </div>
    </div>
  );
}

export default Login;