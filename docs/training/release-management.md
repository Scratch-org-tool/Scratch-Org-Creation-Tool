# Release Management & DevOps — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Advanced · **Category:** Delivery & release management · **Badge:** Release Captain · **Modules:** 3 · **Lessons:** 9 · **Estimated effort:** ~6h

Deployments fail loudly; releases fail quietly — a missed approval, an untested profile, a freeze window nobody communicated. This path turns deployment mechanics into release discipline: environment and branching strategy, CI/CD pipelines with real quality gates, release planning with approvals and notes, go-live runbooks with rollback rehearsals, and the metrics that prove your process is getting better. Everything maps directly onto this platform's Releases, Deployment, Drift, and Calendar modules.

**Skills:** Branching & environment strategy · CI/CD quality gates · Release planning & approvals · Rollback & release metrics

## Contents

- **Module 1: Release Foundations**
  - Lesson 1.1: Release management in plain language
  - Lesson 1.2: Branching strategies and environment flow
  - Lesson 1.3: Cadence, calendars, and freeze windows
- **Module 2: Building the Pipeline**
  - Lesson 2.1: CI/CD pipelines and quality gates
  - Lesson 2.2: Test strategy and static analysis
  - Lesson 2.3: Deployment strategies and rollback plans
- **Module 3: Running the Release**
  - Lesson 3.1: Release planning, notes, and approvals
  - Lesson 3.2: Go-live runbooks and hypercare
  - Lesson 3.3: Release health: DORA metrics and continuous improvement

## Module 1: Release Foundations

What release management actually is, how environments and branches map to each other, and the cadence/calendar decisions that everything else hangs on.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 1.1 — Release management in plain language

**Lesson ID:** `release-what-is-release-management` · **Reading time:** 15 min · **Video:** 5:00

> The difference between a deployment and a release, why Salesforce makes releasing uniquely tricky, and the roles in a healthy release process.

**Learning objectives**

- Distinguish deployments (technical) from releases (business events)
- Explain the Salesforce-specific challenges: metadata, org drift, three platform releases a year
- Name the roles and artifacts of a working release process

#### Concept explanation

##### A release is a promise, a deployment is a mechanism

A DEPLOYMENT moves metadata and code from one org to another — a technical operation this platform executes in minutes. A RELEASE is the business event wrapped around one or more deployments: an agreed scope, tested and approved, delivered to users on a communicated date, with notes explaining what changed and a plan for when it goes wrong.

Teams that conflate the two ship "whatever was in the sandbox on Friday". Teams that separate them can answer the three questions leadership always asks: what exactly went out, who approved it, and how do we undo it? This platform's Releases module exists precisely to group deployments and work items into that versioned, approvable unit.

##### Why Salesforce releasing is its own discipline

Salesforce adds constraints generic DevOps guides ignore. Changes are METADATA, and some of it (profiles, permission sets, picklist values) merges unpredictably or deploys partially. Orgs DRIFT: admins can change production directly, so "what is in production" is not guaranteed to equal "what is in git". Sandboxes refresh on their own cadence and destroy in-flight work if unplanned. And Salesforce itself upgrades every org three times a year — your calendar must absorb Spring/Summer/Winter releases you do not control.

A Salesforce release process therefore needs three habits from day one: version control as the source of truth, drift detection to catch out-of-band changes (this platform's Drift module), and a release calendar that respects sandbox refreshes and platform release windows.

##### Roles and artifacts

Small team or large, the same hats exist: a RELEASE MANAGER owns the calendar, scope, and go/no-go; DEVELOPERS/ADMINS own changes and their tests; QA owns verification evidence; the BUSINESS OWNER accepts scope and signs off; on-call owns hypercare after go-live. One person may wear several hats — the failure mode is a hat nobody wears.

The artifacts that make the process real rather than tribal: a versioned release record (scope + deployments + work items), release notes humans can read, an approval trail, a runbook with rollback steps, and a post-release review. If it is not written down, it does not exist at 2 a.m. during an incident.

#### Real-world example — The Friday sandbox dump

- **Scenario:** A retail team "released" by deploying everything in their UAT sandbox to production every second Friday. Nobody could list what was included, an unfinished pricing flow went live half-built, and the resulting discount bug ran all weekend because no one knew it had shipped — or how to remove it.
- **Solution:** They adopted release records in this platform: every release got a version, an explicit scope of work items and deployments, business sign-off before the window, generated release notes, and a rollback note per risky item.
- **Outcome:** The next pricing issue was traced to its release in minutes, rolled back with the documented step, and leadership finally trusted the team enough to approve a faster weekly cadence — scope control, not slower shipping, was what earned it.

#### Key takeaways

- Deployment = mechanism; release = scoped, approved, communicated business event
- Salesforce specifics: metadata quirks, org drift, sandbox refreshes, three platform upgrades a year
- Version control + drift detection + a release calendar are the non-negotiable base
- Artifacts (release record, notes, approvals, runbook) beat tribal memory

#### Go deeper

- [Application Lifecycle and Development Models (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models)
- [Salesforce Well-Architected: Adaptable](https://architect.salesforce.com/well-architected/adaptable/overview) — Change management from the architect lens

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Release management in plain language matters | intro |
| 2 | 0:30–1:30 | A release is a promise, a deployment is a mechanism | concept |
| 3 | 1:30–2:30 | Why Salesforce releasing is its own discipline | concept |
| 4 | 2:30–3:30 | Roles and artifacts | concept |
| 5 | 3:30–4:15 | Real story — The Friday sandbox dump | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Release management in plain language matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Release management in plain language. The difference between a deployment and a release, why Salesforce makes releasing uniquely tricky, and the roles in a healthy release process.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Release Foundations

**[0:30–1:30] A release is a promise, a deployment is a mechanism**

- **Narration (word-for-word):** A DEPLOYMENT moves metadata and code from one org to another — a technical operation this platform executes in minutes. A RELEASE is the business event wrapped around one or more deployments: an agreed scope, tested and approved, delivered to users on a communicated date, with notes explaining what changed and a plan for when it goes wrong. Teams that conflate the two ship "whatever was in the sandbox on Friday". Teams that separate them can answer the three questions leadership always asks: what exactly went out, who approved it, and how do we undo it? This platform's Releases module exists precisely to group deployments and work items into that versioned, approvable unit.
- **On screen:** Animated explainer diagram for "A release is a promise, a deployment is a mechanism": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Why Salesforce releasing is its own discipline**

- **Narration (word-for-word):** Salesforce adds constraints generic DevOps guides ignore. Changes are METADATA, and some of it (profiles, permission sets, picklist values) merges unpredictably or deploys partially. Orgs DRIFT: admins can change production directly, so "what is in production" is not guaranteed to equal "what is in git". Sandboxes refresh on their own cadence and destroy in-flight work if unplanned. And Salesforce itself upgrades every org three times a year — your calendar must absorb Spring/Summer/Winter releases you do not control. A Salesforce release process therefore needs three habits from day one: version control as the source of truth, drift detection to catch out-of-band changes (this platform's Drift module), and a release calendar that respects sandbox refreshes and platform release windows.
- **On screen:** Animated explainer diagram for "Why Salesforce releasing is its own discipline": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Roles and artifacts**

- **Narration (word-for-word):** Small team or large, the same hats exist: a RELEASE MANAGER owns the calendar, scope, and go/no-go; DEVELOPERS/ADMINS own changes and their tests; QA owns verification evidence; the BUSINESS OWNER accepts scope and signs off; on-call owns hypercare after go-live. One person may wear several hats — the failure mode is a hat nobody wears. The artifacts that make the process real rather than tribal: a versioned release record (scope + deployments + work items), release notes humans can read, an approval trail, a runbook with rollback steps, and a post-release review. If it is not written down, it does not exist at 2 a.m. during an incident.
- **On screen:** Animated explainer diagram for "Roles and artifacts": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The Friday sandbox dump**

- **Narration (word-for-word):** Here is why this matters in the real world. A retail team "released" by deploying everything in their UAT sandbox to production every second Friday. Nobody could list what was included, an unfinished pricing flow went live half-built, and the resulting discount bug ran all weekend because no one knew it had shipped — or how to remove it. What did they do? They adopted release records in this platform: every release got a version, an explicit scope of work items and deployments, business sign-off before the window, generated release notes, and a rollback note per risky item.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The Friday sandbox dump

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Deployment = mechanism; release = scoped, approved, communicated business event. Salesforce specifics: metadata quirks, org drift, sandbox refreshes, three platform upgrades a year. Version control + drift detection + a release calendar are the non-negotiable base. Artifacts (release record, notes, approvals, runbook) beat tribal memory.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Release management in plain language — the idea, the practice, and the real-world payoff. Head back to the Release Foundations module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — Branching strategies and environment flow

**Lesson ID:** `release-branching-environments` · **Reading time:** 20 min · **Video:** 5:00

> Trunk-based vs GitFlow for Salesforce teams, mapping branches to orgs, and keeping environments from becoming snowflakes.

**Learning objectives**

- Compare trunk-based development with GitFlow-style release branches
- Map branches to orgs: scratch/dev sandboxes → integration → UAT → production
- Handle hotfixes without derailing the next release

#### Concept explanation

##### Pick a branching model you can actually run

TRUNK-BASED development keeps one long-lived branch (main); work happens in short-lived feature branches merged within days, and releases are cut from main (often as tags or short release branches). It minimizes merge pain and drift between branches, but demands strong CI and feature flags for unfinished work.

GITFLOW-style models add long-lived develop and release branches. They feel safer for teams with fixed release windows and heavy UAT phases — common in Salesforce shops — at the cost of painful merges and "which branch has the fix?" archaeology. The honest guidance: fewer long-lived branches is better; add a release branch only if your UAT stabilization genuinely needs one. Whatever you pick, write it down with a diagram new joiners can follow.

##### Branches map to orgs

A Salesforce pipeline gives each stage a branch AND an org. A typical shape: feature branches ↔ scratch orgs or developer sandboxes (this platform creates scratch orgs per feature); main/develop ↔ an integration sandbox where merged work first meets itself; a release branch ↔ UAT/Full sandbox where business testing happens against production-shaped data; production ↔ the release tag that was approved.

Two rules keep the map honest. Changes flow through GIT, not org-to-org copying, so the branch always describes the org. And every org should be rebuildable from its branch — if rebuilding UAT from the release branch scares the team, drift has already won.

*One branch per stage, one org per branch — and git is the only road between them.*

```text
feature/quote-discounts ──▶ scratch org (dev + unit tests)
        │  PR + review + CI
        ▼
main ────────────────────▶ integration sandbox (auto-deploy on merge)
        │  cut release/2026.07
        ▼
release/2026.07 ─────────▶ UAT full sandbox (business sign-off)
        │  tag v2026.07 + approve
        ▼
production ◀───────────── deploy the approved tag; hotfixes branch from the tag
```

##### Hotfixes and the drift problem

Production breaks between releases. A HOTFIX branches from the production tag (not from main, which already contains unreleased work), fixes the one thing, deploys with an expedited-but-real approval, and is merged BACK into main and any active release branch immediately — the forgotten back-merge is how fixes silently vanish in the next release, the most embarrassing regression there is.

Drift is the same disease in the other direction: a change made directly in production that git does not know about. Schedule drift checks (this platform's Drift module compares orgs against their expected state), and triage every finding: retrofit it into git, or revert it in the org. Zero unexplained drift is the operational definition of "git is the source of truth".

#### Real-world example — The vanishing hotfix

- **Scenario:** A team hotfixed a broken approval process directly in production on a Tuesday. The fix was never back-merged; the next scheduled release deployed the OLD version of the process, re-breaking approvals during quarter-end — the same incident, twice, with an audience the second time.
- **Solution:** Hotfixes moved to tagged branches with a checklist item — "back-merge to main and active release branches" — enforced by a pipeline check that blocks the next release if a hotfix tag is not an ancestor of the release candidate. Weekly drift checks catch anything patched org-side.
- **Outcome:** Regression-by-release disappeared, drift findings dropped to near zero within a quarter as retrofits caught up, and the release checklist grew its most valuable line item from a real scar.

#### Key takeaways

- Prefer the fewest long-lived branches your UAT process allows
- Each pipeline stage = a branch + an org; git is the only path between orgs
- Hotfix from the production tag; back-merge immediately and verify it
- Scheduled drift checks operationally enforce "git is the source of truth"

#### Go deeper

- [Trunk-based development](https://trunkbaseddevelopment.com/) — The reference site, with team-size guidance
- [Org Development Model (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/org-development-model)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Branching strategies and environment flow matters | intro |
| 2 | 0:30–1:15 | Pick a branching model you can actually run | demo |
| 3 | 1:15–2:00 | Branches map to orgs | demo |
| 4 | 2:00–2:45 | Code walk-through — Branches map to orgs | demo |
| 5 | 2:45–3:30 | Hotfixes and the drift problem | concept |
| 6 | 3:30–4:15 | Real story — The vanishing hotfix | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Branching strategies and environment flow matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Branching strategies and environment flow. Trunk-based vs GitFlow for Salesforce teams, mapping branches to orgs, and keeping environments from becoming snowflakes. By the end of this video you will be able to compare trunk-based development with GitFlow-style release branches; map branches to orgs: scratch/dev sandboxes → integration → UAT → production; handle hotfixes without derailing the next release.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Release Foundations

**[0:30–1:15] Pick a branching model you can actually run**

- **Narration (word-for-word):** Let's actually do this together. TRUNK-BASED development keeps one long-lived branch (main); work happens in short-lived feature branches merged within days, and releases are cut from main (often as tags or short release branches). It minimizes merge pain and drift between branches, but demands strong CI and feature flags for unfinished work. GITFLOW-style models add long-lived develop and release branches. They feel safer for teams with fixed release windows and heavy UAT phases — common in Salesforce shops — at the cost of painful merges and "which branch has the fix?" archaeology.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. GITFLOW-style models add long-lived develop and release branches.
  2. They feel safer for teams with fixed release windows and heavy UAT phases — common in Salesforce shops — at the cost of painful merges and "which branch has the fix?" archaeology.
  3. The honest guidance: fewer long-lived branches is better; add a release branch only if your UAT stabilization genuinely needs one.
  4. Whatever you pick, write it down with a diagram new joiners can follow.

**[1:15–2:00] Branches map to orgs**

- **Narration (word-for-word):** Let's actually do this together. A Salesforce pipeline gives each stage a branch AND an org. A typical shape: feature branches ↔ scratch orgs or developer sandboxes (this platform creates scratch orgs per feature); main/develop ↔ an integration sandbox where merged work first meets itself; a release branch ↔ UAT/Full sandbox where business testing happens against production-shaped data; production ↔ the release tag that was approved. Two rules keep the map honest. Changes flow through GIT, not org-to-org copying, so the branch always describes the org.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Two rules keep the map honest.
  2. Changes flow through GIT, not org-to-org copying, so the branch always describes the org.
  3. And every org should be rebuildable from its branch — if rebuilding UAT from the release branch scares the team, drift has already won.

**[2:00–2:45] Code walk-through — Branches map to orgs**

- **Narration (word-for-word):** Now watch the same idea in code. One branch per stage, one org per branch — and git is the only road between them. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the text snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: TEXT

**[2:45–3:30] Hotfixes and the drift problem**

- **Narration (word-for-word):** Production breaks between releases. A HOTFIX branches from the production tag (not from main, which already contains unreleased work), fixes the one thing, deploys with an expedited-but-real approval, and is merged BACK into main and any active release branch immediately — the forgotten back-merge is how fixes silently vanish in the next release, the most embarrassing regression there is. Drift is the same disease in the other direction: a change made directly in production that git does not know about. Schedule drift checks (this platform's Drift module compares orgs against their expected state), and triage every finding: retrofit it into git, or revert it in the org.
- **On screen:** Animated explainer diagram for "Hotfixes and the drift problem": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The vanishing hotfix**

- **Narration (word-for-word):** Here is why this matters in the real world. A team hotfixed a broken approval process directly in production on a Tuesday. The fix was never back-merged; the next scheduled release deployed the OLD version of the process, re-breaking approvals during quarter-end — the same incident, twice, with an audience the second time. What did they do? Hotfixes moved to tagged branches with a checklist item — "back-merge to main and active release branches" — enforced by a pipeline check that blocks the next release if a hotfix tag is not an ancestor of the release candidate. Weekly drift checks catch anything patched org-side.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The vanishing hotfix

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Prefer the fewest long-lived branches your UAT process allows. Each pipeline stage = a branch + an org; git is the only path between orgs. Hotfix from the production tag; back-merge immediately and verify it. Scheduled drift checks operationally enforce "git is the source of truth".
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Branching strategies and environment flow — the idea, the practice, and the real-world payoff. Head back to the Release Foundations module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.3 — Cadence, calendars, and freeze windows

**Lesson ID:** `release-cadence-calendar` · **Reading time:** 15 min · **Video:** 5:00

> Choosing a release rhythm, building the calendar around sandbox refreshes and Salesforce's own releases, and running freezes that protect instead of paralyze.

**Learning objectives**

- Choose and defend a release cadence for a Salesforce team
- Build a release calendar including platform releases and sandbox refreshes
- Define freeze windows with explicit exception rules

#### Concept explanation

##### Cadence: rhythm beats heroics

A fixed cadence (weekly, biweekly, monthly) turns releasing from an event into a habit: scope cuts become "it catches the next train" instead of a crisis, stakeholders learn when to expect change, and the process itself gets practiced enough to be boring — which is the goal.

Choose cadence by your slowest reliable step, usually UAT. If business testing genuinely needs a week, a weekly cadence will ship untested work; be honest and go biweekly, then shorten as automation grows. Urgent-fix pressure is not a reason for a slower cadence — it is what the hotfix lane is for.

##### The calendar has more on it than your releases

A Salesforce release calendar carries four layers: your release windows (with code-cut and UAT-entry dates), Salesforce's three seasonal releases (test in a preview sandbox BEFORE they hit production — pin the dates each cycle), sandbox refresh schedules (a refresh mid-UAT destroys the test environment), and business blackout periods (quarter-end, Black Friday, audit season).

This platform's Calendar module holds all four: scheduled deploys, drift checks, releases, sandbox refreshes, and freeze windows in one view. The discipline is updating it BEFORE reality changes — a calendar that trails reality is decoration.

##### Freezes that protect without paralyzing

A freeze window pauses normal releases during high-risk periods. A freeze that works has three properties: a defined SCOPE (production metadata changes — not "all work"; development and integration continue), a defined EXCEPTION path (sev-1 fixes deploy during a freeze with an incident ticket and a named approver), and a defined END with a plan for the queue that built up — releasing five weeks of pent-up scope as one mega-release recreates the risk the freeze avoided.

Communicate freezes like outages: dates announced ahead, reminders at start, an explicit all-clear. The quiet failure mode is the "shadow freeze" nobody wrote down, discovered by a team mid-deploy.

#### Real-world example — UAT deleted by a scheduled refresh

- **Scenario:** A team entered their biggest UAT cycle of the year the same week IT's automation refreshed the Full sandbox on its quarterly schedule. Three days of tester evidence, configured test data, and in-progress defect reproductions vanished overnight. The release slipped three weeks.
- **Solution:** Sandbox refresh schedules moved into the shared release calendar with a hard rule — no refresh within an active UAT window without release-manager sign-off — and refresh reminders (this platform's Sandbox Refresh module) now page the release manager before executing.
- **Outcome:** The next three releases ran UAT uninterrupted; one refresh was consciously deferred nine days with a single click instead of costing three weeks. The calendar became the first artifact opened in every release kickoff.

#### Key takeaways

- Fixed cadence turns releases into habit; scope cuts become routine
- Calendar = your windows + Salesforce seasonal releases + sandbox refreshes + blackouts
- Freezes need scope, an exception path, and an end-of-freeze queue plan
- A calendar that trails reality is decoration — update it first

#### Go deeper

- [Salesforce release readiness (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/salesforce-release-readiness-strategies) — Preparing for the seasonal platform releases
- [Salesforce sandbox refresh intervals (Help)](https://help.salesforce.com/s/articleView?id=sf.data_sandbox_environments.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Cadence, calendars, and freeze windows matters | intro |
| 2 | 0:30–1:30 | Cadence: rhythm beats heroics | concept |
| 3 | 1:30–2:30 | The calendar has more on it than your releases | concept |
| 4 | 2:30–3:30 | Freezes that protect without paralyzing | concept |
| 5 | 3:30–4:15 | Real story — UAT deleted by a scheduled refresh | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Cadence, calendars, and freeze windows matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Cadence, calendars, and freeze windows. Choosing a release rhythm, building the calendar around sandbox refreshes and Salesforce's own releases, and running freezes that protect instead of paralyze.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Release Foundations

**[0:30–1:30] Cadence: rhythm beats heroics**

- **Narration (word-for-word):** A fixed cadence (weekly, biweekly, monthly) turns releasing from an event into a habit: scope cuts become "it catches the next train" instead of a crisis, stakeholders learn when to expect change, and the process itself gets practiced enough to be boring — which is the goal. Choose cadence by your slowest reliable step, usually UAT. If business testing genuinely needs a week, a weekly cadence will ship untested work; be honest and go biweekly, then shorten as automation grows. Urgent-fix pressure is not a reason for a slower cadence — it is what the hotfix lane is for.
- **On screen:** Animated explainer diagram for "Cadence: rhythm beats heroics": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] The calendar has more on it than your releases**

- **Narration (word-for-word):** A Salesforce release calendar carries four layers: your release windows (with code-cut and UAT-entry dates), Salesforce's three seasonal releases (test in a preview sandbox BEFORE they hit production — pin the dates each cycle), sandbox refresh schedules (a refresh mid-UAT destroys the test environment), and business blackout periods (quarter-end, Black Friday, audit season). This platform's Calendar module holds all four: scheduled deploys, drift checks, releases, sandbox refreshes, and freeze windows in one view. The discipline is updating it BEFORE reality changes — a calendar that trails reality is decoration.
- **On screen:** Animated explainer diagram for "The calendar has more on it than your releases": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Freezes that protect without paralyzing**

- **Narration (word-for-word):** A freeze window pauses normal releases during high-risk periods. A freeze that works has three properties: a defined SCOPE (production metadata changes — not "all work"; development and integration continue), a defined EXCEPTION path (sev-1 fixes deploy during a freeze with an incident ticket and a named approver), and a defined END with a plan for the queue that built up — releasing five weeks of pent-up scope as one mega-release recreates the risk the freeze avoided. Communicate freezes like outages: dates announced ahead, reminders at start, an explicit all-clear. The quiet failure mode is the "shadow freeze" nobody wrote down, discovered by a team mid-deploy.
- **On screen:** Animated explainer diagram for "Freezes that protect without paralyzing": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — UAT deleted by a scheduled refresh**

- **Narration (word-for-word):** Here is why this matters in the real world. A team entered their biggest UAT cycle of the year the same week IT's automation refreshed the Full sandbox on its quarterly schedule. Three days of tester evidence, configured test data, and in-progress defect reproductions vanished overnight. The release slipped three weeks. What did they do? Sandbox refresh schedules moved into the shared release calendar with a hard rule — no refresh within an active UAT window without release-manager sign-off — and refresh reminders (this platform's Sandbox Refresh module) now page the release manager before executing.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** UAT deleted by a scheduled refresh

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Fixed cadence turns releases into habit; scope cuts become routine. Calendar = your windows + Salesforce seasonal releases + sandbox refreshes + blackouts. Freezes need scope, an exception path, and an end-of-freeze queue plan. A calendar that trails reality is decoration — update it first.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Cadence, calendars, and freeze windows — the idea, the practice, and the real-world payoff. Head back to the Release Foundations module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: Building the Pipeline

CI/CD for Salesforce with real quality gates: validation deploys, test strategy, static analysis, and deployment/rollback mechanics that hold up under pressure.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 2.1 — CI/CD pipelines and quality gates

**Lesson ID:** `release-cicd-quality-gates` · **Reading time:** 20 min · **Video:** 5:00

> What a Salesforce pipeline actually runs at each stage, validate-only deploys as the core trick, and gates that block bad changes without blocking the team.

**Learning objectives**

- Describe each pipeline stage from commit to production deploy
- Use check-only (validate) deploys as pre-merge quality gates
- Design gates that are strict on main and fast on feature branches

#### Concept explanation

##### Continuous integration, Salesforce edition

CI means every change is automatically built and verified when pushed. For Salesforce: on every pull request, the pipeline creates or reuses an isolated org (scratch orgs shine here — this platform provisions them from templates), deploys the branch, runs the relevant Apex tests and static analysis, and reports pass/fail on the PR. Merge is blocked until green.

The payoff is integration bugs found within minutes of the commit that caused them, by a machine, instead of three weeks later in UAT by a human who then has to bisect three weeks of merges. CI is the single highest-leverage investment a Salesforce team can make.

##### The validate-only deploy: Salesforce's secret gate

A check-only deployment compiles metadata and runs specified tests against a REAL target org without committing anything. It is the perfect gate: validate the release candidate against a production-shaped org (or production itself) hours before the window, so surprises surface while everyone is calm.

A mature pipeline validates at three points: PR-time against an integration-shaped org, release-cut time against UAT, and pre-release against production (a "quick deploy" can then release the validated package within ten days without re-running tests). This platform's deployment tooling exposes check-only as a first-class option — use it until it is boring.

*Every PR: isolated org, tests, analysis, and a validate against the shared target.*

```yaml
# Pipeline sketch: PR verification for a Salesforce repo
on: pull_request
jobs:
  verify:
    steps:
      - checkout
      - run: sf org create scratch --definition-file config/project-scratch-def.json --alias pr-org
      - run: sf project deploy start --target-org pr-org          # real deploy to isolated org
      - run: sf apex run test --target-org pr-org --code-coverage --result-format junit
      - run: sf code-analyzer run --workspace force-app --rule-selector Recommended  # static analysis
      - run: sf project deploy validate --target-org integration  # check-only vs shared org
      # merge is blocked unless every step is green
```

##### Gates that respect the team

A quality gate is a CHECK with a THRESHOLD and a CONSEQUENCE: coverage below 85% blocks merge; any Critical static-analysis finding blocks merge; validation failure blocks the release. Gates must be fast (feature-branch gates in minutes — run impacted tests, not the whole org suite), deterministic (a flaky gate teaches people to click re-run until green, which is no gate at all), and tiered — light on feature branches, full on main and release branches.

Every gate needs a documented override path with named approvers and an audit trail, because a gate that can never be overridden will be deleted the first time it blocks a sev-1 fix.

#### Real-world example — The 11 p.m. profile failure

- **Scenario:** A team's monthly release repeatedly failed at 11 p.m. in production with profile and field-level-security errors that UAT never showed — UAT had been hand-patched over months and no longer resembled production. Each failure meant a scramble-and-abort with the business watching.
- **Solution:** They added a check-only validation of the full release package against PRODUCTION at release-cut time, three days before the window, and rebuilt UAT from the release branch each cycle so it stopped being a snowflake.
- **Outcome:** The next three releases deployed first-try in under 20 minutes using quick deploy of the pre-validated package. The 11 p.m. war room became a 15-minute checklist, and release-night attendance dropped from eight people to two.

#### Key takeaways

- CI on every PR: isolated org, deploy, tests, analysis — merge blocked until green
- Check-only deploys validate against real orgs without changing them
- Validate the release package against production days early; quick-deploy it in the window
- Gates must be fast, deterministic, tiered, and overridable with an audit trail

#### Go deeper

- [Continuous Integration using Salesforce DX (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/sfdx_travis_ci)
- [sf project deploy validate (CLI reference)](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_project_commands_unified.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why CI/CD pipelines and quality gates matters | intro |
| 2 | 0:30–1:15 | Continuous integration, Salesforce edition | demo |
| 3 | 1:15–2:00 | The validate-only deploy: Salesforce's secret gate | demo |
| 4 | 2:00–2:45 | Code walk-through — The validate-only deploy: Salesforce's secret gate | demo |
| 5 | 2:45–3:30 | Gates that respect the team | demo |
| 6 | 3:30–4:15 | Real story — The 11 p.m. profile failure | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why CI/CD pipelines and quality gates matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on CI/CD pipelines and quality gates. What a Salesforce pipeline actually runs at each stage, validate-only deploys as the core trick, and gates that block bad changes without blocking the team.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Building the Pipeline

**[0:30–1:15] Continuous integration, Salesforce edition**

- **Narration (word-for-word):** Let's actually do this together. CI means every change is automatically built and verified when pushed. For Salesforce: on every pull request, the pipeline creates or reuses an isolated org (scratch orgs shine here — this platform provisions them from templates), deploys the branch, runs the relevant Apex tests and static analysis, and reports pass/fail on the PR. Merge is blocked until green. The payoff is integration bugs found within minutes of the commit that caused them, by a machine, instead of three weeks later in UAT by a human who then has to bisect three weeks of merges.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. For Salesforce: on every pull request, the pipeline creates or reuses an isolated org (scratch orgs shine here — this platform provisions them from templates), deploys the branch, runs the relevant Apex tests and static analysis, and reports pass/fail on the PR.
  2. Merge is blocked until green.

**[1:15–2:00] The validate-only deploy: Salesforce's secret gate**

- **Narration (word-for-word):** Let's actually do this together. A check-only deployment compiles metadata and runs specified tests against a REAL target org without committing anything. It is the perfect gate: validate the release candidate against a production-shaped org (or production itself) hours before the window, so surprises surface while everyone is calm. A mature pipeline validates at three points: PR-time against an integration-shaped org, release-cut time against UAT, and pre-release against production (a "quick deploy" can then release the validated package within ten days without re-running tests). This platform's deployment tooling exposes check-only as a first-class option — use it until it is boring.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. A check-only deployment compiles metadata and runs specified tests against a REAL target org without committing anything.
  2. It is the perfect gate: validate the release candidate against a production-shaped org (or production itself) hours before the window, so surprises surface while everyone is calm.

**[2:00–2:45] Code walk-through — The validate-only deploy: Salesforce's secret gate**

- **Narration (word-for-word):** Now watch the same idea in code. Every PR: isolated org, tests, analysis, and a validate against the shared target. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the yaml snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: YAML

**[2:45–3:30] Gates that respect the team**

- **Narration (word-for-word):** Let's actually do this together. A quality gate is a CHECK with a THRESHOLD and a CONSEQUENCE: coverage below 85% blocks merge; any Critical static-analysis finding blocks merge; validation failure blocks the release. Gates must be fast (feature-branch gates in minutes — run impacted tests, not the whole org suite), deterministic (a flaky gate teaches people to click re-run until green, which is no gate at all), and tiered — light on feature branches, full on main and release branches.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. A quality gate is a CHECK with a THRESHOLD and a CONSEQUENCE: coverage below 85% blocks merge; any Critical static-analysis finding blocks merge; validation failure blocks the release.
  2. Gates must be fast (feature-branch gates in minutes — run impacted tests, not the whole org suite), deterministic (a flaky gate teaches people to click re-run until green, which is no gate at all), and tiered — light on feature branches, full on main and release branches.

**[3:30–4:15] Real story — The 11 p.m. profile failure**

- **Narration (word-for-word):** Here is why this matters in the real world. A team's monthly release repeatedly failed at 11 p.m. in production with profile and field-level-security errors that UAT never showed — UAT had been hand-patched over months and no longer resembled production. Each failure meant a scramble-and-abort with the business watching. What did they do? They added a check-only validation of the full release package against PRODUCTION at release-cut time, three days before the window, and rebuilt UAT from the release branch each cycle so it stopped being a snowflake. And the payoff: The next three releases deployed first-try in under 20 minutes using quick deploy of the pre-validated package.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The 11 p.m. profile failure

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. CI on every PR: isolated org, deploy, tests, analysis — merge blocked until green. Check-only deploys validate against real orgs without changing them. Validate the release package against production days early; quick-deploy it in the window. Gates must be fast, deterministic, tiered, and overridable with an audit trail.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is CI/CD pipelines and quality gates — the idea, the practice, and the real-world payoff. Head back to the Building the Pipeline module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Test strategy and static analysis

**Lesson ID:** `release-testing-static-analysis` · **Reading time:** 18 min · **Video:** 5:00

> A test pyramid that fits Salesforce, coverage as a floor not a goal, and static analysis (PMD/Code Analyzer) wired into the pipeline.

**Learning objectives**

- Structure unit, integration, and UAT layers for Salesforce changes
- Treat coverage thresholds as a floor and assertions as the point
- Gate merges on static-analysis findings by severity

#### Concept explanation

##### The Salesforce test pyramid

The base: fast APEX UNIT TESTS asserting behavior (not just achieving coverage) — data built via factories, callouts mocked, run on every PR. The middle: INTEGRATION-LEVEL checks — Flow tests, cross-module Apex suites, and automated UI smoke tests for the critical journeys, run on merge to main and nightly. The top: HUMAN UAT against production-shaped data in a Full/Partial sandbox, scoped to the release, with recorded evidence.

The inversion anti-pattern — thin unit tests, everything discovered manually in UAT — makes every release cycle slow AND fragile: bugs found latest cost most. Push detection down the pyramid relentlessly.

##### Coverage honestly

Salesforce requires 75% coverage to deploy Apex to production; healthy teams gate at 85%+ — but as a FLOOR, not a target. Coverage measures which lines EXECUTED, not which behaviors are VERIFIED: a test calling a method with no assertions produces coverage and zero protection. Review tests for assertion quality the way you review code, and track per-class coverage on core domains rather than one org-wide average that hides hollow spots.

This platform's Apex Quality module runs org test suites and trends coverage over time — a falling trend on a core class is a review conversation, not a deploy-day discovery.

##### Static analysis: the reviewer that never sleeps

Salesforce Code Analyzer (bundled into this platform's tooling) runs PMD and the Apex rules over every changeset: SOQL/DML inside loops, missing sharing declarations, hardcoded ids, unclosed queries, CRUD/FLS violations, plus Flow anti-patterns. Findings carry severities — gate on them: Critical/High block merge; Medium requires review; Low is advisory.

Adopting analysis on a legacy codebase? Baseline first: record existing findings, fail the build only on NEW ones, and burn the baseline down deliberately. Turning on 4,000 failures at once teaches the team to ignore the tool permanently.

*Static analysis finds the pattern at review time — before a 200-record batch finds it in production.*

```apex
// The classic finding: SOQL inside a loop — invisible in a 5-record test,
// fatal at 200 records in production.
for (Opportunity opp : Trigger.new) {
    Account acc = [SELECT OwnerId FROM Account WHERE Id = :opp.AccountId]; // PMD: AvoidSoqlInLoops
    opp.OwnerId = acc.OwnerId;
}

// The fix the analyzer is pushing you toward: query once, look up in the loop.
Map<Id, Account> accounts = new Map<Id, Account>(
    [SELECT OwnerId FROM Account WHERE Id IN :accountIds]);
for (Opportunity opp : Trigger.new) {
    opp.OwnerId = accounts.get(opp.AccountId)?.OwnerId;
}
```

#### Real-world example — Ninety-two percent coverage, zero protection

- **Scenario:** An insurer's org showed 92% coverage, yet a premium-calculation change shipped a rounding bug that mispriced 30,000 renewals. The class's test called calculatePremium() for coverage and asserted nothing — the bug executed green through the entire pipeline.
- **Solution:** The team audited tests on the top twenty revenue-critical classes for assertion quality, rewrote the hollow ones around business scenarios with exact expected figures, and added a review rule: a test without meaningful assertions is a defect.
- **Outcome:** The rewritten suite caught two further calculation bugs pre-merge within the quarter. Coverage barely moved — protection moved enormously, and "what do the assertions prove?" became the first question in test review.

#### Key takeaways

- Pyramid: unit tests on every PR; integration on merge; scoped human UAT last
- Coverage is a floor; assertion quality is the actual protection
- Gate on static-analysis severity; baseline legacy findings and burn down
- Bugs found lower in the pyramid cost an order of magnitude less

#### Go deeper

- [Salesforce Code Analyzer](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/overview)
- [Apex Testing (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/apex_testing)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Test strategy and static analysis matters | intro |
| 2 | 0:30–1:15 | The Salesforce test pyramid | demo |
| 3 | 1:15–2:00 | Coverage honestly | demo |
| 4 | 2:00–2:45 | Static analysis: the reviewer that never sleeps | concept |
| 5 | 2:45–3:30 | Code walk-through — Static analysis: the reviewer that never sleeps | demo |
| 6 | 3:30–4:15 | Real story — Ninety-two percent coverage, zero protection | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Test strategy and static analysis matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Test strategy and static analysis. A test pyramid that fits Salesforce, coverage as a floor not a goal, and static analysis (PMD/Code Analyzer) wired into the pipeline.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Building the Pipeline

**[0:30–1:15] The Salesforce test pyramid**

- **Narration (word-for-word):** Let's actually do this together. The base: fast APEX UNIT TESTS asserting behavior (not just achieving coverage) — data built via factories, callouts mocked, run on every PR. The middle: INTEGRATION-LEVEL checks — Flow tests, cross-module Apex suites, and automated UI smoke tests for the critical journeys, run on merge to main and nightly. The top: HUMAN UAT against production-shaped data in a Full/Partial sandbox, scoped to the release, with recorded evidence. The inversion anti-pattern — thin unit tests, everything discovered manually in UAT — makes every release cycle slow AND fragile: bugs found latest cost most. Push detection down the pyramid relentlessly.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. The base: fast APEX UNIT TESTS asserting behavior (not just achieving coverage) — data built via factories, callouts mocked, run on every PR.
  2. The middle: INTEGRATION-LEVEL checks — Flow tests, cross-module Apex suites, and automated UI smoke tests for the critical journeys, run on merge to main and nightly.

**[1:15–2:00] Coverage honestly**

- **Narration (word-for-word):** Let's actually do this together. Salesforce requires 75% coverage to deploy Apex to production; healthy teams gate at 85%+ — but as a FLOOR, not a target. Coverage measures which lines EXECUTED, not which behaviors are VERIFIED: a test calling a method with no assertions produces coverage and zero protection. Review tests for assertion quality the way you review code, and track per-class coverage on core domains rather than one org-wide average that hides hollow spots. This platform's Apex Quality module runs org test suites and trends coverage over time — a falling trend on a core class is a review conversation, not a deploy-day discovery.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Salesforce requires 75% coverage to deploy Apex to production; healthy teams gate at 85%+ — but as a FLOOR, not a target.
  2. Coverage measures which lines EXECUTED, not which behaviors are VERIFIED: a test calling a method with no assertions produces coverage and zero protection.

**[2:00–2:45] Static analysis: the reviewer that never sleeps**

- **Narration (word-for-word):** Salesforce Code Analyzer (bundled into this platform's tooling) runs PMD and the Apex rules over every changeset: SOQL/DML inside loops, missing sharing declarations, hardcoded ids, unclosed queries, CRUD/FLS violations, plus Flow anti-patterns. Findings carry severities — gate on them: Critical/High block merge; Medium requires review; Low is advisory. Adopting analysis on a legacy codebase? Baseline first: record existing findings, fail the build only on NEW ones, and burn the baseline down deliberately. Turning on 4,000 failures at once teaches the team to ignore the tool permanently.
- **On screen:** Animated explainer diagram for "Static analysis: the reviewer that never sleeps": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Code walk-through — Static analysis: the reviewer that never sleeps**

- **Narration (word-for-word):** Now watch the same idea in code. Static analysis finds the pattern at review time — before a 200-record batch finds it in production. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the apex snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: APEX

**[3:30–4:15] Real story — Ninety-two percent coverage, zero protection**

- **Narration (word-for-word):** Here is why this matters in the real world. An insurer's org showed 92% coverage, yet a premium-calculation change shipped a rounding bug that mispriced 30,000 renewals. The class's test called calculatePremium() for coverage and asserted nothing — the bug executed green through the entire pipeline. What did they do? The team audited tests on the top twenty revenue-critical classes for assertion quality, rewrote the hollow ones around business scenarios with exact expected figures, and added a review rule: a test without meaningful assertions is a defect. And the payoff: The rewritten suite caught two further calculation bugs pre-merge within the quarter.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Ninety-two percent coverage, zero protection

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Pyramid: unit tests on every PR; integration on merge; scoped human UAT last. Coverage is a floor; assertion quality is the actual protection. Gate on static-analysis severity; baseline legacy findings and burn down. Bugs found lower in the pyramid cost an order of magnitude less.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Test strategy and static analysis — the idea, the practice, and the real-world payoff. Head back to the Building the Pipeline module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.3 — Deployment strategies and rollback plans

**Lesson ID:** `release-deployment-strategies` · **Reading time:** 20 min · **Video:** 5:00

> Delta vs full deploys, destructive changes, data + metadata sequencing, and rollback plans you have actually rehearsed.

**Learning objectives**

- Choose between delta and full deployments deliberately
- Sequence risky releases: destructive changes, data migrations, feature flags
- Write and rehearse a rollback plan per release

#### Concept explanation

##### Delta vs full, and the destructive-change trap

A DELTA deploy ships only what changed between two git points — fast, minimal blast radius, the right default (this platform's git-based deployment computes deltas). A FULL deploy ships the entire repository state — slower but self-correcting, worth running periodically to squash accumulated drift.

DELETIONS never happen implicitly: removing a field from git does not remove it from the org. Destructive changes ship as their own manifest, ideally in a separate, post-verification step — deleting a field still referenced by a report or integration is a self-inflicted sev-2. Deprecate (hide, stop writing) one release before you destroy.

##### Sequencing the risky release

Real releases mix metadata, data, and behavior changes, and ORDER is part of correctness. The stable pattern: 1) pre-deploy data preparation (backfill new fields, load reference data — this platform's data deployment handles org-to-org data with previews and rollback), 2) metadata deploy with new behavior OFF behind a flag (custom permission or custom-setting toggle), 3) post-deploy verification — smoke tests, a report spot-check, integration heartbeats, 4) progressive enablement — pilot group first, then everyone, 5) cleanup of flags and deprecated components in a LATER release.

Feature flags decouple "deployed" from "live", which converts many all-or-nothing releases into reversible ones — flipping a flag off is a rollback that takes seconds and needs no deploy window.

##### Rollback: a plan, not a hope

Salesforce has no one-click org restore, so rollback is designed per release, per item: metadata rolls back by deploying the PREVIOUS git tag (delta in reverse — trivial IF everything lives in git); flags roll back by flipping off; data migrations roll back via captured before-images (this platform's data deploy keeps rollback data) or a written compensating script; some items (deleted data, sent emails) do NOT roll back — the plan must say so and define forward-fix instead.

Two disciplines separate teams that recover in minutes from teams that improvise at midnight: every release names its rollback decision-maker and time-box ("if smoke tests fail past 30 minutes, we roll back — X decides"), and the metadata rollback path is REHEARSED in a sandbox each cycle so the first execution is never production.

*One card per release: triggers, owner, timed steps, and what will not roll back.*

```text
ROLLBACK CARD — Release 2026.07 · Quote Discounts
----------------------------------------------------
Trigger: smoke tests failing OR error rate > 2% for 30 min
Decision-maker: R. Mehta (release manager)

1. Flip custom permission "Quote_Discounts_Enabled" OFF   (~1 min, no deploy)
2. If metadata fault: deploy tag v2026.06 delta            (~12 min, rehearsed 07-14 in UAT)
3. Data: discount backfill reversible via captured rollback set RB-118
4. NOT reversible: 340 quote PDFs already emailed — comms owner: L. Ortiz
5. Announce in #releases; open incident if step 2 executed
```

#### Real-world example — The rollback that had never been run

- **Scenario:** A CPQ pricing release misbehaved at 7 a.m. as order volume ramped. The team had a rollback "plan" — one line: "redeploy previous version" — that had never been executed. The old branch would not validate (a permission set had changed underneath), and improvising the fix took four hours of revenue-impacting downtime.
- **Solution:** Rollback became a first-class release artifact: new behavior behind a flag wherever possible, previous-tag redeploy rehearsed in UAT during each release week, rollback data captured for migrations, and a named decision-maker with a 30-minute time-box.
- **Outcome:** The next pricing incident was neutralized in 90 seconds by flipping the flag off, root-caused calmly, and forward-fixed the same afternoon. Downtime cost went from four hours to effectively zero — the rehearsal habit paid for itself in one incident.

#### Key takeaways

- Delta by default; periodic full deploys self-correct drift
- Destructive changes are explicit, separate, and one release behind deprecation
- Flags decouple deploy from enable — seconds-fast rollback for behavior
- Rollback plans name triggers, owners, and time-boxes — and get rehearsed

#### Go deeper

- [Metadata API deployment (Developer Guide)](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm)
- [DevOps Center (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/devops-center) — Salesforce's own pipeline tooling concepts

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Deployment strategies and rollback plans matters | intro |
| 2 | 0:30–1:15 | Delta vs full, and the destructive-change trap | demo |
| 3 | 1:15–2:00 | Sequencing the risky release | concept |
| 4 | 2:00–2:45 | Rollback: a plan, not a hope | concept |
| 5 | 2:45–3:30 | Code walk-through — Rollback: a plan, not a hope | demo |
| 6 | 3:30–4:15 | Real story — The rollback that had never been run | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Deployment strategies and rollback plans matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Deployment strategies and rollback plans. Delta vs full deploys, destructive changes, data + metadata sequencing, and rollback plans you have actually rehearsed. By the end of this video you will be able to choose between delta and full deployments deliberately; sequence risky releases: destructive changes, data migrations, feature flags; write and rehearse a rollback plan per release.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Building the Pipeline

**[0:30–1:15] Delta vs full, and the destructive-change trap**

- **Narration (word-for-word):** Let's actually do this together. A DELTA deploy ships only what changed between two git points — fast, minimal blast radius, the right default (this platform's git-based deployment computes deltas). A FULL deploy ships the entire repository state — slower but self-correcting, worth running periodically to squash accumulated drift. DELETIONS never happen implicitly: removing a field from git does not remove it from the org. Destructive changes ship as their own manifest, ideally in a separate, post-verification step — deleting a field still referenced by a report or integration is a self-inflicted sev-2. Deprecate (hide, stop writing) one release before you destroy.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. A DELTA deploy ships only what changed between two git points — fast, minimal blast radius, the right default (this platform's git-based deployment computes deltas).
  2. A FULL deploy ships the entire repository state — slower but self-correcting, worth running periodically to squash accumulated drift.

**[1:15–2:00] Sequencing the risky release**

- **Narration (word-for-word):** Real releases mix metadata, data, and behavior changes, and ORDER is part of correctness. The stable pattern: 1) pre-deploy data preparation (backfill new fields, load reference data — this platform's data deployment handles org-to-org data with previews and rollback), 2) metadata deploy with new behavior OFF behind a flag (custom permission or custom-setting toggle), 3) post-deploy verification — smoke tests, a report spot-check, integration heartbeats, 4) progressive enablement — pilot group first, then everyone, 5) cleanup of flags and deprecated components in a LATER release.
- **On screen:** Animated explainer diagram for "Sequencing the risky release": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Rollback: a plan, not a hope**

- **Narration (word-for-word):** Salesforce has no one-click org restore, so rollback is designed per release, per item: metadata rolls back by deploying the PREVIOUS git tag (delta in reverse — trivial IF everything lives in git); flags roll back by flipping off; data migrations roll back via captured before-images (this platform's data deploy keeps rollback data) or a written compensating script; some items (deleted data, sent emails) do NOT roll back — the plan must say so and define forward-fix instead.
- **On screen:** Animated explainer diagram for "Rollback: a plan, not a hope": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Code walk-through — Rollback: a plan, not a hope**

- **Narration (word-for-word):** Now watch the same idea in code. One card per release: triggers, owner, timed steps, and what will not roll back. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the text snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: TEXT

**[3:30–4:15] Real story — The rollback that had never been run**

- **Narration (word-for-word):** Here is why this matters in the real world. A CPQ pricing release misbehaved at 7 a.m. as order volume ramped. The team had a rollback "plan" — one line: "redeploy previous version" — that had never been executed. The old branch would not validate (a permission set had changed underneath), and improvising the fix took four hours of revenue-impacting downtime. What did they do? Rollback became a first-class release artifact: new behavior behind a flag wherever possible, previous-tag redeploy rehearsed in UAT during each release week, rollback data captured for migrations, and a named decision-maker with a 30-minute time-box.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The rollback that had never been run

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Delta by default; periodic full deploys self-correct drift. Destructive changes are explicit, separate, and one release behind deprecation. Flags decouple deploy from enable — seconds-fast rollback for behavior. Rollback plans name triggers, owners, and time-boxes — and get rehearsed.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Deployment strategies and rollback plans — the idea, the practice, and the real-world payoff. Head back to the Building the Pipeline module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: Running the Release

The human side done professionally: planning and approvals, release notes people read, go-live runbooks, hypercare, and the metrics that drive improvement.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 3.1 — Release planning, notes, and approvals

**Lesson ID:** `release-planning-notes-approvals` · **Reading time:** 15 min · **Video:** 5:00

> Scope cuts without drama, approval flows that add safety instead of ceremony, and release notes for three different audiences.

**Learning objectives**

- Run a release cycle: scope lock, code cut, UAT entry, go/no-go
- Design an approval flow that is auditable but not bureaucratic
- Write release notes for business users, admins, and engineers

#### Concept explanation

##### The cycle: dates that create calm

A release cycle is four dates everyone knows: SCOPE LOCK (what is in; later arrivals catch the next train), CODE CUT (the release branch/tag is created; only stabilization fixes enter), UAT ENTRY/EXIT (business verification with recorded evidence), and GO/NO-GO (a 15-minute meeting reviewing a checklist: UAT sign-off, validation green, rollback card ready, comms drafted, no open sev-1s).

The emotional shift this creates is underrated: scope pressure becomes "next release is in two weeks" instead of a fight, and go/no-go becomes checklist review instead of vibes. This platform's Releases module tracks the version, its work items, deployments, and approval state in one record.

##### Approvals that mean something

An approval flow answers: who confirms the change WORKS (QA/UAT sign-off), who accepts the RISK (business owner), and who confirms the org is READY (release manager)? Two or three named approvals, recorded on the release record with timestamps, are auditable and fast. Twelve-signature chains are neither — they diffuse accountability until nobody actually reads what they sign.

Calibrate rigor to risk: a label fix and a sharing-model change should not share a process. Define lanes (standard / expedited / emergency) with entry criteria, and let the emergency lane be genuinely fast — a sev-1 fix blocked on a vacationing approver is how teams learn to bypass process permanently.

##### Release notes: three audiences, one source

BUSINESS USERS need "what changes for me Monday morning" — features, changed screens, new steps, in their words, with screenshots for anything visual. ADMINS need operational detail: new permissions and flags, changed automations, data migrations, known limitations. ENGINEERS need the changelog: work items, deployments, tags, and links back to the release record.

Generate the skeleton from the release scope (this platform drafts AI release notes from the work items and deployments in the release) and edit for humans — generated notes are a starting point, not a shipping product. Send the business version BEFORE go-live; notes discovered after the change hit users read as an apology.

#### Real-world example — The release nobody told support about

- **Scenario:** A team shipped a redesigned case-close flow on a Sunday. Monday 8 a.m., the support floor found their muscle memory broken mid-call: 200 agents, no warning, no notes. The support director escalated to the COO by 9:15, and the (well-built) feature spent its first week as an incident.
- **Solution:** Release comms became a go/no-go checklist item: business-facing notes distributed three days early to affected team leads, a two-minute walkthrough video for UI changes, and a named comms owner per release. No sign-off from affected department leads, no go.
- **Outcome:** The next flow change landed with agents who had already watched the walkthrough; support tickets about "the new screen" dropped to near zero, and the support director became the release process's loudest advocate — the cheapest stakeholder win the team ever bought.

#### Key takeaways

- Four dates run the cycle: scope lock, code cut, UAT window, go/no-go
- Two or three named, recorded approvals beat twelve-signature ceremony
- Risk-calibrated lanes: standard, expedited, emergency — all defined upfront
- Notes ship BEFORE go-live, written per audience, generated then humanized

#### Go deeper

- [Salesforce release management best practices (Architect)](https://architect.salesforce.com/well-architected/adaptable/overview)
- [Change management (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/org-change-management)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Release planning, notes, and approvals matters | intro |
| 2 | 0:30–1:30 | The cycle: dates that create calm | concept |
| 3 | 1:30–2:30 | Approvals that mean something | concept |
| 4 | 2:30–3:30 | Release notes: three audiences, one source | concept |
| 5 | 3:30–4:15 | Real story — The release nobody told support about | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Release planning, notes, and approvals matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Release planning, notes, and approvals. Scope cuts without drama, approval flows that add safety instead of ceremony, and release notes for three different audiences.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Running the Release

**[0:30–1:30] The cycle: dates that create calm**

- **Narration (word-for-word):** A release cycle is four dates everyone knows: SCOPE LOCK (what is in; later arrivals catch the next train), CODE CUT (the release branch/tag is created; only stabilization fixes enter), UAT ENTRY/EXIT (business verification with recorded evidence), and GO/NO-GO (a 15-minute meeting reviewing a checklist: UAT sign-off, validation green, rollback card ready, comms drafted, no open sev-1s). The emotional shift this creates is underrated: scope pressure becomes "next release is in two weeks" instead of a fight, and go/no-go becomes checklist review instead of vibes. This platform's Releases module tracks the version, its work items, deployments, and approval state in one record.
- **On screen:** Animated explainer diagram for "The cycle: dates that create calm": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Approvals that mean something**

- **Narration (word-for-word):** An approval flow answers: who confirms the change WORKS (QA/UAT sign-off), who accepts the RISK (business owner), and who confirms the org is READY (release manager)? Two or three named approvals, recorded on the release record with timestamps, are auditable and fast. Twelve-signature chains are neither — they diffuse accountability until nobody actually reads what they sign. Calibrate rigor to risk: a label fix and a sharing-model change should not share a process. Define lanes (standard / expedited / emergency) with entry criteria, and let the emergency lane be genuinely fast — a sev-1 fix blocked on a vacationing approver is how teams learn to bypass process permanently.
- **On screen:** Animated explainer diagram for "Approvals that mean something": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Release notes: three audiences, one source**

- **Narration (word-for-word):** BUSINESS USERS need "what changes for me Monday morning" — features, changed screens, new steps, in their words, with screenshots for anything visual. ADMINS need operational detail: new permissions and flags, changed automations, data migrations, known limitations. ENGINEERS need the changelog: work items, deployments, tags, and links back to the release record. Generate the skeleton from the release scope (this platform drafts AI release notes from the work items and deployments in the release) and edit for humans — generated notes are a starting point, not a shipping product. Send the business version BEFORE go-live; notes discovered after the change hit users read as an apology.
- **On screen:** Animated explainer diagram for "Release notes: three audiences, one source": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The release nobody told support about**

- **Narration (word-for-word):** Here is why this matters in the real world. A team shipped a redesigned case-close flow on a Sunday. Monday 8 a.m., the support floor found their muscle memory broken mid-call: 200 agents, no warning, no notes. The support director escalated to the COO by 9:15, and the (well-built) feature spent its first week as an incident. What did they do? Release comms became a go/no-go checklist item: business-facing notes distributed three days early to affected team leads, a two-minute walkthrough video for UI changes, and a named comms owner per release. No sign-off from affected department leads, no go.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The release nobody told support about

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Four dates run the cycle: scope lock, code cut, UAT window, go/no-go. Two or three named, recorded approvals beat twelve-signature ceremony. Risk-calibrated lanes: standard, expedited, emergency — all defined upfront. Notes ship BEFORE go-live, written per audience, generated then humanized.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Release planning, notes, and approvals — the idea, the practice, and the real-world payoff. Head back to the Running the Release module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — Go-live runbooks and hypercare

**Lesson ID:** `release-go-live-hypercare` · **Reading time:** 18 min · **Video:** 5:00

> A minute-by-minute release window, smoke tests that prove life, and a hypercare period that catches what testing missed.

**Learning objectives**

- Write a go-live runbook with owners and timings per step
- Design post-deploy smoke tests for critical business journeys
- Run a hypercare period with real monitoring and exit criteria

#### Concept explanation

##### The runbook: choreography, not heroics

A go-live runbook lists every step with an OWNER, an EXPECTED DURATION, and a VERIFICATION: pre-window checks (validation green, approvals recorded, rollback card printed), the window itself (maintenance banner up, integrations paused if needed, quick deploy executed, data steps run, flags flipped for pilot), and verification before declaring success.

Write it so a competent colleague who was not in the planning meetings could execute it. Timestamps get filled in as you go — that log is gold for the retrospective and for auditors. Releases become boring when the runbook, not adrenaline, does the driving; boring is the goal.

##### Smoke tests: prove the business still works

Within minutes of deploy completion, verify the CRITICAL JOURNEYS — not everything, the five-to-ten flows the business cannot live without: create a lead and convert it, quote a standard deal, close a case, run the revenue report, confirm the ERP integration heartbeat. Script them (who clicks what, what must appear), pre-assign each to a person, and time-box to 20-30 minutes.

Automate what you can (API-level checks and integration heartbeats catch a broad class of failures instantly — this platform's monitoring shows job health live), but keep a human on the UI paths: users experience the UI, not the API. Smoke results are the input to the "declare success or trigger rollback" decision — which is why the rollback card defined the threshold BEFORE the window.

##### Hypercare: the release is not done at deploy

Hypercare is a defined period (48 hours to two weeks, scaled to risk) of heightened attention after go-live: a named rotation watching error rates, integration health, and support tickets; a fast lane for release-related defects that bypasses normal triage; and a daily 15-minute review of what surfaced.

Define EXIT CRITERIA up front — error rates at baseline, no open release-tagged sev-1/2, ticket volume normal — and close hypercare explicitly with a short retrospective: what leaked past which pyramid layer, and which gate or test gets strengthened so it cannot leak again. That loop, run every release, is how a mediocre process becomes a great one in two quarters.

#### Real-world example — The integration that died quietly at go-live

- **Scenario:** A release changed an Opportunity field an ERP integration read. Deploy succeeded, UI smoke tests passed, everyone went to bed. The integration had been failing since 9:07 p.m.; by morning, 14 hours of orders were missing from the ERP and month-end reconciliation was chaos.
- **Solution:** Integration heartbeats became a mandatory smoke-test line item — synthetic transactions pushed through each critical integration within 15 minutes of deploy — and hypercare monitoring watched integration error rates on a dashboard with paging thresholds for the first 48 hours.
- **Outcome:** Two releases later the same class of failure fired the heartbeat alert at go-live plus 12 minutes; the field mapping was fixed within the window, zero orders were lost, and the incident-that-did-not-happen made the case for the monitoring investment better than any slide deck.

#### Key takeaways

- Runbooks have owners, durations, and verifications per step — executable by a stranger
- Smoke-test the critical journeys, UI and integrations, within minutes of deploy
- Hypercare = named rotation + fast defect lane + daily review, with exit criteria
- Every leak strengthens a lower layer: the improvement loop that compounds

#### Go deeper

- [Salesforce incident & change readiness (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/org-change-management)
- [Google SRE: Being on-call (concepts transfer)](https://sre.google/sre-book/being-on-call/) — The hypercare mindset, formalized

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Go-live runbooks and hypercare matters | intro |
| 2 | 0:30–1:30 | The runbook: choreography, not heroics | concept |
| 3 | 1:30–2:30 | Smoke tests: prove the business still works | demo |
| 4 | 2:30–3:30 | Hypercare: the release is not done at deploy | demo |
| 5 | 3:30–4:15 | Real story — The integration that died quietly at go-live | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Go-live runbooks and hypercare matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Go-live runbooks and hypercare. A minute-by-minute release window, smoke tests that prove life, and a hypercare period that catches what testing missed. By the end of this video you will be able to write a go-live runbook with owners and timings per step; design post-deploy smoke tests for critical business journeys; run a hypercare period with real monitoring and exit criteria.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Running the Release

**[0:30–1:30] The runbook: choreography, not heroics**

- **Narration (word-for-word):** A go-live runbook lists every step with an OWNER, an EXPECTED DURATION, and a VERIFICATION: pre-window checks (validation green, approvals recorded, rollback card printed), the window itself (maintenance banner up, integrations paused if needed, quick deploy executed, data steps run, flags flipped for pilot), and verification before declaring success. Write it so a competent colleague who was not in the planning meetings could execute it. Timestamps get filled in as you go — that log is gold for the retrospective and for auditors. Releases become boring when the runbook, not adrenaline, does the driving; boring is the goal.
- **On screen:** Animated explainer diagram for "The runbook: choreography, not heroics": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Smoke tests: prove the business still works**

- **Narration (word-for-word):** Let's actually do this together. Within minutes of deploy completion, verify the CRITICAL JOURNEYS — not everything, the five-to-ten flows the business cannot live without: create a lead and convert it, quote a standard deal, close a case, run the revenue report, confirm the ERP integration heartbeat. Script them (who clicks what, what must appear), pre-assign each to a person, and time-box to 20-30 minutes. Automate what you can (API-level checks and integration heartbeats catch a broad class of failures instantly — this platform's monitoring shows job health live), but keep a human on the UI paths: users experience the UI, not the API. Smoke results are the input to the "declare success or trigger rollback" decision — which is why the rollback card defined the threshold BEFORE the window.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Within minutes of deploy completion, verify the CRITICAL JOURNEYS — not everything, the five-to-ten flows the business cannot live without: create a lead and convert it, quote a standard deal, close a case, run the revenue report, confirm the ERP integration heartbeat.
  2. Script them (who clicks what, what must appear), pre-assign each to a person, and time-box to 20-30 minutes.

**[2:30–3:30] Hypercare: the release is not done at deploy**

- **Narration (word-for-word):** Let's actually do this together. Hypercare is a defined period (48 hours to two weeks, scaled to risk) of heightened attention after go-live: a named rotation watching error rates, integration health, and support tickets; a fast lane for release-related defects that bypasses normal triage; and a daily 15-minute review of what surfaced. Define EXIT CRITERIA up front — error rates at baseline, no open release-tagged sev-1/2, ticket volume normal — and close hypercare explicitly with a short retrospective: what leaked past which pyramid layer, and which gate or test gets strengthened so it cannot leak again. That loop, run every release, is how a mediocre process becomes a great one in two quarters.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Define EXIT CRITERIA up front — error rates at baseline, no open release-tagged sev-1/2, ticket volume normal — and close hypercare explicitly with a short retrospective: what leaked past which pyramid layer, and which gate or test gets strengthened so it cannot leak again.
  2. That loop, run every release, is how a mediocre process becomes a great one in two quarters.

**[3:30–4:15] Real story — The integration that died quietly at go-live**

- **Narration (word-for-word):** Here is why this matters in the real world. A release changed an Opportunity field an ERP integration read. Deploy succeeded, UI smoke tests passed, everyone went to bed. The integration had been failing since 9:07 p.m.; by morning, 14 hours of orders were missing from the ERP and month-end reconciliation was chaos. What did they do? Integration heartbeats became a mandatory smoke-test line item — synthetic transactions pushed through each critical integration within 15 minutes of deploy — and hypercare monitoring watched integration error rates on a dashboard with paging thresholds for the first 48 hours.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The integration that died quietly at go-live

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Runbooks have owners, durations, and verifications per step — executable by a stranger. Smoke-test the critical journeys, UI and integrations, within minutes of deploy. Hypercare = named rotation + fast defect lane + daily review, with exit criteria. Every leak strengthens a lower layer: the improvement loop that compounds.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Go-live runbooks and hypercare — the idea, the practice, and the real-world payoff. Head back to the Running the Release module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.3 — Release health: DORA metrics and continuous improvement

**Lesson ID:** `release-metrics-improvement` · **Reading time:** 17 min · **Video:** 5:00

> Measuring the four DORA metrics for a Salesforce team, running retrospectives that change the process, and paying down release debt.

**Learning objectives**

- Define and measure the four DORA metrics in a Salesforce context
- Run release retrospectives that produce process changes, not blame
- Balance feature delivery against automation and release-debt work

#### Concept explanation

##### Four numbers that describe your delivery

DORA's research distilled delivery performance into four metrics. DEPLOYMENT FREQUENCY: how often you ship to production. LEAD TIME FOR CHANGES: commit-to-production time. CHANGE FAILURE RATE: the share of releases causing an incident or rollback. TIME TO RESTORE: how fast you recover when one does. Elite teams ship on demand with lead times under a day, failure rates under 5%, and restore times under an hour — but the VALUE is your own trend, not the league table.

For a Salesforce team the instrumentation is concrete: deployment records give frequency; work-item-to-release timestamps give lead time; release-tagged incidents give failure rate; incident timelines give restore time. This platform's release and monitoring data holds all four — the discipline is reviewing them monthly, on a chart, in the open.

##### Retrospectives that actually change the process

A release retrospective is 30 minutes, within a week of go-live, with one question: what does the PROCESS learn? Wins worth keeping, leaks worth plugging (each mapped to the gate or pyramid layer that should have caught it), and at most TWO improvement actions with owners and deadlines — ten actions is zero actions wearing a list.

Blamelessness is not softness; it is accuracy. "Why was it possible to deploy with a failing integration test?" changes the pipeline. "Who deployed it?" changes nothing except who hides mistakes next quarter. The actions feed the next cycle, which is why teams that retro every release improve visibly quarter over quarter and teams that skip it re-live the same release forever.

##### Release debt is real debt

Manual steps in the runbook, flaky tests everyone re-runs, environments only one person can rebuild, a hand-maintained deploy spreadsheet — that is RELEASE DEBT, and it compounds: each manual step adds failure probability and makes releases scarier, which pushes teams toward bigger, rarer, riskier releases. The spiral runs in both directions; automation runs it downward.

Budget it like feature work: a standing slice of each cycle (10-20%) for automating one manual step, fixing one flaky test, or scripting one environment rebuild. The compounding is fast — a team that automates one runbook step per release has a one-page runbook within a year, and the "small release more often" flywheel starts turning on its own.

#### Real-world example — From quarterly fear to biweekly boredom

- **Scenario:** A financial-services team released quarterly because releases were terrifying: 30-step manual runbooks, a 40% change-failure rate, all-weekend windows. Each failure made the next release bigger and scarier — the classic doom loop, fully installed.
- **Solution:** They started measuring the four DORA metrics on a wall chart, retroed every release with a two-action limit, and spent 15% of each cycle on release debt: validation automation first, then smoke-test scripting, then flag-based rollbacks, then runbook step elimination — one debt item at a time, every cycle, without exception.
- **Outcome:** Four quarters later: biweekly releases, change-failure rate under 8%, restore time from six hours to 20 minutes via flag rollbacks, and release windows that fit inside a lunch break. The wall chart of four trend lines convinced leadership to fund the platform team permanently — numbers did what advocacy could not.

#### Key takeaways

- Measure frequency, lead time, failure rate, restore time — and watch trends
- Retro every release: blameless, two owned actions, feeding the next cycle
- Map every leaked defect to the layer that should have caught it
- Spend 10-20% of each cycle on release debt; the compounding is the strategy

#### Go deeper

- [DORA research and metrics](https://dora.dev/) — The research base for the four metrics
- [Salesforce Well-Architected](https://architect.salesforce.com/well-architected/overview)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Release health: DORA metrics and continuous improvement matters | intro |
| 2 | 0:30–1:30 | Four numbers that describe your delivery | concept |
| 3 | 1:30–2:30 | Retrospectives that actually change the process | concept |
| 4 | 2:30–3:30 | Release debt is real debt | concept |
| 5 | 3:30–4:15 | Real story — From quarterly fear to biweekly boredom | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Release health: DORA metrics and continuous improvement matters**

- **Narration (word-for-word):** Welcome to Release Management & DevOps, and this five-minute session on Release health: DORA metrics and continuous improvement. Measuring the four DORA metrics for a Salesforce team, running retrospectives that change the process, and paying down release debt.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Release Management & DevOps · Running the Release

**[0:30–1:30] Four numbers that describe your delivery**

- **Narration (word-for-word):** DORA's research distilled delivery performance into four metrics. DEPLOYMENT FREQUENCY: how often you ship to production. LEAD TIME FOR CHANGES: commit-to-production time. CHANGE FAILURE RATE: the share of releases causing an incident or rollback. TIME TO RESTORE: how fast you recover when one does. Elite teams ship on demand with lead times under a day, failure rates under 5%, and restore times under an hour — but the VALUE is your own trend, not the league table. For a Salesforce team the instrumentation is concrete: deployment records give frequency; work-item-to-release timestamps give lead time; release-tagged incidents give failure rate; incident timelines give restore time. This platform's release and monitoring data holds all four — the discipline is reviewing them monthly, on a chart, in the open.
- **On screen:** Animated explainer diagram for "Four numbers that describe your delivery": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Retrospectives that actually change the process**

- **Narration (word-for-word):** A release retrospective is 30 minutes, within a week of go-live, with one question: what does the PROCESS learn? Wins worth keeping, leaks worth plugging (each mapped to the gate or pyramid layer that should have caught it), and at most TWO improvement actions with owners and deadlines — ten actions is zero actions wearing a list. Blamelessness is not softness; it is accuracy. "Why was it possible to deploy with a failing integration test?" changes the pipeline. "Who deployed it?" changes nothing except who hides mistakes next quarter. The actions feed the next cycle, which is why teams that retro every release improve visibly quarter over quarter and teams that skip it re-live the same release forever.
- **On screen:** Animated explainer diagram for "Retrospectives that actually change the process": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Release debt is real debt**

- **Narration (word-for-word):** Manual steps in the runbook, flaky tests everyone re-runs, environments only one person can rebuild, a hand-maintained deploy spreadsheet — that is RELEASE DEBT, and it compounds: each manual step adds failure probability and makes releases scarier, which pushes teams toward bigger, rarer, riskier releases. The spiral runs in both directions; automation runs it downward. Budget it like feature work: a standing slice of each cycle (10-20%) for automating one manual step, fixing one flaky test, or scripting one environment rebuild. The compounding is fast — a team that automates one runbook step per release has a one-page runbook within a year, and the "small release more often" flywheel starts turning on its own.
- **On screen:** Animated explainer diagram for "Release debt is real debt": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — From quarterly fear to biweekly boredom**

- **Narration (word-for-word):** Here is why this matters in the real world. A financial-services team released quarterly because releases were terrifying: 30-step manual runbooks, a 40% change-failure rate, all-weekend windows. Each failure made the next release bigger and scarier — the classic doom loop, fully installed. What did they do? They started measuring the four DORA metrics on a wall chart, retroed every release with a two-action limit, and spent 15% of each cycle on release debt: validation automation first, then smoke-test scripting, then flag-based rollbacks, then runbook step elimination — one debt item at a time, every cycle, without exception.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** From quarterly fear to biweekly boredom

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Measure frequency, lead time, failure rate, restore time — and watch trends. Retro every release: blameless, two owned actions, feeding the next cycle. Map every leaked defect to the layer that should have caught it. Spend 10-20% of each cycle on release debt; the compounding is the strategy.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Release health: DORA metrics and continuous improvement — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
