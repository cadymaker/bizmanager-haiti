'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Item { name: string; quantity: number; unit_price: number; total: number; }

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
}

interface BizInfo {
  business_name: string;
  owner_name: string;
  phone?: string;
  address?: string;
  logo_url?: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceFull | null>(null);
  const [biz, setBiz] = useState<BizInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data: inv } = await supabase
      .from('invoices')
      .select('id, invoice_number, issue_date, total_amount, amount_paid, balance_due, status, currency, metadata, client:clients(name, phone, address)')
      .eq('id', id)
      .single();
    setInvoice(inv as any);

    const { data: business } = await supabase
      .from('businesses')
      .select('business_name, owner_name, phone, address, logo_url')
      .eq('id', session.user.id)
      .single();
    setBiz(business);

    setLoading(false);
  }
async function deleteInvoice() {
    if (!invoice) return;
    if (!confirm(`Efase fakti ${invoice.invoice_number}? Si li te gen pwodwi ki soti nan envantè, stock yo ap remonte. Aksyon sa a pa ka defèt.`)) return;

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Remonte stock pou chak pwodwi ki te nan fakti a
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

    // Efase fakti a (peman yo ap efase otomatik ak cascade)
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

  async function downloadPDF() {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);
    const element = document.getElementById('invoice-print');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${invoice?.invoice_number}.pdf`);
  }

  const fmt = (n: number) => new Intl.NumberFormat('fr-HT').format(n ?? 0) + ' HTG';

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;
  if (!invoice) return <div className="p-6 text-gray-400">Fakti pa jwenn.</div>;

  const items = invoice.metadata?.items ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={() => router.push('/invoices')}
          className="text-sm text-gray-500 hover:text-gray-800">← Retounen</button>
        <div className="flex gap-2">
          <button onClick={downloadPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Telechaje PDF
          </button>
          <button onClick={deleteInvoice}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
            Efase fakti
          </button>
        </div>
      </div>

      {msg && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">{msg}</div>}

      {/* FAKTI A (sa ki pral vin PDF la) */}
      <div id="invoice-print" className="bg-white border border-gray-200 rounded-xl p-8">
<div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            {biz?.logo_url && (
              <img src={biz.logo_url} alt="Logo" crossOrigin="anonymous"
                className="w-16 h-16 object-contain rounded" />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{biz?.business_name}</h1>
            {biz?.address && <p className="text-sm text-gray-500">{biz.address}</p>}
            {biz?.phone && <p className="text-sm text-gray-500">{biz.phone}</p>}
            <p className="text-sm text-gray-500">Gonaïves, Ayiti</p>
            </div>
          </div>
          <div className="text-right">
           <div className="text-2xl font-bold text-blue-600">FAKTI</div>
            <div className="text-sm font-mono text-gray-700 mt-1">{invoice.invoice_number}</div>
            <div className="text-sm text-gray-500 mt-1">
              {new Date(invoice.issue_date).toLocaleDateString('fr-HT')}
            </div>
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

        <table className="w-full text-sm mb-6">
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
            <input type="number" placeholder="Montan peman (HTG)"
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