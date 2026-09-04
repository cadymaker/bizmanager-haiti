'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SubscribeSuccessPage() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'active' | 'pending'>('checking');

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function check() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data } = await supabase
        .from('businesses')
        .select('license_status, license_expiry_date')
        .eq('id', session.user.id)
        .single();

      const active =
        data?.license_status === 'active' &&
        !!data?.license_expiry_date &&
        new Date(data.license_expiry_date) > new Date();

      if (cancelled) return;
      if (active) { setState('active'); return; }

      attempts += 1;
      if (attempts >= 7) { setState('pending'); return; }
      setTimeout(check, 3000); // webhook la ka pran kèk segond
    }

    check();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {state === 'checking' && (
          <>
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <h1 className="text-xl font-semibold text-gray-900">N ap konfime peman ou...</h1>
            <p className="text-sm text-gray-500">Tann yon ti moman, tanpri.</p>
          </>
        )}
        {state === 'active' && (
          <>
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto text-3xl">✓</div>
            <h1 className="text-xl font-semibold text-gray-900">Lisans ou aktive!</h1>
            <p className="text-sm text-gray-500">Mèsi. Ou ka kontinye itilize BizManager kounye a.</p>
            <button onClick={() => router.push('/dashboard')}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Ale nan dashboard
            </button>
          </>
        )}
        {state === 'pending' && (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-3xl">⏳</div>
            <h1 className="text-xl font-semibold text-gray-900">Peman ou resevwa</h1>
            <p className="text-sm text-gray-500">L ap aktive nan yon ti moman. Si sa pran plis pase kèk minit, rafrechi paj la oswa kontakte sipò.</p>
            <button onClick={() => router.push('/dashboard')}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              Ale nan dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}