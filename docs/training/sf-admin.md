# Admin & Configuration Mastery — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Intermediate · **Category:** Salesforce core curriculum · **Badge:** Certified-Ready Admin · **Modules:** 3 · **Lessons:** 10 · **Estimated effort:** ~10h

Go beyond navigation into how Salesforce is actually governed: who sees what (the security model), how business processes are automated with Flow, and how data is loaded, cleaned, and released safely. This is the path that turns platform literacy into hands-on capability.

**Skills:** Security & sharing model · Flow automation · Validation & formulas · Data loading & quality · Sandbox strategy

## Contents

- **Module 1: Identity & the Security Model**
  - Lesson 1.1: Users, licenses, and login policies
  - Lesson 1.2: Profiles, permission sets, and permission set groups
  - Lesson 1.3: Record access: OWD, role hierarchy, and sharing rules
- **Module 2: Declarative App Building & Flow**
  - Lesson 2.1: Page layouts, record types, and Lightning App Builder
  - Lesson 2.2: Formula fields and validation rules
  - Lesson 2.3: Screen flows: guided experiences without code
  - Lesson 2.4: Record-triggered flows & the order of execution
- **Module 3: Data Management, Quality & Release Basics**
  - Lesson 3.1: Data import: wizard, Data Loader, and upserts
  - Lesson 3.2: Data quality: duplicates, hygiene, and stewardship
  - Lesson 3.3: Sandboxes, change sets, and release hygiene

## Module 1: Identity & the Security Model

The layered access model: org, object, field, and record level — the topic every interview and every incident comes back to.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 1.1 — Users, licenses, and login policies

**Lesson ID:** `admin-users-licenses` · **Reading time:** 15 min · **Video:** 5:00

> How identity works in an org: user records, licenses, login hours, IP ranges, and MFA.

**Learning objectives**

- Create and deactivate users correctly
- Understand the relationship between licenses, profiles, and users
- Apply org-level access policies: login hours, IP ranges, MFA

#### Concept explanation

##### The user record

Every person entering the org has a User record holding their username (globally unique across ALL of Salesforce, not just your org), email, license, profile, and role. Usernames look like emails but need not be real mailboxes — alice@acme.com.prod and alice@acme.com.uat can coexist for the same person across environments.

Users are never deleted, only deactivated. Deactivation frees the license while preserving record ownership history and audit trails. Before deactivating, transfer open work — some orgs block deactivation while the user owns records in approval processes.

##### Licenses gate features; profiles shape them

The license (Salesforce, Salesforce Platform, Experience Cloud…) sets the ceiling of what a user could ever do — a Platform license user can never access Opportunities, no matter their profile. The profile then shapes access within that ceiling.

When someone "can't see the Opportunities tab", check in order: license (is it even possible?), then profile/permission sets (is it granted?), then the app's tab visibility. This checklist resolves most access tickets.

##### Org-level access policies

Login hours and login IP ranges live on the profile: outside allowed hours users are logged out; outside trusted IP ranges they must verify identity or are blocked. Multi-factor authentication is contractually required by Salesforce for all UI logins.

Session settings (timeout duration, session security levels) and password policies complete the org-level layer. These controls run BEFORE any sharing calculation — they decide whether you get in at all, not what you see once inside.

#### Real-world example — The contractor offboarding gap

- **Scenario:** An agency contractor finished a three-month engagement, but their user remained active. Two months later, security flagged logins from an unexpected country — the contractor's credentials had been phished.
- **Solution:** The org introduced an offboarding runbook: deactivate on last day, transfer owned records, review login history monthly, and restrict high-privilege profiles to trusted IP ranges with MFA enforced.
- **Outcome:** The audit that followed found zero orphaned active users, and login IP restrictions now contain any future credential leak to the office network.

#### Key takeaways

- Usernames are globally unique across all Salesforce orgs
- Deactivate, never delete: history and auditability depend on it
- License = ceiling, profile/permission sets = shape within it
- Login hours, IP ranges, and MFA gate entry before sharing even applies

#### Go deeper

- [User Management (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lex_implementation_user_setup_mgmt)
- [Identity Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/identity_basics)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Users, licenses, and login policies matters | intro |
| 2 | 0:30–1:30 | The user record | concept |
| 3 | 1:30–2:30 | Licenses gate features; profiles shape them | concept |
| 4 | 2:30–3:30 | Org-level access policies | concept |
| 5 | 3:30–4:15 | Real story — The contractor offboarding gap | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Users, licenses, and login policies matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Users, licenses, and login policies. How identity works in an org: user records, licenses, login hours, IP ranges, and MFA. By the end of this video you will be able to create and deactivate users correctly; understand the relationship between licenses, profiles, and users; apply org-level access policies: login hours, IP ranges, MFA.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Identity & the Security Model

**[0:30–1:30] The user record**

- **Narration (word-for-word):** Every person entering the org has a User record holding their username (globally unique across ALL of Salesforce, not just your org), email, license, profile, and role. Usernames look like emails but need not be real mailboxes — alice@acme.com.prod and alice@acme.com.uat can coexist for the same person across environments. Users are never deleted, only deactivated. Deactivation frees the license while preserving record ownership history and audit trails. Before deactivating, transfer open work — some orgs block deactivation while the user owns records in approval processes.
- **On screen:** Animated explainer diagram for "The user record": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Licenses gate features; profiles shape them**

- **Narration (word-for-word):** The license (Salesforce, Salesforce Platform, Experience Cloud…) sets the ceiling of what a user could ever do — a Platform license user can never access Opportunities, no matter their profile. The profile then shapes access within that ceiling. When someone "can't see the Opportunities tab", check in order: license (is it even possible?), then profile/permission sets (is it granted?), then the app's tab visibility. This checklist resolves most access tickets.
- **On screen:** Animated explainer diagram for "Licenses gate features; profiles shape them": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Org-level access policies**

- **Narration (word-for-word):** Login hours and login IP ranges live on the profile: outside allowed hours users are logged out; outside trusted IP ranges they must verify identity or are blocked. Multi-factor authentication is contractually required by Salesforce for all UI logins. Session settings (timeout duration, session security levels) and password policies complete the org-level layer. These controls run BEFORE any sharing calculation — they decide whether you get in at all, not what you see once inside.
- **On screen:** Animated explainer diagram for "Org-level access policies": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The contractor offboarding gap**

- **Narration (word-for-word):** Here is why this matters in the real world. An agency contractor finished a three-month engagement, but their user remained active. Two months later, security flagged logins from an unexpected country — the contractor's credentials had been phished. What did they do? The org introduced an offboarding runbook: deactivate on last day, transfer owned records, review login history monthly, and restrict high-privilege profiles to trusted IP ranges with MFA enforced. And the payoff: The audit that followed found zero orphaned active users, and login IP restrictions now contain any future credential leak to the office network.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The contractor offboarding gap

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Usernames are globally unique across all Salesforce orgs. Deactivate, never delete: history and auditability depend on it. License = ceiling, profile/permission sets = shape within it. Login hours, IP ranges, and MFA gate entry before sharing even applies.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Users, licenses, and login policies — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — Profiles, permission sets, and permission set groups

**Lesson ID:** `admin-profiles-permsets` · **Reading time:** 18 min · **Video:** 5:00

> Object and field permissions done right: minimal profiles, additive permission sets, and job-role groups.

**Learning objectives**

- Explain object-level (CRED) and field-level security
- Apply the modern "minimal profile + permission sets" strategy
- Bundle permissions into permission set groups aligned to job roles

#### Concept explanation

##### Object permissions: CRED + View All / Modify All

For each object, a profile or permission set grants Create, Read, Edit, Delete — plus the sharing-bypassing View All and Modify All. These are object-level switches: no Read on Case means Cases effectively do not exist for that user, in every list view, report, and API call.

Field-level security (FLS) then hides or read-onlys individual fields. FLS is enforced everywhere server-side — page layouts merely arrange what FLS already allows. Hiding a field on a layout is cosmetic; removing FLS visibility is security.

##### The modern strategy: thin profiles, additive permission sets

Historically orgs cloned dozens of profiles ("Sales Rep", "Senior Sales Rep", "Sales Rep Berlin"…), each a maintenance nightmare. Salesforce's stated direction is the opposite: keep a minimal profile (login policies, defaults) and grant nearly everything through permission sets, which stack additively.

Permission sets answer "what extra capability does this person need?" — Manage Quotas, Access Invoicing Object. One user, many permission sets. There is no "deny" — Salesforce security is additive-only, so the model is: start from nothing, grant deliberately.

##### Permission set groups

A permission set group bundles multiple permission sets into one assignable unit aligned to a job role: the "Service Agent" group might contain Case Management, Knowledge User, and CTI Access. Assign one group instead of five sets.

Groups also support muting — subtracting specific permissions from the bundle without editing the underlying sets. Muting is the only subtractive mechanism in the model, and it only subtracts within that group.

#### Real-world example — Collapsing 34 profiles

- **Scenario:** A grown-by-accident org had 34 profiles differing in tiny ways. Every new field meant touching all 34, and audits couldn't answer "who can edit Amount?" without a spreadsheet safari.
- **Solution:** The admin team collapsed to 4 base profiles, expressed every capability difference as ~20 permission sets, and built permission set groups per job role ("SDR", "AE", "Service Agent", "Finance").
- **Outcome:** New-field rollout time dropped from a day to minutes, onboarding became "assign one group", and the security audit passed with a permission model that could actually be explained.

#### Key takeaways

- Object CRED + FLS are enforced everywhere, including the API — layouts are not security
- Salesforce access is additive: there is no deny, so grant minimally
- Prefer thin profiles with capabilities in permission sets
- Permission set groups map bundles to job roles; muting is the only subtraction

#### Go deeper

- [Data Security (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/data_security) — The definitive module for this whole area
- [Salesforce Help: Permission Sets](https://help.salesforce.com/s/articleView?id=sf.perm_sets_overview.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Profiles, permission sets, and permission set groups matters | intro |
| 2 | 0:30–1:30 | Object permissions: CRED + View All / Modify All | demo |
| 3 | 1:30–2:30 | The modern strategy: thin profiles, additive permission sets | concept |
| 4 | 2:30–3:30 | Permission set groups | demo |
| 5 | 3:30–4:15 | Real story — Collapsing 34 profiles | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Profiles, permission sets, and permission set groups matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Profiles, permission sets, and permission set groups. Object and field permissions done right: minimal profiles, additive permission sets, and job-role groups. By the end of this video you will be able to explain object-level (CRED) and field-level security; apply the modern "minimal profile + permission sets" strategy; bundle permissions into permission set groups aligned to job roles.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Identity & the Security Model

**[0:30–1:30] Object permissions: CRED + View All / Modify All**

- **Narration (word-for-word):** Let's actually do this together. For each object, a profile or permission set grants Create, Read, Edit, Delete — plus the sharing-bypassing View All and Modify All. These are object-level switches: no Read on Case means Cases effectively do not exist for that user, in every list view, report, and API call. Field-level security (FLS) then hides or read-onlys individual fields. FLS is enforced everywhere server-side — page layouts merely arrange what FLS already allows. Hiding a field on a layout is cosmetic; removing FLS visibility is security.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. For each object, a profile or permission set grants Create, Read, Edit, Delete — plus the sharing-bypassing View All and Modify All.
  2. These are object-level switches: no Read on Case means Cases effectively do not exist for that user, in every list view, report, and API call.

**[1:30–2:30] The modern strategy: thin profiles, additive permission sets**

- **Narration (word-for-word):** Historically orgs cloned dozens of profiles ("Sales Rep", "Senior Sales Rep", "Sales Rep Berlin"…), each a maintenance nightmare. Salesforce's stated direction is the opposite: keep a minimal profile (login policies, defaults) and grant nearly everything through permission sets, which stack additively. Permission sets answer "what extra capability does this person need?" — Manage Quotas, Access Invoicing Object. One user, many permission sets. There is no "deny" — Salesforce security is additive-only, so the model is: start from nothing, grant deliberately.
- **On screen:** Animated explainer diagram for "The modern strategy: thin profiles, additive permission sets": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Permission set groups**

- **Narration (word-for-word):** Let's actually do this together. A permission set group bundles multiple permission sets into one assignable unit aligned to a job role: the "Service Agent" group might contain Case Management, Knowledge User, and CTI Access. Assign one group instead of five sets. Groups also support muting — subtracting specific permissions from the bundle without editing the underlying sets. Muting is the only subtractive mechanism in the model, and it only subtracts within that group.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. A permission set group bundles multiple permission sets into one assignable unit aligned to a job role: the "Service Agent" group might contain Case Management, Knowledge User, and CTI Access.
  2. Assign one group instead of five sets.

**[3:30–4:15] Real story — Collapsing 34 profiles**

- **Narration (word-for-word):** Here is why this matters in the real world. A grown-by-accident org had 34 profiles differing in tiny ways. Every new field meant touching all 34, and audits couldn't answer "who can edit Amount?" without a spreadsheet safari. What did they do? The admin team collapsed to 4 base profiles, expressed every capability difference as ~20 permission sets, and built permission set groups per job role ("SDR", "AE", "Service Agent", "Finance"). And the payoff: New-field rollout time dropped from a day to minutes, onboarding became "assign one group", and the security audit passed with a permission model that could actually be explained.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Collapsing 34 profiles

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Object CRED + FLS are enforced everywhere, including the API — layouts are not security. Salesforce access is additive: there is no deny, so grant minimally. Prefer thin profiles with capabilities in permission sets. Permission set groups map bundles to job roles; muting is the only subtraction.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Profiles, permission sets, and permission set groups — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.3 — Record access: OWD, role hierarchy, and sharing rules

**Lesson ID:** `admin-sharing-model` · **Reading time:** 20 min · **Video:** 5:00

> The record-level layer: org-wide defaults as the floor, then hierarchy, sharing rules, teams, and manual shares opening access up.

**Learning objectives**

- Set org-wide defaults as the baseline of record access
- Use the role hierarchy for vertical visibility
- Open access laterally with sharing rules, teams, and manual sharing

#### Concept explanation

##### Org-wide defaults: the floor

Org-wide defaults (OWD) set what users get on records they do NOT own: Private, Public Read Only, or Public Read/Write per object. Everything else in the sharing model only ever OPENS access from this floor — nothing tightens below it.

Design rule: set OWD to the most restrictive setting any user population requires. If pricing data must be hidden from anyone, Opportunity OWD must be Private, and you grant the rest of the org access back through the mechanisms below.

##### Role hierarchy: vertical access

The role hierarchy grants managers access to records owned by (or shared with) their subordinates. It mirrors data access needs, not necessarily the org chart — a small flat hierarchy is normal and healthy.

For custom objects you can disable this inheritance ("Grant Access Using Hierarchies"); for standard objects it is always on. Roles answer "my manager can see my deals"; they do nothing for peers — that is sharing rules' job.

##### Lateral access: sharing rules, teams, manual shares

Sharing rules open records sideways: ownership-based ("records owned by role EMEA Sales → share with role EMEA Service") or criteria-based ("Cases where Type = Escalation → share with the Escalations group"). They target roles and public groups, never individual users.

Account and Opportunity Teams share specific records with a working team, with per-member access levels. Manual sharing handles one-off exceptions. When troubleshooting access, walk the ladder in order: OWD → role hierarchy → sharing rules → teams → manual shares — and remember object CRED and FLS sit before all of it.

#### Real-world example — Private opportunities without blinding service

- **Scenario:** Sales leadership wanted opportunity amounts hidden from other reps (competitive commissions), but service agents needed to see open deals on accounts they supported to avoid tone-deaf conversations.
- **Solution:** Opportunity OWD went Private. The role hierarchy kept managers seeing their teams' pipeline. A criteria-based sharing rule shared open opportunities with the Service group at Read Only, and FLS hid the commission-sensitive fields from the service profile entirely.
- **Outcome:** Reps stopped seeing each other's amounts, service saw exactly enough context to be helpful, and the design was expressed in three declarative settings — no code, fully auditable.

#### Key takeaways

- OWD is the floor; every other mechanism only opens access upward
- Role hierarchy = vertical visibility; sharing rules = lateral, to groups/roles only
- Layer FLS on top when specific fields are more sensitive than the record
- Troubleshoot access in ladder order: CRED/FLS → OWD → hierarchy → rules → teams → manual

#### Go deeper

- [Data Security (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/data_security)
- [Who Sees What in Lightning Experience (Salesforce Help)](https://help.salesforce.com/s/articleView?id=sf.security_data_access.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Record access: OWD, role hierarchy, and sharing rules matters | intro |
| 2 | 0:30–1:30 | Org-wide defaults: the floor | concept |
| 3 | 1:30–2:30 | Role hierarchy: vertical access | concept |
| 4 | 2:30–3:30 | Lateral access: sharing rules, teams, manual shares | concept |
| 5 | 3:30–4:15 | Real story — Private opportunities without blinding service | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Record access: OWD, role hierarchy, and sharing rules matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Record access: OWD, role hierarchy, and sharing rules. The record-level layer: org-wide defaults as the floor, then hierarchy, sharing rules, teams, and manual shares opening access up.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Identity & the Security Model

**[0:30–1:30] Org-wide defaults: the floor**

- **Narration (word-for-word):** Org-wide defaults (OWD) set what users get on records they do NOT own: Private, Public Read Only, or Public Read/Write per object. Everything else in the sharing model only ever OPENS access from this floor — nothing tightens below it. Design rule: set OWD to the most restrictive setting any user population requires. If pricing data must be hidden from anyone, Opportunity OWD must be Private, and you grant the rest of the org access back through the mechanisms below.
- **On screen:** Animated explainer diagram for "Org-wide defaults: the floor": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Role hierarchy: vertical access**

- **Narration (word-for-word):** The role hierarchy grants managers access to records owned by (or shared with) their subordinates. It mirrors data access needs, not necessarily the org chart — a small flat hierarchy is normal and healthy. For custom objects you can disable this inheritance ("Grant Access Using Hierarchies"); for standard objects it is always on. Roles answer "my manager can see my deals"; they do nothing for peers — that is sharing rules' job.
- **On screen:** Animated explainer diagram for "Role hierarchy: vertical access": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Lateral access: sharing rules, teams, manual shares**

- **Narration (word-for-word):** Sharing rules open records sideways: ownership-based ("records owned by role EMEA Sales → share with role EMEA Service") or criteria-based ("Cases where Type = Escalation → share with the Escalations group"). They target roles and public groups, never individual users. Account and Opportunity Teams share specific records with a working team, with per-member access levels. Manual sharing handles one-off exceptions. When troubleshooting access, walk the ladder in order: OWD → role hierarchy → sharing rules → teams → manual shares — and remember object CRED and FLS sit before all of it.
- **On screen:** Animated explainer diagram for "Lateral access: sharing rules, teams, manual shares": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Private opportunities without blinding service**

- **Narration (word-for-word):** Here is why this matters in the real world. Sales leadership wanted opportunity amounts hidden from other reps (competitive commissions), but service agents needed to see open deals on accounts they supported to avoid tone-deaf conversations. What did they do? Opportunity OWD went Private. The role hierarchy kept managers seeing their teams' pipeline. A criteria-based sharing rule shared open opportunities with the Service group at Read Only, and FLS hid the commission-sensitive fields from the service profile entirely. And the payoff: Reps stopped seeing each other's amounts, service saw exactly enough context to be helpful, and the design was expressed in three declarative settings — no code, fully auditable.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Private opportunities without blinding service

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. OWD is the floor; every other mechanism only opens access upward. Role hierarchy = vertical visibility; sharing rules = lateral, to groups/roles only. Layer FLS on top when specific fields are more sensitive than the record. Troubleshoot access in ladder order: CRED/FLS → OWD → hierarchy → rules → teams → manual.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Record access: OWD, role hierarchy, and sharing rules — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: Declarative App Building & Flow

Validation rules, formulas, Lightning pages, and Flow Builder — automating the business without code.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 2.1 — Page layouts, record types, and Lightning App Builder

**Lesson ID:** `admin-app-builder` · **Reading time:** 15 min · **Video:** 5:00

> Shape the user experience: layouts vs dynamic Lightning pages, and when record types are (and aren't) the answer.

**Learning objectives**

- Assign page layouts and understand what they do and don't control
- Use record types for genuinely different business processes
- Build dynamic Lightning record pages with component visibility

#### Concept explanation

##### Layouts and their limits

Page layouts arrange fields, related lists, and actions per profile and record type, and can make fields required or read-only AT THE UI LEVEL. They do not restrict reports or API access — that is FLS's job. Repeat this until it is reflexive: layouts are UX, FLS is security.

Compact layouts choose the handful of fields in the record highlights panel and mobile cards — small effort, outsized daily impact.

##### Record types: different processes, not different data

Record types let one object serve genuinely different processes: a "New Business" vs "Renewal" opportunity with different picklist values, layouts, and Lightning pages. Users pick the type at creation and the experience adapts.

Overuse is a classic org smell. If two record types differ only by one field's visibility, dynamic forms or component visibility is lighter. Use record types when the PROCESS differs — different stages, different automation, different layouts.

##### Lightning App Builder and dynamic pages

Lightning App Builder composes record pages from components: standard (Record Detail, Related Lists, Chatter), custom LWCs, or AppExchange components. Pages can be assigned by app, record type, AND profile.

Component visibility rules ("show the Escalation panel only when Priority = Critical") and Dynamic Forms (place individual fields, with per-field visibility rules) turn static layouts into context-aware workspaces. The best admin-built pages feel like custom apps.

#### Real-world example — One Case object, two support tiers

- **Scenario:** A software company handles both quick how-to questions and complex escalations on the Case object. One giant layout buried tier-2 engineers in irrelevant fields, while tier-1 agents kept skipping required diagnostic details.
- **Solution:** Two record types (Standard, Escalation) with tailored layouts and picklists, plus a Lightning page where the diagnostics panel appears only when the record type is Escalation and Status ≠ New.
- **Outcome:** Tier-1 case handling time dropped noticeably, escalations arrived with required diagnostics filled, and neither team sees the other's clutter.

#### Key takeaways

- Layouts are UX; FLS is security — never confuse the two
- Record types are for different processes, not cosmetic differences
- Lightning pages assign by app + record type + profile
- Component visibility and Dynamic Forms make pages context-aware

#### Go deeper

- [Lightning App Builder (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lightning_app_builder)
- [Salesforce Help: Dynamic Forms](https://help.salesforce.com/s/articleView?id=sf.dynamic_forms_overview.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Page layouts, record types, and Lightning App Builder matters | intro |
| 2 | 0:30–1:30 | Layouts and their limits | concept |
| 3 | 1:30–2:30 | Record types: different processes, not different data | concept |
| 4 | 2:30–3:30 | Lightning App Builder and dynamic pages | concept |
| 5 | 3:30–4:15 | Real story — One Case object, two support tiers | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Page layouts, record types, and Lightning App Builder matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Page layouts, record types, and Lightning App Builder. Shape the user experience: layouts vs dynamic Lightning pages, and when record types are (and aren't) the answer.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Declarative App Building & Flow

**[0:30–1:30] Layouts and their limits**

- **Narration (word-for-word):** Page layouts arrange fields, related lists, and actions per profile and record type, and can make fields required or read-only AT THE UI LEVEL. They do not restrict reports or API access — that is FLS's job. Repeat this until it is reflexive: layouts are UX, FLS is security. Compact layouts choose the handful of fields in the record highlights panel and mobile cards — small effort, outsized daily impact.
- **On screen:** Animated explainer diagram for "Layouts and their limits": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Record types: different processes, not different data**

- **Narration (word-for-word):** Record types let one object serve genuinely different processes: a "New Business" vs "Renewal" opportunity with different picklist values, layouts, and Lightning pages. Users pick the type at creation and the experience adapts. Overuse is a classic org smell. If two record types differ only by one field's visibility, dynamic forms or component visibility is lighter. Use record types when the PROCESS differs — different stages, different automation, different layouts.
- **On screen:** Animated explainer diagram for "Record types: different processes, not different data": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Lightning App Builder and dynamic pages**

- **Narration (word-for-word):** Lightning App Builder composes record pages from components: standard (Record Detail, Related Lists, Chatter), custom LWCs, or AppExchange components. Pages can be assigned by app, record type, AND profile. Component visibility rules ("show the Escalation panel only when Priority = Critical") and Dynamic Forms (place individual fields, with per-field visibility rules) turn static layouts into context-aware workspaces. The best admin-built pages feel like custom apps.
- **On screen:** Animated explainer diagram for "Lightning App Builder and dynamic pages": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — One Case object, two support tiers**

- **Narration (word-for-word):** Here is why this matters in the real world. A software company handles both quick how-to questions and complex escalations on the Case object. One giant layout buried tier-2 engineers in irrelevant fields, while tier-1 agents kept skipping required diagnostic details. What did they do? Two record types (Standard, Escalation) with tailored layouts and picklists, plus a Lightning page where the diagnostics panel appears only when the record type is Escalation and Status ≠ New. And the payoff: Tier-1 case handling time dropped noticeably, escalations arrived with required diagnostics filled, and neither team sees the other's clutter.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** One Case object, two support tiers

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Layouts are UX; FLS is security — never confuse the two. Record types are for different processes, not cosmetic differences. Lightning pages assign by app + record type + profile. Component visibility and Dynamic Forms make pages context-aware.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Page layouts, record types, and Lightning App Builder — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Formula fields and validation rules

**Lesson ID:** `admin-validation-formulas` · **Reading time:** 18 min · **Video:** 5:00

> Calculated truth and guarded input: the two declarative tools that encode business logic into the data layer itself.

**Learning objectives**

- Build formula fields with functions, cross-object references, and images
- Write validation rules that block bad data with helpful messages
- Know the limits: when formulas/validations should give way to Flow or code

#### Concept explanation

##### Formula fields: calculated on read

A formula field computes its value every time it is viewed — never stored, never editable. Classics: Days_Open__c = TODAY() - DATEVALUE(CreatedDate); a traffic-light IMAGE() based on SLA status; Account tier pulled down via cross-object formula Account.Tier__c on a Contact.

Cross-object formulas can reach up to 10 relationships away. Formulas cannot reference child records (that is roll-ups or Flow) and have compile-size limits — when a formula turns into a novel, the logic probably belongs elsewhere.

##### Validation rules: the gatekeepers

A validation rule is a formula that BLOCKS saving when it evaluates true, showing your error message. "Close date cannot be in the past": CloseDate < TODAY(). Combine conditions with AND/OR, detect edits with ISCHANGED(), stage transitions with ISPICKVAL(PriorValue(...)).

Good validation rules state what to do, not just what failed: "Discounts above 20% require VP approval — set Approval Status first" beats "Invalid discount". Remember they fire on ALL entry points: API loads, flows, and integrations too.

##### Knowing when to stop

Formulas and validations are the sharpest declarative tools per unit of effort, but each has a boundary. Need to UPDATE another record? Flow. Need to aggregate children on a lookup relationship? Flow or a scheduled job. Need conditional bypasses for data migrations? Add a "bypass" custom permission check into the rule — a pattern every mature org adopts.

A practical migration tip: validation rules firing during bulk loads are the #1 cause of failed data migrations. Plan bypass switches before load day, not during it.

#### Real-world example — Stopping retroactive close dates

- **Scenario:** Reps backdated opportunity close dates to sneak deals into the previous quarter after it closed, corrupting revenue reporting and triggering a finance escalation.
- **Solution:** A validation rule: CloseDate < TODAY() && ISCHANGED(StageName) && ISPICKVAL(StageName, "Closed Won") blocks closing a deal with a past date, with a message explaining the finance policy. A "Data Migration" custom permission bypasses it for sanctioned admin loads.
- **Outcome:** Quarter-end reporting became trustworthy, the audit finding was closed, and the bypass permission meant legitimate migrations never fought the rule.

#### Key takeaways

- Formula fields are computed on read; they cannot be edited or reference children
- Validation rules block saves everywhere — UI, API, flows
- Error messages should instruct, not just reject
- Build permission-based bypasses into rules before your first big data load

#### Go deeper

- [Formulas and Validations (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/point_click_business_logic)
- [Formula Operators and Functions (Salesforce Help)](https://help.salesforce.com/s/articleView?id=sf.customize_functions.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Formula fields and validation rules matters | intro |
| 2 | 0:30–1:30 | Formula fields: calculated on read | concept |
| 3 | 1:30–2:30 | Validation rules: the gatekeepers | concept |
| 4 | 2:30–3:30 | Knowing when to stop | concept |
| 5 | 3:30–4:15 | Real story — Stopping retroactive close dates | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Formula fields and validation rules matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Formula fields and validation rules. Calculated truth and guarded input: the two declarative tools that encode business logic into the data layer itself.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Declarative App Building & Flow

**[0:30–1:30] Formula fields: calculated on read**

- **Narration (word-for-word):** A formula field computes its value every time it is viewed — never stored, never editable. Classics: Days_Open__c = TODAY() - DATEVALUE(CreatedDate); a traffic-light IMAGE() based on SLA status; Account tier pulled down via cross-object formula Account.Tier__c on a Contact. Cross-object formulas can reach up to 10 relationships away. Formulas cannot reference child records (that is roll-ups or Flow) and have compile-size limits — when a formula turns into a novel, the logic probably belongs elsewhere.
- **On screen:** Animated explainer diagram for "Formula fields: calculated on read": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Validation rules: the gatekeepers**

- **Narration (word-for-word):** A validation rule is a formula that BLOCKS saving when it evaluates true, showing your error message. "Close date cannot be in the past": CloseDate < TODAY(). Combine conditions with AND/OR, detect edits with ISCHANGED(), stage transitions with ISPICKVAL(PriorValue(...)). Good validation rules state what to do, not just what failed: "Discounts above 20% require VP approval — set Approval Status first" beats "Invalid discount". Remember they fire on ALL entry points: API loads, flows, and integrations too.
- **On screen:** Animated explainer diagram for "Validation rules: the gatekeepers": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Knowing when to stop**

- **Narration (word-for-word):** Formulas and validations are the sharpest declarative tools per unit of effort, but each has a boundary. Need to UPDATE another record? Flow. Need to aggregate children on a lookup relationship? Flow or a scheduled job. Need conditional bypasses for data migrations? Add a "bypass" custom permission check into the rule — a pattern every mature org adopts. A practical migration tip: validation rules firing during bulk loads are the #1 cause of failed data migrations. Plan bypass switches before load day, not during it.
- **On screen:** Animated explainer diagram for "Knowing when to stop": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Stopping retroactive close dates**

- **Narration (word-for-word):** Here is why this matters in the real world. Reps backdated opportunity close dates to sneak deals into the previous quarter after it closed, corrupting revenue reporting and triggering a finance escalation. What did they do? A validation rule: CloseDate < TODAY() && ISCHANGED(StageName) && ISPICKVAL(StageName, "Closed Won") blocks closing a deal with a past date, with a message explaining the finance policy. A "Data Migration" custom permission bypasses it for sanctioned admin loads. And the payoff: Quarter-end reporting became trustworthy, the audit finding was closed, and the bypass permission meant legitimate migrations never fought the rule.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Stopping retroactive close dates

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Formula fields are computed on read; they cannot be edited or reference children. Validation rules block saves everywhere — UI, API, flows. Error messages should instruct, not just reject. Build permission-based bypasses into rules before your first big data load.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Formula fields and validation rules — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.3 — Screen flows: guided experiences without code

**Lesson ID:** `admin-screen-flows` · **Reading time:** 20 min · **Video:** 5:00

> Build wizard-style UIs with Flow Builder: screens, variables, decisions, and DML elements.

**Learning objectives**

- Assemble screens, decisions, assignments, and record elements into a flow
- Pass context with input variables like recordId
- Place flows on pages, actions, and utility bars

#### Concept explanation

##### Anatomy of a screen flow

A screen flow is an interactive program built visually: Screen elements collect input, Decision elements branch, Assignment elements set variables, and Create/Update/Get/Delete Records elements do the database work.

Think of it as a form wizard with a brain. A "Log a Site Visit" flow can look up the account, show different questions for retail vs wholesale customers, create the visit record, and update the account's Last Visited date — one guided experience, zero code.

##### Variables and context

Flows have typed variables (text, number, record, collections). An input variable named recordId, marked "available for input", automatically receives the current record's Id when the flow runs from a record page or quick action — the single most important convention in flow building.

Use Get Records to fetch data, loops sparingly (there are usually collection-level alternatives), and keep DML out of loops — the same bulkification instinct that governs Apex applies to flows.

##### Where flows live

Deploy screen flows as: quick actions on records (the most common), components on Lightning pages, utility bar items (persistent tools), or standalone URLs for internal portals. Each placement can pass different inputs.

Always set a fault path: connect elements' fault connectors to a screen or notification that explains failures. A flow that dies silently ("An unhandled fault has occurred") costs more trust than it saved effort.

#### Real-world example — Case escalation wizard

- **Scenario:** Escalating a case involved editing seven fields, notifying two teams, and creating a follow-up task. Agents skipped steps under pressure; half of escalations arrived malformed.
- **Solution:** A screen flow behind an "Escalate" quick action: it asks three questions, validates that diagnostics were attached, sets all seven fields consistently, creates the task, and posts to the escalation Chatter group — with a fault screen if anything fails.
- **Outcome:** Malformed escalations disappeared, average escalation time fell from six minutes of field-editing to ninety seconds, and the process is now documented BY the flow itself.

#### Key takeaways

- Screen flows = guided wizards: screens, decisions, assignments, record elements
- The recordId input variable convention wires flows to their record context
- Keep DML out of loops; think in collections
- Every production flow needs fault paths with human-readable messages

#### Go deeper

- [Flow Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/flow-basics)
- [Build Flows with Flow Builder (Trailhead trail)](https://trailhead.salesforce.com/content/learn/trails/build-flows-with-flow-builder)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Screen flows: guided experiences without code matters | intro |
| 2 | 0:30–1:30 | Anatomy of a screen flow | concept |
| 3 | 1:30–2:30 | Variables and context | concept |
| 4 | 2:30–3:30 | Where flows live | concept |
| 5 | 3:30–4:15 | Real story — Case escalation wizard | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Screen flows: guided experiences without code matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Screen flows: guided experiences without code. Build wizard-style UIs with Flow Builder: screens, variables, decisions, and DML elements. By the end of this video you will be able to assemble screens, decisions, assignments, and record elements into a flow; pass context with input variables like recordId; place flows on pages, actions, and utility bars.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Declarative App Building & Flow

**[0:30–1:30] Anatomy of a screen flow**

- **Narration (word-for-word):** A screen flow is an interactive program built visually: Screen elements collect input, Decision elements branch, Assignment elements set variables, and Create/Update/Get/Delete Records elements do the database work. Think of it as a form wizard with a brain. A "Log a Site Visit" flow can look up the account, show different questions for retail vs wholesale customers, create the visit record, and update the account's Last Visited date — one guided experience, zero code.
- **On screen:** Animated explainer diagram for "Anatomy of a screen flow": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Variables and context**

- **Narration (word-for-word):** Flows have typed variables (text, number, record, collections). An input variable named recordId, marked "available for input", automatically receives the current record's Id when the flow runs from a record page or quick action — the single most important convention in flow building. Use Get Records to fetch data, loops sparingly (there are usually collection-level alternatives), and keep DML out of loops — the same bulkification instinct that governs Apex applies to flows.
- **On screen:** Animated explainer diagram for "Variables and context": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Where flows live**

- **Narration (word-for-word):** Deploy screen flows as: quick actions on records (the most common), components on Lightning pages, utility bar items (persistent tools), or standalone URLs for internal portals. Each placement can pass different inputs. Always set a fault path: connect elements' fault connectors to a screen or notification that explains failures. A flow that dies silently ("An unhandled fault has occurred") costs more trust than it saved effort.
- **On screen:** Animated explainer diagram for "Where flows live": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Case escalation wizard**

- **Narration (word-for-word):** Here is why this matters in the real world. Escalating a case involved editing seven fields, notifying two teams, and creating a follow-up task. Agents skipped steps under pressure; half of escalations arrived malformed. What did they do? A screen flow behind an "Escalate" quick action: it asks three questions, validates that diagnostics were attached, sets all seven fields consistently, creates the task, and posts to the escalation Chatter group — with a fault screen if anything fails. And the payoff: Malformed escalations disappeared, average escalation time fell from six minutes of field-editing to ninety seconds, and the process is now documented BY the flow itself.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Case escalation wizard

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Screen flows = guided wizards: screens, decisions, assignments, record elements. The recordId input variable convention wires flows to their record context. Keep DML out of loops; think in collections. Every production flow needs fault paths with human-readable messages.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Screen flows: guided experiences without code — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.4 — Record-triggered flows & the order of execution

**Lesson ID:** `admin-record-triggered-flows` · **Reading time:** 20 min · **Video:** 5:00

> Automate on create/update/delete with fast field updates and actions — and understand where flows sit in the save order.

**Learning objectives**

- Choose correctly between before-save and after-save flows
- Use entry conditions and scheduled paths
- Reason about the order of execution and design one-flow-per-object strategies

#### Concept explanation

##### Before-save vs after-save

A record-triggered flow runs when records are created, updated, or deleted. Before-save ("fast field updates") flows modify the triggering record BEFORE it hits the database — extremely fast, no extra DML, but limited to updating that record's own fields.

After-save flows run once the record is committed and can do everything else: create related records, update children, send emails, call subflows, enqueue asynchronous paths. Rule of thumb: same-record field updates → before-save; anything touching other records → after-save.

##### Entry conditions and scheduled paths

Entry conditions filter which records trigger the flow — "only when Stage changes to Closed Won". Tight entry conditions are a performance feature AND documentation: they declare exactly when automation applies.

Scheduled paths defer work: "10 minutes after" for near-real-time side effects, "3 days before Contract_End__c" for reminders. Scheduled paths run asynchronously with their own limits — a clean declarative alternative to scheduled Apex for many cases.

##### Order of execution and flow architecture

When a record saves, Salesforce runs a fixed sequence — roughly: system validation → before-save flows → before triggers → custom validation rules → duplicate rules → save → after triggers → assignment/auto-response/escalation rules → after-save flows → roll-ups → post-commit actions (email). Knowing this order explains countless "why is my field overwritten?" mysteries.

Governance matters as much as mechanics: many orgs adopt one record-triggered flow per object per timing (orchestrated with subflows) or at least strict naming and entry-condition discipline, because ten overlapping flows on Opportunity firing in undefined relative order is unmaintainable.

#### Real-world example — The onboarding kickoff automation

- **Scenario:** When a deal closes, customer success must create an onboarding project, task the CSM, and email the customer — previously a manual checklist executed inconsistently, sometimes days late.
- **Solution:** One after-save flow on Opportunity with entry condition "Stage ISCHANGED to Closed Won": it creates the Onboarding_Project__c record, assigns tasks, and a 24-hour scheduled path sends the welcome email if the project is still unstarted. Same-record field stamping (Closed_Won_Date__c) went into a separate before-save flow.
- **Outcome:** Every closed deal now gets a project within seconds, the welcome email never fires for deals that were immediately reopened, and the before/after split kept saves fast.

#### Key takeaways

- Before-save = same-record field updates, fastest; after-save = everything else
- Entry conditions are performance + self-documentation — always set them
- Scheduled paths handle delays and date-relative automation declaratively
- Learn the order of execution; adopt a per-object flow governance strategy

#### Go deeper

- [Record-Triggered Flows (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/record-triggered-flows)
- [Apex Developer Guide: Triggers and Order of Execution](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_triggers_order_of_execution.htm) — The canonical order-of-execution reference

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Record-triggered flows & the order of execution matters | intro |
| 2 | 0:30–1:30 | Before-save vs after-save | demo |
| 3 | 1:30–2:30 | Entry conditions and scheduled paths | concept |
| 4 | 2:30–3:30 | Order of execution and flow architecture | concept |
| 5 | 3:30–4:15 | Real story — The onboarding kickoff automation | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Record-triggered flows & the order of execution matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Record-triggered flows & the order of execution. Automate on create/update/delete with fast field updates and actions — and understand where flows sit in the save order. By the end of this video you will be able to choose correctly between before-save and after-save flows; use entry conditions and scheduled paths; reason about the order of execution and design one-flow-per-object strategies.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Declarative App Building & Flow

**[0:30–1:30] Before-save vs after-save**

- **Narration (word-for-word):** Let's actually do this together. A record-triggered flow runs when records are created, updated, or deleted. Before-save ("fast field updates") flows modify the triggering record BEFORE it hits the database — extremely fast, no extra DML, but limited to updating that record's own fields. After-save flows run once the record is committed and can do everything else: create related records, update children, send emails, call subflows, enqueue asynchronous paths. Rule of thumb: same-record field updates → before-save; anything touching other records → after-save.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. After-save flows run once the record is committed and can do everything else: create related records, update children, send emails, call subflows, enqueue asynchronous paths.
  2. Rule of thumb: same-record field updates → before-save; anything touching other records → after-save.

**[1:30–2:30] Entry conditions and scheduled paths**

- **Narration (word-for-word):** Entry conditions filter which records trigger the flow — "only when Stage changes to Closed Won". Tight entry conditions are a performance feature AND documentation: they declare exactly when automation applies. Scheduled paths defer work: "10 minutes after" for near-real-time side effects, "3 days before Contract_End__c" for reminders. Scheduled paths run asynchronously with their own limits — a clean declarative alternative to scheduled Apex for many cases.
- **On screen:** Animated explainer diagram for "Entry conditions and scheduled paths": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Order of execution and flow architecture**

- **Narration (word-for-word):** When a record saves, Salesforce runs a fixed sequence — roughly: system validation → before-save flows → before triggers → custom validation rules → duplicate rules → save → after triggers → assignment/auto-response/escalation rules → after-save flows → roll-ups → post-commit actions (email). Knowing this order explains countless "why is my field overwritten?" mysteries. Governance matters as much as mechanics: many orgs adopt one record-triggered flow per object per timing (orchestrated with subflows) or at least strict naming and entry-condition discipline, because ten overlapping flows on Opportunity firing in undefined relative order is unmaintainable.
- **On screen:** Animated explainer diagram for "Order of execution and flow architecture": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The onboarding kickoff automation**

- **Narration (word-for-word):** Here is why this matters in the real world. When a deal closes, customer success must create an onboarding project, task the CSM, and email the customer — previously a manual checklist executed inconsistently, sometimes days late. What did they do? One after-save flow on Opportunity with entry condition "Stage ISCHANGED to Closed Won": it creates the Onboarding_Project__c record, assigns tasks, and a 24-hour scheduled path sends the welcome email if the project is still unstarted. Same-record field stamping (Closed_Won_Date__c) went into a separate before-save flow.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The onboarding kickoff automation

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Before-save = same-record field updates, fastest; after-save = everything else. Entry conditions are performance + self-documentation — always set them. Scheduled paths handle delays and date-relative automation declaratively. Learn the order of execution; adopt a per-object flow governance strategy.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Record-triggered flows & the order of execution — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: Data Management, Quality & Release Basics

Loading data safely, keeping it clean, and moving changes between environments.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 3.1 — Data import: wizard, Data Loader, and upserts

**Lesson ID:** `admin-data-loading` · **Reading time:** 18 min · **Video:** 5:00

> Choose the right loading tool, master external IDs and upsert, and prepare files that load cleanly.

**Learning objectives**

- Choose between Data Import Wizard and Data Loader
- Use external IDs and upsert to load relationships without VLOOKUP pain
- Prepare and validate CSVs before touching production

#### Concept explanation

##### Wizard vs Data Loader

The Data Import Wizard (in Setup) handles up to 50,000 records for common objects with built-in duplicate matching — friendly and safe for business admins. Data Loader (or modern CLI equivalents like SFDMU, which this platform uses for org-to-org seeding) handles millions of records, any object, scheduled and command-line operation.

Insert, update, upsert, delete, and hard delete are the verbs. Exports are queries to CSV — also your backup tool of last resort.

##### External IDs and upsert: the killer combo

An external ID is a custom field (text/number) marked as an external, unique identifier — typically holding the record's key in another system (SAP customer number, legacy CRM id). Upsert with an external ID means "update if a record with this key exists, insert otherwise" — idempotent loading.

Better still: when loading child records, you can reference the PARENT's external ID instead of its Salesforce Id — Data Loader resolves the relationship for you. This eliminates the classic "export parents, VLOOKUP the Ids into the child file" ritual entirely.

##### Pre-load discipline

Before any significant load: match your CSV columns to API names, validate picklist values against the org, check date formats (ISO yyyy-MM-dd is safest), verify record ownership assignments, and decide what happens with validation rules and automation — bulk loads that trigger a thousand flows can spiral.

Always rehearse in a sandbox with a representative sample, review the error file from that rehearsal, and only then run production. Keep success and error files: they are your rollback map.

#### Real-world example — Migrating 200k accounts from a legacy CRM

- **Scenario:** A company replaced its legacy CRM, needing 200,000 accounts and 500,000 contacts migrated with relationships intact. The first attempt — exporting inserted account Ids and VLOOKUPing them into the contact file — collapsed under spreadsheet errors.
- **Solution:** They added Legacy_Id__c external IDs on Account and Contact, loaded accounts with upsert, then loaded contacts referencing Account via the parent's external ID. Validation rules got a migration bypass permission; automation on those objects was temporarily gated by entry conditions.
- **Outcome:** The rerun loaded cleanly in one evening, the process was repeatable for the three delta loads before cutover, and zero orphaned contacts survived reconciliation.

#### Key takeaways

- Wizard for small friendly loads; Data Loader/CLI for scale and automation
- Upsert + external IDs = idempotent, re-runnable migrations
- Reference parent external IDs to skip manual Id mapping for children
- Rehearse in sandbox, plan validation/automation bypasses, keep error files

#### Go deeper

- [Data Management (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lex_implementation_data_management)
- [Data Loader Guide](https://developer.salesforce.com/docs/atlas.en-us.dataLoader.meta/dataLoader/data_loader.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Data import: wizard, Data Loader, and upserts matters | intro |
| 2 | 0:30–1:30 | Wizard vs Data Loader | concept |
| 3 | 1:30–2:30 | External IDs and upsert: the killer combo | concept |
| 4 | 2:30–3:30 | Pre-load discipline | demo |
| 5 | 3:30–4:15 | Real story — Migrating 200k accounts from a legacy CRM | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Data import: wizard, Data Loader, and upserts matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Data import: wizard, Data Loader, and upserts. Choose the right loading tool, master external IDs and upsert, and prepare files that load cleanly. By the end of this video you will be able to choose between Data Import Wizard and Data Loader; use external IDs and upsert to load relationships without VLOOKUP pain; prepare and validate CSVs before touching production.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Data Management, Quality & Release Basics

**[0:30–1:30] Wizard vs Data Loader**

- **Narration (word-for-word):** The Data Import Wizard (in Setup) handles up to 50,000 records for common objects with built-in duplicate matching — friendly and safe for business admins. Data Loader (or modern CLI equivalents like SFDMU, which this platform uses for org-to-org seeding) handles millions of records, any object, scheduled and command-line operation. Insert, update, upsert, delete, and hard delete are the verbs. Exports are queries to CSV — also your backup tool of last resort.
- **On screen:** Animated explainer diagram for "Wizard vs Data Loader": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] External IDs and upsert: the killer combo**

- **Narration (word-for-word):** An external ID is a custom field (text/number) marked as an external, unique identifier — typically holding the record's key in another system (SAP customer number, legacy CRM id). Upsert with an external ID means "update if a record with this key exists, insert otherwise" — idempotent loading. Better still: when loading child records, you can reference the PARENT's external ID instead of its Salesforce Id — Data Loader resolves the relationship for you. This eliminates the classic "export parents, VLOOKUP the Ids into the child file" ritual entirely.
- **On screen:** Animated explainer diagram for "External IDs and upsert: the killer combo": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Pre-load discipline**

- **Narration (word-for-word):** Let's actually do this together. Before any significant load: match your CSV columns to API names, validate picklist values against the org, check date formats (ISO yyyy-MM-dd is safest), verify record ownership assignments, and decide what happens with validation rules and automation — bulk loads that trigger a thousand flows can spiral. Always rehearse in a sandbox with a representative sample, review the error file from that rehearsal, and only then run production. Keep success and error files: they are your rollback map.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Always rehearse in a sandbox with a representative sample, review the error file from that rehearsal, and only then run production.
  2. Keep success and error files: they are your rollback map.

**[3:30–4:15] Real story — Migrating 200k accounts from a legacy CRM**

- **Narration (word-for-word):** Here is why this matters in the real world. A company replaced its legacy CRM, needing 200,000 accounts and 500,000 contacts migrated with relationships intact. The first attempt — exporting inserted account Ids and VLOOKUPing them into the contact file — collapsed under spreadsheet errors. What did they do? They added Legacy_Id__c external IDs on Account and Contact, loaded accounts with upsert, then loaded contacts referencing Account via the parent's external ID. Validation rules got a migration bypass permission; automation on those objects was temporarily gated by entry conditions.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Migrating 200k accounts from a legacy CRM

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Wizard for small friendly loads; Data Loader/CLI for scale and automation. Upsert + external IDs = idempotent, re-runnable migrations. Reference parent external IDs to skip manual Id mapping for children. Rehearse in sandbox, plan validation/automation bypasses, keep error files.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Data import: wizard, Data Loader, and upserts — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — Data quality: duplicates, hygiene, and stewardship

**Lesson ID:** `admin-data-quality` · **Reading time:** 15 min · **Video:** 5:00

> Matching rules, duplicate rules, and the operating habits that keep an org's data trustworthy.

**Learning objectives**

- Configure matching rules and duplicate rules
- Run duplicate jobs and merge records safely
- Establish ongoing data stewardship practices

#### Concept explanation

##### Matching rules and duplicate rules

A matching rule defines what "same" means — exact email, fuzzy name + city on Account. A duplicate rule references matching rules and decides behavior: alert the user (they can proceed) or block the save, on create and/or edit, optionally bypassable for specific profiles or data loads.

Standard rules for Accounts, Contacts, and Leads work out of the box; custom matching rules cover org-specific definitions of identity ("same Tax_Number__c").

##### Finding and merging existing duplicates

Duplicate rules prevent NEW duplicates; existing ones need duplicate jobs (Performance/Unlimited editions) or reports on potential-duplicate record sets. Merging (up to three records at a time for Accounts/Contacts/Leads) lets you pick the master and surviving field values; related records reparent to the winner.

Merge is irreversible in practice — snapshot (export) candidates before mass merges, and merge in small reviewed batches rather than one heroic weekend.

##### Stewardship: quality as a process, not a project

Sustainable quality comes from operating habits: required-field discipline balanced against user friction, picklists over free text, ownership of quality dashboards ("Accounts missing industry", "Contacts without email"), and a named data steward per domain.

Measure it: a simple completeness score formula field per record, trended on a dashboard, turns "our data is bad" from a complaint into a burndown chart.

#### Real-world example — Duplicate leads poisoning marketing metrics

- **Scenario:** Marketing imported event lists without controls for a year. The same buyer existed as five leads; email metrics double-counted; sales called people who had already bought.
- **Solution:** A custom matching rule (email exact OR fuzzy name + company), a duplicate rule alerting on create and blocking on import profiles, weekly duplicate jobs with steward-reviewed merges, and a "clean before import" checklist for events.
- **Outcome:** Duplicate creation dropped to near zero, the historical backlog shrank steadily through reviewed merges, and campaign ROI reporting finally matched finance's revenue numbers.

#### Key takeaways

- Matching rules define "same"; duplicate rules define what happens
- Prevention (rules) and cleanup (jobs + merges) are separate workstreams
- Export before mass merges — merges don't undo
- Assign stewardship and measure completeness or quality stays aspirational

#### Go deeper

- [Duplicate Management (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/sales_admin_duplicate_management)
- [Salesforce Help: Duplicate Management](https://help.salesforce.com/s/articleView?id=sf.managing_duplicates_overview.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Data quality: duplicates, hygiene, and stewardship matters | intro |
| 2 | 0:30–1:30 | Matching rules and duplicate rules | concept |
| 3 | 1:30–2:30 | Finding and merging existing duplicates | concept |
| 4 | 2:30–3:30 | Stewardship: quality as a process, not a project | concept |
| 5 | 3:30–4:15 | Real story — Duplicate leads poisoning marketing metrics | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Data quality: duplicates, hygiene, and stewardship matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Data quality: duplicates, hygiene, and stewardship. Matching rules, duplicate rules, and the operating habits that keep an org's data trustworthy. By the end of this video you will be able to configure matching rules and duplicate rules; run duplicate jobs and merge records safely; establish ongoing data stewardship practices.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Data Management, Quality & Release Basics

**[0:30–1:30] Matching rules and duplicate rules**

- **Narration (word-for-word):** A matching rule defines what "same" means — exact email, fuzzy name + city on Account. A duplicate rule references matching rules and decides behavior: alert the user (they can proceed) or block the save, on create and/or edit, optionally bypassable for specific profiles or data loads. Standard rules for Accounts, Contacts, and Leads work out of the box; custom matching rules cover org-specific definitions of identity ("same Tax_Number__c").
- **On screen:** Animated explainer diagram for "Matching rules and duplicate rules": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Finding and merging existing duplicates**

- **Narration (word-for-word):** Duplicate rules prevent NEW duplicates; existing ones need duplicate jobs (Performance/Unlimited editions) or reports on potential-duplicate record sets. Merging (up to three records at a time for Accounts/Contacts/Leads) lets you pick the master and surviving field values; related records reparent to the winner. Merge is irreversible in practice — snapshot (export) candidates before mass merges, and merge in small reviewed batches rather than one heroic weekend.
- **On screen:** Animated explainer diagram for "Finding and merging existing duplicates": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Stewardship: quality as a process, not a project**

- **Narration (word-for-word):** Sustainable quality comes from operating habits: required-field discipline balanced against user friction, picklists over free text, ownership of quality dashboards ("Accounts missing industry", "Contacts without email"), and a named data steward per domain. Measure it: a simple completeness score formula field per record, trended on a dashboard, turns "our data is bad" from a complaint into a burndown chart.
- **On screen:** Animated explainer diagram for "Stewardship: quality as a process, not a project": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Duplicate leads poisoning marketing metrics**

- **Narration (word-for-word):** Here is why this matters in the real world. Marketing imported event lists without controls for a year. The same buyer existed as five leads; email metrics double-counted; sales called people who had already bought. What did they do? A custom matching rule (email exact OR fuzzy name + company), a duplicate rule alerting on create and blocking on import profiles, weekly duplicate jobs with steward-reviewed merges, and a "clean before import" checklist for events. And the payoff: Duplicate creation dropped to near zero, the historical backlog shrank steadily through reviewed merges, and campaign ROI reporting finally matched finance's revenue numbers.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Duplicate leads poisoning marketing metrics

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Matching rules define "same"; duplicate rules define what happens. Prevention (rules) and cleanup (jobs + merges) are separate workstreams. Export before mass merges — merges don't undo. Assign stewardship and measure completeness or quality stays aspirational.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Data quality: duplicates, hygiene, and stewardship — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.3 — Sandboxes, change sets, and release hygiene

**Lesson ID:** `admin-sandboxes-releases` · **Reading time:** 17 min · **Video:** 5:00

> Environment strategy and the admin's release toolkit — from change sets to an appreciation of source-driven pipelines.

**Learning objectives**

- Match sandbox types to purposes and plan refresh cycles
- Deploy with change sets and know their limitations
- Understand why teams graduate to source-driven CI/CD

#### Concept explanation

##### Sandbox strategy

Developer sandboxes (metadata only, refresh daily) for building; Developer Pro for larger test datasets; Partial Copy (sample data via template, refresh every 5 days) for QA; Full (complete replica, refresh every 29 days) for UAT, training, and performance testing.

Refreshing OVERWRITES the sandbox with production's current state — coordinate refresh windows with in-flight work or someone loses a week of configuration. Mature orgs publish a refresh calendar.

##### Change sets: the built-in deployment tool

Outbound change sets bundle metadata components in a source org; the target org (connected via Deployment Settings) receives them as inbound change sets for validation and deployment. Deployments run Apex tests per the chosen test level and can be validated without deploying — do this the day before a release window.

Limitations to respect: change sets don't delete components, don't include everything (some settings and data-like configuration are excluded), aren't versioned, and clicking together the same set across four environments invites drift.

##### Why teams graduate to source-driven delivery

As orgs grow, metadata moves into version control (Git) and deployments become pipeline runs: retrieve → pull request review → automated validation against a target org → deploy. Salesforce DX, scratch orgs, and unlocked packages formalize this; platforms like this DevOps Command Center orchestrate it.

Even if admins keep using change sets day-to-day, understanding the source-driven model matters: it is where the audit trail, rollback story, and multi-team coordination live in serious organizations. That story continues in the Architect path's DevOps module.

#### Real-world example — The Friday-afternoon change set incident

- **Scenario:** An admin deployed a change set Friday at 4 pm containing a new validation rule — but forgot the custom permission it referenced. Every integration user's saves started failing across the org, and the on-call engineer spent the evening diagnosing.
- **Solution:** The org adopted release hygiene: validate change sets 24 hours ahead, deploy Tuesday–Thursday mornings, include dependency checklists, and route emergency fixes through a documented expedited lane with a second reviewer.
- **Outcome:** Failed-deployment incidents fell to nearly zero, and the checklist culture became the on-ramp to a full Git-based pipeline the following year.

#### Key takeaways

- Sandbox type = data copied + refresh interval; publish a refresh calendar
- Validate change sets before release day; they cannot delete or version anything
- Deployment failures are usually missing dependencies — checklist them
- Source-driven CI/CD is the destination; change-set discipline is the on-ramp

#### Go deeper

- [Application Lifecycle and Development Models (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models)
- [Salesforce Help: Sandboxes](https://help.salesforce.com/s/articleView?id=sf.deploy_sandboxes_parent.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Sandboxes, change sets, and release hygiene matters | intro |
| 2 | 0:30–1:30 | Sandbox strategy | concept |
| 3 | 1:30–2:30 | Change sets: the built-in deployment tool | concept |
| 4 | 2:30–3:30 | Why teams graduate to source-driven delivery | concept |
| 5 | 3:30–4:15 | Real story — The Friday-afternoon change set incident | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Sandboxes, change sets, and release hygiene matters**

- **Narration (word-for-word):** Welcome to Admin & Configuration Mastery, and this five-minute session on Sandboxes, change sets, and release hygiene. Environment strategy and the admin's release toolkit — from change sets to an appreciation of source-driven pipelines. By the end of this video you will be able to match sandbox types to purposes and plan refresh cycles; deploy with change sets and know their limitations; understand why teams graduate to source-driven CI/CD.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Admin & Configuration Mastery · Data Management, Quality & Release Basics

**[0:30–1:30] Sandbox strategy**

- **Narration (word-for-word):** Developer sandboxes (metadata only, refresh daily) for building; Developer Pro for larger test datasets; Partial Copy (sample data via template, refresh every 5 days) for QA; Full (complete replica, refresh every 29 days) for UAT, training, and performance testing. Refreshing OVERWRITES the sandbox with production's current state — coordinate refresh windows with in-flight work or someone loses a week of configuration. Mature orgs publish a refresh calendar.
- **On screen:** Animated explainer diagram for "Sandbox strategy": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Change sets: the built-in deployment tool**

- **Narration (word-for-word):** Outbound change sets bundle metadata components in a source org; the target org (connected via Deployment Settings) receives them as inbound change sets for validation and deployment. Deployments run Apex tests per the chosen test level and can be validated without deploying — do this the day before a release window. Limitations to respect: change sets don't delete components, don't include everything (some settings and data-like configuration are excluded), aren't versioned, and clicking together the same set across four environments invites drift.
- **On screen:** Animated explainer diagram for "Change sets: the built-in deployment tool": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Why teams graduate to source-driven delivery**

- **Narration (word-for-word):** As orgs grow, metadata moves into version control (Git) and deployments become pipeline runs: retrieve → pull request review → automated validation against a target org → deploy. Salesforce DX, scratch orgs, and unlocked packages formalize this; platforms like this DevOps Command Center orchestrate it. Even if admins keep using change sets day-to-day, understanding the source-driven model matters: it is where the audit trail, rollback story, and multi-team coordination live in serious organizations. That story continues in the Architect path's DevOps module.
- **On screen:** Animated explainer diagram for "Why teams graduate to source-driven delivery": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The Friday-afternoon change set incident**

- **Narration (word-for-word):** Here is why this matters in the real world. An admin deployed a change set Friday at 4 pm containing a new validation rule — but forgot the custom permission it referenced. Every integration user's saves started failing across the org, and the on-call engineer spent the evening diagnosing. What did they do? The org adopted release hygiene: validate change sets 24 hours ahead, deploy Tuesday–Thursday mornings, include dependency checklists, and route emergency fixes through a documented expedited lane with a second reviewer. And the payoff: Failed-deployment incidents fell to nearly zero, and the checklist culture became the on-ramp to a full Git-based pipeline the following year.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The Friday-afternoon change set incident

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Sandbox type = data copied + refresh interval; publish a refresh calendar. Validate change sets before release day; they cannot delete or version anything. Deployment failures are usually missing dependencies — checklist them. Source-driven CI/CD is the destination; change-set discipline is the on-ramp.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Sandboxes, change sets, and release hygiene — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
