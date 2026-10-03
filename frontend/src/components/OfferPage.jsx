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
            Flotivo pozwala uporządkować informacje o pojazdach, kontrolować
            ważne terminy i mieć najważniejsze dane dotyczące floty zawsze pod
            ręką.
          </p>
        </section>

        <section className="offer-grid">
          <div className="offer-card">
            <span>01</span>
            <h2>Zarządzanie pojazdami</h2>
            <p>
              Dodawaj nowe pojazdy, przeglądaj swoją flotę oraz aktualizuj i
              usuwaj zapisane informacje.
            </p>
          </div>

          <div className="offer-card">
            <span>02</span>
            <h2>Przeglądy i ubezpieczenia</h2>
            <p>
              Kontroluj terminy przeglądów technicznych i polis OC, aby nie
              przegapić ważnych terminów.
            </p>
          </div>

          <div className="offer-card">
            <span>03</span>
            <h2>Filtrowanie pojazdów</h2>
            <p>
              Szybko odnajduj potrzebne pojazdy dzięki możliwości filtrowania
              danych według wybranych kategorii.
            </p>
          </div>

          <div className="offer-card">
            <span>04</span>
            <h2>Statystyki</h2>
            <p>
              Przeglądaj najważniejsze statystyki swojej floty i kontroluj
              informacje związane z pojazdami.
            </p>
          </div>

          <div className="offer-card">
            <span>05</span>
            <h2>Kierowcy i przypisania</h2>
            <p>
              Zarządzaj informacjami o kierowcach i sprawdzaj, kto korzysta z
              poszczególnych pojazdów.
            </p>
          </div>

          <div className="offer-card">
            <span>06</span>
            <h2>Bezpieczny dostęp</h2>
            <p>
              Dostęp do panelu wymaga zalogowania, a po zakończeniu pracy możesz
              bezpiecznie wylogować się z systemu.
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
