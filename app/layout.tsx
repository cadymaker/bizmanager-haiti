import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = 'https://www.bizmanagerhaiti.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'BizManager Haiti — Lojisyèl jesyon pou biznis ayisyen',
    template: '%s | BizManager Haiti',
  },
  description:
    'Lojisyèl POS ak jesyon pou biznis an Ayiti. Vant ak barcode, kès, stock, fakti, ak rapò, mache menm san entènèt. 14 jou gratis.',
  keywords: [
    'logiciel gestion Haiti',
    'POS Haiti',
    'sistèm kès Ayiti',
    'lojisyèl jesyon boutik',
    'point de vente Haiti',
    'gestion stock Haiti',
    'facturation Haiti',
    'caisse enregistreuse Haiti',
    'logiciel boutique Haiti',
    'BizManager Haiti',
    'app jesyon biznis Ayiti',
    'logiciel commerce Haiti',
  ],
  authors: [{ name: 'BizManager Haiti' }],
  creator: 'BizManager Haiti',
  publisher: 'BizManager Haiti',
  applicationName: 'BizManager Haiti',
  category: 'business',
  manifest: '/manifest.json',

  openGraph: {
    type: 'website',
    locale: 'fr_HT',
    url: SITE_URL,
    siteName: 'BizManager Haiti',
    title: 'BizManager Haiti — Lojisyèl jesyon pou biznis ayisyen',
    description:
      'Vant ak barcode, balans kès, jesyon stock, fakti, ak rapò. Mache menm lè entènèt la koupe. 14 jou gratis.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'BizManager Haiti — Lojisyèl jesyon pou biznis ayisyen',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'BizManager Haiti — Lojisyèl jesyon pou biznis ayisyen',
    description:
      'Vant ak barcode, balans kès, stock, fakti, ak rapò. Mache menm san entènèt. 14 jou gratis.',
    images: ['/opengraph-image'],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  alternates: {
    canonical: SITE_URL,
  },

  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" style={{ colorScheme: 'light' }}>
      <head>
        <meta name="color-scheme" content="light" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ backgroundColor: '#ffffff', color: '#171717' }}>{children}</body>
    </html>
  );
}