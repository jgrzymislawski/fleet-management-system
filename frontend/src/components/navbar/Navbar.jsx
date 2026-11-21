import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/logo.png";
import "./Navbar.css";

function Navbar() {
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

  const isActive = (path) => {
    return location.pathname === path;
  };

  const getLinkClassName = (path) => {
    return isActive(path) ? "navbar-link-active" : "";
  };

  return (
    <>
      <nav className="navbar">
        <Link
          to="/"
          className="navbar-logo-link"
          aria-label="Flotivo - strona główna"
        >
          <img src={logo} alt="Flotivo" className="navbar-logo" />
        </Link>

        <div className="navbar-links">
          <Link to="/oferta" className={getLinkClassName("/oferta")}>
            Oferta
          </Link>

          <Link to="/podglad" className={getLinkClassName("/podglad")}>
            Podgląd
          </Link>

          <Link to="/dolacz" className={getLinkClassName("/dolacz")}>
            Dołącz do nas
          </Link>

          <Link to="/login" className="navbar-login-link">
            Zaloguj się
          </Link>
        </div>

        <button
          type="button"
          className="navbar-mobile-toggle"
          aria-label={mobileOpen ? "Zamknij menu" : "Otwórz menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((currentValue) => !currentValue)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="navbar-mobile-overlay"
            aria-label="Zamknij menu"
            onClick={() => setMobileOpen(false)}
          />

          <div className="navbar-mobile-menu">
            <div className="navbar-mobile-menu-top">
              <span>MENU</span>

              <button
                type="button"
                className="navbar-mobile-close"
                aria-label="Zamknij menu"
                onClick={() => setMobileOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="navbar-mobile-links">
              <Link to="/" className={getLinkClassName("/")}>
                Strona główna
              </Link>

              <Link to="/oferta" className={getLinkClassName("/oferta")}>
                Oferta
              </Link>

              <Link to="/podglad" className={getLinkClassName("/podglad")}>
                Podgląd
              </Link>

              <Link to="/dolacz" className={getLinkClassName("/dolacz")}>
                Dołącz do nas
              </Link>

              <Link to="/login" className="navbar-mobile-login">
                Zaloguj się
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default Navbar;
