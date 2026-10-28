const LICENSE_CATEGORIES = [
  "AM",
  "A1",
  "A2",
  "A",
  "B1",
  "B",
  "B+E",
  "C1",
  "C1+E",
  "C",
  "C+E",
  "D1",
  "D1+E",
  "D",
  "D+E",
  "T",
];

function DriverForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  submitText,
  error,
}) {
  const selectedCategories = formData.license_categories || [];

  const handleCategoryChange = (category) => {
    const isSelected = selectedCategories.includes(category);

    const nextCategories = isSelected
      ? selectedCategories.filter(
          (selectedCategory) => selectedCategory !== category,
        )
      : [...selectedCategories, category];

    onChange({
      target: {
        name: "license_categories",
        value: nextCategories,
      },
    });
  };

  return (
    <form className="driver-form" onSubmit={onSubmit}>
      <div className="driver-form-section">
        <div className="driver-form-section-header">
          <h2>Dane kierowcy</h2>

          <p>Podstawowe informacje o kierowcy.</p>
        </div>

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
      </div>

      <div className="driver-form-section">
        <div className="driver-form-section-header">
          <h2>Prawo jazdy i uprawnienia</h2>

          <p>Informacje dotyczące prawa jazdy oraz badań lekarskich.</p>
        </div>

        <div className="driver-form-grid">
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
            <label htmlFor="license_expiry_date">Prawo jazdy ważne do</label>

            <input
              id="license_expiry_date"
              name="license_expiry_date"
              type="date"
              value={formData.license_expiry_date || ""}
              onChange={onChange}
            />
          </div>

          <div className="driver-form-field">
            <label htmlFor="medical_exam_expiry_date">
              Badania lekarskie ważne do
            </label>

            <input
              id="medical_exam_expiry_date"
              name="medical_exam_expiry_date"
              type="date"
              value={formData.medical_exam_expiry_date || ""}
              onChange={onChange}
            />
          </div>
        </div>

        <div className="driver-form-categories">
          <span className="driver-form-categories-label">
            Kategorie prawa jazdy
          </span>

          <div className="driver-form-categories-grid">
            {LICENSE_CATEGORIES.map((category) => {
              const selected = selectedCategories.includes(category);

              return (
                <button
                  key={category}
                  type="button"
                  className={
                    selected
                      ? "driver-category-option driver-category-option-selected"
                      : "driver-category-option"
                  }
                  onClick={() => handleCategoryChange(category)}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <p className="driver-form-categories-help">
            Możesz zaznaczyć kilka kategorii.
          </p>
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
