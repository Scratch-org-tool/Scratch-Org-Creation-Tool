'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Link2,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import type { Repository } from '@sfcc/shared';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { activateTabFromKey } from '@/components/ui/tab-keyboard';
import { ConfirmDialog, FormSection, GlassCard, InlineAlert } from '@/components/studio';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';
import type {
  ProjectBinding,
  PublicIntegrationConnection,
  ScmProvider,
} from './types';
import {
  type ConnectionAction,
  type ConnectionKind,
  type ProviderIntegrationsState,
} from './use-provider-integrations';

const SCM_PROVIDERS: Array<{
  id: ScmProvider;
  name: string;
  description: string;
  authentication: string;
}> = [
  {
    id: 'azure_devops',
    name: 'Azure DevOps',
    description: 'Azure Repos and Azure Boards',
    authentication: 'Personal Access Token',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub repositories and Issues',
    authentication: 'GitHub App installation',
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket Cloud',
    description: 'Bitbucket repositories and Jira bindings',
    authentication: 'OAuth 2.0 or scoped API token',
  },
];

const PROVIDER_NAMES: Record<string, string> = {
  azure_devops: 'Azure DevOps',
  azure_boards: 'Azure Boards',
  github: 'GitHub',
  github_issues: 'GitHub Issues',
  bitbucket: 'Bitbucket Cloud',
  jira: 'Jira Cloud',
};

interface PendingConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  run: () => void | Promise<void>;
}

function ConnectionSummary({
  provider,
  connection,
  authentication,
  state,
  kind,
}: {
  provider: string;
  connection?: PublicIntegrationConnection;
  authentication: string;
  state: ProviderIntegrationsState;
  kind: ConnectionKind;
}) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  if (!connection) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
        No connection configured. Administrators can add one below.
      </div>
    );
  }

  const action: ConnectionAction = { kind, provider: provider as never, connection };
  const statusClass =
    connection.status === 'connected'
      ? 'text-emerald-400'
      : connection.status === 'degraded'
        ? 'text-amber-400'
        : 'text-destructive';

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-muted/15 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">{connection.displayName}</p>
            <p className={cn('text-xs mt-1 capitalize', statusClass)}>
              {connection.status.replace(/_/g, ' ')}
            </p>
          </div>
          {state.isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={state.mutating}
                onClick={() =>
                  setPending({
                    title: `Verify ${connection.displayName}?`,
                    message: 'The provider will be contacted using the stored credential. No secret will be displayed.',
                    confirmLabel: 'Verify connection',
                    run: () => state.verify(action),
                  })
                }
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Verify
              </Button>
              {connection.source !== 'environment' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={state.mutating}
                  onClick={() =>
                    setPending({
                      title: `Disconnect ${connection.displayName}?`,
                      message: 'Deployments and work-item sync using this connection will stop. Existing history is retained.',
                      confirmLabel: 'Disconnect',
                      destructive: true,
                      run: () => state.disconnect(action),
                    })
                  }
                >
                  <Unplug className="w-3.5 h-3.5 mr-1.5" />
                  Disconnect
                </Button>
              )}
            </div>
          )}
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <SummaryRow label="Account" value={connection.namespace || connection.externalAccountId || connection.displayName} />
          <SummaryRow label="Source" value={connection.source ?? 'database'} />
          <SummaryRow label="Authentication" value={authentication} />
          <SummaryRow label="Last verified" value={formatDate(connection.lastVerifiedAt)} />
        </dl>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Capabilities</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(connection.capabilities ?? {})
              .filter(([, enabled]) => enabled)
              .map(([capability]) => (
                <span
                  key={capability}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                >
                  {capability.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </span>
              ))}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        confirmLabel={pending?.confirmLabel}
        destructive={pending?.destructive ?? false}
        loading={state.mutating}
        onConfirm={() => {
          const run = pending?.run;
          setPending(null);
          void run?.();
        }}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      />
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/30 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right break-all">{value}</dd>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ConnectionForm({
  provider,
  existing,
  state,
  kind = 'scm',
}: {
  provider: ScmProvider | 'jira';
  existing?: PublicIntegrationConnection;
  state: ProviderIntegrationsState;
  kind?: ConnectionKind;
}) {
  const [form, setForm] = useState<Record<string, string>>({ authType: 'api_token' });
  const [pendingRotation, setPendingRotation] = useState(false);
  const [selectedJiraSite, setSelectedJiraSite] = useState('');

  const submit = async () => {
    if (provider === 'github' || (
      (provider === 'bitbucket' || provider === 'jira') && form.authType === 'oauth2'
    )) {
      await state.startOAuth(provider);
      return;
    }
    const payload: Record<string, unknown> =
      provider === 'azure_devops'
        ? { orgSlug: form.orgSlug, project: form.project || undefined, pat: form.pat }
        : {
              authType: form.authType,
              email: form.email,
              apiToken: form.apiToken,
              ...(provider === 'bitbucket'
                ? { workspace: form.workspace || undefined }
                : { siteUrl: form.siteUrl }),
            };
    await state.connect(kind, provider === 'jira' ? 'jira' : provider, payload);
    setForm({ authType: 'api_token' });
  };

  const valid =
    provider === 'azure_devops'
      ? Boolean(form.orgSlug?.trim() && form.pat?.trim())
      : provider === 'github'
        ? true
        : form.authType === 'oauth2'
          ? true
          : Boolean(form.email?.trim() && form.apiToken?.trim() && (provider !== 'jira' || form.siteUrl?.trim()));

  return (
    <>
      <FormSection
        title={existing ? 'Rotate credentials' : 'Connection details'}
      >
        <p className="text-xs text-muted-foreground mb-4">
          <ScopeHelp provider={provider} authType={form.authType} />
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {provider === 'azure_devops' && (
            <>
              <Field label="Organization slug" id="provider-azure-org" value={form.orgSlug} setValue={(orgSlug) => setForm({ ...form, orgSlug })} placeholder="my-organization" />
              <Field label="Default project (optional)" id="provider-azure-project" value={form.project} setValue={(project) => setForm({ ...form, project })} />
              <Field label="Personal Access Token" id="provider-azure-token" type="password" value={form.pat} setValue={(pat) => setForm({ ...form, pat })} className="sm:col-span-2" />
            </>
          )}
          {provider === 'github' && (
            <InlineAlert variant="info">
              The GitHub App id, slug, private key, and GitHub Enterprise URL are configured on the server. The private key is never sent to this browser.
            </InlineAlert>
          )}
          {(provider === 'bitbucket' || provider === 'jira') && (
            <>
              <div className="sm:col-span-2">
                <Label htmlFor={`provider-${provider}-auth`}>Authentication</Label>
                <Select
                  id={`provider-${provider}-auth`}
                  value={form.authType}
                  onChange={(event) => setForm({ ...form, authType: event.target.value })}
                >
                  <option value="api_token">Atlassian scoped API token</option>
                  <option value="oauth2">OAuth 2.0 in provider</option>
                </Select>
              </div>
              {form.authType === 'oauth2' ? (
                <InlineAlert variant="info">
                  Continue to {PROVIDER_NAMES[provider]} to authorize. Access and refresh tokens are exchanged and encrypted by the server.
                </InlineAlert>
              ) : (
                <>
                  <Field label="Atlassian account email" id={`provider-${provider}-email`} type="email" value={form.email} setValue={(email) => setForm({ ...form, email })} />
                  <Field label="Scoped API token" id={`provider-${provider}-token`} type="password" value={form.apiToken} setValue={(apiToken) => setForm({ ...form, apiToken })} />
                </>
              )}
              {provider === 'bitbucket' ? (
                <Field label="Workspace (optional)" id="provider-bitbucket-workspace" value={form.workspace} setValue={(workspace) => setForm({ ...form, workspace })} />
              ) : (
                <Field label="Jira Cloud site URL" id="provider-jira-site" value={form.siteUrl} setValue={(siteUrl) => setForm({ ...form, siteUrl })} placeholder="https://company.atlassian.net" className="sm:col-span-2" />
              )}
            </>
          )}
        </div>
      </FormSection>
      {provider === 'jira' && state.jiraSelectionState && state.jiraSites.length > 0 && (
        <div className="mb-4 rounded-lg border border-border/60 p-4">
          <Label htmlFor="provider-jira-site-selection">Authorized Jira Cloud site</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Select
              id="provider-jira-site-selection"
              value={selectedJiraSite}
              onChange={(event) => setSelectedJiraSite(event.target.value)}
            >
              <option value="">Select a site…</option>
              {state.jiraSites.map((site) => (
                <option key={site.id} value={site.id}>{site.name} · {site.url}</option>
              ))}
            </Select>
            <Button
              disabled={!selectedJiraSite || state.mutating}
              onClick={() => void state.selectJiraSite(selectedJiraSite)}
            >
              Connect selected site
            </Button>
          </div>
        </div>
      )}
      <Button
        disabled={!valid || state.mutating}
        loading={state.mutating}
        onClick={() => existing ? setPendingRotation(true) : void submit()}
      >
        {provider === 'github'
          ? existing ? 'Reinstall GitHub App' : 'Install GitHub App'
          : form.authType === 'oauth2'
            ? `Continue to ${PROVIDER_NAMES[provider]}`
            : existing ? 'Rotate credentials' : 'Connect and verify'}
      </Button>
      <ConfirmDialog
        open={pendingRotation}
        title={`Rotate ${PROVIDER_NAMES[provider]} credentials?`}
        message="The new credential will be verified before replacing the stored credential. Active workflows may briefly retry."
        confirmLabel="Verify and rotate"
        destructive={false}
        loading={state.mutating}
        onConfirm={() => {
          setPendingRotation(false);
          void submit();
        }}
        onOpenChange={setPendingRotation}
      />
    </>
  );
}

function ScopeHelp({ provider, authType }: { provider: ScmProvider | 'jira'; authType?: string }) {
  if (provider === 'azure_devops') {
    return <>Required PAT scopes: Code (Read), Project and Team (Read); add Work Items (Read &amp; write) when using Azure Boards.</>;
  }
  if (provider === 'github') {
    return <>Install the server-configured GitHub App with Metadata and Contents read access, Issues read/write, and webhook access.</>;
  }
  if (provider === 'bitbucket') {
    return authType === 'oauth2'
      ? <>OAuth scopes: repository, pullrequest, and webhook as needed.</>
      : <>Use an Atlassian scoped API token with read:workspace:bitbucket and read:repository:bitbucket. Bitbucket app passwords are not supported.</>;
  }
  return authType === 'oauth2'
    ? <>OAuth scopes: read:jira-work, write:jira-work, read:jira-user, and offline_access.</>
    : <>Use an Atlassian API token for an account that can browse and update the Jira projects you bind.</>;
}

function Field({
  label,
  id,
  value,
  setValue,
  type,
  placeholder,
  className,
}: {
  label: string;
  id: string;
  value?: string;
  setValue: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value ?? ''} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} autoComplete={type === 'password' ? 'new-password' : undefined} />
    </div>
  );
}

function BindingsManager({
  state,
  workItemConnection,
  workManagement = false,
}: {
  state: ProviderIntegrationsState;
  workItemConnection?: PublicIntegrationConnection;
  workManagement?: boolean;
}) {
  const [connectionId, setConnectionId] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [project, setProject] = useState('');
  const [repositoryId, setRepositoryId] = useState('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const availableScm = workManagement
    ? state.activeScm.filter((connection) => connection.provider === 'bitbucket')
    : state.activeScm;
  const selected = availableScm.find((connection) => connection.id === connectionId);

  useEffect(() => {
    setRepositories([]);
    setRepositoryId('');
    if (!selected) return;
    const params = new URLSearchParams({ connectionId: selected.id });
    if (workspace.trim()) params.set('namespace', workspace.trim());
    if (project.trim()) params.set('project', project.trim());
    api<Repository[]>(`/integrations/scm/${selected.provider}/repositories?${params}`)
      .then(setRepositories)
      .catch(() => setRepositories([]));
  }, [selected, workspace, project]);

  const save = () => {
    const repo = repositories.find((item) => item.id === repositoryId);
    if ((!selected && !workItemConnection) || !project.trim()) return;
    void state.saveBinding({
      scmConnectionId: selected?.id,
      workItemConnectionId: workItemConnection?.id,
      externalProjectId: project.trim(),
      projectKey: project.trim(),
      repositoryId: repositoryId || undefined,
      repositoryName: repo?.name,
      workspace: workspace.trim() || selected?.namespace || undefined,
    }).then(() => {
      setProject('');
      setRepositoryId('');
    });
  };

  return (
    <GlassCard
      title="Workspace, project, and repository bindings"
      description="Bind app contexts to provider identifiers so workflows resolve the intended repository."
    >
      {state.optimisticAnnouncement && (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {state.optimisticAnnouncement}
        </p>
      )}
      {!state.isAdmin ? (
        <p className="text-sm text-muted-foreground">Bindings are managed by administrators.</p>
      ) : workManagement && !workItemConnection ? (
        <InlineAlert variant="info">Connect Jira Cloud before creating a work-management binding.</InlineAlert>
      ) : !workItemConnection && availableScm.length === 0 ? (
        <InlineAlert variant="info">Connect a source-control provider before creating a binding.</InlineAlert>
      ) : workItemConnection &&
        workItemConnection.status !== 'connected' &&
        workItemConnection.status !== 'degraded' ? (
        <InlineAlert variant="info">Connect Jira Cloud before creating a work-management binding.</InlineAlert>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="binding-connection">Connection</Label>
              <Select id="binding-connection" value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
                <option value="">
                  {workItemConnection ? 'Jira project only' : 'Select connection…'}
                </option>
                {availableScm.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {PROVIDER_NAMES[connection.provider]} · {connection.displayName}
                  </option>
                ))}
              </Select>
            </div>
            <Field label="Workspace / namespace" id="binding-workspace" value={workspace} setValue={setWorkspace} placeholder={selected?.namespace ?? ''} />
            <Field label="Project / app context" id="binding-project" value={project} setValue={setProject} />
            <div>
              <Label htmlFor="binding-repository">Repository (optional)</Label>
              <Select id="binding-repository" value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)} disabled={!selected}>
                <option value="">All repositories</option>
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>{repository.fullName}</option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            onClick={save}
            disabled={
              (!selected && !workItemConnection)
              || !project.trim()
              || state.mutating
              || state.bindingCollectionBusy
            }
          >
            <Link2 className="w-4 h-4 mr-2" />
            Save binding
          </Button>
          <BindingsList bindings={state.bindings} state={state} />
        </div>
      )}
    </GlassCard>
  );
}

function BindingsList({ bindings, state }: { bindings: ProjectBinding[]; state: ProviderIntegrationsState }) {
  const [pendingDelete, setPendingDelete] = useState<ProjectBinding | null>(null);
  if (!bindings.length) return <p className="text-sm text-muted-foreground">No bindings configured.</p>;
  return (
    <>
      <ul className="divide-y divide-border/50 rounded-lg border border-border/60" aria-label="Configured provider bindings">
        {bindings.map((binding) => (
          <li key={binding.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {binding.externalProjectId}
                {binding.repositoryName ? ` / ${binding.repositoryName}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {binding.scmConnection
                  ? `${PROVIDER_NAMES[binding.scmConnection.provider]} · ${binding.scmConnection.displayName}`
                  : `${PROVIDER_NAMES[binding.workItemConnection?.provider ?? 'jira']} · ${binding.workItemConnection?.displayName ?? 'Work management'}`}
              </p>
              {state.bindingErrors[binding.id] && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {state.bindingErrors[binding.id]} The binding was restored.
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              loading={Boolean(state.bindingBusyIds[binding.id])}
              onClick={() => setPendingDelete(binding)}
              disabled={state.mutating || state.bindingCollectionBusy}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Remove ${pendingDelete?.externalProjectId ?? 'binding'}?`}
        message="Deployments and work-item routing will no longer resolve through this binding."
        confirmLabel="Remove binding"
        destructive
        onConfirm={() => {
          const id = pendingDelete?.id;
          setPendingDelete(null);
          if (id) void state.deleteBinding(id);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      />
    </>
  );
}

export function SourceControlIntegrationPanel({
  initialProvider,
  state,
}: {
  initialProvider?: ScmProvider;
  state: ProviderIntegrationsState;
}) {
  const [provider, setProvider] = useState<ScmProvider>(initialProvider ?? 'azure_devops');
  const definition = SCM_PROVIDERS.find((item) => item.id === provider)!;
  const connection = state.connections.scm.find((item) => item.provider === provider);

  if (state.loading) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted/30" aria-label="Loading source-control integrations" />;
  }

  return (
    <div className="space-y-6">
      {state.error && <InlineAlert variant="error" onDismiss={() => state.setError(null)}>{state.error}</InlineAlert>}
      {state.notice && <InlineAlert variant="success" onDismiss={() => state.setNotice(null)}>{state.notice}</InlineAlert>}
      {!state.isAdmin && (
        <InlineAlert variant="info" title="View-only access">
          Connection details and capabilities are visible, but only administrators can connect, rotate, verify, disconnect, or bind providers.
        </InlineAlert>
      )}
      <div className="grid md:grid-cols-3 gap-3" role="tablist" aria-label="Source-control providers">
        {SCM_PROVIDERS.map((item) => {
          const current = state.connections.scm.find((candidate) => candidate.provider === item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`source-provider-tab-${item.id}`}
              aria-controls={`source-provider-panel-${item.id}`}
              aria-selected={provider === item.id}
              tabIndex={provider === item.id ? 0 : -1}
              onClick={() => setProvider(item.id)}
              onKeyDown={activateTabFromKey}
              className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                provider === item.id ? 'border-primary/50 bg-primary/8' : 'border-border/60 hover:border-primary/25',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                {current?.status === 'connected' && <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-label="Connected" />}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">{item.description}</span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`source-provider-panel-${provider}`}
        aria-labelledby={`source-provider-tab-${provider}`}
        tabIndex={0}
      >
        <GlassCard title={definition.name} description={definition.description}>
          <div className="space-y-5">
            <ConnectionSummary provider={provider} connection={connection} authentication={definition.authentication} state={state} kind="scm" />
            {state.isAdmin && connection?.source !== 'environment' && (
              <ConnectionForm provider={provider} existing={connection} state={state} />
            )}
            {connection?.source === 'environment' && (
              <p className="text-xs text-muted-foreground">
                This credential is managed in the server environment and cannot be rotated or removed here.
              </p>
            )}
          </div>
        </GlassCard>
      </div>
      <BindingsManager state={state} />
    </div>
  );
}

export function WorkManagementIntegrationPanel({
  state,
}: {
  state: ProviderIntegrationsState;
}) {
  const jira = state.connections.workItems.find((item) => item.provider === 'jira');
  const linkedProviders = useMemo(
    () => state.connections.workItems.filter((item) => item.provider !== 'jira'),
    [state.connections.workItems],
  );

  if (state.loading) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted/30" aria-label="Loading work-management integrations" />;
  }

  return (
    <div className="space-y-6">
      {state.error && <InlineAlert variant="error" onDismiss={() => state.setError(null)}>{state.error}</InlineAlert>}
      {state.notice && <InlineAlert variant="success" onDismiss={() => state.setNotice(null)}>{state.notice}</InlineAlert>}
      <GlassCard title="Jira Cloud" description="Connect Jira work management and bind projects to Bitbucket repositories.">
        <div className="space-y-5">
          <ConnectionSummary provider="jira" connection={jira} authentication="OAuth 2.0 or scoped API token" state={state} kind="work-items" />
          {state.isAdmin && <ConnectionForm provider="jira" existing={jira} state={state} kind="work-items" />}
        </div>
      </GlassCard>
      <GlassCard title="Provider work management" description="Azure Boards and GitHub Issues follow their paired source-control account.">
        {linkedProviders.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {linkedProviders.map((connection) => (
              <div key={connection.id} className="rounded-lg border border-border/60 p-4">
                <p className="font-medium">{PROVIDER_NAMES[connection.provider]}</p>
                <p className="text-xs text-muted-foreground mt-1">{connection.displayName} · {connection.status}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {Object.entries(connection.capabilities ?? {}).filter(([, value]) => value).map(([name]) => (
                    <span key={name} className="text-[11px] rounded-full bg-muted px-2 py-0.5">{name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No paired work-management connections are active.</p>
        )}
      </GlassCard>
      <BindingsManager state={state} workItemConnection={jira} workManagement />
    </div>
  );
}
