import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./AddUserPage.css";

function AddUserPage({ onLogout }) {
  const navigate = useNavigate();

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

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await apiClient.get("companies/");

        setAvailableCompanies(response.data);
      } catch (err) {
        console.error("Błąd pobierania spółek:", err);

        setError("Nie udało się pobrać listy spółek.");
      } finally {
        setLoadingCompanies(false);
      }
    };

    loadCompanies();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setError("");

    if (name === "role") {
      setFormData({
        ...formData,
        role: value,
        companies: value === "admin" ? [] : formData.companies,
      });

      return;
    }

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleCompanyToggle = (companyId) => {
    setError("");

    const existingAccess = formData.companies.find(
      (company) => Number(company.company_id) === Number(companyId),
    );

    if (existingAccess) {
      setFormData({
        ...formData,
        companies: formData.companies.filter(
          (company) => Number(company.company_id) !== Number(companyId),
        ),
      });

      return;
    }

    setFormData({
      ...formData,
      companies: [
        ...formData.companies,
        {
          company_id: companyId,
          role: "viewer",
        },
      ],
    });
  };

  const handleCompanyRoleChange = (companyId, role) => {
    setError("");

    setFormData({
      ...formData,
      companies: formData.companies.map((company) =>
        Number(company.company_id) === Number(companyId)
          ? {
              ...company,
              role,
            }
          : company,
      ),
    });
  };

  const getBackendError = (data) => {
    if (!data) {
      return "Nie udało się dodać użytkownika.";
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (data.username?.[0]) {
      return data.username[0];
    }

    if (data.email?.[0]) {
      return data.email[0];
    }

    if (data.password?.[0]) {
      return data.password[0];
    }

    if (data.confirm_password?.[0]) {
      return data.confirm_password[0];
    }

    if (data.role?.[0]) {
      return data.role[0];
    }

    if (data.companies?.[0]) {
      return data.companies[0];
    }

    if (data.non_field_errors?.[0]) {
      return data.non_field_errors[0];
    }

    return "Nie udało się dodać użytkownika.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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

    setSaving(true);

    try {
      const dataToSend = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password,
        role: formData.role,
        companies: formData.role === "admin" ? [] : formData.companies,
      };

      await apiClient.post("admin/users/", dataToSend);

      navigate("/admin-panel/users");
    } catch (err) {
      console.error("Błąd dodawania użytkownika:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError(getBackendError(err.response?.data));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="add-user-header">
          <button
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
                            />

                            <span>{company.name}</span>
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

            {error && <p className="add-user-error">{error}</p>}

            <div className="add-user-actions">
              <button
                type="button"
                className="add-user-cancel"
                onClick={() => navigate("/admin-panel/users")}
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
