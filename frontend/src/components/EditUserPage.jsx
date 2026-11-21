import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AddUserPage.css";

function EditUserPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: loggedUser, loadUser, loadingUser } = useAuth();

  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    is_active: true,
    role: "member",
    companies: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManageUsers = loggedUser?.role === "admin";

  const isOwnAccount =
    formData.username !== "" && formData.username === loggedUser?.username;

  useEffect(() => {
    if (loadingUser || !canManageUsers) {
      if (!loadingUser) {
        setLoading(false);
      }

      return;
    }

    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [userResponse, companiesResponse] = await Promise.all([
          apiClient.get(`admin/users/${id}/`),
          apiClient.get("companies/"),
        ]);

        if (!active) return;

        const editedUser = userResponse.data;
        const companiesData = Array.isArray(companiesResponse.data)
          ? companiesResponse.data
          : companiesResponse.data?.results || [];

        setAvailableCompanies(companiesData);

        setFormData({
          username: editedUser.username || "",
          email: editedUser.email || "",
          is_active: Boolean(editedUser.is_active),
          role: editedUser.role || "member",
          companies:
            editedUser.role === "member"
              ? (editedUser.companies || []).map((company) => ({
                  company_id: company.id,
                  role: company.role,
                }))
              : [],
        });
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania użytkownika:", err);

        if (err.response?.status === 404) {
          setError("Nie znaleziono użytkownika.");
        } else if (err.response?.status === 403) {
          setError("Nie masz uprawnień do edycji tego użytkownika.");
        } else {
          setError("Nie udało się pobrać danych użytkownika.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [id, loadingUser, canManageUsers]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

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
        [name]: type === "checkbox" ? checked : value,
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

    if (!data) return "Nie udało się zapisać zmian.";
    if (typeof data === "string") return data;
    if (typeof data.detail === "string") return data.detail;
    if (data.email?.[0]) return data.email[0];
    if (data.role?.[0]) return data.role[0];
    if (data.is_active?.[0]) return data.is_active[0];
    if (data.companies?.[0]) return data.companies[0];
    if (data.non_field_errors?.[0]) return data.non_field_errors[0];

    return "Nie udało się zapisać zmian.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    setError("");

    try {
      setSaving(true);

      await apiClient.put(`admin/users/${id}/`, {
        email: formData.email.trim(),
        is_active: formData.is_active,
        role: formData.role,
        companies: formData.role === "admin" ? [] : formData.companies,
      });

      if (isOwnAccount) {
        await loadUser();
      }

      navigate("/admin-panel/users");
    } catch (err) {
      console.error("Błąd edycji użytkownika:", err);
      setError(getBackendError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadingUser || loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie danych użytkownika...</p>
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
            Nie masz uprawnień do edycji użytkowników.
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

          <h1>Edytuj użytkownika</h1>
          <p>Zmień dane użytkownika oraz jego uprawnienia.</p>
        </div>

        <div className="add-user-card">
          <form className="add-user-form" onSubmit={handleSubmit}>
            <div className="add-user-grid">
              <div className="add-user-field">
                <label htmlFor="username">Nazwa użytkownika</label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  disabled
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
                  disabled={saving}
                />
              </div>

              <div className="add-user-field">
                <label htmlFor="role">Rola w organizacji</label>

                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={isOwnAccount || saving}
                >
                  <option value="member">Użytkownik</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="add-user-field">
                <label>Status konta</label>

                <label className="add-user-company-checkbox">
                  <input
                    name="is_active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={handleChange}
                    disabled={isOwnAccount || saving}
                  />

                  <span>Konto aktywne</span>
                </label>
              </div>
            </div>

            {isOwnAccount && (
              <div className="add-user-admin-info">
                Edytujesz własne konto. Nie możesz dezaktywować swojego konta
                ani odebrać sobie roli administratora.
              </div>
            )}

            {formData.role === "member" && (
              <div className="add-user-companies">
                <div className="add-user-section-header">
                  <h2>Dostęp do spółek</h2>
                  <p>Wybierz spółki oraz poziom dostępu tego użytkownika.</p>
                </div>

                {availableCompanies.length > 0 ? (
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
                Administrator ma automatycznie dostęp do wszystkich spółek
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
                disabled={saving}
              >
                {saving ? "Zapisywanie..." : "Zapisz zmiany"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default EditUserPage;
