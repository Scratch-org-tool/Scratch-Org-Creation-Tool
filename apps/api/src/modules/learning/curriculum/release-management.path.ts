import type { CurriculumPath } from './curriculum.types';

/**
 * Advanced Salesforce Release Management.
 * Strategy, metadata and packaging, environments, delivery controls, operating
 * models, and recovery practices for source-driven Salesforce teams.
 */
export const releaseManagementPath: CurriculumPath = {
  id: 'salesforce-release-management',
  title: 'Salesforce Release Management',
  tagline: 'Move small, traceable changes safely from source to production.',
  description:
    'Build a release system rather than a release-day ritual. This path connects Git and release strategy to Salesforce metadata, packaging, environments, CI/CD quality gates, deployment operations, recovery, and measurable improvement. The practices are tool-neutral, risk-based, and designed for teams that need both delivery speed and strong controls.',
  level: 'advanced',
  badge: 'Salesforce Release Engineer',
  estimatedHours: 9,
  skills: [
    'Release strategy & traceability',
    'Git & trunk-based development',
    'Metadata API & packaging',
    'Environment strategy & drift control',
    'Salesforce CI/CD quality gates',
    'Deployment operations',
    'Recovery & feature flags',
    'Delivery performance measurement',
  ],
  modules: [
    {
      id: 'sf-release-strategy-source',
      title: 'Release Strategy, Source, and Packaging',
      summary:
        'Turn business change into small, versioned release units, then model Salesforce metadata and dependencies so those units can be promoted safely.',
      lessons: [
        {
          id: 'release-strategy-traceability',
          title: 'Release strategy: trunk, trains, versions, and evidence',
          summary:
            'Design a release cadence around short-lived Git branches, explicit risk, predictable trains, meaningful versions, and end-to-end traceability.',
          durationMinutes: 34,
          objectives: [
            'Choose an appropriate cadence and risk path for each class of Salesforce change',
            'Apply trunk-based development with short-lived branches and protected integration',
            'Use release trains and semantic versioning without confusing cadence, artifact, and package versions',
            'Trace a production deployment from business intent to immutable source and validation evidence',
          ],
          sections: [
            {
              heading: 'Start with value, risk, and a release policy',
              body:
                'Release management coordinates demand, technical change, and operational risk; it is not merely the final deployment command. Define a small set of change classes before choosing a branch model or tool. A help-text edit, a new additive field, an Apex transaction change, a sharing-model change, and a field deletion should not all follow identical paths. Give each class a minimum evidence set, approval level, environment path, and recovery requirement.\n\nPrefer small batches. Small changes reduce dependency collisions, shorten review, make a failed change easier to identify, and lower the cost of recovery. A useful policy states who owns the change, what user or business result it serves, the affected components and data, its risk class, required tests, activation plan, and stop conditions. Regulatory controls can require separation of duties without requiring a meeting for every low-risk change.',
            },
            {
              heading: 'Trunk-based development keeps integration continuous',
              body:
                'In trunk-based development, main is protected and releasable, while developers integrate through short-lived branches—normally hours or a few days, not an alternate code line maintained for weeks. Automated checks and peer review guard the merge. Feature flags or incomplete-but-inert metadata keep unfinished behavior from forcing long-lived branches. A release branch can be useful briefly to stabilize a train, but every extra long-lived branch creates merge, back-propagation, and “which version is real?” costs.\n\nSalesforce metadata makes branch hygiene especially important: decomposed source still produces conflicts in shared objects, flows, permission sets, and labels. Rebase or merge from main frequently, keep each pull request cohesive, and assign an explicit owner to resolve semantic XML conflicts. Passing XML syntax does not prove that two independently edited Flow versions still express the intended behavior.',
              code: {
                language: 'bash',
                snippet:
                  '# Create a short-lived branch from the protected trunk\ngit switch main\ngit pull --ff-only\ngit switch -c release-4821-order-routing\n\n# Integrate current trunk before opening the pull request\ngit fetch origin\ngit rebase origin/main\n\n# After review and CI merge the change through the repository UI.\n# Tag the exact production commit after successful promotion.\ngit tag -a sf-release-2026.07.2 <production-commit> \\\n  -m "Order routing release 2026.07.2"',
                caption:
                  'A short-lived branch and immutable production tag; repository protections, not a local command, perform the merge.',
              },
            },
            {
              heading: 'Release trains and versions answer different questions',
              body:
                'A release train is a predictable departure schedule: ready changes that meet the cutoff ride the train; changes that miss it wait rather than destabilize the release. Trains improve stakeholder planning and shared-environment coordination. They do not justify accumulating huge batches. Teams can integrate continuously and still activate or promote on a weekly train, while truly low-risk changes may use a faster path and emergency fixes use a governed hotfix lane.\n\nA version identifies content, not a meeting date. Semantic Versioning communicates compatibility for a product with a declared public contract: MAJOR for incompatible contract changes, MINOR for backward-compatible capability, and PATCH for backward-compatible fixes. Salesforce package versions also carry platform-specific version fields and ancestry rules, so do not infer installability from a SemVer label alone. Calendar-based train names are equally valid for org releases; map every human-friendly name to one source commit and one immutable artifact.',
            },
            {
              heading: 'Make traceability a generated release artifact',
              body:
                'Traceability should answer, without archaeology: why did this change exist, who approved it, what exact bytes moved, which checks passed, where did they move, and what happened afterward? Generate a release manifest from the pipeline. Record work items, source commit, signed or protected tag, artifact digest, component and destructive-change manifests, package version IDs where applicable, target-org identity, validation job, approvals, deployment result, and verification evidence.\n\nNever rebuild between UAT and production. Promote the same package version or content-addressed deployment bundle and apply target-specific configuration through an explicit, reviewed mechanism. A commit hash identifies source, while an artifact digest proves the deployed payload; retain both because generated manifests, conversion, or packaging can make the payload differ from a raw checkout.',
              code: {
                language: 'yaml',
                snippet:
                  'release:\n  id: sf-release-2026.07.2\n  sourceCommit: 4f6c2d1\n  artifactSha256: 8d60d6b6a50c3d7f-example\n  riskClass: medium\n  workItems: [CRM-4821, CRM-4830]\n  componentsManifest: manifest/package.xml\n  destructiveManifest: manifest/destructiveChangesPost.xml\n  packageVersions: []\n  targets:\n    - alias: production\n      validationJob: 0Af-example\n      approval: CAB-2026-0718\n      result: succeeded\n  verification:\n    evidence: evidence/sf-release-2026.07.2.json\n    owner: release-manager@example.invalid',
                caption:
                  'Illustrative, tool-neutral release evidence. Real manifests should use complete digests and durable evidence links.',
              },
            },
          ],
          realWorld: {
            title: 'From quarterly mega-release to a dependable weekly train',
            scenario:
              'A service organization kept feature branches open for six to ten weeks and combined roughly 120 work items into quarterly deployments. Shared Flow and permission-set conflicts appeared only during release hardening, and incident responders could not map the deployed ZIP back to a single reviewed commit.',
            solution:
              'The team protected main, limited branches to small vertical changes, introduced a weekly train with explicit cutoffs, and gave security-model and destructive changes a higher-risk path. Its pipeline generated a manifest tying every promoted artifact digest to work items, approvals, target validation, and a production tag.',
            outcome:
              'Within two quarters, the median batch fell from 120 work items to 11, late merge conflicts became exceptional, and the support team could identify the owning change and recovery plan from the release ID during the first minutes of an incident.',
          },
          keyTakeaways: [
            'Classify change risk and evidence needs instead of forcing every change through one path',
            'Keep main releasable with short-lived branches, protected merges, and flags for incomplete behavior',
            'Use release trains for cadence and versions for identity and compatibility',
            'Map every release name to exactly one source commit and immutable artifact digest',
            'Generate traceability from delivery events; do not reconstruct it manually after an incident',
          ],
          resources: [
            {
              title: 'Salesforce Well-Architected: Application Lifecycle Management',
              url: 'https://architect.salesforce.com/docs/architect/well-architected-tools/guide/adaptable-application-lifecycle-management',
              source: 'architect',
            },
            {
              title: 'Git: Branching Workflows',
              url: 'https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows',
              source: 'other',
            },
            {
              title: 'Semantic Versioning 2.0.0',
              url: 'https://semver.org/',
              source: 'other',
            },
          ],
        },
        {
          id: 'release-metadata-packaging',
          title: 'Metadata, destructive changes, and package boundaries',
          summary:
            'Build precise Salesforce deployment payloads, sequence dependencies, and choose deliberately between unpackaged, unlocked, and managed delivery.',
          durationMinutes: 38,
          objectives: [
            'Explain the relationship between Salesforce source format, Metadata API payloads, and package.xml manifests',
            'Sequence additive and destructive changes without breaking metadata or data dependencies',
            'Model hard and operational dependencies across deployable units',
            'Choose unpackaged, unlocked, or managed packaging based on ownership and distribution needs',
          ],
          sections: [
            {
              heading: 'A manifest is a payload boundary, not a dependency solver',
              body:
                'Salesforce DX source format decomposes complex metadata into reviewable files. Metadata API is the deployment interface for a broad set of platform metadata, and package.xml is a manifest that selects components for retrieve or deploy. The CLI can convert source format as needed. A manifest is valuable for producing a repeatable release boundary, but it does not discover every dependency or guarantee that selected metadata is complete.\n\nUse explicit members for controlled release payloads, review generated manifests, and check the Metadata Coverage Report for component support. Wildcards are convenient for baselines but can silently widen a release as an org grows. Keep the manifest API version aligned with a version supported by the target and intentionally tested by the project; an API bump is a release change, not routine text formatting.',
              code: {
                language: 'xml',
                snippet:
                  '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n  <types>\n    <members>OrderReleaseService</members>\n    <members>OrderReleaseServiceTest</members>\n    <name>ApexClass</name>\n  </types>\n  <types>\n    <members>Order__c.Release_Status__c</members>\n    <name>CustomField</name>\n  </types>\n  <version>67.0</version>\n</Package>',
                caption:
                  'An explicit Summer ’26 example. Pin and test the API version appropriate to the project and target org.',
              },
            },
            {
              heading: 'Destructive changes require ordering and recovery design',
              body:
                'Removing a local source file does not by itself instruct Metadata API to delete the component in an org. List removals in a destructive manifest; wildcards are not supported there. destructiveChangesPre.xml runs deletions before additions and updates, while destructiveChangesPost.xml runs them afterward. Post-destructive ordering fits a common refactor: first deploy code and permissions that no longer reference a field, then remove the field. Pre-destructive ordering fits the less common case where an old component blocks creation of its replacement.\n\nTreat deletion as a separate risk class. Inventory references in Apex, Flow, formulas, reports, integrations, permission sets, and data pipelines; archive source and export affected data; validate in a production-like org; and rehearse recovery. Post-destructive changes are processed before deployment tests, so passing tests is not proof that deleted data or operational dependencies are recoverable.',
              code: {
                language: 'xml',
                snippet:
                  '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n  <types>\n    <members>Order__c.Legacy_Route__c</members>\n    <name>CustomField</name>\n  </types>\n  <version>67.0</version>\n</Package>',
                caption:
                  'manifest/destructiveChangesPost.xml for a field removed only after consumers have been updated and its data archived.',
              },
            },
            {
              heading: 'Build and test the dependency graph',
              body:
                'Hard dependencies are compile- or deploy-time references: an Apex class needs its fields and classes, a permission set needs the component it grants, and an app needs its tabs. Operational dependencies can evade the compiler: a Flow expects reference data, an integration expects a Named Credential and remote endpoint, or a report expects a value introduced by a data migration. Map both kinds. Add providers before consumers; for removal, update or remove consumers before providers.\n\nPackage dependencies make some edges explicit, but package.xml deployments remain order-sensitive and the platform can still surface hidden references only at validation time. Keep foundational schema and shared contracts low in the graph, reject circular package dependencies, and exercise installation into a clean org. A successful incremental deployment into a mature sandbox can conceal an undeclared dependency already present there.',
              code: {
                language: 'json',
                snippet:
                  '{\n  "packageDirectories": [\n    {\n      "path": "packages/core",\n      "package": "Release Core",\n      "versionNumber": "2.3.0.NEXT",\n      "default": true\n    },\n    {\n      "path": "packages/orders",\n      "package": "Order Routing",\n      "versionNumber": "4.1.0.NEXT",\n      "dependencies": [\n        {\n          "package": "Release Core",\n          "versionNumber": "2.3.0.LATEST"\n        }\n      ]\n    }\n  ]\n}',
                caption:
                  'An illustrative sfdx-project.json fragment making the Orders-to-Core package edge explicit.',
              },
            },
            {
              heading: 'Choose packaging by lifecycle and ownership',
              body:
                'Unpackaged source deployment is a valid choice for org-specific metadata when the team needs flexible boundaries and owns the whole target. Unlocked packages add immutable package versions, declared dependencies, installation inventory, and upgrade semantics; Salesforce positions them especially for internal business applications. Subscribers can modify unlocked metadata, which is useful for customer control but makes drift governance essential.\n\nSecond-generation managed packages are designed for controlled distribution, especially AppExchange products. Namespaces, manageability rules, version ancestry, and protected implementation support a publisher-subscriber contract, but those constraints make later boundary mistakes expensive. Do not choose managed packaging merely to make an internal deployment look mature, and do not split an org into dozens of tiny unlocked packages before dependency boundaries are understood. A mixed model—stable shared capabilities packaged, tightly org-specific configuration source-deployed—is often the most maintainable.',
            },
          ],
          realWorld: {
            title: 'A “simple” field deletion that had twelve consumers',
            scenario:
              'A team planned to replace Legacy_Route__c and deleted its source file. Validation failed on an Apex reference; further review found two Flows, a permission set, three reports, an ETL mapping, and historical data still depending on the field.',
            solution:
              'The release engineer added the replacement field first, backfilled and reconciled data, migrated every consumer, and observed a release with no writes to the legacy field. A later release carried an explicit post-destructive manifest and archived data, while shared routing metadata moved into an unlocked base package with a declared application dependency.',
            outcome:
              'The deletion validated cleanly and no downstream job failed. The team added dependency inventory and a two-stage deprecation pattern to its destructive-change standard, preventing hidden consumers from being discovered during the production window.',
          },
          keyTakeaways: [
            'Source format improves reviewability; Metadata API and explicit manifests define deployable payloads',
            'package.xml selects components but does not infer a complete dependency graph',
            'Update consumers before post-destructive removal of their providers, and protect affected data separately',
            'Test dependencies in clean environments because mature sandboxes can hide missing prerequisites',
            'Use unlocked packages for internal modular delivery and managed packages for publisher-controlled distribution when their constraints fit',
          ],
          resources: [
            {
              title: 'Metadata API: Deploying and Retrieving Metadata',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm',
              source: 'developer',
            },
            {
              title: 'Metadata API: Deleting Components from an Org',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy_deleting_files.htm',
              source: 'developer',
            },
            {
              title: 'Salesforce DX: What Is an Unlocked Package?',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_unlocked_pkg_whats_a_package.htm',
              source: 'developer',
            },
            {
              title: 'Second-Generation Managed Packaging Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.pkg2_dev.meta/pkg2_dev/sfdx_dev_dev2gp.htm',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'release-strategy-q1',
          topic: 'Trunk-based development',
          prompt: 'Which working pattern best represents trunk-based development for a Salesforce team?',
          options: [
            'A permanent branch for every sandbox, merged at quarter end',
            'Short-lived branches merged frequently into a protected, releasable main branch',
            'Direct unreviewed commits to main because integration must be fast',
            'One release branch that becomes the source of truth after each deployment',
          ],
          correctIndex: 1,
          explanation:
            'Trunk-based development integrates small changes frequently through protected main; it does not require unreviewed commits or permanent environment branches.',
        },
        {
          id: 'release-strategy-q2',
          topic: 'Release trains',
          prompt: 'What is the central operating rule of a release train?',
          options: [
            'Every planned feature must ship even if a gate fails',
            'All teams keep branches open until the train date',
            'Ready changes depart on a predictable cadence; changes missing the cutoff take a later train',
            'Only emergency changes can be released between Salesforce seasonal upgrades',
          ],
          correctIndex: 2,
          explanation:
            'A train creates predictable departure times and protects the release by letting unready changes wait; it should not force unsafe scope.',
        },
        {
          id: 'release-strategy-q3',
          topic: 'Semantic versioning',
          prompt:
            'Under Semantic Versioning, a change that breaks a declared public contract normally increments which part?',
          options: ['MAJOR', 'MINOR', 'PATCH', 'Build metadata only'],
          correctIndex: 0,
          explanation:
            'SemVer reserves MAJOR for incompatible contract changes, MINOR for backward-compatible capability, and PATCH for backward-compatible fixes.',
        },
        {
          id: 'release-strategy-q4',
          topic: 'Traceability',
          prompt: 'Which pair most directly proves what reviewed content was promoted to production?',
          options: [
            'A release meeting invitation and a screenshot',
            'The sandbox name and the deployer’s username',
            'A work-item count and an approximate deployment time',
            'The source commit plus the immutable artifact or package-version digest/identifier',
          ],
          correctIndex: 3,
          explanation:
            'The commit identifies reviewed source and the artifact digest or immutable package version identifies the actual promoted payload.',
        },
        {
          id: 'release-strategy-q5',
          topic: 'Metadata manifests',
          prompt: 'What does package.xml do in a Metadata API workflow?',
          options: [
            'Selects metadata members for retrieval or deployment',
            'Automatically discovers every transitive dependency',
            'Deletes any component missing from the local repository',
            'Guarantees that the selected components compile in every target org',
          ],
          correctIndex: 0,
          explanation:
            'package.xml selects a payload boundary. Dependency discovery, deletion, and target validation require separate mechanisms.',
        },
        {
          id: 'release-strategy-q6',
          topic: 'Destructive changes',
          prompt:
            'An Apex class currently references a field that the same release will remove. What is the safe ordering?',
          options: [
            'Delete the field in destructiveChangesPre.xml, then compile the unchanged class',
            'Remove the field manually after production tests',
            'Deploy the class without the reference, then delete the field with post-destructive changes',
            'Omit the field from package.xml and assume it is deleted',
          ],
          correctIndex: 2,
          explanation:
            'The consumer must stop referencing the provider first; post-destructive changes then remove the field explicitly.',
        },
        {
          id: 'release-strategy-q7',
          topic: 'Dependencies',
          prompt: 'Why can an incremental deployment pass while installation into a clean org fails?',
          options: [
            'Clean orgs do not support Metadata API',
            'The mature org may already contain an undeclared dependency',
            'Package versions cannot be installed in scratch orgs',
            'Source format is only valid in production',
          ],
          correctIndex: 1,
          explanation:
            'Existing fields, permissions, configuration, or data can mask missing prerequisites; clean installation exposes the real dependency graph.',
        },
        {
          id: 'release-strategy-q8',
          topic: 'Packaging',
          prompt:
            'Which packaging choice best fits an internal application whose customer team must retain the ability to modify packaged metadata?',
          options: [
            'A second-generation managed package with protected implementation',
            'A first-generation managed package solely for namespace isolation',
            'An unmanaged package used as a repeatable upgrade mechanism',
            'An unlocked package, with governance for subscriber modifications',
          ],
          correctIndex: 3,
          explanation:
            'Unlocked packages are intended for modular internal delivery and allow subscriber modification; that flexibility must be paired with drift controls.',
        },
      ],
    },
    {
      id: 'sf-release-environments-pipeline',
      title: 'Environments, Promotion, and CI/CD Gates',
      summary:
        'Create reproducible Salesforce test contexts, control drift, and promote one artifact through automated and human quality gates.',
      lessons: [
        {
          id: 'release-environment-promotion',
          title: 'Environment strategy: reproducibility, data, and drift',
          summary:
            'Match scratch orgs and sandboxes to test purposes, seed safe deterministic data, detect drift, and promote artifacts instead of org state.',
          durationMinutes: 36,
          objectives: [
            'Assign scratch orgs and sandbox types to explicit development and test purposes',
            'Provision repeatable environments and deterministic, privacy-safe seed data',
            'Detect and reconcile metadata drift without treating an org as the release artifact',
            'Promote one immutable artifact through environments while separating target configuration',
          ],
          sections: [
            {
              heading: 'Design environments around test purpose and risk',
              body:
                'An environment exists to answer a question. Scratch orgs are disposable, source-defined environments well suited to isolated feature work, package development, and automated tests. Developer and Developer Pro sandboxes support persistent team work and can use source tracking when enabled. Partial Copy and Full sandboxes provide increasingly production-like data volume and integration conditions for regression, performance, migration, and user acceptance—but they cost more time and capacity to refresh and protect.\n\nDo not create a rigid “one branch equals one org” architecture or require every change to visit every environment. Route changes by risk and evidence needs. An additive permission-set description does not need the same journey as a sharing recalculation or bulk data migration. Record each environment’s purpose, owner, refresh/provisioning policy, data classification, connected systems, release-version policy, and concurrency limit.',
            },
            {
              heading: 'Make scratch-org provisioning executable',
              body:
                'A scratch-org definition captures edition, features, and settings; source and setup scripts complete the environment. Keep definitions in version control and maintain variants only for real product shapes, such as person accounts or an optional industry feature. Org Shape can help reproduce enabled features and settings, but it does not clone production metadata, data, limits, credentials, or every runtime condition.\n\nProvision from an authorized Dev Hub, deploy or install dependencies in graph order, assign permission sets, seed data, run smoke tests, and always delete temporary orgs. Pin CLI and plugin versions in CI where practical. Reproducibility means a failed build can be investigated from its definition and logs, not that every external service will behave identically.',
              code: {
                language: 'json',
                snippet:
                  '{\n  "orgName": "Order Routing Release Lab",\n  "edition": "Enterprise",\n  "features": ["PersonAccounts"],\n  "settings": {\n    "lightningExperienceSettings": {\n      "enableS1DesktopEnabled": true\n    }\n  }\n}',
                caption:
                  'A minimal project-scratch-def.json example; include only features and settings the test actually requires.',
              },
            },
            {
              heading: 'Seed scenarios, not a production copy',
              body:
                'Good seed data is deterministic, minimal, referentially complete, and labeled by scenario. Use stable external IDs so imports are idempotent; create boundary cases such as zero lines, maximum discount, duplicate external key, restricted user, and failed integration response. Version seed schemas with the feature and make tests refer to scenario keys rather than Salesforce record IDs.\n\nUse synthetic data by default. When realistic production-derived data is required in a sandbox, apply approved masking and minimization before broad access, and never copy secrets, tokens, personal data, or live outbound endpoints into a developer seed. A Full sandbox is not automatically safe merely because it is non-production. Disable or redirect integrations, scheduled jobs, emails, and payment-like side effects as part of refresh automation.',
              code: {
                language: 'bash',
                snippet:
                  'set -euo pipefail\nORG_ALIAS="release-order-routing-${BUILD_ID}"\n\nsf org create scratch \\\n  --definition-file config/project-scratch-def.json \\\n  --alias "$ORG_ALIAS" --duration-days 3\nsf project deploy start --source-dir force-app --target-org "$ORG_ALIAS"\nsf org assign permset --name Order_Routing_Tester --target-org "$ORG_ALIAS"\nsf data import tree --plan data/order-routing-plan.json --target-org "$ORG_ALIAS"\nsf apex run test --target-org "$ORG_ALIAS" --test-level RunLocalTests --wait 30\nsf org delete scratch --target-org "$ORG_ALIAS" --no-prompt',
                caption:
                  'A fail-fast, disposable build flow. A production pipeline should also guarantee cleanup when an earlier command fails.',
              },
            },
            {
              heading: 'Control drift and promote artifacts—not orgs',
              body:
                'Drift is a difference between the authoritative release state and a target org. It can be authorized, such as an emergency production fix; expected, such as environment-specific endpoints; platform-generated; or unauthorized. Run scheduled comparisons for governed metadata, classify differences, and either back-propagate approved changes through review or restore the target from source. Never “fix” drift by blindly retrieving an entire org over main.\n\nPromotion should move the same unlocked or managed package version, or the same hashed deployment bundle, through integration, UAT, and production. Rebuilding at each stage invalidates prior evidence. Keep target configuration—Named Credential principals, certificates, endpoint values, and protected secrets—outside the generic artifact or apply it through a separately controlled configuration contract. Validate each target because org capabilities and installed dependencies differ even when the payload is identical.',
              code: {
                language: 'yaml',
                snippet:
                  'promotion:\n  releaseId: sf-release-2026.07.2\n  artifact:\n    uri: artifacts/sf-release-2026.07.2.zip\n    sha256: 8d60d6b6a50c3d7f-example\n    rebuildBetweenStages: false\n  stages:\n    - target: integration\n      purpose: automated-integration\n    - target: uat\n      purpose: business-acceptance\n    - target: production\n      purpose: live\n  targetConfiguration:\n    source: controlled-environment-store\n    includedInArtifact: false',
                caption:
                  'The artifact identity remains fixed; each target still receives its own validation and controlled configuration.',
              },
            },
          ],
          realWorld: {
            title: 'The UAT sandbox that lied',
            scenario:
              'A deployment passed UAT but failed in a newly refreshed staging sandbox. UAT contained an old manually created field and reference record that were absent from Git, so the release had unknowingly depended on drift for months.',
            solution:
              'The team classified and removed UAT drift, added the missing schema dependency to the base package, and converted the reference record into an idempotent seed keyed by an external ID. It began nightly governed-metadata comparisons and rebuilt feature validation in disposable scratch orgs.',
            outcome:
              'Clean-environment validation exposed dependency mistakes before shared testing, UAT stopped acting as an accidental source of truth, and approved emergency changes were back-propagated to main within one business day.',
          },
          keyTakeaways: [
            'Give every environment an explicit test purpose, owner, data policy, and lifecycle',
            'Use scratch orgs for disposable source-defined isolation; use sandboxes when persistence or production-like data is the test requirement',
            'Seed deterministic scenarios with external IDs and protect non-production data and integrations',
            'Classify drift, review authorized changes back into source, and reject blind org-to-repo overwrites',
            'Promote one immutable artifact and validate it separately against every target',
          ],
          resources: [
            {
              title: 'Salesforce Well-Architected: Resilient Application Lifecycle',
              url: 'https://architect.salesforce.com/docs/architect/well-architected/guide/resilient',
              source: 'architect',
            },
            {
              title: 'Salesforce DX Developer Guide: Scratch Orgs',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs.htm',
              source: 'developer',
            },
            {
              title: 'Salesforce CLI: Data Commands',
              url: 'https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_data_commands_unified.html',
              source: 'developer',
            },
          ],
        },
        {
          id: 'release-cicd-quality-gates',
          title: 'CI/CD pipeline gates, validation, and approvals',
          summary:
            'Layer fast static checks, risk-based tests, target validation, immutable evidence, and accountable approvals into a delivery pipeline.',
          durationMinutes: 40,
          objectives: [
            'Design a build-once Salesforce pipeline with progressively stronger quality gates',
            'Combine metadata checks, static analysis, security controls, and dependency validation',
            'Select fast impacted tests without weakening promotion confidence or Salesforce coverage rules',
            'Use production validation, quick deploy, and human approval as distinct controls',
          ],
          sections: [
            {
              heading: 'Build once and increase confidence by stage',
              body:
                'A pipeline should reject cheap failures early and reserve scarce org time for changes that passed. A practical sequence is: normalize and inspect the change; verify manifest and destructive scope; scan secrets and dependencies; run LWC/unit tests and static analysis; deploy to a disposable or integration org; run impacted integration tests; build and hash the release artifact; validate that artifact in higher targets; collect approval; deploy; verify; and publish evidence.\n\nSeparate continuous integration from production release. Every pull request should integrate and prove basic correctness, while a policy decides whether an approved artifact is automatically delivered or waits for a train or change window. Credentials use short-lived or tightly scoped authentication, logs redact secrets, and only the deployment identity receives production metadata permissions.',
              code: {
                language: 'yaml',
                snippet:
                  'pipeline:\n  - stage: inspect\n    gates: [format, manifest-scope, secret-scan, dependency-policy]\n  - stage: verify\n    gates: [lwc-unit, apex-impacted, static-analysis, scratch-deploy]\n  - stage: package\n    outputs: [immutable-artifact, sha256, release-manifest]\n  - stage: validate-uat\n    input: immutable-artifact\n    gates: [integration-tests, business-acceptance]\n  - stage: validate-production\n    input: immutable-artifact\n    gates: [salesforce-validation, operational-readiness]\n  - stage: release\n    gates: [risk-based-approval, change-window]\n  - stage: observe\n    gates: [technical-smoke, business-smoke, error-budget]',
                caption:
                  'A vendor-neutral pipeline contract: each later stage consumes the artifact produced once by package.',
              },
            },
            {
              heading: 'Quality gates need policies, not vanity scores',
              body:
                'Static gates should cover XML/schema validity, duplicate or missing members, unsupported metadata, dependency direction, secret patterns, Apex and JavaScript quality, security rules, and destructive-change review. Salesforce Code Analyzer can combine engines for Apex and Lightning code; ESLint and Jest cover LWC concerns. Pin rule configuration, severity threshold, and engine versions so a pipeline result is reproducible.\n\nA legacy org may need a ratchet: record an approved baseline, block new critical/high findings immediately, and reduce existing debt with owners and deadlines. Never lower a gate silently to make a release pass. Suppressions need a narrow rule, code location, reason, approver, and expiry. Static analysis cannot prove business correctness, authorization behavior, data migration safety, or runtime performance, so it complements rather than replaces tests.',
            },
            {
              heading: 'Select tests from impact, then add defense in depth',
              body:
                'Fast feedback can map changed Apex, Flows, LWCs, objects, and permissions to owning tests. Include tests for direct references, shared transaction boundaries, security personas, bulk behavior, and historically fragile areas. Run LWC unit tests and pure logic tests without an org; use scratch or integration orgs for metadata and cross-component behavior. Run a broader suite on a schedule and before high-risk promotion to catch gaps in the impact map.\n\nSalesforce production deployment rules still apply. RunLocalTests excludes tests originating from installed managed packages and namespaced unlocked packages; RunAllTestsInOrg includes them. RunSpecifiedTests can shorten a carefully analyzed deployment, but the selected tests must give each Apex class and trigger in the deployment at least 75% coverage individually—not merely preserve overall org coverage. Test selection is an evidence-backed optimization, never “the three tests that happen to pass.”',
              code: {
                language: 'bash',
                snippet:
                  '# Validate the frozen production payload and run the selected tests.\nsf project deploy validate \\\n  --manifest manifest/package.xml \\\n  --post-destructive-changes manifest/destructiveChangesPost.xml \\\n  --target-org production \\\n  --test-level RunSpecifiedTests \\\n  --tests OrderReleaseServiceTest \\\n  --tests OrderReleaseSecurityTest \\\n  --wait 120\n\n# After approval, use the successful validation job returned above.\nsf project deploy quick \\\n  --job-id 0AfXXXXXXXXXXXXXXX \\\n  --target-org production --wait 120',
                caption:
                  'Illustrative sf CLI validation and quick deploy. The real pipeline captures the returned job ID rather than hard-coding one.',
              },
            },
            {
              heading: 'Validation, quick deploy, and approval are separate gates',
              body:
                'sf project deploy validate runs a check-only deployment with Apex tests against production and returns a job ID. A successful validation can currently be quick-deployed to that production org for ten days, avoiding a second test run; confirm job status and eligibility at release time. Quick deploy reduces release-window execution time, but it does not replace data backup, integration readiness, feature activation, post-deploy steps, or verification.\n\nAn approval answers a judgment question automation cannot: is the residual risk acceptable now? Present the approver with frozen scope, risk classification, unresolved findings, validation age and target, destructive/data operations, recovery decision, business owner, support coverage, and stop thresholds. Apply separation of duties where policy requires it, but keep low-risk approvals asynchronous and evidence-driven. Any artifact or destructive-scope change after approval invalidates both approval and prior evidence.',
            },
          ],
          realWorld: {
            title: 'A fast pipeline that was fast only when nothing changed',
            scenario:
              'A team ran the full org test suite on every pull request, so feedback took more than two hours. Developers batched commits and bypassed CI for “urgent” changes. Production deployment then repeated the same suite during a narrow window, while static-analysis findings were copied into a spreadsheet no gate consumed.',
            solution:
              'The team introduced deterministic impacted-test mapping plus scratch deployment at pull-request time, blocked new high-severity findings, and retained broad nightly and promotion suites. It built one hashed payload, validated that exact payload in production before the window, and required an evidence-based approval before quick deploy.',
            outcome:
              'Median pull-request feedback fell below twenty minutes without reducing promotion coverage, bypasses stopped, and production execution became a short controlled action. Failed checks were visible at the change that introduced them rather than in a release-day spreadsheet.',
          },
          keyTakeaways: [
            'Fail cheaply first, then spend org and human capacity on progressively stronger evidence',
            'Build and hash one artifact; every validation and deployment must refer to that identity',
            'Ratchet legacy static-analysis debt while blocking new severe findings',
            'Use impacted tests for feedback and broad suites for defense in depth',
            'Treat production validation, risk acceptance, quick deploy, and post-deploy verification as distinct controls',
          ],
          resources: [
            {
              title: 'Salesforce CLI: project deploy validate',
              url: 'https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_validate.html',
              source: 'developer',
            },
            {
              title: 'Salesforce CLI: project deploy quick',
              url: 'https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_quick.html',
              source: 'developer',
            },
            {
              title: 'Salesforce Code Analyzer',
              url: 'https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/overview',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'release-pipeline-q1',
          topic: 'Environment fit',
          prompt: 'Which environment best fits isolated, source-defined feature validation created on demand?',
          options: ['A Full sandbox', 'Production in maintenance mode', 'A scratch org', 'A Partial Copy sandbox'],
          correctIndex: 2,
          explanation:
            'Scratch orgs are temporary and source-defined, making them a strong fit for isolated feature and automated validation.',
        },
        {
          id: 'release-pipeline-q2',
          topic: 'Sandbox strategy',
          prompt: 'When is a Full or Partial Copy sandbox more appropriate than a scratch org?',
          options: [
            'When testing needs production-like data relationships, volume, or integrations',
            'Whenever a developer wants faster provisioning',
            'When no data privacy controls are available',
            'When the repository is not the source of truth',
          ],
          correctIndex: 0,
          explanation:
            'Copy sandboxes serve tests needing realistic data or persistent integration context, subject to masking and side-effect controls.',
        },
        {
          id: 'release-pipeline-q3',
          topic: 'Data seeding',
          prompt: 'What makes a Salesforce seed process safely repeatable?',
          options: [
            'Hard-coded record IDs copied from production',
            'A fresh random schema for every run',
            'Live customer data and active outbound endpoints',
            'Deterministic scenarios upserted by stable external IDs',
          ],
          correctIndex: 3,
          explanation:
            'Stable scenario keys and external IDs support idempotent loading without dependence on org-specific record IDs.',
        },
        {
          id: 'release-pipeline-q4',
          topic: 'Drift',
          prompt: 'An authorized emergency metadata fix was made in production. What should happen next?',
          options: [
            'Leave it only in production because the incident is closed',
            'Retrieve the entire production org and overwrite main',
            'Capture the focused change, review it into source, and reconcile downstream environments',
            'Refresh every sandbox before documenting it',
          ],
          correctIndex: 2,
          explanation:
            'Authorized hotfix drift must be back-propagated through normal review so source and future releases remain authoritative.',
        },
        {
          id: 'release-pipeline-q5',
          topic: 'Static-analysis gates',
          prompt: 'What is a defensible way to introduce static analysis into a legacy codebase?',
          options: [
            'Block new severe findings and ratchet an owned, expiring baseline downward',
            'Ignore all findings until the entire backlog is fixed',
            'Change rule versions on every run',
            'Suppress any rule that delays a release without recording why',
          ],
          correctIndex: 0,
          explanation:
            'A controlled baseline prevents new debt immediately while making existing debt visible and progressively smaller.',
        },
        {
          id: 'release-pipeline-q6',
          topic: 'Test selection',
          prompt: 'What is the safest role for impacted-test selection?',
          options: [
            'It permanently replaces broad regression testing',
            'It provides fast feedback, supplemented by broader scheduled and promotion suites',
            'It selects only tests modified in the same commit',
            'It bypasses Salesforce production code-coverage rules',
          ],
          correctIndex: 1,
          explanation:
            'Impact analysis speeds the inner loop, while broad suites protect against incomplete dependency maps and still satisfy target requirements.',
        },
        {
          id: 'release-pipeline-q7',
          topic: 'RunSpecifiedTests',
          prompt:
            'For a production deployment using RunSpecifiedTests, what Apex coverage rule is especially important?',
          options: [
            'Only the org-wide average must exceed 50%',
            'Tests from installed managed packages must always be selected',
            'Every Flow needs an Apex test with 100% coverage',
            'Selected tests must cover each deployed Apex class and trigger by at least 75%',
          ],
          correctIndex: 3,
          explanation:
            'RunSpecifiedTests applies the 75% requirement individually to each Apex class and trigger in the deployment package.',
        },
        {
          id: 'release-pipeline-q8',
          topic: 'Validation and quick deploy',
          prompt: 'Which statement about Salesforce quick deploy is accurate?',
          options: [
            'It deploys any new payload after an approver checks a box',
            'It uses a successful validation of the same payload and production org within the job’s validity window',
            'It is the required deployment method for sandboxes',
            'It eliminates the need for post-deploy verification',
          ],
          correctIndex: 1,
          explanation:
            'Quick deploy executes an eligible successful production validation job; it does not widen scope or replace operational controls.',
        },
      ],
    },
    {
      id: 'sf-release-operations-recovery',
      title: 'Release Operations, Recovery, and Improvement',
      summary:
        'Operate native or third-party delivery tooling through one control model, execute repeatable runbooks, recover deliberately, and learn from production signals.',
      lessons: [
        {
          id: 'release-tooling-runbooks',
          title: 'Delivery tooling, runbooks, and change windows',
          summary:
            'Apply consistent release controls through DevOps Center, Gearset, Copado, or composable CI, then make production execution explicit and rehearsable.',
          durationMinutes: 35,
          objectives: [
            'Evaluate Salesforce release tools by operating capability and control fit rather than vendor claims',
            'Keep Git, artifact identity, and evidence authoritative across native and third-party tooling',
            'Write an executable deployment runbook with owners, commands, decisions, and stop conditions',
            'Choose risk-based change windows and coordinate business, platform, and integration readiness',
          ],
          sections: [
            {
              heading: 'Choose an operating model before choosing a tool',
              body:
                'A sound release system needs work-to-change traceability, source control, metadata-aware comparison, dependency handling, automated validation, test and analysis integration, approvals, credential control, promotion evidence, and recovery support. Decide which capabilities matter, who operates them, and what evidence must leave the system before evaluating products. A polished deployment diff does not compensate for an unclear source of truth or an unowned hotfix path.\n\nSalesforce DevOps Center provides a native, work-item-oriented path to source-controlled changes and staged promotion. Third-party platforms such as Gearset and Copado commonly add their own metadata comparison, pipeline, orchestration, testing, backup, or governance patterns. A composable CLI pipeline can provide the same control primitives with more engineering ownership. Product coverage, integrations, licensing, and behavior evolve; validate them against a representative metadata set, branch model, identity architecture, audit requirement, and failure drill rather than assuming feature parity.',
            },
            {
              heading: 'Use one release contract across control planes',
              body:
                'Teams often create split-brain delivery: admins promote in one UI, developers deploy from CI, and incident responders run local CLI commands. Multiple interfaces can coexist, but they must write to one governed flow. Git remains authoritative for intended metadata; package version or artifact digest identifies deployable content; the pipeline policy defines gates; and a release record collects evidence from every adapter.\n\nRequire external tools to consume reviewed source and emit machine-readable status. Use service identities rather than personal credentials, least privilege per stage, and immutable logs exported to the audit retention boundary. Define how a tool-created branch is reviewed, how merge conflicts are surfaced, how emergency changes return to trunk, and how the organization exits the tool without losing release history.',
              code: {
                language: 'yaml',
                snippet:
                  'releaseContract:\n  id: sf-release-2026.07.2\n  intent:\n    workItems: [CRM-4821]\n    businessOwner: service-operations\n  source:\n    repository: crm-platform\n    commit: 4f6c2d1\n  artifact:\n    digest: sha256:8d60d6b6a50c3d7f-example\n  controls:\n    riskClass: medium\n    requiredGates: [peer-review, static-analysis, apex-tests, prod-validation]\n    approverRole: release-manager\n  adapters:\n    promotionTool: selected-control-plane\n    deploymentApi: salesforce-metadata-api\n  evidenceUri: evidence/sf-release-2026.07.2.json',
                caption:
                  'A portable contract keeps release identity and controls stable even if the orchestration product changes.',
              },
            },
            {
              heading: 'A deployment runbook is a decision system',
              body:
                'A useful runbook is specific enough for a qualified person who did not author the change. State scope and artifact digest; roles and contact path; prerequisites; target identity; backups; integration, batch, and user readiness; exact automated job or commands; expected durations; validation IDs; ordered data or activation steps; smoke checks; observation period; stop thresholds; recovery actions; and evidence links. Mark which steps are automated and which require judgment.\n\nRehearse high-risk runbooks in a production-like environment, including the abort path. Use timestamps and named owners, not “the team checks logs.” Make commands idempotent or declare when they are not. Never paste secrets into a runbook. Store the durable procedure in version control and generate the release-specific values from the manifest so operators do not manually transcribe commit IDs or component lists.',
              code: {
                language: 'yaml',
                snippet:
                  'runbook:\n  releaseId: sf-release-2026.07.2\n  artifactDigest: sha256:8d60d6b6a50c3d7f-example\n  roles:\n    commander: release-manager\n    deployer: production-service-identity\n    verifier: service-owner\n  prechecks:\n    - production validation job is successful and eligible\n    - async order queue is below 500\n    - backup job completed successfully\n  execute:\n    - quick deploy validation job 0Af-example\n    - assign feature permission to pilot group\n  stopIf:\n    - deployment reports any component failure\n    - order error rate exceeds 2 percent for 5 minutes\n  verify:\n    - create and cancel a synthetic order\n    - confirm integration correlation ID in downstream system\n  recovery: disable pilot permission, then follow recovery-runbook-17',
                caption:
                  'Concrete thresholds and owners turn a checklist into an executable decision record.',
              },
            },
            {
              heading: 'Change windows are a risk treatment, not a ceremony',
              body:
                'Choose a window when user traffic, Salesforce maintenance, integrations, scheduled and batch work, data loads, support coverage, and business deadlines make the residual risk acceptable. High-risk schema deletion or a data conversion may require a quiet period and staffed bridge; a prevalidated, additive, flagged change may be safer during normal staffed hours. Avoid peak business periods, but do not default every release to 2 a.m. when decision-makers and engineers are exhausted.\n\nFreeze the artifact before the go/no-go review. Publish expected user impact, support routing, start and end times, owners, and status channel. At the window, verify Salesforce Trust and target identity, pause only the jobs named in the runbook, execute, observe for the defined period, and explicitly close or invoke recovery. A freeze that allows “one tiny extra fix” after validation is not a freeze.',
            },
          ],
          realWorld: {
            title: 'Three deployment tools, no shared release truth',
            scenario:
              'Admins promoted with a graphical comparison tool, developers used a CI script, and emergency fixes came from laptops. All methods could deploy successfully, but they used different manifests and evidence stores. During an outage, nobody knew whether the production class came from the approved train or a later hotfix.',
            solution:
              'The organization retained role-appropriate interfaces but imposed one release contract: reviewed Git commit, immutable payload digest, central risk policy, service identities, and a shared evidence record. It wrote and rehearsed a production runbook with target checks, stop thresholds, business verification, and a mandatory hotfix backflow step.',
            outcome:
              'The next audit traced every production component change to one release ID, while admins kept a usable UI and developers kept automation. A later failed smoke check was stopped within the observation window because ownership and thresholds were explicit.',
          },
          keyTakeaways: [
            'Evaluate release tooling against required controls, metadata coverage, integrations, auditability, and failure behavior',
            'Allow multiple interfaces only when they honor one source, artifact identity, policy, and evidence contract',
            'Use service identities, least privilege, durable logs, and a tested tool-exit path',
            'Write runbooks with exact owners, order, thresholds, expected results, and recovery decisions',
            'Set change windows by residual risk and staffing, then freeze the validated artifact',
          ],
          resources: [
            {
              title: 'Salesforce DevOps Center Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.devops_center_dev.meta/devops_center_dev/devops_center_dev_overview.htm',
              source: 'developer',
            },
            {
              title: 'Salesforce DevOps Developer Center',
              url: 'https://developer.salesforce.com/developer-centers/devops',
              source: 'developer',
            },
            {
              title: 'Gearset Pipelines Documentation',
              url: 'https://docs.gearset.com/en/collections/10441566-pipelines',
              source: 'other',
            },
            {
              title: 'Copado Documentation',
              url: 'https://docs.copado.com/home/en-us/',
              source: 'other',
            },
          ],
        },
        {
          id: 'release-recovery-improvement',
          title: 'Recovery, verification, observability, and delivery improvement',
          summary:
            'Engineer reversible behavior, a controlled hotfix lane, production verification, and feedback using current DORA-style delivery measures.',
          durationMinutes: 42,
          objectives: [
            'Choose between disable, revert, restore, and forward-fix recovery strategies',
            'Design testable Salesforce feature flags and a governed hotfix lane',
            'Verify technical and business outcomes after deployment with release-correlated signals',
            'Use current DORA-style metrics to improve the delivery system without gaming teams',
          ],
          sections: [
            {
              heading: 'Recovery is broader than metadata rollback',
              body:
                'A successful Salesforce metadata deployment has no universal one-click undo. Reverting source and redeploying can restore many classes, Flows, and configuration components, but it cannot un-delete business data, reverse an external side effect, or guarantee that a previous package version can be installed over a newer one. Destructive metadata, schema conversion, permission exposure, data migration, and outbound integration each need a specific recovery mechanism.\n\nChoose the fastest safe action: disable behavior with a flag; revert compatible metadata; restore data from a tested backup; compensate an external transaction; or fix forward when reversal is more dangerous. Record a recovery point objective for the release and the decision threshold before deployment. Backups count only when ownership, retention, restore procedure, and restore testing are known.',
              code: {
                language: 'bash',
                snippet:
                  '# Prepare a reviewable metadata reversal from the production commit.\ngit switch -c release-hotfix-revert-order-routing sf-release-2026.07.2\ngit revert --no-commit <change-commit>\n\n# Validate the resulting reversal payload before production execution.\nsf project deploy validate \\\n  --source-dir force-app/main/default/classes/OrderReleaseService.cls \\\n  --target-org production \\\n  --test-level RunSpecifiedTests \\\n  --tests OrderReleaseServiceTest --wait 120',
                caption:
                  'A metadata reversal still goes through review and validation; data and external effects require separate recovery steps.',
              },
            },
            {
              heading: 'Feature flags separate deployment from exposure',
              body:
                'A feature flag lets the team deploy inert capability, expose it to a pilot, expand it, or disable it without rebuilding the artifact. Custom Permissions work well for user- or persona-scoped behavior and can be checked in Apex with FeatureManagement.checkPermission or in Flow formulas with $Permission. Custom Metadata can hold system-wide mode, thresholds, or cohorts. Keep authorization and rollout concerns distinct: a release flag must not accidentally grant data access.\n\nEvery flag needs an owner, safe default, activation and kill procedure, telemetry, tests for on and off states, and an expiry date. Evaluate the flag before irreversible work, and define behavior for asynchronous jobs whose initiating user differs from the eventual execution context. Remove stale flags after rollout; nested permanent flags create an untestable second architecture.',
              code: {
                language: 'apex',
                snippet:
                  'public with sharing class OrderRouter {\n    public static RoutingResult route(Order__c orderRecord) {\n        if (!FeatureManagement.checkPermission(\'Use_New_Order_Routing\')) {\n            return LegacyOrderRouter.route(orderRecord);\n        }\n\n        return NewOrderRouter.route(orderRecord);\n    }\n}',
                caption:
                  'A Custom Permission scopes exposure by assigned user; both routing paths need tests and operational signals.',
              },
            },
            {
              heading: 'The hotfix lane is fast because it is prepared',
              body:
                'Branch a hotfix from the exact production tag or commit, not from unreleased main. Keep scope minimal, link the incident, run the required static, test, security, and target-validation gates, and use an expedited named approval. Tag and record the deployed result. Then merge the exact fix back into main and any active release line immediately so the next normal release cannot reintroduce the defect.\n\nExpedited does not mean invisible. Pre-authorize who can invoke the lane, what severity qualifies, which gates may be shortened, how compensating review occurs, and how credentials are obtained. Exercise the lane periodically with a harmless scenario. If every inconvenient deadline becomes an emergency, fix the normal path rather than normalizing bypasses.',
            },
            {
              heading: 'Verify outcomes and correlate production signals',
              body:
                'Deployment success proves that the platform accepted metadata, not that users can complete the intended journey. Begin with technical checks: deployment result, Apex and Flow errors, asynchronous queue health, scheduled work, integration acknowledgments, permission access, and data-migration reconciliation. Then run safe business checks such as quote creation, case routing, or order cancellation with synthetic records and cleanup. Compare a defined baseline and observe through the risk-appropriate window.\n\nInstrument release ID and correlation ID where logs, events, and integrations permit it. Salesforce Event Monitoring can provide events such as unexpected Apex exceptions, with access and retention depending on current entitlements; Flow error handling, platform-event dead-letter/retry behavior, external API monitoring, and business reconciliation add other views. Define alert owner and threshold before release. Debug logs alone are temporary diagnostic data, not a production observability strategy.',
              code: {
                language: 'yaml',
                snippet:
                  'postDeployVerification:\n  releaseId: sf-release-2026.07.2\n  observationMinutes: 30\n  checks:\n    - name: synthetic-order-round-trip\n      owner: service-operations\n      expected: completed-and-cancelled\n      timeoutSeconds: 90\n    - name: order-routing-error-rate\n      owner: on-call-engineer\n      threshold: "< 2% over 5 minutes"\n    - name: downstream-reconciliation\n      owner: integration-operations\n      expected: "source count equals acknowledged count"\n  onFailure:\n    action: disable-feature-flag\n    incidentSeverity: SEV-2',
                caption:
                  'Verification combines a user journey, technical threshold, and cross-system business reconciliation.',
              },
            },
            {
              heading: 'Improve the system with DORA-style measures',
              body:
                'Current DORA guidance uses five software-delivery performance measures. Throughput comprises change lead time (commit to successful production), deployment frequency, and failed deployment recovery time. Instability comprises change fail rate (deployments needing immediate intervention) and deployment rework rate (unplanned deployments that remediate production problems). Measure at a service or product boundary with consistent event definitions; a Salesforce org containing many products should not collapse every team into one misleading average.\n\nUse measures for learning, never individual targets. Correlate commit, artifact, deployment, incident, recovery, and rework events by release ID. Segment by risk class and watch trends: a shorter lead time accompanied by rising failure and rework is not improvement. Review failed gates and incidents, choose one constraint—oversized batches, flaky tests, approval queues, environment contention, slow recovery—and test a process change. Smaller batches, reliable automation, and rehearsed recovery often improve speed and stability together.',
            },
          ],
          realWorld: {
            title: 'A release that deployed cleanly but routed orders twice',
            scenario:
              'A new routing path passed deployment and Apex tests, but a retry interaction with middleware created duplicate routing requests. The deployment dashboard stayed green while operations noticed duplicates twenty minutes later. Reverting Apex would not cancel requests already accepted downstream.',
            solution:
              'The release commander disabled the new path through its Custom Permission, stopped new duplicates, and ran a compensating reconciliation with the integration owner. A minimal hotfix from the production tag added an idempotency key, passed the expedited pipeline, and was merged back to main. Post-deploy checks gained a source-to-acknowledgment count and release correlation ID.',
            outcome:
              'Service was stabilized before a metadata reversal could have completed, all duplicate requests were identified, and the next release detected a simulated retry in its observation window. The retrospective tracked the event as both a change failure and a rework deployment, then prioritized idempotency tests over adding another approval.',
          },
          keyTakeaways: [
            'Plan recovery separately for metadata, data, permissions, packages, and external side effects',
            'Feature flags provide rapid exposure control only when both states, ownership, telemetry, and removal are designed',
            'Branch hotfixes from production, retain essential gates, and merge the deployed fix back immediately',
            'Verify user and business outcomes after platform deployment success',
            'Correlate observability with release IDs and define thresholds, owners, and actions in advance',
            'Use DORA’s current five measures to find system constraints, not to rank people or reward gaming',
          ],
          resources: [
            {
              title: 'Salesforce Architects: Record-Triggered Automation Decision Guide',
              url: 'https://architect.salesforce.com/docs/architect/decision-guides/guide/record-triggered',
              source: 'architect',
            },
            {
              title: 'Apex Unexpected Exception Event Type',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_eventlogfile_apexunexpectedexception.htm',
              source: 'developer',
            },
            {
              title: 'Salesforce Well-Architected: Platform Transformation',
              url: 'https://architect.salesforce.com/docs/architect/fundamentals/guide/platform-transformation',
              source: 'architect',
            },
            {
              title: 'DORA Software Delivery Performance Metrics',
              url: 'https://dora.dev/guides/dora-metrics/',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'release-operations-q1',
          topic: 'Tool selection',
          prompt: 'What should a team define before selecting a Salesforce DevOps product?',
          options: [
            'The vendor whose interface has the most screens',
            'Required controls, metadata coverage, operating ownership, evidence, and failure behavior',
            'A permanent branch for each product license',
            'A plan to replace Git with the deployment history',
          ],
          correctIndex: 1,
          explanation:
            'The operating model and control requirements provide testable selection criteria; product branding does not.',
        },
        {
          id: 'release-operations-q2',
          topic: 'Control planes',
          prompt: 'How can graphical and CLI deployment interfaces safely coexist?',
          options: [
            'Each interface keeps its own source of truth',
            'Admins use production as source while developers use Git',
            'Both honor one reviewed source, artifact identity, gate policy, and evidence record',
            'Whichever interface deploys last becomes authoritative',
          ],
          correctIndex: 2,
          explanation:
            'Different user experiences are compatible when they are adapters to one governed release contract rather than independent delivery systems.',
        },
        {
          id: 'release-operations-q3',
          topic: 'Runbooks',
          prompt: 'Which item turns a deployment checklist into an operational decision system?',
          options: [
            'Named owners, measurable stop conditions, and explicit recovery actions',
            'A general instruction to monitor the org',
            'Credentials pasted beside each command',
            'A component list recreated manually during the window',
          ],
          correctIndex: 0,
          explanation:
            'Specific ownership, thresholds, and pre-decided actions let operators respond consistently under pressure.',
        },
        {
          id: 'release-operations-q4',
          topic: 'Change windows',
          prompt: 'How should a production change window be selected?',
          options: [
            'All changes deploy at 2 a.m. regardless of staffing',
            'Only Salesforce seasonal release dates matter',
            'The window is chosen after deployment starts',
            'Match residual risk to traffic, jobs, integrations, business deadlines, and support coverage',
          ],
          correctIndex: 3,
          explanation:
            'A window is a risk control balancing system activity and the people needed to make and support decisions.',
        },
        {
          id: 'release-operations-q5',
          topic: 'Recovery',
          prompt: 'Why is “git revert and redeploy” not a complete Salesforce recovery plan?',
          options: [
            'Git cannot version Salesforce metadata',
            'It does not restore deleted data or reverse external side effects and package upgrades automatically',
            'Metadata deployments can never reverse Apex',
            'A revert always bypasses tests',
          ],
          correctIndex: 1,
          explanation:
            'Source reversal can repair compatible metadata, while data, integrations, permissions, and package lifecycle need their own recovery mechanisms.',
        },
        {
          id: 'release-operations-q6',
          topic: 'Feature flags',
          prompt: 'Which practice makes a Salesforce feature flag operationally safe?',
          options: [
            'Default it on and omit the old-path test',
            'Use the flag as a substitute for object and field security',
            'Give it an owner, safe default, on/off tests, telemetry, kill procedure, and expiry',
            'Keep every flag permanently for future flexibility',
          ],
          correctIndex: 2,
          explanation:
            'Flags are temporary operational controls that require tested states, clear ownership, observability, and removal.',
        },
        {
          id: 'release-operations-q7',
          topic: 'Hotfix lane',
          prompt: 'What prevents a production hotfix from being lost in the next normal release?',
          options: [
            'Start from unreleased main and deploy everything',
            'Leave the change only in the production org',
            'Create a permanent emergency branch',
            'Branch from production, then merge the exact deployed fix back to main and active release lines',
          ],
          correctIndex: 3,
          explanation:
            'Starting from production controls scope, and immediate back-propagation keeps future release lines from reintroducing the defect.',
        },
        {
          id: 'release-operations-q8',
          topic: 'Post-deploy verification',
          prompt: 'What does a successful Salesforce deployment status prove?',
          options: [
            'The platform accepted the metadata deployment, not that every business journey works',
            'All downstream systems processed the new behavior',
            'No user lacks a required permission',
            'The release cannot increase error rates later',
          ],
          correctIndex: 0,
          explanation:
            'Platform acceptance is necessary but must be followed by technical, integration, security, and business-outcome checks.',
        },
        {
          id: 'release-operations-q9',
          topic: 'Observability',
          prompt: 'Which observability design most improves release diagnosis?',
          options: [
            'Enable debug logs permanently for every user',
            'Correlate release and transaction IDs across platform, integration, and business signals',
            'Rely only on deployer email',
            'Collect metrics without thresholds or owners',
          ],
          correctIndex: 1,
          explanation:
            'Correlation connects a release to affected transactions across boundaries; thresholds and owners turn those signals into action.',
        },
        {
          id: 'release-operations-q10',
          topic: 'DORA metrics',
          prompt: 'Which list reflects DORA’s current five software-delivery performance measures?',
          options: [
            'Story points, velocity, utilization, defect count, and uptime',
            'Build duration, test count, code coverage, approval count, and release size',
            'Change lead time, deployment frequency, failed deployment recovery time, change fail rate, and deployment rework rate',
            'MTBF, CPU, heap, API calls, and storage',
          ],
          correctIndex: 2,
          explanation:
            'DORA currently groups the first three as throughput and change fail rate plus deployment rework rate as instability.',
        },
      ],
    },
  ],
};
