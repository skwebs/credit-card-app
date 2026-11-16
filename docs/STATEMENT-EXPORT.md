# Transaction statement export

The Transactions page provides a date-range statement export in three formats:

- **Excel (`.xls`)**: Excel-compatible SpreadsheetML workbook (no third-party spreadsheet runtime dependency).
- **CSV (`.csv`)**: UTF-8 with BOM for spreadsheet compatibility; cells are quoted and formula-like text is neutralized.
- **PDF**: Opens a print-ready A4 landscape statement. Choose “Save as PDF” in the browser print dialog.

Exports request the full matching date range from the authenticated transactions API rather than exporting only the latest 2,000 transactions held in the bootstrap cache. The selected card and active method, UPI application, search, and category filters are applied. Amounts are exported in INR. Date filtering uses transaction date (`txn_at`), not settlement date.

Excel export uses the legacy Excel XML Spreadsheet format with an `.xls` extension. It is not an OOXML `.xlsx` file.
