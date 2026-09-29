import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import Navbar from './navbar/Navbar';

function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />

      <div
        className="min-h-screen bg-[#F5F1EA] flex flex-col items-center justify-center px-6"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <img
          src={logo}
          alt="Flotivo"
          className="w-64 mb-12"
        />

        <p className="text-[#1A1A1A]/70 font-light text-lg tracking-wide mb-16 text-center max-w-md">
          Zarządzaj pojazdami, kierowcami i przypisaniami floty w jednym,
          przejrzystym miejscu.
        </p>

        <p>
          Jak to działa?
        </p>

        <h2>
          Musisz się zarejestrować
        </h2>

        <button
          onClick={() => navigate('/login')}
          className="border border-[#1A1A1A] text-[#1A1A1A] px-10 py-3 font-light tracking-[0.15em] uppercase text-sm hover:bg-[#1A1A1A] hover:text-[#F5F1EA] transition-colors duration-300"
        >
          Zaloguj się
        </button>
      </div>
    </>
  );
}

export default HomePage;