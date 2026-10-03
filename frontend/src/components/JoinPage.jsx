import { useState } from "react";
import Navbar from "./navbar/Navbar";
import Footer from "./footer/Footer";
import company from "../assets/company.jpg";
import "./JoinPage.css";

function JoinPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log(formData);
  };

  return (
    <div className="join-page">
      <Navbar />

      <main className="join-content">
        <section className="join-header">
          <span className="join-label">DOŁĄCZ DO FLOTIVO</span>

          <h1>Zacznij zarządzać flotą wygodniej.</h1>

          <p>
            Skontaktuj się z nami, aby uzyskać więcej informacji oraz dostęp do
            systemu Flotivo.
          </p>
        </section>

        <section className="join-contact">
          <div className="join-image-container">
            <img
              src={company}
              alt="Flota pojazdów firmowych"
              className="join-image"
            />
          </div>

          <div className="join-form-container">
            <h2>Skontaktuj się z nami</h2>

            <p className="join-form-description">
              Wypełnij formularz, a skontaktujemy się z Tobą w sprawie dostępu
              do systemu.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="join-field">
                <label htmlFor="name">Imię i nazwisko *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="join-field">
                <label htmlFor="email">Adres e-mail *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="join-field">
                <label htmlFor="company">Nazwa firmy</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>

              <div className="join-field">
                <label htmlFor="phone">Numer telefonu</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="join-field">
                <label htmlFor="message">Wiadomość *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                />
              </div>

              <button className="join-submit" type="submit">
                Wyślij zgłoszenie
              </button>
            </form>

            <p className="join-form-info">
              Po otrzymaniu zgłoszenia skontaktujemy się z Tobą w celu
              przekazania informacji dotyczących dostępu do systemu.
            </p>
          </div>
        </section>

        <section className="join-steps">
          <div className="join-steps-header">
            <h2>Jak wygląda rozpoczęcie współpracy?</h2>
            <p>Dołączenie do Flotivo jest proste.</p>
          </div>

          <div className="join-steps-grid">
            <div className="join-step">
              <span>01</span>
              <h3>Wyślij formularz</h3>
              <p>Przekaż nam podstawowe informacje za pomocą formularza.</p>
            </div>

            <div className="join-step">
              <span>02</span>
              <h3>
                <h3>Otrzymaj dane dostępowe</h3>
              </h3>
              <p>
                Po kontakcie otrzymasz informacje potrzebne do rozpoczęcia
                korzystania z systemu.
              </p>
            </div>

            <div className="join-step">
              <span>03</span>
              <h3>Zaloguj się</h3>
              <p>
                Zaloguj się do Flotivo i rozpocznij zarządzanie swoją flotą.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default JoinPage;
