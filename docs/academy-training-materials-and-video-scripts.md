# Salesforce Academy — Training Materials & Video Scripts

> Production pack for every Academy track and lesson: concept briefs, real-world examples, and **ready-to-record ~5-minute video scripts**. Use with HeyGen, Synthesia, CapCut, or screen capture, then upload via each lesson’s **Video session** block.

---

## Platform overview

**Salesforce Academy** is the learning module inside this platform. It takes learners from fresher to architect-level (and adjacent skills) through guided **tracks** (paths), each with modules, lessons, an AI mentor, module quizzes, and admin-visible progress.

**What learners get**

- Structured paths with objectives, explanations, real-world cases, code where relevant, takeaways, and official resource links
- **Read | Video session** switch on every lesson — read the curriculum or watch admin-uploaded training videos
- AI Mentor (story + chat) grounded in the lesson
- Module quizzes (pass mark 70%) and path badges on completion

**Tracks covered in this document**

| Track ID | Title | Focus |
|----------|-------|-------|
| `sf-foundations` | Salesforce Foundations | CRM, navigation, data model, reports |
| `sf-admin` | Admin & Configuration Mastery | Security, Flow, data ops, sandboxes |
| `sf-developer` | Platform Developer Track | Apex, LWC, async, APIs |
| `sf-architect` | Architect & DevOps Mastery | LDV, integration, identity, DX/CI/CD |
| `sf-hands-on` | Salesforce Hands-on Lab | Playground click-paths end-to-end |
| `js-fundamentals` | JavaScript Training | LWC-ready JS |
| `java-fundamentals` | Java Training | Java → Apex bridge |
| `release-management` | Release Management | Environments, pipelines, governance |

**Lesson count in this pack:** 69

---

## Admin access note

Academy (`learning`) is a **locked module**. Standard users only see tracks and features when an administrator grants access from **Admin → User Access** (same pattern as other locked modules).

- Granting the learning module unlocks the Academy UI for that user
- **Academy Progress** assignments can also grant learning when you assign paths
- Admins always have learning access and can upload lesson videos
- Path/feature visibility follows what you grant and assign — do not assume every user sees every track

---

## How admins upload videos (hybrid video path)

Academy uses a **hybrid video session** model:

1. **Primary learner experience:** admin-uploaded MP4/WebM (also OGG, MOV, MKV, AVI) played inline with authenticated streaming (HTTP Range supported)
2. **Production assist:** each lesson exposes a production script (this document + in-app script export) so you can record externally, then upload

**Upload click-path**

1. Sign in as an administrator with Academy access
2. Open **Academy** → the target path → open the lesson
3. Switch the lesson view to **Video session**
4. In **Upload a video session**, choose the file, optional title, click **Upload**
5. Confirm the video appears in the list; play once to verify audio/seek
6. Learners with access see uploaded videos immediately; use **Delete** only to replace obsolete takes

Files are stored on the API server (`LEARNING_VIDEO_DIR`) with metadata in Postgres. Prefer **~5 minutes**, clear audio, 1080p, H.264 MP4 for widest compatibility.

---

## Using these scripts with HeyGen / Synthesia / CapCut

1. **Pick a lesson section** below (or export narration from the in-app Video session block: Copy script / Download `.md` / Download narration `.txt`)
2. **Avatar tools (HeyGen, Synthesia):** paste the Narration column into the script track; use Segment + Direction for B-roll and scene breaks; keep total runtime ≈ 5:00
3. **CapCut / screen capture:** record the Demo click-path or code walkthrough full-screen; lay cold open + story + recap as voiceover on title cards; export MP4
4. **Hybrid tip:** avatar for cold open / concepts / story / CTA; screen recording for the middle demo — splice in CapCut
5. **Upload** the finished file via the lesson **Video session** block (steps above)
6. Optional: keep the raw project next to the lesson id (e.g. `foundations-what-is-salesforce-v1.mp4`) for re-edits after UI changes

**Recording standards:** one idea per lesson; show the UI/code for ≥90 seconds of the middle; say API names aloud when they matter; end with a clear Academy CTA.

---

## Table of contents

- **[Salesforce Foundations](#sf-foundations)** (`sf-foundations`)
  - Welcome to Salesforce & the Cloud
    - [`foundations-what-is-salesforce`](#foundations-what-is-salesforce) What is Salesforce? CRM in plain language
    - [`foundations-ecosystem`](#foundations-ecosystem) The ecosystem: clouds, editions, and orgs
    - [`foundations-navigation`](#foundations-navigation) Navigating Lightning Experience
  - The Salesforce Data Model
    - [`foundations-objects-records-fields`](#foundations-objects-records-fields) Objects, records, and fields
    - [`foundations-relationships`](#foundations-relationships) Relationships: lookup, master-detail, and junctions
    - [`foundations-schema-builder`](#foundations-schema-builder) Reading a schema: Object Manager & Schema Builder
  - Working with Data, Reports & Collaboration
    - [`foundations-list-views`](#foundations-list-views) List views, Kanban, and inline editing
    - [`foundations-reports`](#foundations-reports) Reports & dashboards fundamentals
    - [`foundations-collaboration`](#foundations-collaboration) Chatter, activities, and the AppExchange
- **[Admin & Configuration Mastery](#sf-admin)** (`sf-admin`)
  - Identity & the Security Model
    - [`admin-users-licenses`](#admin-users-licenses) Users, licenses, and login policies
    - [`admin-profiles-permsets`](#admin-profiles-permsets) Profiles, permission sets, and permission set groups
    - [`admin-sharing-model`](#admin-sharing-model) Record access: OWD, role hierarchy, and sharing rules
  - Declarative App Building & Flow
    - [`admin-app-builder`](#admin-app-builder) Page layouts, record types, and Lightning App Builder
    - [`admin-validation-formulas`](#admin-validation-formulas) Formula fields and validation rules
    - [`admin-screen-flows`](#admin-screen-flows) Screen flows: guided experiences without code
    - [`admin-record-triggered-flows`](#admin-record-triggered-flows) Record-triggered flows & the order of execution
  - Data Management, Quality & Release Basics
    - [`admin-data-loading`](#admin-data-loading) Data import: wizard, Data Loader, and upserts
    - [`admin-data-quality`](#admin-data-quality) Data quality: duplicates, hygiene, and stewardship
    - [`admin-sandboxes-releases`](#admin-sandboxes-releases) Sandboxes, change sets, and release hygiene
- **[Platform Developer Track](#sf-developer)** (`sf-developer`)
  - Apex Fundamentals & Triggers
    - [`dev-apex-language`](#dev-apex-language) Apex language essentials
    - [`dev-soql-sosl`](#dev-soql-sosl) SOQL & SOSL: querying like a pro
    - [`dev-triggers`](#dev-triggers) Triggers done right: one trigger, a handler, bulk always
    - [`dev-governor-limits`](#dev-governor-limits) Governor limits: the physics of the platform
  - Testing & Asynchronous Apex
    - [`dev-apex-testing`](#dev-apex-testing) Apex unit testing that actually tests
    - [`dev-async-apex`](#dev-async-apex) Asynchronous Apex: future, Queueable, Batch, Scheduled
    - [`dev-debugging`](#dev-debugging) Debugging: logs, checkpoints, and a method
  - Lightning Web Components
    - [`dev-lwc-fundamentals`](#dev-lwc-fundamentals) LWC fundamentals: components, templates, reactivity
    - [`dev-lwc-data`](#dev-lwc-data) Data access: wire service, LDS, and Apex
    - [`dev-lwc-composition`](#dev-lwc-composition) Component communication & composition
  - Integration & APIs
    - [`dev-apis`](#dev-apis) The API surface: REST, SOAP, Bulk, and friends
    - [`dev-callouts`](#dev-callouts) Callouts, Named Credentials, and resilient consumers
    - [`dev-events`](#dev-events) Platform Events & Change Data Capture
- **[Architect & DevOps Mastery](#sf-architect)** (`sf-architect`)
  - Data & Sharing Architecture at Scale
    - [`arch-ldv`](#arch-ldv) Large Data Volumes: designing for millions of rows
    - [`arch-sharing`](#arch-sharing) Enterprise sharing architecture
    - [`arch-data-lifecycle`](#arch-data-lifecycle) Data strategy: golden records, archiving, and Big Objects
  - Integration & Identity Architecture
    - [`arch-integration-patterns`](#arch-integration-patterns) Integration patterns and the middleware question
    - [`arch-identity`](#arch-identity) Identity architecture: SSO, OAuth, and provisioning
    - [`arch-well-architected`](#arch-well-architected) Well-Architected: trade-offs, decisions, and communication
  - DevOps & Release Engineering
    - [`arch-sfdx`](#arch-sfdx) Source-driven development with Salesforce DX
    - [`arch-scratch-packaging`](#arch-scratch-packaging) Scratch orgs, org shape, and unlocked packages
    - [`arch-cicd`](#arch-cicd) CI/CD pipelines for Salesforce
    - [`arch-governance`](#arch-governance) Environment strategy, governance, and the CoE
- **[Salesforce Hands-on Lab](#sf-hands-on)** (`sf-hands-on`)
  - Your Practice Org & Custom Schema
    - [`hands-on-playground-setup`](#hands-on-playground-setup) Create a Trailhead Playground or blank practice org
    - [`hands-on-custom-object-fields`](#hands-on-custom-object-fields) Object Manager: custom objects and fields
    - [`hands-on-layouts-app-builder`](#hands-on-layouts-app-builder) Page layouts and Lightning App Builder
  - Records, Flows, and Reports
    - [`hands-on-records-list-views`](#hands-on-records-list-views) Create records and useful list views
    - [`hands-on-screen-flow-basics`](#hands-on-screen-flow-basics) Flow Builder: your first screen flow
    - [`hands-on-reports-from-scratch`](#hands-on-reports-from-scratch) Build a report from scratch
- **[JavaScript Training](#js-fundamentals)** (`js-fundamentals`)
  - Language Core
    - [`js-variables-types`](#js-variables-types) Variables, types, and equality
    - [`js-functions`](#js-functions) Functions: declarations, arrows, and this
    - [`js-arrays-objects`](#js-arrays-objects) Arrays and objects for component data
  - Async JavaScript & the DOM
    - [`js-async-promises`](#js-async-promises) Promises and async/await
    - [`js-dom-basics`](#js-dom-basics) DOM basics (and what LWC handles for you)
  - ES Modules & Modern JS for LWC
    - [`js-es-modules`](#js-es-modules) ES modules: import and export
    - [`js-modern-for-lwc`](#js-modern-for-lwc) Modern syntax you will see in LWC
- **[Java Training](#java-fundamentals)** (`java-fundamentals`)
  - Java Language Essentials
    - [`java-classes-objects`](#java-classes-objects) Classes, objects, and methods
    - [`java-types-generics`](#java-types-generics) Types, nullability habits, and generics intro
    - [`java-collections`](#java-collections) Collections: List, Set, Map
  - OOP Design & Exceptions
    - [`java-oop`](#java-oop) OOP: interfaces, inheritance, and composition
    - [`java-exceptions`](#java-exceptions) Exceptions and error strategy
  - Unit Testing Discipline
    - [`java-unit-testing`](#java-unit-testing) Unit tests with clear arrange-act-assert
    - [`java-testing-quality`](#java-testing-quality) Assertions, coverage, and regression habits
- **[Release Management](#release-management)** (`release-management`)
  - Environments & Change Vehicles
    - [`release-change-sets-vs-dx`](#release-change-sets-vs-dx) Change sets vs Salesforce DX
    - [`release-sandboxes-environments`](#release-sandboxes-environments) Sandboxes and environment strategy
    - [`release-branching-strategies`](#release-branching-strategies) Branching strategies for Salesforce teams
  - CI/CD Pipelines & Validation
    - [`release-cicd-pipelines`](#release-cicd-pipelines) CI/CD pipelines for Salesforce
    - [`release-deployment-validation`](#release-deployment-validation) Deployment validation and test levels
  - Rollback, Governance & Release Cadence
    - [`release-rollback-governance`](#release-rollback-governance) Rollback strategies and change governance
    - [`release-calendars-quality-gates`](#release-calendars-quality-gates) Release calendars and quality gates

---

## `sf-foundations` Salesforce Foundations

### Module: `sf-foundations-platform` — Welcome to Salesforce & the Cloud

### `foundations-what-is-salesforce` What is Salesforce? CRM in plain language

**Concept:** A CRM centralizes every customer interaction on shared records. Salesforce is a multi-tenant, metadata-driven cloud platform: your org is isolated, but infrastructure and three yearly releases are shared. Products (Sales/Service Cloud) sit on one platform engine.

**Real-world example:** Scenario — A beverage distributor tracked leads, orders, and complaints in separate spreadsheets; reps visited accounts with open complaints unknowingly. → Solution — They moved to Salesforce: Accounts for customers, Cases for complaints, Opportunities for deals; mobile account pages showed open cases before visits. → Outcome — Visit prep dropped from 30 minutes to 2 minutes; complaint-related churn fell because reps stopped walking into meetings blind.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A beverage distributor tracked leads, orders, and complaints in separate spreadsheets; reps visited accounts with open c…" — then: "In the next five minutes you'll learn What is Salesforce? CRM in plain language so you can apply it the same day." Lower-third: foundations-what-is-salesforce |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: A CRM centralizes every customer interaction on shared records. Salesforce is a multi-tenant, metadata-driven cloud platform: your org is isolated, but infrastructure and three yearly releases are shared. Products (Sales/Service Cloud) sit on one platform engine. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). App Launcher → Accounts → open a sample account → show Related Cases/Opportunities; Setup gear → briefly show Object Manager as 'where the org is built'. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A beverage distributor tracked leads, orders, and complaints in separate spreadsheets; reps visited accounts with open complaints unknowingly. Solution: They moved to Salesforce: Accounts for customers, Cases for complaints, Opportunities for deals; mobile account pages showed open cases before visits. Outcome: Visit prep dropped from 30 minutes to 2 minutes; complaint-related churn fell because reps stopped walking into meetings blind. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-what-is-salesforce`. |

### `foundations-ecosystem` The ecosystem: clouds, editions, and orgs

**Concept:** Clouds are packaged apps (Sales, Service, Marketing, Experience). Editions gate org features; licenses gate per-user access. Production is live; sandboxes and scratch orgs are build/test environments — never build only in production.

**Real-world example:** Scenario — A team must deliver a customer portal in three months with isolated dev, realistic QA data, and UAT that mirrors production. → Solution — Developers use scratch orgs from source; QA uses Partial Copy; UAT uses Full sandbox before a production release window. → Outcome — No developer blocked another; QA found data-shape bugs; production deploy had no surprises.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A team must deliver a customer portal in three months with isolated dev, realistic QA data, and UAT that mirrors product…" — then: "In the next five minutes you'll learn The ecosystem: clouds, editions, and orgs so you can apply it the same day." Lower-third: foundations-ecosystem |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Clouds are packaged apps (Sales, Service, Marketing, Experience). Editions gate org features; licenses gate per-user access. Production is live; sandboxes and scratch orgs are build/test environments — never build only in production. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Sandboxes (or Company Information) to point at edition; App Launcher to contrast Sales vs Service apps; diagram Dev/Partial/Full/Prod on screen. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A team must deliver a customer portal in three months with isolated dev, realistic QA data, and UAT that mirrors production. Solution: Developers use scratch orgs from source; QA uses Partial Copy; UAT uses Full sandbox before a production release window. Outcome: No developer blocked another; QA found data-shape bugs; production deploy had no surprises. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-ecosystem`. |

### `foundations-navigation` Navigating Lightning Experience

**Concept:** Lightning organizes work into apps and tabs. Record pages show highlights, details, and related lists. Global search finds what you can access. Setup (gear) is the admin console — Object Manager, users, automation.

**Real-world example:** Scenario — A graduate joins as junior admin; tickets say 'I can't see the Discount field' and 'my list view disappeared'. → Solution — They learn the triage trio: Object Manager (field + layout?), profile/permission sets (access?), list view filters/sharing. → Outcome — By week three most 'I can't see X' tickets resolve in minutes — navigation literacy, not code.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A graduate joins as junior admin; tickets say 'I can't see the Discount field' and 'my list view disappeared'." — then: "In the next five minutes you'll learn Navigating Lightning Experience so you can apply it the same day." Lower-third: foundations-navigation |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Lightning organizes work into apps and tabs. Record pages show highlights, details, and related lists. Global search finds what you can access. Setup (gear) is the admin console — Object Manager, users, automation. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). App Launcher waffle → type Opportunity → list view → open record → related lists; Global Search; Gear → Setup → Object Manager. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A graduate joins as junior admin; tickets say 'I can't see the Discount field' and 'my list view disappeared'. Solution: They learn the triage trio: Object Manager (field + layout?), profile/permission sets (access?), list view filters/sharing. Outcome: By week three most 'I can't see X' tickets resolve in minutes — navigation literacy, not code. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-navigation`. |

---

### Module: `sf-foundations-data-model` — The Salesforce Data Model

### `foundations-objects-records-fields` Objects, records, and fields

**Concept:** Object ≈ table, field ≈ column, record ≈ row. Standard objects ship with the platform; custom objects/fields use __c API names. Field types (picklist, formula, roll-up) are design decisions; repeating Session1/Session2 fields usually mean you need a child object.

**Real-world example:** Scenario — A training company stuffed Session1_Date__c, Session2_Date__c on Contact and ran out of fields. → Solution — Admin modeled Course__c, Session__c, Attendance__c as related objects instead of numbered fields. → Outcome — Attendance reporting became a standard report; adding a tenth session needed zero new fields.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A training company stuffed Session1_Date__c, Session2_Date__c on Contact and ran out of fields." — then: "In the next five minutes you'll learn Objects, records, and fields so you can apply it the same day." Lower-third: foundations-objects-records-fields |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Object ≈ table, field ≈ column, record ≈ row. Standard objects ship with the platform; custom objects/fields use __c API names. Field types (picklist, formula, roll-up) are design decisions; repeating Session1/Session2 fields usually mean you need a child object. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Object Manager → Account → Fields & Relationships; contrast a standard field with a custom __c field; show API Name vs Label. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A training company stuffed Session1_Date__c, Session2_Date__c on Contact and ran out of fields. Solution: Admin modeled Course__c, Session__c, Attendance__c as related objects instead of numbered fields. Outcome: Attendance reporting became a standard report; adding a tenth session needed zero new fields. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-objects-records-fields`. |

### `foundations-relationships` Relationships: lookup, master-detail, and junctions

**Concept:** Lookup = loose optional link between independent records. Master-detail = owned children with cascade delete, inherited sharing, and roll-up summaries. Many-to-many needs a junction object with two master-details.

**Real-world example:** Scenario — A wholesaler used lookup for Order Lines; totals needed reports and orphaned lines survived deleted orders. → Solution — Rebuilt Order_Line__c as master-detail under Order__c with roll-up Total_Amount__c (SUM). → Outcome — Order totals appear instantly; orphan-line data quality issues disappeared.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A wholesaler used lookup for Order Lines; totals needed reports and orphaned lines survived deleted orders." — then: "In the next five minutes you'll learn Relationships: lookup, master-detail, and junctions so you can apply it the same day." Lower-third: foundations-relationships |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Lookup = loose optional link between independent records. Master-detail = owned children with cascade delete, inherited sharing, and roll-up summaries. Many-to-many needs a junction object with two master-details. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Object Manager → show Contact→Account lookup; Schema Builder filtered to Account/Contact/Opportunity; sketch junction Enrollment on whiteboard/slides. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A wholesaler used lookup for Order Lines; totals needed reports and orphaned lines survived deleted orders. Solution: Rebuilt Order_Line__c as master-detail under Order__c with roll-up Total_Amount__c (SUM). Outcome: Order totals appear instantly; orphan-line data quality issues disappeared. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-relationships`. |

### `foundations-schema-builder` Reading a schema: Object Manager & Schema Builder

**Concept:** Object Manager is the encyclopedia for fields, layouts, and validation rules. Schema Builder draws the relationship map. Onboard by apps → core objects → Schema Builder → sample records → automation last.

**Real-world example:** Scenario — A consultant inherits a 400-object org with no docs and two weeks for an assessment. → Solution — They map the 12 objects behind the primary flow via apps + Schema Builder; read validation rules as business rules; scope automation only to those 12. → Outcome — Assessment lands on time with a core-process diagram; three abandoned objects flagged for archive.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A consultant inherits a 400-object org with no docs and two weeks for an assessment." — then: "In the next five minutes you'll learn Reading a schema: Object Manager & Schema Builder so you can apply it the same day." Lower-third: foundations-schema-builder |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Object Manager is the encyclopedia for fields, layouts, and validation rules. Schema Builder draws the relationship map. Onboard by apps → core objects → Schema Builder → sample records → automation last. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Object Manager tour; Setup → Schema Builder → filter to Account, Contact, Opportunity, Case → zoom relationships. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A consultant inherits a 400-object org with no docs and two weeks for an assessment. Solution: They map the 12 objects behind the primary flow via apps + Schema Builder; read validation rules as business rules; scope automation only to those 12. Outcome: Assessment lands on time with a core-process diagram; three abandoned objects flagged for archive. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-schema-builder`. |

---

### Module: `sf-foundations-productivity` — Working with Data, Reports & Collaboration

### `foundations-list-views` List views, Kanban, and inline editing

**Concept:** List views are saved queries: filters + columns + sharing. Kanban groups by a picklist and updates on drag. Inline editing is fast bulk update with validation and FLS still enforced.

**Real-world example:** Scenario — Support agents each invented personal queues; two high-priority cases sat untouched a weekend. → Solution — Team lead created shared views Unassigned by Priority, My Open Cases, Breaching SLA Today; pinned the default; used in standup. → Outcome — No case went unseen; new agents productive day one.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Support agents each invented personal queues; two high-priority cases sat untouched a weekend." — then: "In the next five minutes you'll learn List views, Kanban, and inline editing so you can apply it the same day." Lower-third: foundations-list-views |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: List views are saved queries: filters + columns + sharing. Kanban groups by a picklist and updates on drag. Inline editing is fast bulk update with validation and FLS still enforced. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Cases or Opportunities tab → New List View → filters → columns → share; switch Kanban by Stage; double-click inline edit one cell. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Support agents each invented personal queues; two high-priority cases sat untouched a weekend. Solution: Team lead created shared views Unassigned by Priority, My Open Cases, Breaching SLA Today; pinned the default; used in standup. Outcome: No case went unseen; new agents productive day one. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-list-views`. |

### `foundations-reports` Reports & dashboards fundamentals

**Concept:** Tabular/summary/matrix/joined formats sit on report types that define available fields. Cross filters answer with/without related records. Dashboards chart source reports; running user controls whose access the data uses.

**Real-world example:** Scenario — A sales VP spent three hours every Monday building a pipeline PowerPoint from exports. → Solution — Admin built summary reports and a dashboard subscribed Monday 7am as the viewer. → Outcome — Three hours became zero; stages stayed honest because everyone saw the same board.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A sales VP spent three hours every Monday building a pipeline PowerPoint from exports." — then: "In the next five minutes you'll learn Reports & dashboards fundamentals so you can apply it the same day." Lower-third: foundations-reports |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Tabular/summary/matrix/joined formats sit on report types that define available fields. Cross filters answer with/without related records. Dashboards chart source reports; running user controls whose access the data uses. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Reports → New Report → Opportunities → Summary by Stage; add chart; Dashboards → component from that report; point at Running User setting. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A sales VP spent three hours every Monday building a pipeline PowerPoint from exports. Solution: Admin built summary reports and a dashboard subscribed Monday 7am as the viewer. Outcome: Three hours became zero; stages stayed honest because everyone saw the same board. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-reports`. |

### `foundations-collaboration` Chatter, activities, and the AppExchange

**Concept:** Chatter keeps discussion on the record. Tasks/events build activity history for continuity. AppExchange packages extend the org — evaluate security/reviews, install in sandbox first, weigh build vs buy.

**Real-world example:** Scenario — A top rep resigns with 40 open opportunities; historically successors rebuilt context for months. → Solution — Team had logged calls and Chatter on each opportunity; successor read timelines for top 15 deals in week one. → Outcome — Only two deals slipped a quarter; activity-on-the-record became a team norm.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A top rep resigns with 40 open opportunities; historically successors rebuilt context for months." — then: "In the next five minutes you'll learn Chatter, activities, and the AppExchange so you can apply it the same day." Lower-third: foundations-collaboration |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Chatter keeps discussion on the record. Tasks/events build activity history for continuity. AppExchange packages extend the org — evaluate security/reviews, install in sandbox first, weigh build vs buy. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Open Opportunity → Chatter @mention + post; Log a Call on activity timeline; briefly open AppExchange search in browser. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A top rep resigns with 40 open opportunities; historically successors rebuilt context for months. Solution: Team had logged calls and Chatter on each opportunity; successor read timelines for top 15 deals in week one. Outcome: Only two deals slipped a quarter; activity-on-the-record became a team norm. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Foundations → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `foundations-collaboration`. |

---

## `sf-admin` Admin & Configuration Mastery

### Module: `sf-admin-security` — Identity & the Security Model

### `admin-users-licenses` Users, licenses, and login policies

**Concept:** Users hold username (globally unique), license, profile, and role. Deactivate never delete. License is the feature ceiling; profile/perm sets shape within it. Login hours, IP ranges, and MFA gate entry before sharing applies.

**Real-world example:** Scenario — A contractor finished engagement but stayed active; later phished credentials logged in from another country. → Solution — Offboarding runbook: deactivate last day, transfer work, monthly login-history review, IP restrict high-privilege profiles + MFA. → Outcome — Audit found zero orphaned actives; IP restrictions contain future credential leaks.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "A contractor finished engagement but stayed active; later phished credentials logged in from another country." — then: "In the next five minutes you'll learn Users, licenses, and login policies so you can apply it the same day." Lower-third: admin-users-licenses |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Users hold username (globally unique), license, profile, and role. Deactivate never delete. License is the feature ceiling; profile/perm sets shape within it. Login hours, IP ranges, and MFA gate entry before sharing applies. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Users → show a user record (license, profile, role); Profiles → Login IP Ranges / Login Hours; mention MFA in Session Settings. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: A contractor finished engagement but stayed active; later phished credentials logged in from another country. Solution: Offboarding runbook: deactivate last day, transfer work, monthly login-history review, IP restrict high-privilege profiles + MFA. Outcome: Audit found zero orphaned actives; IP restrictions contain future credential leaks. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-users-licenses`. |

### `admin-profiles-permsets` Profiles, permission sets, and permission set groups

**Concept:** Object CRED + View/Modify All and field-level security are real security (layouts are not). Prefer thin profiles + additive permission sets; groups bundle job roles; muting is the only subtraction.

**Real-world example:** Scenario — An org had 34 near-duplicate profiles; every new field meant touching all 34. → Solution — Collapsed to 4 base profiles, ~20 permission sets, job-role permission set groups (SDR, AE, Service Agent, Finance). → Outcome — New-field rollout minutes not days; onboarding = assign one group; audit became explainable.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "An org had 34 near-duplicate profiles; every new field meant touching all 34." — then: "In the next five minutes you'll learn Profiles, permission sets, and permission set groups so you can apply it the same day." Lower-third: admin-profiles-permsets |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Object CRED + View/Modify All and field-level security are real security (layouts are not). Prefer thin profiles + additive permission sets; groups bundle job roles; muting is the only subtraction. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Profiles vs Permission Sets; open object settings CRED; show FLS on a field; Permission Set Groups → muting tip. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: An org had 34 near-duplicate profiles; every new field meant touching all 34. Solution: Collapsed to 4 base profiles, ~20 permission sets, job-role permission set groups (SDR, AE, Service Agent, Finance). Outcome: New-field rollout minutes not days; onboarding = assign one group; audit became explainable. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-profiles-permsets`. |

### `admin-sharing-model` Record access: OWD, role hierarchy, and sharing rules

**Concept:** OWD is the floor of record access; hierarchy opens vertically; sharing rules/teams/manual shares open laterally. Troubleshoot: CRED/FLS → OWD → hierarchy → rules → teams → manual.

**Real-world example:** Scenario — Sales wanted private opportunity amounts; service still needed to see open deals on supported accounts. → Solution — Opportunity OWD Private; hierarchy for managers; criteria sharing to Service Read Only; FLS hid commission fields from service. → Outcome — Reps stopped seeing peer amounts; service had enough context; design was three declarative settings.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Sales wanted private opportunity amounts; service still needed to see open deals on supported accounts." — then: "In the next five minutes you'll learn Record access: OWD, role hierarchy, and sharing rules so you can apply it the same day." Lower-third: admin-sharing-model |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: OWD is the floor of record access; hierarchy opens vertically; sharing rules/teams/manual shares open laterally. Troubleshoot: CRED/FLS → OWD → hierarchy → rules → teams → manual. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Sharing Settings → OWD; Roles tree; New Sharing Rule wizard (criteria-based) walkthrough without saving in prod. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Sales wanted private opportunity amounts; service still needed to see open deals on supported accounts. Solution: Opportunity OWD Private; hierarchy for managers; criteria sharing to Service Read Only; FLS hid commission fields from service. Outcome: Reps stopped seeing peer amounts; service had enough context; design was three declarative settings. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-sharing-model`. |

---

### Module: `sf-admin-automation` — Declarative App Building & Flow

### `admin-app-builder` Page layouts, record types, and Lightning App Builder

**Concept:** Layouts arrange fields/actions (UX only). Record types for different processes (picklists, layouts, automation). Lightning App Builder composes components with visibility and Dynamic Forms; assign by app/record type/profile.

**Real-world example:** Scenario — One Case layout buried tier-2 engineers while tier-1 skipped diagnostics. → Solution — Two record types (Standard, Escalation) with tailored layouts; Lightning page shows diagnostics only for Escalation when Status ≠ New. → Outcome — Tier-1 faster; escalations arrived complete; neither team saw the other's clutter.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "One Case layout buried tier-2 engineers while tier-1 skipped diagnostics." — then: "In the next five minutes you'll learn Page layouts, record types, and Lightning App Builder so you can apply it the same day." Lower-third: admin-app-builder |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Layouts arrange fields/actions (UX only). Record types for different processes (picklists, layouts, automation). Lightning App Builder composes components with visibility and Dynamic Forms; assign by app/record type/profile. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Object Manager → Case → Page Layouts; Record Types; Lightning Record Pages → App Builder → component visibility rule demo. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: One Case layout buried tier-2 engineers while tier-1 skipped diagnostics. Solution: Two record types (Standard, Escalation) with tailored layouts; Lightning page shows diagnostics only for Escalation when Status ≠ New. Outcome: Tier-1 faster; escalations arrived complete; neither team saw the other's clutter. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-app-builder`. |

### `admin-validation-formulas` Formula fields and validation rules

**Concept:** Formula fields compute on read (no edit, no child aggregates). Validation rules block save when formula is true — on UI, API, and flows. Write instructive errors; add permission-based bypasses before big data loads.

**Real-world example:** Scenario — Reps backdated Closed Won close dates to sneak deals into prior quarter. → Solution — Validation: past CloseDate + stage to Closed Won blocked with finance message; Data Migration custom permission bypass. → Outcome — Quarter-end reporting trusted; migrations still possible with bypass.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Reps backdated Closed Won close dates to sneak deals into prior quarter." — then: "In the next five minutes you'll learn Formula fields and validation rules so you can apply it the same day." Lower-third: admin-validation-formulas |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Formula fields compute on read (no edit, no child aggregates). Validation rules block save when formula is true — on UI, API, and flows. Write instructive errors; add permission-based bypasses before big data loads. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Object Manager → Opportunity → Validation Rules → New; write CloseDate < TODAY() example; Formula field Days Open = TODAY()-DATEVALUE(CreatedDate). Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Reps backdated Closed Won close dates to sneak deals into prior quarter. Solution: Validation: past CloseDate + stage to Closed Won blocked with finance message; Data Migration custom permission bypass. Outcome: Quarter-end reporting trusted; migrations still possible with bypass. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-validation-formulas`. |

### `admin-screen-flows` Screen flows: guided experiences without code

**Concept:** Screen flows are visual wizards: screens, decisions, assignments, Create/Update/Get Records. Input variable recordId wires record context. Place on actions/pages/utility bar; always add fault paths.

**Real-world example:** Scenario — Case escalation needed seven fields, two notifications, a task; half arrived malformed. → Solution — Escalate quick action screen flow asks three questions, validates diagnostics, sets fields, creates task, posts Chatter; fault screen on failure. → Outcome — Malformed escalations gone; time from six minutes to ninety seconds.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Case escalation needed seven fields, two notifications, a task; half arrived malformed." — then: "In the next five minutes you'll learn Screen flows: guided experiences without code so you can apply it the same day." Lower-third: admin-screen-flows |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Screen flows are visual wizards: screens, decisions, assignments, Create/Update/Get Records. Input variable recordId wires record context. Place on actions/pages/utility bar; always add fault paths. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Flows → New Screen Flow; add Screen + Create Records; show recordId variable; Save/Activate; add as Quick Action on Case. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Case escalation needed seven fields, two notifications, a task; half arrived malformed. Solution: Escalate quick action screen flow asks three questions, validates diagnostics, sets fields, creates task, posts Chatter; fault screen on failure. Outcome: Malformed escalations gone; time from six minutes to ninety seconds. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-screen-flows`. |

### `admin-record-triggered-flows` Record-triggered flows & the order of execution

**Concept:** Before-save fast field updates same-record only; after-save for related work/emails/async. Entry conditions document and filter; scheduled paths defer work. Learn order of execution; prefer one flow per object per timing.

**Real-world example:** Scenario — Closed Won required onboarding project, CSM task, and welcome email — checklist often days late. → Solution — After-save Opportunity flow on Stage→Closed Won creates project/tasks; 24h scheduled path emails if still unstarted; before-save stamps Closed_Won_Date__c. → Outcome — Projects in seconds; welcome email skips reopened deals; saves stay fast.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Closed Won required onboarding project, CSM task, and welcome email — checklist often days late." — then: "In the next five minutes you'll learn Record-triggered flows & the order of execution so you can apply it the same day." Lower-third: admin-record-triggered-flows |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Before-save fast field updates same-record only; after-save for related work/emails/async. Entry conditions document and filter; scheduled paths defer work. Learn order of execution; prefer one flow per object per timing. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Flows → New Record-Triggered Flow; show Before vs After; Entry Conditions; Scheduled Path panel; flash order-of-execution slide. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Closed Won required onboarding project, CSM task, and welcome email — checklist often days late. Solution: After-save Opportunity flow on Stage→Closed Won creates project/tasks; 24h scheduled path emails if still unstarted; before-save stamps Closed_Won_Date__c. Outcome: Projects in seconds; welcome email skips reopened deals; saves stay fast. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-record-triggered-flows`. |

---

### Module: `sf-admin-data-ops` — Data Management, Quality & Release Basics

### `admin-data-loading` Data import: wizard, Data Loader, and upserts

**Concept:** Import Wizard for friendly ≤50k loads; Data Loader/CLI for scale. External IDs + upsert = idempotent loads; children can reference parent external IDs. Rehearse in sandbox; plan validation/automation bypasses; keep error files.

**Real-world example:** Scenario — 200k accounts + 500k contacts migration collapsed on VLOOKUP of Salesforce Ids. → Solution — Legacy_Id__c external IDs; upsert accounts then contacts via parent external ID; migration bypass permission; gate automation entry conditions. → Outcome — Clean evening load; repeatable delta loads; zero orphaned contacts.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "200k accounts + 500k contacts migration collapsed on VLOOKUP of Salesforce Ids." — then: "In the next five minutes you'll learn Data import: wizard, Data Loader, and upserts so you can apply it the same day." Lower-third: admin-data-loading |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Import Wizard for friendly ≤50k loads; Data Loader/CLI for scale. External IDs + upsert = idempotent loads; children can reference parent external IDs. Rehearse in sandbox; plan validation/automation bypasses; keep error files. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Data Import Wizard landing; show External ID checkbox on a custom field; Data Loader upsert matching field screenshot/demo. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: 200k accounts + 500k contacts migration collapsed on VLOOKUP of Salesforce Ids. Solution: Legacy_Id__c external IDs; upsert accounts then contacts via parent external ID; migration bypass permission; gate automation entry conditions. Outcome: Clean evening load; repeatable delta loads; zero orphaned contacts. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-data-loading`. |

### `admin-data-quality` Data quality: duplicates, hygiene, and stewardship

**Concept:** Matching rules define 'same'; duplicate rules alert or block. Jobs + merge clean existing dupes (export first). Stewardship: picklists, required fields balance, completeness dashboards, named stewards.

**Real-world example:** Scenario — Event list imports created five leads per buyer; metrics double-counted; sales called existing customers. → Solution — Custom matching (email or fuzzy name+company); alert on create / block on import profiles; weekly jobs + steward merges; clean-before-import checklist. → Outcome — New dupes near zero; backlog shrinks; campaign ROI matches finance.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Event list imports created five leads per buyer; metrics double-counted; sales called existing customers." — then: "In the next five minutes you'll learn Data quality: duplicates, hygiene, and stewardship so you can apply it the same day." Lower-third: admin-data-quality |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Matching rules define 'same'; duplicate rules alert or block. Jobs + merge clean existing dupes (export first). Stewardship: picklists, required fields balance, completeness dashboards, named stewards. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Duplicate Management → Matching Rules / Duplicate Rules; show Alert vs Block; merge two sample Contacts in UI. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Event list imports created five leads per buyer; metrics double-counted; sales called existing customers. Solution: Custom matching (email or fuzzy name+company); alert on create / block on import profiles; weekly jobs + steward merges; clean-before-import checklist. Outcome: New dupes near zero; backlog shrinks; campaign ROI matches finance. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-data-quality`. |

### `admin-sandboxes-releases` Sandboxes, change sets, and release hygiene

**Concept:** Sandbox types trade data copy vs refresh interval. Change sets deploy metadata but can't delete/version well. Validate 24h ahead; prefer Tue–Thu mornings; graduate to Git/CI/CD for audit and multi-team work.

**Real-world example:** Scenario — Friday 4pm change set missed a custom permission; integrations failed org-wide. → Solution — Hygiene: validate day before, deploy midweek mornings, dependency checklist, expedited lane with second reviewer. → Outcome — Failed-deploy incidents near zero; checklist culture on-ramp to Git pipeline.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Friday 4pm change set missed a custom permission; integrations failed org-wide." — then: "In the next five minutes you'll learn Sandboxes, change sets, and release hygiene so you can apply it the same day." Lower-third: admin-sandboxes-releases |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Sandbox types trade data copy vs refresh interval. Change sets deploy metadata but can't delete/version well. Validate 24h ahead; prefer Tue–Thu mornings; graduate to Git/CI/CD for audit and multi-team work. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Sandboxes list (types); Outbound Change Set → add component → Upload; mention Validate in inbound deploy. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Friday 4pm change set missed a custom permission; integrations failed org-wide. Solution: Hygiene: validate day before, deploy midweek mornings, dependency checklist, expedited lane with second reviewer. Outcome: Failed-deploy incidents near zero; checklist culture on-ramp to Git pipeline. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Admin & Configuration Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `admin-sandboxes-releases`. |

---

## `sf-developer` Platform Developer Track

### Module: `sf-dev-apex` — Apex Fundamentals & Triggers

### `dev-apex-language` Apex language essentials

**Concept:** Apex is Java-like with sObjects and transactions. Limits are per execution context. Core bulk pattern: collect Ids → one query into Map<Id,sObject> → loop with lookups. Queried rows only hold selected fields; with sharing enforces record access.

**Real-world example:** Scenario — Scoring logic queried contacts inside a loop; 200-row load hit Too many SOQL queries: 101. → Solution — Collect account Ids; one query for contacts into Map<Id,List<Contact>>; in-memory lookups. → Outcome — Load used 2 queries not 200+; developer internalized collection-first thinking.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Scoring logic queried contacts inside a loop; 200-row load hit Too many SOQL queries: 101." — then: "In the next five minutes you'll learn Apex language essentials so you can apply it the same day." Lower-third: dev-apex-language |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Apex is Java-like with sObjects and transactions. Limits are per execution context. Core bulk pattern: collect Ids → one query into Map<Id,sObject> → loop with lookups. Queried rows only hold selected fields; with sharing enforces record access. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Walk AccountService.tagStrategicAccounts and Map<Id,Account> from a single SOQL; show the anti-pattern query-in-loop then the fix. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Scoring logic queried contacts inside a loop; 200-row load hit Too many SOQL queries: 101. Solution: Collect account Ids; one query for contacts into Map<Id,List<Contact>>; in-memory lookups. Outcome: Load used 2 queries not 200+; developer internalized collection-first thinking. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-apex-language`. |

### `dev-soql-sosl` SOQL & SOSL: querying like a pro

**Concept:** Child-to-parent uses dots; parent-to-child uses subqueries. Aggregates + GROUP BY; always bind variables. Selective indexed filters on large objects; SOSL for multi-object text search.

**Real-world example:** Scenario — Nightly job filtered 8M tasks with unindexed checkbox Is_Processed__c = false and started timing out. → Solution — Replaced with indexed Status_External__c; verified Query Plan; batch fallback for backfill. → Outcome — Query time milliseconds; selectivity check added to definition of done for >1M-row objects.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Nightly job filtered 8M tasks with unindexed checkbox Is_Processed__c = false and started timing out." — then: "In the next five minutes you'll learn SOQL & SOSL: querying like a pro so you can apply it the same day." Lower-third: dev-soql-sosl |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Child-to-parent uses dots; parent-to-child uses subqueries. Aggregates + GROUP BY; always bind variables. Selective indexed filters on large objects; SOSL for multi-object text search. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Show parent-to-child SOQL with binds; Query Plan tool in Developer Console; SOSL FIND example vs SOQL. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Nightly job filtered 8M tasks with unindexed checkbox Is_Processed__c = false and started timing out. Solution: Replaced with indexed Status_External__c; verified Query Plan; batch fallback for backfill. Outcome: Query time milliseconds; selectivity check added to definition of done for >1M-row objects. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-soql-sosl`. |

### `dev-triggers` Triggers done right: one trigger, a handler, bulk always

**Concept:** Before triggers mutate Trigger.new; after do related work. One trigger per object → handler routed by event. Recursion guards and bypasses; agree trigger vs flow ownership per field.

**Real-world example:** Scenario — Three Account triggers from different eras overwrote a field intermittently ('the ghost'). → Solution — Consolidated to one AccountTrigger + handler with ordered methods, recursion guard, regression tests. → Outcome — Ghost died; new requirements became 30-line tested handler changes.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Three Account triggers from different eras overwrote a field intermittently ('the ghost')." — then: "In the next five minutes you'll learn Triggers done right: one trigger, a handler, bulk always so you can apply it the same day." Lower-third: dev-triggers |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Before triggers mutate Trigger.new; after do related work. One trigger per object → handler routed by event. Recursion guards and bypasses; agree trigger vs flow ownership per field. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Show thin trigger + OpportunityTriggerHandler.stampStageChange comparing new vs oldMap; mention static recursion flag. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Three Account triggers from different eras overwrote a field intermittently ('the ghost'). Solution: Consolidated to one AccountTrigger + handler with ordered methods, recursion guard, regression tests. Outcome: Ghost died; new requirements became 30-line tested handler changes. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-triggers`. |

### `dev-governor-limits` Governor limits: the physics of the platform

**Concept:** Limits protect multi-tenancy; LimitException is uncatchable. Know sync headlines: 100 SOQL, 150 DML, 10k rows, 10s CPU. Bulkify; profile with Limits.*; move volume to async/batch when architecture demands.

**Real-world example:** Scenario — Pricing trigger fine daily; quarter-close 50k line update hit 10s CPU in nested loops. → Solution — Profiled with Limits.getCpuTime(); Map index O(n); Queueable above size threshold. → Outcome — CPU ~9800ms → <900ms; 10× load test added to CI.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Pricing trigger fine daily; quarter-close 50k line update hit 10s CPU in nested loops." — then: "In the next five minutes you'll learn Governor limits: the physics of the platform so you can apply it the same day." Lower-third: dev-governor-limits |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Limits protect multi-tenancy; LimitException is uncatchable. Know sync headlines: 100 SOQL, 150 DML, 10k rows, 10s CPU. Bulkify; profile with Limits.*; move volume to async/batch when architecture demands. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Show debug log LIMIT_USAGE summary; refactor sketch from nested loop to Map; list sync vs async limit table. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Pricing trigger fine daily; quarter-close 50k line update hit 10s CPU in nested loops. Solution: Profiled with Limits.getCpuTime(); Map index O(n); Queueable above size threshold. Outcome: CPU ~9800ms → <900ms; 10× load test added to CI. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-governor-limits`. |

---

### Module: `sf-dev-testing-async` — Testing & Asynchronous Apex

### `dev-apex-testing` Apex unit testing that actually tests

**Concept:** Tests see no org data; factories/@TestSetup build worlds. startTest resets limits; stopTest flushes async. runAs proves security. Assert behavior at bulk (200); 75% coverage is a floor not a goal.

**Real-world example:** Scenario — Refactor needed on 900-line pricing class; 82% coverage but assertion-free tests. → Solution — Wrote 30 behavior tests (incl. bulk) capturing current outcomes; found 2 latent bugs with finance; rewrote against the net. → Outcome — Zero pricing regressions; definition of done requires assertion-based tests.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Refactor needed on 900-line pricing class; 82% coverage but assertion-free tests." — then: "In the next five minutes you'll learn Apex unit testing that actually tests so you can apply it the same day." Lower-third: dev-apex-testing |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Tests see no org data; factories/@TestSetup build worlds. startTest resets limits; stopTest flushes async. runAs proves security. Assert behavior at bulk (200); 75% coverage is a floor not a goal. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Walk OpportunityHandlerTest with @TestSetup, startTest/stopTest, Assert.areEqual message; show TestDataFactory stub. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Refactor needed on 900-line pricing class; 82% coverage but assertion-free tests. Solution: Wrote 30 behavior tests (incl. bulk) capturing current outcomes; found 2 latent bugs with finance; rewrote against the net. Outcome: Zero pricing regressions; definition of done requires assertion-based tests. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-apex-testing`. |

### `dev-async-apex` Asynchronous Apex: future, Queueable, Batch, Scheduled

**Concept:** Queueable > @future (objects, job Id, chaining, callouts). Batch for millions with start/execute/finish and fresh limits per chunk. Schedulable usually launches Batch/Queueable; monitor AsyncApexJob — silent failure is the default.

**Real-world example:** Scenario — Territory recalc across 3M accounts; naive @future fan-out uncoordinated. → Solution — Scheduled Batch at 2am scope 2000; idempotent execute; finish emails + Queueable warehouse sync. → Outcome — Ninety-minute run with retries; dashboard for job health; failures page on-call.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Territory recalc across 3M accounts; naive @future fan-out uncoordinated." — then: "In the next five minutes you'll learn Asynchronous Apex: future, Queueable, Batch, Scheduled so you can apply it the same day." Lower-third: dev-async-apex |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Queueable > @future (objects, job Id, chaining, callouts). Batch for millions with start/execute/finish and fresh limits per chunk. Schedulable usually launches Batch/Queueable; monitor AsyncApexJob — silent failure is the default. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Walk SyncInvoiceJob Queueable chain; Batchable interface sketch; System.schedule cron; Apex Jobs page. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Territory recalc across 3M accounts; naive @future fan-out uncoordinated. Solution: Scheduled Batch at 2am scope 2000; idempotent execute; finish emails + Queueable warehouse sync. Outcome: Ninety-minute run with retries; dashboard for job health; failures page on-call. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-async-apex`. |

### `dev-debugging` Debugging: logs, checkpoints, and a method

**Concept:** Trace flags on the affected user; read EXCEPTION_THROWN and CODE_UNIT timeline as observed order of execution; LIMIT_USAGE for perf. Reproduce → log → fix → unit test. Replay Debugger beats debug-spam.

**Real-world example:** Scenario — Discounts randomly reset after save; trigger looked innocent for a day. → Solution — Trace on affected user showed after-save flow overwriting after trigger; missing record-type entry condition. → Outcome — One entry-condition fix; team pulls a log before theorizing.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Discounts randomly reset after save; trigger looked innocent for a day." — then: "In the next five minutes you'll learn Debugging: logs, checkpoints, and a method so you can apply it the same day." Lower-third: dev-debugging |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Trace flags on the affected user; read EXCEPTION_THROWN and CODE_UNIT timeline as observed order of execution; LIMIT_USAGE for perf. Reproduce → log → fix → unit test. Replay Debugger beats debug-spam. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Debug Logs → New Trace Flag; reproduce save; open log → search CODE_UNIT / EXCEPTION; show LIMIT_USAGE footer. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Discounts randomly reset after save; trigger looked innocent for a day. Solution: Trace on affected user showed after-save flow overwriting after trigger; missing record-type entry condition. Outcome: One entry-condition fix; team pulls a log before theorizing. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-debugging`. |

---

### Module: `sf-dev-lwc` — Lightning Web Components

### `dev-lwc-fundamentals` LWC fundamentals: components, templates, reactivity

**Concept:** LWC = html + js (LightningElement) + meta.xml. Fields reactive; @track for deep mutation; @api public. Templates bind, loop with key, lwc:if. CustomEvent up; lifecycle hooks; shadow DOM isolation.

**Real-world example:** Scenario — Account managers exported opps to Excel weekly just for weighted pipeline with color coding. → Solution — Small LWC on record page with recordId, getter, datatable, App Builder multiplier property. → Outcome — Spreadsheet ritual gone; admins reused component on home with different multiplier.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Account managers exported opps to Excel weekly just for weighted pipeline with color coding." — then: "In the next five minutes you'll learn LWC fundamentals: components, templates, reactivity so you can apply it the same day." Lower-third: dev-lwc-fundamentals |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: LWC = html + js (LightningElement) + meta.xml. Fields reactive; @track for deep mutation; @api public. Templates bind, loop with key, lwc:if. CustomEvent up; lifecycle hooks; shadow DOM isolation. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Walk GreetingCard / pipeline LWC: @api, getter, handleLike, meta.xml targets/properties. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Account managers exported opps to Excel weekly just for weighted pipeline with color coding. Solution: Small LWC on record page with recordId, getter, datatable, App Builder multiplier property. Outcome: Spreadsheet ritual gone; admins reused component on home with different multiplier. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-lwc-fundamentals`. |

### `dev-lwc-data` Data access: wire service, LDS, and Apex

**Concept:** Decision tree: LDS/record forms first → wired cacheable Apex → imperative Apex for DML. Reactive $params; try/catch + toast + refreshApex after writes.

**Real-world example:** Scenario — Account panel used custom Apex for plain fields; broke FLS; every field change needed deploy. → Solution — Refactor to lightning-record-view-form; one cacheable wire for aggregation; one imperative action. → Outcome — FLS fixed; admins control fields in Setup; Apex surface shrunk two-thirds.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Account panel used custom Apex for plain fields; broke FLS; every field change needed deploy." — then: "In the next five minutes you'll learn Data access: wire service, LDS, and Apex so you can apply it the same day." Lower-third: dev-lwc-data |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Decision tree: LDS/record forms first → wired cacheable Apex → imperative Apex for DML. Reactive $params; try/catch + toast + refreshApex after writes. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Show @wire(getRecord); @wire(searchAccounts,{term:'$term'}); imperative save + refreshApex. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Account panel used custom Apex for plain fields; broke FLS; every field change needed deploy. Solution: Refactor to lightning-record-view-form; one cacheable wire for aggregation; one imperative action. Outcome: FLS fixed; admins control fields in Setup; Apex surface shrunk two-thirds. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-lwc-data`. |

### `dev-lwc-composition` Component communication & composition

**Concept:** Properties down, CustomEvents up. LMS for cross-DOM/page-region messaging via channels. Container owns data; presentational children; slots; Jest on contracts.

**Real-world example:** Scenario — Service console: case list, knowledge, timeline unaware of each other; agents re-searched manually. → Solution — CaseSelected LMS channel; list publishes; panels subscribe; none know each other. → Outcome — Coherent workspace; AHT dropped; fourth panel plugged in by subscribing.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Service console: case list, knowledge, timeline unaware of each other; agents re-searched manually." — then: "In the next five minutes you'll learn Component communication & composition so you can apply it the same day." Lower-third: dev-lwc-composition |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Properties down, CustomEvents up. LMS for cross-DOM/page-region messaging via channels. Container owns data; presentational children; slots; Jest on contracts. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Parent passes item={item}; child dispatchEvent select; LMS publish/subscribe sketch on message channel XML. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Service console: case list, knowledge, timeline unaware of each other; agents re-searched manually. Solution: CaseSelected LMS channel; list publishes; panels subscribe; none know each other. Outcome: Coherent workspace; AHT dropped; fourth panel plugged in by subscribing. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-lwc-composition`. |

---

### Module: `sf-dev-integration` — Integration & APIs

### `dev-apis` The API surface: REST, SOAP, Bulk, and friends

**Concept:** REST for transactional CRUD; Bulk 2.0 for volume; Composite for multi-step; SOAP still in middleware. OAuth JWT bearer + dedicated integration users. Prefer events/deltas over chatty polling; watch 24h API allocation.

**Real-world example:** Scenario — Nightly sync paged REST for 2M rows (~40k requests); marketing hit REQUEST_LIMIT_EXCEEDED at 6am. → Solution — Moved to Bulk 2.0 + SystemModstamp deltas. → Outcome — API use down ~99%; org rule: >10k rows must justify not using Bulk.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Nightly sync paged REST for 2M rows (~40k requests); marketing hit REQUEST_LIMIT_EXCEEDED at 6am." — then: "In the next five minutes you'll learn The API surface: REST, SOAP, Bulk, and friends so you can apply it the same day." Lower-third: dev-apis |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: REST for transactional CRUD; Bulk 2.0 for volume; Composite for multi-step; SOAP still in middleware. OAuth JWT bearer + dedicated integration users. Prefer events/deltas over chatty polling; watch 24h API allocation. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Architecture walkthrough | ON SCREEN: diagrams/whiteboard. Compare REST vs Bulk 2.0 vs Composite on a slide; show Connected App + JWT flow boxes; limits endpoint mention. Keep one running example; avoid tool bingo. |
| 3:15–4:15 | Real-world story | Scenario: Nightly sync paged REST for 2M rows (~40k requests); marketing hit REQUEST_LIMIT_EXCEEDED at 6am. Solution: Moved to Bulk 2.0 + SystemModstamp deltas. Outcome: API use down ~99%; org rule: >10k rows must justify not using Bulk. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-apis`. |

### `dev-callouts` Callouts, Named Credentials, and resilient consumers

**Concept:** HttpRequest via callout:NamedCredential — no secrets in code. No callouts after DML (use async). Timeouts, retries/backoff, logged failures; HttpCalloutMock every path including errors.

**Real-world example:** Scenario — Emergency credential rotation; API key in custom setting and hardcoded endpoints across four classes — same-day prod deploy under pressure. → Solution — All callouts behind Named Credentials per environment; Mock suite proves behavior. → Outcome — Next rotation was Setup-only in minutes; security policy finally implementable.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Emergency credential rotation; API key in custom setting and hardcoded endpoints across four classes — same-day prod dep…" — then: "In the next five minutes you'll learn Callouts, Named Credentials, and resilient consumers so you can apply it the same day." Lower-third: dev-callouts |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: HttpRequest via callout:NamedCredential — no secrets in code. No callouts after DML (use async). Timeouts, retries/backoff, logged failures; HttpCalloutMock every path including errors. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. ErpClient.pushInvoice with callout:ERP_API; Named Credential Setup screen; HttpCalloutMock test stub. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Emergency credential rotation; API key in custom setting and hardcoded endpoints across four classes — same-day prod deploy under pressure. Solution: All callouts behind Named Credentials per environment; Mock suite proves behavior. Outcome: Next rotation was Setup-only in minutes; security policy finally implementable. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-callouts`. |

### `dev-events` Platform Events & Change Data Capture

**Concept:** Platform Events = business facts on a bus (Order_Placed__e). CDC = record change stream for sync. Subscribers independent; idempotent consumers; replay IDs; not for synchronous request-reply.

**Real-world example:** Scenario — Order capture called warehouse sync during save — outages failed Salesforce saves; slow API slowed every rep. → Solution — Publish Order_Placed__e after commit; warehouse Pub/Sub with replay; Flow tasks large orders. → Outcome — Saves instant and immune to warehouse; outage events replayed; analytics added subscriber later with zero order-code changes.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Order capture called warehouse sync during save — outages failed Salesforce saves; slow API slowed every rep." — then: "In the next five minutes you'll learn Platform Events & Change Data Capture so you can apply it the same day." Lower-third: dev-events |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Platform Events = business facts on a bus (Order_Placed__e). CDC = record change stream for sync. Subscribers independent; idempotent consumers; replay IDs; not for synchronous request-reply. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Define Order_Placed__e; EventBus.publish; trigger/Flow subscribe; contrast AccountChangeEvent CDC. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Order capture called warehouse sync during save — outages failed Salesforce saves; slow API slowed every rep. Solution: Publish Order_Placed__e after commit; warehouse Pub/Sub with replay; Flow tasks large orders. Outcome: Saves instant and immune to warehouse; outage events replayed; analytics added subscriber later with zero order-code changes. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Platform Developer Track → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `dev-events`. |

---

## `sf-architect` Architect & DevOps Mastery

### Module: `sf-arch-data` — Data & Sharing Architecture at Scale

### `arch-ldv` Large Data Volumes: designing for millions of rows

**Concept:** Selective indexed filters or full scans. Ownership/account/lookup skew cause locking and sharing recalc pain. Skinny tables, deferred sharing, PK chunking; best LDV strategy is fewer rows via archive/summarize.

**Real-world example:** Scenario — Telecom: 40M Tasks; integration user owned 30M; role change locked sharing all evening. → Solution — Archive >18 months to warehouse/external objects; ownership pool outside hierarchy; skinny table for hot reports; Bulk PK chunking extracts. → Outcome — Reports seconds again; reorgs no longer lock evenings; >5M row objects require LDV review.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Telecom: 40M Tasks; integration user owned 30M; role change locked sharing all evening." — then: "In the next five minutes you'll learn Large Data Volumes: designing for millions of rows so you can apply it the same day." Lower-third: arch-ldv |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Selective indexed filters or full scans. Ownership/account/lookup skew cause locking and sharing recalc pain. Skinny tables, deferred sharing, PK chunking; best LDV strategy is fewer rows via archive/summarize. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Architecture walkthrough | ON SCREEN: diagrams/whiteboard. Query Plan selective vs non-selective; skew diagrams; LDV toolbox checklist slide. Keep one running example; avoid tool bingo. |
| 3:15–4:15 | Real-world story | Scenario: Telecom: 40M Tasks; integration user owned 30M; role change locked sharing all evening. Solution: Archive >18 months to warehouse/external objects; ownership pool outside hierarchy; skinny table for hot reports; Bulk PK chunking extracts. Outcome: Reports seconds again; reorgs no longer lock evenings; >5M row objects require LDV review. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-ldv`. |

### `arch-sharing` Enterprise sharing architecture

**Concept:** Share tables + group membership are physical sharing. Keep hierarchies shallow/stable; criteria rules and territories over hierarchy contortions. Apex managed sharing survives ownership changes; restriction rules subtract visibility.

**Real-world example:** Scenario — Insurer quarterly reorg moved thousands of roles; sharing recalc locked org for hours on weekends. → Solution — Shallow 4-level hierarchy + criteria rules on region/product; Territory Management for overlays; deferred sharing windows for mass changes. → Outcome — Reorgs became Tuesday-evening minutes; auditors got a one-page diagram.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Insurer quarterly reorg moved thousands of roles; sharing recalc locked org for hours on weekends." — then: "In the next five minutes you'll learn Enterprise sharing architecture so you can apply it the same day." Lower-third: arch-sharing |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Share tables + group membership are physical sharing. Keep hierarchies shallow/stable; criteria rules and territories over hierarchy contortions. Apex managed sharing survives ownership changes; restriction rules subtract visibility. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Architecture walkthrough | ON SCREEN: diagrams/whiteboard. Share table mental model; hierarchy vs territory; Apex managed share rowCause vs manual; restriction rules placement. Keep one running example; avoid tool bingo. |
| 3:15–4:15 | Real-world story | Scenario: Insurer quarterly reorg moved thousands of roles; sharing recalc locked org for hours on weekends. Solution: Shallow 4-level hierarchy + criteria rules on region/product; Territory Management for overlays; deferred sharing windows for mass changes. Outcome: Reorgs became Tuesday-evening minutes; auditors got a one-page diagram. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-sharing`. |

### `arch-data-lifecycle` Data strategy: golden records, archiving, and Big Objects

**Concept:** Declare system of record per entity/attribute; external IDs as canonical keys. Tier hot records → Big Objects → lake/external objects. Design retention at object design time; file storage often dominates cost.

**Real-world example:** Scenario — Bank needed 7 years of interactions heading to 100M rows — performance and storage crisis. → Solution — Nightly archive >12 months to Big Object; monthly summary for hot reporting; lake for analytics; external IDs across tiers. → Outcome — Transactional object stabilized ~8M rows; compliance on demand; storage down despite retention.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Bank needed 7 years of interactions heading to 100M rows — performance and storage crisis." — then: "In the next five minutes you'll learn Data strategy: golden records, archiving, and Big Objects so you can apply it the same day." Lower-third: arch-data-lifecycle |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Declare system of record per entity/attribute; external IDs as canonical keys. Tier hot records → Big Objects → lake/external objects. Design retention at object design time; file storage often dominates cost. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Architecture walkthrough | ON SCREEN: diagrams/whiteboard. SoR matrix slide; hot/warm/cold tiers; Big Object vs Connect external objects. Keep one running example; avoid tool bingo. |
| 3:15–4:15 | Real-world story | Scenario: Bank needed 7 years of interactions heading to 100M rows — performance and storage crisis. Solution: Nightly archive >12 months to Big Object; monthly summary for hot reporting; lake for analytics; external IDs across tiers. Outcome: Transactional object stabilized ~8M rows; compliance on demand; storage down despite retention. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-data-lifecycle`. |

---

### Module: `sf-arch-integration` — Integration & Identity Architecture

### `arch-integration-patterns` Integration patterns and the middleware question

**Concept:** Name the pattern: Request-Reply, Fire-Forget, Batch Sync, Remote Call-In, UI Update, Data Virtualization. Middleware when interface count/reuse justifies it. Design for downtime: timeouts, backoff, DLQ, idempotency, business SLOs.

**Real-world example:** Scenario — Retailer: 14 point-to-point interfaces, three auth styles; ERP rename broke two silently for a week. → Solution — Classified by pattern; six batch + four events onto middleware with canonical model; kept two simple request-reply direct; correlation IDs + SLOs. → Outcome — Next ERP change = one mapping update; incidents halved; projects start with 'which pattern?'.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Retailer: 14 point-to-point interfaces, three auth styles; ERP rename broke two silently for a week." — then: "In the next five minutes you'll learn Integration patterns and the middleware question so you can apply it the same day." Lower-third: arch-integration-patterns |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Name the pattern: Request-Reply, Fire-Forget, Batch Sync, Remote Call-In, UI Update, Data Virtualization. Middleware when interface count/reuse justifies it. Design for downtime: timeouts, backoff, DLQ, idempotency, business SLOs. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Architecture walkthrough | ON SCREEN: diagrams/whiteboard. Pattern catalog table; point-to-point vs bus diagram; failure-mode checklist. Keep one running example; avoid tool bingo. |
| 3:15–4:15 | Real-world story | Scenario: Retailer: 14 point-to-point interfaces, three auth styles; ERP rename broke two silently for a week. Solution: Classified by pattern; six batch + four events onto middleware with canonical model; kept two simple request-reply direct; correlation IDs + SLOs. Outcome: Next ERP change = one mapping update; incidents halved; projects start with 'which pattern?'. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-integration-patterns`. |

### `arch-identity` Identity architecture: SSO, OAuth, and provisioning

**Concept:** Enterprise default: Salesforce as SAML/OIDC SP behind corporate IdP; My Domain first. Match OAuth flows to app shape; JWT for unattended. SCIM/JIT + IdP groups→permission set groups; automate leavers.

**Real-world example:** Scenario — Manufacturer: local SF passwords, inconsistent MFA, leavers active weeks after AD disable. → Solution — SAML SSO to Entra ID; SCIM to perm set groups; JWT connected apps with quarterly review; break-glass alerted to SOC. → Outcome — Password tickets gone; MFA/conditional access uniform; identity audit zero findings.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Manufacturer: local SF passwords, inconsistent MFA, leavers active weeks after AD disable." — then: "In the next five minutes you'll learn Identity architecture: SSO, OAuth, and provisioning so you can apply it the same day." Lower-third: arch-identity |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Enterprise default: Salesforce as SAML/OIDC SP behind corporate IdP; My Domain first. Match OAuth flows to app shape; JWT for unattended. SCIM/JIT + IdP groups→permission set groups; automate leavers. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → My Domain; Single Sign-On Settings; Connected Apps list; sketch SP vs IdP; SCIM provisioning arrow. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Manufacturer: local SF passwords, inconsistent MFA, leavers active weeks after AD disable. Solution: SAML SSO to Entra ID; SCIM to perm set groups; JWT connected apps with quarterly review; break-glass alerted to SOC. Outcome: Password tickets gone; MFA/conditional access uniform; identity audit zero findings. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-identity`. |

### `arch-well-architected` Well-Architected: trade-offs, decisions, and communication

**Concept:** Well-Architected pillars: Trusted, Easy, Adaptable — shared review language. ADRs capture context, decision, alternatives, consequences. Build differentiators, buy commodities, configure the rest; document TCO and exit.

**Real-world example:** Scenario — Scale-up CPQ debate: custom 'three rules' vs package — two quarters of circling. → Solution — Well-Architected evaluation + 3-year TCO; prototype revealed eleven rules; ADR recommended package + thin custom layer with revisit triggers. → Outcome — Decision stuck; later VP question answered in five minutes from ADR.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Scale-up CPQ debate: custom 'three rules' vs package — two quarters of circling." — then: "In the next five minutes you'll learn Well-Architected: trade-offs, decisions, and communication so you can apply it the same day." Lower-third: arch-well-architected |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Well-Architected pillars: Trusted, Easy, Adaptable — shared review language. ADRs capture context, decision, alternatives, consequences. Build differentiators, buy commodities, configure the rest; document TCO and exit. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Show ADR template filled for CPQ; walk Trusted/Easy/Adaptable checklist on the decision. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Scale-up CPQ debate: custom 'three rules' vs package — two quarters of circling. Solution: Well-Architected evaluation + 3-year TCO; prototype revealed eleven rules; ADR recommended package + thin custom layer with revisit triggers. Outcome: Decision stuck; later VP question answered in five minutes from ADR. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-well-architected`. |

---

### Module: `sf-arch-devops` — DevOps & Release Engineering

### `arch-sfdx` Source-driven development with Salesforce DX

**Concept:** DX inverts truth: Git authoritative, orgs are targets. Decomposed source, sf CLI retrieve/deploy/validate/quick-deploy. Minimize profiles in repo; .forceignore; env-specific values via Named Credentials/CMT not hardcoding.

**Real-world example:** Scenario — Nine-year click-org: no change history, deleted flow unrestorable, onboarding = oral history. → Solution — Retrieved core metadata to Git; PRs for promotions; pipelines validate every merge. → Outcome — Bad change reverted in minutes; audits answered with git log; 'what changed?' meetings died.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Nine-year click-org: no change history, deleted flow unrestorable, onboarding = oral history." — then: "In the next five minutes you'll learn Source-driven development with Salesforce DX so you can apply it the same day." Lower-third: arch-sfdx |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: DX inverts truth: Git authoritative, orgs are targets. Decomposed source, sf CLI retrieve/deploy/validate/quick-deploy. Minimize profiles in repo; .forceignore; env-specific values via Named Credentials/CMT not hardcoding. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. sf project retrieve/deploy validate/quick commands; sfdx-project.json + force-app tree; PR diff of a field. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Nine-year click-org: no change history, deleted flow unrestorable, onboarding = oral history. Solution: Retrieved core metadata to Git; PRs for promotions; pipelines validate every merge. Outcome: Bad change reverted in minutes; audits answered with git log; 'what changed?' meetings died. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-sfdx`. |

### `arch-scratch-packaging` Scratch orgs, org shape, and unlocked packages

**Concept:** Scratch orgs: ephemeral per-feature environments from definition + seed. Unlocked packages version modules with dependencies. Package where boundaries pay; source-deploy the rest pragmatically.

**Real-world example:** Scenario — Sales-eng and service-eng shared one sandbox; overwrites weekly; corrupted class blocked both two days. → Solution — Per-branch scratch orgs + seed via pipeline; base unlocked package; app packages depend on base with contract review. → Outcome — Collisions ended; package release notes replaced tribal memory; time-to-first-commit under an hour.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Sales-eng and service-eng shared one sandbox; overwrites weekly; corrupted class blocked both two days." — then: "In the next five minutes you'll learn Scratch orgs, org shape, and unlocked packages so you can apply it the same day." Lower-third: arch-scratch-packaging |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Scratch orgs: ephemeral per-feature environments from definition + seed. Unlocked packages version modules with dependencies. Package where boundaries pay; source-deploy the rest pragmatically. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. scratch-def.json; sf org create scratch; package.xml / sfdx-project packageDirectories dependencies sketch. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Sales-eng and service-eng shared one sandbox; overwrites weekly; corrupted class blocked both two days. Solution: Per-branch scratch orgs + seed via pipeline; base unlocked package; app packages depend on base with contract review. Outcome: Collisions ended; package release notes replaced tribal memory; time-to-first-commit under an hour. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-scratch-packaging`. |

### `arch-cicd` CI/CD pipelines for Salesforce

**Concept:** Spine: PR static analysis + delta validate → QA auto-deploy → UAT approval → prod quick-deploy from pre-validated job. Impacted tests at PR; full local nightly/promotion. Rollback = revert+redeploy, backups, feature flags; rehearse hotfix lane.

**Real-world example:** Scenario — Monthly heroic change-set weekends; 30% rollback-something rate. → Solution — PR validation, auto QA, UAT validate, twice-weekly quick-deploys, flags, rehearsed hotfix. → Outcome — 12 → ~100 deploys/year with lower fail rate; six-hour call became fifteen-minute quick-deploy.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Monthly heroic change-set weekends; 30% rollback-something rate." — then: "In the next five minutes you'll learn CI/CD pipelines for Salesforce so you can apply it the same day." Lower-third: arch-cicd |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Spine: PR static analysis + delta validate → QA auto-deploy → UAT approval → prod quick-deploy from pre-validated job. Impacted tests at PR; full local nightly/promotion. Rollback = revert+redeploy, backups, feature flags; rehearse hotfix lane. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Pipeline stage diagram; validate then quick-deploy; feature flag + hotfix lane swimlane. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Monthly heroic change-set weekends; 30% rollback-something rate. Solution: PR validation, auto QA, UAT validate, twice-weekly quick-deploys, flags, rehearsed hotfix. Outcome: 12 → ~100 deploys/year with lower fail rate; six-hour call became fifteen-minute quick-deploy. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-cicd`. |

### `arch-governance` Environment strategy, governance, and the CoE

**Concept:** As few orgs as possible, as many as necessary (data/regulatory lines). Risk-tiered change: automate low tiers, review high. Debt register + capacity budget. CoE = paved roads and enablement, not toll gates.

**Real-world example:** Scenario — Every change including help text waited monthly CAB; teams abused emergency lanes so risky changes got less scrutiny. → Solution — CoE risk tiers: tier-1 peer+pipeline; tier-2 async arch review 48h; tier-3 design session; CAB dissolved into tier-3. → Outcome — Lead time 34→4 days; emergency abuse ended; audit happier with pipeline evidence.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Every change including help text waited monthly CAB; teams abused emergency lanes so risky changes got less scrutiny." — then: "In the next five minutes you'll learn Environment strategy, governance, and the CoE so you can apply it the same day." Lower-third: arch-governance |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: As few orgs as possible, as many as necessary (data/regulatory lines). Risk-tiered change: automate low tiers, review high. Debt register + capacity budget. CoE = paved roads and enablement, not toll gates. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Single vs multi-org decision tree; risk-tier table; CoE platform-team scorecard. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Every change including help text waited monthly CAB; teams abused emergency lanes so risky changes got less scrutiny. Solution: CoE risk tiers: tier-1 peer+pipeline; tier-2 async arch review 48h; tier-3 design session; CAB dissolved into tier-3. Outcome: Lead time 34→4 days; emergency abuse ended; audit happier with pipeline evidence. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Architect & DevOps Mastery → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `arch-governance`. |

---

## `sf-hands-on` Salesforce Hands-on Lab

### Module: `sf-hands-on-org-schema` — Your Practice Org & Custom Schema

### `hands-on-playground-setup` Create a Trailhead Playground or blank practice org

**Concept:** A Trailhead Playground (or Developer Edition) is a free admin-capable org for safe practice. Launch from Trailhead; recover credentials from Hands-on Orgs. Confirm System Administrator. Never practice in production.

**Real-world example:** Scenario — Manager won't grant UAT Setup until hire proves they can create objects/fields safely. → Solution — Hire creates Playground, builds mini-project, screenshares Object Manager walkthrough. → Outcome — UAT access granted with confidence; onboarding tickets take minutes.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Manager won't grant UAT Setup until hire proves they can create objects/fields safely." — then: "In the next five minutes you'll learn Create a Trailhead Playground or blank practice org so you can apply it the same day." Lower-third: hands-on-playground-setup |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: A Trailhead Playground (or Developer Edition) is a free admin-capable org for safe practice. Launch from Trailhead; recover credentials from Hands-on Orgs. Confirm System Administrator. Never practice in production. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). trailhead.salesforce.com → Hands-on Orgs → Create Playground → Launch; Get Login Credentials; Gear → Setup → Users confirm System Administrator. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Manager won't grant UAT Setup until hire proves they can create objects/fields safely. Solution: Hire creates Playground, builds mini-project, screenshares Object Manager walkthrough. Outcome: UAT access granted with confidence; onboarding tickets take minutes. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Hands-on Lab → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `hands-on-playground-setup`. |

### `hands-on-custom-object-fields` Object Manager: custom objects and fields

**Concept:** Create Training_Session__c with typed fields (date, picklist, number, checkbox). Design field list first. API names end in __c and are permanent contracts for automation.

**Real-world example:** Scenario — HR needs a training tracker by Friday without AppExchange for a two-week pilot. → Solution — Admin creates Training_Session__c with date/mode/capacity/registration in sandbox, demos, deploys same shape. → Outcome — HR enters sessions same week; schema clean enough for Flow and report later.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "HR needs a training tracker by Friday without AppExchange for a two-week pilot." — then: "In the next five minutes you'll learn Object Manager: custom objects and fields so you can apply it the same day." Lower-third: hands-on-custom-object-fields |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Create Training_Session__c with typed fields (date, picklist, number, checkbox). Design field list first. API names end in __c and are permanent contracts for automation. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Object Manager → Create Custom Object Training Session + tab; New fields Session_Date__c, Delivery_Mode__c, Capacity__c, Registration_Open__c; show API names. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: HR needs a training tracker by Friday without AppExchange for a two-week pilot. Solution: Admin creates Training_Session__c with date/mode/capacity/registration in sandbox, demos, deploys same shape. Outcome: HR enters sessions same week; schema clean enough for Flow and report later. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Hands-on Lab → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `hands-on-custom-object-fields`. |

### `hands-on-layouts-app-builder` Page layouts and Lightning App Builder

**Concept:** Page layouts control which fields appear in Record Detail. Lightning App Builder arranges components; activate/assign the page. Fields must be on the layout to show in detail.

**Real-world example:** Scenario — Fifteen Opportunity fields in one long column; reps left them blank. → Solution — Regroup into layout sections; Lightning page tabs put day-to-day fields first. → Outcome — Critical handoff field completion rose in two weeks — same model, better UX.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Fifteen Opportunity fields in one long column; reps left them blank." — then: "In the next five minutes you'll learn Page layouts and Lightning App Builder so you can apply it the same day." Lower-third: hands-on-layouts-app-builder |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Page layouts control which fields appear in Record Detail. Lightning App Builder arranges components; activate/assign the page. Fields must be on the layout to show in detail. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Object Manager → Training Session → Page Layouts → sections; Lightning Record Pages → App Builder → Activation org default; verify on a record. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Fifteen Opportunity fields in one long column; reps left them blank. Solution: Regroup into layout sections; Lightning page tabs put day-to-day fields first. Outcome: Critical handoff field completion rose in two weeks — same model, better UX. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Hands-on Lab → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `hands-on-layouts-app-builder`. |

---

### Module: `sf-hands-on-data-automation` — Records, Flows, and Reports

### `hands-on-records-list-views` Create records and useful list views

**Concept:** Create records from the object tab. List views = filters + columns + sharing; pin defaults. List views for operations; reports for analysis.

**Real-world example:** Scenario — Support manager re-applies the same Case filters every morning for ten minutes. → Solution — Shared list view High Priority — My Queue with status/priority/age; team pins it. → Outcome — Triage starts instantly; manager stops asking for a dashboard when a list view was the need.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Support manager re-applies the same Case filters every morning for ten minutes." — then: "In the next five minutes you'll learn Create records and useful list views so you can apply it the same day." Lower-third: hands-on-records-list-views |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Create records from the object tab. List views = filters + columns + sharing; pin defaults. List views for operations; reports for analysis. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). App Launcher → Training Sessions → New ×3; New List View Open Virtual Sessions; filters Delivery Mode=Virtual, Registration Open=True; pin default. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Support manager re-applies the same Case filters every morning for ten minutes. Solution: Shared list view High Priority — My Queue with status/priority/age; team pins it. Outcome: Triage starts instantly; manager stops asking for a dashboard when a list view was the need. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Hands-on Lab → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `hands-on-records-list-views`. |

### `hands-on-screen-flow-basics` Flow Builder: your first screen flow

**Concept:** Screen Flow collects only needed inputs then Create Records. Activate; host on a page/action or Run from Flow Builder to test. Fault-friendly field mapping using API names.

**Real-world example:** Scenario — Closed-won handoff fields optional on layout; ops gets incomplete packages. → Solution — Screen Flow from Opportunity action validates required handoff answers and writes fields + task. → Outcome — Incomplete handoffs drop because the wizard won't finish without answers.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Closed-won handoff fields optional on layout; ops gets incomplete packages." — then: "In the next five minutes you'll learn Flow Builder: your first screen flow so you can apply it the same day." Lower-third: hands-on-screen-flow-basics |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Screen Flow collects only needed inputs then Create Records. Activate; host on a page/action or Run from Flow Builder to test. Fault-friendly field mapping using API names. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Setup → Flows → Screen Flow: Screen inputs → Create Records on Training Session → Save/Activate → Run; verify new record on tab. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Closed-won handoff fields optional on layout; ops gets incomplete packages. Solution: Screen Flow from Opportunity action validates required handoff answers and writes fields + task. Outcome: Incomplete handoffs drop because the wizard won't finish without answers. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Hands-on Lab → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `hands-on-screen-flow-basics`. |

### `hands-on-reports-from-scratch` Build a report from scratch

**Concept:** Allow Reports on the object; New Report from report type; filters, row groupings, chart; save to shared folder; validate against known sample data.

**Real-world example:** Scenario — Ops answered leadership from stale spreadsheet exports that disagreed with Salesforce. → Solution — Upcoming Sessions by Mode report with live filters and chart; teach ops to open the report. → Outcome — Standup answers in under a minute from one live report.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Ops answered leadership from stale spreadsheet exports that disagreed with Salesforce." — then: "In the next five minutes you'll learn Build a report from scratch so you can apply it the same day." Lower-third: hands-on-reports-from-scratch |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Allow Reports on the object; New Report from report type; filters, row groupings, chart; save to shared folder; validate against known sample data. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Reports → New Report → Training Sessions; columns; filter dates; group by Delivery Mode; chart; Save to Public/Hands-on folder; Run and count-check. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Ops answered leadership from stale spreadsheet exports that disagreed with Salesforce. Solution: Upcoming Sessions by Mode report with live filters and chart; teach ops to open the report. Outcome: Standup answers in under a minute from one live report. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Salesforce Hands-on Lab → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `hands-on-reports-from-scratch`. |

---

## `js-fundamentals` JavaScript Training

### Module: `js-fundamentals-core` — Language Core

### `js-variables-types` Variables, types, and equality

**Concept:** Prefer const; let when reassigning; avoid var. Know typeof pitfalls (null, arrays). Use === and explicit conversions. Normalize null/undefined from Apex/wire before render.

**Real-world example:** Scenario — LWC badge used StageName == 'Closed Won' but API value was ClosedWon; badge never lit. → Solution — Logged wire result; === against API value; show label separately from logic. → Outcome — Badge correct; team rule: logic from API values, labels for humans.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "LWC badge used StageName == 'Closed Won' but API value was ClosedWon; badge never lit." — then: "In the next five minutes you'll learn Variables, types, and equality so you can apply it the same day." Lower-third: js-variables-types |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Prefer const; let when reassigning; avoid var. Know typeof pitfalls (null, arrays). Use === and explicit conversions. Normalize null/undefined from Apex/wire before render. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. const vs let; typeof null/Array.isArray; === vs ==; Number(countFromInput)===3. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: LWC badge used StageName == 'Closed Won' but API value was ClosedWon; badge never lit. Solution: Logged wire result; === against API value; show label separately from logic. Outcome: Badge correct; team rule: logic from API values, labels for humans. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → JavaScript Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `js-variables-types`. |

### `js-functions` Functions: declarations, arrows, and this

**Concept:** Declarations vs arrows; default/rest/spread. Arrows lexically capture this — use arrow class fields for LWC callbacks. Template onClick wiring binds component methods correctly.

**Real-world example:** Scenario — Developer passed this.toggleRow to child; this wrong; selectedIds never updated. → Solution — Converted to arrow class field; stable parent event contract. → Outcome — Selection state stayed on parent; more callbacks didn't reintroduce the bug.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Developer passed this.toggleRow to child; this wrong; selectedIds never updated." — then: "In the next five minutes you'll learn Functions: declarations, arrows, and this so you can apply it the same day." Lower-third: js-functions |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Declarations vs arrows; default/rest/spread. Arrows lexically capture this — use arrow class fields for LWC callbacks. Template onClick wiring binds component methods correctly. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. formatAmount default param; arrow class field handleSelect; spread copy { ...base, ownerId }. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Developer passed this.toggleRow to child; this wrong; selectedIds never updated. Solution: Converted to arrow class field; stable parent event contract. Outcome: Selection state stayed on parent; more callbacks didn't reintroduce the bug. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → JavaScript Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `js-functions`. |

### `js-arrays-objects` Arrays and objects for component data

**Concept:** Shape Apex JSON with map/filter/find; destructuring + ?. + ??; Map for Id lookups. Return new arrays for clear re-renders.

**Real-world example:** Scenario — Datatable showed [object Object] — wrappers not mapped to column fieldNames. → Solution — Mapped flat rows with exact column keys including nested ownerName. → Outcome — Readable cells; mapper became single presentation choke point.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Datatable showed [object Object] — wrappers not mapped to column fieldNames." — then: "In the next five minutes you'll learn Arrays and objects for component data so you can apply it the same day." Lower-third: js-arrays-objects |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Shape Apex JSON with map/filter/find; destructuring + ?. + ??; Map for Id lookups. Return new arrays for clear re-renders. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. filter+map open opps; optional chaining Contact?.Name; Map from accounts by Id. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Datatable showed [object Object] — wrappers not mapped to column fieldNames. Solution: Mapped flat rows with exact column keys including nested ownerName. Outcome: Readable cells; mapper became single presentation choke point. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → JavaScript Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `js-arrays-objects`. |

---

### Module: `js-fundamentals-async-dom` — Async JavaScript & the DOM

### `js-async-promises` Promises and async/await

**Concept:** Promises: pending/fulfilled/rejected. async/await + try/catch; Promise.all for independent work; loading/error/finally UX. Imperative Apex returns a Promise.

**Real-world example:** Scenario — Submit button double-click created two Cases. → Solution — isSaving true immediately; disable button; await once; clear in finally. → Outcome — Duplicates stopped; pattern became checklist for mutating buttons.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Submit button double-click created two Cases." — then: "In the next five minutes you'll learn Promises and async/await so you can apply it the same day." Lower-third: js-async-promises |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Promises: pending/fulfilled/rejected. async/await + try/catch; Promise.all for independent work; loading/error/finally UX. Imperative Apex returns a Promise. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. async loadOpportunities await Apex; Promise.all account+contacts; refresh() with finally isLoading=false. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Submit button double-click created two Cases. Solution: isSaving true immediately; disable button; await once; clear in finally. Outcome: Duplicates stopped; pattern became checklist for mutating buttons. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → JavaScript Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `js-async-promises`. |

### `js-dom-basics` DOM basics (and what LWC handles for you)

**Concept:** DOM is a tree; LWC prefers declarative bindings over document.querySelector writes. CustomEvent for child→parent; this.template.querySelector for focus/UX after render, not business state.

**Real-world example:** Scenario — querySelector in connectedCallback returned null — template not rendered yet. → Solution — Bound values in fields/template; moved focus logic to button handler after render. → Outcome — Null errors gone; state lived in JS fields.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "querySelector in connectedCallback returned null — template not rendered yet." — then: "In the next five minutes you'll learn DOM basics (and what LWC handles for you) so you can apply it the same day." Lower-third: js-dom-basics |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: DOM is a tree; LWC prefers declarative bindings over document.querySelector writes. CustomEvent for child→parent; this.template.querySelector for focus/UX after render, not business state. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. Contrast raw document.querySelector vs template binding; CustomEvent save detail; this.template.querySelector focus helper. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: querySelector in connectedCallback returned null — template not rendered yet. Solution: Bound values in fields/template; moved focus logic to button handler after render. Outcome: Null errors gone; state lived in JS fields. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → JavaScript Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `js-dom-basics`. |

---

### Module: `js-fundamentals-modules-lwc` — ES Modules & Modern JS for LWC

### `js-es-modules` ES modules: import and export

**Concept:** Modules isolate scope with explicit exports. LWC default-exports LightningElement class; utilities use named exports. @salesforce/apex and @salesforce/schema are compiler module IDs, not filesystem paths.

**Real-world example:** Scenario — Three LWCs pasted currency formatters; finance changed rounding; only one updated — quotes disagreed. → Solution — Extracted formatUsd to c/currencyUtils; deleted copies; named import everywhere. → Outcome — One change updated every surface; reviews reject pasted utilities.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Three LWCs pasted currency formatters; finance changed rounding; only one updated — quotes disagreed." — then: "In the next five minutes you'll learn ES modules: import and export so you can apply it the same day." Lower-third: js-es-modules |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Modules isolate scope with explicit exports. LWC default-exports LightningElement class; utilities use named exports. @salesforce/apex and @salesforce/schema are compiler module IDs, not filesystem paths. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. export function formatUsd; import { LightningElement } from 'lwc'; import getQuote from '@salesforce/apex/...'; import { formatUsd } from 'c/currencyUtils'. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Three LWCs pasted currency formatters; finance changed rounding; only one updated — quotes disagreed. Solution: Extracted formatUsd to c/currencyUtils; deleted copies; named import everywhere. Outcome: One change updated every surface; reviews reject pasted utilities. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → JavaScript Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `js-es-modules`. |

### `js-modern-for-lwc` Modern syntax you will see in LWC

**Concept:** ES classes + fields; @api/@wire as compiler features; template literals; destructured event.detail; immutable updates with spread/map so children see new references.

**Real-world example:** Scenario — Parent mutated this.rows[i].status in place; child datatable kept stale cells. → Solution — Reassigned this.rows = this.rows.map(...) new array/row objects. → Outcome — Child refreshed; immutable updates documented as convention.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Parent mutated this.rows[i].status in place; child datatable kept stale cells." — then: "In the next five minutes you'll learn Modern syntax you will see in LWC so you can apply it the same day." Lower-third: js-modern-for-lwc |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: ES classes + fields; @api/@wire as compiler features; template literals; destructured event.detail; immutable updates with spread/map so children see new references. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. AccountBanner @wire getRecord; handleSearch({detail}); addId/updateStatus immutable patterns. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Parent mutated this.rows[i].status in place; child datatable kept stale cells. Solution: Reassigned this.rows = this.rows.map(...) new array/row objects. Outcome: Child refreshed; immutable updates documented as convention. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → JavaScript Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `js-modern-for-lwc`. |

---

## `java-fundamentals` Java Training

### Module: `java-fundamentals-language` — Java Language Essentials

### `java-classes-objects` Classes, objects, and methods

**Concept:** Class = blueprint; object = instance. Fields, constructors, methods; static vs instance. Apex service/handler classes share this shape — add bulkification/limits in Apex later.

**Real-world example:** Scenario — Validation, callouts prep, and stamping pasted into one 400-line trigger; untestable. → Solution — Extracted AccountService-style class with small methods; trigger became three-line dispatcher. → Outcome — Unit tests targeted methods; later callers reused the service.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Validation, callouts prep, and stamping pasted into one 400-line trigger; untestable." — then: "In the next five minutes you'll learn Classes, objects, and methods so you can apply it the same day." Lower-third: java-classes-objects |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Class = blueprint; object = instance. Fields, constructors, methods; static vs instance. Apex service/handler classes share this shape — add bulkification/limits in Apex later. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. TrainingSession class with reserveSeat; Ids.isBlank static utility; map to Apex AccountService sketch. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Validation, callouts prep, and stamping pasted into one 400-line trigger; untestable. Solution: Extracted AccountService-style class with small methods; trigger became three-line dispatcher. Outcome: Unit tests targeted methods; later callers reused the service. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Java Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `java-classes-objects`. |

### `java-types-generics` Types, nullability habits, and generics intro

**Concept:** Primitives vs wrappers (nullability). List<String> generics. Prefer BigDecimal/Decimal for money. Apex types rhyme with Java without the same wrapper split.

**Real-world example:** Scenario — Java integration used double for Opportunity discounts; finance reconciliation failed by pennies. → Solution — Switched to BigDecimal with scale/rounding aligned to Apex Decimal. → Outcome — Quote totals matched reports under agreed policy.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Java integration used double for Opportunity discounts; finance reconciliation failed by pennies." — then: "In the next five minutes you'll learn Types, nullability habits, and generics intro so you can apply it the same day." Lower-third: java-types-generics |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Primitives vs wrappers (nullability). List<String> generics. Prefer BigDecimal/Decimal for money. Apex types rhyme with Java without the same wrapper split. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. int vs Integer; List<String> loop; BigDecimal tax multiply setScale; note Apex Decimal/Id. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Java integration used double for Opportunity discounts; finance reconciliation failed by pennies. Solution: Switched to BigDecimal with scale/rounding aligned to Apex Decimal. Outcome: Quote totals matched reports under agreed policy. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Java Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `java-types-generics`. |

### `java-collections` Collections: List, Set, Map

**Concept:** List order/dupes; Set uniqueness; Map key→value. Bulk habit: collect keys → fetch once → Map → loop. Apex Map from SOQL is the same instinct with a database shortcut.

**Real-world example:** Scenario — Java middleware called Salesforce REST once per Account for contacts; API limits every Monday 8am. → Solution — Collected Account Ids in a Set; chunked contact queries; Map<String,List<ContactDto>> in memory. → Outcome — API calls down an order of magnitude — same bulk mindset as Apex SOQL.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Java middleware called Salesforce REST once per Account for contacts; API limits every Monday 8am." — then: "In the next five minutes you'll learn Collections: List, Set, Map so you can apply it the same day." Lower-third: java-collections |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: List order/dupes; Set uniqueness; Map key→value. Bulk habit: collect keys → fetch once → Map → loop. Apex Map from SOQL is the same instinct with a database shortcut. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. ArrayList/HashSet/HashMap examples; stream filter hot accounts; narrate Apex new Map<Id,Account>([SELECT...]). Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Java middleware called Salesforce REST once per Account for contacts; API limits every Monday 8am. Solution: Collected Account Ids in a Set; chunked contact queries; Map<String,List<ContactDto>> in memory. Outcome: API calls down an order of magnitude — same bulk mindset as Apex SOQL. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Java Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `java-collections`. |

---

### Module: `java-fundamentals-oop-errors` — OOP Design & Exceptions

### `java-oop` OOP: interfaces, inheritance, and composition

**Concept:** Interfaces define capabilities; swap implementations for tests. Prefer composition + constructor injection over deep inheritance. Apex has smaller OOP surface but same service-collaborator instincts.

**Real-world example:** Scenario — Java job emailed from deep domain methods; tests sent real mail or skipped the class. → Solution — CaseNotifier interface; inject LoggingCaseNotifier in tests, Email in prod. → Outcome — Domain tests offline in milliseconds; production still emailed.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Java job emailed from deep domain methods; tests sent real mail or skipped the class." — then: "In the next five minutes you'll learn OOP: interfaces, inheritance, and composition so you can apply it the same day." Lower-third: java-oop |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Interfaces define capabilities; swap implementations for tests. Prefer composition + constructor injection over deep inheritance. Apex has smaller OOP surface but same service-collaborator instincts. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. CaseNotifier + Email/Logging impls; CaseService(CaseNotifier) escalate delegates. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Java job emailed from deep domain methods; tests sent real mail or skipped the class. Solution: CaseNotifier interface; inject LoggingCaseNotifier in tests, Email in prod. Outcome: Domain tests offline in milliseconds; production still emailed. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Java Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `java-oop`. |

### `java-exceptions` Exceptions and error strategy

**Concept:** Throw when contract can't be met; catch to recover/translate — never empty catch. Java checked vs unchecked; Apex has no checked exceptions and unhandled errors roll back the transaction.

**Real-world example:** Scenario — Sync caught Exception, logged, still returned HTTP 200; records never updated. → Solution — Translated failures into job result with failed Ids; non-success to scheduler; alert on failures. → Outcome — Ops saw failures same morning instead of days later.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Sync caught Exception, logged, still returned HTTP 200; records never updated." — then: "In the next five minutes you'll learn Exceptions and error strategy so you can apply it the same day." Lower-third: java-exceptions |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Throw when contract can't be met; catch to recover/translate — never empty catch. Java checked vs unchecked; Apex has no checked exceptions and unhandled errors roll back the transaction. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. parseCapacity try/catch rethrow with cause; note Apex boundary catch vs don't swallow in domain. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Sync caught Exception, logged, still returned HTTP 200; records never updated. Solution: Translated failures into job result with failed Ids; non-success to scheduler; alert on failures. Outcome: Ops saw failures same morning instead of days later. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Java Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `java-exceptions`. |

---

### Module: `java-fundamentals-testing` — Unit Testing Discipline

### `java-unit-testing` Unit tests with clear arrange-act-assert

**Concept:** Name behavior; arrange minimal state; act once; assert outcomes including edge cases. Fakes for email/HTTP. Apex adds @isTest, coverage gates, startTest/stopTest, isolated test data.

**Real-world example:** Scenario — Deployment blocked at 68% Apex coverage; only happy-path UI clicks tested. → Solution — Added @isTest against service classes including null/empty — same cases as Java port. → Outcome — Coverage cleared; empty-list bug caught pre-release.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Deployment blocked at 68% Apex coverage; only happy-path UI clicks tested." — then: "In the next five minutes you'll learn Unit tests with clear arrange-act-assert so you can apply it the same day." Lower-third: java-unit-testing |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Name behavior; arrange minimal state; act once; assert outcomes including edge cases. Fakes for email/HTTP. Apex adds @isTest, coverage gates, startTest/stopTest, isolated test data. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. JUnit TrainingSessionTest reserveSeat + assertThrows; RecordingNotifier fake; mention Apex @isTest parallels. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Deployment blocked at 68% Apex coverage; only happy-path UI clicks tested. Solution: Added @isTest against service classes including null/empty — same cases as Java port. Outcome: Coverage cleared; empty-list bug caught pre-release. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Java Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `java-unit-testing`. |

### `java-testing-quality` Assertions, coverage, and regression habits

**Concept:** Precise assertions encode the spec; coverage without asserts is vanity. Table-driven boundary examples. Lock Java examples in tests before porting algorithms to Apex.

**Real-world example:** Scenario — Refactor of pricing kept high coverage but tests never checked amounts; tiers drifted silently. → Solution — Rewrote table-driven tier-boundary asserts; build fails on drift. → Outcome — Next refactor fearless; off-by-one caught before customers.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Refactor of pricing kept high coverage but tests never checked amounts; tiers drifted silently." — then: "In the next five minutes you'll learn Assertions, coverage, and regression habits so you can apply it the same day." Lower-third: java-testing-quality |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Precise assertions encode the spec; coverage without asserts is vanity. Table-driven boundary examples. Lock Java examples in tests before porting algorithms to Apex. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. assertAll exact fields; indexById_skipsNulls example; coverage-vs-asserts slide. Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Refactor of pricing kept high coverage but tests never checked amounts; tiers drifted silently. Solution: Rewrote table-driven tier-boundary asserts; build fails on drift. Outcome: Next refactor fearless; off-by-one caught before customers. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Java Training → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `java-testing-quality`. |

---

## `release-management` Release Management

### Module: `release-mgmt-foundations` — Environments & Change Vehicles

### `release-change-sets-vs-dx` Change sets vs Salesforce DX

**Concept:** Change sets: visual org-to-org, weak history — OK for rare tiny tweaks. DX: Git source of truth, PRs, CI validate, auditable SHA. Hybrid: configure in sandboxes but retrieve to Git; production only from pipeline.

**Real-world example:** Scenario — Two admins uploaded separate change sets same afternoon; prod got A's layout and B's missing field dependency. → Solution — Git-backed DX; personal/scratch orgs; PR + pipeline to UAT then prod. → Outcome — Conflicts in review before prod; release notes = commit history.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Two admins uploaded separate change sets same afternoon; prod got A's layout and B's missing field dependency." — then: "In the next five minutes you'll learn Change sets vs Salesforce DX so you can apply it the same day." Lower-third: release-change-sets-vs-dx |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Change sets: visual org-to-org, weak history — OK for rare tiny tweaks. DX: Git source of truth, PRs, CI validate, auditable SHA. Hybrid: configure in sandboxes but retrieve to Git; production only from pipeline. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Demo click-path | ON SCREEN: follow this path live (or recorded). Outbound Change Set UI vs VS Code/sf project deploy + Git PR diff side-by-side. Narrate each click; pause so viewers can mirror in a Playground. |
| 3:15–4:15 | Real-world story | Scenario: Two admins uploaded separate change sets same afternoon; prod got A's layout and B's missing field dependency. Solution: Git-backed DX; personal/scratch orgs; PR + pipeline to UAT then prod. Outcome: Conflicts in review before prod; release notes = commit history. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Release Management → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `release-change-sets-vs-dx`. |

### `release-sandboxes-environments` Sandboxes and environment strategy

**Concept:** Dev/Dev Pro for build; Partial for sampled QA; Full for UAT — refresh is destructive. Topology: feature scratch/personal → integration QA → UAT → prod from approved commit. Hotfixes from prod tag, merge forward.

**Real-world example:** Scenario — Major release UAT rejected — Full sandbox three months stale. → Solution — Calendar-owned refresh two weeks before UAT; Partial data template for QA; forbid building only in Full. → Outcome — UAT on time; feature work continued in source-backed lower envs during refresh.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Major release UAT rejected — Full sandbox three months stale." — then: "In the next five minutes you'll learn Sandboxes and environment strategy so you can apply it the same day." Lower-third: release-sandboxes-environments |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Dev/Dev Pro for build; Partial for sampled QA; Full for UAT — refresh is destructive. Topology: feature scratch/personal → integration QA → UAT → prod from approved commit. Hotfixes from prod tag, merge forward. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Draw Dev→QA→UAT→Prod topology; sandbox type table; hotfix merge-forward arrow. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Major release UAT rejected — Full sandbox three months stale. Solution: Calendar-owned refresh two weeks before UAT; Partial data template for QA; forbid building only in Full. Outcome: UAT on time; feature work continued in source-backed lower envs during refresh. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Release Management → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `release-sandboxes-environments`. |

### `release-branching-strategies` Branching strategies for Salesforce teams

**Concept:** Trunk-based short-lived branches for frequent releases; release branches only when cadence truly slow. Prefer permission sets over profile XML; narrow PRs one capability; every prod deploy maps to a commit/tag.

**Real-world example:** Scenario — Two features edit Admin profile; freeze-week unreadable conflict. → Solution — Mandate permission-set-based access for new features; dedicated path for remaining profile edits. → Outcome — Freeze merges routine; access reviews as intent not 5k-line XML.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Two features edit Admin profile; freeze-week unreadable conflict." — then: "In the next five minutes you'll learn Branching strategies for Salesforce teams so you can apply it the same day." Lower-third: release-branching-strategies |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Trunk-based short-lived branches for frequent releases; release branches only when cadence truly slow. Prefer permission sets over profile XML; narrow PRs one capability; every prod deploy maps to a commit/tag. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Trunk vs release-branch diagram; good PR scope example; profile vs permission set contrast. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Two features edit Admin profile; freeze-week unreadable conflict. Solution: Mandate permission-set-based access for new features; dedicated path for remaining profile edits. Outcome: Freeze merges routine; access reviews as intent not 5k-line XML. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Release Management → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `release-branching-strategies`. |

---

### Module: `release-mgmt-pipelines` — CI/CD Pipelines & Validation

### `release-cicd-pipelines` CI/CD pipelines for Salesforce

**Concept:** PR CI: auth → deploy to scratch → Apex tests → block merge. Release CD: promote same commit through QA/UAT/prod with approvals. Secrets in vault; prod credentials only on pipeline.

**Real-world example:** Scenario — Dev skipped RunLocalTests locally to UAT; prod deploy failed tests never run. → Solution — Lock prod creds to pipeline; revoke laptop→UAT; PR CI must pass RunLocalTests. → Outcome — Broken tests fail at PR time, not maintenance window.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Dev skipped RunLocalTests locally to UAT; prod deploy failed tests never run." — then: "In the next five minutes you'll learn CI/CD pipelines for Salesforce so you can apply it the same day." Lower-third: release-cicd-pipelines |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: PR CI: auth → deploy to scratch → Apex tests → block merge. Release CD: promote same commit through QA/UAT/prod with approvals. Secrets in vault; prod credentials only on pipeline. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Pipeline stage list; PR vs release job; secrets/config matrix. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Dev skipped RunLocalTests locally to UAT; prod deploy failed tests never run. Solution: Lock prod creds to pipeline; revoke laptop→UAT; PR CI must pass RunLocalTests. Outcome: Broken tests fail at PR time, not maintenance window. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Release Management → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `release-cicd-pipelines`. |

### `release-deployment-validation` Deployment validation and test levels

**Concept:** Check-only validate compiles/tests without committing. Choose NoTestRun/RunSpecifiedTests/RunLocalTests by risk — encode in pipeline. Include dependencies, destructive manifests, data/activation post-steps; re-validate if prod moved.

**Real-world example:** Scenario — Friday validate commit A; weekend hotfix to prod; Monday deploy A without revalidate — mid-window fail. → Solution — Policy: fresh validate of final tag against current prod before approval; hotfixes merge forward before tag. → Outcome — Window starts with validate matching the org you change.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Friday validate commit A; weekend hotfix to prod; Monday deploy A without revalidate — mid-window fail." — then: "In the next five minutes you'll learn Deployment validation and test levels so you can apply it the same day." Lower-third: release-deployment-validation |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Check-only validate compiles/tests without committing. Choose NoTestRun/RunSpecifiedTests/RunLocalTests by risk — encode in pipeline. Include dependencies, destructive manifests, data/activation post-steps; re-validate if prod moved. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Code walkthrough | ON SCREEN: IDE or Developer Console. sf project deploy validate --test-level RunLocalTests; quick deploy by job id; dependency miss example (flexiPage needs field). Read the code aloud line-by-line; contrast bad vs good where noted. |
| 3:15–4:15 | Real-world story | Scenario: Friday validate commit A; weekend hotfix to prod; Monday deploy A without revalidate — mid-window fail. Solution: Policy: fresh validate of final tag against current prod before approval; hotfixes merge forward before tag. Outcome: Window starts with validate matching the org you change. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Release Management → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `release-deployment-validation`. |

---

### Module: `release-mgmt-governance` — Rollback, Governance & Release Cadence

### `release-rollback-governance` Rollback strategies and change governance

**Concept:** No universal undeploy — redeploy previous tag, toggles, compensating scripts. Separation of duties; audit SHA/pipeline/approver. Go/no-go: technical + business boxes; no-go is valid.

**Real-world example:** Scenario — Bad Flow emails thousands; night team has no trusted undeploy. → Solution — Playbook step 1: deactivate Flow via known procedure; then redeploy previous metadata tag. → Outcome — Blast radius stopped in minutes because rollback was written with owners.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Bad Flow emails thousands; night team has no trusted undeploy." — then: "In the next five minutes you'll learn Rollback strategies and change governance so you can apply it the same day." Lower-third: release-rollback-governance |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: No universal undeploy — redeploy previous tag, toggles, compensating scripts. Separation of duties; audit SHA/pipeline/approver. Go/no-go: technical + business boxes; no-go is valid. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Rollback options ladder; go/no-go checklist; approval/SoD swimlane. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Bad Flow emails thousands; night team has no trusted undeploy. Solution: Playbook step 1: deactivate Flow via known procedure; then redeploy previous metadata tag. Outcome: Blast radius stopped in minutes because rollback was written with owners. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Release Management → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `release-rollback-governance`. |

### `release-calendars-quality-gates` Release calendars and quality gates

**Concept:** Publish cutoff/freeze/UAT/prod/hypercare; respect business and platform blackouts. Gates: PR build+tests+review; RC UAT sign-off; prod final validate+approval+monitoring+rollback owner. Sev-1 hotfix path still uses Git/pipeline.

**Real-world example:** Scenario — Black Friday freeze; day-three pricing bug; chat argues for manual prod edit. → Solution — Calendar already defines Sev-1 path: branch from prod tag, accelerated pipeline, on-call RM approval, hypercare. → Outcome — Fix in under two hours with audit trail; freeze intact for non-emergencies.

**5-minute video script:**

| Time | Segment | Narration / Direction |
|------|---------|----------------------|
| 0:00–0:30 | Cold open | HOOK: "Black Friday freeze; day-three pricing bug; chat argues for manual prod edit." — then: "In the next five minutes you'll learn Release calendars and quality gates so you can apply it the same day." Lower-third: release-calendars-quality-gates |
| 0:30–1:30 | Core concepts | Teach the idea in plain language: Publish cutoff/freeze/UAT/prod/hypercare; respect business and platform blackouts. Gates: PR build+tests+review; RC UAT sign-off; prod final validate+approval+monitoring+rollback owner. Sev-1 hotfix path still uses Git/pipeline. On-screen: 3–5 bullet keywords only; don't read a wall of text. |
| 1:30–3:15 | Process walkthrough | ON SCREEN: process diagram or checklist. Sample release calendar; three-stage quality gates; hotfix valve diagram. Name owners and artifacts at each step. |
| 3:15–4:15 | Real-world story | Scenario: Black Friday freeze; day-three pricing bug; chat argues for manual prod edit. Solution: Calendar already defines Sev-1 path: branch from prod tag, accelerated pipeline, on-call RM approval, hypercare. Outcome: Fix in under two hours with audit trail; freeze intact for non-emergencies. End with the decision rule learners should remember. |
| 4:15–4:45 | Recap | Three takeaways aloud (from the concept). Flash checklist graphic. "If you remember nothing else: apply today's pattern before you invent a new one." |
| 4:45–5:00 | CTA | "Open Salesforce Academy → Release Management → this lesson. Use Read mode for detail, then mark complete. When you're ready, take the module quiz. Next up: stay on the path." End card: Academy URL / lesson id `release-calendars-quality-gates`. |

---

## Appendix — Production checklist

- [ ] Script reviewed against current Salesforce UI labels (Setup paths drift across releases)
- [ ] Demo recorded in a Playground / scratch org — no customer data
- [ ] Runtime 4:30–5:30; captions exported if required by your enablement policy
- [ ] File named `{lesson-id}-vN.mp4` and uploaded on the correct lesson Video session
- [ ] Spot-check playback as a non-admin learner account that has Academy access
- [ ] Module quiz still aligns with what the video teaches

*End of pack — 69 lessons across 8 tracks.*
