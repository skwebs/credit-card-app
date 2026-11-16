import { useEffect, useState } from 'react';
import { DATE_FORMATS, DEFAULT_DATE_FORMAT, formatDateOnly, getDateFormat, isValidDateFormat } from '../../lib/date-utils';
import type { AppItem, Card, StateSetter } from './view-types';
import { Check, ChevronDown, CreditCard as CreditCardIcon, Info as InfoIcon, Settings as SettingsIcon, SlidersHorizontal as Sliders, Sun, Moon, Monitor, Wallet as WalletIcon, LogOut, UserRound, Eye, EyeOff, Cloud, RefreshCw, AlertTriangle } from 'lucide-react';
const formatDateExample = (format: string) => format.replace(/YYYY/g, '2026').replace(/YY/g, '26').replace(/MMMM/g, 'November').replace(/MMM/g, 'Nov').replace(/MM/g, '11').replace(/M/g, '11').replace(/DD/g, '16').replace(/D/g, '16');
type Props = { [key: string]: any; activeCards: Card[]; apps: AppItem[]; categories: string[]; setCategories: StateSetter<string[]> };

export default function SettingsView(props: Props) {
  const { Activity, Button, Download, Field, Modal, ModalLink, Pencil, Plus, Trash2, Wallet, X, activeCards, apps, budgetEditing, budgetInput, budgetMinor, budgetPct, busy, categories, currentSpend, dashboardMoney, density, modalDisplayMode, setModalDisplayMode, doInstall, editingAppId, editingAppName, editingCategory, editingCategoryName, goTab, inputClass, minorToRupees, navigate, newCategory, notify, perform, request, rupeesToMinor, setBudgetEditing, setBudgetInput, setCategories, setDensity, setEditingAppId, setEditingAppName, setEditingCategory, setEditingCategoryName, setNewCategory } = props;
  const { theme, setTheme, resolvedTheme, status, logOut, receiptStorageStatus, refreshReceiptStorageStatus } = props;
  const storageState = receiptStorageStatus?.state || 'unknown';
  const [dateFormat, setDateFormat] = useState(getDateFormat);
  const [customFormatActive, setCustomFormatActive] = useState(() => !DATE_FORMATS.includes(getDateFormat() as typeof DATE_FORMATS[number]));
  const [customDateFormat, setCustomDateFormat] = useState(() => DATE_FORMATS.includes(getDateFormat() as typeof DATE_FORMATS[number]) ? '' : getDateFormat());
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [dateFormatPickerOpen, setDateFormatPickerOpen] = useState(false);
  useEffect(() => { try { localStorage.setItem('ccm-date-format', dateFormat); } catch { /* Keep the in-memory preference if storage is unavailable. */ } }, [dateFormat]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPasswordError(''); setPasswordSuccess('');
    if (newPassword.length < 10) { setPasswordError('New password must be at least 10 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('New password and confirmation do not match.'); return; }
    setPasswordBusy(true);
    try { await props.request('change-password', 'POST', { current_password: currentPassword, new_password: newPassword }); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordFormOpen(false); setPasswordSuccess('Password changed successfully. Other active sessions have been signed out.'); }
    catch (error) { setPasswordError(error instanceof Error ? error.message : 'Unable to change password.'); }
    finally { setPasswordBusy(false); }
  };
  return (
    <div className="settings-screen">
      <div className="settings-page-intro">
        <div className="settings-page-icon"><SettingsIcon size={22}/></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight">Preferences</h2>
          <p className="mt-1 text-sm text-neutral-500">Personalize your finance workspace.</p>
        </div>
      </div>

      <div className="settings-section-label">PERSONALIZATION</div>
      <details id="appearance" name="settings-section" className="settings-accordion" open>
        <summary className="settings-accordion-summary">
          <span className="settings-row-icon"><Sun size={19}/></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Appearance</span><span className="mt-0.5 block text-xs text-neutral-500">Theme and visual preferences</span></span>
          <ChevronDown size={18} className="settings-chevron"/>
        </summary>
        <div className="settings-accordion-content"><section className="settings-detail-card">
  <p className="mb-3 text-xs text-neutral-500">Choose how Card Ledger looks on this device.</p>
  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Application theme">
    <button type="button" onClick={()=>setTheme('light')} aria-pressed={theme==='light'} className={`settings-choice ${theme==='light'?'settings-choice-active':''}`}><Sun size={18}/><span>Light</span>{theme==='light'&&<Check size={16}/>}</button>
    <button type="button" onClick={()=>setTheme('dark')} aria-pressed={theme==='dark'} className={`settings-choice ${theme==='dark'?'settings-choice-active':''}`}><Moon size={18}/><span>Dark</span>{theme==='dark'&&<Check size={16}/>}</button>
    <button type="button" onClick={()=>setTheme('system')} aria-pressed={theme==='system'} className={`settings-choice ${theme==='system'?'settings-choice-active':''}`}><Monitor size={18}/><span>System</span>{theme==='system'&&<Check size={16}/>}</button>
  </div>
</section></div>
      </details>

      <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-3"><h2 className="font-semibold">Date format</h2><p className="mt-1 text-xs leading-5 text-neutral-500">Choose how calendar dates appear throughout the app and in Excel/PDF exports. Stored dates and date calculations are not changed.</p></div>
        <div className="block text-xs font-semibold text-neutral-400">Display format
          <button type="button" aria-haspopup="dialog" aria-expanded={dateFormatPickerOpen} onClick={() => setDateFormatPickerOpen(true)} className="mt-1 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-left text-sm font-medium text-neutral-100 transition hover:border-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            <span className="min-w-0">{customFormatActive ? `Custom format · ${customDateFormat || 'Not configured'}` : `${dateFormat} · ${formatDateExample(dateFormat)}`}</span><ChevronDown size={18} className="shrink-0 text-neutral-400"/>
          </button>
        </div>
        {dateFormatPickerOpen && <Modal title="Choose date format" onClose={() => setDateFormatPickerOpen(false)}>
          <div className="space-y-2">
            {DATE_FORMATS.map(format => <button key={format} type="button" onClick={() => { setDateFormat(format); setCustomFormatActive(false); setDateFormatPickerOpen(false); }} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${!customFormatActive && dateFormat === format ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}><span className="min-w-0 text-sm font-medium">{format} <span className="text-neutral-400">· {formatDateExample(format)}</span></span>{!customFormatActive && dateFormat === format && <Check size={18} className={`shrink-0 ${resolvedTheme === 'light' ? 'text-violet-800' : 'text-violet-300'}`}/>}</button>)}
            <button type="button" onClick={() => { setCustomFormatActive(true); setDateFormatPickerOpen(false); }} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${customFormatActive ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}><span className="text-sm font-semibold">Custom format</span>{customFormatActive && <Check size={18} className={`shrink-0 ${resolvedTheme === 'light' ? 'text-violet-800' : 'text-violet-300'}`}/>}</button>
          </div>
        </Modal>}
        {customFormatActive && <label className="mt-3 block text-xs font-semibold text-neutral-400">Custom format<input value={customDateFormat} onChange={event => { setCustomDateFormat(event.target.value); if (isValidDateFormat(event.target.value)) setDateFormat(event.target.value); }} placeholder="e.g. DD.MM.YYYY" maxLength={40} className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-neutral-100"/><span className="mt-1 block font-normal text-neutral-500">Supported tokens: YYYY, YY, MMMM, MMM, MM, M, DD and D. Example: DD MMM YYYY.</span>{customDateFormat && !isValidDateFormat(customDateFormat) && <span role="alert" className="mt-1 block text-red-400">Invalid format. Use supported date tokens and separators.</span>}</label>}
        <p className="mt-3 text-xs text-neutral-500">Preview: <strong className="text-neutral-200">{formatDateOnly('2026-11-16', dateFormat)}</strong> is the current preview. Recommended default: {DEFAULT_DATE_FORMAT}. CSV exports use ISO dates (YYYY-MM-DD) for spreadsheet compatibility.</p>
      </section>

      <div className="settings-section-label">FINANCIAL SETTINGS</div>
      <details id="financial-settings" name="settings-section" className="settings-accordion">
        <summary className="settings-accordion-summary">
          <span className="settings-row-icon"><CreditCardIcon size={19}/></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Cards & budgets</span><span className="mt-0.5 block text-xs text-neutral-500">Credit cards and billing-cycle budget</span></span>
          <ChevronDown size={18} className="settings-chevron"/>
        </summary>
        <div className="settings-accordion-content"><section id="card-management" className="mb-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-bold">Credit cards</h2><p className="text-xs text-neutral-500">Add a card or update an existing card</p></div><ModalLink to="/cards/new" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={15}/> <span className="whitespace-nowrap">Add Card</span></ModalLink></div>{activeCards.length===0?<p className="text-sm text-neutral-500">No active cards yet. Use Add Card to get started.</p>:<div className="space-y-2">{activeCards.map(card=><div key={card.id} className="flex items-center gap-3 border-t border-neutral-800 pt-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{card.name}</div><div className="text-xs text-neutral-500">{card.bank_name}{card.last4?` •••• ${card.last4}`:''}</div></div><ModalLink to={`/cards/${card.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-neutral-700 px-4 py-2.5 text-sm font-semibold"><Pencil size={14}/> Edit</ModalLink><button type="button" aria-label={`Delete or archive ${card.name}`} onClick={()=>{if(confirm(`Remove ${card.name}? Cards with transaction, statement or payment history will be archived instead of permanently deleted.`))void perform(()=>request('cards','DELETE',undefined,{id:String(card.id)}),'Card removed or archived')}} className="rounded-xl p-2 text-neutral-500 hover:bg-red-950 hover:text-red-300"><Trash2 size={16}/></button></div>)}</div>}</section><section id="budget-setting" className="mb-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-4"><div className="mb-3 flex items-center gap-3"><div className="budget-icon flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-200"><Activity size={20}/></div><div><h2 className="font-bold">Billing-cycle budget</h2><p className="text-xs text-neutral-500">Dashboard progress uses combined active-cycle spending</p></div></div>{!budgetEditing?<div className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="text-xs text-neutral-500">Budget amount (₹)</div><div className="mt-1 text-xl font-bold tabular-nums">{budgetMinor>0?dashboardMoney(budgetMinor):'Not set'}</div><div className="mt-1 text-xs text-neutral-500">Current cycle total: {dashboardMoney(currentSpend)}</div></div><Button onClick={()=>{setBudgetInput(budgetMinor?minorToRupees(budgetMinor):'');setBudgetEditing(true)}}><Pencil size={15}/> Edit</Button></div>:<form className="space-y-3" onSubmit={e=>{e.preventDefault();void perform(async()=>{const amt=budgetInput.trim()?rupeesToMinor(budgetInput):0;if(!Number.isFinite(amt)||amt<0)throw new Error('Enter a valid budget amount.');await request('settings','POST',{monthly_budget_minor:amt});setBudgetEditing(false)},'Budget saved')}}><Field label="Budget amount (₹)"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">₹</span><input className={`${inputClass} pl-8`} type="number" min="0" step="0.01" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} placeholder="Set your budget" autoFocus/></div></Field><div className="flex items-center justify-between text-xs text-neutral-500"><span>Current cycle total: {dashboardMoney(currentSpend)}</span><span>{budgetMinor>0?`${budgetPct.toFixed(1)}% used`:'No budget set'}</span></div><div className="flex gap-2"><Button type="submit" disabled={busy} className="flex-1"><Check size={16}/> Save budget</Button><Button variant="secondary" disabled={busy} onClick={()=>{setBudgetInput(budgetMinor?minorToRupees(budgetMinor):'');setBudgetEditing(false)}}>Cancel</Button></div></form>}</section></div>
      </details>
      <details id="categories-payment-apps" name="settings-section" className="settings-accordion">
        <summary className="settings-accordion-summary">
          <span className="settings-row-icon"><WalletIcon size={19}/></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Categories & payment apps</span><span className="mt-0.5 block text-xs text-neutral-500">Manage expense categories and UPI apps</span></span>
          <ChevronDown size={18} className="settings-chevron"/>
        </summary>
        <div className="settings-accordion-content"><section className="mb-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-4"><div className="mb-3"><h2 className="font-bold">UPI applications</h2><p className="text-xs text-neutral-500">Manage app names used for transactions</p></div><div className="mb-3"><Button onClick={()=>navigate('/upi-apps/new')}><Plus size={15}/> Add UPI application</Button></div>{apps.length===0?<p className="text-sm text-neutral-500">Add a UPI application when you first need one.</p>:apps.map(app=><div key={app.id} className="flex items-center gap-2 border-t border-neutral-800 py-2.5">{editingAppId===app.id?<><input aria-label={`Edit ${app.name}`} autoFocus className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500" value={editingAppName} maxLength={80} onChange={e=>setEditingAppName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){setEditingAppId(null);setEditingAppName('')}if(e.key==='Enter'){e.preventDefault();const name=editingAppName.trim();if(!name){notify('Application name is required.','error');return}void perform(async()=>{await request('upi-apps','PUT',{id:app.id,name,active:app.active});setEditingAppId(null);setEditingAppName('');navigate('/settings')},'UPI application updated')}}}/><button type="button" disabled={busy||!editingAppName.trim()} onClick={()=>{const name=editingAppName.trim();if(!name)return;void perform(async()=>{await request('upi-apps','PUT',{id:app.id,name,active:app.active});setEditingAppId(null);setEditingAppName('');navigate('/settings')},'UPI application updated')}} className="rounded-xl p-2 text-emerald-300 hover:bg-emerald-950 disabled:opacity-40" aria-label={`Save ${app.name}`} title="Save changes"><Check size={17}/></button><button type="button" disabled={busy} onClick={()=>{setEditingAppId(null);setEditingAppName('');navigate('/settings')}} className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800" aria-label="Cancel editing" title="Cancel"><X size={17}/></button></>:<><div className="min-w-0 flex-1"><button type="button" onClick={()=>navigate(`/upi-apps/${app.id}`)} className={`min-w-0 flex-1 truncate text-left text-sm ${app.active?'text-neutral-200':'text-neutral-600 line-through'}`}>{app.name}{!app.active?' (inactive)':''}</button></div><button type="button" disabled={busy} onClick={()=>navigate(`/upi-apps/${app.id}/edit`)} className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-violet-200" aria-label={`Edit ${app.name}`} title="Edit app name"><Pencil size={16}/></button>{app.active===1&&<button type="button" disabled={busy} onClick={()=>{if(confirm(`Deactivate ${app.name}? Historical transactions retain the app name.`))void perform(()=>request('upi-apps','DELETE',undefined,{id:String(app.id)}),'UPI app deactivated')}} className="rounded-xl p-2 text-neutral-500 hover:bg-red-950 hover:text-red-300" aria-label={`Deactivate ${app.name}`} title="Deactivate app"><Trash2 size={16}/></button>}</>}</div>)}</section><section className="mb-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-bold">Categories</h2><p className="text-xs text-neutral-500">Manage categories available when recording expenses</p></div></div><form className="mb-3 flex gap-2" onSubmit={e=>{e.preventDefault();const name=newCategory.trim();if(!name)return;if(categories.some(c=>c.toLowerCase()===name.toLowerCase())){notify('That category already exists.','error');return}const next=[...categories,name];void perform(async()=>{await request('settings','POST',{categories:next});setCategories(next);setNewCategory('')},'Category added')}}><input className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Add category" maxLength={50}/><Button type="submit" disabled={busy||!newCategory.trim()}><Plus size={15}/> Add</Button></form>{categories.map(category=><div key={category} className="flex items-center gap-2 border-t border-neutral-800 py-2">{editingCategory===category?<><input autoFocus className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" value={editingCategoryName} maxLength={50} onChange={e=>setEditingCategoryName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){setEditingCategory(null);setEditingCategoryName('')}if(e.key==='Enter'){e.preventDefault();const name=editingCategoryName.trim();if(!name)return;const next=categories.map(c=>c===category?name:c);if(new Set(next.map(c=>c.toLowerCase())).size!==next.length){notify('That category already exists.','error');return}void perform(async()=>{await request('settings','POST',{categories:next});setCategories(next);setEditingCategory(null);setEditingCategoryName('')},'Category updated')}}}/><button type="button" disabled={busy||!editingCategoryName.trim()} onClick={()=>{const name=editingCategoryName.trim();if(!name)return;const next=categories.map(c=>c===category?name:c);if(new Set(next.map(c=>c.toLowerCase())).size!==next.length){notify('That category already exists.','error');return}void perform(async()=>{await request('settings','POST',{categories:next});setCategories(next);setEditingCategory(null);setEditingCategoryName('')},'Category updated')}} className="rounded-xl p-2 text-emerald-300" aria-label="Save category"><Check size={17}/></button><button type="button" onClick={()=>{setEditingCategory(null);setEditingCategoryName('')}} className="rounded-xl p-2 text-neutral-400" aria-label="Cancel category edit"><X size={17}/></button></>:<><span className="min-w-0 flex-1 truncate text-sm">{category}</span><button type="button" onClick={()=>{setEditingCategory(category);setEditingCategoryName(category)}} className="rounded-xl p-2 text-neutral-400 hover:text-violet-200" aria-label={`Edit ${category}`}><Pencil size={16}/></button><button type="button" disabled={busy} onClick={()=>{if(categories.length<=1){notify('Keep at least one category.','error');return}if(confirm(`Remove category “${category}” from the available list? Existing transactions will retain their saved category.`)){const next=categories.filter(c=>c!==category);void perform(async()=>{await request('settings','POST',{categories:next});setCategories(next)},'Category removed')}}} className="rounded-xl p-2 text-neutral-500 hover:text-red-300" aria-label={`Remove ${category}`}><Trash2 size={16}/></button></>}</div>)}</section></div>
      </details>

      <div className="settings-section-label">APP PREFERENCES</div>
      <details id="app-preferences" name="settings-section" className="settings-accordion">
        <summary className="settings-accordion-summary">
          <span className="settings-row-icon"><Sliders size={19}/></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Display & interaction</span><span className="mt-0.5 block text-xs text-neutral-500">Density and modal behaviour</span></span>
          <ChevronDown size={18} className="settings-chevron"/>
        </summary>
        <div className="settings-accordion-content"><section className="mb-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-4"><h2 className="font-bold">Display density</h2><p className="mt-1 text-xs text-neutral-500">Choose how much fits on screen.</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setDensity('compact')} className={`density-option rounded-xl border p-3 text-sm font-semibold ${density==='compact'?'border-violet-500 bg-violet-500/15 text-violet-200':'border-neutral-700 bg-neutral-950 text-neutral-300'}`}>Compact</button><button onClick={()=>setDensity('comfortable')} className={`rounded-xl border p-3 text-sm font-semibold ${density==='comfortable'?'border-violet-500 bg-violet-500/15 text-violet-200':'border-neutral-700 bg-neutral-950 text-neutral-300'}`}>Comfortable</button></div></section><section className="mb-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><Sliders size={19}/></div><div><h2 className="font-bold">Modal & page display</h2><p className="mt-1 text-xs leading-5 text-neutral-500">One preference controls how transaction details and edit screens open throughout the app.</p></div></div><div className="mt-3 space-y-2"><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${modalDisplayMode==='modal'?'border-violet-500 bg-violet-500/10':'border-neutral-700 bg-neutral-950'}`}><input type="radio" name="modal-display-mode" value="modal" checked={modalDisplayMode==='modal'} onChange={()=>setModalDisplayMode('modal')} className="mt-1 accent-violet-500"/><span><span className="block text-sm font-semibold">Open as modal <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-violet-300">Recommended</span></span><span className="mt-0.5 block text-xs leading-5 text-neutral-500">Details and edit forms appear over the current screen. Direct links use the Transactions screen as their background.</span></span></label><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${modalDisplayMode==='full-page'?'border-violet-500 bg-violet-500/10':'border-neutral-700 bg-neutral-950'}`}><input type="radio" name="modal-display-mode" value="full-page" checked={modalDisplayMode==='full-page'} onChange={()=>setModalDisplayMode('full-page')} className="mt-1 accent-violet-500"/><span><span className="block text-sm font-semibold">Open as full page</span><span className="mt-0.5 block text-xs leading-5 text-neutral-500">Details and edit forms replace the current screen and use normal page navigation.</span></span></label></div><p className="mt-3 text-[11px] leading-4 text-neutral-600">This setting applies consistently to transaction details and transaction editing. Other application dialogs retain their own modal behaviour.</p></section></div>
      </details>

      <div className="settings-section-label">STORAGE</div>
      <section className="receipt-storage-card rounded-3xl border p-4" aria-labelledby="receipt-storage-heading">
        <div className="flex items-start gap-3">
          <div className="settings-feature-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"><Cloud size={19} strokeWidth={2.2}/></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 id="receipt-storage-heading" className="receipt-storage-title font-semibold">Receipt storage</h2>
              <span className={`receipt-storage-status rounded-full px-2 py-1 text-[10px] font-bold ${storageState==='available'?'is-available':storageState==='checking'?'is-checking':'is-warning'}`}>{storageState==='available'?'Bucket reachable':storageState==='checking'?'Checking…':storageState==='unconfigured'?'Not configured':storageState==='unreachable'?'Unreachable':'Unknown'}</span>
            </div>
            <p className="receipt-storage-description mt-1 text-xs leading-5">{receiptStorageStatus?.message || 'Receipt storage status is not available.'}</p>
          </div>
        </div>
        {storageState!=='available'&&<div className="receipt-storage-followup receipt-storage-warning mt-3 rounded-xl border p-3"><div className="receipt-storage-warning-copy flex items-start gap-2 text-xs leading-5"><AlertTriangle size={15} className="mt-0.5 shrink-0"/><span>Image receipt uploads and previews may not work until the private Cloudflare R2 bucket is configured and reachable. Set the required server-side environment variables in your local environment or Vercel project settings.</span></div>
          {Array.isArray(receiptStorageStatus?.missing)&&receiptStorageStatus.missing.length>0&&<p className="receipt-storage-missing mt-2 break-words text-[11px]">Missing: {receiptStorageStatus.missing.join(', ')}</p>}
        </div>}
        <div className="receipt-storage-followup mt-3 flex flex-wrap items-center justify-between gap-2"><p className="receipt-storage-note text-[11px]">R2_ENDPOINT is optional when using the default Cloudflare endpoint.</p><button type="button" onClick={()=>void refreshReceiptStorageStatus?.()} disabled={storageState==='checking'} className="receipt-storage-action inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold disabled:opacity-50"><RefreshCw size={14} className={storageState==='checking'?'animate-spin':''}/> Check again</button></div>
      </section>

      <div className="settings-section-label">ACCOUNT</div>
      <section className="settings-account-card">
        <div className="settings-account-identity">
          <div className="settings-account-avatar"><UserRound size={20}/></div>
          <div className="min-w-0 flex-1">
            <p className="settings-account-name">{status?.username || 'Personal account'}</p>
            <p className="settings-account-caption">Signed in</p>
          </div>
        </div>
      </section>

      <div className="settings-section-label">SECURITY</div>
      <section className="settings-security-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Password</h2>
          <button type="button" onClick={()=>{setPasswordFormOpen(value=>!value);setPasswordError('');setPasswordSuccess('');}} className="settings-change-password-button" aria-expanded={passwordFormOpen}>{passwordFormOpen ? 'Cancel' : 'Change password'}</button>
        </div>
        {passwordSuccess && <p role="status" className="mb-3 text-sm text-emerald-500">{passwordSuccess}</p>}
        {passwordFormOpen && <form onSubmit={changePassword} className="space-y-3">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-neutral-500">Current password</span><div className="settings-password-field"><input className={`${inputClass} pr-12`} type={showCurrentPassword?'text':'password'} autoComplete="current-password" required value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} /><button type="button" className="settings-password-toggle" onClick={()=>setShowCurrentPassword(value=>!value)} aria-label={showCurrentPassword?'Hide current password':'Show current password'} aria-pressed={showCurrentPassword}>{showCurrentPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-neutral-500">New password</span><div className="settings-password-field"><input className={`${inputClass} pr-12`} type={showNewPassword?'text':'password'} autoComplete="new-password" minLength={10} required value={newPassword} onChange={event=>setNewPassword(event.target.value)} /><button type="button" className="settings-password-toggle" onClick={()=>setShowNewPassword(value=>!value)} aria-label={showNewPassword?'Hide new password':'Show new password'} aria-pressed={showNewPassword}>{showNewPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-neutral-500">Confirm new password</span><div className="settings-password-field"><input className={`${inputClass} pr-12`} type={showConfirmPassword?'text':'password'} autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} /><button type="button" className="settings-password-toggle" onClick={()=>setShowConfirmPassword(value=>!value)} aria-label={showConfirmPassword?'Hide confirmation password':'Show confirmation password'} aria-pressed={showConfirmPassword}>{showConfirmPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          {passwordError && <p role="alert" className="text-sm text-red-500">{passwordError}</p>}
          <Button type="submit" disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}>{passwordBusy ? 'Updating…' : 'Update password'}</Button>
        </form>}
      </section>

      <div className="settings-section-label">HELP &amp; SUPPORT</div>
      <section className="settings-help-card flex flex-wrap items-center gap-3 rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="settings-feature-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"><InfoIcon size={19} strokeWidth={2.2}/></div>
        <div className="min-w-0 flex-1 basis-[12rem]"><h2 className="font-semibold">Help & Guide</h2><p className="mt-1 text-xs leading-5 text-neutral-500">Learn how to manage cards, transactions, statements and preferences.</p></div>
        <button type="button" onClick={() => navigate('/help')} className="settings-help-button ml-auto rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white">Open guide</button>
      </section>
      <div className="settings-section-label">ABOUT</div>
      <details id="about" name="settings-section" className="settings-accordion">
        <summary className="settings-accordion-summary">
          <span className="settings-row-icon"><InfoIcon size={19}/></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Application & data</span><span className="mt-0.5 block text-xs text-neutral-500">App information and installation</span></span>
          <ChevronDown size={18} className="settings-chevron"/>
        </summary>
        <div className="settings-accordion-content"><section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4"><h2 className="font-bold">App and data</h2><p className="mt-2 text-sm leading-6 text-neutral-400">Private SQLite storage, responsive Android-style interface, installable PWA support, and browser-controlled session security.</p><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={()=>goTab('payments')}><Wallet size={16}/> Bill payments</Button><Button variant="secondary" onClick={()=>void doInstall()}><Download size={16}/> Install app</Button></div><p className="mt-3 text-xs text-neutral-600">For installation, use HTTPS and your browser's Install app / Add to Home screen option.</p></section></div>
      </details>
      <p className="settings-footer-note">Your preferences are applied to this application. Financial records remain unchanged when you update display settings.</p>
      <button type="button" disabled={props.busy} onClick={()=>void logOut()} className="settings-logout-button" aria-label={props.busy ? 'Logging out' : 'Log out'}>
        <LogOut size={19} aria-hidden="true" />
        <span>{props.busy ? 'Logging out…' : 'Log out'}</span>
      </button>
    </div>
  );
}
