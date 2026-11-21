import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Sidebar.css";

function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleNavigate = (path) => {
    setMobileOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setMobileOpen(false);
    onLogout();
  };

  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }

    return location.pathname.startsWith(path);
  };

  const getItemClassName = (path) => {
    return `sidebar-item ${isActive(path) ? "sidebar-item-active" : ""}`;
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        aria-label={mobileOpen ? "Zamknij menu" : "Otwórz menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((currentValue) => !currentValue)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Zamknij menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-logo-row">
            <h2 className="sidebar-logo">FLOTIVO</h2>

            <button
              type="button"
              className="sidebar-mobile-close"
              aria-label="Zamknij menu"
              onClick={() => setMobileOpen(false)}
            >
              ×
            </button>
          </div>

          <nav className="sidebar-menu">
            <button
              type="button"
              className={getItemClassName("/dashboard")}
              onClick={() => handleNavigate("/dashboard")}
            >
              Pulpit
            </button>

            <button
              type="button"
              className={getItemClassName("/vehicles")}
              onClick={() => handleNavigate("/vehicles")}
            >
              Pojazdy
            </button>

            <button
              type="button"
              className={getItemClassName("/drivers")}
              onClick={() => handleNavigate("/drivers")}
            >
              Kierowcy
            </button>

            <button
              type="button"
              className={getItemClassName("/service-history")}
              onClick={() => handleNavigate("/service-history")}
            >
              Historia napraw
            </button>

            <button
              type="button"
              className={getItemClassName("/statistics")}
              onClick={() => handleNavigate("/statistics")}
            >
              Statystyki
            </button>

            <button
              type="button"
              className={getItemClassName("/reports")}
              onClick={() => handleNavigate("/reports")}
            >
              Raporty
            </button>

            <button
              type="button"
              className={getItemClassName("/account")}
              onClick={() => handleNavigate("/account")}
            >
              Moje konto
            </button>
          </nav>
        </div>

        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          Wyloguj się
        </button>
      </aside>
    </>
  );
}

export default Sidebar;
