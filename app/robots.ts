import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.bizmanagerhaiti.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Paj prive yo — pa gen rezon pou Google endekse yo
      disallow: [
        '/dashboard',
        '/pos',
        '/inventory',
        '/invoices',
        '/clients',
        '/expenses',
        '/reports',
        '/promotions',
        '/cash-history',
        '/team',
        '/settings',
        '/subscribe',
        '/admin',
        '/api/',
        '/choose-currency',
        '/reset-password',
        '/forgot-password',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}