'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Imèl oswa mo de pas pa kòrèk.');
      setLoading(false);
      return;
    }

    // Tann 1 segonn pou sesyon an sove nan cookie anvan redireksyon
    await new Promise(resolve => setTimeout(resolve, 1000));
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest">BizManager</p>
          <h1 className="text-xl font-semibold mt-1">Konekte nan kont ou</h1>
        </div>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
        )}
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Imèl</label>
            <input type="email"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Mo de pas</label>
            <input type="password"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-2">
            {loading ? 'Koneksyon... Tann...' : 'Konekte'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Pa gen kont?{' '}
          <a href="/register" className="text-blue-600 font-medium hover:underline">Kreye youn gratis</a>
        </p>
      </div>
    </div>
  );
}