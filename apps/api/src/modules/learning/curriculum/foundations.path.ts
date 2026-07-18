import type { CurriculumPath } from './curriculum.types';

/**
 * Path 1 — Salesforce Foundations (Beginner).
 * Designed so a brand-new joiner with zero CRM background can build a correct
 * mental model of the platform before touching configuration or code.
 */
export const foundationsPath: CurriculumPath = {
  id: 'sf-foundations',
  title: 'Salesforce Foundations',
  tagline: 'From zero to confident navigator — the fresher onboarding track.',
  description:
    'Start here if you are new to Salesforce or CRM in general. This path explains what Salesforce is, how the platform organizes information, and how real teams use it every day. You will finish able to navigate any org, read its data model, and build your first report.',
  level: 'beginner',
  category: 'salesforce',
  badge: 'Foundations Graduate',
  estimatedHours: 6,
  skills: ['CRM concepts', 'Lightning navigation', 'Data model literacy', 'Reports & dashboards'],
  modules: [
    {
      id: 'sf-foundations-platform',
      title: 'Welcome to Salesforce & the Cloud',
      summary:
        'What CRM means, why companies choose Salesforce, and how the ecosystem of clouds, editions, and releases fits together.',
      lessons: [
        {
          id: 'foundations-what-is-salesforce',
          title: 'What is Salesforce? CRM in plain language',
          summary:
            'Understand what a CRM does, the problem Salesforce solves, and the multi-tenant cloud model behind it.',
          durationMinutes: 15,
          objectives: [
            'Explain what a CRM is and the business problems it solves',
            'Describe Salesforce as a multi-tenant, metadata-driven cloud platform',
            'Recognize the difference between Salesforce the product and the platform',
          ],
          sections: [
            {
              heading: 'CRM: one shared source of customer truth',
              body:
                'CRM stands for Customer Relationship Management. Before CRM software, sales reps kept customer details in personal spreadsheets, support agents kept notes in email threads, and marketing had its own lists. Nobody saw the full picture, and when an employee left, their knowledge left with them.\n\nA CRM centralizes every interaction — calls, emails, deals, support cases — against a single customer record. Salesforce is the market-leading CRM: when a sales rep at your company opens an account, they see the same up-to-date information the support team and the finance team see.',
            },
            {
              heading: 'Multi-tenant cloud, explained with an office building',
              body:
                'Salesforce runs as a multi-tenant cloud. Think of an office building: every company (a "tenant") rents its own floor, but everyone shares the same foundation, elevators, and electricity. Your company\'s Salesforce environment — called an org — is your private floor: your data, your customizations, your users. Salesforce maintains the shared building, so you never patch servers or install upgrades.\n\nThree times a year (Spring, Summer, Winter releases) every tenant gets new features automatically. This is why customizations in Salesforce are described as metadata — declarative descriptions of your setup that survive every upgrade — rather than modified source code.',
            },
            {
              heading: 'Product vs platform',
              body:
                'Salesforce sells ready-made applications — Sales Cloud for pipeline management, Service Cloud for support, Marketing Cloud for campaigns. All of them sit on the same underlying engine, historically called Force.com and now the Salesforce Platform.\n\nThis matters for your career: once you understand the platform (objects, automation, security), you can work across any Salesforce product. Companies also build entirely custom applications on the platform — anything from recruitment tracking to logistics — without owning a single server.',
            },
          ],
          realWorld: {
            title: 'A distributor consolidates five spreadsheets',
            scenario:
              'A beverage distributor tracked leads in one spreadsheet, orders in another, and complaints in a shared inbox. Sales reps regularly visited customers who had open unresolved complaints — and had no idea.',
            solution:
              'They moved to Salesforce: every customer became an Account record, every complaint a Case, every deal an Opportunity. The rep\'s mobile app now shows open cases right on the account page before a visit.',
            outcome:
              'Visit preparation dropped from 30 minutes of spreadsheet archaeology to a 2-minute record review, and complaint-related churn fell because reps stopped walking into meetings blind.',
          },
          keyTakeaways: [
            'CRM centralizes every customer interaction into a single shared record',
            'Salesforce is multi-tenant: your org is isolated, but the infrastructure is shared and upgraded for you',
            'Customizations are metadata, which is why they survive three releases per year',
            'Learning the platform transfers across every Salesforce product',
          ],
          resources: [
            {
              title: 'Salesforce Platform Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/starting_force_com',
              source: 'trailhead',
              note: 'The canonical starting module',
            },
            {
              title: 'Trailhead Basics',
              url: 'https://trailhead.salesforce.com/content/learn/modules/trailhead_basics',
              source: 'trailhead',
              note: 'Set up your free Trailhead Playground org',
            },
          ],
        },
        {
          id: 'foundations-ecosystem',
          title: 'The ecosystem: clouds, editions, and orgs',
          summary:
            'Map the Salesforce product family, understand editions and licenses, and learn what production, sandbox, and developer orgs are for.',
          durationMinutes: 18,
          objectives: [
            'Name the major Salesforce clouds and what each is for',
            'Understand editions and user licenses at a practical level',
            'Distinguish production orgs, sandboxes, scratch orgs, and Developer Edition orgs',
          ],
          sections: [
            {
              heading: 'The cloud family',
              body:
                'Sales Cloud manages the revenue pipeline: leads, opportunities, forecasts. Service Cloud runs customer support: cases, entitlements, omni-channel routing, knowledge bases. Marketing Cloud handles campaigns and customer journeys. Commerce Cloud powers storefronts. Experience Cloud builds customer- or partner-facing portals on top of your org\'s data.\n\nUnderneath, Platform (with Apex, Flow, and Lightning) is what admins and developers extend. Most enterprise projects combine two or three clouds — for example Service Cloud plus an Experience Cloud portal so customers can log their own cases.',
            },
            {
              heading: 'Editions and licenses',
              body:
                'An edition (Starter, Professional, Enterprise, Unlimited) is what your company buys; it caps features and limits like API calls. Enterprise Edition is the most common baseline for serious customization because it includes the API and more automation capacity.\n\nEach user then consumes a license (for example Salesforce, Salesforce Platform, or Experience Cloud logins) plus optional permission set licenses for add-ons. As an admin you will assign licenses; as a developer you should know that some features simply do not exist in lower editions.',
            },
            {
              heading: 'Production, sandboxes, and developer environments',
              body:
                'Production is the live org where real business happens. Sandboxes are copies of production used for building and testing: Developer and Developer Pro sandboxes copy only metadata, Partial Copy adds a sample of data, and Full sandboxes replicate everything.\n\nScratch orgs are short-lived, source-driven orgs created from a definition file — ideal for feature development and CI pipelines (this application creates them for you). Free Developer Edition orgs and Trailhead Playgrounds are personal practice environments. Golden rule from day one: never build directly in production.',
            },
          ],
          realWorld: {
            title: 'Choosing environments for a support portal project',
            scenario:
              'A team must deliver a customer portal in three months. Developers need isolated environments, QA needs realistic data, and UAT needs to mirror production closely.',
            solution:
              'Each developer works in a scratch org created from source control. Features merge into a Partial Copy sandbox for QA with anonymized sample data, then a Full sandbox hosts UAT before the production release window.',
            outcome:
              'No developer ever blocked another, QA found data-shape bugs a metadata-only sandbox would have missed, and the release deployed to production without surprises.',
          },
          keyTakeaways: [
            'Clouds are packaged applications; the platform underneath is shared',
            'Edition determines org capabilities; licenses determine per-user access',
            'Sandbox types differ mainly in how much production data they copy',
            'Scratch orgs enable modern source-driven development and CI/CD',
          ],
          resources: [
            {
              title: 'Salesforce Platform Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/starting_force_com',
              source: 'trailhead',
            },
            {
              title: 'Application Lifecycle and Development Models (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
              note: 'How environments fit into delivery',
            },
          ],
        },
        {
          id: 'foundations-navigation',
          title: 'Navigating Lightning Experience',
          summary:
            'Get fluent with apps, tabs, records, list views, global search, and Setup — the places you will live every day.',
          durationMinutes: 15,
          objectives: [
            'Navigate apps, tabs, and records confidently',
            'Use global search and list views to find anything fast',
            'Locate Setup and understand what lives there',
          ],
          sections: [
            {
              heading: 'Apps, tabs, and the App Launcher',
              body:
                'Lightning Experience organizes work into apps — a named collection of tabs such as Sales or Service. The App Launcher (the nine-dot waffle icon, top-left) switches between them and can jump straight to any object.\n\nEach tab shows an object home page with list views. A list view is a saved, filterable table — "My Open Opportunities", "Cases Closed This Week". Learn the keyboard-free trick used by every experienced admin: press the App Launcher, type the first letters of anything, and go.',
            },
            {
              heading: 'Record pages: where the work happens',
              body:
                'Opening a record shows the Lightning record page: a highlights panel with key fields and actions on top, detail and related tabs in the middle, and usually an activity timeline or Chatter feed alongside. Related lists show connected records — an Account\'s Contacts, Opportunities, and Cases.\n\nRecord pages are assembled from components in Lightning App Builder, which means what YOU see may differ per app, record type, or profile. If two colleagues see different layouts for the same record, that is configuration, not a bug.',
            },
            {
              heading: 'Global search and Setup',
              body:
                'Global search (top bar) searches across objects and respects your permissions — you only ever find records you are allowed to see. Use quotation marks for exact phrases and the left-hand filters to narrow by object.\n\nThe gear icon opens Setup — the administration console. Everything configurable lives here: users, security, objects (Object Manager), automation, and monitoring. Freshers should explore Setup early even without edit rights; reading an org\'s Setup is how you learn how it was built.',
            },
          ],
          realWorld: {
            title: 'A new hire finds their feet in week one',
            scenario:
              'A graduate joins as a junior admin. Users raise tickets like "I can\'t see the Discount field" and "my list view disappeared" — and the graduate has no idea where to start.',
            solution:
              'They learn the trio that answers most tickets: Object Manager (does the field exist and is it on the layout?), the user\'s profile and permission sets (can they see it?), and list view controls (is it filtered or shared correctly?).',
            outcome:
              'By week three the graduate resolves the majority of "I can\'t see X" tickets in minutes, because navigation and Setup literacy — not code — is what those tickets actually require.',
          },
          keyTakeaways: [
            'Apps are collections of tabs; the App Launcher reaches everything',
            'Record pages are configurable per app, record type, and profile',
            'Global search respects sharing — users only find what they can access',
            'Setup and Object Manager are the admin\'s home; explore them early',
          ],
          resources: [
            {
              title: 'Lightning Experience Customization (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lex_customization',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Help: Get Started',
              url: 'https://help.salesforce.com/s/',
              source: 'help',
              note: 'Official product documentation portal',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-found-plat-1',
          topic: 'CRM basics',
          prompt: 'What is the primary business problem a CRM solves?',
          options: [
            'It replaces the company\'s accounting system',
            'It centralizes all customer interactions into one shared source of truth',
            'It automates payroll for sales teams',
            'It hosts the company website',
          ],
          correctIndex: 1,
          explanation:
            'A CRM consolidates every customer touchpoint — deals, cases, calls, emails — onto shared records so every team sees the same up-to-date picture.',
        },
        {
          id: 'q-found-plat-2',
          topic: 'Multi-tenancy',
          prompt: 'In Salesforce\'s multi-tenant model, what does each customer company get?',
          options: [
            'A dedicated physical server rack',
            'Their own isolated org sharing common platform infrastructure',
            'A copy of the Salesforce source code to modify',
            'A private data center per region',
          ],
          correctIndex: 1,
          explanation:
            'Tenants share infrastructure but each org\'s data and metadata are strictly isolated — like private floors in a shared office building.',
        },
        {
          id: 'q-found-plat-3',
          topic: 'Releases',
          prompt: 'How often does Salesforce deliver major platform releases to all customers?',
          options: ['Monthly', 'Twice a year', 'Three times a year', 'Only when customers opt in'],
          correctIndex: 2,
          explanation:
            'Spring, Summer, and Winter releases upgrade every org automatically — customizations survive because they are metadata, not modified core code.',
        },
        {
          id: 'q-found-plat-4',
          topic: 'Clouds',
          prompt: 'Which cloud would you implement primarily to manage customer support cases?',
          options: ['Sales Cloud', 'Service Cloud', 'Commerce Cloud', 'Marketing Cloud'],
          correctIndex: 1,
          explanation:
            'Service Cloud is built around cases, entitlements, omni-channel routing, and knowledge — the support workload.',
        },
        {
          id: 'q-found-plat-5',
          topic: 'Environments',
          prompt: 'Which environment type copies ALL production data and metadata?',
          options: ['Developer sandbox', 'Partial Copy sandbox', 'Full sandbox', 'Scratch org'],
          correctIndex: 2,
          explanation:
            'Full sandboxes replicate production completely and are typically reserved for UAT and performance testing. Developer sandboxes copy metadata only.',
        },
        {
          id: 'q-found-plat-6',
          topic: 'Environments',
          prompt: 'What is a scratch org?',
          options: [
            'A backup of production taken nightly',
            'A short-lived org created from a source-controlled definition file',
            'A free personal org that never expires',
            'A read-only reporting replica',
          ],
          correctIndex: 1,
          explanation:
            'Scratch orgs are ephemeral, source-driven environments ideal for isolated feature development and CI pipelines.',
        },
        {
          id: 'q-found-plat-7',
          topic: 'Navigation',
          prompt: 'Where does an admin configure users, security, and objects?',
          options: ['The App Launcher', 'Setup', 'The Chatter feed', 'A list view'],
          correctIndex: 1,
          explanation:
            'Setup (gear icon) is the administration console; Object Manager inside it holds object and field configuration.',
        },
        {
          id: 'q-found-plat-8',
          topic: 'Search',
          prompt: 'Why might two users get different results for the same global search term?',
          options: [
            'Search results are randomized',
            'Search respects record access — users only find records they can see',
            'One user\'s browser cache is stale',
            'Global search only works for admins',
          ],
          correctIndex: 1,
          explanation:
            'Search enforces the sharing model, so visibility differences between users naturally produce different result sets.',
        },
        {
          id: 'q-found-plat-9',
          topic: 'Editions',
          prompt: 'What does the org edition (e.g. Enterprise vs Professional) primarily determine?',
          options: [
            'The color theme of the UI',
            'Available platform features and limits such as API access',
            'How many reports a user can run per day',
            'The physical location of your data only',
          ],
          correctIndex: 1,
          explanation:
            'Edition gates capabilities and limits. Enterprise Edition is the common baseline for API access and serious customization.',
        },
        {
          id: 'q-found-plat-10',
          topic: 'Record pages',
          prompt: 'Two users see different layouts for the same Opportunity record. The most likely reason is:',
          options: [
            'A Salesforce outage',
            'Lightning pages/layouts assigned differently by app, record type, or profile',
            'One user has a corrupted account',
            'Opportunities always render randomly',
          ],
          correctIndex: 1,
          explanation:
            'Lightning record pages and page layouts can be assigned per app, record type, and profile — differing views are configuration, not defects.',
        },
      ],
    },
    {
      id: 'sf-foundations-data-model',
      title: 'The Salesforce Data Model',
      summary:
        'Objects, fields, records, and relationships — the vocabulary every Salesforce conversation is built on.',
      lessons: [
        {
          id: 'foundations-objects-records-fields',
          title: 'Objects, records, and fields',
          summary:
            'Learn the spreadsheet analogy that unlocks everything: objects as tables, fields as columns, records as rows.',
          durationMinutes: 15,
          objectives: [
            'Define objects, fields, and records precisely',
            'Distinguish standard from custom objects and the __c suffix',
            'Read any org\'s schema through Object Manager',
          ],
          sections: [
            {
              heading: 'The spreadsheet analogy',
              body:
                'An object is like a spreadsheet tab: Account, Contact, Opportunity. A field is a column with a type — text, number, date, picklist, checkbox. A record is one row: "Acme Corporation" is a record of the Account object.\n\nThe analogy has limits — objects also carry security, automation, and relationships — but it is the fastest way to read a new org. When someone says "add a field to Case", you now know exactly what that means.',
            },
            {
              heading: 'Standard vs custom',
              body:
                'Salesforce ships standard objects (Account, Contact, Lead, Opportunity, Case) with built-in behavior — Leads convert, Opportunities roll into forecasts. You cannot delete standard objects, but you can extend them with custom fields.\n\nCustom objects are ones your team creates for business-specific data, and their API names end in __c: Delivery_Route__c, Training_Session__c. Field API names work the same way (Discount_Percent__c). The API name is what code, flows, and integrations use; the label is just what humans see — labels can change freely, API names should be treated as permanent.',
            },
            {
              heading: 'Field types matter more than you think',
              body:
                'Choosing a field type is a design decision. Picklists constrain values and power clean reporting; free text invites chaos. Formula fields calculate on read and cannot be edited. Roll-up summaries aggregate child records onto a master record (master-detail only). Lookup fields create relationships — more on those next lesson.\n\nA practical fresher habit: before creating any field, search the object for an existing one. Duplicate fields ("Region", "Region2", "Region Final") are the most common form of org debt.',
            },
          ],
          realWorld: {
            title: 'Modeling a training business',
            scenario:
              'A training company needs to track courses, scheduled sessions, and who attended. They start by cramming session dates into Contact fields — Session1_Date__c, Session2_Date__c — and quickly run out.',
            solution:
              'An admin models it properly: a Course__c object, a Session__c object related to Course__c, and an Attendance__c object linking Contacts to Sessions. Each concept becomes an object, not a pile of fields.',
            outcome:
              'Reporting "who attended what, when" becomes a standard report instead of an impossible spreadsheet export, and adding a tenth session requires zero new fields.',
          },
          keyTakeaways: [
            'Object = table, field = column, record = row — plus security and behavior',
            'Custom objects and fields carry the __c suffix in their API names',
            'API names are contracts: code and integrations depend on them',
            'When data repeats (Session1, Session2…), you need a related object, not more fields',
          ],
          resources: [
            {
              title: 'Data Modeling (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/data_modeling',
              source: 'trailhead',
              note: 'The essential module for this lesson',
            },
            {
              title: 'Object Reference for the Salesforce Platform',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_concepts.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'foundations-relationships',
          title: 'Relationships: lookup, master-detail, and junctions',
          summary:
            'How records connect to each other, and how to choose the right relationship type.',
          durationMinutes: 20,
          objectives: [
            'Differentiate lookup and master-detail relationships',
            'Explain cascade delete, roll-up summaries, and ownership inheritance',
            'Model many-to-many relationships with junction objects',
          ],
          sections: [
            {
              heading: 'Lookup: a loose connection',
              body:
                'A lookup relationship links one record to another while both stay independent. Contact has a lookup to Account: delete the account and (by default) contacts survive with the field cleared, or the delete can be blocked.\n\nUse lookups when the child makes sense on its own, when the relationship is optional, or when the two records have different owners and sharing needs.',
            },
            {
              heading: 'Master-detail: ownership and lifecycle',
              body:
                'Master-detail is a tight bond: the detail record\'s lifecycle belongs to its master. Delete the master and details cascade-delete. Details inherit the master\'s owner and sharing — they have no independent owner.\n\nThe payoff is roll-up summary fields: the master can COUNT, SUM, MIN, or MAX its details natively — total value of all line items on an order, for example — with no code and no scheduled job.',
            },
            {
              heading: 'Junction objects for many-to-many',
              body:
                'A student attends many courses; a course has many students. Neither side can hold a single lookup. The answer is a junction object — a custom object with two master-detail relationships, one to each parent. Each junction record represents one pairing (one enrollment).\n\nStandard Salesforce uses this pattern itself: OpportunityContactRole joins Opportunities and Contacts. When an interviewer asks how to model many-to-many, the junction object is the expected answer.',
            },
          ],
          realWorld: {
            title: 'Order lines that total themselves',
            scenario:
              'A wholesaler tracks Orders and Order Lines. With a lookup relationship, sales managers had to run a report just to know an order\'s total, and orphaned lines survived deleted orders, polluting revenue reports.',
            solution:
              'The admin rebuilt Order_Line__c as master-detail under Order__c, added a roll-up summary Total_Amount__c (SUM of line amounts), and let cascade delete clean up lines automatically.',
            outcome:
              'Order totals appear instantly on every order page and in list views, and the orphan-line data quality problem disappeared entirely.',
          },
          keyTakeaways: [
            'Lookup = independent records loosely linked; master-detail = owned children',
            'Roll-up summary fields require master-detail',
            'Master-detail children inherit sharing and cascade-delete with their master',
            'Junction objects (two master-details) model many-to-many relationships',
          ],
          resources: [
            {
              title: 'Data Modeling (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/data_modeling',
              source: 'trailhead',
            },
            {
              title: 'Object Relationships Overview (Salesforce Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.overview_of_custom_object_relationships.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'foundations-schema-builder',
          title: 'Reading a schema: Object Manager & Schema Builder',
          summary:
            'Use Object Manager and Schema Builder to reverse-engineer how any org is built — a superpower for new team members.',
          durationMinutes: 12,
          objectives: [
            'Inspect fields, relationships, and layouts through Object Manager',
            'Visualize the data model with Schema Builder',
            'Approach an unfamiliar org methodically',
          ],
          sections: [
            {
              heading: 'Object Manager: the encyclopedia',
              body:
                'Setup → Object Manager lists every object in the org. Open one and you can read its fields (with types and API names), relationships, record types, page layouts, and validation rules.\n\nJoining an existing project? Spend your first hours in Object Manager on the five or six core objects. Reading fields and validation rules tells you more about the real business process than most documentation.',
            },
            {
              heading: 'Schema Builder: the map',
              body:
                'Schema Builder (also in Setup) renders objects and relationships as a draggable diagram. Master-detail and lookup lines are drawn differently, so one glance shows you the org\'s backbone.\n\nFilter it to just the objects you care about — a full enterprise org diagram is unreadable. A filtered Schema Builder screenshot is also the fastest artifact to bring to design discussions.',
            },
            {
              heading: 'A method for unfamiliar orgs',
              body:
                'A reliable routine: 1) List the apps users actually use (App Launcher). 2) For each core tab, open Object Manager and read fields + validation rules. 3) Draw the relationship map in Schema Builder. 4) Open a few real records to see layouts and data quality. 5) Only then look at automation (flows, triggers).\n\nThis order — data model before automation — is deliberate: automation only makes sense once you know what the records mean.',
            },
          ],
          realWorld: {
            title: 'Consultant onboards to a 400-object org',
            scenario:
              'A consultant inherits a seven-year-old org with 400+ objects, no documentation, and a departed original team. Leadership wants an assessment within two weeks.',
            solution:
              'They identify the 12 objects behind the primary business flow via app navigation, map them in Schema Builder, and read every validation rule as "business rules written down". Automation review comes last, scoped only to those 12 objects.',
            outcome:
              'The assessment lands on time with an accurate core-process diagram, and three "mystery" objects are flagged as abandoned — later confirmed and archived.',
          },
          keyTakeaways: [
            'Object Manager is the authoritative reference for any object\'s configuration',
            'Schema Builder visualizes relationships — filter it or drown',
            'Validation rules are business rules in disguise; read them when onboarding',
            'Understand the data model before you touch automation',
          ],
          resources: [
            {
              title: 'Data Modeling (Trailhead) — Schema Builder unit',
              url: 'https://trailhead.salesforce.com/content/learn/modules/data_modeling',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-found-dm-1',
          topic: 'Data model',
          prompt: 'In the spreadsheet analogy, a Salesforce record corresponds to a…',
          options: ['Tab', 'Column', 'Row', 'Cell'],
          correctIndex: 2,
          explanation: 'Object = tab/table, field = column, record = one row of data.',
        },
        {
          id: 'q-found-dm-2',
          topic: 'API names',
          prompt: 'What does the __c suffix on Delivery_Route__c indicate?',
          options: [
            'The object is cached',
            'It is a custom object or field created in this org',
            'It is a child object',
            'The object is scheduled for deletion',
          ],
          correctIndex: 1,
          explanation:
            'Custom objects and custom fields always end in __c; standard ones (Account, Name) never do.',
        },
        {
          id: 'q-found-dm-3',
          topic: 'Relationships',
          prompt: 'Which capability REQUIRES a master-detail relationship?',
          options: [
            'Global search',
            'Roll-up summary fields',
            'Formula fields',
            'List views',
          ],
          correctIndex: 1,
          explanation:
            'Roll-ups (COUNT/SUM/MIN/MAX of children) are only available on the master of a master-detail relationship.',
        },
        {
          id: 'q-found-dm-4',
          topic: 'Relationships',
          prompt: 'When the master record of a master-detail relationship is deleted, detail records are…',
          options: [
            'Left orphaned with the field cleared',
            'Automatically deleted (cascade delete)',
            'Reassigned to the system administrator',
            'Converted to standalone objects',
          ],
          correctIndex: 1,
          explanation:
            'Details share their master\'s lifecycle — deleting the master cascade-deletes its details.',
        },
        {
          id: 'q-found-dm-5',
          topic: 'Junction objects',
          prompt: 'How do you model a many-to-many relationship (students ↔ courses)?',
          options: [
            'Two lookup fields on the student',
            'A junction object with two master-detail relationships',
            'A multi-select picklist of course names',
            'Duplicate the student record per course',
          ],
          correctIndex: 1,
          explanation:
            'A junction object (e.g. Enrollment) with master-details to both parents is the standard many-to-many pattern.',
        },
        {
          id: 'q-found-dm-6',
          topic: 'Field design',
          prompt: 'Why prefer a picklist over free text for a "Region" field?',
          options: [
            'Picklists load faster',
            'Constrained values keep reporting and automation reliable',
            'Free text fields cost extra storage',
            'Picklists are required on custom objects',
          ],
          correctIndex: 1,
          explanation:
            '"EMEA", "emea", and "Europe" in free text destroy grouping; a picklist guarantees one clean value set.',
        },
        {
          id: 'q-found-dm-7',
          topic: 'Schema tools',
          prompt: 'Which tool visualizes objects and their relationships as a diagram?',
          options: ['Data Loader', 'Schema Builder', 'App Launcher', 'Report Builder'],
          correctIndex: 1,
          explanation:
            'Schema Builder renders the data model graphically; Object Manager lists configuration per object.',
        },
        {
          id: 'q-found-dm-8',
          topic: 'Data design',
          prompt: 'Fields named Session1_Date__c, Session2_Date__c, Session3_Date__c signal that you should…',
          options: [
            'Add Session4_Date__c preemptively',
            'Create a related Session object instead of repeating fields',
            'Convert them to formula fields',
            'Move them to the page layout footer',
          ],
          correctIndex: 1,
          explanation:
            'Repeating numbered fields indicate a one-to-many relationship that belongs in a child object.',
        },
        {
          id: 'q-found-dm-9',
          topic: 'Standard objects',
          prompt: 'Which of these is a STANDARD Salesforce object?',
          options: ['Opportunity', 'Delivery_Route__c', 'Invoice__c', 'Training_Session__c'],
          correctIndex: 0,
          explanation:
            'Opportunity ships with the platform. The __c suffix on the others marks them as custom.',
        },
        {
          id: 'q-found-dm-10',
          topic: 'Lookups',
          prompt: 'A lookup relationship is the better choice when…',
          options: [
            'You need roll-up summaries on the parent',
            'The child must inherit the parent\'s sharing',
            'Both records are independent and the link is optional',
            'You must cascade delete children',
          ],
          correctIndex: 2,
          explanation:
            'Lookups suit loose, optional links between independently owned records; the other three describe master-detail behavior.',
        },
      ],
    },
    {
      id: 'sf-foundations-productivity',
      title: 'Working with Data, Reports & Collaboration',
      summary:
        'Find, slice, and present data: list views, reports, dashboards, and the collaboration tools around them.',
      lessons: [
        {
          id: 'foundations-list-views',
          title: 'List views, Kanban, and inline editing',
          summary:
            'Master the daily workhorse of Salesforce users: filtered, shareable, editable lists.',
          durationMinutes: 12,
          objectives: [
            'Build and share filtered list views',
            'Switch between table and Kanban visualizations',
            'Use inline editing safely',
          ],
          sections: [
            {
              heading: 'Filters, columns, sharing',
              body:
                'A list view is a saved query over one object: choose filter criteria, pick columns, and share it with everyone, specific groups, or keep it private. "My Overdue Cases" is just Cases where Owner = me and Due Date < TODAY.\n\nWell-named shared list views quietly standardize how a team works. Chaotic orgs have 90 private near-duplicate views; healthy orgs curate a handful of shared ones per object.',
            },
            {
              heading: 'Kanban view',
              body:
                'Any list view can render as a Kanban board grouped by a picklist field — Opportunities by Stage is the classic. Cards drag between columns, updating the underlying field instantly, and each column can show a summarized amount.\n\nKanban is more than cosmetic: for pipeline reviews it turns a data-entry chore into a visual conversation.',
            },
            {
              heading: 'Inline editing and its guardrails',
              body:
                'Double-click a cell in a list view to edit it in place; edit several rows and save once. This is the fastest bulk-update tool that requires zero setup.\n\nGuardrails still apply: validation rules run, field-level security applies, and records locked by approval processes refuse edits. If inline editing is disabled entirely, the view usually mixes multiple record types — a good trivia fact that saves an hour of confusion.',
            },
          ],
          realWorld: {
            title: 'A support team standardizes triage',
            scenario:
              'Each support agent invented their own way of finding work; two high-priority cases sat untouched for a weekend because they matched nobody\'s personal list view.',
            solution:
              'The team lead created three shared views — "Unassigned by Priority", "My Open Cases", "Breaching SLA Today" — pinned "Unassigned by Priority" as the default, and reviewed it in daily standup.',
            outcome:
              'No case has gone unseen since, and new agents are productive on day one because the work queue is defined by the org, not by tribal knowledge.',
          },
          keyTakeaways: [
            'List views are saved queries: filters + columns + sharing',
            'Kanban visualizes any list view grouped by a picklist',
            'Inline editing is bulk editing with validation still enforced',
            'Curated shared views beat dozens of private duplicates',
          ],
          resources: [
            {
              title: 'Lightning Experience Customization (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lex_customization',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'foundations-reports',
          title: 'Reports & dashboards fundamentals',
          summary:
            'Turn records into answers: report formats, filters, groupings, and dashboards that update themselves.',
          durationMinutes: 20,
          objectives: [
            'Build tabular, summary, and matrix reports',
            'Understand report types as the data contract behind reports',
            'Assemble dashboards and schedule subscriptions',
          ],
          sections: [
            {
              heading: 'Report formats',
              body:
                'Tabular reports are flat lists — good for exports. Summary reports group rows (Opportunities by Stage) with subtotals, and are what you will build most. Matrix reports group by rows AND columns (Stage × Region). Joined reports place multiple report blocks side by side for cross-object comparisons.\n\nEvery report starts from a report type, which fixes which objects and fields are available — "Opportunities with Products", "Cases with Contact". If a field seems missing from the report builder, the report type is usually why.',
            },
            {
              heading: 'Filters, buckets, and formulas',
              body:
                'Standard filters constrain scope (My vs All, date ranges); field filters add conditions; cross filters express "Accounts WITH open Cases" or "WITHOUT Opportunities" — the most underused power feature in reporting.\n\nBucket columns group values on the fly (deal size → Small/Medium/Large) without creating fields. Row-level and summary formulas compute values like win rate directly in the report.',
            },
            {
              heading: 'Dashboards',
              body:
                'A dashboard is a grid of components — charts, gauges, tables — each powered by a source report. Dashboards refresh on demand or on schedule, and can be emailed via subscriptions.\n\nOne concept matters above all: the running user. A dashboard runs as a designated user (fixed) or as the viewer (dynamic). Fixed running users can accidentally show every region\'s numbers to everyone — always check this setting before sharing a dashboard broadly.',
            },
          ],
          realWorld: {
            title: 'A Monday-morning pipeline dashboard',
            scenario:
              'A sales VP spent every Monday assembling a pipeline deck by hand: exports, pivot tables, screenshots, PowerPoint — three hours weekly, always slightly stale.',
            solution:
              'An admin built summary reports (pipeline by stage, by owner, closing this quarter, top 10 deals) and a dashboard on top, subscribed to the VP\'s inbox every Monday at 7 am as the viewer.',
            outcome:
              'Three hours became zero, the numbers are live, and reps started keeping stages honest because everyone sees the same board every Monday.',
          },
          keyTakeaways: [
            'Summary reports with groupings are the everyday workhorse',
            'The report type dictates available objects and fields',
            'Cross filters ("with / without related records") answer questions plain filters cannot',
            'Always verify a dashboard\'s running user before sharing it',
          ],
          resources: [
            {
              title: 'Reports & Dashboards for Lightning Experience (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lex_implementation_reports_dashboards',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Help: Reports and Dashboards',
              url: 'https://help.salesforce.com/s/articleView?id=sf.rd_reports_overview.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'foundations-collaboration',
          title: 'Chatter, activities, and the AppExchange',
          summary:
            'Collaborate in context with Chatter and activities, and extend the platform through the AppExchange marketplace.',
          durationMinutes: 13,
          objectives: [
            'Use Chatter feeds, @mentions, and record following effectively',
            'Log activities so history survives employee turnover',
            'Evaluate AppExchange packages sensibly',
          ],
          sections: [
            {
              heading: 'Chatter: collaboration attached to records',
              body:
                'Chatter is the collaboration feed built into records. Discussing a deal ON the opportunity record — @mentioning a colleague, attaching the proposal — keeps the context where the next person will look, instead of buried in someone\'s inbox.\n\nFollow a record to get feed notifications when it changes. Groups host team-level discussion. The discipline "if it\'s about the record, say it on the record" is a hallmark of mature Salesforce teams.',
            },
            {
              heading: 'Activities: tasks and events',
              body:
                'Tasks (to-dos) and events (calendar entries) attach to records via two special fields: Name (a person — Contact or Lead) and Related To (any enabled object). The activity timeline on a record page shows the full interaction history: calls logged, emails sent, meetings held.\n\nWhen a rep resigns, their pipeline is only as recoverable as their activity history. Logging activities is not bureaucracy; it is business continuity.',
            },
            {
              heading: 'AppExchange: the app store',
              body:
                'The AppExchange is Salesforce\'s marketplace of managed packages — from document generation to full industry solutions. Installing a package adds its objects, code, and pages to your org.\n\nEvaluate before installing: security review status, reviews, pricing model, and what permissions it requests. Always install to a sandbox first. The build-vs-buy instinct matters — a $10/user/month package often beats three months of custom development.',
            },
          ],
          realWorld: {
            title: 'Recovering a resigned rep\'s pipeline',
            scenario:
              'A top rep resigns with two weeks\' notice, owning 40 open opportunities. In previous years this meant deals stalling for months while a successor rebuilt context from scratch.',
            solution:
              'Because the team logged calls and kept deal discussion in Chatter on each opportunity, the successor read the timeline and feed for each of the top 15 deals and scheduled continuity calls in week one.',
            outcome:
              'Only two deals slipped a quarter. The sales director credited the "context lives on the record" habit — and made activity logging a formal team norm.',
          },
          keyTakeaways: [
            'Chatter keeps deal and case discussion attached to the record',
            'Activity history is business continuity, not paperwork',
            'AppExchange packages can replace months of custom build — evaluate, then sandbox-test',
            'Follow records you depend on; @mention people to pull them into context',
          ],
          resources: [
            {
              title: 'AppExchange Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/appexchange_basics',
              source: 'trailhead',
            },
            {
              title: 'AppExchange Marketplace',
              url: 'https://appexchange.salesforce.com/',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-found-prod-1',
          topic: 'List views',
          prompt: 'What three things define a list view?',
          options: [
            'Object, Apex class, and layout',
            'Filters, selected columns, and sharing settings',
            'Report type, format, and running user',
            'App, tab, and profile',
          ],
          correctIndex: 1,
          explanation:
            'A list view is a saved query: filter criteria, displayed columns, and who can see it.',
        },
        {
          id: 'q-found-prod-2',
          topic: 'Kanban',
          prompt: 'Kanban view groups records into columns based on…',
          options: [
            'The record owner',
            'A picklist field such as Stage or Status',
            'Creation date',
            'Alphabetical order',
          ],
          correctIndex: 1,
          explanation:
            'Kanban lanes come from a picklist field; dragging a card updates that field on the record.',
        },
        {
          id: 'q-found-prod-3',
          topic: 'Reports',
          prompt: 'Which report format supports grouping rows AND columns (e.g. Stage × Region)?',
          options: ['Tabular', 'Summary', 'Matrix', 'Joined'],
          correctIndex: 2,
          explanation:
            'Matrix reports group on both axes; summary reports group rows only; tabular reports are flat.',
        },
        {
          id: 'q-found-prod-4',
          topic: 'Report types',
          prompt: 'A field you need is missing in the report builder. The most likely cause is…',
          options: [
            'The field was deleted',
            'The chosen report type does not include it',
            'Reports cannot show custom fields',
            'You must enable it in Chatter first',
          ],
          correctIndex: 1,
          explanation:
            'The report type is the contract deciding which objects and fields a report can use.',
        },
        {
          id: 'q-found-prod-5',
          topic: 'Cross filters',
          prompt: 'Which reporting feature answers "show Accounts WITHOUT any open Opportunities"?',
          options: ['Bucket column', 'Cross filter', 'Summary formula', 'Chart filter'],
          correctIndex: 1,
          explanation:
            'Cross filters express with/without conditions over related records — a plain field filter cannot.',
        },
        {
          id: 'q-found-prod-6',
          topic: 'Dashboards',
          prompt: 'Why is a dashboard\'s "running user" setting security-relevant?',
          options: [
            'It controls the refresh schedule',
            'Data is shown according to that user\'s access — a fixed user may over-expose data',
            'It decides who may edit the dashboard',
            'It changes the color palette',
          ],
          correctIndex: 1,
          explanation:
            'A fixed running user renders data with THEIR visibility for all viewers; "run as viewer" respects each person\'s own access.',
        },
        {
          id: 'q-found-prod-7',
          topic: 'Chatter',
          prompt: 'What is the main benefit of discussing a deal in Chatter on the opportunity record?',
          options: [
            'Chatter posts increase the opportunity amount',
            'The context stays attached to the record for anyone who works it later',
            'It bypasses sharing rules',
            'It sends the post to all customers',
          ],
          correctIndex: 1,
          explanation:
            'Record-based collaboration preserves institutional knowledge where the next owner will look.',
        },
        {
          id: 'q-found-prod-8',
          topic: 'Activities',
          prompt: 'On a Task, the "Related To" field can point to…',
          options: [
            'Only Contacts',
            'Only Accounts',
            'Any activity-enabled object, such as an Account or a custom object',
            'Only other Tasks',
          ],
          correctIndex: 2,
          explanation:
            '"Name" points to a person (Contact/Lead); "Related To" links the activity to any activity-enabled record.',
        },
        {
          id: 'q-found-prod-9',
          topic: 'AppExchange',
          prompt: 'Before installing an AppExchange package in production you should…',
          options: [
            'Install it in a sandbox and review its permissions first',
            'Disable all validation rules',
            'Delete unused custom objects',
            'Export all data as CSV',
          ],
          correctIndex: 0,
          explanation:
            'Sandbox-first installation plus a permissions/security review is the standard safe path.',
        },
        {
          id: 'q-found-prod-10',
          topic: 'Inline editing',
          prompt: 'Inline editing in a list view will still be blocked by…',
          options: [
            'Kanban view being enabled',
            'Validation rules and field-level security',
            'The App Launcher',
            'Dashboard subscriptions',
          ],
          correctIndex: 1,
          explanation:
            'Inline edits are real record edits: validation rules, FLS, and record locks all still apply.',
        },
      ],
    },
  ],
};
