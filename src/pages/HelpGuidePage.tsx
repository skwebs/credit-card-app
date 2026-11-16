import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { BookOpen, CreditCard, ReceiptText, Download, CalendarDays, Palette, RefreshCw, ShieldCheck, Search } from 'lucide-react';

const sections = [
  { title: 'Getting started', icon: BookOpen, body: ['Use the bottom navigation to move between Dashboard, Transactions and Settings.', 'The dashboard summarizes your active cards, spending and billing-cycle activity.', 'Use the sync control in the header to refresh data when you are online.'] },
  { title: 'Managing credit cards', icon: CreditCard, body: ['Open Settings → Cards & budgets to add or edit a credit card.', 'Enter the billing day and billing rule carefully; these determine the card billing cycle.', 'Cards with transaction, statement or payment history are archived rather than permanently removed.'] },
  { title: 'Transactions', icon: ReceiptText, body: ['Open Transactions to review, search and filter expenses.', 'Use the add action to record a transaction and select its card, date, amount and payment method.', 'Transaction date and settlement date are different: transaction date records the purchase; settlement date determines the billing cycle.'] },
  { title: 'Statement exports', icon: Download, body: ['Open a card and use its export action, or export from the Transactions screen.', 'Choose Custom date range, Calendar month, Last days/months, or Billing cycle and card.', 'Billing-cycle exports select transactions by settlement date and the selected card. Other date-range exports use transaction dates.', 'Excel preserves date cells for sorting and calculations. CSV uses ISO dates (YYYY-MM-DD) to reduce locale ambiguity. PDF and Print use the selected display date format.'] },
  { title: 'Date format', icon: CalendarDays, body: ['Open Settings → Date format to select a predefined format or enter a supported custom pattern.', 'Supported tokens: YYYY, YY, MMMM, MMM, MM, M, DD and D. Example: DD MMM YYYY displays 16 Nov 2026.', 'Changing the display format does not change stored dates, billing calculations or API date values.'] },
  { title: 'Appearance and preferences', icon: Palette, body: ['Open Settings → Appearance to choose Light, Dark or System theme. System follows your device appearance preference.', 'Display density and transaction modal/page behaviour are available under Display & interaction.', 'Statement export remembers the last valid period, date range, card, billing cycle and export format on this device.'] },
  { title: 'Sync, privacy and troubleshooting', icon: RefreshCw, body: ['Offline changes are kept locally and synchronized when connectivity returns.', 'If sync is pending, keep the app open or return online and use Sync again.', 'Never share your password or exported statements publicly. If an export does not download, check browser download permissions and pop-up permissions for Print.'] },
];

type HelpGuidePageProps = { theme: 'dark' | 'light' | 'system'; resolvedTheme: 'dark' | 'light'; onToggleTheme: () => void };

export default function HelpGuidePage({ theme, resolvedTheme, onToggleTheme }: HelpGuidePageProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const visibleSections = useMemo(() => { const q = query.trim().toLowerCase(); return q ? sections.filter(section => `${section.title} ${section.body.join(' ')}`.toLowerCase().includes(q)) : sections; }, [query]);
  return <div className="help-guide-page space-y-4">
    <AppHeader title="Help & Guide" subtitle="How to use Credit Card Ledger" theme={theme} resolvedTheme={resolvedTheme} onToggleTheme={onToggleTheme} onBack={()=>navigate('/settings')} className="-mx-4 -mt-4 mb-4" />
    <div className="help-quick-help rounded-2xl border p-4"><div className="flex items-center gap-2 font-semibold"><Search size={17}/> Quick help</div><p className="help-secondary-copy mt-1 text-sm leading-6">Search or expand a topic below for practical instructions. This guide covers the current application workflows.</p><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search help topics…" aria-label="Search help topics" className="help-search-input mt-3 w-full rounded-xl border px-3 py-3 text-sm"/></div>
    {visibleSections.map(({title, icon: Icon, body}) => <details key={title} className="help-topic-card rounded-2xl border p-4"><summary className="flex cursor-pointer list-none items-center gap-3 font-semibold"><span className="help-topic-icon flex h-9 w-9 items-center justify-center rounded-xl"><Icon size={18}/></span><span className="flex-1">{title}</span><span className="text-neutral-500">＋</span></summary><ul className="help-topic-body mt-3 space-y-2 border-t pt-3">{body.map(item => <li key={item} className="flex gap-2 text-sm leading-6"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400"/><span>{item}</span></li>)}</ul></details>)}
    {visibleSections.length === 0 && <p className="help-topic-card rounded-2xl border p-4 text-sm">No help topics match your search.</p>}
    <div className="help-topic-card rounded-2xl border p-4"><div className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/> Data safety</div><p className="help-secondary-copy mt-1 text-sm leading-6">Display preferences are stored locally on this device. Financial records remain in the application's existing data storage and synchronization flow.</p></div>
  </div>;
}
