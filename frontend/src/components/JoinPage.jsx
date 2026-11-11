import { useState } from "react";

import Navbar from "./navbar/Navbar";
import Footer from "./footer/Footer";

import apiClient from "../api/client";

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

  const [sending, setSending] = useState(false);

  const [success, setSuccess] = useState("");

  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSending(true);

      setSuccess("");

      setError("");

      await apiClient.post("contact/", formData);

      setSuccess(
        "Zgłoszenie zostało wysłane. Skontaktujemy się z Tobą wkrótce.",
      );

      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        message: "",
      });
    } catch (err) {
      console.error("Błąd wysyłania formularza:", err);

      console.error("Odpowiedź backendu:", err.response?.data);

      setError(
        err.response?.data?.detail ||
          "Nie udało się wysłać formularza. Spróbuj ponownie.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="join-page">
      <Navbar />

      <main className="join-content">
        <section className="join-header">
          <span className="join-label">DOŁĄCZ DO FLOTIVO</span>

          <h1>Zacznij zarządzać flotą wygodniej</h1>

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
                  disabled={sending}
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
                  disabled={sending}
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
                  disabled={sending}
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
                  disabled={sending}
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
                  disabled={sending}
                />
              </div>

              {success && <p className="join-success">{success}</p>}

              {error && <p className="join-error">{error}</p>}

              <button className="join-submit" type="submit" disabled={sending}>
                {sending ? "Wysyłanie..." : "Wyślij zgłoszenie"}
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
            <h2>Rozpocznij współpracę z Flotivo.</h2>

            <p>Dołącz do nas w 3 prostych krokach.</p>
          </div>

          <div className="join-steps-grid">
            <div className="join-step">
              <span>01</span>

              <h3>Wypełnij formularz kontaktowy</h3>

              <p>
                Prześlij zgłoszenie, podając podstawowe informacje o swojej
                firmie.
              </p>
            </div>

            <div className="join-step">
              <span>02</span>

              <h3>Otrzymaj dostęp</h3>

              <p>
                Skontaktujemy się z Tobą i przekażemy informacje niezbędne do
                korzystania z systemu.
              </p>
            </div>

            <div className="join-step">
              <span>03</span>

              <h3>Zaloguj się i zarządzaj swoją flotą</h3>

              <p>
                Wejdź do Flotivo i rozpocznij wygodne zarządzanie pojazdami
                swojej firmy.
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
