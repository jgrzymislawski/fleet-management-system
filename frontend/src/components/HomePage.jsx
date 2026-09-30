import Navbar from './navbar/Navbar';
import cars from '../assets/cars.jpg';
import './HomePage.css';
import Footer from './footer/Footer';

function HomePage() {
  return (
    <div className="home-page">
      <Navbar />

      <main className="home-content">
        <h1 className="home-title">Strona główna</h1>

        <section className="home-hero">
          <div className="home-image-container">
            <img
              src={cars}
              alt="Flota samochodów"
              className="home-image"
            />
          </div>

          <div className="home-description">
            <h2>
              Dołącz do nas i już dziś uszereguj swoją flotę.
            </h2>

            <p>
              Kontroluj wydatki, ubezpieczenia, przeglądy oraz najważniejsze
              informacje dotyczące swoich pojazdów w jednym miejscu.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;