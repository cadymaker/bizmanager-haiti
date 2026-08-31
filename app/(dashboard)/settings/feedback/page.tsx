'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: '🐛 Yon pwoblèm', hint: 'Yon bagay ki pa mache byen nan app la.' },
  { value: 'suggestion', label: '💡 Yon sijesyon', hint: 'Yon lide pou amelyore app la.' },
  { value: 'question', label: '❓ Yon kesyon', hint: 'Yon bagay ou pa konprann.' },
  { value: 'other', label: '💬 Lòt', hint: 'Nenpòt lòt bagay ou vle di nou.' },
];

export default function FeedbackPage() {
  const [business, setBusiness] = useState<any>(null);
  const [category, setCategory] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const ctx = await getBusinessContext();
      if (!ctx) return;
      const { data } = await supabase
        .from('businesses')
        .select('business_name, owner_name, email, phone')
        .eq('id', ctx.businessId)
        .single();
      setBusiness(data);
    }
    load();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    if (message.trim().length < 10) {
      setErr('Ekri yon mesaj ki gen omwen 10 karaktè.');
      return;
    }

    setSending(true);
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) { setSending(false); return; }

    const { error } = await supabase.from('feedback').insert({
      business_id: ctx.businessId,
      business_name: business?.business_name ?? null,
      owner_name: business?.owner_name ?? null,
      email: business?.email ?? null,
      phone: business?.phone ?? null,
      category: category,
      message: message.trim(),
    });

    setSending(false);

    if (error) {
      setErr('Erè: ' + error.message);
      return;
    }

    setMessage('');
    setCategory('suggestion');
    setSent(true);
  }

  const activeCat = FEEDBACK_CATEGORIES.find(c => c.value === category);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <a href="/settings" className="text-sm text-blue-600 hover:underline">← Retounen nan Paramèt</a>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Ban nou opinyon w</h1>
        <p className="text-sm text-gray-500 mt-1">
          Yon pwoblèm, yon sijesyon, oswa yon kesyon? Ekri nou — sa ede nou amelyore
          BizManager pou tout biznis ayisyen yo.
        </p>
      </div>

      {sent ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-lg font-medium text-green-800">✓ Mèsi!</p>
          <p className="text-sm text-green-600 mt-1">
            Nou resevwa mesaj ou. N ap gade l byen vit.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
            <button onClick={() => setSent(false)}
              className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              Voye yon lòt mesaj
            </button>
            <a href="/settings"
              className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
              Retounen nan Paramèt
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={send} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-sm text-gray-600 font-medium">Sou ki sa?</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {FEEDBACK_CATEGORIES.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setCategory(c.value)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    category === c.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
            {activeCat && (
              <p className="text-xs text-gray-400 mt-2">{activeCat.hint}</p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-600 font-medium">Mesaj ou</label>
            <textarea
              rows={6}
              placeholder={
                category === 'bug'
                  ? 'Esplike sa ki pa mache, epi ki sa ou t ap fè lè sa rive...'
                  : 'Ekri sa ou vle di nou...'
              }
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              N ap wè non biznis ou ak kontak ou ansanm ak mesaj la, pou nou ka reponn ou.
            </p>
          </div>

          {err && (
            <div className="text-sm rounded-lg p-3 bg-red-50 text-red-700">{err}</div>
          )}

          <button type="submit" disabled={sending}
            className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {sending ? 'Ap voye...' : 'Voye mesaj la'}
          </button>
        </form>
      )}
    </div>
  );
}