'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginWorkspace, LoginWorkspaceLoader, type AuthMode } from '@/modules/auth';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');

  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'signup') setMode('signup');
  }, [searchParams]);

  return <LoginWorkspace mode={mode} onModeChange={setMode} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginWorkspaceLoader />}>
      <LoginPageContent />
    </Suspense>
  );
}
