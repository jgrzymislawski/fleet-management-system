import { useRef, useState } from "react";

import apiClient from "../api/client";

import "./VehicleImportModal.css";

function VehicleImportModal({ onClose, onImported }) {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);

  const [importing, setImporting] = useState(false);

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const [error, setError] = useState(null);

  const [result, setResult] = useState(null);

  const downloadBlob = (response, fallbackFilename) => {
    const blob = new Blob([response.data], {
      type:
        "application/" +
        "vnd.openxmlformats-officedocument." +
        "spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    let filename = fallbackFilename;

    const contentDisposition = response.headers["content-disposition"];

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);

      if (match && match[1]) {
        filename = match[1];
      }
    }

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);

      setError(null);

      const response = await apiClient.get("vehicles/import-template/", {
        responseType: "blob",
      });

      downloadBlob(response, "flotivo-szablon-importu-pojazdow.xlsx");
    } catch (err) {
      console.error("Błąd pobierania szablonu:", err);

      setError("Nie udało się pobrać szablonu importu.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    setResult(null);
    setError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setSelectedFile(null);

      setError("Wybierz plik w formacie XLSX.");

      event.target.value = "";

      return;
    }

    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError("Najpierw wybierz plik XLSX.");

      return;
    }

    try {
      setImporting(true);
      setError(null);
      setResult(null);

      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await apiClient.post("vehicles/import/", formData);

      setResult(response.data);

      if (response.data.imported > 0 && onImported) {
        await onImported();
      }
    } catch (err) {
      console.error("Błąd importu pojazdów:", err);

      const responseData = err.response?.data;

      if (responseData?.detail) {
        setError(responseData.detail);
      } else {
        setError("Nie udało się zaimportować pojazdów.");
      }
    } finally {
      setImporting(false);
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="vehicle-import-overlay">
      <div className="vehicle-import-modal">
        <div className="vehicle-import-header">
          <div>
            <h2>Import pojazdów</h2>

            <p>Dodaj wiele pojazdów jednocześnie z pliku Excel.</p>
          </div>

          <button
            type="button"
            className="vehicle-import-close"
            onClick={onClose}
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        <div className="vehicle-import-info">
          <strong>Jak wykonać import?</strong>

          <ol>
            <li>Pobierz przygotowany szablon XLSX.</li>

            <li>Uzupełnij dane pojazdów.</li>

            <li>Nie zmieniaj nazw kolumn w pierwszym wierszu.</li>

            <li>Wybierz uzupełniony plik i rozpocznij import.</li>
          </ol>
        </div>

        <button
          type="button"
          className="vehicle-import-template-button"
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
        >
          {downloadingTemplate ? "Pobieranie..." : "Pobierz szablon XLSX"}
        </button>

        <div className="vehicle-import-file-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            hidden
          />

          <button
            type="button"
            className="vehicle-import-file-button"
            onClick={handleSelectFile}
          >
            Wybierz plik
          </button>

          <div className="vehicle-import-file-name">
            {selectedFile ? selectedFile.name : "Nie wybrano pliku"}
          </div>
        </div>

        {error && <div className="vehicle-import-error">{error}</div>}

        {result && (
          <div className="vehicle-import-result">
            <h3>Wynik importu</h3>

            <div className="vehicle-import-summary">
              <div className="vehicle-import-summary-item">
                <span>Dodano</span>

                <strong>{result.imported}</strong>
              </div>

              <div className="vehicle-import-summary-item">
                <span>Pominięto</span>

                <strong>{result.skipped}</strong>
              </div>

              <div className="vehicle-import-summary-item">
                <span>Błędy</span>

                <strong>{result.errors_count}</strong>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="vehicle-import-errors">
                <h4>Szczegóły</h4>

                <div className="vehicle-import-errors-list">
                  {result.errors.map((importError, index) => (
                    <div
                      key={`${importError.row}-${index}`}
                      className="vehicle-import-error-row"
                    >
                      <strong>Wiersz {importError.row}</strong>

                      <span>{importError.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="vehicle-import-actions">
          <button
            type="button"
            className="vehicle-import-cancel"
            onClick={onClose}
          >
            Zamknij
          </button>

          <button
            type="button"
            className="vehicle-import-submit"
            onClick={handleImport}
            disabled={importing || !selectedFile}
          >
            {importing ? "Importowanie..." : "Importuj pojazdy"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VehicleImportModal;
