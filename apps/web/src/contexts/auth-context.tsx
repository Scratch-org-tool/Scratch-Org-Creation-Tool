'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  reload as reloadFirebaseUser,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseProfile,
  type User,
} from 'firebase/auth';
import {
  AUTH_GENERIC_INVALID,
  AUTH_LOGIN_FAILED,
  AUTH_RESET_SENT,
  AUTH_SIGNUP_FAILED,
  AUTH_UNAVAILABLE,
} from '@sfcc/shared';
import { getFirebaseAuth } from '@/lib/firebase';
import { buildApiUrl } from '@/lib/api-base-url';
import { setAuthTokenGetter, api } from '@/services/api';
import type { AppModule, UserAccessProfile } from '@sfcc/shared';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  buildDisplayNameRequest,
  runFirebaseSignOutWithCleanup,
  runOptimisticDisplayNameUpdate,
  synchronizeFirebaseDisplayName,
  type LatestRequestGate,
} from '@/modules/account/account-actions';

interface MeResponse extends UserAccessProfile {
  effectiveModules: AppModule[];
  createdAt?: string;
  updatedAt?: string;
}

interface AuthLoginResponse {
  customToken?: string;
  profile: MeResponse;
  usePasswordSignIn?: boolean;
}

interface DisplayNameUpdateResult {
  profile: MeResponse;
  syncWarning?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: MeResponse | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string, adminBootstrapToken?: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    confirmPassword: string,
    adminBootstrapToken?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<DisplayNameUpdateResult | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (parsed.message) {
      const msg = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
      return msg;
    }
  } catch {
    /* use fallback */
  }
  return fallback;
}

async function fetchAuthPublic<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new Error(AUTH_UNAVAILABLE);
  }
  if (!res.ok) {
    throw new Error(await parseApiError(res, fallbackError));
  }
  return res.json() as Promise<T>;
}

async function fetchWithToken<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error(AUTH_UNAVAILABLE);
  }
  if (!res.ok) {
    throw new Error(await parseApiError(res, AUTH_GENERIC_INVALID));
  }
  return res.json() as Promise<T>;
}

async function loadProfile(firebaseUser: User, adminBootstrapToken?: string): Promise<MeResponse> {
  const token = await firebaseUser.getIdToken();
  const displayName = firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User';

  if (adminBootstrapToken !== undefined) {
    return fetchWithToken<MeResponse>('/auth/register', token, {
      method: 'POST',
      body: JSON.stringify({ displayName, adminBootstrapToken }),
    });
  }

  try {
    return await fetchWithToken<MeResponse>('/auth/me', token);
  } catch {
    return fetchWithToken<MeResponse>('/auth/register', token, {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [userRevision, setUserRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileUserIdRef = useRef<string | null>(null);
  const profileRef = useRef<MeResponse | null>(null);
  const displayNameGateRef = useRef<LatestRequestGate>({ current: 0 });

  const replaceProfile = useCallback((next: MeResponse | null) => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  const refreshUserContext = useCallback((next: User | null) => {
    setUser(next);
    setUserRevision((current) => current + 1);
  }, []);

  const refreshProfile = useCallback(async (firebaseUser?: User | null) => {
    const current = firebaseUser ?? user;
    if (!current) {
      profileUserIdRef.current = null;
      replaceProfile(null);
      setProfileError(null);
      return;
    }
    try {
      const me = await loadProfile(current);
      profileUserIdRef.current = current.uid;
      replaceProfile(me);
      setProfileError(null);
    } catch {
      // Keep a profile that was already verified for this Firebase user.
      // Transient API failures must not revoke the UI's last known access.
      if (profileUserIdRef.current !== current.uid) replaceProfile(null);
      setProfileError(AUTH_GENERIC_INVALID);
    }
  }, [replaceProfile, user]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    setAuthTokenGetter(async (forceRefresh?: boolean) => {
      const current = auth.currentUser;
      if (!current) return null;
      return current.getIdToken(forceRefresh ?? false);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.uid !== profileUserIdRef.current) {
        displayNameGateRef.current.current += 1;
        replaceProfile(null);
      }
      setUser(firebaseUser);
      if (firebaseUser) {
        await refreshProfile(firebaseUser);
      } else {
        profileUserIdRef.current = null;
        replaceProfile(null);
        setProfileError(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshProfile, replaceProfile]);

  const signIn = useCallback(async (email: string, password: string, adminBootstrapToken?: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error(AUTH_UNAVAILABLE);

    const result = await fetchAuthPublic<AuthLoginResponse>(
      '/auth/login',
      { email, password, adminBootstrapToken },
      AUTH_LOGIN_FAILED,
    );

    const credential = result.customToken
      ? await signInWithCustomToken(auth, result.customToken)
      : await signInWithEmailAndPassword(auth, email, password);
    replaceProfile(result.profile);
    profileUserIdRef.current = credential.user.uid;
    setProfileError(null);
    setUser(credential.user);
    setAuthTokenGetter(async (forceRefresh?: boolean) => {
      const current = auth.currentUser;
      return current ? current.getIdToken(forceRefresh ?? false) : null;
    });
  }, [replaceProfile]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    confirmPassword: string,
    adminBootstrapToken?: string,
  ) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error(AUTH_UNAVAILABLE);

    const result = await fetchAuthPublic<AuthLoginResponse>(
      '/auth/signup',
      { email, password, displayName, confirmPassword, adminBootstrapToken },
      AUTH_SIGNUP_FAILED,
    );

    const credential = result.customToken
      ? await signInWithCustomToken(auth, result.customToken)
      : await signInWithEmailAndPassword(auth, email, password);
    replaceProfile(result.profile);
    profileUserIdRef.current = credential.user.uid;
    setProfileError(null);
    setUser(credential.user);
    setAuthTokenGetter(async (forceRefresh?: boolean) => {
      const current = auth.currentUser;
      return current ? current.getIdToken(forceRefresh ?? false) : null;
    });
  }, [replaceProfile]);

  const clearClientAuth = useCallback(() => {
    setAuthTokenGetter(async () => null);
    setUser(null);
    profileUserIdRef.current = null;
    displayNameGateRef.current.current += 1;
    replaceProfile(null);
    setProfileError(null);
  }, [replaceProfile]);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    await runFirebaseSignOutWithCleanup(
      () => auth ? firebaseSignOut(auth) : Promise.resolve(),
      clearClientAuth,
    );
  }, [clearClientAuth]);

  const resetPassword = useCallback(async (email: string) => {
    const result = await fetchAuthPublic<{ message: string }>(
      '/auth/forgot-password',
      { email },
      AUTH_GENERIC_INVALID,
    );
    return result.message ?? AUTH_RESET_SENT;
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const snapshot = profileRef.current;
    const auth = getFirebaseAuth();
    const firebaseUser = auth?.currentUser;
    if (!snapshot || !firebaseUser || profileUserIdRef.current !== firebaseUser.uid) {
      throw new Error(AUTH_GENERIC_INVALID);
    }

    const requestBody = buildDisplayNameRequest(displayName);
    const normalized = requestBody.displayName;
    const result = await runOptimisticDisplayNameUpdate({
      gate: displayNameGateRef.current,
      snapshot,
      displayName: normalized,
      setProfile: replaceProfile,
      request: () => api<MeResponse>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(requestBody),
      }),
      syncFirebase: (nextDisplayName, sequence) => synchronizeFirebaseDisplayName({
        displayName: nextDisplayName,
        sequence,
        updateProfile: (authoritativeDisplayName) => updateFirebaseProfile(firebaseUser, {
          displayName: authoritativeDisplayName,
        }),
        reload: () => reloadFirebaseUser(firebaseUser),
        refreshContext: () => refreshUserContext(auth.currentUser),
      }),
      reconcile: async () => {
        try {
          await reloadFirebaseUser(firebaseUser);
        } finally {
          refreshUserContext(auth.currentUser);
          await refreshProfile(firebaseUser);
        }
      },
    });
    if (result.status === 'stale') return null;
    setProfileError(null);
    return {
      profile: result.profile,
      ...(result.syncWarning ? { syncWarning: result.syncWarning } : {}),
    };
  }, [refreshProfile, refreshUserContext, replaceProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updateDisplayName,
      refreshProfile: () => refreshProfile(),
    }),
    [
      user,
      profile,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updateDisplayName,
      refreshProfile,
      userRevision,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
