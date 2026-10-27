import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./AdminUsersPage.css";

function AdminUsersPage({ onLogout }) {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get("admin/users/");

        setUsers(response.data);
      } catch (err) {
        console.error("Błąd pobierania użytkowników:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać listy użytkowników.");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const getRoleName = (role) => {
    if (role === "admin") {
      return "Administrator";
    }

    if (role === "member") {
      return "Użytkownik";
    }

    return role;
  };

  const getCompanyRoleName = (role) => {
    if (role === "admin") {
      return "Administrator";
    }

    if (role === "editor") {
      return "Edycja";
    }

    if (role === "viewer") {
      return "Tylko odczyt";
    }

    return role;
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie użytkowników...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="admin-users-header">
          <div>
            <button
              className="admin-users-back"
              onClick={() => navigate("/admin-panel")}
            >
              ← Wróć do administracji
            </button>

            <h1>Użytkownicy</h1>

            <p>Zarządzaj użytkownikami swojej organizacji.</p>
          </div>

          <button
            className="admin-users-add"
            onClick={() => navigate("/admin-panel/users/add")}
          >
            + Dodaj użytkownika
          </button>
        </div>

        {error && <p className="admin-users-error">{error}</p>}

        {users.length > 0 ? (
          <div className="admin-users-list">
            {users.map((user) => (
              <div className="admin-user-card" key={user.id}>
                <div className="admin-user-main">
                  <div>
                    <h2>{user.username}</h2>

                    <p>{user.email || "Brak adresu e-mail"}</p>
                  </div>

                  <div className="admin-user-badges">
                    <span className="admin-user-role">
                      {getRoleName(user.role)}
                    </span>

                    <span
                      className={
                        user.is_active
                          ? "admin-user-status admin-user-status-active"
                          : "admin-user-status admin-user-status-inactive"
                      }
                    >
                      {user.is_active ? "Aktywny" : "Nieaktywny"}
                    </span>
                  </div>
                </div>

                <div className="admin-user-companies">
                  <span className="admin-user-companies-title">
                    Dostęp do spółek
                  </span>

                  {user.companies?.length > 0 ? (
                    <div className="admin-user-company-list">
                      {user.companies.map((company) => (
                        <div className="admin-user-company" key={company.id}>
                          <span>{company.name}</span>

                          <span>{getCompanyRoleName(company.role)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin-user-no-companies">
                      Brak przypisanych spółek.
                    </p>
                  )}
                </div>

                <div className="admin-user-actions">
                  <button
                    className="admin-user-edit"
                    onClick={() =>
                      navigate(`/admin-panel/users/${user.id}/edit`)
                    }
                  >
                    Edytuj
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-users-empty">
            <h2>Brak użytkowników</h2>

            <p>W organizacji nie ma jeszcze użytkowników.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminUsersPage;
