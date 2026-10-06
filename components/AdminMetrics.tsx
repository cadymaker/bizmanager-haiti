'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/currency';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ListItem {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  days: number;
  paid: boolean;
}

interface Metrics {
  mrr: number;
  freeCodeActive: number;
  revenue: { thisMonth: number; last30: number; allTime: number };
  businesses: {
    total: number;
    trials: number;
    activeLicenses: number;
    expired: number;
    newSignups30: number;
    notRenewed: number;
  };
  activity: { active7: number; usable: number };
  conversion: { rate: number | null; converted: number; trialEnded: number };
  series: { key: string; label: string; revenue: number; signups: number }[];
  lists: {
    expiringSoon: ListItem[];
    trialsEndingSoon: ListItem[];
    notRenewed: ListItem[];
    freeCodeExpired: ListItem[];
  };
}

const fmt = (n: number) => formatMoney(Math.round(n), 'HTG');

function waLink(phone: string | null, text: string) {
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function BigCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function ActionList({
  title, subtitle, items, empty, daysLabel, message, tone, showFreeBadge = false,
}: {
  title: string;
  subtitle: string;
  items: ListItem[];
  empty: string;
  daysLabel: (d: number) => string;
  message: (it: ListItem) => string;
  tone: 'amber' | 'blue' | 'red' | 'purple';
  showFreeBadge?: boolean;
}) {
  const header = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  }[tone];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`px-4 py-3 border-b ${header}`}>
        <h3 className="font-medium text-sm">{title} ({items.length})</h3>
        <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-gray-400">{empty}</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {items.map(it => {
            const link = waLink(it.phone, message(it));
            return (
              <div key={it.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{it.business_name}</span>
                    {showFreeBadge && !it.paid && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-medium whitespace-nowrap">
                        kòd gratis
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {it.owner_name ?? '—'} · {daysLabel(it.days)}
                  </div>
                </div>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 whitespace-nowrap">
                    WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-gray-300 whitespace-nowrap">Pa gen telefòn</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminMetrics() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Pa ka chaje metrik yo.');
      else setM(data);
    } catch {
      setError('Pa ka chaje metrik yo.');
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-400">Ap chaje metrik yo...</div>;
  }
  if (error || !m) {
    return (
      <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm flex justify-between items-center">
        <span>{error || 'Pa ka chaje metrik yo.'}</span>
        <button onClick={load} className="underline font-medium">Eseye ankò</button>
      </div>
    );
  }

  const activePct = m.activity.usable > 0 ? Math.round((m.activity.active7 / m.activity.usable) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Metrik BizManager</h2>
        <button onClick={load} className="text-sm text-blue-600 hover:underline">Rafrechi</button>
      </div>

      {/* Gwo metrik yo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <BigCard
          label="MRR estime"
          value={fmt(m.mrr)}
          sub={m.freeCodeActive > 0
            ? `+ ${m.freeCodeActive} biznis aktif ak kòd gratis (pa konte)`
            : 'Revni chak mwa ki rekiran'}
          accent="text-blue-600"
        />
        <BigCard
          label="Revni mwa sa a"
          value={fmt(m.revenue.thisMonth)}
          sub={`30 jou: ${fmt(m.revenue.last30)} · Total: ${fmt(m.revenue.allTime)}`}
          accent="text-green-600"
        />
        <BigCard
          label="Biznis aktif (7 jou)"
          value={`${m.activity.active7} / ${m.activity.usable}`}
          sub={`${activePct}% nan biznis ki gen aksè fè omwen 1 vant`}
        />
        <BigCard
          label="Konvèsyon esè"
          value={m.conversion.rate === null ? '—' : `${Math.round(m.conversion.rate)}%`}
          sub={`${m.conversion.converted} peye sou ${m.conversion.trialEnded} esè ki fini (kòd gratis pa konte)`}
          accent="text-purple-600"
        />
      </div>

      {/* Rezime biznis yo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SmallStat label="Total biznis" value={m.businesses.total} />
        <SmallStat label="An esè" value={m.businesses.trials} accent="text-amber-600" />
        <SmallStat label="Lisans aktif" value={m.businesses.activeLicenses} accent="text-green-600" />
        <SmallStat label="Ekspire" value={m.businesses.expired} accent="text-red-600" />
        <SmallStat label="Nouvo (30 jou)" value={m.businesses.newSignups30} accent="text-blue-600" />
        <SmallStat label="Pa renouvle" value={m.businesses.notRenewed} accent="text-orange-600" />
      </div>

      {/* Grafik 6 mwa */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-medium text-gray-800 mb-3 text-sm">Revni ak nouvo enskripsyon (6 mwa)</h3>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={m.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="rev" tick={{ fontSize: 11 }} width={70}
                tickFormatter={(v) => new Intl.NumberFormat('fr-HT', { notation: 'compact' }).format(v)} />
              <YAxis yAxisId="sig" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
              <Tooltip
                cursor={false}
                formatter={(v: any, name: any) => (name === 'Revni' ? fmt(Number(v)) : v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="rev" dataKey="revenue" name="Revni" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="sig" dataKey="signups" name="Enskripsyon" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lis aksyon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActionList
          title="Lisans k ap ekspire"
          subtitle="Nan 7 jou kap vini yo — bon moman pou raple yo renouvle."
          items={m.lists.expiringSoon}
          empty="Okenn lisans p ap ekspire semèn sa a."
          daysLabel={d => (d === 0 ? 'ekspire jodi a' : `${d} jou rete`)}
          message={it => it.paid
            ? `Bonjou ${it.owner_name ?? ''}! Lisans BizManager pou ${it.business_name} ap ekspire byento. Ou ka renouvle l nan app la (Achte lisans) ak MonCash. Mèsi!`
            : `Bonjou ${it.owner_name ?? ''}! Mwa gratis BizManager pou ${it.business_name} ap fini byento. Nou espere app la ede w! Pou kontinye, ou ka aktive abònman w nan app la (Achte lisans) ak MonCash.`}
          tone="amber"
          showFreeBadge
        />
        <ActionList
          title="Esè k ap fini"
          subtitle="Nan 3 jou kap vini yo — kontakte yo pou konvèti yo."
          items={m.lists.trialsEndingSoon}
          empty="Okenn esè p ap fini nan 3 jou."
          daysLabel={d => (d === 0 ? 'fini jodi a' : `${d} jou rete`)}
          message={it => `Bonjou ${it.owner_name ?? ''}! Esè gratis BizManager pou ${it.business_name} ap fini byento. Èske ou bezwen èd pou kontinye? Ou ka aktive abònman w nan app la ak MonCash.`}
          tone="blue"
        />
        <ActionList
          title="Kòd gratis ki fini"
          subtitle="Te resevwa yon kòd gratis, men poko peye — bon kandida pou konvèti."
          items={m.lists.freeCodeExpired}
          empty="Pa gen kòd gratis ki fini san peman."
          daysLabel={d => `fini depi ${d} jou`}
          message={it => `Bonjou ${it.owner_name ?? ''}! Mwa gratis BizManager pou ${it.business_name} fini. Kijan app la te ede biznis ou? Pou kontinye, ou ka aktive abònman w nan app la ak MonCash. N ap la si w bezwen èd.`}
          tone="purple"
        />
        <ActionList
          title="Pa renouvle"
          subtitle="Te peye deja, men lisans lan ekspire."
          items={m.lists.notRenewed}
          empty="Pa gen kliyan ki pa renouvle."
          daysLabel={d => `ekspire depi ${d} jou`}
          message={it => `Bonjou ${it.owner_name ?? ''}! Nou remake lisans BizManager pou ${it.business_name} ekspire. Èske gen yon bagay nou ka amelyore pou ou? Ou ka renouvle nenpòt lè nan app la.`}
          tone="red"
        />
      </div>
    </div>
  );
}