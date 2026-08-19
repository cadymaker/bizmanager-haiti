export default function PrinterGuidePage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Konfigirasyon Enprimant</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kijan pou konekte yon enprimant tèmik Bluetooth 80mm ak telefòn oswa tablèt Android ou a.
        </p>
      </div>

      {/* Sa ou bezwen */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800 mb-3">Sa ou bezwen</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span>📱</span>
            <span>Yon telefòn oswa tablèt <strong>Android</strong> (RawBT pa mache sou iPhone).</span>
          </li>
          <li className="flex gap-2">
            <span>🖨️</span>
            <span>Yon enprimant tèmik <strong>Bluetooth 80mm</strong> (ESC/POS).</span>
          </li>
          <li className="flex gap-2">
            <span>📲</span>
            <span>App <strong>RawBT</strong> (gratis sou Google Play).</span>
          </li>
        </ul>
      </div>

      {/* Etap 1 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm flex-shrink-0">1</span>
          <h2 className="font-medium text-gray-800">Konekte (pair) enprimant lan nan Bluetooth</h2>
        </div>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Limen enprimant lan (chaje l anvan si l gen batri).</li>
          <li>Sou telefòn lan, ale nan <strong>Paramèt → Bluetooth</strong> epi limen Bluetooth.</li>
          <li>Chèche non enprimant lan nan lis la epi peze pou konekte.</li>
          <li>Si l mande yon kòd PIN, eseye <strong>0000</strong> oswa <strong>1234</strong> (se de kòd ki pi komen yo).</li>
        </ol>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          Nòt: enprimant lan ka "pair" san l pa enprime toujou — se RawBT (etap 3) k ap fè l enprime vre.
        </div>
      </div>

      {/* Etap 2 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm flex-shrink-0">2</span>
          <h2 className="font-medium text-gray-800">Enstale RawBT</h2>
        </div>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Louvri <strong>Google Play Store</strong>.</li>
          <li>Chèche <strong>“RawBT”</strong> (RawBT inkless print service).</li>
          <li>Enstale l. Li gratis pou kòmanse.</li>
        </ol>
      </div>

      {/* Etap 3 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm flex-shrink-0">3</span>
          <h2 className="font-medium text-gray-800">Konfigire RawBT ak enprimant lan</h2>
        </div>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Louvri RawBT.</li>
          <li>Nan paramèt koneksyon an, chwazi <strong>Bluetooth</strong>, epi chwazi enprimant ou te konekte nan etap 1 lan.</li>
          <li>Mete lajè papye a sou <strong>80mm</strong> (58mm se pou ti enprimant yo — pa w la se 80mm).</li>
          <li>Chèche bouton <strong>“Test Print”</strong> epi peze l. Si enprimant lan sòti yon ti resi tès, ou konekte byen! ✅</li>
        </ol>
      </div>

      {/* Etap 4 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm flex-shrink-0">4</span>
          <h2 className="font-medium text-gray-800">Enprime yon resi nan BizManager</h2>
        </div>
        <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Nan BizManager, fè yon vant jan w konn fè a.</li>
          <li>Sou resi a, peze <strong>“Enprime resi”</strong>.</li>
          <li>Nan dyalòg enprime a ki louvri, chwazi <strong>RawBT</strong> kòm enprimant lan.</li>
          <li>Resi a ap sòti sou enprimant tèmik lan. Menm bagay pou <strong>Rapò Z</strong> lè w fèmen kès la.</li>
        </ol>
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
          Depi RawBT konfigire yon fwa, ou pa bezwen refè l — chak fwa ou peze “Enprime”, chwazi RawBT epi resi a sòti.
        </div>
      </div>

      {/* Pwoblèm ak solisyon */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800 mb-3">Si gen pwoblèm</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-700">Enprimant lan pa parèt nan Bluetooth</p>
            <p className="text-gray-600">Verifye li limen epi li chaje. Etenn li epi limen l ankò. Kèk enprimant gen yon bouton ou peze pou l vin "vizib" (pairing mode).</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Test Print pa sòti anyen</p>
            <p className="text-gray-600">Verifye ou chwazi bon enprimant lan nan RawBT, epi papye a byen mete (pafwa gen yon sans pou woulo papye a). Verifye lajè a sou 80mm.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Resi a sòti twò piti oswa koupe</p>
            <p className="text-gray-600">Nan RawBT, asire lajè a se 80mm. Si tèks la twò gwo/piti, ajiste echèl la (scale) nan paramèt RawBT yo.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700">Gen yon ti mak sou papye a</p>
            <p className="text-gray-600">Vèsyon gratis RawBT la mete yon ti mak. Yon lisans (yon sèl peman) retire l. Pou kòmanse, mak la pa deranje anyen.</p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        BizManager Haiti — Konfigirasyon enprimant tèmik 🇭🇹
      </p>
    </div>
  );
}