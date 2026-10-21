import Sidebar from "./sidebar/Sidebar";
import { useAuth } from "../context/AuthContext";

function AdminPanelPage({ onLogout }) {
  const { user } = useAuth();

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <h1>Administracja</h1>

        <p>
          Zarządzanie organizacją{" "}
          <strong>{user?.organization?.name || "Brak organizacji"}</strong>
        </p>

        <p>
          W tym miejscu będziemy zarządzać użytkownikami, spółkami i ich
          uprawnieniami.
        </p>
      </main>
    </div>
  );
}

export default AdminPanelPage;
