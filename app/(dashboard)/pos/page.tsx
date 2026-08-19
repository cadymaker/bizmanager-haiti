'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';

interface Product {
  id: string;
  name: string;
  sale_price: number;
  quantity: number;
  image_url: string | null;
  barcode: string | null;
}

interface CartItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  stock: number;
}

interface BizInfo {
  business_name: string;
  street?: string;
  city?: string;
  department?: string;
  phone?: string;
}

interface Receipt {
  invoiceNumber: string;
  dateTime: string;
  cashierName: string;
  items: { name: string; quantity: number; unit_price: number; total: number }[];
  total: number;
  cashGiven: number;
  change: number;
}

// Dat jodi a nan lè LOKAL la (Ayiti), pa an UTC
function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Dat + lè pou resi a (fòma lokal)
function nowDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [biz, setBiz] = useState<BizInfo | null>(null);
  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Eskane barcode (tape / eskanè USB)
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMsg, setScanMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Eskane ak kamera
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const processBarcodeRef = useRef<(code: string) => void>(() => {});

  // Peman
  const [showPayment, setShowPayment] = useState(false);
  const [cashGiven, setCashGiven] = useState('');
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState('');

  // Resi
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: business } = await supabase
      .from('businesses')
      .select('business_name, street, city, department, phone, currency')
      .eq('id', ctx.businessId)
      .single();
    setBiz(business);
    setCurrency(business?.currency ?? 'HTG');

    const { data } = await supabase
      .from('products')
      .select('id, name, sale_price, quantity, image_url, barcode')
      .eq('business_id', ctx.businessId)
      .order('name');
    setProducts(data ?? []);
    setLoading(false);
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(p: Product) {
    if (p.quantity <= 0) return;
    setCart(prev => {
      const existing = prev.find(it => it.product_id === p.id);
      if (existing) {
        if (existing.quantity >= p.quantity) return prev;
        return prev.map(it =>
          it.product_id === p.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...prev, {
        product_id: p.id,
        name: p.name,
        unit_price: p.sale_price,
        quantity: 1,
        stock: p.quantity,
      }];
    });
  }

  // Lojik pataje: tape, eskanè USB, ak kamera tout pase la
  function processBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;

    const prod = products.find(p => p.barcode && p.barcode === trimmed);
    if (!prod) {
      setScanMsg({ type: 'error', text: `Pa jwenn okenn pwodwi ak barcode: ${trimmed}` });
      return;
    }
    if (prod.quantity <= 0) {
      setScanMsg({ type: 'error', text: `${prod.name} — pa gen an stock (fini).` });
      return;
    }
    const existing = cart.find(it => it.product_id === prod.id);
    if (existing && existing.quantity >= prod.quantity) {
      setScanMsg({ type: 'error', text: `${prod.name} — maksimòm stock rive (${prod.quantity}).` });
      return;
    }

    addToCart(prod);
    setScanMsg({ type: 'success', text: `✓ ${prod.name} ajoute nan panye a` });
  }

  // Kenbe yon referans ki toujou pwente sou dènye vèsyon processBarcode la
  // (paske callback kamera a anrejistre yon sèl fwa)
  useEffect(() => {
    processBarcodeRef.current = processBarcode;
  });

  // Tape / eskanè USB + Enter
  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeInput.trim();
    setBarcodeInput('');
    setTimeout(() => barcodeRef.current?.focus(), 0);
    processBarcode(code);
  }

  // Louvri / fèmen kamera a
  function openScanner() {
    setScannerError('');
    setScanMsg(null);
    setShowScanner(true);
  }
  function closeScanner() {
    setShowScanner(false); // netwayaj effect la ap fèmen kamera a
  }

  // Demare kamera a lè modal la louvri
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
          { facingMode: 'environment' }, // kamera dèyè a
          { fps: 10, qrbox: { width: 280, height: 160 } },
          (decodedText: string) => {
            const now = Date.now();
            // Anpeche menm barcode la ajoute plizyè fwa nan yon segond
            if (
              decodedText === lastScanRef.current.code &&
              now - lastScanRef.current.time < 1500
            ) return;
            lastScanRef.current = { code: decodedText, time: now };
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(80); // ti vibrasyon konfimasyon
            }
            processBarcodeRef.current(decodedText);
          },
          () => { /* inyore erè pa fram (nòmal) */ }
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

  function changeQty(productId: string, delta: number) {
    setCart(prev => prev.map(it => {
      if (it.product_id !== productId) return it;
      const newQty = it.quantity + delta;
      if (newQty < 1) return it;
      if (newQty > it.stock) return it;
      return { ...it, quantity: newQty };
    }));
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(it => it.product_id !== productId));
  }

  function clearCart() {
    if (cart.length > 0 && !confirm('Vide panye a?')) return;
    setCart([]);
    setScanMsg(null);
  }

  const total = cart.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  const itemCount = cart.reduce((s, it) => s + it.quantity, 0);
  const fmt = (n: number) => formatMoney(n, currency);

  const cashNum = parseFloat(cashGiven) || 0;
  const change = cashNum - total;

  function openPayment() {
    if (cart.length === 0) return;
    setCashGiven('');
    setMsg('');
    setShowPayment(true);
  }

  async function completeSale() {
    if (cashNum < total) {
      setMsg('Kòb kliyan bay la pa ase.');
      return;
    }
    setProcessing(true);
    setMsg('');

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setProcessing(false); return; }

    const saleItems = cart.map(it => ({
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: it.unit_price * it.quantity,
      product_id: it.product_id,
    }));

    // 1) Kreye fakti a (vant POS, peye konplè)
    const { data: inserted, error } = await supabase.from('invoices').insert({
      business_id: ctx.businessId,
      client_id: null,
      niche_template: 'retail',
      issue_date: todayLocalDate(),
      subtotal: total,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: total,
      amount_paid: total,
      currency: currency,
      status: 'paid',
      source: 'pos',
      created_by: ctx.userId,
      metadata: {
        items: saleItems,
        discount: 0,
        cash_given: cashNum,
        change: change,
      },
    }).select('id, invoice_number').single();

    if (error) {
      setMsg('Erè: ' + error.message);
      setProcessing(false);
      return;
    }

    // 2) Anrejistre peman an
    await supabase.from('payments').insert({
      invoice_id: inserted.id,
      business_id: ctx.businessId,
      amount: total,
      method: 'cash',
    });

    // 3) Desann stock
    for (const it of cart) {
      const prod = products.find(p => p.id === it.product_id);
      if (prod) {
        await supabase
          .from('products')
          .update({ quantity: prod.quantity - it.quantity })
          .eq('id', it.product_id);
      }
    }

    // 4) Prepare resi a
    setReceipt({
      invoiceNumber: inserted.invoice_number,
      dateTime: nowDateTime(),
      cashierName: ctx.fullName || 'Itilizatè',
      items: saleItems.map(it => ({ name: it.name, quantity: it.quantity, unit_price: it.unit_price, total: it.total })),
      total,
      cashGiven: cashNum,
      change,
    });

    setProcessing(false);
    setShowPayment(false);
    setCart([]);
    setCashGiven('');
    setScanMsg(null);
    setTimeout(() => barcodeRef.current?.focus(), 0);
    load();
  }

  function closeReceipt() {
    setReceipt(null);
  }

  function printReceipt() {
    window.print();
  }

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;

  const addrLine = [biz?.city, biz?.department].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] md:h-screen relative">
      {/* ===== GOCH: Lis pwodwi ===== */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden print:hidden">
        <div className="mb-3">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Sistèm Vant</h1>

          {/* Eskane barcode (tape / eskanè USB) */}
          <form onSubmit={handleBarcodeSubmit} className="mb-2">
            <label className="text-xs text-gray-500 font-medium mb-1 block">Eskane barcode</label>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                type="text"
                placeholder="Eskane oswa tape barcode, apre peze Enter"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                className="flex-1 px-4 py-2.5 border-2 border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400"
                autoFocus
              />
              <button type="submit"
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap">
                Ajoute
              </button>
            </div>
          </form>

          {/* Bouton kamera */}
          <button
            type="button"
            onClick={openScanner}
            className="w-full mb-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 flex items-center justify-center gap-2"
          >
            📷 Eskane ak kamera
          </button>

          {scanMsg && (
            <div className={`mb-2 text-sm rounded-lg px-3 py-2 ${
              scanMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {scanMsg.text}
            </div>
          )}

          <input
            type="text"
            placeholder="Chèche yon pwodwi pa non..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm">
              {products.length === 0 ? 'Pa gen pwodwi nan envantè a.' : 'Pa gen pwodwi ki matche.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.quantity <= 0}
                  className={`text-left border rounded-xl p-3 transition-colors ${
                    p.quantity <= 0
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 bg-white hover:border-blue-400 hover:shadow-sm'
                  }`}
                >
                  <div className="w-full h-16 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden mb-2">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-300 text-xs">Pa gen foto</span>
                    )}
                  </div>
                  <div className="font-medium text-sm text-gray-800 truncate">{p.name}</div>
                  <div className="text-sm text-blue-600 font-semibold">{fmt(p.sale_price)}</div>
                  <div className={`text-xs mt-0.5 ${p.quantity <= 0 ? 'text-red-500' : p.quantity <= 5 ? 'text-orange-500' : 'text-gray-400'}`}>
                    {p.quantity <= 0 ? 'Fini' : `${p.quantity} an stock`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== DWAT: Panye ===== */}
      <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col print:hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">Panye ({itemCount})</h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-600 hover:underline">Vide</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 py-10 text-sm px-4">
              Klike sou yon pwodwi pou ajoute l nan panye a.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {cart.map(it => (
                <div key={it.product_id} className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-gray-800 truncate">{it.name}</div>
                      <div className="text-xs text-gray-400">{fmt(it.unit_price)} × {it.quantity}</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                      {fmt(it.unit_price * it.quantity)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => changeQty(it.product_id, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200">−</button>
                    <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                    <button onClick={() => changeQty(it.product_id, 1)}
                      disabled={it.quantity >= it.stock}
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 disabled:opacity-40">+</button>
                    <button onClick={() => removeFromCart(it.product_id)}
                      className="ml-auto text-xs text-red-600 hover:underline">Retire</button>
                  </div>
                  {it.quantity >= it.stock && (
                    <div className="text-xs text-orange-500 mt-1">Maksimòm stock ({it.stock})</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total</span>
            <span className="text-2xl font-bold text-gray-900">{fmt(total)}</span>
          </div>
          <button
            onClick={openPayment}
            disabled={cart.length === 0}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Kontinye ak peman
          </button>
        </div>
      </div>

      {/* ===== MODAL KAMERA ===== */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">📷 Eskane pwodwi</h2>
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

              {scanMsg && (
                <div className={`mt-3 text-sm rounded-lg px-3 py-2 ${
                  scanMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {scanMsg.text}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                Panye: <strong className="text-gray-900">{itemCount}</strong> atik • <strong className="text-gray-900">{fmt(total)}</strong>
              </div>
              <button onClick={closeScanner}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black">
                Fèmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL PEMAN ===== */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden"
          onClick={() => !processing && setShowPayment(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Peman</h2>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-sm text-gray-500">Total pou peye</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{fmt(total)}</p>
            </div>

            <label className="text-sm text-gray-600 font-medium">Kòb kliyan bay</label>
            <input
              type="number"
              autoFocus
              placeholder="0"
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
              className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-lg font-semibold text-right focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <div className="flex justify-between items-center mt-4 px-1">
              <span className="text-gray-600">Monè pou remèt</span>
              <span className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-gray-300'}`}>
                {change >= 0 ? fmt(change) : fmt(0)}
              </span>
            </div>

            {msg && (
              <div className="mt-3 text-sm rounded-lg p-2 bg-red-50 text-red-700">{msg}</div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowPayment(false)}
                disabled={processing}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Anile
              </button>
              <button
                onClick={completeSale}
                disabled={processing || cashNum < total}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40"
              >
                {processing ? 'Ap fè vant...' : 'Fè vant lan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL RESI ===== */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-2xl w-full max-w-sm my-4 print:rounded-none print:max-w-none print:my-0">
            {/* Antèt modal (pa enprime) */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center print:hidden">
              <h2 className="font-semibold text-gray-800">✓ Vant fini</h2>
              <button onClick={closeReceipt} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            {/* ===== RESI TIKÈ 80mm ===== */}
            <div id="receipt-print" className="receipt-ticket">
              <div className="text-center">
                <div className="biz-name">{biz?.business_name}</div>
                {biz?.street && <div className="line">{biz.street}</div>}
                {addrLine && <div className="line">{addrLine}, Ayiti</div>}
                {!addrLine && <div className="line">Ayiti</div>}
                {biz?.phone && <div className="line">Tel: {biz.phone}</div>}
              </div>

              <div className="divider"></div>

              <div className="line">Resi: {receipt.invoiceNumber}</div>
              <div className="line">Dat: {receipt.dateTime}</div>
              <div className="line">Kesye: {receipt.cashierName}</div>

              <div className="divider"></div>

              {receipt.items.map((it, i) => (
                <div key={i} className="item">
                  <div className="item-name">{it.name}</div>
                  <div className="item-row">
                    <span>{it.quantity} x {fmt(it.unit_price)}</span>
                    <span>{fmt(it.total)}</span>
                  </div>
                </div>
              ))}

              <div className="divider"></div>

              <div className="total-row">
                <span>TOTAL</span>
                <span>{fmt(receipt.total)}</span>
              </div>
              <div className="item-row">
                <span>Kòb bay</span>
                <span>{fmt(receipt.cashGiven)}</span>
              </div>
              <div className="item-row">
                <span>Monè</span>
                <span>{fmt(receipt.change)}</span>
              </div>

              <div className="divider"></div>

              <div className="text-center footer-text">
                Mèsi pou konfyans ou!<br />
                Nou espere wè w ankò.
              </div>
            </div>

            {/* Bouton yo (pa enprime) */}
            <div className="p-4 border-t border-gray-100 flex gap-2 print:hidden">
              <button onClick={closeReceipt}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Fèmen
              </button>
              <button onClick={printReceipt}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Enprime resi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== STIL RESI (80mm) ===== */}
      <style jsx global>{`
        .receipt-ticket {
          width: 80mm;
          max-width: 100%;
          margin: 0 auto;
          padding: 12px 10px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          color: #000;
          background: #fff;
        }
        .receipt-ticket .biz-name {
          font-size: 15px;
          font-weight: bold;
          margin-bottom: 2px;
        }
        .receipt-ticket .line {
          font-size: 11px;
        }
        .receipt-ticket .divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .receipt-ticket .item {
          margin-bottom: 4px;
        }
        .receipt-ticket .item-name {
          font-weight: bold;
        }
        .receipt-ticket .item-row {
          display: flex;
          justify-content: space-between;
        }
        .receipt-ticket .total-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .receipt-ticket .footer-text {
          font-size: 11px;
          margin-top: 4px;
        }
        .receipt-ticket .text-center {
          text-align: center;
        }

        /* Lè n ap enprime: montre SÈLMAN resi a */
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-print, #receipt-print * {
            visibility: visible;
          }
          #receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}