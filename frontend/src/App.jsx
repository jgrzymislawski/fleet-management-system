import { lazy, Suspense, useCallback } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import HomePage from "./components/HomePage";
import Login from "./components/Login";
import useIdleLogout from "./hooks/useIdleLogout";
import { useAuth } from "./context/AuthContext";
import { logoutSession } from "./api/client";
import "./App.css";

// Ladowanie podstron na zadanie.
const OfferPage = lazy(() => import("./components/OfferPage"));
const PreviewPage = lazy(() => import("./components/PreviewPage"));
const JoinPage = lazy(() => import("./components/JoinPage"));
const VehiclesPage = lazy(() => import("./components/VehiclesPage"));
const DriversPage = lazy(() => import("./components/DriversPage"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const EditVehiclePage = lazy(() => import("./components/EditVehiclePage"));
const AddVehiclePage = lazy(() => import("./components/AddVehiclePage"));
const VehicleDetailsPage = lazy(
  () => import("./components/VehicleDetailsPage"),
);
const AddDriverPage = lazy(() => import("./components/AddDriverPage"));
const DriverDetailsPage = lazy(() => import("./components/DriverDetailsPage"));
const EditDriverPage = lazy(() => import("./components/EditDriverPage"));
const AlertsPage = lazy(() => import("./components/AlertsPage"));
const ServiceHistoryPage = lazy(
  () => import("./components/ServiceHistoryPage"),
);
const AddServiceRecordPage = lazy(
  () => import("./components/AddServiceRecordPage"),
);
const EditServiceRecordPage = lazy(
  () => import("./components/EditServiceRecordPage"),
);
const StatisticsPage = lazy(() => import("./components/StatisticsPage"));
const ReportsPage = lazy(() => import("./components/ReportsPage"));
const AddVehicleDocumentPage = lazy(
  () => import("./components/AddVehicleDocumentPage"),
);
const EditVehicleDocumentPage = lazy(
  () => import("./components/EditVehicleDocumentPage"),
);
const AccountPage = lazy(() => import("./components/AccountPage"));
const ChangePasswordPage = lazy(
  () => import("./components/ChangePasswordPage"),
);
const NotificationPreferencesPage = lazy(
  () => import("./components/NotificationPreferencesPage"),
);
const AdminPanelPage = lazy(() => import("./components/AdminPanelPage"));
const AdminCompaniesPage = lazy(
  () => import("./components/AdminCompaniesPage"),
);
const AddCompanyPage = lazy(() => import("./components/AddCompanyPage"));
const EditCompanyPage = lazy(() => import("./components/EditCompanyPage"));
const AdminUsersPage = lazy(() => import("./components/AdminUsersPage"));
const AddUserPage = lazy(() => import("./components/AddUserPage"));
const EditUserPage = lazy(() => import("./components/EditUserPage"));
const AdminNotificationSettingsPage = lazy(
  () => import("./components/AdminNotificationSettingsPage"),
);
const ActivityLogPage = lazy(() => import("./components/ActivityLogPage"));

function App() {
  const navigate = useNavigate();
  const { user, loadingUser, loadUser, clearUser } = useAuth();

  const isLoggedIn = Boolean(user);

  const clearSession = useCallback(() => {
    clearUser();

    void logoutSession().catch(() => {
      window.alert(
        "Wylogowano lokalnie, ale serwer nie potwierdził " +
          "unieważnienia sesji. Sprawdź połączenie z internetem. " +
          "Sesja na serwerze może nadal być aktywna.",
      );
    });
  }, [clearUser]);

  const handleLoginSuccess = async () => {
    const authenticatedUser = await loadUser();

    if (!authenticatedUser) {
      throw new Error("Nie udało się potwierdzić tożsamości użytkownika.");
    }

    navigate("/dashboard", { replace: true });
    return authenticatedUser;
  };

  const handleLogout = useCallback(() => {
    clearSession();
    navigate("/", { replace: true });
  }, [clearSession, navigate]);

  const handleIdleLogout = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [clearSession, navigate]);

  useIdleLogout(isLoggedIn, handleIdleLogout, 15 * 60 * 1000);

  const protectedElement = (element) => {
    if (loadingUser) {
      return <div className="dashboard-route-loading">Ładowanie...</div>;
    }

    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }

    return element;
  };

  const adminElement = (element) => {
    if (loadingUser) {
      return <div className="dashboard-route-loading">Ładowanie...</div>;
    }

    if (!isLoggedIn) {
      return <Navigate to="/login" replace />;
    }

    if (user.role !== "admin") {
      return <Navigate to="/account" replace />;
    }

    return element;
  };

  return (
    <Suspense
      fallback={
        <div className="dashboard-route-loading" role="status">
          Ładowanie strony...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/oferta" element={<OfferPage />} />
        <Route path="/podglad" element={<PreviewPage />} />
        <Route path="/dolacz" element={<JoinPage />} />

        <Route
          path="/login"
          element={
            loadingUser ? (
              <div className="dashboard-route-loading">Ładowanie sesji...</div>
            ) : isLoggedIn ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} />
            )
          }
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
          element={protectedElement(
            <EditVehiclePage onLogout={handleLogout} />,
          )}
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
          path="/reports"
          element={protectedElement(<ReportsPage onLogout={handleLogout} />)}
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

        <Route
          path="/admin-panel/notifications"
          element={adminElement(
            <AdminNotificationSettingsPage onLogout={handleLogout} />,
          )}
        />

        <Route
          path="/admin-panel/activity"
          element={adminElement(<ActivityLogPage onLogout={handleLogout} />)}
        />

        <Route
          path="*"
          element={<Navigate to={isLoggedIn ? "/dashboard" : "/"} replace />}
        />
      </Routes>
    </Suspense>
  );
}

export default App;
