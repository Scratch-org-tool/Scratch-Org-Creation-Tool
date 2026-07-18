# Salesforce Training Material — Complete Concept Guide + 5-Minute Video Script

This document is a complete training reference for the Salesforce Academy application, including:

1. Current concept coverage in the app.
2. Newly added concepts (blank Salesforce training, JavaScript training, Java training, release management).
3. Real-world examples for every concept area.
4. A ready-to-use **5-minute video script** for recording and upload.
5. Implementation notes on access control, UI/UX gaps, and enhancements.

---

## 1) Complete Concept Coverage in the Application

The Academy now contains **5 paths / 14 modules / 46 lessons**.

## Path A — Salesforce Foundations (Beginner)

### A1. Welcome to Salesforce & the Cloud
- CRM basics, multi-tenancy, Salesforce ecosystem, navigation.
- **Real-world example:** Distributor consolidated spreadsheets into one Account/Case/Opportunity model and reduced visit prep time.

### A2. Salesforce Data Model
- Objects, fields, records, relationships, schema reading.
- **Real-world example:** Training company replaced numbered session fields with proper related objects.

### A3. Data, Reports & Collaboration
- List views, Kanban, reports, dashboards, Chatter, activities, AppExchange.
- **Real-world example:** Sales VP replaced manual Monday reporting with automated dashboard subscriptions.

---

## Path B — Admin & Configuration Mastery (Intermediate)

### B1. Identity & Security Model
- Users/licenses, profiles/permission sets, OWD, sharing architecture.
- **Real-world example:** Private opportunity model with selective service visibility using criteria sharing + FLS.

### B2. Declarative App Building & Flow
- App Builder, record types, validations/formulas, screen flows, record-triggered flows.
- **Real-world example:** Escalation quick action replaced manual seven-field process and improved quality.

### B3. Data Management, Quality & Release Basics
- Data loading/upsert, duplicate management, sandbox strategy, change sets, release hygiene.
- **Real-world example:** Legacy CRM migration stabilized with external IDs, rehearsals, and bypass patterns.

---

## Path C — Cross-Skill Career Accelerator (Intermediate) **(New)**

### C1. Blank Salesforce Training Setup **(New)**
- How to create a reproducible zero-to-ready training environment.
- **Real-world example:** Onboarding batch moved from inconsistent setup to deterministic pipeline provisioning.

### C2. JavaScript Training for LWC **(New)**
- Modern JavaScript essentials, immutable updates, async error-safe UX patterns.
- **Real-world example:** Stale panel bugs removed by immutable state and async error normalization.

### C3. Java-to-Apex Bridge Training **(New)**
- What Java habits transfer, what breaks under governor limits, bulk-safe architecture.
- **Real-world example:** Java team corrected per-record query anti-patterns and passed production-scale validation.

### C4. Release Management Training **(New, explicit module)**
- Readiness checks, execution runbooks, rollback/hotfix operations.
- **Real-world example:** Quarter-close release incidents reduced with pre-validation + dependency manifest discipline.

---

## Path D — Platform Developer Track (Advanced)

### D1. Apex Fundamentals & Triggers
- Apex essentials, SOQL/SOSL, trigger patterns, governor limits.
- **Real-world example:** Query-in-loop defect fixed via map-based indexing and single-query strategy.

### D2. Testing & Async Apex
- Unit testing quality, Queueable/Batch/Scheduled design, debugging workflow.
- **Real-world example:** 900-line pricing refactor shipped safely after behavior-driven test net creation.

### D3. Lightning Web Components
- Component structure, reactivity, data access strategy, communication composition.
- **Real-world example:** Spreadsheet-heavy account review replaced with reusable configurable LWC.

### D4. Integration & APIs
- API selection, callouts, Named Credentials, Platform Events, CDC.
- **Real-world example:** API limit incidents resolved by moving high-volume sync from REST polling to Bulk + deltas.

---

## Path E — Architect & DevOps Mastery (Expert)

### E1. Data & Sharing Architecture at Scale
- LDV selectivity, skew mitigation, enterprise sharing internals, archival strategy.
- **Real-world example:** 40M-task org stabilized via archival, ownership distribution, and LDV optimization.

### E2. Integration & Identity Architecture
- Integration patterns, middleware decisions, SSO/OAuth architecture, Well-Architected decisions.
- **Real-world example:** Multi-interface retailer moved from fragile point-to-point mesh to pattern-driven integration.

### E3. DevOps & Release Engineering
- DX source-driven model, scratch org + package strategy, CI/CD, governance and CoE.
- **Real-world example:** Monthly heroic releases became routine quick-deploy cadence with lower failure rates.

---

## 2) Admin Control & Access Governance (Implemented Enhancement)

To satisfy “feature visible only with admin permission,” Academy access is now split into explicit grants:

- `learning` — Academy base access.
- `learning-tutor` — AI mentor chat.
- `learning-video` — video session scripts.
- `learning-explainer` — animated explainers/story mode.

### Behavior
- If a user lacks a grant, that feature is hidden in UI and blocked at API level.
- Team assignment flow auto-grants the complete Academy feature bundle so assigned learners can execute training immediately.
- Admin/User Access page can now control these features directly as module permissions.

---

## 3) UI/UX and Security Loophole Analysis

## Closed gaps
1. **Feature overexposure risk:** Mentor/video/explainer previously available once `learning` was granted.  
   **Fix:** Added feature-level permission checks in backend + conditional rendering in frontend.

2. **Inconsistent training experience under partial access:** Assignments could grant learning path without advanced learning tools.  
   **Fix:** Assignment workflow now grants the learning feature bundle.

## Suggested next enhancements
1. Add permission tooltips in User Access drawer (what each Academy sub-feature does).
2. Add per-feature analytics (usage vs enabled users) for admin adoption tracking.
3. Add “recommended permission templates” (Viewer / Learner / Mentor-enabled / Full Academy).

---

## 4) 5-Minute Video Script (Ready to Record)

**Title:** Salesforce Academy — Complete Training, Controlled Access, and Practical Delivery  
**Duration:** ~5:00  
**Audience:** Admins, delivery leads, enablement managers

---

### 00:00–00:30 — Hook
“Welcome to Salesforce Academy inside our DevOps Command Center.  
In five minutes, I’ll show you what training content exists, what new concepts were added, and how admin controls now ensure users only see features they’re explicitly permitted to use.”

---

### 00:30–01:20 — What the Academy Covers
“The Academy now includes five structured learning paths from beginner to expert.  
Foundations covers CRM basics, data model, reporting, and collaboration.  
Admin Mastery covers security, Flow automation, data operations, and release hygiene.  
Developer Track covers Apex, testing, async, LWC, and integrations.  
Architect Mastery covers large-scale design, identity, and DevOps governance.  
And we now added a new Cross-Skill Career Accelerator path.”

---

### 01:20–02:20 — New Concepts Added
“The new path adds the exact missing concepts teams asked for:
1) Blank Salesforce training setup — how to provision clean reproducible learning orgs.  
2) JavaScript training for Lightning Web Components — modern syntax, immutable state, async handling.  
3) Java-to-Apex bridge training — what transfers from Java and what must change for governor limits.  
4) Explicit release management training — readiness checks, deployment runbooks, rollback and hotfix discipline.

Each lesson includes objectives, explanation sections, practical takeaways, and a real-world scenario with outcome.”

---

### 02:20–03:20 — Admin Controls and Permission Governance
“A major enhancement is granular Academy access control.  
Instead of one broad learning permission, admins can now control:
- core Academy access,  
- AI Mentor access,  
- Video Session script access,  
- Animated Explainer access.

If a user is not granted a feature, it is hidden in the UI and blocked by the API.  
This ensures strict permission-based visibility and prevents accidental overexposure.”

---

### 03:20–04:15 — Real-World Operational Value
“This design improves delivery operations immediately:
- onboarding is faster because training environments can be bootstrapped consistently,  
- developers get language bridge training that reduces avoidable Apex defects,  
- release management skills are taught as operational practice, not theory,  
- and admin teams retain full control over who can use advanced AI training features.

Assignments still work smoothly: when admins assign training, the required Academy feature bundle is auto-granted so learners can execute without friction.”

---

### 04:15–05:00 — Close and CTA
“In summary, the Academy now has complete concept coverage from fresher to architect, includes the requested JavaScript, Java, blank-org, and release-management training, and enforces admin-governed feature visibility end-to-end.

Next steps: review User Access permissions, assign role-based training paths, and begin recording module videos from the built-in script flow.

Thanks for watching.”

---

## 5) Recording Notes for Your Upload Workflow

- Use this script as narration baseline.
- Capture one screen sequence per section (path overview, sample lesson, permission matrix, assignment flow).
- Keep overlays simple: “Concept → Example → Outcome”.
- Export at 1080p with chapter markers at each timestamp block above.
