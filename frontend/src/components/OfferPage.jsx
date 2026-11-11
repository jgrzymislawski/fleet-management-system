import { useNavigate } from "react-router-dom";
import Navbar from "./navbar/Navbar";
import Footer from "./footer/Footer";
import "./OfferPage.css";

function OfferPage() {
  const navigate = useNavigate();

  return (
    <div className="offer-page">
      <Navbar />

      <main className="offer-content">
        <section className="offer-header">
          <span className="offer-label">MOŻLIWOŚCI FLOTIVO</span>

          <h1>Wszystko, czego potrzebujesz do zarządzania flotą.</h1>

          <p>
            Flotivo to intuicyjny system, który ułatwia zarządzanie pojazdami
            firmowymi, kontrolowanie kosztów i monitorowanie ważnych terminów.
          </p>
        </section>

        <section className="offer-grid">
          <div className="offer-card">
            <span>01</span>
            <h2>Zarządzanie pojazdami</h2>
            <p>
              Dodawaj, edytuj i zarządzaj pojazdami swojej firmy w prosty
              sposób.
            </p>
          </div>

          <div className="offer-card">
            <span>02</span>
            <h2>Przeglądy i ubezpieczenia</h2>
            <p>Monitoruj ważność przeglądów technicznych i polis OC.</p>
          </div>

          <div className="offer-card">
            <span>03</span>
            <h2>Filtrowanie pojazdów</h2>
            <p>Szybko odnajduj pojazdy dzięki wygodnym filtrom.</p>
          </div>

          <div className="offer-card">
            <span>04</span>
            <h2>Statystyki</h2>
            <p>Analizuj najważniejsze dane i miej pełny obraz swojej floty.</p>
          </div>

          <div className="offer-card">
            <span>05</span>
            <h2>Kierowcy i przypisania</h2>
            <p>
              Zarządzaj danymi kierowców i wygodnie przypisuj im pojazdy
              firmowe.
            </p>
          </div>

          <div className="offer-card">
            <span>06</span>
            <h2>Bezpieczny dostęp</h2>
            <p>
              Chroń dane swojej floty dzięki dostępowi wymagającemu logowania
              oraz możliwości bezpiecznego wylogowania z systemu.
            </p>
          </div>
        </section>

        <section className="offer-cta">
          <div>
            <h2>Uporządkuj swoją flotę z Flotivo.</h2>
            <p>Najważniejsze informacje o pojazdach w jednym miejscu.</p>
          </div>

          <div className="offer-actions">
            <button
              className="offer-button-primary"
              onClick={() => navigate("/dolacz")}
            >
              Dołącz do nas
            </button>

            <button
              className="offer-button-secondary"
              onClick={() => navigate("/login")}
            >
              Zaloguj się
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default OfferPage;
