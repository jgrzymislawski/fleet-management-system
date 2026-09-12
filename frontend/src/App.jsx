import { useState } from 'react';
import Login from './components/Login';
import VehicleList from './components/VehicleList';
import DriverList from './components/DriverList';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div>
      <h1>Zalogowano!</h1>
      <VehicleList />
      <DriverList />
    </div>
  );
}

export default App;