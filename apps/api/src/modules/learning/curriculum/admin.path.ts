import type { CurriculumPath } from './curriculum.types';

/**
 * Path 2 — Admin & Configuration Mastery (Intermediate).
 * The security model, declarative automation, and data operations that make
 * someone genuinely dangerous (in a good way) in a real org.
 */
export const adminPath: CurriculumPath = {
  id: 'sf-admin',
  title: 'Admin & Configuration Mastery',
  tagline: 'Security, automation, and data operations — the working admin\'s toolkit.',
  description:
    'Go beyond navigation into how Salesforce is actually governed: who sees what (the security model), how business processes are automated with Flow, and how data is loaded, cleaned, and released safely. This is the path that turns platform literacy into hands-on capability.',
  level: 'intermediate',
  category: 'salesforce',
  badge: 'Certified-Ready Admin',
  estimatedHours: 10,
  skills: [
    'Security & sharing model',
    'Flow automation',
    'Validation & formulas',
    'Data loading & quality',
    'Sandbox strategy',
  ],
  modules: [
    {
      id: 'sf-admin-security',
      title: 'Identity & the Security Model',
      summary:
        'The layered access model: org, object, field, and record level — the topic every interview and every incident comes back to.',
      lessons: [
        {
          id: 'admin-users-licenses',
          title: 'Users, licenses, and login policies',
          summary:
            'How identity works in an org: user records, licenses, login hours, IP ranges, and MFA.',
          durationMinutes: 15,
          objectives: [
            'Create and deactivate users correctly',
            'Understand the relationship between licenses, profiles, and users',
            'Apply org-level access policies: login hours, IP ranges, MFA',
          ],
          sections: [
            {
              heading: 'The user record',
              body:
                'Every person entering the org has a User record holding their username (globally unique across ALL of Salesforce, not just your org), email, license, profile, and role. Usernames look like emails but need not be real mailboxes — alice@acme.com.prod and alice@acme.com.uat can coexist for the same person across environments.\n\nUsers are never deleted, only deactivated. Deactivation frees the license while preserving record ownership history and audit trails. Before deactivating, transfer open work — some orgs block deactivation while the user owns records in approval processes.',
            },
            {
              heading: 'Licenses gate features; profiles shape them',
              body:
                'The license (Salesforce, Salesforce Platform, Experience Cloud…) sets the ceiling of what a user could ever do — a Platform license user can never access Opportunities, no matter their profile. The profile then shapes access within that ceiling.\n\nWhen someone "can\'t see the Opportunities tab", check in order: license (is it even possible?), then profile/permission sets (is it granted?), then the app\'s tab visibility. This checklist resolves most access tickets.',
            },
            {
              heading: 'Org-level access policies',
              body:
                'Login hours and login IP ranges live on the profile: outside allowed hours users are logged out; outside trusted IP ranges they must verify identity or are blocked. Multi-factor authentication is contractually required by Salesforce for all UI logins.\n\nSession settings (timeout duration, session security levels) and password policies complete the org-level layer. These controls run BEFORE any sharing calculation — they decide whether you get in at all, not what you see once inside.',
            },
          ],
          realWorld: {
            title: 'The contractor offboarding gap',
            scenario:
              'An agency contractor finished a three-month engagement, but their user remained active. Two months later, security flagged logins from an unexpected country — the contractor\'s credentials had been phished.',
            solution:
              'The org introduced an offboarding runbook: deactivate on last day, transfer owned records, review login history monthly, and restrict high-privilege profiles to trusted IP ranges with MFA enforced.',
            outcome:
              'The audit that followed found zero orphaned active users, and login IP restrictions now contain any future credential leak to the office network.',
          },
          keyTakeaways: [
            'Usernames are globally unique across all Salesforce orgs',
            'Deactivate, never delete: history and auditability depend on it',
            'License = ceiling, profile/permission sets = shape within it',
            'Login hours, IP ranges, and MFA gate entry before sharing even applies',
          ],
          resources: [
            {
              title: 'User Management (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lex_implementation_user_setup_mgmt',
              source: 'trailhead',
            },
            {
              title: 'Identity Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/identity_basics',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'admin-profiles-permsets',
          title: 'Profiles, permission sets, and permission set groups',
          summary:
            'Object and field permissions done right: minimal profiles, additive permission sets, and job-role groups.',
          durationMinutes: 18,
          objectives: [
            'Explain object-level (CRED) and field-level security',
            'Apply the modern "minimal profile + permission sets" strategy',
            'Bundle permissions into permission set groups aligned to job roles',
          ],
          sections: [
            {
              heading: 'Object permissions: CRED + View All / Modify All',
              body:
                'For each object, a profile or permission set grants Create, Read, Edit, Delete — plus the sharing-bypassing View All and Modify All. These are object-level switches: no Read on Case means Cases effectively do not exist for that user, in every list view, report, and API call.\n\nField-level security (FLS) then hides or read-onlys individual fields. FLS is enforced everywhere server-side — page layouts merely arrange what FLS already allows. Hiding a field on a layout is cosmetic; removing FLS visibility is security.',
            },
            {
              heading: 'The modern strategy: thin profiles, additive permission sets',
              body:
                'Historically orgs cloned dozens of profiles ("Sales Rep", "Senior Sales Rep", "Sales Rep Berlin"…), each a maintenance nightmare. Salesforce\'s stated direction is the opposite: keep a minimal profile (login policies, defaults) and grant nearly everything through permission sets, which stack additively.\n\nPermission sets answer "what extra capability does this person need?" — Manage Quotas, Access Invoicing Object. One user, many permission sets. There is no "deny" — Salesforce security is additive-only, so the model is: start from nothing, grant deliberately.',
            },
            {
              heading: 'Permission set groups',
              body:
                'A permission set group bundles multiple permission sets into one assignable unit aligned to a job role: the "Service Agent" group might contain Case Management, Knowledge User, and CTI Access. Assign one group instead of five sets.\n\nGroups also support muting — subtracting specific permissions from the bundle without editing the underlying sets. Muting is the only subtractive mechanism in the model, and it only subtracts within that group.',
            },
          ],
          realWorld: {
            title: 'Collapsing 34 profiles',
            scenario:
              'A grown-by-accident org had 34 profiles differing in tiny ways. Every new field meant touching all 34, and audits couldn\'t answer "who can edit Amount?" without a spreadsheet safari.',
            solution:
              'The admin team collapsed to 4 base profiles, expressed every capability difference as ~20 permission sets, and built permission set groups per job role ("SDR", "AE", "Service Agent", "Finance").',
            outcome:
              'New-field rollout time dropped from a day to minutes, onboarding became "assign one group", and the security audit passed with a permission model that could actually be explained.',
          },
          keyTakeaways: [
            'Object CRED + FLS are enforced everywhere, including the API — layouts are not security',
            'Salesforce access is additive: there is no deny, so grant minimally',
            'Prefer thin profiles with capabilities in permission sets',
            'Permission set groups map bundles to job roles; muting is the only subtraction',
          ],
          resources: [
            {
              title: 'Data Security (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/data_security',
              source: 'trailhead',
              note: 'The definitive module for this whole area',
            },
            {
              title: 'Salesforce Help: Permission Sets',
              url: 'https://help.salesforce.com/s/articleView?id=sf.perm_sets_overview.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'admin-sharing-model',
          title: 'Record access: OWD, role hierarchy, and sharing rules',
          summary:
            'The record-level layer: org-wide defaults as the floor, then hierarchy, sharing rules, teams, and manual shares opening access up.',
          durationMinutes: 20,
          objectives: [
            'Set org-wide defaults as the baseline of record access',
            'Use the role hierarchy for vertical visibility',
            'Open access laterally with sharing rules, teams, and manual sharing',
          ],
          sections: [
            {
              heading: 'Org-wide defaults: the floor',
              body:
                'Org-wide defaults (OWD) set what users get on records they do NOT own: Private, Public Read Only, or Public Read/Write per object. Everything else in the sharing model only ever OPENS access from this floor — nothing tightens below it.\n\nDesign rule: set OWD to the most restrictive setting any user population requires. If pricing data must be hidden from anyone, Opportunity OWD must be Private, and you grant the rest of the org access back through the mechanisms below.',
            },
            {
              heading: 'Role hierarchy: vertical access',
              body:
                'The role hierarchy grants managers access to records owned by (or shared with) their subordinates. It mirrors data access needs, not necessarily the org chart — a small flat hierarchy is normal and healthy.\n\nFor custom objects you can disable this inheritance ("Grant Access Using Hierarchies"); for standard objects it is always on. Roles answer "my manager can see my deals"; they do nothing for peers — that is sharing rules\' job.',
            },
            {
              heading: 'Lateral access: sharing rules, teams, manual shares',
              body:
                'Sharing rules open records sideways: ownership-based ("records owned by role EMEA Sales → share with role EMEA Service") or criteria-based ("Cases where Type = Escalation → share with the Escalations group"). They target roles and public groups, never individual users.\n\nAccount and Opportunity Teams share specific records with a working team, with per-member access levels. Manual sharing handles one-off exceptions. When troubleshooting access, walk the ladder in order: OWD → role hierarchy → sharing rules → teams → manual shares — and remember object CRED and FLS sit before all of it.',
            },
          ],
          realWorld: {
            title: 'Private opportunities without blinding service',
            scenario:
              'Sales leadership wanted opportunity amounts hidden from other reps (competitive commissions), but service agents needed to see open deals on accounts they supported to avoid tone-deaf conversations.',
            solution:
              'Opportunity OWD went Private. The role hierarchy kept managers seeing their teams\' pipeline. A criteria-based sharing rule shared open opportunities with the Service group at Read Only, and FLS hid the commission-sensitive fields from the service profile entirely.',
            outcome:
              'Reps stopped seeing each other\'s amounts, service saw exactly enough context to be helpful, and the design was expressed in three declarative settings — no code, fully auditable.',
          },
          keyTakeaways: [
            'OWD is the floor; every other mechanism only opens access upward',
            'Role hierarchy = vertical visibility; sharing rules = lateral, to groups/roles only',
            'Layer FLS on top when specific fields are more sensitive than the record',
            'Troubleshoot access in ladder order: CRED/FLS → OWD → hierarchy → rules → teams → manual',
          ],
          resources: [
            {
              title: 'Data Security (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/data_security',
              source: 'trailhead',
            },
            {
              title: 'Who Sees What in Lightning Experience (Salesforce Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.security_data_access.htm&type=5',
              source: 'help',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-adm-sec-1',
          topic: 'Users',
          prompt: 'Why can\'t you delete a Salesforce user?',
          options: [
            'You can, with the right permission',
            'Deactivation preserves ownership history and audit trails while freeing the license',
            'Users are stored outside the org',
            'Deletion requires a support ticket',
          ],
          correctIndex: 1,
          explanation:
            'Users are deactivated, never deleted, so historical ownership, activities, and audit data stay intact.',
        },
        {
          id: 'q-adm-sec-2',
          topic: 'Licenses',
          prompt: 'A user with a Salesforce Platform license cannot access Opportunities because…',
          options: [
            'Their profile is missing a tab',
            'The license itself excludes core CRM objects — no profile can override that',
            'Opportunities require MFA',
            'The org edition is too low',
          ],
          correctIndex: 1,
          explanation:
            'Licenses set the feature ceiling. Profiles and permission sets only shape access within what the license allows.',
        },
        {
          id: 'q-adm-sec-3',
          topic: 'FLS',
          prompt: 'Hiding a field on the page layout but leaving field-level security visible means…',
          options: [
            'The field is fully secured',
            'The field is still readable via reports, list views, and the API',
            'The field is deleted after 30 days',
            'Validation rules stop running on it',
          ],
          correctIndex: 1,
          explanation:
            'Layouts are presentation. Only FLS (and object permissions) are enforced across UI, reports, and API.',
        },
        {
          id: 'q-adm-sec-4',
          topic: 'Permission strategy',
          prompt: 'The modern recommended permission strategy is…',
          options: [
            'One profile per job title, cloned as needed',
            'Minimal profiles with capabilities granted via permission sets and groups',
            'Give everyone Modify All Data and rely on trust',
            'Control everything through page layouts',
          ],
          correctIndex: 1,
          explanation:
            'Salesforce\'s direction is thin profiles plus additive permission sets, bundled into job-role groups.',
        },
        {
          id: 'q-adm-sec-5',
          topic: 'Permission model',
          prompt: 'Which statement about the Salesforce permission model is TRUE?',
          options: [
            'Permissions are additive; the only subtraction is muting inside a permission set group',
            'A profile can deny what a permission set grants',
            'Permission sets expire after 90 days',
            'FLS can grant access CRED denies',
          ],
          correctIndex: 0,
          explanation:
            'There is no deny. Access accumulates from profile + permission sets; muting within a group is the single subtractive tool.',
        },
        {
          id: 'q-adm-sec-6',
          topic: 'OWD',
          prompt: 'Org-wide defaults should be set to…',
          options: [
            'Public Read/Write for convenience',
            'The most restrictive level any user population requires, opened up via sharing',
            'Private for every object in every org, always',
            'Whatever the previous admin chose',
          ],
          correctIndex: 1,
          explanation:
            'OWD is the floor and nothing tightens below it — so it must match the most restrictive requirement, with access granted back explicitly.',
        },
        {
          id: 'q-adm-sec-7',
          topic: 'Role hierarchy',
          prompt: 'The role hierarchy primarily grants…',
          options: [
            'Peers access to each other\'s records',
            'Managers access to records owned by users below them',
            'Field-level visibility',
            'Login access outside IP ranges',
          ],
          correctIndex: 1,
          explanation:
            'Roles provide vertical (manager-over-subordinate) record access; lateral access needs sharing rules or teams.',
        },
        {
          id: 'q-adm-sec-8',
          topic: 'Sharing rules',
          prompt: 'Sharing rules can share records with…',
          options: [
            'Individual users only',
            'Roles and public groups (never single users)',
            'Anyone with the record URL',
            'External systems',
          ],
          correctIndex: 1,
          explanation:
            'Sharing rules target roles, roles-and-subordinates, or public groups. One-off individual access is manual sharing.',
        },
        {
          id: 'q-adm-sec-9',
          topic: 'Troubleshooting',
          prompt: 'A user cannot see a record. What should you check FIRST?',
          options: [
            'Manual shares on the record',
            'Whether their profile/permission sets grant Read on the object at all',
            'The dashboard running user',
            'Their Chatter settings',
          ],
          correctIndex: 1,
          explanation:
            'Object-level CRED comes before any record-sharing logic — without Read, no sharing mechanism can help.',
        },
        {
          id: 'q-adm-sec-10',
          topic: 'View All',
          prompt: '"View All" on an object does what?',
          options: [
            'Grants read access to every record of that object, bypassing sharing',
            'Shows all fields regardless of FLS',
            'Adds the object to all apps',
            'Enables Kanban view',
          ],
          correctIndex: 0,
          explanation:
            'View All / Modify All are object-level sharing bypasses — powerful and to be granted sparingly.',
        },
      ],
    },
    {
      id: 'sf-admin-automation',
      title: 'Declarative App Building & Flow',
      summary:
        'Validation rules, formulas, Lightning pages, and Flow Builder — automating the business without code.',
      lessons: [
        {
          id: 'admin-app-builder',
          title: 'Page layouts, record types, and Lightning App Builder',
          summary:
            'Shape the user experience: layouts vs dynamic Lightning pages, and when record types are (and aren\'t) the answer.',
          durationMinutes: 15,
          objectives: [
            'Assign page layouts and understand what they do and don\'t control',
            'Use record types for genuinely different business processes',
            'Build dynamic Lightning record pages with component visibility',
          ],
          sections: [
            {
              heading: 'Layouts and their limits',
              body:
                'Page layouts arrange fields, related lists, and actions per profile and record type, and can make fields required or read-only AT THE UI LEVEL. They do not restrict reports or API access — that is FLS\'s job. Repeat this until it is reflexive: layouts are UX, FLS is security.\n\nCompact layouts choose the handful of fields in the record highlights panel and mobile cards — small effort, outsized daily impact.',
            },
            {
              heading: 'Record types: different processes, not different data',
              body:
                'Record types let one object serve genuinely different processes: a "New Business" vs "Renewal" opportunity with different picklist values, layouts, and Lightning pages. Users pick the type at creation and the experience adapts.\n\nOveruse is a classic org smell. If two record types differ only by one field\'s visibility, dynamic forms or component visibility is lighter. Use record types when the PROCESS differs — different stages, different automation, different layouts.',
            },
            {
              heading: 'Lightning App Builder and dynamic pages',
              body:
                'Lightning App Builder composes record pages from components: standard (Record Detail, Related Lists, Chatter), custom LWCs, or AppExchange components. Pages can be assigned by app, record type, AND profile.\n\nComponent visibility rules ("show the Escalation panel only when Priority = Critical") and Dynamic Forms (place individual fields, with per-field visibility rules) turn static layouts into context-aware workspaces. The best admin-built pages feel like custom apps.',
            },
          ],
          realWorld: {
            title: 'One Case object, two support tiers',
            scenario:
              'A software company handles both quick how-to questions and complex escalations on the Case object. One giant layout buried tier-2 engineers in irrelevant fields, while tier-1 agents kept skipping required diagnostic details.',
            solution:
              'Two record types (Standard, Escalation) with tailored layouts and picklists, plus a Lightning page where the diagnostics panel appears only when the record type is Escalation and Status ≠ New.',
            outcome:
              'Tier-1 case handling time dropped noticeably, escalations arrived with required diagnostics filled, and neither team sees the other\'s clutter.',
          },
          keyTakeaways: [
            'Layouts are UX; FLS is security — never confuse the two',
            'Record types are for different processes, not cosmetic differences',
            'Lightning pages assign by app + record type + profile',
            'Component visibility and Dynamic Forms make pages context-aware',
          ],
          resources: [
            {
              title: 'Lightning App Builder (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lightning_app_builder',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Help: Dynamic Forms',
              url: 'https://help.salesforce.com/s/articleView?id=sf.dynamic_forms_overview.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'admin-validation-formulas',
          title: 'Formula fields and validation rules',
          summary:
            'Calculated truth and guarded input: the two declarative tools that encode business logic into the data layer itself.',
          durationMinutes: 18,
          objectives: [
            'Build formula fields with functions, cross-object references, and images',
            'Write validation rules that block bad data with helpful messages',
            'Know the limits: when formulas/validations should give way to Flow or code',
          ],
          sections: [
            {
              heading: 'Formula fields: calculated on read',
              body:
                'A formula field computes its value every time it is viewed — never stored, never editable. Classics: Days_Open__c = TODAY() - DATEVALUE(CreatedDate); a traffic-light IMAGE() based on SLA status; Account tier pulled down via cross-object formula Account.Tier__c on a Contact.\n\nCross-object formulas can reach up to 10 relationships away. Formulas cannot reference child records (that is roll-ups or Flow) and have compile-size limits — when a formula turns into a novel, the logic probably belongs elsewhere.',
            },
            {
              heading: 'Validation rules: the gatekeepers',
              body:
                'A validation rule is a formula that BLOCKS saving when it evaluates true, showing your error message. "Close date cannot be in the past": CloseDate < TODAY(). Combine conditions with AND/OR, detect edits with ISCHANGED(), stage transitions with ISPICKVAL(PriorValue(...)).\n\nGood validation rules state what to do, not just what failed: "Discounts above 20% require VP approval — set Approval Status first" beats "Invalid discount". Remember they fire on ALL entry points: API loads, flows, and integrations too.',
            },
            {
              heading: 'Knowing when to stop',
              body:
                'Formulas and validations are the sharpest declarative tools per unit of effort, but each has a boundary. Need to UPDATE another record? Flow. Need to aggregate children on a lookup relationship? Flow or a scheduled job. Need conditional bypasses for data migrations? Add a "bypass" custom permission check into the rule — a pattern every mature org adopts.\n\nA practical migration tip: validation rules firing during bulk loads are the #1 cause of failed data migrations. Plan bypass switches before load day, not during it.',
            },
          ],
          realWorld: {
            title: 'Stopping retroactive close dates',
            scenario:
              'Reps backdated opportunity close dates to sneak deals into the previous quarter after it closed, corrupting revenue reporting and triggering a finance escalation.',
            solution:
              'A validation rule: CloseDate < TODAY() && ISCHANGED(StageName) && ISPICKVAL(StageName, "Closed Won") blocks closing a deal with a past date, with a message explaining the finance policy. A "Data Migration" custom permission bypasses it for sanctioned admin loads.',
            outcome:
              'Quarter-end reporting became trustworthy, the audit finding was closed, and the bypass permission meant legitimate migrations never fought the rule.',
          },
          keyTakeaways: [
            'Formula fields are computed on read; they cannot be edited or reference children',
            'Validation rules block saves everywhere — UI, API, flows',
            'Error messages should instruct, not just reject',
            'Build permission-based bypasses into rules before your first big data load',
          ],
          resources: [
            {
              title: 'Formulas and Validations (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/point_click_business_logic',
              source: 'trailhead',
            },
            {
              title: 'Formula Operators and Functions (Salesforce Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.customize_functions.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'admin-screen-flows',
          title: 'Screen flows: guided experiences without code',
          summary:
            'Build wizard-style UIs with Flow Builder: screens, variables, decisions, and DML elements.',
          durationMinutes: 20,
          objectives: [
            'Assemble screens, decisions, assignments, and record elements into a flow',
            'Pass context with input variables like recordId',
            'Place flows on pages, actions, and utility bars',
          ],
          sections: [
            {
              heading: 'Anatomy of a screen flow',
              body:
                'A screen flow is an interactive program built visually: Screen elements collect input, Decision elements branch, Assignment elements set variables, and Create/Update/Get/Delete Records elements do the database work.\n\nThink of it as a form wizard with a brain. A "Log a Site Visit" flow can look up the account, show different questions for retail vs wholesale customers, create the visit record, and update the account\'s Last Visited date — one guided experience, zero code.',
            },
            {
              heading: 'Variables and context',
              body:
                'Flows have typed variables (text, number, record, collections). An input variable named recordId, marked "available for input", automatically receives the current record\'s Id when the flow runs from a record page or quick action — the single most important convention in flow building.\n\nUse Get Records to fetch data, loops sparingly (there are usually collection-level alternatives), and keep DML out of loops — the same bulkification instinct that governs Apex applies to flows.',
            },
            {
              heading: 'Where flows live',
              body:
                'Deploy screen flows as: quick actions on records (the most common), components on Lightning pages, utility bar items (persistent tools), or standalone URLs for internal portals. Each placement can pass different inputs.\n\nAlways set a fault path: connect elements\' fault connectors to a screen or notification that explains failures. A flow that dies silently ("An unhandled fault has occurred") costs more trust than it saved effort.',
            },
          ],
          realWorld: {
            title: 'Case escalation wizard',
            scenario:
              'Escalating a case involved editing seven fields, notifying two teams, and creating a follow-up task. Agents skipped steps under pressure; half of escalations arrived malformed.',
            solution:
              'A screen flow behind an "Escalate" quick action: it asks three questions, validates that diagnostics were attached, sets all seven fields consistently, creates the task, and posts to the escalation Chatter group — with a fault screen if anything fails.',
            outcome:
              'Malformed escalations disappeared, average escalation time fell from six minutes of field-editing to ninety seconds, and the process is now documented BY the flow itself.',
          },
          keyTakeaways: [
            'Screen flows = guided wizards: screens, decisions, assignments, record elements',
            'The recordId input variable convention wires flows to their record context',
            'Keep DML out of loops; think in collections',
            'Every production flow needs fault paths with human-readable messages',
          ],
          resources: [
            {
              title: 'Flow Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/flow-basics',
              source: 'trailhead',
            },
            {
              title: 'Build Flows with Flow Builder (Trailhead trail)',
              url: 'https://trailhead.salesforce.com/content/learn/trails/build-flows-with-flow-builder',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'admin-record-triggered-flows',
          title: 'Record-triggered flows & the order of execution',
          summary:
            'Automate on create/update/delete with fast field updates and actions — and understand where flows sit in the save order.',
          durationMinutes: 20,
          objectives: [
            'Choose correctly between before-save and after-save flows',
            'Use entry conditions and scheduled paths',
            'Reason about the order of execution and design one-flow-per-object strategies',
          ],
          sections: [
            {
              heading: 'Before-save vs after-save',
              body:
                'A record-triggered flow runs when records are created, updated, or deleted. Before-save ("fast field updates") flows modify the triggering record BEFORE it hits the database — extremely fast, no extra DML, but limited to updating that record\'s own fields.\n\nAfter-save flows run once the record is committed and can do everything else: create related records, update children, send emails, call subflows, enqueue asynchronous paths. Rule of thumb: same-record field updates → before-save; anything touching other records → after-save.',
            },
            {
              heading: 'Entry conditions and scheduled paths',
              body:
                'Entry conditions filter which records trigger the flow — "only when Stage changes to Closed Won". Tight entry conditions are a performance feature AND documentation: they declare exactly when automation applies.\n\nScheduled paths defer work: "10 minutes after" for near-real-time side effects, "3 days before Contract_End__c" for reminders. Scheduled paths run asynchronously with their own limits — a clean declarative alternative to scheduled Apex for many cases.',
            },
            {
              heading: 'Order of execution and flow architecture',
              body:
                'When a record saves, Salesforce runs a fixed sequence — roughly: system validation → before-save flows → before triggers → custom validation rules → duplicate rules → save → after triggers → assignment/auto-response/escalation rules → after-save flows → roll-ups → post-commit actions (email). Knowing this order explains countless "why is my field overwritten?" mysteries.\n\nGovernance matters as much as mechanics: many orgs adopt one record-triggered flow per object per timing (orchestrated with subflows) or at least strict naming and entry-condition discipline, because ten overlapping flows on Opportunity firing in undefined relative order is unmaintainable.',
            },
          ],
          realWorld: {
            title: 'The onboarding kickoff automation',
            scenario:
              'When a deal closes, customer success must create an onboarding project, task the CSM, and email the customer — previously a manual checklist executed inconsistently, sometimes days late.',
            solution:
              'One after-save flow on Opportunity with entry condition "Stage ISCHANGED to Closed Won": it creates the Onboarding_Project__c record, assigns tasks, and a 24-hour scheduled path sends the welcome email if the project is still unstarted. Same-record field stamping (Closed_Won_Date__c) went into a separate before-save flow.',
            outcome:
              'Every closed deal now gets a project within seconds, the welcome email never fires for deals that were immediately reopened, and the before/after split kept saves fast.',
          },
          keyTakeaways: [
            'Before-save = same-record field updates, fastest; after-save = everything else',
            'Entry conditions are performance + self-documentation — always set them',
            'Scheduled paths handle delays and date-relative automation declaratively',
            'Learn the order of execution; adopt a per-object flow governance strategy',
          ],
          resources: [
            {
              title: 'Record-Triggered Flows (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/record-triggered-flows',
              source: 'trailhead',
            },
            {
              title: 'Apex Developer Guide: Triggers and Order of Execution',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_triggers_order_of_execution.htm',
              source: 'developer',
              note: 'The canonical order-of-execution reference',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-adm-auto-1',
          topic: 'Layouts',
          prompt: 'Making a field read-only on the page layout…',
          options: [
            'Prevents all edits including via API',
            'Only affects that layout\'s UI — FLS still governs real access',
            'Deletes existing values',
            'Applies to every profile automatically',
          ],
          correctIndex: 1,
          explanation:
            'Layouts control presentation for their assigned profiles/record types; enforcement everywhere else is FLS.',
        },
        {
          id: 'q-adm-auto-2',
          topic: 'Record types',
          prompt: 'The BEST reason to introduce a record type is…',
          options: [
            'Two user groups want different field ordering',
            'The object serves genuinely different processes needing different picklists, layouts, and automation',
            'To hide one field from interns',
            'To speed up reports',
          ],
          correctIndex: 1,
          explanation:
            'Record types shine for divergent business processes; purely cosmetic differences are better served by dynamic forms/visibility.',
        },
        {
          id: 'q-adm-auto-3',
          topic: 'Formulas',
          prompt: 'Which is TRUE of formula fields?',
          options: [
            'They are computed when viewed and cannot be edited',
            'Users can override them with inline editing',
            'They can aggregate child records on lookups',
            'They persist values nightly',
          ],
          correctIndex: 0,
          explanation:
            'Formulas evaluate on read. Aggregating children needs roll-ups (master-detail) or automation.',
        },
        {
          id: 'q-adm-auto-4',
          topic: 'Validation',
          prompt: 'Validation rules fire on…',
          options: [
            'UI edits only',
            'Every save path: UI, API, Data Loader, and flows',
            'Only record creation',
            'Only fields on the page layout',
          ],
          correctIndex: 1,
          explanation:
            'Validation is enforced at the data layer — which is why bulk loads need planned bypass mechanisms.',
        },
        {
          id: 'q-adm-auto-5',
          topic: 'Flow types',
          prompt: 'A flow that updates a field ON the triggering record before it is written should be…',
          options: [
            'An after-save record-triggered flow',
            'A before-save (fast field update) record-triggered flow',
            'A screen flow',
            'A scheduled-only flow',
          ],
          correctIndex: 1,
          explanation:
            'Before-save flows mutate the in-flight record with no extra DML — the fastest option for same-record updates.',
        },
        {
          id: 'q-adm-auto-6',
          topic: 'Flow context',
          prompt: 'For a screen flow on a record page to know which record it launched from, you create…',
          options: [
            'A formula field on the object',
            'An input variable named recordId marked available for input',
            'A validation rule',
            'A custom label',
          ],
          correctIndex: 1,
          explanation:
            'The recordId input-variable convention is how record pages and quick actions pass context into flows.',
        },
        {
          id: 'q-adm-auto-7',
          topic: 'Scheduled paths',
          prompt: '"Send a reminder 3 days before Contract_End__c" is best implemented with…',
          options: [
            'A validation rule',
            'A scheduled path on a record-triggered flow',
            'A roll-up summary',
            'A compact layout',
          ],
          correctIndex: 1,
          explanation:
            'Scheduled paths run relative to record date fields — the declarative answer to date-driven automation.',
        },
        {
          id: 'q-adm-auto-8',
          topic: 'Order of execution',
          prompt: 'In the save order, before-save flows run…',
          options: [
            'After validation rules',
            'Before Apex before-triggers and before custom validation rules',
            'After the record commits',
            'Only in sandboxes',
          ],
          correctIndex: 1,
          explanation:
            'Before-save flows run very early — before before-triggers and validation rules — which is why they are so fast.',
        },
        {
          id: 'q-adm-auto-9',
          topic: 'Flow governance',
          prompt: 'Why do many orgs standardize on one record-triggered flow per object per timing?',
          options: [
            'Salesforce charges per flow',
            'Relative execution order of multiple flows on one object is not guaranteed, hurting maintainability',
            'Flows cannot share objects',
            'It is required for deployment',
          ],
          correctIndex: 1,
          explanation:
            'Consolidation (or strict discipline) prevents unpredictable interactions between overlapping flows.',
        },
        {
          id: 'q-adm-auto-10',
          topic: 'Fault handling',
          prompt: 'A production screen flow should handle errors by…',
          options: [
            'Letting the default unhandled-fault message appear',
            'Connecting fault paths to screens/notifications that explain what happened',
            'Wrapping everything in loops',
            'Disabling validation rules',
          ],
          correctIndex: 1,
          explanation:
            'Fault connectors with clear messaging keep user trust and make failures diagnosable.',
        },
      ],
    },
    {
      id: 'sf-admin-data-ops',
      title: 'Data Management, Quality & Release Basics',
      summary:
        'Loading data safely, keeping it clean, and moving changes between environments.',
      lessons: [
        {
          id: 'admin-data-loading',
          title: 'Data import: wizard, Data Loader, and upserts',
          summary:
            'Choose the right loading tool, master external IDs and upsert, and prepare files that load cleanly.',
          durationMinutes: 18,
          objectives: [
            'Choose between Data Import Wizard and Data Loader',
            'Use external IDs and upsert to load relationships without VLOOKUP pain',
            'Prepare and validate CSVs before touching production',
          ],
          sections: [
            {
              heading: 'Wizard vs Data Loader',
              body:
                'The Data Import Wizard (in Setup) handles up to 50,000 records for common objects with built-in duplicate matching — friendly and safe for business admins. Data Loader (or modern CLI equivalents like SFDMU, which this platform uses for org-to-org seeding) handles millions of records, any object, scheduled and command-line operation.\n\nInsert, update, upsert, delete, and hard delete are the verbs. Exports are queries to CSV — also your backup tool of last resort.',
            },
            {
              heading: 'External IDs and upsert: the killer combo',
              body:
                'An external ID is a custom field (text/number) marked as an external, unique identifier — typically holding the record\'s key in another system (SAP customer number, legacy CRM id). Upsert with an external ID means "update if a record with this key exists, insert otherwise" — idempotent loading.\n\nBetter still: when loading child records, you can reference the PARENT\'s external ID instead of its Salesforce Id — Data Loader resolves the relationship for you. This eliminates the classic "export parents, VLOOKUP the Ids into the child file" ritual entirely.',
            },
            {
              heading: 'Pre-load discipline',
              body:
                'Before any significant load: match your CSV columns to API names, validate picklist values against the org, check date formats (ISO yyyy-MM-dd is safest), verify record ownership assignments, and decide what happens with validation rules and automation — bulk loads that trigger a thousand flows can spiral.\n\nAlways rehearse in a sandbox with a representative sample, review the error file from that rehearsal, and only then run production. Keep success and error files: they are your rollback map.',
            },
          ],
          realWorld: {
            title: 'Migrating 200k accounts from a legacy CRM',
            scenario:
              'A company replaced its legacy CRM, needing 200,000 accounts and 500,000 contacts migrated with relationships intact. The first attempt — exporting inserted account Ids and VLOOKUPing them into the contact file — collapsed under spreadsheet errors.',
            solution:
              'They added Legacy_Id__c external IDs on Account and Contact, loaded accounts with upsert, then loaded contacts referencing Account via the parent\'s external ID. Validation rules got a migration bypass permission; automation on those objects was temporarily gated by entry conditions.',
            outcome:
              'The rerun loaded cleanly in one evening, the process was repeatable for the three delta loads before cutover, and zero orphaned contacts survived reconciliation.',
          },
          keyTakeaways: [
            'Wizard for small friendly loads; Data Loader/CLI for scale and automation',
            'Upsert + external IDs = idempotent, re-runnable migrations',
            'Reference parent external IDs to skip manual Id mapping for children',
            'Rehearse in sandbox, plan validation/automation bypasses, keep error files',
          ],
          resources: [
            {
              title: 'Data Management (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lex_implementation_data_management',
              source: 'trailhead',
            },
            {
              title: 'Data Loader Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.dataLoader.meta/dataLoader/data_loader.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'admin-data-quality',
          title: 'Data quality: duplicates, hygiene, and stewardship',
          summary:
            'Matching rules, duplicate rules, and the operating habits that keep an org\'s data trustworthy.',
          durationMinutes: 15,
          objectives: [
            'Configure matching rules and duplicate rules',
            'Run duplicate jobs and merge records safely',
            'Establish ongoing data stewardship practices',
          ],
          sections: [
            {
              heading: 'Matching rules and duplicate rules',
              body:
                'A matching rule defines what "same" means — exact email, fuzzy name + city on Account. A duplicate rule references matching rules and decides behavior: alert the user (they can proceed) or block the save, on create and/or edit, optionally bypassable for specific profiles or data loads.\n\nStandard rules for Accounts, Contacts, and Leads work out of the box; custom matching rules cover org-specific definitions of identity ("same Tax_Number__c").',
            },
            {
              heading: 'Finding and merging existing duplicates',
              body:
                'Duplicate rules prevent NEW duplicates; existing ones need duplicate jobs (Performance/Unlimited editions) or reports on potential-duplicate record sets. Merging (up to three records at a time for Accounts/Contacts/Leads) lets you pick the master and surviving field values; related records reparent to the winner.\n\nMerge is irreversible in practice — snapshot (export) candidates before mass merges, and merge in small reviewed batches rather than one heroic weekend.',
            },
            {
              heading: 'Stewardship: quality as a process, not a project',
              body:
                'Sustainable quality comes from operating habits: required-field discipline balanced against user friction, picklists over free text, ownership of quality dashboards ("Accounts missing industry", "Contacts without email"), and a named data steward per domain.\n\nMeasure it: a simple completeness score formula field per record, trended on a dashboard, turns "our data is bad" from a complaint into a burndown chart.',
            },
          ],
          realWorld: {
            title: 'Duplicate leads poisoning marketing metrics',
            scenario:
              'Marketing imported event lists without controls for a year. The same buyer existed as five leads; email metrics double-counted; sales called people who had already bought.',
            solution:
              'A custom matching rule (email exact OR fuzzy name + company), a duplicate rule alerting on create and blocking on import profiles, weekly duplicate jobs with steward-reviewed merges, and a "clean before import" checklist for events.',
            outcome:
              'Duplicate creation dropped to near zero, the historical backlog shrank steadily through reviewed merges, and campaign ROI reporting finally matched finance\'s revenue numbers.',
          },
          keyTakeaways: [
            'Matching rules define "same"; duplicate rules define what happens',
            'Prevention (rules) and cleanup (jobs + merges) are separate workstreams',
            'Export before mass merges — merges don\'t undo',
            'Assign stewardship and measure completeness or quality stays aspirational',
          ],
          resources: [
            {
              title: 'Duplicate Management (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/sales_admin_duplicate_management',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Help: Duplicate Management',
              url: 'https://help.salesforce.com/s/articleView?id=sf.managing_duplicates_overview.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'admin-sandboxes-releases',
          title: 'Sandboxes, change sets, and release hygiene',
          summary:
            'Environment strategy and the admin\'s release toolkit — from change sets to an appreciation of source-driven pipelines.',
          durationMinutes: 17,
          objectives: [
            'Match sandbox types to purposes and plan refresh cycles',
            'Deploy with change sets and know their limitations',
            'Understand why teams graduate to source-driven CI/CD',
          ],
          sections: [
            {
              heading: 'Sandbox strategy',
              body:
                'Developer sandboxes (metadata only, refresh daily) for building; Developer Pro for larger test datasets; Partial Copy (sample data via template, refresh every 5 days) for QA; Full (complete replica, refresh every 29 days) for UAT, training, and performance testing.\n\nRefreshing OVERWRITES the sandbox with production\'s current state — coordinate refresh windows with in-flight work or someone loses a week of configuration. Mature orgs publish a refresh calendar.',
            },
            {
              heading: 'Change sets: the built-in deployment tool',
              body:
                'Outbound change sets bundle metadata components in a source org; the target org (connected via Deployment Settings) receives them as inbound change sets for validation and deployment. Deployments run Apex tests per the chosen test level and can be validated without deploying — do this the day before a release window.\n\nLimitations to respect: change sets don\'t delete components, don\'t include everything (some settings and data-like configuration are excluded), aren\'t versioned, and clicking together the same set across four environments invites drift.',
            },
            {
              heading: 'Why teams graduate to source-driven delivery',
              body:
                'As orgs grow, metadata moves into version control (Git) and deployments become pipeline runs: retrieve → pull request review → automated validation against a target org → deploy. Salesforce DX, scratch orgs, and unlocked packages formalize this; platforms like this DevOps Command Center orchestrate it.\n\nEven if admins keep using change sets day-to-day, understanding the source-driven model matters: it is where the audit trail, rollback story, and multi-team coordination live in serious organizations. That story continues in the Architect path\'s DevOps module.',
            },
          ],
          realWorld: {
            title: 'The Friday-afternoon change set incident',
            scenario:
              'An admin deployed a change set Friday at 4 pm containing a new validation rule — but forgot the custom permission it referenced. Every integration user\'s saves started failing across the org, and the on-call engineer spent the evening diagnosing.',
            solution:
              'The org adopted release hygiene: validate change sets 24 hours ahead, deploy Tuesday–Thursday mornings, include dependency checklists, and route emergency fixes through a documented expedited lane with a second reviewer.',
            outcome:
              'Failed-deployment incidents fell to nearly zero, and the checklist culture became the on-ramp to a full Git-based pipeline the following year.',
          },
          keyTakeaways: [
            'Sandbox type = data copied + refresh interval; publish a refresh calendar',
            'Validate change sets before release day; they cannot delete or version anything',
            'Deployment failures are usually missing dependencies — checklist them',
            'Source-driven CI/CD is the destination; change-set discipline is the on-ramp',
          ],
          resources: [
            {
              title: 'Application Lifecycle and Development Models (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Help: Sandboxes',
              url: 'https://help.salesforce.com/s/articleView?id=sf.deploy_sandboxes_parent.htm&type=5',
              source: 'help',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-adm-data-1',
          topic: 'Loading tools',
          prompt: 'Which scenario clearly requires Data Loader (or a CLI tool) over the Import Wizard?',
          options: [
            'Importing 300 leads from a trade show',
            'Loading 400,000 records into a custom object on a schedule',
            'Updating 20 contacts\' phone numbers',
            'Importing accounts with duplicate checking',
          ],
          correctIndex: 1,
          explanation:
            'The wizard caps at 50k records and limited objects; scale, any-object support, and scheduling are Data Loader territory.',
        },
        {
          id: 'q-adm-data-2',
          topic: 'Upsert',
          prompt: 'Upsert using an external ID field means…',
          options: [
            'Insert everything and delete duplicates later',
            'Update the record when the key matches, insert when it does not',
            'Update only, never insert',
            'Merge matching records automatically',
          ],
          correctIndex: 1,
          explanation:
            'Upsert keyed on an external ID is idempotent: safe to re-run, no duplicate creation.',
        },
        {
          id: 'q-adm-data-3',
          topic: 'Relationships in loads',
          prompt: 'The cleanest way to set each Contact\'s Account during a load is…',
          options: [
            'Manually reparenting after load',
            'Referencing the Account\'s external ID in the contact file so the loader resolves it',
            'Creating contacts without accounts',
            'Using the account NAME and hoping it is unique',
          ],
          correctIndex: 1,
          explanation:
            'Loaders can resolve parent relationships via the parent\'s external ID — no Salesforce-Id VLOOKUP step needed.',
        },
        {
          id: 'q-adm-data-4',
          topic: 'Load safety',
          prompt: 'Before a large production data load you should…',
          options: [
            'Disable all security',
            'Rehearse in a sandbox and plan validation/automation bypasses',
            'Delete existing data to avoid conflicts',
            'Refresh the Full sandbox afterwards',
          ],
          correctIndex: 1,
          explanation:
            'Sandbox rehearsal surfaces picklist, validation, and automation issues while they are still free to fix.',
        },
        {
          id: 'q-adm-data-5',
          topic: 'Duplicates',
          prompt: 'The difference between a matching rule and a duplicate rule is…',
          options: [
            'None — two names for one thing',
            'Matching rules define what counts as "the same"; duplicate rules decide alert/block behavior',
            'Duplicate rules only work on Leads',
            'Matching rules delete duplicates automatically',
          ],
          correctIndex: 1,
          explanation:
            'Matching rule = identity definition; duplicate rule = enforcement policy referencing matching rules.',
        },
        {
          id: 'q-adm-data-6',
          topic: 'Merging',
          prompt: 'Before a mass merge exercise you should…',
          options: [
            'Export the candidate records as a snapshot',
            'Disable sharing rules',
            'Refresh all sandboxes',
            'Turn off duplicate rules permanently',
          ],
          correctIndex: 0,
          explanation:
            'Merges are effectively irreversible — an export is your only realistic undo.',
        },
        {
          id: 'q-adm-data-7',
          topic: 'Sandboxes',
          prompt: 'Which sandbox copies ALL production data and refreshes at most every 29 days?',
          options: ['Developer', 'Developer Pro', 'Partial Copy', 'Full'],
          correctIndex: 3,
          explanation:
            'Full sandboxes replicate production completely — the UAT/performance environment.',
        },
        {
          id: 'q-adm-data-8',
          topic: 'Refresh risk',
          prompt: 'Refreshing a sandbox…',
          options: [
            'Merges sandbox changes into production',
            'Overwrites the sandbox with production\'s current state, destroying unsaved work',
            'Backs the sandbox up automatically first',
            'Only updates data, never metadata',
          ],
          correctIndex: 1,
          explanation:
            'A refresh replaces the sandbox wholesale — which is why refresh calendars and coordination exist.',
        },
        {
          id: 'q-adm-data-9',
          topic: 'Change sets',
          prompt: 'Which is a real limitation of change sets?',
          options: [
            'They cannot include Apex classes',
            'They cannot delete components or represent version history',
            'They only work within one org',
            'They bypass Apex tests',
          ],
          correctIndex: 1,
          explanation:
            'Change sets are additive-only, unversioned bundles — the core reasons teams adopt source-driven pipelines.',
        },
        {
          id: 'q-adm-data-10',
          topic: 'Release hygiene',
          prompt: 'A low-risk release habit demonstrated in the lesson is…',
          options: [
            'Deploying Friday afternoons to avoid users',
            'Validating the deployment against the target a day before the release window',
            'Skipping tests for small changes',
            'Refreshing production weekly',
          ],
          correctIndex: 1,
          explanation:
            'Validation-only runs catch missing dependencies and test failures before the actual deployment moment.',
        },
      ],
    },
  ],
};
