'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const PLANS = [
  { id: '30days', label: '30 jou', amount: 1000, duration: '30 jou' },
  { id: '90days', label: '90 jou', amount: 2500, duration: '90 jou' },
  { id: '1year', label: '1 an', amount: 10000, duration: '1 an' },
];

const MONCASH_NUMBER = '+509 3193-8499';

type PayMethod = 'moncash_auto' | 'moncash' | 'cash';

export default function SubscribePage() {
  const [selectedPlan, setSelectedPlan] = useState(PLANS[0]);
  const [method, setMethod] = useState<PayMethod>('moncash_auto');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
  const [pending, setPending] = useState<{ plan: string; status: string; created_at: string } | null>(null);

  useEffect(() => { checkPending(); }, []);

  async function checkPending() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('payment_requests')
      .select('plan, status, created_at')
      .eq('business_id', session.user.id)
      .eq('status', 'pending')
      .eq('provider', 'manual') // sèlman demann manyèl ki bezwen verifikasyon
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (data) setPending(data);
  }

  function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setReceipt(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  }

  // ── MonCash otomatik : rele API a epi redije sou MonCash ──
  async function handleAutoPayment() {
    setLoading(true);
    setMsg(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    try {
      const res = await fetch('/api/billing/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: selectedPlan.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        setMsg({ type: 'error', text: data.error || 'Erè pandan kreyasyon peman an. Tanpri eseye ankò.' });
        setLoading(false);
        return;
      }
      // Redije sou MonCash (paj la ap kite, pa bezwen setLoading(false))
      window.location.href = data.redirectUrl;
    } catch {
      setMsg({ type: 'error', text: 'Erè rezo. Tanpri eseye ankò.' });
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (method === 'moncash_auto') {
      return handleAutoPayment();
    }

    // ── Flux manyèl (MonCash ak resi, oswa Cash) ──
    if (method === 'moncash' && !receipt) {
      setMsg({ type: 'error', text: 'Tanpri upload foto konfirmasyon peman an.' });
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    let receiptUrl = '';
    if (receipt) {
      const ext = receipt.name.split('.').pop();
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, receipt);
      if (upErr) {
        setMsg({ type: 'error', text: 'Erè upload: ' + upErr.message });
        setLoading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path);
      receiptUrl = publicUrl;
    }

    const { error } = await supabase.from('payment_requests').insert({
      business_id: session.user.id,
      plan: selectedPlan.id,
      amount: selectedPlan.amount,
      duration: selectedPlan.duration,
      payment_method: method,
      provider: 'manual',
      receipt_url: receiptUrl || null,
      status: 'pending',
    });

    if (!error) {
      setMsg({ type: 'success', text: 'Demann ou soumèt! N ap verifye peman an epi voye kòd aktivasyon ou nan yon ti moman.' });
      setReceipt(null);
      setReceiptPreview('');
      checkPending();
    } else {
      setMsg({ type: 'error', text: 'Erè: ' + error.message });
    }
    setLoading(false);
  }

  const fmt = (n: number) => new Intl.NumberFormat('fr-HT').format(n) + ' HTG';

  const methods: { id: PayMethod; label: string; sub: string }[] = [
    { id: 'moncash_auto', label: 'MonCash otomatik', sub: 'Aktivasyon rapid' },
    { id: 'moncash', label: 'MonCash manyèl', sub: 'Voye resi' },
    { id: 'cash', label: 'Cash', sub: 'An pèsòn' },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Achte lisans</h1>
        <p className="text-sm text-gray-500 mt-1">Chwazi yon plan epi peye pou kontinye itilize app la.</p>
      </div>

      {pending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
          Ou gen yon demann k ap tann verifikasyon. N ap voye kòd ou a byento.
        </div>
      )}

      {msg && (
        <div className={`text-sm rounded-lg p-3 ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">1. Chwazi plan ou</label>
        <div className="grid grid-cols-3 gap-3">
          {PLANS.map(p => (
            <button key={p.id} onClick={() => setSelectedPlan(p)}
              className={`p-4 rounded-xl border text-center transition-colors ${
                selectedPlan.id === p.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <div className="font-semibold text-gray-900">{p.label}</div>
              <div className="text-sm text-blue-600 font-medium mt-1">{fmt(p.amount)}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">2. Metòd peman</label>
        <div className="grid grid-cols-3 gap-3">
          {methods.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`p-3 rounded-xl border text-center transition-colors ${
                method === m.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <div className="font-medium text-gray-900 text-sm">{m.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {method === 'moncash_auto' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-gray-700">
          <p>W ap redije sou MonCash pou peye <strong>{fmt(selectedPlan.amount)}</strong>.</p>
          <p className="mt-1 text-gray-600">Lisans ou ap aktive <strong>otomatikman</strong> touswit apre peman an — pa gen resi pou upload.</p>
        </div>
      )}

      {method === 'moncash' && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700">3. Peye {fmt(selectedPlan.amount)} sou MonCash</p>
            <p className="text-sm text-gray-600 mt-1">
              Voye peman an sou nimewo: <strong className="text-blue-600">{MONCASH_NUMBER}</strong>
            </p>
            <p className="text-xs text-gray-500 mt-1">Apre ou peye, pran yon foto (screenshot) konfirmasyon an.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">4. Upload foto konfirmasyon</label>
            <input type="file" accept="image/*" onChange={handleReceiptChange}
              className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700" />
            {receiptPreview && (
              <img src={receiptPreview} alt="Resi" className="mt-3 max-h-48 rounded-lg border border-gray-200" />
            )}
          </div>
        </div>
      )}

      {method === 'cash' && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-sm text-gray-600">
            Pou peman Cash: kontakte nou pou peye an pèsòn. Apre peman an, n ap ba ou yon resi.
            Ou ka upload foto resi a anba a (opsyonèl).
          </p>
          <div className="mt-3">
            <input type="file" accept="image/*" onChange={handleReceiptChange}
              className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700" />
            {receiptPreview && (
              <img src={receiptPreview} alt="Resi" className="mt-3 max-h-48 rounded-lg border border-gray-200" />
            )}
          </div>
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading
          ? 'Ap trete...'
          : method === 'moncash_auto'
            ? `Peye ${fmt(selectedPlan.amount)} ak MonCash`
            : 'Soumèt demann peman'}
      </button>
    </div>
  );
}