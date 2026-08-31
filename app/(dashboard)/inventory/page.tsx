'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';
import { queueCount } from '@/lib/offline';

interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  purchase_price: number;
  sale_price: number;
  quantity: number;
  image_url: string | null;
  barcode: string | null;
  low_stock_threshold: number | null;
}

interface Adjustment {
  id: string;
  product_name: string;
  quantity: number;
  reason: string;
  note: string | null;
  total_cost: number;
  created_at: string;
}

const REASONS = [
  { value: 'lost', label: 'Pèdi' },
  { value: 'damaged', label: 'Gate' },
  { value: 'expired', label: 'Ekspire' },
  { value: 'other', label: 'Lòt rezon' },
];

const DEFAULT_THRESHOLD = 5;
function thresholdOf(p: { low_stock_threshold: number | null }): number {
  return p.low_stock_threshold != null && p.low_stock_threshold > 0
    ? p.low_stock_threshold
    : DEFAULT_THRESHOLD;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingSales, setPendingSales] = useState(0);

  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerRef = useRef<any>(null);
  const handledRef = useRef(false);

  const barcodeSvgRef = useRef<SVGSVGElement>(null);

  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('lost');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustErr, setAdjustErr] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', category: '', description: '',
    purchase_price: '', sale_price: '', quantity: '', image_url: '', barcode: '',
    low_stock_threshold: '',
  });

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

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('name');
    setProducts(data ?? []);

    setPendingSales(queueCount(ctx.businessId));
    setLoading(false);
  }

  function resetForm() {
    setForm({
      name: '', category: '', description: '', purchase_price: '', sale_price: '',
      quantity: '', image_url: '', barcode: '', low_stock_threshold: '',
    });
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(p: Product) {
    setForm({
      name: p.name,
      category: p.category ?? '',
      description: p.description ?? '',
      purchase_price: String(p.purchase_price),
      sale_price: String(p.sale_price),
      quantity: String(p.quantity),
      image_url: p.image_url ?? '',
      barcode: p.barcode ?? '',
      low_stock_threshold: p.low_stock_threshold != null ? String(p.low_stock_threshold) : '',
    });
    setEditId(p.id);
    setShowForm(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMsg('Imaj la twò gwo (maksimòm 2MB).');
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setUploading(false); return; }

    const ext = file.name.split('.').pop();
    const fileName = `${ctx.businessId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('products')
      .upload(fileName, file, { upsert: true });

    if (upErr) {
      setMsg('Erè upload: ' + upErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('products').getPublicUrl(fileName);
    setForm(f => ({ ...f, image_url: urlData.publicUrl }));
    setUploading(false);
  }

  function generateBarcode() {
    let code = '';
    let attempts = 0;
    do {
      const rand = Math.floor(100000 + Math.random() * 900000);
      code = '20' + rand;
      attempts++;
    } while (products.some(p => p.barcode === code) && attempts < 30);

    setForm(f => ({ ...f, barcode: code }));
    setMsg('Barcode jenere: ' + code);
    setTimeout(() => setMsg(''), 3000);
  }

  useEffect(() => {
    const code = form.barcode.trim();
    if (!code || !barcodeSvgRef.current) return;
    let cancelled = false;
    (async () => {
      const mod: any = await import('jsbarcode');
      if (cancelled || !barcodeSvgRef.current) return;
      const JsBarcode = mod.default || mod;
      try {
        JsBarcode(barcodeSvgRef.current, code, {
          format: 'CODE128',
          displayValue: true,
          fontSize: 14,
          height: 55,
          width: 2,
          margin: 8,
        });
      } catch {
        /* valè barcode envalid — inyore */
      }
    })();
    return () => { cancelled = true; };
  }, [form.barcode]);

  function printLabel() {
    const code = form.barcode.trim();
    if (!code || !barcodeSvgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(barcodeSvgRef.current);
    const priceNum = parseFloat(form.sale_price);
    const priceLine = !isNaN(priceNum) && priceNum > 0 ? fmt(priceNum) : '';

    const win = window.open('', '', 'width=420,height=320');
    if (!win) return;
    win.document.write(
      '<html><head><title>Etikèt pwodwi</title></head>' +
      '<body style="margin:0;padding:12px;text-align:center;font-family:sans-serif;">' +
      (form.name ? '<div style="font-weight:bold;font-size:14px;margin-bottom:4px;">' + form.name + '</div>' : '') +
      svgData +
      (priceLine ? '<div style="font-size:14px;font-weight:bold;margin-top:4px;">' + priceLine + '</div>' : '') +
      '</body></html>'
    );
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  function openScanner() {
    setScannerError('');
    handledRef.current = false;
    setShowScanner(true);
  }
  function closeScanner() {
    setShowScanner(false);
  }

  useEffect(() => {
    if (!showScanner) return;
    let active = true;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!active) return;
        const scanner = new Html5Qrcode('barcode-scanner-region');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 160 } },
          (decodedText: string) => {
            if (handledRef.current) return;
            handledRef.current = true;
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(80);
            }
            setForm(f => ({ ...f, barcode: decodedText }));
            setMsg('Barcode eskane: ' + decodedText);
            setTimeout(() => setMsg(''), 3000);
            setShowScanner(false);
          },
          () => { /* inyore erè pa fram */ }
        );
      } catch (err: any) {
        if (active) {
          setScannerError(
            'Pa ka louvri kamera a. Verifye ou bay pèmisyon kamera a nan browser la. ' +
            (err?.message || '')
          );
        }
      }
    })();

    return () => {
      active = false;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [showScanner]);

  function openAdjust(p: Product) {
    setAdjustProduct(p);
    setAdjustQty('');
    setAdjustReason('lost');
    setAdjustNote('');
    setAdjustErr('');
  }
  function closeAdjust() {
    setAdjustProduct(null);
  }

  async function openHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setHistoryLoading(false); return; }

    const { data } = await supabase
      .from('stock_adjustments')
      .select('id, product_name, quantity, reason, note, total_cost, created_at')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false })
      .limit(100);

    setAdjustments(data ?? []);
    setHistoryLoading(false);
  }

  const adjustQtyNum = parseInt(adjustQty);
  const adjustCost = adjustProduct && !isNaN(adjustQtyNum)
    ? adjustProduct.purchase_price * adjustQtyNum
    : 0;

  async function saveAdjustment() {
    if (!adjustProduct) return;
    if (isNaN(adjustQtyNum) || adjustQtyNum <= 0) {
      setAdjustErr('Antre yon kantite ki pi gran pase 0.');
      return;
    }
    if (adjustQtyNum > adjustProduct.quantity) {
      setAdjustErr(`Ou pa ka retire ${adjustQtyNum} — gen sèlman ${adjustProduct.quantity} an stock.`);
      return;
    }

    setAdjustBusy(true);
    setAdjustErr('');

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setAdjustBusy(false); return; }

    const { error: adjErr } = await supabase.from('stock_adjustments').insert({
      business_id: ctx.businessId,
      product_id: adjustProduct.id,
      product_name: adjustProduct.name,
      quantity: adjustQtyNum,
      reason: adjustReason,
      note: adjustNote.trim() || null,
      unit_cost: adjustProduct.purchase_price,
      total_cost: adjustProduct.purchase_price * adjustQtyNum,
      created_by: ctx.userId,
    });

    if (adjErr) {
      setAdjustErr('Erè: ' + adjErr.message);
      setAdjustBusy(false);
      return;
    }

    const { error: prodErr } = await supabase
      .from('products')
      .update({ quantity: adjustProduct.quantity - adjustQtyNum })
      .eq('id', adjustProduct.id);

    setAdjustBusy(false);

    if (prodErr) {
      setAdjustErr('Erè stock: ' + prodErr.message);
      return;
    }

    const reasonLabel = REASONS.find(r => r.value === adjustReason)?.label ?? '';
    setMsg(`${adjustQtyNum} ${adjustProduct.name} retire nan stock (${reasonLabel}).`);
    setTimeout(() => setMsg(''), 4000);
    setAdjustProduct(null);
    load();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setMsg('Non pwodwi obligatwa.'); return; }

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) return;

    const payload = {
      business_id: ctx.businessId,
      name: form.name,
      category: form.category || null,
      description: form.description || null,
      purchase_price: parseFloat(form.purchase_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      quantity: parseInt(form.quantity) || 0,
      image_url: form.image_url || null,
      barcode: form.barcode.trim() || null,
      low_stock_threshold: form.low_stock_threshold
        ? parseInt(form.low_stock_threshold)
        : null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editId));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }

    if (!error) {
      setMsg(editId ? 'Pwodwi modifye!' : 'Pwodwi ajoute!');
      resetForm();
      load();
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Erè: ' + error.message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Efase "${name}" nan envantè a?`)) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    load();
  }

  const fmt = (n: number) => formatMoney(n, currency);

  const totalValue = products.reduce((s, p) => s + p.sale_price * p.quantity, 0);
  const lowStock = products.filter(p => p.quantity >= 1 && p.quantity <= thresholdOf(p)).length;
  const outOfStock = products.filter(p => p.quantity === 0).length;
  const totalVarieties = products.length;
  const totalItems = products.reduce((s, p) => s + p.quantity, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">Envantè</h1>
        <div className="flex gap-2">
          <button onClick={openHistory}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
            📋 Istorik pèt
          </button>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            {showForm ? 'Fèmen' : '+ Nouvo pwodwi'}
          </button>
        </div>
      </div>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      {pendingSales > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-center justify-between gap-2">
          <span>
            ⚠️ Gen <strong>{pendingSales}</strong> vant POS ki poko sinkronize.
            Stock ki afiche isit la ka pi wo pase reyalite a.
          </span>
          <a href="/pos" className="underline font-medium whitespace-nowrap">Ale nan POS →</a>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Valè total stock (vant)</p>
          <p className="text-xl font-semibold mt-1">{fmt(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pwodwi ki prèske fini</p>
          <p className={`text-xl font-semibold mt-1 ${lowStock > 0 ? 'text-orange-600' : 'text-green-600'}`}>{lowStock}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pwodwi ki fini (0)</p>
          <p className={`text-xl font-semibold mt-1 ${outOfStock > 0 ? 'text-red-600' : 'text-green-600'}`}>{outOfStock}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-medium text-gray-800">{editId ? 'Modifye pwodwi' : 'Ajoute nouvo pwodwi'}</h2>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.image_url ? (
                <img src={form.image_url} alt="Pwodwi" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400 text-center">Pa gen foto</span>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Foto pwodwi (opsyonèl)</label>
              <input type="file" accept="image/*" onChange={handleImageUpload}
                className="block mt-1 text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs hover:file:bg-blue-100" />
              {uploading && <p className="text-xs text-blue-600 mt-1">Ap upload...</p>}
              <p className="text-xs text-gray-400 mt-1">PNG, JPG — max 2MB</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Non pwodwi *" required
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Kategori (ex: Bwason)"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          </div>
          <input placeholder="Deskripsyon (opsyonèl)"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

          <div>
            <label className="text-xs text-gray-500 font-medium">Barcode (opsyonèl)</label>
            <div className="flex gap-2 mt-1">
              <input placeholder="Eskane, tape, oswa jenere barcode la"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
              <button type="button" onClick={openScanner}
                className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 whitespace-nowrap flex items-center gap-1">
                📷 Eskane
              </button>
              <button type="button" onClick={generateBarcode}
                className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 whitespace-nowrap flex items-center gap-1">
                ⚙️ Jenere
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Pwodwi enpòte: eskane oswa tape barcode faktori a. Pwodwi lokal san barcode: klike "Jenere".
            </p>

            {form.barcode.trim() && (
              <div className="mt-3 border border-gray-200 rounded-lg p-3 flex flex-col items-center gap-2 bg-gray-50">
                <svg ref={barcodeSvgRef} />
                <button type="button" onClick={printLabel}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black">
                  🖨️ Enprime etikèt
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Pri acha</label>
              <input type="number" placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Pri vant</label>
              <input type="number" placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Kantite an stock</label>
              <input type="number" placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium">Alèt stock ba (opsyonèl)</label>
            <input type="number" placeholder={`Default: ${DEFAULT_THRESHOLD}`}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              value={form.low_stock_threshold}
              onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">
              Lè stock la rive nan chif sa a oswa anba, w ap jwenn yon alèt. Kite vid pou itilize {DEFAULT_THRESHOLD}.
            </p>
          </div>

          <button type="submit" disabled={uploading}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {editId ? 'Anrejistre chanjman' : 'Ajoute pwodwi a'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[780px]">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Pwodwi</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Pri acha</th>
              <th className="px-4 py-3">Pri vant</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Aksyon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Chajman...</td></tr>
            )}
            {!loading && products.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Pa gen pwodwi toujou. Klike "+ Nouvo pwodwi".</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.barcode ? (
                        <div className="text-xs text-gray-400">⬛ {p.barcode}</div>
                      ) : p.description ? (
                        <div className="text-xs text-gray-400">{p.description}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.category || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{fmt(p.purchase_price)}</td>
                <td className="px-4 py-3">{fmt(p.sale_price)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.quantity === 0 ? 'bg-red-100 text-red-700' :
                    p.quantity <= thresholdOf(p) ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {p.quantity} {p.quantity === 0 ? '❌' : p.quantity <= thresholdOf(p) ? '⚠️' : ''}
                  </span>
                  {p.low_stock_threshold != null && p.low_stock_threshold > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">alèt: {p.low_stock_threshold}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(p)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200">
                      Modifye
                    </button>
                    <button onClick={() => openAdjust(p)}
                      disabled={p.quantity <= 0}
                      className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs hover:bg-orange-200 disabled:opacity-40 disabled:cursor-not-allowed">
                      📉 Retire
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs hover:bg-red-200">
                      Efase
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && products.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between gap-2 text-sm">
            <span className="text-gray-600">
              Kantite varyete pwodwi: <strong className="text-gray-900">{totalVarieties}</strong>
            </span>
            <span className="text-gray-600">
              Kantite total atik nan stock: <strong className="text-gray-900">{totalItems}</strong>
            </span>
          </div>
        )}
      </div>

      {/* ===== MODAL ISTORIK PÈT ===== */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">📋 Istorik pèt nan stock</h2>
              <button onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {historyLoading ? (
                <div className="p-6 text-center text-gray-400 text-sm">Chajman...</div>
              ) : adjustments.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  Pa gen okenn pèt anrejistre toujou.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
                      <th className="px-4 py-3">Dat</th>
                      <th className="px-4 py-3">Pwodwi</th>
                      <th className="px-4 py-3">Kantite</th>
                      <th className="px-4 py-3">Rezon</th>
                      <th className="px-4 py-3 text-right">Valè</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adjustments.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(a.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{a.product_name}</div>
                          {a.note && <div className="text-xs text-gray-400">{a.note}</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{a.quantity}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            {REASONS.find(r => r.value === a.reason)?.label ?? a.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-700 whitespace-nowrap">
                          {fmt(a.total_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!historyLoading && adjustments.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between gap-2 text-sm">
                <span className="text-gray-600">
                  <strong className="text-gray-900">{adjustments.length}</strong> pèt anrejistre
                </span>
                <span className="text-gray-600">
                  Total valè pèt: <strong className="text-red-700">
                    {fmt(adjustments.reduce((s, a) => s + Number(a.total_cost || 0), 0))}
                  </strong>
                </span>
              </div>
            )}

            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setShowHistory(false)}
                className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black">
                Fèmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL AJISTEMAN STOCK ===== */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !adjustBusy && closeAdjust()}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Retire nan stock</h2>
            <p className="text-sm text-gray-500 mb-4">
              {adjustProduct.name} — <strong>{adjustProduct.quantity}</strong> an stock kounye a.
            </p>

            <label className="text-sm text-gray-600 font-medium">Kantite pou retire</label>
            <input
              type="number"
              autoFocus
              placeholder="0"
              value={adjustQty}
              onChange={e => setAdjustQty(e.target.value)}
              className="w-full mt-1 mb-3 px-4 py-3 border border-gray-200 rounded-lg text-lg font-semibold text-right focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <label className="text-sm text-gray-600 font-medium">Rezon</label>
            <div className="grid grid-cols-2 gap-2 mt-1 mb-3">
              {REASONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setAdjustReason(r.value)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    adjustReason === r.value
                      ? 'bg-orange-600 text-white border-orange-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <label className="text-sm text-gray-600 font-medium">Nòt (opsyonèl)</label>
            <input
              type="text"
              placeholder="Ex: dat ekspirasyon pase"
              value={adjustNote}
              onChange={e => setAdjustNote(e.target.value)}
              className="w-full mt-1 mb-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            {!isNaN(adjustQtyNum) && adjustQtyNum > 0 && (
              <div className="flex justify-between items-center bg-red-50 rounded-lg px-4 py-2.5 mb-3">
                <span className="text-sm text-red-700 font-medium">Valè pèt la</span>
                <span className="text-lg font-bold text-red-800">{fmt(adjustCost)}</span>
              </div>
            )}

            {adjustErr && (
              <div className="mb-3 text-sm rounded-lg p-2 bg-red-50 text-red-700">{adjustErr}</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={closeAdjust}
                disabled={adjustBusy}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Anile
              </button>
              <button
                onClick={saveAdjustment}
                disabled={adjustBusy || isNaN(adjustQtyNum) || adjustQtyNum <= 0}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-40"
              >
                {adjustBusy ? 'Ap retire...' : 'Retire nan stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL KAMERA ===== */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">📷 Eskane barcode pwodwi a</h2>
              <button onClick={closeScanner} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <div className="p-4">
              {scannerError ? (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">
                  {scannerError}
                </div>
              ) : (
                <>
                  <div id="barcode-scanner-region" className="w-full rounded-lg overflow-hidden bg-black" />
                  <p className="text-center text-xs text-gray-500 mt-2">
                    Pwente kamera a sou barcode pwodwi a
                  </p>
                </>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={closeScanner}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black">
                Fèmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}