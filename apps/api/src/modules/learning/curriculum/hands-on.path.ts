import type { CurriculumPath } from './curriculum.types';

/**
 * Path — Salesforce Hands-on Lab (Beginner).
 * Click-path practice in a blank org / Trailhead Playground so learners build
 * muscle memory before deeper admin or developer tracks.
 */
export const handsOnPath: CurriculumPath = {
  id: 'sf-hands-on',
  title: 'Salesforce Hands-on Lab',
  tagline: 'Practice in a blank org — click paths that stick after Trailhead playground setup.',
  description:
    'Learn by doing in a free Trailhead Playground or blank Developer Edition org. You will create custom objects and fields, customize page layouts and Lightning pages, enter records, build a screen Flow, and ship a report from scratch — with numbered Setup click-paths you can follow at the keyboard.',
  level: 'beginner',
  badge: 'Hands-on Lab Completer',
  estimatedHours: 5,
  skills: [
    'Trailhead Playground setup',
    'Object Manager',
    'Page layouts & App Builder',
    'Records & list views',
    'Screen Flows',
    'Reports from scratch',
  ],
  modules: [
    {
      id: 'sf-hands-on-org-schema',
      title: 'Your Practice Org & Custom Schema',
      summary:
        'Stand up a Trailhead Playground, then model a small business object with fields, layouts, and a Lightning record page.',
      lessons: [
        {
          id: 'hands-on-playground-setup',
          title: 'Create a Trailhead Playground or blank practice org',
          summary:
            'Get a free, disposable Salesforce org you own — and learn how to open it, reset credentials, and keep practice work separate from production.',
          durationMinutes: 15,
          objectives: [
            'Create a Trailhead Playground (or Developer Edition) and launch it',
            'Locate username, reset password, and confirm you can log in directly',
            'Explain why practice work belongs in a playground, never production',
          ],
          sections: [
            {
              heading: 'Why a blank org matters',
              body:
                'Reading about Object Manager is not the same as clicking through it. A Trailhead Playground (or free Developer Edition org) gives you a full Salesforce environment with admin rights, sample apps, and no risk to real company data.\n\nTreat it as disposable: you can break things, create junk objects, and start over. That freedom is how muscle memory forms.',
            },
            {
              heading: 'Click-path: create and open a Playground',
              body:
                '1. Sign in at trailhead.salesforce.com with your Trailhead account.\n2. Open any hands-on Trailhead module (or go to your profile → Hands-on Orgs).\n3. When prompted for a hands-on org, choose Create Playground (or Create a Trailhead Playground).\n4. Wait until status shows Ready, then click Launch.\n5. Confirm you land in Lightning Experience with the App Launcher (waffle) visible.\n\nIf Launch opens a login challenge, use Get Your Login Credentials from the same Hands-on Orgs screen, copy the username, reset the password, then log in at login.salesforce.com.',
            },
            {
              heading: 'Orient yourself in Setup',
              body:
                '1. Click the gear icon (top-right) → Setup.\n2. Note the org name in the Setup header — this is your practice tenant.\n3. In Quick Find, type Object Manager and open it — you will live here for the next lessons.\n4. In Quick Find, type Users → Users and find your user; confirm Profile is System Administrator.\n\nGolden rule: never practice configuration in a company production org. Playgrounds and Developer Edition orgs exist so you can experiment safely.',
            },
          ],
          realWorld: {
            title: 'A new admin practices before touching UAT',
            scenario:
              'A company hires a junior admin. The manager will not grant Setup access in the shared UAT sandbox until the hire proves they can create objects and fields without breaking layouts.',
            solution:
              'The hire creates a Trailhead Playground, completes a personal mini-project (custom object + fields + layout), and screenshares the Object Manager walkthrough in the next 1:1.',
            outcome:
              'The manager grants UAT Setup access with confidence, and the hire already knows where Object Manager, App Builder, and Flows live — so onboarding tickets take minutes instead of hours.',
          },
          keyTakeaways: [
            'A Trailhead Playground is a free, admin-capable org for practice',
            'Launch from Trailhead; recover credentials from Hands-on Orgs if needed',
            'Confirm System Administrator before starting lab work',
            'Never use production as a learning environment',
          ],
          resources: [
            {
              title: 'Trailhead Basics',
              url: 'https://trailhead.salesforce.com/content/learn/modules/trailhead_basics',
              source: 'trailhead',
              note: 'Create and manage Playgrounds',
            },
            {
              title: 'Sign up for a Developer Edition',
              url: 'https://developer.salesforce.com/signup',
              source: 'developer',
              note: 'Alternative blank org if you prefer DE',
            },
          ],
        },
        {
          id: 'hands-on-custom-object-fields',
          title: 'Object Manager: custom objects and fields',
          summary:
            'Build a custom object with typed fields — the foundation every Salesforce app sits on.',
          durationMinutes: 25,
          objectives: [
            'Create a custom object with a sensible API name and name field',
            'Add custom fields of multiple types (text, number, date, picklist, checkbox)',
            'Find field API names in Object Manager and explain why they matter',
          ],
          sections: [
            {
              heading: 'Decide what you are modeling',
              body:
                'For this lab, model a simple Training Session object: something a learning team might track. You need a name, a session date, a delivery mode (picklist), a capacity (number), and a flag for whether registration is open.\n\nBefore clicking, write the field list on paper. Admins who design first create cleaner orgs than admins who invent fields mid-build.',
            },
            {
              heading: 'Click-path: create the custom object',
              body:
                '1. Gear → Setup → Quick Find: Object Manager → Object Manager.\n2. Click Create → Custom Object.\n3. Label: Training Session. Plural Label: Training Sessions.\n4. Object Name / API Name: leave as Training_Session (Salesforce adds __c).\n5. Record Name: Session Name, Data Type: Text.\n6. Check Allow Reports, Allow Search, Allow Activities (optional but useful).\n7. Deployment Status: Deployed.\n8. Check Launch New Custom Tab Wizard after saving → Save.\n9. In the tab wizard, choose a Tab Style → Next → set visibility (Visible for System Administrator) → Save.',
            },
            {
              heading: 'Click-path: add custom fields',
              body:
                '1. Setup → Object Manager → Training Session → Fields & Relationships → New.\n2. Create Session_Date__c: Data Type Date → Next → Field Label Session Date → Next → visible to all profiles → Next → add to page layout → Save.\n3. Create Delivery_Mode__c: Picklist → values In Person, Virtual, Hybrid → Next → complete wizard → Save.\n4. Create Capacity__c: Number (length 3, decimal 0) → complete wizard → Save.\n5. Create Registration_Open__c: Checkbox, default Checked → complete wizard → Save.\n\nAfter each field, open the field detail and note the Field Name (API name ending in __c). Flows, reports, and code use the API name — treat it as permanent.',
            },
          ],
          realWorld: {
            title: 'HR needs a training tracker by Friday',
            scenario:
              'HR asks for a place to log instructor-led sessions without buying a new tool. IT will not approve an AppExchange package for a two-week pilot.',
            solution:
              'An admin creates Training_Session__c with date, mode, capacity, and registration fields in a sandbox first, then deploys the same shape to production after a short demo.',
            outcome:
              'HR enters sessions the same week, and the schema is clean enough to attach a Flow and a report later without renaming everything.',
          },
          keyTakeaways: [
            'Custom objects get a __c API suffix; design labels and API names carefully',
            'Object Manager → Fields & Relationships is where typed fields are created',
            'Picklists constrain values; numbers and dates enable reporting later',
            'API names are permanent contracts for automation and integrations',
          ],
          resources: [
            {
              title: 'Data Modeling (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/data_modeling',
              source: 'trailhead',
            },
            {
              title: 'Create Custom Objects (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.creating_custom_objects.htm',
              source: 'help',
            },
          ],
        },
        {
          id: 'hands-on-layouts-app-builder',
          title: 'Page layouts and Lightning App Builder',
          summary:
            'Control what users see: classic page layouts for fields and related lists, Lightning App Builder for the record page experience.',
          durationMinutes: 25,
          objectives: [
            'Edit a page layout to arrange sections and fields',
            'Open Lightning App Builder and activate a record page',
            'Explain the difference between page layouts and Lightning record pages',
          ],
          sections: [
            {
              heading: 'Two layers of "what the user sees"',
              body:
                'Page layouts control which fields, buttons, and related lists appear and in what order — they are the older, still-required layer.\n\nLightning record pages (Lightning App Builder) arrange components: highlights panel, record detail, related lists, tabs, and custom components. You usually need both: put fields on the layout, then present them inside a Lightning page.',
            },
            {
              heading: 'Click-path: edit the page layout',
              body:
                '1. Setup → Object Manager → Training Session → Page Layouts.\n2. Open Training Session Layout (or the layout assigned to your profile).\n3. Drag a Section onto the layout; name it Session Details; 2-column.\n4. Drag Session Date, Delivery Mode, Capacity, and Registration Open into the section.\n5. Remove unused standard fields from the detail area if they clutter the page.\n6. Click Save.\n\nTip: fields not on the layout are invisible on the record detail component even if the user has field-level security access.',
            },
            {
              heading: 'Click-path: Lightning App Builder record page',
              body:
                '1. Setup → Object Manager → Training Session → Lightning Record Pages → New (or Edit the existing default).\n2. Choose Record Page → label Training Session Record Page → object Training Session → Next.\n3. Start from Default or Clone Salesforce Default → Finish.\n4. In App Builder, ensure Highlights Panel and Record Detail are on the canvas; add a Related Lists or Related List - Single component if needed.\n5. Click Activation → assign as Org Default (fine for a playground) → Save → Back.\n6. App Launcher → Training Sessions → open any record and verify your fields and layout.\n\nIf fields are missing, fix the page layout first, then refresh the Lightning page.',
            },
          ],
          realWorld: {
            title: 'Users ignore half the fields on a crowded page',
            scenario:
              'Sales ops added fifteen custom fields to Opportunity. Reps still left them blank because everything sat in one long column with no visual grouping.',
            solution:
              'An admin regrouped fields into page-layout sections (Commercial, Risk, Handoff) and rebuilt the Lightning record page with tabs so day-to-day fields appear first.',
            outcome:
              'Field completion for the critical handoff fields rose sharply within two weeks — same data model, better presentation.',
          },
          keyTakeaways: [
            'Page layouts control field placement; Lightning pages control component layout',
            'A field must be on the layout to appear in Record Detail',
            'Activate Lightning pages (org, app, or app+record type+profile)',
            'Clean sections beat long unsorted field lists',
          ],
          resources: [
            {
              title: 'Lightning Experience Customization (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lex_customization',
              source: 'trailhead',
            },
            {
              title: 'Lightning App Builder (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.lightning_app_builder_overview.htm',
              source: 'help',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-hands-org-1',
          topic: 'Playground',
          prompt: 'What is a Trailhead Playground primarily for?',
          options: [
            'Hosting a company production CRM',
            'Safe personal practice with admin rights',
            'Replacing Full sandboxes for UAT',
            'Storing customer payment data',
          ],
          correctIndex: 1,
          explanation:
            'Playgrounds are free practice orgs so learners can configure and break things without touching production.',
        },
        {
          id: 'q-hands-org-2',
          topic: 'Playground',
          prompt: 'You click Launch and hit a login screen. Where do you usually recover Playground credentials?',
          options: [
            'Setup → Company Information',
            'Trailhead profile → Hands-on Orgs → Get Your Login Credentials',
            'App Launcher → Credentials',
            'The AppExchange',
          ],
          correctIndex: 1,
          explanation:
            'Trailhead Hands-on Orgs exposes the username and a password reset for each playground.',
        },
        {
          id: 'q-hands-org-3',
          topic: 'Setup',
          prompt: 'Which path opens Object Manager?',
          options: [
            'App Launcher → Reports',
            'Gear → Setup → Object Manager',
            'Chatter → Topics',
            'File upload dialog',
          ],
          correctIndex: 1,
          explanation:
            'Object Manager lives in Setup and is the home for object and field configuration.',
        },
        {
          id: 'q-hands-org-4',
          topic: 'Custom objects',
          prompt: 'What suffix do custom object API names use?',
          options: ['__std', '__c', '__x', '__custom'],
          correctIndex: 1,
          explanation:
            'Custom objects and custom fields use the __c suffix in their API names.',
        },
        {
          id: 'q-hands-org-5',
          topic: 'Fields',
          prompt: 'Which field type is best for a fixed list of delivery modes like Virtual and In Person?',
          options: ['Long Text Area', 'Picklist', 'Formula', 'Auto Number'],
          correctIndex: 1,
          explanation:
            'Picklists constrain values to a defined set, which improves data quality and reporting.',
        },
        {
          id: 'q-hands-org-6',
          topic: 'API names',
          prompt: 'Why should you treat field API names as permanent?',
          options: [
            'They appear in the browser tab title',
            'Flows, code, and integrations reference them',
            'They cannot contain underscores',
            'Salesforce deletes labels nightly',
          ],
          correctIndex: 1,
          explanation:
            'Automation and integrations bind to API names; labels can change, API names should not.',
        },
        {
          id: 'q-hands-org-7',
          topic: 'Page layouts',
          prompt: 'A user has field-level access but still cannot see a field on the record. What should you check first?',
          options: [
            'Whether the field is on the page layout',
            'Whether the org uses Classic only',
            'Whether multi-factor authentication is enabled',
            'Whether the field label contains spaces',
          ],
          correctIndex: 0,
          explanation:
            'Record Detail respects the page layout; fields omitted from the layout do not appear there.',
        },
        {
          id: 'q-hands-org-8',
          topic: 'Lightning pages',
          prompt: 'What tool do you use to arrange components on a Lightning record page?',
          options: [
            'Process Builder',
            'Lightning App Builder',
            'Schema Builder only',
            'Data Loader',
          ],
          correctIndex: 1,
          explanation:
            'Lightning App Builder assembles highlights, detail, related lists, and other components on record pages.',
        },
        {
          id: 'q-hands-org-9',
          topic: 'Activation',
          prompt: 'After building a Lightning record page, what must you do before users see it?',
          options: [
            'Export it to Excel',
            'Activate and assign it (org, app, or app+record type+profile)',
            'Convert it to a Visualforce page',
            'Enable Debug Mode',
          ],
          correctIndex: 1,
          explanation:
            'Unactivated pages do not serve to users; activation assigns the page to the right audiences.',
        },
        {
          id: 'q-hands-org-10',
          topic: 'Practice safety',
          prompt: 'Where should a beginner practice creating custom objects?',
          options: [
            'Company production',
            'A Trailhead Playground or Developer Edition org',
            'A partner Community only',
            'The public website CMS',
          ],
          correctIndex: 1,
          explanation:
            'Practice orgs isolate experiments from live business data and users.',
        },
      ],
    },
    {
      id: 'sf-hands-on-data-automation',
      title: 'Records, Flows, and Reports',
      summary:
        'Enter data, guide users with a screen Flow, and prove the work with a report built from scratch.',
      lessons: [
        {
          id: 'hands-on-records-list-views',
          title: 'Create records and useful list views',
          summary:
            'Populate your object, then build filtered list views so users find the right rows in one click.',
          durationMinutes: 20,
          objectives: [
            'Create records from the object home and from a related context',
            'Build a filtered, shared list view with visible columns',
            'Pin a default list view for faster daily use',
          ],
          sections: [
            {
              heading: 'Click-path: create Training Session records',
              body:
                '1. App Launcher → search Training Sessions → open the tab.\n2. Click New.\n3. Session Name: Q3 Onboarding Kickoff.\n4. Session Date: pick a date next month.\n5. Delivery Mode: Virtual. Capacity: 40. Registration Open: checked.\n6. Save & New and create two more sessions with different modes and dates.\n7. Return to the object home and confirm three rows appear in Recently Viewed.',
            },
            {
              heading: 'Click-path: build a list view',
              body:
                '1. On the Training Sessions tab, click the list view picker (next to Recently Viewed) → New.\n2. Name: Open Virtual Sessions. API Name: Open_Virtual_Sessions.\n3. Who sees this list view: All users can see this list view (fine in a playground) → Save.\n4. Click the filter funnel → Add Filter: Delivery Mode equals Virtual.\n5. Add Filter: Registration Open equals True → Save filters.\n6. Select Fields to Display → add Session Date, Delivery Mode, Capacity, Registration Open → Save.\n7. Optionally pin Open Virtual Sessions as your default list view.',
            },
            {
              heading: 'List views vs reports',
              body:
                'List views are for operational work — scanning, editing inline (when enabled), and opening records. Reports are for analysis — grouping, charting, and scheduled delivery.\n\nIf a user says "I need a list of open virtual sessions on my tab," that is a list view. If they say "I need capacity by month for leadership," that is a report.',
            },
          ],
          realWorld: {
            title: 'Support managers drown in Recently Viewed',
            scenario:
              'A support manager opens Cases every morning and spends ten minutes re-applying the same filters for high-priority open cases owned by their queue.',
            solution:
              'An admin creates a shared list view High Priority — My Queue with status, priority, and age columns, then teaches the team to pin it.',
            outcome:
              'Morning triage starts on the right queue instantly, and the manager stops asking for a "dashboard" when a list view was the real need.',
          },
          keyTakeaways: [
            'Object tabs are where users create and browse records',
            'List views combine filters, columns, and sharing',
            'Pin defaults for roles that repeat the same scan daily',
            'Use list views for operations; reports for analysis',
          ],
          resources: [
            {
              title: 'Lightning Experience Desktop (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lex_migration_whatsnew',
              source: 'trailhead',
            },
            {
              title: 'Create a List View (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.customviews.htm',
              source: 'help',
            },
          ],
        },
        {
          id: 'hands-on-screen-flow-basics',
          title: 'Flow Builder: your first screen flow',
          summary:
            'Guide users through a short wizard that creates a Training Session without exposing the full record form.',
          durationMinutes: 30,
          objectives: [
            'Create a Screen Flow in Flow Builder',
            'Add screen inputs, a Create Records element, and connect the path',
            'Activate the flow and add it to a Lightning page or run it from App Launcher',
          ],
          sections: [
            {
              heading: 'When screen flows beat a raw New button',
              body:
                'The standard New form shows every field on the layout. A screen Flow lets you ask only what matters, add help text, branch on answers, and create related records in one guided path.\n\nFor this lab you will collect Session Name, Session Date, and Delivery Mode, then create the Training_Session__c record.',
            },
            {
              heading: 'Click-path: build the screen flow',
              body:
                '1. Gear → Setup → Quick Find: Flows → Flows → New Flow.\n2. Select Screen Flow → Create.\n3. Open the Manager (left) → New Resource → Variable: apiName recordTrainingSession, Data Type Record, Object Training Session, Availability for input unchecked → Done.\n4. Drag Screen onto the canvas. Label: Session Details. Add Text input Session Name (require), Date Session Date (require), Picklist Delivery Mode with choices In Person, Virtual, Hybrid.\n5. Drag Create Records after the screen. Label: Create Session. Set how to use: one record. Object: Training Session. Field mapping: Name ← Session_Name screen component, Session_Date__c ← Session_Date, Delivery_Mode__c ← Delivery_Mode. Optionally set Registration_Open__c to {!$GlobalConstant.True}.\n6. Connect Start → Screen → Create Records. Click Save: Flow Label New Training Session Wizard, API Name New_Training_Session_Wizard → Save.\n7. Click Activate.',
            },
            {
              heading: 'Click-path: let users run it',
              body:
                'Option A — Lightning page action:\n1. Setup → Object Manager → Training Session → Lightning Record Pages → Edit.\n2. Or add a new App Page: Setup → Lightning App Builder → New → App Page → host the Flow component pointing at New Training Session Wizard → Activation → add to an app.\n\nOption B — quick test:\n1. Setup → Flows → open your flow → Run.\n2. Fill the screen → verify a new Training Session record appears on the tab.\n\nIf Create Records fails, confirm API field names and that the running user can create the object.',
            },
          ],
          realWorld: {
            title: 'Field reps skip required handoff fields',
            scenario:
              'Closed-won opportunities need a handoff form, but reps ignore optional fields on the record page and operations receives incomplete packages.',
            solution:
              'A screen Flow launched from an Opportunity action collects only the handoff questions, validates required answers, and writes them to fields plus a related onboarding task.',
            outcome:
              'Incomplete handoffs drop because the wizard will not finish without the critical answers — without cluttering the main Opportunity layout.',
          },
          keyTakeaways: [
            'Screen Flows guide data entry with only the fields you choose',
            'Create Records writes to the database after screen inputs',
            'Activate before users can run the flow',
            'Test with Run in Flow Builder before adding the flow to pages',
          ],
          resources: [
            {
              title: 'Flow Builder Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/flow-builder',
              source: 'trailhead',
            },
            {
              title: 'Build a Screen Flow (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.flow_build_screen.htm',
              source: 'help',
            },
          ],
        },
        {
          id: 'hands-on-reports-from-scratch',
          title: 'Build a report from scratch',
          summary:
            'Create a tabular report on your custom object, filter it, group it, and hang a chart for a simple dashboard-ready view.',
          durationMinutes: 25,
          objectives: [
            'Create a custom report type or use the custom object report type',
            'Build a filtered report with groupings and a chart',
            'Save the report in a public folder for sharing',
          ],
          sections: [
            {
              heading: 'Reports need a report type',
              body:
                'A report type defines the object (and related objects) available as columns. When you checked Allow Reports on Training Session, Salesforce created a primary report type for that object.\n\nIf the object does not appear in the create-report wizard, return to Object Manager → edit the object → enable Allow Reports, then try again.',
            },
            {
              heading: 'Click-path: create the report',
              body:
                '1. App Launcher → Reports → New Report.\n2. Search Training Sessions → select Training Sessions → Start Report.\n3. Outline panel: ensure columns Session Name, Session Date, Delivery Mode, Capacity, Registration Open are present (Add column if needed).\n4. Filters: Show Me All Training Sessions; Session Date = Current FQ (or Range → next 90 days).\n5. Optional: Add filter Registration Open equals True.\n6. Group Rows by Delivery Mode (in the Outline → group).\n7. Click the chart icon → donut or horizontal bar on Record Count.\n8. Save: Report Name Upcoming Sessions by Mode, Folder: Public Reports (or create Hands-on Lab folder) → Save.\n9. Run and confirm counts match the records you created.',
            },
            {
              heading: 'From report to daily habit',
              body:
                'Subscribe yourself to the report (Report → Subscribe) for a weekly email if your org edition supports it. For leadership, place the same report chart on a Lightning dashboard later.\n\nValidate with a known dataset: if you created three sessions and two are Virtual, the Virtual bucket should show two — if not, check filters and field values, not the chart type.',
            },
          ],
          realWorld: {
            title: 'Ops cannot answer "how many virtual seats next month?"',
            scenario:
              'Before leadership standup, operations opens spreadsheets exported last week. Capacity numbers disagree with Salesforce because people kept working in the export.',
            solution:
              'An admin builds Upcoming Sessions by Mode on Training_Session__c with live filters and a chart, then teaches ops to open the report instead of exporting.',
            outcome:
              'Standup answers come from one live report in under a minute, and the stale spreadsheet habit fades.',
          },
          keyTakeaways: [
            'Allow Reports on the object before it appears in the report wizard',
            'Filters and groupings turn a row dump into an operational answer',
            'Save to a shared folder so others can run the same report',
            'Validate report totals against records you know you created',
          ],
          resources: [
            {
              title: 'Reports & Dashboards for Lightning Experience (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/reports_dashboards_lightning_experience',
              source: 'trailhead',
            },
            {
              title: 'Create a Report (Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.reports_builder_create.htm',
              source: 'help',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-hands-data-1',
          topic: 'Records',
          prompt: 'Where do end users typically click to create a new Training Session record?',
          options: [
            'Setup → Object Manager → New',
            'The Training Sessions tab → New',
            'Setup → Flows → Debug',
            'Company Information',
          ],
          correctIndex: 1,
          explanation:
            'Object tabs in Lightning are the standard place to create and browse records.',
        },
        {
          id: 'q-hands-data-2',
          topic: 'List views',
          prompt: 'What do list view filters do?',
          options: [
            'Change field-level security',
            'Narrow which records appear in the table',
            'Deploy metadata to production',
            'Reset user passwords',
          ],
          correctIndex: 1,
          explanation:
            'Filters define the record set shown in that saved list view.',
        },
        {
          id: 'q-hands-data-3',
          topic: 'List views vs reports',
          prompt: 'A manager wants a chart of capacity by month for leadership. What should you build?',
          options: [
            'Only a list view',
            'A report (and optionally a dashboard)',
            'A validation rule',
            'A sharing rule',
          ],
          correctIndex: 1,
          explanation:
            'Analytical charts and groupings belong in reports/dashboards, not list views.',
        },
        {
          id: 'q-hands-data-4',
          topic: 'Flow types',
          prompt: 'Which flow type presents screens to a user and collects input?',
          options: [
            'Schedule-Triggered Flow',
            'Record-Triggered Flow only',
            'Screen Flow',
            'Platform Event-Triggered Flow',
          ],
          correctIndex: 2,
          explanation:
            'Screen Flows are interactive wizards; other types run in the background without UI screens.',
        },
        {
          id: 'q-hands-data-5',
          topic: 'Flow Builder',
          prompt: 'Which element writes a new Training Session row in your wizard flow?',
          options: [
            'Get Records',
            'Create Records',
            'Assignment only',
            'Decision only',
          ],
          correctIndex: 1,
          explanation:
            'Create Records performs DML insert based on the field values you map.',
        },
        {
          id: 'q-hands-data-6',
          topic: 'Flow activation',
          prompt: 'A flow runs in the Flow Builder Run dialog but users cannot see it in the UI. Likely cause?',
          options: [
            'The object API name is too long',
            'The flow is not activated or not exposed on a page/action',
            'List views are pinned',
            'Reports are disabled org-wide',
          ],
          correctIndex: 1,
          explanation:
            'Draft flows are for builders; activation plus a host (page, action, etc.) is required for users.',
        },
        {
          id: 'q-hands-data-7',
          topic: 'Reports',
          prompt: 'Why might Training Sessions not appear when you click New Report?',
          options: [
            'Custom objects cannot be reported',
            'Allow Reports is unchecked on the object',
            'You must use Classic',
            'Picklist fields block reporting',
          ],
          correctIndex: 1,
          explanation:
            'Allow Reports must be enabled on the object for its report type to be available.',
        },
        {
          id: 'q-hands-data-8',
          topic: 'Reports',
          prompt: 'Grouping rows by Delivery Mode in a report primarily helps you:',
          options: [
            'Change sharing settings',
            'Aggregate and compare counts per mode',
            'Create Apex classes',
            'Delete unused fields',
          ],
          correctIndex: 1,
          explanation:
            'Row groupings bucket records so subtotals and charts become meaningful.',
        },
        {
          id: 'q-hands-data-9',
          topic: 'Folders',
          prompt: 'Why save a report to a shared/public folder in a team org?',
          options: [
            'Reports only run from shared folders',
            'Other users can find and run the same report',
            'It converts the report into a Flow',
            'It disables filters permanently',
          ],
          correctIndex: 1,
          explanation:
            'Folder sharing controls who can access saved reports.',
        },
        {
          id: 'q-hands-data-10',
          topic: 'Validation',
          prompt: 'Best way to verify a new report is correct after creating three known sample records?',
          options: [
            'Compare report totals to the records you know exist',
            'Delete the report type',
            'Turn off Allow Reports',
            'Convert all fields to text',
          ],
          correctIndex: 0,
          explanation:
            'Known sample data is the fastest check that filters and groupings behave as intended.',
        },
      ],
    },
  ],
};
