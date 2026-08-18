import Link from 'next/link';
import PrivacyContent from '../privacy-content';

export const metadata = {
  title: 'Politik Konfidansyalite — BizManager Haiti',
  description: 'Politik Konfidansyalite BizManager Haiti',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-600">BizManager Haiti</h1>
          <p className="text-sm text-gray-500 mt-1">Politik Konfidansyalite / Politique de Confidentialité</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
          <PrivacyContent />
        </div>

        <div className="mt-6 text-center text-sm">
          <Link href="/legal/terms" className="text-blue-600 hover:underline">Kondisyon Itilizasyon →</Link>
        </div>
      </div>
    </div>
  );
}