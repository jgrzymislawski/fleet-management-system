import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import VehicleForm from "./VehicleForm";
import apiClient from "../api/client";
import { fetchAllPages } from "../api/pagination";
import { useAuth } from "../context/AuthContext";
import "./AddVehiclePage.css";

function AddVehiclePage({ onLogout }) {
  const navigate = useNavigate();
  const { user, loadingUser } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loadingFormData, setLoadingFormData] = useState(true);
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

  const canAddVehicle =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  useEffect(() => {
    if (!loadingUser && !canAddVehicle) {
      navigate("/vehicles", { replace: true });
    }
  }, [canAddVehicle, loadingUser, navigate]);

  useEffect(() => {
    if (loadingUser || !canAddVehicle) return;

    let active = true;

    const loadData = async () => {
      try {
        setLoadingFormData(true);

        const [driversData, companiesResponse] = await Promise.all([
          fetchAllPages(apiClient, "drivers/"),
          apiClient.get("companies/"),
        ]);

        if (!active) return;

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

        setError(null);
      } catch (err) {
        if (!active) return;
        console.error("Błąd pobierania danych formularza:", err);
        setError("Nie udało się pobrać danych formularza.");
      } finally {
        if (active) setLoadingFormData(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [user, loadingUser, canAddVehicle]);

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

    if (!data) return "Nie udało się dodać pojazdu.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;

    const firstFieldError = Object.values(data).find(
      (value) => Array.isArray(value) && value.length > 0,
    );

    if (firstFieldError) return firstFieldError[0];

    return "Nie udało się dodać pojazdu.";
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
      await apiClient.post("vehicles/", dataToSend);
      navigate("/vehicles");
    } catch (err) {
      console.error("Błąd dodawania pojazdu:", err);
      setError(getBackendError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser || loadingFormData) {
    return (
      <div className="dashboard-layout">
        <Sidebar onLogout={onLogout} />
        <main className="dashboard-content">
          <p>Ładowanie danych formularza...</p>
        </main>
      </div>
    );
  }

  if (!canAddVehicle) return null;

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />
      <main className="dashboard-content">
        <div className="add-vehicle-header">
          <div>
            <h1>Dodaj pojazd</h1>
            <p>Wprowadź dane nowego pojazdu.</p>
          </div>
        </div>
        <VehicleForm
          formData={formData}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/vehicles")}
          submitText="Dodaj pojazd"
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

export default AddVehiclePage;
