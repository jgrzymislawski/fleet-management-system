import logo from '../../assets/logo.png';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <img
          src={logo}
          alt="Flotivo"
          className="footer-logo"
        />

        <p className="footer-contact">
          Kontakt: flotivo@gmail.com
        </p>

        <p className="footer-copyright">
          © 2026 Flotivo. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;