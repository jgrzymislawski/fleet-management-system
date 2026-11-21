import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./AddVehicleDocumentPage.css";

const DOCUMENT_TYPES = [
  { value: "oc", label: "OC" },
  { value: "ac", label: "AC" },
  { value: "registration", label: "Dowód rejestracyjny" },
  { value: "inspection", label: "Przegląd techniczny" },
  { value: "leasing", label: "Umowa leasingowa" },
  { value: "warranty", label: "Gwarancja" },
  { value: "assistance", label: "Assistance" },
  { value: "other", label: "Inny" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

function AddVehicleDocumentPage({ onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canEditCompany } = useAuth();

  const vehicleFromUrl = searchParams.get("vehicle") || "";

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    vehicle: vehicleFromUrl,
    document_type: "",
    document_number: "",
    issue_date: "",
    expiry_date: "",
    cost: "",
    notes: "",
    file: null,
  });

  useEffect(() => {
    let active = true;

    const loadVehicles = async () => {
      try {
        setLoading(true);
        setError("");

        const vehiclesData = await fetchAllPages(apiClient, "vehicles/");

        if (!active) {
          return;
        }

        const editableVehicles = (
          Array.isArray(vehiclesData) ? vehiclesData : []
        ).filter((vehicle) => canEditCompany(vehicle.company));

        setVehicles(editableVehicles);

        if (vehicleFromUrl) {
          const selectedVehicle = editableVehicles.find(
            (vehicle) => Number(vehicle.id) === Number(vehicleFromUrl),
          );

          if (!selectedVehicle) {
            setError(
              "Nie masz uprawnień do dodawania dokumentów dla tego pojazdu.",
            );
          }
        }
      } catch (err) {
        if (!active) {
          return;
        }

        console.error("Błąd pobierania pojazdów:", err);
        setVehicles([]);
        setError("Nie udało się pobrać listy pojazdów.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadVehicles();

    return () => {
      active = false;
    };
  }, [vehicleFromUrl, canEditCompany]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    setError("");
  };

  const validateFile = (file) => {
    if (!file) {
      return "";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "Maksymalny rozmiar pliku to 10 MB.";
    }

    const fileName = file.name.toLowerCase();

    if (!ALLOWED_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
      return "Dozwolone formaty plików: PDF, JPG, JPEG, PNG.";
    }

    return "";
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    const fileError = validateFile(file);

    if (fileError) {
      event.target.value = "";

      setFormData((currentData) => ({
        ...currentData,
        file: null,
      }));

      setError(fileError);
      return;
    }

    setFormData((currentData) => ({
      ...currentData,
      file,
    }));

    setError("");
  };

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) {
      return "Nie udało się dodać dokumentu.";
    }

    if (typeof data === "string") {
      return data;
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    const fieldOrder = [
      "vehicle",
      "document_type",
      "document_number",
      "issue_date",
      "expiry_date",
      "cost",
      "notes",
      "file",
    ];

    for (const field of fieldOrder) {
      const value = data[field];

      if (Array.isArray(value) && value.length > 0) {
        return value[0];
      }

      if (typeof value === "string") {
        return value;
      }
    }

    const firstError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    return firstError?.[0] || "Nie udało się dodać dokumentu.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");

    if (!formData.vehicle) {
      setError("Wybierz pojazd.");
      return;
    }

    if (!formData.document_type) {
      setError("Wybierz typ dokumentu.");
      return;
    }

    if (
      formData.issue_date &&
      formData.expiry_date &&
      formData.issue_date > formData.expiry_date
    ) {
      setError("Data wystawienia nie może być późniejsza od daty ważności.");
      return;
    }

    const fileError = validateFile(formData.file);

    if (fileError) {
      setError(fileError);
      return;
    }

    const data = new FormData();

    data.append("vehicle", formData.vehicle);
    data.append("document_type", formData.document_type);
    data.append("document_number", formData.document_number.trim());
    data.append("notes", formData.notes.trim());

    if (formData.issue_date) {
      data.append("issue_date", formData.issue_date);
    }

    if (formData.expiry_date) {
      data.append("expiry_date", formData.expiry_date);
    }

    if (formData.cost !== "") {
      data.append("cost", formData.cost);
    }

    if (formData.file) {
      data.append("file", formData.file);
    }

    try {
      setSaving(true);

      await apiClient.post("vehicle-documents/", data);

      navigate(`/vehicles/${formData.vehicle}`);
    } catch (err) {
      console.error("Błąd dodawania dokumentu:", err);
      setError(getBackendError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (vehicleFromUrl) {
      navigate(`/vehicles/${vehicleFromUrl}`);
    } else {
      navigate("/vehicles");
    }
  };

  const selectedVehicle = vehicles.find(
    (vehicle) => Number(vehicle.id) === Number(formData.vehicle),
  );

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="document-form-header">
          <div>
            <button
              type="button"
              className="document-form-back"
              onClick={handleCancel}
            >
              ← Wróć
            </button>

            <h1>Dodaj dokument</h1>
            <p>Dodaj dokument przypisany do wybranego pojazdu.</p>
          </div>
        </div>

        <form className="document-form-card" onSubmit={handleSubmit}>
          {error && (
            <div className="document-form-error" role="alert">
              {error}
            </div>
          )}

          <div className="document-form-grid">
            <div className="document-form-group document-form-full">
              <label htmlFor="vehicle">Pojazd *</label>

              {vehicleFromUrl && selectedVehicle ? (
                <input
                  type="text"
                  value={`${selectedVehicle.brand || ""} ${
                    selectedVehicle.model || ""
                  } - ${
                    selectedVehicle.registration_number || "Brak rejestracji"
                  }`}
                  disabled
                />
              ) : (
                <select
                  id="vehicle"
                  name="vehicle"
                  value={formData.vehicle}
                  onChange={handleChange}
                  disabled={saving}
                  required
                >
                  <option value="">Wybierz pojazd</option>

                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {[vehicle.brand, vehicle.model]
                        .filter(Boolean)
                        .join(" ") || "Pojazd"}{" "}
                      - {vehicle.registration_number || "Brak rejestracji"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="document-form-group">
              <label htmlFor="document_type">Typ dokumentu *</label>

              <select
                id="document_type"
                name="document_type"
                value={formData.document_type}
                onChange={handleChange}
                disabled={saving}
                required
              >
                <option value="">Wybierz typ</option>

                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="document-form-group">
              <label htmlFor="document_number">Numer dokumentu</label>

              <input
                id="document_number"
                name="document_number"
                type="text"
                maxLength={100}
                value={formData.document_number}
                onChange={handleChange}
                placeholder="Np. POL/123456"
                disabled={saving}
              />
            </div>

            <div className="document-form-group">
              <label htmlFor="cost">Koszt</label>

              <input
                id="cost"
                name="cost"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={handleChange}
                placeholder="0.00"
                disabled={saving}
              />
            </div>

            <div className="document-form-group">
              <label htmlFor="issue_date">Data wystawienia</label>

              <input
                id="issue_date"
                name="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={handleChange}
                disabled={saving}
              />
            </div>

            <div className="document-form-group">
              <label htmlFor="expiry_date">Data ważności</label>

              <input
                id="expiry_date"
                name="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={handleChange}
                disabled={saving}
              />
            </div>

            <div className="document-form-group">
              <label htmlFor="file">Plik</label>

              <input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                disabled={saving}
              />

              <span className="document-form-file-info">
                Dozwolone formaty: PDF, JPG, JPEG, PNG. Maksymalny rozmiar
                pliku: 10 MB.
              </span>

              {formData.file && (
                <span className="document-form-selected-file">
                  Wybrano: {formData.file.name}
                </span>
              )}
            </div>

            <div className="document-form-group document-form-full document-form-notes">
              <label htmlFor="notes">Notatki</label>

              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="5"
                placeholder="Dodatkowe informacje o dokumencie..."
                disabled={saving}
              />
            </div>
          </div>

          <div className="document-form-actions">
            <button
              type="button"
              className="document-form-cancel"
              onClick={handleCancel}
              disabled={saving}
            >
              Anuluj
            </button>

            <button
              type="submit"
              className="document-form-save"
              disabled={saving || !formData.vehicle}
            >
              {saving ? "Zapisywanie..." : "Dodaj dokument"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default AddVehicleDocumentPage;
