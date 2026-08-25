'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';
import {
  saveCache, readCache, cacheAge, formatCacheAge,
  saveLastBusinessId, readLastBusinessId,
  withTimeout, isOnline,
  addToQueue, queueCount, nextTempNumber, makeLocalId,
  applyQueueToProducts, readQueue, removeFromQueue, markQueueError,
  type QueuedSale,
} from '@/lib/offline';

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
  currency?: string;
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

interface Session {
  id: string;
  opening_amount: number;
  cash_out: number;
  currency: string;
  opened_at: string;
}

interface ZReport {
  openingAmount: number;
  totalCashSales: number;
  cashOut: number;
  expected: number;
  counted: number;
  ecart: number;
  openedAt: string;
  closedAt: string;
  cashierName: string;
}

function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PosPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [biz, setBiz] = useState<BizInfo | null>(null);
  const [currency, setCurrency] = useState('HTG');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // ===== Offline =====
  const [offline, setOffline] = useState(false);
  const [dataAge, setDataAge] = useState<number | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // ===== Kès =====
  const [session, setSession] = useState<Session | null>(null);
  const [sessionCashSales, setSessionCashSales] = useState(0);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingInput, setOpeningInput] = useState('');
  const [openingBusy, setOpeningBusy] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [countedInput, setCountedInput] = useState('');
  const [cashOutInput, setCashOutInput] = useState('');
  const [closingBusy, setClosingBusy] = useState(false);
  const [zReport, setZReport] = useState<ZReport | null>(null);

  // Eskane barcode
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMsg, setScanMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Kamera
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

  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const isCashier = role === 'cashier';

  function cancelOpenSession() {
    setShowOpenModal(false);
    setOpeningInput('');
    setMsg('');
  }

  async function signOutFromPos() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  useEffect(() => { load(); }, []);

  // Reyaji lè rezo a tounen oswa mouri
  useEffect(() => {
    function onOnline() { load(); }
    function onOffline() { setOffline(true); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function load() {
    setLoading(true);

    const supabase = createClient();

    // Eseye jwenn kontèks la (li bezwen rezo). Si li echwe, n ap
    // sèvi ak dènye businessId nou te sove a.
    const ctx = await withTimeout(getBusinessContext());
    const bid = ctx?.businessId ?? readLastBusinessId();

    if (!bid) {
      setOffline(true);
      setLoading(false);
      return;
    }

    setBusinessId(bid);
    if (ctx) {
      saveLastBusinessId(bid);
      setRole(ctx.role);
      saveCache('role', bid, ctx.role);
      saveCache('user_id', bid, ctx.userId);
      saveCache('cashier_name', bid, ctx.fullName || 'Itilizatè');
    } else {
      const cachedRole = readCache<string>('role', bid);
      if (cachedRole) setRole(cachedRole);
    }

    // ---- Enfo biznis ----
    const bizRes = await withTimeout(
      supabase
        .from('businesses')
        .select('business_name, street, city, department, phone, currency')
        .eq('id', bid)
        .single()
    );

    let isOff = !isOnline();

    if (bizRes && (bizRes as any).data) {
      const business = (bizRes as any).data as BizInfo;
      setBiz(business);
      setCurrency(business.currency ?? 'HTG');
      saveCache('biz', bid, business);
    } else {
      isOff = true;
      const cachedBiz = readCache<BizInfo>('biz', bid);
      if (cachedBiz) {
        setBiz(cachedBiz);
        setCurrency(cachedBiz.currency ?? 'HTG');
      }
    }

    // ---- Pwodwi ----
    // Kachèt la kenbe stock SÈVÈ a. Sa nou afiche = kachèt mwens fil datant.
    const prodRes = await withTimeout(
      supabase
        .from('products')
        .select('id, name, sale_price, quantity, image_url, barcode')
        .eq('business_id', bid)
        .order('name')
    );

    if (prodRes && (prodRes as any).data) {
      const list = (prodRes as any).data as Product[];
      saveCache('products', bid, list);
      setProducts(applyQueueToProducts(list, bid));
      setDataAge(0);
    } else {
      isOff = true;
      const cachedProducts = readCache<Product[]>('products', bid) ?? [];
      setProducts(applyQueueToProducts(cachedProducts, bid));
      setDataAge(cacheAge('products', bid));
    }

    // ---- Sesyon kès ----
    const sessRes = await withTimeout(
      supabase
        .from('cash_sessions')
        .select('id, opening_amount, cash_out, currency, opened_at')
        .eq('business_id', bid)
        .eq('status', 'OPEN')
        .maybeSingle()
    );

    let activeSession: Session | null = null;

    if (sessRes !== null) {
      const sess = (sessRes as any).data as Session | null;
      if (sess) {
        activeSession = sess;
        setSession(sess);
        saveCache('session', bid, sess);
        setShowOpenModal(false);
        await refreshCashSales(sess.id);
      } else {
        setSession(null);
        saveCache('session', bid, null);
        setSessionCashSales(0);
        setShowOpenModal(true);
      }
    } else {
      isOff = true;
      const cachedSession = readCache<Session | null>('session', bid);
      activeSession = cachedSession ?? null;
      setSession(cachedSession ?? null);
      if (!cachedSession) setShowOpenModal(true);
    }

    setPendingCount(queueCount(bid));
    setOffline(isOff);
    setLoading(false);

    // Si nou an liy epi gen vant nan fil, sinkronize otomatikman
    if (!isOff && queueCount(bid) > 0 && !syncing) {
      const res = await syncQueue(bid);
      if (res.ok > 0) {
        setSyncMsg(`✓ ${res.ok} vant voye sou sèvè a.`);
        setTimeout(() => setSyncMsg(''), 5000);
        // Rechaje pwodwi yo ak stock sèvè a ajou
        const fresh = await withTimeout(
          supabase
            .from('products')
            .select('id, name, sale_price, quantity, image_url, barcode')
            .eq('business_id', bid)
            .order('name')
        );
        if (fresh && (fresh as any).data) {
          const list = (fresh as any).data as Product[];
          saveCache('products', bid, list);
          setProducts(applyQueueToProducts(list, bid));
        }
        if (activeSession) await refreshCashSales(activeSession.id);
      }
      if (res.failed > 0) {
        setSyncMsg(`${res.failed} vant pa t ka voye. N ap eseye ankò.`);
      }
    }
  }

  async function refreshCashSales(sessionId: string) {
    const supabase = createClient();
    const res = await withTimeout(
      supabase
        .from('payments')
        .select('amount')
        .eq('session_id', sessionId)
        .eq('method', 'cash')
    );
    if (res && (res as any).data) {
      const total = ((res as any).data as any[]).reduce(
        (s, p) => s + Number(p.amount || 0), 0
      );
      setSessionCashSales(total);
    }
  }

  // ===== Sinkronize vant offline yo =====
  async function syncQueue(bid: string): Promise<{ ok: number; failed: number }> {
    const queue = readQueue(bid);
    if (queue.length === 0) return { ok: 0, failed: 0 };

    setSyncing(true);
    const supabase = createClient();
    let ok = 0;
    let failed = 0;

    for (const sale of queue) {
      try {
        // 1) Kreye fakti a
        const { data: inserted, error: invErr } = await supabase
          .from('invoices')
          .insert({
            business_id: sale.business_id,
            client_id: null,
            niche_template: 'retail',
            issue_date: sale.issue_date,
            subtotal: sale.total,
            tax_rate: 0,
            tax_amount: 0,
            total_amount: sale.total,
            amount_paid: sale.total,
            currency: sale.currency,
            status: 'paid',
            source: 'pos',
            created_by: sale.user_id || null,
            session_id: sale.session_id,
            metadata: {
              items: sale.items,
              discount: 0,
              cash_given: sale.cash_given,
              change: sale.change,
              offline: true,
              temp_number: sale.temp_number,
              sold_at: sale.created_at,
            },
          })
          .select('id')
          .single();

        if (invErr || !inserted) {
          markQueueError(bid, sale.local_id, invErr?.message ?? 'fakti echwe');
          failed++;
          continue;
        }

        // 2) Peman an
        await supabase.from('payments').insert({
          invoice_id: inserted.id,
          business_id: sale.business_id,
          amount: sale.total,
          method: 'cash',
          session_id: sale.session_id,
        });

        // 3) Desann stock sou sèvè a
        for (const it of sale.items) {
          const { data: prod } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', it.product_id)
            .single();
          if (prod) {
            await supabase
              .from('products')
              .update({ quantity: Math.max(0, Number(prod.quantity) - it.quantity) })
              .eq('id', it.product_id);
          }
        }

        // 4) Retire l nan fil la — sèlman lè tout bagay pase
        removeFromQueue(bid, sale.local_id);
        ok++;
      } catch (e: any) {
        markQueueError(bid, sale.local_id, e?.message ?? 'erè enkoni');
        failed++;
      }
    }

    setSyncing(false);
    setPendingCount(queueCount(bid));
    return { ok, failed };
  }

  // Sinkronize epi rechaje done yo
  async function syncNow() {
    if (!businessId || syncing) return;
    setSyncMsg('');
    const res = await syncQueue(businessId);
    if (res.ok > 0) {
      setSyncMsg(`✓ ${res.ok} vant voye sou sèvè a.`);
      setTimeout(() => setSyncMsg(''), 5000);
    }
    if (res.failed > 0) {
      setSyncMsg(`${res.failed} vant pa t ka voye. N ap eseye ankò.`);
    }
    await load();
  }

  async function openSession() {
    if (offline) {
      setMsg('Ou pa ka ouvri kès la san entènèt. Konekte ou an premye.');
      return;
    }
    const amount = parseFloat(openingInput);
    if (isNaN(amount) || amount < 0) { setMsg('Antre yon fon de kès valab.'); return; }
    setOpeningBusy(true);

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setOpeningBusy(false); setMsg('Pa gen koneksyon.'); return; }

    const { data, error } = await supabase.from('cash_sessions').insert({
      business_id: ctx.businessId,
      opened_by: ctx.userId,
      status: 'OPEN',
      opening_amount: amount,
      currency: currency,
    }).select('id, opening_amount, cash_out, currency, opened_at').single();

    setOpeningBusy(false);
    if (error) { setMsg('Erè ouvèti kès: ' + error.message); return; }

    setSession(data);
    saveCache('session', ctx.businessId, data);
    setSessionCashSales(0);
    setShowOpenModal(false);
    setOpeningInput('');
    setTimeout(() => barcodeRef.current?.focus(), 0);
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

  useEffect(() => {
    processBarcodeRef.current = processBarcode;
  });

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = barcodeInput.trim();
    setBarcodeInput('');
    setTimeout(() => barcodeRef.current?.focus(), 0);
    processBarcode(code);
  }

  function openScanner() {
    setScannerError('');
    setScanMsg(null);
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
            const now = Date.now();
            if (
              decodedText === lastScanRef.current.code &&
              now - lastScanRef.current.time < 1500
            ) return;
            lastScanRef.current = { code: decodedText, time: now };
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(80);
            }
            processBarcodeRef.current(decodedText);
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
    if (!session) { setShowOpenModal(true); return; }
    setCashGiven('');
    setMsg('');
    setShowPayment(true);
  }

  async function completeSale() {
    if (cashNum < total) {
      setMsg('Kòb kliyan bay la pa ase.');
      return;
    }
    if (!session) { setMsg('Pa gen kès louvri.'); return; }

    const saleItems = cart.map(it => ({
      product_id: it.product_id,
      name: it.name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: it.unit_price * it.quantity,
    }));

    // ===== VANT OFFLINE =====
    if (offline) {
      if (!businessId) { setMsg('Pa gen done biznis lokal.'); return; }

      const tempNumber = nextTempNumber(businessId);
      const nowIso = new Date().toISOString();

      const queued: QueuedSale = {
        local_id: makeLocalId(),
        business_id: businessId,
        session_id: session.id,
        user_id: readCache<string>('user_id', businessId) ?? '',
        cashier_name: readCache<string>('cashier_name', businessId) ?? 'Itilizatè',
        issue_date: todayLocalDate(),
        created_at: nowIso,
        currency: currency,
        items: saleItems,
        total: total,
        cash_given: cashNum,
        change: change,
        temp_number: tempNumber,
      };

      addToQueue(businessId, queued);
      setPendingCount(queueCount(businessId));

      // Rekalkile stock la depi kachèt la mwens fil datant lan
      // (kachèt la pa touche — li kenbe stock sèvè a)
      const pristine = readCache<Product[]>('products', businessId) ?? products;
      setProducts(applyQueueToProducts(pristine, businessId));

      setReceipt({
        invoiceNumber: tempNumber,
        dateTime: nowDateTime(),
        cashierName: queued.cashier_name,
        items: saleItems.map(it => ({
          name: it.name, quantity: it.quantity,
          unit_price: it.unit_price, total: it.total,
        })),
        total,
        cashGiven: cashNum,
        change,
      });

      setShowPayment(false);
      setCart([]);
      setCashGiven('');
      setScanMsg(null);
      setTimeout(() => barcodeRef.current?.focus(), 0);
      return;
    }

    // ===== VANT AN LIY =====
    setProcessing(true);
    setMsg('');

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setProcessing(false); setMsg('Pa gen koneksyon.'); return; }

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
      session_id: session.id,
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

    await supabase.from('payments').insert({
      invoice_id: inserted.id,
      business_id: ctx.businessId,
      amount: total,
      method: 'cash',
      session_id: session.id,
    });

    for (const it of cart) {
      const prod = products.find(p => p.id === it.product_id);
      if (prod) {
        await supabase
          .from('products')
          .update({ quantity: prod.quantity - it.quantity })
          .eq('id', it.product_id);
      }
    }

    setReceipt({
      invoiceNumber: inserted.invoice_number,
      dateTime: nowDateTime(),
      cashierName: ctx.fullName || 'Itilizatè',
      items: saleItems.map(it => ({
        name: it.name, quantity: it.quantity,
        unit_price: it.unit_price, total: it.total,
      })),
      total,
      cashGiven: cashNum,
      change,
    });

    await refreshCashSales(session.id);

    setProcessing(false);
    setShowPayment(false);
    setCart([]);
    setCashGiven('');
    setScanMsg(null);
    setTimeout(() => barcodeRef.current?.focus(), 0);

    const { data: freshProducts } = await supabase
      .from('products')
      .select('id, name, sale_price, quantity, image_url, barcode')
      .eq('business_id', ctx.businessId)
      .order('name');
    if (freshProducts) {
      saveCache('products', ctx.businessId, freshProducts);
      setProducts(applyQueueToProducts(freshProducts, ctx.businessId));
    }
  }

  function closeReceipt() {
    setReceipt(null);
  }

  function printReceipt() {
    window.print();
  }

  function openCloseModal() {
    if (!session) return;
    if (offline) {
      setMsg('Ou pa ka fèmen kès la san entènèt.');
      setTimeout(() => setMsg(''), 4000);
      return;
    }
    if (pendingCount > 0) {
      if (!confirm(
        `Gen ${pendingCount} vant ki poko voye sou sèvè a. ` +
        `Si ou fèmen kès la kounye a, vant sa yo p ap konte nan Rapò Z a.\n\n` +
        `Klike "Voye kounye a" an premye. Kontinye kanmenm?`
      )) return;
    }
    setCountedInput('');
    setCashOutInput('');
    setMsg('');
    setShowCloseModal(true);
  }

  const closeCashOut = parseFloat(cashOutInput) || 0;
  const closeExpected = session ? session.opening_amount + sessionCashSales - closeCashOut : 0;
  const closeCounted = parseFloat(countedInput);
  const closeEcart = !isNaN(closeCounted) ? closeCounted - closeExpected : 0;

  async function closeSession() {
    if (!session) return;
    if (isNaN(closeCounted) || closeCounted < 0) { setMsg('Antre kòb ou konte a.'); return; }
    setClosingBusy(true);

    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setClosingBusy(false); setMsg('Pa gen koneksyon.'); return; }

    const { data: pays } = await supabase
      .from('payments')
      .select('amount')
      .eq('session_id', session.id)
      .eq('method', 'cash');
    const totalCash = (pays ?? []).reduce((s, p: any) => s + Number(p.amount || 0), 0);
    const expected = session.opening_amount + totalCash - closeCashOut;
    const ecart = closeCounted - expected;
    const closedAtIso = new Date().toISOString();

    const { error } = await supabase.from('cash_sessions').update({
      status: 'CLOSED',
      closed_by: ctx.userId,
      cash_out: closeCashOut,
      counted_amount: closeCounted,
      total_cash_sales: totalCash,
      expected_amount: expected,
      ecart: ecart,
      closed_at: closedAtIso,
    }).eq('id', session.id);

    setClosingBusy(false);
    if (error) { setMsg('Erè fèmti kès: ' + error.message); return; }

    setZReport({
      openingAmount: session.opening_amount,
      totalCashSales: totalCash,
      cashOut: closeCashOut,
      expected,
      counted: closeCounted,
      ecart,
      openedAt: session.opened_at,
      closedAt: closedAtIso,
      cashierName: ctx.fullName || 'Itilizatè',
    });

    setShowCloseModal(false);
    setSession(null);
    saveCache('session', ctx.businessId, null);
    setSessionCashSales(0);
  }

  function closeZReport() {
    setZReport(null);
    setShowOpenModal(true);
  }

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;

  const addrLine = [biz?.city, biz?.department].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] md:h-screen relative">
      {/* ===== GOCH: Lis pwodwi ===== */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden print:hidden">
        <div className="mb-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">Sistèm Vant</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                offline ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {offline ? '⚠ Offline' : '● An liy'}
              </span>
            </div>
            {session ? (
              <button onClick={openCloseModal}
                className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200 whitespace-nowrap">
                🔒 Fèmen Kès
              </button>
            ) : (
              <button onClick={() => setShowOpenModal(true)}
                className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium hover:bg-emerald-200 whitespace-nowrap">
                🔓 Ouvri Kès
              </button>
            )}
          </div>

          {/* Avètisman offline */}
          {offline && (
            <div className="mb-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800">
              Pa gen koneksyon. W ap wè pwodwi ki te chaje {formatCacheAge(dataAge)}.
              <button onClick={load} className="ml-2 underline font-medium">Eseye ankò</button>
            </div>
          )}

          {/* Vant k ap tann sinkronizasyon */}
          {pendingCount > 0 && (
            <div className="mb-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 flex items-center justify-between gap-2">
              <span>
                📤 <strong>{pendingCount}</strong> vant k ap tann pou voye sou sèvè a.
              </span>
              {!offline && (
                <button onClick={syncNow} disabled={syncing}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                  {syncing ? 'Ap voye...' : 'Voye kounye a'}
                </button>
              )}
            </div>
          )}

          {/* Mesaj sinkronizasyon */}
          {syncMsg && (
            <div className="mb-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              {syncMsg}
            </div>
          )}

          {/* Endikatè kès */}
          {session && (
            <div className="mb-2 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Kès louvri
              </span>
              {!isCashier && !offline && (
                <span className="text-emerald-800">
                  Kach jounen an: <strong>{fmt(sessionCashSales)}</strong>
                </span>
              )}
            </div>
          )}

          {!session && (
            <div className="mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
              Kès la pa louvri. Ouvri kès la anvan ou fè yon vant.
            </div>
          )}

          {/* Eskane barcode */}
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

      {/* ===== MODAL OUVÈTI KÈS ===== */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Ouvèti Kès</h2>
            <p className="text-sm text-gray-500 mb-4">
              Antre fon de kès la (kòb ki nan kès la kounye a) pou w ka kòmanse vann.
            </p>

            {offline && (
              <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800">
                Ou pa gen koneksyon. Ouvèti kès mande entènèt.
              </div>
            )}

            <label className="text-sm text-gray-600 font-medium">Fon de kès ({currency})</label>
            <input
              type="number"
              autoFocus
              placeholder="Egzanp: 5000"
              value={openingInput}
              onChange={e => setOpeningInput(e.target.value)}
              className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-lg font-semibold text-right focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {msg && (
              <div className="mt-3 text-sm rounded-lg p-2 bg-red-50 text-red-700">{msg}</div>
            )}

            <button
              onClick={openSession}
              disabled={openingBusy || offline}
              className="w-full mt-5 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {openingBusy ? 'Ap ouvri...' : 'Ouvri kès la'}
            </button>

            {isCashier ? (
              <button
                onClick={signOutFromPos}
                disabled={openingBusy}
                className="w-full mt-2 py-2.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
              >
                Dekoneksyon
              </button>
            ) : (
              <button
                onClick={cancelOpenSession}
                disabled={openingBusy}
                className="w-full mt-2 py-2.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
              >
                Anile — m pa vle ouvri kès la kounye a
              </button>
            )}
          </div>
        </div>
      )}

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

            {offline && (
              <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800">
                Mòd offline: vant lan ap sove sou aparèy la epi voye sou sèvè a lè koneksyon tounen.
              </div>
            )}

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

      {/* ===== MODAL FÈMTI KÈS ===== */}
      {showCloseModal && session && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden"
          onClick={() => !closingBusy && setShowCloseModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Fèmen Kès</h2>

            {!isCashier && (
              <div className="space-y-2 text-sm bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fon de kès</span>
                  <span className="font-medium">{fmt(session.opening_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total vant cash</span>
                  <span className="font-medium">{fmt(sessionCashSales)}</span>
                </div>
              </div>
            )}

            {isCashier && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 text-sm text-indigo-800">
                Konte tout kòb ki nan kès la epi tape total la anba. Sistèm nan ap fè rès kalkil la.
              </div>
            )}

            <label className="text-sm text-gray-600 font-medium">Sòti espès (opsyonèl)</label>
            <input
              type="number"
              placeholder="0"
              value={cashOutInput}
              onChange={e => setCashOutInput(e.target.value)}
              className="w-full mt-1 mb-1 px-4 py-2.5 border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-xs text-gray-400 mb-3">Kòb ou retire nan kès la pandan jounen an (depans, monnen, elatriye).</p>

            {!isCashier && (
              <div className="flex justify-between items-center bg-blue-50 rounded-lg px-4 py-2.5 mb-4">
                <span className="text-sm text-blue-700 font-medium">Total dwe genyen</span>
                <span className="text-lg font-bold text-blue-800">{fmt(closeExpected)}</span>
              </div>
            )}

            <label className="text-sm text-gray-600 font-medium">Kòb ou konte nan kès la</label>
            <input
              type="number"
              autoFocus
              placeholder="0"
              value={countedInput}
              onChange={e => setCountedInput(e.target.value)}
              className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-lg font-semibold text-right focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {!isCashier && !isNaN(closeCounted) && (
              <div className="flex justify-between items-center mt-3 px-1">
                <span className="text-gray-600">Diferans</span>
                <span className={`text-xl font-bold ${
                  closeEcart === 0 ? 'text-green-600' : closeEcart < 0 ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {closeEcart > 0 ? '+' : ''}{fmt(closeEcart)}
                </span>
              </div>
            )}

            {msg && (
              <div className="mt-3 text-sm rounded-lg p-2 bg-red-50 text-red-700">{msg}</div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCloseModal(false)}
                disabled={closingBusy}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Anile
              </button>
              <button
                onClick={closeSession}
                disabled={closingBusy || isNaN(closeCounted)}
                className="flex-1 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-40"
              >
                {closingBusy ? 'Ap fèmen...' : 'Fèmen kès la'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL RAPÒ Z ===== */}
      {zReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-2xl w-full max-w-sm my-4 print:rounded-none print:max-w-none print:my-0">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center print:hidden">
              <h2 className="font-semibold text-gray-800">✓ Kès fèmen</h2>
              <button onClick={closeZReport} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <div id="receipt-print" className="receipt-ticket">
              <div className="text-center">
                <div className="biz-name">{biz?.business_name}</div>
                <div className="line">RAPÒ FÈMTI KÈS (Z)</div>
              </div>

              <div className="divider"></div>

              <div className="line">Kesye: {zReport.cashierName}</div>
              <div className="line">Ouvèti: {fmtDateTime(zReport.openedAt)}</div>
              <div className="line">Fèmti: {fmtDateTime(zReport.closedAt)}</div>

              <div className="divider"></div>

              <div className="item-row">
                <span>Fon de kès</span>
                <span>{fmt(zReport.openingAmount)}</span>
              </div>
              <div className="item-row">
                <span>Total vant cash</span>
                <span>{fmt(zReport.totalCashSales)}</span>
              </div>
              <div className="item-row">
                <span>Sòti espès</span>
                <span>- {fmt(zReport.cashOut)}</span>
              </div>

              <div className="divider"></div>

              <div className="total-row">
                <span>DWE GENYEN</span>
                <span>{fmt(zReport.expected)}</span>
              </div>
              <div className="item-row">
                <span>Kòb konte</span>
                <span>{fmt(zReport.counted)}</span>
              </div>
              <div className="total-row">
                <span>DIFERANS</span>
                <span>{zReport.ecart > 0 ? '+' : ''}{fmt(zReport.ecart)}</span>
              </div>

              <div className="divider"></div>

              <div className="text-center footer-text">
                {zReport.ecart === 0 ? 'Kès la balanse.' : zReport.ecart < 0 ? 'Kès la manke kòb.' : 'Kès la gen twòp kòb.'}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-2 print:hidden">
              <button onClick={closeZReport}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Fèmen
              </button>
              <button onClick={printReceipt}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Enprime rapò
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL RESI ===== */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-2xl w-full max-w-sm my-4 print:rounded-none print:max-w-none print:my-0">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center print:hidden">
              <h2 className="font-semibold text-gray-800">✓ Vant fini</h2>
              <button onClick={closeReceipt} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

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
              {receipt.invoiceNumber.startsWith('OFF-') && (
                <div className="line">(resi tanporè — offline)</div>
              )}
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
        .receipt-ticket .line { font-size: 11px; }
        .receipt-ticket .divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .receipt-ticket .item { margin-bottom: 4px; }
        .receipt-ticket .item-name { font-weight: bold; }
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
        .receipt-ticket .text-center { text-align: center; }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 4mm 3mm !important;
            color: #000 !important;
            font-size: 12px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #receipt-print .divider {
            border-top: 1px dashed #000 !important;
            margin: 6px 0 !important;
          }
          #receipt-print .item,
          #receipt-print .item-row,
          #receipt-print .total-row {
            page-break-inside: avoid;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </div>
  );
}