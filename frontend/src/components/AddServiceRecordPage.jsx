import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./AddServiceRecordPage.css";

function AddServiceRecordPage({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, canEditCompany } = useAuth();

  const vehicleFromUrl = searchParams.get("vehicle") || "";

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [showVehicleResults, setShowVehicleResults] = useState(false);

  const vehicleSearchRef = useRef(null);

  const [formData, setFormData] = useState({
    vehicle: vehicleFromUrl,
    service_date: "",
    title: "",
    description: "",
    mileage: "",
    cost: "",
  });

  const canAddServiceRecord =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  useEffect(() => {
    let active = true;

    const loadVehicles = async () => {
      try {
        setLoadingVehicles(true);

        const vehiclesData = await fetchAllPages(apiClient, "vehicles/");

        if (!active) return;

        const editableVehicles = (
          Array.isArray(vehiclesData) ? vehiclesData : []
        ).filter((vehicle) => canEditCompany(vehicle.company));

        setVehicles(editableVehicles);

        if (vehicleFromUrl) {
          const selectedVehicle = editableVehicles.find(
            (vehicle) => Number(vehicle.id) === Number(vehicleFromUrl),
          );

          if (selectedVehicle) {
            setVehicleSearch(
              `${selectedVehicle.brand || ""} ${
                selectedVehicle.model || ""
              } - ${selectedVehicle.registration_number || "Brak rejestracji"}`,
            );
          } else {
            setError("Nie masz uprawnień do dodania wpisu dla tego pojazdu.");
          }
        }
      } catch (err) {
        if (!active) return;

        console.error("Błąd pobierania pojazdów:", err);
        setError("Nie udało się pobrać listy pojazdów.");
      } finally {
        if (active) {
          setLoadingVehicles(false);
        }
      }
    };

    if (canAddServiceRecord) {
      loadVehicles();
    } else {
      setLoadingVehicles(false);
    }

    return () => {
      active = false;
    };
  }, [vehicleFromUrl, canAddServiceRecord, canEditCompany]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        vehicleSearchRef.current &&
        !vehicleSearchRef.current.contains(event.target)
      ) {
        setShowVehicleResults(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowVehicleResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleVehicleSearchChange = (event) => {
    setVehicleSearch(event.target.value);
    setShowVehicleResults(true);

    setFormData((current) => ({
      ...current,
      vehicle: "",
    }));
  };

  const handleVehicleSelect = (vehicle) => {
    setFormData((current) => ({
      ...current,
      vehicle: String(vehicle.id),
    }));

    setVehicleSearch(
      `${vehicle.brand || ""} ${vehicle.model || ""} - ${
        vehicle.registration_number || "Brak rejestracji"
      }`,
    );

    setShowVehicleResults(false);
  };

  const normalizedVehicleSearch = vehicleSearch.toLowerCase().trim();

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!normalizedVehicleSearch) return true;

    const searchValue = [
      vehicle.brand,
      vehicle.model,
      vehicle.registration_number,
      vehicle.vin,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchValue.includes(normalizedVehicleSearch);
  });

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) return "Nie udało się dodać wpisu serwisowego.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;

    const firstError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    return firstError?.[0] || "Nie udało się dodać wpisu serwisowego.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError(null);

    if (!formData.vehicle) {
      setError("Wybierz pojazd.");
      return;
    }

    try {
      setSubmitting(true);

      await apiClient.post("service-records/", {
        vehicle: Number(formData.vehicle),
        service_date: formData.service_date,
        title: formData.title.trim(),
        description: formData.description.trim(),
        mileage: formData.mileage ? Number(formData.mileage) : null,
        cost: formData.cost || "0.00",
      });

      if (vehicleFromUrl) {
        navigate(`/vehicles/${vehicleFromUrl}`);
      } else {
        navigate("/service-history");
      }
    } catch (err) {
      console.error("Błąd dodawania wpisu serwisowego:", err);
      setError(getBackendError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (vehicleFromUrl) {
      navigate(`/vehicles/${vehicleFromUrl}`);
    } else {
      navigate("/service-history");
    }
  };

  if (!canAddServiceRecord) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Nie masz uprawnień do dodawania wpisów serwisowych.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="service-record-form-header">
          <button
            type="button"
            className="service-record-back"
            onClick={handleCancel}
          >
            ← Wróć
          </button>

          <h1>Dodaj wpis serwisowy</h1>
          <p>Dodaj naprawę lub serwis wykonany dla pojazdu.</p>
        </div>

        <form className="service-record-form" onSubmit={handleSubmit}>
          {error && (
            <p className="service-record-error" role="alert">
              {error}
            </p>
          )}

          <div className="service-record-field service-record-vehicle-field">
            <label htmlFor="vehicle-search">Pojazd *</label>

            <div
              className="service-record-vehicle-search"
              ref={vehicleSearchRef}
            >
              <input
                id="vehicle-search"
                type="text"
                value={vehicleSearch}
                onChange={handleVehicleSearchChange}
                onFocus={() => setShowVehicleResults(true)}
                placeholder={
                  loadingVehicles
                    ? "Ładowanie pojazdów..."
                    : "Wpisz markę, model lub numer rejestracyjny"
                }
                disabled={Boolean(vehicleFromUrl) || loadingVehicles}
                autoComplete="off"
                required
              />

              {showVehicleResults && !vehicleFromUrl && !loadingVehicles && (
                <div className="service-record-vehicle-results">
                  {filteredVehicles.length > 0 ? (
                    filteredVehicles.map((vehicle) => (
                      <button
                        type="button"
                        key={vehicle.id}
                        className="service-record-vehicle-option"
                        onClick={() => handleVehicleSelect(vehicle)}
                      >
                        <span>
                          {[vehicle.brand, vehicle.model]
                            .filter(Boolean)
                            .join(" ") || "Pojazd"}
                        </span>

                        <strong>
                          {vehicle.registration_number || "Brak rejestracji"}
                        </strong>
                      </button>
                    ))
                  ) : (
                    <div className="service-record-vehicle-empty">
                      Nie znaleziono pojazdu.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="service-record-grid">
            <div className="service-record-field">
              <label htmlFor="service_date">Data serwisu *</label>
              <input
                id="service_date"
                name="service_date"
                type="date"
                value={formData.service_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="service-record-field">
              <label htmlFor="title">Rodzaj naprawy / serwisu *</label>
              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                maxLength={255}
                placeholder="Np. Wymiana oleju"
                required
              />
            </div>

            <div className="service-record-field">
              <label htmlFor="mileage">Przebieg</label>
              <input
                id="mileage"
                name="mileage"
                type="number"
                min="0"
                step="1"
                value={formData.mileage}
                onChange={handleChange}
                placeholder="Np. 145000"
              />
            </div>

            <div className="service-record-field">
              <label htmlFor="cost">Koszt</label>
              <input
                id="cost"
                name="cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={handleChange}
                placeholder="Np. 350.00"
              />
            </div>
          </div>

          <div className="service-record-field service-record-description">
            <label htmlFor="description">Opis</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Dodatkowe informacje o wykonanej naprawie..."
              rows="5"
            />
          </div>

          <div className="service-record-actions">
            <button
              type="button"
              className="service-record-cancel"
              onClick={handleCancel}
              disabled={submitting}
            >
              Anuluj
            </button>

            <button
              type="submit"
              className="service-record-submit"
              disabled={submitting || loadingVehicles}
            >
              {submitting ? "Dodawanie..." : "Dodaj wpis"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default AddServiceRecordPage;
