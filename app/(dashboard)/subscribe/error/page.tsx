'use client';
import { useRouter } from 'next/navigation';

export default function SubscribeErrorPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-3xl">✕</div>
        <h1 className="text-xl font-semibold text-gray-900">Peman an pa fin fèt</h1>
        <p className="text-sm text-gray-500">Peman an te anile oswa li echwe. Ou pa peye anyen — ou ka eseye ankò.</p>
        <button onClick={() => router.push('/subscribe')}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          Retounen achte lisans
        </button>
      </div>
    </div>
  );
}