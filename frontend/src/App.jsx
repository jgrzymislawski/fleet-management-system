import { useCallback, useState } from "react";
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
import AddDriverPage from "./components/AddDriverPage";
import DriverDetailsPage from "./components/DriverDetailsPage";
import EditDriverPage from "./components/EditDriverPage";
import AlertsPage from "./components/AlertsPage";
import ServiceHistoryPage from "./components/ServiceHistoryPage";
import AddServiceRecordPage from "./components/AddServiceRecordPage";
import EditServiceRecordPage from "./components/EditServiceRecordPage";
import StatisticsPage from "./components/StatisticsPage";
import AddVehicleDocumentPage from "./components/AddVehicleDocumentPage";
import EditVehicleDocumentPage from "./components/EditVehicleDocumentPage";
import AccountPage from "./components/AccountPage";
import ChangePasswordPage from "./components/ChangePasswordPage";
import AdminPanelPage from "./components/AdminPanelPage";
import AdminCompaniesPage from "./components/AdminCompaniesPage";
import AddCompanyPage from "./components/AddCompanyPage";
import EditCompanyPage from "./components/EditCompanyPage";
import AdminUsersPage from "./components/AdminUsersPage";
import AddUserPage from "./components/AddUserPage";
import EditUserPage from "./components/EditUserPage";
import NotificationPreferencesPage from "./components/NotificationPreferencesPage";

import useIdleLogout from "./hooks/useIdleLogout";
import { useAuth } from "./context/AuthContext";

import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem("access_token") !== null,
  );

  const navigate = useNavigate();

  const { user, loadingUser, clearUser } = useAuth();

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    navigate("/dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    clearUser();

    setIsLoggedIn(false);

    navigate("/");
  };

  const handleIdleLogout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    clearUser();

    setIsLoggedIn(false);

    navigate("/login", {
      replace: true,
    });
  }, [navigate, clearUser]);

  useIdleLogout(isLoggedIn, handleIdleLogout, 15 * 60 * 1000);

  const protectedElement = (element) => {
    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }

    return element;
  };

  const adminElement = (element) => {
    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }

    if (loadingUser) {
      return <p>Ładowanie...</p>;
    }

    if (user?.role !== "admin") {
      return <Navigate to="/account" replace />;
    }

    return element;
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
        path="/dashboard"
        element={protectedElement(<Dashboard onLogout={handleLogout} />)}
      />

      <Route
        path="/vehicles"
        element={protectedElement(<VehiclesPage onLogout={handleLogout} />)}
      />

      <Route
        path="/vehicles/add"
        element={protectedElement(<AddVehiclePage onLogout={handleLogout} />)}
      />

      <Route
        path="/vehicles/:id/edit"
        element={protectedElement(<EditVehiclePage onLogout={handleLogout} />)}
      />

      <Route
        path="/vehicles/:id"
        element={protectedElement(
          <VehicleDetailsPage onLogout={handleLogout} />,
        )}
      />

      <Route
        path="/drivers"
        element={protectedElement(<DriversPage onLogout={handleLogout} />)}
      />

      <Route
        path="/drivers/add"
        element={protectedElement(<AddDriverPage onLogout={handleLogout} />)}
      />

      <Route
        path="/drivers/:id/edit"
        element={protectedElement(<EditDriverPage onLogout={handleLogout} />)}
      />

      <Route
        path="/drivers/:id"
        element={protectedElement(
          <DriverDetailsPage onLogout={handleLogout} />,
        )}
      />

      <Route
        path="/alerts"
        element={protectedElement(<AlertsPage onLogout={handleLogout} />)}
      />

      <Route
        path="/service-history"
        element={protectedElement(
          <ServiceHistoryPage onLogout={handleLogout} />,
        )}
      />

      <Route
        path="/service-history/add"
        element={protectedElement(
          <AddServiceRecordPage onLogout={handleLogout} />,
        )}
      />

      <Route
        path="/service-history/:id/edit"
        element={protectedElement(
          <EditServiceRecordPage onLogout={handleLogout} />,
        )}
      />

      <Route
        path="/vehicle-documents/add"
        element={protectedElement(
          <AddVehicleDocumentPage onLogout={handleLogout} />,
        )}
      />

      <Route
        path="/vehicle-documents/:id/edit"
        element={protectedElement(
          <EditVehicleDocumentPage onLogout={handleLogout} />,
        )}
      />

      <Route
        path="/statistics"
        element={protectedElement(<StatisticsPage onLogout={handleLogout} />)}
      />

      <Route
        path="/account"
        element={protectedElement(<AccountPage onLogout={handleLogout} />)}
      />

      <Route
        path="/account/change-password"
        element={protectedElement(
          <ChangePasswordPage onLogout={handleLogout} />,
        )}
      />
      <Route
        path="/account/notifications"
        element={protectedElement(
          <NotificationPreferencesPage onLogout={handleLogout} />,
        )}
      />
      <Route
        path="/admin-panel"
        element={adminElement(<AdminPanelPage onLogout={handleLogout} />)}
      />

      <Route
        path="/admin-panel/companies"
        element={adminElement(<AdminCompaniesPage onLogout={handleLogout} />)}
      />

      <Route
        path="/admin-panel/companies/add"
        element={adminElement(<AddCompanyPage onLogout={handleLogout} />)}
      />

      <Route
        path="/admin-panel/companies/:id/edit"
        element={adminElement(<EditCompanyPage onLogout={handleLogout} />)}
      />

      <Route
        path="/admin-panel/users"
        element={adminElement(<AdminUsersPage onLogout={handleLogout} />)}
      />

      <Route
        path="/admin-panel/users/add"
        element={adminElement(<AddUserPage onLogout={handleLogout} />)}
      />
      <Route
        path="/admin-panel/users/:id/edit"
        element={adminElement(<EditUserPage onLogout={handleLogout} />)}
      />
    </Routes>
  );
}

export default App;
