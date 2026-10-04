import { useState } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";

import HomePage from "./components/HomePage";
import Login from "./components/Login";
import OfferPage from "./components/OfferPage";
import PreviewPage from "./components/PreviewPage";
import JoinPage from "./components/JoinPage";
import VehiclesPage from "./components/VehiclesPage";
import DriversPage from "./components/DriversPage";
import Dashboard from "./components/Dashboard";
import EditVehiclePage from "./components/EditVehiclePage";
import AddVehiclePage from "./components/AddVehiclePage";
import VehicleDetailsPage from "./components/VehicleDetailsPage";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem("access_token") !== null,
  );
  const navigate = useNavigate();

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    navigate("/dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    setIsLoggedIn(false);
    navigate("/");
  };

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/oferta" element={<OfferPage />} />
      <Route path="/podglad" element={<PreviewPage />} />
      <Route path="/dolacz" element={<JoinPage />} />

      <Route
        path="/login"
        element={<Login onLoginSuccess={handleLoginSuccess} />}
      />
      <Route
        path="/vehicles/add"
        element={
          isLoggedIn ? (
            <AddVehiclePage onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          isLoggedIn ? (
            <Dashboard onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/vehicles/:id/edit"
        element={
          isLoggedIn ? (
            <EditVehiclePage onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/vehicles/:id"
        element={
          isLoggedIn ? (
            <VehicleDetailsPage onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/vehicles"
        element={
          isLoggedIn ? (
            <VehiclesPage onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/drivers"
        element={
          isLoggedIn ? (
            <DriversPage onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
