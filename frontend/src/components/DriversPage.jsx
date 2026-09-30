import Sidebar from './sidebar/Sidebar';
import DriverList from './DriverList';

function DriversPage({ onLogout }) {
  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <DriverList />
      </main>
    </div>
  );
}

export default DriversPage;