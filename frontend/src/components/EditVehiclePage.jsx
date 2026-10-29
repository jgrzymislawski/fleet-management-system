import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import VehicleForm from "./VehicleForm";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AddVehiclePage.css";

function EditVehiclePage({ onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const { user, loadingUser, canEditCompany } = useAuth();

  const [drivers, setDrivers] = useState([]);
  const [companies, setCompanies] = useState([]);

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

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loadingUser) {
      return;
    }

    const loadData = async () => {
      try {
        const [vehicleResponse, driversResponse, companiesResponse] =
          await Promise.all([
            apiClient.get(`vehicles/${id}/`),
            apiClient.get("drivers/"),
            apiClient.get("companies/"),
          ]);

        const vehicle = vehicleResponse.data;

        if (user?.role !== "admin" && !canEditCompany(vehicle.company)) {
          navigate(`/vehicles/${id}`);
          return;
        }

        setDrivers(driversResponse.data);

        if (user?.role === "admin") {
          setCompanies(companiesResponse.data);
        } else {
          const editableCompanyIds =
            user?.companies
              ?.filter((company) => company.role === "editor")
              .map((company) => Number(company.id)) || [];

          const editableCompanies = companiesResponse.data.filter((company) =>
            editableCompanyIds.includes(Number(company.id)),
          );

          setCompanies(editableCompanies);
        }

        setFormData({
          brand: vehicle.brand,
          model: vehicle.model,
          registration_number: vehicle.registration_number,
          vin: vehicle.vin || "",
          year: vehicle.year,
          vehicle_type: vehicle.vehicle_type,
          fuel_type: vehicle.fuel_type || "",
          mileage: vehicle.mileage,
          status: vehicle.status,
          inspection_expiry_date: vehicle.inspection_expiry_date || "",
          insurance_expiry_date: vehicle.insurance_expiry_date || "",
          driver: vehicle.driver || "",
          driver_name: vehicle.driver_name || "",
          company: vehicle.company || "",
          branch: vehicle.branch || "",
        });
      } catch (err) {
        console.error("Błąd pobierania danych pojazdu:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        setError("Nie udało się pobrać danych pojazdu.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, user, loadingUser, canEditCompany, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setError(null);

    if (user?.role !== "admin" && !formData.company) {
      setError("Wybierz spółkę, do której ma należeć pojazd.");

      return;
    }

    const dataToSend = {
      ...formData,
      vin: formData.vin || null,
      fuel_type: formData.fuel_type || null,
      inspection_expiry_date: formData.inspection_expiry_date || null,
      insurance_expiry_date: formData.insurance_expiry_date || null,
      driver: formData.driver || null,
      driver_name: formData.driver_name || null,
      company: formData.company || null,
      branch: formData.branch.trim(),
    };

    apiClient
      .put(`vehicles/${id}/`, dataToSend)
      .then(() => {
        navigate(`/vehicles/${id}`);
      })
      .catch((err) => {
        console.error("Błąd zapisu:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        const backendError =
          err.response?.data?.detail ||
          err.response?.data?.company?.[0] ||
          err.response?.data?.driver?.[0];

        setError(backendError || "Nie udało się zapisać zmian.");
      });
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
        />
      </main>
    </div>
  );
}

export default EditVehiclePage;
