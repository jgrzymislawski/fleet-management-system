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
            <h2>Dołącz do nas już dziś i lepiej zarządzaj swoją flotą! </h2>

            <p>
              Wszystkie pojazdy, kierowcy, koszty i ważne terminy w jednym
              miejscu. Flotivo pomaga firmom uporządkować zarządzanie flotą,
              ograniczyć formalności i zyskać pełną kontrolę nad pojazdami.
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
            <p>Zarządzaj swoją flotą w jednym miejscu. </p>
          </div>

          <div className="home-features-grid">
            <div className="home-feature-card">
              <span className="home-feature-number">01</span>
              <h3>Pojazdy</h3>
              <p>
                Zarządzaj pojazdami w jednym miejscu. Przechowuj ich dane,
                monitoruj stan floty i uzyskuj szybki dostęp do najważniejszych
                informacji.
              </p>
            </div>

            <div className="home-feature-card">
              <span className="home-feature-number">02</span>
              <h3>Kierowcy</h3>
              <p>
                Uporządkuj informacje o kierowcach i zarządzaj przypisaniem
                pojazdów do pracowników.
              </p>
            </div>

            <div className="home-feature-card">
              <span className="home-feature-number">03</span>
              <h3>Terminy</h3>
              <p>
                Kontroluj daty przeglądów technicznych i ważność polis
                ubezpieczeniowych. Miej najważniejsze terminy w jednym miejscu i
                unikaj niepotrzebnych opóźnień.
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
