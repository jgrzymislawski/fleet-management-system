import { useEffect, useRef, useState } from "react";
import apiClient from "../api/client";
import "./DriverImportModal.css";

function DriverImportModal({ onClose, onImported }) {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const busy = importing || downloadingTemplate;

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [busy, onClose]);

  const getFilename = (response, fallbackFilename) => {
    const contentDisposition = response.headers?.["content-disposition"];

    if (!contentDisposition) {
      return fallbackFilename;
    }

    const filenameMatch = contentDisposition.match(
      /filename\*?=(?:UTF-8''|")?([^";]+)/i,
    );

    if (!filenameMatch?.[1]) {
      return fallbackFilename;
    }

    try {
      return decodeURIComponent(filenameMatch[1].replace(/"/g, ""));
    } catch {
      return filenameMatch[1].replace(/"/g, "");
    }
  };

  const downloadBlob = (response, fallbackFilename) => {
    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = getFilename(response, fallbackFilename);

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
  };

  const getBackendError = (err, fallbackMessage) => {
    const data = err.response?.data;

    if (!data) {
      return fallbackMessage;
    }

    if (typeof data === "string") {
      return data;
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail[0];
    }

    const firstError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    return firstError?.[0] || fallbackMessage;
  };

  const handleDownloadTemplate = async () => {
    if (busy) {
      return;
    }

    try {
      setDownloadingTemplate(true);
      setError(null);

      const response = await apiClient.get("drivers/import-template/", {
        responseType: "blob",
      });

      downloadBlob(response, "flotivo-szablon-importu-kierowcow.xlsx");
    } catch (err) {
      console.error("Błąd pobierania szablonu:", err);

      setError(getBackendError(err, "Nie udało się pobrać szablonu importu."));
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
    if (!selectedFile || busy) {
      if (!selectedFile) {
        setError("Najpierw wybierz plik XLSX.");
      }

      return;
    }

    try {
      setImporting(true);
      setError(null);
      setResult(null);

      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await apiClient.post("drivers/import/", formData);

      const importResult = response.data || {};

      setResult(importResult);

      if (Number(importResult.imported) > 0 && onImported) {
        try {
          await onImported();
        } catch (refreshError) {
          console.error(
            "Import zakończony, ale nie udało się odświeżyć listy:",
            refreshError,
          );
        }
      }
    } catch (err) {
      console.error("Błąd importu kierowców:", err);

      setError(getBackendError(err, "Nie udało się zaimportować kierowców."));
    } finally {
      setImporting(false);
    }
  };

  const handleSelectFile = () => {
    if (!busy) {
      fileInputRef.current?.click();
    }
  };

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && !busy) {
      onClose();
    }
  };

  return (
    <div className="driver-import-overlay" onMouseDown={handleOverlayClick}>
      <div
        className="driver-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-import-title"
      >
        <div className="driver-import-header">
          <div>
            <h2 id="driver-import-title">Import kierowców</h2>
            <p>Dodaj wielu kierowców jednocześnie z pliku Excel.</p>
          </div>

          <button
            type="button"
            className="driver-import-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        <div className="driver-import-info">
          <strong>Jak wykonać import?</strong>

          <ol>
            <li>Pobierz przygotowany szablon XLSX.</li>
            <li>Uzupełnij dane kierowców.</li>
            <li>Nie zmieniaj nazw kolumn w pierwszym wierszu.</li>
            <li>Kolejność kolumn może być dowolna.</li>
            <li>Wybierz uzupełniony plik i rozpocznij import.</li>
          </ol>
        </div>

        <button
          type="button"
          className="driver-import-template-button"
          onClick={handleDownloadTemplate}
          disabled={busy}
        >
          {downloadingTemplate ? "Pobieranie..." : "Pobierz szablon XLSX"}
        </button>

        <div className="driver-import-file-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            disabled={busy}
            hidden
          />

          <button
            type="button"
            className="driver-import-file-button"
            onClick={handleSelectFile}
            disabled={busy}
          >
            Wybierz plik
          </button>

          <div
            className="driver-import-file-name"
            title={selectedFile?.name || ""}
          >
            {selectedFile ? selectedFile.name : "Nie wybrano pliku"}
          </div>
        </div>

        {error && (
          <div className="driver-import-error" role="alert">
            {error}
          </div>
        )}

        {result && (
          <div className="driver-import-result" role="status">
            <h3>Wynik importu</h3>

            <div className="driver-import-summary">
              <div className="driver-import-summary-item">
                <span>Dodano</span>
                <strong>{Number(result.imported) || 0}</strong>
              </div>

              <div className="driver-import-summary-item">
                <span>Pominięto</span>
                <strong>{Number(result.skipped) || 0}</strong>
              </div>

              <div className="driver-import-summary-item">
                <span>Błędy</span>
                <strong>{Number(result.errors_count) || 0}</strong>
              </div>
            </div>

            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div className="driver-import-errors">
                <h4>Szczegóły</h4>

                <div className="driver-import-errors-list">
                  {result.errors.map((importError, index) => (
                    <div
                      key={`${importError.row || "error"}-${index}`}
                      className="driver-import-error-row"
                    >
                      <strong>
                        {importError.row ? `Wiersz ${importError.row}` : "Błąd"}
                      </strong>

                      <span>
                        {importError.message || "Nieznany błąd importu."}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="driver-import-actions">
          <button
            type="button"
            className="driver-import-cancel"
            onClick={onClose}
            disabled={busy}
          >
            Zamknij
          </button>

          <button
            type="button"
            className="driver-import-submit"
            onClick={handleImport}
            disabled={busy || !selectedFile}
          >
            {importing ? "Importowanie..." : "Importuj kierowców"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DriverImportModal;
