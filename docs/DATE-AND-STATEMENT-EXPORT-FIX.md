# Date handling and statement export correction

## Date-only contract

- PostgreSQL `DATE` values are parsed by `pg` as unchanged `YYYY-MM-DD` strings (OID 1082).
- Transaction timestamps (`TIMESTAMP WITHOUT TIME ZONE`) remain local wall-clock strings (`YYYY-MM-DD HH:mm:ss`).
- Date-only values must not be passed through JavaScript `Date` or `toISOString()` for display/export.
- Statement CSV, XLSX and PDF format both transaction and settlement calendar dates from their string components.

## Statement formats

- CSV is UTF-8 without a BOM to avoid BOM bytes appearing as `ï»¿` in consumers that do not detect BOMs. Fields remain quoted and formula-prefixed text is escaped.
- Excel export is a real `.xlsx` workbook generated with ExcelJS, including column widths, frozen header row and INR number formatting.
- PDF export downloads a real PDF generated with jsPDF and AutoTable.
- Print remains a separate browser print action.

## Dependencies

Runtime dependencies added: `exceljs`, `jspdf`, and `jspdf-autotable`.
Run `npm install` to regenerate `package-lock.json` before using `npm ci` in a clean environment.
