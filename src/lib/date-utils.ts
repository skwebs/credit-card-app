/** Date-only values must remain YYYY-MM-DD strings; never parse them with Date. */
export type DateOnly = string;
export const DATE_FORMAT_KEY = 'ccm-date-format';
export const DEFAULT_DATE_FORMAT = 'DD MMM YYYY';
export const DATE_FORMATS = [
  'DD MMM YYYY', 'DD MMM YY', 'DD-MM-YYYY', 'DD/MM/YYYY',
  'MM/DD/YYYY', 'YYYY-MM-DD', 'DD MMMM YYYY',
] as const;
const TOKENS = ['YYYY', 'MMMM', 'MMM', 'YY', 'DD', 'MM', 'M', 'D'] as const;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function dateOnlyPart(value: string | null | undefined): DateOnly {
  if (!value) return '';
  return value.slice(0, 10);
}

export function isValidDateFormat(format: string): boolean {
  if (!format || format.length > 40) return false;
  let rest = format;
  while (rest.length) {
    const token = TOKENS.find(item => rest.startsWith(item));
    if (token) { rest = rest.slice(token.length); continue; }
    const char = rest[0];
    if (!/[ ./,_-]/.test(char)) return false;
    rest = rest.slice(1);
  }
  return /Y/.test(format) && /M/.test(format) && /D/.test(format);
}

export function getDateFormat(): string {
  try {
    const saved = localStorage.getItem(DATE_FORMAT_KEY);
    return saved && isValidDateFormat(saved) ? saved : DEFAULT_DATE_FORMAT;
  } catch { return DEFAULT_DATE_FORMAT; }
}

export function formatDateOnly(value: string | null | undefined, format = getDateFormat()): string {
  const date = dateOnlyPart(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
  const [year, month, day] = date.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '—';
  const values: Record<string, string> = {
    YYYY: String(year), YY: String(year).slice(-2), MM: String(month).padStart(2, '0'),
    M: String(month), DD: String(day).padStart(2, '0'), D: String(day),
    MMM: MONTHS[month - 1].slice(0, 3), MMMM: MONTHS[month - 1],
  };
  const safeFormat = isValidDateFormat(format) ? format : DEFAULT_DATE_FORMAT;
  return safeFormat.replace(/YYYY|MMMM|MMM|YY|DD|MM|M|D/g, token => values[token]);
}

/** Extract the calendar date from a local SQL timestamp without timezone conversion. */
export function transactionDateOnly(value: string | null | undefined): DateOnly {
  return dateOnlyPart(value);
}
