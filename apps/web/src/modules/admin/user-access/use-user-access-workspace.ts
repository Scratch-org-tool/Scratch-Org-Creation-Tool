'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import {
  getSessionCache,
  hasFreshSessionCache,
  setSessionCache,
} from '@/lib/session-cache';
import type { AppModule } from '@sfcc/shared';
import type {
  ManageDraft,
  UserAccessOverview,
  UserAccessRow,
  UserAccessTab,
  UserStatusFilter,
} from './types';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [manageUser, setManageUser] = useState<UserAccessRow | null>(null);
  const [draft, setDraft] = useState<ManageDraft | null>(null);
  const [pendingRole, setPendingRole] = useState<{ userId: string; nextRole: 'admin' | 'user' } | null>(null);

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
    setLoading(true);
    setError(null);
    try {
      const data = await api<UserAccessOverview>('/auth/users/overview');
      setOverview(data);
      setSessionCache(cacheKey, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (profile?.role === 'admin' && !hasFreshSessionCache(cacheKey)) {
      void loadOverview();
    }
  }, [profile, loadOverview, cacheKey]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (overview?.users ?? []).filter((u) => {
      if (statusFilter === 'active' && u.status !== 'active') return false;
      if (statusFilter === 'inactive' && u.status !== 'inactive') return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.displayRole.toLowerCase().includes(q)
      );
    });
  }, [overview?.users, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  const openManage = (user: UserAccessRow) => {
    setManageUser(user);
    setDraft({
      role: user.role,
      grantedModules: [...user.grantedModules],
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

  const saveManage = async () => {
    if (!manageUser || !draft) return;
    if (draft.role !== manageUser.role) {
      setPendingRole({ userId: manageUser.id, nextRole: draft.role });
      return;
    }
    await persistAccess(manageUser.id, draft);
  };

  const persistAccess = async (userId: string, data: ManageDraft) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api<UserAccessRow>(`/auth/users/${userId}/access`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: data.role,
          grantedModules: data.grantedModules,
          status: data.status,
        }),
      });
      setOverview((prev) =>
        prev
          ? { ...prev, users: prev.users.map((u) => (u.id === userId ? updated : u)) }
          : prev,
      );
      if (userId === profile?.id) await refreshProfile();
      closeManage();
      setPendingRole(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
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
    saveManage,
    pendingRole,
    setPendingRole,
    confirmRoleChange,
    refresh: () => loadOverview(true),
  };
}
