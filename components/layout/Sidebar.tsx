'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const nav = [
  { href: '/dashboard', label: 'Tablo de bòd' },
  { href: '/invoices', label: 'Factures' },
  { href: '/clients', label: 'Clients / Dèt' },
  { href: '/expenses', label: 'Depans' },
  { href: '/subscribe', label: 'Achte lisans' },
  { href: '/settings', label: 'Paramèt' },
];

export default function Sidebar({ businessName, isAdmin, niche, onNavigate }: { businessName: string; isAdmin: boolean; niche?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <p className="text-xs uppercase text-gray-400 tracking-widest">BizManager</p>
        <p className="font-semibold truncate mt-0.5">{businessName}</p>
        <p className="text-xs text-gray-400 mt-0.5">Gonaïves, Ayiti</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label }) => (
          <Link key={href} href={href} onClick={onNavigate}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith(href)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}>
            {label}
          </Link>
        ))}

        {niche === 'retail' && (
          <Link href="/inventory" onClick={onNavigate}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith('/inventory')
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}>
            Envantè
          </Link>
        )}

        {isAdmin && (
          <>
            <div className="border-t border-gray-700 my-2" />
            <Link href="/admin" onClick={onNavigate}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-400 hover:bg-gray-800'
              }`}>
              Admin Dashboard
            </Link>
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