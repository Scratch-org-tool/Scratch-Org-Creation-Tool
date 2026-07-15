'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginWorkspace, LoginWorkspaceLoader, type AuthMode } from '@/modules/auth';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const notice =
    searchParams.get('notice') === 'password-changed'
      ? 'Password changed successfully. Sign in with your new password.'
      : searchParams.get('notice') === 'sessions-ended'
        ? 'You have been signed out on all devices.'
        : undefined;

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'signup') setMode('signup');
  }, [searchParams]);

  return <LoginWorkspace mode={mode} onModeChange={setMode} notice={notice} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginWorkspaceLoader />}>
      <LoginPageContent />
    </Suspense>
  );
}
