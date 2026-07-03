'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setError('Yon erè rive. Tanpri eseye ankò.');
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest">BizManager</p>
          <h1 className="text-xl font-semibold mt-1">Bliye modpas ou?</h1>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-50 text-green-700 text-sm rounded-lg p-4 text-center">
              Nou voye yon lyen bay <strong>{email}</strong>. Tcheke imèl ou (ak dosye spam nan tou) epi klike lyen an pou chanje modpas ou.
            </div>
            <a href="/login"
              className="block text-center text-sm text-blue-600 hover:underline">
              ← Retounen nan koneksyon
            </a>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 text-center mb-4">
              Antre imèl ou, epi n ap voye yon lyen pou ou chanje modpas ou.
            </p>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Imèl</label>
                <input type="email"
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-2">
                {loading ? 'Ap voye...' : 'Voye lyen reset la'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">
              <a href="/login" className="text-blue-600 font-medium hover:underline">← Retounen nan koneksyon</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}