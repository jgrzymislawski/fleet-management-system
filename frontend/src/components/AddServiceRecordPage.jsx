import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./AddServiceRecordPage.css";

function AddServiceRecordPage({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const vehicleFromUrl = searchParams.get("vehicle") || "";

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    apiClient
      .get("vehicles/")
      .then((response) => {
        setVehicles(response.data);

        if (vehicleFromUrl) {
          const selectedVehicle = response.data.find(
            (vehicle) => Number(vehicle.id) === Number(vehicleFromUrl),
          );

          if (selectedVehicle) {
            setVehicleSearch(
              `${selectedVehicle.brand} ${selectedVehicle.model} - ${selectedVehicle.registration_number}`,
            );
          }
        }
      })
      .catch((err) => {
        console.error("Błąd pobierania pojazdów:", err);
        setError("Nie udało się pobrać listy pojazdów.");
      });
  }, [vehicleFromUrl]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        vehicleSearchRef.current &&
        !vehicleSearchRef.current.contains(event.target)
      ) {
        setShowVehicleResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  };

  const handleVehicleSearchChange = (event) => {
    const value = event.target.value;

    setVehicleSearch(value);
    setShowVehicleResults(true);

    setFormData((currentFormData) => ({
      ...currentFormData,
      vehicle: "",
    }));
  };

  const handleVehicleSelect = (vehicle) => {
    setFormData((currentFormData) => ({
      ...currentFormData,
      vehicle: String(vehicle.id),
    }));

    setVehicleSearch(
      `${vehicle.brand} ${vehicle.model} - ${vehicle.registration_number}`,
    );

    setShowVehicleResults(false);
  };

  const normalizedVehicleSearch = vehicleSearch.toLowerCase().trim();

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!normalizedVehicleSearch) {
      return true;
    }

    const brand = vehicle.brand?.toLowerCase() || "";
    const model = vehicle.model?.toLowerCase() || "";
    const registration = vehicle.registration_number?.toLowerCase() || "";

    return (
      brand.includes(normalizedVehicleSearch) ||
      model.includes(normalizedVehicleSearch) ||
      registration.includes(normalizedVehicleSearch)
    );
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError(null);

    if (!formData.vehicle) {
      setError("Wybierz pojazd.");
      return;
    }

    try {
      const dataToSend = {
        vehicle: Number(formData.vehicle),
        service_date: formData.service_date,
        title: formData.title,
        description: formData.description,
        mileage: formData.mileage ? Number(formData.mileage) : null,
        cost: formData.cost || "0.00",
      };

      await apiClient.post("service-records/", dataToSend);

      if (vehicleFromUrl) {
        navigate(`/vehicles/${vehicleFromUrl}`);
      } else {
        navigate("/service-history");
      }
    } catch (err) {
      console.error("Błąd dodawania wpisu serwisowego:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się dodać wpisu serwisowego.");
    }
  };

  const handleCancel = () => {
    if (vehicleFromUrl) {
      navigate(`/vehicles/${vehicleFromUrl}`);
    } else {
      navigate("/service-history");
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="service-record-form-header">
          <div>
            <button className="service-record-back" onClick={handleCancel}>
              ← Wróć
            </button>

            <h1>Dodaj wpis serwisowy</h1>

            <p>Dodaj naprawę lub serwis wykonany dla pojazdu.</p>
          </div>
        </div>

        <form className="service-record-form" onSubmit={handleSubmit}>
          {error && <p className="service-record-error">{error}</p>}

          <div className="service-record-field">
            <label htmlFor="vehicle-search">Pojazd</label>

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
                placeholder="Wpisz markę, model lub numer rejestracyjny"
                disabled={vehicleFromUrl !== ""}
                autoComplete="off"
              />

              {showVehicleResults && vehicleFromUrl === "" && (
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
                          {vehicle.brand} {vehicle.model}
                        </span>

                        <strong>{vehicle.registration_number}</strong>
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
              <label htmlFor="service_date">Data serwisu</label>

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
              <label htmlFor="title">Rodzaj naprawy / serwisu</label>

              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
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

          <div className="service-record-field">
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
            >
              Anuluj
            </button>

            <button type="submit" className="service-record-submit">
              Dodaj wpis
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default AddServiceRecordPage;
