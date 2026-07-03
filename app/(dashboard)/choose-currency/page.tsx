'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CURRENCIES, Currency } from '@/lib/currency';

export default function ChooseCurrencyPage() {
  const [selected, setSelected] = useState<Currency>('HTG');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }

    const { error } = await supabase
      .from('businesses')
      .update({ currency: selected })
      .eq('id', session.user.id);

    if (error) {
      setError('Yon erè rive: ' + error.message);
      setSaving(false);
      return;
    }

    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest">BizManager</p>
          <h1 className="text-xl font-semibold mt-1 text-gray-900">Chwazi devise biznis ou</h1>
          <p className="text-sm text-gray-500 mt-2">
            Nan ki lajan biznis ou opere? Tout montan yo (fakti, vant, depans) ap afiche nan devise sa a.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
        )}

        <div className="space-y-3">
          {(Object.keys(CURRENCIES) as Currency[]).map(cur => (
            <button key={cur} onClick={() => setSelected(cur)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                selected === cur
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
              <div className="text-left">
                <div className="font-medium text-gray-900">{CURRENCIES[cur].label}</div>
                <div className="text-xs text-gray-500 mt-0.5">Egzanp: 5 000 {CURRENCIES[cur].symbol}</div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                selected === cur ? 'border-blue-600' : 'border-gray-300'
              }`}>
                {selected === cur && <div className="w-3 h-3 rounded-full bg-blue-600" />}
              </div>
            </button>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Ap anrejistre...' : 'Kontinye'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          Ou ka chanje devise a pita nan Paramèt.
        </p>
      </div>
    </div>
  );
}