import { useEffect, useMemo, useState } from 'react';
import { formatDateOnly, getDateFormat } from '../../lib/date-utils';
import { FileSpreadsheet, FileText, X as CloseIcon } from 'lucide-react';
import type { Card, Txn } from './view-types';

type StatementOption = { id: number; card_id: number; cycle_start: string; cycle_end: string; statement_date?: string };
type ExportFilters = { from?: string; to?: string; month?: string; card_id?: string; method?: string; upi_app_id?: string; category?: string; q?: string };
type Props = {
  open: boolean;
  onClose: () => void;
  cards: Card[];
  statements?: StatementOption[];
  request: (action: string, method?: string, data?: unknown, params?: Record<string, string>) => Promise<any>;
  notify: (message: string, kind?: 'success' | 'error' | 'info') => void;
  filters?: ExportFilters;
  fixedCardId?: number;
  initialMode?: 'custom' | 'cycle';
  initialCycleId?: string;
  searchQuery?: string;
};

type ExportFormat = 'excel' | 'csv' | 'pdf' | 'print';
type Mode = 'custom' | 'month' | 'recent' | 'cycle';
const columns = ['Transaction date', 'Settlement date', 'Card', 'Particulars', 'Category', 'Payment method', 'UPI app', 'Amount (INR)', 'Notes'];
const escapeCsv = (value: unknown) => { const text = String(value ?? ''); const safe = /^[=+@-]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; };
const dateLabel = (value: string) => value ? formatDateOnly(value) : '';
const EXPORT_PREFS_KEY = 'ccm-statement-export-preferences-v1';
type SavedExportPrefs = { mode?: Mode; fromDate?: string; toDate?: string; month?: string; recentCount?: string; recentUnit?: 'days' | 'months'; exportCard?: string; cycleId?: string; format?: ExportFormat };
const readExportPrefs = (): SavedExportPrefs => { try { const value = JSON.parse(localStorage.getItem(EXPORT_PREFS_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
const writeExportPrefs = (value: SavedExportPrefs) => { try { localStorage.setItem(EXPORT_PREFS_KEY, JSON.stringify(value)); } catch { /* Preferences are optional when storage is unavailable. */ } };
const dateInIndia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftDate = (value: string, days: number) => { const [y, m, d] = value.split('-').map(Number); const date = new Date(Date.UTC(y, m - 1, d + days)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; };
const monthBounds = (month: string) => { const [year, monthNumber] = month.split('-').map(Number); const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(); return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }; };
const downloadBlob = (blob: Blob, filename: string) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
const statementRows = (rows: Txn[]) => rows.map(t => [t.txn_at, t.settlement_date, t.card_name, t.particular, t.category || '', t.payment_method.toUpperCase(), t.upi_app_name || '', t.amount_minor / 100, t.notes || '']);

export default function StatementExportDialog({ open, onClose, cards, statements = [], request, notify, filters = {}, fixedCardId, initialMode = 'custom', initialCycleId, searchQuery }: Props) {
  const today = dateInIndia();
  const [saved] = useState<SavedExportPrefs>(() => readExportPrefs());
  const [mode, setMode] = useState<Mode>(initialMode !== 'custom' ? initialMode : (['custom','month','recent','cycle'].includes(saved.mode || '') ? saved.mode as Mode : initialMode));
  const [fromDate, setFromDate] = useState(filters.from || (filters.month ? `${filters.month}-01` : saved.fromDate || `${today.slice(0, 7)}-01`));
  const [toDate, setToDate] = useState(filters.to || saved.toDate || today);
  const [month, setMonth] = useState(saved.month || today.slice(0, 7));
  const [recentCount, setRecentCount] = useState(saved.recentCount || '30');
  const [recentUnit, setRecentUnit] = useState<'days' | 'months'>(saved.recentUnit === 'months' ? 'months' : 'days');
  const [exportCard, setExportCard] = useState(String(fixedCardId ?? filters.card_id ?? saved.exportCard ?? ''));
  const [cycleId, setCycleId] = useState(initialCycleId || saved.cycleId || (fixedCardId ? `current-${fixedCardId}` : ''));
  const [lastFormat, setLastFormat] = useState<ExportFormat>(saved.format && ['excel','csv','pdf','print'].includes(saved.format) ? saved.format : 'excel');
  const [busy, setBusy] = useState(false);

  const cycleOptions = useMemo(() => {
    const options: { value: string; cardId: number; from: string; to: string; label: string }[] = [];
    const selectedCards = cards.filter(card => !fixedCardId || card.id === fixedCardId);
    for (const card of selectedCards) {
      if (card.cycle_start && card.cycle_end) options.push({ value: `current-${card.id}`, cardId: card.id, from: card.cycle_start, to: card.cycle_end, label: `${card.name} · Current (${dateLabel(card.cycle_start)} – ${dateLabel(card.cycle_end)})` });
    }
    for (const statement of statements) {
      const card = cards.find(item => item.id === statement.card_id);
      if (!card || (fixedCardId && statement.card_id !== fixedCardId)) continue;
      options.push({ value: `statement-${statement.id}`, cardId: statement.card_id, from: statement.cycle_start, to: statement.cycle_end, label: `${card.name} · ${dateLabel(statement.cycle_start)} – ${dateLabel(statement.cycle_end)}` });
    }
    return options;
  }, [cards, statements, fixedCardId]);

  const validExportCard = fixedCardId ? String(fixedCardId) : (cards.some(card => String(card.id) === exportCard) ? exportCard : '');
  const validCycleId = cycleOptions.some(option => option.value === cycleId && (!validExportCard || option.cardId === Number(validExportCard))) ? cycleId : '';
  const selectedCycle = cycleOptions.find(option => option.value === validCycleId);
  useEffect(() => {
    writeExportPrefs({ mode, fromDate, toDate, month, recentCount, recentUnit, exportCard: validExportCard, cycleId: validCycleId, format: lastFormat });
  }, [mode, fromDate, toDate, month, recentCount, recentUnit, validExportCard, validCycleId, lastFormat]);

  if (!open) return null;

  const exportStatement = async (format: ExportFormat) => {
    setLastFormat(format);
    let from = fromDate;
    let to = toDate;
    let bySettlementDate = false;
    if (mode === 'month') ({ from, to } = monthBounds(month));
    if (mode === 'recent') {
      const count = Number(recentCount);
      if (!Number.isInteger(count) || count < 1 || count > 3650) { notify('Enter a number between 1 and 3,650.', 'error'); return; }
      if (recentUnit === 'days') from = shiftDate(today, -(count - 1));
      else {
        const [year, monthNumber, day] = today.split('-').map(Number);
        const targetMonth = new Date(Date.UTC(year, monthNumber - 1 - count, 1));
        const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
        const start = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(day, lastDay)));
        from = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
      }
      to = today;
    }
    if (mode === 'cycle') {
      if (!selectedCycle?.from || !selectedCycle.to) { notify('Select a billing cycle with valid dates.', 'error'); return; }
      from = selectedCycle.from;
      to = selectedCycle.to;
      bySettlementDate = true;
    }
    if (!from || !to || from > to) { notify('Select a valid statement date range.', 'error'); return; }
    const printable = format === 'print' ? window.open('', '_blank') : null;
    if (format === 'print' && !printable) { notify('Allow pop-ups to print the statement.', 'error'); return; }
    setBusy(true);
    try {
      const params: Record<string, string> = bySettlementDate ? { settle_from: from, settle_to: to } : { from, to };
      const cardId = fixedCardId ? String(fixedCardId) : mode === 'cycle' ? String(selectedCycle?.cardId || validExportCard) : validExportCard;
      if (cardId) params.card_id = cardId;
      if (filters.method) params.method = filters.method;
      if (filters.upi_app_id) params.upi_app_id = filters.upi_app_id;
      const q = (searchQuery ?? filters.q ?? '').trim();
      if (q) params.q = q;
      const response = await request('transactions', 'GET', undefined, params);
      const rows: Txn[] = (response.transactions || []).filter((txn: Txn) => !filters.category || (txn.category || '') === filters.category).sort((a: Txn, b: Txn) => a.txn_at.localeCompare(b.txn_at) || a.id - b.id);
      if (!rows.length) { printable?.close(); notify('No transactions found for the selected export period.', 'info'); return; }
      const rawData = statementRows(rows);
      const data = rawData.map(row => [dateLabel(String(row[0])), dateLabel(String(row[1])), ...row.slice(2)]);
      const total = rows.reduce((sum, txn) => sum + Number(txn.amount_minor || 0), 0) / 100;
      const cardName = cards.find(card => card.id === Number(cardId))?.name;
      const filename = `card-ledger-${(cardName ? `${cardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-` : '')}statement-${from}-to-${to}`;
      if (format === 'csv') {
        const csvData = rawData.map(row => [String(row[0] || '').slice(0, 10), String(row[1] || '').slice(0, 10), ...row.slice(2)]);
        const csv = [columns, ...csvData, ['', '', '', '', '', '', 'Total', total, '']].map(row => row.map(escapeCsv).join(',')).join('\r\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
      } else if (format === 'excel') {
        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Credit Card Ledger';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Statement');
        worksheet.columns = columns.map((header, index) => ({ header, key: `col${index}`, width: [20, 18, 22, 32, 20, 18, 20, 16, 36][index] }));
        const excelDateFormat = getDateFormat().replace(/YYYY/g, 'yyyy').replace(/YY/g, 'yy').replace(/MMMM/g, 'mmmm').replace(/MMM/g, 'mmm').replace(/MM/g, 'mm').replace(/M/g, 'm').replace(/DD/g, 'dd').replace(/D/g, 'd');
        rawData.forEach(row => {
          const excelRow = row.map((value, index) => index < 2 && value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : value);
          const added = worksheet.addRow(Object.fromEntries(excelRow.map((value, index) => [`col${index}`, value])));
          added.getCell(1).numFmt = excelDateFormat; added.getCell(2).numFmt = excelDateFormat;
        });
        const totalRow = worksheet.addRow({ col6: 'Total', col7: total });
        totalRow.font = { bold: true };
        worksheet.getColumn(8).numFmt = '₹#,##0.00';
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        const buffer = await workbook.xlsx.writeBuffer();
        downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
      } else if (format === 'pdf') {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(16); doc.text('Card Ledger Statement', 14, 15);
        doc.setFontSize(9); doc.text(`Period: ${dateLabel(from)} – ${dateLabel(to)} | ${rows.length} transactions`, 14, 22);
        autoTable(doc, { startY: 28, head: [columns], body: data.map(row => row.map((value, index) => index === 7 ? Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value ?? ''))), styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' }, headStyles: { fillColor: [79, 70, 229] }, columnStyles: { 7: { halign: 'right' } }, didDrawPage: () => { doc.setFontSize(8); doc.text(`Total expenses: INR ${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, doc.internal.pageSize.getHeight() - 8); } });
        doc.save(`${filename}.pdf`);
      } else if (printable) {
        const body = data.map(row => `<tr>${row.map((value, index) => `<td>${index === 7 ? Number(value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('')}</tr>`).join('');
        printable.document.write(`<!doctype html><html><head><title>Card Ledger Statement</title><style>body{font:12px Arial,sans-serif;color:#111;padding:24px}h1{font-size:20px;margin:0 0 6px}.meta{color:#555;margin-bottom:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#eee}td:nth-child(8),th:nth-child(8){text-align:right}.total{font-weight:bold;text-align:right;margin-top:14px}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>Card Ledger Statement</h1><div class="meta">Period: ${dateLabel(from)} – ${dateLabel(to)} · ${rows.length} transactions</div><table><thead><tr>${columns.map(column => `<th>${column}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table><p class="total">Total expenses: ${total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p><script>window.onload=()=>window.print()</script></body></html>`);
        printable.document.close();
      }
      onClose();
      notify(`${format.toUpperCase()} statement prepared.`);
    } catch (error) {
      printable?.close();
      notify(`Could not export statement: ${(error as Error).message}`, 'error');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="statement-export-title" className="statement-export-dialog w-full max-w-lg rounded-3xl border border-neutral-700 bg-neutral-950 p-4 text-neutral-100 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 id="statement-export-title" className="text-lg font-bold">Export statement</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close export" className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800"><CloseIcon size={19}/></button></div><div className="space-y-3">
    <label className="block text-xs font-semibold text-neutral-400">Export period<select value={mode} onChange={event => setMode(event.target.value as Mode)} disabled={busy} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"><option value="custom">Custom date range (current option)</option><option value="month">Calendar month</option><option value="recent">Last days / months</option><option value="cycle">Billing cycle and card</option></select></label>
    {(mode === 'custom' || mode === 'month' || mode === 'recent') && !fixedCardId && <label className="block text-xs font-semibold text-neutral-400">Credit card<select value={validExportCard} onChange={event => setExportCard(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"><option value="">All cards</option>{cards.map(card => <option key={card.id} value={card.id}>{card.name} · {card.bank_name}</option>)}</select></label>}
    {mode === 'custom' && <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-neutral-400">From date<input type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"/></label><label className="block text-xs font-semibold text-neutral-400">To date<input type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"/></label></div>}
    {mode === 'month' && <label className="block text-xs font-semibold text-neutral-400">Calendar month<input type="month" value={month} onChange={event => setMonth(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"/></label>}
    {mode === 'recent' && <div className="grid grid-cols-[1fr_1fr] gap-3"><label className="block text-xs font-semibold text-neutral-400">Number<input type="number" min="1" max="3650" value={recentCount} onChange={event => setRecentCount(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"/></label><label className="block text-xs font-semibold text-neutral-400">Period<select value={recentUnit} onChange={event => setRecentUnit(event.target.value as 'days' | 'months')} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"><option value="days">Days</option><option value="months">Months</option></select></label></div>}
    {mode === 'cycle' && <><label className="block text-xs font-semibold text-neutral-400">{fixedCardId ? 'Credit card' : 'Credit card'}<select value={validExportCard} disabled={!!fixedCardId} onChange={event => { setExportCard(event.target.value); setCycleId(''); }} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100">{cards.filter(card => !fixedCardId || card.id === fixedCardId).map(card => <option key={card.id} value={card.id}>{card.name} · {card.bank_name}</option>)}</select></label><label className="block text-xs font-semibold text-neutral-400">Billing cycle<select value={validCycleId} onChange={event => setCycleId(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-neutral-100"><option value="">Select billing cycle</option>{cycleOptions.filter(option => option.cardId === Number(validExportCard)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{selectedCycle && <p className="rounded-xl bg-neutral-900 p-3 text-xs text-neutral-400">Transactions are selected by settlement date: {dateLabel(selectedCycle.from)} – {dateLabel(selectedCycle.to)}.</p>}</>}
    <p className="text-xs leading-5 text-neutral-500">{mode === 'cycle' ? 'Billing-cycle exports use settlement dates and the selected card.' : 'Date-based exports use transaction dates. Current payment method, UPI app, search and category filters are retained.'}</p>
    <p className="pt-1 text-[11px] text-neutral-500">Last used export format: {lastFormat.toUpperCase()}</p><div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4"><button type="button" disabled={busy} onClick={() => void exportStatement('excel')} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-300 disabled:opacity-50"><FileSpreadsheet size={19}/>Excel (.xlsx)</button><button type="button" disabled={busy} onClick={() => void exportStatement('csv')} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/10 text-xs font-semibold text-sky-300 disabled:opacity-50"><FileText size={19}/>CSV</button><button type="button" disabled={busy} onClick={() => void exportStatement('pdf')} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-red-500/40 bg-red-500/10 text-xs font-semibold text-red-300 disabled:opacity-50"><FileText size={19}/>Download PDF</button><button type="button" disabled={busy} onClick={() => void exportStatement('print')} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-neutral-500/40 bg-neutral-500/10 text-xs font-semibold text-neutral-300 disabled:opacity-50"><FileText size={19}/>Print</button></div>{busy && <p role="status" className="text-center text-xs text-violet-300">Preparing statement…</p>}</div></section></div>;
}
