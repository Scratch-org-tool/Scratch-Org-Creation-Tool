import type { AppModule } from './auth.js';
import type { CopilotAction } from './copilot-actions.js';

export interface CopilotClientContext {
  pathname: string;
  pageTitle: string;
  module: AppModule | null;
  grantedModules: AppModule[];
  connectedOrgs: Array<{ alias: string; orgId: string; type?: string }>;
  activeTab?: string;
  recentJobId?: string;
  role: 'admin' | 'user';
}

export interface AppGuideRoute {
  path: string;
  label: string;
  module: AppModule;
  description: string;
  children?: Array<{ path: string; label: string; description: string }>;
}

export interface AppGuideWorkflow {
  id: string;
  title: string;
  keywords: string[];
  module: AppModule;
  steps: string[];
  relatedPaths: string[];
}

export const APP_GUIDE_ROUTES: AppGuideRoute[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    module: 'dashboard',
    description: 'Home hub with quick actions and overview of connected orgs and recent activity.',
  },
  {
    path: '/environment-center',
    label: 'Environment Center',
    module: 'environment',
    description: 'Manage Salesforce environments, source control, and work-management integrations.',
    children: [
      {
        path: '/environment-center',
        label: 'Salesforce',
        description: 'Connect Dev Hub and sandbox orgs via Salesforce CLI web login.',
      },
      {
        path: '/environment-center?tab=source-control',
        label: 'Source Control',
        description: 'Connect Azure DevOps, GitHub, or Bitbucket and bind repositories.',
      },
      {
        path: '/environment-center?tab=work-management',
        label: 'Work Management',
        description: 'Connect Jira or inspect paired Azure Boards and GitHub Issues capabilities.',
      },
      {
        path: '/environment-center/create-scratch-org',
        label: 'Create Scratch Org',
        description: 'Wizard to create a scratch org: alias, duration, Dev Hub, template, packages.',
      },
    ],
  },
  {
    path: '/scratch-templates',
    label: 'Templates',
    module: 'environment',
    description: 'Manage scratch org definition templates used when creating scratch orgs.',
  },
  {
    path: '/deployment-center',
    label: 'Deployment Center',
    module: 'deployment',
    description: 'Hub for Git metadata deployment, Jenkins, org setup, data, and provisioning.',
    children: [
      { path: '/deployment-center/git', label: 'Git Metadata Deploy', description: 'Deploy from Azure DevOps, GitHub, or Bitbucket.' },
      { path: '/deployment-center/jenkins', label: 'Jenkins', description: 'Jenkins pipeline integration for deployments.' },
      { path: '/data-deploy', label: 'Data Deployment', description: 'Pick objects, compare source vs target records, and insert or upsert between orgs with history.' },
      { path: '/data-center', label: 'Data Operations', description: 'CONA seed, onboarding replication, and reusable query templates.' },
      { path: '/org-setup', label: 'Org Setup', description: 'Assign permission sets and configure org setup steps.' },
      { path: '/user-provisioning', label: 'User Provisioning', description: 'Bulk create or update Salesforce users.' },
      { path: '/custom-settings-load', label: 'Custom Settings Load', description: 'Load custom settings data into target orgs.' },
    ],
  },
  {
    path: '/deployment-workbench',
    label: 'Deployment Workbench',
    module: 'deployment',
    description: 'Metadata and data deployments: compare orgs or branches, quality gates, approvals, rollback, and audit.',
  },
  {
    path: '/monitoring',
    label: 'Monitoring',
    module: 'monitoring',
    description: 'View job status, logs, and troubleshoot failed scratch org, data, and deploy jobs.',
  },
  {
    path: '/defects-command-centre',
    label: 'AI Defects Command Centre',
    module: 'defects',
    description: 'View provider work items assigned to you, update status, read comments, and investigate with AI.',
  },
  {
    path: '/admin/users',
    label: 'User Access',
    module: 'dashboard',
    description: 'Admin-only: grant module access (Deployment, Monitoring, Copilot, etc.) to users.',
  },
];

export const APP_GUIDE_WORKFLOWS: AppGuideWorkflow[] = [
  {
    id: 'connect-org',
    title: 'Connect a Salesforce org',
    keywords: ['connect', 'dev hub', 'authorize', 'login', 'integration', 'org connection'],
    module: 'environment',
    steps: [
      'Open **Environment Center** in the sidebar → **Salesforce**.',
      'Click **Connect Org** and complete Salesforce web login for your Dev Hub or sandbox.',
      'After auth, the org appears in the connected orgs list and is available in deployment forms.',
    ],
    relatedPaths: ['/environment-center'],
  },
  {
    id: 'create-scratch-org',
    title: 'Create a scratch org',
    keywords: ['scratch org', 'scratch', 'provision', 'create org'],
    module: 'environment',
    steps: [
      'Ensure a Dev Hub is connected under **Environment Center → Salesforce**.',
      'Go to **Environment → Create Scratch Org** (or sidebar **Environment** child link).',
      'Fill alias, duration (days), Dev Hub alias, scratch definition template, and optional packages.',
      'Submit and track progress in **Monitoring**.',
    ],
    relatedPaths: ['/environment-center/create-scratch-org', '/environment-center'],
  },
  {
    id: 'metadata-deploy',
    title: 'Deploy metadata',
    keywords: ['metadata', 'deploy metadata', 'git deploy', 'branch deploy', 'workbench'],
    module: 'deployment',
    steps: [
      'Open **Deployment Workbench** in the sidebar and choose **Metadata Deployment**.',
      'Pick the comparison source (org or repository branch) and the target org, then start the comparison.',
      'Select components, review dependencies and quality gates, then create and execute the plan.',
    ],
    relatedPaths: ['/deployment-workbench'],
  },
  {
    id: 'git-metadata-deploy',
    title: 'Run a Git metadata deployment',
    keywords: ['git', 'metadata source', 'azure', 'github', 'bitbucket', 'repository deploy'],
    module: 'deployment',
    steps: [
      'Connect Azure DevOps, GitHub, or Bitbucket under **Environment Center → Source Control**.',
      'Open **Deployment** → **Git Metadata Deploy**.',
      'Select provider, account, repository, branch, manifest, and target org, then deploy.',
    ],
    relatedPaths: ['/deployment-center/git', '/deployment-center'],
  },
  {
    id: 'org-to-org-data-deploy',
    title: 'Deploy records from one org to another',
    keywords: ['org to org', 'data deploy', 'insert', 'upsert', 'records', 'compare records'],
    module: 'data',
    steps: [
      'Open **Deployment Workbench** → **Data Deployment** (or **Deployment** → **Data Deployment**).',
      'Pick source org, target org, and strategy (upsert updates matches; insert always creates).',
      'Check the objects to move, then adjust filters, deploy fields, or custom SOQL per object.',
      'Click **Review & compare** to see matching records and the target impact (new vs existing).',
      'Run **Preflight & deploy**; track progress live and later under the **History** tab.',
    ],
    relatedPaths: ['/data-deploy', '/deployment-center'],
  },
  {
    id: 'data-replication',
    title: 'Replicate data between orgs',
    keywords: ['sfdmu', 'replicate', 'onboarding', 'bulk data'],
    module: 'data',
    steps: [
      'Open **Deployment** → **Data Center** (or **Data Center** from deployment hub).',
      'Choose source and target orgs, configure SOQL or query sets.',
      'For onboarding config replication, use the cfs_ob__Onboarding_Config__c workflow.',
      'Start the job and monitor in **Monitoring**.',
    ],
    relatedPaths: ['/data-center', '/deployment-center'],
  },
  {
    id: 'monitoring-jobs',
    title: 'Find and troubleshoot jobs',
    keywords: ['monitoring', 'failed job', 'job log', 'troubleshoot', 'status'],
    module: 'monitoring',
    steps: [
      'Open **Monitoring** in the sidebar.',
      'Filter by job type or status; click a job for detailed logs.',
      'Use log output to identify Salesforce CLI or SFDMU errors.',
    ],
    relatedPaths: ['/monitoring'],
  },
  {
    id: 'defects-command-centre',
    title: 'Manage Azure defects and user stories',
    keywords: ['defect', 'bug', 'user story', 'azure boards', 'work item', 'assigned'],
    module: 'defects',
    steps: [
      'Open **AI Defects** in the sidebar.',
      'Review work items assigned to your login email (admins see all items).',
      'Select an item to read description, comments, and change status.',
      'Use **Investigate with AI** for root-cause analysis.',
    ],
    relatedPaths: ['/defects-command-centre', '/environment-center'],
  },
  {
    id: 'user-access',
    title: 'Grant module access to users',
    keywords: ['permission', 'module grant', 'user access', 'copilot access', 'locked'],
    module: 'dashboard',
    steps: [
      'Admin opens **User Access** (`/admin/users`).',
      'User must sign in once so an AppUser row exists, then click **Refresh**.',
      'Grant modules: Deployment, Org Setup, Monitoring, **Copilot**, etc.',
      'By default new users only have Dashboard, Environment, and Data.',
    ],
    relatedPaths: ['/admin/users'],
  },
];

const PATH_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/environment-center/create-scratch-org', title: 'Create Scratch Org' },
  { prefix: '/environment-center', title: 'Environment Center' },
  { prefix: '/scratch-templates', title: 'Scratch Templates' },
  { prefix: '/deployment-center/git', title: 'Git Metadata Deploy' },
  { prefix: '/deployment-center/azure', title: 'Git Metadata Deploy' },
  { prefix: '/deployment-center/jenkins', title: 'Jenkins' },
  { prefix: '/deployment-center', title: 'Deployment Center' },
  { prefix: '/data-deploy', title: 'Data Deployment' },
  { prefix: '/data-center', title: 'Data Operations' },
  { prefix: '/org-setup', title: 'Org Setup' },
  { prefix: '/user-provisioning', title: 'User Provisioning' },
  { prefix: '/custom-settings-load', title: 'Custom Settings Load' },
  { prefix: '/deployment-workbench', title: 'Deployment Workbench' },
  { prefix: '/monitoring', title: 'Monitoring' },
  { prefix: '/defects-command-centre', title: 'AI Defects Command Centre' },
  { prefix: '/admin/users', title: 'User Access' },
  { prefix: '/dashboard', title: 'Dashboard' },
];

const QUICK_PROMPTS: Array<{ prefix: string; prompts: string[] }> = [
  { prefix: '/dashboard', prompts: ['What can I do from here?', 'Where do I connect a Salesforce org?'] },
  {
    prefix: '/environment-center',
    prompts: ['How do I connect a Salesforce org?', 'How do I create a scratch org?'],
  },
  {
    prefix: '/deployment-center',
    prompts: ['How do I deploy from Git?', 'Where do I connect a source-control provider?'],
  },
  { prefix: '/deployment-workbench', prompts: ['How do I deploy metadata?', 'Where is deployment history?'] },
  { prefix: '/data-deploy', prompts: ['How do I deploy records to another org?', 'What is the difference between insert and upsert?'] },
  { prefix: '/data-center', prompts: ['How do I replicate data between orgs?', 'What is SFDMU in this app?'] },
  { prefix: '/monitoring', prompts: ['How do I find a failed job?', 'How do I read job logs?'] },
  {
    prefix: '/defects-command-centre',
    prompts: ['How do I see my assigned defects?', 'How do I update a work item status?'],
  },
  { prefix: '/admin/users', prompts: ['How do I grant Copilot access?', 'What modules can I assign?'] },
];

const NAV_KEYWORDS: Array<{
  patterns: RegExp;
  action: Extract<CopilotAction, { type: 'navigate' }>;
}> = [
  {
    patterns: /\b(scratch\s*org|create\s+scratch)\b/i,
    action: { type: 'navigate', href: '/environment-center/create-scratch-org', label: 'Create Scratch Org' },
  },
  {
    patterns: /\b(connect\s+org|integrations?|dev\s*hub)\b/i,
    action: { type: 'navigate', href: '/environment-center', label: 'Environment Integrations' },
  },
  {
    patterns: /\b(metadata\s+deploy|metadata\s+deployment|deployment\s+workbench)\b/i,
    action: { type: 'navigate', href: '/deployment-workbench?flow=metadata', label: 'Metadata Deployment' },
  },
  {
    patterns: /\b(git\s+metadata|repository\s+deploy|azure|github|bitbucket|ado\s+pipeline)\b/i,
    action: { type: 'navigate', href: '/deployment-center/git', label: 'Git Metadata Deploy' },
  },
  {
    patterns: /\b(jenkins)\b/i,
    action: { type: 'navigate', href: '/deployment-center/jenkins', label: 'Jenkins' },
  },
  {
    patterns: /\b(org.to.org\s+data|data\s+deploy)\b/i,
    action: { type: 'navigate', href: '/data-deploy', label: 'Data Deployment' },
  },
  {
    patterns: /\b(data\s+center|sfdmu)\b/i,
    action: { type: 'navigate', href: '/data-center', label: 'Data Center' },
  },
  {
    patterns: /\b(monitoring|job\s+logs?|failed\s+job)\b/i,
    action: { type: 'navigate', href: '/monitoring', label: 'Monitoring' },
  },
  {
    patterns: /\b(defects?|bugs?|user\s+stor(y|ies)|azure\s+boards?|work\s+items?)\b/i,
    action: { type: 'navigate', href: '/defects-command-centre', label: 'AI Defects Command Centre' },
  },
  {
    patterns: /\b(dashboard|home)\b/i,
    action: { type: 'navigate', href: '/dashboard', label: 'Dashboard' },
  },
  {
    patterns: /\b(user\s+access|grant\s+module)\b/i,
    action: { type: 'navigate', href: '/admin/users', label: 'User Access' },
  },
  {
    patterns: /\b(scratch\s+templates?)\b/i,
    action: { type: 'navigate', href: '/scratch-templates', label: 'Scratch Templates' },
  },
  {
    patterns: /\b(org\s+setup)\b/i,
    action: { type: 'navigate', href: '/org-setup', label: 'Org Setup' },
  },
];

export function getPageTitleForPath(pathname: string): string {
  const match = PATH_TITLES.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  return match?.title ?? 'Salesforce DevOps Command Center';
}

export function getQuickPromptsForPath(pathname: string): string[] {
  const match = QUICK_PROMPTS.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  return match?.prompts ?? ['What can I do in this application?', 'How do I get started?'];
}

export function matchGuideWorkflows(query: string, limit = 3): AppGuideWorkflow[] {
  const lower = query.toLowerCase();
  const scored = APP_GUIDE_WORKFLOWS.map((w) => {
    let score = 0;
    for (const kw of w.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 2;
    }
    for (const word of lower.split(/\s+/)) {
      if (word.length > 3 && w.title.toLowerCase().includes(word)) score += 1;
    }
    return { w, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.w);
}

export function formatGuideForPrompt(query: string, context?: Partial<CopilotClientContext>): string {
  const workflows = matchGuideWorkflows(query, 3);
  const routeLines = APP_GUIDE_ROUTES.map((r) => {
    const children = r.children?.map((c) => `  - ${c.label}: ${c.path} — ${c.description}`).join('\n');
    return `- **${r.label}** (${r.path}, module: ${r.module}): ${r.description}${children ? `\n${children}` : ''}`;
  }).join('\n');

  const workflowLines =
    workflows.length > 0
      ? workflows
          .map(
            (w) =>
              `### ${w.title}\n${w.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nPaths: ${w.relatedPaths.join(', ')}`,
          )
          .join('\n\n')
      : 'No specific workflow matched; use the route map.';

  const ctxLine = context?.pathname
    ? `User is on: ${context.pageTitle ?? context.pathname} (${context.pathname}). Module: ${context.module ?? 'unknown'}.`
    : '';

  return `## Application route map\n${routeLines}\n\n## Relevant workflows\n${workflowLines}\n\n${ctxLine}`;
}

const NAV_INTENT = /\b(take\s+me\s+to|go\s+to|open|navigate\s+to|show\s+me|bring\s+me\s+to)\b/i;

export function matchNavigationAction(
  query: string,
  grantedModules: AppModule[] = [],
): CopilotAction | undefined {
  if (!NAV_INTENT.test(query)) return undefined;
  for (const entry of NAV_KEYWORDS) {
    if (!entry.patterns.test(query)) continue;
    const route = APP_GUIDE_ROUTES.find((r) => entry.action.href.startsWith(r.path));
    const module = route?.module;
    if (module && grantedModules.length > 0 && !grantedModules.includes(module)) continue;
    return entry.action;
  }
  return undefined;
}
