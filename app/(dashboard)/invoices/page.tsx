'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney, currencySymbol } from '@/lib/currency';

interface Item {
  name: string;
  quantity: number;
  unit_price: number;
  product_id?: string | null;
}
interface Client { id: string; name: string; }
interface Product { id: string; name: string; sale_price: number; quantity: number; }
interface Promotion {
  id: string;
  code: string;
  label: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}
interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  issue_date: string;
  client: { name?: string } | null;
}

function formatInvoiceDate(dateStr: string): string {
  const datePart = (dateStr || '').split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return dateStr || '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d)}/${pad(m)}/${y}`;
}

function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState('HTG');
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: 1, unit_price: 0, product_id: null }]);

  // ===== Rabè =====
  const [discountMode, setDiscountMode] = useState<'none' | 'manual' | 'promo'>('none');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [discountInput, setDiscountInput] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoErr, setPromoErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('currency')
      .eq('id', ctx.businessId)
      .single();
    setCurrency(biz?.currency ?? 'HTG');

    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, amount_paid, balance_due, status, issue_date, client:clients(name)')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });
    setInvoices((inv as any) ?? []);

    const { data: cl } = await supabase
      .from('clients')
      .select('id, name')
      .eq('business_id', ctx.businessId)
      .order('name');
    setClients(cl ?? []);

    const { data: pr } = await supabase
      .from('products')
      .select('id, name, sale_price, quantity')
      .eq('business_id', ctx.businessId)
      .order('name');
    setProducts(pr ?? []);

    const { data: promo } = await supabase
      .from('promotions')
      .select('id, code, label, discount_type, discount_value, min_amount, starts_at, ends_at, is_active')
      .eq('business_id', ctx.businessId)
      .eq('is_active', true);
    setPromotions((promo as any) ?? []);

    setLoading(false);
  }

  function updateItem(i: number, field: keyof Item, value: string | number) {
    const copy = [...items];
    (copy[i] as any)[field] = value;
    setItems(copy);
  }

  function selectProduct(i: number, productId: string) {
    const copy = [...items];
    if (productId === '') {
      copy[i].product_id = null;
      setItems(copy);
      return;
    }
    const prod = products.find(p => p.id === productId);
    if (prod) {
      copy[i].product_id = prod.id;
      copy[i].name = prod.name;
      copy[i].unit_price = prod.sale_price;
    }
    setItems(copy);
  }

  function addItemRow() {
    setItems([...items, { name: '', quantity: 1, unit_price: 0, product_id: null }]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  const subtotal = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  function computeDiscount(): { amount: number; type: string | null; value: number } {
    if (discountMode === 'promo' && appliedPromo) {
      const amt = appliedPromo.discount_type === 'percent'
        ? (subtotal * appliedPromo.discount_value) / 100
        : appliedPromo.discount_value;
      return {
        amount: Math.min(Math.max(0, amt), subtotal),
        type: appliedPromo.discount_type,
        value: appliedPromo.discount_value,
      };
    }
    if (discountMode === 'manual') {
      const v = parseFloat(discountInput) || 0;
      if (v <= 0) return { amount: 0, type: null, value: 0 };
      const amt = discountType === 'percent' ? (subtotal * v) / 100 : v;
      return {
        amount: Math.min(Math.max(0, amt), subtotal),
        type: discountType,
        value: v,
      };
    }
    return { amount: 0, type: null, value: 0 };
  }

  const discount = computeDiscount();
  const totalAfterDiscount = Math.max(0, subtotal - discount.amount);

  function applyPromo() {
    setPromoErr('');
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    const promo = promotions.find(p => p.code.toUpperCase() === code);
    if (!promo) { setPromoErr('Kòd promo sa a pa egziste.'); return; }
    if (!promo.is_active) { setPromoErr('Kòd promo sa a pa aktif.'); return; }

    const today = todayLocalDate();
    if (promo.starts_at && today < promo.starts_at) {
      setPromoErr(`Promo a kòmanse ${promo.starts_at}.`);
      return;
    }
    if (promo.ends_at && today > promo.ends_at) {
      setPromoErr('Promo sa a fini deja.');
      return;
    }
    if (promo.min_amount && subtotal < Number(promo.min_amount)) {
      setPromoErr(`Fakti a dwe omwen ${fmt(Number(promo.min_amount))} pou promo sa a.`);
      return;
    }

    setAppliedPromo(promo);
    setDiscountMode('promo');
    setPromoInput('');
  }

  function clearDiscount() {
    setDiscountMode('none');
    setDiscountInput('');
    setPromoInput('');
    setAppliedPromo(null);
    setPromoErr('');
  }

  async function saveInvoice(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter(it => it.name.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setMsg('Ajoute omwen yon atik.');
      return;
    }

    for (const it of validItems) {
      if (it.product_id) {
        const prod = products.find(p => p.id === it.product_id);
        if (prod && it.quantity > prod.quantity) {
          setMsg(`Stock pa ase pou "${prod.name}". Ou gen ${prod.quantity} an stock, ou eseye vann ${it.quantity}.`);
          return;
        }
      }
    }

    setSaving(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setSaving(false); return; }

    const rawTotal = validItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

    let discAmount = 0;
    if (discountMode === 'promo' && appliedPromo) {
      discAmount = appliedPromo.discount_type === 'percent'
        ? (rawTotal * appliedPromo.discount_value) / 100
        : appliedPromo.discount_value;
    } else if (discountMode === 'manual') {
      const v = parseFloat(discountInput) || 0;
      discAmount = discountType === 'percent' ? (rawTotal * v) / 100 : v;
    }
    discAmount = Math.min(Math.max(0, discAmount), rawTotal);

    const finalTotal = Math.max(0, rawTotal - discAmount);
    const promoCode = discountMode === 'promo' && appliedPromo ? appliedPromo.code : null;

    const { data: inserted, error } = await supabase.from('invoices').insert({
      business_id: ctx.businessId,
      client_id: clientId || null,
      niche_template: 'retail',
      issue_date: todayLocalDate(),
      subtotal: rawTotal,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: finalTotal,
      amount_paid: 0,
      currency: currency,
      status: 'sent',
      discount_type: discount.type,
      discount_value: discount.value,
      discount_amount: discAmount,
      promo_code: promoCode,
      metadata: {
        items: validItems.map(it => ({
          name: it.name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          total: it.quantity * it.unit_price,
          product_id: it.product_id ?? null,
        })),
        subtotal: rawTotal,
        discount: discAmount,
      },
    }).select('id').single();

    if (error) {
      setMsg('Erè: ' + error.message);
      setSaving(false);
      return;
    }

    // Desann stock la atravè fonksyon sekirize a
    for (const it of validItems) {
      if (it.product_id) {
        await supabase.rpc('decrement_stock', {
          p_product_id: it.product_id,
          p_quantity: it.quantity,
        });
      }
    }

    if (promoCode && appliedPromo) {
      const { data: pr } = await supabase
        .from('promotions')
        .select('times_used')
        .eq('id', appliedPromo.id)
        .single();
      if (pr) {
        await supabase
          .from('promotions')
          .update({ times_used: Number(pr.times_used || 0) + 1 })
          .eq('id', appliedPromo.id);
      }
    }

    setLastCreatedId(inserted?.id ?? null);
    setMsg('Fakti kreye ak siksè!');
    setShowForm(false);
    setClientId('');
    setItems([{ name: '', quantity: 1, unit_price: 0, product_id: null }]);
    clearDiscount();
    load();
    setSaving(false);
  }

  const fmt = (n: number) => formatMoney(n, currency);
  const sym = currencySymbol(currency);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Fakti</h1>
        <button onClick={() => { setShowForm(!showForm); setLastCreatedId(null); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          {showForm ? 'Fèmen' : '+ Nouvo fakti'}
        </button>
      </div>

      {msg && !lastCreatedId && (
        <div className={`text-sm rounded-lg p-3 ${msg.startsWith('Erè') || msg.startsWith('Stock') || msg.startsWith('Ajoute') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>
      )}

      {lastCreatedId && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-green-800">Fakti kreye ak siksè!</p>
            <p className="text-sm text-green-600 mt-0.5">Ou ka voye l bay kliyan an kounye a.</p>
          </div>
          <div className="flex gap-2">
            <a href={`/invoices/${lastCreatedId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 whitespace-nowrap shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Voye bay kliyan
            </a>
            <button onClick={() => setLastCreatedId(null)}
              className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              Fèmen
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={saveInvoice} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">Kliyan</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">— Chwazi kliyan —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Atik yo</label>
            <p className="text-xs text-gray-400 mb-2">Chwazi yon pwodwi nan envantè a, oswa tape yon atik lib. (Pri an {sym})</p>
            <div className="space-y-3 mt-1">
              {items.map((it, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
                  {products.length > 0 && (
                    <select value={it.product_id ?? ''} onChange={e => selectProduct(i, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="">— Atik lib (tape anba) —</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                          {p.name} ({p.quantity} an stock) {p.quantity <= 0 ? '- FINI' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2 items-center">
                    <input placeholder="Non atik" value={it.name}
                      onChange={e => updateItem(i, 'name', e.target.value)}
                      readOnly={!!it.product_id}
                      className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <input type="number" placeholder="Qté" value={it.quantity === 0 ? '' : it.quantity} min="1"
                      onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                    <input type="number" placeholder="Pri" value={it.unit_price === 0 ? '' : it.unit_price}
                      onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      readOnly={!!it.product_id}
                      className={`w-24 px-2 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <span className="w-24 text-sm text-gray-600 text-right">{fmt(it.quantity * it.unit_price)}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}
                        className="text-red-500 text-sm px-2">x</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItemRow}
              className="mt-2 text-sm text-blue-600 hover:underline">+ Ajoute atik</button>
          </div>

          {/* ===== RABÈ ===== */}
          <div className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Rabè</span>
              {discountMode !== 'none' && (
                <button type="button" onClick={clearDiscount}
                  className="text-xs text-red-600 hover:underline">Retire rabè</button>
              )}
            </div>

            {discountMode === 'none' && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDiscountMode('manual')}
                  className="py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 text-gray-700">
                  Rabè manyèl
                </button>
                <button type="button" onClick={() => setDiscountMode('promo')}
                  className="py-2 rounded-lg text-sm font-medium border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100">
                  Kòd promo
                </button>
              </div>
            )}

            {discountMode === 'manual' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDiscountType('percent')}
                    className={`py-2 rounded-lg text-sm font-medium border ${
                      discountType === 'percent'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}>
                    Pousantaj (%)
                  </button>
                  <button type="button" onClick={() => setDiscountType('fixed')}
                    className={`py-2 rounded-lg text-sm font-medium border ${
                      discountType === 'fixed'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}>
                    Montan fiks ({sym})
                  </button>
                </div>
                <input
                  type="number"
                  placeholder={discountType === 'percent' ? 'Egzanp: 10' : 'Egzanp: 500'}
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-right font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}

            {discountMode === 'promo' && (
              <div className="space-y-2">
                {appliedPromo ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm text-purple-800">
                    <strong>{appliedPromo.code}</strong>
                    {appliedPromo.label && <span> — {appliedPromo.label}</span>}
                    <div className="text-xs mt-0.5">
                      {appliedPromo.discount_type === 'percent'
                        ? `${appliedPromo.discount_value}% rabè`
                        : `${fmt(appliedPromo.discount_value)} rabè`}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Antre kòd promo a"
                      value={promoInput}
                      onChange={e => setPromoInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } }}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button type="button" onClick={applyPromo}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 whitespace-nowrap">
                      Aplike
                    </button>
                  </div>
                )}
                {promoErr && (
                  <div className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700">{promoErr}</div>
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Sou-total:</span>
              <span className="text-sm font-medium w-28 text-right">{fmt(subtotal)}</span>
            </div>
            {discount.amount > 0 && (
              <div className="flex justify-end items-center gap-4">
                <span className="text-sm text-green-700">
                  Rabè {discountMode === 'promo' && appliedPromo ? `(${appliedPromo.code})` : ''}:
                </span>
                <span className="text-sm font-medium text-green-700 w-28 text-right">
                  - {fmt(discount.amount)}
                </span>
              </div>
            )}
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Total:</span>
              <span className="text-lg font-semibold w-28 text-right">{fmt(totalAfterDiscount)}</span>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Ap anrejistre...' : 'Anrejistre fakti a'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Nimewo</th>
              <th className="px-4 py-3">Kliyan</th>
              <th className="px-4 py-3">Dat</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Balans</th>
              <th className="px-4 py-3">Estati</th>
              <th className="px-4 py-3">Aksyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Chajman...</td></tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Pa gen fakti toujou.</td></tr>
            )}
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-blue-600 text-xs">
                  <a href={`/invoices/${inv.id}`} className="hover:underline">{inv.invoice_number}</a>
                </td>
                <td className="px-4 py-3">{inv.client?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{formatInvoiceDate(inv.issue_date)}</td>
                <td className="px-4 py-3">{fmt(inv.total_amount)}</td>
                <td className="px-4 py-3">
                  {inv.balance_due > 0
                    ? <span className="text-orange-600">{fmt(inv.balance_due)}</span>
                    : <span className="text-green-600">Peye nèt</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                    inv.status === 'partial' ? 'bg-orange-100 text-orange-700' :
                    inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{
                    inv.status === 'paid' ? 'Peye' :
                    inv.status === 'partial' ? 'Pasyèl' :
                    inv.status === 'sent' ? 'Voye' :
                    inv.status === 'draft' ? 'Bouyon' :
                    inv.status === 'cancelled' ? 'Anile' : inv.status
                  }</span>
                </td>
                <td className="px-4 py-3">
                  <a href={`/invoices/${inv.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 whitespace-nowrap shadow-sm">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    Voye
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}