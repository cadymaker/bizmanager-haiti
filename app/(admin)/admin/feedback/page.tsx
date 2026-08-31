'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Feedback {
  id: string;
  business_id: string | null;
  business_name: string | null;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

interface Deletion {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  niche: string | null;
  license_status: string | null;
  reason: string;
  note: string | null;
  account_created_at: string | null;
  deleted_at: string;
}

const CATEGORIES: Record<string, { label: string; cls: string }> = {
  bug: { label: '🐛 Pwoblèm', cls: 'bg-red-100 text-red-700' },
  suggestion: { label: '💡 Sijesyon', cls: 'bg-blue-100 text-blue-700' },
  question: { label: '❓ Kesyon', cls: 'bg-amber-100 text-amber-700' },
  other: { label: '💬 Lòt', cls: 'bg-gray-100 text-gray-700' },
};

const STATUSES: Record<string, { label: string; cls: string }> = {
  new: { label: 'Nouvo', cls: 'bg-green-100 text-green-700' },
  read: { label: 'Li', cls: 'bg-blue-100 text-blue-700' },
  done: { label: 'Fini', cls: 'bg-gray-100 text-gray-600' },
};

const DELETE_REASONS: Record<string, string> = {
  too_expensive: 'Pri twò chè',
  not_using: 'Pa itilize app la ase',
  too_complicated: 'App la twò konplike',
  missing_features: 'App la pa gen sa l bezwen',
  found_alternative: 'Jwenn yon lòt app',
  business_closed: 'Biznis la fèmen',
  technical_issues: 'Pwoblèm teknik',
  other: 'Lòt rezon',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Konbyen tan yon kont te dire
function accountAge(created: string | null, deleted: string): string {
  if (!created) return '—';
  const days = Math.round(
    (new Date(deleted).getTime() - new Date(created).getTime()) / 86400000
  );
  if (days < 1) return 'mwens pase 1 jou';
  if (days === 1) return '1 jou';
  if (days < 30) return `${days} jou`;
  const months = Math.round(days / 30);
  return months === 1 ? '1 mwa' : `${months} mwa`;
}

export default function AdminFeedbackPage() {
  const [tab, setTab] = useState<'feedback' | 'deletions'>('feedback');
  const [items, setItems] = useState<Feedback[]>([]);
  const [deletions, setDeletions] = useState<Deletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'bug' | 'suggestion'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Ou pa konekte.'); setLoading(false); return; }

    const res = await fetch('/api/admin/feedback', {
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Pa ka chaje done yo.');
      setLoading(false);
      return;
    }

    setItems(data.feedback ?? []);
    setDeletions(data.deletions ?? []);
    setLoading(false);
  }

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(null); return; }

    await fetch('/api/admin/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, status }),
    });

    setItems(prev => prev.map(f => f.id === id ? { ...f, status } : f));
    setBusy(null);
  }

  function replyByEmail(f: Feedback) {
    if (!f.email) return;
    const subject = `BizManager — repons pou mesaj ou`;
    const body =
      `Bonjou ${f.owner_name ?? ''},\n\n` +
      `Mèsi pou mesaj ou.\n\n` +
      `\n\n` +
      `---\n` +
      `Mesaj ou te voye a:\n"${f.message}"\n`;
    window.location.href =
      `mailto:${f.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function replyByWhatsApp(f: Feedback) {
    if (!f.phone) return;
    const phone = f.phone.replace(/[^0-9]/g, '');
    const text = `Bonjou ${f.owner_name ?? ''}! Mèsi pou mesaj ou nan BizManager. `;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  const filtered = items.filter(f => {
    if (filter === 'all') return true;
    if (filter === 'new') return f.status === 'new';
    return f.category === filter;
  });

  const newCount = items.filter(f => f.status === 'new').length;
  const bugCount = items.filter(f => f.category === 'bug').length;

  // Konte rezon efasman yo
  const reasonCounts = deletions.reduce((acc, d) => {
    acc[d.reason] = (acc[d.reason] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

  if (error) return (
    <div className="p-6"><div className="bg-red-50 text-red-600 rounded-xl p-4">{error}</div></div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <a href="/admin" className="text-sm text-blue-600 hover:underline">← Retounen nan Pannèl Admin</a>
          <h1 className="text-2xl font-semibold text-gray-900 mt-2">Sa itilizatè yo di</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} mesaj · {deletions.length} kont efase
          </p>
        </div>
        <button onClick={load}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-black">
          Rafrechi
        </button>
      </div>

      {/* Onglè */}
      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab('feedback')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'feedback'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}>
          💬 Feedback ({items.length})
        </button>
        <button onClick={() => setTab('deletions')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'deletions'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}>
          🚪 Rezon efasman ({deletions.length})
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-gray-400 text-sm">Chajman...</div>
      ) : tab === 'feedback' ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase">Nouvo</p>
              <p className="text-2xl font-semibold mt-1 text-green-600">{newCount}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase">Pwoblèm</p>
              <p className="text-2xl font-semibold mt-1 text-red-600">{bugCount}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase">Total</p>
              <p className="text-2xl font-semibold mt-1">{items.length}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { v: 'all', label: 'Tout' },
              { v: 'new', label: 'Nouvo sèlman' },
              { v: 'bug', label: '🐛 Pwoblèm' },
              { v: 'suggestion', label: '💡 Sijesyon' },
            ].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  filter === f.v
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Pa gen okenn mesaj nan filt sa a.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(f => {
                const cat = CATEGORIES[f.category] ?? CATEGORIES.other;
                const st = STATUSES[f.status] ?? STATUSES.new;
                return (
                  <div key={f.id} className={`bg-white rounded-xl border p-5 ${
                    f.status === 'new' ? 'border-green-200' : 'border-gray-200'
                  }`}>
                    <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.cls}`}>
                            {cat.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="font-medium text-gray-900 mt-2">
                          {f.business_name ?? 'Biznis efase'}
                        </div>
                        <div className="text-xs text-gray-400 break-all">
                          {f.owner_name} {f.email ? `· ${f.email}` : ''} {f.phone ? `· ${f.phone}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {fmtDate(f.created_at)}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {f.message}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {f.email && (
                        <button onClick={() => replyByEmail(f)}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200">
                          ✉️ Reponn pa imèl
                        </button>
                      )}
                      {f.phone && (
                        <button onClick={() => replyByWhatsApp(f)}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200">
                          WhatsApp
                        </button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        {f.status !== 'read' && (
                          <button onClick={() => setStatus(f.id, 'read')} disabled={busy === f.id}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 disabled:opacity-50">
                            Make kòm li
                          </button>
                        )}
                        {f.status !== 'done' && (
                          <button onClick={() => setStatus(f.id, 'done')} disabled={busy === f.id}
                            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs hover:bg-black disabled:opacity-50">
                            Make kòm fini
                          </button>
                        )}
                        {f.status === 'done' && (
                          <button onClick={() => setStatus(f.id, 'new')} disabled={busy === f.id}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 disabled:opacity-50">
                            Remete nouvo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Rezime rezon yo */}
          {topReasons.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-medium text-gray-800 mb-3">Poukisa moun ale</h2>
              <div className="space-y-2">
                {topReasons.map(([reason, count]) => {
                  const pct = Math.round((count / deletions.length) * 100);
                  return (
                    <div key={reason}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{DELETE_REASONS[reason] ?? reason}</span>
                        <span className="text-gray-500">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {deletions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Pa gen okenn kont ki efase toujou.
            </div>
          ) : (
            <div className="space-y-3">
              {deletions.map(d => (
                <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {DELETE_REASONS[d.reason] ?? d.reason}
                      </span>
                      <div className="font-medium text-gray-900 mt-2">
                        {d.business_name ?? '—'}
                      </div>
                      <div className="text-xs text-gray-400 break-all">
                        {d.owner_name} {d.email ? `· ${d.email}` : ''} {d.phone ? `· ${d.phone}` : ''}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {d.niche ? `Niche: ${d.niche} · ` : ''}
                        Lisans: {d.license_status ?? '—'} ·
                        Kont lan te dire {accountAge(d.account_created_at, d.deleted_at)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {fmtDate(d.deleted_at)}
                    </div>
                  </div>

                  {d.note && (
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {d.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}