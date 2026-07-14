'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import type { AutomationRunView } from '@/components/scratch-org/types';

interface PostDeployPanelProps {
  run: AutomationRunView | null;
  automationRunId: string | null;
  sourceOrgId?: string;
  onRefresh?: () => void;
}

type DiscoverResponse = {
  picklists: Array<{ name: string; values: string[] }>;
};

const DATASET_OPTIONS = ['OnboardingConfig', 'Products', 'VisitPlans', 'Accounts'] as const;

export function PostDeployPanel({ run, automationRunId, sourceOrgId: sourceOrgIdProp, onRefresh }: PostDeployPanelProps) {
  const awaiting = run?.status === 'completed' && (run.checkpoint as { awaitingUserActions?: boolean })?.awaitingUserActions;
  const targetOrgId = (run?.checkpoint as { targetOrgConnectionId?: string })?.targetOrgConnectionId;
  const configSourceOrgId = (run as { config?: { sourceOrgId?: string } } | null)?.config?.sourceOrgId;
  const sourceOrgId = sourceOrgIdProp ?? configSourceOrgId;

  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [partnerMode, setPartnerMode] = useState<'excel' | 'org_to_org'>('excel');
  const [bottler, setBottler] = useState<'5000' | '4900' | '4600'>('5000');
  const [datasets, setDatasets] = useState<string[]>([...DATASET_OPTIONS]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadDiscover = useCallback(async () => {
    if (!targetOrgId) return;
    setLoadingDiscover(true);
    try {
      const res = await api<DiscoverResponse>(`/provisioning/orgs/${targetOrgId}/discover`);
      setDiscover(res);
    } finally {
      setLoadingDiscover(false);
    }
  }, [targetOrgId]);

  useEffect(() => {
    if (awaiting && targetOrgId) void loadDiscover();
  }, [awaiting, targetOrgId, loadDiscover]);

  if (!awaiting || !automationRunId) return null;

  const runActions = async (actions: string[], opts?: { partnerExcelBase64?: string }) => {
    setRunning(actions.join(','));
    setMessage(null);
    try {
      const res = await api<{ jobs: Array<{ action: string; jobId: string }> }>(
        `/environment/automation-runs/${automationRunId}/run`,
        {
          method: 'POST',
          body: JSON.stringify({
            actions,
            partnerExcelBase64: opts?.partnerExcelBase64,
          }),
        },
      );
      setMessage(`Started: ${res.jobs.map((j) => j.action).join(', ')}`);
      onRefresh?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(null);
    }
  };

  const handlePartnerPreview = async () => {
    if (!targetOrgId || partnerMode !== 'excel' || !excelFile) return;
    setRunning('preview');
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
      setMessage(`Preview: ${res.partners} partners, ${res.employees} employees`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/50 p-4">
      <div>
        <h3 className="text-sm font-semibold">Post-deploy actions</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Auto pipeline finished. Configure and run user provisioning, data seed, and partner import.
        </p>
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User metadata</h4>
        <Button size="sm" variant="outline" onClick={() => void loadDiscover()} loading={loadingDiscover}>
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
          onClick={() => void runActions(['provision_users'])}
          loading={running === 'provision_users'}
          disabled={!targetOrgId}
        >
          Run user provisioning
        </Button>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data seed</h4>
        <div className="flex flex-wrap gap-2">
          {DATASET_OPTIONS.map((d) => (
            <label key={d} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={datasets.includes(d)}
                onChange={(e) => {
                  setDatasets((prev) =>
                    e.target.checked ? [...prev, d] : prev.filter((x) => x !== d),
                  );
                }}
              />
              {d}
            </label>
          ))}
        </div>
        {!sourceOrgId && (
          <p className="text-xs text-amber-600">Set sourceOrgId in pipeline config for data seed.</p>
        )}
        <Button
          size="sm"
          onClick={() => void runActions(['load_data_seed'])}
          loading={running === 'load_data_seed'}
          disabled={!sourceOrgId}
        >
          Run data seed
        </Button>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account partners</h4>
        <div className="flex gap-2">
          <select
            className="text-xs border rounded px-2 py-1 bg-background"
            value={partnerMode}
            onChange={(e) => setPartnerMode(e.target.value as 'excel' | 'org_to_org')}
          >
            <option value="excel">Excel upload</option>
            <option value="org_to_org">Org-to-org transfer</option>
          </select>
          <select
            className="text-xs border rounded px-2 py-1 bg-background"
            value={bottler}
            onChange={(e) => setBottler(e.target.value as typeof bottler)}
          >
            <option value="5000">5000 NE</option>
            <option value="4900">4900 Abarta</option>
            <option value="4600">4600 Reyes</option>
          </select>
        </div>
        {partnerMode === 'excel' && (
          <input
            type="file"
            accept=".xlsx,.xls"
            className="text-xs"
            onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
          />
        )}
        <div className="flex gap-2">
          {partnerMode === 'excel' && (
            <Button size="sm" variant="outline" onClick={() => void handlePartnerPreview()} disabled={!excelFile}>
              Preview
            </Button>
          )}
          <Button
            size="sm"
            onClick={async () => {
              if (partnerMode === 'excel' && excelFile) {
                const base64 = await fileToBase64(excelFile);
                await runActions(['load_account_partners'], { partnerExcelBase64: base64 });
              } else {
                await runActions(['load_account_partners']);
              }
            }}
            loading={running === 'load_account_partners'}
          >
            Run partner import
          </Button>
        </div>
      </section>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
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
