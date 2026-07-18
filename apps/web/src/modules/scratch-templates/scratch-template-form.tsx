'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { FormSection, GlassCard, InlineAlert, PageSkeleton } from '@/components/studio';
import { api } from '@/services/api';
import { fetchOrgsList } from '@/hooks/use-orgs';
import {
  DEFAULT_AZURE_MANIFEST_PATH,
  migrateTemplateConfigToV2,
  querySectionSchema,
  SYSTEM_SCRATCH_TEMPLATE_KEYS,
} from '@sfcc/shared';
import { DataSeedSection } from './components/data-seed-section';
import { fileToBase64 } from './components/file-dropzone';
import { OrgConfigSection } from './components/org-config-section';
import {
  formatPermissionSets,
  parsePermissionSets,
  PermissionSetsEditor,
} from './components/permission-sets-editor';
import { PartnerImportSection } from './components/partner-import-section';
import { PipelineStepsSection } from './components/pipeline-steps-section';
import { SfdmuExportEditor } from './components/sfdmu-export-editor';
import { SourceOrgsSection } from './components/source-orgs-section';
import { TemplateReview } from './components/template-review';
import { TemplateFormTips } from './components/template-form-tips';
import { TemplateStepIndicator } from './components/template-step-indicator';
import { TemplateStepSidebar } from './components/template-step-sidebar';
import { TemplateFormPageHeader } from './template-form-page-header';
import { QuerySectionEditor } from './components/query-section-editor';
import { UserProvisioningV2Section } from './components/user-provisioning-v2-section';
import type { ScmProvider } from '@sfcc/shared';
import type { PublicIntegrationConnection } from '@/modules/environment-center/integrations/types';
import { SCM_PROVIDER_LABELS } from '@/modules/source-control/provider-config';
import {
  DEFAULT_TEMPLATE_CONFIG,
  getTemplateWizardSteps,
  type TemplateConfigState,
} from './types';
import { hasValidCustomJson, setCustomSettingsEnabled } from './template-form-utils';

const DRAFT_KEY = 'scratch-template-draft';

interface Org {
  id: string;
  alias: string;
}

function withCanonicalGitSource(config: TemplateConfigState): TemplateConfigState {
  if (config.gitSource) return config;
  if (!config.azureDeploy) return config;
  return {
    ...config,
    gitSource: {
      provider: 'azure_devops',
      manifestPath: config.azureDeploy.manifestPath,
    },
  };
}

function migrateForEditor(config: TemplateConfigState): TemplateConfigState {
  const migrated = migrateTemplateConfigToV2(config);
  return withCanonicalGitSource({
    ...migrated,
    version: 2,
    template: migrated.template ?? DEFAULT_TEMPLATE_CONFIG.template,
    duration: migrated.duration ?? DEFAULT_TEMPLATE_CONFIG.duration,
    installPackage: migrated.installPackage ?? DEFAULT_TEMPLATE_CONFIG.installPackage,
    permissionSets: migrated.permissionSets ?? [],
    orgConfig: migrated.orgConfig ?? DEFAULT_TEMPLATE_CONFIG.orgConfig,
    customSettings: migrated.customSettings ?? DEFAULT_TEMPLATE_CONFIG.customSettings,
    pipelineSteps: migrated.pipelineSteps ?? DEFAULT_TEMPLATE_CONFIG.pipelineSteps,
  });
}

export function ScratchTemplateForm({
  templateId,
  onClose,
}: {
  templateId?: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<TemplateConfigState>(() => migrateForEditor(DEFAULT_TEMPLATE_CONFIG));
  const [permissionSetsText, setPermissionSetsText] = useState('');
  const [customJson, setCustomJson] = useState('');
  const [queryJsonFile, setQueryJsonFile] = useState<File | null>(null);
  const [partnerFile, setPartnerFile] = useState<File | null>(null);
  const [storedPartnerName, setStoredPartnerName] = useState<string | undefined>();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [scmConnections, setScmConnections] = useState<PublicIntegrationConnection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!templateId);
  const [isSystemTemplate, setIsSystemTemplate] = useState(false);
  const [systemKey, setSystemKey] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(!!templateId);
  const [userPlanState, setUserPlanState] = useState({ valid: false, checking: true });
  const handleUserPlanValidation = useCallback(
    (state: { valid: boolean; checking: boolean }) => setUserPlanState(state),
    [],
  );

  const orgAliases = useMemo(
    () => Object.fromEntries(orgs.map((o) => [o.id, o.alias])),
    [orgs],
  );

  const persistDraft = useCallback(() => {
    if (templateId || !draftHydrated) return;
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ name, description, config, permissionSetsText, customJson }),
      );
    } catch {
      /* ignore */
    }
  }, [templateId, draftHydrated, name, description, config, permissionSetsText, customJson]);

  const dataDeploymentOrgId = config.dataDeploymentOrgId ?? config.sourceOrgId;
  const hasConfiguredUsers = Boolean(
    config.userProvisioning?.users?.length
    || config.userProvisioning?.slots?.length
    || config.userProvisioning?.userGenerators?.length,
  );
  const userPlanReady =
    !hasConfiguredUsers || (userPlanState.valid && !userPlanState.checking);
  const wizardSteps = useMemo(() => getTemplateWizardSteps(systemKey), [systemKey]);
  const activeStep = wizardSteps[step] ?? wizardSteps[0]!;
  const isScratchSourcePreset =
    systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.SCRATCH_SOURCE_DEPLOYMENT;
  const isConfigPartnersPreset =
    systemKey === SYSTEM_SCRATCH_TEMPLATE_KEYS.CONFIG_SEED_ACCOUNT_PARTNERS;

  useEffect(() => {
    setStep((current) => Math.min(current, wizardSteps.length - 1));
  }, [wizardSteps.length]);

  useEffect(() => {
    void fetchOrgsList().then(setOrgs).catch(console.error);
    void api<{ scm: PublicIntegrationConnection[] }>('/integrations/admin/connections')
      .then(({ scm }) =>
        setScmConnections(
          scm.filter((connection) =>
            connection.status === 'connected' || connection.status === 'degraded'),
        ),
      )
      .catch(() => setScmConnections([]));

    if (templateId) {
      api<{
        name: string;
        description: string | null;
        isSystem: boolean;
        systemKey: string | null;
        config: TemplateConfigState;
      }>(`/environment/scratch-templates/${templateId}`)
        .then((t) => {
          setName(t.name);
          setDescription(t.description ?? '');
          setIsSystemTemplate(t.isSystem);
          setSystemKey(t.systemKey);
          try {
            setConfig(migrateForEditor(t.config));
          } catch (migrationError) {
            setConfig(withCanonicalGitSource({
              ...t.config,
              version: 2,
              template: t.config.template ?? DEFAULT_TEMPLATE_CONFIG.template,
              duration: t.config.duration ?? DEFAULT_TEMPLATE_CONFIG.duration,
              installPackage: t.config.installPackage ?? DEFAULT_TEMPLATE_CONFIG.installPackage,
              orgConfig: t.config.orgConfig ?? DEFAULT_TEMPLATE_CONFIG.orgConfig,
              customSettings: t.config.customSettings ?? DEFAULT_TEMPLATE_CONFIG.customSettings,
              pipelineSteps: t.config.pipelineSteps ?? DEFAULT_TEMPLATE_CONFIG.pipelineSteps,
            }));
            setError(migrationError instanceof Error ? migrationError.message : 'Legacy migration needs attention');
          }
          setPermissionSetsText(formatPermissionSets(t.config.permissionSets));
          const exportConfig = (t.config.customSettings as { exportConfig?: unknown } | undefined)
            ?.exportConfig;
          if (t.config.customSettings?.mode === 'custom' && exportConfig) {
            setCustomJson(JSON.stringify(exportConfig, null, 2));
          }
          if (t.config.partnerImport?.partnerExcelBase64) {
            setStoredPartnerName('partner-workbook.xlsx');
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as {
          name?: string;
          description?: string;
          config?: TemplateConfigState;
          permissionSetsText?: string;
          customJson?: string;
        };
        if (draft.name !== undefined) setName(draft.name);
        if (draft.description !== undefined) setDescription(draft.description);
        if (draft.config) {
          try {
            setConfig(migrateForEditor(draft.config));
          } catch {
            setConfig(withCanonicalGitSource({
              ...draft.config,
              version: 2,
              template: draft.config.template ?? DEFAULT_TEMPLATE_CONFIG.template,
              duration: draft.config.duration ?? DEFAULT_TEMPLATE_CONFIG.duration,
              installPackage: draft.config.installPackage ?? DEFAULT_TEMPLATE_CONFIG.installPackage,
              orgConfig: draft.config.orgConfig ?? DEFAULT_TEMPLATE_CONFIG.orgConfig,
              customSettings: draft.config.customSettings ?? DEFAULT_TEMPLATE_CONFIG.customSettings,
              pipelineSteps: draft.config.pipelineSteps ?? DEFAULT_TEMPLATE_CONFIG.pipelineSteps,
            }));
          }
        }
        if (draft.permissionSetsText !== undefined) setPermissionSetsText(draft.permissionSetsText);
        if (draft.customJson !== undefined) setCustomJson(draft.customJson);
      }
    } catch {
      /* ignore */
    }
    setDraftHydrated(true);
    setLoading(false);
  }, [templateId]);

  useEffect(() => {
    persistDraft();
  }, [persistDraft]);

  useEffect(() => {
    if (!scmConnections.length) return;
    const current = scmConnections.find((connection) =>
      connection.id === config.gitSource?.connectionId ||
      connection.provider === config.gitSource?.provider);
    const selected = current ?? scmConnections[0];
    if (!selected || (
      config.gitSource?.provider === selected.provider &&
      config.gitSource?.connectionId === selected.id
    )) return;
    setConfig((value) => ({
      ...value,
      gitSource: {
        ...value.gitSource,
        provider: selected.provider as ScmProvider,
        connectionId: selected.id,
        namespace: selected.namespace ?? undefined,
      },
    }));
  }, [scmConnections, config.gitSource?.connectionId, config.gitSource?.provider]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!hasValidCustomJson(config, customJson)) {
        throw new Error('Custom settings mode requires valid JSON before this V2 template can be saved.');
      }
      if (hasConfiguredUsers && !userPlanReady) {
        throw new Error('Resolve provisioning profile, mapping, permission-set, and metadata errors before saving.');
      }
      let exportConfig: unknown;
      if (config.customSettings?.enabled !== false && config.customSettings?.mode === 'custom') {
        if (!customJson.trim()) {
          throw new Error('Custom settings mode requires valid JSON before this V2 template can be saved.');
        }
        const validated = await api<{ normalized: unknown }>('/data/custom-settings/validate', {
          method: 'POST',
          body: JSON.stringify(JSON.parse(customJson)),
        });
        exportConfig = validated.normalized;
      }

      let partnerExcelBase64 = config.partnerImport?.partnerExcelBase64;
      if (partnerFile) {
        partnerExcelBase64 = await fileToBase64(partnerFile);
      }

      const body = {
        name,
        description: description || undefined,
        config: {
          version: 2,
          template: config.template,
          duration: config.duration,
          installPackage: config.installPackage,
          ...(config.gitSource
            ? {
                gitSource: {
                  provider: config.gitSource.provider,
                  connectionId: config.gitSource.connectionId,
                  namespace: config.gitSource.namespace,
                  project: config.gitSource.project,
                  manifestPath: config.gitSource.manifestPath,
                },
              }
            : {}),
          permissionSets: parsePermissionSets(permissionSetsText),
          orgConfig: config.orgConfig,
          customSettings: {
            enabled: config.customSettings?.enabled !== false,
            mode: config.customSettings?.enabled === false
              ? 'bundled'
              : (config.customSettings?.mode ?? 'bundled'),
            ...(exportConfig ? { exportConfig } : {}),
          },
          sourceOrgId: config.dataDeploymentOrgId || config.sourceOrgId || undefined,
          dataDeploymentOrgId: config.dataDeploymentOrgId || config.sourceOrgId || undefined,
          customSettingsOrgId: config.customSettings?.enabled === false
            ? undefined
            : (config.customSettingsOrgId || config.sourceOrgId || undefined),
          dataSeed: config.dataSeed
            ? {
                ...config.dataSeed,
                datasets: config.dataSeed.datasets ?? [],
                mode: config.dataSeed.mode ?? 'hybrid',
                querySet: config.dataSeed.querySet,
                querySection: config.dataSeed.querySection
                  ? querySectionSchema.parse(config.dataSeed.querySection)
                  : undefined,
              }
            : undefined,
          accountSeedRows: config.dataSeed ? config.accountSeedRows : undefined,
          partnerImport:
            config.partnerImport?.enabled
              ? {
                  ...config.partnerImport,
                  partnerExcelBase64,
                }
              : undefined,
          userProvisioning: config.userProvisioning,
          pipelineSteps: config.pipelineSteps,
        },
      };

      if (templateId) {
        await api(`/environment/scratch-templates/${templateId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await api('/environment/scratch-templates', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        sessionStorage.removeItem(DRAFT_KEY);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    activeStep.id === 'general'
      ? name.trim().length > 0
      : activeStep.id === 'custom-settings'
        ? hasValidCustomJson(config, customJson)
        : activeStep.id === 'query-section' && config.dataSeed?.querySection
          ? querySectionSchema.safeParse(config.dataSeed.querySection).success
          : activeStep.id === 'partners-users'
            ? userPlanReady
            : true;

  if (loading) {
    return <PageSkeleton variant="form" />;
  }

  const wideStep = ['data-seed', 'query-section', 'partners-users'].includes(activeStep.id);

  const stepFooter = (
    <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-border/60">
      {step > 0 && (
        <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
      )}
      {step < wizardSteps.length - 1 ? (
        <Button
          variant="outline"
          size="lg"
          className="ml-auto gap-2 rounded-lg border-violet-500/35 bg-violet-500/8 shadow-none hover:bg-violet-500/15 hover:border-violet-500/50"
          onClick={() => setStep((s) => s + 1)}
          disabled={!canNext}
        >
          Continue to {wizardSteps[step + 1]?.label}
          <ChevronRight className="w-4 h-4 text-violet-400" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="lg"
          className="ml-auto gap-2 rounded-lg border-violet-500/40 bg-violet-500/10 shadow-none hover:bg-violet-500/20 hover:border-violet-500/55"
          onClick={() => void save()}
          loading={saving}
          disabled={
            !name.trim()
            || !hasValidCustomJson(config, customJson)
            || !userPlanReady
          }
        >
          <Check className="w-4 h-4 text-violet-400" />
          {isSystemTemplate ? 'Save default template' : 'Save template'}
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-0">
      <TemplateFormPageHeader
        mode={templateId ? 'edit' : 'new'}
        isSystem={isSystemTemplate}
        systemKey={systemKey}
        activeStep={activeStep}
        stepNumber={step + 1}
        totalSteps={wizardSteps.length}
        onCancel={onClose}
      />

      <TemplateStepIndicator steps={wizardSteps} current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,220px)_minmax(0,1fr)] xl:grid-cols-[minmax(200px,220px)_minmax(0,1fr)_minmax(240px,280px)] gap-6 items-start">
        <aside className="hidden lg:block sticky top-6 self-start">
          <GlassCard title="Pipeline steps" contentClassName="p-2 pt-0">
            <TemplateStepSidebar steps={wizardSteps} current={step} onStepClick={setStep} />
          </GlassCard>
        </aside>

        <div className={wideStep ? 'min-w-0 w-full' : 'min-w-0 w-full max-w-3xl xl:max-w-none'}>
          <GlassCard
            title={activeStep.label}
            description={undefined}
            className="min-w-0"
          >
            <div className={wideStep ? undefined : 'max-w-2xl'}>
              {activeStep.id === 'general' && (
                <FormSection title="Details">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="scratch-template-name">Name</Label>
                      <Input
                        id="scratch-template-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="CONA Sprint Setup"
                      />
                    </div>
                    <div>
                      <Label htmlFor="scratch-template-description">Description</Label>
                      <Textarea
                        id="scratch-template-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Full CONA scratch pipeline with bundled custom settings…"
                        rows={4}
                      />
                    </div>
                  </div>
                </FormSection>
              )}

              {activeStep.id === 'scratch' && (
                <FormSection title="Scratch org defaults">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="scratch-template-definition">Scratch definition file</Label>
                        <Input
                          id="scratch-template-definition"
                          value={config.template ?? ''}
                          onChange={(e) => setConfig({ ...config, template: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="scratch-template-duration">Default duration (days)</Label>
                        <Input
                          id="scratch-template-duration"
                          type="number"
                          min={1}
                          max={30}
                          value={config.duration ?? 7}
                          onChange={(e) => setConfig({ ...config, duration: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={config.installPackage ?? true}
                        onChange={(e) => setConfig({ ...config, installPackage: e.target.checked })}
                      />
                      Pre-install Error Logger package
                    </label>
                    <div className="space-y-3 rounded-lg border border-border/60 p-4">
                      <div>
                        <h3 className="text-sm font-medium">Metadata Source</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Store a provider/account default. Repository and branch are selected per run.
                        </p>
                      </div>
                      {scmConnections.length === 0 ? (
                        <InlineAlert variant="warning">
                          No connected source-control provider is available. Connect one in Environment Center.
                        </InlineAlert>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="scratch-template-provider">Provider</Label>
                            <Select
                              id="scratch-template-provider"
                              value={config.gitSource?.provider ?? ''}
                              onChange={(event) => {
                                const provider = event.target.value as ScmProvider;
                                const connection = scmConnections.find((item) => item.provider === provider);
                                setConfig({
                                  ...config,
                                  gitSource: {
                                    ...config.gitSource,
                                    provider,
                                    connectionId: connection?.id,
                                    namespace: connection?.namespace ?? undefined,
                                  },
                                });
                              }}
                            >
                              {[...new Set(scmConnections.map((item) => item.provider as ScmProvider))].map((provider) => (
                                <option key={provider} value={provider}>{SCM_PROVIDER_LABELS[provider]}</option>
                              ))}
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="scratch-template-connection">Account / connection</Label>
                            <Select
                              id="scratch-template-connection"
                              value={config.gitSource?.connectionId ?? ''}
                              onChange={(event) => {
                                const connection = scmConnections.find((item) => item.id === event.target.value);
                                setConfig({
                                  ...config,
                                  gitSource: {
                                    ...config.gitSource,
                                    provider: (connection?.provider as ScmProvider | undefined) ?? config.gitSource?.provider,
                                    connectionId: event.target.value,
                                    namespace: connection?.namespace ?? undefined,
                                  },
                                });
                              }}
                            >
                              {scmConnections
                                .filter((item) => item.provider === config.gitSource?.provider)
                                .map((connection) => (
                                  <option key={connection.id} value={connection.id}>{connection.displayName}</option>
                                ))}
                            </Select>
                          </div>
                        </div>
                      )}
                      <div>
                        <Label htmlFor="scratch-template-manifest">Default manifest path</Label>
                        <Input
                          id="scratch-template-manifest"
                          value={
                            config.gitSource?.manifestPath ??
                            config.azureDeploy?.manifestPath ??
                            DEFAULT_AZURE_MANIFEST_PATH
                          }
                          onChange={(event) =>
                            setConfig({
                              ...config,
                              gitSource: {
                                ...config.gitSource,
                                provider: config.gitSource?.provider ?? 'azure_devops',
                                manifestPath: event.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </FormSection>
              )}

              {activeStep.id === 'source-orgs' && (
                <FormSection title={activeStep.label}>
                  <SourceOrgsSection
                    orgs={orgs}
                    dataDeploymentOrgId={config.dataDeploymentOrgId ?? config.sourceOrgId}
                    customSettingsOrgId={config.customSettingsOrgId ?? config.sourceOrgId}
                    showCustomSettings={!systemKey || isConfigPartnersPreset}
                    onChange={(patch) =>
                      setConfig({
                        ...config,
                        ...patch,
                        sourceOrgId: patch.dataDeploymentOrgId ?? config.sourceOrgId,
                      })
                    }
                  />
                </FormSection>
              )}

              {activeStep.id === 'custom-settings' && (
                <FormSection title="Custom settings (SFDMU)">
                  {config.customSettingsOrgId && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Export source:{' '}
                      {orgAliases[config.customSettingsOrgId] ?? config.customSettingsOrgId}
                    </p>
                  )}
                  <SfdmuExportEditor
                    enabled={config.customSettings?.enabled !== false}
                    mode={config.customSettings?.mode ?? 'bundled'}
                    json={customJson}
                    onEnabledChange={(enabled) => setConfig(setCustomSettingsEnabled(config, enabled))}
                    onModeChange={(mode) =>
                      setConfig({
                        ...config,
                        customSettings: {
                          enabled: config.customSettings?.enabled !== false,
                          mode,
                          exportConfig: config.customSettings?.exportConfig,
                        },
                      })
                    }
                    onJsonChange={setCustomJson}
                  />
                </FormSection>
              )}

              {activeStep.id === 'permissions' && (
                <FormSection title={activeStep.label}>
                  <div className="space-y-6">
                    {!isConfigPartnersPreset && (
                      <PermissionSetsEditor value={permissionSetsText} onChange={setPermissionSetsText} />
                    )}
                    {!isScratchSourcePreset && (
                      <OrgConfigSection
                        value={config.orgConfig ?? DEFAULT_TEMPLATE_CONFIG.orgConfig!}
                        onChange={(orgConfig) => setConfig({ ...config, orgConfig })}
                      />
                    )}
                  </div>
                </FormSection>
              )}

              {activeStep.id === 'data-seed' && (
                <FormSection title={activeStep.label}>
                  <div className="space-y-6">
                    <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(config.dataSeed)}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setConfig({
                              ...config,
                              dataSeed: DEFAULT_TEMPLATE_CONFIG.dataSeed,
                              accountSeedRows:
                                config.accountSeedRows ?? DEFAULT_TEMPLATE_CONFIG.accountSeedRows,
                            });
                            return;
                          }
                          setConfig({
                            ...config,
                            dataSeed: undefined,
                            accountSeedRows: undefined,
                            pipelineSteps: {
                              ...(config.pipelineSteps ?? DEFAULT_TEMPLATE_CONFIG.pipelineSteps!),
                              autoRunDataSeed: false,
                            },
                          });
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {isConfigPartnersPreset
                            ? 'Enable onboarding configuration seed'
                            : 'Enable data deployment'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isConfigPartnersPreset
                            ? 'Seed onboarding configuration before Account Partner mapping.'
                            : 'Add built-in datasets, uploaded query JSON, or ordered V2 queries to this template.'}
                        </p>
                      </div>
                    </label>
                    {config.dataSeed ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Data deployment org:{' '}
                          {dataDeploymentOrgId
                            ? orgAliases[dataDeploymentOrgId] ?? dataDeploymentOrgId
                            : 'selected when this template is launched'}
                        </p>
                        <DataSeedSection
                          mode={config.dataSeed.mode ?? 'hybrid'}
                          datasets={config.dataSeed.datasets ?? []}
                          accountRows={config.accountSeedRows ?? []}
                          querySet={config.dataSeed.querySet}
                          queryJsonFile={queryJsonFile}
                          onModeChange={(mode) =>
                            setConfig({
                              ...config,
                              dataSeed: {
                                ...config.dataSeed!,
                                datasets: config.dataSeed?.datasets ?? [],
                                mode,
                                querySet: config.dataSeed?.querySet,
                              },
                            })
                          }
                          onDatasetsChange={(datasets) =>
                            setConfig({
                              ...config,
                              dataSeed: {
                                ...config.dataSeed!,
                                datasets,
                                mode: config.dataSeed?.mode ?? 'hybrid',
                                querySet: config.dataSeed?.querySet,
                              },
                            })
                          }
                          onAccountRowsChange={(accountSeedRows) => setConfig({ ...config, accountSeedRows })}
                          onQuerySetChange={(querySet) =>
                            setConfig({
                              ...config,
                              dataSeed: {
                                ...config.dataSeed!,
                                datasets: config.dataSeed?.datasets ?? [],
                                mode: config.dataSeed?.mode ?? 'hybrid',
                                querySet,
                              },
                            })
                          }
                          onQueryJsonFileChange={setQueryJsonFile}
                        />
                      </>
                    ) : (
                      <InlineAlert>
                        This preset stops after source deployment. Enable data deployment to configure queries or seed datasets.
                      </InlineAlert>
                    )}
                  </div>
                </FormSection>
              )}

              {activeStep.id === 'query-section' && (
                <FormSection title="Named query section">
                  {config.dataSeed ? (
                    <QuerySectionEditor
                      value={config.dataSeed.querySection}
                      sourceOrgId={dataDeploymentOrgId}
                      salesOfficesByBottler={config.partnerImport?.salesOfficeConfig
                        ? {
                            [config.partnerImport.salesOfficeConfig.bottler]:
                              config.partnerImport.salesOfficeConfig.offices,
                          }
                        : undefined}
                      legacySummary={
                        config.dataSeed.querySet || config.accountSeedRows?.length
                          ? `${config.dataSeed.querySet?.queries.length ?? 0} query JSON entries and ${config.accountSeedRows?.length ?? 0} account rows were migrated into named V2 queries.`
                          : undefined
                      }
                      onChange={(querySection) =>
                        setConfig({
                          ...config,
                          dataSeed: {
                            ...config.dataSeed!,
                            datasets: config.dataSeed?.datasets ?? [],
                            mode: querySection
                              ? 'query_section'
                              : config.dataSeed?.mode === 'query_section'
                                ? 'hybrid'
                                : (config.dataSeed?.mode ?? 'hybrid'),
                            querySection,
                          },
                        })
                      }
                    />
                  ) : (
                    <InlineAlert>
                      Enable data deployment on the previous step before adding ordered queries.
                    </InlineAlert>
                  )}
                </FormSection>
              )}

              {activeStep.id === 'partners-users' && (
                <div className="space-y-6">
                  <FormSection title="Partner import">
                    <PartnerImportSection
                      value={config.partnerImport ?? DEFAULT_TEMPLATE_CONFIG.partnerImport!}
                      excelFile={partnerFile}
                      onExcelFileChange={setPartnerFile}
                      storedFileName={storedPartnerName}
                      onChange={(partnerImport) =>
                        setConfig({
                          ...config,
                          partnerImport,
                          pipelineSteps: partnerImport.enabled
                            ? config.pipelineSteps
                            : {
                                ...(config.pipelineSteps ?? DEFAULT_TEMPLATE_CONFIG.pipelineSteps!),
                                autoRunPartners: false,
                              },
                        })
                      }
                    />
                  </FormSection>
                  {!isConfigPartnersPreset && (
                    <FormSection title="User provisioning">
                      <UserProvisioningV2Section
                        sourceOrgId={dataDeploymentOrgId}
                        value={config.userProvisioning ?? DEFAULT_TEMPLATE_CONFIG.userProvisioning!}
                        onChange={(userProvisioning) => setConfig({ ...config, userProvisioning })}
                        onValidationChange={handleUserPlanValidation}
                      />
                    </FormSection>
                  )}
                  <FormSection title="Automation">
                    <PipelineStepsSection
                      value={config.pipelineSteps ?? DEFAULT_TEMPLATE_CONFIG.pipelineSteps!}
                      onChange={(pipelineSteps) => setConfig({ ...config, pipelineSteps })}
                      availability={{
                        autoRunDataSeed: Boolean(config.dataSeed),
                        autoRunPartners: config.partnerImport?.enabled === true,
                        autoRunUsers: hasConfiguredUsers,
                      }}
                      visibleSteps={isConfigPartnersPreset
                        ? ['autoRunDataSeed', 'autoRunPartners']
                        : undefined}
                    />
                  </FormSection>
                </div>
              )}

              {activeStep.id === 'review' && (
                <>
                  {hasConfiguredUsers && !userPlanReady && (
                    <InlineAlert variant="error" title="Provisioning plan not validated">
                      Return to Partners &amp; users and resolve all profile, mapping,
                      permission-set, and metadata validation errors before saving.
                    </InlineAlert>
                  )}
                  <TemplateReview
                    name={name}
                    description={description}
                    config={{
                      ...config,
                      permissionSets: parsePermissionSets(permissionSetsText),
                    }}
                    orgAliases={orgAliases}
                    steps={wizardSteps}
                    systemKey={systemKey}
                    onEditStep={setStep}
                  />
                </>
              )}

              {error && <InlineAlert variant="error">{error}</InlineAlert>}

              {stepFooter}
            </div>
          </GlassCard>
        </div>

        <aside className="hidden xl:block sticky top-6 self-start">
          <TemplateFormTips step={activeStep} systemKey={systemKey} />
        </aside>
      </div>
    </div>
  );
}
