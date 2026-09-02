'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney, currencySymbol } from '@/lib/currency';

interface Item {
  name: string;
  quantity: number;
  unit_price: number;
  total?: number;
  product_id?: string | null;
}
interface Client { id: string; name: string; }
interface Product { id: string; name: string; sale_price: number; quantity: number; }
interface InvoiceFull {
  id: string;
  invoice_number: string;
  issue_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  currency: string;
  discount_amount?: number;
  promo_code?: string | null;
  metadata: { items?: Item[]; discount?: number };
  client: { name?: string; phone?: string; address?: string } | null;
  client_id?: string | null;
}
interface BizInfo {
  business_name: string;
  logo_url?: string | null;
  street?: string;
  city?: string;
  department?: string;
  phone?: string;
}

function formatInvoiceDate(dateStr: string): string {
  const datePart = (dateStr || '').split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return dateStr || '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d)}/${pad(m)}/${y}`;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<InvoiceFull | null>(null);
  const [biz, setBiz] = useState<BizInfo | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Modifikasyon
  const [editMode, setEditMode] = useState(false);
  const [eClientId, setEClientId] = useState('');
  const [eItems, setEItems] = useState<Item[]>([]);
  const [eDiscount, setEDiscount] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: business } = await supabase
      .from('businesses')
      .select('business_name, logo_url, street, city, department, phone')
      .eq('id', ctx.businessId)
      .single();
    setBiz(business);

    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, total_amount, amount_paid, balance_due, status, currency, discount_amount, promo_code, metadata, client_id, client:clients(name, phone, address)')
      .eq('id', id)
      .single();
    setInvoice(inv as any);

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

    setLoading(false);
  }

  async function addPayment() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !invoice) return;

    setPaying(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setPaying(false); return; }

    await supabase.from('payments').insert({
      invoice_id: invoice.id,
      business_id: ctx.businessId,
      amount: amt,
      method: 'cash',
    });

    const newPaid = invoice.amount_paid + amt;
    const newStatus = newPaid >= invoice.total_amount ? 'paid' : 'partial';

    await supabase
      .from('invoices')
      .update({ amount_paid: newPaid, status: newStatus })
      .eq('id', invoice.id);

    setMsg('Peman anrejistre!');
    setAmount('');
    load();
    setPaying(false);
    setTimeout(() => setMsg(''), 3000);
  }

  // ===== Modifikasyon =====
  function startEdit() {
    if (!invoice) return;
    setEClientId(invoice.client_id ?? '');
    setEItems((invoice.metadata?.items ?? []).map(it => ({
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      product_id: it.product_id ?? null,
    })));
    setEDiscount(invoiceDiscount);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setMsg('');
  }

  function updateEItem(i: number, field: keyof Item, value: string | number) {
    const copy = [...eItems];
    (copy[i] as any)[field] = value;
    setEItems(copy);
  }

  function selectEProduct(i: number, productId: string) {
    const copy = [...eItems];
    if (productId === '') {
      copy[i].product_id = null;
      setEItems(copy);
      return;
    }
    const prod = products.find(p => p.id === productId);
    if (prod) {
      copy[i].product_id = prod.id;
      copy[i].name = prod.name;
      copy[i].unit_price = prod.sale_price;
    }
    setEItems(copy);
  }

  function addEItem() {
    setEItems([...eItems, { name: '', quantity: 1, unit_price: 0, product_id: null }]);
  }

  function removeEItem(i: number) {
    setEItems(eItems.filter((_, idx) => idx !== i));
  }

  const eSubtotal = eItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
  const eTotal = Math.max(0, eSubtotal - eDiscount);

  async function saveEdit() {
    if (!invoice) return;
    const validItems = eItems.filter(it => it.name.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setMsg('Ajoute omwen yon atik.');
      return;
    }

    setSavingEdit(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setSavingEdit(false); return; }

    // 1) Kantite ansyen pa pwodwi
    const oldByProduct: Record<string, number> = {};
    (invoice.metadata?.items ?? []).forEach(it => {
      if (it.product_id) {
        oldByProduct[it.product_id] = (oldByProduct[it.product_id] ?? 0) + it.quantity;
      }
    });

    // 2) Kantite nouvo pa pwodwi
    const newByProduct: Record<string, number> = {};
    validItems.forEach(it => {
      if (it.product_id) {
        newByProduct[it.product_id] = (newByProduct[it.product_id] ?? 0) + it.quantity;
      }
    });

    // 3) Verifye stock ase pou ogmantasyon yo
    const allProductIds = Array.from(new Set([
      ...Object.keys(oldByProduct),
      ...Object.keys(newByProduct),
    ]));

    for (const pid of allProductIds) {
      const delta = (newByProduct[pid] ?? 0) - (oldByProduct[pid] ?? 0);
      if (delta > 0) {
        const prod = products.find(p => p.id === pid);
        if (prod && delta > prod.quantity) {
          setMsg(`Stock pa ase pou "${prod.name}". Ou gen ${prod.quantity} an stock.`);
          setSavingEdit(false);
          return;
        }
      }
    }

    const rawTotal = validItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
    const finalTotal = Math.max(0, rawTotal - eDiscount);

    // Rekalkile estati a selon nouvo total la
    let newStatus = invoice.status;
    if (invoice.amount_paid >= finalTotal && finalTotal > 0) newStatus = 'paid';
    else if (invoice.amount_paid > 0) newStatus = 'partial';
    else newStatus = 'sent';

    // 4) Mete fakti a ajou (SAN balance_due — Postgres kalkile l otomatikman)
    const { error } = await supabase
      .from('invoices')
      .update({
        client_id: eClientId || null,
        subtotal: rawTotal,
        total_amount: finalTotal,
        status: newStatus,
        discount_amount: eDiscount,
        discount_type: eDiscount > 0 ? 'fixed' : null,
        discount_value: eDiscount,
        metadata: {
          items: validItems.map(it => ({
            name: it.name,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total: it.quantity * it.unit_price,
            product_id: it.product_id ?? null,
          })),
          discount: eDiscount,
        },
      })
      .eq('id', invoice.id);

    if (error) {
      setMsg('Erè: ' + error.message);
      setSavingEdit(false);
      return;
    }

    // 5) Aplike ajisteman stock la (delta pa pwodwi)
    for (const pid of allProductIds) {
      const delta = (newByProduct[pid] ?? 0) - (oldByProduct[pid] ?? 0);
      if (delta === 0) continue;
      if (delta > 0) {
        // Nou vann plis → desann stock
        await supabase.rpc('decrement_stock', {
          p_product_id: pid,
          p_quantity: delta,
        });
      } else {
        // Nou retire atik → remonte stock
        await supabase.rpc('increment_stock', {
          p_product_id: pid,
          p_quantity: Math.abs(delta),
        });
      }
    }

    setMsg('Fakti modifye!');
    setEditMode(false);
    load();
    setSavingEdit(false);
    setTimeout(() => setMsg(''), 3000);
  }

  async function deleteInvoice() {
    if (!invoice) return;
    if (!confirm(`Efase fakti ${invoice.invoice_number}? Stock la ap remonte epi tout peman yo ap efase. Aksyon sa a pa gen retou.`)) return;

    const supabase = createClient();

    // 1) Remonte stock la
    const items = invoice.metadata?.items ?? [];
    for (const it of items as any[]) {
      if (it.product_id && (it.quantity ?? 0) > 0) {
        await supabase.rpc('increment_stock', {
          p_product_id: it.product_id,
          p_quantity: it.quantity,
        });
      }
    }

    // 2) Efase peman yo
    await supabase.from('payments').delete().eq('invoice_id', invoice.id);

    // 3) Efase fakti a
    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id);

    if (error) {
      setMsg('Erè: ' + error.message);
      return;
    }

    router.push('/invoices');
  }

  const fmt = (n: number) => formatMoney(n, invoice?.currency);
  const sym = currencySymbol(invoice?.currency);

  // Rabè a: nan kolòn nan (nouvo fakti) oswa nan metadata (ansyen fakti)
  const invoiceDiscount = Number(
    invoice?.discount_amount && invoice.discount_amount > 0
      ? invoice.discount_amount
      : invoice?.metadata?.discount ?? 0
  );

  async function downloadPDF() {
    if (!invoice) return;
    setDownloading(true);

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = margin;

      const money = (n: number) => formatMoney(n, invoice.currency);

      // Logo
      if (biz?.logo_url) {
        try {
          const res = await fetch(biz.logo_url);
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          doc.addImage(dataUrl, 'PNG', margin, y, 60, 60);
        } catch { /* logo opsyonèl */ }
      }

      // Enfo biznis
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(biz?.business_name ?? '', margin + 75, y + 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      let by = y + 32;
      if (biz?.street) { doc.text(biz.street, margin + 75, by); by += 12; }
      const addrLine = [biz?.city, biz?.department].filter(Boolean).join(', ');
      if (addrLine) { doc.text(addrLine + ', Ayiti', margin + 75, by); by += 12; }
      if (biz?.phone) { doc.text(biz.phone, margin + 75, by); by += 12; }

      // FAKTI
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('FAKTI', pageW - margin, y + 18, { align: 'right' });

      doc.setTextColor(60);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.invoice_number, pageW - margin, y + 36, { align: 'right' });
      doc.text(formatInvoiceDate(invoice.issue_date), pageW - margin, y + 50, { align: 'right' });

      y = Math.max(by, y + 70);

      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(1.5);
      doc.line(margin, y, pageW - margin, y);
      y += 22;

      // Kliyan
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text('FAKTI POU', margin, y);
      y += 14;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20);
      doc.text(invoice.client?.name ?? 'Kliyan', margin, y);
      y += 14;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90);
      if (invoice.client?.phone) { doc.text(invoice.client.phone, margin, y); y += 12; }
      if (invoice.client?.address) { doc.text(invoice.client.address, margin, y); y += 12; }

      y += 12;

      // Antèt tab
      const colQty = pageW - margin - 260;
      const colPrice = pageW - margin - 150;
      const colTotal = pageW - margin;

      doc.setFillColor(37, 99, 235);
      doc.rect(margin, y, pageW - margin * 2, 24, 'F');
      doc.setTextColor(255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('ATIK', margin + 10, y + 16);
      doc.text('QTE', colQty, y + 16, { align: 'right' });
      doc.text('PRI', colPrice, y + 16, { align: 'right' });
      doc.text('TOTAL', colTotal - 10, y + 16, { align: 'right' });
      y += 24;

      // Liy atik
      doc.setTextColor(30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const items = invoice.metadata?.items ?? [];
      items.forEach((it, i) => {
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, pageW - margin * 2, 22, 'F');
        }
        doc.text(String(it.name), margin + 10, y + 15);
        doc.text(String(it.quantity), colQty, y + 15, { align: 'right' });
        doc.text(money(it.unit_price), colPrice, y + 15, { align: 'right' });
        doc.text(money(it.quantity * it.unit_price), colTotal - 10, y + 15, { align: 'right' });
        y += 22;
      });

      y += 10;
      doc.setDrawColor(220);
      doc.setLineWidth(0.5);
      doc.line(colQty - 40, y, pageW - margin, y);
      y += 18;

      const rawTotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
      const discount = Number(
        invoice.discount_amount && invoice.discount_amount > 0
          ? invoice.discount_amount
          : invoice.metadata?.discount ?? 0
      );

      const line = (label: string, val: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
        doc.setFontSize(opts?.size ?? 10);
        doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
        if (opts?.color) doc.setTextColor(...opts.color);
        else doc.setTextColor(60);
        doc.text(label, colPrice, y, { align: 'right' });
        doc.text(val, colTotal - 10, y, { align: 'right' });
        y += opts?.bold ? 20 : 16;
      };

      if (discount > 0) {
        line('Sou-total', money(rawTotal));
        line(
          invoice.promo_code ? `Rabè (${invoice.promo_code})` : 'Rabè',
          '- ' + money(discount),
          { color: [22, 163, 74] }
        );
      }
      line('Total', money(invoice.total_amount), { bold: true, size: 13, color: [20, 20, 20] });

      if (invoice.amount_paid > 0) {
        line('Peye', money(invoice.amount_paid), { color: [22, 163, 74] });
        line('Balans', money(invoice.balance_due), {
          bold: true,
          color: invoice.balance_due > 0 ? [234, 88, 12] : [22, 163, 74],
        });
      }

      // Pye paj
      const footY = doc.internal.pageSize.getHeight() - 50;
      doc.setDrawColor(230);
      doc.line(margin, footY - 20, pageW - margin, footY - 20);
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.setFont('helvetica', 'normal');
      doc.text('Mèsi pou konfyans ou! Peman: Cash, MonCash', pageW / 2, footY, { align: 'center' });

      doc.save(`${invoice.invoice_number}.pdf`);
    } catch (e: any) {
      setMsg('Erè PDF: ' + (e?.message ?? 'enkoni'));
    }

    setDownloading(false);
  }

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;
  if (!invoice) return <div className="p-6 text-gray-400">Fakti pa jwenn.</div>;

  const items = invoice.metadata?.items ?? [];
  const rawTotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const addrLine = [biz?.city, biz?.department].filter(Boolean).join(', ');

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      {/* Aksyon yo */}
      <div className="flex flex-wrap justify-between items-center gap-2 print:hidden">
        <a href="/invoices" className="text-sm text-blue-600 hover:underline">← Retounen</a>
        <div className="flex gap-2">
          {!editMode && (
            <button onClick={startEdit}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Modifye
            </button>
          )}
          <button onClick={downloadPDF} disabled={downloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {downloading ? 'Ap prepare...' : 'Telechaje PDF'}
          </button>
          {!editMode && (
            <button onClick={deleteInvoice}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100">
              Efase fakti
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`text-sm rounded-lg p-3 print:hidden ${msg.startsWith('Erè') || msg.startsWith('Stock') || msg.startsWith('Ajoute') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>
      )}

      {/* ===== MÒD MODIFIKASYON ===== */}
      {editMode ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 print:hidden">
          <h2 className="font-medium text-gray-800">Modifye fakti {invoice.invoice_number}</h2>

          <div>
            <label className="text-xs text-gray-500 font-medium">Kliyan</label>
            <select value={eClientId} onChange={e => setEClientId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">— Chwazi kliyan —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Atik yo</label>
            <div className="space-y-3 mt-1">
              {eItems.map((it, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
                  {products.length > 0 && (
                    <select value={it.product_id ?? ''} onChange={e => selectEProduct(i, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="">— Atik lib (tape anba) —</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.quantity} an stock)
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2 items-center">
                    <input placeholder="Non atik" value={it.name}
                      onChange={e => updateEItem(i, 'name', e.target.value)}
                      readOnly={!!it.product_id}
                      className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <input type="number" placeholder="Qté" value={it.quantity === 0 ? '' : it.quantity} min="1"
                      onChange={e => updateEItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                    <input type="number" placeholder="Pri" value={it.unit_price === 0 ? '' : it.unit_price}
                      onChange={e => updateEItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      readOnly={!!it.product_id}
                      className={`w-24 px-2 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <span className="w-24 text-sm text-gray-600 text-right">{fmt(it.quantity * it.unit_price)}</span>
                    {eItems.length > 1 && (
                      <button type="button" onClick={() => removeEItem(i)}
                        className="text-red-500 text-sm px-2">x</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addEItem}
              className="mt-2 text-sm text-blue-600 hover:underline">+ Ajoute atik</button>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Rabè ({sym})</label>
            <input type="number" value={eDiscount === 0 ? '' : eDiscount}
              onChange={e => setEDiscount(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>

          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Sou-total:</span>
              <span className="text-sm font-medium w-28 text-right">{fmt(eSubtotal)}</span>
            </div>
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Total:</span>
              <span className="text-lg font-semibold w-28 text-right">{fmt(eTotal)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={savingEdit}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {savingEdit ? 'Ap anrejistre...' : 'Anrejistre modifikasyon yo'}
            </button>
            <button onClick={cancelEdit}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Anile
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ===== FAKTI (afichaj) ===== */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b-2 border-blue-600">
              <div className="flex gap-4">
                {biz?.logo_url && (
                  <img src={biz.logo_url} alt="Logo"
                    className="w-16 h-16 object-contain rounded-lg border border-gray-100" />
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{biz?.business_name}</h1>
                  <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                    {biz?.street && <p>{biz.street}</p>}
                    {biz?.phone && <p>{biz.phone}</p>}
                    {addrLine && <p>{addrLine}, Ayiti</p>}
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-blue-600">FAKTI</p>
                <p className="text-sm text-gray-600 mt-1 font-mono">{invoice.invoice_number}</p>
                <p className="text-sm text-gray-500">{formatInvoiceDate(invoice.issue_date)}</p>
              </div>
            </div>

            <div className="py-6">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Fakti pou</p>
              <p className="font-semibold text-gray-900 mt-1">{invoice.client?.name ?? 'Kliyan'}</p>
              {invoice.client?.phone && <p className="text-sm text-gray-500">{invoice.client.phone}</p>}
              {invoice.client?.address && <p className="text-sm text-gray-500">{invoice.client.address}</p>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white text-xs uppercase">
                    <th className="px-3 py-2 text-left rounded-l-lg">Atik</th>
                    <th className="px-3 py-2 text-right">Qté</th>
                    <th className="px-3 py-2 text-right">Pri</th>
                    <th className="px-3 py-2 text-right rounded-r-lg">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                      <td className="px-3 py-2.5">{it.name}</td>
                      <td className="px-3 py-2.5 text-right">{it.quantity}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(it.unit_price)}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(it.quantity * it.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-2 max-w-xs ml-auto text-sm">
              {invoiceDiscount > 0 && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Sou-total</span>
                    <span>{fmt(rawTotal)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Rabè{invoice.promo_code ? ` (${invoice.promo_code})` : ''}</span>
                    <span>- {fmt(invoiceDiscount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{fmt(invoice.total_amount)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-green-600">
                    <span>Peye</span>
                    <span>{fmt(invoice.amount_paid)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold ${invoice.balance_due > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    <span>Balans</span>
                    <span>{fmt(invoice.balance_due)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-gray-100 text-center text-sm text-gray-400">
              Mèsi pou konfyans ou! Peman: Cash, MonCash
            </div>
          </div>

          {/* ===== PEMAN ===== */}
          {invoice.balance_due > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 print:hidden">
              <h2 className="font-medium text-gray-800">Anrejistre yon peman</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Solde ki rete: <strong className="text-orange-600">{fmt(invoice.balance_due)}</strong>
              </p>
              <div className="flex gap-2 mt-3">
                <input type="number" placeholder="Montan"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={amount} onChange={e => setAmount(e.target.value)} />
                <button onClick={addPayment} disabled={paying}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {paying ? '...' : 'Anrejistre'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}