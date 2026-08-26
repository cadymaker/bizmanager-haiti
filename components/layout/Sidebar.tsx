'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const nav = [
  { href: '/dashboard', label: 'Tablo de bòd' },
  { href: '/pos', label: 'Vant (POS)' },
  { href: '/invoices', label: 'Fakti' },
  { href: '/expenses', label: 'Depans' },
  { href: '/clients', label: 'Kliyan / Dèt' },
  { href: '/inventory', label: 'Envantè', retailOnly: true },
  { href: '/promotions', label: 'Pwomosyon' },
  { href: '/cash-history', label: 'Istwa Kès' },
  { href: '/reports', label: 'Rapò & Statistik' },
  { href: '/team', label: 'Itilizatè' },
  { href: '/subscribe', label: 'Achte lisans' },
  { href: '/settings', label: 'Paramèt' },
];

export default function Sidebar({ businessName, isAdmin, niche, role, onNavigate }: { businessName: string; isAdmin: boolean; niche?: string; role?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const isCashier = role === 'cashier';

  // Filtre eleman ki pou retail sèlman (Envantè)
  const visibleNav = nav.filter(item => !item.retailOnly || niche === 'retail');

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <p className="text-xs uppercase text-gray-400 tracking-widest">BizManager</p>
        <p className="font-semibold truncate mt-0.5">{businessName}</p>
        <p className="text-xs text-gray-400 mt-0.5">Gonaïves, Ayiti</p>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {isCashier ? (
          // ===== MENI KESYE (sèlman POS) =====
          <Link href="/pos" onClick={onNavigate}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith('/pos')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}>
            Vant (POS)
          </Link>
        ) : (
          // ===== MENI MÈT (tout bagay, nan lòd chwazi a) =====
          <>
            {visibleNav.map(({ href, label }) => (
              <Link key={href} href={href} onClick={onNavigate}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname.startsWith(href)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}>
                {label}
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className="border-t border-gray-700 my-2" />
                <Link href="/admin" onClick={onNavigate}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    pathname.startsWith('/admin')
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-400 hover:bg-gray-800'
                  }`}>
                  Pannèl Admin
                </Link>
              </>
            )}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-gray-700">
        <button onClick={handleSignOut}
          className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg">
          Dekoneksyon
        </button>
      </div>
    </aside>
  );
}