'use client';

export default function PosPage() {
  return (
    <div className="p-6 flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Sistèm Vant (POS)</h1>
        <p className="text-gray-500 mt-2">
          Sistèm pou fè vant rapid ak resi ap vini byento. Ou pral ka vann pwodwi, jenere resi, epi enprime yo dirèkteman isit la.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6 text-amber-700 text-sm">
          🚧 An konstriksyon — disponib nan yon pwochen mizajou.
        </div>
      </div>
    </div>
  );
}