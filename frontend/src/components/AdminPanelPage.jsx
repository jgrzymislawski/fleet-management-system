import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./AdminPanelPage.css";

function AdminPanelPage({ onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <div className="admin-panel-header">
          <div>
            <h1>Administracja</h1>

            <p>
              Zarządzanie organizacją{" "}
              <strong>{user?.organization?.name || "Brak organizacji"}</strong>
            </p>
          </div>
        </div>

        <div className="admin-panel-grid">
          <button
            className="admin-panel-card"
            onClick={() => navigate("/admin-panel/companies")}
          >
            <span className="admin-panel-card-title">Spółki</span>

            <span className="admin-panel-card-description">
              Dodawaj, edytuj i zarządzaj spółkami w swojej organizacji.
            </span>
          </button>

          <button
            className="admin-panel-card"
            onClick={() => navigate("/admin-panel/users")}
          >
            <span className="admin-panel-card-title">Użytkownicy</span>

            <span className="admin-panel-card-description">
              Zarządzaj kontami użytkowników i ich uprawnieniami.
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}

export default AdminPanelPage;
