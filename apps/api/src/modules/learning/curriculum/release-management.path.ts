import type { CurriculumPath } from './curriculum.types';

/**
 * Path 7 — Release Management & DevOps (category: devops).
 * How to ship Salesforce changes safely: environment strategy, Salesforce DX and
 * source control, Git branching, CI/CD pipelines, packaging, and governance —
 * the exact discipline this platform (the DevOps Command Center) automates.
 */
export const releaseManagementPath: CurriculumPath = {
  id: 'release-management',
  title: 'Release Management & DevOps',
  tagline: 'Ship Salesforce changes safely with source control, CI/CD, and governance.',
  description:
    'Learn to move Salesforce changes from a developer’s keyboard to production without fear. This track covers environment strategy, Salesforce DX and source-driven development, Git branching models, building CI/CD pipelines, packaging and deployment options, and the governance that keeps releases auditable — the same practices this DevOps Command Center automates for you.',
  category: 'devops',
  level: 'intermediate',
  badge: 'Release Manager',
  estimatedHours: 6,
  skills: [
    'Environment strategy',
    'Salesforce DX',
    'Git branching',
    'CI/CD pipelines',
    'Packaging & governance',
  ],
  modules: [
    {
      id: 'rm-foundations',
      title: 'Release Fundamentals & Source Control',
      summary:
        'Environments and release strategy, Salesforce DX source-driven development, and Git branching — the foundation of every safe release.',
      lessons: [
        {
          id: 'rm-environments',
          title: 'Environments and release strategy',
          summary:
            'Design a path to production using the right org types, and understand why source control — not change sets — is the modern source of truth.',
          durationMinutes: 15,
          objectives: [
            'Map an org strategy from development to production',
            'Explain why "the org is not the source of truth" matters',
            'Describe environment promotion and release cadence',
          ],
          sections: [
            {
              heading: 'The path to production',
              body:
                'A healthy Salesforce delivery pipeline flows through several environments: developers build in scratch orgs or developer sandboxes, features integrate in a shared sandbox, QA validates in a Partial Copy sandbox with realistic data, business users sign off in a Full sandbox (UAT), and only then does the change reach production. Each stage catches a different class of problem before it can affect real users.',
            },
            {
              heading: 'Source control is the source of truth',
              body:
                'The single biggest mindset shift in Salesforce DevOps is that Git — not any org — is authoritative. Metadata is retrieved into a repository, reviewed as code, and deployed forward. Orgs become disposable targets you can rebuild. This is what makes releases repeatable, auditable, and reversible, and it is the premise behind scratch orgs and this platform’s pipelines.\n\n- Change sets: click-based, no history, no review, hard to reverse — legacy.\n- Source control + DX: reviewed diffs, full history, automated deploys — modern.',
            },
            {
              heading: 'Promotion and cadence',
              body:
                'Changes are promoted, never rebuilt by hand, from one environment to the next: the same versioned artifact that passed QA is what deploys to UAT and production. Teams pick a cadence — continuous, weekly, or fixed release windows — and protect production with freeze windows around critical business periods. Predictable cadence plus promotion of a known-good artifact is what turns releases from stressful events into routine.',
            },
          ],
          realWorld: {
            title: 'Escaping "click deploy" chaos',
            scenario:
              'A team built directly in production and copied changes between sandboxes with change sets. Nobody knew exactly what was live, two admins overwrote each other’s work, and a bad change took a day to unpick.',
            solution:
              'They retrieved all metadata into Git, made the repo the source of truth, and defined a scratch-org → sandbox → UAT → production promotion path with pull-request review.',
            outcome:
              'Every change became a reviewed, reversible commit; conflicts surfaced in pull requests instead of in production; and rollbacks became "deploy the previous tag".',
          },
          keyTakeaways: [
            'A staged path (dev → integration → QA → UAT → prod) catches issues early',
            'Git, not the org, is the modern source of truth',
            'Change sets lack history/review; source control + DX provide both',
            'Promote one known-good artifact forward; use freeze windows to protect prod',
          ],
          resources: [
            {
              title: 'Trailhead — Application Lifecycle and Development Models',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Architects — Team Development',
              url: 'https://architect.salesforce.com/deliver/release-management',
              source: 'architect',
            },
          ],
        },
        {
          id: 'rm-sfdx',
          title: 'Salesforce DX and source-driven development',
          summary:
            'Use the Salesforce CLI and DX project format to retrieve, track, and deploy metadata as source you can version.',
          durationMinutes: 18,
          objectives: [
            'Understand the DX project layout and sfdx-project.json',
            'Use core sf CLI commands for auth, retrieve, and deploy',
            'Create and use scratch orgs for isolated development',
          ],
          sections: [
            {
              heading: 'The DX project format',
              body:
                'A Salesforce DX project stores metadata as source under a package directory (usually force-app), described by sfdx-project.json. This "source format" splits big bundles into readable files, so diffs are meaningful and merges are possible — unlike the old monolithic metadata format.',
              code: {
                language: 'json',
                snippet:
                  '{\n  "packageDirectories": [\n    { "path": "force-app", "default": true }\n  ],\n  "namespace": "",\n  "sfdcLoginUrl": "https://login.salesforce.com",\n  "sourceApiVersion": "60.0"\n}',
                caption: 'sfdx-project.json declares the package directories and API version.',
              },
            },
            {
              heading: 'The Salesforce CLI you will use daily',
              body:
                'The `sf` CLI authorizes orgs, moves metadata, and runs tests. A handful of commands cover most work — this platform wraps these same commands behind its deployment UI.',
              code: {
                language: 'bash',
                snippet:
                  '# Authorize an org (opens a browser)\nsf org login web --alias devhub --set-default-dev-hub\n\n# Retrieve metadata into source\nsf project retrieve start --metadata ApexClass:AccountService\n\n# Deploy source to an org, running local tests\nsf project deploy start --source-dir force-app \\\n  --test-level RunLocalTests --target-org uat',
                caption: 'Authorize, retrieve, deploy — the core DX loop.',
              },
            },
            {
              heading: 'Scratch orgs for isolation',
              body:
                'A scratch org is a short-lived, source-defined org spun up from a definition file. Each developer (or CI job) gets a clean org, pushes source into it, tests, and throws it away. This eliminates "works in my sandbox" drift and is the engine behind this platform’s scratch-org automation.',
              code: {
                language: 'bash',
                snippet:
                  '# Create a scratch org for 7 days\nsf org create scratch --definition-file config/project-scratch-def.json \\\n  --alias feature-x --duration-days 7 --set-default\n\n# Push your source and open it\nsf project deploy start --source-dir force-app --target-org feature-x\nsf org open --target-org feature-x',
                caption: 'Scratch orgs are disposable, reproducible dev environments.',
              },
            },
          ],
          realWorld: {
            title: 'Reproducible environments end "works on my org"',
            scenario:
              'Two developers hit different bugs because their sandboxes had drifted apart over months of manual tweaks, and nobody could reproduce a defect QA reported.',
            solution:
              'The team defined their org shape in a scratch definition file and created a fresh scratch org from source for each feature and each CI run.',
            outcome:
              'Every environment became identical and reproducible from Git; the elusive defect reproduced immediately in a clean scratch org, and onboarding a new developer went from days to minutes.',
          },
          keyTakeaways: [
            'DX source format makes metadata diffable and mergeable',
            'sfdx-project.json defines package directories + API version',
            'Learn a few sf commands: login, retrieve, deploy, test',
            'Scratch orgs give clean, reproducible, disposable environments',
          ],
          resources: [
            {
              title: 'Salesforce Developers — Salesforce DX Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/',
              source: 'developer',
            },
            {
              title: 'Trailhead — Salesforce DX quick start',
              url: 'https://trailhead.salesforce.com/content/learn/projects/quick-start-salesforce-dx',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'rm-git',
          title: 'Version control with Git: branching models',
          summary:
            'Use Git effectively for Salesforce: branches, pull requests, merge vs rebase, and a branching model that fits your release cadence.',
          durationMinutes: 17,
          objectives: [
            'Use the core Git workflow (branch, commit, push, PR)',
            'Choose a branching model (feature branches, GitFlow, trunk-based)',
            'Resolve conflicts and protect key branches',
          ],
          sections: [
            {
              heading: 'The everyday Git workflow',
              body:
                'Work happens on a short-lived feature branch off the main line. You commit small, meaningful changes, push, and open a pull request (PR) for review and automated checks. Only reviewed, green PRs merge back — this is where quality gates live.',
              code: {
                language: 'bash',
                snippet:
                  'git checkout -b feature/opportunity-split\n# ...retrieve/edit metadata...\ngit add force-app\ngit commit -m "Add opportunity split rollup"\ngit push -u origin feature/opportunity-split\n# open a pull request for review + CI',
                caption: 'Small branches + pull requests = reviewable, safe change.',
              },
            },
            {
              heading: 'Branching models',
              body:
                'Pick a model that matches your cadence:\n\n- Feature branches + main: simple; each feature branches off main and merges back after review.\n- GitFlow: long-lived develop and release branches; suits scheduled releases and multiple environments.\n- Trunk-based: very short branches merged to main frequently behind flags; suits continuous delivery.\n\nMost Salesforce teams start with feature branches into a protected main that maps to production, adding a release branch when they need a staging buffer.',
            },
            {
              heading: 'Conflicts, merge vs rebase, and protection',
              body:
                'A merge conflict happens when two branches change the same lines; Git pauses so you can resolve them. Merge preserves history as-is; rebase rewrites your branch on top of the latest main for a linear history (never rebase shared branches). Protect main with required reviews and status checks so nothing merges without passing CI — the guardrail that makes fast releases safe.',
            },
          ],
          realWorld: {
            title: 'Parallel features without stepping on each other',
            scenario:
              'Before Git, two admins editing the same flow overwrote each other through change sets, silently losing a day of work.',
            solution:
              'Each change moved to a feature branch with pull-request review; overlapping edits to the same metadata now produced a visible merge conflict resolved before merge.',
            outcome:
              'Lost work stopped happening, reviewers caught issues early, and branch protection on main meant production only ever received reviewed, CI-verified changes.',
          },
          keyTakeaways: [
            'Branch → commit → push → pull request is the core loop',
            'Choose a branching model matching your release cadence',
            'Conflicts are normal; understand merge vs rebase and never rebase shared branches',
            'Protect main with required reviews + status checks',
          ],
          resources: [
            {
              title: 'Git — Branching and Merging (Pro Git)',
              url: 'https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging',
              source: 'other',
            },
            {
              title: 'Salesforce Architects — Release Management',
              url: 'https://architect.salesforce.com/deliver/release-management',
              source: 'architect',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'rm-found-q1',
          topic: 'Environments',
          prompt: 'Where should business users perform final sign-off (UAT)?',
          options: ['Production', 'A Full sandbox', 'A scratch org', 'A developer’s laptop'],
          correctIndex: 1,
          explanation: 'A Full sandbox mirrors production data/metadata, ideal for UAT.',
        },
        {
          id: 'rm-found-q2',
          topic: 'Source of truth',
          prompt: 'In modern Salesforce DevOps, what is the source of truth?',
          options: ['The production org', 'The version-control repository', 'A change set', 'The sandbox'],
          correctIndex: 1,
          explanation: 'Git is authoritative; orgs are deployment targets.',
        },
        {
          id: 'rm-found-q3',
          topic: 'Change sets',
          prompt: 'A key drawback of change sets is that they…',
          options: [
            'Are too fast',
            'Lack history and review and are hard to reverse',
            'Require Git',
            'Only work in scratch orgs',
          ],
          correctIndex: 1,
          explanation: 'Change sets have no versioning/review and are hard to roll back.',
        },
        {
          id: 'rm-found-q4',
          topic: 'DX',
          prompt: 'What does sfdx-project.json define?',
          options: [
            'User passwords',
            'Package directories and source API version',
            'The database schema',
            'CI credentials',
          ],
          correctIndex: 1,
          explanation: 'It declares package directories, namespace, and API version.',
        },
        {
          id: 'rm-found-q5',
          topic: 'Scratch orgs',
          prompt: 'A scratch org is best described as…',
          options: [
            'A permanent production copy',
            'A short-lived, source-defined, disposable org',
            'A backup of production data',
            'A user license',
          ],
          correctIndex: 1,
          explanation: 'Scratch orgs are ephemeral, reproducible dev/CI environments.',
        },
        {
          id: 'rm-found-q6',
          topic: 'CLI',
          prompt: 'Which command deploys source to an org?',
          options: [
            'sf org open',
            'sf project deploy start',
            'sf org list',
            'sf config set',
          ],
          correctIndex: 1,
          explanation: 'sf project deploy start pushes source metadata to a target org.',
        },
        {
          id: 'rm-found-q7',
          topic: 'Git',
          prompt: 'Where do code review and automated checks happen?',
          options: ['In production', 'In a pull request', 'In a change set', 'In Setup'],
          correctIndex: 1,
          explanation: 'Pull requests are the gate for review and CI status checks.',
        },
        {
          id: 'rm-found-q8',
          topic: 'Git',
          prompt: 'What causes a merge conflict?',
          options: [
            'Two branches change the same lines',
            'Using scratch orgs',
            'Deploying too fast',
            'Running tests',
          ],
          correctIndex: 0,
          explanation: 'Overlapping edits to the same lines require manual resolution.',
        },
        {
          id: 'rm-found-q9',
          topic: 'Branch protection',
          prompt: 'Branch protection on main typically requires…',
          options: [
            'Nothing',
            'Reviews and passing status checks before merge',
            'A production password',
            'A full sandbox',
          ],
          correctIndex: 1,
          explanation: 'Required reviews + green CI keep unreviewed changes out of main.',
        },
      ],
    },
    {
      id: 'rm-cicd-governance',
      title: 'CI/CD, Packaging & Governance',
      summary:
        'Automate validation and deployment with CI/CD, package changes with unlocked packages or the Metadata API, and govern releases with approvals and auditability.',
      lessons: [
        {
          id: 'rm-cicd',
          title: 'Building a CI/CD pipeline',
          summary:
            'Automate the boring, error-prone parts: validate every pull request and deploy on merge, with tests and static analysis as gates.',
          durationMinutes: 18,
          objectives: [
            'Explain continuous integration vs continuous delivery',
            'Design pipeline stages: validate, test, deploy',
            'Read a real CI configuration for Salesforce',
          ],
          sections: [
            {
              heading: 'CI vs CD',
              body:
                'Continuous Integration (CI) means every change is automatically built and tested as it merges, so integration problems surface immediately. Continuous Delivery (CD) means those validated changes can be released to any environment at the push of a button (or automatically). Together they replace manual, risky deployments with a repeatable pipeline.',
            },
            {
              heading: 'Pipeline stages for Salesforce',
              body:
                'A typical Salesforce pipeline runs on each pull request and on merge:\n\n- Validate: a check-only deploy of the changed metadata against a target org.\n- Test: run Apex tests (RunLocalTests) and enforce a coverage threshold.\n- Analyze: run the Salesforce Code Analyzer / PMD for quality and security.\n- Deploy: on merge to main, deploy for real to the next environment.\n\nEach stage is a gate: a red stage blocks the merge or deploy.',
            },
            {
              heading: 'A real pipeline definition',
              body:
                'Pipelines are usually declared as YAML checked into the repo, so the process itself is versioned and reviewed. Below is a minimal GitHub Actions example that validates a pull request with a check-only deploy and local tests.',
              code: {
                language: 'yaml',
                snippet:
                  'name: PR Validation\non:\n  pull_request:\n    branches: [ main ]\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Install Salesforce CLI\n        run: npm install --global @salesforce/cli\n      - name: Authorize org (JWT)\n        run: sf org login jwt --username "$SF_USERNAME" \\\n             --jwt-key-file server.key --client-id "$SF_CLIENT_ID" --alias ci\n      - name: Validate (check-only) + run tests\n        run: sf project deploy start --dry-run \\\n             --source-dir force-app --test-level RunLocalTests --target-org ci',
                caption: 'The pipeline is code: reviewed, versioned, and repeatable.',
              },
            },
          ],
          realWorld: {
            title: 'Catching a failing test before it reached production',
            scenario:
              'A team deployed manually on Friday afternoons; a change that broke an Apex test slipped through because nobody re-ran the full suite, and it failed in production on Monday.',
            solution:
              'They added a CI job that ran RunLocalTests on every pull request and a check-only validation deploy, blocking merge on any failure.',
            outcome:
              'The broken test was caught in the PR, Friday deployments became a non-event, and mean time to detect regressions dropped from days to minutes.',
          },
          keyTakeaways: [
            'CI validates/tests every change; CD makes releasing push-button',
            'Stages act as gates: validate → test → analyze → deploy',
            'Run Apex tests and code analysis automatically on pull requests',
            'Define pipelines as versioned YAML so the process is reviewable',
          ],
          resources: [
            {
              title: 'Trailhead — Continuous Integration Using Salesforce DX',
              url: 'https://trailhead.salesforce.com/content/learn/modules/sfdx_travis_ci',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Developers — CI/CD with Salesforce DX',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ci_intro.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'rm-packaging',
          title: 'Packaging: change sets, unlocked packages, and the Metadata API',
          summary:
            'Choose how to bundle and move metadata — and why unlocked packages are the modern, versioned answer.',
          durationMinutes: 16,
          objectives: [
            'Compare deployment mechanisms and their trade-offs',
            'Create and version an unlocked package',
            'Understand the Metadata API and manifest (package.xml)',
          ],
          sections: [
            {
              heading: 'Ways to move metadata',
              body:
                'You have several options, from least to most mature:\n\n- Change sets: UI-only, no versioning — avoid for anything repeatable.\n- Metadata API deploys: script the movement of a defined set of components (what the sf CLI and this platform use).\n- Unlocked packages: versioned, modular bundles of metadata you build, install, and upgrade like software releases.\n\nMature teams organize metadata into unlocked packages so each capability has a version number and a clear owner.',
            },
            {
              heading: 'The manifest (package.xml)',
              body:
                'The Metadata API works against a manifest — package.xml — that lists exactly which components to retrieve or deploy. It is the contract for what is in a deployment, and it is how this platform’s org-to-org tools scope a change precisely.',
              code: {
                language: 'xml',
                snippet:
                  '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n  <types>\n    <members>AccountService</members>\n    <members>OpportunityTrigger</members>\n    <name>ApexClass</name>\n  </types>\n  <version>60.0</version>\n</Package>',
                caption: 'package.xml declares precisely which components a deploy includes.',
              },
            },
            {
              heading: 'Unlocked packages in practice',
              body:
                'An unlocked package turns a directory of metadata into a versioned artifact. You create a package once, then create a new version for each release and install/upgrade it in target orgs — giving you dependency management and clean upgrades instead of ad-hoc deploys.',
              code: {
                language: 'bash',
                snippet:
                  '# One-time: define the package\nsf package create --name "Billing" --package-type Unlocked --path force-app\n\n# Each release: version it, then install\nsf package version create --package "Billing" --installation-key-bypass --wait 20\nsf package install --package "Billing@1.2.0-1" --target-org uat --wait 20',
                caption: 'Unlocked packages give metadata real version numbers and upgrades.',
              },
            },
          ],
          realWorld: {
            title: 'Turning a metadata sprawl into versioned modules',
            scenario:
              'A large org deployed everything as one giant metadata blob; a small billing change forced re-deploying unrelated components and risked collateral breakage.',
            solution:
              'They carved the org into unlocked packages (Billing, Sales, Service). Each release versioned only the affected package and installed it independently.',
            outcome:
              'Deploys got smaller and safer, teams owned their packages, and rolling back meant installing the previous package version rather than untangling a monolith.',
          },
          keyTakeaways: [
            'Change sets don’t version; Metadata API deploys are scriptable; unlocked packages are versioned modules',
            'package.xml is the manifest that scopes a deployment precisely',
            'Unlocked packages give version numbers, upgrades, and ownership',
            'Modularizing metadata shrinks blast radius and eases rollback',
          ],
          resources: [
            {
              title: 'Salesforce Developers — Unlocked Packages',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_unlocked_pkg_intro.htm',
              source: 'developer',
            },
            {
              title: 'Salesforce Developers — Metadata API Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/',
              source: 'developer',
            },
          ],
        },
        {
          id: 'rm-governance',
          title: 'Release governance, approvals, and this platform',
          summary:
            'Add the human and audit layer — approvals, release notes, drift detection, and monitoring — and see how the DevOps Command Center ties it together.',
          durationMinutes: 15,
          objectives: [
            'Define release governance: approvals, notes, and audit trails',
            'Explain drift detection and post-deploy validation',
            'Map these practices onto the platform’s modules',
          ],
          sections: [
            {
              heading: 'Governance is the safety net around automation',
              body:
                'Automation makes deployment fast; governance makes it trustworthy. Governance adds approvals (a human sign-off before production), release notes (what changed and why), an audit trail (who deployed what, when), and rollback plans. For regulated industries this is not optional — it is how you prove control.',
            },
            {
              heading: 'Drift, validation, and monitoring',
              body:
                'Even with a clean pipeline, orgs can drift when someone edits production directly. Drift detection compares the live org against source and flags differences so they can be reconciled. Post-deploy validation runs smoke tests after a release, and monitoring tracks job outcomes so a failed deploy pages someone instead of being discovered by users.',
            },
            {
              heading: 'How this platform automates the discipline',
              body:
                'The DevOps Command Center is this whole track made operational:\n\n- Environment Center + scratch-org automation manage reproducible orgs.\n- Deployment Center, Metadata Deployment, and Data Deployment move changes org-to-org with previews and rollback.\n- Releases group deployments and work items with approvals and AI-generated release notes.\n- Drift Monitoring, Apex Quality, Calendar, and Monitoring provide the governance and visibility layer.\n\nEverything you learned in this path — environments, DX, Git, CI/CD, packaging, governance — is what these modules automate, which is why understanding the concepts makes you far more effective with the tool.',
            },
          ],
          realWorld: {
            title: 'Passing an audit with a documented release process',
            scenario:
              'A finance customer failed a control review because they could not show who approved a production change or what it contained.',
            solution:
              'They adopted release records with mandatory approvals, auto-generated release notes tying deployments to work items, and an immutable audit trail — coordinated through the platform’s Releases and Audit modules.',
            outcome:
              'The next audit passed cleanly: every production change had an approver, a change list, and a timestamped audit entry, and drift monitoring proved production matched source.',
          },
          keyTakeaways: [
            'Governance adds approvals, release notes, audit trails, and rollback plans',
            'Drift detection reconciles orgs edited outside the pipeline',
            'Post-deploy validation + monitoring catch failures fast',
            'This platform automates the full environment→DX→Git→CI/CD→governance discipline',
          ],
          resources: [
            {
              title: 'Salesforce Architects — Release Management',
              url: 'https://architect.salesforce.com/deliver/release-management',
              source: 'architect',
            },
            {
              title: 'Trailhead — DevOps Center',
              url: 'https://trailhead.salesforce.com/content/learn/modules/devops-center',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'rm-cicd-q1',
          topic: 'CI/CD',
          prompt: 'Continuous Integration primarily ensures that…',
          options: [
            'Deploys are manual',
            'Every change is automatically built and tested as it merges',
            'Only admins can deploy',
            'Tests are optional',
          ],
          correctIndex: 1,
          explanation: 'CI builds and tests changes automatically to surface issues early.',
        },
        {
          id: 'rm-cicd-q2',
          topic: 'Pipeline',
          prompt: 'A "check-only" (validate) deploy is used to…',
          options: [
            'Permanently deploy to production',
            'Verify a deployment would succeed without committing changes',
            'Delete metadata',
            'Create users',
          ],
          correctIndex: 1,
          explanation: 'A dry-run/validate deploy checks success without applying changes.',
        },
        {
          id: 'rm-cicd-q3',
          topic: 'Pipeline as code',
          prompt: 'Why define pipelines as YAML in the repo?',
          options: [
            'It runs faster',
            'The process becomes versioned and reviewable',
            'It avoids testing',
            'It hides the steps',
          ],
          correctIndex: 1,
          explanation: 'Pipeline-as-code is versioned, reviewed, and reproducible.',
        },
        {
          id: 'rm-cicd-q4',
          topic: 'Packaging',
          prompt: 'Which is a versioned, modular way to ship metadata?',
          options: ['Change sets', 'Unlocked packages', 'Manual edits', 'Screenshots'],
          correctIndex: 1,
          explanation: 'Unlocked packages provide versioning and clean upgrades.',
        },
        {
          id: 'rm-cicd-q5',
          topic: 'Manifest',
          prompt: 'What does package.xml specify?',
          options: [
            'User permissions',
            'Exactly which metadata components a deploy includes',
            'The org’s edition',
            'The CI runner OS',
          ],
          correctIndex: 1,
          explanation: 'package.xml is the manifest listing components to retrieve/deploy.',
        },
        {
          id: 'rm-cicd-q6',
          topic: 'Governance',
          prompt: 'Which is a core element of release governance?',
          options: [
            'Skipping reviews',
            'Approvals, release notes, and an audit trail',
            'Editing production directly',
            'Removing tests',
          ],
          correctIndex: 1,
          explanation: 'Governance adds sign-off, documentation, and auditability.',
        },
        {
          id: 'rm-cicd-q7',
          topic: 'Drift',
          prompt: 'Org drift refers to…',
          options: [
            'Slow page loads',
            'A live org differing from the source of truth',
            'A network outage',
            'A user forgetting their password',
          ],
          correctIndex: 1,
          explanation: 'Drift is divergence between the org and version control, often from direct edits.',
        },
        {
          id: 'rm-cicd-q8',
          topic: 'Validation',
          prompt: 'Post-deploy validation is used to…',
          options: [
            'Create scratch orgs',
            'Run smoke tests after a release to confirm health',
            'Delete branches',
            'Generate passwords',
          ],
          correctIndex: 1,
          explanation: 'Post-deploy checks confirm the release behaves correctly.',
        },
        {
          id: 'rm-cicd-q9',
          topic: 'Platform',
          prompt: 'Which module groups deployments + work items with approvals and AI release notes?',
          options: ['Monitoring', 'Releases', 'Environment Center', 'Data Center'],
          correctIndex: 1,
          explanation: 'The Releases module handles versioned releases, approvals, and notes.',
        },
      ],
    },
  ],
};
