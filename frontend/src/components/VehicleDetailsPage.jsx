import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
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
    const loadVehicle = async () => {
      try {
        const vehicleResponse = await apiClient.get(`vehicles/${id}/`);

        const vehicleData = vehicleResponse.data;

        setVehicle(vehicleData);

        if (vehicleData.driver) {
          try {
            const driverResponse = await apiClient.get(
              `drivers/${vehicleData.driver}/`,
            );

            setDriver(driverResponse.data);
          } catch (driverError) {
            console.error("Błąd pobierania kierowcy:", driverError);
          }
        } else {
          setDriver(null);
        }

        try {
          const serviceResponse = await apiClient.get(
            `service-records/?vehicle=${id}`,
          );

          const serviceData = Array.isArray(serviceResponse.data)
            ? serviceResponse.data
            : serviceResponse.data.results || [];

          setServiceRecords(serviceData);
        } catch (serviceError) {
          console.error("Błąd pobierania historii serwisowej:", serviceError);
        }

        try {
          const documentsResponse = await apiClient.get(
            `vehicle-documents/?vehicle=${id}`,
          );

          const documentsData = Array.isArray(documentsResponse.data)
            ? documentsResponse.data
            : documentsResponse.data.results || [];

          setDocuments(documentsData);
        } catch (documentsError) {
          console.error("Błąd pobierania dokumentów:", documentsError);
        }

        try {
          const assignmentsResponse = await apiClient.get(
            "driver-assignments/",
          );

          const assignmentsData = Array.isArray(assignmentsResponse.data)
            ? assignmentsResponse.data
            : assignmentsResponse.data.results || [];

          const vehicleAssignments = assignmentsData.filter(
            (assignment) => Number(assignment.vehicle) === Number(id),
          );

          setDriverAssignments(vehicleAssignments);
        } catch (assignmentsError) {
          console.error(
            "Błąd pobierania historii przypisań:",
            assignmentsError,
          );
        }
      } catch (err) {
        console.error("Błąd pobierania pojazdu:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych pojazdu.");
      } finally {
        setLoading(false);
      }
    };

    loadVehicle();
  }, [id]);

  const getStatusName = (status) => {
    if (status === "active") {
      return "Aktywny";
    }

    if (status === "maintenance") {
      return "W serwisie";
    }

    if (status === "inactive") {
      return "Nieaktywny";
    }

    return status;
  };

  const getVehicleTypeName = (type) => {
    if (type === "passenger") {
      return "Samochód osobowy";
    }

    if (type === "van") {
      return "Bus / samochód dostawczy";
    }

    if (type === "truck") {
      return "Samochód ciężarowy";
    }

    if (type === "special") {
      return "Pojazd specjalny";
    }

    if (type === "other") {
      return "Inny";
    }

    return type;
  };

  const getFuelTypeName = (fuelType) => {
    if (fuelType === "petrol") {
      return "Benzyna";
    }

    if (fuelType === "diesel") {
      return "Diesel";
    }

    if (fuelType === "lpg") {
      return "LPG";
    }

    if (fuelType === "hybrid") {
      return "Hybryda";
    }

    if (fuelType === "electric") {
      return "Elektryczny";
    }

    return "Nie podano";
  };

  const getDocumentTypeName = (type) => {
    if (type === "oc") {
      return "OC";
    }

    if (type === "ac") {
      return "AC";
    }

    if (type === "registration") {
      return "Dowód rejestracyjny";
    }

    if (type === "inspection") {
      return "Przegląd techniczny";
    }

    if (type === "leasing") {
      return "Umowa leasingowa";
    }

    if (type === "warranty") {
      return "Gwarancja";
    }

    if (type === "assistance") {
      return "Assistance";
    }

    if (type === "other") {
      return "Inny";
    }

    return type;
  };

  const formatMileage = (mileage) => {
    if (mileage === null || mileage === undefined) {
      return "Nie podano";
    }

    return `${Number(mileage).toLocaleString("pl-PL")} km`;
  };

  const formatDate = (date) => {
    if (!date) {
      return "Nie podano";
    }

    return new Date(date).toLocaleDateString("pl-PL");
  };

  const formatCost = (cost) => {
    return `${Number(cost).toLocaleString("pl-PL", {
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

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const difference = expiryDate - today;

    const daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24));

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
      return `${driver.first_name} ${driver.last_name}`;
    }

    if (vehicle?.driver_name) {
      return vehicle.driver_name;
    }

    return "Brak przypisanego kierowcy";
  };

  const handleDeleteServiceRecord = async (record) => {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć wpis "${record.title}"?`,
    );

    if (!confirmed) {
      return;
    }

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

    if (!confirmed) {
      return;
    }

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

  const handleExportPdf = async () => {
    if (!vehicle) {
      return;
    }

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

      const contentDisposition = response.headers["content-disposition"];

      let filename = `flotivo-karta-${vehicle.registration_number}.pdf`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);

        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.href = downloadUrl;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Błąd eksportu karty pojazdu:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

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
              className="vehicle-details-back"
              onClick={() => navigate("/vehicles")}
            >
              ← Wróć do pojazdów
            </button>

            <h1>
              {vehicle.brand} {vehicle.model}
            </h1>

            <div className="vehicle-details-subtitle">
              <span>{vehicle.registration_number}</span>

              <span
                className={`vehicle-status vehicle-status-${vehicle.status}`}
              >
                {getStatusName(vehicle.status)}
              </span>
            </div>
          </div>

          <div className="vehicle-details-header-actions">
            <button
              className="vehicle-details-export"
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? "Generowanie..." : "Eksportuj kartę PDF"}
            </button>

            {canEditVehicle && (
              <button
                className="vehicle-details-edit"
                onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
              >
                Edytuj pojazd
              </button>
            )}
          </div>
        </div>

        {actionError && <p className="vehicle-details-error">{actionError}</p>}

        <div className="vehicle-details-card">
          <h2>Dane pojazdu</h2>

          <div className="vehicle-details-grid">
            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Marka</span>

              <span className="vehicle-detail-value">{vehicle.brand}</span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Model</span>

              <span className="vehicle-detail-value">{vehicle.model}</span>
            </div>

            <div className="vehicle-detail">
              <span className="vehicle-detail-label">Numer rejestracyjny</span>

              <span className="vehicle-detail-value">
                {vehicle.registration_number}
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

              <span className="vehicle-detail-value">{vehicle.year}</span>
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
                        {assignment.driver_display_name}
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
                      {record.title}
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

                      <strong>
                        {document.cost !== null
                          ? formatCost(document.cost)
                          : "Brak kosztu"}
                      </strong>
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
