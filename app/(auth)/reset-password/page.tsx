'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  // Verifye si gen yon sesyon reset valid (soti nan lyen imèl la)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        // Tann yon ti moman pou Supabase trete token nan URL la
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) setReady(true);
            else setError('Lyen an envalid oswa li ekspire. Tanpri mande yon nouvo lyen.');
          });
        }, 1500);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Modpas la dwe genyen omwen 6 karaktè.');
      return;
    }
    if (password !== confirm) {
      setError('De modpas yo pa menm.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError('Yon erè rive: ' + error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    // Redirije nan koneksyon apre 2 segonn
    setTimeout(() => { window.location.href = '/login'; }, 2500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest">BizManager</p>
          <h1 className="text-xl font-semibold mt-1">Chanje modpas ou</h1>
        </div>

        {done ? (
          <div className="bg-green-50 text-green-700 text-sm rounded-lg p-4 text-center">
            Modpas ou chanje ak siksè! N ap voye ou nan koneksyon...
          </div>
        ) : !ready && !error ? (
          <div className="text-center text-sm text-gray-500 py-4">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Ap verifye lyen an...
          </div>
        ) : error && !ready ? (
          <div className="space-y-4">
            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-4 text-center">{error}</div>
            <a href="/forgot-password"
              className="block text-center text-sm text-blue-600 hover:underline">
              Mande yon nouvo lyen
            </a>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Nouvo modpas</label>
                <input type="password"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Konfime modpas la</label>
                <input type="password"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-2">
                {loading ? 'Ap chanje...' : 'Chanje modpas la'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}