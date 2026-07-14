'use client';

import {
  AUTH_GENERIC_INVALID,
  AUTH_LOGIN_FAILED,
  AUTH_PASSWORD_MISMATCH,
  AUTH_PASSWORD_TOO_WEAK,
  AUTH_RESET_SENT,
  AUTH_SIGNUP_FAILED,
  MIN_SIGNUP_PASSWORD_SCORE,
  scorePassword,
} from '@sfcc/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  clearBootstrapToken,
  readBootstrapToken,
  storeBootstrapToken,
} from './admin-bootstrap';

const REMEMBER_EMAIL_KEY = 'sfcc.auth.rememberEmail';

export type AuthMode = 'login' | 'signup';

export function useAuthForm(mode: AuthMode) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, resetPassword, user, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const next = searchParams.get('next') ?? '/dashboard';

  const passwordStrength = useMemo(
    () => (mode === 'signup' ? scorePassword(password) : null),
    [mode, password],
  );

  const signupPasswordTooWeak =
    mode === 'signup' &&
    password.length > 0 &&
    (passwordStrength?.score ?? 0) < MIN_SIGNUP_PASSWORD_SCORE;

  useEffect(() => {
    const bootstrap = searchParams.get('bootstrap');
    if (bootstrap?.trim()) {
      storeBootstrapToken(bootstrap.trim());
      const params = new URLSearchParams(searchParams.toString());
      params.delete('bootstrap');
      const qs = params.toString();
      router.replace(qs ? `/login?${qs}` : '/login', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    setError('');
    setFieldErrors({});
    setSuccess('');
    setLoading(false);
    setRedirecting(false);
    setConfirmPassword('');
  }, [mode]);

  useEffect(() => {
    if (!authLoading && user && !redirecting) {
      setRedirecting(true);
      router.replace(next);
    }
  }, [authLoading, user, router, next, redirecting]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistRememberMe = useCallback((value: string, remember: boolean) => {
    try {
      if (remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, value);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleRememberChange = useCallback(
    (checked: boolean) => {
      setRememberMe(checked);
      persistRememberMe(email, checked);
    },
    [email, persistRememberMe],
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      setEmail(value);
      if (rememberMe) persistRememberMe(value, true);
    },
    [rememberMe, persistRememberMe],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSuccess('');

    if (password.length < 8) {
      setError(AUTH_GENERIC_INVALID);
      return;
    }

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setFieldErrors({ displayName: 'Display name is required' });
        return;
      }
      if ((passwordStrength?.score ?? 0) < MIN_SIGNUP_PASSWORD_SCORE) {
        setFieldErrors({ password: AUTH_PASSWORD_TOO_WEAK });
        return;
      }
      if (password !== confirmPassword) {
        setFieldErrors({ confirmPassword: AUTH_PASSWORD_MISMATCH });
        return;
      }
    }

    const adminBootstrapToken = readBootstrapToken();
    setLoading(true);
    setRedirecting(false);
    try {
      if (mode === 'login') {
        await signIn(email, password, adminBootstrapToken);
      } else {
        await signUp(email, password, displayName.trim(), confirmPassword, adminBootstrapToken);
      }
      clearBootstrapToken();
      persistRememberMe(email, rememberMe);
      setRedirecting(true);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : (mode === 'login' ? AUTH_LOGIN_FAILED : AUTH_SIGNUP_FAILED));
      setLoading(false);
      setRedirecting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError(AUTH_GENERIC_INVALID);
      return;
    }
    setForgotLoading(true);
    try {
      const message = await resetPassword(email.trim());
      setSuccess(message || AUTH_RESET_SENT);
    } catch {
      setSuccess(AUTH_RESET_SENT);
    } finally {
      setForgotLoading(false);
    }
  };

  return {
    email,
    password,
    confirmPassword,
    displayName,
    rememberMe,
    showPassword,
    showConfirmPassword,
    error,
    fieldErrors,
    success,
    loading,
    redirecting,
    isBusy: loading || redirecting,
    forgotLoading,
    authLoading,
    passwordStrength,
    signupPasswordTooWeak,
    setPassword,
    setConfirmPassword,
    setDisplayName,
    setShowPassword,
    setShowConfirmPassword,
    handleEmailChange,
    handleRememberChange,
    handleSubmit,
    handleForgotPassword,
  };
}
