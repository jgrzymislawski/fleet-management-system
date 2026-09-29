import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import HomePage from './components/HomePage';
import Login from './components/Login';
import VehicleList from './components/VehicleList';
import DriverList from './components/DriverList';
import OfferPage from './components/OfferPage';
import PreviewPage from './components/PreviewPage';
import JoinPage from './components/JoinPage';

function Dashboard({ onLogout }) {
  return (
    <div>
      <h1>Zalogowano!</h1>
      <button onClick={onLogout}>Wyloguj</button>
      <VehicleList />
      <DriverList />
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setIsLoggedIn(false);
    navigate('/');
  };

  return (
    <Routes>
      <Route path="/podglad" element={<PreviewPage />} /><Route path="/dolacz" element={<JoinPage />} />
      <Route path="/oferta" element={<OfferPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
      <Route
        path="/dashboard"
        element={isLoggedIn ? <Dashboard onLogout={handleLogout} /> : <HomePage />}
      />
    </Routes>
  );
}

export default App;