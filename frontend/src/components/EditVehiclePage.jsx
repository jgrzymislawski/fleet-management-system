import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import VehicleForm from "./VehicleForm";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./AddVehiclePage.css";

function EditVehiclePage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loadingUser, canEditCompany } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    brand: "",
    model: "",
    registration_number: "",
    vin: "",
    year: "",
    vehicle_type: "passenger",
    fuel_type: "",
    mileage: "",
    status: "active",
    inspection_expiry_date: "",
    insurance_expiry_date: "",
    driver: "",
    driver_name: "",
    company: "",
    branch: "",
  });

  useEffect(() => {
    if (loadingUser) return;

    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);

        const [vehicleResponse, driversData, companiesResponse] =
          await Promise.all([
            apiClient.get(`vehicles/${id}/`),
            fetchAllPages(apiClient, "drivers/"),
            apiClient.get("companies/"),
          ]);

        if (!active) return;

        const vehicle = vehicleResponse.data;

        if (user?.role !== "admin" && !canEditCompany(vehicle.company)) {
          navigate(`/vehicles/${id}`, { replace: true });
          return;
        }

        setDrivers(Array.isArray(driversData) ? driversData : []);

        const allCompanies = Array.isArray(companiesResponse.data)
          ? companiesResponse.data
          : companiesResponse.data?.results || [];

        if (user?.role === "admin") {
          setCompanies(allCompanies);
        } else {
          const editableCompanyIds =
            user?.companies
              ?.filter((company) => company.role === "editor")
              .map((company) => Number(company.id)) || [];

          setCompanies(
            allCompanies.filter((company) =>
              editableCompanyIds.includes(Number(company.id)),
            ),
          );
        }

        setFormData({
          brand: vehicle.brand || "",
          model: vehicle.model || "",
          registration_number: vehicle.registration_number || "",
          vin: vehicle.vin || "",
          year: vehicle.year || "",
          vehicle_type: vehicle.vehicle_type || "passenger",
          fuel_type: vehicle.fuel_type || "",
          mileage: vehicle.mileage ?? "",
          status: vehicle.status || "active",
          inspection_expiry_date: vehicle.inspection_expiry_date || "",
          insurance_expiry_date: vehicle.insurance_expiry_date || "",
          driver: vehicle.driver || "",
          driver_name: vehicle.driver_name || "",
          company: vehicle.company || "",
          branch: vehicle.branch || "",
        });

        setError(null);
      } catch (err) {
        if (!active) return;
        console.error("Błąd pobierania danych pojazdu:", err);
        setError("Nie udało się pobrać danych pojazdu.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [id, user, loadingUser, canEditCompany, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => {
      const updated = {
        ...current,
        [name]: value,
      };

      if (name === "driver" && value) {
        updated.driver_name = "";
      }

      if (name === "driver_name" && value) {
        updated.driver = "";
      }

      return updated;
    });
  };

  const getBackendError = (err) => {
    const data = err.response?.data;

    if (!data) return "Nie udało się zapisać zmian.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;

    const firstFieldError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    if (firstFieldError) return firstFieldError[0];

    return "Nie udało się zapisać zmian.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError(null);

    if (user?.role !== "admin" && !formData.company) {
      setError("Wybierz spółkę, do której ma należeć pojazd.");
      return;
    }

    const dataToSend = {
      ...formData,
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      registration_number: formData.registration_number.trim(),
      vin: formData.vin.trim() || null,
      year: formData.year || null,
      fuel_type: formData.fuel_type || null,
      mileage: formData.mileage || 0,
      inspection_expiry_date: formData.inspection_expiry_date || null,
      insurance_expiry_date: formData.insurance_expiry_date || null,
      driver: formData.driver || null,
      driver_name: formData.driver_name.trim() || null,
      company: formData.company || null,
      branch: formData.branch.trim(),
    };

    try {
      setSubmitting(true);
      await apiClient.put(`vehicles/${id}/`, dataToSend);
      navigate(`/vehicles/${id}`);
    } catch (err) {
      console.error("Błąd zapisu pojazdu:", err);
      setError(getBackendError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser || loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie danych pojazdu...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />
      <main className="dashboard-content">
        <div className="add-vehicle-header">
          <div>
            <h1>Edytuj pojazd</h1>
            <p>Zmień dane wybranego pojazdu.</p>
          </div>
        </div>
        <VehicleForm
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/vehicles/${id}`)}
          submitText="Zapisz zmiany"
          error={error}
          drivers={drivers}
          companies={companies}
          allowEmptyCompany={user?.role === "admin"}
          submitting={submitting}
        />
      </main>
    </div>
  );
}

export default EditVehiclePage;
