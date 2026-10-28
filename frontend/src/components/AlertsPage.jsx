import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AlertsPage.css";

function AlertsPage({ onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const canViewDriverAlerts = user?.role === "admin";

  const getDocumentTypeName = (type) => {
    if (type === "oc") return "Polisa OC";
    if (type === "ac") return "Polisa AC";
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
      return "Inny dokument";
    }

    return type;
  };

  const getExpiryStatus = (date) => {
    const today = new Date();
    const expiryDate = new Date(date);

    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const difference = expiryDate - today;

    const daysLeft = Math.ceil(difference / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return {
        text: "Po terminie",
        className: "alert-status-expired",
      };
    }

    if (daysLeft === 0) {
      return {
        text: "Wygasa dzisiaj",
        className: "alert-status-warning",
      };
    }

    return {
      text: `Wygasa za ${daysLeft} dni`,
      className: "alert-status-warning",
    };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("pl-PL");
  };

  const getResponseData = (response) => {
    if (Array.isArray(response.data)) {
      return response.data;
    }

    return response.data.results || [];
  };

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true);
        setError(null);

        const requests = [
          apiClient.get("vehicles/"),
          apiClient.get("vehicle-documents/"),
        ];

        if (canViewDriverAlerts) {
          requests.push(apiClient.get("drivers/"));
        }

        const responses = await Promise.all(requests);

        const vehicles = getResponseData(responses[0]);

        const documents = getResponseData(responses[1]);

        const drivers =
          canViewDriverAlerts && responses[2]
            ? getResponseData(responses[2])
            : [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const warningLimit = new Date(today);

        warningLimit.setDate(warningLimit.getDate() + 30);

        const generatedAlerts = [];

        vehicles.forEach((vehicle) => {
          if (vehicle.inspection_expiry_date) {
            const inspectionDate = new Date(vehicle.inspection_expiry_date);

            inspectionDate.setHours(0, 0, 0, 0);

            if (inspectionDate <= warningLimit) {
              generatedAlerts.push({
                id: `inspection-${vehicle.id}`,
                category: "vehicle",
                targetId: vehicle.id,
                name: `${vehicle.brand} ${vehicle.model}`,
                secondary: vehicle.registration_number,
                type: "Przegląd techniczny",
                date: vehicle.inspection_expiry_date,
                status: getExpiryStatus(vehicle.inspection_expiry_date),
              });
            }
          }

          if (vehicle.insurance_expiry_date) {
            const insuranceDate = new Date(vehicle.insurance_expiry_date);

            insuranceDate.setHours(0, 0, 0, 0);

            if (insuranceDate <= warningLimit) {
              generatedAlerts.push({
                id: `insurance-${vehicle.id}`,
                category: "vehicle",
                targetId: vehicle.id,
                name: `${vehicle.brand} ${vehicle.model}`,
                secondary: vehicle.registration_number,
                type: "Polisa OC",
                date: vehicle.insurance_expiry_date,
                status: getExpiryStatus(vehicle.insurance_expiry_date),
              });
            }
          }
        });

        documents.forEach((document) => {
          if (!document.expiry_date) {
            return;
          }

          if (
            document.document_type === "oc" ||
            document.document_type === "inspection"
          ) {
            return;
          }

          const expiryDate = new Date(document.expiry_date);

          expiryDate.setHours(0, 0, 0, 0);

          if (expiryDate > warningLimit) {
            return;
          }

          const vehicle = vehicles.find(
            (vehicleItem) =>
              Number(vehicleItem.id) === Number(document.vehicle),
          );

          if (!vehicle) {
            return;
          }

          generatedAlerts.push({
            id: `document-${document.id}`,
            category: "vehicle",
            targetId: vehicle.id,
            name: `${vehicle.brand} ${vehicle.model}`,
            secondary: vehicle.registration_number,
            type: getDocumentTypeName(document.document_type),
            date: document.expiry_date,
            status: getExpiryStatus(document.expiry_date),
          });
        });

        drivers.forEach((driver) => {
          if (driver.license_expiry_date) {
            const licenseDate = new Date(driver.license_expiry_date);

            licenseDate.setHours(0, 0, 0, 0);

            if (licenseDate <= warningLimit) {
              generatedAlerts.push({
                id: `driver-license-${driver.id}`,
                category: "driver",
                targetId: driver.id,
                name: `${driver.first_name} ${driver.last_name}`,
                secondary: "Kierowca",
                type: "Ważność prawa jazdy",
                date: driver.license_expiry_date,
                status: getExpiryStatus(driver.license_expiry_date),
              });
            }
          }

          if (driver.medical_exam_expiry_date) {
            const medicalDate = new Date(driver.medical_exam_expiry_date);

            medicalDate.setHours(0, 0, 0, 0);

            if (medicalDate <= warningLimit) {
              generatedAlerts.push({
                id: `medical-exam-${driver.id}`,
                category: "driver",
                targetId: driver.id,
                name: `${driver.first_name} ${driver.last_name}`,
                secondary: "Kierowca",
                type: "Badania lekarskie",
                date: driver.medical_exam_expiry_date,
                status: getExpiryStatus(driver.medical_exam_expiry_date),
              });
            }
          }
        });

        generatedAlerts.sort((a, b) => new Date(a.date) - new Date(b.date));

        setAlerts(generatedAlerts);
      } catch (err) {
        console.error("Błąd pobierania alertów:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać alertów.");
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, [canViewDriverAlerts]);

  const vehicleAlerts = alerts.filter((alert) => alert.category === "vehicle");

  const driverAlerts = alerts.filter((alert) => alert.category === "driver");

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "all") {
      return true;
    }

    if (filter === "vehicles") {
      return alert.category === "vehicle";
    }

    if (filter === "drivers") {
      return alert.category === "driver";
    }

    return true;
  });

  const handleAlertClick = (alert) => {
    if (alert.category === "driver") {
      navigate(`/drivers/${alert.targetId}`);

      return;
    }

    navigate(`/vehicles/${alert.targetId}`);
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="alerts-header">
          <div>
            <button
              className="alerts-back"
              onClick={() => navigate("/dashboard")}
            >
              ← Wróć do dashboardu
            </button>

            <h1>Wymagają uwagi</h1>

            <p>
              Terminy pojazdów i kierowców po terminie lub wygasające w ciągu 30
              dni.
            </p>
          </div>
        </div>

        {error && <p className="alerts-error">{error}</p>}

        <div className="alerts-toolbar">
          <div className="alerts-filters">
            <button
              type="button"
              className={
                filter === "all"
                  ? "alerts-filter alerts-filter-active"
                  : "alerts-filter"
              }
              onClick={() => setFilter("all")}
            >
              Wszystkie
              <span>{alerts.length}</span>
            </button>

            <button
              type="button"
              className={
                filter === "vehicles"
                  ? "alerts-filter alerts-filter-active"
                  : "alerts-filter"
              }
              onClick={() => setFilter("vehicles")}
            >
              Pojazdy
              <span>{vehicleAlerts.length}</span>
            </button>

            {canViewDriverAlerts && (
              <button
                type="button"
                className={
                  filter === "drivers"
                    ? "alerts-filter alerts-filter-active"
                    : "alerts-filter"
                }
                onClick={() => setFilter("drivers")}
              >
                Kierowcy
                <span>{driverAlerts.length}</span>
              </button>
            )}
          </div>

          <div className="alerts-count">
            Wyświetlono: {filteredAlerts.length}
          </div>
        </div>

        {loading ? (
          <div className="alerts-empty">Ładowanie alertów...</div>
        ) : (
          <div className="alerts-list">
            {filteredAlerts.map((alert) => (
              <button
                key={alert.id}
                className="alert-item"
                onClick={() => handleAlertClick(alert)}
              >
                <div className="alert-item-main">
                  <div className="alert-name-row">
                    <span className="alert-vehicle-name">{alert.name}</span>

                    <span
                      className={
                        alert.category === "driver"
                          ? "alert-category alert-category-driver"
                          : "alert-category alert-category-vehicle"
                      }
                    >
                      {alert.category === "driver" ? "Kierowca" : "Pojazd"}
                    </span>
                  </div>

                  <span className="alert-registration">{alert.secondary}</span>
                </div>

                <div className="alert-type">{alert.type}</div>

                <div className="alert-date">{formatDate(alert.date)}</div>

                <span className={`alert-status ${alert.status.className}`}>
                  {alert.status.text}
                </span>
              </button>
            ))}

            {filteredAlerts.length === 0 && !error && (
              <div className="alerts-empty">
                Brak terminów wymagających uwagi w wybranej kategorii.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default AlertsPage;
