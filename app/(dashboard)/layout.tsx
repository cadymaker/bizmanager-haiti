'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/layout/Sidebar';
import InstallPrompt from '@/components/InstallPrompt';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
 const [businessName, setBusinessName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;

    async function checkSession() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkSession, 500);
        } else {
          window.location.href = '/login';
        }
        return;
      }

     const { data: business } = await supabase
        .from('businesses')
        .select('business_name, is_admin, niche, license_status, license_expiry_date, trial_start_date')
        .eq('id', session.user.id)
        .single();

      // Verifye si lisans lan aksesib
      let accessible = true;
      if (business) {
        const now = new Date();
        if (business.license_status === 'active' && business.license_expiry_date) {
          accessible = new Date(business.license_expiry_date) > now;
        } else if (business.license_status === 'trial') {
          const trialEnd = new Date(business.trial_start_date);
          trialEnd.setDate(trialEnd.getDate() + 14);
          accessible = trialEnd > now;
        } else {
          accessible = false;
        }
      }

      const path = window.location.pathname;
      const allowedWhenExpired = ['/subscribe', '/settings', '/admin'];
      const isAllowed = allowedWhenExpired.some(p => path.startsWith(p));

      // Admin toujou gen aksè
      if (!accessible && !business?.is_admin && !isAllowed) {
        window.location.href = '/subscribe';
        return;
      }

      setBusinessName(business?.business_name ?? '');
      setIsAdmin(business?.is_admin ?? false);
      setNiche(business?.niche ?? '');
      setLoading(false);
    }

    checkSession();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Chajman...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className={`
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-200
        md:relative md:translate-x-0
        ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
       <Sidebar businessName={businessName} isAdmin={isAdmin} niche={niche} onNavigate={() => setMenuOpen(false)} />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMenuOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
          <button onClick={() => setMenuOpen(true)}
            className="text-gray-700 p-1" aria-label="Meni">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-semibold text-gray-800 truncate">{businessName}</span>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <InstallPrompt />
    </div>
  );
}