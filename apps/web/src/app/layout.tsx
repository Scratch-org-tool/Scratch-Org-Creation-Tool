import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { FirebaseProvider } from '@/components/providers/firebase-provider';
import { ChunkLoadRecovery } from '@/components/errors/chunk-load-recovery';
import { CHUNK_ERROR_BOOTSTRAP } from '@/lib/chunk-error-script';
import { CHUNK_ERROR_INLINE_CSS } from '@/lib/chunk-error-inline-css';

export const metadata: Metadata = {
  title: 'Salesforce DevOps Command Center',
  description: 'AI-powered Salesforce development lifecycle automation',
  applicationName: 'SF DevOps Command Center',
  icons: {
    icon: [{ url: '/images/logo.png', type: 'image/png' }],
    apple: [{ url: '/images/logo.png', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CHUNK_ERROR_INLINE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: CHUNK_ERROR_BOOTSTRAP }} />
      </head>
      <body suppressHydrationWarning className="bg-[#0a1628]">
        <div id="__app" suppressHydrationWarning>
          <AuthProvider>
            <FirebaseProvider>
              {children}
              <ChunkLoadRecovery />
            </FirebaseProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
