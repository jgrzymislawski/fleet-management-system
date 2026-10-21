import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Sidebar.css";

function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h2 className="sidebar-logo">FLOTIVO</h2>

        <nav className="sidebar-menu">
          <button
            className="sidebar-item"
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>

          <button
            className="sidebar-item"
            onClick={() => navigate("/vehicles")}
          >
            Pojazdy
          </button>

          <button className="sidebar-item" onClick={() => navigate("/drivers")}>
            Kierowcy
          </button>

          <button
            className="sidebar-item"
            onClick={() => navigate("/service-history")}
          >
            Historia napraw
          </button>

          <button
            className="sidebar-item"
            onClick={() => navigate("/statistics")}
          >
            Statystyki
          </button>

          <button className="sidebar-item" onClick={() => navigate("/account")}>
            Moje konto
          </button>
        </nav>
      </div>

      <button className="sidebar-logout" onClick={onLogout}>
        Wyloguj się
      </button>
    </aside>
  );
}

export default Sidebar;
