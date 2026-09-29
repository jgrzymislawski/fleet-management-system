import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/">
        <img
          src={logo}
          alt="Flotivo"
          className="navbar-logo"
        />
      </Link>

      <div className="navbar-links">
        <Link to="/oferta">Oferta</Link>
        <Link to="/podglad">Podgląd</Link>
        <Link to="/dolacz">Dołącz do nas</Link>
        <Link to="/login">Zaloguj się</Link>
      </div>
    </nav>
  );
}

export default Navbar;