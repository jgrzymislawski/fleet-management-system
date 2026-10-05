function DriverForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  submitText,
  error,
}) {
  return (
    <form className="driver-form" onSubmit={onSubmit}>
      <div className="driver-form-grid">
        <div className="driver-form-field">
          <label htmlFor="first_name">Imię *</label>
          <input
            id="first_name"
            name="first_name"
            type="text"
            value={formData.first_name}
            onChange={onChange}
            required
          />
        </div>

        <div className="driver-form-field">
          <label htmlFor="last_name">Nazwisko *</label>
          <input
            id="last_name"
            name="last_name"
            type="text"
            value={formData.last_name}
            onChange={onChange}
            required
          />
        </div>

        <div className="driver-form-field">
          <label htmlFor="license_number">Numer prawa jazdy *</label>
          <input
            id="license_number"
            name="license_number"
            type="text"
            value={formData.license_number}
            onChange={onChange}
            required
          />
        </div>

        <div className="driver-form-field">
          <label htmlFor="phone_number">Numer telefonu *</label>
          <input
            id="phone_number"
            name="phone_number"
            type="tel"
            value={formData.phone_number}
            onChange={onChange}
            required
          />
        </div>

        <div className="driver-form-field">
          <label htmlFor="hired_at">Data zatrudnienia *</label>
          <input
            id="hired_at"
            name="hired_at"
            type="date"
            value={formData.hired_at}
            onChange={onChange}
            required
          />
        </div>
      </div>

      {error && <p className="driver-form-error">{error}</p>}

      <div className="driver-form-actions">
        <button type="button" className="driver-form-cancel" onClick={onCancel}>
          Anuluj
        </button>

        <button type="submit" className="driver-form-submit">
          {submitText}
        </button>
      </div>
    </form>
  );
}

export default DriverForm;
