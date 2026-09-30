import Navbar from './navbar/Navbar';
import Footer from './footer/Footer';

function PreviewPage() {
  return (
    <>
      <Navbar />

      <main>
        <h1>Podgląd</h1>
        <p>
          Tutaj znajdzie się prezentacja systemu Flotivo.
        </p>
      </main>

      <Footer />
    </>
  );
}

export default PreviewPage;