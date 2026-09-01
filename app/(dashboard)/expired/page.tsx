'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';

export default function ExpiredPage() {
  const router = useRouter();
  const [bizName, setBizName] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const ctx = await getBusinessContext();
      if (!ctx) return;
      setRole(ctx.role);

      const { data } = await supabase
        .from('businesses')
        .select('business_name, phone')
        .eq('id', ctx.businessId)
        .single();
      setBizName(data?.business_name ?? '');
    }
    load();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
          <span className="text-3xl">🔒</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mt-5">
          Lisans lan ekspire
        </h1>

        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          Lisans {bizName ? <strong>{bizName}</strong> : 'biznis lan'} fini.
          Sistèm vant lan bloke jiskaske lisans lan renouvle.
        </p>

        {role === 'cashier' ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-5 text-sm text-blue-800">
            Kontakte mèt biznis la pou l renouvle lisans lan.
          </div>
        ) : (
          <a href="/subscribe"
            className="block mt-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            Renouvle lisans lan
          </a>
        )}

        <button onClick={signOut}
          className="w-full mt-3 py-2.5 text-sm text-gray-500 hover:text-gray-800">
          Dekoneksyon
        </button>
      </div>
    </div>
  );
}