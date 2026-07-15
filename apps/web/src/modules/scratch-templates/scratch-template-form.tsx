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
  TEMPLATE_WIZARD_STEPS,
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
  return withCanonicalGitSource({
    ...DEFAULT_TEMPLATE_CONFIG,
    ...migrateTemplateConfigToV2(config),
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
        config: TemplateConfigState;
      }>(`/environment/scratch-templates/${templateId}`)
        .then((t) => {
          setName(t.name);
          setDescription(t.description ?? '');
          try {
            setConfig(migrateForEditor(t.config));
          } catch (migrationError) {
            setConfig(withCanonicalGitSource({ ...DEFAULT_TEMPLATE_CONFIG, ...t.config, version: 2 }));
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
            setConfig(withCanonicalGitSource({ ...DEFAULT_TEMPLATE_CONFIG, ...draft.config, version: 2 }));
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
      if (userPlanState.checking || !userPlanState.valid) {
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
          dataSeed: {
            ...config.dataSeed,
            datasets: config.dataSeed?.datasets ?? DEFAULT_TEMPLATE_CONFIG.dataSeed?.datasets,
            mode: config.dataSeed?.mode ?? 'hybrid',
            querySet: config.dataSeed?.querySet,
            querySection: config.dataSeed?.querySection
              ? querySectionSchema.parse(config.dataSeed.querySection)
              : undefined,
          },
          accountSeedRows: config.accountSeedRows,
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
    step === 0
      ? name.trim().length > 0
      : step === 2
        ? Boolean(config.dataDeploymentOrgId ?? config.sourceOrgId) &&
          (
            config.customSettings?.enabled === false
            || Boolean(config.customSettingsOrgId ?? config.sourceOrgId)
          )
        : step === 3
          ? hasValidCustomJson(config, customJson)
          : step === 6 && config.dataSeed?.querySection
            ? querySectionSchema.safeParse(config.dataSeed.querySection).success
            : step === 7
              ? userPlanState.valid && !userPlanState.checking
            : true;

  if (loading) {
    return <PageSkeleton variant="form" />;
  }

  const wideStep = step >= 5;

  const stepFooter = (
    <div className="flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-border/60">
      {step > 0 && (
        <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
      )}
      {step < TEMPLATE_WIZARD_STEPS.length - 1 ? (
        <Button
          variant="outline"
          size="lg"
          className="ml-auto gap-2 rounded-lg border-violet-500/35 bg-violet-500/8 shadow-none hover:bg-violet-500/15 hover:border-violet-500/50"
          onClick={() => setStep((s) => s + 1)}
          disabled={!canNext}
        >
          Continue to {TEMPLATE_WIZARD_STEPS[step + 1]}
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
            || userPlanState.checking
            || !userPlanState.valid
          }
        >
          <Check className="w-4 h-4 text-violet-400" />
          Save template
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-0">
      <TemplateFormPageHeader
        mode={templateId ? 'edit' : 'new'}
        step={step}
        onCancel={onClose}
      />

      <TemplateStepIndicator current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,220px)_minmax(0,1fr)] xl:grid-cols-[minmax(200px,220px)_minmax(0,1fr)_minmax(240px,280px)] gap-6 items-start">
        <aside className="hidden lg:block sticky top-6 self-start">
          <GlassCard title="Pipeline steps" contentClassName="p-2 pt-0">
            <TemplateStepSidebar current={step} onStepClick={setStep} />
          </GlassCard>
        </aside>

        <div className={wideStep ? 'min-w-0 w-full' : 'min-w-0 w-full max-w-3xl xl:max-w-none'}>
          <GlassCard
            title={TEMPLATE_WIZARD_STEPS[step]}
            description={undefined}
            className="min-w-0"
          >
            <div className={wideStep ? undefined : 'max-w-2xl'}>
              {step === 0 && (
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

              {step === 1 && (
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

              {step === 2 && (
                <FormSection title="Source orgs">
                  <SourceOrgsSection
                    orgs={orgs}
                    dataDeploymentOrgId={config.dataDeploymentOrgId ?? config.sourceOrgId}
                    customSettingsOrgId={config.customSettingsOrgId ?? config.sourceOrgId}
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

              {step === 3 && (
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

              {step === 4 && (
                <FormSection title="Permissions & org config">
                  <div className="space-y-6">
                    <PermissionSetsEditor value={permissionSetsText} onChange={setPermissionSetsText} />
                    <OrgConfigSection
                      value={config.orgConfig ?? DEFAULT_TEMPLATE_CONFIG.orgConfig!}
                      onChange={(orgConfig) => setConfig({ ...config, orgConfig })}
                    />
                  </div>
                </FormSection>
              )}

              {step === 5 && (
                <FormSection title="Data seed">
                  <div className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                      Data deployment org:{' '}
                      {dataDeploymentOrgId
                        ? orgAliases[dataDeploymentOrgId] ?? dataDeploymentOrgId
                        : '— select on Source orgs step'}
                    </p>
                    <DataSeedSection
                      mode={config.dataSeed?.mode ?? 'hybrid'}
                      datasets={config.dataSeed?.datasets ?? []}
                      accountRows={config.accountSeedRows ?? []}
                      querySet={config.dataSeed?.querySet}
                      queryJsonFile={queryJsonFile}
                      onModeChange={(mode) =>
                        setConfig({
                          ...config,
                          dataSeed: {
                            ...config.dataSeed,
                            datasets: config.dataSeed?.datasets ?? DEFAULT_TEMPLATE_CONFIG.dataSeed?.datasets ?? [],
                            mode,
                            querySet: config.dataSeed?.querySet,
                          },
                        })
                      }
                      onDatasetsChange={(datasets) =>
                        setConfig({
                          ...config,
                          dataSeed: {
                            ...config.dataSeed,
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
                            ...config.dataSeed,
                            datasets: config.dataSeed?.datasets ?? [],
                            mode: config.dataSeed?.mode ?? 'hybrid',
                            querySet,
                          },
                        })
                      }
                      onQueryJsonFileChange={setQueryJsonFile}
                    />
                  </div>
                </FormSection>
              )}

              {step === 6 && (
                <FormSection title="Named query section">
                  <QuerySectionEditor
                    value={config.dataSeed?.querySection}
                    sourceOrgId={dataDeploymentOrgId}
                    salesOfficesByBottler={config.partnerImport?.salesOfficeConfig
                      ? {
                          [config.partnerImport.salesOfficeConfig.bottler]:
                            config.partnerImport.salesOfficeConfig.offices,
                        }
                      : undefined}
                    legacySummary={
                      config.dataSeed?.querySet || config.accountSeedRows?.length
                        ? `${config.dataSeed?.querySet?.queries.length ?? 0} query JSON entries and ${config.accountSeedRows?.length ?? 0} account rows were migrated into named V2 queries.`
                        : undefined
                    }
                    onChange={(querySection) =>
                      setConfig({
                        ...config,
                        dataSeed: {
                          ...config.dataSeed,
                          datasets: config.dataSeed?.datasets ?? [],
                          mode: querySection ? 'query_section' : (config.dataSeed?.mode ?? 'hybrid'),
                          querySection,
                        },
                      })
                    }
                  />
                </FormSection>
              )}

              {step === 7 && (
                <div className="space-y-6">
                  <FormSection title="Partner import">
                    <PartnerImportSection
                      value={config.partnerImport ?? DEFAULT_TEMPLATE_CONFIG.partnerImport!}
                      excelFile={partnerFile}
                      onExcelFileChange={setPartnerFile}
                      storedFileName={storedPartnerName}
                      onChange={(partnerImport) => setConfig({ ...config, partnerImport })}
                    />
                  </FormSection>
                  <FormSection title="User provisioning">
                    <UserProvisioningV2Section
                      sourceOrgId={dataDeploymentOrgId}
                      value={config.userProvisioning ?? DEFAULT_TEMPLATE_CONFIG.userProvisioning!}
                      onChange={(userProvisioning) => setConfig({ ...config, userProvisioning })}
                      onValidationChange={handleUserPlanValidation}
                    />
                  </FormSection>
                  <FormSection title="Automation">
                    <PipelineStepsSection
                      value={config.pipelineSteps ?? DEFAULT_TEMPLATE_CONFIG.pipelineSteps!}
                      onChange={(pipelineSteps) => setConfig({ ...config, pipelineSteps })}
                    />
                  </FormSection>
                </div>
              )}

              {step === 8 && (
                <>
                  {(userPlanState.checking || !userPlanState.valid) && (
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
          <TemplateFormTips step={step} />
        </aside>
      </div>
    </div>
  );
}
