'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBusinessContext } from '@/lib/business';

// ⚠️ CHANJE IMÈL SA A AK PA W LA
const SUPPORT_EMAIL = 'sales.cs@cadymakerservices.com';

const FAQ = [
  {
    q: 'Kijan pou m ouvri kès la nan maten?',
    a: 'Ale nan Vant (POS). Yon fenèt ap mande w fon de kès la — se kòb ki nan kès la anvan ou kòmanse vann. Antre montan an epi klike "Ouvri kès la".',
  },
  {
    q: 'Kijan pou m fèmen kès la nan aswè?',
    a: 'Nan POS la, klike "🔒 Fèmen Kès". Konte tout kòb ki nan kès la epi tape total la. Sistèm nan ap montre w si gen yon diferans, epi w ap ka enprime Rapò Z a.',
  },
  {
    q: 'App la mache si m pa gen entènèt?',
    a: 'Wi. Ouvri kès la pandan ou gen entènèt nan maten. Apre sa, ou ka vann tout jounen an san koneksyon. Vant yo sove sou telefòn nan epi voye sou sèvè a otomatikman lè entènèt tounen.',
  },
  {
    q: 'Kijan pou m ajoute barcode sou pwodwi mwen yo?',
    a: 'Nan Envantè, modifye yon pwodwi. Ou ka eskane barcode faktori a ak kamera a, tape l alamen, oswa klike "⚙️ Jenere" pou pwodwi lokal ki pa gen barcode — epi enprime yon etikèt.',
  },
  {
    q: 'Kijan pou m konekte yon enprimant?',
    a: 'Ale nan Paramèt → Enprimant tèmik → "Wè gid konfigirasyon an". Gid la esplike chak etap pou yon enprimant Bluetooth 80mm sou Android.',
  },
  {
    q: 'Kijan pou m bay yon kesye aksè?',
    a: 'Ale nan Itilizatè epi kreye yon kont pou li. Yon kesye ap wè SÈLMAN sistèm vant lan — li p ap ka wè depans, rapò, oswa modifye pri.',
  },
  {
    q: 'Kijan pou m bay yon rabè oswa yon kòd promo?',
    a: 'Nan POS la, lè w rive nan peman an, klike "Rabè manyèl" (% oswa montan fiks) oswa "🎟️ Kòd promo". Ou kreye kòd promo yo nan paj Pwomosyon.',
  },
  {
    q: 'Poukisa benefis nèt la pa menm ak vant total la?',
    a: 'Benefis nèt = Vant − Kou pwodwi vann yo − Depans − Pèt nan stock. Ale nan Tablo de bòd, seksyon "Kijan benefis nèt la kalkile" pou wè chak etap.',
  },
  {
    q: 'Kijan pou m konnen ki pwodwi pou m rachte?',
    a: 'Nan Tablo de bòd, anba paj la, gen yon seksyon "📦 Pwodwi pou rachte". Ou ka mete yon seuil alèt pa pwodwi nan Envantè (Modifye → Alèt stock ba).',
  },
  {
    q: 'Kijan pou m aktive lisans mwen?',
    a: 'Apre ou fin peye (MonCash oswa cash), n ap voye yon kòd aktivasyon ba w pa WhatsApp oswa imèl. Antre kòd la nan Paramèt → "Lisans & Aktivasyon" epi klike "Aktive".',
  },
];

export default function HelpPage() {
  const [business, setBusiness] = useState<any>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const ctx = await getBusinessContext();
      if (!ctx) return;
      const { data } = await supabase
        .from('businesses')
        .select('business_name, owner_name, phone')
        .eq('id', ctx.businessId)
        .single();
      setBusiness(data);
    }
    load();
  }, []);

  function contactByEmail() {
    const subject = `BizManager — ${business?.business_name ?? 'Èd'}`;
    const body =
      `Bonjou ekip BizManager,\n\n` +
      `\n\n` +
      `---\n` +
      `Biznis: ${business?.business_name ?? ''}\n` +
      `Mèt: ${business?.owner_name ?? ''}\n` +
      `Telefòn: ${business?.phone ?? ''}\n`;
    window.location.href =
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <a href="/settings" className="text-sm text-blue-600 hover:underline">← Retounen nan Paramèt</a>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Èd</h1>
        <p className="text-sm text-gray-500 mt-1">
          Repons pou kesyon moun poze pi souvan yo.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {FAQ.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full text-left px-5 py-4 flex justify-between items-center gap-3 hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-800">{item.q}</span>
              <span className="text-gray-400 text-xl flex-shrink-0 leading-none">
                {openFaq === i ? '−' : '+'}
              </span>
            </button>
            {openFaq === i && (
              <div className="px-5 pb-4 text-sm text-gray-600 bg-gray-50">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-medium text-blue-800">Ou pa jwenn repons ou?</h2>
        <p className="text-sm text-blue-600 mt-1">
          Voye nou yon imèl epi n ap reponn ou pi vit posib.
        </p>
        <button onClick={contactByEmail}
          className="mt-3 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          ✉️ Kontakte nou pa imèl
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800">Ou gen yon sijesyon?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Si ou gen yon lide pou amelyore BizManager, oswa ou jwenn yon pwoblèm, di nou.
        </p>
        <a href="/settings/feedback"
          className="inline-block mt-3 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
          💬 Ban nou opinyon w
        </a>
      </div>
    </div>
  );
}