# Modern Salesforce Platform — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Intermediate · **Category:** Salesforce core curriculum · **Badge:** Modern Platform Practitioner · **Modules:** 3 · **Lessons:** 6 · **Estimated effort:** ~9h

Build a current, product-spanning view of Salesforce. Learn to select and connect Sales, Service, and Experience Cloud; deliver scalable journeys with OmniStudio; turn source data into governed Data Cloud activation; modernize automation with Flow; and design Agentforce solutions whose actions, handoffs, security, and telemetry are production-ready.

**Skills:** Customer 360 solution design · Sales, Service & Experience Cloud · OmniStudio · Data Cloud · Flow Orchestration · Dynamic Forms & Actions · Agentforce & Einstein · Trusted AI operations

## Contents

- **Module 1: Customer 360 & Scalable Digital Experiences**
  - Lesson 1.1: Sales, Service, Experience Cloud & Customer 360
  - Lesson 1.2: OmniStudio for scalable guided experiences
- **Module 2: Data Cloud & Modern Automation**
  - Lesson 2.1: Data Cloud: ingest, harmonize, resolve, segment, activate
  - Lesson 2.2: Flow Orchestration, modern Flow & dynamic experiences
- **Module 3: Agentforce, Einstein & Trusted Operations**
  - Lesson 3.1: Agentforce & Einstein: grounded reasoning and safe action
  - Lesson 3.2: Trusted AI: security, evaluation & observability

## Module 1: Customer 360 & Scalable Digital Experiences

Select the right CRM products for a measurable outcome, then compose secure, maintainable customer and employee journeys with Experience Cloud and OmniStudio.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 8 questions.*

### Lesson 1.1 — Sales, Service, Experience Cloud & Customer 360

**Lesson ID:** `modern-customer-360-cloud-strategy` · **Reading time:** 32 min · **Video:** 5:00

> Turn business outcomes into a coherent product architecture instead of treating every Salesforce cloud as an interchangeable feature bundle.

**Learning objectives**

- Map Sales, Service, and Experience Cloud capabilities to distinct jobs and user groups
- Explain Customer 360 as an architectural outcome built from governed data and connected processes
- Create an evidence-based product selection and integration decision record
- Identify the identity, sharing, licensing, and operating-model questions behind an external experience

#### Concept explanation

##### Start with the job, not the cloud name

Sales Cloud supports the revenue lifecycle: leads, accounts, contacts, opportunities, activities, forecasting, and sales productivity. Service Cloud supports the service lifecycle: cases, knowledge, entitlements, routing, channels, and agent work. Experience Cloud publishes authenticated or public digital experiences for customers, partners, and other external audiences while reusing Salesforce data and processes.

These products complement one another, but they do not erase product boundaries. A partner deal-registration portal commonly combines Sales Cloud opportunity data with Experience Cloud identity and pages. A self-service support site combines Service Cloud cases and knowledge with Experience Cloud. Choose the product that owns the core job, then add channels and shared capabilities deliberately. Product names, packaging, and entitlements evolve, so validate the current contract and official documentation rather than encoding a release-specific feature matrix.

##### Customer 360 is a governed architecture

A 360-degree customer view is not created by purchasing a product with “360” in its name. It requires stable customer identifiers, declared systems of record, a shared vocabulary, integration contracts, consent rules, and processes that keep the view useful. Core CRM can be the operational home for accounts, opportunities, and cases; Data Cloud can harmonize and resolve profiles from many sources; MuleSoft or APIs can connect systems that remain authoritative elsewhere.

Separate three meanings of “single source of truth”: one system may author an attribute, another may assemble the best current profile, and several applications may consume it. Document ownership at the attribute level. For example, ERP can author credit status, Service Cloud can author case history, and Data Cloud can assemble an activation profile without silently making CRM the master of every field.

##### Use a capability and value decision record

For each candidate product, trace business outcome → persona → moment of work → required capability → authoritative data → integration → security → measurable KPI. Include nonfunctional needs such as volume, latency, availability, accessibility, localization, retention, and support ownership. Then compare native configuration, extension, integration, and custom-build options.

A good decision record also states what will not be implemented. This limits duplicate portals, overlapping automation, and licenses bought “just in case.” Prototype the riskiest assumption—often external-user sharing, identity, or a cross-system transaction—before finalizing scope.

*A deployment-neutral architecture decision record that connects outcomes to products, data ownership, and access.*

```yaml
decision: Partner deal registration
outcomes:
  - reduce duplicate deal reviews
personas:
  partner_seller: Experience Cloud external user
  channel_manager: Sales Cloud internal user
capabilities:
  submit_deal: Experience Cloud form
  qualify_and_forecast: Sales Cloud opportunity
  notify_status: Flow
systems_of_record:
  partner_identity: corporate_identity_provider
  opportunity: salesforce_crm
security:
  record_access: partner-account-scoped
  sensitive_fields: internal-only
measures:
  - median_review_time
  - duplicate_submission_rate
out_of_scope:
  - partner_order_management
```

##### Design the external boundary before the page

Experience Cloud adds an external security and identity boundary. Decide who can self-register, how identities are verified and linked to accounts, which external license model fits the access pattern, and whether records are exposed through sharing sets, share groups, sharing rules, or another supported mechanism. External org-wide defaults should begin restrictive; guest access deserves an even smaller, explicitly reviewed surface.

Page visibility and audience targeting personalize presentation, but they are not authorization. Object permissions, field-level security, record sharing, Apex enforcement, and integration credentials protect data. Also define content ownership, moderation, accessibility, analytics, incident response, and deprovisioning. A portal is a product with an operating model, not merely a published template.

#### Real-world example — One front door for a medical-equipment partner network

- **Scenario:** A manufacturer had account teams tracking partner deals in Sales Cloud, support teams handling equipment cases in email, and distributors submitting requests through three disconnected forms. Leadership proposed buying every available cloud before agreeing on the target process.
- **Solution:** The team mapped outcomes first. Sales Cloud remained the system for partner accounts and opportunities; Service Cloud became the case and knowledge workspace; Experience Cloud provided authenticated deal registration and support. Partner-account sharing was proven in a prototype, ERP retained order authority through an API, and Data Cloud was deferred until multi-source profile activation had a funded use case.
- **Outcome:** Partners received one secure entry point, duplicate deal submissions fell, support gained complete case context, and the company avoided licensing and implementing capabilities that had no measurable first-phase outcome.

#### Key takeaways

- Sales Cloud owns revenue work, Service Cloud owns service work, and Experience Cloud exposes selected processes to external audiences
- Customer 360 requires identity, data ownership, integration, consent, and governance—not a product checkbox
- Select products by measurable jobs and nonfunctional requirements, then document exclusions
- Attribute authorship and assembled-profile ownership can belong to different systems
- Audience targeting changes presentation; permissions and sharing enforce authorization

#### Go deeper

- [Salesforce End-to-End Front Office](https://trailhead.salesforce.com/content/learn/modules/salesforce-end-to-end-front-office/get-to-know-the-salesforce-e2e-front-office) — Official overview of connected Customer 360 capabilities
- [Service Cloud Platform Quick Look](https://trailhead.salesforce.com/content/learn/modules/service-cloud-platform-quick-look/get-to-know-the-service-cloud-platform)
- [Expand Your Reach with Experience Cloud](https://trailhead.salesforce.com/content/learn/trails/communities) — Official trail covering external experiences and secure CRM data sharing

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Sales, Service, Experience Cloud & Customer 360 matters | intro |
| 2 | 0:30–1:06 | Start with the job, not the cloud name | demo |
| 3 | 1:06–1:42 | Customer 360 is a governed architecture | concept |
| 4 | 1:42–2:18 | Use a capability and value decision record | concept |
| 5 | 2:18–2:54 | Code walk-through — Use a capability and value decision record | demo |
| 6 | 2:54–3:30 | Design the external boundary before the page | concept |
| 7 | 3:30–4:15 | Real story — One front door for a medical-equipment partner network | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Sales, Service, Experience Cloud & Customer 360 matters**

- **Narration (word-for-word):** Welcome to Modern Salesforce Platform, and this five-minute session on Sales, Service, Experience Cloud & Customer 360. Turn business outcomes into a coherent product architecture instead of treating every Salesforce cloud as an interchangeable feature bundle.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Modern Salesforce Platform · Customer 360 & Scalable Digital Experiences

**[0:30–1:06] Start with the job, not the cloud name**

- **Narration (word-for-word):** Let's actually do this together. Sales Cloud supports the revenue lifecycle: leads, accounts, contacts, opportunities, activities, forecasting, and sales productivity. Service Cloud supports the service lifecycle: cases, knowledge, entitlements, routing, channels, and agent work. Experience Cloud publishes authenticated or public digital experiences for customers, partners, and other external audiences while reusing Salesforce data and processes. These products complement one another, but they do not erase product boundaries. A partner deal-registration portal commonly combines Sales Cloud opportunity data with Experience Cloud identity and pages.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Choose the product that owns the core job, then add channels and shared capabilities deliberately.
  2. Product names, packaging, and entitlements evolve, so validate the current contract and official documentation rather than encoding a release-specific feature matrix.

**[1:06–1:42] Customer 360 is a governed architecture**

- **Narration (word-for-word):** A 360-degree customer view is not created by purchasing a product with “360” in its name. It requires stable customer identifiers, declared systems of record, a shared vocabulary, integration contracts, consent rules, and processes that keep the view useful. Core CRM can be the operational home for accounts, opportunities, and cases; Data Cloud can harmonize and resolve profiles from many sources; MuleSoft or APIs can connect systems that remain authoritative elsewhere.
- **On screen:** Animated explainer diagram for "Customer 360 is a governed architecture": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Use a capability and value decision record**

- **Narration (word-for-word):** For each candidate product, trace business outcome → persona → moment of work → required capability → authoritative data → integration → security → measurable KPI. Include nonfunctional needs such as volume, latency, availability, accessibility, localization, retention, and support ownership. Then compare native configuration, extension, integration, and custom-build options. A good decision record also states what will not be implemented. This limits duplicate portals, overlapping automation, and licenses bought “just in case.” Prototype the riskiest assumption—often external-user sharing, identity, or a cross-system transaction—before finalizing scope.
- **On screen:** Animated explainer diagram for "Use a capability and value decision record": the key entities appear and connect exactly as the narration names them.

**[2:18–2:54] Code walk-through — Use a capability and value decision record**

- **Narration (word-for-word):** Now watch the same idea in code. A deployment-neutral architecture decision record that connects outcomes to products, data ownership, and access. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the yaml snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: YAML

**[2:54–3:30] Design the external boundary before the page**

- **Narration (word-for-word):** Experience Cloud adds an external security and identity boundary. Decide who can self-register, how identities are verified and linked to accounts, which external license model fits the access pattern, and whether records are exposed through sharing sets, share groups, sharing rules, or another supported mechanism. External org-wide defaults should begin restrictive; guest access deserves an even smaller, explicitly reviewed surface. Page visibility and audience targeting personalize presentation, but they are not authorization. Object permissions, field-level security, record sharing, Apex enforcement, and integration credentials protect data.
- **On screen:** Animated explainer diagram for "Design the external boundary before the page": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — One front door for a medical-equipment partner network**

- **Narration (word-for-word):** Here is why this matters in the real world. A manufacturer had account teams tracking partner deals in Sales Cloud, support teams handling equipment cases in email, and distributors submitting requests through three disconnected forms. Leadership proposed buying every available cloud before agreeing on the target process. What did they do? The team mapped outcomes first. Sales Cloud remained the system for partner accounts and opportunities; Service Cloud became the case and knowledge workspace; Experience Cloud provided authenticated deal registration and support.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** One front door for a medical-equipment partner network

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Sales Cloud owns revenue work, Service Cloud owns service work, and Experience Cloud exposes selected processes to external audiences. Customer 360 requires identity, data ownership, integration, consent, and governance—not a product checkbox. Select products by measurable jobs and nonfunctional requirements, then document exclusions. Attribute authorship and assembled-profile ownership can belong to different systems. Audience targeting changes presentation; permissions and sharing enforce authorization.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Sales, Service, Experience Cloud & Customer 360 — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — OmniStudio for scalable guided experiences

**Lesson ID:** `modern-omnistudio-digital-experiences` · **Reading time:** 34 min · **Video:** 5:00

> Compose guided interactions from focused UI, data-mapping, and orchestration components, with explicit contracts and performance budgets.

**Learning objectives**

- Assign clear responsibilities to OmniScripts, FlexCards, Data Mappers, and Integration Procedures
- Design a layered digital experience that can span Salesforce and external data
- Apply payload, transaction, caching, error, and security patterns for scale
- Plan reusable components, tests, observability, and source-driven promotion

#### Concept explanation

##### Four components, four responsibilities

An OmniScript is a guided, multi-step interaction: collect inputs, branch, validate, and invoke work. A FlexCard presents contextual data and actions in a compact, reusable UI. A Data Mapper reads, transforms, or writes Salesforce data through declared mappings. An Integration Procedure orchestrates server-side work across Data Mappers, APIs, and Apex and returns a response shaped for its consumer.

Keep these boundaries crisp. The UI should not know five backend schemas; an Integration Procedure should return a purpose-built contract. A Data Mapper should map data, not become an undocumented business-policy engine. Reusable OmniScripts and FlexCards should receive explicit inputs instead of depending on hidden page state.

##### Build a contract-first experience stack

Start with the smallest input and output contract for each user moment. A FlexCard can show policy status and launch an OmniScript. The OmniScript gathers only the fields needed at each step. One Integration Procedure can coordinate customer lookup, eligibility, and persistence, using Data Mappers for Salesforce reads and writes and an authenticated integration for external data.

Version and document the contract independently of labels and screen order. Return stable status codes, user-safe messages, and correlation identifiers; do not expose raw downstream errors. Keep secrets and endpoints in supported credential/configuration facilities, never in component formulas.

*A practical component blueprint; actual metadata is configured and promoted with the supported OmniStudio tooling.*

```yaml
experience: ClaimIntake
entry:
  flexCard: PolicySummary
  action: LaunchClaimOmniScript
ui:
  omniScript: ClaimIntake
  inputs: [policyId, contactId]
  steps: [verify_identity, incident, evidence, review]
server:
  integrationProcedure: ClaimIntakeService
  operations:
    - dataMapper: ReadPolicyContext
    - api: CheckCoverage
    - dataMapper: UpsertClaim
contract:
  response: [claimId, status, nextAction, correlationId]
  excludes: [internalRiskScore, rawProviderError]
```

##### Performance and resilience are design inputs

Reduce round trips by aggregating related server work in an Integration Procedure, but do not create a giant procedure that couples unrelated journeys. Request and return only fields the screen uses. Load later-step data only when needed, keep repeated reference reads cacheable where the data and runtime permit it, and move genuinely long-running work to an appropriate asynchronous boundary rather than holding an interactive transaction open.

Define timeouts, retry ownership, idempotency keys for writes, and partial-failure behavior. Retrying a read can be safe; blindly retrying “create order” can duplicate a transaction. Platform limits and cache behavior vary by runtime and entitlement, so use current official guidance and test with production-like payloads, concurrency, and downstream latency.

##### Secure, test, and operate the whole journey

Every layer must enforce the caller’s intended authority. Review object and field access for Data Mapper operations, sharing behavior and user context for Apex, credentials and allowlisted destinations for callouts, and data returned to external users. Treat browser-supplied identifiers and hidden fields as untrusted; re-derive ownership and eligibility on the server.

Test components in layers: mapping fixtures for Data Mappers, contract tests for Integration Procedures, branch and validation tests for OmniScripts, accessibility and responsive checks for UI, then end-to-end tests for the critical path. Promote activated versions through source control and supported deployment tooling. Monitor latency, failure category, abandonment by step, and downstream correlation IDs so a “spinner” can be traced beyond the browser.

#### Real-world example — Claims intake that remains usable during a provider slowdown

- **Scenario:** An insurer built a single browser-heavy form that called policy, identity, and document services separately. Mobile users waited through repeated calls, provider timeouts produced generic errors, and retries created duplicate claims.
- **Solution:** The team rebuilt the journey as an OmniScript launched from a policy FlexCard. A contract-focused Integration Procedure combined reads, Data Mappers handled Salesforce mapping, and claim creation used an idempotency key. Evidence upload was isolated from the core save, errors carried correlation IDs, and performance tests included slow-provider cases.
- **Outcome:** The initial payload became smaller, duplicate claims stopped, users could recover from document-service failures without re-entering the incident, and support could trace each failure across Salesforce and the provider.

#### Key takeaways

- OmniScripts guide interactions; FlexCards present context and actions
- Data Mappers map Salesforce data; Integration Procedures orchestrate server-side work
- Stable, minimal contracts decouple the experience from backend schemas
- Retries for writes require idempotency and explicit ownership
- Security, accessibility, performance, and telemetry must be tested end to end

#### Go deeper

- [OmniStudio Overview](https://developer.salesforce.com/docs/atlas.en-us.industries_reference.meta/industries_reference/omnistudio_overview.htm)
- [OmniStudio Integration Procedure APIs](https://developer.salesforce.com/docs/atlas.en-us.industries_reference.meta/industries_reference/omnistudio_integration_procedure_apis.htm)
- [OmniStudio Data Mapper APIs](https://developer.salesforce.com/docs/atlas.en-us.industries_reference.meta/industries_reference/omnistudio_data_mapper_apis.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why OmniStudio for scalable guided experiences matters | intro |
| 2 | 0:30–1:06 | Four components, four responsibilities | concept |
| 3 | 1:06–1:42 | Build a contract-first experience stack | concept |
| 4 | 1:42–2:18 | Code walk-through — Build a contract-first experience stack | demo |
| 5 | 2:18–2:54 | Performance and resilience are design inputs | demo |
| 6 | 2:54–3:30 | Secure, test, and operate the whole journey | concept |
| 7 | 3:30–4:15 | Real story — Claims intake that remains usable during a provider slowdown | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why OmniStudio for scalable guided experiences matters**

- **Narration (word-for-word):** Welcome to Modern Salesforce Platform, and this five-minute session on OmniStudio for scalable guided experiences. Compose guided interactions from focused UI, data-mapping, and orchestration components, with explicit contracts and performance budgets.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Modern Salesforce Platform · Customer 360 & Scalable Digital Experiences

**[0:30–1:06] Four components, four responsibilities**

- **Narration (word-for-word):** An OmniScript is a guided, multi-step interaction: collect inputs, branch, validate, and invoke work. A FlexCard presents contextual data and actions in a compact, reusable UI. A Data Mapper reads, transforms, or writes Salesforce data through declared mappings. An Integration Procedure orchestrates server-side work across Data Mappers, APIs, and Apex and returns a response shaped for its consumer. Keep these boundaries crisp. The UI should not know five backend schemas; an Integration Procedure should return a purpose-built contract.
- **On screen:** Animated explainer diagram for "Four components, four responsibilities": the key entities appear and connect exactly as the narration names them.

**[1:06–1:42] Build a contract-first experience stack**

- **Narration (word-for-word):** Start with the smallest input and output contract for each user moment. A FlexCard can show policy status and launch an OmniScript. The OmniScript gathers only the fields needed at each step. One Integration Procedure can coordinate customer lookup, eligibility, and persistence, using Data Mappers for Salesforce reads and writes and an authenticated integration for external data. Version and document the contract independently of labels and screen order. Return stable status codes, user-safe messages, and correlation identifiers; do not expose raw downstream errors.
- **On screen:** Animated explainer diagram for "Build a contract-first experience stack": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Code walk-through — Build a contract-first experience stack**

- **Narration (word-for-word):** Now watch the same idea in code. A practical component blueprint; actual metadata is configured and promoted with the supported OmniStudio tooling. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the yaml snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: YAML

**[2:18–2:54] Performance and resilience are design inputs**

- **Narration (word-for-word):** Let's actually do this together. Reduce round trips by aggregating related server work in an Integration Procedure, but do not create a giant procedure that couples unrelated journeys. Request and return only fields the screen uses. Load later-step data only when needed, keep repeated reference reads cacheable where the data and runtime permit it, and move genuinely long-running work to an appropriate asynchronous boundary rather than holding an interactive transaction open. Define timeouts, retry ownership, idempotency keys for writes, and partial-failure behavior.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Define timeouts, retry ownership, idempotency keys for writes, and partial-failure behavior.
  2. Retrying a read can be safe; blindly retrying “create order” can duplicate a transaction.
  3. Platform limits and cache behavior vary by runtime and entitlement, so use current official guidance and test with production-like payloads, concurrency, and downstream latency.

**[2:54–3:30] Secure, test, and operate the whole journey**

- **Narration (word-for-word):** Every layer must enforce the caller’s intended authority. Review object and field access for Data Mapper operations, sharing behavior and user context for Apex, credentials and allowlisted destinations for callouts, and data returned to external users. Treat browser-supplied identifiers and hidden fields as untrusted; re-derive ownership and eligibility on the server. Test components in layers: mapping fixtures for Data Mappers, contract tests for Integration Procedures, branch and validation tests for OmniScripts, accessibility and responsive checks for UI, then end-to-end tests for the critical path.
- **On screen:** Animated explainer diagram for "Secure, test, and operate the whole journey": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Claims intake that remains usable during a provider slowdown**

- **Narration (word-for-word):** Here is why this matters in the real world. An insurer built a single browser-heavy form that called policy, identity, and document services separately. Mobile users waited through repeated calls, provider timeouts produced generic errors, and retries created duplicate claims. What did they do? The team rebuilt the journey as an OmniScript launched from a policy FlexCard. A contract-focused Integration Procedure combined reads, Data Mappers handled Salesforce mapping, and claim creation used an idempotency key. Evidence upload was isolated from the core save, errors carried correlation IDs, and performance tests included slow-provider cases.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Claims intake that remains usable during a provider slowdown

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. OmniScripts guide interactions; FlexCards present context and actions. Data Mappers map Salesforce data; Integration Procedures orchestrate server-side work. Stable, minimal contracts decouple the experience from backend schemas. Retries for writes require idempotency and explicit ownership. Security, accessibility, performance, and telemetry must be tested end to end.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is OmniStudio for scalable guided experiences — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: Data Cloud & Modern Automation

Move from raw source data to governed activation, and from fragmented legacy automation to observable Flow and multi-team orchestration.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 8 questions.*

### Lesson 2.1 — Data Cloud: ingest, harmonize, resolve, segment, activate

**Lesson ID:** `modern-data-cloud-lifecycle` · **Reading time:** 38 min · **Video:** 5:00

> Design the complete Data Cloud lifecycle, including identity quality, consent, activation contracts, and ongoing governance.

**Learning objectives**

- Trace source data through data streams, DLOs, DMOs, unified profiles, segments, and activations
- Design match and reconciliation rules using measurable identity-quality hypotheses
- Distinguish segmentation membership from downstream activation and consent enforcement
- Define governance for lineage, access, data quality, retention, usage, and change control

#### Concept explanation

##### Ingestion preserves source meaning

Data Cloud—called Data 360 in current Salesforce documentation—connects batch, streaming, and supported federated sources through data streams. Ingested data lands in Data Lake Objects (DLOs) in a source-oriented shape. Preserve source keys, event time, ingestion time, and provenance so records can be reconciled and replayed. Do not “clean” away evidence needed to understand what a source actually sent.

Choose an ingestion pattern from business freshness and cost, not from a blanket demand for real time. A nightly loyalty balance may be sufficient while web abandonment needs a shorter path. Define schema-change ownership, late-arriving-event behavior, deletion propagation, monitoring, and recovery before turning on the feed.

##### Harmonization creates comparable meaning

Map DLO fields into Data Model Objects (DMOs) based on the Customer 360 Data Model, extending it only when the business meaning truly differs. Individual, contact-point, engagement, and business entities must retain relationships and source identifiers. Standardized email, phone, country, timestamp, and consent semantics improve every later identity and segment decision.

Mapping is a semantic contract, not a drag-and-drop chore. Profile null rates, invalid values, uniqueness, referential integrity, and freshness before and after mapping. Calculated insights can derive reusable measures such as trailing spend or case frequency, but every metric needs a named owner, definition, grain, time window, and refresh expectation.

##### Identity resolution links; reconciliation selects

Identity resolution applies match rules to decide which source profiles belong to the same person or account. Exact normalized email may be strong in one domain; shared household email may be unsafe in another. Fuzzy names should normally be combined with stronger evidence. Reconciliation rules then choose which value represents an attribute in the unified profile—for example a trusted-source priority or a recency strategy.

Source records remain traceable; unification does not justify overwriting them. Establish labeled test pairs for true matches and true nonmatches, then measure false merges and missed matches. Review consolidation rates and sampled profiles whenever source quality or a ruleset changes. A false merge can disclose one person’s data to another, making identity quality a security concern as well as an analytics concern.

##### Segments and activations need policy gates

A segment is a reproducible membership definition over eligible data; an activation publishes selected attributes and membership to a configured destination. Keep the activation payload minimal, map destination identifiers explicitly, and enforce consent, purpose, suppression, residency, and retention rules at the appropriate layers. A customer qualifying for “high value” does not imply permission to contact them in every channel.

Govern the lifecycle through permissions, data spaces or equivalent separation where appropriate, lineage, classifications, usage monitoring, release records, and owner-approved changes. Preview counts and samples, reconcile destination totals, monitor refresh failures, and support deletion and consent changes through the full downstream path.

*A lifecycle contract that keeps technical mapping, identity logic, purpose, and operational controls together.*

```yaml
use_case: LoyaltyRenewal
source:
  stream: commerce_orders
  key: order_id
  event_time: purchased_at
model:
  dlo: CommerceOrderDLO
  dmos: [Individual, ContactPointEmail, SalesOrder]
identity:
  match: normalized_email + loyalty_member_id
  reconcile:
    email: most_recent_consented_value
segment:
  criteria: membership_expires_within_30_days AND consent_email
activation:
  target: approved_marketing_destination
  attributes: [unified_individual_id, loyalty_tier, expiry_date]
governance:
  owner: customer_data_team
  controls: [lineage, quality_thresholds, suppression, deletion_propagation]
  monitors: [freshness, match_quality, segment_count, delivery_failures]
```

#### Real-world example — A retailer stops marketing to merged households

- **Scenario:** A retailer joined store, ecommerce, and loyalty profiles on email alone. Shared family addresses caused false merges, opt-outs were not consistently propagated, and campaign counts differed sharply from destination delivery.
- **Solution:** The data team retained source keys in DLOs, harmonized profile and consent fields into DMOs, and required loyalty ID plus normalized contact evidence for high-confidence matches. Reconciliation preferred the latest consented contact point from governed sources. Activation applied suppression and emitted only the destination fields required, with count reconciliation and deletion monitoring.
- **Outcome:** False household merges dropped in the reviewed sample, opt-outs flowed through the activation path, campaign totals became explainable, and identity-rule changes entered the same tested change process as application code.

#### Key takeaways

- DLOs retain source-oriented data; DMOs harmonize it into shared business meaning
- Match rules link profiles, while reconciliation rules choose representative attribute values
- Identity rules require labeled quality tests because false merges can become privacy incidents
- Segments define membership; activations publish approved data to a destination
- Consent, minimization, lineage, deletion, usage, and monitoring govern the whole lifecycle

#### Go deeper

- [Data 360 Architecture](https://developer.salesforce.com/docs/data/data-cloud-dev/guide/dc-architecture.html) — Official end-to-end architecture, including identity, segmentation, and governance
- [Model Data in Data 360](https://developer.salesforce.com/docs/data/data-cloud-dmo-mapping/guide/c360dm-model-data.html) — DLO, DMO, and Customer 360 Data Model reference
- [Map Data and Create Unified Profiles](https://trailhead.salesforce.com/content/learn/modules/data-cloud-connect-and-unify/map-and-unify-data)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Data Cloud: ingest, harmonize, resolve, segment, activate matters | intro |
| 2 | 0:30–1:06 | Ingestion preserves source meaning | demo |
| 3 | 1:06–1:42 | Harmonization creates comparable meaning | concept |
| 4 | 1:42–2:18 | Identity resolution links; reconciliation selects | demo |
| 5 | 2:18–2:54 | Segments and activations need policy gates | concept |
| 6 | 2:54–3:30 | Code walk-through — Segments and activations need policy gates | demo |
| 7 | 3:30–4:15 | Real story — A retailer stops marketing to merged households | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Data Cloud: ingest, harmonize, resolve, segment, activate matters**

- **Narration (word-for-word):** Welcome to Modern Salesforce Platform, and this five-minute session on Data Cloud: ingest, harmonize, resolve, segment, activate. Design the complete Data Cloud lifecycle, including identity quality, consent, activation contracts, and ongoing governance.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Modern Salesforce Platform · Data Cloud & Modern Automation

**[0:30–1:06] Ingestion preserves source meaning**

- **Narration (word-for-word):** Let's actually do this together. Data Cloud—called Data 360 in current Salesforce documentation—connects batch, streaming, and supported federated sources through data streams. Ingested data lands in Data Lake Objects (DLOs) in a source-oriented shape. Preserve source keys, event time, ingestion time, and provenance so records can be reconciled and replayed. Do not “clean” away evidence needed to understand what a source actually sent. Choose an ingestion pattern from business freshness and cost, not from a blanket demand for real time.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Choose an ingestion pattern from business freshness and cost, not from a blanket demand for real time.
  2. Define schema-change ownership, late-arriving-event behavior, deletion propagation, monitoring, and recovery before turning on the feed.

**[1:06–1:42] Harmonization creates comparable meaning**

- **Narration (word-for-word):** Map DLO fields into Data Model Objects (DMOs) based on the Customer 360 Data Model, extending it only when the business meaning truly differs. Individual, contact-point, engagement, and business entities must retain relationships and source identifiers. Standardized email, phone, country, timestamp, and consent semantics improve every later identity and segment decision. Mapping is a semantic contract, not a drag-and-drop chore. Profile null rates, invalid values, uniqueness, referential integrity, and freshness before and after mapping.
- **On screen:** Animated explainer diagram for "Harmonization creates comparable meaning": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Identity resolution links; reconciliation selects**

- **Narration (word-for-word):** Let's actually do this together. Identity resolution applies match rules to decide which source profiles belong to the same person or account. Exact normalized email may be strong in one domain; shared household email may be unsafe in another. Fuzzy names should normally be combined with stronger evidence. Reconciliation rules then choose which value represents an attribute in the unified profile—for example a trusted-source priority or a recency strategy. Source records remain traceable; unification does not justify overwriting them.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Establish labeled test pairs for true matches and true nonmatches, then measure false merges and missed matches.
  2. A false merge can disclose one person’s data to another, making identity quality a security concern as well as an analytics concern.

**[2:18–2:54] Segments and activations need policy gates**

- **Narration (word-for-word):** A segment is a reproducible membership definition over eligible data; an activation publishes selected attributes and membership to a configured destination. Keep the activation payload minimal, map destination identifiers explicitly, and enforce consent, purpose, suppression, residency, and retention rules at the appropriate layers. A customer qualifying for “high value” does not imply permission to contact them in every channel. Govern the lifecycle through permissions, data spaces or equivalent separation where appropriate, lineage, classifications, usage monitoring, release records, and owner-approved changes.
- **On screen:** Animated explainer diagram for "Segments and activations need policy gates": the key entities appear and connect exactly as the narration names them.

**[2:54–3:30] Code walk-through — Segments and activations need policy gates**

- **Narration (word-for-word):** Now watch the same idea in code. A lifecycle contract that keeps technical mapping, identity logic, purpose, and operational controls together. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the yaml snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: YAML

**[3:30–4:15] Real story — A retailer stops marketing to merged households**

- **Narration (word-for-word):** Here is why this matters in the real world. A retailer joined store, ecommerce, and loyalty profiles on email alone. Shared family addresses caused false merges, opt-outs were not consistently propagated, and campaign counts differed sharply from destination delivery. What did they do? The data team retained source keys in DLOs, harmonized profile and consent fields into DMOs, and required loyalty ID plus normalized contact evidence for high-confidence matches. Reconciliation preferred the latest consented contact point from governed sources. Activation applied suppression and emitted only the destination fields required, with count reconciliation and deletion monitoring.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A retailer stops marketing to merged households

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. DLOs retain source-oriented data; DMOs harmonize it into shared business meaning. Match rules link profiles, while reconciliation rules choose representative attribute values. Identity rules require labeled quality tests because false merges can become privacy incidents. Segments define membership; activations publish approved data to a destination. Consent, minimization, lineage, deletion, usage, and monitoring govern the whole lifecycle.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Data Cloud: ingest, harmonize, resolve, segment, activate — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Flow Orchestration, modern Flow & dynamic experiences

**Lesson ID:** `modern-flow-orchestration-modernization` · **Reading time:** 38 min · **Video:** 5:00

> Choose the right Flow boundary, coordinate long-running human work, personalize record pages safely, and retire Process Builder without changing behavior by accident.

**Learning objectives**

- Select before-save, after-save, asynchronous, scheduled, screen, and autolaunched Flow patterns by transaction need
- Model multi-stage, multi-user processes with Flow Orchestration and observable work items
- Use Dynamic Forms and Dynamic Actions without confusing visibility with security
- Execute an inventory-led, regression-tested Process Builder migration

#### Concept explanation

##### Pick a Flow boundary by transaction semantics

Use a before-save record-triggered flow for fast same-record field changes that need no additional DML. Use after-save when related records, notifications, actions, or orchestration are required. Use an asynchronous path or another supported async mechanism when work should leave the original transaction; use scheduled paths for time-relative work. Screen flows collect user input, while autolaunched flows expose reusable headless logic.

Keep entry criteria selective, avoid queries and writes inside loops, process collections, use fault paths, and make retryable work idempotent. Put reusable policy in focused subflows or invocable actions, not in copied branches. Record trigger order and ownership. The right split between Flow and Apex depends on automation density, volume, complexity, and team skills—not a slogan that one tool must do everything.

##### Orchestrate work that outlives one transaction

Flow Orchestration coordinates flows as steps grouped into sequential stages. Background steps run autolaunched flows; interactive steps run screen flows and create work items for assigned users, groups, or queues. Steps within a stage can support ordered or concurrent work, while stage exit conditions make the lifecycle explicit.

Use orchestration for processes with durable handoffs, multiple teams, and operational monitoring: onboarding, claims, investigations, or complex approvals. Do not use it merely to wrap a few synchronous field updates. Define assignment fallbacks, due-time policy, rework and cancellation paths, version behavior for in-flight runs, and who monitors stuck runs and work items.

##### Dynamic Forms and Actions shape the moment of work

Dynamic Forms place fields and sections as Lightning page components and apply visibility rules so each persona sees relevant detail at the right state. Dynamic Actions conditionally surface the actions most useful for that context. Use them to reduce page noise—for example showing escalation fields and “Request Review” only when a case is eligible.

Visibility rules are presentation logic, not security. Field-level security, object permissions, and record sharing still decide what users may read or change. Avoid duplicating critical business policy in a page rule: a hidden button does not prevent an API call, and another page can expose the same action. Put authorization and invariant validation in enforceable platform layers.

##### Migrate Process Builder as a behavior change

Inventory each process, its criteria, scheduled actions, field updates, invocable code, downstream automation, running interviews, and business owner. Group automation by object and outcome before conversion. The Migrate to Flow tooling can accelerate supported cases, but generated output still requires design review; cloning each legacy process one-for-one preserves fragmentation and uncertain ordering.

Capture baseline scenarios, bulk behavior, user/system context, order of execution, faults, and timing. Build and test in a nonproduction environment, compare outcomes, choose a cutover and rollback plan, deactivate the legacy process only after validation, and monitor errors and business KPIs. Remove or archive obsolete automation after the agreed observation period.

*An automation catalog entry that makes transaction boundaries, UI behavior, migration evidence, and operations reviewable.*

```yaml
automation: OpportunityLifecycle
owner: revenue_operations
entry_point:
  type: record_triggered_flow
  object: Opportunity
  order: documented_team_sequence
paths:
  before_save: [derive_review_status]
  after_save: [create_review_task]
  asynchronous: [publish_analytics_event]
ui:
  dynamic_fields: review_status == required
  dynamic_action: Request_Review
orchestration:
  stages: [sales_review, finance_review, fulfillment]
migration:
  replaces: [legacy_discount_process]
  tests: [single_update, bulk_update, recursion, scheduled_action, fault]
  rollback: reactivate_legacy_version_and_disable_new_entry_point
monitoring: [flow_errors, stuck_work_items, approval_cycle_time]
```

#### Real-world example — A discount approval becomes an observable lifecycle

- **Scenario:** An enterprise had four Process Builder processes, two flows, and a page-layout button updating the same Opportunity approval fields. Bulk imports caused duplicate tasks, finance handoffs lived in email, and nobody could tell where approvals stalled.
- **Solution:** The team inventoried behavior and consolidated the entry criteria. A before-save flow derived review status, an after-save flow launched a Flow Orchestration for sales and finance work, and Dynamic Forms exposed only the relevant review section. Legacy processes were retired in controlled slices after bulk and timing regression tests.
- **Outcome:** Duplicate tasks stopped, reviewers received trackable work items, cycle-time bottlenecks became visible by stage, and future changes had one owned automation map instead of seven competing entry points.

#### Key takeaways

- Choose Flow types by transaction, timing, interaction, and volume requirements
- Flow Orchestration is for durable stages, automated steps, and human work items
- Dynamic Forms and Actions personalize presentation but never replace authorization
- Bulk-safe collections, selective entry, fault paths, idempotency, and monitoring are production Flow basics
- Process Builder migration starts with behavior inventory and ends with monitored cutover—not automatic conversion

#### Go deeper

- [Record-Triggered Automation Decision Guide](https://architect.salesforce.com/docs/architect/decision-guides/guide/record-triggered)
- [Building Forms Decision Guide](https://architect.salesforce.com/docs/architect/decision-guides/guide/build-forms) — Official comparison of Dynamic Forms, Flow, OmniStudio, and LWC
- [Build a Flow Orchestration](https://trailhead.salesforce.com/content/learn/modules/build-a-flow-orchestration/identify-business-uses-for-flow-orchestration)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Flow Orchestration, modern Flow & dynamic experiences matters | intro |
| 2 | 0:30–1:06 | Pick a Flow boundary by transaction semantics | demo |
| 3 | 1:06–1:42 | Orchestrate work that outlives one transaction | concept |
| 4 | 1:42–2:18 | Dynamic Forms and Actions shape the moment of work | concept |
| 5 | 2:18–2:54 | Migrate Process Builder as a behavior change | concept |
| 6 | 2:54–3:30 | Code walk-through — Migrate Process Builder as a behavior change | demo |
| 7 | 3:30–4:15 | Real story — A discount approval becomes an observable lifecycle | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Flow Orchestration, modern Flow & dynamic experiences matters**

- **Narration (word-for-word):** Welcome to Modern Salesforce Platform, and this five-minute session on Flow Orchestration, modern Flow & dynamic experiences. Choose the right Flow boundary, coordinate long-running human work, personalize record pages safely, and retire Process Builder without changing behavior by accident.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Modern Salesforce Platform · Data Cloud & Modern Automation

**[0:30–1:06] Pick a Flow boundary by transaction semantics**

- **Narration (word-for-word):** Let's actually do this together. Use a before-save record-triggered flow for fast same-record field changes that need no additional DML. Use after-save when related records, notifications, actions, or orchestration are required. Use an asynchronous path or another supported async mechanism when work should leave the original transaction; use scheduled paths for time-relative work. Screen flows collect user input, while autolaunched flows expose reusable headless logic. Keep entry criteria selective, avoid queries and writes inside loops, process collections, use fault paths, and make retryable work idempotent.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Use a before-save record-triggered flow for fast same-record field changes that need no additional DML.
  2. Use after-save when related records, notifications, actions, or orchestration are required.

**[1:06–1:42] Orchestrate work that outlives one transaction**

- **Narration (word-for-word):** Flow Orchestration coordinates flows as steps grouped into sequential stages. Background steps run autolaunched flows; interactive steps run screen flows and create work items for assigned users, groups, or queues. Steps within a stage can support ordered or concurrent work, while stage exit conditions make the lifecycle explicit. Use orchestration for processes with durable handoffs, multiple teams, and operational monitoring: onboarding, claims, investigations, or complex approvals. Do not use it merely to wrap a few synchronous field updates.
- **On screen:** Animated explainer diagram for "Orchestrate work that outlives one transaction": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Dynamic Forms and Actions shape the moment of work**

- **Narration (word-for-word):** Dynamic Forms place fields and sections as Lightning page components and apply visibility rules so each persona sees relevant detail at the right state. Dynamic Actions conditionally surface the actions most useful for that context. Use them to reduce page noise—for example showing escalation fields and “Request Review” only when a case is eligible. Visibility rules are presentation logic, not security. Field-level security, object permissions, and record sharing still decide what users may read or change.
- **On screen:** Animated explainer diagram for "Dynamic Forms and Actions shape the moment of work": the key entities appear and connect exactly as the narration names them.

**[2:18–2:54] Migrate Process Builder as a behavior change**

- **Narration (word-for-word):** Inventory each process, its criteria, scheduled actions, field updates, invocable code, downstream automation, running interviews, and business owner. Group automation by object and outcome before conversion. The Migrate to Flow tooling can accelerate supported cases, but generated output still requires design review; cloning each legacy process one-for-one preserves fragmentation and uncertain ordering. Capture baseline scenarios, bulk behavior, user/system context, order of execution, faults, and timing.
- **On screen:** Animated explainer diagram for "Migrate Process Builder as a behavior change": the key entities appear and connect exactly as the narration names them.

**[2:54–3:30] Code walk-through — Migrate Process Builder as a behavior change**

- **Narration (word-for-word):** Now watch the same idea in code. An automation catalog entry that makes transaction boundaries, UI behavior, migration evidence, and operations reviewable. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the yaml snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: YAML

**[3:30–4:15] Real story — A discount approval becomes an observable lifecycle**

- **Narration (word-for-word):** Here is why this matters in the real world. An enterprise had four Process Builder processes, two flows, and a page-layout button updating the same Opportunity approval fields. Bulk imports caused duplicate tasks, finance handoffs lived in email, and nobody could tell where approvals stalled. What did they do? The team inventoried behavior and consolidated the entry criteria. A before-save flow derived review status, an after-save flow launched a Flow Orchestration for sales and finance work, and Dynamic Forms exposed only the relevant review section. Legacy processes were retired in controlled slices after bulk and timing regression tests.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A discount approval becomes an observable lifecycle

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Choose Flow types by transaction, timing, interaction, and volume requirements. Flow Orchestration is for durable stages, automated steps, and human work items. Dynamic Forms and Actions personalize presentation but never replace authorization. Bulk-safe collections, selective entry, fault paths, idempotency, and monitoring are production Flow basics. Process Builder migration starts with behavior inventory and ends with monitored cutover—not automatic conversion.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Flow Orchestration, modern Flow & dynamic experiences — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: Agentforce, Einstein & Trusted Operations

Ground agent reasoning in approved data, expose bounded actions, preserve human control, and operate AI with security and evidence.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 8 questions.*

### Lesson 3.1 — Agentforce & Einstein: grounded reasoning and safe action

**Lesson ID:** `modern-agentforce-einstein-architecture` · **Reading time:** 38 min · **Video:** 5:00

> Design the full agent loop—from topic scope and grounding to deterministic tools, confirmation, and context-rich human handoff.

**Learning objectives**

- Explain how Agentforce reasoning, Einstein generative services, grounding, and actions fit together
- Design focused topics or subagents with evidence-based prompts and bounded tool access
- Wrap Flow, Apex, and integration capabilities as clear, deterministic agent actions
- Implement human handoff that preserves context, authority, and customer choice

#### Concept explanation

##### Separate reasoning from authority

An Agentforce experience begins at a channel and routes a request into a scoped topic or subagent. Instructions and conversation context guide a reasoning engine; grounding adds approved business evidence; a model proposes a response or tool choice; actions invoke deterministic platform capabilities; observations return results for the next step. Einstein generative services and the Einstein Trust Layer support the model interaction, while Agentforce adds the agentic planning and action loop.

The model can decide among allowed tools, but it should not create its own authority. Salesforce permissions, action runtime context, validation, approval policy, and downstream systems determine what actually happens. Keep topic scope narrow enough to test, and make “cannot safely complete” a designed state rather than encouraging improvisation.

##### Ground prompts with the least necessary evidence

Grounding can draw from CRM records, knowledge, Data Cloud, prompt-template inputs, or approved retrieval services. Retrieve evidence using the caller’s authorized context where supported, filter by status and audience, and prefer current, owned content. Include stable identifiers and effective dates so an answer can be traced. More context is not automatically better: irrelevant records consume the context window and can steer the model toward the wrong policy.

Treat retrieved text as untrusted data, especially web pages, attachments, emails, and knowledge imported from outside. Instructions found inside that content must not override system policy. Prompt templates should state the job, evidence boundaries, required output, uncertainty behavior, and when to ask, confirm, refuse, or hand off. Evaluate the assembled prompt and retrieval results, not just the template text.

##### Actions are typed, least-privilege contracts

Agent actions can wrap Flow, Apex, prompt templates, APIs, or integration assets. Give each action a precise name and description, typed inputs, a minimal output, explicit errors, and one business responsibility. Validate all model-supplied arguments server-side. Use allowlists for state transitions and destination systems; never convert free-form model text directly into unrestricted SOQL, URLs, recipients, or code.

Read actions and reversible drafts can require lighter controls. Financial, destructive, identity-changing, or externally visible writes should use deterministic eligibility checks and often explicit user or human confirmation. Make writes idempotent and auditable. Return structured outcomes such as `completed`, `needs_confirmation`, `not_authorized`, or `temporarily_unavailable` so the agent does not invent success after a tool failure.

##### Handoff is a first-class action

Escalate when the user asks, identity or consent is unresolved, evidence conflicts, confidence or policy thresholds fail, a sensitive exception appears, or a required tool is unavailable. A useful handoff carries the authenticated customer and channel, concise issue summary, relevant records, evidence consulted, actions attempted and their results, promised follow-up, and the reason for transfer. Do not force the customer to repeat the entire conversation.

For service use cases, Agentforce can transfer through an active Omni-Channel connection. Routing availability, queue fallback, after-hours behavior, transcript access, and ownership must be configured and tested. The following Agent Script extract illustrates bounded tools and the escalation utility; referenced actions, variables, and the messaging connection are declared elsewhere in the agent definition.

*An illustrative Agent Script pattern using precise tools and the supported escalation utility.*

```yaml
subagent order_support:
    description: "Answer order questions and request approved changes"
    reasoning:
        instructions: ->
            | Use retrieved order facts; never guess fulfillment dates.
            | Confirm the order and requested change before any write.
            | Call {!@actions.escalate_to_human} on request, conflict, or unsafe uncertainty.
        actions:
            lookup_order: @actions.lookup_order
                description: "Read one order the verified customer is authorized to view"
            request_address_change: @actions.request_address_change
                description: "Submit a validated, confirmed change request; never edit shipment history"
            escalate_to_human: @utils.escalate
                description: "Transfer the conversation with context to a service representative"
                available when @variables.handoff_available
```

#### Real-world example — An order agent that never invents a shipment promise

- **Scenario:** A distributor piloted an order-status assistant that answered from general product text. It guessed delivery dates when ERP data was late and accepted address changes without checking shipment state, creating operational and fraud risk.
- **Solution:** The replacement agent used a narrow order-support topic, grounded responses in authorized order and logistics records, and exposed separate read and address-change-request actions. The write action revalidated identity and status, required confirmation, and was idempotent. Conflicting dates, blocked changes, user requests, and tool outages transferred to an Omni-Channel queue with a structured summary.
- **Outcome:** Unsupported delivery promises disappeared from the evaluation set, duplicate changes were prevented, agents received useful context at handoff, and the team could improve retrieval and actions independently of the conversational wording.

#### Key takeaways

- Reasoning chooses among permitted options; deterministic controls grant authority
- Grounding should be authorized, relevant, current, traceable, and resistant to injected instructions
- Agent actions need narrow contracts, server-side validation, explicit errors, and idempotent writes
- Sensitive actions deserve eligibility checks and confirmation outside model discretion
- Human handoff needs explicit triggers, routing, context transfer, and fallback behavior

#### Go deeper

- [Agentforce Architecture Fundamentals](https://architect.salesforce.com/docs/architect/fundamentals/guide/get-started-agentforce.html)
- [Agent Script Actions Reference](https://developer.salesforce.com/docs/ai/agentforce/guide/ascript-ref-actions.html)
- [Agent Script Utilities and Human Escalation](https://developer.salesforce.com/docs/ai/agentforce/guide/ascript-ref-utils.html)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Agentforce & Einstein: grounded reasoning and safe action matters | intro |
| 2 | 0:30–1:06 | Separate reasoning from authority | demo |
| 3 | 1:06–1:42 | Ground prompts with the least necessary evidence | concept |
| 4 | 1:42–2:18 | Actions are typed, least-privilege contracts | concept |
| 5 | 2:18–2:54 | Handoff is a first-class action | concept |
| 6 | 2:54–3:30 | Code walk-through — Handoff is a first-class action | demo |
| 7 | 3:30–4:15 | Real story — An order agent that never invents a shipment promise | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Agentforce & Einstein: grounded reasoning and safe action matters**

- **Narration (word-for-word):** Welcome to Modern Salesforce Platform, and this five-minute session on Agentforce & Einstein: grounded reasoning and safe action. Design the full agent loop—from topic scope and grounding to deterministic tools, confirmation, and context-rich human handoff.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Modern Salesforce Platform · Agentforce, Einstein & Trusted Operations

**[0:30–1:06] Separate reasoning from authority**

- **Narration (word-for-word):** Let's actually do this together. An Agentforce experience begins at a channel and routes a request into a scoped topic or subagent. Instructions and conversation context guide a reasoning engine; grounding adds approved business evidence; a model proposes a response or tool choice; actions invoke deterministic platform capabilities; observations return results for the next step. Einstein generative services and the Einstein Trust Layer support the model interaction, while Agentforce adds the agentic planning and action loop.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. The model can decide among allowed tools, but it should not create its own authority.
  2. Keep topic scope narrow enough to test, and make “cannot safely complete” a designed state rather than encouraging improvisation.

**[1:06–1:42] Ground prompts with the least necessary evidence**

- **Narration (word-for-word):** Grounding can draw from CRM records, knowledge, Data Cloud, prompt-template inputs, or approved retrieval services. Retrieve evidence using the caller’s authorized context where supported, filter by status and audience, and prefer current, owned content. Include stable identifiers and effective dates so an answer can be traced. More context is not automatically better: irrelevant records consume the context window and can steer the model toward the wrong policy. Treat retrieved text as untrusted data, especially web pages, attachments, emails, and knowledge imported from outside.
- **On screen:** Animated explainer diagram for "Ground prompts with the least necessary evidence": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Actions are typed, least-privilege contracts**

- **Narration (word-for-word):** Agent actions can wrap Flow, Apex, prompt templates, APIs, or integration assets. Give each action a precise name and description, typed inputs, a minimal output, explicit errors, and one business responsibility. Validate all model-supplied arguments server-side. Use allowlists for state transitions and destination systems; never convert free-form model text directly into unrestricted SOQL, URLs, recipients, or code. Read actions and reversible drafts can require lighter controls. Financial, destructive, identity-changing, or externally visible writes should use deterministic eligibility checks and often explicit user or human confirmation.
- **On screen:** Animated explainer diagram for "Actions are typed, least-privilege contracts": the key entities appear and connect exactly as the narration names them.

**[2:18–2:54] Handoff is a first-class action**

- **Narration (word-for-word):** Escalate when the user asks, identity or consent is unresolved, evidence conflicts, confidence or policy thresholds fail, a sensitive exception appears, or a required tool is unavailable. A useful handoff carries the authenticated customer and channel, concise issue summary, relevant records, evidence consulted, actions attempted and their results, promised follow-up, and the reason for transfer. Do not force the customer to repeat the entire conversation. For service use cases, Agentforce can transfer through an active Omni-Channel connection.
- **On screen:** Animated explainer diagram for "Handoff is a first-class action": the key entities appear and connect exactly as the narration names them.

**[2:54–3:30] Code walk-through — Handoff is a first-class action**

- **Narration (word-for-word):** Now watch the same idea in code. An illustrative Agent Script pattern using precise tools and the supported escalation utility. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the yaml snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: YAML

**[3:30–4:15] Real story — An order agent that never invents a shipment promise**

- **Narration (word-for-word):** Here is why this matters in the real world. A distributor piloted an order-status assistant that answered from general product text. It guessed delivery dates when ERP data was late and accepted address changes without checking shipment state, creating operational and fraud risk. What did they do? The replacement agent used a narrow order-support topic, grounded responses in authorized order and logistics records, and exposed separate read and address-change-request actions. The write action revalidated identity and status, required confirmation, and was idempotent. Conflicting dates, blocked changes, user requests, and tool outages transferred to an Omni-Channel queue with a structured summary.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** An order agent that never invents a shipment promise

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Reasoning chooses among permitted options; deterministic controls grant authority. Grounding should be authorized, relevant, current, traceable, and resistant to injected instructions. Agent actions need narrow contracts, server-side validation, explicit errors, and idempotent writes. Sensitive actions deserve eligibility checks and confirmation outside model discretion. Human handoff needs explicit triggers, routing, context transfer, and fallback behavior.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Agentforce & Einstein: grounded reasoning and safe action — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — Trusted AI: security, evaluation & observability

**Lesson ID:** `modern-trusted-ai-operations` · **Reading time:** 38 min · **Video:** 5:00

> Turn trust principles into enforceable controls, adversarial tests, privacy-aware telemetry, release gates, and incident response.

**Learning objectives**

- Threat-model grounded agents across prompts, retrieval, models, actions, identities, and downstream systems
- Apply Einstein Trust Layer controls alongside least privilege and policy enforcement
- Define offline evaluations and production telemetry for quality, safety, reliability, cost, and business value
- Operate agents with staged release, human oversight, audit evidence, kill switches, and incident playbooks

#### Concept explanation

##### Trust Layer controls are a foundation, not the whole control plane

The Einstein Trust Layer provides capabilities such as secure grounding, supported sensitive-data masking, toxicity detection, audit and feedback data, and zero-data-retention agreements with supported third-party model providers. Exact behavior depends on configuration, region, language, model, and product support; verify current documentation and contracts. Detection is probabilistic, so a “not detected” result is not proof that content is safe.

Add an application threat model: direct and indirect prompt injection, unauthorized retrieval, poisoned knowledge, cross-customer leakage, sensitive output, harmful content, fabricated facts, excessive agency, tool-argument manipulation, duplicate writes, model or dependency outage, and abusive consumption. Map each threat to prevention, detection, response, evidence owner, and residual risk.

##### Propagate identity and minimize every privilege

Define whose authority each retrieval and action uses: the end user, an agent service principal, an integration user, or a human approver. Preserve end-user identity across agent, API, and downstream hops where the architecture supports it. If a service identity is necessary, constrain it with dedicated permission sets, sharing, credential scopes, record filters, action allowlists, and transaction-level policy checks.

Classify data before grounding and logging. Exclude secrets and unnecessary regulated fields, enforce object/field/record access, use approved credentials and endpoints, and redact telemetry. A model instruction such as “do not reveal salary” is not an access control. The salary field should be absent unless an authorized use case explicitly requires it.

##### Observe quality, safety, reliability, and value

Build a versioned evaluation set from representative, boundary, multilingual, adversarial, and previously failed cases. Score grounded correctness, evidence relevance, policy compliance, action choice, argument accuracy, confirmation behavior, handoff quality, and harmful-data leakage. Human review remains essential for nuanced or high-impact outcomes; model-based grading can assist but should itself be calibrated.

Production telemetry should connect conversation and agent version to retrieval sources, tool calls, structured outcomes, latency, errors, retries, handoffs, user feedback, policy signals, and cost or consumption—without retaining unnecessary sensitive text. Monitor distributions and trends, not only averages: action failure by version, unsupported-answer samples, p95 latency, repeat-contact rate, containment with quality, and business outcome. A high containment rate is harmful if customers are simply trapped.

##### Release and respond like a production system

Assign business, technical, data, security, and content owners. Promote versioned prompts, topics, retrieval settings, and actions through review and testing. Start with internal or limited audiences, low-risk read use cases, and conservative action scopes; expand only when evidence meets defined release gates. Maintain change records and periodically re-evaluate after model, data, policy, or integration changes.

Provide a fast way to disable an action, topic, channel, or agent without waiting for a full deployment. Incident playbooks should cover triage, evidence preservation, access revocation, customer remedy, rollback, data correction, and post-incident evaluation additions. The sample policy below is an operating contract, not a substitute for enforceable Salesforce and gateway configuration.

*A reviewable AI operating policy; production controls must also be enforced in permissions, actions, gateways, and runtime settings.*

```json
{
  "agent": "OrderSupport",
  "riskTier": "customer-facing-transactional",
  "allowedActions": ["lookup_order", "request_address_change"],
  "confirmationRequired": ["request_address_change"],
  "grounding": {
    "approvedSources": ["Published_Knowledge", "Authorized_Order_API"],
    "excludeDataClasses": ["credentials", "payment_card_full"]
  },
  "releaseGates": {
    "criticalPolicyViolations": 0,
    "actionArgumentTestsPass": true,
    "humanReviewApproved": true
  },
  "alerts": ["authorization_denied_spike", "action_failure_spike", "safety_signal"],
  "killSwitches": ["agent", "topic", "action"],
  "evidenceOwner": "AI_Operations"
}
```

#### Real-world example — A bank contains an indirect prompt-injection attempt

- **Scenario:** A banking assistant retrieved a customer-uploaded document containing hidden instructions to ignore policy and call an address-change tool. Early tests measured only friendly-answer quality and logged complete prompts containing unnecessary personal data.
- **Solution:** The bank treated retrieved documents as untrusted, separated instructions from evidence, restricted the tool to a validated and confirmed request object, propagated customer identity, and required a deterministic account-state check. Telemetry was redacted and linked to versions and tool outcomes. Adversarial documents entered a release-gate suite, and operations gained per-action and per-agent kill switches.
- **Outcome:** The injected instruction could not authorize a change, security could trace the denied attempt without exposing full document contents, and the same attack became a permanent regression test before every agent release.

#### Key takeaways

- Trust Layer protections reduce risk but do not replace authorization, threat modeling, or human oversight
- Model instructions are not security controls; minimize retrieved data and enforce permissions at every action
- Evaluate retrieval, reasoning, tool arguments, confirmations, and handoffs—not just fluent answers
- Privacy-aware traces must connect versions, evidence, actions, outcomes, latency, and policy signals
- Staged rollout, accountable owners, kill switches, and incident playbooks make AI operable

#### Go deeper

- [Einstein Trust Layer](https://developer.salesforce.com/docs/ai/agentforce/guide/trust.html)
- [Trusted Agentic AI](https://trailhead.salesforce.com/content/learn/modules/trusted-agentic-ai/discover-how-salesforce-builds-trusted-agentic-ai)
- [End-User Identity Propagation in Agents](https://architect.salesforce.com/docs/architect/fundamentals/guide/end-user-identity-propagation)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Trusted AI: security, evaluation & observability matters | intro |
| 2 | 0:30–1:06 | Trust Layer controls are a foundation, not the whole control plane | demo |
| 3 | 1:06–1:42 | Propagate identity and minimize every privilege | concept |
| 4 | 1:42–2:18 | Observe quality, safety, reliability, and value | concept |
| 5 | 2:18–2:54 | Release and respond like a production system | concept |
| 6 | 2:54–3:30 | Code walk-through — Release and respond like a production system | demo |
| 7 | 3:30–4:15 | Real story — A bank contains an indirect prompt-injection attempt | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Trusted AI: security, evaluation & observability matters**

- **Narration (word-for-word):** Welcome to Modern Salesforce Platform, and this five-minute session on Trusted AI: security, evaluation & observability. Turn trust principles into enforceable controls, adversarial tests, privacy-aware telemetry, release gates, and incident response.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Modern Salesforce Platform · Agentforce, Einstein & Trusted Operations

**[0:30–1:06] Trust Layer controls are a foundation, not the whole control plane**

- **Narration (word-for-word):** Let's actually do this together. The Einstein Trust Layer provides capabilities such as secure grounding, supported sensitive-data masking, toxicity detection, audit and feedback data, and zero-data-retention agreements with supported third-party model providers. Exact behavior depends on configuration, region, language, model, and product support; verify current documentation and contracts. Detection is probabilistic, so a “not detected” result is not proof that content is safe.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Add an application threat model: direct and indirect prompt injection, unauthorized retrieval, poisoned knowledge, cross-customer leakage, sensitive output, harmful content, fabricated facts, excessive agency, tool-argument manipulation, duplicate writes, model or dependency outage, and abusive consumption.
  2. Map each threat to prevention, detection, response, evidence owner, and residual risk.

**[1:06–1:42] Propagate identity and minimize every privilege**

- **Narration (word-for-word):** Define whose authority each retrieval and action uses: the end user, an agent service principal, an integration user, or a human approver. Preserve end-user identity across agent, API, and downstream hops where the architecture supports it. If a service identity is necessary, constrain it with dedicated permission sets, sharing, credential scopes, record filters, action allowlists, and transaction-level policy checks. Classify data before grounding and logging. Exclude secrets and unnecessary regulated fields, enforce object/field/record access, use approved credentials and endpoints, and redact telemetry.
- **On screen:** Animated explainer diagram for "Propagate identity and minimize every privilege": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Observe quality, safety, reliability, and value**

- **Narration (word-for-word):** Build a versioned evaluation set from representative, boundary, multilingual, adversarial, and previously failed cases. Score grounded correctness, evidence relevance, policy compliance, action choice, argument accuracy, confirmation behavior, handoff quality, and harmful-data leakage. Human review remains essential for nuanced or high-impact outcomes; model-based grading can assist but should itself be calibrated. Production telemetry should connect conversation and agent version to retrieval sources, tool calls, structured outcomes, latency, errors, retries, handoffs, user feedback, policy signals, and cost or consumption—without retaining unnecessary sensitive text.
- **On screen:** Animated explainer diagram for "Observe quality, safety, reliability, and value": the key entities appear and connect exactly as the narration names them.

**[2:18–2:54] Release and respond like a production system**

- **Narration (word-for-word):** Assign business, technical, data, security, and content owners. Promote versioned prompts, topics, retrieval settings, and actions through review and testing. Start with internal or limited audiences, low-risk read use cases, and conservative action scopes; expand only when evidence meets defined release gates. Maintain change records and periodically re-evaluate after model, data, policy, or integration changes. Provide a fast way to disable an action, topic, channel, or agent without waiting for a full deployment.
- **On screen:** Animated explainer diagram for "Release and respond like a production system": the key entities appear and connect exactly as the narration names them.

**[2:54–3:30] Code walk-through — Release and respond like a production system**

- **Narration (word-for-word):** Now watch the same idea in code. A reviewable AI operating policy; production controls must also be enforced in permissions, actions, gateways, and runtime settings. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the json snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JSON

**[3:30–4:15] Real story — A bank contains an indirect prompt-injection attempt**

- **Narration (word-for-word):** Here is why this matters in the real world. A banking assistant retrieved a customer-uploaded document containing hidden instructions to ignore policy and call an address-change tool. Early tests measured only friendly-answer quality and logged complete prompts containing unnecessary personal data. What did they do? The bank treated retrieved documents as untrusted, separated instructions from evidence, restricted the tool to a validated and confirmed request object, propagated customer identity, and required a deterministic account-state check. Telemetry was redacted and linked to versions and tool outcomes. Adversarial documents entered a release-gate suite, and operations gained per-action and per-agent kill switches.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A bank contains an indirect prompt-injection attempt

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Trust Layer protections reduce risk but do not replace authorization, threat modeling, or human oversight. Model instructions are not security controls; minimize retrieved data and enforce permissions at every action. Evaluate retrieval, reasoning, tool arguments, confirmations, and handoffs—not just fluent answers. Privacy-aware traces must connect versions, evidence, actions, outcomes, latency, and policy signals. Staged rollout, accountable owners, kill switches, and incident playbooks make AI operable.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Trusted AI: security, evaluation & observability — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
