import { useState, useEffect } from 'react';
import apiClient from '../api/client';

function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get('vehicles/')
      .then((response) => {
        setVehicles(response.data);
      })
      .catch((err) => {
        console.error(err);
        setError('Nie udało się pobrać listy pojazdów');
      });
  }, []);

  return (
    <div>
      <h2>Lista pojazdów</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {vehicles.map((vehicle) => (
          <li key={vehicle.id}>
            {vehicle.brand} {vehicle.model} — {vehicle.registration_number} ({vehicle.status})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default VehicleList;