import type { CurriculumPath } from './curriculum.types';

/**
 * Path — Release Management (Intermediate).
 * Enterprise change delivery: environments, branching, CI/CD, validation,
 * rollback/governance, and release calendars with quality gates.
 */
export const releaseManagementPath: CurriculumPath = {
  id: 'release-management',
  title: 'Release Management',
  tagline: 'Ship Salesforce change safely — environments, pipelines, and governance.',
  description:
    'Learn how enterprise teams move metadata and code from idea to production. Compare change sets with Salesforce DX, design sandbox strategies, choose branching models, build CI/CD pipelines, validate deployments, plan rollback and governance, and run a release calendar with quality gates that protect the business.',
  level: 'intermediate',
  badge: 'Release Manager',
  estimatedHours: 7,
  skills: [
    'Change sets vs DX',
    'Sandboxes & environments',
    'Branching strategies',
    'CI/CD pipelines',
    'Deployment validation',
    'Rollback & governance',
    'Release calendars',
    'Quality gates',
  ],
  modules: [
    {
      id: 'release-mgmt-foundations',
      title: 'Environments & Change Vehicles',
      summary:
        'Choose the right orgs for each stage and the right tool — change sets or DX — for each kind of change.',
      lessons: [
        {
          id: 'release-change-sets-vs-dx',
          title: 'Change sets vs Salesforce DX',
          summary:
            'Know when point-and-click change sets are enough — and when source-driven DX is the safer enterprise default.',
          durationMinutes: 25,
          objectives: [
            'Describe outbound/inbound change sets and their limits',
            'Explain source-driven development with Salesforce DX CLI and packaging',
            'Choose a change vehicle based on team size, frequency, and complexity',
          ],
          sections: [
            {
              heading: 'Change sets: visual, org-to-org, limited',
              body:
                'Change sets move metadata between related orgs (production and its sandboxes). You pick components in Setup, upload an outbound set, and deploy inbound in the target.\n\nStrengths: familiar to admins, no Git required for small changes. Limits: related orgs only, weak diff/history, easy to miss dependencies, poor fit for parallel team work, and no natural code review.',
            },
            {
              heading: 'Salesforce DX: source as the system of truth',
              body:
                'With DX, metadata lives in Git. Developers retrieve/deploy with the CLI (sf project deploy start), review diffs in pull requests, and automate validation in CI. Unlocked/second-generation packages and scratch orgs extend the model for modular delivery.\n\nDX does not remove the need for governance — it makes governance auditable: every production deploy can point to a commit SHA.',
            },
            {
              heading: 'A practical decision rule',
              body:
                'Use change sets for rare, tiny admin tweaks in low-maturity orgs — and document them. Prefer DX + Git when multiple people ship weekly, when Apex/LWC is involved, or when audit needs a trail.\n\nMany enterprises run a hybrid transition: admins still configure in sandboxes, but releases retrieve into Git so production deploys only from pipelines.',
            },
          ],
          realWorld: {
            title: 'Two admins overwrite each other with change sets',
            scenario:
              'Admin A and Admin B each build in the same Partial sandbox and upload separate change sets the same afternoon. Production ends with A’s page layout and B’s missing field dependency.',
            solution:
              'The org moves to Git-backed DX: each admin works in a scratch org or personal Developer sandbox, opens a pull request, and a pipeline deploys the merged main branch to UAT then production.',
            outcome:
              'Conflicts surface in review before production, and the release notes list commit history instead of “components we think we sent.”',
          },
          keyTakeaways: [
            'Change sets are org-to-org and history-poor',
            'DX makes Git the source of truth with reviewable diffs',
            'Pipeline deploys beat ad-hoc uploads for frequent change',
            'Hybrid transitions still end with production deploying from source',
          ],
          resources: [
            {
              title: 'Application Lifecycle and Development Models (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
            },
            {
              title: 'Salesforce DX Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'release-sandboxes-environments',
          title: 'Sandboxes and environment strategy',
          summary:
            'Map Dev → QA → UAT → Production with the right sandbox types and data realities.',
          durationMinutes: 25,
          objectives: [
            'Differentiate Developer, Developer Pro, Partial Copy, and Full sandboxes',
            'Place scratch orgs in a modern environment topology',
            'Define promotion rules so hotfixes and features do not collide',
          ],
          sections: [
            {
              heading: 'Sandbox types by purpose',
              body:
                'Developer / Developer Pro: metadata copies for build work; Pro adds more storage. Partial Copy: metadata plus a sampled data template — good for QA. Full: near-production data and metadata — scarce, often reserved for UAT, training, or performance.\n\nRefresh wipes sandbox changes. Schedule refreshes deliberately and never treat a sandbox as the only copy of work — that is what Git is for.',
            },
            {
              heading: 'A reference topology',
              body:
                '1. Feature work: scratch orgs or personal Developer sandboxes from Git branches.\n2. Integration/QA: shared Developer Pro or Partial Copy, deployed from the main/integration branch.\n3. UAT: Full or Partial with realistic data, deployed from a release candidate tag.\n4. Production: deploy only from the approved release artifact/commit.\n\nHotfixes branch from the production tag, merge forward into main after release so fixes are not lost.',
            },
            {
              heading: 'Data and secrets realities',
              body:
                'Partial/Full sandboxes may contain sensitive data — apply masking policies. Named credentials, secrets, and some features differ per environment; use environment-specific config (and never commit secrets).\n\nDocument which tests require which data shape so QA does not chase “works in Full only” bugs without a plan.',
            },
          ],
          realWorld: {
            title: 'UAT blocked because Full sandbox is three months stale',
            scenario:
              'A regulated insurer schedules a major release. UAT users reject the Full sandbox as unusable — queues, users, and product data drifted badly since the last refresh.',
            solution:
              'Release management adds a calendar-owned refresh window two weeks before UAT, plus a data template for Partial QA, and forbids building features only in Full.',
            outcome:
              'UAT starts on time with known data, and feature development continues in source-backed lower environments during the refresh.',
          },
          keyTakeaways: [
            'Sandbox type follows purpose: build, QA sample data, or full UAT',
            'Scratch orgs isolate feature work without locking shared sandboxes',
            'Refresh is destructive — source control is the durable store',
            'Promote the same commit through environments; do not rebuild by hand',
          ],
          resources: [
            {
              title: 'Sandboxes (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.deploy_sandboxes_parent.htm',
              source: 'help',
            },
            {
              title: 'Scratch Orgs (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/sfdx_app_dev',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'release-branching-strategies',
          title: 'Branching strategies for Salesforce teams',
          summary:
            'Pick trunk-based or GitFlow-style models that match release cadence — and keep metadata merges sane.',
          durationMinutes: 20,
          objectives: [
            'Compare trunk-based development with long-lived release branches',
            'Define PR rules for metadata and Apex',
            'Avoid the common XML merge pitfalls in Salesforce projects',
          ],
          sections: [
            {
              heading: 'Trunk-based for frequent releases',
              body:
                'Engineers open short-lived feature branches from main, merge via pull request daily or every few days, and release from main (or a tag cut from main). Feature flags or careful activation behind custom settings reduce the need for long-lived branches.\n\nThis model fits DX pipelines well: CI validates every PR against a scratch org.',
            },
            {
              heading: 'Release branches when cadence is slower',
              body:
                'Some enterprises cut a release/x.y branch for hardening while main accepts next-sprint work. Hotfixes commit to the release branch and merge forward.\n\nCost: longer divergence and more merges of Salesforce XML. Use only when release windows are truly infrequent and controlled.',
            },
            {
              heading: 'Metadata merge hygiene',
              body:
                'Profiles, permission sets, and some XML types conflict easily. Prefer small permission sets over editing monolithic profiles, keep PRs narrow, and use tools/processes that expand or explain metadata diffs.\n\nRule: one business capability per PR when possible — “new Training Session fields + layout + FLS” — so reviewers can reason about the unit of change.',
            },
          ],
          realWorld: {
            title: 'Profile XML conflict delays a freeze week',
            scenario:
              'Two features both edit the same Admin profile in one sprint. Merging release branches produces an unreadable conflict the day before production freeze.',
            solution:
              'Architecture mandates permission-set-based access for new features; PRs no longer touch the giant profile. Remaining profile edits require a dedicated ownership path.',
            outcome:
              'Freeze week merges become routine, and access changes review as intent (“grant X”) instead of 5,000-line XML diffs.',
          },
          keyTakeaways: [
            'Short-lived branches reduce Salesforce XML merge pain',
            'Match branching to release cadence — do not copy GitFlow blindly',
            'Permission sets beat profile edits for parallel work',
            'Every production deploy should map to a Git commit/tag',
          ],
          resources: [
            {
              title: 'DevOps Center Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/devops-center-basics',
              source: 'trailhead',
            },
            {
              title: 'Source Tracking and Deploy (Docs)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_push_sot_intro.htm',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-rel-env-1',
          topic: 'Change sets',
          prompt: 'A primary limitation of change sets is that they:',
          options: [
            'Only deploy Apex, never declarative metadata',
            'Work between related orgs and lack strong source history',
            'Require a Full sandbox always',
            'Cannot include custom fields',
          ],
          correctIndex: 1,
          explanation: 'Change sets are org-to-org among related environments and are weak on history/review.',
        },
        {
          id: 'q-rel-env-2',
          topic: 'DX',
          prompt: 'In a DX source-driven model, what is the system of truth?',
          options: [
            'Whoever last clicked in production',
            'Git-tracked project source',
            'The oldest sandbox',
            'A spreadsheet of components',
          ],
          correctIndex: 1,
          explanation: 'Source control holds the canonical metadata and code.',
        },
        {
          id: 'q-rel-env-3',
          topic: 'Sandboxes',
          prompt: 'Which sandbox type copies a sample of production data using a template?',
          options: [
            'Developer',
            'Scratch org',
            'Partial Copy',
            'Partner Developer Edition only',
          ],
          correctIndex: 2,
          explanation: 'Partial Copy sandboxes include sampled data defined by a template.',
        },
        {
          id: 'q-rel-env-4',
          topic: 'Sandboxes',
          prompt: 'What happens to uncommitted sandbox work when you refresh?',
          options: [
            'It is automatically merged to Git',
            'It is lost from the sandbox',
            'It deploys to production',
            'It converts into a change set',
          ],
          correctIndex: 1,
          explanation: 'Refresh replaces the sandbox; durable work must live in source control.',
        },
        {
          id: 'q-rel-env-5',
          topic: 'Topology',
          prompt: 'Where should production deploys come from in a mature pipeline?',
          options: [
            'Direct Setup edits in production',
            'An approved Git commit/artifact already validated upstream',
            'A random Developer sandbox retrieve',
            'Email attachments of XML',
          ],
          correctIndex: 1,
          explanation: 'Promote the same reviewed artifact through environments.',
        },
        {
          id: 'q-rel-env-6',
          topic: 'Scratch orgs',
          prompt: 'Scratch orgs are best used for:',
          options: [
            'Long-term production hosting',
            'Short-lived, source-driven feature development and CI',
            'Storing years of Full sandbox data',
            'Replacing SSO',
          ],
          correctIndex: 1,
          explanation: 'Scratch orgs are ephemeral environments created from definition + source.',
        },
        {
          id: 'q-rel-env-7',
          topic: 'Branching',
          prompt: 'Trunk-based development emphasizes:',
          options: [
            'Month-long feature branches with no merges',
            'Short-lived branches integrated frequently into main',
            'Editing only in production',
            'One shared sandbox password',
          ],
          correctIndex: 1,
          explanation: 'Frequent integration keeps branches short and reduces merge risk.',
        },
        {
          id: 'q-rel-env-8',
          topic: 'Metadata',
          prompt: 'Why are large profile edits problematic in Git-based teams?',
          options: [
            'Profiles cannot be deployed',
            'They create frequent, hard-to-review merge conflicts',
            'Profiles are binary-only',
            'Git rejects XML',
          ],
          correctIndex: 1,
          explanation: 'Monolithic profile XML conflicts when many features touch access.',
        },
        {
          id: 'q-rel-env-9',
          topic: 'Hotfixes',
          prompt: 'After shipping a hotfix from a release branch, you should:',
          options: [
            'Delete main',
            'Merge the fix forward so main does not lose it',
            'Never test it',
            'Only keep it in the sandbox',
          ],
          correctIndex: 1,
          explanation: 'Forward-merge prevents the bug from reappearing in the next release.',
        },
        {
          id: 'q-rel-env-10',
          topic: 'Hybrid',
          prompt: 'A sensible hybrid transition step is:',
          options: [
            'Ban all sandboxes',
            'Let admins configure in sandboxes but retrieve releases into Git for production deploy',
            'Disable Apex tests',
            'Use change sets only between unrelated orgs',
          ],
          correctIndex: 1,
          explanation: 'Capturing work into Git preserves reviewability even during cultural transition.',
        },
      ],
    },
    {
      id: 'release-mgmt-pipelines',
      title: 'CI/CD Pipelines & Validation',
      summary:
        'Automate build, test, and deploy validation so humans review intent — not click deploy scripts.',
      lessons: [
        {
          id: 'release-cicd-pipelines',
          title: 'CI/CD pipelines for Salesforce',
          summary:
            'Design a pipeline that validates every pull request and promotes releases with the same scripts every time.',
          durationMinutes: 25,
          objectives: [
            'List stages of a typical Salesforce CI/CD pipeline',
            'Explain PR validation vs release deployment jobs',
            'Identify secrets, auth, and org targets as pipeline configuration',
          ],
          sections: [
            {
              heading: 'Pipeline stages that earn their keep',
              body:
                '1. Install CLI / dependencies.\n2. Authenticate to a CI scratch org or ephemeral org (JWT or equivalent).\n3. Deploy or push source.\n4. Run Apex tests (and static analysis if you use it).\n5. Publish results; block merge on failure.\n\nRelease jobs repeat deploy+test against QA/UAT/prod targets with approvals between stages.',
            },
            {
              heading: 'PR validation vs release promotion',
              body:
                'Pull request CI answers: “Is this change safe to merge?” using a scratch org and fast tests. Release CI answers: “Can this exact commit enter the next environment?” using longer tests and manual approval gates.\n\nNever invent a one-off deploy command for production — the release job should be the only path.',
            },
            {
              heading: 'Auth and environments as config',
              body:
                'Store consumer keys, certificates, and org aliases in the CI secret store — not in Git. Parameterize targets (QA, UAT, Prod) so the same workflow definition promotes upward.\n\nFail the pipeline if required test levels are not met; do not rely on a human remembering --test-level.',
            },
          ],
          realWorld: {
            title: '“It passed on my machine” reaches production',
            scenario:
              'A developer deploys from a local CLI to UAT with RunLocalTests skipped to save time. Production deploy later fails Apex tests the developer never ran.',
            solution:
              'Security locks production credentials to the pipeline. Local deploys to shared UAT are revoked; PR CI must pass RunLocalTests before merge.',
            outcome:
              'Broken tests fail at pull request time, not during the maintenance window.',
          },
          keyTakeaways: [
            'CI validates every PR; CD promotes a known commit',
            'Production credentials belong to the pipeline, not laptops',
            'Same scripts for every environment reduce surprise',
            'Approvals sit between stages — not as a substitute for automated tests',
          ],
          resources: [
            {
              title: 'Continuous Integration (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/continuous-integration-and-continuous-delivery',
              source: 'trailhead',
            },
            {
              title: 'Salesforce CLI Setup (Docs)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_intro.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'release-deployment-validation',
          title: 'Deployment validation and test levels',
          summary:
            'Use check-only validates, test levels, and dependency analysis before the maintenance window.',
          durationMinutes: 25,
          objectives: [
            'Run a validate-only deploy and interpret results',
            'Choose appropriate Apex test levels for the change',
            'Catch missing dependencies before production night',
          ],
          sections: [
            {
              heading: 'Validate before you commit the window',
              body:
                'A check-only (validate) deploy compiles metadata and can run tests without committing changes to the target org. Run validates against UAT/prod early on release day — or the day before — so failures are not discovered at cutover.\n\nTreat a green validate on the release commit as a release prerequisite.',
            },
            {
              heading: 'Test levels with intent',
              body:
                'NoTestRun is for pure declarative deploys in constrained cases — risky if Apex is present. RunSpecifiedTests fits package-focused changes with a known test set. RunLocalTests is the common enterprise default for org-wide Apex.\n\nPick the level that matches risk and platform requirements; document it in the pipeline so humans cannot quietly downgrade it.',
            },
            {
              heading: 'Dependencies and destructive changes',
              body:
                'Missing dependent components (flexiPages needing fields, flows needing objects) fail deploys. Destructive changes (deleting metadata) need explicit manifests and careful ordering.\n\nMaintain a release checklist: data migrations, feature toggles, post-deploy Flow activation, and permission assignment — metadata deploy alone is rarely the whole release.',
            },
          ],
          realWorld: {
            title: 'Validate succeeds Friday; Monday deploy fails',
            scenario:
              'A team validates commit A on Friday. Over the weekend, another hotfix lands in production. Monday they deploy commit A without rebasing/revalidating; component conflicts fail mid-window.',
            solution:
              'Release policy requires a fresh validate of the final release tag against current production immediately before approval, and hotfixes merge forward before the tag is cut.',
            outcome:
              'The window starts with a validate that matches the org you are about to change.',
          },
          keyTakeaways: [
            'Check-only validates de-risk cutovers',
            'Test level is a governance control, not a convenience flag',
            'Post-deploy steps are part of the release package',
            'Re-validate when production moved since the last check',
          ],
          resources: [
            {
              title: 'Deploy and Retrieve (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.deploy_overview.htm',
              source: 'help',
            },
            {
              title: 'Running Apex Tests in Deployments',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_testing_unit_tests_running.htm',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-rel-ci-1',
          topic: 'CI',
          prompt: 'The main question PR continuous integration answers is:',
          options: [
            'Who should get a raise?',
            'Is this change safe to merge?',
            'Which sandbox to refresh tonight?',
            'What color is the logo?',
          ],
          correctIndex: 1,
          explanation: 'PR CI gates merges with build/test evidence.',
        },
        {
          id: 'q-rel-ci-2',
          topic: 'CD',
          prompt: 'Continuous delivery promotion should deploy:',
          options: [
            'Whatever is on the developer’s laptop',
            'The same reviewed commit/artifact validated upstream',
            'A newly rewritten change set each stage',
            'Only destructive changes',
          ],
          correctIndex: 1,
          explanation: 'Promoting one artifact keeps environments comparable.',
        },
        {
          id: 'q-rel-ci-3',
          topic: 'Secrets',
          prompt: 'Where should JWT keys / deploy credentials live?',
          options: [
            'In the Git repository root',
            'In CI secret storage / a vault',
            'In a public Chatter file',
            'Hard-coded in Apex',
          ],
          correctIndex: 1,
          explanation: 'Secrets belong in managed secret stores, never source control.',
        },
        {
          id: 'q-rel-ci-4',
          topic: 'Validation',
          prompt: 'A check-only deploy is useful because it:',
          options: [
            'Skips all Apex compilation',
            'Validates without committing changes to the target',
            'Refreshes a Full sandbox',
            'Creates users automatically',
          ],
          correctIndex: 1,
          explanation: 'Validate/check-only surfaces failures before the real deploy.',
        },
        {
          id: 'q-rel-ci-5',
          topic: 'Tests',
          prompt: 'RunLocalTests as a deploy test level means:',
          options: [
            'No tests run',
            'All local (non-installed-package) Apex tests in the org run',
            'Only UI tests in Browser run',
            'Only one method runs',
          ],
          correctIndex: 1,
          explanation: 'RunLocalTests executes the org’s local Apex tests.',
        },
        {
          id: 'q-rel-ci-6',
          topic: 'Governance',
          prompt: 'Why lock production deploy credentials to the pipeline?',
          options: [
            'To slow developers down for sport',
            'To prevent untested ad-hoc deploys that bypass quality gates',
            'Because CLI cannot authenticate otherwise',
            'To disable sandboxes',
          ],
          correctIndex: 1,
          explanation: 'A single path through CI/CD enforces tests and approvals.',
        },
        {
          id: 'q-rel-ci-7',
          topic: 'Dependencies',
          prompt: 'A Lightning page deploy fails citing an unknown field. Likely cause?',
          options: [
            'The field exists but was not included/deployed as a dependency',
            'Lightning pages cannot show fields',
            'Git cannot store XML',
            'Apex tests were too fast',
          ],
          correctIndex: 0,
          explanation: 'Metadata dependencies must be present in the target or the same deploy.',
        },
        {
          id: 'q-rel-ci-8',
          topic: 'Release package',
          prompt: 'Which is often needed besides metadata deploy?',
          options: [
            'Nothing — metadata always covers data and activation',
            'Data migration, permission assignment, or Flow activation steps',
            'Deleting Git history',
            'Disabling MFA',
          ],
          correctIndex: 1,
          explanation: 'Operational post-steps frequently accompany metadata releases.',
        },
        {
          id: 'q-rel-ci-9',
          topic: 'Revalidation',
          prompt: 'Production changed after your last validate. What should you do before cutover?',
          options: [
            'Skip tests to save time',
            'Re-validate the final release tag against current production',
            'Deploy from a different untested branch',
            'Refresh production',
          ],
          correctIndex: 1,
          explanation: 'Validates must match the org state you are about to change.',
        },
        {
          id: 'q-rel-ci-10',
          topic: 'Pipeline design',
          prompt: 'Approvals in a CD pipeline are best used to:',
          options: [
            'Replace Apex tests entirely',
            'Authorize promotion between environments after automated checks pass',
            'Store passwords in Git',
            'Edit profiles in production',
          ],
          correctIndex: 1,
          explanation: 'Humans approve promotions; machines still run the technical gates.',
        },
      ],
    },
    {
      id: 'release-mgmt-governance',
      title: 'Rollback, Governance & Release Cadence',
      summary:
        'Plan for failure, define who can approve what, and run a release calendar with quality gates the business trusts.',
      lessons: [
        {
          id: 'release-rollback-governance',
          title: 'Rollback strategies and change governance',
          summary:
            'Decide how you will undo a bad release — and who is allowed to ship — before you need the answer at 2 a.m.',
          durationMinutes: 25,
          objectives: [
            'List realistic Salesforce rollback options and their limits',
            'Design an approval / separation-of-duties model',
            'Document go/no-go criteria tied to technical and business checks',
          ],
          sections: [
            {
              heading: 'Rollback is rarely “undeploy”',
              body:
                'Salesforce does not provide a universal undo for every metadata deploy. Practical strategies include: redeploying the previous Git tag, restoring specific components, feature toggles to disable behavior, compensating data scripts, and — in extreme cases — sandbox-based reconstruction.\n\nDesign releases to be forward-fixable: toggles, additive fields first, risky cutovers split into steps.',
            },
            {
              heading: 'Governance that enables speed',
              body:
                'Separation of duties: authors should not be the sole approvers of their production release. CAB or lightweight release managers gate high-risk changes; low-risk changes follow an expedited path with automated gates still mandatory.\n\nKeep an audit trail: commit SHA, pipeline run URL, validate results, approver, and release notes linked to work items.',
            },
            {
              heading: 'Go/no-go checklist',
              body:
                'Technical: green validate, required tests passed, no open Sev-1 defects, monitoring ready.\nBusiness: UAT sign-off, support staffing for the window, communications sent, rollback owner named.\n\nIf any mandatory box is unchecked, the default answer is no-go — not “we will hope.”',
            },
          ],
          realWorld: {
            title: 'Bad Flow floods the org with emails',
            scenario:
              'A record-triggered Flow deploys with a wrong entry condition and emails thousands of contacts. There is no instant “undeploy Flow” button the night team trusts.',
            solution:
              'The release playbook’s first rollback step is to deactivate the Flow via a known admin user / scripted toggle, then redeploy the previous metadata tag for a durable fix.',
            outcome:
              'Blast radius stops in minutes because rollback was a written procedure with owners — not an invent-on-the-call exercise.',
          },
          keyTakeaways: [
            'Plan rollback as forward-fix + redeploy previous tag',
            'Additive, toggled releases are easier to reverse',
            'Approvals and audit trails are part of delivery, not bureaucracy for its own sake',
            'No-go is a valid release outcome',
          ],
          resources: [
            {
              title: 'Change and Release Management (Architects)',
              url: 'https://architect.salesforce.com/decision-guides/development-lifecycle-and-deployment',
              source: 'architect',
            },
            {
              title: 'Monitor Deployments (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.deploy_monitoring.htm',
              source: 'help',
            },
          ],
        },
        {
          id: 'release-calendars-quality-gates',
          title: 'Release calendars and quality gates',
          summary:
            'Set a predictable cadence, freeze windows that make sense, and define gates that stop bad changes without freezing the company.',
          durationMinutes: 25,
          objectives: [
            'Build a release calendar with code freeze, UAT, and hypercare',
            'Define quality gates for PR, release candidate, and production',
            'Balance blackout dates with emergency hotfix paths',
          ],
          sections: [
            {
              heading: 'Cadence people can plan around',
              body:
                'Publish a calendar: feature cutoff, code freeze, UAT window, production slot, hypercare period. Align with Salesforce platform release blackout guidance and business blackouts (peak sales periods, financial close).\n\nPredictable cadence reduces shadow IT — teams stop sneaking changes when they trust the next train.',
            },
            {
              heading: 'Quality gates by stage',
              body:
                'PR gate: build + Apex tests + peer review (+ linters).\nRelease candidate gate: full validate in UAT, UAT sign-off, known-issue list.\nProduction gate: final validate, approval, monitoring plan, rollback owner.\n\nAutomate everything that can be automated; reserve humans for risk judgment and business acceptance.',
            },
            {
              heading: 'Emergency path without bypassing evidence',
              body:
                'Hotfixes still use Git and pipelines — just a shorter approval chain. Require a defect severity definition, minimal repro, accelerated tests (specified + critical suites), and a follow-up to add permanent coverage.\n\nNever normalize “click deploy in prod” as the hotfix process, or the normal gates will rot.',
            },
          ],
          realWorld: {
            title: 'Black Friday freeze without a hotfix valve',
            scenario:
              'Retail freezes all Salesforce change for two weeks. On day three a pricing bug blocks checkout-related Case workflows. Engineers argue in chat about breaking the freeze with a manual production edit.',
            solution:
              'The calendar already defines a Sev-1 hotfix path: branch from prod tag, accelerated pipeline, on-call release manager approval, hypercare checklist.',
            outcome:
              'The fix ships in under two hours with an audit trail — and the freeze remains intact for non-emergencies.',
          },
          keyTakeaways: [
            'Publish cadence: cutoff, freeze, UAT, prod, hypercare',
            'Stage-specific quality gates keep reviews focused',
            'Hotfixes need a fast path that still produces evidence',
            'Trust in the next release train reduces rogue production edits',
          ],
          resources: [
            {
              title: 'Development Models (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
            },
            {
              title: 'Release Management Practices (Architects)',
              url: 'https://architect.salesforce.com/',
              source: 'architect',
              note: 'Browse lifecycle & deployment guidance',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-rel-gov-1',
          topic: 'Rollback',
          prompt: 'Why is “just undeploy” rarely a complete Salesforce rollback plan?',
          options: [
            'Undeploy always works for every component',
            'Many changes lack a simple universal undo; teams redeploy prior source and use toggles/compensations',
            'Git forbids tags',
            'Apex cannot be redeployed',
          ],
          correctIndex: 1,
          explanation: 'Rollback is usually redeploy previous artifacts plus operational compensations.',
        },
        {
          id: 'q-rel-gov-2',
          topic: 'Design',
          prompt: 'Which release design is generally easier to reverse?',
          options: [
            'Destructive field deletes on day one with no toggle',
            'Additive changes behind a feature toggle',
            'Editing production directly with no branch',
            'Skipping UAT permanently',
          ],
          correctIndex: 1,
          explanation: 'Additive, toggled behavior can be turned off quickly while a durable fix ships.',
        },
        {
          id: 'q-rel-gov-3',
          topic: 'Governance',
          prompt: 'Separation of duties in release management means:',
          options: [
            'The author is the only required approver',
            'Authors are not sole approvers of their own production release',
            'Nobody may approve anything',
            'QA owns Git alone',
          ],
          correctIndex: 1,
          explanation: 'Independent approval reduces risk of unchecked self-deployment.',
        },
        {
          id: 'q-rel-gov-4',
          topic: 'Audit',
          prompt: 'A useful production release audit trail includes:',
          options: [
            'Only a verbal “looks good”',
            'Commit SHA, pipeline run, validate results, approver, release notes',
            'The developer’s favorite emoji',
            'A screenshot of Setup home',
          ],
          correctIndex: 1,
          explanation: 'Traceability ties production state to reviewed source and approvals.',
        },
        {
          id: 'q-rel-gov-5',
          topic: 'Go/no-go',
          prompt: 'If a mandatory UAT sign-off is missing at the window, the default should be:',
          options: [
            'Deploy anyway and monitor',
            'No-go until criteria are met or formally waived by policy',
            'Delete the tests',
            'Refresh production',
          ],
          correctIndex: 1,
          explanation: 'Go/no-go criteria exist to stop unsafe releases.',
        },
        {
          id: 'q-rel-gov-6',
          topic: 'Calendar',
          prompt: 'What does a code freeze typically mean on a release calendar?',
          options: [
            'Git is deleted',
            'Feature changes stop so the release candidate can harden',
            'All sandboxes are locked forever',
            'Apex tests are optional',
          ],
          correctIndex: 1,
          explanation: 'Freeze stabilizes scope while validation and UAT finish.',
        },
        {
          id: 'q-rel-gov-7',
          topic: 'Quality gates',
          prompt: 'Which gate belongs at pull request time?',
          options: [
            'Board of directors signature only',
            'Automated build/tests and peer review',
            'Full company all-hands approval',
            'Production data export',
          ],
          correctIndex: 1,
          explanation: 'PR gates catch issues before merge with automation + review.',
        },
        {
          id: 'q-rel-gov-8',
          topic: 'Hotfix',
          prompt: 'A healthy Sev-1 hotfix path should still:',
          options: [
            'Skip Git and edit production by hand',
            'Use pipeline + accelerated tests + recorded approval',
            'Disable all monitoring',
            'Avoid release notes',
          ],
          correctIndex: 1,
          explanation: 'Emergencies compress time, not evidence and traceability.',
        },
        {
          id: 'q-rel-gov-9',
          topic: 'Hypercare',
          prompt: 'Hypercare after a major release is for:',
          options: [
            'Ignoring production',
            'Heightened monitoring and rapid response while the change settles',
            'Deleting Apex tests',
            'Refreshing every sandbox simultaneously',
          ],
          correctIndex: 1,
          explanation: 'Hypercare staffs support/engineering attention immediately post-release.',
        },
        {
          id: 'q-rel-gov-10',
          topic: 'Cadence',
          prompt: 'Why does a trusted release train reduce rogue production edits?',
          options: [
            'People prefer chaos',
            'Teams wait for the next planned window when they believe it is reliable',
            'Salesforce blocks Setup after first release',
            'Change sets become illegal',
          ],
          correctIndex: 1,
          explanation: 'Predictable, trusted cadence removes the incentive to bypass process.',
        },
      ],
    },
  ],
};
