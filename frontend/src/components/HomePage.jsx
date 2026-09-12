import { useNavigate } from 'react-router-dom';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>System Zarządzania Flotą</h1>
      <p>Zarządzaj pojazdami i kierowcami w jednym miejscu.</p>
      <button onClick={() => navigate('/login')}>Zaloguj się</button>
    </div>
  );
}

export default HomePage;