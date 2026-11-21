import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./VehicleDetailsPage.css";

function VehicleDetailsPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEditCompany } = useAuth();

  const [vehicle, setVehicle] = useState(null);
  const [driver, setDriver] = useState(null);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [driverAssignments, setDriverAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    let active = true;

    const loadVehicle = async () => {
      try {
        setLoading(true);
        setError(null);

        const vehicleResponse = await apiClient.get(`vehicles/${id}/`);
        const vehicleData = vehicleResponse.data;

        if (!active) return;

        setVehicle(vehicleData);

        const requests = [
          fetchAllPages(apiClient, "service-records/", { vehicle: id }),
          fetchAllPages(apiClient, "vehicle-documents/", { vehicle: id }),
          fetchAllPages(apiClient, "driver-assignments/", { vehicle: id }),
        ];

        if (vehicleData.driver) {
          requests.push(apiClient.get(`drivers/${vehicleData.driver}/`));
        }

        const results = await Promise.allSettled(requests);

        if (!active) return;

        if (results[0].status === "fulfilled") {
          setServiceRecords(
            Array.isArray(results[0].value) ? results[0].value : [],
          );
        } else {
          console.error(
            "Błąd pobierania historii serwisowej:",
            results[0].reason,
          );
          setServiceRecords([]);
        }

        if (results[1].status === "fulfilled") {
          setDocuments(Array.isArray(results[1].value) ? results[1].value : []);
        } else {
          console.error("Błąd pobierania dokumentów:", results[1].reason);
          setDocuments([]);
        }

        if (results[2].status === "fulfilled") {
          setDriverAssignments(
            Array.isArray(results[2].value) ? results[2].value : [],
          );
        } else {
          console.error(
            "Błąd pobierania historii przypisań:",
            results[2].reason,
          );
          setDriverAssignments([]);
        }

        if (vehicleData.driver && results[3]) {
          if (results[3].status === "fulfilled") {
            setDriver(results[3].value.data);
          } else {
            console.error("Błąd pobierania kierowcy:", results[3].reason);
            setDriver(null);
          }
        } else {
          setDriver(null);
        }
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania pojazdu:", err);
        setVehicle(null);

        if (err.response?.status === 404) {
          setError("Nie znaleziono pojazdu.");
        } else if (err.response?.status === 403) {
          setError("Nie masz uprawnień do wyświetlenia tego pojazdu.");
        } else {
          setError("Nie udało się pobrać danych pojazdu.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadVehicle();

    return () => {
      active = false;
    };
  }, [id]);

  const getStatusName = (status) => {
    if (status === "active") return "Aktywny";
    if (status === "maintenance") return "W serwisie";
    if (status === "inactive") return "Nieaktywny";
    return status || "Nie podano";
  };

  const getStatusClass = (status) => {
    if (["active", "maintenance", "inactive"].includes(status)) {
      return `vehicle-status vehicle-status-${status}`;
    }

    return "vehicle-status vehicle-status-unknown";
  };

  const getVehicleTypeName = (type) => {
    if (type === "passenger") return "Samochód osobowy";
    if (type === "van") return "Bus / samochód dostawczy";
    if (type === "truck") return "Samochód ciężarowy";
    if (type === "special") return "Pojazd specjalny";
    if (type === "other") return "Inny";
    return type || "Nie podano";
  };

  const getFuelTypeName = (fuelType) => {
    if (fuelType === "petrol") return "Benzyna";
    if (fuelType === "diesel") return "Diesel";
    if (fuelType === "lpg") return "LPG";
    if (fuelType === "hybrid") return "Hybryda";
    if (fuelType === "electric") return "Elektryczny";
    return "Nie podano";
  };

  const getDocumentTypeName = (type) => {
    if (type === "oc") return "OC";
    if (type === "ac") return "AC";
    if (type === "registration") return "Dowód rejestracyjny";
    if (type === "inspection") return "Przegląd techniczny";
    if (type === "leasing") return "Umowa leasingowa";
    if (type === "warranty") return "Gwarancja";
    if (type === "assistance") return "Assistance";
    if (type === "other") return "Inny";
    return type || "Nie podano";
  };

  const formatMileage = (mileage) => {
    if (mileage === null || mileage === undefined || mileage === "") {
      return "Nie podano";
    }

    const value = Number(mileage);

    if (!Number.isFinite(value)) {
      return "Nie podano";
    }

    return `${value.toLocaleString("pl-PL")} km`;
  };

  const formatDate = (date) => {
    if (!date) return "Nie podano";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Nie podano";
    }

    return parsedDate.toLocaleDateString("pl-PL");
  };

  const formatCost = (cost) => {
    if (cost === null || cost === undefined || cost === "") {
      return "Brak kosztu";
    }

    const value = Number(cost);

    if (!Number.isFinite(value)) {
      return "Brak kosztu";
    }

    return `${value.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} zł`;
  };

  const getExpiryStatus = (date) => {
    if (!date) {
      return {
        text: "Brak terminu",
        className: "expiry-status-none",
      };
    }

    const today = new Date();
    const expiryDate = new Date(date);

    if (Number.isNaN(expiryDate.getTime())) {
      return {
        text: "Brak terminu",
        className: "expiry-status-none",
      };
    }

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const daysLeft = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft < 0) {
      return {
        text: "Po terminie",
        className: "expiry-status-expired",
      };
    }

    if (daysLeft <= 30) {
      return {
        text: daysLeft === 0 ? "Wygasa dzisiaj" : `Wygasa za ${daysLeft} dni`,
        className: "expiry-status-warning",
      };
    }

    return {
      text: "Ważne",
      className: "expiry-status-valid",
    };
  };

  const getDriverName = () => {
    if (driver) {
      const name =
        `${driver.first_name || ""} ${driver.last_name || ""}`.trim();
      return name || "Nie podano";
    }

    if (vehicle?.driver_name) {
      return vehicle.driver_name;
    }

    return "Brak przypisanego kierowcy";
  };

  const handleDeleteServiceRecord = async (record) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć wpis "${record.title || "Bez nazwy"}"?`,
    );

    if (!confirmed) return;

    try {
      setActionError("");
      await apiClient.delete(`service-records/${record.id}/`);

      setServiceRecords((currentRecords) =>
        currentRecords.filter(
          (currentRecord) => currentRecord.id !== record.id,
        ),
      );
    } catch (err) {
      console.error("Błąd usuwania wpisu serwisowego:", err);
      setActionError("Nie udało się usunąć wpisu serwisowego.");
    }
  };

  const handleDeleteDocument = async (document) => {
    const documentName = getDocumentTypeName(document.document_type);

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć dokument "${documentName}"?`,
    );

    if (!confirmed) return;

    try {
      setActionError("");
      await apiClient.delete(`vehicle-documents/${document.id}/`);

      setDocuments((currentDocuments) =>
        currentDocuments.filter(
          (currentDocument) => currentDocument.id !== document.id,
        ),
      );
    } catch (err) {
      console.error("Błąd usuwania dokumentu:", err);
      setActionError("Nie udało się usunąć dokumentu.");
    }
  };

  const getPdfFilename = (response) => {
    const contentDisposition = response.headers?.["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i,
      );

      if (filenameMatch?.[1]) {
        try {
          return decodeURIComponent(filenameMatch[1].replace(/"/g, ""));
        } catch {
          return filenameMatch[1].replace(/"/g, "");
        }
      }
    }

    const registration =
      vehicle?.registration_number || vehicle?.id || "pojazd";

    return `flotivo-karta-${registration}.pdf`;
  };

  const handleExportPdf = async () => {
    if (!vehicle || exportingPdf) return;

    try {
      setExportingPdf(true);
      setActionError("");

      const response = await apiClient.get(`vehicles/${id}/card-pdf/`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = getPdfFilename(response);

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Błąd eksportu karty pojazdu:", err);
      setActionError("Nie udało się wygenerować karty pojazdu.");
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie danych pojazdu...</p>
        </main>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p className="vehicle-details-error">
            {error || "Nie znaleziono pojazdu."}
          </p>
          <button
            type="button"
            className="vehicle-details-back"
            onClick={() => navigate("/vehicles")}
          >
            ← Wróć do pojazdów
          </button>
        </main>
      </div>
    );
  }

  const canEditVehicle = canEditCompany(vehicle.company);
  const inspectionStatus = getExpiryStatus(vehicle.inspection_expiry_date);
  const insuranceStatus = getExpiryStatus(vehicle.insurance_expiry_date);

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />
      <main className="dashboard-content">
        <div className="vehicle-details-header">
          <div>
            <button
              type="button"
              className="vehicle-details-back"
              onClick={() => navigate("/vehicles")}
            >
              ← Wróć do pojazdów
            </button>
            <h1>
              {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") ||
                "Pojazd"}
            </h1>
            <div className="vehicle-details-subtitle">
              <span>{vehicle.registration_number || "Brak rejestracji"}</span>
              <span className={getStatusClass(vehicle.status)}>
                {getStatusName(vehicle.status)}
              </span>
            </div>
          </div>
          <div className="vehicle-details-header-actions">
            <button
              type="button"
              className="vehicle-details-export"
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? "Generowanie..." : "Eksportuj kartę PDF"}
            </button>
            {canEditVehicle && (
              <button
                type="button"
                className="vehicle-details-edit"
                onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
              >
                Edytuj pojazd
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <p className="vehicle-details-error" role="alert">
            {actionError}
          </p>
        )}

        <div className="vehicle-details-card">
          <h2>Dane pojazdu</h2>
          <div className="vehicle-details-grid">
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Marka</span>
              <span className="vehicle-detail-value">
                {vehicle.brand || "Nie podano"}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Model</span>
              <span className="vehicle-detail-value">
                {vehicle.model || "Nie podano"}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Numer rejestracyjny</span>
              <span className="vehicle-detail-value">
                {vehicle.registration_number || "Nie podano"}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">VIN</span>
              <span className="vehicle-detail-value">
                {vehicle.vin || "Nie podano"}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Rok produkcji</span>
              <span className="vehicle-detail-value">
                {vehicle.year || "Nie podano"}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Typ pojazdu</span>
              <span className="vehicle-detail-value">
                {getVehicleTypeName(vehicle.vehicle_type)}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Rodzaj paliwa</span>
              <span className="vehicle-detail-value">
                {getFuelTypeName(vehicle.fuel_type)}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Przebieg</span>
              <span className="vehicle-detail-value">
                {formatMileage(vehicle.mileage)}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Status</span>
              <span className="vehicle-detail-value">
                {getStatusName(vehicle.status)}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Spółka</span>
              <span className="vehicle-detail-value">
                {vehicle.company_name || "Bez przypisanej spółki"}
                {vehicle.company_name &&
                  vehicle.company_is_active === false && (
                    <span className="vehicle-company-inactive">Nieaktywna</span>
                  )}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Oddział</span>
              <span className="vehicle-detail-value">
                {vehicle.branch || "Nie podano"}
              </span>
            </div>
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Kierowca</span>
              {driver ? (
                <button
                  type="button"
                  className="vehicle-driver-link"
                  onClick={() => navigate(`/drivers/${driver.id}`)}
                >
                  {getDriverName()}
                </button>
              ) : (
                <span className="vehicle-detail-value">{getDriverName()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="vehicle-assignment-card">
          <div className="vehicle-assignment-header">
            <div>
              <h2>Historia przypisań kierowców</h2>
              <p>Historia kierowców przypisanych do tego pojazdu.</p>
            </div>
          </div>
          {driverAssignments.length > 0 ? (
            <div className="vehicle-assignment-list">
              {driverAssignments.map((assignment) => (
                <div className="vehicle-assignment-item" key={assignment.id}>
                  <div className="vehicle-assignment-main">
                    <div className="vehicle-assignment-driver">
                      <span className="vehicle-assignment-name">
                        {assignment.driver_display_name || "Nie podano"}
                      </span>
                      {assignment.is_active && (
                        <span className="vehicle-assignment-active">
                          Aktualne
                        </span>
                      )}
                    </div>
                    {assignment.notes && (
                      <span className="vehicle-assignment-notes">
                        {assignment.notes}
                      </span>
                    )}
                  </div>
                  <div className="vehicle-assignment-dates">
                    <div>
                      <span className="vehicle-assignment-date-label">Od</span>
                      <strong>{formatDate(assignment.start_date)}</strong>
                    </div>
                    <span className="vehicle-assignment-arrow">→</span>
                    <div>
                      <span className="vehicle-assignment-date-label">Do</span>
                      <strong>
                        {assignment.end_date
                          ? formatDate(assignment.end_date)
                          : "Obecnie"}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="vehicle-service-empty">
              Brak historii przypisań kierowców.
            </div>
          )}
        </div>

        <div className="vehicle-expiry-card">
          <h2>Terminy</h2>
          <div className="vehicle-expiry-grid">
            <div className="vehicle-expiry-item">
              <span className="vehicle-detail-label">Przegląd techniczny</span>
              <span className="vehicle-expiry-date">
                {formatDate(vehicle.inspection_expiry_date)}
              </span>
              <span className={`expiry-status ${inspectionStatus.className}`}>
                {inspectionStatus.text}
              </span>
            </div>
            <div className="vehicle-expiry-item">
              <span className="vehicle-detail-label">Polisa OC</span>
              <span className="vehicle-expiry-date">
                {formatDate(vehicle.insurance_expiry_date)}
              </span>
              <span className={`expiry-status ${insuranceStatus.className}`}>
                {insuranceStatus.text}
              </span>
            </div>
          </div>
        </div>

        <div className="vehicle-service-card">
          <div className="vehicle-service-header">
            <div>
              <h2>Historia napraw</h2>
              <p>Historia serwisów i napraw tego pojazdu.</p>
            </div>
            {canEditVehicle && (
              <button
                type="button"
                className="vehicle-service-add"
                onClick={() =>
                  navigate(`/service-history/add?vehicle=${vehicle.id}`)
                }
              >
                + Dodaj wpis
              </button>
            )}
          </div>
          {serviceRecords.length > 0 ? (
            <div className="vehicle-service-list">
              {serviceRecords.map((record) => (
                <div className="vehicle-service-item" key={record.id}>
                  <div className="vehicle-service-main">
                    <span className="vehicle-service-title">
                      {record.title || "Bez nazwy"}
                    </span>
                    <span className="vehicle-service-description">
                      {record.description || "Brak dodatkowego opisu"}
                    </span>
                  </div>
                  <div className="vehicle-service-data">
                    <span>{formatDate(record.service_date)}</span>
                    <span>{formatMileage(record.mileage)}</span>
                    <strong>{formatCost(record.cost)}</strong>
                  </div>
                  {canEditVehicle && (
                    <div className="vehicle-service-actions">
                      <button
                        type="button"
                        className="vehicle-service-edit"
                        onClick={() =>
                          navigate(`/service-history/${record.id}/edit`)
                        }
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        className="vehicle-service-delete"
                        onClick={() => handleDeleteServiceRecord(record)}
                      >
                        Usuń
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="vehicle-service-empty">
              Brak wpisów w historii napraw.
            </div>
          )}
        </div>

        <div className="vehicle-service-card">
          <div className="vehicle-service-header">
            <div>
              <h2>Dokumenty pojazdu</h2>
              <p>Dokumenty i polisy przypisane do tego pojazdu.</p>
            </div>
            {canEditVehicle && (
              <button
                type="button"
                className="vehicle-service-add"
                onClick={() =>
                  navigate(`/vehicle-documents/add?vehicle=${vehicle.id}`)
                }
              >
                + Dodaj dokument
              </button>
            )}
          </div>
          {documents.length > 0 ? (
            <div className="vehicle-service-list">
              {documents.map((document) => {
                const documentStatus = getExpiryStatus(document.expiry_date);

                return (
                  <div className="vehicle-service-item" key={document.id}>
                    <div className="vehicle-service-main">
                      <span className="vehicle-service-title">
                        {getDocumentTypeName(document.document_type)}
                      </span>
                      <span className="vehicle-service-description">
                        {document.document_number
                          ? `Numer: ${document.document_number}`
                          : "Brak numeru dokumentu"}
                      </span>
                      <span className="vehicle-service-description">
                        {document.notes || "Brak dodatkowych notatek"}
                      </span>
                      {document.file && (
                        <a
                          className="vehicle-document-file"
                          href={document.file}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Otwórz załącznik
                        </a>
                      )}
                    </div>
                    <div className="vehicle-service-data">
                      <span>Wystawiono: {formatDate(document.issue_date)}</span>
                      <span>Ważny do: {formatDate(document.expiry_date)}</span>
                      <span
                        className={`expiry-status ${documentStatus.className}`}
                      >
                        {documentStatus.text}
                      </span>
                      <strong>{formatCost(document.cost)}</strong>
                    </div>
                    {canEditVehicle && (
                      <div className="vehicle-service-actions">
                        <button
                          type="button"
                          className="vehicle-service-edit"
                          onClick={() =>
                            navigate(`/vehicle-documents/${document.id}/edit`)
                          }
                        >
                          Edytuj
                        </button>
                        <button
                          type="button"
                          className="vehicle-service-delete"
                          onClick={() => handleDeleteDocument(document)}
                        >
                          Usuń
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="vehicle-service-empty">
              Brak dokumentów dla tego pojazdu.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default VehicleDetailsPage;
