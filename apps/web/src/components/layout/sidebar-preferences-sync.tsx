'use client';

import { useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toAppUserId } from '@sfcc/shared';
import { useAuth } from '@/contexts/auth-context';
import { getFirebaseDb, FIREBASE_COLLECTIONS } from '@/lib/firebase';
import {
  SIDEBAR_STORAGE_KEY,
  persistSidebarOpen,
  useSidebar,
} from '@/components/ui/sidebar';

/** Syncs sidebar collapsed state with Firestore (cross-device), respecting localStorage priority. */
export function SidebarPreferencesSync() {
  const { user } = useAuth();
  const { open, setOpen } = useSidebar();
  const userId = user?.uid ? toAppUserId(user.uid) : undefined;

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !userId) return;

    const load = async () => {
      const hasLocal = localStorage.getItem(SIDEBAR_STORAGE_KEY) !== null;
      if (hasLocal) return;

      const ref = doc(db, FIREBASE_COLLECTIONS.UI_PREFERENCES, userId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const data = snap.data() as { sidebarCollapsed?: boolean };
      if (typeof data.sidebarCollapsed === 'boolean') {
        setOpen(!data.sidebarCollapsed);
        persistSidebarOpen(!data.sidebarCollapsed);
      }
    };

    load().catch(console.error);
  }, [userId, setOpen]);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !userId) return;

    const sync = async () => {
      const ref = doc(db, FIREBASE_COLLECTIONS.UI_PREFERENCES, userId);
      await setDoc(
        ref,
        {
          userId,
          sidebarCollapsed: !open,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    };

    sync().catch(console.error);
  }, [userId, open]);

  return null;
}
