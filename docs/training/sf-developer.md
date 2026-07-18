# Platform Developer Track — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Advanced · **Category:** Salesforce core curriculum · **Badge:** Platform Developer · **Modules:** 4 · **Lessons:** 13 · **Estimated effort:** ~14h

Learn to build on the platform the way it was designed to be used: bulkified Apex with real test coverage, Lightning Web Components on Lightning Data Service, and integrations that pick the right API for the job. Every lesson bakes in the limits-first mindset that production orgs demand.

**Skills:** Apex & triggers · SOQL/SOSL · Unit testing · Asynchronous Apex · Lightning Web Components · APIs & integration

## Contents

- **Module 1: Apex Fundamentals & Triggers**
  - Lesson 1.1: Apex language essentials
  - Lesson 1.2: SOQL & SOSL: querying like a pro
  - Lesson 1.3: Triggers done right: one trigger, a handler, bulk always
  - Lesson 1.4: Governor limits: the physics of the platform
- **Module 2: Testing & Asynchronous Apex**
  - Lesson 2.1: Apex unit testing that actually tests
  - Lesson 2.2: Asynchronous Apex: future, Queueable, Batch, Scheduled
  - Lesson 2.3: Debugging: logs, checkpoints, and a method
- **Module 3: Lightning Web Components**
  - Lesson 3.1: LWC fundamentals: components, templates, reactivity
  - Lesson 3.2: Data access: wire service, LDS, and Apex
  - Lesson 3.3: Component communication & composition
- **Module 4: Integration & APIs**
  - Lesson 4.1: The API surface: REST, SOAP, Bulk, and friends
  - Lesson 4.2: Callouts, Named Credentials, and resilient consumers
  - Lesson 4.3: Platform Events & Change Data Capture

## Module 1: Apex Fundamentals & Triggers

The language, the query languages, the trigger framework pattern, and the governor limits that shape all of it.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 1.1 — Apex language essentials

**Lesson ID:** `dev-apex-language` · **Reading time:** 20 min · **Video:** 5:00

> Classes, collections, and sObjects — Apex through the eyes of the multi-tenant runtime it lives in.

**Learning objectives**

- Write Apex classes with proper collection usage
- Work with sObjects statically and dynamically
- Understand transactions and execution contexts

#### Concept explanation

##### A Java-like language with a database built in

Apex is strongly typed and object-oriented — classes, interfaces, inheritance — with database records (sObjects) and queries as first-class citizens. Account acc = new Account(Name='Acme'); insert acc; is a complete, transactional persistence operation.

Apex executes server-side in an execution context that begins with an entry point (trigger, web request, batch chunk, anonymous script) and ends with commit or rollback. All limits — queries, DML, CPU — are measured per execution context.

*A service class: with sharing enforces record access; logic stays out of the trigger.*

```apex
public with sharing class AccountService {
    public static void tagStrategicAccounts(List<Account> accounts) {
        for (Account acc : accounts) {
            if (acc.AnnualRevenue != null && acc.AnnualRevenue > 10_000_000) {
                acc.Segment__c = 'Strategic';
            }
        }
    }
}
```

##### Collections: List, Set, Map

The three collections carry nearly all Apex logic. Lists hold ordered records; Sets deduplicate (perfect for Ids); Maps index by key. Map<Id, Account> accountsById = new Map<Id, Account>([SELECT Id, Name FROM Account WHERE Id IN :accountIds]); is the single most useful idiom in the language — one query, indexed lookups afterward.

Mastering the "collect Ids → query once into a Map → loop with lookups" pattern is 80% of writing bulk-safe code.

##### sObjects, statically and dynamically

Static references (Account.Name) are compile-checked — prefer them. The dynamic API (Schema.getGlobalDescribe(), sObject.get('Field__c')) enables generic frameworks that operate on any object, at the cost of runtime-only error discovery.

sObjects returned by queries only contain the fields you selected; touching an unqueried field throws. That error message — "SObject row was retrieved via SOQL without querying the requested field" — will greet every new Apex developer at least once.

#### Real-world example — The 101-query lesson

- **Scenario:** A new developer wrote account-scoring logic that queried each account's contacts inside a loop. It sailed through single-record testing, then a 200-record data load hit "Too many SOQL queries: 101" and blocked the entire migration.
- **Solution:** The fix was the canonical pattern: collect the account Ids, run ONE query for all related contacts grouped into a Map<Id, List<Contact>>, then loop with in-memory lookups.
- **Outcome:** The load ran with 2 queries instead of 200+, and the developer internalized the rule that shapes all Apex: your code always runs against collections, never single records.

#### Key takeaways

- Apex is transactional: an execution context commits or rolls back as a unit
- Map<Id, sObject> built from a single query is the core bulk pattern
- Queried sObjects only carry selected fields
- with sharing / without sharing decides whether record access applies to your class

#### Go deeper

- [Apex Basics & Database (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/apex_database)
- [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Apex language essentials matters | intro |
| 2 | 0:30–1:15 | A Java-like language with a database built in | concept |
| 3 | 1:15–2:00 | Code walk-through — A Java-like language with a database built in | demo |
| 4 | 2:00–2:45 | Collections: List, Set, Map | concept |
| 5 | 2:45–3:30 | sObjects, statically and dynamically | concept |
| 6 | 3:30–4:15 | Real story — The 101-query lesson | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Apex language essentials matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Apex language essentials. Classes, collections, and sObjects — Apex through the eyes of the multi-tenant runtime it lives in. By the end of this video you will be able to write Apex classes with proper collection usage; work with sObjects statically and dynamically; understand transactions and execution contexts.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Apex Fundamentals & Triggers

**[0:30–1:15] A Java-like language with a database built in**

- **Narration (word-for-word):** Apex is strongly typed and object-oriented — classes, interfaces, inheritance — with database records (sObjects) and queries as first-class citizens. Account acc = new Account(Name='Acme'); insert acc; is a complete, transactional persistence operation. Apex executes server-side in an execution context that begins with an entry point (trigger, web request, batch chunk, anonymous script) and ends with commit or rollback. All limits — queries, DML, CPU — are measured per execution context.
- **On screen:** Animated explainer diagram for "A Java-like language with a database built in": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Code walk-through — A Java-like language with a database built in**

- **Narration (word-for-word):** Now watch the same idea in code. A service class: with sharing enforces record access; logic stays out of the trigger. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the apex snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: APEX

**[2:00–2:45] Collections: List, Set, Map**

- **Narration (word-for-word):** The three collections carry nearly all Apex logic. Lists hold ordered records; Sets deduplicate (perfect for Ids); Maps index by key. Map<Id, Account> accountsById = new Map<Id, Account>([SELECT Id, Name FROM Account WHERE Id IN :accountIds]); is the single most useful idiom in the language — one query, indexed lookups afterward. Mastering the "collect Ids → query once into a Map → loop with lookups" pattern is 80% of writing bulk-safe code.
- **On screen:** Animated explainer diagram for "Collections: List, Set, Map": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] sObjects, statically and dynamically**

- **Narration (word-for-word):** Static references (Account.Name) are compile-checked — prefer them. The dynamic API (Schema.getGlobalDescribe(), sObject.get('Field__c')) enables generic frameworks that operate on any object, at the cost of runtime-only error discovery. sObjects returned by queries only contain the fields you selected; touching an unqueried field throws. That error message — "SObject row was retrieved via SOQL without querying the requested field" — will greet every new Apex developer at least once.
- **On screen:** Animated explainer diagram for "sObjects, statically and dynamically": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The 101-query lesson**

- **Narration (word-for-word):** Here is why this matters in the real world. A new developer wrote account-scoring logic that queried each account's contacts inside a loop. It sailed through single-record testing, then a 200-record data load hit "Too many SOQL queries: 101" and blocked the entire migration. What did they do? The fix was the canonical pattern: collect the account Ids, run ONE query for all related contacts grouped into a Map<Id, List<Contact>>, then loop with in-memory lookups. And the payoff: The load ran with 2 queries instead of 200+, and the developer internalized the rule that shapes all Apex: your code always runs against collections, never single records.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The 101-query lesson

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Apex is transactional: an execution context commits or rolls back as a unit. Map<Id, sObject> built from a single query is the core bulk pattern. Queried sObjects only carry selected fields. with sharing / without sharing decides whether record access applies to your class.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Apex language essentials — the idea, the practice, and the real-world payoff. Head back to the Apex Fundamentals & Triggers module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — SOQL & SOSL: querying like a pro

**Lesson ID:** `dev-soql-sosl` · **Reading time:** 20 min · **Video:** 5:00

> Relationship queries, aggregates, selective filters — and when full-text SOSL beats SOQL.

**Learning objectives**

- Write parent-to-child and child-to-parent SOQL
- Use aggregate functions, GROUP BY, and bind variables
- Understand selectivity and choose SOSL when text search is the job

#### Concept explanation

##### Relationship queries

Child-to-parent walks lookups with dot notation: SELECT Name, Account.Owner.Name FROM Contact. Parent-to-child nests a subquery: SELECT Name, (SELECT LastName FROM Contacts) FROM Account — note the child RELATIONSHIP name (Contacts, or Custom_Objects__r for custom).

One well-shaped relationship query frequently replaces two queries plus manual stitching — fewer limits consumed, less code to test.

*Parent-to-child subquery with bind variables — one round trip for accounts and their open deals.*

```sql
SELECT Id, Name,
       (SELECT Id, Amount, StageName FROM Opportunities WHERE IsClosed = false)
FROM Account
WHERE Industry = :industry AND LastActivityDate >= :cutoff
ORDER BY Name
LIMIT 200
```

##### Aggregates and bind variables

COUNT(), SUM(), AVG(), MIN(), MAX() with GROUP BY return AggregateResult rows: SELECT StageName, SUM(Amount) total FROM Opportunity GROUP BY StageName. HAVING filters groups.

Bind variables (WHERE Id IN :accountIds) are non-negotiable: they prevent SOQL injection and let the platform cache query plans. String-concatenated dynamic SOQL with user input is the classic security-review failure.

##### Selectivity and SOSL

On large tables, the optimizer needs a selective filter — an indexed field (Id, Name, external IDs, lookup fields, unique fields) that narrows rows below thresholds. Filters on unindexed checkboxes or NOT-conditions over millions of rows time out. The Query Plan tool in Developer Console reveals what the optimizer will do.

SOSL is the other language: FIND {"acme corp"} IN ALL FIELDS RETURNING Account(Name), Contact(Name) searches the full-text index across objects at once. User-typed search box → SOSL; precise filtered retrieval → SOQL.

#### Real-world example — The report that timed out

- **Scenario:** A nightly Apex job filtered 8 million task records with WHERE Is_Processed__c = false (an unindexed checkbox). As data grew, the query started timing out, silently killing the job.
- **Solution:** The team replaced the checkbox filter with an indexed Status_External__c external-ID field populated on creation, verified selectivity with Query Plan, and added a fallback batch path for backfill.
- **Outcome:** Query time fell from timeout to milliseconds. The incident review added "selectivity check for any query on objects > 1M rows" to the team's definition of done.

#### Key takeaways

- Dot notation up, subqueries down — learn both directions cold
- Always use bind variables; never concatenate user input into SOQL
- Large-object queries need selective, indexed filters — verify with Query Plan
- SOSL for fuzzy multi-object text search; SOQL for structured retrieval

#### Go deeper

- [SOQL and SOSL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_sosl_intro.htm)
- [Apex Basics & Database (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/apex_database)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why SOQL & SOSL: querying like a pro matters | intro |
| 2 | 0:30–1:15 | Relationship queries | demo |
| 3 | 1:15–2:00 | Code walk-through — Relationship queries | demo |
| 4 | 2:00–2:45 | Aggregates and bind variables | concept |
| 5 | 2:45–3:30 | Selectivity and SOSL | concept |
| 6 | 3:30–4:15 | Real story — The report that timed out | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why SOQL & SOSL: querying like a pro matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on SOQL & SOSL: querying like a pro. Relationship queries, aggregates, selective filters — and when full-text SOSL beats SOQL. By the end of this video you will be able to write parent-to-child and child-to-parent SOQL; use aggregate functions, GROUP BY, and bind variables; understand selectivity and choose SOSL when text search is the job.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Apex Fundamentals & Triggers

**[0:30–1:15] Relationship queries**

- **Narration (word-for-word):** Let's actually do this together. Child-to-parent walks lookups with dot notation: SELECT Name, Account.Owner.Name FROM Contact. Parent-to-child nests a subquery: SELECT Name, (SELECT LastName FROM Contacts) FROM Account — note the child RELATIONSHIP name (Contacts, or Custom_Objects__r for custom). One well-shaped relationship query frequently replaces two queries plus manual stitching — fewer limits consumed, less code to test.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Child-to-parent walks lookups with dot notation: SELECT Name, Account.Owner.Name FROM Contact.
  2. Parent-to-child nests a subquery: SELECT Name, (SELECT LastName FROM Contacts) FROM Account — note the child RELATIONSHIP name (Contacts, or Custom_Objects__r for custom).

**[1:15–2:00] Code walk-through — Relationship queries**

- **Narration (word-for-word):** Now watch the same idea in code. Parent-to-child subquery with bind variables — one round trip for accounts and their open deals. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the sql snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: SQL

**[2:00–2:45] Aggregates and bind variables**

- **Narration (word-for-word):** COUNT(), SUM(), AVG(), MIN(), MAX() with GROUP BY return AggregateResult rows: SELECT StageName, SUM(Amount) total FROM Opportunity GROUP BY StageName. HAVING filters groups. Bind variables (WHERE Id IN :accountIds) are non-negotiable: they prevent SOQL injection and let the platform cache query plans. String-concatenated dynamic SOQL with user input is the classic security-review failure.
- **On screen:** Animated explainer diagram for "Aggregates and bind variables": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Selectivity and SOSL**

- **Narration (word-for-word):** On large tables, the optimizer needs a selective filter — an indexed field (Id, Name, external IDs, lookup fields, unique fields) that narrows rows below thresholds. Filters on unindexed checkboxes or NOT-conditions over millions of rows time out. The Query Plan tool in Developer Console reveals what the optimizer will do. SOSL is the other language: FIND {"acme corp"} IN ALL FIELDS RETURNING Account(Name), Contact(Name) searches the full-text index across objects at once. User-typed search box → SOSL; precise filtered retrieval → SOQL.
- **On screen:** Animated explainer diagram for "Selectivity and SOSL": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The report that timed out**

- **Narration (word-for-word):** Here is why this matters in the real world. A nightly Apex job filtered 8 million task records with WHERE Is_Processed__c = false (an unindexed checkbox). As data grew, the query started timing out, silently killing the job. What did they do? The team replaced the checkbox filter with an indexed Status_External__c external-ID field populated on creation, verified selectivity with Query Plan, and added a fallback batch path for backfill. And the payoff: Query time fell from timeout to milliseconds. The incident review added "selectivity check for any query on objects > 1M rows" to the team's definition of done.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The report that timed out

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Dot notation up, subqueries down — learn both directions cold. Always use bind variables; never concatenate user input into SOQL. Large-object queries need selective, indexed filters — verify with Query Plan. SOSL for fuzzy multi-object text search; SOQL for structured retrieval.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is SOQL & SOSL: querying like a pro — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.3 — Triggers done right: one trigger, a handler, bulk always

**Lesson ID:** `dev-triggers` · **Reading time:** 22 min · **Video:** 5:00

> Trigger events, context variables, and the handler-class architecture that keeps orgs maintainable.

**Learning objectives**

- Use trigger context variables (new, old, newMap, oldMap) correctly
- Apply the one-trigger-per-object handler pattern
- Prevent recursion and coordinate with declarative automation

#### Concept explanation

##### Events and context variables

Triggers fire before/after insert, update, delete, and after undelete. Before-triggers mutate Trigger.new directly (no extra DML); after-triggers see committed values (Ids exist) and handle related-record work.

Trigger.new/newMap hold incoming state; Trigger.old/oldMap hold prior state on updates/deletes. Change detection is the bread-and-butter: newRecord.StageName != Trigger.oldMap.get(newRecord.Id).StageName.

*One thin trigger delegating to a handler — logic testable without the trigger firing.*

```apex
trigger OpportunityTrigger on Opportunity (before insert, before update, after update) {
    OpportunityTriggerHandler.run();
}

public class OpportunityTriggerHandler {
    public static void run() {
        if (Trigger.isBefore && Trigger.isUpdate) {
            stampStageChange((List<Opportunity>) Trigger.new,
                             (Map<Id, Opportunity>) Trigger.oldMap);
        }
    }
    private static void stampStageChange(List<Opportunity> opps, Map<Id, Opportunity> oldMap) {
        for (Opportunity opp : opps) {
            if (opp.StageName != oldMap.get(opp.Id).StageName) {
                opp.Stage_Changed_On__c = System.today();
            }
        }
    }
}
```

##### The handler pattern

Production rule: ONE trigger per object, containing no logic — it delegates to a handler class routed by event. Why: multiple triggers on one object fire in undefined order, and logic in trigger bodies cannot be unit-tested in isolation or reused.

Handlers also centralize recursion control (a static "already ran" flag or processed-Id set) and bypass switches (custom permission or hierarchy custom setting) — the levers you desperately want during data migrations and incident response.

##### Living with flows

Triggers and record-triggered flows coexist in the same save: before-save flows → before triggers → after triggers → after-save flows (within the broader order of execution). Same-object field logic split across a flow AND a before-trigger is where "who overwrote my field?" mysteries are born.

Teams need an explicit convention — for example: declarative-first for simple same-record updates, Apex for complex cross-object logic, and NEVER both patterns for the same field. Document the split; the order of execution will not forgive ambiguity.

#### Real-world example — Untangling three triggers on Account

- **Scenario:** An org accreted three Account triggers from different eras. A field set by trigger A was overwritten by trigger C — but only sometimes, because relative firing order between triggers is not guaranteed. Support tickets called it "the ghost".
- **Solution:** The team consolidated into one AccountTrigger + handler with explicit method ordering, added a recursion guard, and wrote regression tests asserting the end-state of the contested field for each scenario.
- **Outcome:** The ghost died immediately. Six months later the same handler structure made adding a new requirement a 30-line, fully tested change instead of a fourth trigger.

#### Key takeaways

- Before-triggers mutate Trigger.new free of DML; after-triggers do related-record work
- One trigger per object; all logic in a testable handler
- Build recursion guards and bypass switches in from day one
- Agree team conventions for trigger-vs-flow responsibilities per object

#### Go deeper

- [Apex Triggers (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/apex_triggers)
- [Triggers and Order of Execution (Apex Guide)](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_triggers_order_of_execution.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Triggers done right: one trigger, a handler, bulk always matters | intro |
| 2 | 0:30–1:15 | Events and context variables | concept |
| 3 | 1:15–2:00 | Code walk-through — Events and context variables | demo |
| 4 | 2:00–2:45 | The handler pattern | concept |
| 5 | 2:45–3:30 | Living with flows | concept |
| 6 | 3:30–4:15 | Real story — Untangling three triggers on Account | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Triggers done right: one trigger, a handler, bulk always matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Triggers done right: one trigger, a handler, bulk always. Trigger events, context variables, and the handler-class architecture that keeps orgs maintainable. By the end of this video you will be able to use trigger context variables (new, old, newMap, oldMap) correctly; apply the one-trigger-per-object handler pattern; prevent recursion and coordinate with declarative automation.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Apex Fundamentals & Triggers

**[0:30–1:15] Events and context variables**

- **Narration (word-for-word):** Triggers fire before/after insert, update, delete, and after undelete. Before-triggers mutate Trigger.new directly (no extra DML); after-triggers see committed values (Ids exist) and handle related-record work. Trigger.new/newMap hold incoming state; Trigger.old/oldMap hold prior state on updates/deletes. Change detection is the bread-and-butter: newRecord.StageName != Trigger.oldMap.get(newRecord.Id).StageName.
- **On screen:** Animated explainer diagram for "Events and context variables": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Code walk-through — Events and context variables**

- **Narration (word-for-word):** Now watch the same idea in code. One thin trigger delegating to a handler — logic testable without the trigger firing. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the apex snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: APEX

**[2:00–2:45] The handler pattern**

- **Narration (word-for-word):** Production rule: ONE trigger per object, containing no logic — it delegates to a handler class routed by event. Why: multiple triggers on one object fire in undefined order, and logic in trigger bodies cannot be unit-tested in isolation or reused. Handlers also centralize recursion control (a static "already ran" flag or processed-Id set) and bypass switches (custom permission or hierarchy custom setting) — the levers you desperately want during data migrations and incident response.
- **On screen:** Animated explainer diagram for "The handler pattern": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Living with flows**

- **Narration (word-for-word):** Triggers and record-triggered flows coexist in the same save: before-save flows → before triggers → after triggers → after-save flows (within the broader order of execution). Same-object field logic split across a flow AND a before-trigger is where "who overwrote my field?" mysteries are born. Teams need an explicit convention — for example: declarative-first for simple same-record updates, Apex for complex cross-object logic, and NEVER both patterns for the same field. Document the split; the order of execution will not forgive ambiguity.
- **On screen:** Animated explainer diagram for "Living with flows": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Untangling three triggers on Account**

- **Narration (word-for-word):** Here is why this matters in the real world. An org accreted three Account triggers from different eras. A field set by trigger A was overwritten by trigger C — but only sometimes, because relative firing order between triggers is not guaranteed. Support tickets called it "the ghost". What did they do? The team consolidated into one AccountTrigger + handler with explicit method ordering, added a recursion guard, and wrote regression tests asserting the end-state of the contested field for each scenario. And the payoff: The ghost died immediately.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Untangling three triggers on Account

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Before-triggers mutate Trigger.new free of DML; after-triggers do related-record work. One trigger per object; all logic in a testable handler. Build recursion guards and bypass switches in from day one. Agree team conventions for trigger-vs-flow responsibilities per object.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Triggers done right: one trigger, a handler, bulk always — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.4 — Governor limits: the physics of the platform

**Lesson ID:** `dev-governor-limits` · **Reading time:** 18 min · **Video:** 5:00

> Why limits exist, the numbers that matter, and the design patterns that keep you far away from them.

**Learning objectives**

- Explain multi-tenancy as the reason limits exist
- Memorize the headline synchronous limits
- Apply bulkification and limit-aware design patterns

#### Concept explanation

##### Why limits exist

Your Apex shares hardware with thousands of other tenants. Governor limits are the contract that stops one tenant's runaway loop from degrading everyone else — not an inconvenience but the reason the platform can promise consistent performance without you managing servers.

Limits are per execution context and most differ between synchronous and asynchronous execution. Exceeding one throws an uncatchable LimitException: the transaction dies, full stop.

##### The numbers that matter

Synchronous headline limits: 100 SOQL queries, 150 DML statements, 10,000 rows retrieved, 10,000 rows of DML, 10 seconds CPU, 6 MB heap, 100 callouts (120s total). Asynchronous contexts get 200 SOQL, 60 seconds CPU, 12 MB heap.

You do not memorize all limits — you memorize these, and you instrument code with Limits.getQueries(), Limits.getCpuTime() when operating near the edge. Debug logs print a limit usage summary per context: read it.

##### Design patterns that respect the physics

Bulkification: no SOQL or DML inside loops, ever — collect, query once, mutate in memory, write once. Selective queries with WHERE and LIMIT rather than filtering in Apex. Move heavy work async (Queueable, Batch) where limits are roomier. Cache describes and configuration in static variables (free within a context).

When approaching row limits by design (millions of records), the answer is architecture, not optimization: Batch Apex chunks, platform events for decoupling, or pushing aggregation to the database via roll-ups and reports.

#### Real-world example — CPU timeout at quarter close

- **Scenario:** A pricing recalculation trigger comfortably handled daily edits. At quarter close, ops mass-updated 50,000 opportunity lines; batches of 200 hit the 10-second CPU limit deep inside nested loops nobody had profiled.
- **Solution:** Profiling with Limits.getCpuTime() found an O(n²) inner loop matching lines to price rules. A Map-based index made it O(n); the recalculation also moved to a Queueable for updates above a size threshold.
- **Outcome:** CPU per batch dropped from ~9,800 ms to under 900 ms. The team added a load test at 10× daily volume to CI — the class of bug that only appears at scale now surfaces before release.

#### Key takeaways

- Limits are the multi-tenant contract; LimitException is uncatchable
- Know the headline numbers: 100 queries / 150 DML / 10k rows / 10s CPU sync
- Bulkify always; profile with Limits methods and the debug log summary
- Near the ceiling by design? Change architecture (async/batch), not micro-optimize

#### Go deeper

- [Execution Governors and Limits (Apex Guide)](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm)
- [Apex Basics & Database (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/apex_database)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Governor limits: the physics of the platform matters | intro |
| 2 | 0:30–1:30 | Why limits exist | concept |
| 3 | 1:30–2:30 | The numbers that matter | concept |
| 4 | 2:30–3:30 | Design patterns that respect the physics | concept |
| 5 | 3:30–4:15 | Real story — CPU timeout at quarter close | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Governor limits: the physics of the platform matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Governor limits: the physics of the platform. Why limits exist, the numbers that matter, and the design patterns that keep you far away from them. By the end of this video you will be able to explain multi-tenancy as the reason limits exist; memorize the headline synchronous limits; apply bulkification and limit-aware design patterns.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Apex Fundamentals & Triggers

**[0:30–1:30] Why limits exist**

- **Narration (word-for-word):** Your Apex shares hardware with thousands of other tenants. Governor limits are the contract that stops one tenant's runaway loop from degrading everyone else — not an inconvenience but the reason the platform can promise consistent performance without you managing servers. Limits are per execution context and most differ between synchronous and asynchronous execution. Exceeding one throws an uncatchable LimitException: the transaction dies, full stop.
- **On screen:** Animated explainer diagram for "Why limits exist": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] The numbers that matter**

- **Narration (word-for-word):** Synchronous headline limits: 100 SOQL queries, 150 DML statements, 10,000 rows retrieved, 10,000 rows of DML, 10 seconds CPU, 6 MB heap, 100 callouts (120s total). Asynchronous contexts get 200 SOQL, 60 seconds CPU, 12 MB heap. You do not memorize all limits — you memorize these, and you instrument code with Limits.getQueries(), Limits.getCpuTime() when operating near the edge. Debug logs print a limit usage summary per context: read it.
- **On screen:** Animated explainer diagram for "The numbers that matter": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Design patterns that respect the physics**

- **Narration (word-for-word):** Bulkification: no SOQL or DML inside loops, ever — collect, query once, mutate in memory, write once. Selective queries with WHERE and LIMIT rather than filtering in Apex. Move heavy work async (Queueable, Batch) where limits are roomier. Cache describes and configuration in static variables (free within a context). When approaching row limits by design (millions of records), the answer is architecture, not optimization: Batch Apex chunks, platform events for decoupling, or pushing aggregation to the database via roll-ups and reports.
- **On screen:** Animated explainer diagram for "Design patterns that respect the physics": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — CPU timeout at quarter close**

- **Narration (word-for-word):** Here is why this matters in the real world. A pricing recalculation trigger comfortably handled daily edits. At quarter close, ops mass-updated 50,000 opportunity lines; batches of 200 hit the 10-second CPU limit deep inside nested loops nobody had profiled. What did they do? Profiling with Limits.getCpuTime() found an O(n²) inner loop matching lines to price rules. A Map-based index made it O(n); the recalculation also moved to a Queueable for updates above a size threshold. And the payoff: CPU per batch dropped from ~9,800 ms to under 900 ms.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** CPU timeout at quarter close

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Limits are the multi-tenant contract; LimitException is uncatchable. Know the headline numbers: 100 queries / 150 DML / 10k rows / 10s CPU sync. Bulkify always; profile with Limits methods and the debug log summary. Near the ceiling by design? Change architecture (async/batch), not micro-optimize.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Governor limits: the physics of the platform — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: Testing & Asynchronous Apex

Unit tests that earn their coverage, and the async toolbox: future, Queueable, Batch, and Scheduled Apex.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 2.1 — Apex unit testing that actually tests

**Lesson ID:** `dev-apex-testing` · **Reading time:** 20 min · **Video:** 5:00

> Test data factories, assertions with meaning, Test.startTest, and testing as a design tool — beyond the 75% number.

**Learning objectives**

- Structure tests with @isTest, test data factories, and System.runAs
- Use Test.startTest/stopTest for limits isolation and async execution
- Write assertions that verify behavior, not just coverage

#### Concept explanation

##### The rules of the arena

Test methods live in @isTest classes, see no org data by default (@isTest(SeeAllData=true) is a legacy escape hatch to avoid), and never commit. Production deployments require 75% aggregate coverage with all tests passing — but treat 75% as a floor the platform enforces, not a goal.

Every test builds its own world: a TestDataFactory class centralizes record creation so a new validation rule breaks ONE factory method, not 200 tests.

*@TestSetup data, startTest/stopTest isolation, and an assertion with a reason message.*

```apex
@isTest
private class OpportunityHandlerTest {
    @TestSetup
    static void makeData() {
        insert TestDataFactory.accounts(5);
    }

    @isTest
    static void stampsDateWhenStageChanges() {
        Opportunity opp = TestDataFactory.oppForFirstAccount('Prospecting');
        insert opp;

        Test.startTest();
        opp.StageName = 'Closed Won';
        update opp;
        Test.stopTest();

        opp = [SELECT Stage_Changed_On__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(System.today(), opp.Stage_Changed_On__c,
            'Stage change must stamp the change date');
    }
}
```

##### startTest, stopTest, and runAs

Test.startTest() resets governor limits for the code under test — your setup queries stop polluting the measurement. Test.stopTest() forces queued asynchronous work (future, Queueable, Batch) to execute synchronously, so you can assert on async results deterministically.

System.runAs(user) tests behavior under a real profile/permission profile — the only way to prove your with sharing code actually restricts access. Permission bugs found by runAs tests are dramatically cheaper than the same bugs found by auditors.

##### Coverage is a byproduct

A test that calls a method and asserts nothing achieves coverage and proves nothing. Good tests assert outcomes: field values after the operation, records created, errors thrown for bad input (try/catch + Assert.fail pattern), and behavior at bulk scale — insert 200 records, not 1.

Name tests for the behavior they pin: stampsDateWhenStageChanges, blocksDiscountAboveTwentyPercentForReps. A failing test name should read as a bug report.

#### Real-world example — The refactor nobody feared

- **Scenario:** A team needed to replace a 900-line legacy pricing class. Coverage was 82% — but almost entirely assertion-free "coverage tests", so nobody could tell whether a rewrite broke real behavior.
- **Solution:** Before refactoring, they wrote thirty behavior tests capturing current pricing outcomes for representative scenarios (bulk included), reviewed the odd results with finance (two were latent bugs!), then rewrote the class against that safety net.
- **Outcome:** The rewrite shipped with zero pricing regressions, two pre-existing bugs fixed, and the team's definition of done changed to require assertion-based tests — coverage became a byproduct.

#### Key takeaways

- Tests see no org data; factories centralize test record creation
- startTest resets limits; stopTest flushes async work for assertion
- runAs proves security behavior under real profiles
- Assert outcomes at bulk scale; 75% is a floor, not a target

#### Go deeper

- [Apex Testing (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/apex_testing)
- [Testing Best Practices (Apex Guide)](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_testing_best_practices.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Apex unit testing that actually tests matters | intro |
| 2 | 0:30–1:15 | The rules of the arena | concept |
| 3 | 1:15–2:00 | Code walk-through — The rules of the arena | demo |
| 4 | 2:00–2:45 | startTest, stopTest, and runAs | demo |
| 5 | 2:45–3:30 | Coverage is a byproduct | concept |
| 6 | 3:30–4:15 | Real story — The refactor nobody feared | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Apex unit testing that actually tests matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Apex unit testing that actually tests. Test data factories, assertions with meaning, Test.startTest, and testing as a design tool — beyond the 75% number. By the end of this video you will be able to structure tests with @isTest, test data factories, and System.runAs; use Test.startTest/stopTest for limits isolation and async execution; write assertions that verify behavior, not just coverage.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Testing & Asynchronous Apex

**[0:30–1:15] The rules of the arena**

- **Narration (word-for-word):** Test methods live in @isTest classes, see no org data by default (@isTest(SeeAllData=true) is a legacy escape hatch to avoid), and never commit. Production deployments require 75% aggregate coverage with all tests passing — but treat 75% as a floor the platform enforces, not a goal. Every test builds its own world: a TestDataFactory class centralizes record creation so a new validation rule breaks ONE factory method, not 200 tests.
- **On screen:** Animated explainer diagram for "The rules of the arena": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Code walk-through — The rules of the arena**

- **Narration (word-for-word):** Now watch the same idea in code. @TestSetup data, startTest/stopTest isolation, and an assertion with a reason message. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the apex snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: APEX

**[2:00–2:45] startTest, stopTest, and runAs**

- **Narration (word-for-word):** Let's actually do this together. Test.startTest() resets governor limits for the code under test — your setup queries stop polluting the measurement. Test.stopTest() forces queued asynchronous work (future, Queueable, Batch) to execute synchronously, so you can assert on async results deterministically. System.runAs(user) tests behavior under a real profile/permission profile — the only way to prove your with sharing code actually restricts access. Permission bugs found by runAs tests are dramatically cheaper than the same bugs found by auditors.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Test.startTest() resets governor limits for the code under test — your setup queries stop polluting the measurement.
  2. Test.stopTest() forces queued asynchronous work (future, Queueable, Batch) to execute synchronously, so you can assert on async results deterministically.

**[2:45–3:30] Coverage is a byproduct**

- **Narration (word-for-word):** A test that calls a method and asserts nothing achieves coverage and proves nothing. Good tests assert outcomes: field values after the operation, records created, errors thrown for bad input (try/catch + Assert.fail pattern), and behavior at bulk scale — insert 200 records, not 1. Name tests for the behavior they pin: stampsDateWhenStageChanges, blocksDiscountAboveTwentyPercentForReps. A failing test name should read as a bug report.
- **On screen:** Animated explainer diagram for "Coverage is a byproduct": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The refactor nobody feared**

- **Narration (word-for-word):** Here is why this matters in the real world. A team needed to replace a 900-line legacy pricing class. Coverage was 82% — but almost entirely assertion-free "coverage tests", so nobody could tell whether a rewrite broke real behavior. What did they do? Before refactoring, they wrote thirty behavior tests capturing current pricing outcomes for representative scenarios (bulk included), reviewed the odd results with finance (two were latent bugs!), then rewrote the class against that safety net. And the payoff: The rewrite shipped with zero pricing regressions, two pre-existing bugs fixed, and the team's definition of done changed to require assertion-based tests — coverage became a byproduct.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The refactor nobody feared

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Tests see no org data; factories centralize test record creation. startTest resets limits; stopTest flushes async work for assertion. runAs proves security behavior under real profiles. Assert outcomes at bulk scale; 75% is a floor, not a target.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Apex unit testing that actually tests — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Asynchronous Apex: future, Queueable, Batch, Scheduled

**Lesson ID:** `dev-async-apex` · **Reading time:** 22 min · **Video:** 5:00

> The four async tools, what each is for, and how to chain work across limit boundaries.

**Learning objectives**

- Choose the right async tool per use case
- Implement Queueable chaining and Batch Apex correctly
- Schedule recurring work and monitor async health

#### Concept explanation

##### future and Queueable

@future methods are fire-and-forget with primitive-only parameters — historically used for callouts after DML (callouts cannot follow uncommitted DML in one transaction). Queueable is the modern superset: object parameters, a job Id for monitoring, and chaining — one Queueable can enqueue the next.

Default to Queueable; reserve @future for the rare trivial case. Both run with async limits (200 SOQL, 60s CPU, 12MB heap).

*A chained Queueable with callouts — each link processes a slice within its own limits.*

```apex
public class SyncInvoiceJob implements Queueable, Database.AllowsCallouts {
    private final List<Id> invoiceIds;
    public SyncInvoiceJob(List<Id> invoiceIds) { this.invoiceIds = invoiceIds; }

    public void execute(QueueableContext ctx) {
        List<Id> batch = take(invoiceIds, 50);
        ErpClient.pushInvoices(batch);          // callout allowed here
        List<Id> remaining = rest(invoiceIds, 50);
        if (!remaining.isEmpty()) {
            System.enqueueJob(new SyncInvoiceJob(remaining)); // chain
        }
    }
}
```

##### Batch Apex: the heavy hauler

Database.Batchable<sObject> splits huge datasets into chunks (default 200, configurable) with three phases: start (returns a QueryLocator over up to 50 MILLION rows), execute (per chunk, fresh limits each time), finish (post-processing, notifications, chaining the next job).

Batch is for data-volume work: nightly recalculations, archival, mass cleanups. Make execute idempotent — chunks can retry — and use Database.Stateful only when you genuinely need cross-chunk state (it serializes the instance between chunks and costs performance).

##### Scheduled Apex and operational monitoring

Schedulable classes run on cron expressions — System.schedule('Nightly recalc', '0 0 2 * * ?', new RecalcScheduler()); typically the scheduler just launches a Batch or Queueable so logic stays testable.

Operations matter as much as code: the Apex Jobs page and AsyncApexJob object show statuses and failures; flex queue holds up to 100 waiting batches; scheduled classes LOCK — you cannot edit a class referenced by an active schedule, a famous deployment gotcha. Monitor failures actively: async errors don't interrupt any user, which means nobody notices until the data is stale.

#### Real-world example — Nightly territory recalculation

- **Scenario:** Account territory assignment depended on rules across 3 million accounts. A synchronous approach was impossible (row limits), and a naive @future fan-out created thousands of uncoordinated jobs with no visibility.
- **Solution:** A Scheduled class kicks off a Batch at 2 am (scope 2,000). execute() recalculates each chunk idempotently; finish() emails a summary and enqueues a Queueable that syncs changes to the data warehouse via callouts.
- **Outcome:** The full recalculation completes in ninety minutes with per-chunk retry safety, one dashboard shows job health, and failed nights page the on-call admin instead of being discovered by sales ops a week later.

#### Key takeaways

- Queueable > @future: objects, job Ids, chaining
- Batch for millions of rows; fresh limits per chunk; keep execute idempotent
- Scheduled Apex should delegate to Batch/Queueable, not hold logic
- Monitor AsyncApexJob — silent async failure is the default failure mode

#### Go deeper

- [Asynchronous Apex (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/asynchronous_apex)
- [Batch Apex (Apex Guide)](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_batch_interface.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Asynchronous Apex: future, Queueable, Batch, Scheduled matters | intro |
| 2 | 0:30–1:15 | future and Queueable | concept |
| 3 | 1:15–2:00 | Code walk-through — future and Queueable | demo |
| 4 | 2:00–2:45 | Batch Apex: the heavy hauler | concept |
| 5 | 2:45–3:30 | Scheduled Apex and operational monitoring | concept |
| 6 | 3:30–4:15 | Real story — Nightly territory recalculation | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Asynchronous Apex: future, Queueable, Batch, Scheduled matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Asynchronous Apex: future, Queueable, Batch, Scheduled. The four async tools, what each is for, and how to chain work across limit boundaries. By the end of this video you will be able to choose the right async tool per use case; implement Queueable chaining and Batch Apex correctly; schedule recurring work and monitor async health.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Testing & Asynchronous Apex

**[0:30–1:15] future and Queueable**

- **Narration (word-for-word):** @future methods are fire-and-forget with primitive-only parameters — historically used for callouts after DML (callouts cannot follow uncommitted DML in one transaction). Queueable is the modern superset: object parameters, a job Id for monitoring, and chaining — one Queueable can enqueue the next. Default to Queueable; reserve @future for the rare trivial case. Both run with async limits (200 SOQL, 60s CPU, 12MB heap).
- **On screen:** Animated explainer diagram for "future and Queueable": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Code walk-through — future and Queueable**

- **Narration (word-for-word):** Now watch the same idea in code. A chained Queueable with callouts — each link processes a slice within its own limits. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the apex snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: APEX

**[2:00–2:45] Batch Apex: the heavy hauler**

- **Narration (word-for-word):** Database.Batchable<sObject> splits huge datasets into chunks (default 200, configurable) with three phases: start (returns a QueryLocator over up to 50 MILLION rows), execute (per chunk, fresh limits each time), finish (post-processing, notifications, chaining the next job). Batch is for data-volume work: nightly recalculations, archival, mass cleanups. Make execute idempotent — chunks can retry — and use Database.Stateful only when you genuinely need cross-chunk state (it serializes the instance between chunks and costs performance).
- **On screen:** Animated explainer diagram for "Batch Apex: the heavy hauler": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Scheduled Apex and operational monitoring**

- **Narration (word-for-word):** Schedulable classes run on cron expressions — System.schedule('Nightly recalc', '0 0 2 * * ?', new RecalcScheduler()); typically the scheduler just launches a Batch or Queueable so logic stays testable. Operations matter as much as code: the Apex Jobs page and AsyncApexJob object show statuses and failures; flex queue holds up to 100 waiting batches; scheduled classes LOCK — you cannot edit a class referenced by an active schedule, a famous deployment gotcha. Monitor failures actively: async errors don't interrupt any user, which means nobody notices until the data is stale.
- **On screen:** Animated explainer diagram for "Scheduled Apex and operational monitoring": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Nightly territory recalculation**

- **Narration (word-for-word):** Here is why this matters in the real world. Account territory assignment depended on rules across 3 million accounts. A synchronous approach was impossible (row limits), and a naive @future fan-out created thousands of uncoordinated jobs with no visibility. What did they do? A Scheduled class kicks off a Batch at 2 am (scope 2,000). execute() recalculates each chunk idempotently; finish() emails a summary and enqueues a Queueable that syncs changes to the data warehouse via callouts.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Nightly territory recalculation

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Queueable > @future: objects, job Ids, chaining. Batch for millions of rows; fresh limits per chunk; keep execute idempotent. Scheduled Apex should delegate to Batch/Queueable, not hold logic. Monitor AsyncApexJob — silent async failure is the default failure mode.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Asynchronous Apex: future, Queueable, Batch, Scheduled — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.3 — Debugging: logs, checkpoints, and a method

**Lesson ID:** `dev-debugging` · **Reading time:** 15 min · **Video:** 5:00

> Debug levels, reading the log like a detective, and a reproducible debugging workflow with VS Code.

**Learning objectives**

- Set trace flags and interpret debug log sections
- Profile limit consumption from log summaries
- Debug systematically instead of System.debug-scattering

#### Concept explanation

##### Trace flags and levels

A trace flag (user + time window + debug level) makes the platform emit logs for that user's transactions. Levels per category (Apex, Database, Workflow, Validation…) tune verbosity; FINEST Apex logging includes every statement but truncates sooner — logs cap at 20 MB.

Log into the problem user's context (or trace THAT user): most "works for me" bugs are visibility or automation differences between users, and the log of the right user says so immediately.

##### Reading a log

A debug log is the transaction's biography: CODE_UNIT_STARTED blocks show what ran (triggers, flows, validations) in exact order; SOQL_EXECUTE lines show queries with row counts; DML_BEGIN shows writes; the LIMIT_USAGE summary at the end shows consumption per namespace.

Two high-value habits: search for EXCEPTION_THROWN first, and read the execution order of CODE_UNIT blocks when fields change "mysteriously" — the log IS the order of execution, observed.

##### A reproducible workflow

The professional loop: reproduce minimally (Execute Anonymous with a hardcoded record), trace with targeted levels, locate with the log timeline, fix, then encode the reproduction as a unit test so the bug stays dead.

VS Code with the Salesforce extensions supports Apex Replay Debugger — stepping through a captured log with variable inspection — which beats twenty rounds of System.debug archaeology for gnarly logic bugs.

#### Real-world example — The mystery of the vanishing discount

- **Scenario:** Sales reported discounts "randomly resetting to zero" after save. Three developers stared at the trigger for a day — the trigger was innocent.
- **Solution:** A trace flag on an affected user produced a log whose CODE_UNIT timeline showed an after-save flow (built by a departed admin) recalculating discounts AFTER the trigger ran. The flow's entry condition was missing a record-type filter.
- **Outcome:** One entry-condition fix ended a week of confusion. The team now pulls a debug log BEFORE theorizing — the log shows the actual execution order, opinions do not.

#### Key takeaways

- Trace the affected user, not yourself — context differences are the usual suspect
- The log is the observed order of execution; read CODE_UNIT blocks
- Check LIMIT_USAGE summaries during performance work
- Every fixed bug becomes a unit test

#### Go deeper

- [Debug Logs (Salesforce Help)](https://help.salesforce.com/s/articleView?id=sf.code_debug_log.htm&type=5)
- [Salesforce Extensions for VS Code](https://developer.salesforce.com/tools/vscode)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Debugging: logs, checkpoints, and a method matters | intro |
| 2 | 0:30–1:30 | Trace flags and levels | concept |
| 3 | 1:30–2:30 | Reading a log | concept |
| 4 | 2:30–3:30 | A reproducible workflow | concept |
| 5 | 3:30–4:15 | Real story — The mystery of the vanishing discount | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Debugging: logs, checkpoints, and a method matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Debugging: logs, checkpoints, and a method. Debug levels, reading the log like a detective, and a reproducible debugging workflow with VS Code. By the end of this video you will be able to set trace flags and interpret debug log sections; profile limit consumption from log summaries; debug systematically instead of System.debug-scattering.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Testing & Asynchronous Apex

**[0:30–1:30] Trace flags and levels**

- **Narration (word-for-word):** A trace flag (user + time window + debug level) makes the platform emit logs for that user's transactions. Levels per category (Apex, Database, Workflow, Validation…) tune verbosity; FINEST Apex logging includes every statement but truncates sooner — logs cap at 20 MB. Log into the problem user's context (or trace THAT user): most "works for me" bugs are visibility or automation differences between users, and the log of the right user says so immediately.
- **On screen:** Animated explainer diagram for "Trace flags and levels": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Reading a log**

- **Narration (word-for-word):** A debug log is the transaction's biography: CODE_UNIT_STARTED blocks show what ran (triggers, flows, validations) in exact order; SOQL_EXECUTE lines show queries with row counts; DML_BEGIN shows writes; the LIMIT_USAGE summary at the end shows consumption per namespace. Two high-value habits: search for EXCEPTION_THROWN first, and read the execution order of CODE_UNIT blocks when fields change "mysteriously" — the log IS the order of execution, observed.
- **On screen:** Animated explainer diagram for "Reading a log": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] A reproducible workflow**

- **Narration (word-for-word):** The professional loop: reproduce minimally (Execute Anonymous with a hardcoded record), trace with targeted levels, locate with the log timeline, fix, then encode the reproduction as a unit test so the bug stays dead. VS Code with the Salesforce extensions supports Apex Replay Debugger — stepping through a captured log with variable inspection — which beats twenty rounds of System.debug archaeology for gnarly logic bugs.
- **On screen:** Animated explainer diagram for "A reproducible workflow": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The mystery of the vanishing discount**

- **Narration (word-for-word):** Here is why this matters in the real world. Sales reported discounts "randomly resetting to zero" after save. Three developers stared at the trigger for a day — the trigger was innocent. What did they do? A trace flag on an affected user produced a log whose CODE_UNIT timeline showed an after-save flow (built by a departed admin) recalculating discounts AFTER the trigger ran. The flow's entry condition was missing a record-type filter. And the payoff: One entry-condition fix ended a week of confusion. The team now pulls a debug log BEFORE theorizing — the log shows the actual execution order, opinions do not.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The mystery of the vanishing discount

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Trace the affected user, not yourself — context differences are the usual suspect. The log is the observed order of execution; read CODE_UNIT blocks. Check LIMIT_USAGE summaries during performance work. Every fixed bug becomes a unit test.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Debugging: logs, checkpoints, and a method — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: Lightning Web Components

Modern web-standard UI on the platform: reactivity, Lightning Data Service, Apex wiring, and component communication.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 3.1 — LWC fundamentals: components, templates, reactivity

**Lesson ID:** `dev-lwc-fundamentals` · **Reading time:** 20 min · **Video:** 5:00

> The anatomy of a component — HTML template, JavaScript class, metadata — and how reactivity actually works.

**Learning objectives**

- Build a component from template + class + meta.xml
- Use decorators: @api, @track, and when neither is needed
- Handle events and conditional rendering in templates

#### Concept explanation

##### Anatomy of a component

An LWC is a folder: component.html (template), component.js (an ES class extending LightningElement), component.js-meta.xml (visibility: which pages/apps can host it, plus configurable properties). CSS and tests sit alongside.

LWC is built on web standards — custom elements, modules, shadow DOM — so modern JavaScript knowledge transfers directly, unlike the proprietary Aura framework it replaced. Base components (lightning-input, lightning-datatable, lightning-card) provide SLDS-styled building blocks.

*@api exposes a public property; plain fields are already reactive; getters derive display values.*

```javascript
import { LightningElement, api } from 'lwc';

export default class GreetingCard extends LightningElement {
    @api recordName = 'friend';
    liked = false;              // reactive without any decorator

    get message() {
        return `Hello, ${this.recordName}!`;
    }
    handleLike() {
        this.liked = !this.liked;
    }
}
```

##### Reactivity and decorators

All fields are reactive for primitive reassignment — change this.count and the template re-renders. @track is only needed for observing MUTATION of objects/arrays (or reassign a fresh copy instead — the cleaner habit). @api marks public properties settable by parent components or App Builder.

Templates bind with {property}, loop with for:each (always set key=), and render conditionally with the modern lwc:if|elseif|else directives.

##### Events and lifecycle

DOM events wire with onclick={handleClick}. Components communicate upward via CustomEvent: this.dispatchEvent(new CustomEvent('select', { detail: { id } })) — parents listen with onselect. Lifecycle hooks: connectedCallback (setup on insert), renderedCallback (after render — guard against loops), disconnectedCallback (cleanup).

Shadow DOM isolates styling: your CSS stays in, page CSS stays out. Styling hooks (--slds-c-… custom properties) are the sanctioned way to theme base components.

#### Real-world example — Replacing a spreadsheet ritual with a component

- **Scenario:** Account managers exported related opportunities to Excel just to see a weighted pipeline number with color coding — every account review, every week.
- **Solution:** A developer built a small LWC: it receives recordId from the record page, computes weighted pipeline in a getter, renders a lightning-datatable with SLDS badge styling, and exposes a "target multiplier" property configurable per App Builder page.
- **Outcome:** The spreadsheet ritual disappeared; admins later reused the same component on the Sales home page with a different multiplier — zero code changes, one meta.xml property.

#### Key takeaways

- Component = template + class + meta.xml; base components handle the look
- Fields are reactive; @track only for object mutation; @api for public props
- Communicate down via properties, up via CustomEvent
- meta.xml properties make components admin-configurable — design for it

#### Go deeper

- [Lightning Web Components Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lightning-web-components-basics)
- [LWC Developer Guide](https://developer.salesforce.com/docs/platform/lwc/guide)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why LWC fundamentals: components, templates, reactivity matters | intro |
| 2 | 0:30–1:15 | Anatomy of a component | concept |
| 3 | 1:15–2:00 | Code walk-through — Anatomy of a component | demo |
| 4 | 2:00–2:45 | Reactivity and decorators | concept |
| 5 | 2:45–3:30 | Events and lifecycle | concept |
| 6 | 3:30–4:15 | Real story — Replacing a spreadsheet ritual with a component | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why LWC fundamentals: components, templates, reactivity matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on LWC fundamentals: components, templates, reactivity. The anatomy of a component — HTML template, JavaScript class, metadata — and how reactivity actually works. By the end of this video you will be able to build a component from template + class + meta.xml; use decorators: @api, @track, and when neither is needed; handle events and conditional rendering in templates.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Lightning Web Components

**[0:30–1:15] Anatomy of a component**

- **Narration (word-for-word):** An LWC is a folder: component.html (template), component.js (an ES class extending LightningElement), component.js-meta.xml (visibility: which pages/apps can host it, plus configurable properties). CSS and tests sit alongside. LWC is built on web standards — custom elements, modules, shadow DOM — so modern JavaScript knowledge transfers directly, unlike the proprietary Aura framework it replaced. Base components (lightning-input, lightning-datatable, lightning-card) provide SLDS-styled building blocks.
- **On screen:** Animated explainer diagram for "Anatomy of a component": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Code walk-through — Anatomy of a component**

- **Narration (word-for-word):** Now watch the same idea in code. @api exposes a public property; plain fields are already reactive; getters derive display values. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:00–2:45] Reactivity and decorators**

- **Narration (word-for-word):** All fields are reactive for primitive reassignment — change this.count and the template re-renders. @track is only needed for observing MUTATION of objects/arrays (or reassign a fresh copy instead — the cleaner habit). @api marks public properties settable by parent components or App Builder. Templates bind with {property}, loop with for:each (always set key=), and render conditionally with the modern lwc:if|elseif|else directives.
- **On screen:** Animated explainer diagram for "Reactivity and decorators": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Events and lifecycle**

- **Narration (word-for-word):** DOM events wire with onclick={handleClick}. Components communicate upward via CustomEvent: this.dispatchEvent(new CustomEvent('select', { detail: { id } })) — parents listen with onselect. Lifecycle hooks: connectedCallback (setup on insert), renderedCallback (after render — guard against loops), disconnectedCallback (cleanup). Shadow DOM isolates styling: your CSS stays in, page CSS stays out. Styling hooks (--slds-c-… custom properties) are the sanctioned way to theme base components.
- **On screen:** Animated explainer diagram for "Events and lifecycle": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Replacing a spreadsheet ritual with a component**

- **Narration (word-for-word):** Here is why this matters in the real world. Account managers exported related opportunities to Excel just to see a weighted pipeline number with color coding — every account review, every week. What did they do? A developer built a small LWC: it receives recordId from the record page, computes weighted pipeline in a getter, renders a lightning-datatable with SLDS badge styling, and exposes a "target multiplier" property configurable per App Builder page. And the payoff: The spreadsheet ritual disappeared; admins later reused the same component on the Sales home page with a different multiplier — zero code changes, one meta.xml property.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Replacing a spreadsheet ritual with a component

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Component = template + class + meta.xml; base components handle the look. Fields are reactive; @track only for object mutation; @api for public props. Communicate down via properties, up via CustomEvent. meta.xml properties make components admin-configurable — design for it.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is LWC fundamentals: components, templates, reactivity — the idea, the practice, and the real-world payoff. Head back to the Lightning Web Components module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — Data access: wire service, LDS, and Apex

**Lesson ID:** `dev-lwc-data` · **Reading time:** 20 min · **Video:** 5:00

> The data-access decision tree: Lightning Data Service first, wired Apex second, imperative Apex when you need control.

**Learning objectives**

- Use LDS adapters (getRecord, createRecord) and record forms
- Wire Apex methods reactively with @wire and $parameters
- Call Apex imperatively and handle errors + refreshApex

#### Concept explanation

##### Lightning Data Service: the free layer

LDS gives CRUD on single records with a shared client-side cache and zero Apex: lightning-record-form and friends render full forms respecting FLS and layouts; @wire(getRecord, { recordId: '$recordId', fields }) streams record data into your component and keeps every LDS consumer on the page in sync after edits.

If your requirement is "show/edit fields of THIS record", LDS is the answer — no controller, no test class, cache included.

##### Wired Apex for lists and logic

For queries beyond one record, expose Apex: @AuraEnabled(cacheable=true) static methods wire into components. Reactive parameters ($searchTerm) re-invoke the wire automatically when the property changes — a search-as-you-type experience in a handful of lines.

cacheable=true is required for wiring and enables client caching, but such methods cannot perform DML. Structure reads as cacheable wires and writes as separate imperative methods.

*Reactive wire: typing updates `term`, the wire re-queries, the template re-renders.*

```javascript
import { LightningElement, wire } from 'lwc';
import searchAccounts from '@salesforce/apex/AccountSearchController.search';

export default class AccountSearch extends LightningElement {
    term = '';
    @wire(searchAccounts, { term: '$term' }) results; // re-fires when term changes

    handleChange(event) {
        this.term = event.target.value;
    }
}
```

##### Imperative calls and cache refresh

Button-triggered operations and DML use imperative calls: await save({ payload }) inside try/catch, then toast the outcome (ShowToastEvent) and refresh stale wires with refreshApex(this.wiredResult) or notify LDS of record changes.

Errors from Apex arrive as structured objects — build one error-normalizing utility and reuse it everywhere. Never swallow errors silently; a component that fails without feedback erodes trust in the whole app.

#### Real-world example — The over-engineered account panel, refactored

- **Scenario:** A consultancy delivered an account panel powered entirely by custom Apex — including plain field display. It broke FLS (fields admins hid kept showing) and required a deployment for every field change.
- **Solution:** The refactor used lightning-record-view-form for record fields (FLS respected automatically, fields changeable by admins), kept one cacheable wired Apex method for the genuinely custom aggregation, and one imperative method for the action button.
- **Outcome:** The FLS violation vanished without code, admins gained field-level control through Setup, and the Apex surface (and its test burden) shrank by two-thirds.

#### Key takeaways

- Decision tree: LDS/record forms → wired cacheable Apex → imperative Apex
- LDS respects FLS and layouts and shares a cache across the page
- Reactive $params turn wires into live queries
- Writes are imperative + try/catch + toast + refreshApex

#### Go deeper

- [Lightning Data Service Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/lightning_data_service)
- [LWC Guide: Data Access](https://developer.salesforce.com/docs/platform/lwc/guide/data-overview.html)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Data access: wire service, LDS, and Apex matters | intro |
| 2 | 0:30–1:15 | Lightning Data Service: the free layer | concept |
| 3 | 1:15–2:00 | Wired Apex for lists and logic | concept |
| 4 | 2:00–2:45 | Code walk-through — Wired Apex for lists and logic | demo |
| 5 | 2:45–3:30 | Imperative calls and cache refresh | concept |
| 6 | 3:30–4:15 | Real story — The over-engineered account panel, refactored | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Data access: wire service, LDS, and Apex matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Data access: wire service, LDS, and Apex. The data-access decision tree: Lightning Data Service first, wired Apex second, imperative Apex when you need control. By the end of this video you will be able to use LDS adapters (getRecord, createRecord) and record forms; wire Apex methods reactively with @wire and $parameters; call Apex imperatively and handle errors + refreshApex.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Lightning Web Components

**[0:30–1:15] Lightning Data Service: the free layer**

- **Narration (word-for-word):** LDS gives CRUD on single records with a shared client-side cache and zero Apex: lightning-record-form and friends render full forms respecting FLS and layouts; @wire(getRecord, { recordId: '$recordId', fields }) streams record data into your component and keeps every LDS consumer on the page in sync after edits. If your requirement is "show/edit fields of THIS record", LDS is the answer — no controller, no test class, cache included.
- **On screen:** Animated explainer diagram for "Lightning Data Service: the free layer": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Wired Apex for lists and logic**

- **Narration (word-for-word):** For queries beyond one record, expose Apex: @AuraEnabled(cacheable=true) static methods wire into components. Reactive parameters ($searchTerm) re-invoke the wire automatically when the property changes — a search-as-you-type experience in a handful of lines. cacheable=true is required for wiring and enables client caching, but such methods cannot perform DML. Structure reads as cacheable wires and writes as separate imperative methods.
- **On screen:** Animated explainer diagram for "Wired Apex for lists and logic": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Wired Apex for lists and logic**

- **Narration (word-for-word):** Now watch the same idea in code. Reactive wire: typing updates `term`, the wire re-queries, the template re-renders. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:45–3:30] Imperative calls and cache refresh**

- **Narration (word-for-word):** Button-triggered operations and DML use imperative calls: await save({ payload }) inside try/catch, then toast the outcome (ShowToastEvent) and refresh stale wires with refreshApex(this.wiredResult) or notify LDS of record changes. Errors from Apex arrive as structured objects — build one error-normalizing utility and reuse it everywhere. Never swallow errors silently; a component that fails without feedback erodes trust in the whole app.
- **On screen:** Animated explainer diagram for "Imperative calls and cache refresh": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The over-engineered account panel, refactored**

- **Narration (word-for-word):** Here is why this matters in the real world. A consultancy delivered an account panel powered entirely by custom Apex — including plain field display. It broke FLS (fields admins hid kept showing) and required a deployment for every field change. What did they do? The refactor used lightning-record-view-form for record fields (FLS respected automatically, fields changeable by admins), kept one cacheable wired Apex method for the genuinely custom aggregation, and one imperative method for the action button. And the payoff: The FLS violation vanished without code, admins gained field-level control through Setup, and the Apex surface (and its test burden) shrank by two-thirds.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The over-engineered account panel, refactored

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Decision tree: LDS/record forms → wired cacheable Apex → imperative Apex. LDS respects FLS and layouts and shares a cache across the page. Reactive $params turn wires into live queries. Writes are imperative + try/catch + toast + refreshApex.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Data access: wire service, LDS, and Apex — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.3 — Component communication & composition

**Lesson ID:** `dev-lwc-composition` · **Reading time:** 18 min · **Video:** 5:00

> Parent-child contracts, Lightning Message Service across the page, and composition patterns that scale.

**Learning objectives**

- Design parent-child contracts with @api and events
- Use Lightning Message Service for cross-DOM communication
- Compose pages from small, single-purpose components

#### Concept explanation

##### Parent-child: properties down, events up

Parents pass data via public properties (<c-line-item item={item}>) and call public @api methods for imperative nudges (childCmp.focus()). Children never reach into parents; they dispatch CustomEvents describing what happened, not what the parent should do — onitemselect, not onupdateparentlist.

This one-way data flow keeps components reusable: a child that assumes its parent is a specific component is no longer a component, it is a fragment.

##### Lightning Message Service: across the page

Components in different DOM branches — two App Builder regions, or an LWC and a Visualforce page — cannot exchange DOM events. Lightning Message Service (LMS) provides publish/subscribe over a message channel: define the channel (XML metadata), publish({ recordId }), subscribe and react.

Use LMS for page-level coordination ("account selected in list → detail panel loads it"). Resist making it a global event bus for everything — implicit coupling through a dozen channels is jQuery-spaghetti reborn.

##### Composition as architecture

Big features decompose into a container component (owns data loading and state) and presentational children (receive props, emit events). Slots (<slot>) let consumers inject content, enabling generic card/layout components.

The test of good decomposition: can you explain each component's job in one sentence, and could a different feature reuse the child components? Jest tests (sfdx-lwc-jest) then test children with simple prop/event contracts instead of monolithic page mocks.

#### Real-world example — A console page that finally talks to itself

- **Scenario:** A service console page had a case list (one vendor's component), a knowledge panel (another team's), and a customer timeline — none aware of each other. Agents clicked a case, then manually searched the other two panels.
- **Solution:** The team defined a CaseSelected message channel; the list publishes on click, and both panels subscribe and refresh themselves. No component knows the others exist — they share only the channel contract.
- **Outcome:** Three isolated widgets became one coherent workspace; average handling time dropped, and a fourth panel (order history) plugged in a sprint later by simply subscribing to the same channel.

#### Key takeaways

- Properties down, events up — children never command parents
- Events describe what happened; parents decide what to do
- LMS connects components across DOM boundaries via message channels
- Container + presentational decomposition keeps components testable and reusable

#### Go deeper

- [LWC Guide: Communicate with Events](https://developer.salesforce.com/docs/platform/lwc/guide/events.html)
- [LWC Guide: Lightning Message Service](https://developer.salesforce.com/docs/platform/lwc/guide/use-message-channel.html)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Component communication & composition matters | intro |
| 2 | 0:30–1:30 | Parent-child: properties down, events up | concept |
| 3 | 1:30–2:30 | Lightning Message Service: across the page | concept |
| 4 | 2:30–3:30 | Composition as architecture | demo |
| 5 | 3:30–4:15 | Real story — A console page that finally talks to itself | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Component communication & composition matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Component communication & composition. Parent-child contracts, Lightning Message Service across the page, and composition patterns that scale. By the end of this video you will be able to design parent-child contracts with @api and events; use Lightning Message Service for cross-DOM communication; compose pages from small, single-purpose components.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Lightning Web Components

**[0:30–1:30] Parent-child: properties down, events up**

- **Narration (word-for-word):** Parents pass data via public properties (<c-line-item item={item}>) and call public @api methods for imperative nudges (childCmp.focus()). Children never reach into parents; they dispatch CustomEvents describing what happened, not what the parent should do — onitemselect, not onupdateparentlist. This one-way data flow keeps components reusable: a child that assumes its parent is a specific component is no longer a component, it is a fragment.
- **On screen:** Animated explainer diagram for "Parent-child: properties down, events up": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Lightning Message Service: across the page**

- **Narration (word-for-word):** Components in different DOM branches — two App Builder regions, or an LWC and a Visualforce page — cannot exchange DOM events. Lightning Message Service (LMS) provides publish/subscribe over a message channel: define the channel (XML metadata), publish({ recordId }), subscribe and react. Use LMS for page-level coordination ("account selected in list → detail panel loads it"). Resist making it a global event bus for everything — implicit coupling through a dozen channels is jQuery-spaghetti reborn.
- **On screen:** Animated explainer diagram for "Lightning Message Service: across the page": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] Composition as architecture**

- **Narration (word-for-word):** Let's actually do this together. Big features decompose into a container component (owns data loading and state) and presentational children (receive props, emit events). Slots (<slot>) let consumers inject content, enabling generic card/layout components. The test of good decomposition: can you explain each component's job in one sentence, and could a different feature reuse the child components? Jest tests (sfdx-lwc-jest) then test children with simple prop/event contracts instead of monolithic page mocks.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. The test of good decomposition: can you explain each component's job in one sentence, and could a different feature reuse the child components?
  2. Jest tests (sfdx-lwc-jest) then test children with simple prop/event contracts instead of monolithic page mocks.

**[3:30–4:15] Real story — A console page that finally talks to itself**

- **Narration (word-for-word):** Here is why this matters in the real world. A service console page had a case list (one vendor's component), a knowledge panel (another team's), and a customer timeline — none aware of each other. Agents clicked a case, then manually searched the other two panels. What did they do? The team defined a CaseSelected message channel; the list publishes on click, and both panels subscribe and refresh themselves. No component knows the others exist — they share only the channel contract.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A console page that finally talks to itself

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Properties down, events up — children never command parents. Events describe what happened; parents decide what to do. LMS connects components across DOM boundaries via message channels. Container + presentational decomposition keeps components testable and reusable.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Component communication & composition — the idea, the practice, and the real-world payoff. Head back to the Lightning Web Components module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 4: Integration & APIs

The platform's API surface, secure callouts with Named Credentials, and event-driven integration with Platform Events and CDC.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 4.1 — The API surface: REST, SOAP, Bulk, and friends

**Lesson ID:** `dev-apis` · **Reading time:** 18 min · **Video:** 5:00

> Which API for which job — and the auth, limits, and composite patterns around them.

**Learning objectives**

- Map use cases to REST, SOAP, Bulk 2.0, and Composite APIs
- Understand OAuth flows for server-to-server integration
- Respect API limits with change-detection-friendly designs

#### Concept explanation

##### Choosing the API

REST API: CRUD + query over JSON — the default for modern integrations (/services/data/vXX.X/sobjects/Account/…). SOAP: contract-first WSDL, still alive in enterprise middleware. Bulk API 2.0: asynchronous CSV jobs for millions of rows. Composite/Graph: multiple operations in one round trip, with references between subrequests — the answer to "create account, then contact, then opportunity atomically".

Metadata and Tooling APIs manage configuration rather than data (deployments, CI tooling — the machinery this platform automates). Streaming/Pub-Sub APIs push events instead of answering polls.

##### Authentication in practice

External systems authenticate via OAuth 2.0 through a Connected App. Server-to-server integrations should use the JWT Bearer flow (certificate-based, no interactive login, no password storage) or the client-credentials flow; interactive apps use the web-server flow with refresh tokens.

Give integrations dedicated integration users with minimal permission sets — "the ERP writes orders" should not run as a system administrator. API-only user licenses and login IP restrictions harden this further.

##### API limits and polite integration design

Orgs have rolling 24-hour API request allocations (edition- and license-based). Chatty designs — polling every record every minute — burn allocations and scale badly. Prefer event-driven push (Platform Events, CDC, outbound messages), delta queries on SystemModstamp, and Bulk API for volume.

Monitor consumption in Setup (API Usage) and via the limits endpoint. Integration reviews should always ask: "what happens when the remote side is down?" — queues, retries with backoff, and idempotent receivers are the difference between integration and entanglement.

#### Real-world example — The nightly sync that ate the API allocation

- **Scenario:** A data team synced 2 million records nightly by paging the REST API — 40,000 requests per run. Marketing's integration started failing at 6 am with REQUEST_LIMIT_EXCEEDED: the org's daily allocation was gone.
- **Solution:** The sync moved to Bulk API 2.0 (a handful of job-management requests instead of tens of thousands) and switched to delta extraction on SystemModstamp, shrinking most nights to a few thousand changed rows.
- **Outcome:** API consumption dropped by ~99%, the 6 am failures stopped, and the incident produced an org-wide rule: any integration moving >10k rows must justify NOT using Bulk.

#### Key takeaways

- REST for transactional CRUD, Bulk 2.0 for volume, Composite for multi-step atomicity
- Server-to-server auth = JWT bearer flow with a dedicated integration user
- Design for deltas and push, not full-table polling
- Plan for remote failure: retries, backoff, idempotency

#### Go deeper

- [API Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/api_basics)
- [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why The API surface: REST, SOAP, Bulk, and friends matters | intro |
| 2 | 0:30–1:30 | Choosing the API | demo |
| 3 | 1:30–2:30 | Authentication in practice | concept |
| 4 | 2:30–3:30 | API limits and polite integration design | concept |
| 5 | 3:30–4:15 | Real story — The nightly sync that ate the API allocation | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why The API surface: REST, SOAP, Bulk, and friends matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on The API surface: REST, SOAP, Bulk, and friends. Which API for which job — and the auth, limits, and composite patterns around them. By the end of this video you will be able to map use cases to REST, SOAP, Bulk 2.0, and Composite APIs; understand OAuth flows for server-to-server integration; respect API limits with change-detection-friendly designs.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Integration & APIs

**[0:30–1:30] Choosing the API**

- **Narration (word-for-word):** Let's actually do this together. REST API: CRUD + query over JSON — the default for modern integrations (/services/data/vXX.X/sobjects/Account/…). SOAP: contract-first WSDL, still alive in enterprise middleware. Bulk API 2.0: asynchronous CSV jobs for millions of rows. Composite/Graph: multiple operations in one round trip, with references between subrequests — the answer to "create account, then contact, then opportunity atomically". Metadata and Tooling APIs manage configuration rather than data (deployments, CI tooling — the machinery this platform automates). Streaming/Pub-Sub APIs push events instead of answering polls.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. REST API: CRUD + query over JSON — the default for modern integrations (/services/data/vXX.X/sobjects/Account/…).
  2. Composite/Graph: multiple operations in one round trip, with references between subrequests — the answer to "create account, then contact, then opportunity atomically".

**[1:30–2:30] Authentication in practice**

- **Narration (word-for-word):** External systems authenticate via OAuth 2.0 through a Connected App. Server-to-server integrations should use the JWT Bearer flow (certificate-based, no interactive login, no password storage) or the client-credentials flow; interactive apps use the web-server flow with refresh tokens. Give integrations dedicated integration users with minimal permission sets — "the ERP writes orders" should not run as a system administrator. API-only user licenses and login IP restrictions harden this further.
- **On screen:** Animated explainer diagram for "Authentication in practice": the key entities appear and connect exactly as the narration names them.

**[2:30–3:30] API limits and polite integration design**

- **Narration (word-for-word):** Orgs have rolling 24-hour API request allocations (edition- and license-based). Chatty designs — polling every record every minute — burn allocations and scale badly. Prefer event-driven push (Platform Events, CDC, outbound messages), delta queries on SystemModstamp, and Bulk API for volume. Monitor consumption in Setup (API Usage) and via the limits endpoint. Integration reviews should always ask: "what happens when the remote side is down?" — queues, retries with backoff, and idempotent receivers are the difference between integration and entanglement.
- **On screen:** Animated explainer diagram for "API limits and polite integration design": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The nightly sync that ate the API allocation**

- **Narration (word-for-word):** Here is why this matters in the real world. A data team synced 2 million records nightly by paging the REST API — 40,000 requests per run. Marketing's integration started failing at 6 am with REQUEST_LIMIT_EXCEEDED: the org's daily allocation was gone. What did they do? The sync moved to Bulk API 2.0 (a handful of job-management requests instead of tens of thousands) and switched to delta extraction on SystemModstamp, shrinking most nights to a few thousand changed rows. And the payoff: API consumption dropped by ~99%, the 6 am failures stopped, and the incident produced an org-wide rule: any integration moving >10k rows must justify NOT using Bulk.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The nightly sync that ate the API allocation

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. REST for transactional CRUD, Bulk 2.0 for volume, Composite for multi-step atomicity. Server-to-server auth = JWT bearer flow with a dedicated integration user. Design for deltas and push, not full-table polling. Plan for remote failure: retries, backoff, idempotency.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is The API surface: REST, SOAP, Bulk, and friends — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 4.2 — Callouts, Named Credentials, and resilient consumers

**Lesson ID:** `dev-callouts` · **Reading time:** 18 min · **Video:** 5:00

> Outbound HTTP done right: no hardcoded endpoints or secrets, timeouts and retries by design.

**Learning objectives**

- Make HTTP callouts from Apex with proper error handling
- Externalize endpoints and auth with Named Credentials
- Design for timeouts, retries, and testability with HttpCalloutMock

#### Concept explanation

##### The callout mechanics

HttpRequest/HttpResponse drive outbound calls: set endpoint, method, headers, body; send; branch on status code. Callouts must be registered in Remote Site Settings OR — much better — routed through a Named Credential.

Two structural rules: callouts cannot follow DML in the same transaction (async or reorder), and synchronous contexts allow 100 callouts / 120 seconds total — long-running remote calls need explicit timeouts well below that.

*callout:NamedCredential endpoints keep URLs and auth out of code entirely.*

```apex
public class ErpClient {
    public static InvoiceResult pushInvoice(Id invoiceId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:ERP_API/invoices');   // Named Credential
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(10000);
        req.setBody(JSON.serialize(InvoicePayload.from(invoiceId)));

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() >= 300) {
            throw new ErpCalloutException('ERP rejected invoice: ' + res.getStatus());
        }
        return (InvoiceResult) JSON.deserialize(res.getBody(), InvoiceResult.class);
    }
}
```

##### Named Credentials: secrets out of code

A Named Credential bundles endpoint URL + authentication (Basic, OAuth, JWT, AWS signature) as declarative metadata. Code references callout:ERP_API/path and the platform injects credentials at runtime — nothing sensitive in Apex, different values per environment without code changes, credential rotation without deployment.

Hardcoded endpoints and secrets in custom settings/labels are the legacy anti-pattern; security reviews flag them on sight. External Credentials (the newer model) separate the "where" from the "how to authenticate" for even cleaner reuse.

##### Resilience and testing

Treat every remote system as eventually unavailable: set timeouts, catch CalloutException, retry transient failures with backoff (usually via Queueable re-enqueue), and record failures somewhere actionable (error log object + notification, not a swallowed exception).

Tests cannot make real callouts: implement HttpCalloutMock returning canned responses per scenario — success, 4xx, 5xx, timeout — and assert your client's behavior for each. An untested error path is where the 2 am incident lives.

#### Real-world example — Rotating credentials without a deployment

- **Scenario:** A payments provider forced an emergency credential rotation. The org's legacy integration had the API key in a custom setting and the endpoint hardcoded across four classes — the fix needed a same-day production deployment under incident pressure.
- **Solution:** Post-incident, all callouts moved behind Named Credentials with per-environment values. The next rotation was a Setup-only change performed by an admin in minutes, with an HttpCalloutMock suite proving behavior unchanged.
- **Outcome:** Credential rotation became an operational task instead of an engineering emergency, and the security team's "no secrets in code or settings" policy finally had a clean implementation pattern.

#### Key takeaways

- callout:NamedCredential — never hardcode endpoints or secrets
- No callouts after DML; async is the standard workaround
- Timeouts + retries + logged failures = resilient consumer
- HttpCalloutMock every path, especially the failures

#### Go deeper

- [Apex Integration Services (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/apex_integration_services)
- [Named Credentials (Salesforce Help)](https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm&type=5)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Callouts, Named Credentials, and resilient consumers matters | intro |
| 2 | 0:30–1:15 | The callout mechanics | concept |
| 3 | 1:15–2:00 | Code walk-through — The callout mechanics | demo |
| 4 | 2:00–2:45 | Named Credentials: secrets out of code | concept |
| 5 | 2:45–3:30 | Resilience and testing | concept |
| 6 | 3:30–4:15 | Real story — Rotating credentials without a deployment | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Callouts, Named Credentials, and resilient consumers matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Callouts, Named Credentials, and resilient consumers. Outbound HTTP done right: no hardcoded endpoints or secrets, timeouts and retries by design. By the end of this video you will be able to make HTTP callouts from Apex with proper error handling; externalize endpoints and auth with Named Credentials; design for timeouts, retries, and testability with HttpCalloutMock.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Integration & APIs

**[0:30–1:15] The callout mechanics**

- **Narration (word-for-word):** HttpRequest/HttpResponse drive outbound calls: set endpoint, method, headers, body; send; branch on status code. Callouts must be registered in Remote Site Settings OR — much better — routed through a Named Credential. Two structural rules: callouts cannot follow DML in the same transaction (async or reorder), and synchronous contexts allow 100 callouts / 120 seconds total — long-running remote calls need explicit timeouts well below that.
- **On screen:** Animated explainer diagram for "The callout mechanics": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Code walk-through — The callout mechanics**

- **Narration (word-for-word):** Now watch the same idea in code. callout:NamedCredential endpoints keep URLs and auth out of code entirely. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the apex snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: APEX

**[2:00–2:45] Named Credentials: secrets out of code**

- **Narration (word-for-word):** A Named Credential bundles endpoint URL + authentication (Basic, OAuth, JWT, AWS signature) as declarative metadata. Code references callout:ERP_API/path and the platform injects credentials at runtime — nothing sensitive in Apex, different values per environment without code changes, credential rotation without deployment. Hardcoded endpoints and secrets in custom settings/labels are the legacy anti-pattern; security reviews flag them on sight. External Credentials (the newer model) separate the "where" from the "how to authenticate" for even cleaner reuse.
- **On screen:** Animated explainer diagram for "Named Credentials: secrets out of code": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Resilience and testing**

- **Narration (word-for-word):** Treat every remote system as eventually unavailable: set timeouts, catch CalloutException, retry transient failures with backoff (usually via Queueable re-enqueue), and record failures somewhere actionable (error log object + notification, not a swallowed exception). Tests cannot make real callouts: implement HttpCalloutMock returning canned responses per scenario — success, 4xx, 5xx, timeout — and assert your client's behavior for each. An untested error path is where the 2 am incident lives.
- **On screen:** Animated explainer diagram for "Resilience and testing": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Rotating credentials without a deployment**

- **Narration (word-for-word):** Here is why this matters in the real world. A payments provider forced an emergency credential rotation. The org's legacy integration had the API key in a custom setting and the endpoint hardcoded across four classes — the fix needed a same-day production deployment under incident pressure. What did they do? Post-incident, all callouts moved behind Named Credentials with per-environment values. The next rotation was a Setup-only change performed by an admin in minutes, with an HttpCalloutMock suite proving behavior unchanged.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Rotating credentials without a deployment

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. callout:NamedCredential — never hardcode endpoints or secrets. No callouts after DML; async is the standard workaround. Timeouts + retries + logged failures = resilient consumer. HttpCalloutMock every path, especially the failures.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Callouts, Named Credentials, and resilient consumers — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 4.3 — Platform Events & Change Data Capture

**Lesson ID:** `dev-events` · **Reading time:** 18 min · **Video:** 5:00

> Event-driven architecture on-platform: custom events, CDC streams, and the decoupling they buy.

**Learning objectives**

- Define and publish Platform Events from Apex, Flow, and APIs
- Subscribe via triggers, flows, and external CometD/Pub-Sub clients
- Choose between Platform Events and Change Data Capture

#### Concept explanation

##### Platform Events: the org's message bus

A Platform Event is a custom-defined message (Order_Placed__e with fields) published to the event bus rather than saved as data. Publishers — Apex (EventBus.publish), Flows, REST — fire and continue; subscribers — Apex triggers on the event, flows, external clients — process asynchronously.

The decoupling is the point: the order-taking code neither knows nor cares that fulfillment, analytics, AND a webhook forwarder all react. Adding a fourth consumer requires zero changes to publishers.

##### Change Data Capture: the record change stream

CDC publishes standardized change events (AccountChangeEvent) for every create/update/delete/undelete on enabled objects — no custom publishing code. External systems subscribe (Pub/Sub API is the modern gRPC-based client) and replicate changes into caches, warehouses, or search indexes near-real-time.

Choose CDC when the message IS "this record changed" — data sync. Choose Platform Events when the message is a business FACT ("order placed", "fraud suspected") that may not map 1:1 to any record write.

##### Operating an event-driven org

Events are retained on the bus (72 hours for standard-volume) and consumers resume from a replay ID after disconnection — design consumers idempotent because redelivery is possible. Publish-behavior matters in Apex: "publish after commit" (default, safe) vs "publish immediately".

Mind the allocations (publish and delivery limits per 24h), monitor subscriptions (EventBusSubscriber), and resist eventifying everything: request-reply questions ("what is this account's credit score right now?") are still callouts, not events.

#### Real-world example — Decoupling order fulfillment from order capture

- **Scenario:** Order capture called the warehouse system synchronously during save. Warehouse maintenance windows made SALESFORCE saves fail; a slow warehouse API made every rep's save slow. Two systems, one fate.
- **Solution:** Order capture now publishes Order_Placed__e after commit. The warehouse integration subscribes via Pub/Sub API with replay-based resume; a subscriber flow also tasks the account team for large orders. During warehouse downtime, events simply queue on the bus.
- **Outcome:** Saves became instant and immune to warehouse health, missed events during a later outage replayed automatically from the last replay ID, and analytics added their own subscriber a month later without touching order code.

#### Key takeaways

- Platform Events = business facts on a bus; CDC = record-change stream
- Publishers and subscribers evolve independently — that is the payoff
- Consumers must be idempotent; replay IDs cover disconnection windows
- Not everything is an event: request-reply questions remain callouts

#### Go deeper

- [Platform Events Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/platform_events_basics)
- [Change Data Capture Basics (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/change-data-capture)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 7

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Platform Events & Change Data Capture matters | intro |
| 2 | 0:30–1:30 | Platform Events: the org's message bus | concept |
| 3 | 1:30–2:30 | Change Data Capture: the record change stream | demo |
| 4 | 2:30–3:30 | Operating an event-driven org | concept |
| 5 | 3:30–4:15 | Real story — Decoupling order fulfillment from order capture | story |
| 6 | 4:15–4:45 | Recap — lock it in | recap |
| 7 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Platform Events & Change Data Capture matters**

- **Narration (word-for-word):** Welcome to Platform Developer Track, and this five-minute session on Platform Events & Change Data Capture. Event-driven architecture on-platform: custom events, CDC streams, and the decoupling they buy. By the end of this video you will be able to define and publish Platform Events from Apex, Flow, and APIs; subscribe via triggers, flows, and external CometD/Pub-Sub clients; choose between Platform Events and Change Data Capture.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Platform Developer Track · Integration & APIs

**[0:30–1:30] Platform Events: the org's message bus**

- **Narration (word-for-word):** A Platform Event is a custom-defined message (Order_Placed__e with fields) published to the event bus rather than saved as data. Publishers — Apex (EventBus.publish), Flows, REST — fire and continue; subscribers — Apex triggers on the event, flows, external clients — process asynchronously. The decoupling is the point: the order-taking code neither knows nor cares that fulfillment, analytics, AND a webhook forwarder all react. Adding a fourth consumer requires zero changes to publishers.
- **On screen:** Animated explainer diagram for "Platform Events: the org's message bus": the key entities appear and connect exactly as the narration names them.

**[1:30–2:30] Change Data Capture: the record change stream**

- **Narration (word-for-word):** Let's actually do this together. CDC publishes standardized change events (AccountChangeEvent) for every create/update/delete/undelete on enabled objects — no custom publishing code. External systems subscribe (Pub/Sub API is the modern gRPC-based client) and replicate changes into caches, warehouses, or search indexes near-real-time. Choose CDC when the message IS "this record changed" — data sync. Choose Platform Events when the message is a business FACT ("order placed", "fraud suspected") that may not map 1:1 to any record write.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Choose CDC when the message IS "this record changed" — data sync.
  2. Choose Platform Events when the message is a business FACT ("order placed", "fraud suspected") that may not map 1:1 to any record write.

**[2:30–3:30] Operating an event-driven org**

- **Narration (word-for-word):** Events are retained on the bus (72 hours for standard-volume) and consumers resume from a replay ID after disconnection — design consumers idempotent because redelivery is possible. Publish-behavior matters in Apex: "publish after commit" (default, safe) vs "publish immediately". Mind the allocations (publish and delivery limits per 24h), monitor subscriptions (EventBusSubscriber), and resist eventifying everything: request-reply questions ("what is this account's credit score right now?") are still callouts, not events.
- **On screen:** Animated explainer diagram for "Operating an event-driven org": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Decoupling order fulfillment from order capture**

- **Narration (word-for-word):** Here is why this matters in the real world. Order capture called the warehouse system synchronously during save. Warehouse maintenance windows made SALESFORCE saves fail; a slow warehouse API made every rep's save slow. Two systems, one fate. What did they do? Order capture now publishes Order_Placed__e after commit. The warehouse integration subscribes via Pub/Sub API with replay-based resume; a subscriber flow also tasks the account team for large orders. During warehouse downtime, events simply queue on the bus.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Decoupling order fulfillment from order capture

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Platform Events = business facts on a bus; CDC = record-change stream. Publishers and subscribers evolve independently — that is the payoff. Consumers must be idempotent; replay IDs cover disconnection windows. Not everything is an event: request-reply questions remain callouts.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Platform Events & Change Data Capture — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
