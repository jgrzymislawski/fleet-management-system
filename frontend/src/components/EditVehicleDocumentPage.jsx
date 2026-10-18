import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import apiClient from "../api/client";
import "./AddVehicleDocumentPage.css";

function EditVehicleDocumentPage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [vehicles, setVehicles] = useState([]);
  const [existingFile, setExistingFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    vehicle: "",
    document_type: "",
    document_number: "",
    issue_date: "",
    expiry_date: "",
    cost: "",
    notes: "",
    file: null,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [documentResponse, vehiclesResponse] = await Promise.all([
          apiClient.get(`vehicle-documents/${id}/`),
          apiClient.get("vehicles/"),
        ]);

        const document = documentResponse.data;

        setVehicles(vehiclesResponse.data);
        setExistingFile(document.file);

        setFormData({
          vehicle: document.vehicle || "",
          document_type: document.document_type || "",
          document_number: document.document_number || "",
          issue_date: document.issue_date || "",
          expiry_date: document.expiry_date || "",
          cost: document.cost ?? "",
          notes: document.notes || "",
          file: null,
        });
      } catch (err) {
        console.error("Błąd pobierania dokumentu:", err);
        setError("Nie udało się pobrać dokumentu.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    setFormData((currentData) => ({
      ...currentData,
      file: file || null,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.vehicle) {
      setError("Wybierz pojazd.");
      return;
    }

    if (!formData.document_type) {
      setError("Wybierz typ dokumentu.");
      return;
    }

    setSaving(true);
    setError("");

    const data = new FormData();

    data.append("vehicle", formData.vehicle);
    data.append("document_type", formData.document_type);
    data.append("document_number", formData.document_number);
    data.append("notes", formData.notes);

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
      await apiClient.put(`vehicle-documents/${id}/`, data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      navigate(`/vehicles/${formData.vehicle}`);
    } catch (err) {
      console.error("Błąd edycji dokumentu:", err);
      console.error("Odpowiedź backendu:", err.response?.data);

      setError("Nie udało się zapisać zmian.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />

        <main className="dashboard-content">
          <p>Ładowanie dokumentu...</p>
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
              onClick={() =>
                formData.vehicle
                  ? navigate(`/vehicles/${formData.vehicle}`)
                  : navigate("/vehicles")
              }
            >
              ← Wróć
            </button>

            <h1>Edytuj dokument</h1>

            <p>Zmień dane dokumentu przypisanego do pojazdu.</p>
          </div>
        </div>

        <form className="document-form-card" onSubmit={handleSubmit}>
          {error && <div className="document-form-error">{error}</div>}

          <div className="document-form-grid">
            <div className="document-form-group document-form-full">
              <label htmlFor="vehicle">Pojazd</label>

              <select
                id="vehicle"
                name="vehicle"
                value={formData.vehicle}
                onChange={handleChange}
                required
              >
                <option value="">Wybierz pojazd</option>

                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.brand} {vehicle.model} -{" "}
                    {vehicle.registration_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="document-form-group">
              <label htmlFor="document_type">Typ dokumentu</label>

              <select
                id="document_type"
                name="document_type"
                value={formData.document_type}
                onChange={handleChange}
                required
              >
                <option value="">Wybierz typ</option>
                <option value="oc">OC</option>
                <option value="ac">AC</option>
                <option value="registration">Dowód rejestracyjny</option>
                <option value="inspection">Przegląd techniczny</option>
                <option value="leasing">Umowa leasingowa</option>
                <option value="warranty">Gwarancja</option>
                <option value="assistance">Assistance</option>
                <option value="other">Inny</option>
              </select>
            </div>

            <div className="document-form-group">
              <label htmlFor="document_number">Numer dokumentu</label>

              <input
                id="document_number"
                name="document_number"
                type="text"
                value={formData.document_number}
                onChange={handleChange}
                placeholder="Np. POL/123456"
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
              />
            </div>

            <div className="document-form-group">
              <label htmlFor="file">Nowy plik</label>

              <input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />

              {existingFile && (
                <span className="document-form-file-info">
                  Dokument posiada już załączony plik.
                </span>
              )}
            </div>

            <div className="document-form-group document-form-full">
              <label htmlFor="notes">Notatki</label>

              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="5"
                placeholder="Dodatkowe informacje o dokumencie..."
              />
            </div>
          </div>

          <div className="document-form-actions">
            <button
              type="button"
              className="document-form-cancel"
              onClick={() =>
                formData.vehicle
                  ? navigate(`/vehicles/${formData.vehicle}`)
                  : navigate("/vehicles")
              }
            >
              Anuluj
            </button>

            <button
              type="submit"
              className="document-form-save"
              disabled={saving}
            >
              {saving ? "Zapisywanie..." : "Zapisz zmiany"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default EditVehicleDocumentPage;
