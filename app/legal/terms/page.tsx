import Link from 'next/link';
import TermsContent from '../terms-content';

export const metadata = {
  title: 'Kondisyon Itilizasyon — BizManager Haiti',
  description: 'Kondisyon Itilizasyon BizManager Haiti',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-600">BizManager Haiti</h1>
          <p className="text-sm text-gray-500 mt-1">Kondisyon Itilizasyon / Conditions d'Utilisation</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
          <TermsContent />
        </div>

        <div className="mt-6 text-center text-sm">
          <Link href="/legal/privacy" className="text-blue-600 hover:underline">← Politik Konfidansyalite</Link>
        </div>
      </div>
    </div>
  );
}