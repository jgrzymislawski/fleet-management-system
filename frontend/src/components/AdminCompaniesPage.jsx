import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./AdminCompaniesPage.css";

function AdminCompaniesPage({ onLogout }) {
  const navigate = useNavigate();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiClient.get("admin/companies/");

      setCompanies(response.data);
    } catch (err) {
      console.error("Błąd pobierania spółek:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się pobrać listy spółek.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleToggleActive = async (company) => {
    const newStatus = !company.is_active;

    const actionName = newStatus ? "aktywować" : "dezaktywować";

    const confirmed = window.confirm(
      `Czy na pewno chcesz ${actionName} spółkę "${company.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionError("");

      const response = await apiClient.patch(`admin/companies/${company.id}/`, {
        is_active: newStatus,
      });

      setCompanies((currentCompanies) =>
        currentCompanies.map((currentCompany) =>
          currentCompany.id === company.id ? response.data : currentCompany,
        ),
      );
    } catch (err) {
      console.error("Błąd zmiany statusu spółki:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setActionError("Nie udało się zmienić statusu spółki.");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie spółek...</p>
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
              className="admin-companies-back"
              onClick={() => navigate("/admin-panel")}
            >
              ← Wróć do administracji
            </button>

            <h1>Spółki</h1>

            <p>Zarządzaj spółkami należącymi do organizacji.</p>
          </div>

          <button
            className="admin-companies-add"
            onClick={() => navigate("/admin-panel/companies/add")}
          >
            + Dodaj spółkę
          </button>
        </div>

        {error && <p className="admin-companies-error">{error}</p>}

        {actionError && <p className="admin-companies-error">{actionError}</p>}

        {companies.length > 0 ? (
          <div className="admin-companies-list">
            {companies.map((company) => (
              <div className="admin-company-card" key={company.id}>
                <div className="admin-company-main">
                  <div>
                    <h2>{company.name}</h2>

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
                    className="admin-company-edit"
                    onClick={() =>
                      navigate(`/admin-panel/companies/${company.id}/edit`)
                    }
                  >
                    Edytuj
                  </button>

                  <button
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
            <h2>Brak spółek</h2>

            <p>W tej organizacji nie ma jeszcze żadnych spółek.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminCompaniesPage;
