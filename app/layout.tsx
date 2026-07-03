import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BizManager Haiti',
  description: 'Aplikasyon jesyon biznis pou Gonaïves, Ayiti',
  manifest: '/manifest.json',
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