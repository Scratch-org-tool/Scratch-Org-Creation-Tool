'use client';

import { useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseDb, initFirebaseAnalytics, FIREBASE_COLLECTIONS } from '@/lib/firebase';
import { toAppUserId } from '@sfcc/shared';
import { useCopilotStore } from '@/store';
import { useAuth } from '@/contexts/auth-context';

/** Initializes Firebase analytics and syncs UI preferences to Firestore. */
export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const copilotOpen = useCopilotStore((s) => s.isOpen);
  const userId = user?.uid ? toAppUserId(user.uid) : undefined;

  useEffect(() => {
    initFirebaseAnalytics().catch(() => undefined);
  }, []);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !userId) return;

    const sync = async () => {
      const ref = doc(db, FIREBASE_COLLECTIONS.UI_PREFERENCES, userId);
      await setDoc(
        ref,
        {
          userId,
          theme: 'dark',
          copilotOpen,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    };

    sync().catch(console.error);
  }, [userId, copilotOpen]);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !userId) return;

    const load = async () => {
      const ref = doc(db, FIREBASE_COLLECTIONS.UI_PREFERENCES, userId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as { copilotOpen?: boolean };
      if (data.copilotOpen === true) {
        useCopilotStore.getState().setOpen(true);
      }
    };

    load().catch(console.error);
  }, [userId]);

  return <>{children}</>;
}
