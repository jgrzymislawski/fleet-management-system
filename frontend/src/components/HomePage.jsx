import Navbar from "./navbar/Navbar";
import cars from "../assets/cars.jpg";
import "./HomePage.css";
import Footer from "./footer/Footer";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="home-page">
      <Navbar />

      <main className="home-content">
        <h1 className="home-title">Strona główna</h1>

        <section className="home-hero">
          <div className="home-image-container">
            <img src={cars} alt="Flota samochodów" className="home-image" />
          </div>

          <div className="home-description">
            <h2>Dołącz do nas i już dziś uszereguj swoją flotę.</h2>

            <p>
              Kontroluj wydatki, ubezpieczenia, przeglądy oraz najważniejsze
              informacje dotyczące swoich pojazdów w jednym miejscu.
            </p>
            <div className="home-actions">
              <button
                className="home-button home-button-primary"
                onClick={() => navigate("/oferta")}
              >
                Poznaj możliwości
              </button>

              <button
                className="home-button home-button-secondary"
                onClick={() => navigate("/login")}
              >
                Zaloguj się
              </button>
            </div>
          </div>
        </section>
        <section className="home-features">
          <div className="home-features-heading">
            <h2>Wszystko pod kontrolą</h2>
            <p>Najważniejsze elementy zarządzania flotą w jednym miejscu.</p>
          </div>

          <div className="home-features-grid">
            <div className="home-feature-card">
              <span className="home-feature-number">01</span>
              <h3>Pojazdy</h3>
              <p>
                Przechowuj najważniejsze informacje o swoich pojazdach i miej do
                nich szybki dostęp.
              </p>
            </div>

            <div className="home-feature-card">
              <span className="home-feature-number">02</span>
              <h3>Kierowcy</h3>
              <p>
                Zarządzaj kierowcami oraz kontroluj przypisania pracowników do
                konkretnych pojazdów.
              </p>
            </div>

            <div className="home-feature-card">
              <span className="home-feature-number">03</span>
              <h3>Terminy</h3>
              <p>
                Pilnuj ważnych terminów związanych z przeglądami technicznymi i
                ubezpieczeniami.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;
