import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AdminUsersPage.css";

function AdminUsersPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (loadingUser || user?.role !== "admin") {
      setLoading(false);
      return;
    }

    let active = true;

    const loadUsers = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get("admin/users/");

        if (!active) return;

        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];

        setUsers(data);
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania użytkowników:", err);
        setUsers([]);

        if (err.response?.status === 403) {
          setError("Nie masz uprawnień do wyświetlenia użytkowników.");
        } else {
          setError("Nie udało się pobrać listy użytkowników.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      active = false;
    };
  }, [user, loadingUser]);

  const getRoleName = (role) => {
    if (role === "admin") return "Administrator";
    if (role === "member") return "Użytkownik";
    return role || "Nie określono";
  };

  const getCompanyRoleName = (role) => {
    if (role === "admin") return "Administrator";
    if (role === "editor") return "Edycja";
    if (role === "viewer") return "Tylko odczyt";
    return role || "Brak uprawnień";
  };

  const filteredUsers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) {
      return users;
    }

    return users.filter((account) => {
      const companyNames = (account.companies || [])
        .map((company) => company.name)
        .join(" ");

      const searchValue = [
        account.username,
        account.email,
        getRoleName(account.role),
        companyNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchValue.includes(search);
    });
  }, [users, searchText]);

  if (loadingUser || loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie użytkowników...</p>
        </main>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <div className="admin-users-error">
            Nie masz uprawnień do zarządzania użytkownikami.
          </div>
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
              type="button"
              className="admin-users-back"
              onClick={() => navigate("/admin-panel")}
            >
              ← Wróć do administracji
            </button>

            <h1>Użytkownicy</h1>
            <p>Zarządzaj użytkownikami swojej organizacji.</p>
          </div>

          <button
            type="button"
            className="admin-users-add"
            onClick={() => navigate("/admin-panel/users/add")}
          >
            + Dodaj użytkownika
          </button>
        </div>

        {error && (
          <div className="admin-users-error" role="alert">
            {error}
          </div>
        )}

        <div className="admin-users-toolbar">
          <div className="admin-users-search-wrapper">
            <input
              type="search"
              className="admin-users-search"
              placeholder="Szukaj po nazwie, e-mailu, roli lub spółce..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            {searchText && (
              <button
                type="button"
                className="admin-users-search-clear"
                onClick={() => setSearchText("")}
                aria-label="Wyczyść wyszukiwanie"
              >
                ×
              </button>
            )}
          </div>

          <span className="admin-users-count">
            Wyświetlono: {filteredUsers.length} z {users.length}
          </span>
        </div>

        {filteredUsers.length > 0 ? (
          <div className="admin-users-list">
            {filteredUsers.map((account) => {
              const companies = [...(account.companies || [])].sort((a, b) =>
                (a.name || "").localeCompare(b.name || "", "pl", {
                  sensitivity: "base",
                }),
              );

              return (
                <div className="admin-user-card" key={account.id}>
                  <div className="admin-user-main">
                    <div>
                      <h2>{account.username || "Bez nazwy użytkownika"}</h2>
                      <p>{account.email || "Brak adresu e-mail"}</p>
                    </div>

                    <div className="admin-user-badges">
                      <span className="admin-user-role">
                        {getRoleName(account.role)}
                      </span>

                      <span
                        className={
                          account.is_active
                            ? "admin-user-status admin-user-status-active"
                            : "admin-user-status admin-user-status-inactive"
                        }
                      >
                        {account.is_active ? "Aktywny" : "Nieaktywny"}
                      </span>
                    </div>
                  </div>

                  <div className="admin-user-companies">
                    <span className="admin-user-companies-title">
                      Dostęp do spółek
                    </span>

                    {companies.length > 0 ? (
                      <div className="admin-user-company-list">
                        {companies.map((company) => (
                          <div className="admin-user-company" key={company.id}>
                            <span>{company.name || "Bez nazwy"}</span>
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
                      type="button"
                      className="admin-user-edit"
                      onClick={() =>
                        navigate(`/admin-panel/users/${account.id}/edit`)
                      }
                    >
                      Edytuj
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="admin-users-empty">
            <h2>{searchText.trim() ? "Brak wyników" : "Brak użytkowników"}</h2>

            <p>
              {searchText.trim()
                ? "Nie znaleziono użytkowników pasujących do wyszukiwania."
                : "W organizacji nie ma jeszcze użytkowników."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminUsersPage;
