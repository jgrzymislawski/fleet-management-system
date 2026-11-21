import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AdminCompaniesPage.css";

function AdminCompaniesPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [companyToToggle, setCompanyToToggle] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const canManageCompanies = user?.role === "admin";

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiClient.get("admin/companies/");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];

      setCompanies(data);
    } catch (err) {
      console.error("Błąd pobierania spółek:", err);

      setCompanies([]);

      if (err.response?.status === 403) {
        setError("Nie masz uprawnień do wyświetlenia spółek.");
      } else {
        setError("Nie udało się pobrać listy spółek.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadingUser || !canManageCompanies) {
      if (!loadingUser) {
        setLoading(false);
      }

      return;
    }

    loadCompanies();
  }, [loadingUser, canManageCompanies]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !changingStatus) {
        setCompanyToToggle(null);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [changingStatus]);

  const filteredCompanies = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) {
      return companies;
    }

    return companies.filter((company) => {
      const searchableText = [company.name, company.tax_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [companies, searchText]);

  const handleToggleActive = (company) => {
    setActionError("");
    setCompanyToToggle(company);
  };

  const confirmToggleActive = async () => {
    if (!companyToToggle || changingStatus) {
      return;
    }

    try {
      setChangingStatus(true);
      setActionError("");

      const response = await apiClient.patch(
        `admin/companies/${companyToToggle.id}/`,
        {
          is_active: !companyToToggle.is_active,
        },
      );

      setCompanies((currentCompanies) =>
        currentCompanies.map((company) =>
          company.id === companyToToggle.id ? response.data : company,
        ),
      );

      setCompanyToToggle(null);
    } catch (err) {
      console.error("Błąd zmiany statusu spółki:", err);
      setActionError("Nie udało się zmienić statusu spółki.");
    } finally {
      setChangingStatus(false);
    }
  };

  if (loadingUser || loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie spółek...</p>
        </main>
      </div>
    );
  }

  if (!canManageCompanies) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <div className="admin-companies-error">
            Nie masz uprawnień do zarządzania spółkami.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="admin-companies-header">
          <div>
            <button
              type="button"
              className="admin-companies-back"
              onClick={() => navigate("/admin-panel")}
            >
              ← Wróć do administracji
            </button>

            <h1>Spółki</h1>
            <p>Zarządzaj spółkami należącymi do organizacji.</p>
          </div>

          <button
            type="button"
            className="admin-companies-add"
            onClick={() => navigate("/admin-panel/companies/add")}
          >
            + Dodaj spółkę
          </button>
        </div>

        {error && (
          <p className="admin-companies-error" role="alert">
            {error}
          </p>
        )}

        {actionError && (
          <p className="admin-companies-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="admin-companies-toolbar">
          <div className="admin-companies-search-wrapper">
            <input
              type="search"
              className="admin-companies-search"
              placeholder="Szukaj po nazwie lub NIP..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />

            {searchText && (
              <button
                type="button"
                className="admin-companies-search-clear"
                onClick={() => setSearchText("")}
                aria-label="Wyczyść wyszukiwanie"
              >
                ×
              </button>
            )}
          </div>

          <span className="admin-companies-count">
            Wyświetlono: {filteredCompanies.length} z {companies.length}
          </span>
        </div>

        {filteredCompanies.length > 0 ? (
          <div className="admin-companies-list">
            {filteredCompanies.map((company) => (
              <div className="admin-company-card" key={company.id}>
                <div className="admin-company-main">
                  <div>
                    <h2>{company.name || "Bez nazwy"}</h2>
                    <p>NIP: {company.tax_id || "Nie podano"}</p>
                  </div>

                  <span
                    className={
                      company.is_active
                        ? "admin-company-status admin-company-status-active"
                        : "admin-company-status admin-company-status-inactive"
                    }
                  >
                    {company.is_active ? "Aktywna" : "Nieaktywna"}
                  </span>
                </div>

                <div className="admin-company-actions">
                  <button
                    type="button"
                    className="admin-company-edit"
                    onClick={() =>
                      navigate(`/admin-panel/companies/${company.id}/edit`)
                    }
                  >
                    Edytuj
                  </button>

                  <button
                    type="button"
                    className={
                      company.is_active
                        ? "admin-company-toggle admin-company-disable"
                        : "admin-company-toggle admin-company-enable"
                    }
                    onClick={() => handleToggleActive(company)}
                  >
                    {company.is_active ? "Dezaktywuj" : "Aktywuj"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-companies-empty">
            <h2>{searchText.trim() ? "Brak wyników" : "Brak spółek"}</h2>

            <p>
              {searchText.trim()
                ? "Nie znaleziono spółek pasujących do wyszukiwania."
                : "W tej organizacji nie ma jeszcze żadnych spółek."}
            </p>
          </div>
        )}

        {companyToToggle && (
          <div className="admin-company-modal-overlay">
            <div
              className="admin-company-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-company-modal-title"
            >
              <h2 id="admin-company-modal-title">
                {companyToToggle.is_active
                  ? "Dezaktywować spółkę?"
                  : "Aktywować spółkę?"}
              </h2>

              <p>
                Czy na pewno chcesz{" "}
                {companyToToggle.is_active ? "dezaktywować" : "aktywować"}{" "}
                spółkę <strong>{companyToToggle.name}</strong>?
              </p>

              <div className="admin-company-modal-actions">
                <button
                  type="button"
                  className="admin-company-modal-cancel"
                  onClick={() => setCompanyToToggle(null)}
                  disabled={changingStatus}
                >
                  Anuluj
                </button>

                <button
                  type="button"
                  className={
                    companyToToggle.is_active
                      ? "admin-company-modal-confirm admin-company-modal-confirm-danger"
                      : "admin-company-modal-confirm"
                  }
                  onClick={confirmToggleActive}
                  disabled={changingStatus}
                >
                  {changingStatus
                    ? "Zapisywanie..."
                    : companyToToggle.is_active
                      ? "Dezaktywuj"
                      : "Aktywuj"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminCompaniesPage;
