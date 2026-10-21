import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./AccountPage.css";

function AccountPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();

  const getRoleName = (role) => {
    if (role === "admin") {
      return "Administrator";
    }

    if (role === "member") {
      return "Użytkownik";
    }

    return "Nie określono";
  };

  const getCompanyRoleName = (role) => {
    if (role === "admin") {
      return "Administrator";
    }

    if (role === "editor") {
      return "Odczyt i edycja";
    }

    if (role === "viewer") {
      return "Tylko odczyt";
    }

    return "Brak uprawnień";
  };

  if (loadingUser) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie danych użytkownika...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p className="account-error">
            Nie udało się pobrać danych użytkownika.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="account-header">
          <div>
            <h1>Moje konto</h1>

            <p>Informacje o Twoim koncie i uprawnieniach w systemie Flotivo.</p>
          </div>
        </div>

        <div className="account-card">
          <h2>Dane użytkownika</h2>

          <div className="account-details-grid">
            <div className="account-detail">
              <span className="account-detail-label">Nazwa użytkownika</span>

              <span className="account-detail-value">{user.username}</span>
            </div>

            <div className="account-detail">
              <span className="account-detail-label">E-mail</span>

              <span className="account-detail-value">
                {user.email || "Nie podano"}
              </span>
            </div>

            <div className="account-detail">
              <span className="account-detail-label">Rola</span>

              <span className="account-detail-value">
                {getRoleName(user.role)}
              </span>
            </div>

            <div className="account-detail">
              <span className="account-detail-label">Organizacja</span>

              <span className="account-detail-value">
                {user.organization?.name || "Brak organizacji"}
              </span>
            </div>
          </div>
        </div>

        <div className="account-card">
          <h2>Dostęp do spółek</h2>

          {user.companies?.length > 0 ? (
            <div className="account-companies">
              {user.companies.map((company) => (
                <div className="account-company" key={company.id}>
                  <div>
                    <span className="account-company-name">{company.name}</span>

                    <span className="account-company-role">
                      {getCompanyRoleName(company.role)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="account-empty">Brak przypisanych spółek.</p>
          )}
        </div>

        <div className="account-card">
          <h2>Bezpieczeństwo</h2>

          <p className="account-card-description">
            Możesz zmienić hasło używane do logowania do systemu.
          </p>

          <button
            className="account-primary-button"
            onClick={() => navigate("/account/change-password")}
          >
            Zmień hasło
          </button>
        </div>

        {user.role === "admin" && (
          <div className="account-card account-admin-card">
            <h2>Administracja</h2>

            <p className="account-card-description">
              Zarządzaj użytkownikami, spółkami i uprawnieniami swojej
              organizacji.
            </p>

            <button
              className="account-primary-button"
              onClick={() => navigate("/admin-panel")}
            >
              Otwórz panel administracyjny
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default AccountPage;
