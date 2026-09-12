import { useState, useEffect } from 'react';
import apiClient from '../api/client';

function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get('drivers/')
      .then((response) => {
        setDrivers(response.data);
      })
      .catch((err) => {
        console.error(err);
        setError('Nie udało się pobrać listy kierowców');
      });
  }, []);

  return (
    <div>
      <h2>Lista kierowców</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {drivers.map((driver) => (
          <li key={driver.id}>
            {driver.first_name} {driver.last_name} — prawo jazdy: {driver.license_number}, tel: {driver.phone_number}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DriverList;