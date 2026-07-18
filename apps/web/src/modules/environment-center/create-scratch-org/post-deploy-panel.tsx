'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import type { AutomationRunView } from '@/components/scratch-org/types';
import {
  DATASET_OPTIONS,
  resolvePostDeployDefaults,
  type Dataset,
  type PartnerBottler,
  type PartnerMode,
} from './post-deploy-defaults';

interface PostDeployPanelProps {
  run: AutomationRunView | null;
  automationRunId: string | null;
  sourceOrgId?: string;
  onRefresh?: () => void | Promise<void>;
}

type DiscoverResponse = {
  picklists: Array<{ name: string; values: string[] }>;
};

export function PostDeployPanel({ run, automationRunId, sourceOrgId: sourceOrgIdProp, onRefresh }: PostDeployPanelProps) {
  const generatedId = useId().replace(/:/g, '');
  const id = (name: string) => `post-deploy-${generatedId}-${name}`;
  const awaiting =
    run?.status === 'awaiting_input'
    && run.checkpoint?.awaitingUserActions === true;
  const targetOrgId = run?.checkpoint?.targetOrgConnectionId;
  const config = run?.config;
  const configSourceOrgId = config?.dataDeploymentOrgId ?? config?.sourceOrgId;
  const sourceOrgId = configSourceOrgId ?? sourceOrgIdProp;
  const completedActions = new Set(run?.checkpoint?.userActionsCompleted ?? []);
  const hasUsers = Boolean(
    config?.userProvisioning?.users?.length
    || config?.userProvisioning?.slots?.length
    || config?.userProvisioning?.userGenerators?.length,
  );
  const canProvisionUsers =
    hasUsers
    && config?.pipelineSteps?.autoRunUsers !== true
    && !completedActions.has('provision_users');
  const canLoadData =
    Boolean(config?.dataSeed)
    && Boolean(sourceOrgId)
    && config?.pipelineSteps?.autoRunDataSeed !== true
    && !completedActions.has('load_data_seed');
  const queryHandlesPartners = Boolean(
    config?.dataSeed?.mode === 'query_section'
    && config.dataSeed.querySection?.accountPartnerPlan,
  );
  const canLoadPartners =
    config?.partnerImport?.enabled === true
    && config.pipelineSteps?.autoRunPartners !== true
    && !queryHandlesPartners
    && !completedActions.has('load_account_partners')
    && (config.partnerImport.mode === 'excel' || Boolean(sourceOrgId));

  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [partnerMode, setPartnerMode] = useState<PartnerMode>('org_to_org_matched');
  const [bottler, setBottler] = useState<PartnerBottler>('5000');
  const [datasets, setDatasets] = useState<Dataset[]>([...DATASET_OPTIONS]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const discoverRequest = useRef(0);
  const actionGeneration = useRef(0);
  const actionInFlight = useRef(false);

  const loadDiscover = useCallback(async () => {
    const request = ++discoverRequest.current;
    if (!targetOrgId) {
      setDiscover(null);
      return;
    }
    setLoadingDiscover(true);
    try {
      const res = await api<DiscoverResponse>(`/provisioning/orgs/${targetOrgId}/discover`);
      if (request === discoverRequest.current) setDiscover(res);
    } catch (error) {
      if (request === discoverRequest.current) {
        setDiscover(null);
        setMessage(
          error instanceof Error
            ? `Could not load user metadata: ${error.message}`
            : 'Could not load user metadata.',
        );
      }
    } finally {
      if (request === discoverRequest.current) setLoadingDiscover(false);
    }
  }, [targetOrgId]);

  useEffect(() => {
    discoverRequest.current += 1;
    actionGeneration.current += 1;
    actionInFlight.current = false;
    setDiscover(null);
    setLoadingDiscover(false);
    setRunning(null);
    setExcelFile(null);
    setMessage(null);
    const defaults = resolvePostDeployDefaults(config);
    setDatasets(defaults.datasets);
    setPartnerMode(defaults.partnerMode);
    setBottler(defaults.bottler);
  }, [
    automationRunId,
    config?.dataSeed?.datasets?.join('|'),
    config?.partnerImport?.bottler,
    config?.partnerImport?.mode,
  ]);

  useEffect(() => {
    if (awaiting && canProvisionUsers && targetOrgId) void loadDiscover();
  }, [awaiting, canProvisionUsers, targetOrgId, loadDiscover, automationRunId]);

  if (!awaiting || !automationRunId) return null;

  const runActions = async (
    action: 'provision_users' | 'load_data_seed' | 'load_account_partners',
    resolveOptions?: () => Promise<{
      datasets?: string[];
      partnerMode?: PartnerMode;
      partnerBottler?: PartnerBottler;
      partnerExcelBase64?: string;
    }>,
  ) => {
    if (actionInFlight.current) return;
    const generation = ++actionGeneration.current;
    actionInFlight.current = true;
    setRunning(action);
    setMessage(null);
    try {
      const opts = await resolveOptions?.();
      const res = await api<{ jobs: Array<{ action: string; jobId: string }> }>(
        `/environment/automation-runs/${automationRunId}/run`,
        {
          method: 'POST',
          body: JSON.stringify({
            actions: [action],
            datasets: opts?.datasets,
            partnerMode: opts?.partnerMode,
            partnerBottler: opts?.partnerBottler,
            partnerExcelBase64: opts?.partnerExcelBase64,
          }),
        },
      );
      if (generation === actionGeneration.current) {
        setMessage(`Started: ${res.jobs.map((j) => j.action).join(', ')}`);
        await onRefresh?.();
      }
    } catch (e) {
      if (generation === actionGeneration.current) {
        setMessage(e instanceof Error ? e.message : 'The post-deploy action could not be started.');
      }
    } finally {
      if (generation === actionGeneration.current) {
        actionInFlight.current = false;
        setRunning(null);
      }
    }
  };

  const handlePartnerPreview = async () => {
    if (
      actionInFlight.current
      || !targetOrgId
      || partnerMode !== 'excel'
      || !excelFile
    ) return;
    const generation = ++actionGeneration.current;
    actionInFlight.current = true;
    setRunning('preview');
    setMessage(null);
    try {
      const base64 = await fileToBase64(excelFile);
      const res = await api<{ partners: number; employees: number }>('/data/account-partners/preview', {
        method: 'POST',
        body: JSON.stringify({
          bottler,
          targetOrgId,
          perOffice: 30,
          matchOrgDistribution: true,
          excelBase64: base64,
        }),
      });
      if (generation === actionGeneration.current) {
        setMessage(`Preview: ${res.partners} partners, ${res.employees} employees`);
      }
    } catch (e) {
      if (generation === actionGeneration.current) {
        setMessage(e instanceof Error ? e.message : 'Preview failed');
      }
    } finally {
      if (generation === actionGeneration.current) {
        actionInFlight.current = false;
        setRunning(null);
      }
    }
  };

  const specificBottlerRequired =
    bottler === 'all'
    && (partnerMode === 'excel' || partnerMode === 'org_to_org_matched');
  const hasConfiguredExcel = Boolean(config?.partnerImport?.excelPath);
  const hasAvailableActions = canProvisionUsers || canLoadData || canLoadPartners;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/50 p-4">
      <div>
        <h3 className="text-sm font-semibold">Post-deploy actions</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Auto pipeline finished. Configure and run user provisioning, data seed, and partner import.
        </p>
      </div>

      {!hasAvailableActions && (
        <p className="text-xs text-muted-foreground">
          No remaining manual post-deploy actions are configured. Refresh the run to continue.
        </p>
      )}

      {canProvisionUsers && <section className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User metadata</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void loadDiscover()}
          loading={loadingDiscover}
          disabled={running !== null}
        >
          Refresh picklists
        </Button>
        {discover && (
          <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
            {discover.picklists.map((p) => (
              <li key={p.name}>
                <span className="font-mono">{p.name}</span>: {p.values.length} values
              </li>
            ))}
          </ul>
        )}
        <Button
          size="sm"
          onClick={() => void runActions('provision_users')}
          loading={running === 'provision_users'}
          disabled={!targetOrgId || running !== null}
        >
          Run user provisioning
        </Button>
      </section>}

      {canLoadData && <section className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data seed</h4>
        <div className="flex flex-wrap gap-2">
          {DATASET_OPTIONS.map((d) => (
            <label key={d} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={datasets.includes(d)}
                onChange={(e) => {
                  setDatasets((prev) =>
                    e.target.checked ? [...new Set([...prev, d])] : prev.filter((x) => x !== d),
                  );
                }}
              />
              {d}
            </label>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => void runActions(
            'load_data_seed',
            () => Promise.resolve({ datasets }),
          )}
          loading={running === 'load_data_seed'}
          disabled={!sourceOrgId || datasets.length === 0 || running !== null}
        >
          Run data seed
        </Button>
      </section>}

      {canLoadPartners && <section className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account partners</h4>
        <div className="flex gap-2">
          <label htmlFor={id('partner-mode')} className="sr-only">Partner import mode</label>
          <select
            id={id('partner-mode')}
            className="text-xs border rounded px-2 py-1 bg-background"
            value={partnerMode}
            onChange={(e) => setPartnerMode(e.target.value as PartnerMode)}
            disabled={running !== null}
          >
            <option value="excel">Excel upload</option>
            <option value="org_to_org">Org-to-org transfer</option>
            <option value="org_to_org_matched">Org-to-org matched distribution</option>
          </select>
          <label htmlFor={id('partner-bottler')} className="sr-only">Partner bottler</label>
          <select
            id={id('partner-bottler')}
            className="text-xs border rounded px-2 py-1 bg-background"
            value={bottler}
            onChange={(e) => setBottler(e.target.value as typeof bottler)}
            disabled={running !== null}
          >
            <option value="5000">5000 NE</option>
            <option value="4900">4900 Abarta</option>
            <option value="4600">4600 Reyes</option>
            <option value="all">All bottlers</option>
          </select>
        </div>
        {specificBottlerRequired && (
          <p className="text-xs text-amber-500">
            Select a specific bottler for Excel or matched-distribution imports.
          </p>
        )}
        {partnerMode === 'excel' && (
          <>
            <label htmlFor={id('partner-file')} className="sr-only">Partner spreadsheet</label>
            <input
              id={id('partner-file')}
              type="file"
              accept=".xlsx,.xls"
              className="text-xs"
              onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
              disabled={running !== null}
            />
            {hasConfiguredExcel && !excelFile && (
              <p className="text-xs text-muted-foreground">
                The template’s configured spreadsheet will be used.
              </p>
            )}
          </>
        )}
        <div className="flex gap-2">
          {partnerMode === 'excel' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handlePartnerPreview()}
              loading={running === 'preview'}
              disabled={!excelFile || running !== null}
            >
              Preview
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => void runActions(
              'load_account_partners',
              async () => {
                if (partnerMode === 'excel' && excelFile) {
                  const base64 = await fileToBase64(excelFile);
                  return {
                    partnerMode,
                    partnerBottler: bottler,
                    partnerExcelBase64: base64,
                  };
                }
                return {
                  partnerMode,
                  partnerBottler: bottler,
                };
              },
            )}
            loading={running === 'load_account_partners'}
            disabled={
              running !== null
              || specificBottlerRequired
              || (partnerMode === 'excel' && !excelFile && !hasConfiguredExcel)
              || (partnerMode === 'org_to_org' && !sourceOrgId)
              || (partnerMode === 'org_to_org_matched' && !sourceOrgId)
            }
          >
            Run partner import
          </Button>
        </div>
      </section>}

      {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
