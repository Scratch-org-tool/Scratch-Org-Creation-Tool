import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Sign in — SF DevOps Command Center',
  description:
    'Sign in or create an account for the Salesforce DevOps Command Center — environments, deployments, and monitoring.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'SF DevOps Command Center',
    description: 'Salesforce development lifecycle automation',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
