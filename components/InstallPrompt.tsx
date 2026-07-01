'use client';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem('install-dismissed');
      if (!dismissed) setShow(true);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem('install-dismissed', 'true');
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '16px',
      left: '16px',
      right: '16px',
      maxWidth: '420px',
      margin: '0 auto',
      zIndex: 50,
    }}
      className="bg-white rounded-xl border border-gray-200 shadow-lg p-4 flex items-center gap-3">
      <img src="/icon-192.png" alt="BizManager" className="w-12 h-12 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm">Enstale BizManager</p>
        <p className="text-xs text-gray-500">Aksè rapid depi ekran akèy ou</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={handleDismiss}
          className="px-3 py-2 text-gray-500 text-sm hover:bg-gray-50 rounded-lg">
          Pita
        </button>
        <button onClick={handleInstall}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          Enstale
        </button>
      </div>
    </div>
  );
}