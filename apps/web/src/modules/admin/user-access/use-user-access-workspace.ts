'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import {
  getSessionCache,
  hasFreshSessionCache,
  setSessionCache,
} from '@/lib/session-cache';
import { DEFAULT_LEARNING_FEATURES, type AppModule } from '@sfcc/shared';
import type {
  ManageDraft,
  UserAccessOverview,
  UserAccessRow,
  UserAccessTab,
  UserRoleFilter,
  UserStatusFilter,
} from './types';
import { applyAccessDraft, reconcileAccessRow } from './optimistic-user-access';
import { usersToCsv } from './user-access-csv';

export function useUserAccessWorkspace() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const cacheKey = 'user-access:overview';
  const cached = getSessionCache<UserAccessOverview>(cacheKey);
  const [overview, setOverview] = useState<UserAccessOverview | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<UserAccessTab>('users');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [manageUser, setManageUser] = useState<UserAccessRow | null>(null);
  const [draft, setDraft] = useState<ManageDraft | null>(null);
  const [pendingRole, setPendingRole] = useState<{ userId: string; nextRole: 'admin' | 'user' } | null>(null);
  const [optimisticAnnouncement, setOptimisticAnnouncement] = useState('');
  const accessBusyRef = useRef(new Set<string>());
  const accessTokensRef = useRef(new Map<string, number>());
  const overviewRequestRef = useRef(0);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  const loadOverview = useCallback(async (manual = false) => {
    if (!manual && hasFreshSessionCache(cacheKey)) {
      const cached = getSessionCache<UserAccessOverview>(cacheKey);
      if (cached) {
        setOverview(cached);
        setLoading(false);
        return;
      }
    }
    const request = ++overviewRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api<UserAccessOverview>('/auth/users/overview');
      if (overviewRequestRef.current !== request) return;
      setOverview(data);
      setSessionCache(cacheKey, data);
    } catch (err) {
      if (overviewRequestRef.current === request) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      }
    } finally {
      if (overviewRequestRef.current === request) setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (profile?.role === 'admin' && !hasFreshSessionCache(cacheKey)) {
      void loadOverview();
    }
  }, [profile, loadOverview, cacheKey]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter, pageSize]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (overview?.users ?? []).filter((u) => {
      if (statusFilter === 'active' && u.status !== 'active') return false;
      if (statusFilter === 'inactive' && u.status !== 'inactive') return false;
      if (roleFilter !== 'all' && u.displayRole !== roleFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.displayRole.toLowerCase().includes(q)
      );
    });
  }, [overview?.users, search, statusFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  const exportCsv = useCallback(() => {
    if (typeof document === 'undefined' || filteredUsers.length === 0) return;
    const csv = usersToCsv(filteredUsers);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user-access-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [filteredUsers]);

  const openManage = (user: UserAccessRow) => {
    setManageUser(user);
    setDraft({
      role: user.role,
      grantedModules: [...user.grantedModules],
      learningFeatures: [...(user.learningFeatures ?? [])],
      status: user.status,
    });
  };

  const closeManage = () => {
    setManageUser(null);
    setDraft(null);
  };

  const toggleDraftModule = (module: AppModule) => {
    setDraft((d) => {
      if (!d) return d;
      const next = d.grantedModules.includes(module)
        ? d.grantedModules.filter((m) => m !== module)
        : [...d.grantedModules, module];
      return { ...d, grantedModules: next };
    });
  };

  /**
   * Toggle one Academy feature. When the user has no explicit grants yet, we
   * materialise the default baseline first so the checkbox state the admin sees
   * (the effective access) is exactly what gets saved.
   */
  const toggleDraftLearningFeature = (feature: string) => {
    setDraft((d) => {
      if (!d) return d;
      const effective =
        d.learningFeatures.length > 0 ? d.learningFeatures : [...DEFAULT_LEARNING_FEATURES];
      const next = effective.includes(feature)
        ? effective.filter((f) => f !== feature)
        : [...effective, feature];
      return { ...d, learningFeatures: next };
    });
  };

  const saveManage = async () => {
    if (!manageUser || !draft) return;
    if (draft.role !== manageUser.role) {
      setPendingRole({ userId: manageUser.id, nextRole: draft.role });
      return;
    }
    await persistAccess(manageUser.id, draft);
  };

  const persistAccess = async (userId: string, data: ManageDraft) => {
    if (accessBusyRef.current.has(userId) || !overview) return;
    const token = (accessTokensRef.current.get(userId) ?? 0) + 1;
    accessTokensRef.current.set(userId, token);
    accessBusyRef.current.add(userId);
    const snapshot = overview;
    overviewRequestRef.current += 1;
    setLoading(false);
    setSaving(true);
    setError(null);
    setOverview(applyAccessDraft(overview, userId, data));
    setOptimisticAnnouncement(`Access changes for ${manageUser?.displayName ?? userId} are being saved.`);
    try {
      const updated = await api<UserAccessRow>(`/auth/users/${encodeURIComponent(userId)}/access`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: data.role,
          grantedModules: data.grantedModules,
          learningFeatures: data.learningFeatures,
          status: data.status,
        }),
      });
      if (accessTokensRef.current.get(userId) !== token) return;
      setOverview((current) => {
        if (!current) return current;
        const next = reconcileAccessRow(current, updated);
        setSessionCache(cacheKey, next);
        return next;
      });
      closeManage();
      setPendingRole(null);
      setOptimisticAnnouncement(`Access changes for ${updated.displayName} were saved.`);
      if (userId === profile?.id) {
        void refreshProfile().catch(() => {
          setError('Access was saved, but your session profile could not be refreshed.');
        });
      }
    } catch (err) {
      if (accessTokensRef.current.get(userId) !== token) return;
      setOverview(snapshot);
      setSessionCache(cacheKey, snapshot);
      setError(`${err instanceof Error ? err.message : 'Failed to save changes'} Changes were rolled back; your draft is still editable.`);
      setPendingRole(null);
      setOptimisticAnnouncement('Access changes failed and were rolled back. The draft remains open.');
    } finally {
      if (accessTokensRef.current.get(userId) === token) {
        accessBusyRef.current.delete(userId);
        setSaving(false);
      }
    }
  };

  const confirmRoleChange = async () => {
    if (!pendingRole || !draft) return;
    await persistAccess(pendingRole.userId, { ...draft, role: pendingRole.nextRole });
  };

  return {
    profile,
    overview,
    loading,
    saving,
    error,
    setError,
    tab,
    setTab,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    exportCsv,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    filteredUsers,
    paginatedUsers,
    manageUser,
    draft,
    setDraft,
    openManage,
    closeManage,
    toggleDraftModule,
    toggleDraftLearningFeature,
    saveManage,
    pendingRole,
    setPendingRole,
    confirmRoleChange,
    optimisticAnnouncement,
    refresh: () => loadOverview(true),
  };
}
