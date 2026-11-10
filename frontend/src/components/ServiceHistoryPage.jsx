import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./ServiceHistoryPage.css";

function ServiceHistoryPage({ onLogout }) {
  const navigate = useNavigate();

  const { user, canEditCompany } = useAuth();

  const [serviceRecords, setServiceRecords] = useState([]);
  const [totalServiceRecords, setTotalServiceRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const canAddServiceRecord =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  const loadServiceRecords = async (page = currentPage) => {
    try {
      const response = await apiClient.get("service-records/", {
        params: {
          page,
          page_size: pageSize,
        },
      });

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];

      const count = Array.isArray(response.data)
        ? response.data.length
        : response.data.count || 0;

      setServiceRecords(data);
      setTotalServiceRecords(count);
      setError(null);
    } catch (err) {
      console.error("Błąd pobierania historii napraw:", err);

      setError("Nie udało się pobrać historii napraw.");
    }
  };

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const vehiclesData = await fetchAllPages(apiClient, "vehicles/");

        setVehicles(vehiclesData);
      } catch (err) {
        console.error("Błąd pobierania pojazdów:", err);

        setError("Nie udało się pobrać listy pojazdów.");
      }
    };

    loadVehicles();
  }, []);

  useEffect(() => {
    loadServiceRecords(currentPage);
  }, [currentPage]);

  const getVehicle = (vehicleId) => {
    return vehicles.find((vehicle) => Number(vehicle.id) === Number(vehicleId));
  };

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  const formatMileage = (mileage) => {
    if (mileage === null || mileage === undefined) {
      return "Nie podano";
    }

    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  const formatCost = (cost) => {
    return `${Number(cost).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  };

  const handleDelete = async (record) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć wpis "${record.title}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(`service-records/${record.id}/`);

      if (serviceRecords.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1);
      } else {
        await loadServiceRecords(currentPage);
      }
    } catch (err) {
      console.error("Błąd usuwania wpisu:", err);

      setError("Nie udało się usunąć wpisu.");
    }
  };

  const getExportFilename = (response) => {
    const contentDisposition = response.headers["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);

      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1];
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    return `flotivo-historia-serwisowa-${today}.xlsx`;
  };

  const handleExport = async () => {
    if (totalServiceRecords === 0) {
      setError("Brak wpisów do wyeksportowania.");
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const response = await apiClient.post(
        "service-records/export/",
        {
          service_record_ids: [],
        },
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = getExportFilename(response);

      document.body.appendChild(link);

      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Błąd eksportu historii napraw:", err);

      setError("Nie udało się wyeksportować historii napraw.");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalServiceRecords / pageSize));

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="service-history-header">
          <div>
            <h1>Historia napraw</h1>

            <p>
              Wszystkie naprawy i serwisy pojazdów znajdujących się we flocie.
            </p>
          </div>

          <div className="service-history-header-actions">
            <button
              className="service-history-export"
              onClick={handleExport}
              disabled={exporting || totalServiceRecords === 0}
            >
              {exporting ? "Eksportowanie..." : "Eksportuj"}
            </button>

            {canAddServiceRecord && (
              <button
                className="service-history-add"
                onClick={() => navigate("/service-history/add")}
              >
                + Dodaj wpis
              </button>
            )}
          </div>
        </div>

        {error && <p className="service-history-error">{error}</p>}

        <div className="service-history-count">
          Na tej stronie: {serviceRecords.length} • Łącznie:{" "}
          {totalServiceRecords}
        </div>

        <div className="service-history-table">
          <div className="service-history-table-header">
            <span>Pojazd</span>
            <span>Naprawa</span>
            <span>Data</span>
            <span>Przebieg</span>
            <span>Koszt</span>
            <span>Akcje</span>
          </div>

          {serviceRecords.map((record) => {
            const vehicle = getVehicle(record.vehicle);

            const canEditRecord = vehicle && canEditCompany(vehicle.company);

            return (
              <div
                className="service-history-row"
                key={record.id}
                onClick={() => navigate(`/vehicles/${record.vehicle}`)}
              >
                <div className="service-history-vehicle">
                  <span className="service-history-vehicle-name">
                    {vehicle
                      ? `${vehicle.brand} ${vehicle.model}`
                      : "Nieznany pojazd"}
                  </span>

                  <span className="service-history-registration">
                    {vehicle?.registration_number || ""}
                  </span>
                </div>

                <div className="service-history-repair">
                  <span className="service-history-title">{record.title}</span>

                  <span className="service-history-description">
                    {record.description || "Brak opisu"}
                  </span>
                </div>

                <span>{formatDate(record.service_date)}</span>

                <span>{formatMileage(record.mileage)}</span>

                <strong>{formatCost(record.cost)}</strong>

                <div className="service-history-actions">
                  {canEditRecord && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();

                          navigate(`/service-history/${record.id}/edit`);
                        }}
                      >
                        Edytuj
                      </button>

                      <button
                        type="button"
                        className="service-history-delete"
                        onClick={(event) => {
                          event.stopPropagation();

                          handleDelete(record);
                        }}
                      >
                        Usuń
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {serviceRecords.length === 0 && !error && (
            <div className="service-history-empty">
              Brak wpisów w historii napraw.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="service-history-pagination">
            <button
              type="button"
              className="service-history-pagination-button"
              onClick={() => setCurrentPage((page) => page - 1)}
              disabled={currentPage <= 1}
            >
              ← Poprzednia
            </button>

            <span className="service-history-pagination-info">
              Strona {currentPage} z {totalPages}
            </span>

            <button
              type="button"
              className="service-history-pagination-button"
              onClick={() => setCurrentPage((page) => page + 1)}
              disabled={currentPage >= totalPages}
            >
              Następna →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default ServiceHistoryPage;
