'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  createAssignments,
  fetchCatalog,
  fetchTeamOverview,
  revokeAssignment,
} from './learning-api';
import type { LearningAdminOverview, LearningPathSummary } from './types';

export interface AssignDraft {
  userIds: string[];
  pathIds: string[];
  note: string;
  dueAt: string;
}

const EMPTY_DRAFT: AssignDraft = { userIds: [], pathIds: [], note: '', dueAt: '' };

export function useTeamWorkspace() {
  const { profile, loading: profileLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [overview, setOverview] = useState<LearningAdminOverview | null>(null);
  const [paths, setPaths] = useState<LearningPathSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<AssignDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [overviewData, catalog] = await Promise.all([fetchTeamOverview(), fetchCatalog()]);
      setOverview(overviewData);
      setPaths(catalog.paths);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [isAdmin, load, profileLoading]);

  const openDrawer = useCallback((presetUserId?: string) => {
    setDraft({ ...EMPTY_DRAFT, userIds: presetUserId ? [presetUserId] : [] });
    setSaveError(null);
    setDrawerOpen(true);
  }, []);

  const submitAssignments = useCallback(async () => {
    if (draft.userIds.length === 0 || draft.pathIds.length === 0) {
      setSaveError('Pick at least one learner and one path.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await createAssignments({
        userIds: draft.userIds,
        pathIds: draft.pathIds,
        note: draft.note.trim() || undefined,
        // Due dates are calendar dates, not browser-local instants. Keep the
        // selected date stable for learners in every time zone.
        dueAt: draft.dueAt ? `${draft.dueAt}T23:59:59.999Z` : undefined,
      });
      setDrawerOpen(false);
      setNotice(
        `${result.created.length} assignment${result.created.length === 1 ? '' : 's'} created${result.skippedExisting > 0 ? ` (${result.skippedExisting} already existed)` : ''}. Learners have been notified.`,
      );
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create assignments');
    } finally {
      setSaving(false);
    }
  }, [draft, load]);

  const revoke = useCallback(
    async (assignmentId: string) => {
      setRevokingId(assignmentId);
      try {
        await revokeAssignment(assignmentId);
        await load();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to revoke the assignment');
        return false;
      } finally {
        setRevokingId(null);
      }
    },
    [load],
  );

  const engagementRate = useMemo(() => {
    if (!overview || overview.totals.learners === 0) return null;
    return Math.round((overview.totals.activeLearners / overview.totals.learners) * 100);
  }, [overview]);

  return {
    isAdmin,
    profileLoading,
    overview,
    paths,
    loading,
    error,
    notice,
    setNotice,
    drawerOpen,
    setDrawerOpen,
    draft,
    setDraft,
    saving,
    saveError,
    openDrawer,
    submitAssignments,
    revoke,
    revokingId,
    engagementRate,
    reload: load,
  };
}
