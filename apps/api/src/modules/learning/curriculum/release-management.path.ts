import type { CurriculumPath } from './curriculum.types';

/**
 * Path 7 — Release Management & DevOps (Advanced, delivery track).
 * The process track for this platform: branching, pipelines, quality gates,
 * release execution, and post-release health — taught with Salesforce
 * specifics (metadata, orgs, freezes) rather than generic web-app DevOps.
 */
export const releaseManagementPath: CurriculumPath = {
  id: 'release-management',
  title: 'Release Management & DevOps',
  tagline: 'Ship Salesforce changes on schedule, with rollback plans you trust.',
  description:
    'Deployments fail loudly; releases fail quietly — a missed approval, an untested profile, a freeze window nobody communicated. This path turns deployment mechanics into release discipline: environment and branching strategy, CI/CD pipelines with real quality gates, release planning with approvals and notes, go-live runbooks with rollback rehearsals, and the metrics that prove your process is getting better. Everything maps directly onto this platform\'s Releases, Deployment, Drift, and Calendar modules.',
  level: 'advanced',
  category: 'delivery',
  badge: 'Release Captain',
  estimatedHours: 6,
  skills: ['Branching & environment strategy', 'CI/CD quality gates', 'Release planning & approvals', 'Rollback & release metrics'],
  modules: [
    {
      id: 'release-foundations',
      title: 'Release Foundations',
      summary:
        'What release management actually is, how environments and branches map to each other, and the cadence/calendar decisions that everything else hangs on.',
      lessons: [
        {
          id: 'release-what-is-release-management',
          title: 'Release management in plain language',
          summary:
            'The difference between a deployment and a release, why Salesforce makes releasing uniquely tricky, and the roles in a healthy release process.',
          durationMinutes: 15,
          objectives: [
            'Distinguish deployments (technical) from releases (business events)',
            'Explain the Salesforce-specific challenges: metadata, org drift, three platform releases a year',
            'Name the roles and artifacts of a working release process',
          ],
          sections: [
            {
              heading: 'A release is a promise, a deployment is a mechanism',
              body:
                'A DEPLOYMENT moves metadata and code from one org to another — a technical operation this platform executes in minutes. A RELEASE is the business event wrapped around one or more deployments: an agreed scope, tested and approved, delivered to users on a communicated date, with notes explaining what changed and a plan for when it goes wrong.\n\nTeams that conflate the two ship "whatever was in the sandbox on Friday". Teams that separate them can answer the three questions leadership always asks: what exactly went out, who approved it, and how do we undo it? This platform\'s Releases module exists precisely to group deployments and work items into that versioned, approvable unit.',
            },
            {
              heading: 'Why Salesforce releasing is its own discipline',
              body:
                'Salesforce adds constraints generic DevOps guides ignore. Changes are METADATA, and some of it (profiles, permission sets, picklist values) merges unpredictably or deploys partially. Orgs DRIFT: admins can change production directly, so "what is in production" is not guaranteed to equal "what is in git". Sandboxes refresh on their own cadence and destroy in-flight work if unplanned. And Salesforce itself upgrades every org three times a year — your calendar must absorb Spring/Summer/Winter releases you do not control.\n\nA Salesforce release process therefore needs three habits from day one: version control as the source of truth, drift detection to catch out-of-band changes (this platform\'s Drift module), and a release calendar that respects sandbox refreshes and platform release windows.',
            },
            {
              heading: 'Roles and artifacts',
              body:
                'Small team or large, the same hats exist: a RELEASE MANAGER owns the calendar, scope, and go/no-go; DEVELOPERS/ADMINS own changes and their tests; QA owns verification evidence; the BUSINESS OWNER accepts scope and signs off; on-call owns hypercare after go-live. One person may wear several hats — the failure mode is a hat nobody wears.\n\nThe artifacts that make the process real rather than tribal: a versioned release record (scope + deployments + work items), release notes humans can read, an approval trail, a runbook with rollback steps, and a post-release review. If it is not written down, it does not exist at 2 a.m. during an incident.',
            },
          ],
          realWorld: {
            title: 'The Friday sandbox dump',
            scenario:
              'A retail team "released" by deploying everything in their UAT sandbox to production every second Friday. Nobody could list what was included, an unfinished pricing flow went live half-built, and the resulting discount bug ran all weekend because no one knew it had shipped — or how to remove it.',
            solution:
              'They adopted release records in this platform: every release got a version, an explicit scope of work items and deployments, business sign-off before the window, generated release notes, and a rollback note per risky item.',
            outcome:
              'The next pricing issue was traced to its release in minutes, rolled back with the documented step, and leadership finally trusted the team enough to approve a faster weekly cadence — scope control, not slower shipping, was what earned it.',
          },
          keyTakeaways: [
            'Deployment = mechanism; release = scoped, approved, communicated business event',
            'Salesforce specifics: metadata quirks, org drift, sandbox refreshes, three platform upgrades a year',
            'Version control + drift detection + a release calendar are the non-negotiable base',
            'Artifacts (release record, notes, approvals, runbook) beat tribal memory',
          ],
          resources: [
            {
              title: 'Application Lifecycle and Development Models (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Well-Architected: Adaptable',
              url: 'https://architect.salesforce.com/well-architected/adaptable/overview',
              source: 'architect',
              note: 'Change management from the architect lens',
            },
          ],
        },
        {
          id: 'release-branching-environments',
          title: 'Branching strategies and environment flow',
          summary:
            'Trunk-based vs GitFlow for Salesforce teams, mapping branches to orgs, and keeping environments from becoming snowflakes.',
          durationMinutes: 20,
          objectives: [
            'Compare trunk-based development with GitFlow-style release branches',
            'Map branches to orgs: scratch/dev sandboxes → integration → UAT → production',
            'Handle hotfixes without derailing the next release',
          ],
          sections: [
            {
              heading: 'Pick a branching model you can actually run',
              body:
                'TRUNK-BASED development keeps one long-lived branch (main); work happens in short-lived feature branches merged within days, and releases are cut from main (often as tags or short release branches). It minimizes merge pain and drift between branches, but demands strong CI and feature flags for unfinished work.\n\nGITFLOW-style models add long-lived develop and release branches. They feel safer for teams with fixed release windows and heavy UAT phases — common in Salesforce shops — at the cost of painful merges and "which branch has the fix?" archaeology. The honest guidance: fewer long-lived branches is better; add a release branch only if your UAT stabilization genuinely needs one. Whatever you pick, write it down with a diagram new joiners can follow.',
            },
            {
              heading: 'Branches map to orgs',
              body:
                'A Salesforce pipeline gives each stage a branch AND an org. A typical shape: feature branches ↔ scratch orgs or developer sandboxes (this platform creates scratch orgs per feature); main/develop ↔ an integration sandbox where merged work first meets itself; a release branch ↔ UAT/Full sandbox where business testing happens against production-shaped data; production ↔ the release tag that was approved.\n\nTwo rules keep the map honest. Changes flow through GIT, not org-to-org copying, so the branch always describes the org. And every org should be rebuildable from its branch — if rebuilding UAT from the release branch scares the team, drift has already won.',
              code: {
                language: 'text',
                snippet:
                  'feature/quote-discounts ──▶ scratch org (dev + unit tests)\n        │  PR + review + CI\n        ▼\nmain ────────────────────▶ integration sandbox (auto-deploy on merge)\n        │  cut release/2026.07\n        ▼\nrelease/2026.07 ─────────▶ UAT full sandbox (business sign-off)\n        │  tag v2026.07 + approve\n        ▼\nproduction ◀───────────── deploy the approved tag; hotfixes branch from the tag',
                caption: 'One branch per stage, one org per branch — and git is the only road between them.',
              },
            },
            {
              heading: 'Hotfixes and the drift problem',
              body:
                'Production breaks between releases. A HOTFIX branches from the production tag (not from main, which already contains unreleased work), fixes the one thing, deploys with an expedited-but-real approval, and is merged BACK into main and any active release branch immediately — the forgotten back-merge is how fixes silently vanish in the next release, the most embarrassing regression there is.\n\nDrift is the same disease in the other direction: a change made directly in production that git does not know about. Schedule drift checks (this platform\'s Drift module compares orgs against their expected state), and triage every finding: retrofit it into git, or revert it in the org. Zero unexplained drift is the operational definition of "git is the source of truth".',
            },
          ],
          realWorld: {
            title: 'The vanishing hotfix',
            scenario:
              'A team hotfixed a broken approval process directly in production on a Tuesday. The fix was never back-merged; the next scheduled release deployed the OLD version of the process, re-breaking approvals during quarter-end — the same incident, twice, with an audience the second time.',
            solution:
              'Hotfixes moved to tagged branches with a checklist item — "back-merge to main and active release branches" — enforced by a pipeline check that blocks the next release if a hotfix tag is not an ancestor of the release candidate. Weekly drift checks catch anything patched org-side.',
            outcome:
              'Regression-by-release disappeared, drift findings dropped to near zero within a quarter as retrofits caught up, and the release checklist grew its most valuable line item from a real scar.',
          },
          keyTakeaways: [
            'Prefer the fewest long-lived branches your UAT process allows',
            'Each pipeline stage = a branch + an org; git is the only path between orgs',
            'Hotfix from the production tag; back-merge immediately and verify it',
            'Scheduled drift checks operationally enforce "git is the source of truth"',
          ],
          resources: [
            {
              title: 'Trunk-based development',
              url: 'https://trunkbaseddevelopment.com/',
              source: 'other',
              note: 'The reference site, with team-size guidance',
            },
            {
              title: 'Org Development Model (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/org-development-model',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'release-cadence-calendar',
          title: 'Cadence, calendars, and freeze windows',
          summary:
            'Choosing a release rhythm, building the calendar around sandbox refreshes and Salesforce\'s own releases, and running freezes that protect instead of paralyze.',
          durationMinutes: 15,
          objectives: [
            'Choose and defend a release cadence for a Salesforce team',
            'Build a release calendar including platform releases and sandbox refreshes',
            'Define freeze windows with explicit exception rules',
          ],
          sections: [
            {
              heading: 'Cadence: rhythm beats heroics',
              body:
                'A fixed cadence (weekly, biweekly, monthly) turns releasing from an event into a habit: scope cuts become "it catches the next train" instead of a crisis, stakeholders learn when to expect change, and the process itself gets practiced enough to be boring — which is the goal.\n\nChoose cadence by your slowest reliable step, usually UAT. If business testing genuinely needs a week, a weekly cadence will ship untested work; be honest and go biweekly, then shorten as automation grows. Urgent-fix pressure is not a reason for a slower cadence — it is what the hotfix lane is for.',
            },
            {
              heading: 'The calendar has more on it than your releases',
              body:
                'A Salesforce release calendar carries four layers: your release windows (with code-cut and UAT-entry dates), Salesforce\'s three seasonal releases (test in a preview sandbox BEFORE they hit production — pin the dates each cycle), sandbox refresh schedules (a refresh mid-UAT destroys the test environment), and business blackout periods (quarter-end, Black Friday, audit season).\n\nThis platform\'s Calendar module holds all four: scheduled deploys, drift checks, releases, sandbox refreshes, and freeze windows in one view. The discipline is updating it BEFORE reality changes — a calendar that trails reality is decoration.',
            },
            {
              heading: 'Freezes that protect without paralyzing',
              body:
                'A freeze window pauses normal releases during high-risk periods. A freeze that works has three properties: a defined SCOPE (production metadata changes — not "all work"; development and integration continue), a defined EXCEPTION path (sev-1 fixes deploy during a freeze with an incident ticket and a named approver), and a defined END with a plan for the queue that built up — releasing five weeks of pent-up scope as one mega-release recreates the risk the freeze avoided.\n\nCommunicate freezes like outages: dates announced ahead, reminders at start, an explicit all-clear. The quiet failure mode is the "shadow freeze" nobody wrote down, discovered by a team mid-deploy.',
            },
          ],
          realWorld: {
            title: 'UAT deleted by a scheduled refresh',
            scenario:
              'A team entered their biggest UAT cycle of the year the same week IT\'s automation refreshed the Full sandbox on its quarterly schedule. Three days of tester evidence, configured test data, and in-progress defect reproductions vanished overnight. The release slipped three weeks.',
            solution:
              'Sandbox refresh schedules moved into the shared release calendar with a hard rule — no refresh within an active UAT window without release-manager sign-off — and refresh reminders (this platform\'s Sandbox Refresh module) now page the release manager before executing.',
            outcome:
              'The next three releases ran UAT uninterrupted; one refresh was consciously deferred nine days with a single click instead of costing three weeks. The calendar became the first artifact opened in every release kickoff.',
          },
          keyTakeaways: [
            'Fixed cadence turns releases into habit; scope cuts become routine',
            'Calendar = your windows + Salesforce seasonal releases + sandbox refreshes + blackouts',
            'Freezes need scope, an exception path, and an end-of-freeze queue plan',
            'A calendar that trails reality is decoration — update it first',
          ],
          resources: [
            {
              title: 'Salesforce release readiness (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/salesforce-release-readiness-strategies',
              source: 'trailhead',
              note: 'Preparing for the seasonal platform releases',
            },
            {
              title: 'Salesforce sandbox refresh intervals (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.data_sandbox_environments.htm',
              source: 'help',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-rel-found-1',
          topic: 'Concepts',
          prompt: 'What is the difference between a deployment and a release?',
          options: [
            'They are synonyms',
            'A deployment is the technical move of changes; a release is the scoped, approved, communicated business event around it',
            'Releases are only for code, deployments only for config',
            'A release is any deployment that succeeds',
          ],
          correctIndex: 1,
          explanation:
            'Deployments are mechanics. A release adds scope control, approval, communication, and a rollback plan — the parts leadership and auditors care about.',
        },
        {
          id: 'q-rel-found-2',
          topic: 'Salesforce specifics',
          prompt: 'Which trio of Salesforce realities most shapes its release process?',
          options: [
            'Apex, LWC, and Flow',
            'Metadata merge quirks, org drift, and Salesforce\'s three seasonal platform releases',
            'Licenses, editions, and API limits',
            'Chatter, Files, and Reports',
          ],
          correctIndex: 1,
          explanation:
            'Partial-merging metadata, admins changing production directly, and platform upgrades you do not control are the release-specific challenges.',
        },
        {
          id: 'q-rel-found-3',
          topic: 'Drift',
          prompt: 'What does "org drift" mean?',
          options: [
            'Sandbox storage filling up',
            'The org\'s actual state diverging from the version-controlled source of truth',
            'Users moving between profiles',
            'API versions deprecating',
          ],
          correctIndex: 1,
          explanation:
            'Direct production changes make the org disagree with git. Scheduled drift checks find it; each finding is retrofitted to git or reverted.',
        },
        {
          id: 'q-rel-found-4',
          topic: 'Branching',
          prompt: 'What is the main argument for trunk-based development over long-lived branches?',
          options: [
            'It requires no code review',
            'Short-lived branches merged frequently minimize merge conflicts and branch drift',
            'It eliminates the need for CI',
            'It allows deploying without tests',
          ],
          correctIndex: 1,
          explanation:
            'The longer branches live, the more they diverge and the worse merges get. Trunk-based keeps divergence — and merge archaeology — small.',
        },
        {
          id: 'q-rel-found-5',
          topic: 'Environments',
          prompt: 'In a healthy pipeline, how do changes travel between orgs?',
          options: [
            'Org-to-org copies whenever convenient',
            'Through version control — each stage\'s org is deployed from its branch',
            'Manual re-entry in each org',
            'Only through change sets',
          ],
          correctIndex: 1,
          explanation:
            'Git is the road between orgs. Every org rebuildable from its branch is the test that the pipeline is honest.',
        },
        {
          id: 'q-rel-found-6',
          topic: 'Hotfixes',
          prompt: 'Where should a production hotfix branch from, and what must happen after it ships?',
          options: [
            'From main; nothing further',
            'From the production release tag; then back-merge into main and any active release branch',
            'From the oldest feature branch; then delete it',
            'From UAT; then refresh the sandbox',
          ],
          correctIndex: 1,
          explanation:
            'Branching from the tag avoids shipping unreleased work; the immediate back-merge prevents the next release from regressing the fix.',
        },
        {
          id: 'q-rel-found-7',
          topic: 'Cadence',
          prompt: 'What should primarily determine a team\'s release cadence?',
          options: [
            'The CEO\'s travel schedule',
            'The slowest reliable step in the process — usually business UAT',
            'The number of developers',
            'Salesforce license tier',
          ],
          correctIndex: 1,
          explanation:
            'A cadence faster than your testing capability ships untested work. Match the rhythm to reality, then improve the bottleneck.',
        },
        {
          id: 'q-rel-found-8',
          topic: 'Calendar',
          prompt: 'Besides your own release windows, what belongs on a Salesforce release calendar?',
          options: [
            'Only public holidays',
            'Salesforce seasonal release dates, sandbox refresh schedules, and business blackout periods',
            'Developer vacation days only',
            'Nothing — calendars are for meetings',
          ],
          correctIndex: 1,
          explanation:
            'Platform upgrades, refreshes, and blackouts all interact with your windows — invisible ones cause incidents like refreshing mid-UAT.',
        },
        {
          id: 'q-rel-found-9',
          topic: 'Freezes',
          prompt: 'Which three elements make a freeze window workable?',
          options: [
            'Total silence, no deploys of any kind, indefinite duration',
            'Defined scope, a documented sev-1 exception path, and a plan for the post-freeze queue',
            'A verbal agreement among developers',
            'Freezing sandboxes as well as production',
          ],
          correctIndex: 1,
          explanation:
            'Freezes protect high-risk periods without stopping development — but only when scope, exceptions, and the thaw are explicit.',
        },
        {
          id: 'q-rel-found-10',
          topic: 'Artifacts',
          prompt: 'Which set of artifacts distinguishes a managed release from a "sandbox dump"?',
          options: [
            'A zip of the sandbox metadata',
            'Versioned release record with scope, approval trail, human-readable notes, and a rollback runbook',
            'A Slack message announcing the deploy',
            'The deployment job id',
          ],
          correctIndex: 1,
          explanation:
            'Scope, approvals, notes, and rollback are what let you answer: what shipped, who approved it, and how do we undo it?',
        },
      ],
    },
    {
      id: 'release-pipeline',
      title: 'Building the Pipeline',
      summary:
        'CI/CD for Salesforce with real quality gates: validation deploys, test strategy, static analysis, and deployment/rollback mechanics that hold up under pressure.',
      lessons: [
        {
          id: 'release-cicd-quality-gates',
          title: 'CI/CD pipelines and quality gates',
          summary:
            'What a Salesforce pipeline actually runs at each stage, validate-only deploys as the core trick, and gates that block bad changes without blocking the team.',
          durationMinutes: 20,
          objectives: [
            'Describe each pipeline stage from commit to production deploy',
            'Use check-only (validate) deploys as pre-merge quality gates',
            'Design gates that are strict on main and fast on feature branches',
          ],
          sections: [
            {
              heading: 'Continuous integration, Salesforce edition',
              body:
                'CI means every change is automatically built and verified when pushed. For Salesforce: on every pull request, the pipeline creates or reuses an isolated org (scratch orgs shine here — this platform provisions them from templates), deploys the branch, runs the relevant Apex tests and static analysis, and reports pass/fail on the PR. Merge is blocked until green.\n\nThe payoff is integration bugs found within minutes of the commit that caused them, by a machine, instead of three weeks later in UAT by a human who then has to bisect three weeks of merges. CI is the single highest-leverage investment a Salesforce team can make.',
            },
            {
              heading: 'The validate-only deploy: Salesforce\'s secret gate',
              body:
                'A check-only deployment compiles metadata and runs specified tests against a REAL target org without committing anything. It is the perfect gate: validate the release candidate against a production-shaped org (or production itself) hours before the window, so surprises surface while everyone is calm.\n\nA mature pipeline validates at three points: PR-time against an integration-shaped org, release-cut time against UAT, and pre-release against production (a "quick deploy" can then release the validated package within ten days without re-running tests). This platform\'s deployment tooling exposes check-only as a first-class option — use it until it is boring.',
              code: {
                language: 'yaml',
                snippet:
                  '# Pipeline sketch: PR verification for a Salesforce repo\non: pull_request\njobs:\n  verify:\n    steps:\n      - checkout\n      - run: sf org create scratch --definition-file config/project-scratch-def.json --alias pr-org\n      - run: sf project deploy start --target-org pr-org          # real deploy to isolated org\n      - run: sf apex run test --target-org pr-org --code-coverage --result-format junit\n      - run: sf code-analyzer run --workspace force-app --rule-selector Recommended  # static analysis\n      - run: sf project deploy validate --target-org integration  # check-only vs shared org\n      # merge is blocked unless every step is green',
                caption: 'Every PR: isolated org, tests, analysis, and a validate against the shared target.',
              },
            },
            {
              heading: 'Gates that respect the team',
              body:
                'A quality gate is a CHECK with a THRESHOLD and a CONSEQUENCE: coverage below 85% blocks merge; any Critical static-analysis finding blocks merge; validation failure blocks the release. Gates must be fast (feature-branch gates in minutes — run impacted tests, not the whole org suite), deterministic (a flaky gate teaches people to click re-run until green, which is no gate at all), and tiered — light on feature branches, full on main and release branches.\n\nEvery gate needs a documented override path with named approvers and an audit trail, because a gate that can never be overridden will be deleted the first time it blocks a sev-1 fix.',
            },
          ],
          realWorld: {
            title: 'The 11 p.m. profile failure',
            scenario:
              'A team\'s monthly release repeatedly failed at 11 p.m. in production with profile and field-level-security errors that UAT never showed — UAT had been hand-patched over months and no longer resembled production. Each failure meant a scramble-and-abort with the business watching.',
            solution:
              'They added a check-only validation of the full release package against PRODUCTION at release-cut time, three days before the window, and rebuilt UAT from the release branch each cycle so it stopped being a snowflake.',
            outcome:
              'The next three releases deployed first-try in under 20 minutes using quick deploy of the pre-validated package. The 11 p.m. war room became a 15-minute checklist, and release-night attendance dropped from eight people to two.',
          },
          keyTakeaways: [
            'CI on every PR: isolated org, deploy, tests, analysis — merge blocked until green',
            'Check-only deploys validate against real orgs without changing them',
            'Validate the release package against production days early; quick-deploy it in the window',
            'Gates must be fast, deterministic, tiered, and overridable with an audit trail',
          ],
          resources: [
            {
              title: 'Continuous Integration using Salesforce DX (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/sfdx_travis_ci',
              source: 'trailhead',
            },
            {
              title: 'sf project deploy validate (CLI reference)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_project_commands_unified.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'release-testing-static-analysis',
          title: 'Test strategy and static analysis',
          summary:
            'A test pyramid that fits Salesforce, coverage as a floor not a goal, and static analysis (PMD/Code Analyzer) wired into the pipeline.',
          durationMinutes: 18,
          objectives: [
            'Structure unit, integration, and UAT layers for Salesforce changes',
            'Treat coverage thresholds as a floor and assertions as the point',
            'Gate merges on static-analysis findings by severity',
          ],
          sections: [
            {
              heading: 'The Salesforce test pyramid',
              body:
                'The base: fast APEX UNIT TESTS asserting behavior (not just achieving coverage) — data built via factories, callouts mocked, run on every PR. The middle: INTEGRATION-LEVEL checks — Flow tests, cross-module Apex suites, and automated UI smoke tests for the critical journeys, run on merge to main and nightly. The top: HUMAN UAT against production-shaped data in a Full/Partial sandbox, scoped to the release, with recorded evidence.\n\nThe inversion anti-pattern — thin unit tests, everything discovered manually in UAT — makes every release cycle slow AND fragile: bugs found latest cost most. Push detection down the pyramid relentlessly.',
            },
            {
              heading: 'Coverage honestly',
              body:
                'Salesforce requires 75% coverage to deploy Apex to production; healthy teams gate at 85%+ — but as a FLOOR, not a target. Coverage measures which lines EXECUTED, not which behaviors are VERIFIED: a test calling a method with no assertions produces coverage and zero protection. Review tests for assertion quality the way you review code, and track per-class coverage on core domains rather than one org-wide average that hides hollow spots.\n\nThis platform\'s Apex Quality module runs org test suites and trends coverage over time — a falling trend on a core class is a review conversation, not a deploy-day discovery.',
            },
            {
              heading: 'Static analysis: the reviewer that never sleeps',
              body:
                'Salesforce Code Analyzer (bundled into this platform\'s tooling) runs PMD and the Apex rules over every changeset: SOQL/DML inside loops, missing sharing declarations, hardcoded ids, unclosed queries, CRUD/FLS violations, plus Flow anti-patterns. Findings carry severities — gate on them: Critical/High block merge; Medium requires review; Low is advisory.\n\nAdopting analysis on a legacy codebase? Baseline first: record existing findings, fail the build only on NEW ones, and burn the baseline down deliberately. Turning on 4,000 failures at once teaches the team to ignore the tool permanently.',
              code: {
                language: 'apex',
                snippet:
                  '// The classic finding: SOQL inside a loop — invisible in a 5-record test,\n// fatal at 200 records in production.\nfor (Opportunity opp : Trigger.new) {\n    Account acc = [SELECT OwnerId FROM Account WHERE Id = :opp.AccountId]; // PMD: AvoidSoqlInLoops\n    opp.OwnerId = acc.OwnerId;\n}\n\n// The fix the analyzer is pushing you toward: query once, look up in the loop.\nMap<Id, Account> accounts = new Map<Id, Account>(\n    [SELECT OwnerId FROM Account WHERE Id IN :accountIds]);\nfor (Opportunity opp : Trigger.new) {\n    opp.OwnerId = accounts.get(opp.AccountId)?.OwnerId;\n}',
                caption: 'Static analysis finds the pattern at review time — before a 200-record batch finds it in production.',
              },
            },
          ],
          realWorld: {
            title: 'Ninety-two percent coverage, zero protection',
            scenario:
              'An insurer\'s org showed 92% coverage, yet a premium-calculation change shipped a rounding bug that mispriced 30,000 renewals. The class\'s test called calculatePremium() for coverage and asserted nothing — the bug executed green through the entire pipeline.',
            solution:
              'The team audited tests on the top twenty revenue-critical classes for assertion quality, rewrote the hollow ones around business scenarios with exact expected figures, and added a review rule: a test without meaningful assertions is a defect.',
            outcome:
              'The rewritten suite caught two further calculation bugs pre-merge within the quarter. Coverage barely moved — protection moved enormously, and "what do the assertions prove?" became the first question in test review.',
          },
          keyTakeaways: [
            'Pyramid: unit tests on every PR; integration on merge; scoped human UAT last',
            'Coverage is a floor; assertion quality is the actual protection',
            'Gate on static-analysis severity; baseline legacy findings and burn down',
            'Bugs found lower in the pyramid cost an order of magnitude less',
          ],
          resources: [
            {
              title: 'Salesforce Code Analyzer',
              url: 'https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/overview',
              source: 'developer',
            },
            {
              title: 'Apex Testing (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_testing',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'release-deployment-strategies',
          title: 'Deployment strategies and rollback plans',
          summary:
            'Delta vs full deploys, destructive changes, data + metadata sequencing, and rollback plans you have actually rehearsed.',
          durationMinutes: 20,
          objectives: [
            'Choose between delta and full deployments deliberately',
            'Sequence risky releases: destructive changes, data migrations, feature flags',
            'Write and rehearse a rollback plan per release',
          ],
          sections: [
            {
              heading: 'Delta vs full, and the destructive-change trap',
              body:
                'A DELTA deploy ships only what changed between two git points — fast, minimal blast radius, the right default (this platform\'s git-based deployment computes deltas). A FULL deploy ships the entire repository state — slower but self-correcting, worth running periodically to squash accumulated drift.\n\nDELETIONS never happen implicitly: removing a field from git does not remove it from the org. Destructive changes ship as their own manifest, ideally in a separate, post-verification step — deleting a field still referenced by a report or integration is a self-inflicted sev-2. Deprecate (hide, stop writing) one release before you destroy.',
            },
            {
              heading: 'Sequencing the risky release',
              body:
                'Real releases mix metadata, data, and behavior changes, and ORDER is part of correctness. The stable pattern: 1) pre-deploy data preparation (backfill new fields, load reference data — this platform\'s data deployment handles org-to-org data with previews and rollback), 2) metadata deploy with new behavior OFF behind a flag (custom permission or custom-setting toggle), 3) post-deploy verification — smoke tests, a report spot-check, integration heartbeats, 4) progressive enablement — pilot group first, then everyone, 5) cleanup of flags and deprecated components in a LATER release.\n\nFeature flags decouple "deployed" from "live", which converts many all-or-nothing releases into reversible ones — flipping a flag off is a rollback that takes seconds and needs no deploy window.',
            },
            {
              heading: 'Rollback: a plan, not a hope',
              body:
                'Salesforce has no one-click org restore, so rollback is designed per release, per item: metadata rolls back by deploying the PREVIOUS git tag (delta in reverse — trivial IF everything lives in git); flags roll back by flipping off; data migrations roll back via captured before-images (this platform\'s data deploy keeps rollback data) or a written compensating script; some items (deleted data, sent emails) do NOT roll back — the plan must say so and define forward-fix instead.\n\nTwo disciplines separate teams that recover in minutes from teams that improvise at midnight: every release names its rollback decision-maker and time-box ("if smoke tests fail past 30 minutes, we roll back — X decides"), and the metadata rollback path is REHEARSED in a sandbox each cycle so the first execution is never production.',
              code: {
                language: 'text',
                snippet:
                  'ROLLBACK CARD — Release 2026.07 · Quote Discounts\n----------------------------------------------------\nTrigger: smoke tests failing OR error rate > 2% for 30 min\nDecision-maker: R. Mehta (release manager)\n\n1. Flip custom permission "Quote_Discounts_Enabled" OFF   (~1 min, no deploy)\n2. If metadata fault: deploy tag v2026.06 delta            (~12 min, rehearsed 07-14 in UAT)\n3. Data: discount backfill reversible via captured rollback set RB-118\n4. NOT reversible: 340 quote PDFs already emailed — comms owner: L. Ortiz\n5. Announce in #releases; open incident if step 2 executed',
                caption: 'One card per release: triggers, owner, timed steps, and what will not roll back.',
              },
            },
          ],
          realWorld: {
            title: 'The rollback that had never been run',
            scenario:
              'A CPQ pricing release misbehaved at 7 a.m. as order volume ramped. The team had a rollback "plan" — one line: "redeploy previous version" — that had never been executed. The old branch would not validate (a permission set had changed underneath), and improvising the fix took four hours of revenue-impacting downtime.',
            solution:
              'Rollback became a first-class release artifact: new behavior behind a flag wherever possible, previous-tag redeploy rehearsed in UAT during each release week, rollback data captured for migrations, and a named decision-maker with a 30-minute time-box.',
            outcome:
              'The next pricing incident was neutralized in 90 seconds by flipping the flag off, root-caused calmly, and forward-fixed the same afternoon. Downtime cost went from four hours to effectively zero — the rehearsal habit paid for itself in one incident.',
          },
          keyTakeaways: [
            'Delta by default; periodic full deploys self-correct drift',
            'Destructive changes are explicit, separate, and one release behind deprecation',
            'Flags decouple deploy from enable — seconds-fast rollback for behavior',
            'Rollback plans name triggers, owners, and time-boxes — and get rehearsed',
          ],
          resources: [
            {
              title: 'Metadata API deployment (Developer Guide)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm',
              source: 'developer',
            },
            {
              title: 'DevOps Center (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/devops-center',
              source: 'trailhead',
              note: 'Salesforce\'s own pipeline tooling concepts',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-rel-pipe-1',
          topic: 'CI',
          prompt: 'What should happen automatically on every pull request in a mature Salesforce pipeline?',
          options: [
            'Direct deploy to production',
            'Deploy to an isolated org, run tests and static analysis, block merge until green',
            'An email to the release manager',
            'A full sandbox refresh',
          ],
          correctIndex: 1,
          explanation:
            'CI verifies every change in isolation within minutes — integration bugs surface at the commit, not three weeks later in UAT.',
        },
        {
          id: 'q-rel-pipe-2',
          topic: 'Validation',
          prompt: 'What does a check-only (validate) deployment do?',
          options: [
            'Deploys but skips tests',
            'Compiles and tests against the target org WITHOUT committing changes',
            'Only checks file syntax locally',
            'Creates a backup of the org',
          ],
          correctIndex: 1,
          explanation:
            'Check-only runs the full deployment and test process without persisting — the perfect dress rehearsal against production days early.',
        },
        {
          id: 'q-rel-pipe-3',
          topic: 'Quick deploy',
          prompt: 'What does a successful production validation enable?',
          options: [
            'Skipping UAT forever',
            'A quick deploy of that exact validated package within ten days, without re-running tests',
            'Automatic nightly deployment',
            'Unlimited deploys with no tests for a month',
          ],
          correctIndex: 1,
          explanation:
            'Quick deploy releases the pre-validated package during the window in minutes — validation took the risk out earlier, while everyone was calm.',
        },
        {
          id: 'q-rel-pipe-4',
          topic: 'Gates',
          prompt: 'Why must quality gates be deterministic (not flaky)?',
          options: [
            'Flaky gates use more CPU',
            'A gate people re-run until green stops filtering anything — it trains the team to ignore it',
            'Determinism is required by Salesforce',
            'Flaky gates block hotfixes permanently',
          ],
          correctIndex: 1,
          explanation:
            'The first time "just re-run it" works, the gate\'s authority is gone. Fix or quarantine flaky checks immediately.',
        },
        {
          id: 'q-rel-pipe-5',
          topic: 'Testing',
          prompt: 'Why is 92% code coverage NOT sufficient evidence of a safe change?',
          options: [
            'Salesforce requires 100%',
            'Coverage proves lines executed — only assertions prove behavior is correct',
            'Coverage excludes triggers',
            'It is sufficient evidence',
          ],
          correctIndex: 1,
          explanation:
            'A test with no assertions produces coverage and zero protection. Review tests for what they PROVE, not what they touch.',
        },
        {
          id: 'q-rel-pipe-6',
          topic: 'Static analysis',
          prompt: 'How should a team adopt static analysis on a large legacy codebase?',
          options: [
            'Fail the build on all 4,000 existing findings at once',
            'Baseline existing findings, fail only on NEW ones, and burn the baseline down deliberately',
            'Run it manually once a year',
            'Only analyze test classes',
          ],
          correctIndex: 1,
          explanation:
            'Failing on everything teaches the team to ignore the tool. New-findings-only keeps the gate meaningful while debt shrinks on a plan.',
        },
        {
          id: 'q-rel-pipe-7',
          topic: 'Deploys',
          prompt: 'Removing a custom field from the git repository and deploying — what happens to the field in the org?',
          options: [
            'It is deleted automatically',
            'Nothing — deletions require an explicit destructive-changes manifest',
            'It is archived to the recycle bin',
            'The deploy fails',
          ],
          correctIndex: 1,
          explanation:
            'Salesforce deploys are additive by default. Destructive changes ship explicitly — and should trail deprecation by a release.',
        },
        {
          id: 'q-rel-pipe-8',
          topic: 'Feature flags',
          prompt: 'What is the release value of deploying new behavior behind a flag (custom permission / setting)?',
          options: [
            'It doubles test coverage',
            'It decouples deploy from enable — rollback becomes flipping the flag off in seconds',
            'It removes the need for approvals',
            'It hides the change from auditors',
          ],
          correctIndex: 1,
          explanation:
            '"Deployed but off" converts all-or-nothing releases into reversible ones and enables progressive rollout to pilot groups.',
        },
        {
          id: 'q-rel-pipe-9',
          topic: 'Rollback',
          prompt: 'Which element is essential in a real rollback plan?',
          options: [
            'A promise to be careful',
            'Named decision-maker, explicit triggers/time-box, per-item steps, and a list of what cannot roll back',
            'The phone number of Salesforce support',
            'A second production org',
          ],
          correctIndex: 1,
          explanation:
            'Rollback is a designed, owned procedure. Items that cannot be reversed (sent emails, deleted data) need forward-fix plans stated upfront.',
        },
        {
          id: 'q-rel-pipe-10',
          topic: 'Rollback',
          prompt: 'Why rehearse the previous-tag redeploy in a sandbox every release cycle?',
          options: [
            'To use spare sandbox capacity',
            'So the first execution of your rollback is never in production during an incident',
            'Salesforce licensing requires it',
            'To keep git history clean',
          ],
          correctIndex: 1,
          explanation:
            'Unrehearsed rollbacks fail in surprising ways (dependencies changed underneath). Rehearsal converts a midnight improvisation into a checklist.',
        },
      ],
    },
    {
      id: 'release-execution',
      title: 'Running the Release',
      summary:
        'The human side done professionally: planning and approvals, release notes people read, go-live runbooks, hypercare, and the metrics that drive improvement.',
      lessons: [
        {
          id: 'release-planning-notes-approvals',
          title: 'Release planning, notes, and approvals',
          summary:
            'Scope cuts without drama, approval flows that add safety instead of ceremony, and release notes for three different audiences.',
          durationMinutes: 15,
          objectives: [
            'Run a release cycle: scope lock, code cut, UAT entry, go/no-go',
            'Design an approval flow that is auditable but not bureaucratic',
            'Write release notes for business users, admins, and engineers',
          ],
          sections: [
            {
              heading: 'The cycle: dates that create calm',
              body:
                'A release cycle is four dates everyone knows: SCOPE LOCK (what is in; later arrivals catch the next train), CODE CUT (the release branch/tag is created; only stabilization fixes enter), UAT ENTRY/EXIT (business verification with recorded evidence), and GO/NO-GO (a 15-minute meeting reviewing a checklist: UAT sign-off, validation green, rollback card ready, comms drafted, no open sev-1s).\n\nThe emotional shift this creates is underrated: scope pressure becomes "next release is in two weeks" instead of a fight, and go/no-go becomes checklist review instead of vibes. This platform\'s Releases module tracks the version, its work items, deployments, and approval state in one record.',
            },
            {
              heading: 'Approvals that mean something',
              body:
                'An approval flow answers: who confirms the change WORKS (QA/UAT sign-off), who accepts the RISK (business owner), and who confirms the org is READY (release manager)? Two or three named approvals, recorded on the release record with timestamps, are auditable and fast. Twelve-signature chains are neither — they diffuse accountability until nobody actually reads what they sign.\n\nCalibrate rigor to risk: a label fix and a sharing-model change should not share a process. Define lanes (standard / expedited / emergency) with entry criteria, and let the emergency lane be genuinely fast — a sev-1 fix blocked on a vacationing approver is how teams learn to bypass process permanently.',
            },
            {
              heading: 'Release notes: three audiences, one source',
              body:
                'BUSINESS USERS need "what changes for me Monday morning" — features, changed screens, new steps, in their words, with screenshots for anything visual. ADMINS need operational detail: new permissions and flags, changed automations, data migrations, known limitations. ENGINEERS need the changelog: work items, deployments, tags, and links back to the release record.\n\nGenerate the skeleton from the release scope (this platform drafts AI release notes from the work items and deployments in the release) and edit for humans — generated notes are a starting point, not a shipping product. Send the business version BEFORE go-live; notes discovered after the change hit users read as an apology.',
            },
          ],
          realWorld: {
            title: 'The release nobody told support about',
            scenario:
              'A team shipped a redesigned case-close flow on a Sunday. Monday 8 a.m., the support floor found their muscle memory broken mid-call: 200 agents, no warning, no notes. The support director escalated to the COO by 9:15, and the (well-built) feature spent its first week as an incident.',
            solution:
              'Release comms became a go/no-go checklist item: business-facing notes distributed three days early to affected team leads, a two-minute walkthrough video for UI changes, and a named comms owner per release. No sign-off from affected department leads, no go.',
            outcome:
              'The next flow change landed with agents who had already watched the walkthrough; support tickets about "the new screen" dropped to near zero, and the support director became the release process\'s loudest advocate — the cheapest stakeholder win the team ever bought.',
          },
          keyTakeaways: [
            'Four dates run the cycle: scope lock, code cut, UAT window, go/no-go',
            'Two or three named, recorded approvals beat twelve-signature ceremony',
            'Risk-calibrated lanes: standard, expedited, emergency — all defined upfront',
            'Notes ship BEFORE go-live, written per audience, generated then humanized',
          ],
          resources: [
            {
              title: 'Salesforce release management best practices (Architect)',
              url: 'https://architect.salesforce.com/well-architected/adaptable/overview',
              source: 'architect',
            },
            {
              title: 'Change management (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/org-change-management',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'release-go-live-hypercare',
          title: 'Go-live runbooks and hypercare',
          summary:
            'A minute-by-minute release window, smoke tests that prove life, and a hypercare period that catches what testing missed.',
          durationMinutes: 18,
          objectives: [
            'Write a go-live runbook with owners and timings per step',
            'Design post-deploy smoke tests for critical business journeys',
            'Run a hypercare period with real monitoring and exit criteria',
          ],
          sections: [
            {
              heading: 'The runbook: choreography, not heroics',
              body:
                'A go-live runbook lists every step with an OWNER, an EXPECTED DURATION, and a VERIFICATION: pre-window checks (validation green, approvals recorded, rollback card printed), the window itself (maintenance banner up, integrations paused if needed, quick deploy executed, data steps run, flags flipped for pilot), and verification before declaring success.\n\nWrite it so a competent colleague who was not in the planning meetings could execute it. Timestamps get filled in as you go — that log is gold for the retrospective and for auditors. Releases become boring when the runbook, not adrenaline, does the driving; boring is the goal.',
            },
            {
              heading: 'Smoke tests: prove the business still works',
              body:
                'Within minutes of deploy completion, verify the CRITICAL JOURNEYS — not everything, the five-to-ten flows the business cannot live without: create a lead and convert it, quote a standard deal, close a case, run the revenue report, confirm the ERP integration heartbeat. Script them (who clicks what, what must appear), pre-assign each to a person, and time-box to 20-30 minutes.\n\nAutomate what you can (API-level checks and integration heartbeats catch a broad class of failures instantly — this platform\'s monitoring shows job health live), but keep a human on the UI paths: users experience the UI, not the API. Smoke results are the input to the "declare success or trigger rollback" decision — which is why the rollback card defined the threshold BEFORE the window.',
            },
            {
              heading: 'Hypercare: the release is not done at deploy',
              body:
                'Hypercare is a defined period (48 hours to two weeks, scaled to risk) of heightened attention after go-live: a named rotation watching error rates, integration health, and support tickets; a fast lane for release-related defects that bypasses normal triage; and a daily 15-minute review of what surfaced.\n\nDefine EXIT CRITERIA up front — error rates at baseline, no open release-tagged sev-1/2, ticket volume normal — and close hypercare explicitly with a short retrospective: what leaked past which pyramid layer, and which gate or test gets strengthened so it cannot leak again. That loop, run every release, is how a mediocre process becomes a great one in two quarters.',
            },
          ],
          realWorld: {
            title: 'The integration that died quietly at go-live',
            scenario:
              'A release changed an Opportunity field an ERP integration read. Deploy succeeded, UI smoke tests passed, everyone went to bed. The integration had been failing since 9:07 p.m.; by morning, 14 hours of orders were missing from the ERP and month-end reconciliation was chaos.',
            solution:
              'Integration heartbeats became a mandatory smoke-test line item — synthetic transactions pushed through each critical integration within 15 minutes of deploy — and hypercare monitoring watched integration error rates on a dashboard with paging thresholds for the first 48 hours.',
            outcome:
              'Two releases later the same class of failure fired the heartbeat alert at go-live plus 12 minutes; the field mapping was fixed within the window, zero orders were lost, and the incident-that-did-not-happen made the case for the monitoring investment better than any slide deck.',
          },
          keyTakeaways: [
            'Runbooks have owners, durations, and verifications per step — executable by a stranger',
            'Smoke-test the critical journeys, UI and integrations, within minutes of deploy',
            'Hypercare = named rotation + fast defect lane + daily review, with exit criteria',
            'Every leak strengthens a lower layer: the improvement loop that compounds',
          ],
          resources: [
            {
              title: 'Salesforce incident & change readiness (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/org-change-management',
              source: 'trailhead',
            },
            {
              title: 'Google SRE: Being on-call (concepts transfer)',
              url: 'https://sre.google/sre-book/being-on-call/',
              source: 'other',
              note: 'The hypercare mindset, formalized',
            },
          ],
        },
        {
          id: 'release-metrics-improvement',
          title: 'Release health: DORA metrics and continuous improvement',
          summary:
            'Measuring the four DORA metrics for a Salesforce team, running retrospectives that change the process, and paying down release debt.',
          durationMinutes: 17,
          objectives: [
            'Define and measure the four DORA metrics in a Salesforce context',
            'Run release retrospectives that produce process changes, not blame',
            'Balance feature delivery against automation and release-debt work',
          ],
          sections: [
            {
              heading: 'Four numbers that describe your delivery',
              body:
                'DORA\'s research distilled delivery performance into four metrics. DEPLOYMENT FREQUENCY: how often you ship to production. LEAD TIME FOR CHANGES: commit-to-production time. CHANGE FAILURE RATE: the share of releases causing an incident or rollback. TIME TO RESTORE: how fast you recover when one does. Elite teams ship on demand with lead times under a day, failure rates under 5%, and restore times under an hour — but the VALUE is your own trend, not the league table.\n\nFor a Salesforce team the instrumentation is concrete: deployment records give frequency; work-item-to-release timestamps give lead time; release-tagged incidents give failure rate; incident timelines give restore time. This platform\'s release and monitoring data holds all four — the discipline is reviewing them monthly, on a chart, in the open.',
            },
            {
              heading: 'Retrospectives that actually change the process',
              body:
                'A release retrospective is 30 minutes, within a week of go-live, with one question: what does the PROCESS learn? Wins worth keeping, leaks worth plugging (each mapped to the gate or pyramid layer that should have caught it), and at most TWO improvement actions with owners and deadlines — ten actions is zero actions wearing a list.\n\nBlamelessness is not softness; it is accuracy. "Why was it possible to deploy with a failing integration test?" changes the pipeline. "Who deployed it?" changes nothing except who hides mistakes next quarter. The actions feed the next cycle, which is why teams that retro every release improve visibly quarter over quarter and teams that skip it re-live the same release forever.',
            },
            {
              heading: 'Release debt is real debt',
              body:
                'Manual steps in the runbook, flaky tests everyone re-runs, environments only one person can rebuild, a hand-maintained deploy spreadsheet — that is RELEASE DEBT, and it compounds: each manual step adds failure probability and makes releases scarier, which pushes teams toward bigger, rarer, riskier releases. The spiral runs in both directions; automation runs it downward.\n\nBudget it like feature work: a standing slice of each cycle (10-20%) for automating one manual step, fixing one flaky test, or scripting one environment rebuild. The compounding is fast — a team that automates one runbook step per release has a one-page runbook within a year, and the "small release more often" flywheel starts turning on its own.',
            },
          ],
          realWorld: {
            title: 'From quarterly fear to biweekly boredom',
            scenario:
              'A financial-services team released quarterly because releases were terrifying: 30-step manual runbooks, a 40% change-failure rate, all-weekend windows. Each failure made the next release bigger and scarier — the classic doom loop, fully installed.',
            solution:
              'They started measuring the four DORA metrics on a wall chart, retroed every release with a two-action limit, and spent 15% of each cycle on release debt: validation automation first, then smoke-test scripting, then flag-based rollbacks, then runbook step elimination — one debt item at a time, every cycle, without exception.',
            outcome:
              'Four quarters later: biweekly releases, change-failure rate under 8%, restore time from six hours to 20 minutes via flag rollbacks, and release windows that fit inside a lunch break. The wall chart of four trend lines convinced leadership to fund the platform team permanently — numbers did what advocacy could not.',
          },
          keyTakeaways: [
            'Measure frequency, lead time, failure rate, restore time — and watch trends',
            'Retro every release: blameless, two owned actions, feeding the next cycle',
            'Map every leaked defect to the layer that should have caught it',
            'Spend 10-20% of each cycle on release debt; the compounding is the strategy',
          ],
          resources: [
            {
              title: 'DORA research and metrics',
              url: 'https://dora.dev/',
              source: 'other',
              note: 'The research base for the four metrics',
            },
            {
              title: 'Salesforce Well-Architected',
              url: 'https://architect.salesforce.com/well-architected/overview',
              source: 'architect',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-rel-exec-1',
          topic: 'Planning',
          prompt: 'What does "scope lock" mean in a release cycle?',
          options: [
            'The org is locked for all users',
            'The release\'s contents are fixed — later work catches the next release',
            'Only admins may deploy',
            'The git repository becomes read-only',
          ],
          correctIndex: 1,
          explanation:
            'Scope lock converts "just squeeze this in" pressure into a routine answer: the next train leaves in two weeks.',
        },
        {
          id: 'q-rel-exec-2',
          topic: 'Approvals',
          prompt: 'Which approval set is both auditable and practical?',
          options: [
            'Twelve signatures from every department',
            'QA/UAT sign-off, business-owner risk acceptance, and release-manager readiness — named and timestamped',
            'A verbal OK in stand-up',
            'No approvals if tests pass',
          ],
          correctIndex: 1,
          explanation:
            'Three meaningful, recorded approvals answer works/risk/ready. Long chains diffuse accountability until signatures mean nothing.',
        },
        {
          id: 'q-rel-exec-3',
          topic: 'Approvals',
          prompt: 'Why should an emergency (sev-1) release lane exist with genuinely fast approval?',
          options: [
            'To skip testing permanently',
            'Because if the formal path cannot handle emergencies, teams learn to bypass process entirely',
            'To avoid documenting hotfixes',
            'Auditors require it',
          ],
          correctIndex: 1,
          explanation:
            'Process survives only if it works under pressure. A defined fast lane with after-the-fact review beats ad-hoc bypassing every time.',
        },
        {
          id: 'q-rel-exec-4',
          topic: 'Release notes',
          prompt: 'When should business-facing release notes reach affected users?',
          options: [
            'Never — notes are internal',
            'Before go-live, so changes arrive expected instead of as surprises',
            'A week after go-live',
            'Only when someone complains',
          ],
          correctIndex: 1,
          explanation:
            'Notes after the fact read as an apology. Pre-release comms (plus a walkthrough for UI changes) prevents the Monday-morning revolt.',
        },
        {
          id: 'q-rel-exec-5',
          topic: 'Runbook',
          prompt: 'What makes a go-live runbook trustworthy?',
          options: [
            'It is memorized by the release manager',
            'Every step has an owner, expected duration, and a verification — executable by someone outside the planning meetings',
            'It is at least 50 pages',
            'It is written during the release window',
          ],
          correctIndex: 1,
          explanation:
            'Owners, timings, and verifications turn go-live into choreography. If only one person can run it, it is a risk, not a runbook.',
        },
        {
          id: 'q-rel-exec-6',
          topic: 'Smoke tests',
          prompt: 'What should post-deploy smoke tests cover?',
          options: [
            'Every feature in the org',
            'The five-to-ten critical business journeys — UI paths AND integration heartbeats',
            'Only the newest feature',
            'Database storage levels',
          ],
          correctIndex: 1,
          explanation:
            'Smoke tests prove the business still works: key user journeys plus synthetic transactions through critical integrations, in ~30 minutes.',
        },
        {
          id: 'q-rel-exec-7',
          topic: 'Hypercare',
          prompt: 'Which elements define a real hypercare period?',
          options: [
            'Hoping users report problems',
            'Named rotation, monitored dashboards, a fast defect lane, daily review, and explicit exit criteria',
            'Disabling monitoring to reduce noise',
            'A frozen backlog for a month',
          ],
          correctIndex: 1,
          explanation:
            'Hypercare is structured attention with a defined end — error rates at baseline and no open release-tagged sev-1/2 close it out.',
        },
        {
          id: 'q-rel-exec-8',
          topic: 'DORA',
          prompt: 'What are the four DORA metrics?',
          options: [
            'Coverage, velocity, bugs, uptime',
            'Deployment frequency, lead time for changes, change failure rate, time to restore',
            'Story points, burn-down, capacity, morale',
            'Logins, API calls, storage, licenses',
          ],
          correctIndex: 1,
          explanation:
            'The four together describe speed AND stability — and improving them together is what distinguishes elite delivery.',
        },
        {
          id: 'q-rel-exec-9',
          topic: 'Retrospectives',
          prompt: 'Why limit a release retrospective to about two improvement actions?',
          options: [
            'Meetings must stay under ten minutes',
            'Two owned, deadlined actions get done; ten-item lists are zero actions in disguise',
            'Most releases have at most two problems',
            'Actions expire after two weeks',
          ],
          correctIndex: 1,
          explanation:
            'Improvement compounds through completed actions per cycle, not through comprehensive lists nobody executes.',
        },
        {
          id: 'q-rel-exec-10',
          topic: 'Release debt',
          prompt: 'Why does release debt (manual steps, flaky tests, snowflake environments) push teams toward RARER releases?',
          options: [
            'It does not — debt encourages frequency',
            'Each manual step adds fear and failure probability, so teams batch bigger releases — which raises risk further',
            'Auditors mandate quarterly releases',
            'Flaky tests only run quarterly',
          ],
          correctIndex: 1,
          explanation:
            'Fear drives batching; batching drives risk — the doom loop. Automating a step per cycle runs the same loop in reverse.',
        },
      ],
    },
  ],
};
