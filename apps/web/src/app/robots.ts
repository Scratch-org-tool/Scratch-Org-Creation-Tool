import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/login'],
      disallow: [
        '/dashboard',
        '/environment-center',
        '/deployment-center',
        '/metadata-deployment',
        '/monitoring',
        '/data-center',
        '/org-setup',
        '/admin',
        '/api',
      ],
    },
  };
}
