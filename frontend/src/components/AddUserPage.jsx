import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AddUserPage.css";

function AddUserPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();

  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "member",
    companies: [],
  });
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManageUsers = user?.role === "admin";

  useEffect(() => {
    if (loadingUser || !canManageUsers) {
      if (!loadingUser) {
        setLoadingCompanies(false);
      }

      return;
    }

    let active = true;

    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true);

        const response = await apiClient.get("companies/");

        if (!active) return;

        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];

        setAvailableCompanies(data);
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania spółek:", err);
        setAvailableCompanies([]);
        setError("Nie udało się pobrać listy spółek.");
      } finally {
        if (active) {
          setLoadingCompanies(false);
        }
      }
    };

    loadCompanies();

    return () => {
      active = false;
    };
  }, [loadingUser, canManageUsers]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setError("");

    setFormData((currentData) => {
      if (name === "role") {
        return {
          ...currentData,
          role: value,
          companies: value === "admin" ? [] : currentData.companies,
        };
      }

      return {
        ...currentData,
        [name]: value,
      };
    });
  };

  const handleCompanyToggle = (companyId) => {
    setError("");

    setFormData((currentData) => {
      const existingAccess = currentData.companies.find(
        (company) => Number(company.company_id) === Number(companyId),
      );

      if (existingAccess) {
        return {
          ...currentData,
          companies: currentData.companies.filter(
            (company) => Number(company.company_id) !== Number(companyId),
          ),
        };
      }

      return {
        ...currentData,
        companies: [
          ...currentData.companies,
          {
            company_id: companyId,
            role: "viewer",
          },
        ],
      };
    });
  };

  const handleCompanyRoleChange = (companyId, role) => {
    setError("");

    setFormData((currentData) => ({
      ...currentData,
      companies: currentData.companies.map((company) =>
        Number(company.company_id) === Number(companyId)
          ? {
              ...company,
              role,
            }
          : company,
      ),
    }));
  };

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) return "Nie udało się dodać użytkownika.";
    if (typeof data === "string") return data;
    if (typeof data.detail === "string") return data.detail;
    if (data.username?.[0]) return data.username[0];
    if (data.email?.[0]) return data.email[0];
    if (data.password?.[0]) return data.password[0];
    if (data.confirm_password?.[0]) return data.confirm_password[0];
    if (data.role?.[0]) return data.role[0];
    if (data.companies?.[0]) return data.companies[0];
    if (data.non_field_errors?.[0]) return data.non_field_errors[0];

    return "Nie udało się dodać użytkownika.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    setError("");

    if (!formData.username.trim()) {
      setError("Podaj nazwę użytkownika.");
      return;
    }

    if (!formData.password) {
      setError("Podaj hasło.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Hasła nie są takie same.");
      return;
    }

    try {
      setSaving(true);

      await apiClient.post("admin/users/", {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password,
        role: formData.role,
        companies: formData.role === "admin" ? [] : formData.companies,
      });

      navigate("/admin-panel/users");
    } catch (err) {
      console.error("Błąd dodawania użytkownika:", err);
      setError(getBackendError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie...</p>
        </main>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p className="add-user-error">
            Nie masz uprawnień do dodawania użytkowników.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="add-user-header">
          <button
            type="button"
            className="add-user-back"
            onClick={() => navigate("/admin-panel/users")}
          >
            ← Wróć do użytkowników
          </button>

          <h1>Dodaj użytkownika</h1>
          <p>Utwórz konto i określ jego uprawnienia w organizacji.</p>
        </div>

        <div className="add-user-card">
          <form className="add-user-form" onSubmit={handleSubmit}>
            <div className="add-user-grid">
              <div className="add-user-field">
                <label htmlFor="username">Nazwa użytkownika *</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="off"
                  disabled={saving}
                  required
                />
              </div>

              <div className="add-user-field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="off"
                  disabled={saving}
                />
              </div>

              <div className="add-user-field">
                <label htmlFor="password">Hasło startowe *</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={saving}
                  required
                />
              </div>

              <div className="add-user-field">
                <label htmlFor="confirm_password">Powtórz hasło *</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={saving}
                  required
                />
              </div>

              <div className="add-user-field">
                <label htmlFor="role">Rola w organizacji *</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={saving}
                >
                  <option value="member">Użytkownik</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            {formData.role === "member" && (
              <div className="add-user-companies">
                <div className="add-user-section-header">
                  <h2>Dostęp do spółek</h2>
                  <p>Wybierz spółki, do których użytkownik ma mieć dostęp.</p>
                </div>

                {loadingCompanies ? (
                  <p>Ładowanie spółek...</p>
                ) : availableCompanies.length > 0 ? (
                  <div className="add-user-company-list">
                    {availableCompanies.map((company) => {
                      const access = formData.companies.find(
                        (item) =>
                          Number(item.company_id) === Number(company.id),
                      );

                      return (
                        <div className="add-user-company" key={company.id}>
                          <label className="add-user-company-checkbox">
                            <input
                              type="checkbox"
                              checked={Boolean(access)}
                              onChange={() => handleCompanyToggle(company.id)}
                              disabled={saving}
                            />
                            <span>{company.name || "Bez nazwy"}</span>
                          </label>

                          {access && (
                            <select
                              value={access.role}
                              onChange={(event) =>
                                handleCompanyRoleChange(
                                  company.id,
                                  event.target.value,
                                )
                              }
                              disabled={saving}
                            >
                              <option value="viewer">Tylko odczyt</option>
                              <option value="editor">Odczyt i edycja</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="add-user-empty">Brak aktywnych spółek.</p>
                )}
              </div>
            )}

            {formData.role === "admin" && (
              <div className="add-user-admin-info">
                Administrator automatycznie otrzyma dostęp do wszystkich spółek
                organizacji.
              </div>
            )}

            {error && (
              <p className="add-user-error" role="alert">
                {error}
              </p>
            )}

            <div className="add-user-actions">
              <button
                type="button"
                className="add-user-cancel"
                onClick={() => navigate("/admin-panel/users")}
                disabled={saving}
              >
                Anuluj
              </button>

              <button
                type="submit"
                className="add-user-submit"
                disabled={saving || loadingCompanies}
              >
                {saving ? "Tworzenie..." : "Dodaj użytkownika"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default AddUserPage;
