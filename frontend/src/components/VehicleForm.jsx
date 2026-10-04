function VehicleForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  submitText,
  error,
}) {
  return (
    <form className="add-vehicle-form" onSubmit={onSubmit}>
      <div className="vehicle-form-grid">
        <div className="vehicle-form-field">
          <label htmlFor="brand">Marka *</label>
          <input
            id="brand"
            name="brand"
            type="text"
            value={formData.brand}
            onChange={onChange}
            required
          />
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="model">Model *</label>
          <input
            id="model"
            name="model"
            type="text"
            value={formData.model}
            onChange={onChange}
            required
          />
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="registration_number">Numer rejestracyjny *</label>
          <input
            id="registration_number"
            name="registration_number"
            type="text"
            value={formData.registration_number}
            onChange={onChange}
            required
          />
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="vin">VIN</label>
          <input
            id="vin"
            name="vin"
            type="text"
            maxLength="17"
            value={formData.vin}
            onChange={onChange}
          />
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="year">Rok produkcji *</label>
          <input
            id="year"
            name="year"
            type="number"
            value={formData.year}
            onChange={onChange}
            required
          />
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="mileage">Przebieg *</label>
          <input
            id="mileage"
            name="mileage"
            type="number"
            min="0"
            value={formData.mileage}
            onChange={onChange}
            required
          />
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="vehicle_type">Typ pojazdu *</label>

          <select
            id="vehicle_type"
            name="vehicle_type"
            value={formData.vehicle_type}
            onChange={onChange}
          >
            <option value="passenger">Samochód osobowy</option>
            <option value="van">Bus / samochód dostawczy</option>
            <option value="truck">Samochód ciężarowy</option>
            <option value="special">Pojazd specjalny</option>
            <option value="other">Inny</option>
          </select>
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="fuel_type">Rodzaj paliwa</label>

          <select
            id="fuel_type"
            name="fuel_type"
            value={formData.fuel_type}
            onChange={onChange}
          >
            <option value="">Wybierz</option>
            <option value="petrol">Benzyna</option>
            <option value="diesel">Diesel</option>
            <option value="lpg">LPG</option>
            <option value="hybrid">Hybryda</option>
            <option value="electric">Elektryczny</option>
          </select>
        </div>

        <div className="vehicle-form-field">
          <label htmlFor="status">Status *</label>

          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={onChange}
          >
            <option value="active">Aktywny</option>
            <option value="maintenance">W serwisie</option>
            <option value="inactive">Nieaktywny</option>
          </select>
        </div>
      </div>

      {error && <p className="add-vehicle-error">{error}</p>}

      <div className="vehicle-form-actions">
        <button
          type="button"
          className="vehicle-form-cancel"
          onClick={onCancel}
        >
          Anuluj
        </button>

        <button type="submit" className="vehicle-form-submit">
          {submitText}
        </button>
      </div>
    </form>
  );
}

export default VehicleForm;
