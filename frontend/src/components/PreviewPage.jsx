import { useNavigate } from "react-router-dom";
import Navbar from "./navbar/Navbar";
import Footer from "./footer/Footer";

import dashboardImage from "../assets/pulpit.png";
import vehiclesImage from "../assets/samochody.png";
import driversImage from "../assets/kierowcy.png";

import "./PreviewPage.css";

function PreviewPage() {
  const navigate = useNavigate();

  return (
    <div className="preview-page">
      <Navbar />

      <main className="preview-content">
        <section className="preview-header">
          <span className="preview-label">ZOBACZ FLOTIVO</span>

          <h1>Zobacz, jak wygląda system.</h1>

          <p>
            Flotivo zostało zaprojektowane tak, aby najważniejsze informacje
            dotyczące floty były czytelne i łatwo dostępne.
          </p>
        </section>

        <section className="preview-main">
          <div className="preview-image preview-image-large">
            <img src={dashboardImage} alt="Dashboard systemu Flotivo" />
          </div>

          <div className="preview-description">
            <span>01</span>

            <h2>Pulpit</h2>

            <p>
              Po zalogowaniu użytkownik otrzymuje dostęp do panelu, z którego
              może przejść do najważniejszych części systemu.
            </p>
          </div>
        </section>

        <section className="preview-section">
          <div className="preview-text">
            <span>02</span>

            <h2>Zarządzanie pojazdami</h2>

            <p>
              Przeglądaj pojazdy swojej floty i uzyskuj szybki dostęp do
              najważniejszych informacji na ich temat.
            </p>
          </div>

          <div className="preview-image">
            <img src={vehiclesImage} alt="Lista pojazdów w systemie Flotivo" />
          </div>
        </section>

        <section className="preview-section preview-section-reverse">
          <div className="preview-image">
            <img src={driversImage} alt="Lista kierowców w systemie Flotivo" />
          </div>

          <div className="preview-text">
            <span>03</span>

            <h2>Kierowcy</h2>

            <p>
              Zarządzaj informacjami o kierowcach i kontroluj przypisania
              kierowców do pojazdów.
            </p>
          </div>
        </section>

        <section className="preview-cta">
          <h2>Gotowy, aby uporządkować swoją flotę?</h2>

          <p>Zaloguj się i przejdź do panelu Flotivo.</p>

          <button onClick={() => navigate("/login")}>Zaloguj się</button>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default PreviewPage;
