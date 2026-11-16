import ModalLink from '../../routes/ModalLink';
import { useAppRouteContext } from '../../routes/route-context';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import ReceiptImagePreview from '../../components/ReceiptImagePreview';
import ReceiptImage from '../../components/ReceiptImage';
import { type AppRouteContext } from '../../routes/route-context';

const API = `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/api`;
const money = (minor: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format((Number(minor) || 0) / 100);
const day = (value: string) => { const v=value?.slice(0,10); if(!v)return '—'; const [year,month,date]=v.split('-'); return `${date}/${month}/${year}`; };

export default function TransactionDetailsPage() {
  const { transactionId } = useParams();
  const { txns, dataReady, deleteTransaction, removeTransactionAttachment } = useAppRouteContext<AppRouteContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const txn = txns.find(item => item.id === Number(transactionId));
  if (!dataReady) return <div className="py-8 text-center text-sm text-neutral-500">Loading transaction…</div>;
  if (!txn) return <Navigate to="/transactions" replace />;

  const time = txn.txn_at.slice(11, 16) || '—';
  const fields: [string, string][] = [
    ['Credit card', txn.card_name],
    ['Payment method', txn.payment_method.toUpperCase()],
    ...(txn.upi_app_name ? [['UPI application', txn.upi_app_name] as [string, string]] : []),
    ['Transaction date', day(txn.txn_at)],
    ['Transaction time', time],
    ['Settlement date', txn.settlement_date ? day(txn.settlement_date) : 'Not set'],
    ['Category', txn.category || '—'],
    ['Tags', txn.tags || '—'],
    ['Notes', txn.notes || '—'],
  ];

  const close = () => ((location.state as any)?.backgroundLocation ? navigate(-1) : navigate('/transactions'));
  return <section className="route-detail-modal mx-auto flex w-full max-w-3xl flex-col">
    <header className="route-modal-header flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-4">
      <h2 className="text-lg font-bold">Transaction details</h2>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Delete transaction"
          title="Delete transaction"
          onClick={() => {
            if (window.confirm('Delete this transaction? This action cannot be undone. If it belongs to a locked statement, unlock the statement first.')) {
              deleteTransaction(txn);
              close();
            }
          }}
          className="flex items-center justify-center rounded-full p-2 text-red-400 hover:bg-red-950/40 hover:text-red-300"
        >
          <Trash2 size={21}/>
        </button>
        <button type="button" onClick={close} aria-label="Close transaction details" className="rounded-full p-2 text-neutral-400 hover:bg-neutral-800"><X size={21}/></button>
      </div>
    </header>
    <div className="route-detail-content flex min-h-0 flex-1 flex-col gap-3">
      <section className="route-detail-summary rounded-3xl border border-neutral-800 bg-neutral-900 p-5 text-center"><div className="text-sm text-neutral-400">{txn.particular || 'Expense'}</div><div className="mt-2 text-3xl font-bold tabular-nums">{money(txn.amount_minor)}</div><div className="mt-2 text-xs text-neutral-500">{day(txn.txn_at)} · {time}</div></section>
      <section className="route-detail-fields overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        {fields.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 border-b border-neutral-800 px-4 py-3 last:border-b-0"><span className="text-sm text-neutral-400">{label}</span><span className="max-w-[65%] whitespace-pre-wrap break-words text-right text-sm font-medium">{value}</span></div>)}
        {txn.has_attachment === 1 && <div className="receipt-detail-section border-t border-neutral-800 p-4"><div className="mb-3 flex items-center gap-2"><ImageIcon size={17} className="text-violet-500"/><h3 className="text-sm font-semibold">Receipt attachment</h3></div><div className="receipt-detail-card flex items-center gap-3 rounded-xl border p-3"><button type="button" onClick={()=>setReceiptPreviewOpen(true)} className="receipt-detail-thumbnail-button shrink-0" aria-label="View receipt image"><ReceiptImage key={txn.id} src={`${API}?action=transaction-attachment&id=${txn.id}`} alt="Transaction receipt thumbnail" className="h-20 w-20 shrink-0 rounded-lg" imageClassName="receipt-detail-thumbnail h-20 w-20 rounded-lg object-contain" /></button><div className="min-w-0 flex-1"><div className="receipt-detail-name truncate text-sm font-semibold">Receipt image</div><div className="receipt-detail-hint mt-1 text-xs">Preview the full image without leaving this transaction.</div><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={()=>setReceiptPreviewOpen(true)} className="receipt-preview-text-action text-xs font-semibold">View image</button><a href={`${API}?action=transaction-attachment&id=${txn.id}`} target="_blank" rel="noreferrer" className="receipt-preview-text-action text-xs font-semibold">Open original</a></div></div></div><button type="button" onClick={()=>{if(window.confirm('Remove the receipt image from this transaction?'))void removeTransactionAttachment(txn);}} className="mt-3 min-h-10 rounded-xl px-3 text-xs font-semibold text-red-500 hover:bg-red-500/10">Remove receipt</button></div>}
      </section>
    </div>
    {receiptPreviewOpen && <ReceiptImagePreview src={`${API}?action=transaction-attachment&id=${txn.id}`} alt={`Receipt for ${txn.particular || 'transaction'}`} onClose={() => setReceiptPreviewOpen(false)} />}
    <div className="route-detail-actions flex shrink-0 items-center justify-between gap-3">
      <button type="button" onClick={close} className="inline-flex min-h-12 min-w-32 items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-semibold text-neutral-200 hover:bg-neutral-700">
        <ArrowLeft size={16}/> Back
      </button>
      <ModalLink to={`/transactions/${txn.id}/edit`} modal={(localStorage.getItem('ccm-transaction-edit-mode') || 'modal') !== 'full-page'} state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }} className="inline-flex min-h-12 min-w-40 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white">
        <Pencil size={16}/> Edit transaction
      </ModalLink>
    </div>
  </section>;
}
