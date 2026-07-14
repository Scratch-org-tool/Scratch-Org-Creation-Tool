'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  deployFieldsFromSoqlSelect,
  parseOrgToOrgSoql,
  validateSoqlForObject,
} from '@sfcc/shared';
import { api } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import type {
  Org,
  OrgToOrgDeployBatchResult,
  OrgToOrgFilterPreviewResult,
  OrgToOrgFormState,
  OrgToOrgObjectDeployConfig,
  OrgToOrgObjectInfo,
  OrgToOrgObjectMeta,
  OrgToOrgQueryMode,
  OrgToOrgWizardStep,
} from './types';
import { DEFAULT_OBJECT_CONFIG } from './types';

const DEFAULT_FORM: OrgToOrgFormState = {
  sourceOrgId: '',
  targetOrgId: '',
  strategy: 'upsert',
};

const TERMINAL_JOB_STATUSES = ['completed', 'failed', 'cancelled'];

function aggregateJobStatus(statuses: string[]): string {
  if (statuses.some((s) => s === 'failed')) return 'failed';
  if (statuses.some((s) => s === 'cancelled')) return 'cancelled';
  if (statuses.length > 0 && statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'running')) return 'running';
  return 'queued';
}

function usesCustomSoql(config: OrgToOrgObjectDeployConfig): boolean {
  return config.queryMode === 'soql' && Boolean(config.customSoql?.trim());
}

function buildPreviewBody(sourceOrgId: string, objectName: string, config: OrgToOrgObjectDeployConfig) {
  const base = {
    sourceOrgId,
    objectName,
    recordLimit: config.recordLimit,
    page: 1,
    pageSize: config.recordLimit,
  };
  if (usesCustomSoql(config)) {
    return { ...base, soql: config.customSoql!.trim() };
  }
  return {
    ...base,
    filters: config.filters,
    selectedReferenceFields: config.selectedReferenceFields,
    selectedDeployFields: config.selectedDeployFields,
  };
}

export function useOrgToOrgDeploy() {
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState<OrgToOrgFormState>(DEFAULT_FORM);
  const [objects, setObjects] = useState<OrgToOrgObjectInfo[]>([]);
  const [checkedObjects, setCheckedObjects] = useState<Set<string>>(new Set());
  const [activeObject, setActiveObject] = useState<string | null>(null);
  const [objectConfigs, setObjectConfigs] = useState<Map<string, OrgToOrgObjectDeployConfig>>(new Map());
  const [objectMetaCache, setObjectMetaCache] = useState<Map<string, OrgToOrgObjectMeta>>(new Map());
  const [selectedRecordIds, setSelectedRecordIds] = useState<Map<string, Set<string>>>(new Map());
  const [wizardStep, setWizardStep] = useState<OrgToOrgWizardStep>('configure');
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDeploy, setLoadingDeploy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<OrgToOrgDeployBatchResult | null>(null);
  const [deployStatus, setDeployStatus] = useState<string | null>(null);
  const [deployJobError, setDeployJobError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void fetchOrgsList().then(setOrgs).catch(console.error);
  }, []);

  useEffect(() => {
    if (jobIds.length === 0) return;
    let cancelled = false;
    const poll = setInterval(async () => {
      try {
        const jobs = await Promise.all(
          jobIds.map((id) =>
            api<{ status: string; error?: string | null; logs?: Array<{ line: string }> }>(`/jobs/${id}`),
          ),
        );
        if (cancelled) return;
        const lines: string[] = [];
        for (const data of jobs) {
          if (data.logs?.length) lines.push(...data.logs.map((l) => l.line));
        }
        if (lines.length) setLogs(lines);
        setDeployStatus(aggregateJobStatus(jobs.map((j) => j.status)));
        const failed = jobs.find((j) => j.status === 'failed');
        setDeployJobError(failed?.error ?? null);
        if (jobs.every((j) => TERMINAL_JOB_STATUSES.includes(j.status))) clearInterval(poll);
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [jobIds]);

  useEffect(() => {
    const sourceOrgId = searchParams.get('sourceOrgId');
    if (sourceOrgId) setForm((f) => ({ ...f, sourceOrgId }));
  }, [searchParams]);

  const orgsReady =
    Boolean(form.sourceOrgId) &&
    Boolean(form.targetOrgId) &&
    form.sourceOrgId !== form.targetOrgId;

  const sourceOrg = orgs.find((o) => o.id === form.sourceOrgId);
  const targetOrg = orgs.find((o) => o.id === form.targetOrgId);

  const loadObjects = useCallback(async () => {
    if (!form.sourceOrgId) return;
    setLoadingObjects(true);
    setError(null);
    try {
      const list = await api<OrgToOrgObjectInfo[]>(
        `/data/org-to-org/objects?orgId=${encodeURIComponent(form.sourceOrgId)}`,
      );
      setObjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objects');
    } finally {
      setLoadingObjects(false);
    }
  }, [form.sourceOrgId]);

  useEffect(() => {
    setObjects([]);
    setCheckedObjects(new Set());
    setActiveObject(null);
    setObjectConfigs(new Map());
    setObjectMetaCache(new Map());
    setSelectedRecordIds(new Map());
    setWizardStep('configure');
    if (orgsReady) void loadObjects();
  }, [form.sourceOrgId, form.targetOrgId, orgsReady, loadObjects]);

  const runPreviewForObject = useCallback(
    async (objectName: string, config: OrgToOrgObjectDeployConfig) => {
      if (!form.sourceOrgId) return;
      setLoadingPreview(true);
      try {
        const result = await api<OrgToOrgFilterPreviewResult>('/data/org-to-org/preview-filter', {
          method: 'POST',
          body: JSON.stringify(buildPreviewBody(form.sourceOrgId, objectName, config)),
        });
        setObjectConfigs((prev) => {
          const next = new Map(prev);
          const existing = next.get(objectName) ?? config;
          next.set(objectName, {
            ...existing,
            matchCount: result.matchCount,
            previewRecords: result.records,
            displayFields: result.displayFields,
          });
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Filter preview failed');
      } finally {
        setLoadingPreview(false);
      }
    },
    [form.sourceOrgId],
  );

  const loadObjectMeta = useCallback(
    async (objectName: string) => {
      if (!form.sourceOrgId) return null;
      setLoadingMeta(true);
      try {
        const meta = await api<OrgToOrgObjectMeta>(
          `/data/org-to-org/object-meta?orgId=${encodeURIComponent(form.sourceOrgId)}&objectName=${encodeURIComponent(objectName)}`,
        );
        setObjectMetaCache((prev) => new Map(prev).set(objectName, meta));

        const defaultDeployFields = (meta.deployableFields ?? [])
          .filter((f) => f.selected)
          .map((f) => f.name);
        const refFields = meta.referenceFields.filter((r) => r.selected).map((r) => r.name);

        let configForPreview: OrgToOrgObjectDeployConfig | null = null;
        setObjectConfigs((prev) => {
          const next = new Map(prev);
          const existing = next.get(objectName);
          const updated: OrgToOrgObjectDeployConfig = existing
            ? {
                ...existing,
                matchField: meta.matchField,
                displayFields: meta.displayFields,
                selectedDeployFields:
                  existing.selectedDeployFields.length > 0
                    ? existing.selectedDeployFields
                    : defaultDeployFields,
              }
            : {
                ...DEFAULT_OBJECT_CONFIG(meta.objectName, meta.matchField),
                selectedReferenceFields: refFields,
                selectedDeployFields: defaultDeployFields,
                displayFields: meta.displayFields,
              };
          next.set(objectName, updated);
          configForPreview = updated;
          return next;
        });

        if (configForPreview) {
          void runPreviewForObject(objectName, configForPreview);
        }
        return meta;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load object metadata');
        return null;
      } finally {
        setLoadingMeta(false);
      }
    },
    [form.sourceOrgId, runPreviewForObject],
  );

  const schedulePreview = useCallback(
    (objectName: string, config: OrgToOrgObjectDeployConfig) => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => {
        void runPreviewForObject(objectName, config);
      }, 500);
    },
    [runPreviewForObject],
  );

  const toggleObjectChecked = useCallback(
    (apiName: string, checked: boolean) => {
      setCheckedObjects((prev) => {
        const next = new Set(prev);
        if (checked) next.add(apiName);
        else next.delete(apiName);
        return next;
      });
      if (checked) {
        setActiveObject(apiName);
        void loadObjectMeta(apiName);
      }
    },
    [loadObjectMeta],
  );

  const focusObject = useCallback(
    (apiName: string) => {
      setActiveObject(apiName);
      void loadObjectMeta(apiName);
    },
    [loadObjectMeta],
  );

  const updateObjectConfig = useCallback(
    (objectName: string, patch: Partial<OrgToOrgObjectDeployConfig>) => {
      setObjectConfigs((prev) => {
        const next = new Map(prev);
        const existing = next.get(objectName) ?? DEFAULT_OBJECT_CONFIG(objectName);
        const builderEdit =
          patch.filters !== undefined ||
          patch.selectedDeployFields !== undefined ||
          patch.selectedReferenceFields !== undefined;
        const updated: OrgToOrgObjectDeployConfig = {
          ...existing,
          ...patch,
          ...(builderEdit && patch.queryMode !== 'soql'
            ? { queryMode: 'builder' as const, customSoql: '' }
            : {}),
        };
        next.set(objectName, updated);
        if (usesCustomSoql(updated) || updated.queryMode !== 'soql') {
          schedulePreview(objectName, updated);
        }
        return next;
      });
    },
    [schedulePreview],
  );

  const setQueryMode = useCallback(
    (objectName: string, mode: OrgToOrgQueryMode) => {
      if (mode === 'builder') {
        updateObjectConfig(objectName, { queryMode: 'builder', customSoql: '' });
      } else {
        setObjectConfigs((prev) => {
          const next = new Map(prev);
          const existing = next.get(objectName) ?? DEFAULT_OBJECT_CONFIG(objectName);
          next.set(objectName, { ...existing, queryMode: 'soql' });
          return next;
        });
      }
    },
    [updateObjectConfig],
  );

  const applyCustomSoql = useCallback(
    (objectName: string, soql: string) => {
      const meta = objectMetaCache.get(objectName);
      if (!meta) return;
      try {
        validateSoqlForObject(soql, meta.objectName);
        const parsed = parseOrgToOrgSoql(soql);
        const existing = objectConfigs.get(objectName) ?? DEFAULT_OBJECT_CONFIG(objectName, meta.matchField);
        const updated: OrgToOrgObjectDeployConfig = {
          ...existing,
          queryMode: 'soql',
          customSoql: soql.trim(),
          selectedDeployFields: deployFieldsFromSoqlSelect(parsed.fields),
          filters: parsed.filters,
        };
        setObjectConfigs((prev) => {
          const next = new Map(prev);
          next.set(objectName, updated);
          return next;
        });
        void runPreviewForObject(objectName, updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid SOQL query');
      }
    },
    [objectMetaCache, objectConfigs, runPreviewForObject],
  );

  const clearCustomSoql = useCallback(
    (objectName: string) => {
      updateObjectConfig(objectName, { queryMode: 'builder', customSoql: '' });
    },
    [updateObjectConfig],
  );

  const toggleReferenceField = useCallback(
    (objectName: string, fieldName: string, selected: boolean) => {
      setObjectConfigs((prev) => {
        const next = new Map(prev);
        const existing = next.get(objectName);
        if (!existing) return prev;
        const refs = new Set(existing.selectedReferenceFields);
        if (selected) refs.add(fieldName);
        else refs.delete(fieldName);
        const updated: OrgToOrgObjectDeployConfig = {
          ...existing,
          selectedReferenceFields: Array.from(refs),
          queryMode: 'builder',
          customSoql: '',
        };
        next.set(objectName, updated);
        schedulePreview(objectName, updated);
        return next;
      });
    },
    [schedulePreview],
  );

  const toggleRecord = useCallback((objectName: string, recordId: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(objectName) ?? []);
      if (set.has(recordId)) set.delete(recordId);
      else set.add(recordId);
      next.set(objectName, set);
      return next;
    });
  }, []);

  const toggleAllRecordsForObject = useCallback((objectName: string, recordIds: string[]) => {
    setSelectedRecordIds((prev) => {
      const next = new Map(prev);
      const current = next.get(objectName) ?? new Set();
      const allSelected = recordIds.every((id) => current.has(id));
      const set = new Set(current);
      if (allSelected) {
        for (const id of recordIds) set.delete(id);
      } else {
        for (const id of recordIds) set.add(id);
      }
      next.set(objectName, set);
      return next;
    });
  }, []);

  const activeConfig = activeObject ? objectConfigs.get(activeObject) : undefined;
  const activeMeta = activeObject ? objectMetaCache.get(activeObject) : undefined;

  const checkedObjectList = useMemo(
    () => objects.filter((o) => checkedObjects.has(o.apiName)),
    [objects, checkedObjects],
  );

  const totalSelectedCount = useMemo(() => {
    let n = 0;
    for (const set of selectedRecordIds.values()) n += set.size;
    return n;
  }, [selectedRecordIds]);

  const canGoNext = checkedObjects.size > 0;
  const canDeploy = wizardStep === 'preview' && checkedObjects.size > 0;

  const goToPreview = useCallback(async () => {
    if (!canGoNext) return;
    setWizardStep('preview');
    setError(null);
    for (const apiName of checkedObjects) {
      const config = objectConfigs.get(apiName);
      if (config) await runPreviewForObject(apiName, config);
    }
  }, [canGoNext, checkedObjects, objectConfigs, runPreviewForObject]);

  const deploy = useCallback(async () => {
    if (!orgsReady || checkedObjects.size === 0) return;
    setLoadingDeploy(true);
    setError(null);
    setLogs([]);
    setJobIds([]);
    setBatchResult(null);
    setDeployStatus('queued');
    setDeployJobError(null);
    try {
      const payload = {
        sourceOrgId: form.sourceOrgId,
        targetOrgId: form.targetOrgId,
        strategy: form.strategy,
        objects: Array.from(checkedObjects).map((objectName) => {
          const config = objectConfigs.get(objectName) ?? DEFAULT_OBJECT_CONFIG(objectName);
          const ids = selectedRecordIds.get(objectName);
          return {
            objectName,
            recordLimit: config.recordLimit,
            filters: config.filters,
            selectedReferenceFields: config.selectedReferenceFields,
            selectedDeployFields: config.selectedDeployFields,
            matchField: config.matchField,
            ...(usesCustomSoql(config)
              ? { soql: config.customSoql!.trim(), queryMode: 'soql' as const }
              : {}),
            ...(ids && ids.size > 0 ? { selectedRecordIds: Array.from(ids) } : {}),
          };
        }),
      };
      const result = await api<OrgToOrgDeployBatchResult>('/data/org-to-org/deploy-batch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setBatchResult(result);
      setJobIds(result.deployments.map((d) => d.jobId));
      setWizardStep('deploy');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setLoadingDeploy(false);
    }
  }, [orgsReady, checkedObjects, form, objectConfigs, selectedRecordIds]);

  const scratchWarning =
    sourceOrg?.type === 'scratch' && sourceOrg.expiresAt
      ? new Date(sourceOrg.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
      : false;

  return {
    orgs,
    form,
    setForm,
    sourceOrg,
    targetOrg,
    objects,
    checkedObjects,
    activeObject,
    activeConfig,
    activeMeta,
    objectConfigs,
    objectMetaCache,
    selectedRecordIds,
    wizardStep,
    setWizardStep,
    loadingObjects,
    loadingMeta,
    loadingPreview,
    loadingDeploy,
    error,
    setError,
    orgsReady,
    toggleObjectChecked,
    focusObject,
    updateObjectConfig,
    toggleReferenceField,
    setQueryMode,
    applyCustomSoql,
    clearCustomSoql,
    toggleRecord,
    toggleAllRecordsForObject,
    checkedObjectList,
    totalSelectedCount,
    canGoNext,
    canDeploy,
    goToPreview,
    deploy,
    scratchWarning,
    jobIds,
    batchResult,
    deployStatus,
    deployJobError,
    logs,
    setLogs,
  };
}
