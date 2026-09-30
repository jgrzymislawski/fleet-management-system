import { useNavigate } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ onLogout }) {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h2 className="sidebar-logo">FLOTIVO</h2>

        <nav className="sidebar-menu">
          <button
            className="sidebar-item"
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>

          <button
            className="sidebar-item"
            onClick={() => navigate('/vehicles')}
          >
            Pojazdy
          </button>

          <button
              className="sidebar-item"
                onClick={() => navigate('/drivers')}
                >
                Kierowcy
          </button>

          <button className="sidebar-item">
            Przypisania
          </button>
        </nav>
      </div>

      <button
        className="sidebar-logout"
        onClick={onLogout}
      >
        Wyloguj się
      </button>
    </aside>
  );
}

export default Sidebar;