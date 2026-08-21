'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';
import { formatMoney } from '@/lib/currency';

interface CashSession {
  id: string;
  status: string;
  opening_amount: number;
  cash_out: number;
  counted_amount: number | null;
  total_cash_sales: number | null;
  expected_amount: number | null;
  ecart: number | null;
  opened_at: string;
  closed_at: string | null;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CashHistoryPage() {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [currency, setCurrency] = useState('HTG');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CashSession | null>(null);
  const [bizName, setBizName] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setLoading(false); return; }

    const { data: biz } = await supabase
      .from('businesses')
      .select('business_name, currency')
      .eq('id', ctx.businessId)
      .single();
    setCurrency(biz?.currency ?? 'HTG');
    setBizName(biz?.business_name ?? '');

    const { data } = await supabase
      .from('cash_sessions')
      .select('id, status, opening_amount, cash_out, counted_amount, total_cash_sales, expected_amount, ecart, opened_at, closed_at')
      .eq('business_id', ctx.businessId)
      .order('opened_at', { ascending: false })
      .limit(100);

    setSessions(data ?? []);
    setLoading(false);
  }

  const fmt = (n: number) => formatMoney(n, currency);

  function printReport() {
    window.print();
  }

  // Estatistik sou kès ki fèmen yo
  const closed = sessions.filter(s => s.status === 'CLOSED');
  const totalSales = closed.reduce((s, x) => s + Number(x.total_cash_sales || 0), 0);
  const totalEcart = closed.reduce((s, x) => s + Number(x.ecart || 0), 0);
  const shortCount = closed.filter(s => Number(s.ecart || 0) < 0).length;

  if (loading) return <div className="p-6 text-gray-400">Chajman...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Istwa Kès</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tout kès ki te louvri ak fèmen yo, ak diferans ki te genyen.
        </p>
      </div>

      {/* Rezime */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Kès fèmen</p>
          <p className="text-xl font-semibold mt-1">{closed.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total vant cash</p>
          <p className="text-xl font-semibold mt-1">{fmt(totalSales)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total diferans</p>
          <p className={`text-xl font-semibold mt-1 ${
            totalEcart === 0 ? 'text-green-600' : totalEcart < 0 ? 'text-red-600' : 'text-amber-600'
          }`}>
            {totalEcart > 0 ? '+' : ''}{fmt(totalEcart)}
          </p>
          {shortCount > 0 && (
            <p className="text-xs text-red-500 mt-0.5">{shortCount} kès ki te manke kòb</p>
          )}
        </div>
      </div>

      {/* Tablo sesyon yo */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto print:hidden">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-400 bg-gray-50">
              <th className="px-4 py-3">Ouvèti</th>
              <th className="px-4 py-3">Fèmti</th>
              <th className="px-4 py-3 text-right">Fon</th>
              <th className="px-4 py-3 text-right">Vant cash</th>
              <th className="px-4 py-3 text-right">Konte</th>
              <th className="px-4 py-3 text-right">Diferans</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                Pa gen okenn kès anrejistre toujou.
              </td></tr>
            )}
            {sessions.map(s => {
              const isOpen = s.status === 'OPEN';
              const ecart = Number(s.ecart || 0);
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDateTime(s.opened_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isOpen ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        Toujou louvri
                      </span>
                    ) : (
                      <span className="text-gray-600">{fmtDateTime(s.closed_at)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(s.opening_amount)}</td>
                  <td className="px-4 py-3 text-right">{isOpen ? '—' : fmt(Number(s.total_cash_sales || 0))}</td>
                  <td className="px-4 py-3 text-right">{isOpen ? '—' : fmt(Number(s.counted_amount || 0))}</td>
                  <td className="px-4 py-3 text-right">
                    {isOpen ? '—' : (
                      <span className={`font-semibold ${
                        ecart === 0 ? 'text-green-600' : ecart < 0 ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {ecart > 0 ? '+' : ''}{fmt(ecart)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!isOpen && (
                      <button onClick={() => setSelected(s)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 whitespace-nowrap">
                        Wè rapò
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== MODAL RAPÒ Z ===== */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-2xl w-full max-w-sm my-4 print:rounded-none print:max-w-none print:my-0">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center print:hidden">
              <h2 className="font-semibold text-gray-800">Rapò Fèmti Kès</h2>
              <button onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>

            <div id="receipt-print" className="receipt-ticket">
              <div className="text-center">
                <div className="biz-name">{bizName}</div>
                <div className="line">RAPÒ FÈMTI KÈS (Z)</div>
              </div>

              <div className="divider"></div>

              <div className="line">Ouvèti: {fmtDateTime(selected.opened_at)}</div>
              <div className="line">Fèmti: {fmtDateTime(selected.closed_at)}</div>

              <div className="divider"></div>

              <div className="item-row">
                <span>Fon de kès</span>
                <span>{fmt(selected.opening_amount)}</span>
              </div>
              <div className="item-row">
                <span>Total vant cash</span>
                <span>{fmt(Number(selected.total_cash_sales || 0))}</span>
              </div>
              <div className="item-row">
                <span>Sòti espès</span>
                <span>- {fmt(Number(selected.cash_out || 0))}</span>
              </div>

              <div className="divider"></div>

              <div className="total-row">
                <span>DWE GENYEN</span>
                <span>{fmt(Number(selected.expected_amount || 0))}</span>
              </div>
              <div className="item-row">
                <span>Kòb konte</span>
                <span>{fmt(Number(selected.counted_amount || 0))}</span>
              </div>
              <div className="total-row">
                <span>DIFERANS</span>
                <span>
                  {Number(selected.ecart || 0) > 0 ? '+' : ''}{fmt(Number(selected.ecart || 0))}
                </span>
              </div>

              <div className="divider"></div>

              <div className="text-center footer-text">
                {Number(selected.ecart || 0) === 0
                  ? 'Kès la balanse.'
                  : Number(selected.ecart || 0) < 0
                    ? 'Kès la manke kòb.'
                    : 'Kès la gen twòp kòb.'}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-2 print:hidden">
              <button onClick={() => setSelected(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Fèmen
              </button>
              <button onClick={printReport}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Enprime rapò
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== STIL RAPÒ (80mm) ===== */}
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
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </div>
  );
}