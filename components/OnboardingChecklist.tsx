'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';

interface Step {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

export default function OnboardingChecklist() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { check(); }, []);

  async function check() {
    const supabase = createClient();
    const ctx = await getBusinessContext();
    if (!ctx) return;

    // Si mèt la deja fèmen checklist la, pa montre l ankò
    if (localStorage.getItem(`bzm_onboarding_done_${ctx.businessId}`) === '1') {
      return;
    }

    const bid = ctx.businessId;

    const [prodRes, clientRes, invRes, bizRes] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', bid),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('business_id', bid),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('business_id', bid),
      supabase.from('businesses').select('logo_url, street, city, department').eq('id', bid).single(),
    ]);

    const biz = bizRes.data as any;
    const hasAddress = !!(biz?.street || biz?.city || biz?.department);

    const built: Step[] = [
      { key: 'product', label: 'Ajoute premye pwodwi w', href: '/inventory', done: (prodRes.count ?? 0) > 0 },
      { key: 'client', label: 'Ajoute kliyan ou', href: '/clients', done: (clientRes.count ?? 0) > 0 },
      { key: 'logo', label: 'Mete logo biznis ou', href: '/settings', done: !!biz?.logo_url },
      { key: 'address', label: 'Ajoute adrès biznis ou', href: '/settings', done: hasAddress },
      { key: 'sale', label: 'Fè premye vant ou', href: '/pos', done: (invRes.count ?? 0) > 0 },
    ];

    setSteps(built);
  }

  function dismiss() {
    const supabase = createClient();
    getBusinessContext().then(ctx => {
      if (ctx) localStorage.setItem(`bzm_onboarding_done_${ctx.businessId}`, '1');
    });
    setDismissed(true);
  }

  if (dismissed || !steps) return null;

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  // Si tout etap fèt, montre yon ti mesaj felisitasyon ak yon bouton fèmen
  if (allDone) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-green-800 text-sm">
          <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm">✓</span>
          <span><strong>Tout bon!</strong> Ou fin konfigire BizManager. Bon travay!</span>
        </div>
        <button onClick={dismiss} className="text-green-700 text-sm font-medium hover:underline whitespace-nowrap">
          Fèmen
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-blue-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
        <div>
          <h2 className="font-medium text-blue-900">Byenveni sou BizManager 👋</h2>
          <p className="text-xs text-blue-600 mt-0.5">
            Fè premye etap sa yo pou w byen kòmanse ({doneCount}/{steps.length} fèt)
          </p>
        </div>
        <button onClick={dismiss} className="text-blue-400 hover:text-blue-700 text-sm whitespace-nowrap">
          Sote
        </button>
      </div>

      {/* Ti bar pwogrè */}
      <div className="h-1.5 bg-gray-100">
        <div className="h-full bg-blue-600 transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <div className="divide-y divide-gray-100">
        {steps.map(step => (
          step.done ? (
            <div key={step.key} className="px-4 py-3 flex items-center gap-3 text-gray-400">
              <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm flex-shrink-0">✓</span>
              <span className="text-sm line-through">{step.label}</span>
            </div>
          ) : (
            <a key={step.key} href={step.href}
              className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <span className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0" />
              <span className="text-sm text-gray-800 font-medium flex-1">{step.label}</span>
              <span className="text-blue-600 text-sm">→</span>
            </a>
          )
        ))}
      </div>
    </div>
  );
}