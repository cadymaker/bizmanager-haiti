import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'BizManager Haiti — Lojisyèl jesyon pou biznis ayisyen';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.15)',
              padding: '8px 18px',
              borderRadius: '999px',
              fontSize: 24,
              color: '#dbeafe',
            }}
          >
            BizManager Haiti
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 700,
            color: '#ffffff',
            marginTop: '28px',
            lineHeight: 1.1,
          }}
        >
          Jere biznis ou san tèt chaje
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: '#bfdbfe',
            marginTop: '24px',
            lineHeight: 1.4,
          }}
        >
          Vant, stock, kès, fakti ak rapò, menm lè entènèt la koupe
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '44px' }}>
          {['Barcode', 'Balans kès', 'Mache offline', '14 jou gratis'].map(t => (
            <div
              key={t}
              style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.18)',
                color: '#ffffff',
                padding: '12px 22px',
                borderRadius: '12px',
                fontSize: 24,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}