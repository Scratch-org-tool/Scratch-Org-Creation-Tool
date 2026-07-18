# Architect & DevOps Mastery — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Expert · **Category:** Salesforce core curriculum · **Badge:** Architect Mastery · **Modules:** 3 · **Lessons:** 10 · **Estimated effort:** ~12h

The expert path: how Salesforce behaves at millions of records and thousands of users, how to architect integrations and identity across an enterprise landscape, and how modern teams deliver change through source control, scratch orgs, and CI/CD pipelines. Think in trade-offs, document decisions, and design what the platform rewards.

**Skills:** Large data volumes · Enterprise sharing design · Integration architecture · Identity & SSO · Salesforce DX & CI/CD · Governance

## Contents

- **Module 1: Data & Sharing Architecture at Scale**
  - Lesson 1.1: Large Data Volumes: designing for millions of rows
  - Lesson 1.2: Enterprise sharing architecture
  - Lesson 1.3: Data strategy: golden records, archiving, and Big Objects
- **Module 2: Integration & Identity Architecture**
  - Lesson 2.1: Integration patterns and the middleware question
  - Lesson 2.2: Identity architecture: SSO, OAuth, and provisioning
  - Lesson 2.3: Well-Architected: trade-offs, decisions, and communication
- **Module 3: DevOps & Release Engineering**
  - Lesson 3.1: Source-driven development with Salesforce DX
  - Lesson 3.2: Scratch orgs, org shape, and unlocked packages
  - Lesson 3.3: CI/CD pipelines for Salesforce
  - Lesson 3.4: Environment strategy, governance, and the CoE

## Module 1: Data & Sharing Architecture at Scale

What changes at 10 million rows: query selectivity, skew, sharing recalculation, and lifecycle strategies.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 1.1 — Large Data Volumes: designing for millions of rows

**Lesson ID:** `arch-ldv` · **Reading time:** 22 min · **Video:** 5:00

> Indexes, skinny tables, selective queries, and the data-skew patterns that quietly destroy performance.

**Learning objectives**

- Predict query behavior at scale using selectivity rules
- Recognize and prevent ownership, lookup, and account data skew
- Apply LDV mitigations: indexes, skinny tables, divisions, async patterns

#### Concept explanation

##### Selectivity is everything

Under the hood every object is stored in generic multi-tenant tables, and the Lightning Platform query optimizer decides per query whether an index can be used. Standard indexes cover Id, Name, OwnerId, CreatedDate, SystemModstamp, lookup and master-detail fields, and external IDs; custom indexes can be requested on other fields.

A filter is selective roughly when it returns under 10% of the first million rows and 5% thereafter (capped). Non-selective filters on big tables trigger full scans: timeouts in reports, list views, SOQL. The Query Plan tool exposes the optimizer's costing — architects read it the way DBAs read explain plans.

##### Data skew: the three flavors

Ownership skew: one user (usually an integration user) owning hundreds of thousands of records — any role/ownership change recalculates sharing for all of them, locking rows for minutes. Account skew: tens of thousands of children under one account — updates to children fight to lock the same parent. Lookup skew: one lookup target referenced by enormous numbers of records — same locking problem via a side door.

Mitigations: distribute ownership across a pool of integration users placed at the top of the role hierarchy (or outside it), split mega-accounts into logical sub-accounts, and introduce "bucket" records or nullable lookups to spread lookup targets.

##### The LDV toolbox

Skinny tables (Salesforce-provisioned narrow copies of hot fields) accelerate specific report/query workloads. Divisions partition extremely large orgs. Deferred sharing calculation batches recalc during maintenance windows for mass ownership changes. Bulk API with PK chunking extracts giant tables reliably.

Above all: keep the working set small — archive aggressively (next lessons), summarize instead of storing detail forever, and question every "keep everything in Salesforce forever" requirement. The cheapest query is against a row that is not there.

#### Real-world example — The 40-million-task org

- **Scenario:** A telecom logged every customer touch as a Task — 40 million rows and growing. Reports timed out, the integration user owned 30 million of them, and a reorg's role change once locked sharing recalculation for an entire evening.
- **Solution:** Architecture review: activities older than 18 months moved to a warehouse (kept queryable via external objects), ownership spread across ten integration users outside the role hierarchy, hot reports moved to a skinny table, and extraction switched to Bulk API with PK chunking.
- **Outcome:** Report latency returned to seconds, reorgs stopped causing sharing-lock evenings, and the org adopted a standing rule: any object projected to exceed 5M rows gets an LDV design review first.

#### Key takeaways

- Learn the standard indexes and the selectivity thresholds by heart
- Skew (ownership/account/lookup) is a locking problem — design ownership deliberately
- Skinny tables, deferred sharing, PK chunking: know when to reach for each
- The best LDV strategy is fewer rows: archive and summarize

#### Go deeper

- [Large Data Volumes (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/large-data-volumes)
- [Best Practices for Deployments with Large Data Volumes](https://developer.salesforce.com/docs/atlas.en-us.salesforce_large_data_volumes_bp.meta/salesforce_large_data_volumes_bp/ldv_deployments_introduction.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Large Data Volumes: designing for millions of rows matters | intro |
| 2 | 0:30–1:30 | Selectivity is everything | concept |
| 3 | 1:30–2:30 | Data skew: the three flavors | concept |
| 4 | 2:30–3:30 | The LDV toolbox | demo |
| 5 | 3:30–4:15 | Real story — The 40-million-task org | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Large Data Volumes: designing for millions of rows matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Large Data Volumes: designing for millions of rows. Indexes, skinny tables, selective queries, and the data-skew patterns that quietly destroy performance. By the end of this video you will be able to predict query behavior at scale using selectivity rules; recognize and prevent ownership, lookup, and account data skew; apply LDV mitigations: indexes, skinny tables, divisions, async patterns.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · Data & Sharing Architecture at Scale

**[0:30–1:30] Selectivity is everything**

- **Narration (word-for-word):** Under the hood every object is stored in generic multi-tenant tables, and the Lightning Platform query optimizer decides per query whether an index can be used. Standard indexes cover Id, Name, OwnerId, CreatedDate, SystemModstamp, lookup and master-detail fields, and external IDs; custom indexes can be requested on other fields. A filter is selective roughly when it returns under 10% of the first million rows and 5% thereafter (capped). Non-selective filters on big tables trigger full scans: timeouts in reports, list views, SOQL. The Query Plan tool exposes the optimizer's costing — architects read it the way DBAs read explain plans.
- **On screen:** Animated explainer diagram for "Selectivity is everything": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Data skew: the three flavors**

- **Narration (word-for-word):** Ownership skew: one user (usually an integration user) owning hundreds of thousands of records — any role/ownership change recalculates sharing for all of them, locking rows for minutes. Account skew: tens of thousands of children under one account — updates to children fight to lock the same parent. Lookup skew: one lookup target referenced by enormous numbers of records — same locking problem via a side door. Mitigations: distribute ownership across a pool of integration users placed at the top of the role hierarchy (or outside it), split mega-accounts into logical sub-accounts, and introduce "bucket" records or nullable lookups to spread lookup targets.
- **On screen:** Animated explainer diagram for "Data skew: the three flavors": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] The LDV toolbox**

- **Narration (word-for-word):** Let's actually do this together. Skinny tables (Salesforce-provisioned narrow copies of hot fields) accelerate specific report/query workloads. Divisions partition extremely large orgs. Deferred sharing calculation batches recalc during maintenance windows for mass ownership changes. Bulk API with PK chunking extracts giant tables reliably. Above all: keep the working set small — archive aggressively (next lessons), summarize instead of storing detail forever, and question every "keep everything in Salesforce forever" requirement. The cheapest query is against a row that is not there.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Above all: keep the working set small — archive aggressively (next lessons), summarize instead of storing detail forever, and question every "keep everything in Salesforce forever" requirement.
  2. The cheapest query is against a row that is not there.

**[3:30–4:15] Real story — The 40-million-task org**

- **Narration (word-for-word):** Here is why this matters in the real world. A telecom logged every customer touch as a Task — 40 million rows and growing. Reports timed out, the integration user owned 30 million of them, and a reorg's role change once locked sharing recalculation for an entire evening. What did they do? Architecture review: activities older than 18 months moved to a warehouse (kept queryable via external objects), ownership spread across ten integration users outside the role hierarchy, hot reports moved to a skinny table, and extraction switched to Bulk API with PK chunking.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The 40-million-task org

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Learn the standard indexes and the selectivity thresholds by heart. Skew (ownership/account/lookup) is a locking problem — design ownership deliberately. Skinny tables, deferred sharing, PK chunking: know when to reach for each. The best LDV strategy is fewer rows: archive and summarize.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Large Data Volumes: designing for millions of rows — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — Enterprise sharing architecture

**Lesson ID:** `arch-sharing` · **Reading time:** 20 min · **Video:** 5:00

> Designing who-sees-what for thousands of users: implicit sharing, share tables, Apex managed sharing, and performance.

**Learning objectives**

- Read the sharing architecture: share tables, group maintenance, implicit shares
- Design role hierarchies and territory structures that scale
- Use Apex managed sharing and restriction rules appropriately

#### Concept explanation

##### How sharing physically works

Every object with Private/Read-Only OWD has a share table (AccountShare, MyObject__Share) holding access grants, and group-membership tables the platform joins at query time. Every sharing rule, team member, and manual share is a row; the role hierarchy materializes as group memberships.

This is why sharing design is performance design: millions of share rows recalculating on a role change is the hidden cost of a casually restructured hierarchy. Implicit sharing (parent account access from child opportunity/case access, and vice versa for portal users) adds rows you never explicitly created.

##### Structures that scale

Keep role hierarchies shallow and stable — model data access needs, not the HR org chart; every reorg-driven role move triggers recalculation. Prefer criteria-based sharing and public groups over per-team rules that multiply. Territory Management handles matrixed sales access (geography × product) better than hierarchy contortions.

For B2C-scale communities/portals, sharing sets and share groups follow different mechanics than internal sharing — an architect sizing an Experience Cloud rollout must model those separately.

##### Programmatic and restrictive controls

Apex managed sharing writes share rows with a custom rowCause for requirements no declarative rule expresses ("share the claim with the assigned adjuster's peer-review group for 30 days"). Managed shares survive ownership changes; manual shares do not — a critical operational difference.

Restriction rules (and scoping rules) SUBTRACT visibility — the long-missing "deny" for specific segments (contractors see only their department's cases). They apply after normal sharing and cannot mix with every feature, so validate against your report/list-view requirements before committing.

#### Real-world example — The reorg that used to take a weekend

- **Scenario:** An insurer restructured sales quarterly. Each reorg meant moving thousands of users between roles; sharing recalculation locked the org for hours, so reorgs happened on weekends with all-hands on deck.
- **Solution:** Architects rebuilt access around a shallow four-level hierarchy plus criteria-based rules on region/product fields, moved matrixed overlay access to Territory Management, and scheduled unavoidable mass changes with deferred sharing maintenance windows.
- **Outcome:** Quarterly reorgs became a Tuesday-evening configuration change measured in minutes. The access model also became explainable — auditors received a one-page diagram instead of a 400-rule export.

#### Key takeaways

- Sharing is rows in share tables — design with recalculation cost in mind
- Shallow, stable hierarchies; criteria-based rules; territories for matrix access
- Apex managed sharing for exotic rules; restriction rules for subtractive needs
- Model portal/community sharing separately — different mechanics

#### Go deeper

- [Who Sees What (Salesforce Help)](https://help.salesforce.com/s/articleView?id=sf.security_data_access.htm&type=5)
- [Record-Level Access: Under the Hood (Architect guide)](https://developer.salesforce.com/docs/atlas.en-us.draes.meta/draes/draes_preface.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Enterprise sharing architecture matters | intro |
| 2 | 0:30–1:30 | How sharing physically works | concept |
| 3 | 1:30–2:30 | Structures that scale | concept |
| 4 | 2:30–3:30 | Programmatic and restrictive controls | concept |
| 5 | 3:30–4:15 | Real story — The reorg that used to take a weekend | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Enterprise sharing architecture matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Enterprise sharing architecture. Designing who-sees-what for thousands of users: implicit sharing, share tables, Apex managed sharing, and performance. By the end of this video you will be able to read the sharing architecture: share tables, group maintenance, implicit shares; design role hierarchies and territory structures that scale; use Apex managed sharing and restriction rules appropriately.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · Data & Sharing Architecture at Scale

**[0:30–1:30] How sharing physically works**

- **Narration (word-for-word):** Every object with Private/Read-Only OWD has a share table (AccountShare, MyObject__Share) holding access grants, and group-membership tables the platform joins at query time. Every sharing rule, team member, and manual share is a row; the role hierarchy materializes as group memberships. This is why sharing design is performance design: millions of share rows recalculating on a role change is the hidden cost of a casually restructured hierarchy. Implicit sharing (parent account access from child opportunity/case access, and vice versa for portal users) adds rows you never explicitly created.
- **On screen:** Animated explainer diagram for "How sharing physically works": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Structures that scale**

- **Narration (word-for-word):** Keep role hierarchies shallow and stable — model data access needs, not the HR org chart; every reorg-driven role move triggers recalculation. Prefer criteria-based sharing and public groups over per-team rules that multiply. Territory Management handles matrixed sales access (geography × product) better than hierarchy contortions. For B2C-scale communities/portals, sharing sets and share groups follow different mechanics than internal sharing — an architect sizing an Experience Cloud rollout must model those separately.
- **On screen:** Animated explainer diagram for "Structures that scale": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Programmatic and restrictive controls**

- **Narration (word-for-word):** Apex managed sharing writes share rows with a custom rowCause for requirements no declarative rule expresses ("share the claim with the assigned adjuster's peer-review group for 30 days"). Managed shares survive ownership changes; manual shares do not — a critical operational difference. Restriction rules (and scoping rules) SUBTRACT visibility — the long-missing "deny" for specific segments (contractors see only their department's cases). They apply after normal sharing and cannot mix with every feature, so validate against your report/list-view requirements before committing.
- **On screen:** Animated explainer diagram for "Programmatic and restrictive controls": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The reorg that used to take a weekend**

- **Narration (word-for-word):** Here is why this matters in the real world. An insurer restructured sales quarterly. Each reorg meant moving thousands of users between roles; sharing recalculation locked the org for hours, so reorgs happened on weekends with all-hands on deck. What did they do? Architects rebuilt access around a shallow four-level hierarchy plus criteria-based rules on region/product fields, moved matrixed overlay access to Territory Management, and scheduled unavoidable mass changes with deferred sharing maintenance windows. And the payoff: Quarterly reorgs became a Tuesday-evening configuration change measured in minutes. The access model also became explainable — auditors received a one-page diagram instead of a 400-rule export.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The reorg that used to take a weekend

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Sharing is rows in share tables — design with recalculation cost in mind. Shallow, stable hierarchies; criteria-based rules; territories for matrix access. Apex managed sharing for exotic rules; restriction rules for subtractive needs. Model portal/community sharing separately — different mechanics.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Enterprise sharing architecture — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.3 — Data strategy: golden records, archiving, and Big Objects

**Lesson ID:** `arch-data-lifecycle` · **Reading time:** 18 min · **Video:** 5:00

> Master data thinking, archival tiers, and keeping the org lean without losing history.

**Learning objectives**

- Define system-of-record boundaries and golden-record strategy
- Design archival tiers with Big Objects and external stores
- Keep integrations consistent with external IDs and canonical keys

#### Concept explanation

##### Master data: who owns the truth?

In enterprise landscapes Salesforce is rarely the only system holding customers. Architecture must declare, per entity and per attribute, the system of record: perhaps ERP owns billing addresses, Salesforce owns relationship data, and a CDP merges the marketing view.

Without this declaration, integrations "sync" both directions until data ping-pongs. Canonical keys (external IDs) anchor identity across systems; survivorship rules decide which source wins per field on merge. This is unglamorous work that determines whether every downstream report can be trusted.

##### Archival tiers

A pragmatic tiering: hot data (active use) stays as normal records; warm history moves to Big Objects — Salesforce's billions-scale append-oriented store, queryable via Async SOQL/limited SOQL, ideal for audit trails and interaction history; cold data exports to a lake/warehouse, optionally surfaced back read-only through Salesforce Connect external objects.

Design archival at OBJECT DESIGN TIME: which date field drives retention, what summary rolls up before detail leaves, and which compliance rules (retention/deletion mandates) apply. Retrofitting archival onto a 50M-row object is an order of magnitude harder.

##### Storage economics and hygiene

Data storage is one of the platform's most expensive line items; unbounded growth also degrades performance and backup/restore windows. Quarterly hygiene reviews — top objects by rows/storage, growth curves, orphaned records — keep surprises away.

Beware "attachment sprawl": Files often dominate storage. Policy (what belongs in Salesforce vs the document platform), plus automated cleanup for machine-generated files, routinely reclaims more storage than any record archival project.

#### Real-world example — Seven years of interaction history, one lean org

- **Scenario:** A bank's compliance mandate required seven years of customer-interaction history, but the interactions object was on course for 100M rows — threatening performance and a storage bill nobody had budgeted.
- **Solution:** Interactions older than 12 months flow nightly into a Big Object keyed by customer + timestamp (compliance queries run there); a monthly summary record per customer keeps hot reporting fast; raw exports land in the data lake for analytics. External IDs anchor identity across all three tiers.
- **Outcome:** The transactional object stabilized around 8M rows, compliance retrieves any historical interaction on demand, and storage costs fell despite the seven-year retention guarantee.

#### Key takeaways

- Declare system of record per entity AND attribute; anchor with external IDs
- Tier data: records → Big Objects → external stores, by access pattern
- Design retention/archival when designing the object, not after 50M rows
- Audit file storage — it often dwarfs record storage

#### Go deeper

- [Big Objects Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/big_objects)
- [Salesforce Connect (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lightning_connect)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Data strategy: golden records, archiving, and Big Objects matters | intro |
| 2 | 0:30–1:30 | Master data: who owns the truth? | concept |
| 3 | 1:30–2:30 | Archival tiers | concept |
| 4 | 2:30–3:30 | Storage economics and hygiene | concept |
| 5 | 3:30–4:15 | Real story — Seven years of interaction history, one lean org | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Data strategy: golden records, archiving, and Big Objects matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Data strategy: golden records, archiving, and Big Objects. Master data thinking, archival tiers, and keeping the org lean without losing history. By the end of this video you will be able to define system-of-record boundaries and golden-record strategy; design archival tiers with Big Objects and external stores; keep integrations consistent with external IDs and canonical keys.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · Data & Sharing Architecture at Scale

**[0:30–1:30] Master data: who owns the truth?**

- **Narration (word-for-word):** In enterprise landscapes Salesforce is rarely the only system holding customers. Architecture must declare, per entity and per attribute, the system of record: perhaps ERP owns billing addresses, Salesforce owns relationship data, and a CDP merges the marketing view. Without this declaration, integrations "sync" both directions until data ping-pongs. Canonical keys (external IDs) anchor identity across systems; survivorship rules decide which source wins per field on merge. This is unglamorous work that determines whether every downstream report can be trusted.
- **On screen:** Animated explainer diagram for "Master data: who owns the truth?": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Archival tiers**

- **Narration (word-for-word):** A pragmatic tiering: hot data (active use) stays as normal records; warm history moves to Big Objects — Salesforce's billions-scale append-oriented store, queryable via Async SOQL/limited SOQL, ideal for audit trails and interaction history; cold data exports to a lake/warehouse, optionally surfaced back read-only through Salesforce Connect external objects. Design archival at OBJECT DESIGN TIME: which date field drives retention, what summary rolls up before detail leaves, and which compliance rules (retention/deletion mandates) apply. Retrofitting archival onto a 50M-row object is an order of magnitude harder.
- **On screen:** Animated explainer diagram for "Archival tiers": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Storage economics and hygiene**

- **Narration (word-for-word):** Data storage is one of the platform's most expensive line items; unbounded growth also degrades performance and backup/restore windows. Quarterly hygiene reviews — top objects by rows/storage, growth curves, orphaned records — keep surprises away. Beware "attachment sprawl": Files often dominate storage. Policy (what belongs in Salesforce vs the document platform), plus automated cleanup for machine-generated files, routinely reclaims more storage than any record archival project.
- **On screen:** Animated explainer diagram for "Storage economics and hygiene": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Seven years of interaction history, one lean org**

- **Narration (word-for-word):** Here is why this matters in the real world. A bank's compliance mandate required seven years of customer-interaction history, but the interactions object was on course for 100M rows — threatening performance and a storage bill nobody had budgeted. What did they do? Interactions older than 12 months flow nightly into a Big Object keyed by customer + timestamp (compliance queries run there); a monthly summary record per customer keeps hot reporting fast; raw exports land in the data lake for analytics. External IDs anchor identity across all three tiers.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Seven years of interaction history, one lean org

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Declare system of record per entity AND attribute; anchor with external IDs. Tier data: records → Big Objects → external stores, by access pattern. Design retention/archival when designing the object, not after 50M rows. Audit file storage — it often dwarfs record storage.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Data strategy: golden records, archiving, and Big Objects — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: Integration & Identity Architecture

Patterns, layers, and trust: architecting how Salesforce talks to the enterprise and how users prove who they are.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 2.1 — Integration patterns and the middleware question

**Lesson ID:** `arch-integration-patterns` · **Reading time:** 20 min · **Video:** 5:00

> The canonical pattern catalog — request-reply, fire-and-forget, batch sync, remote call-in, data virtualization — and when middleware earns its keep.

**Learning objectives**

- Apply the canonical Salesforce integration patterns to requirements
- Decide between point-to-point and middleware-brokered integration
- Design for failure: queues, retries, idempotency, monitoring

#### Concept explanation

##### The pattern catalog

Salesforce's integration patterns document names the recurring shapes: Request & Reply (synchronous callout for an immediate answer), Fire & Forget (publish/queue and move on), Batch Data Synchronization (scheduled bulk movement), Remote Call-In (external systems calling Salesforce APIs), UI Update from data changes (streaming to the UI), and Data Virtualization (Salesforce Connect external objects — access without copying).

Architects speak in these names: "credit check is request-reply with a 3-second budget; order handoff is fire-and-forget via Platform Events; nightly product sync is batch". Naming the pattern surfaces the right questions — timeouts for request-reply, delivery guarantees for fire-and-forget, windows and deltas for batch.

##### Point-to-point vs middleware

Two systems, one interface? Point-to-point is honest and cheap. But each additional system multiplies connections: five systems fully meshed is ten interfaces, each with its own auth, mapping, and error handling. Middleware (MuleSoft, or event brokers like Kafka) centralizes transformation, routing, retry, and monitoring — and becomes the natural home of canonical data models.

The architect's judgment: middleware adds a platform to run and a team to staff. Adopt it when interface count, reuse ambitions, or non-Salesforce integration needs justify it — not because a diagram looks tidier with a bus in the middle.

##### Designing for the bad day

Every integration design review asks: what happens when the other side is down, slow, or returns garbage? Answers worth having: timeouts tuned below platform ceilings, retries with exponential backoff on transient failures only, dead-letter handling with human-visible alerting, idempotent receivers (dedupe keys), and correlation IDs flowing end-to-end for traceability.

Monitor the business outcome, not just HTTP codes: "orders created in ERP within 5 minutes of Closed Won ≥ 99.5%" is an integration SLO that pages someone before sales notices.

#### Real-world example — From spaghetti to an integration strategy

- **Scenario:** A retailer grew to 14 point-to-point interfaces around Salesforce — three teams, three auth styles, no shared monitoring. An ERP field rename silently broke two of them for a week.
- **Solution:** An architecture review classified each interface by pattern, moved the six batch syncs and four event flows onto middleware with a canonical customer/order model, kept two genuinely simple request-reply calls direct, and added correlation-ID logging with business SLO dashboards.
- **Outcome:** The next ERP change was absorbed by one mapping update in middleware. Integration incidents fell by half, and — culturally — new projects now start with "which pattern?" instead of "which endpoint?".

#### Key takeaways

- Name the pattern first; the pattern names the failure modes to design for
- Middleware is justified by interface count and reuse, not aesthetics
- Idempotency + retries + correlation IDs are table stakes
- Define business-level integration SLOs and monitor them

#### Go deeper

- [Integration Patterns and Practices (Salesforce)](https://developer.salesforce.com/docs/atlas.en-us.integration_patterns_and_practices.meta/integration_patterns_and_practices/integ_pat_intro_overview.htm) — The canonical pattern catalog
- [Salesforce Architects: Decision Guides](https://architect.salesforce.com/decision-guides)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Integration patterns and the middleware question matters | intro |
| 2 | 0:30–1:30 | The pattern catalog | concept |
| 3 | 1:30–2:30 | Point-to-point vs middleware | concept |
| 4 | 2:30–3:30 | Designing for the bad day | concept |
| 5 | 3:30–4:15 | Real story — From spaghetti to an integration strategy | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Integration patterns and the middleware question matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Integration patterns and the middleware question. The canonical pattern catalog — request-reply, fire-and-forget, batch sync, remote call-in, data virtualization — and when middleware earns its keep. By the end of this video you will be able to apply the canonical Salesforce integration patterns to requirements; decide between point-to-point and middleware-brokered integration; design for failure: queues, retries, idempotency, monitoring.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · Integration & Identity Architecture

**[0:30–1:30] The pattern catalog**

- **Narration (word-for-word):** Salesforce's integration patterns document names the recurring shapes: Request & Reply (synchronous callout for an immediate answer), Fire & Forget (publish/queue and move on), Batch Data Synchronization (scheduled bulk movement), Remote Call-In (external systems calling Salesforce APIs), UI Update from data changes (streaming to the UI), and Data Virtualization (Salesforce Connect external objects — access without copying). Architects speak in these names: "credit check is request-reply with a 3-second budget; order handoff is fire-and-forget via Platform Events; nightly product sync is batch". Naming the pattern surfaces the right questions — timeouts for request-reply, delivery guarantees for fire-and-forget, windows and deltas for batch.
- **On screen:** Animated explainer diagram for "The pattern catalog": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Point-to-point vs middleware**

- **Narration (word-for-word):** Two systems, one interface? Point-to-point is honest and cheap. But each additional system multiplies connections: five systems fully meshed is ten interfaces, each with its own auth, mapping, and error handling. Middleware (MuleSoft, or event brokers like Kafka) centralizes transformation, routing, retry, and monitoring — and becomes the natural home of canonical data models. The architect's judgment: middleware adds a platform to run and a team to staff. Adopt it when interface count, reuse ambitions, or non-Salesforce integration needs justify it — not because a diagram looks tidier with a bus in the middle.
- **On screen:** Animated explainer diagram for "Point-to-point vs middleware": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Designing for the bad day**

- **Narration (word-for-word):** Every integration design review asks: what happens when the other side is down, slow, or returns garbage? Answers worth having: timeouts tuned below platform ceilings, retries with exponential backoff on transient failures only, dead-letter handling with human-visible alerting, idempotent receivers (dedupe keys), and correlation IDs flowing end-to-end for traceability. Monitor the business outcome, not just HTTP codes: "orders created in ERP within 5 minutes of Closed Won ≥ 99.5%" is an integration SLO that pages someone before sales notices.
- **On screen:** Animated explainer diagram for "Designing for the bad day": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — From spaghetti to an integration strategy**

- **Narration (word-for-word):** Here is why this matters in the real world. A retailer grew to 14 point-to-point interfaces around Salesforce — three teams, three auth styles, no shared monitoring. An ERP field rename silently broke two of them for a week. What did they do? An architecture review classified each interface by pattern, moved the six batch syncs and four event flows onto middleware with a canonical customer/order model, kept two genuinely simple request-reply calls direct, and added correlation-ID logging with business SLO dashboards. And the payoff: The next ERP change was absorbed by one mapping update in middleware.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** From spaghetti to an integration strategy

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Name the pattern first; the pattern names the failure modes to design for. Middleware is justified by interface count and reuse, not aesthetics. Idempotency + retries + correlation IDs are table stakes. Define business-level integration SLOs and monitor them.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Integration patterns and the middleware question — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Identity architecture: SSO, OAuth, and provisioning

**Lesson ID:** `arch-identity` · **Reading time:** 20 min · **Video:** 5:00

> SAML vs OpenID Connect, Salesforce as SP or IdP, connected apps, and automated user lifecycle.

**Learning objectives**

- Design SSO with SAML or OpenID Connect, choosing SP vs IdP roles
- Match OAuth flows to application types
- Automate provisioning/deprovisioning with SCIM or JIT

#### Concept explanation

##### SSO: one identity, many systems

Enterprises centralize authentication in an identity provider (Entra ID/Azure AD, Okta, Ping). Salesforce typically acts as service provider: login redirects to the IdP (SAML or OpenID Connect), the IdP returns an assertion/token, Salesforce maps it to a user via Federation ID. Passwords never live in Salesforce; MFA and conditional access enforce centrally.

Salesforce can also BE the identity provider — common when Experience Cloud is the front door and downstream apps trust Salesforce identities. My Domain is a prerequisite for all of it.

##### OAuth flows by application shape

Connected apps define OAuth clients. Web apps with a backend → authorization code flow (with refresh tokens). Unattended server integrations → JWT bearer (certificate) or client credentials. Devices without browsers → device flow. SPAs/mobile → authorization code with PKCE. Username-password flow is legacy: disable it.

Scopes bound what a token may do; token and refresh policies bound for how long. High-assurance sessions can be demanded for sensitive operations. Review connected apps like firewall rules — annually, with an owner per app.

##### Lifecycle: provisioning and the leaver problem

Joiner/mover/leaver events should flow from the IdP: SCIM provisioning or JIT (just-in-time creation from SAML attributes) creates and updates users; deactivation MUST be automated — orphaned active accounts of departed employees are a top audit finding across the industry.

Map IdP groups to permission set groups so access follows role changes automatically. Log and alert on direct-login exceptions (integration users, break-glass admin accounts) — those bypass central policy and deserve scrutiny.

#### Real-world example — One badge, eleven systems

- **Scenario:** A manufacturer ran Salesforce logins on local passwords: 90-day resets generated helpdesk tickets, security couldn't enforce MFA consistently, and a leaver's Salesforce access survived their AD account by weeks.
- **Solution:** SAML SSO against Entra ID with Federation IDs, SCIM provisioning mapped AD groups → permission set groups, JWT-based connected apps for integrations with quarterly reviews, and break-glass local admin logins alerted to the SOC.
- **Outcome:** Password tickets disappeared, MFA and conditional access applied uniformly the day HR triggered a leaver event, and the following audit's identity section closed with zero findings — a first.

#### Key takeaways

- Salesforce as SAML/OIDC service provider is the enterprise default; My Domain first
- Pick OAuth flows by app shape; kill the username-password flow
- Automate leaver deactivation — orphaned accounts are the classic finding
- IdP groups → permission set groups keeps access aligned with roles

#### Go deeper

- [Identity Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/identity_basics)
- [Salesforce Help: Single Sign-On](https://help.salesforce.com/s/articleView?id=sf.sso_about.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Identity architecture: SSO, OAuth, and provisioning matters | intro |
| 2 | 0:30–1:30 | SSO: one identity, many systems | concept |
| 3 | 1:30–2:30 | OAuth flows by application shape | concept |
| 4 | 2:30–3:30 | Lifecycle: provisioning and the leaver problem | concept |
| 5 | 3:30–4:15 | Real story — One badge, eleven systems | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Identity architecture: SSO, OAuth, and provisioning matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Identity architecture: SSO, OAuth, and provisioning. SAML vs OpenID Connect, Salesforce as SP or IdP, connected apps, and automated user lifecycle. By the end of this video you will be able to design SSO with SAML or OpenID Connect, choosing SP vs IdP roles; match OAuth flows to application types; automate provisioning/deprovisioning with SCIM or JIT.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · Integration & Identity Architecture

**[0:30–1:30] SSO: one identity, many systems**

- **Narration (word-for-word):** Enterprises centralize authentication in an identity provider (Entra ID/Azure AD, Okta, Ping). Salesforce typically acts as service provider: login redirects to the IdP (SAML or OpenID Connect), the IdP returns an assertion/token, Salesforce maps it to a user via Federation ID. Passwords never live in Salesforce; MFA and conditional access enforce centrally. Salesforce can also BE the identity provider — common when Experience Cloud is the front door and downstream apps trust Salesforce identities. My Domain is a prerequisite for all of it.
- **On screen:** Animated explainer diagram for "SSO: one identity, many systems": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] OAuth flows by application shape**

- **Narration (word-for-word):** Connected apps define OAuth clients. Web apps with a backend → authorization code flow (with refresh tokens). Unattended server integrations → JWT bearer (certificate) or client credentials. Devices without browsers → device flow. SPAs/mobile → authorization code with PKCE. Username-password flow is legacy: disable it. Scopes bound what a token may do; token and refresh policies bound for how long. High-assurance sessions can be demanded for sensitive operations. Review connected apps like firewall rules — annually, with an owner per app.
- **On screen:** Animated explainer diagram for "OAuth flows by application shape": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Lifecycle: provisioning and the leaver problem**

- **Narration (word-for-word):** Joiner/mover/leaver events should flow from the IdP: SCIM provisioning or JIT (just-in-time creation from SAML attributes) creates and updates users; deactivation MUST be automated — orphaned active accounts of departed employees are a top audit finding across the industry. Map IdP groups to permission set groups so access follows role changes automatically. Log and alert on direct-login exceptions (integration users, break-glass admin accounts) — those bypass central policy and deserve scrutiny.
- **On screen:** Animated explainer diagram for "Lifecycle: provisioning and the leaver problem": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — One badge, eleven systems**

- **Narration (word-for-word):** Here is why this matters in the real world. A manufacturer ran Salesforce logins on local passwords: 90-day resets generated helpdesk tickets, security couldn't enforce MFA consistently, and a leaver's Salesforce access survived their AD account by weeks. What did they do? SAML SSO against Entra ID with Federation IDs, SCIM provisioning mapped AD groups → permission set groups, JWT-based connected apps for integrations with quarterly reviews, and break-glass local admin logins alerted to the SOC. And the payoff: Password tickets disappeared, MFA and conditional access applied uniformly the day HR triggered a leaver event, and the following audit's identity section closed with zero findings — a first.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** One badge, eleven systems

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Salesforce as SAML/OIDC service provider is the enterprise default; My Domain first. Pick OAuth flows by app shape; kill the username-password flow. Automate leaver deactivation — orphaned accounts are the classic finding. IdP groups → permission set groups keeps access aligned with roles.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Identity architecture: SSO, OAuth, and provisioning — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.3 — Well-Architected: trade-offs, decisions, and communication

**Lesson ID:** `arch-well-architected` · **Reading time:** 16 min · **Video:** 5:00

> The Salesforce Well-Architected framework, architecture decision records, and the architect's real job: making trade-offs explicit.

**Learning objectives**

- Use the Well-Architected pillars as a review checklist
- Write architecture decision records (ADRs) worth reading later
- Evaluate build-vs-buy-vs-configure honestly

#### Concept explanation

##### The framework as a shared language

Salesforce Well-Architected organizes quality into Trusted (security, compliance, reliability), Easy (intentional, automated where it should be, maintainable), and Adaptable (resilient to change, composable). Its value is less novelty than vocabulary: teams review designs against named qualities instead of taste.

Use it as a review lens: for each significant design, walk the pillars and record where you consciously trade one against another — "we accept lower composability here for delivery speed; revisit when volumes exceed X".

##### Decisions are the deliverable

An architecture decision record captures: context (forces at play), the decision, alternatives considered, and consequences. Five of these per quarter outlive any 60-page architecture document, because they answer the question future engineers actually ask: "why is it like this?"

Keep ADRs where engineers live (repo or wiki adjacent to code/config), number them, never rewrite history — supersede. The discipline forces clarity: a decision you cannot write down crisply is usually not yet made.

##### Build, buy, or configure

The platform gives three levers: configure (declarative), build (custom code), buy (AppExchange/ISV). Honest evaluation weighs total cost of ownership: configuration is cheap until it sprawls; custom code is powerful and permanent maintenance; packages ship features fast and couple you to a vendor's roadmap and pricing.

An architect's tie-breakers: Is this capability differentiating for the business (lean build) or commodity (lean buy)? Who maintains it in three years? What does exit look like? Answering those out loud, in an ADR, is the job.

#### Real-world example — The CPQ decision, documented

- **Scenario:** A scale-up needed quoting. Sales ops wanted a quick custom build ("just three discount rules!"), finance wanted a mature CPQ package, and the argument had circled for two quarters without resolution.
- **Solution:** The architect ran a Well-Architected-framed evaluation: modeled three-year TCO for both, prototyped the "three rules" (which turned out to be eleven), and wrote an ADR recommending the package with a thin custom layer — documenting the rejected build option and its trigger conditions for reconsideration.
- **Outcome:** The decision stuck because the reasoning was inspectable. A year later, when a new VP asked "why didn't we build this?", the ADR answered in five minutes — no relitigation, no archaeology.

#### Key takeaways

- Well-Architected pillars (Trusted, Easy, Adaptable) make quality reviewable
- Record decisions as ADRs: context, decision, alternatives, consequences
- Build for differentiators, buy commodities, configure the rest
- Trade-offs are inevitable; undocumented trade-offs are incidents in waiting

#### Go deeper

- [Salesforce Well-Architected](https://architect.salesforce.com/well-architected/overview)
- [Salesforce Architects site](https://architect.salesforce.com/)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Well-Architected: trade-offs, decisions, and communication matters | intro |
| 2 | 0:30–1:30 | The framework as a shared language | concept |
| 3 | 1:30–2:30 | Decisions are the deliverable | concept |
| 4 | 2:30–3:30 | Build, buy, or configure | concept |
| 5 | 3:30–4:15 | Real story — The CPQ decision, documented | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Well-Architected: trade-offs, decisions, and communication matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Well-Architected: trade-offs, decisions, and communication. The Salesforce Well-Architected framework, architecture decision records, and the architect's real job: making trade-offs explicit. By the end of this video you will be able to use the Well-Architected pillars as a review checklist; write architecture decision records (ADRs) worth reading later; evaluate build-vs-buy-vs-configure honestly.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · Integration & Identity Architecture

**[0:30–1:30] The framework as a shared language**

- **Narration (word-for-word):** Salesforce Well-Architected organizes quality into Trusted (security, compliance, reliability), Easy (intentional, automated where it should be, maintainable), and Adaptable (resilient to change, composable). Its value is less novelty than vocabulary: teams review designs against named qualities instead of taste. Use it as a review lens: for each significant design, walk the pillars and record where you consciously trade one against another — "we accept lower composability here for delivery speed; revisit when volumes exceed X".
- **On screen:** Animated explainer diagram for "The framework as a shared language": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Decisions are the deliverable**

- **Narration (word-for-word):** An architecture decision record captures: context (forces at play), the decision, alternatives considered, and consequences. Five of these per quarter outlive any 60-page architecture document, because they answer the question future engineers actually ask: "why is it like this?" Keep ADRs where engineers live (repo or wiki adjacent to code/config), number them, never rewrite history — supersede. The discipline forces clarity: a decision you cannot write down crisply is usually not yet made.
- **On screen:** Animated explainer diagram for "Decisions are the deliverable": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Build, buy, or configure**

- **Narration (word-for-word):** The platform gives three levers: configure (declarative), build (custom code), buy (AppExchange/ISV). Honest evaluation weighs total cost of ownership: configuration is cheap until it sprawls; custom code is powerful and permanent maintenance; packages ship features fast and couple you to a vendor's roadmap and pricing. An architect's tie-breakers: Is this capability differentiating for the business (lean build) or commodity (lean buy)? Who maintains it in three years? What does exit look like? Answering those out loud, in an ADR, is the job.
- **On screen:** Animated explainer diagram for "Build, buy, or configure": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The CPQ decision, documented**

- **Narration (word-for-word):** Here is why this matters in the real world. A scale-up needed quoting. Sales ops wanted a quick custom build ("just three discount rules!"), finance wanted a mature CPQ package, and the argument had circled for two quarters without resolution. What did they do? The architect ran a Well-Architected-framed evaluation: modeled three-year TCO for both, prototyped the "three rules" (which turned out to be eleven), and wrote an ADR recommending the package with a thin custom layer — documenting the rejected build option and its trigger conditions for reconsideration. And the payoff: The decision stuck because the reasoning was inspectable.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The CPQ decision, documented

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Well-Architected pillars (Trusted, Easy, Adaptable) make quality reviewable. Record decisions as ADRs: context, decision, alternatives, consequences. Build for differentiators, buy commodities, configure the rest. Trade-offs are inevitable; undocumented trade-offs are incidents in waiting.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Well-Architected: trade-offs, decisions, and communication — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: DevOps & Release Engineering

Source-driven development, scratch orgs and packaging, CI/CD pipelines, and the governance that makes speed safe.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 3.1 — Source-driven development with Salesforce DX

**Lesson ID:** `arch-sfdx` · **Reading time:** 18 min · **Video:** 5:00

> Git as the source of truth: project structure, the sf CLI, and leaving "the org is the truth" behind.

**Learning objectives**

- Structure a DX project and speak the sf CLI fluently
- Establish Git as source of truth over org-based truth
- Handle metadata's quirks in version control

#### Concept explanation

##### The inversion: repo over org

Traditional Salesforce treated production as the source of truth — you clicked, then dragged changes forward with change sets. Salesforce DX inverts this: a Git repository holds the metadata (source format, decomposed into per-field/per-object files), and orgs become deployment TARGETS built from source.

The payoff: history, code review, parallel branches, rollback points, and CI. The cost: discipline — every org change must land in the repo or it will be overwritten. That discipline is the cultural core of Salesforce DevOps.

##### Project anatomy and the CLI

sfdx-project.json defines package directories (force-app by convention); source lives decomposed so a picklist edit diffs as one small file. The sf CLI drives everything: sf project retrieve/deploy start, sf org create scratch, sf apex run test — the same commands locally and in CI, which is precisely what this DevOps platform orchestrates for you.

Under the hood, deploys and retrieves speak the Metadata API; source tracking on scratch orgs and dev sandboxes lets the CLI compute what changed on either side.

*The retrieve → validate → quick-deploy rhythm every pipeline automates.*

```bash
# retrieve current source from a sandbox
sf project retrieve start --target-org dev-sandbox

# validate (check-only) against UAT with tests
sf project deploy validate --target-org uat --test-level RunLocalTests

# deploy the validated package by job id (quick deploy)
sf project deploy quick --job-id <validateJobId> --target-org uat
```

##### Metadata in Git: the sharp edges

Metadata is XML, and some files (profiles!) are giant and touch-everything — most teams minimize profile metadata in the repo in favor of permission sets. Some components don't round-trip cleanly; .forceignore excludes what should not sync. Merge conflicts in XML demand conventions: small PRs, decomposed source, and formatting normalization.

Environment-specific values (endpoints, certificates) must not be hardcoded in metadata — use named credentials, custom metadata types, and post-deploy scripts instead. Treat these edges as known terrain, not surprises.

#### Real-world example — The org nobody could rebuild

- **Scenario:** A company's org embodied nine years of clicks. Nobody could say what changed last quarter, a deleted flow could not be restored, and onboarding a new admin took months of oral history.
- **Solution:** They adopted DX incrementally: retrieved the core metadata into Git, made the repo authoritative for changed components, required PRs for all promotions, and used this platform's pipelines so validation ran on every merge automatically.
- **Outcome:** Six months later a bad change was reverted in minutes (git revert + redeploy), quarterly audit questions were answered with git log, and the "what changed?" meeting simply stopped existing.

#### Key takeaways

- DX inverts truth: repo authoritative, orgs are targets
- Decomposed source format makes changes reviewable diffs
- Same sf CLI commands locally and in CI — automate the rhythm
- Respect the sharp edges: profiles, non-round-tripping metadata, env-specific values

#### Go deeper

- [App Development with Salesforce DX (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/sfdx_app_dev)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Source-driven development with Salesforce DX matters | intro |
| 2 | 0:30–1:15 | The inversion: repo over org | concept |
| 3 | 1:15–2:00 | Project anatomy and the CLI | concept |
| 4 | 2:00–2:45 | Code walk-through — Project anatomy and the CLI | demo |
| 5 | 2:45–3:30 | Metadata in Git: the sharp edges | concept |
| 6 | 3:30–4:15 | Real story — The org nobody could rebuild | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Source-driven development with Salesforce DX matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Source-driven development with Salesforce DX. Git as the source of truth: project structure, the sf CLI, and leaving "the org is the truth" behind. By the end of this video you will be able to structure a DX project and speak the sf CLI fluently; establish Git as source of truth over org-based truth; handle metadata's quirks in version control.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · DevOps & Release Engineering

**[0:30–1:15] The inversion: repo over org**

- **Narration (word-for-word):** Traditional Salesforce treated production as the source of truth — you clicked, then dragged changes forward with change sets. Salesforce DX inverts this: a Git repository holds the metadata (source format, decomposed into per-field/per-object files), and orgs become deployment TARGETS built from source. The payoff: history, code review, parallel branches, rollback points, and CI. The cost: discipline — every org change must land in the repo or it will be overwritten. That discipline is the cultural core of Salesforce DevOps.
- **On screen:** Animated explainer diagram for "The inversion: repo over org": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Project anatomy and the CLI**

- **Narration (word-for-word):** sfdx-project.json defines package directories (force-app by convention); source lives decomposed so a picklist edit diffs as one small file. The sf CLI drives everything: sf project retrieve/deploy start, sf org create scratch, sf apex run test — the same commands locally and in CI, which is precisely what this DevOps platform orchestrates for you. Under the hood, deploys and retrieves speak the Metadata API; source tracking on scratch orgs and dev sandboxes lets the CLI compute what changed on either side.
- **On screen:** Animated explainer diagram for "Project anatomy and the CLI": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Project anatomy and the CLI**

- **Narration (word-for-word):** Now watch the same idea in code. The retrieve → validate → quick-deploy rhythm every pipeline automates. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the bash snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: BASH

**[2:45–3:30] Metadata in Git: the sharp edges**

- **Narration (word-for-word):** Metadata is XML, and some files (profiles!) are giant and touch-everything — most teams minimize profile metadata in the repo in favor of permission sets. Some components don't round-trip cleanly; .forceignore excludes what should not sync. Merge conflicts in XML demand conventions: small PRs, decomposed source, and formatting normalization. Environment-specific values (endpoints, certificates) must not be hardcoded in metadata — use named credentials, custom metadata types, and post-deploy scripts instead. Treat these edges as known terrain, not surprises.
- **On screen:** Animated explainer diagram for "Metadata in Git: the sharp edges": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The org nobody could rebuild**

- **Narration (word-for-word):** Here is why this matters in the real world. A company's org embodied nine years of clicks. Nobody could say what changed last quarter, a deleted flow could not be restored, and onboarding a new admin took months of oral history. What did they do? They adopted DX incrementally: retrieved the core metadata into Git, made the repo authoritative for changed components, required PRs for all promotions, and used this platform's pipelines so validation ran on every merge automatically.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The org nobody could rebuild

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. DX inverts truth: repo authoritative, orgs are targets. Decomposed source format makes changes reviewable diffs. Same sf CLI commands locally and in CI — automate the rhythm. Respect the sharp edges: profiles, non-round-tripping metadata, env-specific values.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Source-driven development with Salesforce DX — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — Scratch orgs, org shape, and unlocked packages

**Lesson ID:** `arch-scratch-packaging` · **Reading time:** 18 min · **Video:** 5:00

> Ephemeral environments per feature, and packaging as the unit of modular delivery.

**Learning objectives**

- Design scratch org definitions and seed data for realistic dev environments
- Understand org shape and snapshot options
- Modularize metadata into unlocked packages with dependencies

#### Concept explanation

##### Scratch orgs: environments as cattle

A scratch org spins up in minutes from a definition file (edition, features, settings) and expires within days — every feature branch gets a pristine, isolated org. push source, load seed data, develop, run tests, destroy. No more "who broke the shared dev sandbox?".

Realism requires setup: enable the org features production uses, seed representative data (this platform's data-seeding pipelines exist for exactly this), and script the whole provisioning so a new environment is one command or one pipeline run. Org shape can mirror production's features/limits for higher fidelity.

##### Unlocked packages: modular metadata

An unlocked package is a versioned, installable unit of metadata with declared dependencies — your org's architecture expressed as modules: core-model, service-layer, sales-app, integrations. Version numbers, release notes, and installation give you what change sets never could: an inventory of WHAT is deployed WHERE.

Dependency discipline is the hard part: shared objects/fields go in base packages, apps depend on base, circular dependencies are refactoring homework you cannot skip. "Happy soup" (everything unpackaged) to packages is a journey — most enterprises modularize the new and strangle the old gradually.

##### When to package, when not to

Packaging shines for platform teams shipping shared capability across orgs/business units, ISV-style reuse, and enforcing modular boundaries. It adds ceremony: package versions to build, ancestry to manage (for 2GP), and installation orchestration.

A pragmatic middle exists: source-driven org deployments (no packages) with clean folder modularity, graduating hot spots into packages when reuse or boundary enforcement demands it. Choose per-module, not ideologically.

#### Real-world example — Two teams, one org, zero collisions

- **Scenario:** Sales-engineering and service-engineering teams shared one developer sandbox. Deployments overwrote each other weekly; a corrupted shared class once blocked both teams for two days.
- **Solution:** Each feature branch now provisions a scratch org with seeded data via pipeline. Shared metadata moved into a base unlocked package owned jointly; each team ships its own app package depending on base, with contract changes to base requiring cross-team review.
- **Outcome:** Collisions ended immediately. Release notes per package version replaced tribal deployment memory, and time-to-first-commit for new developers dropped from a week of environment setup to under an hour.

#### Key takeaways

- Scratch orgs make environments disposable and per-feature — script their setup completely
- Unlocked packages version metadata and declare dependencies explicitly
- Base/shared packages + app packages; break circular dependencies early
- Package where boundaries pay; source-deploy the rest — pragmatism over ideology

#### Go deeper

- [Unlocked Packages for Customers (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/unlocked-packages-for-customers)
- [Scratch Orgs (Salesforce DX Guide)](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Scratch orgs, org shape, and unlocked packages matters | intro |
| 2 | 0:30–1:30 | Scratch orgs: environments as cattle | demo |
| 3 | 1:30–2:30 | Unlocked packages: modular metadata | concept |
| 4 | 2:30–3:30 | When to package, when not to | concept |
| 5 | 3:30–4:15 | Real story — Two teams, one org, zero collisions | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Scratch orgs, org shape, and unlocked packages matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Scratch orgs, org shape, and unlocked packages. Ephemeral environments per feature, and packaging as the unit of modular delivery. By the end of this video you will be able to design scratch org definitions and seed data for realistic dev environments; understand org shape and snapshot options; modularize metadata into unlocked packages with dependencies.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · DevOps & Release Engineering

**[0:30–1:30] Scratch orgs: environments as cattle**

- **Narration (word-for-word):** Let's actually do this together. A scratch org spins up in minutes from a definition file (edition, features, settings) and expires within days — every feature branch gets a pristine, isolated org. push source, load seed data, develop, run tests, destroy. No more "who broke the shared dev sandbox?". Realism requires setup: enable the org features production uses, seed representative data (this platform's data-seeding pipelines exist for exactly this), and script the whole provisioning so a new environment is one command or one pipeline run. Org shape can mirror production's features/limits for higher fidelity.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. A scratch org spins up in minutes from a definition file (edition, features, settings) and expires within days — every feature branch gets a pristine, isolated org.
  2. push source, load seed data, develop, run tests, destroy.

**[1:30–2:30] Unlocked packages: modular metadata**

- **Narration (word-for-word):** An unlocked package is a versioned, installable unit of metadata with declared dependencies — your org's architecture expressed as modules: core-model, service-layer, sales-app, integrations. Version numbers, release notes, and installation give you what change sets never could: an inventory of WHAT is deployed WHERE. Dependency discipline is the hard part: shared objects/fields go in base packages, apps depend on base, circular dependencies are refactoring homework you cannot skip. "Happy soup" (everything unpackaged) to packages is a journey — most enterprises modularize the new and strangle the old gradually.
- **On screen:** Animated explainer diagram for "Unlocked packages: modular metadata": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] When to package, when not to**

- **Narration (word-for-word):** Packaging shines for platform teams shipping shared capability across orgs/business units, ISV-style reuse, and enforcing modular boundaries. It adds ceremony: package versions to build, ancestry to manage (for 2GP), and installation orchestration. A pragmatic middle exists: source-driven org deployments (no packages) with clean folder modularity, graduating hot spots into packages when reuse or boundary enforcement demands it. Choose per-module, not ideologically.
- **On screen:** Animated explainer diagram for "When to package, when not to": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Two teams, one org, zero collisions**

- **Narration (word-for-word):** Here is why this matters in the real world. Sales-engineering and service-engineering teams shared one developer sandbox. Deployments overwrote each other weekly; a corrupted shared class once blocked both teams for two days. What did they do? Each feature branch now provisions a scratch org with seeded data via pipeline. Shared metadata moved into a base unlocked package owned jointly; each team ships its own app package depending on base, with contract changes to base requiring cross-team review. And the payoff: Collisions ended immediately. Release notes per package version replaced tribal deployment memory, and time-to-first-commit for new developers dropped from a week of environment setup to under an hour.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Two teams, one org, zero collisions

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Scratch orgs make environments disposable and per-feature — script their setup completely. Unlocked packages version metadata and declare dependencies explicitly. Base/shared packages + app packages; break circular dependencies early. Package where boundaries pay; source-deploy the rest — pragmatism over ideology.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Scratch orgs, org shape, and unlocked packages — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.3 — CI/CD pipelines for Salesforce

**Lesson ID:** `arch-cicd` · **Reading time:** 20 min · **Video:** 5:00

> From commit to production: validation gates, delta deployments, test strategy, and rollback thinking.

**Learning objectives**

- Design a branch → validate → promote pipeline across environments
- Choose test levels and quality gates per stage
- Plan rollback and hotfix lanes before you need them

#### Concept explanation

##### The pipeline spine

A canonical Salesforce pipeline: feature branch → PR triggers static analysis (Code Analyzer/PMD, ESLint for LWC) + delta validation against an integration org → merge to main → automated deploy to QA with test execution → promotion to UAT with validation-only + manual approval → production deploy in a window, quick-deploy from a pre-validated job where possible.

Delta deployments (deploy only changed components) keep cycles fast; full validations still run nightly to catch drift. Every gate that can be automated should be — human attention is reserved for the judgment calls. This platform's deployment workbench implements exactly this spine.

##### Test strategy per stage

PR validation: RunLocalTests is thorough but slow for big orgs — running impacted test classes (computed from the delta) keeps feedback tight, with full local tests at the nightly gate. UAT/production: RunLocalTests, non-negotiable. LWC gets Jest at PR time; integration-level UI checks live in a small smoke suite, not a thousand brittle end-to-end scripts.

Quality gates beyond tests: coverage thresholds (per-class, not just org aggregate), static-analysis severity budgets, and deployment-risk review for destructive changes. Fail fast, fail in the PR, never fail at 6 pm on release day.

##### Rollback is a design requirement

Salesforce has no one-click rollback: deployed metadata stays deployed. Real strategies: git revert + redeploy (fast for code/config), pre-release org backups of impacted metadata, feature flags (custom permissions / custom metadata switches) so risky behavior can be disabled without deployment, and destructive-change staging separated from additive deploys.

Hotfix lane: a short-lived branch from the production tag, minimal fix, expedited validation, deploy, then merge back to main — documented and rehearsed BEFORE the incident, because 2 am is a bad time to invent process.

#### Real-world example — Release day, demoted to routine

- **Scenario:** Releases were monthly, manual, and heroic: a change-set assembly weekend, a six-hour deployment call, and a 30% rollback-something rate. Teams padded estimates with "release risk" as a line item.
- **Solution:** The org adopted a pipeline: PR validation with impacted tests + static analysis, auto-deploy to QA, validated promotion to UAT, pre-validated quick-deploys to production twice a week, feature flags for risky changes, and a rehearsed hotfix lane.
- **Outcome:** Deployment frequency went from 12/year to ~100/year while failed-change rate FELL. Release day stopped being an event; the six-hour call became a fifteen-minute quick-deploy — and "release risk" vanished from estimates.

#### Key takeaways

- Pipeline spine: PR validation → QA auto-deploy → UAT approval → prod quick-deploy
- Impacted tests for speed at PR; full local tests nightly and at promotion
- Rollback = revert+redeploy, backups, and feature flags — planned in advance
- Rehearse the hotfix lane before the incident

#### Go deeper

- [Application Lifecycle and Development Models (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models)
- [Salesforce Code Analyzer](https://developer.salesforce.com/tools/vscode/en/user-guide/code-analyzer)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why CI/CD pipelines for Salesforce matters | intro |
| 2 | 0:30–1:30 | The pipeline spine | concept |
| 3 | 1:30–2:30 | Test strategy per stage | concept |
| 4 | 2:30–3:30 | Rollback is a design requirement | concept |
| 5 | 3:30–4:15 | Real story — Release day, demoted to routine | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why CI/CD pipelines for Salesforce matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on CI/CD pipelines for Salesforce. From commit to production: validation gates, delta deployments, test strategy, and rollback thinking. By the end of this video you will be able to design a branch → validate → promote pipeline across environments; choose test levels and quality gates per stage; plan rollback and hotfix lanes before you need them.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · DevOps & Release Engineering

**[0:30–1:30] The pipeline spine**

- **Narration (word-for-word):** A canonical Salesforce pipeline: feature branch → PR triggers static analysis (Code Analyzer/PMD, ESLint for LWC) + delta validation against an integration org → merge to main → automated deploy to QA with test execution → promotion to UAT with validation-only + manual approval → production deploy in a window, quick-deploy from a pre-validated job where possible. Delta deployments (deploy only changed components) keep cycles fast; full validations still run nightly to catch drift. Every gate that can be automated should be — human attention is reserved for the judgment calls. This platform's deployment workbench implements exactly this spine.
- **On screen:** Animated explainer diagram for "The pipeline spine": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Test strategy per stage**

- **Narration (word-for-word):** PR validation: RunLocalTests is thorough but slow for big orgs — running impacted test classes (computed from the delta) keeps feedback tight, with full local tests at the nightly gate. UAT/production: RunLocalTests, non-negotiable. LWC gets Jest at PR time; integration-level UI checks live in a small smoke suite, not a thousand brittle end-to-end scripts. Quality gates beyond tests: coverage thresholds (per-class, not just org aggregate), static-analysis severity budgets, and deployment-risk review for destructive changes. Fail fast, fail in the PR, never fail at 6 pm on release day.
- **On screen:** Animated explainer diagram for "Test strategy per stage": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Rollback is a design requirement**

- **Narration (word-for-word):** Salesforce has no one-click rollback: deployed metadata stays deployed. Real strategies: git revert + redeploy (fast for code/config), pre-release org backups of impacted metadata, feature flags (custom permissions / custom metadata switches) so risky behavior can be disabled without deployment, and destructive-change staging separated from additive deploys. Hotfix lane: a short-lived branch from the production tag, minimal fix, expedited validation, deploy, then merge back to main — documented and rehearsed BEFORE the incident, because 2 am is a bad time to invent process.
- **On screen:** Animated explainer diagram for "Rollback is a design requirement": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Release day, demoted to routine**

- **Narration (word-for-word):** Here is why this matters in the real world. Releases were monthly, manual, and heroic: a change-set assembly weekend, a six-hour deployment call, and a 30% rollback-something rate. Teams padded estimates with "release risk" as a line item. What did they do? The org adopted a pipeline: PR validation with impacted tests + static analysis, auto-deploy to QA, validated promotion to UAT, pre-validated quick-deploys to production twice a week, feature flags for risky changes, and a rehearsed hotfix lane. And the payoff: Deployment frequency went from 12/year to ~100/year while failed-change rate FELL.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Release day, demoted to routine

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Pipeline spine: PR validation → QA auto-deploy → UAT approval → prod quick-deploy. Impacted tests for speed at PR; full local tests nightly and at promotion. Rollback = revert+redeploy, backups, and feature flags — planned in advance. Rehearse the hotfix lane before the incident.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is CI/CD pipelines for Salesforce — the idea, the practice, and the real-world payoff. Head back to the DevOps & Release Engineering module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.4 — Environment strategy, governance, and the CoE

**Lesson ID:** `arch-governance` · **Reading time:** 16 min · **Video:** 5:00

> Multi-org strategy, release governance that enables rather than blocks, and running a Center of Excellence.

**Learning objectives**

- Reason about single-org vs multi-org trade-offs
- Design lightweight release governance and technical-debt management
- Structure a Center of Excellence that accelerates teams

#### Concept explanation

##### Single org or many?

Single org maximizes shared data (one customer view), shared automation, and simpler integration — at the cost of coordination overhead, limits contention, and blast radius. Multi-org isolates business units and regulatory domains (data residency!) at the cost of duplicated build, cross-org integration, and fractured customer views.

There is no universally right answer, only explicit trade-offs: most enterprises converge on "as few orgs as possible, as many as necessary", with org boundaries drawn along data-sharing needs and regulatory lines — and the decision documented as an ADR reviewed when the business changes.

##### Governance that enables

Governance fails in two directions: absent (ten teams deploying into one org unaware of each other) or suffocating (a monthly CAB queue for a help-text change). The working middle: risk-tiered change classes — low-risk changes flow through the automated pipeline with peer review only; higher-risk classes (security model, shared objects, integrations) add architecture review.

Manage technical debt visibly: a debt register with owners and a fixed capacity allocation (say 15% of each sprint). Debt you cannot see compounds; debt on a board with a budget shrinks.

##### The Center of Excellence

A Salesforce CoE concentrates scarce expertise: platform architecture, design standards, shared components, environment/release management, and enablement. The failure mode is becoming a bottleneck-shaped ivory tower; the success mode is a platform team serving product teams — paved roads, not toll gates.

Concretely: publish standards with examples, maintain the pipeline and shared packages as products, review by exception (only the risk tiers that need it), and measure yourselves on the product teams' delivery speed and incident rate — the CoE succeeds when others ship faster, safely. Training programs (like this academy) are a CoE deliverable too: capability scales better than review capacity.

#### Real-world example — From CAB queue to paved road

- **Scenario:** Every change — including field help text — waited for a monthly change advisory board. Teams smuggled work through "emergency" lanes, which meant the risky changes got LESS scrutiny than the trivial ones.
- **Solution:** A new CoE introduced risk tiers: tier-1 (declarative, non-shared) auto-flowed through the pipeline with peer review; tier-2 added async architecture review in 48h SLA; tier-3 (security model, shared core, integrations) got a design session. The CAB dissolved into the tier-3 review.
- **Outcome:** Median change lead time dropped from 34 days to 4, emergency-lane abuse ended because the normal lane was faster, and audit satisfaction IMPROVED — every change now had pipeline evidence attached automatically.

#### Key takeaways

- "As few orgs as possible, as many as necessary" — decide on data & regulatory lines
- Risk-tiered governance: automate the low tiers, review the high ones
- Make technical debt visible with a register and a capacity budget
- A CoE is a platform team: paved roads and enablement, not toll gates

#### Go deeper

- [Salesforce Well-Architected](https://architect.salesforce.com/well-architected/overview)
- [Salesforce Architects: Decision Guides](https://architect.salesforce.com/decision-guides)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Environment strategy, governance, and the CoE matters | intro |
| 2 | 0:30–1:30 | Single org or many? | concept |
| 3 | 1:30–2:30 | Governance that enables | concept |
| 4 | 2:30–3:30 | The Center of Excellence | concept |
| 5 | 3:30–4:15 | Real story — From CAB queue to paved road | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Environment strategy, governance, and the CoE matters**

- **Narration (word-for-word):** Welcome to Architect & DevOps Mastery, and this five-minute session on Environment strategy, governance, and the CoE. Multi-org strategy, release governance that enables rather than blocks, and running a Center of Excellence. By the end of this video you will be able to reason about single-org vs multi-org trade-offs; design lightweight release governance and technical-debt management; structure a Center of Excellence that accelerates teams.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Architect & DevOps Mastery · DevOps & Release Engineering

**[0:30–1:30] Single org or many?**

- **Narration (word-for-word):** Single org maximizes shared data (one customer view), shared automation, and simpler integration — at the cost of coordination overhead, limits contention, and blast radius. Multi-org isolates business units and regulatory domains (data residency!) at the cost of duplicated build, cross-org integration, and fractured customer views. There is no universally right answer, only explicit trade-offs: most enterprises converge on "as few orgs as possible, as many as necessary", with org boundaries drawn along data-sharing needs and regulatory lines — and the decision documented as an ADR reviewed when the business changes.
- **On screen:** Animated explainer diagram for "Single org or many?": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Governance that enables**

- **Narration (word-for-word):** Governance fails in two directions: absent (ten teams deploying into one org unaware of each other) or suffocating (a monthly CAB queue for a help-text change). The working middle: risk-tiered change classes — low-risk changes flow through the automated pipeline with peer review only; higher-risk classes (security model, shared objects, integrations) add architecture review. Manage technical debt visibly: a debt register with owners and a fixed capacity allocation (say 15% of each sprint). Debt you cannot see compounds; debt on a board with a budget shrinks.
- **On screen:** Animated explainer diagram for "Governance that enables": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] The Center of Excellence**

- **Narration (word-for-word):** A Salesforce CoE concentrates scarce expertise: platform architecture, design standards, shared components, environment/release management, and enablement. The failure mode is becoming a bottleneck-shaped ivory tower; the success mode is a platform team serving product teams — paved roads, not toll gates. Concretely: publish standards with examples, maintain the pipeline and shared packages as products, review by exception (only the risk tiers that need it), and measure yourselves on the product teams' delivery speed and incident rate — the CoE succeeds when others ship faster, safely. Training programs (like this academy) are a CoE deliverable too: capability scales better than review capacity.
- **On screen:** Animated explainer diagram for "The Center of Excellence": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — From CAB queue to paved road**

- **Narration (word-for-word):** Here is why this matters in the real world. Every change — including field help text — waited for a monthly change advisory board. Teams smuggled work through "emergency" lanes, which meant the risky changes got LESS scrutiny than the trivial ones. What did they do? A new CoE introduced risk tiers: tier-1 (declarative, non-shared) auto-flowed through the pipeline with peer review; tier-2 added async architecture review in 48h SLA; tier-3 (security model, shared core, integrations) got a design session. The CAB dissolved into the tier-3 review.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** From CAB queue to paved road

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. "As few orgs as possible, as many as necessary" — decide on data & regulatory lines. Risk-tiered governance: automate the low tiers, review the high ones. Make technical debt visible with a register and a capacity budget. A CoE is a platform team: paved roads and enablement, not toll gates.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Environment strategy, governance, and the CoE — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
