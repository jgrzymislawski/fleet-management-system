import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import VehicleForm from "./VehicleForm";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./AddVehiclePage.css";

function AddVehiclePage({ onLogout }) {
  const navigate = useNavigate();

  const { user, loadingUser } = useAuth();

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
  });

  const [error, setError] = useState(null);

  const canAddVehicle =
    user?.role === "admin" ||
    user?.companies?.some((company) => company.role === "editor");

  useEffect(() => {
    if (loadingUser) {
      return;
    }

    if (!canAddVehicle) {
      navigate("/vehicles");
    }
  }, [canAddVehicle, loadingUser, navigate]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [driversResponse, companiesResponse] = await Promise.all([
          apiClient.get("drivers/"),
          apiClient.get("companies/"),
        ]);

        setDrivers(driversResponse.data);

        if (user?.role === "admin") {
          setCompanies(companiesResponse.data);
          return;
        }

        const editableCompanyIds =
          user?.companies
            ?.filter((company) => company.role === "editor")
            .map((company) => Number(company.id)) || [];

        const editableCompanies = companiesResponse.data.filter((company) =>
          editableCompanyIds.includes(Number(company.id)),
        );

        setCompanies(editableCompanies);
      } catch (err) {
        console.error("Błąd pobierania danych formularza:", err);

        setError("Nie udało się pobrać danych formularza.");
      }
    };

    if (!loadingUser && canAddVehicle) {
      loadData();
    }
  }, [user, loadingUser, canAddVehicle]);

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
    };

    apiClient
      .post("vehicles/", dataToSend)
      .then(() => {
        navigate("/vehicles");
      })
      .catch((err) => {
        console.error("Błąd dodawania pojazdu:", err);

        console.error("Odpowiedź backendu:", err.response?.data);

        const backendError =
          err.response?.data?.detail || err.response?.data?.company?.[0];

        setError(backendError || "Nie udało się dodać pojazdu.");
      });
  };

  if (loadingUser) {
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
        />
      </main>
    </div>
  );
}

export default AddVehiclePage;
