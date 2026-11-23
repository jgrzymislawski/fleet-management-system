"""Ochrona plikow XLSX przed wstrzykiwaniem formul w danych tekstowych.

Wszystkie eksporty Flotivo sa arkuszami danych, a nie arkuszami
z obliczeniami. Nie zapisujemy w nich aktywnych formul.
"""

DANGEROUS_FORMULA_PREFIXES = ("=", "+", "-", "@")

# Biale znaki i niewidoczne prefiksy przed formulami.
LEADING_IGNORABLE = " \t\r\n\v\f\ufeff\u200b\u200c\u200d"


def sanitize_spreadsheet_value(value):
    """Zachowaj oryginalne typy danych; niebezpieczny tekst oznacz apostrofem."""
    if not isinstance(value, str):
        return value

    if value.lstrip(LEADING_IGNORABLE).startswith(
        DANGEROUS_FORMULA_PREFIXES
    ):
        return "'" + value

    return value


def sanitize_workbook(workbook):
    """Neutralizuj wszystkie komorki tekstowe przed zapisaniem XLSX."""
    for worksheet in workbook.worksheets:
        for row in worksheet.iter_rows():
            for cell in row:
                if isinstance(cell.value, str):
                    safe_value = sanitize_spreadsheet_value(cell.value)
                    if safe_value != cell.value:
                        cell.value = safe_value

    return workbook
