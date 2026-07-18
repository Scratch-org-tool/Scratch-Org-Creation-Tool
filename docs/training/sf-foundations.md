# Salesforce Foundations — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Beginner · **Category:** Salesforce core curriculum · **Badge:** Foundations Graduate · **Modules:** 3 · **Lessons:** 9 · **Estimated effort:** ~6h

Start here if you are new to Salesforce or CRM in general. This path explains what Salesforce is, how the platform organizes information, and how real teams use it every day. You will finish able to navigate any org, read its data model, and build your first report.

**Skills:** CRM concepts · Lightning navigation · Data model literacy · Reports & dashboards

## Contents

- **Module 1: Welcome to Salesforce & the Cloud**
  - Lesson 1.1: What is Salesforce? CRM in plain language
  - Lesson 1.2: The ecosystem: clouds, editions, and orgs
  - Lesson 1.3: Navigating Lightning Experience
- **Module 2: The Salesforce Data Model**
  - Lesson 2.1: Objects, records, and fields
  - Lesson 2.2: Relationships: lookup, master-detail, and junctions
  - Lesson 2.3: Reading a schema: Object Manager & Schema Builder
- **Module 3: Working with Data, Reports & Collaboration**
  - Lesson 3.1: List views, Kanban, and inline editing
  - Lesson 3.2: Reports & dashboards fundamentals
  - Lesson 3.3: Chatter, activities, and the AppExchange

## Module 1: Welcome to Salesforce & the Cloud

What CRM means, why companies choose Salesforce, and how the ecosystem of clouds, editions, and releases fits together.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 1.1 — What is Salesforce? CRM in plain language

**Lesson ID:** `foundations-what-is-salesforce` · **Reading time:** 15 min · **Video:** 5:00

> Understand what a CRM does, the problem Salesforce solves, and the multi-tenant cloud model behind it.

**Learning objectives**

- Explain what a CRM is and the business problems it solves
- Describe Salesforce as a multi-tenant, metadata-driven cloud platform
- Recognize the difference between Salesforce the product and the platform

#### Concept explanation

##### CRM: one shared source of customer truth

CRM stands for Customer Relationship Management. Before CRM software, sales reps kept customer details in personal spreadsheets, support agents kept notes in email threads, and marketing had its own lists. Nobody saw the full picture, and when an employee left, their knowledge left with them.

A CRM centralizes every interaction — calls, emails, deals, support cases — against a single customer record. Salesforce is the market-leading CRM: when a sales rep at your company opens an account, they see the same up-to-date information the support team and the finance team see.

##### Multi-tenant cloud, explained with an office building

Salesforce runs as a multi-tenant cloud. Think of an office building: every company (a "tenant") rents its own floor, but everyone shares the same foundation, elevators, and electricity. Your company's Salesforce environment — called an org — is your private floor: your data, your customizations, your users. Salesforce maintains the shared building, so you never patch servers or install upgrades.

Three times a year (Spring, Summer, Winter releases) every tenant gets new features automatically. This is why customizations in Salesforce are described as metadata — declarative descriptions of your setup that survive every upgrade — rather than modified source code.

##### Product vs platform

Salesforce sells ready-made applications — Sales Cloud for pipeline management, Service Cloud for support, Marketing Cloud for campaigns. All of them sit on the same underlying engine, historically called Force.com and now the Salesforce Platform.

This matters for your career: once you understand the platform (objects, automation, security), you can work across any Salesforce product. Companies also build entirely custom applications on the platform — anything from recruitment tracking to logistics — without owning a single server.

#### Real-world example — A distributor consolidates five spreadsheets

- **Scenario:** A beverage distributor tracked leads in one spreadsheet, orders in another, and complaints in a shared inbox. Sales reps regularly visited customers who had open unresolved complaints — and had no idea.
- **Solution:** They moved to Salesforce: every customer became an Account record, every complaint a Case, every deal an Opportunity. The rep's mobile app now shows open cases right on the account page before a visit.
- **Outcome:** Visit preparation dropped from 30 minutes of spreadsheet archaeology to a 2-minute record review, and complaint-related churn fell because reps stopped walking into meetings blind.

#### Key takeaways

- CRM centralizes every customer interaction into a single shared record
- Salesforce is multi-tenant: your org is isolated, but the infrastructure is shared and upgraded for you
- Customizations are metadata, which is why they survive three releases per year
- Learning the platform transfers across every Salesforce product

#### Go deeper

- [Salesforce Platform Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/starting_force_com) — The canonical starting module
- [Trailhead Basics](https://trailhead.salesforce.com/content/learn/modules/trailhead_basics) — Set up your free Trailhead Playground org

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why What is Salesforce? CRM in plain language matters | intro |
| 2 | 0:30–1:30 | CRM: one shared source of customer truth | concept |
| 3 | 1:30–2:30 | Multi-tenant cloud, explained with an office building | concept |
| 4 | 2:30–3:30 | Product vs platform | concept |
| 5 | 3:30–4:15 | Real story — A distributor consolidates five spreadsheets | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why What is Salesforce? CRM in plain language matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on What is Salesforce? CRM in plain language. Understand what a CRM does, the problem Salesforce solves, and the multi-tenant cloud model behind it. By the end of this video you will be able to explain what a CRM is and the business problems it solves; describe Salesforce as a multi-tenant, metadata-driven cloud platform; recognize the difference between Salesforce the product and the platform.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · Welcome to Salesforce & the Cloud

**[0:30–1:30] CRM: one shared source of customer truth**

- **Narration (word-for-word):** CRM stands for Customer Relationship Management. Before CRM software, sales reps kept customer details in personal spreadsheets, support agents kept notes in email threads, and marketing had its own lists. Nobody saw the full picture, and when an employee left, their knowledge left with them. A CRM centralizes every interaction — calls, emails, deals, support cases — against a single customer record. Salesforce is the market-leading CRM: when a sales rep at your company opens an account, they see the same up-to-date information the support team and the finance team see.
- **On screen:** Animated explainer diagram for "CRM: one shared source of customer truth": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Multi-tenant cloud, explained with an office building**

- **Narration (word-for-word):** Salesforce runs as a multi-tenant cloud. Think of an office building: every company (a "tenant") rents its own floor, but everyone shares the same foundation, elevators, and electricity. Your company's Salesforce environment — called an org — is your private floor: your data, your customizations, your users. Salesforce maintains the shared building, so you never patch servers or install upgrades. Three times a year (Spring, Summer, Winter releases) every tenant gets new features automatically. This is why customizations in Salesforce are described as metadata — declarative descriptions of your setup that survive every upgrade — rather than modified source code.
- **On screen:** Animated explainer diagram for "Multi-tenant cloud, explained with an office building": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Product vs platform**

- **Narration (word-for-word):** Salesforce sells ready-made applications — Sales Cloud for pipeline management, Service Cloud for support, Marketing Cloud for campaigns. All of them sit on the same underlying engine, historically called Force.com and now the Salesforce Platform. This matters for your career: once you understand the platform (objects, automation, security), you can work across any Salesforce product. Companies also build entirely custom applications on the platform — anything from recruitment tracking to logistics — without owning a single server.
- **On screen:** Animated explainer diagram for "Product vs platform": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — A distributor consolidates five spreadsheets**

- **Narration (word-for-word):** Here is why this matters in the real world. A beverage distributor tracked leads in one spreadsheet, orders in another, and complaints in a shared inbox. Sales reps regularly visited customers who had open unresolved complaints — and had no idea. What did they do? They moved to Salesforce: every customer became an Account record, every complaint a Case, every deal an Opportunity. The rep's mobile app now shows open cases right on the account page before a visit. And the payoff: Visit preparation dropped from 30 minutes of spreadsheet archaeology to a 2-minute record review, and complaint-related churn fell because reps stopped walking into meetings blind.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A distributor consolidates five spreadsheets

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. CRM centralizes every customer interaction into a single shared record. Salesforce is multi-tenant: your org is isolated, but the infrastructure is shared and upgraded for you. Customizations are metadata, which is why they survive three releases per year. Learning the platform transfers across every Salesforce product.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is What is Salesforce? CRM in plain language — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — The ecosystem: clouds, editions, and orgs

**Lesson ID:** `foundations-ecosystem` · **Reading time:** 18 min · **Video:** 5:00

> Map the Salesforce product family, understand editions and licenses, and learn what production, sandbox, and developer orgs are for.

**Learning objectives**

- Name the major Salesforce clouds and what each is for
- Understand editions and user licenses at a practical level
- Distinguish production orgs, sandboxes, scratch orgs, and Developer Edition orgs

#### Concept explanation

##### The cloud family

Sales Cloud manages the revenue pipeline: leads, opportunities, forecasts. Service Cloud runs customer support: cases, entitlements, omni-channel routing, knowledge bases. Marketing Cloud handles campaigns and customer journeys. Commerce Cloud powers storefronts. Experience Cloud builds customer- or partner-facing portals on top of your org's data.

Underneath, Platform (with Apex, Flow, and Lightning) is what admins and developers extend. Most enterprise projects combine two or three clouds — for example Service Cloud plus an Experience Cloud portal so customers can log their own cases.

##### Editions and licenses

An edition (Starter, Professional, Enterprise, Unlimited) is what your company buys; it caps features and limits like API calls. Enterprise Edition is the most common baseline for serious customization because it includes the API and more automation capacity.

Each user then consumes a license (for example Salesforce, Salesforce Platform, or Experience Cloud logins) plus optional permission set licenses for add-ons. As an admin you will assign licenses; as a developer you should know that some features simply do not exist in lower editions.

##### Production, sandboxes, and developer environments

Production is the live org where real business happens. Sandboxes are copies of production used for building and testing: Developer and Developer Pro sandboxes copy only metadata, Partial Copy adds a sample of data, and Full sandboxes replicate everything.

Scratch orgs are short-lived, source-driven orgs created from a definition file — ideal for feature development and CI pipelines (this application creates them for you). Free Developer Edition orgs and Trailhead Playgrounds are personal practice environments. Golden rule from day one: never build directly in production.

#### Real-world example — Choosing environments for a support portal project

- **Scenario:** A team must deliver a customer portal in three months. Developers need isolated environments, QA needs realistic data, and UAT needs to mirror production closely.
- **Solution:** Each developer works in a scratch org created from source control. Features merge into a Partial Copy sandbox for QA with anonymized sample data, then a Full sandbox hosts UAT before the production release window.
- **Outcome:** No developer ever blocked another, QA found data-shape bugs a metadata-only sandbox would have missed, and the release deployed to production without surprises.

#### Key takeaways

- Clouds are packaged applications; the platform underneath is shared
- Edition determines org capabilities; licenses determine per-user access
- Sandbox types differ mainly in how much production data they copy
- Scratch orgs enable modern source-driven development and CI/CD

#### Go deeper

- [Salesforce Platform Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/starting_force_com)
- [Application Lifecycle and Development Models (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models) — How environments fit into delivery

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why The ecosystem: clouds, editions, and orgs matters | intro |
| 2 | 0:30–1:30 | The cloud family | concept |
| 3 | 1:30–2:30 | Editions and licenses | demo |
| 4 | 2:30–3:30 | Production, sandboxes, and developer environments | concept |
| 5 | 3:30–4:15 | Real story — Choosing environments for a support portal project | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why The ecosystem: clouds, editions, and orgs matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on The ecosystem: clouds, editions, and orgs. Map the Salesforce product family, understand editions and licenses, and learn what production, sandbox, and developer orgs are for.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · Welcome to Salesforce & the Cloud

**[0:30–1:30] The cloud family**

- **Narration (word-for-word):** Sales Cloud manages the revenue pipeline: leads, opportunities, forecasts. Service Cloud runs customer support: cases, entitlements, omni-channel routing, knowledge bases. Marketing Cloud handles campaigns and customer journeys. Commerce Cloud powers storefronts. Experience Cloud builds customer- or partner-facing portals on top of your org's data. Underneath, Platform (with Apex, Flow, and Lightning) is what admins and developers extend. Most enterprise projects combine two or three clouds — for example Service Cloud plus an Experience Cloud portal so customers can log their own cases.
- **On screen:** Animated explainer diagram for "The cloud family": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Editions and licenses**

- **Narration (word-for-word):** Let's actually do this together. An edition (Starter, Professional, Enterprise, Unlimited) is what your company buys; it caps features and limits like API calls. Enterprise Edition is the most common baseline for serious customization because it includes the API and more automation capacity. Each user then consumes a license (for example Salesforce, Salesforce Platform, or Experience Cloud logins) plus optional permission set licenses for add-ons. As an admin you will assign licenses; as a developer you should know that some features simply do not exist in lower editions.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Each user then consumes a license (for example Salesforce, Salesforce Platform, or Experience Cloud logins) plus optional permission set licenses for add-ons.
  2. As an admin you will assign licenses; as a developer you should know that some features simply do not exist in lower editions.

**[2:30–3:30] Production, sandboxes, and developer environments**

- **Narration (word-for-word):** Production is the live org where real business happens. Sandboxes are copies of production used for building and testing: Developer and Developer Pro sandboxes copy only metadata, Partial Copy adds a sample of data, and Full sandboxes replicate everything. Scratch orgs are short-lived, source-driven orgs created from a definition file — ideal for feature development and CI pipelines (this application creates them for you). Free Developer Edition orgs and Trailhead Playgrounds are personal practice environments. Golden rule from day one: never build directly in production.
- **On screen:** Animated explainer diagram for "Production, sandboxes, and developer environments": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Choosing environments for a support portal project**

- **Narration (word-for-word):** Here is why this matters in the real world. A team must deliver a customer portal in three months. Developers need isolated environments, QA needs realistic data, and UAT needs to mirror production closely. What did they do? Each developer works in a scratch org created from source control. Features merge into a Partial Copy sandbox for QA with anonymized sample data, then a Full sandbox hosts UAT before the production release window. And the payoff: No developer ever blocked another, QA found data-shape bugs a metadata-only sandbox would have missed, and the release deployed to production without surprises.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Choosing environments for a support portal project

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Clouds are packaged applications; the platform underneath is shared. Edition determines org capabilities; licenses determine per-user access. Sandbox types differ mainly in how much production data they copy. Scratch orgs enable modern source-driven development and CI/CD.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is The ecosystem: clouds, editions, and orgs — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.3 — Navigating Lightning Experience

**Lesson ID:** `foundations-navigation` · **Reading time:** 15 min · **Video:** 5:00

> Get fluent with apps, tabs, records, list views, global search, and Setup — the places you will live every day.

**Learning objectives**

- Navigate apps, tabs, and records confidently
- Use global search and list views to find anything fast
- Locate Setup and understand what lives there

#### Concept explanation

##### Apps, tabs, and the App Launcher

Lightning Experience organizes work into apps — a named collection of tabs such as Sales or Service. The App Launcher (the nine-dot waffle icon, top-left) switches between them and can jump straight to any object.

Each tab shows an object home page with list views. A list view is a saved, filterable table — "My Open Opportunities", "Cases Closed This Week". Learn the keyboard-free trick used by every experienced admin: press the App Launcher, type the first letters of anything, and go.

##### Record pages: where the work happens

Opening a record shows the Lightning record page: a highlights panel with key fields and actions on top, detail and related tabs in the middle, and usually an activity timeline or Chatter feed alongside. Related lists show connected records — an Account's Contacts, Opportunities, and Cases.

Record pages are assembled from components in Lightning App Builder, which means what YOU see may differ per app, record type, or profile. If two colleagues see different layouts for the same record, that is configuration, not a bug.

##### Global search and Setup

Global search (top bar) searches across objects and respects your permissions — you only ever find records you are allowed to see. Use quotation marks for exact phrases and the left-hand filters to narrow by object.

The gear icon opens Setup — the administration console. Everything configurable lives here: users, security, objects (Object Manager), automation, and monitoring. Freshers should explore Setup early even without edit rights; reading an org's Setup is how you learn how it was built.

#### Real-world example — A new hire finds their feet in week one

- **Scenario:** A graduate joins as a junior admin. Users raise tickets like "I can't see the Discount field" and "my list view disappeared" — and the graduate has no idea where to start.
- **Solution:** They learn the trio that answers most tickets: Object Manager (does the field exist and is it on the layout?), the user's profile and permission sets (can they see it?), and list view controls (is it filtered or shared correctly?).
- **Outcome:** By week three the graduate resolves the majority of "I can't see X" tickets in minutes, because navigation and Setup literacy — not code — is what those tickets actually require.

#### Key takeaways

- Apps are collections of tabs; the App Launcher reaches everything
- Record pages are configurable per app, record type, and profile
- Global search respects sharing — users only find what they can access
- Setup and Object Manager are the admin's home; explore them early

#### Go deeper

- [Lightning Experience Customization (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lex_customization)
- [Salesforce Help: Get Started](https://help.salesforce.com/s/) — Official product documentation portal

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Navigating Lightning Experience matters | intro |
| 2 | 0:30–1:30 | Apps, tabs, and the App Launcher | concept |
| 3 | 1:30–2:30 | Record pages: where the work happens | concept |
| 4 | 2:30–3:30 | Global search and Setup | concept |
| 5 | 3:30–4:15 | Real story — A new hire finds their feet in week one | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Navigating Lightning Experience matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on Navigating Lightning Experience. Get fluent with apps, tabs, records, list views, global search, and Setup — the places you will live every day. By the end of this video you will be able to navigate apps, tabs, and records confidently; use global search and list views to find anything fast; locate Setup and understand what lives there.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · Welcome to Salesforce & the Cloud

**[0:30–1:30] Apps, tabs, and the App Launcher**

- **Narration (word-for-word):** Lightning Experience organizes work into apps — a named collection of tabs such as Sales or Service. The App Launcher (the nine-dot waffle icon, top-left) switches between them and can jump straight to any object. Each tab shows an object home page with list views. A list view is a saved, filterable table — "My Open Opportunities", "Cases Closed This Week". Learn the keyboard-free trick used by every experienced admin: press the App Launcher, type the first letters of anything, and go.
- **On screen:** Animated explainer diagram for "Apps, tabs, and the App Launcher": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Record pages: where the work happens**

- **Narration (word-for-word):** Opening a record shows the Lightning record page: a highlights panel with key fields and actions on top, detail and related tabs in the middle, and usually an activity timeline or Chatter feed alongside. Related lists show connected records — an Account's Contacts, Opportunities, and Cases. Record pages are assembled from components in Lightning App Builder, which means what YOU see may differ per app, record type, or profile. If two colleagues see different layouts for the same record, that is configuration, not a bug.
- **On screen:** Animated explainer diagram for "Record pages: where the work happens": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Global search and Setup**

- **Narration (word-for-word):** Global search (top bar) searches across objects and respects your permissions — you only ever find records you are allowed to see. Use quotation marks for exact phrases and the left-hand filters to narrow by object. The gear icon opens Setup — the administration console. Everything configurable lives here: users, security, objects (Object Manager), automation, and monitoring. Freshers should explore Setup early even without edit rights; reading an org's Setup is how you learn how it was built.
- **On screen:** Animated explainer diagram for "Global search and Setup": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — A new hire finds their feet in week one**

- **Narration (word-for-word):** Here is why this matters in the real world. A graduate joins as a junior admin. Users raise tickets like "I can't see the Discount field" and "my list view disappeared" — and the graduate has no idea where to start. What did they do? They learn the trio that answers most tickets: Object Manager (does the field exist and is it on the layout?), the user's profile and permission sets (can they see it?), and list view controls (is it filtered or shared correctly?).
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A new hire finds their feet in week one

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Apps are collections of tabs; the App Launcher reaches everything. Record pages are configurable per app, record type, and profile. Global search respects sharing — users only find what they can access. Setup and Object Manager are the admin's home; explore them early.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Navigating Lightning Experience — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: The Salesforce Data Model

Objects, fields, records, and relationships — the vocabulary every Salesforce conversation is built on.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 2.1 — Objects, records, and fields

**Lesson ID:** `foundations-objects-records-fields` · **Reading time:** 15 min · **Video:** 5:00

> Learn the spreadsheet analogy that unlocks everything: objects as tables, fields as columns, records as rows.

**Learning objectives**

- Define objects, fields, and records precisely
- Distinguish standard from custom objects and the __c suffix
- Read any org's schema through Object Manager

#### Concept explanation

##### The spreadsheet analogy

An object is like a spreadsheet tab: Account, Contact, Opportunity. A field is a column with a type — text, number, date, picklist, checkbox. A record is one row: "Acme Corporation" is a record of the Account object.

The analogy has limits — objects also carry security, automation, and relationships — but it is the fastest way to read a new org. When someone says "add a field to Case", you now know exactly what that means.

##### Standard vs custom

Salesforce ships standard objects (Account, Contact, Lead, Opportunity, Case) with built-in behavior — Leads convert, Opportunities roll into forecasts. You cannot delete standard objects, but you can extend them with custom fields.

Custom objects are ones your team creates for business-specific data, and their API names end in __c: Delivery_Route__c, Training_Session__c. Field API names work the same way (Discount_Percent__c). The API name is what code, flows, and integrations use; the label is just what humans see — labels can change freely, API names should be treated as permanent.

##### Field types matter more than you think

Choosing a field type is a design decision. Picklists constrain values and power clean reporting; free text invites chaos. Formula fields calculate on read and cannot be edited. Roll-up summaries aggregate child records onto a master record (master-detail only). Lookup fields create relationships — more on those next lesson.

A practical fresher habit: before creating any field, search the object for an existing one. Duplicate fields ("Region", "Region2", "Region Final") are the most common form of org debt.

#### Real-world example — Modeling a training business

- **Scenario:** A training company needs to track courses, scheduled sessions, and who attended. They start by cramming session dates into Contact fields — Session1_Date__c, Session2_Date__c — and quickly run out.
- **Solution:** An admin models it properly: a Course__c object, a Session__c object related to Course__c, and an Attendance__c object linking Contacts to Sessions. Each concept becomes an object, not a pile of fields.
- **Outcome:** Reporting "who attended what, when" becomes a standard report instead of an impossible spreadsheet export, and adding a tenth session requires zero new fields.

#### Key takeaways

- Object = table, field = column, record = row — plus security and behavior
- Custom objects and fields carry the __c suffix in their API names
- API names are contracts: code and integrations depend on them
- When data repeats (Session1, Session2…), you need a related object, not more fields

#### Go deeper

- [Data Modeling (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/data_modeling) — The essential module for this lesson
- [Object Reference for the Salesforce Platform](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_concepts.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Objects, records, and fields matters | intro |
| 2 | 0:30–1:30 | The spreadsheet analogy | concept |
| 3 | 1:30–2:30 | Standard vs custom | concept |
| 4 | 2:30–3:30 | Field types matter more than you think | concept |
| 5 | 3:30–4:15 | Real story — Modeling a training business | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Objects, records, and fields matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on Objects, records, and fields. Learn the spreadsheet analogy that unlocks everything: objects as tables, fields as columns, records as rows. By the end of this video you will be able to define objects, fields, and records precisely; distinguish standard from custom objects and the __c suffix; read any org's schema through Object Manager.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · The Salesforce Data Model

**[0:30–1:30] The spreadsheet analogy**

- **Narration (word-for-word):** An object is like a spreadsheet tab: Account, Contact, Opportunity. A field is a column with a type — text, number, date, picklist, checkbox. A record is one row: "Acme Corporation" is a record of the Account object. The analogy has limits — objects also carry security, automation, and relationships — but it is the fastest way to read a new org. When someone says "add a field to Case", you now know exactly what that means.
- **On screen:** Animated explainer diagram for "The spreadsheet analogy": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Standard vs custom**

- **Narration (word-for-word):** Salesforce ships standard objects (Account, Contact, Lead, Opportunity, Case) with built-in behavior — Leads convert, Opportunities roll into forecasts. You cannot delete standard objects, but you can extend them with custom fields. Custom objects are ones your team creates for business-specific data, and their API names end in __c: Delivery_Route__c, Training_Session__c. Field API names work the same way (Discount_Percent__c). The API name is what code, flows, and integrations use; the label is just what humans see — labels can change freely, API names should be treated as permanent.
- **On screen:** Animated explainer diagram for "Standard vs custom": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Field types matter more than you think**

- **Narration (word-for-word):** Choosing a field type is a design decision. Picklists constrain values and power clean reporting; free text invites chaos. Formula fields calculate on read and cannot be edited. Roll-up summaries aggregate child records onto a master record (master-detail only). Lookup fields create relationships — more on those next lesson. A practical fresher habit: before creating any field, search the object for an existing one. Duplicate fields ("Region", "Region2", "Region Final") are the most common form of org debt.
- **On screen:** Animated explainer diagram for "Field types matter more than you think": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Modeling a training business**

- **Narration (word-for-word):** Here is why this matters in the real world. A training company needs to track courses, scheduled sessions, and who attended. They start by cramming session dates into Contact fields — Session1_Date__c, Session2_Date__c — and quickly run out. What did they do? An admin models it properly: a Course__c object, a Session__c object related to Course__c, and an Attendance__c object linking Contacts to Sessions. Each concept becomes an object, not a pile of fields. And the payoff: Reporting "who attended what, when" becomes a standard report instead of an impossible spreadsheet export, and adding a tenth session requires zero new fields.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Modeling a training business

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Object = table, field = column, record = row — plus security and behavior. Custom objects and fields carry the __c suffix in their API names. API names are contracts: code and integrations depend on them. When data repeats (Session1, Session2…), you need a related object, not more fields.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Objects, records, and fields — the idea, the practice, and the real-world payoff. Head back to the The Salesforce Data Model module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Relationships: lookup, master-detail, and junctions

**Lesson ID:** `foundations-relationships` · **Reading time:** 20 min · **Video:** 5:00

> How records connect to each other, and how to choose the right relationship type.

**Learning objectives**

- Differentiate lookup and master-detail relationships
- Explain cascade delete, roll-up summaries, and ownership inheritance
- Model many-to-many relationships with junction objects

#### Concept explanation

##### Lookup: a loose connection

A lookup relationship links one record to another while both stay independent. Contact has a lookup to Account: delete the account and (by default) contacts survive with the field cleared, or the delete can be blocked.

Use lookups when the child makes sense on its own, when the relationship is optional, or when the two records have different owners and sharing needs.

##### Master-detail: ownership and lifecycle

Master-detail is a tight bond: the detail record's lifecycle belongs to its master. Delete the master and details cascade-delete. Details inherit the master's owner and sharing — they have no independent owner.

The payoff is roll-up summary fields: the master can COUNT, SUM, MIN, or MAX its details natively — total value of all line items on an order, for example — with no code and no scheduled job.

##### Junction objects for many-to-many

A student attends many courses; a course has many students. Neither side can hold a single lookup. The answer is a junction object — a custom object with two master-detail relationships, one to each parent. Each junction record represents one pairing (one enrollment).

Standard Salesforce uses this pattern itself: OpportunityContactRole joins Opportunities and Contacts. When an interviewer asks how to model many-to-many, the junction object is the expected answer.

#### Real-world example — Order lines that total themselves

- **Scenario:** A wholesaler tracks Orders and Order Lines. With a lookup relationship, sales managers had to run a report just to know an order's total, and orphaned lines survived deleted orders, polluting revenue reports.
- **Solution:** The admin rebuilt Order_Line__c as master-detail under Order__c, added a roll-up summary Total_Amount__c (SUM of line amounts), and let cascade delete clean up lines automatically.
- **Outcome:** Order totals appear instantly on every order page and in list views, and the orphan-line data quality problem disappeared entirely.

#### Key takeaways

- Lookup = independent records loosely linked; master-detail = owned children
- Roll-up summary fields require master-detail
- Master-detail children inherit sharing and cascade-delete with their master
- Junction objects (two master-details) model many-to-many relationships

#### Go deeper

- [Data Modeling (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/data_modeling)
- [Object Relationships Overview (Salesforce Help)](https://help.salesforce.com/s/articleView?id=sf.overview_of_custom_object_relationships.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Relationships: lookup, master-detail, and junctions matters | intro |
| 2 | 0:30–1:30 | Lookup: a loose connection | concept |
| 3 | 1:30–2:30 | Master-detail: ownership and lifecycle | concept |
| 4 | 2:30–3:30 | Junction objects for many-to-many | concept |
| 5 | 3:30–4:15 | Real story — Order lines that total themselves | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Relationships: lookup, master-detail, and junctions matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on Relationships: lookup, master-detail, and junctions. How records connect to each other, and how to choose the right relationship type. By the end of this video you will be able to differentiate lookup and master-detail relationships; explain cascade delete, roll-up summaries, and ownership inheritance; model many-to-many relationships with junction objects.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · The Salesforce Data Model

**[0:30–1:30] Lookup: a loose connection**

- **Narration (word-for-word):** A lookup relationship links one record to another while both stay independent. Contact has a lookup to Account: delete the account and (by default) contacts survive with the field cleared, or the delete can be blocked. Use lookups when the child makes sense on its own, when the relationship is optional, or when the two records have different owners and sharing needs.
- **On screen:** Animated explainer diagram for "Lookup: a loose connection": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Master-detail: ownership and lifecycle**

- **Narration (word-for-word):** Master-detail is a tight bond: the detail record's lifecycle belongs to its master. Delete the master and details cascade-delete. Details inherit the master's owner and sharing — they have no independent owner. The payoff is roll-up summary fields: the master can COUNT, SUM, MIN, or MAX its details natively — total value of all line items on an order, for example — with no code and no scheduled job.
- **On screen:** Animated explainer diagram for "Master-detail: ownership and lifecycle": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Junction objects for many-to-many**

- **Narration (word-for-word):** A student attends many courses; a course has many students. Neither side can hold a single lookup. The answer is a junction object — a custom object with two master-detail relationships, one to each parent. Each junction record represents one pairing (one enrollment). Standard Salesforce uses this pattern itself: OpportunityContactRole joins Opportunities and Contacts. When an interviewer asks how to model many-to-many, the junction object is the expected answer.
- **On screen:** Animated explainer diagram for "Junction objects for many-to-many": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Order lines that total themselves**

- **Narration (word-for-word):** Here is why this matters in the real world. A wholesaler tracks Orders and Order Lines. With a lookup relationship, sales managers had to run a report just to know an order's total, and orphaned lines survived deleted orders, polluting revenue reports. What did they do? The admin rebuilt Order_Line__c as master-detail under Order__c, added a roll-up summary Total_Amount__c (SUM of line amounts), and let cascade delete clean up lines automatically. And the payoff: Order totals appear instantly on every order page and in list views, and the orphan-line data quality problem disappeared entirely.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Order lines that total themselves

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Lookup = independent records loosely linked; master-detail = owned children. Roll-up summary fields require master-detail. Master-detail children inherit sharing and cascade-delete with their master. Junction objects (two master-details) model many-to-many relationships.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Relationships: lookup, master-detail, and junctions — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.3 — Reading a schema: Object Manager & Schema Builder

**Lesson ID:** `foundations-schema-builder` · **Reading time:** 12 min · **Video:** 5:00

> Use Object Manager and Schema Builder to reverse-engineer how any org is built — a superpower for new team members.

**Learning objectives**

- Inspect fields, relationships, and layouts through Object Manager
- Visualize the data model with Schema Builder
- Approach an unfamiliar org methodically

#### Concept explanation

##### Object Manager: the encyclopedia

Setup → Object Manager lists every object in the org. Open one and you can read its fields (with types and API names), relationships, record types, page layouts, and validation rules.

Joining an existing project? Spend your first hours in Object Manager on the five or six core objects. Reading fields and validation rules tells you more about the real business process than most documentation.

##### Schema Builder: the map

Schema Builder (also in Setup) renders objects and relationships as a draggable diagram. Master-detail and lookup lines are drawn differently, so one glance shows you the org's backbone.

Filter it to just the objects you care about — a full enterprise org diagram is unreadable. A filtered Schema Builder screenshot is also the fastest artifact to bring to design discussions.

##### A method for unfamiliar orgs

A reliable routine: 1) List the apps users actually use (App Launcher). 2) For each core tab, open Object Manager and read fields + validation rules. 3) Draw the relationship map in Schema Builder. 4) Open a few real records to see layouts and data quality. 5) Only then look at automation (flows, triggers).

This order — data model before automation — is deliberate: automation only makes sense once you know what the records mean.

#### Real-world example — Consultant onboards to a 400-object org

- **Scenario:** A consultant inherits a seven-year-old org with 400+ objects, no documentation, and a departed original team. Leadership wants an assessment within two weeks.
- **Solution:** They identify the 12 objects behind the primary business flow via app navigation, map them in Schema Builder, and read every validation rule as "business rules written down". Automation review comes last, scoped only to those 12 objects.
- **Outcome:** The assessment lands on time with an accurate core-process diagram, and three "mystery" objects are flagged as abandoned — later confirmed and archived.

#### Key takeaways

- Object Manager is the authoritative reference for any object's configuration
- Schema Builder visualizes relationships — filter it or drown
- Validation rules are business rules in disguise; read them when onboarding
- Understand the data model before you touch automation

#### Go deeper

- [Data Modeling (Trailhead) — Schema Builder unit](https://trailhead.salesforce.com/content/learn/modules/data_modeling)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Reading a schema: Object Manager & Schema Builder matters | intro |
| 2 | 0:30–1:30 | Object Manager: the encyclopedia | concept |
| 3 | 1:30–2:30 | Schema Builder: the map | concept |
| 4 | 2:30–3:30 | A method for unfamiliar orgs | demo |
| 5 | 3:30–4:15 | Real story — Consultant onboards to a 400-object org | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Reading a schema: Object Manager & Schema Builder matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on Reading a schema: Object Manager & Schema Builder. Use Object Manager and Schema Builder to reverse-engineer how any org is built — a superpower for new team members. By the end of this video you will be able to inspect fields, relationships, and layouts through Object Manager; visualize the data model with Schema Builder; approach an unfamiliar org methodically.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · The Salesforce Data Model

**[0:30–1:30] Object Manager: the encyclopedia**

- **Narration (word-for-word):** Setup → Object Manager lists every object in the org. Open one and you can read its fields (with types and API names), relationships, record types, page layouts, and validation rules. Joining an existing project? Spend your first hours in Object Manager on the five or six core objects. Reading fields and validation rules tells you more about the real business process than most documentation.
- **On screen:** Animated explainer diagram for "Object Manager: the encyclopedia": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Schema Builder: the map**

- **Narration (word-for-word):** Schema Builder (also in Setup) renders objects and relationships as a draggable diagram. Master-detail and lookup lines are drawn differently, so one glance shows you the org's backbone. Filter it to just the objects you care about — a full enterprise org diagram is unreadable. A filtered Schema Builder screenshot is also the fastest artifact to bring to design discussions.
- **On screen:** Animated explainer diagram for "Schema Builder: the map": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] A method for unfamiliar orgs**

- **Narration (word-for-word):** Let's actually do this together. A reliable routine: 1) List the apps users actually use (App Launcher). 2) For each core tab, open Object Manager and read fields + validation rules. 3) Draw the relationship map in Schema Builder. 4) Open a few real records to see layouts and data quality. 5) Only then look at automation (flows, triggers). This order — data model before automation — is deliberate: automation only makes sense once you know what the records mean.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. 2) For each core tab, open Object Manager and read fields + validation rules.
  2. 3) Draw the relationship map in Schema Builder.
  3. 4) Open a few real records to see layouts and data quality.

**[3:30–4:15] Real story — Consultant onboards to a 400-object org**

- **Narration (word-for-word):** Here is why this matters in the real world. A consultant inherits a seven-year-old org with 400+ objects, no documentation, and a departed original team. Leadership wants an assessment within two weeks. What did they do? They identify the 12 objects behind the primary business flow via app navigation, map them in Schema Builder, and read every validation rule as "business rules written down". Automation review comes last, scoped only to those 12 objects. And the payoff: The assessment lands on time with an accurate core-process diagram, and three "mystery" objects are flagged as abandoned — later confirmed and archived.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Consultant onboards to a 400-object org

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Object Manager is the authoritative reference for any object's configuration. Schema Builder visualizes relationships — filter it or drown. Validation rules are business rules in disguise; read them when onboarding. Understand the data model before you touch automation.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Reading a schema: Object Manager & Schema Builder — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: Working with Data, Reports & Collaboration

Find, slice, and present data: list views, reports, dashboards, and the collaboration tools around them.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 3.1 — List views, Kanban, and inline editing

**Lesson ID:** `foundations-list-views` · **Reading time:** 12 min · **Video:** 5:00

> Master the daily workhorse of Salesforce users: filtered, shareable, editable lists.

**Learning objectives**

- Build and share filtered list views
- Switch between table and Kanban visualizations
- Use inline editing safely

#### Concept explanation

##### Filters, columns, sharing

A list view is a saved query over one object: choose filter criteria, pick columns, and share it with everyone, specific groups, or keep it private. "My Overdue Cases" is just Cases where Owner = me and Due Date < TODAY.

Well-named shared list views quietly standardize how a team works. Chaotic orgs have 90 private near-duplicate views; healthy orgs curate a handful of shared ones per object.

##### Kanban view

Any list view can render as a Kanban board grouped by a picklist field — Opportunities by Stage is the classic. Cards drag between columns, updating the underlying field instantly, and each column can show a summarized amount.

Kanban is more than cosmetic: for pipeline reviews it turns a data-entry chore into a visual conversation.

##### Inline editing and its guardrails

Double-click a cell in a list view to edit it in place; edit several rows and save once. This is the fastest bulk-update tool that requires zero setup.

Guardrails still apply: validation rules run, field-level security applies, and records locked by approval processes refuse edits. If inline editing is disabled entirely, the view usually mixes multiple record types — a good trivia fact that saves an hour of confusion.

#### Real-world example — A support team standardizes triage

- **Scenario:** Each support agent invented their own way of finding work; two high-priority cases sat untouched for a weekend because they matched nobody's personal list view.
- **Solution:** The team lead created three shared views — "Unassigned by Priority", "My Open Cases", "Breaching SLA Today" — pinned "Unassigned by Priority" as the default, and reviewed it in daily standup.
- **Outcome:** No case has gone unseen since, and new agents are productive on day one because the work queue is defined by the org, not by tribal knowledge.

#### Key takeaways

- List views are saved queries: filters + columns + sharing
- Kanban visualizes any list view grouped by a picklist
- Inline editing is bulk editing with validation still enforced
- Curated shared views beat dozens of private duplicates

#### Go deeper

- [Lightning Experience Customization (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lex_customization)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why List views, Kanban, and inline editing matters | intro |
| 2 | 0:30–1:30 | Filters, columns, sharing | concept |
| 3 | 1:30–2:30 | Kanban view | concept |
| 4 | 2:30–3:30 | Inline editing and its guardrails | concept |
| 5 | 3:30–4:15 | Real story — A support team standardizes triage | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why List views, Kanban, and inline editing matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on List views, Kanban, and inline editing. Master the daily workhorse of Salesforce users: filtered, shareable, editable lists. By the end of this video you will be able to build and share filtered list views; switch between table and Kanban visualizations; use inline editing safely. And stick around — we close with a true-to-life story of a team that lived this exact problem.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · Working with Data, Reports & Collaboration

**[0:30–1:30] Filters, columns, sharing**

- **Narration (word-for-word):** A list view is a saved query over one object: choose filter criteria, pick columns, and share it with everyone, specific groups, or keep it private. "My Overdue Cases" is just Cases where Owner = me and Due Date < TODAY. Well-named shared list views quietly standardize how a team works. Chaotic orgs have 90 private near-duplicate views; healthy orgs curate a handful of shared ones per object.
- **On screen:** Animated explainer diagram for "Filters, columns, sharing": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Kanban view**

- **Narration (word-for-word):** Any list view can render as a Kanban board grouped by a picklist field — Opportunities by Stage is the classic. Cards drag between columns, updating the underlying field instantly, and each column can show a summarized amount. Kanban is more than cosmetic: for pipeline reviews it turns a data-entry chore into a visual conversation.
- **On screen:** Animated explainer diagram for "Kanban view": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Inline editing and its guardrails**

- **Narration (word-for-word):** Double-click a cell in a list view to edit it in place; edit several rows and save once. This is the fastest bulk-update tool that requires zero setup. Guardrails still apply: validation rules run, field-level security applies, and records locked by approval processes refuse edits. If inline editing is disabled entirely, the view usually mixes multiple record types — a good trivia fact that saves an hour of confusion.
- **On screen:** Animated explainer diagram for "Inline editing and its guardrails": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — A support team standardizes triage**

- **Narration (word-for-word):** Here is why this matters in the real world. Each support agent invented their own way of finding work; two high-priority cases sat untouched for a weekend because they matched nobody's personal list view. What did they do? The team lead created three shared views — "Unassigned by Priority", "My Open Cases", "Breaching SLA Today" — pinned "Unassigned by Priority" as the default, and reviewed it in daily standup. And the payoff: No case has gone unseen since, and new agents are productive on day one because the work queue is defined by the org, not by tribal knowledge.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A support team standardizes triage

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. List views are saved queries: filters + columns + sharing. Kanban visualizes any list view grouped by a picklist. Inline editing is bulk editing with validation still enforced. Curated shared views beat dozens of private duplicates.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is List views, Kanban, and inline editing — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — Reports & dashboards fundamentals

**Lesson ID:** `foundations-reports` · **Reading time:** 20 min · **Video:** 5:00

> Turn records into answers: report formats, filters, groupings, and dashboards that update themselves.

**Learning objectives**

- Build tabular, summary, and matrix reports
- Understand report types as the data contract behind reports
- Assemble dashboards and schedule subscriptions

#### Concept explanation

##### Report formats

Tabular reports are flat lists — good for exports. Summary reports group rows (Opportunities by Stage) with subtotals, and are what you will build most. Matrix reports group by rows AND columns (Stage × Region). Joined reports place multiple report blocks side by side for cross-object comparisons.

Every report starts from a report type, which fixes which objects and fields are available — "Opportunities with Products", "Cases with Contact". If a field seems missing from the report builder, the report type is usually why.

##### Filters, buckets, and formulas

Standard filters constrain scope (My vs All, date ranges); field filters add conditions; cross filters express "Accounts WITH open Cases" or "WITHOUT Opportunities" — the most underused power feature in reporting.

Bucket columns group values on the fly (deal size → Small/Medium/Large) without creating fields. Row-level and summary formulas compute values like win rate directly in the report.

##### Dashboards

A dashboard is a grid of components — charts, gauges, tables — each powered by a source report. Dashboards refresh on demand or on schedule, and can be emailed via subscriptions.

One concept matters above all: the running user. A dashboard runs as a designated user (fixed) or as the viewer (dynamic). Fixed running users can accidentally show every region's numbers to everyone — always check this setting before sharing a dashboard broadly.

#### Real-world example — A Monday-morning pipeline dashboard

- **Scenario:** A sales VP spent every Monday assembling a pipeline deck by hand: exports, pivot tables, screenshots, PowerPoint — three hours weekly, always slightly stale.
- **Solution:** An admin built summary reports (pipeline by stage, by owner, closing this quarter, top 10 deals) and a dashboard on top, subscribed to the VP's inbox every Monday at 7 am as the viewer.
- **Outcome:** Three hours became zero, the numbers are live, and reps started keeping stages honest because everyone sees the same board every Monday.

#### Key takeaways

- Summary reports with groupings are the everyday workhorse
- The report type dictates available objects and fields
- Cross filters ("with / without related records") answer questions plain filters cannot
- Always verify a dashboard's running user before sharing it

#### Go deeper

- [Reports & Dashboards for Lightning Experience (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lex_implementation_reports_dashboards)
- [Salesforce Help: Reports and Dashboards](https://help.salesforce.com/s/articleView?id=sf.rd_reports_overview.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Reports & dashboards fundamentals matters | intro |
| 2 | 0:30–1:30 | Report formats | concept |
| 3 | 1:30–2:30 | Filters, buckets, and formulas | concept |
| 4 | 2:30–3:30 | Dashboards | concept |
| 5 | 3:30–4:15 | Real story — A Monday-morning pipeline dashboard | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Reports & dashboards fundamentals matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on Reports & dashboards fundamentals. Turn records into answers: report formats, filters, groupings, and dashboards that update themselves. By the end of this video you will be able to build tabular, summary, and matrix reports; understand report types as the data contract behind reports; assemble dashboards and schedule subscriptions.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · Working with Data, Reports & Collaboration

**[0:30–1:30] Report formats**

- **Narration (word-for-word):** Tabular reports are flat lists — good for exports. Summary reports group rows (Opportunities by Stage) with subtotals, and are what you will build most. Matrix reports group by rows AND columns (Stage × Region). Joined reports place multiple report blocks side by side for cross-object comparisons. Every report starts from a report type, which fixes which objects and fields are available — "Opportunities with Products", "Cases with Contact". If a field seems missing from the report builder, the report type is usually why.
- **On screen:** Animated explainer diagram for "Report formats": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Filters, buckets, and formulas**

- **Narration (word-for-word):** Standard filters constrain scope (My vs All, date ranges); field filters add conditions; cross filters express "Accounts WITH open Cases" or "WITHOUT Opportunities" — the most underused power feature in reporting. Bucket columns group values on the fly (deal size → Small/Medium/Large) without creating fields. Row-level and summary formulas compute values like win rate directly in the report.
- **On screen:** Animated explainer diagram for "Filters, buckets, and formulas": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Dashboards**

- **Narration (word-for-word):** A dashboard is a grid of components — charts, gauges, tables — each powered by a source report. Dashboards refresh on demand or on schedule, and can be emailed via subscriptions. One concept matters above all: the running user. A dashboard runs as a designated user (fixed) or as the viewer (dynamic). Fixed running users can accidentally show every region's numbers to everyone — always check this setting before sharing a dashboard broadly.
- **On screen:** Animated explainer diagram for "Dashboards": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — A Monday-morning pipeline dashboard**

- **Narration (word-for-word):** Here is why this matters in the real world. A sales VP spent every Monday assembling a pipeline deck by hand: exports, pivot tables, screenshots, PowerPoint — three hours weekly, always slightly stale. What did they do? An admin built summary reports (pipeline by stage, by owner, closing this quarter, top 10 deals) and a dashboard on top, subscribed to the VP's inbox every Monday at 7 am as the viewer. And the payoff: Three hours became zero, the numbers are live, and reps started keeping stages honest because everyone sees the same board every Monday.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A Monday-morning pipeline dashboard

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Summary reports with groupings are the everyday workhorse. The report type dictates available objects and fields. Cross filters ("with / without related records") answer questions plain filters cannot. Always verify a dashboard's running user before sharing it.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Reports & dashboards fundamentals — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.3 — Chatter, activities, and the AppExchange

**Lesson ID:** `foundations-collaboration` · **Reading time:** 13 min · **Video:** 5:00

> Collaborate in context with Chatter and activities, and extend the platform through the AppExchange marketplace.

**Learning objectives**

- Use Chatter feeds, @mentions, and record following effectively
- Log activities so history survives employee turnover
- Evaluate AppExchange packages sensibly

#### Concept explanation

##### Chatter: collaboration attached to records

Chatter is the collaboration feed built into records. Discussing a deal ON the opportunity record — @mentioning a colleague, attaching the proposal — keeps the context where the next person will look, instead of buried in someone's inbox.

Follow a record to get feed notifications when it changes. Groups host team-level discussion. The discipline "if it's about the record, say it on the record" is a hallmark of mature Salesforce teams.

##### Activities: tasks and events

Tasks (to-dos) and events (calendar entries) attach to records via two special fields: Name (a person — Contact or Lead) and Related To (any enabled object). The activity timeline on a record page shows the full interaction history: calls logged, emails sent, meetings held.

When a rep resigns, their pipeline is only as recoverable as their activity history. Logging activities is not bureaucracy; it is business continuity.

##### AppExchange: the app store

The AppExchange is Salesforce's marketplace of managed packages — from document generation to full industry solutions. Installing a package adds its objects, code, and pages to your org.

Evaluate before installing: security review status, reviews, pricing model, and what permissions it requests. Always install to a sandbox first. The build-vs-buy instinct matters — a $10/user/month package often beats three months of custom development.

#### Real-world example — Recovering a resigned rep's pipeline

- **Scenario:** A top rep resigns with two weeks' notice, owning 40 open opportunities. In previous years this meant deals stalling for months while a successor rebuilt context from scratch.
- **Solution:** Because the team logged calls and kept deal discussion in Chatter on each opportunity, the successor read the timeline and feed for each of the top 15 deals and scheduled continuity calls in week one.
- **Outcome:** Only two deals slipped a quarter. The sales director credited the "context lives on the record" habit — and made activity logging a formal team norm.

#### Key takeaways

- Chatter keeps deal and case discussion attached to the record
- Activity history is business continuity, not paperwork
- AppExchange packages can replace months of custom build — evaluate, then sandbox-test
- Follow records you depend on; @mention people to pull them into context

#### Go deeper

- [AppExchange Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/appexchange_basics)
- [AppExchange Marketplace](https://appexchange.salesforce.com/)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Chatter, activities, and the AppExchange matters | intro |
| 2 | 0:30–1:30 | Chatter: collaboration attached to records | concept |
| 3 | 1:30–2:30 | Activities: tasks and events | concept |
| 4 | 2:30–3:30 | AppExchange: the app store | demo |
| 5 | 3:30–4:15 | Real story — Recovering a resigned rep's pipeline | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Chatter, activities, and the AppExchange matters**

- **Narration (word-for-word):** Welcome to Salesforce Foundations, and this five-minute session on Chatter, activities, and the AppExchange. Collaborate in context with Chatter and activities, and extend the platform through the AppExchange marketplace. By the end of this video you will be able to use Chatter feeds, @mentions, and record following effectively; log activities so history survives employee turnover; evaluate AppExchange packages sensibly.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Salesforce Foundations · Working with Data, Reports & Collaboration

**[0:30–1:30] Chatter: collaboration attached to records**

- **Narration (word-for-word):** Chatter is the collaboration feed built into records. Discussing a deal ON the opportunity record — @mentioning a colleague, attaching the proposal — keeps the context where the next person will look, instead of buried in someone's inbox. Follow a record to get feed notifications when it changes. Groups host team-level discussion. The discipline "if it's about the record, say it on the record" is a hallmark of mature Salesforce teams.
- **On screen:** Animated explainer diagram for "Chatter: collaboration attached to records": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Activities: tasks and events**

- **Narration (word-for-word):** Tasks (to-dos) and events (calendar entries) attach to records via two special fields: Name (a person — Contact or Lead) and Related To (any enabled object). The activity timeline on a record page shows the full interaction history: calls logged, emails sent, meetings held. When a rep resigns, their pipeline is only as recoverable as their activity history. Logging activities is not bureaucracy; it is business continuity.
- **On screen:** Animated explainer diagram for "Activities: tasks and events": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] AppExchange: the app store**

- **Narration (word-for-word):** Let's actually do this together. The AppExchange is Salesforce's marketplace of managed packages — from document generation to full industry solutions. Installing a package adds its objects, code, and pages to your org. Evaluate before installing: security review status, reviews, pricing model, and what permissions it requests. Always install to a sandbox first. The build-vs-buy instinct matters — a $10/user/month package often beats three months of custom development.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Always install to a sandbox first.
  2. The build-vs-buy instinct matters — a $10/user/month package often beats three months of custom development.

**[3:30–4:15] Real story — Recovering a resigned rep's pipeline**

- **Narration (word-for-word):** Here is why this matters in the real world. A top rep resigns with two weeks' notice, owning 40 open opportunities. In previous years this meant deals stalling for months while a successor rebuilt context from scratch. What did they do? Because the team logged calls and kept deal discussion in Chatter on each opportunity, the successor read the timeline and feed for each of the top 15 deals and scheduled continuity calls in week one. And the payoff: Only two deals slipped a quarter. The sales director credited the "context lives on the record" habit — and made activity logging a formal team norm.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Recovering a resigned rep's pipeline

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Chatter keeps deal and case discussion attached to the record. Activity history is business continuity, not paperwork. AppExchange packages can replace months of custom build — evaluate, then sandbox-test. Follow records you depend on; @mention people to pull them into context.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Chatter, activities, and the AppExchange — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
