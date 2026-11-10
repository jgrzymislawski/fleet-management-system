import { useEffect, useState } from "react";

import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";

import Sidebar from "./sidebar/Sidebar";

import "./ActivityLogPage.css";

const HIDDEN_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",

  "organization",

  "vehicles",
  "drivers",
  "companies",
  "memberships",

  "notification_logs",
  "company_accesses",
  "user_accesses",

  "assignments",
  "vehicle_assignments",

  "service_records",
  "documents",

  "password",
  "last_login",

  "groups",
  "user_permissions",

  "is_staff",
  "is_superuser",

  "date_joined",
]);

const FIELD_LABELS = {
  brand: "Marka",
  model: "Model",
  registration_number: "Numer rejestracyjny",
  vin: "VIN",
  year: "Rok produkcji",
  vehicle_type: "Typ pojazdu",
  fuel_type: "Rodzaj paliwa",
  mileage: "Przebieg",
  status: "Status",
  branch: "Oddział",
  driver: "Kierowca",
  driver_name: "Kierowca",

  inspection_expiry_date: "Termin przeglądu",
  insurance_expiry_date: "Termin OC",

  company: "Spółka",

  first_name: "Imię",
  last_name: "Nazwisko",
  license_number: "Numer prawa jazdy",
  license_categories: "Kategorie prawa jazdy",
  license_expiry_date: "Ważność prawa jazdy",
  medical_exam_expiry_date: "Ważność badań",
  phone_number: "Telefon",
  hired_at: "Data zatrudnienia",

  title: "Nazwa",
  description: "Opis",
  service_date: "Data serwisu",
  cost: "Koszt",

  document_type: "Typ dokumentu",
  document_number: "Numer dokumentu",
  issue_date: "Data wystawienia",
  expiry_date: "Termin ważności",
  notes: "Uwagi",
  file: "Plik",

  name: "Nazwa",
  tax_id: "NIP",
  is_active: "Aktywny",

  username: "Nazwa użytkownika",
  email: "E-mail",
  role: "Rola",

  start_date: "Data rozpoczęcia",
  end_date: "Data zakończenia",
  active: "Aktywne",

  membership: "Użytkownik",
};

const VALUE_LABELS = {
  active: "Aktywny",
  inactive: "Nieaktywny",
  maintenance: "W serwisie",

  petrol: "Benzyna",
  diesel: "Diesel",
  lpg: "LPG",
  hybrid: "Hybryda",
  electric: "Elektryczny",

  passenger: "Samochód osobowy",
  van: "Bus / samochód dostawczy",
  truck: "Samochód ciężarowy",
  special: "Pojazd specjalny",
  other: "Inny",

  admin: "Administrator",
  member: "Użytkownik",

  viewer: "Podgląd",
  editor: "Edycja",
};

function ActivityLogPage({ onLogout }) {
  const { user } = useAuth();

  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");

  const [periodDays, setPeriodDays] = useState(30);

  const [totalLogs, setTotalLogs] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const pageSize = 20;

  const canViewActivity = user?.role === "admin";

  const buildActivityParams = (page = currentPage) => {
    const params = {
      page,
      page_size: pageSize,
    };

    const normalizedSearch = searchText.trim();

    if (normalizedSearch) {
      params.search = normalizedSearch;
    }

    if (actionFilter) {
      params.action = actionFilter;
    }

    if (userFilter) {
      params.user = userFilter;
    }

    if (modelFilter) {
      params.model = modelFilter;
    }

    return params;
  };

  const loadActivity = async (page = currentPage) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get("activity/", {
        params: buildActivityParams(page),
      });

      setLogs(response.data.logs || []);
      setUsers(response.data.users || []);
      setModelOptions(response.data.model_options || []);

      setPeriodDays(response.data.period_days || 30);

      setTotalLogs(response.data.total_count || 0);
      setFilteredCount(response.data.count || 0);

      setTotalPages(response.data.total_pages || 1);

      if (response.data.page && response.data.page !== currentPage) {
        setCurrentPage(response.data.page);
      }
    } catch (err) {
      console.error("Błąd pobierania logów aktywności:", err);

      if (err.response?.status === 403) {
        setError("Nie masz uprawnień do wyświetlania logów aktywności.");
      } else {
        setError("Nie udało się pobrać logów aktywności.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewActivity) {
      setLoading(false);

      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        loadActivity(currentPage);
      },
      searchText.trim() ? 300 : 0,
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    canViewActivity,
    currentPage,
    searchText,
    actionFilter,
    userFilter,
    modelFilter,
  ]);

  const formatDateTime = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const looksLikeDate = (value) => {
    if (typeof value !== "string") {
      return false;
    }

    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) ||
      /^\d{4}-\d{2}-\d{2}T/.test(value) ||
      /^\d{4}-\d{2}-\d{2} /.test(value)
    );
  };

  const formatPossibleDate = (value) => {
    if (!looksLikeDate(value)) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const hasTime = String(value).includes("T") || String(value).includes(" ");

    if (hasTime) {
      return date.toLocaleString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return date.toLocaleDateString("pl-PL");
  };

  const formatArrayString = (value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed.join(", ");
      }
    } catch {
      return null;
    }

    return null;
  };

  const formatValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "None" ||
      value === "null"
    ) {
      return "brak";
    }

    if (value === true || value === "True" || value === "true") {
      return "Tak";
    }

    if (value === false || value === "False" || value === "false") {
      return "Nie";
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(", ") : "brak";
    }

    const arrayValue = formatArrayString(value);

    if (arrayValue !== null) {
      return arrayValue;
    }

    const dateValue = formatPossibleDate(value);

    if (dateValue !== null) {
      return dateValue;
    }

    const normalizedValue = String(value).toLowerCase();

    if (Object.prototype.hasOwnProperty.call(VALUE_LABELS, normalizedValue)) {
      return VALUE_LABELS[normalizedValue];
    }

    return String(value);
  };

  const formatFieldName = (field) => {
    if (FIELD_LABELS[field]) {
      return FIELD_LABELS[field];
    }

    return field
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase());
  };

  const isTechnicalRelationValue = (value) => {
    if (value === null || value === undefined) {
      return false;
    }

    const text = String(value).toLowerCase();

    return text.includes(".none") || text.includes("relatedmanager");
  };

  const getVisibleChanges = (log) => {
    if (!Array.isArray(log.changes)) {
      return [];
    }

    return log.changes.filter((change) => {
      if (HIDDEN_FIELDS.has(change.field)) {
        return false;
      }

      if (
        isTechnicalRelationValue(change.old) ||
        isTechnicalRelationValue(change.new)
      ) {
        return false;
      }

      return true;
    });
  };

  const getActionClass = (action) => {
    if (action === 0 || action === "0") {
      return "activity-action-create";
    }

    if (action === 1 || action === "1") {
      return "activity-action-update";
    }

    if (action === 2 || action === "2") {
      return "activity-action-delete";
    }

    return "activity-action-other";
  };

  const getObjectName = (log) => {
    if (log.object_repr && log.object_repr !== "None") {
      return log.object_repr;
    }

    if (log.object_id) {
      return `ID: ${log.object_id}`;
    }

    return "—";
  };

  const handleSearchChange = (event) => {
    setCurrentPage(1);

    setSearchText(event.target.value);
  };

  const handleActionFilterChange = (event) => {
    setCurrentPage(1);

    setActionFilter(event.target.value);
  };

  const handleUserFilterChange = (event) => {
    setCurrentPage(1);

    setUserFilter(event.target.value);
  };

  const handleModelFilterChange = (event) => {
    setCurrentPage(1);

    setModelFilter(event.target.value);
  };

  const clearFilters = () => {
    setCurrentPage(1);

    setSearchText("");
    setActionFilter("");
    setUserFilter("");
    setModelFilter("");
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((page) => page - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((page) => page + 1);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="activity-page">
          <div className="activity-header">
            <div>
              <h1>Log aktywności</h1>

              <p>
                Historia zmian wykonanych przez użytkowników organizacji z
                ostatnich {periodDays} dni.
              </p>
            </div>

            <button
              className="activity-refresh-button"
              onClick={() => loadActivity(currentPage)}
              disabled={loading}
            >
              {loading ? "Odświeżanie..." : "Odśwież"}
            </button>
          </div>

          <div className="activity-summary">
            <div className="activity-summary-card">
              <span>Wszystkie zdarzenia</span>

              <strong>{totalLogs}</strong>
            </div>

            <div className="activity-summary-card">
              <span>Po filtrach</span>

              <strong>{filteredCount}</strong>
            </div>

            <div className="activity-summary-card">
              <span>Okres</span>

              <strong>{periodDays} dni</strong>
            </div>
          </div>

          <div className="activity-filters">
            <div className="activity-search-container">
              <label>Szukaj</label>

              <input
                type="text"
                placeholder="Użytkownik, obiekt, typ..."
                value={searchText}
                onChange={handleSearchChange}
              />
            </div>

            <div className="activity-filter-container">
              <label>Akcja</label>

              <select value={actionFilter} onChange={handleActionFilterChange}>
                <option value="">Wszystkie akcje</option>

                <option value="0">Dodano</option>

                <option value="1">Zmieniono</option>

                <option value="2">Usunięto</option>

                <option value="3">Wyświetlono</option>
              </select>
            </div>

            <div className="activity-filter-container">
              <label>Użytkownik</label>

              <select value={userFilter} onChange={handleUserFilterChange}>
                <option value="">Wszyscy użytkownicy</option>

                {users.map((activityUser) => (
                  <option key={activityUser.id} value={activityUser.id}>
                    {activityUser.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="activity-filter-container">
              <label>Typ obiektu</label>

              <select value={modelFilter} onChange={handleModelFilterChange}>
                <option value="">Wszystkie obiekty</option>

                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="activity-clear-button" onClick={clearFilters}>
              Wyczyść filtry
            </button>
          </div>

          {error && <div className="activity-error">{error}</div>}

          {loading && (
            <div className="activity-loading">
              Ładowanie logów aktywności...
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="activity-results-info">
                Na tej stronie: <strong>{logs.length}</strong> • Po filtrach:{" "}
                <strong>{filteredCount}</strong> • Wszystkich:{" "}
                <strong>{totalLogs}</strong>
              </div>

              <div className="activity-list">
                {logs.map((log) => {
                  const visibleChanges = getVisibleChanges(log);

                  return (
                    <div key={log.id} className="activity-log-item">
                      <div className="activity-log-top">
                        <div className="activity-log-user">
                          <div className="activity-user-avatar">
                            {(log.actor?.name?.[0] || "S").toUpperCase()}
                          </div>

                          <div>
                            <strong>{log.actor?.name || "System"}</strong>

                            <span>{formatDateTime(log.timestamp)}</span>
                          </div>
                        </div>

                        <span
                          className={`activity-action-badge ${getActionClass(
                            log.action,
                          )}`}
                        >
                          {log.action_label}
                        </span>
                      </div>

                      <div className="activity-object">
                        <span className="activity-object-type">
                          {log.model_label}
                        </span>

                        <strong>{getObjectName(log)}</strong>
                      </div>

                      {visibleChanges.length > 0 && (
                        <div className="activity-changes">
                          {visibleChanges.map((change, index) => (
                            <div
                              key={`${log.id}-${change.field}-${index}`}
                              className="activity-change-row"
                            >
                              <span className="activity-change-field">
                                {formatFieldName(change.field)}
                              </span>

                              {String(log.action) === "1" ? (
                                <div className="activity-change-values">
                                  <span className="activity-old-value">
                                    {formatValue(change.old)}
                                  </span>

                                  <span className="activity-arrow">→</span>

                                  <span className="activity-new-value">
                                    {formatValue(change.new)}
                                  </span>
                                </div>
                              ) : (
                                <span className="activity-single-value">
                                  {formatValue(change.new)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {logs.length === 0 && (
                  <div className="activity-empty">
                    <h3>Brak logów</h3>

                    <p>
                      Nie znaleziono zdarzeń spełniających wybrane kryteria.
                    </p>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="activity-pagination">
                  <button
                    type="button"
                    className="activity-pagination-button"
                    onClick={handlePreviousPage}
                    disabled={currentPage <= 1 || loading}
                  >
                    ← Poprzednia
                  </button>

                  <span className="activity-pagination-info">
                    Strona {currentPage} z {totalPages}
                  </span>

                  <button
                    type="button"
                    className="activity-pagination-button"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages || loading}
                  >
                    Następna →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default ActivityLogPage;
