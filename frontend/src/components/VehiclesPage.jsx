import Sidebar from './sidebar/Sidebar';
import VehicleList from './VehicleList';

function VehiclesPage({ onLogout }) {
  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />

      <main className="dashboard-content">
        <VehicleList />
      </main>
    </div>
  );
}

export default VehiclesPage;