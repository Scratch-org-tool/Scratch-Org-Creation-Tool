import type { CurriculumPath } from "./curriculum.types";

/**
 * Path 4 — Modern Salesforce Platform (Intermediate).
 * Connects the core CRM clouds to OmniStudio, Data Cloud, modern Flow, and
 * Agentforce while treating trust, governance, and operations as architecture.
 */
export const modernPlatformPath: CurriculumPath = {
  id: "sf-modern-platform",
  title: "Modern Salesforce Platform",
  tagline:
    "Connect CRM, data, automation, digital experiences, and trusted AI.",
  description:
    "Build a current, product-spanning view of Salesforce. Learn to select and connect Sales, Service, and Experience Cloud; deliver scalable journeys with OmniStudio; turn source data into governed Data Cloud activation; modernize automation with Flow; and design Agentforce solutions whose actions, handoffs, security, and telemetry are production-ready.",
  level: "intermediate",
  category: "salesforce",
  badge: "Modern Platform Practitioner",
  estimatedHours: 9,
  skills: [
    "Customer 360 solution design",
    "Sales, Service & Experience Cloud",
    "OmniStudio",
    "Data Cloud",
    "Flow Orchestration",
    "Dynamic Forms & Actions",
    "Agentforce & Einstein",
    "Trusted AI operations",
  ],
  modules: [
    {
      id: "sf-modern-customer-experiences",
      title: "Customer 360 & Scalable Digital Experiences",
      summary:
        "Select the right CRM products for a measurable outcome, then compose secure, maintainable customer and employee journeys with Experience Cloud and OmniStudio.",
      lessons: [
        {
          id: "modern-customer-360-cloud-strategy",
          title: "Sales, Service, Experience Cloud & Customer 360",
          summary:
            "Turn business outcomes into a coherent product architecture instead of treating every Salesforce cloud as an interchangeable feature bundle.",
          durationMinutes: 32,
          objectives: [
            "Map Sales, Service, and Experience Cloud capabilities to distinct jobs and user groups",
            "Explain Customer 360 as an architectural outcome built from governed data and connected processes",
            "Create an evidence-based product selection and integration decision record",
            "Identify the identity, sharing, licensing, and operating-model questions behind an external experience",
          ],
          sections: [
            {
              heading: "Start with the job, not the cloud name",
              body: "Sales Cloud supports the revenue lifecycle: leads, accounts, contacts, opportunities, activities, forecasting, and sales productivity. Service Cloud supports the service lifecycle: cases, knowledge, entitlements, routing, channels, and agent work. Experience Cloud publishes authenticated or public digital experiences for customers, partners, and other external audiences while reusing Salesforce data and processes.\n\nThese products complement one another, but they do not erase product boundaries. A partner deal-registration portal commonly combines Sales Cloud opportunity data with Experience Cloud identity and pages. A self-service support site combines Service Cloud cases and knowledge with Experience Cloud. Choose the product that owns the core job, then add channels and shared capabilities deliberately. Product names, packaging, and entitlements evolve, so validate the current contract and official documentation rather than encoding a release-specific feature matrix.",
            },
            {
              heading: "Customer 360 is a governed architecture",
              body: "A 360-degree customer view is not created by purchasing a product with “360” in its name. It requires stable customer identifiers, declared systems of record, a shared vocabulary, integration contracts, consent rules, and processes that keep the view useful. Core CRM can be the operational home for accounts, opportunities, and cases; Data Cloud can harmonize and resolve profiles from many sources; MuleSoft or APIs can connect systems that remain authoritative elsewhere.\n\nSeparate three meanings of “single source of truth”: one system may author an attribute, another may assemble the best current profile, and several applications may consume it. Document ownership at the attribute level. For example, ERP can author credit status, Service Cloud can author case history, and Data Cloud can assemble an activation profile without silently making CRM the master of every field.",
            },
            {
              heading: "Use a capability and value decision record",
              body: "For each candidate product, trace business outcome → persona → moment of work → required capability → authoritative data → integration → security → measurable KPI. Include nonfunctional needs such as volume, latency, availability, accessibility, localization, retention, and support ownership. Then compare native configuration, extension, integration, and custom-build options.\n\nA good decision record also states what will not be implemented. This limits duplicate portals, overlapping automation, and licenses bought “just in case.” Prototype the riskiest assumption—often external-user sharing, identity, or a cross-system transaction—before finalizing scope.",
              code: {
                language: "yaml",
                snippet:
                  "decision: Partner deal registration\noutcomes:\n  - reduce duplicate deal reviews\npersonas:\n  partner_seller: Experience Cloud external user\n  channel_manager: Sales Cloud internal user\ncapabilities:\n  submit_deal: Experience Cloud form\n  qualify_and_forecast: Sales Cloud opportunity\n  notify_status: Flow\nsystems_of_record:\n  partner_identity: corporate_identity_provider\n  opportunity: salesforce_crm\nsecurity:\n  record_access: partner-account-scoped\n  sensitive_fields: internal-only\nmeasures:\n  - median_review_time\n  - duplicate_submission_rate\nout_of_scope:\n  - partner_order_management",
                caption:
                  "A deployment-neutral architecture decision record that connects outcomes to products, data ownership, and access.",
              },
            },
            {
              heading: "Design the external boundary before the page",
              body: "Experience Cloud adds an external security and identity boundary. Decide who can self-register, how identities are verified and linked to accounts, which external license model fits the access pattern, and whether records are exposed through sharing sets, share groups, sharing rules, or another supported mechanism. External org-wide defaults should begin restrictive; guest access deserves an even smaller, explicitly reviewed surface.\n\nPage visibility and audience targeting personalize presentation, but they are not authorization. Object permissions, field-level security, record sharing, Apex enforcement, and integration credentials protect data. Also define content ownership, moderation, accessibility, analytics, incident response, and deprovisioning. A portal is a product with an operating model, not merely a published template.",
            },
          ],
          realWorld: {
            title: "One front door for a medical-equipment partner network",
            scenario:
              "A manufacturer had account teams tracking partner deals in Sales Cloud, support teams handling equipment cases in email, and distributors submitting requests through three disconnected forms. Leadership proposed buying every available cloud before agreeing on the target process.",
            solution:
              "The team mapped outcomes first. Sales Cloud remained the system for partner accounts and opportunities; Service Cloud became the case and knowledge workspace; Experience Cloud provided authenticated deal registration and support. Partner-account sharing was proven in a prototype, ERP retained order authority through an API, and Data Cloud was deferred until multi-source profile activation had a funded use case.",
            outcome:
              "Partners received one secure entry point, duplicate deal submissions fell, support gained complete case context, and the company avoided licensing and implementing capabilities that had no measurable first-phase outcome.",
          },
          keyTakeaways: [
            "Sales Cloud owns revenue work, Service Cloud owns service work, and Experience Cloud exposes selected processes to external audiences",
            "Customer 360 requires identity, data ownership, integration, consent, and governance—not a product checkbox",
            "Select products by measurable jobs and nonfunctional requirements, then document exclusions",
            "Attribute authorship and assembled-profile ownership can belong to different systems",
            "Audience targeting changes presentation; permissions and sharing enforce authorization",
          ],
          resources: [
            {
              title: "Salesforce End-to-End Front Office",
              url: "https://trailhead.salesforce.com/content/learn/modules/salesforce-end-to-end-front-office/get-to-know-the-salesforce-e2e-front-office",
              source: "trailhead",
              note: "Official overview of connected Customer 360 capabilities",
            },
            {
              title: "Service Cloud Platform Quick Look",
              url: "https://trailhead.salesforce.com/content/learn/modules/service-cloud-platform-quick-look/get-to-know-the-service-cloud-platform",
              source: "trailhead",
            },
            {
              title: "Expand Your Reach with Experience Cloud",
              url: "https://trailhead.salesforce.com/content/learn/trails/communities",
              source: "trailhead",
              note: "Official trail covering external experiences and secure CRM data sharing",
            },
          ],
        },
        {
          id: "modern-omnistudio-digital-experiences",
          title: "OmniStudio for scalable guided experiences",
          summary:
            "Compose guided interactions from focused UI, data-mapping, and orchestration components, with explicit contracts and performance budgets.",
          durationMinutes: 34,
          objectives: [
            "Assign clear responsibilities to OmniScripts, FlexCards, Data Mappers, and Integration Procedures",
            "Design a layered digital experience that can span Salesforce and external data",
            "Apply payload, transaction, caching, error, and security patterns for scale",
            "Plan reusable components, tests, observability, and source-driven promotion",
          ],
          sections: [
            {
              heading: "Four components, four responsibilities",
              body: "An OmniScript is a guided, multi-step interaction: collect inputs, branch, validate, and invoke work. A FlexCard presents contextual data and actions in a compact, reusable UI. A Data Mapper reads, transforms, or writes Salesforce data through declared mappings. An Integration Procedure orchestrates server-side work across Data Mappers, APIs, and Apex and returns a response shaped for its consumer.\n\nKeep these boundaries crisp. The UI should not know five backend schemas; an Integration Procedure should return a purpose-built contract. A Data Mapper should map data, not become an undocumented business-policy engine. Reusable OmniScripts and FlexCards should receive explicit inputs instead of depending on hidden page state.",
            },
            {
              heading: "Build a contract-first experience stack",
              body: "Start with the smallest input and output contract for each user moment. A FlexCard can show policy status and launch an OmniScript. The OmniScript gathers only the fields needed at each step. One Integration Procedure can coordinate customer lookup, eligibility, and persistence, using Data Mappers for Salesforce reads and writes and an authenticated integration for external data.\n\nVersion and document the contract independently of labels and screen order. Return stable status codes, user-safe messages, and correlation identifiers; do not expose raw downstream errors. Keep secrets and endpoints in supported credential/configuration facilities, never in component formulas.",
              code: {
                language: "yaml",
                snippet:
                  "experience: ClaimIntake\nentry:\n  flexCard: PolicySummary\n  action: LaunchClaimOmniScript\nui:\n  omniScript: ClaimIntake\n  inputs: [policyId, contactId]\n  steps: [verify_identity, incident, evidence, review]\nserver:\n  integrationProcedure: ClaimIntakeService\n  operations:\n    - dataMapper: ReadPolicyContext\n    - api: CheckCoverage\n    - dataMapper: UpsertClaim\ncontract:\n  response: [claimId, status, nextAction, correlationId]\n  excludes: [internalRiskScore, rawProviderError]",
                caption:
                  "A practical component blueprint; actual metadata is configured and promoted with the supported OmniStudio tooling.",
              },
            },
            {
              heading: "Performance and resilience are design inputs",
              body: "Reduce round trips by aggregating related server work in an Integration Procedure, but do not create a giant procedure that couples unrelated journeys. Request and return only fields the screen uses. Load later-step data only when needed, keep repeated reference reads cacheable where the data and runtime permit it, and move genuinely long-running work to an appropriate asynchronous boundary rather than holding an interactive transaction open.\n\nDefine timeouts, retry ownership, idempotency keys for writes, and partial-failure behavior. Retrying a read can be safe; blindly retrying “create order” can duplicate a transaction. Platform limits and cache behavior vary by runtime and entitlement, so use current official guidance and test with production-like payloads, concurrency, and downstream latency.",
            },
            {
              heading: "Secure, test, and operate the whole journey",
              body: "Every layer must enforce the caller’s intended authority. Review object and field access for Data Mapper operations, sharing behavior and user context for Apex, credentials and allowlisted destinations for callouts, and data returned to external users. Treat browser-supplied identifiers and hidden fields as untrusted; re-derive ownership and eligibility on the server.\n\nTest components in layers: mapping fixtures for Data Mappers, contract tests for Integration Procedures, branch and validation tests for OmniScripts, accessibility and responsive checks for UI, then end-to-end tests for the critical path. Promote activated versions through source control and supported deployment tooling. Monitor latency, failure category, abandonment by step, and downstream correlation IDs so a “spinner” can be traced beyond the browser.",
            },
          ],
          realWorld: {
            title:
              "Claims intake that remains usable during a provider slowdown",
            scenario:
              "An insurer built a single browser-heavy form that called policy, identity, and document services separately. Mobile users waited through repeated calls, provider timeouts produced generic errors, and retries created duplicate claims.",
            solution:
              "The team rebuilt the journey as an OmniScript launched from a policy FlexCard. A contract-focused Integration Procedure combined reads, Data Mappers handled Salesforce mapping, and claim creation used an idempotency key. Evidence upload was isolated from the core save, errors carried correlation IDs, and performance tests included slow-provider cases.",
            outcome:
              "The initial payload became smaller, duplicate claims stopped, users could recover from document-service failures without re-entering the incident, and support could trace each failure across Salesforce and the provider.",
          },
          keyTakeaways: [
            "OmniScripts guide interactions; FlexCards present context and actions",
            "Data Mappers map Salesforce data; Integration Procedures orchestrate server-side work",
            "Stable, minimal contracts decouple the experience from backend schemas",
            "Retries for writes require idempotency and explicit ownership",
            "Security, accessibility, performance, and telemetry must be tested end to end",
          ],
          resources: [
            {
              title: "OmniStudio Overview",
              url: "https://developer.salesforce.com/docs/atlas.en-us.industries_reference.meta/industries_reference/omnistudio_overview.htm",
              source: "developer",
            },
            {
              title: "OmniStudio Integration Procedure APIs",
              url: "https://developer.salesforce.com/docs/atlas.en-us.industries_reference.meta/industries_reference/omnistudio_integration_procedure_apis.htm",
              source: "developer",
            },
            {
              title: "OmniStudio Data Mapper APIs",
              url: "https://developer.salesforce.com/docs/atlas.en-us.industries_reference.meta/industries_reference/omnistudio_data_mapper_apis.htm",
              source: "developer",
            },
          ],
        },
      ],
      quizBank: [
        {
          id: "modern-q-experience-1",
          topic: "Cloud selection",
          prompt:
            "A company needs case queues, knowledge, entitlements, and agent routing. Which product should own that core workload?",
          options: [
            "Sales Cloud",
            "Service Cloud",
            "Experience Cloud alone",
            "Data Cloud alone",
          ],
          correctIndex: 1,
          explanation:
            "Those are service-lifecycle capabilities. Experience Cloud can expose self-service, but Service Cloud owns the underlying case and agent workload.",
        },
        {
          id: "modern-q-experience-2",
          topic: "Experience Cloud",
          prompt:
            "What is the strongest reason to add Experience Cloud to a partner-sales solution?",
          options: [
            "It replaces all opportunity management",
            "It gives external partners a governed experience over selected CRM data and processes",
            "It automatically becomes the system of record for orders",
            "It removes the need for record sharing",
          ],
          correctIndex: 1,
          explanation:
            "Experience Cloud is the external experience layer. It reuses selected platform data and processes but still requires explicit ownership and sharing.",
        },
        {
          id: "modern-q-experience-3",
          topic: "Customer 360",
          prompt:
            "Which statement best describes a durable Customer 360 architecture?",
          options: [
            "Every customer attribute must be authored in one Salesforce object",
            "Buying all Salesforce clouds automatically unifies every identity",
            "Systems of record, identifiers, integration, consent, and profile assembly are explicitly governed",
            "A dashboard joins exported spreadsheets once a quarter",
          ],
          correctIndex: 2,
          explanation:
            "A useful 360 view is an operating and data architecture. Product ownership alone does not resolve identity, stewardship, or consent.",
        },
        {
          id: "modern-q-experience-4",
          topic: "Product strategy",
          prompt: "What should lead a Salesforce product-selection decision?",
          options: [
            "The longest feature list",
            "A measurable outcome, persona journey, data authority, and nonfunctional requirements",
            "The product with the newest branding",
            "A goal to eliminate every external system",
          ],
          correctIndex: 1,
          explanation:
            "Outcome-to-capability traceability reveals the smallest coherent product set and the integration and operating model it actually needs.",
        },
        {
          id: "modern-q-experience-5",
          topic: "OmniScripts",
          prompt:
            "Which OmniStudio component primarily implements a guided, branching, multi-step interaction?",
          options: [
            "FlexCard",
            "OmniScript",
            "Data Mapper",
            "Calculated Insight",
          ],
          correctIndex: 1,
          explanation:
            "OmniScripts guide users through steps, validation, branching, and actions. FlexCards are compact contextual displays.",
        },
        {
          id: "modern-q-experience-6",
          topic: "FlexCards",
          prompt: "What is a FlexCard best suited to do?",
          options: [
            "Resolve customer identities across data sources",
            "Display contextual data and launch relevant actions",
            "Replace every server-side integration",
            "Define org-wide defaults",
          ],
          correctIndex: 1,
          explanation:
            "A FlexCard is a reusable presentation component for contextual data and actions, often launching an OmniScript.",
        },
        {
          id: "modern-q-experience-7",
          topic: "Integration Procedures",
          prompt:
            "A journey must combine Salesforce data, an external eligibility API, and a shaped response. Where should that server-side orchestration live?",
          options: [
            "A page visibility rule",
            "An Integration Procedure",
            "A FlexCard label",
            "A sharing set",
          ],
          correctIndex: 1,
          explanation:
            "Integration Procedures coordinate multiple data sources and return a consumer-focused contract without pushing backend complexity into the UI.",
        },
        {
          id: "modern-q-experience-8",
          topic: "Resilient writes",
          prompt:
            "Why should a retried OmniStudio write carry an idempotency key?",
          options: [
            "To make the screen more colorful",
            "To prevent the same logical request from creating duplicate transactions",
            "To bypass field-level security",
            "To increase the response payload",
          ],
          correctIndex: 1,
          explanation:
            "Network and timeout retries can repeat a create operation. An idempotency key lets the server recognize and safely return the original result.",
        },
      ],
    },
    {
      id: "sf-modern-data-automation",
      title: "Data Cloud & Modern Automation",
      summary:
        "Move from raw source data to governed activation, and from fragmented legacy automation to observable Flow and multi-team orchestration.",
      lessons: [
        {
          id: "modern-data-cloud-lifecycle",
          title: "Data Cloud: ingest, harmonize, resolve, segment, activate",
          summary:
            "Design the complete Data Cloud lifecycle, including identity quality, consent, activation contracts, and ongoing governance.",
          durationMinutes: 38,
          objectives: [
            "Trace source data through data streams, DLOs, DMOs, unified profiles, segments, and activations",
            "Design match and reconciliation rules using measurable identity-quality hypotheses",
            "Distinguish segmentation membership from downstream activation and consent enforcement",
            "Define governance for lineage, access, data quality, retention, usage, and change control",
          ],
          sections: [
            {
              heading: "Ingestion preserves source meaning",
              body: "Data Cloud—called Data 360 in current Salesforce documentation—connects batch, streaming, and supported federated sources through data streams. Ingested data lands in Data Lake Objects (DLOs) in a source-oriented shape. Preserve source keys, event time, ingestion time, and provenance so records can be reconciled and replayed. Do not “clean” away evidence needed to understand what a source actually sent.\n\nChoose an ingestion pattern from business freshness and cost, not from a blanket demand for real time. A nightly loyalty balance may be sufficient while web abandonment needs a shorter path. Define schema-change ownership, late-arriving-event behavior, deletion propagation, monitoring, and recovery before turning on the feed.",
            },
            {
              heading: "Harmonization creates comparable meaning",
              body: "Map DLO fields into Data Model Objects (DMOs) based on the Customer 360 Data Model, extending it only when the business meaning truly differs. Individual, contact-point, engagement, and business entities must retain relationships and source identifiers. Standardized email, phone, country, timestamp, and consent semantics improve every later identity and segment decision.\n\nMapping is a semantic contract, not a drag-and-drop chore. Profile null rates, invalid values, uniqueness, referential integrity, and freshness before and after mapping. Calculated insights can derive reusable measures such as trailing spend or case frequency, but every metric needs a named owner, definition, grain, time window, and refresh expectation.",
            },
            {
              heading: "Identity resolution links; reconciliation selects",
              body: "Identity resolution applies match rules to decide which source profiles belong to the same person or account. Exact normalized email may be strong in one domain; shared household email may be unsafe in another. Fuzzy names should normally be combined with stronger evidence. Reconciliation rules then choose which value represents an attribute in the unified profile—for example a trusted-source priority or a recency strategy.\n\nSource records remain traceable; unification does not justify overwriting them. Establish labeled test pairs for true matches and true nonmatches, then measure false merges and missed matches. Review consolidation rates and sampled profiles whenever source quality or a ruleset changes. A false merge can disclose one person’s data to another, making identity quality a security concern as well as an analytics concern.",
            },
            {
              heading: "Segments and activations need policy gates",
              body: "A segment is a reproducible membership definition over eligible data; an activation publishes selected attributes and membership to a configured destination. Keep the activation payload minimal, map destination identifiers explicitly, and enforce consent, purpose, suppression, residency, and retention rules at the appropriate layers. A customer qualifying for “high value” does not imply permission to contact them in every channel.\n\nGovern the lifecycle through permissions, data spaces or equivalent separation where appropriate, lineage, classifications, usage monitoring, release records, and owner-approved changes. Preview counts and samples, reconcile destination totals, monitor refresh failures, and support deletion and consent changes through the full downstream path.",
              code: {
                language: "yaml",
                snippet:
                  "use_case: LoyaltyRenewal\nsource:\n  stream: commerce_orders\n  key: order_id\n  event_time: purchased_at\nmodel:\n  dlo: CommerceOrderDLO\n  dmos: [Individual, ContactPointEmail, SalesOrder]\nidentity:\n  match: normalized_email + loyalty_member_id\n  reconcile:\n    email: most_recent_consented_value\nsegment:\n  criteria: membership_expires_within_30_days AND consent_email\nactivation:\n  target: approved_marketing_destination\n  attributes: [unified_individual_id, loyalty_tier, expiry_date]\ngovernance:\n  owner: customer_data_team\n  controls: [lineage, quality_thresholds, suppression, deletion_propagation]\n  monitors: [freshness, match_quality, segment_count, delivery_failures]",
                caption:
                  "A lifecycle contract that keeps technical mapping, identity logic, purpose, and operational controls together.",
              },
            },
          ],
          realWorld: {
            title: "A retailer stops marketing to merged households",
            scenario:
              "A retailer joined store, ecommerce, and loyalty profiles on email alone. Shared family addresses caused false merges, opt-outs were not consistently propagated, and campaign counts differed sharply from destination delivery.",
            solution:
              "The data team retained source keys in DLOs, harmonized profile and consent fields into DMOs, and required loyalty ID plus normalized contact evidence for high-confidence matches. Reconciliation preferred the latest consented contact point from governed sources. Activation applied suppression and emitted only the destination fields required, with count reconciliation and deletion monitoring.",
            outcome:
              "False household merges dropped in the reviewed sample, opt-outs flowed through the activation path, campaign totals became explainable, and identity-rule changes entered the same tested change process as application code.",
          },
          keyTakeaways: [
            "DLOs retain source-oriented data; DMOs harmonize it into shared business meaning",
            "Match rules link profiles, while reconciliation rules choose representative attribute values",
            "Identity rules require labeled quality tests because false merges can become privacy incidents",
            "Segments define membership; activations publish approved data to a destination",
            "Consent, minimization, lineage, deletion, usage, and monitoring govern the whole lifecycle",
          ],
          resources: [
            {
              title: "Data 360 Architecture",
              url: "https://developer.salesforce.com/docs/data/data-cloud-dev/guide/dc-architecture.html",
              source: "developer",
              note: "Official end-to-end architecture, including identity, segmentation, and governance",
            },
            {
              title: "Model Data in Data 360",
              url: "https://developer.salesforce.com/docs/data/data-cloud-dmo-mapping/guide/c360dm-model-data.html",
              source: "developer",
              note: "DLO, DMO, and Customer 360 Data Model reference",
            },
            {
              title: "Map Data and Create Unified Profiles",
              url: "https://trailhead.salesforce.com/content/learn/modules/data-cloud-connect-and-unify/map-and-unify-data",
              source: "trailhead",
            },
          ],
        },
        {
          id: "modern-flow-orchestration-modernization",
          title: "Flow Orchestration, modern Flow & dynamic experiences",
          summary:
            "Choose the right Flow boundary, coordinate long-running human work, personalize record pages safely, and retire Process Builder without changing behavior by accident.",
          durationMinutes: 38,
          objectives: [
            "Select before-save, after-save, asynchronous, scheduled, screen, and autolaunched Flow patterns by transaction need",
            "Model multi-stage, multi-user processes with Flow Orchestration and observable work items",
            "Use Dynamic Forms and Dynamic Actions without confusing visibility with security",
            "Execute an inventory-led, regression-tested Process Builder migration",
          ],
          sections: [
            {
              heading: "Pick a Flow boundary by transaction semantics",
              body: "Use a before-save record-triggered flow for fast same-record field changes that need no additional DML. Use after-save when related records, notifications, actions, or orchestration are required. Use an asynchronous path or another supported async mechanism when work should leave the original transaction; use scheduled paths for time-relative work. Screen flows collect user input, while autolaunched flows expose reusable headless logic.\n\nKeep entry criteria selective, avoid queries and writes inside loops, process collections, use fault paths, and make retryable work idempotent. Put reusable policy in focused subflows or invocable actions, not in copied branches. Record trigger order and ownership. The right split between Flow and Apex depends on automation density, volume, complexity, and team skills—not a slogan that one tool must do everything.",
            },
            {
              heading: "Orchestrate work that outlives one transaction",
              body: "Flow Orchestration coordinates flows as steps grouped into sequential stages. Background steps run autolaunched flows; interactive steps run screen flows and create work items for assigned users, groups, or queues. Steps within a stage can support ordered or concurrent work, while stage exit conditions make the lifecycle explicit.\n\nUse orchestration for processes with durable handoffs, multiple teams, and operational monitoring: onboarding, claims, investigations, or complex approvals. Do not use it merely to wrap a few synchronous field updates. Define assignment fallbacks, due-time policy, rework and cancellation paths, version behavior for in-flight runs, and who monitors stuck runs and work items.",
            },
            {
              heading: "Dynamic Forms and Actions shape the moment of work",
              body: "Dynamic Forms place fields and sections as Lightning page components and apply visibility rules so each persona sees relevant detail at the right state. Dynamic Actions conditionally surface the actions most useful for that context. Use them to reduce page noise—for example showing escalation fields and “Request Review” only when a case is eligible.\n\nVisibility rules are presentation logic, not security. Field-level security, object permissions, and record sharing still decide what users may read or change. Avoid duplicating critical business policy in a page rule: a hidden button does not prevent an API call, and another page can expose the same action. Put authorization and invariant validation in enforceable platform layers.",
            },
            {
              heading: "Migrate Process Builder as a behavior change",
              body: "Inventory each process, its criteria, scheduled actions, field updates, invocable code, downstream automation, running interviews, and business owner. Group automation by object and outcome before conversion. The Migrate to Flow tooling can accelerate supported cases, but generated output still requires design review; cloning each legacy process one-for-one preserves fragmentation and uncertain ordering.\n\nCapture baseline scenarios, bulk behavior, user/system context, order of execution, faults, and timing. Build and test in a nonproduction environment, compare outcomes, choose a cutover and rollback plan, deactivate the legacy process only after validation, and monitor errors and business KPIs. Remove or archive obsolete automation after the agreed observation period.",
              code: {
                language: "yaml",
                snippet:
                  "automation: OpportunityLifecycle\nowner: revenue_operations\nentry_point:\n  type: record_triggered_flow\n  object: Opportunity\n  order: documented_team_sequence\npaths:\n  before_save: [derive_review_status]\n  after_save: [create_review_task]\n  asynchronous: [publish_analytics_event]\nui:\n  dynamic_fields: review_status == required\n  dynamic_action: Request_Review\norchestration:\n  stages: [sales_review, finance_review, fulfillment]\nmigration:\n  replaces: [legacy_discount_process]\n  tests: [single_update, bulk_update, recursion, scheduled_action, fault]\n  rollback: reactivate_legacy_version_and_disable_new_entry_point\nmonitoring: [flow_errors, stuck_work_items, approval_cycle_time]",
                caption:
                  "An automation catalog entry that makes transaction boundaries, UI behavior, migration evidence, and operations reviewable.",
              },
            },
          ],
          realWorld: {
            title: "A discount approval becomes an observable lifecycle",
            scenario:
              "An enterprise had four Process Builder processes, two flows, and a page-layout button updating the same Opportunity approval fields. Bulk imports caused duplicate tasks, finance handoffs lived in email, and nobody could tell where approvals stalled.",
            solution:
              "The team inventoried behavior and consolidated the entry criteria. A before-save flow derived review status, an after-save flow launched a Flow Orchestration for sales and finance work, and Dynamic Forms exposed only the relevant review section. Legacy processes were retired in controlled slices after bulk and timing regression tests.",
            outcome:
              "Duplicate tasks stopped, reviewers received trackable work items, cycle-time bottlenecks became visible by stage, and future changes had one owned automation map instead of seven competing entry points.",
          },
          keyTakeaways: [
            "Choose Flow types by transaction, timing, interaction, and volume requirements",
            "Flow Orchestration is for durable stages, automated steps, and human work items",
            "Dynamic Forms and Actions personalize presentation but never replace authorization",
            "Bulk-safe collections, selective entry, fault paths, idempotency, and monitoring are production Flow basics",
            "Process Builder migration starts with behavior inventory and ends with monitored cutover—not automatic conversion",
          ],
          resources: [
            {
              title: "Record-Triggered Automation Decision Guide",
              url: "https://architect.salesforce.com/docs/architect/decision-guides/guide/record-triggered",
              source: "architect",
            },
            {
              title: "Building Forms Decision Guide",
              url: "https://architect.salesforce.com/docs/architect/decision-guides/guide/build-forms",
              source: "architect",
              note: "Official comparison of Dynamic Forms, Flow, OmniStudio, and LWC",
            },
            {
              title: "Build a Flow Orchestration",
              url: "https://trailhead.salesforce.com/content/learn/modules/build-a-flow-orchestration/identify-business-uses-for-flow-orchestration",
              source: "trailhead",
            },
          ],
        },
      ],
      quizBank: [
        {
          id: "modern-q-data-auto-1",
          topic: "Data Cloud objects",
          prompt: "What is the clearest distinction between a DLO and a DMO?",
          options: [
            "A DLO is source-oriented storage; a DMO expresses harmonized business meaning",
            "A DLO is a dashboard; a DMO is a user license",
            "A DLO contains only segments; a DMO contains only activations",
            "There is no architectural distinction",
          ],
          correctIndex: 0,
          explanation:
            "Data streams land in Data Lake Objects, while mappings standardize that data into Data Model Objects used across the Customer 360 model.",
        },
        {
          id: "modern-q-data-auto-2",
          topic: "Identity resolution",
          prompt:
            "In identity resolution, what do reconciliation rules decide?",
          options: [
            "Which sources can connect to Data Cloud",
            "Which profiles belong to the same person",
            "Which representative attribute value is selected after profiles are linked",
            "Which users receive an orchestration work item",
          ],
          correctIndex: 2,
          explanation:
            "Match rules link source profiles. Reconciliation rules determine the value represented on the unified profile when sources disagree.",
        },
        {
          id: "modern-q-data-auto-3",
          topic: "Identity quality",
          prompt:
            "Why must identity-resolution changes be tested with known match and nonmatch pairs?",
          options: [
            "To make ingestion real time",
            "To measure false merges and missed matches rather than trusting consolidation rate alone",
            "To bypass consent checks",
            "To eliminate source identifiers",
          ],
          correctIndex: 1,
          explanation:
            "A high consolidation rate can hide dangerous false merges. Labeled examples reveal both incorrect links and missed legitimate links.",
        },
        {
          id: "modern-q-data-auto-4",
          topic: "Activation",
          prompt:
            "A profile qualifies for a high-value segment. What must still be checked before email activation?",
          options: [
            "Whether every source field can be exported",
            "Channel consent, purpose, suppression, and the minimum destination payload",
            "Whether the user owns an Opportunity",
            "Whether a FlexCard is activated",
          ],
          correctIndex: 1,
          explanation:
            "Segment membership is not permission to contact. Activation must enforce consent and purpose and send only required attributes.",
        },
        {
          id: "modern-q-data-auto-5",
          topic: "Record-triggered Flow",
          prompt:
            "Which Flow pattern best fits a same-record field derivation before the record is saved?",
          options: [
            "Before-save record-triggered flow",
            "Flow Orchestration interactive step",
            "Scheduled flow one week later",
            "Experience Cloud audience rule",
          ],
          correctIndex: 0,
          explanation:
            "Before-save flows efficiently update fields on the triggering record without a separate update operation.",
        },
        {
          id: "modern-q-data-auto-6",
          topic: "Flow Orchestration",
          prompt:
            "What does an interactive step in Flow Orchestration use to obtain human input?",
          options: [
            "A calculated insight",
            "A screen flow presented as an assigned work item",
            "A before-save flow with no UI",
            "A Data Mapper",
          ],
          correctIndex: 1,
          explanation:
            "Interactive steps run screen flows and create work items for assigned users, groups, or queues.",
        },
        {
          id: "modern-q-data-auto-7",
          topic: "Dynamic Forms",
          prompt:
            "Which statement about a Dynamic Forms visibility rule is correct?",
          options: [
            "It replaces field-level security",
            "It is presentation logic; enforce data access with permissions and sharing",
            "It blocks all API access to a hidden field",
            "It grants object Create permission",
          ],
          correctIndex: 1,
          explanation:
            "Component visibility controls what a page renders. It does not authorize records or fields across APIs, reports, or other pages.",
        },
        {
          id: "modern-q-data-auto-8",
          topic: "Process Builder migration",
          prompt:
            "What is the safest first step in a Process Builder migration?",
          options: [
            "Deactivate every process in production",
            "Convert every process one-for-one and skip regression tests",
            "Inventory criteria, actions, timing, context, dependencies, and owners",
            "Move all logic into one screen flow",
          ],
          correctIndex: 2,
          explanation:
            "An inventory establishes current behavior and dependencies. Without it, conversion can change ordering, timing, context, and side effects.",
        },
      ],
    },
    {
      id: "sf-modern-agentic-trust",
      title: "Agentforce, Einstein & Trusted Operations",
      summary:
        "Ground agent reasoning in approved data, expose bounded actions, preserve human control, and operate AI with security and evidence.",
      lessons: [
        {
          id: "modern-agentforce-einstein-architecture",
          title: "Agentforce & Einstein: grounded reasoning and safe action",
          summary:
            "Design the full agent loop—from topic scope and grounding to deterministic tools, confirmation, and context-rich human handoff.",
          durationMinutes: 38,
          objectives: [
            "Explain how Agentforce reasoning, Einstein generative services, grounding, and actions fit together",
            "Design focused topics or subagents with evidence-based prompts and bounded tool access",
            "Wrap Flow, Apex, and integration capabilities as clear, deterministic agent actions",
            "Implement human handoff that preserves context, authority, and customer choice",
          ],
          sections: [
            {
              heading: "Separate reasoning from authority",
              body: "An Agentforce experience begins at a channel and routes a request into a scoped topic or subagent. Instructions and conversation context guide a reasoning engine; grounding adds approved business evidence; a model proposes a response or tool choice; actions invoke deterministic platform capabilities; observations return results for the next step. Einstein generative services and the Einstein Trust Layer support the model interaction, while Agentforce adds the agentic planning and action loop.\n\nThe model can decide among allowed tools, but it should not create its own authority. Salesforce permissions, action runtime context, validation, approval policy, and downstream systems determine what actually happens. Keep topic scope narrow enough to test, and make “cannot safely complete” a designed state rather than encouraging improvisation.",
            },
            {
              heading: "Ground prompts with the least necessary evidence",
              body: "Grounding can draw from CRM records, knowledge, Data Cloud, prompt-template inputs, or approved retrieval services. Retrieve evidence using the caller’s authorized context where supported, filter by status and audience, and prefer current, owned content. Include stable identifiers and effective dates so an answer can be traced. More context is not automatically better: irrelevant records consume the context window and can steer the model toward the wrong policy.\n\nTreat retrieved text as untrusted data, especially web pages, attachments, emails, and knowledge imported from outside. Instructions found inside that content must not override system policy. Prompt templates should state the job, evidence boundaries, required output, uncertainty behavior, and when to ask, confirm, refuse, or hand off. Evaluate the assembled prompt and retrieval results, not just the template text.",
            },
            {
              heading: "Actions are typed, least-privilege contracts",
              body: "Agent actions can wrap Flow, Apex, prompt templates, APIs, or integration assets. Give each action a precise name and description, typed inputs, a minimal output, explicit errors, and one business responsibility. Validate all model-supplied arguments server-side. Use allowlists for state transitions and destination systems; never convert free-form model text directly into unrestricted SOQL, URLs, recipients, or code.\n\nRead actions and reversible drafts can require lighter controls. Financial, destructive, identity-changing, or externally visible writes should use deterministic eligibility checks and often explicit user or human confirmation. Make writes idempotent and auditable. Return structured outcomes such as `completed`, `needs_confirmation`, `not_authorized`, or `temporarily_unavailable` so the agent does not invent success after a tool failure.",
            },
            {
              heading: "Handoff is a first-class action",
              body: "Escalate when the user asks, identity or consent is unresolved, evidence conflicts, confidence or policy thresholds fail, a sensitive exception appears, or a required tool is unavailable. A useful handoff carries the authenticated customer and channel, concise issue summary, relevant records, evidence consulted, actions attempted and their results, promised follow-up, and the reason for transfer. Do not force the customer to repeat the entire conversation.\n\nFor service use cases, Agentforce can transfer through an active Omni-Channel connection. Routing availability, queue fallback, after-hours behavior, transcript access, and ownership must be configured and tested. The following Agent Script extract illustrates bounded tools and the escalation utility; referenced actions, variables, and the messaging connection are declared elsewhere in the agent definition.",
              code: {
                language: "yaml",
                snippet:
                  'subagent order_support:\n    description: "Answer order questions and request approved changes"\n    reasoning:\n        instructions: ->\n            | Use retrieved order facts; never guess fulfillment dates.\n            | Confirm the order and requested change before any write.\n            | Call {!@actions.escalate_to_human} on request, conflict, or unsafe uncertainty.\n        actions:\n            lookup_order: @actions.lookup_order\n                description: "Read one order the verified customer is authorized to view"\n            request_address_change: @actions.request_address_change\n                description: "Submit a validated, confirmed change request; never edit shipment history"\n            escalate_to_human: @utils.escalate\n                description: "Transfer the conversation with context to a service representative"\n                available when @variables.handoff_available',
                caption:
                  "An illustrative Agent Script pattern using precise tools and the supported escalation utility.",
              },
            },
          ],
          realWorld: {
            title: "An order agent that never invents a shipment promise",
            scenario:
              "A distributor piloted an order-status assistant that answered from general product text. It guessed delivery dates when ERP data was late and accepted address changes without checking shipment state, creating operational and fraud risk.",
            solution:
              "The replacement agent used a narrow order-support topic, grounded responses in authorized order and logistics records, and exposed separate read and address-change-request actions. The write action revalidated identity and status, required confirmation, and was idempotent. Conflicting dates, blocked changes, user requests, and tool outages transferred to an Omni-Channel queue with a structured summary.",
            outcome:
              "Unsupported delivery promises disappeared from the evaluation set, duplicate changes were prevented, agents received useful context at handoff, and the team could improve retrieval and actions independently of the conversational wording.",
          },
          keyTakeaways: [
            "Reasoning chooses among permitted options; deterministic controls grant authority",
            "Grounding should be authorized, relevant, current, traceable, and resistant to injected instructions",
            "Agent actions need narrow contracts, server-side validation, explicit errors, and idempotent writes",
            "Sensitive actions deserve eligibility checks and confirmation outside model discretion",
            "Human handoff needs explicit triggers, routing, context transfer, and fallback behavior",
          ],
          resources: [
            {
              title: "Agentforce Architecture Fundamentals",
              url: "https://architect.salesforce.com/docs/architect/fundamentals/guide/get-started-agentforce.html",
              source: "architect",
            },
            {
              title: "Agent Script Actions Reference",
              url: "https://developer.salesforce.com/docs/ai/agentforce/guide/ascript-ref-actions.html",
              source: "developer",
            },
            {
              title: "Agent Script Utilities and Human Escalation",
              url: "https://developer.salesforce.com/docs/ai/agentforce/guide/ascript-ref-utils.html",
              source: "developer",
            },
          ],
        },
        {
          id: "modern-trusted-ai-operations",
          title: "Trusted AI: security, evaluation & observability",
          summary:
            "Turn trust principles into enforceable controls, adversarial tests, privacy-aware telemetry, release gates, and incident response.",
          durationMinutes: 38,
          objectives: [
            "Threat-model grounded agents across prompts, retrieval, models, actions, identities, and downstream systems",
            "Apply Einstein Trust Layer controls alongside least privilege and policy enforcement",
            "Define offline evaluations and production telemetry for quality, safety, reliability, cost, and business value",
            "Operate agents with staged release, human oversight, audit evidence, kill switches, and incident playbooks",
          ],
          sections: [
            {
              heading:
                "Trust Layer controls are a foundation, not the whole control plane",
              body: "The Einstein Trust Layer provides capabilities such as secure grounding, supported sensitive-data masking, toxicity detection, audit and feedback data, and zero-data-retention agreements with supported third-party model providers. Exact behavior depends on configuration, region, language, model, and product support; verify current documentation and contracts. Detection is probabilistic, so a “not detected” result is not proof that content is safe.\n\nAdd an application threat model: direct and indirect prompt injection, unauthorized retrieval, poisoned knowledge, cross-customer leakage, sensitive output, harmful content, fabricated facts, excessive agency, tool-argument manipulation, duplicate writes, model or dependency outage, and abusive consumption. Map each threat to prevention, detection, response, evidence owner, and residual risk.",
            },
            {
              heading: "Propagate identity and minimize every privilege",
              body: "Define whose authority each retrieval and action uses: the end user, an agent service principal, an integration user, or a human approver. Preserve end-user identity across agent, API, and downstream hops where the architecture supports it. If a service identity is necessary, constrain it with dedicated permission sets, sharing, credential scopes, record filters, action allowlists, and transaction-level policy checks.\n\nClassify data before grounding and logging. Exclude secrets and unnecessary regulated fields, enforce object/field/record access, use approved credentials and endpoints, and redact telemetry. A model instruction such as “do not reveal salary” is not an access control. The salary field should be absent unless an authorized use case explicitly requires it.",
            },
            {
              heading: "Observe quality, safety, reliability, and value",
              body: "Build a versioned evaluation set from representative, boundary, multilingual, adversarial, and previously failed cases. Score grounded correctness, evidence relevance, policy compliance, action choice, argument accuracy, confirmation behavior, handoff quality, and harmful-data leakage. Human review remains essential for nuanced or high-impact outcomes; model-based grading can assist but should itself be calibrated.\n\nProduction telemetry should connect conversation and agent version to retrieval sources, tool calls, structured outcomes, latency, errors, retries, handoffs, user feedback, policy signals, and cost or consumption—without retaining unnecessary sensitive text. Monitor distributions and trends, not only averages: action failure by version, unsupported-answer samples, p95 latency, repeat-contact rate, containment with quality, and business outcome. A high containment rate is harmful if customers are simply trapped.",
            },
            {
              heading: "Release and respond like a production system",
              body: "Assign business, technical, data, security, and content owners. Promote versioned prompts, topics, retrieval settings, and actions through review and testing. Start with internal or limited audiences, low-risk read use cases, and conservative action scopes; expand only when evidence meets defined release gates. Maintain change records and periodically re-evaluate after model, data, policy, or integration changes.\n\nProvide a fast way to disable an action, topic, channel, or agent without waiting for a full deployment. Incident playbooks should cover triage, evidence preservation, access revocation, customer remedy, rollback, data correction, and post-incident evaluation additions. The sample policy below is an operating contract, not a substitute for enforceable Salesforce and gateway configuration.",
              code: {
                language: "json",
                snippet:
                  '{\n  "agent": "OrderSupport",\n  "riskTier": "customer-facing-transactional",\n  "allowedActions": ["lookup_order", "request_address_change"],\n  "confirmationRequired": ["request_address_change"],\n  "grounding": {\n    "approvedSources": ["Published_Knowledge", "Authorized_Order_API"],\n    "excludeDataClasses": ["credentials", "payment_card_full"]\n  },\n  "releaseGates": {\n    "criticalPolicyViolations": 0,\n    "actionArgumentTestsPass": true,\n    "humanReviewApproved": true\n  },\n  "alerts": ["authorization_denied_spike", "action_failure_spike", "safety_signal"],\n  "killSwitches": ["agent", "topic", "action"],\n  "evidenceOwner": "AI_Operations"\n}',
                caption:
                  "A reviewable AI operating policy; production controls must also be enforced in permissions, actions, gateways, and runtime settings.",
              },
            },
          ],
          realWorld: {
            title: "A bank contains an indirect prompt-injection attempt",
            scenario:
              "A banking assistant retrieved a customer-uploaded document containing hidden instructions to ignore policy and call an address-change tool. Early tests measured only friendly-answer quality and logged complete prompts containing unnecessary personal data.",
            solution:
              "The bank treated retrieved documents as untrusted, separated instructions from evidence, restricted the tool to a validated and confirmed request object, propagated customer identity, and required a deterministic account-state check. Telemetry was redacted and linked to versions and tool outcomes. Adversarial documents entered a release-gate suite, and operations gained per-action and per-agent kill switches.",
            outcome:
              "The injected instruction could not authorize a change, security could trace the denied attempt without exposing full document contents, and the same attack became a permanent regression test before every agent release.",
          },
          keyTakeaways: [
            "Trust Layer protections reduce risk but do not replace authorization, threat modeling, or human oversight",
            "Model instructions are not security controls; minimize retrieved data and enforce permissions at every action",
            "Evaluate retrieval, reasoning, tool arguments, confirmations, and handoffs—not just fluent answers",
            "Privacy-aware traces must connect versions, evidence, actions, outcomes, latency, and policy signals",
            "Staged rollout, accountable owners, kill switches, and incident playbooks make AI operable",
          ],
          resources: [
            {
              title: "Einstein Trust Layer",
              url: "https://developer.salesforce.com/docs/ai/agentforce/guide/trust.html",
              source: "developer",
            },
            {
              title: "Trusted Agentic AI",
              url: "https://trailhead.salesforce.com/content/learn/modules/trusted-agentic-ai/discover-how-salesforce-builds-trusted-agentic-ai",
              source: "trailhead",
            },
            {
              title: "End-User Identity Propagation in Agents",
              url: "https://architect.salesforce.com/docs/architect/fundamentals/guide/end-user-identity-propagation",
              source: "architect",
            },
          ],
        },
      ],
      quizBank: [
        {
          id: "modern-q-ai-trust-1",
          topic: "Agent architecture",
          prompt:
            "Which component should ultimately authorize an Agentforce write?",
          options: [
            "The model deciding that the request sounds reasonable",
            "A deterministic action enforcing identity, permissions, validation, and policy",
            "The longest topic instruction",
            "A user-interface visibility rule",
          ],
          correctIndex: 1,
          explanation:
            "Reasoning can select a tool, but enforceable code and platform controls decide whether a write is authorized.",
        },
        {
          id: "modern-q-ai-trust-2",
          topic: "Grounding",
          prompt:
            "What is the safest treatment of instructions found inside a retrieved customer document?",
          options: [
            "Treat them as higher priority than agent policy",
            "Execute them if they mention an available action",
            "Treat them as untrusted data that cannot override system or topic instructions",
            "Add more documents until the instructions disappear",
          ],
          correctIndex: 2,
          explanation:
            "Retrieved content can contain indirect prompt injection. It is evidence, not a trusted instruction source.",
        },
        {
          id: "modern-q-ai-trust-3",
          topic: "Agent actions",
          prompt: "Which action design is most production-ready?",
          options: [
            "execute_any_query(freeFormText)",
            "update_any_record(json)",
            "request_address_change(orderId, validatedAddress, idempotencyKey) with explicit outcomes",
            "call_url(urlFromConversation)",
          ],
          correctIndex: 2,
          explanation:
            "The narrow typed action limits authority, supports validation and deduplication, and returns outcomes the agent can handle safely.",
        },
        {
          id: "modern-q-ai-trust-4",
          topic: "Human handoff",
          prompt: "What should a high-quality human handoff include?",
          options: [
            "Only the last customer message",
            "A request that the customer repeat everything",
            "Identity context, issue summary, evidence, attempted actions, results, and transfer reason",
            "The model hidden prompt and every unrelated record",
          ],
          correctIndex: 2,
          explanation:
            "A concise, authorized context package lets the human continue safely without losing history or exposing unnecessary data.",
        },
        {
          id: "modern-q-ai-trust-5",
          topic: "Einstein Trust Layer",
          prompt:
            "Which statement about Trust Layer toxicity detection is technically responsible?",
          options: [
            "A clean score proves the response is harmless",
            "Detection is one probabilistic signal and must be combined with policy, testing, and oversight",
            "It replaces record-level security",
            "It authorizes agent actions",
          ],
          correctIndex: 1,
          explanation:
            "Safety classifiers can miss context and language variants. They are valuable signals, not proof or authorization controls.",
        },
        {
          id: "modern-q-ai-trust-6",
          topic: "Least privilege",
          prompt:
            "Why is “never reveal salary” in a prompt insufficient protection?",
          options: [
            "Prompts cannot contain words",
            "Instructions are not access controls; unauthorized salary data should not be retrieved or exposed to the action",
            "Salary is always public in Salesforce",
            "A longer prompt grants field-level security",
          ],
          correctIndex: 1,
          explanation:
            "Security must be enforced through data minimization, permissions, sharing, and action policy, even if the model ignores or is tricked around an instruction.",
        },
        {
          id: "modern-q-ai-trust-7",
          topic: "AI observability",
          prompt:
            "Which metric set gives the most useful operational view of an agent?",
          options: [
            "Message count only",
            "Containment rate only",
            "Versioned quality, policy signals, tool outcomes, handoffs, latency, feedback, and business results",
            "The number of words in each response",
          ],
          correctIndex: 2,
          explanation:
            "No single metric captures safety or value. Linked quality, action, reliability, human, and outcome evidence reveals regressions and trade-offs.",
        },
        {
          id: "modern-q-ai-trust-8",
          topic: "AI operations",
          prompt:
            "Why should teams maintain separate agent, topic, and action kill switches?",
          options: [
            "To avoid all testing",
            "To contain the smallest unsafe capability quickly while preserving safe service where appropriate",
            "To give the model more permissions",
            "To bypass incident evidence collection",
          ],
          correctIndex: 1,
          explanation:
            "Granular controls let operations disable a failing write or topic immediately without necessarily removing every safe read-only capability.",
        },
      ],
    },
  ],
};
