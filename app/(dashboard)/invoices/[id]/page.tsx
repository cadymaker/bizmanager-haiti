'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatMoney, currencySymbol } from '@/lib/currency';

interface Item { name: string; quantity: number; unit_price: number; total: number; product_id?: string | null; }

interface InvoiceFull {
  id: string;
  invoice_number: string;
  issue_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  currency: string;
  metadata: { items?: Item[]; discount?: number };
  client: { name?: string; phone?: string; address?: string } | null;
  client_id?: string | null;
}

interface BizInfo {
  business_name: string;
  owner_name: string;
  phone?: string;
  address?: string;
  street?: string;
  city?: string;
  department?: string;
  logo_url?: string;
}

interface Client { id: string; name: string; }
interface Product { id: string; name: string; sale_price: number; quantity: number; }

// Dat san pwoblèm timezone: nou pran sèlman pati dat la (YYYY-MM-DD)
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
  const id = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceFull | null>(null);
  const [biz, setBiz] = useState<BizInfo | null>(null);
  const [logoBase64, setLogoBase64] = useState('');
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [generating, setGenerating] = useState(false);

  // ---- Eta pou MODIFYE ----
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [eClientId, setEClientId] = useState('');
  const [eItems, setEItems] = useState<Item[]>([]);
  const [eDiscount, setEDiscount] = useState(0);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, total_amount, amount_paid, balance_due, status, currency, metadata, client_id, client:clients(name, phone, address)')
      .eq('id', id)
      .single();
    setInvoice(inv as any);

    const { data: business } = await supabase
      .from('businesses')
      .select('business_name, owner_name, phone, address, street, city, department, logo_url')
      .eq('id', session.user.id)
      .single();
    setBiz(business);

    // Kliyan ak pwodwi pou fòm modifikasyon an
    const { data: cl } = await supabase
      .from('clients')
      .select('id, name')
      .eq('business_id', session.user.id)
      .order('name');
    setClients(cl ?? []);

    const { data: pr } = await supabase
      .from('products')
      .select('id, name, sale_price, quantity')
      .eq('business_id', session.user.id)
      .order('name');
    setProducts(pr ?? []);

    // Konvèti logo a an base64 pou l parèt nan PDF (evite pwoblèm CORS)
    if (business?.logo_url) {
      try {
        const res = await fetch(business.logo_url);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      } catch {
        // si li echwe, logo a p ap nan PDF la men rès la ap bon
      }
    }

    setLoading(false);
  }

  // Louvri fòm modifikasyon an ak done aktyèl fakti a
  function startEdit() {
    if (!invoice) return;
    setEClientId(invoice.client_id ?? '');
    const current = (invoice.metadata?.items ?? []).map(it => ({
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: it.quantity * it.unit_price,
      product_id: it.product_id ?? null,
    }));
    setEItems(current.length ? current : [{ name: '', quantity: 1, unit_price: 0, total: 0, product_id: null }]);
    setEDiscount(invoice.metadata?.discount ?? 0);
    setMsg('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setMsg('');
  }

  function eUpdateItem(i: number, field: keyof Item, value: string | number) {
    const copy = [...eItems];
    (copy[i] as any)[field] = value;
    setEItems(copy);
  }

  function eSelectProduct(i: number, productId: string) {
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

  function eAddItemRow() {
    setEItems([...eItems, { name: '', quantity: 1, unit_price: 0, total: 0, product_id: null }]);
  }

  function eRemoveItem(i: number) {
    setEItems(eItems.filter((_, idx) => idx !== i));
  }

  const eSubtotal = eItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
  const eTotalAfterDiscount = Math.max(0, eSubtotal - eDiscount);

  // ---- ANREJISTRE MODIFIKASYON YO (ak ajisteman stock) ----
  async function saveEdit() {
    if (!invoice) return;
    const validItems = eItems.filter(it => it.name.trim() && it.quantity > 0);
    if (validItems.length === 0) { setMsg('Ajoute omwen yon atik.'); return; }

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // 1) Kalkile kantite ANSYEN pa pwodwi (sa ki te sove nan fakti a)
    const oldByProduct: Record<string, number> = {};
    for (const it of (invoice.metadata?.items ?? [])) {
      if (it.product_id) {
        oldByProduct[it.product_id] = (oldByProduct[it.product_id] ?? 0) + (it.quantity ?? 0);
      }
    }

    // 2) Kalkile kantite NOUVO pa pwodwi (apre modifikasyon an)
    const newByProduct: Record<string, number> = {};
    for (const it of validItems) {
      if (it.product_id) {
        newByProduct[it.product_id] = (newByProduct[it.product_id] ?? 0) + it.quantity;
      }
    }

    // 3) Pou chak pwodwi, delta = nouvo − ansyen.
    //    delta > 0 → nou bezwen retire plis nan stock (fòk gen ase)
    //    delta < 0 → nou remonte stock
const allProductIds = Array.from(new Set([...Object.keys(oldByProduct), ...Object.keys(newByProduct)]));

    // Verifye stock ase anvan nou touche anyen
    for (const pid of allProductIds) {
      const delta = (newByProduct[pid] ?? 0) - (oldByProduct[pid] ?? 0);
      if (delta > 0) {
        const prod = products.find(p => p.id === pid);
        const stock = prod?.quantity ?? 0;
        if (delta > stock) {
          setMsg(`Stock pa ase pou "${prod?.name ?? 'pwodwi'}". Ou gen ${stock} an plis disponib, ou bezwen ${delta} an plis.`);
          return;
        }
      }
    }

    setSaving(true);

    const rawTotal = validItems.reduce((s, it) => s + (it.quantity * it.unit_price), 0);
    const finalTotal = Math.max(0, rawTotal - eDiscount);

    // Nouvo estati dapre peman ki deja fèt
    let newStatus = invoice.status;
    if (invoice.amount_paid <= 0) newStatus = 'sent';
    else if (invoice.amount_paid >= finalTotal) newStatus = 'paid';
    else newStatus = 'partial';

    // 4) Mete fakti a ajou (SAN balance_due — Postgres kalkile l otomatikman)
    const { error } = await supabase
      .from('invoices')
      .update({
        client_id: eClientId || null,
        subtotal: rawTotal,
        total_amount: finalTotal,
        status: newStatus,
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
      setSaving(false);
      return;
    }

    // 5) Aplike ajisteman stock la (delta pa pwodwi)
    for (const pid of allProductIds) {
      const delta = (newByProduct[pid] ?? 0) - (oldByProduct[pid] ?? 0);
      if (delta === 0) continue;
      const prod = products.find(p => p.id === pid);
      const currentStock = prod?.quantity ?? 0;
      const nextStock = currentStock - delta; // retire delta (si negatif, li remonte)
      await supabase
        .from('products')
        .update({ quantity: nextStock })
        .eq('id', pid);
    }

    setMsg('Modifikasyon anrejistre!');
    setEditing(false);
    setSaving(false);
    load();
    setTimeout(() => setMsg(''), 3000);
  }

  async function deleteInvoice() {
    if (!invoice) return;
    if (!confirm(`Efase fakti ${invoice.invoice_number}? Si li te gen pwodwi ki soti nan envantè, stock yo ap remonte. Aksyon sa a pa ka defèt.`)) return;

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const items = invoice.metadata?.items ?? [];
    for (const it of items as any[]) {
      if (it.product_id) {
        const { data: prod } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', it.product_id)
          .single();
        if (prod) {
          await supabase
            .from('products')
            .update({ quantity: prod.quantity + (it.quantity ?? 0) })
            .eq('id', it.product_id);
        }
      }
    }

    const { error } = await supabase.from('invoices').delete().eq('id', invoice.id);
    if (!error) {
      router.push('/invoices');
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  async function recordPayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setMsg('Antre yon montan valab.'); return; }
    if (!invoice) return;

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('payments').insert({
      invoice_id: invoice.id,
      business_id: session.user.id,
      amount,
      method: 'cash',
    });

    if (!error) {
      setMsg('Peman anrejistre!');
      setPayAmount('');
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  // ---- Jenere PDF la DIRÈKTEMAN ak jsPDF, wotè egzak kontni an ----
  async function downloadPDF() {
    if (!invoice) return;
    setGenerating(true);
    try {
      const { default: jsPDF } = await import('jspdf');

      const pageW = 210;              // lajè A4 (mm) — toujou rete lajè a
      const marginX = 15;
      const rightX = pageW - marginX;
      const SECTION_GAP = 12;         // espas ~1.2cm ant gwo seksyon yo

      const clean = (s: string) => (s || '').replace(/[\u202F\u00A0\u2009\u2007]/g, ' ');
      const money = (n: number) => clean(fmt(n));

      const items = invoice.metadata?.items ?? [];
      const discount = invoice.metadata?.discount ?? 0;

      const draw = (pdf: any): number => {
        const setColor = (c: number[]) => pdf.setTextColor(c[0], c[1], c[2]);
        let y = 15;

        // ANTÈT
        let textX = marginX;
        const logoMax = 20;
        if (logoBase64) {
          try {
            const props = pdf.getImageProperties(logoBase64);
            let w = logoMax, h = logoMax;
            if (props.width && props.height) {
              const r = props.width / props.height;
              if (r >= 1) { w = logoMax; h = logoMax / r; } else { h = logoMax; w = logoMax * r; }
            }
            pdf.addImage(logoBase64, 'PNG', marginX, y, w, h);
            textX = marginX + logoMax + 4;
          } catch { textX = marginX; }
        }

        let by = y + 4;
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); setColor([17, 24, 39]);
        pdf.text(biz?.business_name || '', textX, by); by += 6;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); setColor([107, 114, 128]);
        if (biz?.street) { pdf.text(biz.street, textX, by); by += 4; }
        if (biz?.phone) { pdf.text(biz.phone, textX, by); by += 4; }
        const cityLine = [biz?.city, biz?.department].filter(Boolean).join(', ');
        pdf.text((cityLine ? cityLine + ', ' : '') + 'Ayiti', textX, by); by += 4;

        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); setColor([37, 99, 235]);
        pdf.text('FAKTI', rightX, y + 4, { align: 'right' });
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); setColor([55, 65, 81]);
        pdf.text(invoice.invoice_number, rightX, y + 11, { align: 'right' });
        pdf.setFontSize(9); setColor([107, 114, 128]);
        pdf.text(formatInvoiceDate(invoice.issue_date), rightX, y + 16, { align: 'right' });

        const reservedTop = logoBase64 ? logoMax : 0;
        y = Math.max(by, y + reservedTop) + 3;

        pdf.setDrawColor(37, 99, 235); pdf.setLineWidth(0.6);
        pdf.line(marginX, y, rightX, y); y += 6;

        // KLIYAN
        if (invoice.client && (invoice.client.name || invoice.client.phone || invoice.client.address)) {
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); setColor([156, 163, 175]);
          pdf.text('FAKTI POU', marginX, y); y += 4.5;
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); setColor([17, 24, 39]);
          if (invoice.client.name) { pdf.text(invoice.client.name, marginX, y); y += 4.5; }
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); setColor([107, 114, 128]);
          if (invoice.client.phone) { pdf.text(invoice.client.phone, marginX, y); y += 4; }
          if (invoice.client.address) { pdf.text(invoice.client.address, marginX, y); y += 4; }
        }

        y += SECTION_GAP;

        // TABLO ATIK
        const tableW = pageW - marginX * 2;
        const totalTX = rightX - 2;
        const priTX = totalTX - 30;
        const qteTX = priTX - 26;
        const nameW = (qteTX - 6) - marginX;

        const headH = 8;
        pdf.setFillColor(37, 99, 235); pdf.rect(marginX, y, tableW, headH, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); setColor([255, 255, 255]);
        pdf.text('Atik', marginX + 2, y + 5.5);
        pdf.text('Qté', qteTX, y + 5.5, { align: 'right' });
        pdf.text('Pri', priTX, y + 5.5, { align: 'right' });
        pdf.text('Total', totalTX, y + 5.5, { align: 'right' });
        y += headH;

        pdf.setFontSize(9);
        items.forEach((it, i) => {
          const nameLines = pdf.splitTextToSize(it.name || '', nameW);
          const rowH = Math.max(7, nameLines.length * 4.5 + 3);
          if (i % 2 === 0) { pdf.setFillColor(249, 250, 251); pdf.rect(marginX, y, tableW, rowH, 'F'); }
          setColor([31, 41, 55]); pdf.setFont('helvetica', 'normal');
          pdf.text(nameLines, marginX + 2, y + 5);
          pdf.text(String(it.quantity), qteTX, y + 5, { align: 'right' });
          pdf.text(money(it.unit_price), priTX, y + 5, { align: 'right' });
          pdf.setFont('helvetica', 'bold');
          pdf.text(money(it.total), totalTX, y + 5, { align: 'right' });
          y += rowH;
        });

        y += SECTION_GAP;

        // TOTAL YO
        const labelX = rightX - 50;
        let ty = y;
        const line = (label: string, value: string, o?: { color?: number[]; bold?: boolean; size?: number }) => {
          pdf.setFont('helvetica', o?.bold ? 'bold' : 'normal');
          pdf.setFontSize(o?.size ?? 9); setColor(o?.color ?? [55, 65, 81]);
          pdf.text(label, labelX, ty); pdf.text(value, rightX, ty, { align: 'right' });
          ty += 5.5;
        };
        if (discount > 0) {
          line('Sou-total', money(invoice.total_amount + discount), { color: [107, 114, 128] });
          line('Rabè', '- ' + money(discount), { color: [22, 163, 74] });
        }
        pdf.setDrawColor(209, 213, 219); pdf.setLineWidth(0.3);
        pdf.line(labelX, ty - 3.5, rightX, ty - 3.5);
        line('Total', money(invoice.total_amount), { bold: true, size: 12, color: [17, 24, 39] });
        if (invoice.amount_paid > 0) {
          line('Peye', '- ' + money(invoice.amount_paid), { color: [22, 163, 74] });
          pdf.line(labelX, ty - 3.5, rightX, ty - 3.5);
          line('Solde dû', money(invoice.balance_due), { bold: true, size: 11, color: [234, 88, 12] });
        }
        ty += 3;

        // BA PAJ
        const footY = ty + 8;
        pdf.setDrawColor(229, 231, 235); pdf.setLineWidth(0.3);
        pdf.line(marginX, footY - 4, rightX, footY - 4);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); setColor([156, 163, 175]);
        pdf.text('Mèsi pou konfyans ou! Peman: Cash, MonCash', pageW / 2, footY, { align: 'center' });

        return footY + 4;
      };

      const scratch = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const contentBottom = draw(scratch);
      const pageH = contentBottom + 6;

      const orientation = pageH >= pageW ? 'p' : 'l';
      const pdf = new jsPDF({ orientation, unit: 'mm', format: [pageW, pageH] });
      draw(pdf);
      pdf.save(`${invoice.invoice_number}.pdf`);
    } catch (e: any) {
      setMsg('Erè PDF: ' + (e?.message || 'eseye ankò'));
    } finally {
      setGenerating(false);
    }
  }

  const fmt = (n: number) => formatMoney(n, invoice?.currency);
  const sym = currencySymbol(invoice?.currency);

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;
  if (!invoice) return <div className="p-6 text-gray-400">Fakti pa jwenn.</div>;

  const items = invoice.metadata?.items ?? [];
  const logoSrc = logoBase64 || biz?.logo_url;

  // ====== MÒD MODIFIKASYON ======
  if (editing) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Modifye fakti {invoice.invoice_number}</h1>
          <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-800">← Anile</button>
        </div>

        {msg && (
          <div className={`text-sm rounded-lg p-3 ${msg.startsWith('Erè') || msg.startsWith('Stock') || msg.startsWith('Ajoute') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</div>
        )}

        {invoice.amount_paid > 0 && (
          <div className="bg-blue-50 text-blue-700 text-sm rounded-lg p-3">
            Fakti sa a gen {fmt(invoice.amount_paid)} ki deja peye. Solde a ap rekalkile otomatikman.
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
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
            <p className="text-xs text-gray-400 mb-2">Chwazi yon pwodwi nan envantè a, oswa tape yon atik lib. (Pri an {sym})</p>
            <div className="space-y-3 mt-1">
              {eItems.map((it, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
                  {products.length > 0 && (
                    <select value={it.product_id ?? ''} onChange={e => eSelectProduct(i, e.target.value)}
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
                      onChange={e => eUpdateItem(i, 'name', e.target.value)}
                      readOnly={!!it.product_id}
                      className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <input type="number" placeholder="Qté" value={it.quantity === 0 ? '' : it.quantity} min="1"
                      onChange={e => eUpdateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                    <input type="number" placeholder="Pri" value={it.unit_price === 0 ? '' : it.unit_price}
                      onChange={e => eUpdateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      readOnly={!!it.product_id}
                      className={`w-24 px-2 py-2 border border-gray-200 rounded-lg text-sm ${it.product_id ? 'bg-gray-100' : 'bg-white'}`} />
                    <span className="w-24 text-sm text-gray-600 text-right">{fmt(it.quantity * it.unit_price)}</span>
                    {eItems.length > 1 && (
                      <button type="button" onClick={() => eRemoveItem(i)}
                        className="text-red-500 text-sm px-2">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={eAddItemRow}
              className="mt-2 text-sm text-blue-600 hover:underline">+ Ajoute atik</button>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Sou-total:</span>
              <span className="text-sm font-medium w-28 text-right">{fmt(eSubtotal)}</span>
            </div>
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Rabè ({sym}):</span>
              <input type="number" value={eDiscount === 0 ? '' : eDiscount} placeholder="0"
                onChange={e => setEDiscount(parseFloat(e.target.value) || 0)}
                className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right" />
            </div>
            <div className="flex justify-end items-center gap-4">
              <span className="text-sm text-gray-500">Total:</span>
              <span className="text-lg font-semibold w-28 text-right">{fmt(eTotalAfterDiscount)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <div className="flex justify-end items-center gap-4">
                <span className="text-sm text-gray-500">Nouvo solde:</span>
                <span className="text-sm font-medium w-28 text-right text-orange-600">
                  {fmt(Math.max(0, eTotalAfterDiscount - invoice.amount_paid))}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Ap anrejistre...' : 'Anrejistre modifikasyon yo'}
            </button>
            <button onClick={cancelEdit} disabled={saving}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
              Anile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ====== MÒD NÒMAL (gade fakti a) ======
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <button onClick={() => router.push('/invoices')}
          className="text-sm text-gray-500 hover:text-gray-800">← Retounen</button>
        <div className="flex gap-2">
          <button onClick={startEdit}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
            Modifye
          </button>
          <button onClick={downloadPDF} disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
            {generating ? 'Ap prepare...' : 'Telechaje PDF'}
          </button>
          <button onClick={deleteInvoice}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
            Efase fakti
          </button>
        </div>
      </div>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      {/* Apèsi sou ekran (responsive). PDF la jenere apa, li p ap depann de sa a. */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
          <div className="flex items-center gap-4">
            {logoSrc && (
              <img src={logoSrc} alt="Logo" style={{ width: 64, height: 64 }}
                className="object-contain rounded" />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{biz?.business_name}</h1>
              {biz?.street && <p className="text-sm text-gray-500">{biz.street}</p>}
              {biz?.phone && <p className="text-sm text-gray-500">{biz.phone}</p>}
              <p className="text-sm text-gray-500">
                {[biz?.city, biz?.department].filter(Boolean).join(', ')}
                {(biz?.city || biz?.department) ? ', Ayiti' : 'Ayiti'}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-2xl font-bold text-blue-600">FAKTI</div>
            <div className="text-sm font-mono text-gray-700 mt-1">{invoice.invoice_number}</div>
            <div className="text-sm text-gray-500 mt-1">{formatInvoiceDate(invoice.issue_date)}</div>
          </div>
        </div>

        <div className="border-t-2 border-blue-600 mb-4" />

        {invoice.client && (
          <div className="mb-6">
            <p className="text-xs uppercase text-gray-400">Fakti pou</p>
            <p className="font-semibold">{invoice.client.name}</p>
            {invoice.client.phone && <p className="text-sm text-gray-500">{invoice.client.phone}</p>}
            {invoice.client.address && <p className="text-sm text-gray-500">{invoice.client.address}</p>}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm mb-6 min-w-[420px]">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left px-3 py-2">Atik</th>
                <th className="text-right px-3 py-2">Qté</th>
                <th className="text-right px-3 py-2">Pri</th>
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 text-right">{it.quantity}</td>
                  <td className="px-3 py-2 text-right">{fmt(it.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            {(invoice.metadata?.discount ?? 0) > 0 && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Sou-total</span>
                  <span>{fmt(invoice.total_amount + (invoice.metadata?.discount ?? 0))}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Rabè</span>
                  <span>- {fmt(invoice.metadata?.discount ?? 0)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total</span><span>{fmt(invoice.total_amount)}</span>
            </div>
            {invoice.amount_paid > 0 && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Peye</span><span>- {fmt(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between font-bold text-orange-600 border-t pt-1">
                  <span>Solde dû</span><span>{fmt(invoice.balance_due)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t mt-8 pt-4 text-center text-xs text-gray-400">
          Mèsi pou konfyans ou! Peman: Cash, MonCash
        </div>
      </div>

      {/* SEKSYON PEMAN */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-medium text-gray-800 mb-1">Anrejistre yon peman</h3>
        <p className="text-sm text-gray-500 mb-3">
          Solde ki rete: <strong className="text-orange-600">{fmt(invoice.balance_due)}</strong>
        </p>
        {invoice.balance_due > 0 ? (
          <div className="flex gap-2">
            <input type="number" placeholder="Montan peman"
              value={payAmount} onChange={e => setPayAmount(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <button onClick={recordPayment}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              Anrejistre
            </button>
          </div>
        ) : (
          <p className="text-green-600 text-sm font-medium">✓ Fakti sa a soldé nèt!</p>
        )}
      </div>
    </div>
  );
}