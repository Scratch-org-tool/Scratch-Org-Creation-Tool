import type { CurriculumPath } from './curriculum.types';

/**
 * Path 8 — Architect & DevOps Mastery (Expert).
 * Large data volumes, enterprise sharing, integration and identity
 * architecture, and the source-driven DevOps discipline this very platform
 * exists to automate.
 */
export const architectPath: CurriculumPath = {
  id: 'sf-architect',
  title: 'Architect & DevOps Mastery',
  tagline: 'Design for scale, integrate with intent, release with confidence.',
  description:
    'The expert path: how Salesforce behaves at millions of records and thousands of users, how to architect integrations and identity across an enterprise landscape, and how modern teams deliver change through source control, scratch orgs, and CI/CD pipelines. Think in trade-offs, document decisions, and design what the platform rewards.',
  level: 'expert',
  category: 'salesforce',
  badge: 'Architect Mastery',
  estimatedHours: 12,
  skills: [
    'Large data volumes',
    'Enterprise sharing design',
    'Integration architecture',
    'Identity & SSO',
    'Salesforce DX & CI/CD',
    'Governance',
  ],
  modules: [
    {
      id: 'sf-arch-data',
      title: 'Data & Sharing Architecture at Scale',
      summary:
        'What changes at 10 million rows: query selectivity, skew, sharing recalculation, and lifecycle strategies.',
      lessons: [
        {
          id: 'arch-ldv',
          title: 'Large Data Volumes: designing for millions of rows',
          summary:
            'Indexes, skinny tables, selective queries, and the data-skew patterns that quietly destroy performance.',
          durationMinutes: 22,
          objectives: [
            'Predict query behavior at scale using selectivity rules',
            'Recognize and prevent ownership, lookup, and account data skew',
            'Apply LDV mitigations: indexes, skinny tables, divisions, async patterns',
          ],
          sections: [
            {
              heading: 'Selectivity is everything',
              body:
                'Under the hood every object is stored in generic multi-tenant tables, and the Lightning Platform query optimizer decides per query whether an index can be used. Standard indexes cover Id, Name, OwnerId, CreatedDate, SystemModstamp, lookup and master-detail fields, and external IDs; custom indexes can be requested on other fields.\n\nA filter is selective roughly when it returns under 10% of the first million rows and 5% thereafter (capped). Non-selective filters on big tables trigger full scans: timeouts in reports, list views, SOQL. The Query Plan tool exposes the optimizer\'s costing — architects read it the way DBAs read explain plans.',
            },
            {
              heading: 'Data skew: the three flavors',
              body:
                'Ownership skew: one user (usually an integration user) owning hundreds of thousands of records — any role/ownership change recalculates sharing for all of them, locking rows for minutes. Account skew: tens of thousands of children under one account — updates to children fight to lock the same parent. Lookup skew: one lookup target referenced by enormous numbers of records — same locking problem via a side door.\n\nMitigations: distribute ownership across a pool of integration users placed at the top of the role hierarchy (or outside it), split mega-accounts into logical sub-accounts, and introduce "bucket" records or nullable lookups to spread lookup targets.',
            },
            {
              heading: 'The LDV toolbox',
              body:
                'Skinny tables (Salesforce-provisioned narrow copies of hot fields) accelerate specific report/query workloads. Divisions partition extremely large orgs. Deferred sharing calculation batches recalc during maintenance windows for mass ownership changes. Bulk API with PK chunking extracts giant tables reliably.\n\nAbove all: keep the working set small — archive aggressively (next lessons), summarize instead of storing detail forever, and question every "keep everything in Salesforce forever" requirement. The cheapest query is against a row that is not there.',
            },
          ],
          realWorld: {
            title: 'The 40-million-task org',
            scenario:
              'A telecom logged every customer touch as a Task — 40 million rows and growing. Reports timed out, the integration user owned 30 million of them, and a reorg\'s role change once locked sharing recalculation for an entire evening.',
            solution:
              'Architecture review: activities older than 18 months moved to a warehouse (kept queryable via external objects), ownership spread across ten integration users outside the role hierarchy, hot reports moved to a skinny table, and extraction switched to Bulk API with PK chunking.',
            outcome:
              'Report latency returned to seconds, reorgs stopped causing sharing-lock evenings, and the org adopted a standing rule: any object projected to exceed 5M rows gets an LDV design review first.',
          },
          keyTakeaways: [
            'Learn the standard indexes and the selectivity thresholds by heart',
            'Skew (ownership/account/lookup) is a locking problem — design ownership deliberately',
            'Skinny tables, deferred sharing, PK chunking: know when to reach for each',
            'The best LDV strategy is fewer rows: archive and summarize',
          ],
          resources: [
            {
              title: 'Large Data Volumes (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/large-data-volumes',
              source: 'trailhead',
            },
            {
              title: 'Best Practices for Deployments with Large Data Volumes',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.salesforce_large_data_volumes_bp.meta/salesforce_large_data_volumes_bp/ldv_deployments_introduction.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'arch-sharing',
          title: 'Enterprise sharing architecture',
          summary:
            'Designing who-sees-what for thousands of users: implicit sharing, share tables, Apex managed sharing, and performance.',
          durationMinutes: 20,
          objectives: [
            'Read the sharing architecture: share tables, group maintenance, implicit shares',
            'Design role hierarchies and territory structures that scale',
            'Use Apex managed sharing and restriction rules appropriately',
          ],
          sections: [
            {
              heading: 'How sharing physically works',
              body:
                'Every object with Private/Read-Only OWD has a share table (AccountShare, MyObject__Share) holding access grants, and group-membership tables the platform joins at query time. Every sharing rule, team member, and manual share is a row; the role hierarchy materializes as group memberships.\n\nThis is why sharing design is performance design: millions of share rows recalculating on a role change is the hidden cost of a casually restructured hierarchy. Implicit sharing (parent account access from child opportunity/case access, and vice versa for portal users) adds rows you never explicitly created.',
            },
            {
              heading: 'Structures that scale',
              body:
                'Keep role hierarchies shallow and stable — model data access needs, not the HR org chart; every reorg-driven role move triggers recalculation. Prefer criteria-based sharing and public groups over per-team rules that multiply. Territory Management handles matrixed sales access (geography × product) better than hierarchy contortions.\n\nFor B2C-scale communities/portals, sharing sets and share groups follow different mechanics than internal sharing — an architect sizing an Experience Cloud rollout must model those separately.',
            },
            {
              heading: 'Programmatic and restrictive controls',
              body:
                'Apex managed sharing writes share rows with a custom rowCause for requirements no declarative rule expresses ("share the claim with the assigned adjuster\'s peer-review group for 30 days"). Managed shares survive ownership changes; manual shares do not — a critical operational difference.\n\nRestriction rules (and scoping rules) SUBTRACT visibility — the long-missing "deny" for specific segments (contractors see only their department\'s cases). They apply after normal sharing and cannot mix with every feature, so validate against your report/list-view requirements before committing.',
            },
          ],
          realWorld: {
            title: 'The reorg that used to take a weekend',
            scenario:
              'An insurer restructured sales quarterly. Each reorg meant moving thousands of users between roles; sharing recalculation locked the org for hours, so reorgs happened on weekends with all-hands on deck.',
            solution:
              'Architects rebuilt access around a shallow four-level hierarchy plus criteria-based rules on region/product fields, moved matrixed overlay access to Territory Management, and scheduled unavoidable mass changes with deferred sharing maintenance windows.',
            outcome:
              'Quarterly reorgs became a Tuesday-evening configuration change measured in minutes. The access model also became explainable — auditors received a one-page diagram instead of a 400-rule export.',
          },
          keyTakeaways: [
            'Sharing is rows in share tables — design with recalculation cost in mind',
            'Shallow, stable hierarchies; criteria-based rules; territories for matrix access',
            'Apex managed sharing for exotic rules; restriction rules for subtractive needs',
            'Model portal/community sharing separately — different mechanics',
          ],
          resources: [
            {
              title: 'Who Sees What (Salesforce Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.security_data_access.htm&type=5',
              source: 'help',
            },
            {
              title: 'Record-Level Access: Under the Hood (Architect guide)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.draes.meta/draes/draes_preface.htm',
              source: 'architect',
            },
          ],
        },
        {
          id: 'arch-data-lifecycle',
          title: 'Data strategy: golden records, archiving, and Big Objects',
          summary:
            'Master data thinking, archival tiers, and keeping the org lean without losing history.',
          durationMinutes: 18,
          objectives: [
            'Define system-of-record boundaries and golden-record strategy',
            'Design archival tiers with Big Objects and external stores',
            'Keep integrations consistent with external IDs and canonical keys',
          ],
          sections: [
            {
              heading: 'Master data: who owns the truth?',
              body:
                'In enterprise landscapes Salesforce is rarely the only system holding customers. Architecture must declare, per entity and per attribute, the system of record: perhaps ERP owns billing addresses, Salesforce owns relationship data, and a CDP merges the marketing view.\n\nWithout this declaration, integrations "sync" both directions until data ping-pongs. Canonical keys (external IDs) anchor identity across systems; survivorship rules decide which source wins per field on merge. This is unglamorous work that determines whether every downstream report can be trusted.',
            },
            {
              heading: 'Archival tiers',
              body:
                'A pragmatic tiering: hot data (active use) stays as normal records; warm history moves to Big Objects — Salesforce\'s billions-scale append-oriented store, queryable via Async SOQL/limited SOQL, ideal for audit trails and interaction history; cold data exports to a lake/warehouse, optionally surfaced back read-only through Salesforce Connect external objects.\n\nDesign archival at OBJECT DESIGN TIME: which date field drives retention, what summary rolls up before detail leaves, and which compliance rules (retention/deletion mandates) apply. Retrofitting archival onto a 50M-row object is an order of magnitude harder.',
            },
            {
              heading: 'Storage economics and hygiene',
              body:
                'Data storage is one of the platform\'s most expensive line items; unbounded growth also degrades performance and backup/restore windows. Quarterly hygiene reviews — top objects by rows/storage, growth curves, orphaned records — keep surprises away.\n\nBeware "attachment sprawl": Files often dominate storage. Policy (what belongs in Salesforce vs the document platform), plus automated cleanup for machine-generated files, routinely reclaims more storage than any record archival project.',
            },
          ],
          realWorld: {
            title: 'Seven years of interaction history, one lean org',
            scenario:
              'A bank\'s compliance mandate required seven years of customer-interaction history, but the interactions object was on course for 100M rows — threatening performance and a storage bill nobody had budgeted.',
            solution:
              'Interactions older than 12 months flow nightly into a Big Object keyed by customer + timestamp (compliance queries run there); a monthly summary record per customer keeps hot reporting fast; raw exports land in the data lake for analytics. External IDs anchor identity across all three tiers.',
            outcome:
              'The transactional object stabilized around 8M rows, compliance retrieves any historical interaction on demand, and storage costs fell despite the seven-year retention guarantee.',
          },
          keyTakeaways: [
            'Declare system of record per entity AND attribute; anchor with external IDs',
            'Tier data: records → Big Objects → external stores, by access pattern',
            'Design retention/archival when designing the object, not after 50M rows',
            'Audit file storage — it often dwarfs record storage',
          ],
          resources: [
            {
              title: 'Big Objects Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/big_objects',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Connect (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lightning_connect',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-arch-data-1',
          topic: 'Selectivity',
          prompt: 'A report on a 20M-row object times out. The FIRST architectural question is…',
          options: [
            'Which browser the user runs',
            'Whether the filters are selective against indexed fields',
            'Whether the org is on Hyperforce',
            'How many dashboards exist',
          ],
          correctIndex: 1,
          explanation:
            'At LDV scale, non-selective filters mean full scans — selectivity against indexes is the core diagnostic.',
        },
        {
          id: 'q-arch-data-2',
          topic: 'Indexes',
          prompt: 'Which fields are indexed by default?',
          options: [
            'All custom text fields',
            'Id, Name, OwnerId, CreatedDate, SystemModstamp, lookups, external IDs',
            'Only Id',
            'Formula fields',
          ],
          correctIndex: 1,
          explanation:
            'Standard indexes cover system fields, relationships, and external IDs; other fields need custom indexes.',
        },
        {
          id: 'q-arch-data-3',
          topic: 'Ownership skew',
          prompt: 'A single integration user owning 5M records is dangerous because…',
          options: [
            'Licenses cost more',
            'Role or ownership changes trigger massive sharing recalculation and locking',
            'The user\'s list views break',
            'API limits halve',
          ],
          correctIndex: 1,
          explanation:
            'Ownership skew turns routine hierarchy changes into org-locking recalculation events — spread ownership across a pool.',
        },
        {
          id: 'q-arch-data-4',
          topic: 'Account skew',
          prompt: 'Tens of thousands of contacts under ONE account cause…',
          options: [
            'Better reporting',
            'Parent-record lock contention when children update',
            'Automatic archiving',
            'Faster sharing',
          ],
          correctIndex: 1,
          explanation:
            'Child updates lock the parent; mega-parents serialize those locks — split into sub-accounts.',
        },
        {
          id: 'q-arch-data-5',
          topic: 'Share tables',
          prompt: 'Record sharing physically materializes as…',
          options: [
            'Encrypted cookies',
            'Rows in share tables joined with group membership at query time',
            'Formula fields',
            'Apex classes',
          ],
          correctIndex: 1,
          explanation:
            'AccountShare/CustomObject__Share rows + group tables ARE the sharing model — hence recalculation costs.',
        },
        {
          id: 'q-arch-data-6',
          topic: 'Hierarchy design',
          prompt: 'Role hierarchies should be…',
          options: [
            'A mirror of the full HR org chart',
            'Shallow and stable, modeling data access needs',
            'One role per employee',
            'Rebuilt quarterly',
          ],
          correctIndex: 1,
          explanation:
            'Every hierarchy move recalculates sharing; shallow stable structures keep reorgs cheap.',
        },
        {
          id: 'q-arch-data-7',
          topic: 'Restriction rules',
          prompt: 'Restriction rules are notable because they…',
          options: [
            'Grant extra access',
            'SUBTRACT visibility — a targeted deny mechanism in an otherwise additive model',
            'Replace profiles',
            'Speed up queries',
          ],
          correctIndex: 1,
          explanation:
            'Restriction/scoping rules filter records away from specific users — the exception to "sharing only opens".',
        },
        {
          id: 'q-arch-data-8',
          topic: 'Apex sharing',
          prompt: 'Apex managed sharing differs from manual sharing in that managed shares…',
          options: [
            'Expire nightly',
            'Survive record ownership changes (manual shares are removed)',
            'Bypass OWD',
            'Only apply to admins',
          ],
          correctIndex: 1,
          explanation:
            'Custom rowCause shares persist through ownership transfer — vital for programmatic access rules.',
        },
        {
          id: 'q-arch-data-9',
          topic: 'Big Objects',
          prompt: 'Big Objects are best suited for…',
          options: [
            'Hot transactional workloads with complex automation',
            'Billions-scale append-mostly history: audit trails, interaction archives',
            'Replacing all custom objects',
            'Storing file attachments',
          ],
          correctIndex: 1,
          explanation:
            'Big Objects trade automation/features for massive scale — an archival tier, not a workhorse.',
        },
        {
          id: 'q-arch-data-10',
          topic: 'Master data',
          prompt: '"System of record" should be declared…',
          options: [
            'Once for the whole company',
            'Per entity and even per attribute, anchored by canonical external IDs',
            'By whichever system was bought first',
            'Only for accounts',
          ],
          correctIndex: 1,
          explanation:
            'Different systems own different attributes of the same entity; explicit ownership stops sync ping-pong.',
        },
      ],
    },
    {
      id: 'sf-arch-integration',
      title: 'Integration & Identity Architecture',
      summary:
        'Patterns, layers, and trust: architecting how Salesforce talks to the enterprise and how users prove who they are.',
      lessons: [
        {
          id: 'arch-integration-patterns',
          title: 'Integration patterns and the middleware question',
          summary:
            'The canonical pattern catalog — request-reply, fire-and-forget, batch sync, remote call-in, data virtualization — and when middleware earns its keep.',
          durationMinutes: 20,
          objectives: [
            'Apply the canonical Salesforce integration patterns to requirements',
            'Decide between point-to-point and middleware-brokered integration',
            'Design for failure: queues, retries, idempotency, monitoring',
          ],
          sections: [
            {
              heading: 'The pattern catalog',
              body:
                'Salesforce\'s integration patterns document names the recurring shapes: Request & Reply (synchronous callout for an immediate answer), Fire & Forget (publish/queue and move on), Batch Data Synchronization (scheduled bulk movement), Remote Call-In (external systems calling Salesforce APIs), UI Update from data changes (streaming to the UI), and Data Virtualization (Salesforce Connect external objects — access without copying).\n\nArchitects speak in these names: "credit check is request-reply with a 3-second budget; order handoff is fire-and-forget via Platform Events; nightly product sync is batch". Naming the pattern surfaces the right questions — timeouts for request-reply, delivery guarantees for fire-and-forget, windows and deltas for batch.',
            },
            {
              heading: 'Point-to-point vs middleware',
              body:
                'Two systems, one interface? Point-to-point is honest and cheap. But each additional system multiplies connections: five systems fully meshed is ten interfaces, each with its own auth, mapping, and error handling. Middleware (MuleSoft, or event brokers like Kafka) centralizes transformation, routing, retry, and monitoring — and becomes the natural home of canonical data models.\n\nThe architect\'s judgment: middleware adds a platform to run and a team to staff. Adopt it when interface count, reuse ambitions, or non-Salesforce integration needs justify it — not because a diagram looks tidier with a bus in the middle.',
            },
            {
              heading: 'Designing for the bad day',
              body:
                'Every integration design review asks: what happens when the other side is down, slow, or returns garbage? Answers worth having: timeouts tuned below platform ceilings, retries with exponential backoff on transient failures only, dead-letter handling with human-visible alerting, idempotent receivers (dedupe keys), and correlation IDs flowing end-to-end for traceability.\n\nMonitor the business outcome, not just HTTP codes: "orders created in ERP within 5 minutes of Closed Won ≥ 99.5%" is an integration SLO that pages someone before sales notices.',
            },
          ],
          realWorld: {
            title: 'From spaghetti to an integration strategy',
            scenario:
              'A retailer grew to 14 point-to-point interfaces around Salesforce — three teams, three auth styles, no shared monitoring. An ERP field rename silently broke two of them for a week.',
            solution:
              'An architecture review classified each interface by pattern, moved the six batch syncs and four event flows onto middleware with a canonical customer/order model, kept two genuinely simple request-reply calls direct, and added correlation-ID logging with business SLO dashboards.',
            outcome:
              'The next ERP change was absorbed by one mapping update in middleware. Integration incidents fell by half, and — culturally — new projects now start with "which pattern?" instead of "which endpoint?".',
          },
          keyTakeaways: [
            'Name the pattern first; the pattern names the failure modes to design for',
            'Middleware is justified by interface count and reuse, not aesthetics',
            'Idempotency + retries + correlation IDs are table stakes',
            'Define business-level integration SLOs and monitor them',
          ],
          resources: [
            {
              title: 'Integration Patterns and Practices (Salesforce)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.integration_patterns_and_practices.meta/integration_patterns_and_practices/integ_pat_intro_overview.htm',
              source: 'developer',
              note: 'The canonical pattern catalog',
            },
            {
              title: 'Salesforce Architects: Decision Guides',
              url: 'https://architect.salesforce.com/decision-guides',
              source: 'architect',
            },
          ],
        },
        {
          id: 'arch-identity',
          title: 'Identity architecture: SSO, OAuth, and provisioning',
          summary:
            'SAML vs OpenID Connect, Salesforce as SP or IdP, connected apps, and automated user lifecycle.',
          durationMinutes: 20,
          objectives: [
            'Design SSO with SAML or OpenID Connect, choosing SP vs IdP roles',
            'Match OAuth flows to application types',
            'Automate provisioning/deprovisioning with SCIM or JIT',
          ],
          sections: [
            {
              heading: 'SSO: one identity, many systems',
              body:
                'Enterprises centralize authentication in an identity provider (Entra ID/Azure AD, Okta, Ping). Salesforce typically acts as service provider: login redirects to the IdP (SAML or OpenID Connect), the IdP returns an assertion/token, Salesforce maps it to a user via Federation ID. Passwords never live in Salesforce; MFA and conditional access enforce centrally.\n\nSalesforce can also BE the identity provider — common when Experience Cloud is the front door and downstream apps trust Salesforce identities. My Domain is a prerequisite for all of it.',
            },
            {
              heading: 'OAuth flows by application shape',
              body:
                'Connected apps define OAuth clients. Web apps with a backend → authorization code flow (with refresh tokens). Unattended server integrations → JWT bearer (certificate) or client credentials. Devices without browsers → device flow. SPAs/mobile → authorization code with PKCE. Username-password flow is legacy: disable it.\n\nScopes bound what a token may do; token and refresh policies bound for how long. High-assurance sessions can be demanded for sensitive operations. Review connected apps like firewall rules — annually, with an owner per app.',
            },
            {
              heading: 'Lifecycle: provisioning and the leaver problem',
              body:
                'Joiner/mover/leaver events should flow from the IdP: SCIM provisioning or JIT (just-in-time creation from SAML attributes) creates and updates users; deactivation MUST be automated — orphaned active accounts of departed employees are a top audit finding across the industry.\n\nMap IdP groups to permission set groups so access follows role changes automatically. Log and alert on direct-login exceptions (integration users, break-glass admin accounts) — those bypass central policy and deserve scrutiny.',
            },
          ],
          realWorld: {
            title: 'One badge, eleven systems',
            scenario:
              'A manufacturer ran Salesforce logins on local passwords: 90-day resets generated helpdesk tickets, security couldn\'t enforce MFA consistently, and a leaver\'s Salesforce access survived their AD account by weeks.',
            solution:
              'SAML SSO against Entra ID with Federation IDs, SCIM provisioning mapped AD groups → permission set groups, JWT-based connected apps for integrations with quarterly reviews, and break-glass local admin logins alerted to the SOC.',
            outcome:
              'Password tickets disappeared, MFA and conditional access applied uniformly the day HR triggered a leaver event, and the following audit\'s identity section closed with zero findings — a first.',
          },
          keyTakeaways: [
            'Salesforce as SAML/OIDC service provider is the enterprise default; My Domain first',
            'Pick OAuth flows by app shape; kill the username-password flow',
            'Automate leaver deactivation — orphaned accounts are the classic finding',
            'IdP groups → permission set groups keeps access aligned with roles',
          ],
          resources: [
            {
              title: 'Identity Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/identity_basics',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Help: Single Sign-On',
              url: 'https://help.salesforce.com/s/articleView?id=sf.sso_about.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'arch-well-architected',
          title: 'Well-Architected: trade-offs, decisions, and communication',
          summary:
            'The Salesforce Well-Architected framework, architecture decision records, and the architect\'s real job: making trade-offs explicit.',
          durationMinutes: 16,
          objectives: [
            'Use the Well-Architected pillars as a review checklist',
            'Write architecture decision records (ADRs) worth reading later',
            'Evaluate build-vs-buy-vs-configure honestly',
          ],
          sections: [
            {
              heading: 'The framework as a shared language',
              body:
                'Salesforce Well-Architected organizes quality into Trusted (security, compliance, reliability), Easy (intentional, automated where it should be, maintainable), and Adaptable (resilient to change, composable). Its value is less novelty than vocabulary: teams review designs against named qualities instead of taste.\n\nUse it as a review lens: for each significant design, walk the pillars and record where you consciously trade one against another — "we accept lower composability here for delivery speed; revisit when volumes exceed X".',
            },
            {
              heading: 'Decisions are the deliverable',
              body:
                'An architecture decision record captures: context (forces at play), the decision, alternatives considered, and consequences. Five of these per quarter outlive any 60-page architecture document, because they answer the question future engineers actually ask: "why is it like this?"\n\nKeep ADRs where engineers live (repo or wiki adjacent to code/config), number them, never rewrite history — supersede. The discipline forces clarity: a decision you cannot write down crisply is usually not yet made.',
            },
            {
              heading: 'Build, buy, or configure',
              body:
                'The platform gives three levers: configure (declarative), build (custom code), buy (AppExchange/ISV). Honest evaluation weighs total cost of ownership: configuration is cheap until it sprawls; custom code is powerful and permanent maintenance; packages ship features fast and couple you to a vendor\'s roadmap and pricing.\n\nAn architect\'s tie-breakers: Is this capability differentiating for the business (lean build) or commodity (lean buy)? Who maintains it in three years? What does exit look like? Answering those out loud, in an ADR, is the job.',
            },
          ],
          realWorld: {
            title: 'The CPQ decision, documented',
            scenario:
              'A scale-up needed quoting. Sales ops wanted a quick custom build ("just three discount rules!"), finance wanted a mature CPQ package, and the argument had circled for two quarters without resolution.',
            solution:
              'The architect ran a Well-Architected-framed evaluation: modeled three-year TCO for both, prototyped the "three rules" (which turned out to be eleven), and wrote an ADR recommending the package with a thin custom layer — documenting the rejected build option and its trigger conditions for reconsideration.',
            outcome:
              'The decision stuck because the reasoning was inspectable. A year later, when a new VP asked "why didn\'t we build this?", the ADR answered in five minutes — no relitigation, no archaeology.',
          },
          keyTakeaways: [
            'Well-Architected pillars (Trusted, Easy, Adaptable) make quality reviewable',
            'Record decisions as ADRs: context, decision, alternatives, consequences',
            'Build for differentiators, buy commodities, configure the rest',
            'Trade-offs are inevitable; undocumented trade-offs are incidents in waiting',
          ],
          resources: [
            {
              title: 'Salesforce Well-Architected',
              url: 'https://architect.salesforce.com/well-architected/overview',
              source: 'architect',
            },
            {
              title: 'Salesforce Architects site',
              url: 'https://architect.salesforce.com/',
              source: 'architect',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-arch-int-1',
          topic: 'Patterns',
          prompt: '"Check credit score synchronously during quote save, 3-second budget" is which pattern?',
          options: ['Fire & Forget', 'Request & Reply', 'Batch Data Synchronization', 'Data Virtualization'],
          correctIndex: 1,
          explanation:
            'An immediate answer inside a user interaction is request-reply — with timeout budgets as the key design constraint.',
        },
        {
          id: 'q-arch-int-2',
          topic: 'Patterns',
          prompt: 'Accessing ERP order data in Salesforce WITHOUT copying it uses…',
          options: [
            'Batch sync into a custom object',
            'Salesforce Connect external objects (data virtualization)',
            'CSV exports',
            'Outbound messages',
          ],
          correctIndex: 1,
          explanation:
            'External objects query remote data live via OData/custom adapters — no storage, no sync jobs.',
        },
        {
          id: 'q-arch-int-3',
          topic: 'Middleware',
          prompt: 'The strongest ARCHITECTURAL argument for middleware is…',
          options: [
            'Diagrams look better',
            'Many interfaces with shared transformation/monitoring needs and reuse across systems',
            'It is always cheaper',
            'Salesforce requires it',
          ],
          correctIndex: 1,
          explanation:
            'Middleware earns its platform cost through centralized mapping, routing, retries, and canonical models across many interfaces.',
        },
        {
          id: 'q-arch-int-4',
          topic: 'Resilience',
          prompt: 'Idempotent receivers matter in integration because…',
          options: [
            'They compress payloads',
            'Retries and at-least-once delivery mean the same message may arrive twice',
            'They avoid OAuth',
            'They double throughput',
          ],
          correctIndex: 1,
          explanation:
            'Safe redelivery requires processing duplicates harmlessly — dedupe keys and upserts, not blind inserts.',
        },
        {
          id: 'q-arch-int-5',
          topic: 'SSO',
          prompt: 'In a typical enterprise SSO setup, Salesforce acts as…',
          options: [
            'The identity provider for Active Directory',
            'A service provider trusting the corporate IdP via SAML/OIDC',
            'A password vault',
            'A certificate authority',
          ],
          correctIndex: 1,
          explanation:
            'Salesforce delegates authentication to the IdP and maps the returned identity (Federation ID) to a user.',
        },
        {
          id: 'q-arch-int-6',
          topic: 'OAuth',
          prompt: 'An unattended nightly integration service should authenticate with…',
          options: [
            'A shared admin password',
            'The JWT bearer flow using a certificate and an integration user',
            'Device flow',
            'Implicit flow',
          ],
          correctIndex: 1,
          explanation:
            'JWT bearer gives non-interactive, certificate-based auth without stored passwords — least-privilege user attached.',
        },
        {
          id: 'q-arch-int-7',
          topic: 'Lifecycle',
          prompt: 'The classic identity audit finding this lesson highlights is…',
          options: [
            'Too many dashboards',
            'Departed employees\' accounts left active because deactivation was manual',
            'Excessive API versions',
            'Unused sandboxes',
          ],
          correctIndex: 1,
          explanation:
            'Automating leaver deactivation from the IdP (SCIM) closes the orphaned-account gap.',
        },
        {
          id: 'q-arch-int-8',
          topic: 'Well-Architected',
          prompt: 'The Salesforce Well-Architected pillars are…',
          options: [
            'Fast, Cheap, Good',
            'Trusted, Easy, Adaptable',
            'Secure, Scalable, Serverless',
            'Plan, Build, Run',
          ],
          correctIndex: 1,
          explanation:
            'Trusted / Easy / Adaptable structure the framework\'s health checks and vocabulary.',
        },
        {
          id: 'q-arch-int-9',
          topic: 'ADRs',
          prompt: 'A good architecture decision record contains…',
          options: [
            'Only the final decision, briefly',
            'Context, the decision, alternatives considered, and consequences',
            'Meeting attendees and duration',
            'Vendor marketing material',
          ],
          correctIndex: 1,
          explanation:
            'ADRs preserve the WHY — context and rejected alternatives — which is what future teams need.',
        },
        {
          id: 'q-arch-int-10',
          topic: 'Build vs buy',
          prompt: 'A sound tie-breaker for build-vs-buy is…',
          options: [
            'Whichever the loudest stakeholder prefers',
            'Build for business differentiators; buy commodity capabilities — and model 3-year TCO',
            'Always build to avoid license fees',
            'Always buy to avoid code',
          ],
          correctIndex: 1,
          explanation:
            'Differentiation and total cost of ownership — including maintenance and exit — are the honest axes.',
        },
      ],
    },
    {
      id: 'sf-arch-devops',
      title: 'DevOps & Release Engineering',
      summary:
        'Source-driven development, scratch orgs and packaging, CI/CD pipelines, and the governance that makes speed safe.',
      lessons: [
        {
          id: 'arch-sfdx',
          title: 'Source-driven development with Salesforce DX',
          summary:
            'Git as the source of truth: project structure, the sf CLI, and leaving "the org is the truth" behind.',
          durationMinutes: 18,
          objectives: [
            'Structure a DX project and speak the sf CLI fluently',
            'Establish Git as source of truth over org-based truth',
            'Handle metadata\'s quirks in version control',
          ],
          sections: [
            {
              heading: 'The inversion: repo over org',
              body:
                'Traditional Salesforce treated production as the source of truth — you clicked, then dragged changes forward with change sets. Salesforce DX inverts this: a Git repository holds the metadata (source format, decomposed into per-field/per-object files), and orgs become deployment TARGETS built from source.\n\nThe payoff: history, code review, parallel branches, rollback points, and CI. The cost: discipline — every org change must land in the repo or it will be overwritten. That discipline is the cultural core of Salesforce DevOps.',
            },
            {
              heading: 'Project anatomy and the CLI',
              body:
                'sfdx-project.json defines package directories (force-app by convention); source lives decomposed so a picklist edit diffs as one small file. The sf CLI drives everything: sf project retrieve/deploy start, sf org create scratch, sf apex run test — the same commands locally and in CI, which is precisely what this DevOps platform orchestrates for you.\n\nUnder the hood, deploys and retrieves speak the Metadata API; source tracking on scratch orgs and dev sandboxes lets the CLI compute what changed on either side.',
              code: {
                language: 'bash',
                snippet:
                  '# retrieve current source from a sandbox\nsf project retrieve start --target-org dev-sandbox\n\n# validate (check-only) against UAT with tests\nsf project deploy validate --target-org uat --test-level RunLocalTests\n\n# deploy the validated package by job id (quick deploy)\nsf project deploy quick --job-id <validateJobId> --target-org uat',
                caption: 'The retrieve → validate → quick-deploy rhythm every pipeline automates.',
              },
            },
            {
              heading: 'Metadata in Git: the sharp edges',
              body:
                'Metadata is XML, and some files (profiles!) are giant and touch-everything — most teams minimize profile metadata in the repo in favor of permission sets. Some components don\'t round-trip cleanly; .forceignore excludes what should not sync. Merge conflicts in XML demand conventions: small PRs, decomposed source, and formatting normalization.\n\nEnvironment-specific values (endpoints, certificates) must not be hardcoded in metadata — use named credentials, custom metadata types, and post-deploy scripts instead. Treat these edges as known terrain, not surprises.',
            },
          ],
          realWorld: {
            title: 'The org nobody could rebuild',
            scenario:
              'A company\'s org embodied nine years of clicks. Nobody could say what changed last quarter, a deleted flow could not be restored, and onboarding a new admin took months of oral history.',
            solution:
              'They adopted DX incrementally: retrieved the core metadata into Git, made the repo authoritative for changed components, required PRs for all promotions, and used this platform\'s pipelines so validation ran on every merge automatically.',
            outcome:
              'Six months later a bad change was reverted in minutes (git revert + redeploy), quarterly audit questions were answered with git log, and the "what changed?" meeting simply stopped existing.',
          },
          keyTakeaways: [
            'DX inverts truth: repo authoritative, orgs are targets',
            'Decomposed source format makes changes reviewable diffs',
            'Same sf CLI commands locally and in CI — automate the rhythm',
            'Respect the sharp edges: profiles, non-round-tripping metadata, env-specific values',
          ],
          resources: [
            {
              title: 'App Development with Salesforce DX (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/sfdx_app_dev',
              source: 'trailhead',
            },
            {
              title: 'Salesforce DX Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_intro.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'arch-scratch-packaging',
          title: 'Scratch orgs, org shape, and unlocked packages',
          summary:
            'Ephemeral environments per feature, and packaging as the unit of modular delivery.',
          durationMinutes: 18,
          objectives: [
            'Design scratch org definitions and seed data for realistic dev environments',
            'Understand org shape and snapshot options',
            'Modularize metadata into unlocked packages with dependencies',
          ],
          sections: [
            {
              heading: 'Scratch orgs: environments as cattle',
              body:
                'A scratch org spins up in minutes from a definition file (edition, features, settings) and expires within days — every feature branch gets a pristine, isolated org. push source, load seed data, develop, run tests, destroy. No more "who broke the shared dev sandbox?".\n\nRealism requires setup: enable the org features production uses, seed representative data (this platform\'s data-seeding pipelines exist for exactly this), and script the whole provisioning so a new environment is one command or one pipeline run. Org shape can mirror production\'s features/limits for higher fidelity.',
            },
            {
              heading: 'Unlocked packages: modular metadata',
              body:
                'An unlocked package is a versioned, installable unit of metadata with declared dependencies — your org\'s architecture expressed as modules: core-model, service-layer, sales-app, integrations. Version numbers, release notes, and installation give you what change sets never could: an inventory of WHAT is deployed WHERE.\n\nDependency discipline is the hard part: shared objects/fields go in base packages, apps depend on base, circular dependencies are refactoring homework you cannot skip. "Happy soup" (everything unpackaged) to packages is a journey — most enterprises modularize the new and strangle the old gradually.',
            },
            {
              heading: 'When to package, when not to',
              body:
                'Packaging shines for platform teams shipping shared capability across orgs/business units, ISV-style reuse, and enforcing modular boundaries. It adds ceremony: package versions to build, ancestry to manage (for 2GP), and installation orchestration.\n\nA pragmatic middle exists: source-driven org deployments (no packages) with clean folder modularity, graduating hot spots into packages when reuse or boundary enforcement demands it. Choose per-module, not ideologically.',
            },
          ],
          realWorld: {
            title: 'Two teams, one org, zero collisions',
            scenario:
              'Sales-engineering and service-engineering teams shared one developer sandbox. Deployments overwrote each other weekly; a corrupted shared class once blocked both teams for two days.',
            solution:
              'Each feature branch now provisions a scratch org with seeded data via pipeline. Shared metadata moved into a base unlocked package owned jointly; each team ships its own app package depending on base, with contract changes to base requiring cross-team review.',
            outcome:
              'Collisions ended immediately. Release notes per package version replaced tribal deployment memory, and time-to-first-commit for new developers dropped from a week of environment setup to under an hour.',
          },
          keyTakeaways: [
            'Scratch orgs make environments disposable and per-feature — script their setup completely',
            'Unlocked packages version metadata and declare dependencies explicitly',
            'Base/shared packages + app packages; break circular dependencies early',
            'Package where boundaries pay; source-deploy the rest — pragmatism over ideology',
          ],
          resources: [
            {
              title: 'Unlocked Packages for Customers (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/unlocked-packages-for-customers',
              source: 'trailhead',
            },
            {
              title: 'Scratch Orgs (Salesforce DX Guide)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'arch-cicd',
          title: 'CI/CD pipelines for Salesforce',
          summary:
            'From commit to production: validation gates, delta deployments, test strategy, and rollback thinking.',
          durationMinutes: 20,
          objectives: [
            'Design a branch → validate → promote pipeline across environments',
            'Choose test levels and quality gates per stage',
            'Plan rollback and hotfix lanes before you need them',
          ],
          sections: [
            {
              heading: 'The pipeline spine',
              body:
                'A canonical Salesforce pipeline: feature branch → PR triggers static analysis (Code Analyzer/PMD, ESLint for LWC) + delta validation against an integration org → merge to main → automated deploy to QA with test execution → promotion to UAT with validation-only + manual approval → production deploy in a window, quick-deploy from a pre-validated job where possible.\n\nDelta deployments (deploy only changed components) keep cycles fast; full validations still run nightly to catch drift. Every gate that can be automated should be — human attention is reserved for the judgment calls. This platform\'s deployment workbench implements exactly this spine.',
            },
            {
              heading: 'Test strategy per stage',
              body:
                'PR validation: RunLocalTests is thorough but slow for big orgs — running impacted test classes (computed from the delta) keeps feedback tight, with full local tests at the nightly gate. UAT/production: RunLocalTests, non-negotiable. LWC gets Jest at PR time; integration-level UI checks live in a small smoke suite, not a thousand brittle end-to-end scripts.\n\nQuality gates beyond tests: coverage thresholds (per-class, not just org aggregate), static-analysis severity budgets, and deployment-risk review for destructive changes. Fail fast, fail in the PR, never fail at 6 pm on release day.',
            },
            {
              heading: 'Rollback is a design requirement',
              body:
                'Salesforce has no one-click rollback: deployed metadata stays deployed. Real strategies: git revert + redeploy (fast for code/config), pre-release org backups of impacted metadata, feature flags (custom permissions / custom metadata switches) so risky behavior can be disabled without deployment, and destructive-change staging separated from additive deploys.\n\nHotfix lane: a short-lived branch from the production tag, minimal fix, expedited validation, deploy, then merge back to main — documented and rehearsed BEFORE the incident, because 2 am is a bad time to invent process.',
            },
          ],
          realWorld: {
            title: 'Release day, demoted to routine',
            scenario:
              'Releases were monthly, manual, and heroic: a change-set assembly weekend, a six-hour deployment call, and a 30% rollback-something rate. Teams padded estimates with "release risk" as a line item.',
            solution:
              'The org adopted a pipeline: PR validation with impacted tests + static analysis, auto-deploy to QA, validated promotion to UAT, pre-validated quick-deploys to production twice a week, feature flags for risky changes, and a rehearsed hotfix lane.',
            outcome:
              'Deployment frequency went from 12/year to ~100/year while failed-change rate FELL. Release day stopped being an event; the six-hour call became a fifteen-minute quick-deploy — and "release risk" vanished from estimates.',
          },
          keyTakeaways: [
            'Pipeline spine: PR validation → QA auto-deploy → UAT approval → prod quick-deploy',
            'Impacted tests for speed at PR; full local tests nightly and at promotion',
            'Rollback = revert+redeploy, backups, and feature flags — planned in advance',
            'Rehearse the hotfix lane before the incident',
          ],
          resources: [
            {
              title: 'Application Lifecycle and Development Models (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Code Analyzer',
              url: 'https://developer.salesforce.com/tools/vscode/en/user-guide/code-analyzer',
              source: 'developer',
            },
          ],
        },
        {
          id: 'arch-governance',
          title: 'Environment strategy, governance, and the CoE',
          summary:
            'Multi-org strategy, release governance that enables rather than blocks, and running a Center of Excellence.',
          durationMinutes: 16,
          objectives: [
            'Reason about single-org vs multi-org trade-offs',
            'Design lightweight release governance and technical-debt management',
            'Structure a Center of Excellence that accelerates teams',
          ],
          sections: [
            {
              heading: 'Single org or many?',
              body:
                'Single org maximizes shared data (one customer view), shared automation, and simpler integration — at the cost of coordination overhead, limits contention, and blast radius. Multi-org isolates business units and regulatory domains (data residency!) at the cost of duplicated build, cross-org integration, and fractured customer views.\n\nThere is no universally right answer, only explicit trade-offs: most enterprises converge on "as few orgs as possible, as many as necessary", with org boundaries drawn along data-sharing needs and regulatory lines — and the decision documented as an ADR reviewed when the business changes.',
            },
            {
              heading: 'Governance that enables',
              body:
                'Governance fails in two directions: absent (ten teams deploying into one org unaware of each other) or suffocating (a monthly CAB queue for a help-text change). The working middle: risk-tiered change classes — low-risk changes flow through the automated pipeline with peer review only; higher-risk classes (security model, shared objects, integrations) add architecture review.\n\nManage technical debt visibly: a debt register with owners and a fixed capacity allocation (say 15% of each sprint). Debt you cannot see compounds; debt on a board with a budget shrinks.',
            },
            {
              heading: 'The Center of Excellence',
              body:
                'A Salesforce CoE concentrates scarce expertise: platform architecture, design standards, shared components, environment/release management, and enablement. The failure mode is becoming a bottleneck-shaped ivory tower; the success mode is a platform team serving product teams — paved roads, not toll gates.\n\nConcretely: publish standards with examples, maintain the pipeline and shared packages as products, review by exception (only the risk tiers that need it), and measure yourselves on the product teams\' delivery speed and incident rate — the CoE succeeds when others ship faster, safely. Training programs (like this academy) are a CoE deliverable too: capability scales better than review capacity.',
            },
          ],
          realWorld: {
            title: 'From CAB queue to paved road',
            scenario:
              'Every change — including field help text — waited for a monthly change advisory board. Teams smuggled work through "emergency" lanes, which meant the risky changes got LESS scrutiny than the trivial ones.',
            solution:
              'A new CoE introduced risk tiers: tier-1 (declarative, non-shared) auto-flowed through the pipeline with peer review; tier-2 added async architecture review in 48h SLA; tier-3 (security model, shared core, integrations) got a design session. The CAB dissolved into the tier-3 review.',
            outcome:
              'Median change lead time dropped from 34 days to 4, emergency-lane abuse ended because the normal lane was faster, and audit satisfaction IMPROVED — every change now had pipeline evidence attached automatically.',
          },
          keyTakeaways: [
            '"As few orgs as possible, as many as necessary" — decide on data & regulatory lines',
            'Risk-tiered governance: automate the low tiers, review the high ones',
            'Make technical debt visible with a register and a capacity budget',
            'A CoE is a platform team: paved roads and enablement, not toll gates',
          ],
          resources: [
            {
              title: 'Salesforce Well-Architected',
              url: 'https://architect.salesforce.com/well-architected/overview',
              source: 'architect',
            },
            {
              title: 'Salesforce Architects: Decision Guides',
              url: 'https://architect.salesforce.com/decision-guides',
              source: 'architect',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-arch-devops-1',
          topic: 'Source-driven',
          prompt: 'Salesforce DX\'s core inversion is…',
          options: [
            'Sandboxes replace production',
            'The Git repo becomes the source of truth; orgs become deployment targets',
            'Metadata becomes read-only',
            'Change sets become versioned',
          ],
          correctIndex: 1,
          explanation:
            'Source-driven development makes the repository authoritative — history, review, rollback, and CI follow.',
        },
        {
          id: 'q-arch-devops-2',
          topic: 'Metadata in Git',
          prompt: 'Why do DX teams minimize PROFILE metadata in the repo?',
          options: [
            'Profiles deploy too fast',
            'Profile files are huge, touch everything, and merge terribly — permission sets are cleaner',
            'Git cannot store XML',
            'Profiles are deprecated entirely',
          ],
          correctIndex: 1,
          explanation:
            'Profiles are the classic merge-conflict generator; permission-set-first strategies keep diffs sane.',
        },
        {
          id: 'q-arch-devops-3',
          topic: 'Scratch orgs',
          prompt: 'The main advantage of scratch orgs over a shared dev sandbox is…',
          options: [
            'They keep production data',
            'Isolated, reproducible per-feature environments created and destroyed on demand',
            'They never expire',
            'They skip tests',
          ],
          correctIndex: 1,
          explanation:
            'Ephemeral isolation ends "who broke dev?" — every branch gets a pristine org built from source.',
        },
        {
          id: 'q-arch-devops-4',
          topic: 'Packaging',
          prompt: 'Unlocked packages give you, above raw org deployments…',
          options: [
            'Faster SOQL',
            'Versioned, dependency-declared units — an inventory of what is deployed where',
            'Free sandboxes',
            'Automatic UI tests',
          ],
          correctIndex: 1,
          explanation:
            'Versioning + dependencies + installation history make metadata modular and auditable.',
        },
        {
          id: 'q-arch-devops-5',
          topic: 'Pipeline',
          prompt: 'A "quick deploy" to production is possible when…',
          options: [
            'The org is in maintenance mode',
            'A prior check-only validation (with tests) succeeded, within its validity window',
            'Fewer than 10 components changed',
            'An admin approves in the UI',
          ],
          correctIndex: 1,
          explanation:
            'Validate ahead (tests run), then release the pre-validated job instantly in the window — minimal release-moment risk.',
        },
        {
          id: 'q-arch-devops-6',
          topic: 'Testing gates',
          prompt: 'A sane test strategy runs…',
          options: [
            'All tests on every keystroke',
            'Impacted tests at PR speed, full local tests nightly and at UAT/production promotion',
            'No tests before UAT',
            'Only manual testing',
          ],
          correctIndex: 1,
          explanation:
            'Fast feedback at PR, exhaustive verification at promotion — speed and safety at the right layers.',
        },
        {
          id: 'q-arch-devops-7',
          topic: 'Rollback',
          prompt: 'Since Salesforce lacks one-click rollback, teams prepare by…',
          options: [
            'Never deploying on Fridays only',
            'Git revert + redeploy, metadata backups, and feature-flag kill switches',
            'Keeping a spare production org',
            'Avoiding all automation',
          ],
          correctIndex: 1,
          explanation:
            'Revertability comes from source control, backups, and flags designed in BEFORE the incident.',
        },
        {
          id: 'q-arch-devops-8',
          topic: 'Org strategy',
          prompt: 'The strongest driver toward a MULTI-org strategy is…',
          options: [
            'Preferring smaller dashboards',
            'Regulatory/data-residency isolation and truly disjoint business domains',
            'Cheaper licenses',
            'Avoiding code reviews',
          ],
          correctIndex: 1,
          explanation:
            'Regulatory boundaries and non-shared domains justify org splits; shared customer views argue for fewer orgs.',
        },
        {
          id: 'q-arch-devops-9',
          topic: 'Governance',
          prompt: 'Risk-tiered change governance means…',
          options: [
            'All changes wait for a monthly board',
            'Low-risk changes auto-flow through the pipeline; only high-risk classes get architecture review',
            'Only admins may deploy',
            'Risk is assessed after deployment',
          ],
          correctIndex: 1,
          explanation:
            'Tiering reserves scarce human review for changes that need it — faster AND safer than blanket boards.',
        },
        {
          id: 'q-arch-devops-10',
          topic: 'CoE',
          prompt: 'A healthy Center of Excellence primarily…',
          options: [
            'Approves every change personally',
            'Provides paved roads — standards, shared components, pipelines, training — measured by other teams\' delivery speed',
            'Owns all development',
            'Reports ticket counts',
          ],
          correctIndex: 1,
          explanation:
            'Platform-team thinking: enable product teams to ship fast and safely; review only by exception.',
        },
      ],
    },
  ],
};
