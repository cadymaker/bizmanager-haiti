'use client';
import { useState } from 'react';

const FEATURES = [
  {
    icon: '🛒',
    title: 'Sistèm vant (POS)',
    desc: 'Vann rapid ak eskanè barcode oswa kamera telefòn ou. Resi tikè enprime sou enprimant tèmik.',
  },
  {
    icon: '📴',
    title: 'Mache san entènèt',
    desc: 'Kontinye vann menm lè koneksyon an koupe. Vant yo sinkronize otomatikman lè entènèt tounen.',
  },
  {
    icon: '💰',
    title: 'Balans kès chak jou',
    desc: 'Ouvri kès ak fon de kès, swiv kach la an dirèk, epi fèmen ak yon Rapò Z ki montre diferans lan.',
  },
  {
    icon: '📦',
    title: 'Jesyon envantè',
    desc: 'Swiv stock ou, jwenn alèt lè yon pwodwi prèske fini, epi anrejistre pèt ak valè yo.',
  },
  {
    icon: '🧾',
    title: 'Fakti ak dèt kliyan',
    desc: 'Kreye fakti ak logo ou, swiv kiyès ki dwe w, epi voye rappèl an yon klik.',
  },
  {
    icon: '📊',
    title: 'Rapò ak benefis',
    desc: 'Wè vant, kou pwodwi, depans, pèt, ak vrè benefis nèt ou — pa yon chif apeprè.',
  },
  {
    icon: '🎟️',
    title: 'Rabè ak pwomosyon',
    desc: 'Bay rabè an pousantaj oswa montan fiks, epi kreye kòd promo ak dat ak kondisyon.',
  },
  {
    icon: '👥',
    title: 'Kesye ak sekirite',
    desc: 'Bay kesye ou aksè sèlman nan sistèm vant lan. Yo pa ka wè depans oswa chanje pri.',
  },
];

const PRICING = [
  { duration: '30 jou', price: '1 000', per: 'HTG', note: 'Pou eseye' },
  { duration: '90 jou', price: '2 500', per: 'HTG', note: 'Ekonomi 500 HTG', popular: true },
  { duration: '1 an', price: '10 000', per: 'HTG', note: 'Ekonomi 2 000 HTG', best: true },
];

const FAQ = [
  {
    q: 'Èske app la mache san entènèt?',
    a: 'Wi. Ouvri kès la nan maten pandan ou gen entènèt, epi ou ka vann tout jounen an san koneksyon. Vant yo sove sou telefòn nan epi voye sou sèvè a otomatikman lè entènèt tounen.',
  },
  {
    q: 'Ki aparèy mwen bezwen?',
    a: 'Yon telefòn Android, yon tablèt, oswa yon òdinatè. Ou ka enstale BizManager tankou yon app sou telefòn ou. Pou eskane barcode, kamera telefòn nan ase.',
  },
  {
    q: 'Èske m ka teste anvan m peye?',
    a: 'Wi. Ou gen 14 jou gratis ak tout fonksyonalite yo. Pa gen kat kredi pou antre — jis kreye kont ou epi kòmanse.',
  },
  {
    q: 'Kijan pou m peye?',
    a: 'Ou ka peye ak MonCash oswa cash. Apre peman an, n ap voye yon kòd aktivasyon ba w pa WhatsApp oswa imèl.',
  },
  {
    q: 'Èske done mwen an sekirite?',
    a: 'Wi. Chak biznis gen pwòp done pa l, epi yon biznis pa ka wè done yon lòt. Done yo sove sou sèvè sekirize, pa sèlman sou telefòn ou.',
  },
  {
    q: 'Ki kalite biznis ki ka itilize l?',
    a: 'Boutik, sal fitness, pafimri, episri, famasi, magazen pyès — nenpòt ti komès ki vann pwodwi oswa sèvis epi ki bezwen swiv kès, stock, ak kliyan.',
  },
];

const APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'BizManager Haiti',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Android, iOS, Web',
  description:
    'Lojisyèl POS ak jesyon pou ti komès an Ayiti. Vant ak barcode, kès, stock, fakti, ak rapò — mache menm san entènèt.',
  url: 'https://www.bizmanagerhaiti.com',
  inLanguage: 'ht',
  offers: {
    '@type': 'Offer',
    price: '1000',
    priceCurrency: 'HTG',
    description: 'Lisans 30 jou. Esè gratis 14 jou.',
  },
  featureList: [
    'Sistèm vant (POS) ak eskanè barcode',
    'Mache san entènèt (offline)',
    'Balans kès ak Rapò Z',
    'Jesyon envantè ak alèt stock',
    'Fakti ak dèt kliyan',
    'Rapò ak analiz benefis',
  ],
  provider: {
    '@type': 'Organization',
    name: 'BizManager Haiti',
    url: 'https://www.bizmanagerhaiti.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Gonaïves',
      addressCountry: 'HT',
    },
  },
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

// Flèch pou bouton yo (SVG — pa gen librairie)
function ArrowRight({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function PhoneMockup() {
  return (
    <svg viewBox="0 0 280 560" className="w-full h-auto drop-shadow-2xl" aria-hidden="true">
      <rect x="10" y="10" width="260" height="540" rx="34" fill="#111827" />
      <rect x="18" y="18" width="244" height="524" rx="28" fill="#ffffff" />
      <rect x="110" y="26" width="60" height="6" rx="3" fill="#111827" />

      <text x="34" y="66" fontSize="13" fontWeight="700" fill="#111827">Sistem Vant</text>
      <rect x="150" y="54" width="52" height="16" rx="8" fill="#d1fae5" />
      <text x="158" y="66" fontSize="8" fill="#047857">An liy</text>
      <rect x="208" y="54" width="46" height="16" rx="8" fill="#fef3c7" />
      <text x="216" y="66" fontSize="8" fill="#92400e">Kes</text>

      <rect x="30" y="78" width="220" height="26" rx="8" fill="#ecfdf5" stroke="#a7f3d0" />
      <circle cx="42" cy="91" r="3.5" fill="#10b981" />
      <text x="52" y="95" fontSize="9" fill="#047857">Kes louvri</text>
      <text x="160" y="95" fontSize="9" fontWeight="600" fill="#065f46">12 400 HTG</text>

      <rect x="30" y="112" width="164" height="28" rx="8" fill="#fff" stroke="#c7d2fe" strokeWidth="2" />
      <text x="40" y="130" fontSize="8.5" fill="#9ca3af">Eskane barcode...</text>
      <rect x="200" y="112" width="50" height="28" rx="8" fill="#4f46e5" />
      <text x="212" y="130" fontSize="9" fill="#fff">Ajoute</text>

      <rect x="30" y="148" width="220" height="26" rx="8" fill="#eef2ff" stroke="#c7d2fe" />
      <text x="88" y="165" fontSize="9" fill="#4338ca">Eskane ak kamera</text>

      {[0, 1, 2, 3].map(i => {
        const x = 30 + (i % 2) * 114;
        const y = 186 + Math.floor(i / 2) * 96;
        return (
          <g key={i}>
            <rect x={x} y={y} width="106" height="86" rx="10" fill="#fff" stroke="#e5e7eb" />
            <rect x={x + 8} y={y + 8} width="90" height="34" rx="6" fill="#f3f4f6" />
            <rect x={x + 8} y={y + 50} width="62" height="7" rx="3.5" fill="#374151" />
            <rect x={x + 8} y={y + 63} width="42" height="7" rx="3.5" fill="#2563eb" />
          </g>
        );
      })}

      <rect x="30" y="384" width="220" height="1" fill="#e5e7eb" />
      <text x="30" y="406" fontSize="10" fontWeight="600" fill="#111827">Panye (3)</text>

      {[0, 1].map(i => (
        <g key={i}>
          <rect x={30} y={416 + i * 30} width="130" height="7" rx="3.5" fill="#374151" />
          <rect x={30} y={428 + i * 30} width="70" height="6" rx="3" fill="#d1d5db" />
          <rect x={196} y={416 + i * 30} width="54" height="8" rx="4" fill="#111827" />
        </g>
      ))}

      <rect x="30" y="482" width="220" height="1" fill="#e5e7eb" />
      <text x="30" y="504" fontSize="10" fill="#6b7280">Total</text>
      <text x="250" y="506" fontSize="15" fontWeight="700" fill="#111827" textAnchor="end">3 250 HTG</text>

      <rect x="30" y="514" width="220" height="30" rx="10" fill="#16a34a" />
      <text x="140" y="534" fontSize="11" fontWeight="600" fill="#fff" textAnchor="middle">
        Kontinye ak peman
      </text>
    </svg>
  );
}

function OfflineIllustration() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto" aria-hidden="true">
      <rect x="30" y="30" width="110" height="160" rx="16" fill="#1e40af" />
      <rect x="38" y="38" width="94" height="144" rx="12" fill="#fff" />
      <rect x="50" y="56" width="70" height="8" rx="4" fill="#e5e7eb" />
      <rect x="50" y="72" width="50" height="8" rx="4" fill="#e5e7eb" />
      <rect x="50" y="96" width="70" height="24" rx="6" fill="#fed7aa" />
      <text x="60" y="112" fontSize="9" fill="#9a3412">Offline</text>
      <rect x="50" y="130" width="70" height="10" rx="5" fill="#dbeafe" />
      <rect x="50" y="146" width="70" height="10" rx="5" fill="#dbeafe" />

      <path d="M 160 110 L 230 110" stroke="#3b82f6" strokeWidth="3" strokeDasharray="8 6" />
      <path d="M 224 103 L 232 110 L 224 117" stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="195" y="98" fontSize="11" fill="#3b82f6" textAnchor="middle" fontWeight="600">sync</text>

      <ellipse cx="310" cy="115" rx="60" ry="38" fill="#dbeafe" />
      <ellipse cx="285" cy="105" rx="32" ry="26" fill="#dbeafe" />
      <ellipse cx="335" cy="105" rx="28" ry="22" fill="#dbeafe" />
      <circle cx="310" cy="112" r="14" fill="#3b82f6" />
      <path d="M 303 112 L 308 117 L 318 106" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: '', phone: '', email: '', business_name: '', message: '', website: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  async function sendContact(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSending(true);

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setErr(data.error ?? 'Pa ka voye mesaj la.');
      return;
    }

    setForm({ name: '', phone: '', email: '', business_name: '', message: '', website: '' });
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_SCHEMA) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />

      {/* ===== ANTET ===== */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur-md z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/icon-192.png" alt="BizManager Haiti" className="w-9 h-9 rounded-lg" />
            <div className="leading-tight">
              <p className="font-bold text-gray-900 text-base">BizManager</p>
              <p className="text-[10px] text-gray-500 tracking-wide">HAITI</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <a href="#kontak"
              className="hidden sm:block px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Kontak
            </a>
            <a href="/login"
              className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
              Konekte
            </a>
            <a href="/register"
              className="group px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap shadow-sm inline-flex items-center gap-1.5">
              Komanse gratis
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ===== HERO (fon blan ak gradyan dous) ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.10),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium border border-green-100">
                14 jou gratis — pa gen kat kredi
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-[1.1] mt-6">
                Jere biznis ou
                <span className="text-blue-600"> san tet chaje</span>
              </h1>

              <p className="text-lg text-gray-600 mt-5 leading-relaxed">
                Lojisyèl jesyon ki fèt pou ti komès ayisyen. Vant, stock, kès, fakti,
                ak rapò — tout nan yon sèl kote,
                <strong className="text-gray-900"> menm lè entènèt la koupe</strong>.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <a href="/register"
                  className="group px-7 py-4 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 text-center shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 inline-flex items-center justify-center gap-2">
                  Kòmanse 14 jou gratis
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </a>
                <a href="#kontak"
                  className="px-7 py-4 bg-white text-gray-800 border border-gray-200 rounded-xl text-base font-semibold hover:bg-gray-50 hover:border-gray-300 text-center transition-all">
                  Voye nou yon mesaj
                </a>
              </div>

              <p className="text-sm text-gray-500 mt-4">
                Pa gen kat kredi bezwen · Konfigirasyon an 2 minit
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm text-gray-500">
                <span>Mache sou telefon</span>
                <span>Tout an Kreyol</span>
                <span>Mache offline</span>
              </div>
            </div>

            <div className="flex justify-center mt-4 lg:mt-0">
              <div className="w-[220px] sm:w-[250px] lg:w-[280px]">
                <PhoneMockup />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PWOBLEM (fon gri dous) ===== */}
      <section className="bg-slate-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Ou konnen pwoblèm sa yo?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            {[
              {
                title: 'Kès la pa balanse',
                desc: 'Nan fen jounen an, ou pa konnen si kòb la konplè oswa si gen yon bagay ki manke.',
              },
              {
                title: 'Ou pa konnen vrè benefis ou',
                desc: 'Ou wè kòb ap antre, men ou pa sèten si w ap fè pwofi apre tout depans yo.',
              },
              {
                title: 'Entènèt la koupe',
                desc: 'Lòt sistèm bloke nèt lè koneksyon an ale. Ou pa ka vann, kliyan an ap tann.',
              },
            ].map((p, i) => (
              <div key={i}
                className="bg-white rounded-2xl border border-gray-200 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="w-10 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-700" />
                <h3 className="font-semibold text-gray-900 mt-4">{p.title}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-lg text-gray-800 mt-10 font-medium">
            BizManager rezoud twa pwoblèm sa yo.
          </p>
        </div>
      </section>

      {/* ===== FONKSYONALITE (fon blan) ===== */}
      <section id="fonksyonalite" className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Fonksyonalite</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
              Tout sa yon ti komès bezwen
            </h2>
            <p className="text-gray-600 mt-3">
              Pa gen bagay konplike. Chak fonksyonalite fèt pou reyalite biznis an Ayiti.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            {FEATURES.map((f, i) => (
              <div key={i}
                className="bg-white rounded-2xl border border-gray-200 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-blue-200">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xl shadow-sm shadow-blue-500/20">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mt-4">{f.title}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== OFFLINE (fon ble fonse) ===== */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-sm font-semibold text-blue-200 uppercase tracking-wide">
                Sa ki fè nou diferan
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-white mt-3 leading-tight">
                Entènèt koupe?<br />Kontinye vann.
              </h2>
              <p className="text-blue-100 mt-5 text-lg leading-relaxed">
                Lè koneksyon an ale, ou kontinye eskane pwodwi, fè vant, epi bay kliyan resi.
                Lè entènèt tounen, tout bagay sinkronize otomatikman — ou pa pèdi yon sèl vant.
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                {['Eskane barcode', 'Fè vant', 'Bay resi', 'Sinkronize otomatikman'].map((t, i) => (
                  <span key={i} className="bg-white/15 text-white text-sm px-3 py-1.5 rounded-lg backdrop-blur border border-white/10">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur border border-white/10">
              <OfflineIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ===== TARIF (fon blan) ===== */}
      <section id="tarif" className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Tarif</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
              Yon pri ki fè sans pou ti komès
            </h2>
            <p className="text-gray-600 mt-3">
              Kòmanse ak <strong className="text-gray-900">14 jou gratis</strong>.
              Apre sa, chwazi peryòd ki bon pou ou.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 mt-16 max-w-4xl mx-auto items-center">
            {PRICING.map((p, i) => (
              <div key={i}
                className={`rounded-2xl text-center relative bg-white transition-all duration-300 ${
                  p.popular
                    ? 'p-8 border-2 border-blue-600 shadow-xl shadow-blue-500/20 sm:scale-110 z-10'
                    : p.best
                      ? 'p-6 border-2 border-green-500 shadow-lg shadow-green-500/10'
                      : 'p-6 border border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}>
                {p.popular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-4 py-1.5 rounded-full font-semibold whitespace-nowrap shadow-lg shadow-blue-600/30">
                    Pi popilè
                  </span>
                )}
                {p.best && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs px-4 py-1.5 rounded-full font-semibold whitespace-nowrap shadow-lg shadow-green-600/30">
                    Pi bon valè
                  </span>
                )}

                <p className="text-sm text-gray-500 uppercase tracking-wide">{p.duration}</p>
                <p className={`font-bold text-gray-900 mt-2 ${p.popular ? 'text-4xl' : 'text-3xl'}`}>
                  {p.price}
                  <span className="text-base font-normal text-gray-500"> {p.per}</span>
                </p>
                {p.note && (
                  <p className={`text-xs mt-2 font-medium ${
                    p.popular ? 'text-blue-600' : p.best ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {p.note}
                  </p>
                )}

                <a href="/register"
                  className={`block mt-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    p.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  Chwazi
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-10">
            Peman ak MonCash oswa cash · Tout fonksyonalite yo enkli nan chak plan
          </p>
        </div>
      </section>

      {/* ===== KI MOUN NOU YE (otantik, pa fo temwayaj) ===== */}
      <section className="bg-slate-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Ki moun nou ye</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
              Fèt pa yon komèsan, pou komèsan
            </h2>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 mt-10 shadow-sm">
            <p className="text-gray-700 leading-relaxed">
              BizManager pa soti nan yon biwo. Li soti nan{' '}
              <strong className="text-gray-900">Cadymaker Fitness</strong>, yon vrè biznis
              nan Gonayiv, kote nou te gen menm pwoblèm ou yo: kès ki pa balanse nan fen jounen an,
              entènèt ki koupe nan mitan yon vant, stock ki disparèt san esplikasyon.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Nou te chèche yon solisyon. Sa nou jwenn yo te fèt pou lòt reyalite — yo mande
              entènèt tout tan, yo pa an Kreyòl, epi pri yo an dola. Kidonk nou konstwi sa nou
              te bezwen an nou menm, epi nou teste l chak jou nan pwòp kès nou.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Kounye a n ap pataje l ak lòt ti komès ayisyen.{' '}
              <strong className="text-gray-900">
                Chak fonksyonalite nan app la soti nan yon vrè pwoblèm nou te viv.
              </strong>
            </p>

            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
              <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Ekip BizManager Haiti</p>
                <p className="text-xs text-gray-500">Gonayiv, Ayiti</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ (fon blan) ===== */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
              Kesyon moun poze souvan
            </h2>
          </div>

          <div className="mt-10 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
            {FAQ.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-5 py-4 flex justify-between items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800">{item.q}</span>
                  <span className="text-gray-400 text-xl flex-shrink-0 leading-none">
                    {openFaq === i ? '-' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed bg-slate-50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== KONTAK (fon gri dous) ===== */}
      <section id="kontak" className="bg-slate-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Kontak</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">
                Yon kesyon? Ekri nou.
              </h2>
              <p className="text-gray-600 mt-4 leading-relaxed">
                Ou vle konnen si BizManager bon pou biznis ou? Ou bezwen yon demonstrasyon?
                Voye nou yon mesaj epi n ap reponn ou.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { title: 'Repons rapid', desc: 'N ap reponn ou nan mwens pase 24 è.' },
                  { title: 'Konsèy san angajman', desc: 'N ap di w onètman si app la bon pou ou.' },
                  { title: 'Ekip lokal', desc: 'Nou baze an Ayiti, nou konnen reyalite a.' },
                ].map((it, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{it.title}</p>
                      <p className="text-sm text-gray-600">{it.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {sent ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center h-full flex flex-col justify-center">
                  <p className="text-lg font-semibold text-green-800">Mèsi!</p>
                  <p className="text-sm text-green-600 mt-2">
                    Nou resevwa mesaj ou. N ap reponn ou byen vit.
                  </p>
                  <button onClick={() => setSent(false)}
                    className="mt-5 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 mx-auto">
                    Voye yon lòt mesaj
                  </button>
                </div>
              ) : (
                <form onSubmit={sendContact}
                  className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">

                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input
                      type="text"
                      id="website"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={e => setForm({ ...form, website: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-600 font-medium">Non ou *</label>
                      <input required placeholder="Non konplè"
                        className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium">Non biznis ou</label>
                      <input placeholder="Opsyonèl"
                        className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-600 font-medium">Telefòn</label>
                      <input type="tel" placeholder="+509 ..."
                        className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 font-medium">Imèl</label>
                      <input type="email" placeholder="imel@egzanp.com"
                        className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 -mt-2">
                    Bay omwen youn nan de a pou nou ka reponn ou.
                  </p>

                  <div>
                    <label className="text-xs text-gray-600 font-medium">Mesaj ou *</label>
                    <textarea required rows={5} placeholder="Ekri kesyon ou isit la..."
                      className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                  </div>

                  {err && (
                    <div className="text-sm rounded-lg p-3 bg-red-50 text-red-700">{err}</div>
                  )}

                  <button type="submit" disabled={sending}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {sending ? 'Ap voye...' : 'Voye mesaj la'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== APEL FINAL (fon fonse) ===== */}
      <section className="bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.15),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold text-white">
            Pare pou pran kontròl biznis ou?
          </h2>
          <p className="text-gray-400 mt-4 text-lg">
            Kreye kont ou nan de minit. Pa gen kat kredi, pa gen angajman.
          </p>
          <a href="/register"
            className="group inline-flex items-center justify-center gap-2 mt-8 px-8 py-4 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:shadow-blue-600/40">
            Kòmanse 14 jou gratis
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </a>
          <p className="text-sm text-gray-500 mt-4">
            Pa gen kat kredi bezwen · Konfigirasyon an 2 minit
          </p>
        </div>
      </section>

      {/* ===== PYE PAJ ===== */}
      <footer className="bg-slate-950 text-gray-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2.5">
                <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg" />
                <p className="text-white font-bold">BizManager Haiti</p>
              </div>
              <p className="text-sm mt-3 leading-relaxed">
                Lojisyèl jesyon pou ti komès ayisyen. Fèt an Ayiti, pou Ayiti.
              </p>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Lyen</p>
              <div className="mt-3 space-y-2 text-sm">
                <a href="#fonksyonalite" className="block hover:text-white transition-colors">Fonksyonalite</a>
                <a href="#tarif" className="block hover:text-white transition-colors">Tarif</a>
                <a href="/login" className="block hover:text-white transition-colors">Konekte</a>
                <a href="/register" className="block hover:text-white transition-colors">Kreye yon kont</a>
              </div>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Legal &amp; Kontak</p>
              <div className="mt-3 space-y-2 text-sm">
                <a href="/legal/privacy" className="block hover:text-white transition-colors">Politik Konfidansyalite</a>
                <a href="/legal/terms" className="block hover:text-white transition-colors">Kondisyon Itilizasyon</a>
                <a href="#kontak" className="block hover:text-white transition-colors">Kontakte nou</a>
                <p>Gonaïves, Ayiti</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-10 pt-6 text-sm text-center">
            © {new Date().getFullYear()} BizManager Haiti. Tout dwa rezève.
          </div>
        </div>
      </footer>
    </div>
  );
}