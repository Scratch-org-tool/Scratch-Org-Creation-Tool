import type { CurriculumPath } from './curriculum.types';

/**
 * Path 3 — Platform Developer Track (Advanced).
 * Apex, SOQL, testing, async processing, LWC, and integration — with the
 * bulkification and limits mindset that separates platform developers from
 * Java/C# developers writing Java/C# in Apex syntax.
 */
export const developerPath: CurriculumPath = {
  id: 'sf-developer',
  title: 'Platform Developer Track',
  tagline: 'Apex, LWC, and integrations — engineered for governor limits.',
  description:
    'Learn to build on the platform the way it was designed to be used: bulkified Apex with real test coverage, Lightning Web Components on Lightning Data Service, and integrations that pick the right API for the job. Every lesson bakes in the limits-first mindset that production orgs demand.',
  category: 'salesforce',
  level: 'advanced',
  badge: 'Platform Developer',
  estimatedHours: 14,
  skills: [
    'Apex & triggers',
    'SOQL/SOSL',
    'Unit testing',
    'Asynchronous Apex',
    'Lightning Web Components',
    'APIs & integration',
  ],
  modules: [
    {
      id: 'sf-dev-apex',
      title: 'Apex Fundamentals & Triggers',
      summary:
        'The language, the query languages, the trigger framework pattern, and the governor limits that shape all of it.',
      lessons: [
        {
          id: 'dev-apex-language',
          title: 'Apex language essentials',
          summary:
            'Classes, collections, and sObjects — Apex through the eyes of the multi-tenant runtime it lives in.',
          durationMinutes: 20,
          objectives: [
            'Write Apex classes with proper collection usage',
            'Work with sObjects statically and dynamically',
            'Understand transactions and execution contexts',
          ],
          sections: [
            {
              heading: 'A Java-like language with a database built in',
              body:
                'Apex is strongly typed and object-oriented — classes, interfaces, inheritance — with database records (sObjects) and queries as first-class citizens. Account acc = new Account(Name=\'Acme\'); insert acc; is a complete, transactional persistence operation.\n\nApex executes server-side in an execution context that begins with an entry point (trigger, web request, batch chunk, anonymous script) and ends with commit or rollback. All limits — queries, DML, CPU — are measured per execution context.',
              code: {
                language: 'apex',
                snippet:
                  'public with sharing class AccountService {\n    public static void tagStrategicAccounts(List<Account> accounts) {\n        for (Account acc : accounts) {\n            if (acc.AnnualRevenue != null && acc.AnnualRevenue > 10_000_000) {\n                acc.Segment__c = \'Strategic\';\n            }\n        }\n    }\n}',
                caption: 'A service class: with sharing enforces record access; logic stays out of the trigger.',
              },
            },
            {
              heading: 'Collections: List, Set, Map',
              body:
                'The three collections carry nearly all Apex logic. Lists hold ordered records; Sets deduplicate (perfect for Ids); Maps index by key. Map<Id, Account> accountsById = new Map<Id, Account>([SELECT Id, Name FROM Account WHERE Id IN :accountIds]); is the single most useful idiom in the language — one query, indexed lookups afterward.\n\nMastering the "collect Ids → query once into a Map → loop with lookups" pattern is 80% of writing bulk-safe code.',
            },
            {
              heading: 'sObjects, statically and dynamically',
              body:
                'Static references (Account.Name) are compile-checked — prefer them. The dynamic API (Schema.getGlobalDescribe(), sObject.get(\'Field__c\')) enables generic frameworks that operate on any object, at the cost of runtime-only error discovery.\n\nsObjects returned by queries only contain the fields you selected; touching an unqueried field throws. That error message — "SObject row was retrieved via SOQL without querying the requested field" — will greet every new Apex developer at least once.',
            },
          ],
          realWorld: {
            title: 'The 101-query lesson',
            scenario:
              'A new developer wrote account-scoring logic that queried each account\'s contacts inside a loop. It sailed through single-record testing, then a 200-record data load hit "Too many SOQL queries: 101" and blocked the entire migration.',
            solution:
              'The fix was the canonical pattern: collect the account Ids, run ONE query for all related contacts grouped into a Map<Id, List<Contact>>, then loop with in-memory lookups.',
            outcome:
              'The load ran with 2 queries instead of 200+, and the developer internalized the rule that shapes all Apex: your code always runs against collections, never single records.',
          },
          keyTakeaways: [
            'Apex is transactional: an execution context commits or rolls back as a unit',
            'Map<Id, sObject> built from a single query is the core bulk pattern',
            'Queried sObjects only carry selected fields',
            'with sharing / without sharing decides whether record access applies to your class',
          ],
          resources: [
            {
              title: 'Apex Basics & Database (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_database',
              source: 'trailhead',
            },
            {
              title: 'Apex Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'dev-soql-sosl',
          title: 'SOQL & SOSL: querying like a pro',
          summary:
            'Relationship queries, aggregates, selective filters — and when full-text SOSL beats SOQL.',
          durationMinutes: 20,
          objectives: [
            'Write parent-to-child and child-to-parent SOQL',
            'Use aggregate functions, GROUP BY, and bind variables',
            'Understand selectivity and choose SOSL when text search is the job',
          ],
          sections: [
            {
              heading: 'Relationship queries',
              body:
                'Child-to-parent walks lookups with dot notation: SELECT Name, Account.Owner.Name FROM Contact. Parent-to-child nests a subquery: SELECT Name, (SELECT LastName FROM Contacts) FROM Account — note the child RELATIONSHIP name (Contacts, or Custom_Objects__r for custom).\n\nOne well-shaped relationship query frequently replaces two queries plus manual stitching — fewer limits consumed, less code to test.',
              code: {
                language: 'sql',
                snippet:
                  'SELECT Id, Name,\n       (SELECT Id, Amount, StageName FROM Opportunities WHERE IsClosed = false)\nFROM Account\nWHERE Industry = :industry AND LastActivityDate >= :cutoff\nORDER BY Name\nLIMIT 200',
                caption: 'Parent-to-child subquery with bind variables — one round trip for accounts and their open deals.',
              },
            },
            {
              heading: 'Aggregates and bind variables',
              body:
                'COUNT(), SUM(), AVG(), MIN(), MAX() with GROUP BY return AggregateResult rows: SELECT StageName, SUM(Amount) total FROM Opportunity GROUP BY StageName. HAVING filters groups.\n\nBind variables (WHERE Id IN :accountIds) are non-negotiable: they prevent SOQL injection and let the platform cache query plans. String-concatenated dynamic SOQL with user input is the classic security-review failure.',
            },
            {
              heading: 'Selectivity and SOSL',
              body:
                'On large tables, the optimizer needs a selective filter — an indexed field (Id, Name, external IDs, lookup fields, unique fields) that narrows rows below thresholds. Filters on unindexed checkboxes or NOT-conditions over millions of rows time out. The Query Plan tool in Developer Console reveals what the optimizer will do.\n\nSOSL is the other language: FIND {"acme corp"} IN ALL FIELDS RETURNING Account(Name), Contact(Name) searches the full-text index across objects at once. User-typed search box → SOSL; precise filtered retrieval → SOQL.',
            },
          ],
          realWorld: {
            title: 'The report that timed out',
            scenario:
              'A nightly Apex job filtered 8 million task records with WHERE Is_Processed__c = false (an unindexed checkbox). As data grew, the query started timing out, silently killing the job.',
            solution:
              'The team replaced the checkbox filter with an indexed Status_External__c external-ID field populated on creation, verified selectivity with Query Plan, and added a fallback batch path for backfill.',
            outcome:
              'Query time fell from timeout to milliseconds. The incident review added "selectivity check for any query on objects > 1M rows" to the team\'s definition of done.',
          },
          keyTakeaways: [
            'Dot notation up, subqueries down — learn both directions cold',
            'Always use bind variables; never concatenate user input into SOQL',
            'Large-object queries need selective, indexed filters — verify with Query Plan',
            'SOSL for fuzzy multi-object text search; SOQL for structured retrieval',
          ],
          resources: [
            {
              title: 'SOQL and SOSL Reference',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_sosl_intro.htm',
              source: 'developer',
            },
            {
              title: 'Apex Basics & Database (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_database',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'dev-triggers',
          title: 'Triggers done right: one trigger, a handler, bulk always',
          summary:
            'Trigger events, context variables, and the handler-class architecture that keeps orgs maintainable.',
          durationMinutes: 22,
          objectives: [
            'Use trigger context variables (new, old, newMap, oldMap) correctly',
            'Apply the one-trigger-per-object handler pattern',
            'Prevent recursion and coordinate with declarative automation',
          ],
          sections: [
            {
              heading: 'Events and context variables',
              body:
                'Triggers fire before/after insert, update, delete, and after undelete. Before-triggers mutate Trigger.new directly (no extra DML); after-triggers see committed values (Ids exist) and handle related-record work.\n\nTrigger.new/newMap hold incoming state; Trigger.old/oldMap hold prior state on updates/deletes. Change detection is the bread-and-butter: newRecord.StageName != Trigger.oldMap.get(newRecord.Id).StageName.',
              code: {
                language: 'apex',
                snippet:
                  'trigger OpportunityTrigger on Opportunity (before insert, before update, after update) {\n    OpportunityTriggerHandler.run();\n}\n\npublic class OpportunityTriggerHandler {\n    public static void run() {\n        if (Trigger.isBefore && Trigger.isUpdate) {\n            stampStageChange((List<Opportunity>) Trigger.new,\n                             (Map<Id, Opportunity>) Trigger.oldMap);\n        }\n    }\n    private static void stampStageChange(List<Opportunity> opps, Map<Id, Opportunity> oldMap) {\n        for (Opportunity opp : opps) {\n            if (opp.StageName != oldMap.get(opp.Id).StageName) {\n                opp.Stage_Changed_On__c = System.today();\n            }\n        }\n    }\n}',
                caption: 'One thin trigger delegating to a handler — logic testable without the trigger firing.',
              },
            },
            {
              heading: 'The handler pattern',
              body:
                'Production rule: ONE trigger per object, containing no logic — it delegates to a handler class routed by event. Why: multiple triggers on one object fire in undefined order, and logic in trigger bodies cannot be unit-tested in isolation or reused.\n\nHandlers also centralize recursion control (a static "already ran" flag or processed-Id set) and bypass switches (custom permission or hierarchy custom setting) — the levers you desperately want during data migrations and incident response.',
            },
            {
              heading: 'Living with flows',
              body:
                'Triggers and record-triggered flows coexist in the same save: before-save flows → before triggers → after triggers → after-save flows (within the broader order of execution). Same-object field logic split across a flow AND a before-trigger is where "who overwrote my field?" mysteries are born.\n\nTeams need an explicit convention — for example: declarative-first for simple same-record updates, Apex for complex cross-object logic, and NEVER both patterns for the same field. Document the split; the order of execution will not forgive ambiguity.',
            },
          ],
          realWorld: {
            title: 'Untangling three triggers on Account',
            scenario:
              'An org accreted three Account triggers from different eras. A field set by trigger A was overwritten by trigger C — but only sometimes, because relative firing order between triggers is not guaranteed. Support tickets called it "the ghost".',
            solution:
              'The team consolidated into one AccountTrigger + handler with explicit method ordering, added a recursion guard, and wrote regression tests asserting the end-state of the contested field for each scenario.',
            outcome:
              'The ghost died immediately. Six months later the same handler structure made adding a new requirement a 30-line, fully tested change instead of a fourth trigger.',
          },
          keyTakeaways: [
            'Before-triggers mutate Trigger.new free of DML; after-triggers do related-record work',
            'One trigger per object; all logic in a testable handler',
            'Build recursion guards and bypass switches in from day one',
            'Agree team conventions for trigger-vs-flow responsibilities per object',
          ],
          resources: [
            {
              title: 'Apex Triggers (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_triggers',
              source: 'trailhead',
            },
            {
              title: 'Triggers and Order of Execution (Apex Guide)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_triggers_order_of_execution.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'dev-governor-limits',
          title: 'Governor limits: the physics of the platform',
          summary:
            'Why limits exist, the numbers that matter, and the design patterns that keep you far away from them.',
          durationMinutes: 18,
          objectives: [
            'Explain multi-tenancy as the reason limits exist',
            'Memorize the headline synchronous limits',
            'Apply bulkification and limit-aware design patterns',
          ],
          sections: [
            {
              heading: 'Why limits exist',
              body:
                'Your Apex shares hardware with thousands of other tenants. Governor limits are the contract that stops one tenant\'s runaway loop from degrading everyone else — not an inconvenience but the reason the platform can promise consistent performance without you managing servers.\n\nLimits are per execution context and most differ between synchronous and asynchronous execution. Exceeding one throws an uncatchable LimitException: the transaction dies, full stop.',
            },
            {
              heading: 'The numbers that matter',
              body:
                'Synchronous headline limits: 100 SOQL queries, 150 DML statements, 10,000 rows retrieved, 10,000 rows of DML, 10 seconds CPU, 6 MB heap, 100 callouts (120s total). Asynchronous contexts get 200 SOQL, 60 seconds CPU, 12 MB heap.\n\nYou do not memorize all limits — you memorize these, and you instrument code with Limits.getQueries(), Limits.getCpuTime() when operating near the edge. Debug logs print a limit usage summary per context: read it.',
            },
            {
              heading: 'Design patterns that respect the physics',
              body:
                'Bulkification: no SOQL or DML inside loops, ever — collect, query once, mutate in memory, write once. Selective queries with WHERE and LIMIT rather than filtering in Apex. Move heavy work async (Queueable, Batch) where limits are roomier. Cache describes and configuration in static variables (free within a context).\n\nWhen approaching row limits by design (millions of records), the answer is architecture, not optimization: Batch Apex chunks, platform events for decoupling, or pushing aggregation to the database via roll-ups and reports.',
            },
          ],
          realWorld: {
            title: 'CPU timeout at quarter close',
            scenario:
              'A pricing recalculation trigger comfortably handled daily edits. At quarter close, ops mass-updated 50,000 opportunity lines; batches of 200 hit the 10-second CPU limit deep inside nested loops nobody had profiled.',
            solution:
              'Profiling with Limits.getCpuTime() found an O(n²) inner loop matching lines to price rules. A Map-based index made it O(n); the recalculation also moved to a Queueable for updates above a size threshold.',
            outcome:
              'CPU per batch dropped from ~9,800 ms to under 900 ms. The team added a load test at 10× daily volume to CI — the class of bug that only appears at scale now surfaces before release.',
          },
          keyTakeaways: [
            'Limits are the multi-tenant contract; LimitException is uncatchable',
            'Know the headline numbers: 100 queries / 150 DML / 10k rows / 10s CPU sync',
            'Bulkify always; profile with Limits methods and the debug log summary',
            'Near the ceiling by design? Change architecture (async/batch), not micro-optimize',
          ],
          resources: [
            {
              title: 'Execution Governors and Limits (Apex Guide)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm',
              source: 'developer',
            },
            {
              title: 'Apex Basics & Database (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_database',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-dev-apex-1',
          topic: 'Bulkification',
          prompt: 'Why must SOQL never appear inside a loop over trigger records?',
          options: [
            'It is a style preference',
            'With up to 200 records per trigger invocation, per-record queries blow the 100-query limit',
            'SOQL in loops returns stale data',
            'Loops cannot contain method calls',
          ],
          correctIndex: 1,
          explanation:
            'Triggers process batches. Per-record queries multiply by batch size and exceed limits — collect Ids, query once.',
        },
        {
          id: 'q-dev-apex-2',
          topic: 'Collections',
          prompt: 'Which idiom retrieves many accounts and enables O(1) lookup by Id?',
          options: [
            'List<Account> accs = [SELECT Id FROM Account];',
            'Map<Id, Account> byId = new Map<Id, Account>([SELECT Id, Name FROM Account WHERE Id IN :ids]);',
            'Set<Account> accs = new Set<Account>();',
            'A nested for loop',
          ],
          correctIndex: 1,
          explanation:
            'Constructing a Map<Id, sObject> directly from a query is the canonical single-query, indexed-lookup pattern.',
        },
        {
          id: 'q-dev-apex-3',
          topic: 'SOQL',
          prompt: 'SELECT Name, (SELECT LastName FROM Contacts) FROM Account is an example of…',
          options: [
            'Child-to-parent dot notation',
            'A parent-to-child relationship subquery',
            'An aggregate query',
            'SOSL',
          ],
          correctIndex: 1,
          explanation:
            'The nested SELECT over the child relationship name retrieves children with their parents in one query.',
        },
        {
          id: 'q-dev-apex-4',
          topic: 'SOQL security',
          prompt: 'Bind variables (WHERE Email = :userInput) matter because they…',
          options: [
            'Run faster than literals in all cases',
            'Prevent SOQL injection by treating input as data, not query text',
            'Bypass sharing rules',
            'Are required for LIMIT clauses',
          ],
          correctIndex: 1,
          explanation:
            'Binds separate code from data — the platform never parses user input as query syntax.',
        },
        {
          id: 'q-dev-apex-5',
          topic: 'SOSL',
          prompt: 'A global search box where users type free text across Accounts, Contacts, and Cases should use…',
          options: ['Three SOQL queries with LIKE', 'SOSL', 'A roll-up summary', 'Database.query in a loop'],
          correctIndex: 1,
          explanation:
            'SOSL searches the full-text index across multiple objects in one operation — built for exactly this.',
        },
        {
          id: 'q-dev-apex-6',
          topic: 'Triggers',
          prompt: 'Which context variable pair detects that a field CHANGED during an update?',
          options: [
            'Trigger.isInsert and Trigger.size',
            'Trigger.new compared against Trigger.oldMap',
            'Trigger.isBefore and Trigger.isAfter',
            'Limits.getDmlRows and Limits.getQueries',
          ],
          correctIndex: 1,
          explanation:
            'Compare each new record with oldMap.get(record.Id) to detect transitions like stage changes.',
        },
        {
          id: 'q-dev-apex-7',
          topic: 'Trigger architecture',
          prompt: 'Why one trigger per object?',
          options: [
            'Salesforce charges per trigger',
            'Multiple triggers on one object have no guaranteed firing order',
            'Two triggers cannot share fields',
            'Deployment tools reject extras',
          ],
          correctIndex: 1,
          explanation:
            'Undefined relative order between triggers creates unreproducible bugs; one trigger + handler restores determinism.',
        },
        {
          id: 'q-dev-apex-8',
          topic: 'Before vs after',
          prompt: 'Updating a field ON the triggering records with no extra DML requires…',
          options: [
            'An after-insert trigger with update DML',
            'A before trigger mutating Trigger.new',
            'A future method',
            'A scheduled flow',
          ],
          correctIndex: 1,
          explanation:
            'Before-triggers modify in-flight records directly; the save writes your changes with the record.',
        },
        {
          id: 'q-dev-apex-9',
          topic: 'Limits',
          prompt: 'The synchronous per-transaction limits are…',
          options: [
            'Unlimited on Unlimited Edition',
            '100 SOQL queries and 150 DML statements',
            '10 SOQL queries and 15 DML statements',
            '1,000 of each',
          ],
          correctIndex: 1,
          explanation:
            'The headline synchronous numbers: 100 queries, 150 DML, 10k rows, 10s CPU — burn them into memory.',
        },
        {
          id: 'q-dev-apex-10',
          topic: 'Limits',
          prompt: 'What happens when Apex exceeds a governor limit?',
          options: [
            'The platform queues the excess for later',
            'An uncatchable LimitException kills the transaction',
            'A warning email is sent and execution continues',
            'Only the current loop iteration fails',
          ],
          correctIndex: 1,
          explanation:
            'LimitException cannot be caught — design and bulkify so you never approach it.',
        },
      ],
    },
    {
      id: 'sf-dev-testing-async',
      title: 'Testing & Asynchronous Apex',
      summary:
        'Unit tests that earn their coverage, and the async toolbox: future, Queueable, Batch, and Scheduled Apex.',
      lessons: [
        {
          id: 'dev-apex-testing',
          title: 'Apex unit testing that actually tests',
          summary:
            'Test data factories, assertions with meaning, Test.startTest, and testing as a design tool — beyond the 75% number.',
          durationMinutes: 20,
          objectives: [
            'Structure tests with @isTest, test data factories, and System.runAs',
            'Use Test.startTest/stopTest for limits isolation and async execution',
            'Write assertions that verify behavior, not just coverage',
          ],
          sections: [
            {
              heading: 'The rules of the arena',
              body:
                'Test methods live in @isTest classes, see no org data by default (@isTest(SeeAllData=true) is a legacy escape hatch to avoid), and never commit. Production deployments require 75% aggregate coverage with all tests passing — but treat 75% as a floor the platform enforces, not a goal.\n\nEvery test builds its own world: a TestDataFactory class centralizes record creation so a new validation rule breaks ONE factory method, not 200 tests.',
              code: {
                language: 'apex',
                snippet:
                  '@isTest\nprivate class OpportunityHandlerTest {\n    @TestSetup\n    static void makeData() {\n        insert TestDataFactory.accounts(5);\n    }\n\n    @isTest\n    static void stampsDateWhenStageChanges() {\n        Opportunity opp = TestDataFactory.oppForFirstAccount(\'Prospecting\');\n        insert opp;\n\n        Test.startTest();\n        opp.StageName = \'Closed Won\';\n        update opp;\n        Test.stopTest();\n\n        opp = [SELECT Stage_Changed_On__c FROM Opportunity WHERE Id = :opp.Id];\n        Assert.areEqual(System.today(), opp.Stage_Changed_On__c,\n            \'Stage change must stamp the change date\');\n    }\n}',
                caption: '@TestSetup data, startTest/stopTest isolation, and an assertion with a reason message.',
              },
            },
            {
              heading: 'startTest, stopTest, and runAs',
              body:
                'Test.startTest() resets governor limits for the code under test — your setup queries stop polluting the measurement. Test.stopTest() forces queued asynchronous work (future, Queueable, Batch) to execute synchronously, so you can assert on async results deterministically.\n\nSystem.runAs(user) tests behavior under a real profile/permission profile — the only way to prove your with sharing code actually restricts access. Permission bugs found by runAs tests are dramatically cheaper than the same bugs found by auditors.',
            },
            {
              heading: 'Coverage is a byproduct',
              body:
                'A test that calls a method and asserts nothing achieves coverage and proves nothing. Good tests assert outcomes: field values after the operation, records created, errors thrown for bad input (try/catch + Assert.fail pattern), and behavior at bulk scale — insert 200 records, not 1.\n\nName tests for the behavior they pin: stampsDateWhenStageChanges, blocksDiscountAboveTwentyPercentForReps. A failing test name should read as a bug report.',
            },
          ],
          realWorld: {
            title: 'The refactor nobody feared',
            scenario:
              'A team needed to replace a 900-line legacy pricing class. Coverage was 82% — but almost entirely assertion-free "coverage tests", so nobody could tell whether a rewrite broke real behavior.',
            solution:
              'Before refactoring, they wrote thirty behavior tests capturing current pricing outcomes for representative scenarios (bulk included), reviewed the odd results with finance (two were latent bugs!), then rewrote the class against that safety net.',
            outcome:
              'The rewrite shipped with zero pricing regressions, two pre-existing bugs fixed, and the team\'s definition of done changed to require assertion-based tests — coverage became a byproduct.',
          },
          keyTakeaways: [
            'Tests see no org data; factories centralize test record creation',
            'startTest resets limits; stopTest flushes async work for assertion',
            'runAs proves security behavior under real profiles',
            'Assert outcomes at bulk scale; 75% is a floor, not a target',
          ],
          resources: [
            {
              title: 'Apex Testing (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_testing',
              source: 'trailhead',
            },
            {
              title: 'Testing Best Practices (Apex Guide)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_testing_best_practices.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'dev-async-apex',
          title: 'Asynchronous Apex: future, Queueable, Batch, Scheduled',
          summary:
            'The four async tools, what each is for, and how to chain work across limit boundaries.',
          durationMinutes: 22,
          objectives: [
            'Choose the right async tool per use case',
            'Implement Queueable chaining and Batch Apex correctly',
            'Schedule recurring work and monitor async health',
          ],
          sections: [
            {
              heading: 'future and Queueable',
              body:
                '@future methods are fire-and-forget with primitive-only parameters — historically used for callouts after DML (callouts cannot follow uncommitted DML in one transaction). Queueable is the modern superset: object parameters, a job Id for monitoring, and chaining — one Queueable can enqueue the next.\n\nDefault to Queueable; reserve @future for the rare trivial case. Both run with async limits (200 SOQL, 60s CPU, 12MB heap).',
              code: {
                language: 'apex',
                snippet:
                  'public class SyncInvoiceJob implements Queueable, Database.AllowsCallouts {\n    private final List<Id> invoiceIds;\n    public SyncInvoiceJob(List<Id> invoiceIds) { this.invoiceIds = invoiceIds; }\n\n    public void execute(QueueableContext ctx) {\n        List<Id> batch = take(invoiceIds, 50);\n        ErpClient.pushInvoices(batch);          // callout allowed here\n        List<Id> remaining = rest(invoiceIds, 50);\n        if (!remaining.isEmpty()) {\n            System.enqueueJob(new SyncInvoiceJob(remaining)); // chain\n        }\n    }\n}',
                caption: 'A chained Queueable with callouts — each link processes a slice within its own limits.',
              },
            },
            {
              heading: 'Batch Apex: the heavy hauler',
              body:
                'Database.Batchable<sObject> splits huge datasets into chunks (default 200, configurable) with three phases: start (returns a QueryLocator over up to 50 MILLION rows), execute (per chunk, fresh limits each time), finish (post-processing, notifications, chaining the next job).\n\nBatch is for data-volume work: nightly recalculations, archival, mass cleanups. Make execute idempotent — chunks can retry — and use Database.Stateful only when you genuinely need cross-chunk state (it serializes the instance between chunks and costs performance).',
            },
            {
              heading: 'Scheduled Apex and operational monitoring',
              body:
                'Schedulable classes run on cron expressions — System.schedule(\'Nightly recalc\', \'0 0 2 * * ?\', new RecalcScheduler()); typically the scheduler just launches a Batch or Queueable so logic stays testable.\n\nOperations matter as much as code: the Apex Jobs page and AsyncApexJob object show statuses and failures; flex queue holds up to 100 waiting batches; scheduled classes LOCK — you cannot edit a class referenced by an active schedule, a famous deployment gotcha. Monitor failures actively: async errors don\'t interrupt any user, which means nobody notices until the data is stale.',
            },
          ],
          realWorld: {
            title: 'Nightly territory recalculation',
            scenario:
              'Account territory assignment depended on rules across 3 million accounts. A synchronous approach was impossible (row limits), and a naive @future fan-out created thousands of uncoordinated jobs with no visibility.',
            solution:
              'A Scheduled class kicks off a Batch at 2 am (scope 2,000). execute() recalculates each chunk idempotently; finish() emails a summary and enqueues a Queueable that syncs changes to the data warehouse via callouts.',
            outcome:
              'The full recalculation completes in ninety minutes with per-chunk retry safety, one dashboard shows job health, and failed nights page the on-call admin instead of being discovered by sales ops a week later.',
          },
          keyTakeaways: [
            'Queueable > @future: objects, job Ids, chaining',
            'Batch for millions of rows; fresh limits per chunk; keep execute idempotent',
            'Scheduled Apex should delegate to Batch/Queueable, not hold logic',
            'Monitor AsyncApexJob — silent async failure is the default failure mode',
          ],
          resources: [
            {
              title: 'Asynchronous Apex (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/asynchronous_apex',
              source: 'trailhead',
            },
            {
              title: 'Batch Apex (Apex Guide)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_batch_interface.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'dev-debugging',
          title: 'Debugging: logs, checkpoints, and a method',
          summary:
            'Debug levels, reading the log like a detective, and a reproducible debugging workflow with VS Code.',
          durationMinutes: 15,
          objectives: [
            'Set trace flags and interpret debug log sections',
            'Profile limit consumption from log summaries',
            'Debug systematically instead of System.debug-scattering',
          ],
          sections: [
            {
              heading: 'Trace flags and levels',
              body:
                'A trace flag (user + time window + debug level) makes the platform emit logs for that user\'s transactions. Levels per category (Apex, Database, Workflow, Validation…) tune verbosity; FINEST Apex logging includes every statement but truncates sooner — logs cap at 20 MB.\n\nLog into the problem user\'s context (or trace THAT user): most "works for me" bugs are visibility or automation differences between users, and the log of the right user says so immediately.',
            },
            {
              heading: 'Reading a log',
              body:
                'A debug log is the transaction\'s biography: CODE_UNIT_STARTED blocks show what ran (triggers, flows, validations) in exact order; SOQL_EXECUTE lines show queries with row counts; DML_BEGIN shows writes; the LIMIT_USAGE summary at the end shows consumption per namespace.\n\nTwo high-value habits: search for EXCEPTION_THROWN first, and read the execution order of CODE_UNIT blocks when fields change "mysteriously" — the log IS the order of execution, observed.',
            },
            {
              heading: 'A reproducible workflow',
              body:
                'The professional loop: reproduce minimally (Execute Anonymous with a hardcoded record), trace with targeted levels, locate with the log timeline, fix, then encode the reproduction as a unit test so the bug stays dead.\n\nVS Code with the Salesforce extensions supports Apex Replay Debugger — stepping through a captured log with variable inspection — which beats twenty rounds of System.debug archaeology for gnarly logic bugs.',
            },
          ],
          realWorld: {
            title: 'The mystery of the vanishing discount',
            scenario:
              'Sales reported discounts "randomly resetting to zero" after save. Three developers stared at the trigger for a day — the trigger was innocent.',
            solution:
              'A trace flag on an affected user produced a log whose CODE_UNIT timeline showed an after-save flow (built by a departed admin) recalculating discounts AFTER the trigger ran. The flow\'s entry condition was missing a record-type filter.',
            outcome:
              'One entry-condition fix ended a week of confusion. The team now pulls a debug log BEFORE theorizing — the log shows the actual execution order, opinions do not.',
          },
          keyTakeaways: [
            'Trace the affected user, not yourself — context differences are the usual suspect',
            'The log is the observed order of execution; read CODE_UNIT blocks',
            'Check LIMIT_USAGE summaries during performance work',
            'Every fixed bug becomes a unit test',
          ],
          resources: [
            {
              title: 'Debug Logs (Salesforce Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.code_debug_log.htm&type=5',
              source: 'help',
            },
            {
              title: 'Salesforce Extensions for VS Code',
              url: 'https://developer.salesforce.com/tools/vscode',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-dev-test-1',
          topic: 'Testing',
          prompt: 'By default, Apex tests…',
          options: [
            'See all org data',
            'See no org data and must create their own',
            'Can only read Accounts',
            'Run against production data nightly',
          ],
          correctIndex: 1,
          explanation:
            'Test isolation forces self-contained data creation — hence test data factories.',
        },
        {
          id: 'q-dev-test-2',
          topic: 'Testing',
          prompt: 'Test.stopTest() is important when testing async code because it…',
          options: [
            'Rolls back all DML',
            'Forces queued async jobs to run so you can assert their results',
            'Doubles governor limits',
            'Skips validation rules',
          ],
          correctIndex: 1,
          explanation:
            'stopTest synchronously executes pending future/Queueable/Batch work — deterministic async testing.',
        },
        {
          id: 'q-dev-test-3',
          topic: 'Testing',
          prompt: 'System.runAs(someUser) exists to test…',
          options: [
            'CPU limits',
            'Sharing and permission behavior under that user\'s access',
            'Email deliverability',
            'UI rendering',
          ],
          correctIndex: 1,
          explanation:
            'runAs switches user context so with sharing code and permission-dependent logic can be verified.',
        },
        {
          id: 'q-dev-test-4',
          topic: 'Coverage',
          prompt: 'Production deployments require…',
          options: [
            '90% coverage per class',
            '75% aggregate coverage with all tests passing',
            '50% coverage on triggers only',
            'No tests if the change is small',
          ],
          correctIndex: 1,
          explanation:
            '75% org-wide (plus every trigger having some coverage) is the platform floor — behavior assertions are on you.',
        },
        {
          id: 'q-dev-test-5',
          topic: 'Async choice',
          prompt: 'Modern code needing async work with object parameters and chaining should use…',
          options: ['@future', 'Queueable', 'A before trigger', 'SOSL'],
          correctIndex: 1,
          explanation:
            'Queueable supersedes @future: richer parameters, job Ids, and chain-ability.',
        },
        {
          id: 'q-dev-test-6',
          topic: 'Batch',
          prompt: 'Batch Apex is the right tool when…',
          options: [
            'You need a callout after DML for one record',
            'You must process millions of rows in resumable, limit-safe chunks',
            'A user clicks a button',
            'You need real-time UI updates',
          ],
          correctIndex: 1,
          explanation:
            'The start/execute/finish lifecycle with per-chunk limits is built for data-volume operations.',
        },
        {
          id: 'q-dev-test-7',
          topic: 'Batch',
          prompt: 'Each execute() invocation of a batch gets…',
          options: [
            'Shared limits across the whole batch run',
            'Fresh governor limits for its chunk',
            'No limits at all',
            'Half of synchronous limits',
          ],
          correctIndex: 1,
          explanation:
            'Limits reset per chunk — that is precisely why batch scales where synchronous code cannot.',
        },
        {
          id: 'q-dev-test-8',
          topic: 'Scheduling',
          prompt: 'A known operational gotcha with Scheduled Apex is…',
          options: [
            'It cannot call other classes',
            'Classes referenced by active schedules are locked against editing/deployment',
            'It only runs on weekends',
            'It bypasses all limits',
          ],
          correctIndex: 1,
          explanation:
            'Active schedules lock their classes — deployments must abort or recreate the schedules.',
        },
        {
          id: 'q-dev-test-9',
          topic: 'Callouts',
          prompt: 'Callouts cannot be made after DML in the same transaction. The standard solution is…',
          options: [
            'Retry the callout in a loop',
            'Move the callout to async Apex (Queueable with AllowsCallouts)',
            'Use SOSL instead',
            'Wrap the callout in Test.startTest',
          ],
          correctIndex: 1,
          explanation:
            'Uncommitted work cannot be held open across a callout — decouple via async execution.',
        },
        {
          id: 'q-dev-test-10',
          topic: 'Debugging',
          prompt: 'A field changes "mysteriously" on save. The fastest reliable diagnostic is…',
          options: [
            'Re-reading all org code',
            'A debug log\'s CODE_UNIT timeline showing the actual execution order',
            'Asking in Chatter',
            'Disabling all flows in production',
          ],
          correctIndex: 1,
          explanation:
            'The log records what actually ran and in what order — flows, triggers, validations — ending speculation.',
        },
      ],
    },
    {
      id: 'sf-dev-lwc',
      title: 'Lightning Web Components',
      summary:
        'Modern web-standard UI on the platform: reactivity, Lightning Data Service, Apex wiring, and component communication.',
      lessons: [
        {
          id: 'dev-lwc-fundamentals',
          title: 'LWC fundamentals: components, templates, reactivity',
          summary:
            'The anatomy of a component — HTML template, JavaScript class, metadata — and how reactivity actually works.',
          durationMinutes: 20,
          objectives: [
            'Build a component from template + class + meta.xml',
            'Use decorators: @api, @track, and when neither is needed',
            'Handle events and conditional rendering in templates',
          ],
          sections: [
            {
              heading: 'Anatomy of a component',
              body:
                'An LWC is a folder: component.html (template), component.js (an ES class extending LightningElement), component.js-meta.xml (visibility: which pages/apps can host it, plus configurable properties). CSS and tests sit alongside.\n\nLWC is built on web standards — custom elements, modules, shadow DOM — so modern JavaScript knowledge transfers directly, unlike the proprietary Aura framework it replaced. Base components (lightning-input, lightning-datatable, lightning-card) provide SLDS-styled building blocks.',
              code: {
                language: 'javascript',
                snippet:
                  "import { LightningElement, api } from 'lwc';\n\nexport default class GreetingCard extends LightningElement {\n    @api recordName = 'friend';\n    liked = false;              // reactive without any decorator\n\n    get message() {\n        return `Hello, ${this.recordName}!`;\n    }\n    handleLike() {\n        this.liked = !this.liked;\n    }\n}",
                caption: '@api exposes a public property; plain fields are already reactive; getters derive display values.',
              },
            },
            {
              heading: 'Reactivity and decorators',
              body:
                'All fields are reactive for primitive reassignment — change this.count and the template re-renders. @track is only needed for observing MUTATION of objects/arrays (or reassign a fresh copy instead — the cleaner habit). @api marks public properties settable by parent components or App Builder.\n\nTemplates bind with {property}, loop with for:each (always set key=), and render conditionally with the modern lwc:if|elseif|else directives.',
            },
            {
              heading: 'Events and lifecycle',
              body:
                'DOM events wire with onclick={handleClick}. Components communicate upward via CustomEvent: this.dispatchEvent(new CustomEvent(\'select\', { detail: { id } })) — parents listen with onselect. Lifecycle hooks: connectedCallback (setup on insert), renderedCallback (after render — guard against loops), disconnectedCallback (cleanup).\n\nShadow DOM isolates styling: your CSS stays in, page CSS stays out. Styling hooks (--slds-c-… custom properties) are the sanctioned way to theme base components.',
            },
          ],
          realWorld: {
            title: 'Replacing a spreadsheet ritual with a component',
            scenario:
              'Account managers exported related opportunities to Excel just to see a weighted pipeline number with color coding — every account review, every week.',
            solution:
              'A developer built a small LWC: it receives recordId from the record page, computes weighted pipeline in a getter, renders a lightning-datatable with SLDS badge styling, and exposes a "target multiplier" property configurable per App Builder page.',
            outcome:
              'The spreadsheet ritual disappeared; admins later reused the same component on the Sales home page with a different multiplier — zero code changes, one meta.xml property.',
          },
          keyTakeaways: [
            'Component = template + class + meta.xml; base components handle the look',
            'Fields are reactive; @track only for object mutation; @api for public props',
            'Communicate down via properties, up via CustomEvent',
            'meta.xml properties make components admin-configurable — design for it',
          ],
          resources: [
            {
              title: 'Lightning Web Components Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lightning-web-components-basics',
              source: 'trailhead',
            },
            {
              title: 'LWC Developer Guide',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide',
              source: 'developer',
            },
          ],
        },
        {
          id: 'dev-lwc-data',
          title: 'Data access: wire service, LDS, and Apex',
          summary:
            'The data-access decision tree: Lightning Data Service first, wired Apex second, imperative Apex when you need control.',
          durationMinutes: 20,
          objectives: [
            'Use LDS adapters (getRecord, createRecord) and record forms',
            'Wire Apex methods reactively with @wire and $parameters',
            'Call Apex imperatively and handle errors + refreshApex',
          ],
          sections: [
            {
              heading: 'Lightning Data Service: the free layer',
              body:
                'LDS gives CRUD on single records with a shared client-side cache and zero Apex: lightning-record-form and friends render full forms respecting FLS and layouts; @wire(getRecord, { recordId: \'$recordId\', fields }) streams record data into your component and keeps every LDS consumer on the page in sync after edits.\n\nIf your requirement is "show/edit fields of THIS record", LDS is the answer — no controller, no test class, cache included.',
            },
            {
              heading: 'Wired Apex for lists and logic',
              body:
                'For queries beyond one record, expose Apex: @AuraEnabled(cacheable=true) static methods wire into components. Reactive parameters ($searchTerm) re-invoke the wire automatically when the property changes — a search-as-you-type experience in a handful of lines.\n\ncacheable=true is required for wiring and enables client caching, but such methods cannot perform DML. Structure reads as cacheable wires and writes as separate imperative methods.',
              code: {
                language: 'javascript',
                snippet:
                  "import { LightningElement, wire } from 'lwc';\nimport searchAccounts from '@salesforce/apex/AccountSearchController.search';\n\nexport default class AccountSearch extends LightningElement {\n    term = '';\n    @wire(searchAccounts, { term: '$term' }) results; // re-fires when term changes\n\n    handleChange(event) {\n        this.term = event.target.value;\n    }\n}",
                caption: 'Reactive wire: typing updates `term`, the wire re-queries, the template re-renders.',
              },
            },
            {
              heading: 'Imperative calls and cache refresh',
              body:
                'Button-triggered operations and DML use imperative calls: await save({ payload }) inside try/catch, then toast the outcome (ShowToastEvent) and refresh stale wires with refreshApex(this.wiredResult) or notify LDS of record changes.\n\nErrors from Apex arrive as structured objects — build one error-normalizing utility and reuse it everywhere. Never swallow errors silently; a component that fails without feedback erodes trust in the whole app.',
            },
          ],
          realWorld: {
            title: 'The over-engineered account panel, refactored',
            scenario:
              'A consultancy delivered an account panel powered entirely by custom Apex — including plain field display. It broke FLS (fields admins hid kept showing) and required a deployment for every field change.',
            solution:
              'The refactor used lightning-record-view-form for record fields (FLS respected automatically, fields changeable by admins), kept one cacheable wired Apex method for the genuinely custom aggregation, and one imperative method for the action button.',
            outcome:
              'The FLS violation vanished without code, admins gained field-level control through Setup, and the Apex surface (and its test burden) shrank by two-thirds.',
          },
          keyTakeaways: [
            'Decision tree: LDS/record forms → wired cacheable Apex → imperative Apex',
            'LDS respects FLS and layouts and shares a cache across the page',
            'Reactive $params turn wires into live queries',
            'Writes are imperative + try/catch + toast + refreshApex',
          ],
          resources: [
            {
              title: 'Lightning Data Service Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lightning_data_service',
              source: 'trailhead',
            },
            {
              title: 'LWC Guide: Data Access',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/data-overview.html',
              source: 'developer',
            },
          ],
        },
        {
          id: 'dev-lwc-composition',
          title: 'Component communication & composition',
          summary:
            'Parent-child contracts, Lightning Message Service across the page, and composition patterns that scale.',
          durationMinutes: 18,
          objectives: [
            'Design parent-child contracts with @api and events',
            'Use Lightning Message Service for cross-DOM communication',
            'Compose pages from small, single-purpose components',
          ],
          sections: [
            {
              heading: 'Parent-child: properties down, events up',
              body:
                'Parents pass data via public properties (<c-line-item item={item}>) and call public @api methods for imperative nudges (childCmp.focus()). Children never reach into parents; they dispatch CustomEvents describing what happened, not what the parent should do — onitemselect, not onupdateparentlist.\n\nThis one-way data flow keeps components reusable: a child that assumes its parent is a specific component is no longer a component, it is a fragment.',
            },
            {
              heading: 'Lightning Message Service: across the page',
              body:
                'Components in different DOM branches — two App Builder regions, or an LWC and a Visualforce page — cannot exchange DOM events. Lightning Message Service (LMS) provides publish/subscribe over a message channel: define the channel (XML metadata), publish({ recordId }), subscribe and react.\n\nUse LMS for page-level coordination ("account selected in list → detail panel loads it"). Resist making it a global event bus for everything — implicit coupling through a dozen channels is jQuery-spaghetti reborn.',
            },
            {
              heading: 'Composition as architecture',
              body:
                'Big features decompose into a container component (owns data loading and state) and presentational children (receive props, emit events). Slots (<slot>) let consumers inject content, enabling generic card/layout components.\n\nThe test of good decomposition: can you explain each component\'s job in one sentence, and could a different feature reuse the child components? Jest tests (sfdx-lwc-jest) then test children with simple prop/event contracts instead of monolithic page mocks.',
            },
          ],
          realWorld: {
            title: 'A console page that finally talks to itself',
            scenario:
              'A service console page had a case list (one vendor\'s component), a knowledge panel (another team\'s), and a customer timeline — none aware of each other. Agents clicked a case, then manually searched the other two panels.',
            solution:
              'The team defined a CaseSelected message channel; the list publishes on click, and both panels subscribe and refresh themselves. No component knows the others exist — they share only the channel contract.',
            outcome:
              'Three isolated widgets became one coherent workspace; average handling time dropped, and a fourth panel (order history) plugged in a sprint later by simply subscribing to the same channel.',
          },
          keyTakeaways: [
            'Properties down, events up — children never command parents',
            'Events describe what happened; parents decide what to do',
            'LMS connects components across DOM boundaries via message channels',
            'Container + presentational decomposition keeps components testable and reusable',
          ],
          resources: [
            {
              title: 'LWC Guide: Communicate with Events',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/events.html',
              source: 'developer',
            },
            {
              title: 'LWC Guide: Lightning Message Service',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/use-message-channel.html',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-dev-lwc-1',
          topic: 'LWC basics',
          prompt: 'The .js-meta.xml file of an LWC controls…',
          options: [
            'The component\'s CSS',
            'Where the component can be used and its App Builder properties',
            'The Apex controller binding',
            'Governor limits',
          ],
          correctIndex: 1,
          explanation:
            'meta.xml declares targets (record page, app page, home…) and exposes configurable properties to admins.',
        },
        {
          id: 'q-dev-lwc-2',
          topic: 'Reactivity',
          prompt: 'When is @track actually required in modern LWC?',
          options: [
            'On every property',
            'Only to observe mutations INSIDE objects/arrays',
            'On public properties',
            'Never — it is deprecated syntax with no effect',
          ],
          correctIndex: 1,
          explanation:
            'Primitive reassignment is reactive by default; @track matters only for deep mutation (or reassign a copy instead).',
        },
        {
          id: 'q-dev-lwc-3',
          topic: 'Component contract',
          prompt: '@api on a property means…',
          options: [
            'It is public — parents and App Builder can set it',
            'It calls a REST API',
            'It is cached between sessions',
            'It bypasses FLS',
          ],
          correctIndex: 0,
          explanation: '@api defines the component\'s public interface.',
        },
        {
          id: 'q-dev-lwc-4',
          topic: 'Data access',
          prompt: 'To display and edit fields of the current record with FLS respected and no Apex, use…',
          options: [
            'Imperative Apex with dynamic SOQL',
            'lightning-record-form / LDS wire adapters',
            'An iframe to Classic',
            'A Visualforce page',
          ],
          correctIndex: 1,
          explanation:
            'LDS-based forms give CRUD with FLS/layout awareness and a shared cache — zero controller code.',
        },
        {
          id: 'q-dev-lwc-5',
          topic: 'Wire service',
          prompt: 'For an Apex method to be used with @wire it must be…',
          options: [
            'Annotated @AuraEnabled(cacheable=true)',
            'Declared global',
            'In a class named after the component',
            'A void method',
          ],
          correctIndex: 0,
          explanation:
            'Wiring requires cacheable=true — which also means the method cannot perform DML.',
        },
        {
          id: 'q-dev-lwc-6',
          topic: 'Wire reactivity',
          prompt: 'Prefixing a wire parameter with $ (e.g. term: \'$term\') causes…',
          options: [
            'A compile error',
            'The wire to re-invoke automatically when that property changes',
            'The parameter to be encrypted',
            'The wire to run only once',
          ],
          correctIndex: 1,
          explanation:
            '$-parameters are reactive bindings — the foundation of live search and dependent pickers.',
        },
        {
          id: 'q-dev-lwc-7',
          topic: 'DML from LWC',
          prompt: 'A "Save" button that performs DML should call Apex…',
          options: [
            'Via @wire',
            'Imperatively (await method()) with try/catch and a toast',
            'Through a formula field',
            'Only from renderedCallback',
          ],
          correctIndex: 1,
          explanation:
            'Writes are user-triggered imperative calls; wires are for reactive reads.',
        },
        {
          id: 'q-dev-lwc-8',
          topic: 'Events',
          prompt: 'The recommended way for a child LWC to inform its parent of a selection is…',
          options: [
            'Directly mutating a parent property',
            'Dispatching a CustomEvent with the selection in detail',
            'Lightning Message Service',
            'A static Apex variable',
          ],
          correctIndex: 1,
          explanation:
            'Within a DOM hierarchy: properties down, CustomEvents up. LMS is for cross-DOM communication.',
        },
        {
          id: 'q-dev-lwc-9',
          topic: 'LMS',
          prompt: 'Lightning Message Service is needed when…',
          options: [
            'A parent passes data to its child',
            'Sibling components in separate page regions (or LWC↔Visualforce) must communicate',
            'You need to call Apex',
            'You want faster rendering',
          ],
          correctIndex: 1,
          explanation:
            'LMS crosses DOM boundaries that events cannot — separate regions, different frameworks.',
        },
        {
          id: 'q-dev-lwc-10',
          topic: 'Refresh',
          prompt: 'After an imperative save, the wired list on the same page is stale. You should…',
          options: [
            'Reload the browser programmatically',
            'Call refreshApex on the stored wired result',
            'Add a 5-second timer',
            'Convert the wire to a loop',
          ],
          correctIndex: 1,
          explanation:
            'refreshApex re-provisions the wire\'s data — the sanctioned cache-refresh mechanism.',
        },
      ],
    },
    {
      id: 'sf-dev-integration',
      title: 'Integration & APIs',
      summary:
        'The platform\'s API surface, secure callouts with Named Credentials, and event-driven integration with Platform Events and CDC.',
      lessons: [
        {
          id: 'dev-apis',
          title: 'The API surface: REST, SOAP, Bulk, and friends',
          summary:
            'Which API for which job — and the auth, limits, and composite patterns around them.',
          durationMinutes: 18,
          objectives: [
            'Map use cases to REST, SOAP, Bulk 2.0, and Composite APIs',
            'Understand OAuth flows for server-to-server integration',
            'Respect API limits with change-detection-friendly designs',
          ],
          sections: [
            {
              heading: 'Choosing the API',
              body:
                'REST API: CRUD + query over JSON — the default for modern integrations (/services/data/vXX.X/sobjects/Account/…). SOAP: contract-first WSDL, still alive in enterprise middleware. Bulk API 2.0: asynchronous CSV jobs for millions of rows. Composite/Graph: multiple operations in one round trip, with references between subrequests — the answer to "create account, then contact, then opportunity atomically".\n\nMetadata and Tooling APIs manage configuration rather than data (deployments, CI tooling — the machinery this platform automates). Streaming/Pub-Sub APIs push events instead of answering polls.',
            },
            {
              heading: 'Authentication in practice',
              body:
                'External systems authenticate via OAuth 2.0 through a Connected App. Server-to-server integrations should use the JWT Bearer flow (certificate-based, no interactive login, no password storage) or the client-credentials flow; interactive apps use the web-server flow with refresh tokens.\n\nGive integrations dedicated integration users with minimal permission sets — "the ERP writes orders" should not run as a system administrator. API-only user licenses and login IP restrictions harden this further.',
            },
            {
              heading: 'API limits and polite integration design',
              body:
                'Orgs have rolling 24-hour API request allocations (edition- and license-based). Chatty designs — polling every record every minute — burn allocations and scale badly. Prefer event-driven push (Platform Events, CDC, outbound messages), delta queries on SystemModstamp, and Bulk API for volume.\n\nMonitor consumption in Setup (API Usage) and via the limits endpoint. Integration reviews should always ask: "what happens when the remote side is down?" — queues, retries with backoff, and idempotent receivers are the difference between integration and entanglement.',
            },
          ],
          realWorld: {
            title: 'The nightly sync that ate the API allocation',
            scenario:
              'A data team synced 2 million records nightly by paging the REST API — 40,000 requests per run. Marketing\'s integration started failing at 6 am with REQUEST_LIMIT_EXCEEDED: the org\'s daily allocation was gone.',
            solution:
              'The sync moved to Bulk API 2.0 (a handful of job-management requests instead of tens of thousands) and switched to delta extraction on SystemModstamp, shrinking most nights to a few thousand changed rows.',
            outcome:
              'API consumption dropped by ~99%, the 6 am failures stopped, and the incident produced an org-wide rule: any integration moving >10k rows must justify NOT using Bulk.',
          },
          keyTakeaways: [
            'REST for transactional CRUD, Bulk 2.0 for volume, Composite for multi-step atomicity',
            'Server-to-server auth = JWT bearer flow with a dedicated integration user',
            'Design for deltas and push, not full-table polling',
            'Plan for remote failure: retries, backoff, idempotency',
          ],
          resources: [
            {
              title: 'API Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/api_basics',
              source: 'trailhead',
            },
            {
              title: 'REST API Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'dev-callouts',
          title: 'Callouts, Named Credentials, and resilient consumers',
          summary:
            'Outbound HTTP done right: no hardcoded endpoints or secrets, timeouts and retries by design.',
          durationMinutes: 18,
          objectives: [
            'Make HTTP callouts from Apex with proper error handling',
            'Externalize endpoints and auth with Named Credentials',
            'Design for timeouts, retries, and testability with HttpCalloutMock',
          ],
          sections: [
            {
              heading: 'The callout mechanics',
              body:
                'HttpRequest/HttpResponse drive outbound calls: set endpoint, method, headers, body; send; branch on status code. Callouts must be registered in Remote Site Settings OR — much better — routed through a Named Credential.\n\nTwo structural rules: callouts cannot follow DML in the same transaction (async or reorder), and synchronous contexts allow 100 callouts / 120 seconds total — long-running remote calls need explicit timeouts well below that.',
              code: {
                language: 'apex',
                snippet:
                  'public class ErpClient {\n    public static InvoiceResult pushInvoice(Id invoiceId) {\n        HttpRequest req = new HttpRequest();\n        req.setEndpoint(\'callout:ERP_API/invoices\');   // Named Credential\n        req.setMethod(\'POST\');\n        req.setHeader(\'Content-Type\', \'application/json\');\n        req.setTimeout(10000);\n        req.setBody(JSON.serialize(InvoicePayload.from(invoiceId)));\n\n        HttpResponse res = new Http().send(req);\n        if (res.getStatusCode() >= 300) {\n            throw new ErpCalloutException(\'ERP rejected invoice: \' + res.getStatus());\n        }\n        return (InvoiceResult) JSON.deserialize(res.getBody(), InvoiceResult.class);\n    }\n}',
                caption: 'callout:NamedCredential endpoints keep URLs and auth out of code entirely.',
              },
            },
            {
              heading: 'Named Credentials: secrets out of code',
              body:
                'A Named Credential bundles endpoint URL + authentication (Basic, OAuth, JWT, AWS signature) as declarative metadata. Code references callout:ERP_API/path and the platform injects credentials at runtime — nothing sensitive in Apex, different values per environment without code changes, credential rotation without deployment.\n\nHardcoded endpoints and secrets in custom settings/labels are the legacy anti-pattern; security reviews flag them on sight. External Credentials (the newer model) separate the "where" from the "how to authenticate" for even cleaner reuse.',
            },
            {
              heading: 'Resilience and testing',
              body:
                'Treat every remote system as eventually unavailable: set timeouts, catch CalloutException, retry transient failures with backoff (usually via Queueable re-enqueue), and record failures somewhere actionable (error log object + notification, not a swallowed exception).\n\nTests cannot make real callouts: implement HttpCalloutMock returning canned responses per scenario — success, 4xx, 5xx, timeout — and assert your client\'s behavior for each. An untested error path is where the 2 am incident lives.',
            },
          ],
          realWorld: {
            title: 'Rotating credentials without a deployment',
            scenario:
              'A payments provider forced an emergency credential rotation. The org\'s legacy integration had the API key in a custom setting and the endpoint hardcoded across four classes — the fix needed a same-day production deployment under incident pressure.',
            solution:
              'Post-incident, all callouts moved behind Named Credentials with per-environment values. The next rotation was a Setup-only change performed by an admin in minutes, with an HttpCalloutMock suite proving behavior unchanged.',
            outcome:
              'Credential rotation became an operational task instead of an engineering emergency, and the security team\'s "no secrets in code or settings" policy finally had a clean implementation pattern.',
          },
          keyTakeaways: [
            'callout:NamedCredential — never hardcode endpoints or secrets',
            'No callouts after DML; async is the standard workaround',
            'Timeouts + retries + logged failures = resilient consumer',
            'HttpCalloutMock every path, especially the failures',
          ],
          resources: [
            {
              title: 'Apex Integration Services (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_integration_services',
              source: 'trailhead',
            },
            {
              title: 'Named Credentials (Salesforce Help)',
              url: 'https://help.salesforce.com/s/articleView?id=sf.named_credentials_about.htm&type=5',
              source: 'help',
            },
          ],
        },
        {
          id: 'dev-events',
          title: 'Platform Events & Change Data Capture',
          summary:
            'Event-driven architecture on-platform: custom events, CDC streams, and the decoupling they buy.',
          durationMinutes: 18,
          objectives: [
            'Define and publish Platform Events from Apex, Flow, and APIs',
            'Subscribe via triggers, flows, and external CometD/Pub-Sub clients',
            'Choose between Platform Events and Change Data Capture',
          ],
          sections: [
            {
              heading: 'Platform Events: the org\'s message bus',
              body:
                'A Platform Event is a custom-defined message (Order_Placed__e with fields) published to the event bus rather than saved as data. Publishers — Apex (EventBus.publish), Flows, REST — fire and continue; subscribers — Apex triggers on the event, flows, external clients — process asynchronously.\n\nThe decoupling is the point: the order-taking code neither knows nor cares that fulfillment, analytics, AND a webhook forwarder all react. Adding a fourth consumer requires zero changes to publishers.',
            },
            {
              heading: 'Change Data Capture: the record change stream',
              body:
                'CDC publishes standardized change events (AccountChangeEvent) for every create/update/delete/undelete on enabled objects — no custom publishing code. External systems subscribe (Pub/Sub API is the modern gRPC-based client) and replicate changes into caches, warehouses, or search indexes near-real-time.\n\nChoose CDC when the message IS "this record changed" — data sync. Choose Platform Events when the message is a business FACT ("order placed", "fraud suspected") that may not map 1:1 to any record write.',
            },
            {
              heading: 'Operating an event-driven org',
              body:
                'Events are retained on the bus (72 hours for standard-volume) and consumers resume from a replay ID after disconnection — design consumers idempotent because redelivery is possible. Publish-behavior matters in Apex: "publish after commit" (default, safe) vs "publish immediately".\n\nMind the allocations (publish and delivery limits per 24h), monitor subscriptions (EventBusSubscriber), and resist eventifying everything: request-reply questions ("what is this account\'s credit score right now?") are still callouts, not events.',
            },
          ],
          realWorld: {
            title: 'Decoupling order fulfillment from order capture',
            scenario:
              'Order capture called the warehouse system synchronously during save. Warehouse maintenance windows made SALESFORCE saves fail; a slow warehouse API made every rep\'s save slow. Two systems, one fate.',
            solution:
              'Order capture now publishes Order_Placed__e after commit. The warehouse integration subscribes via Pub/Sub API with replay-based resume; a subscriber flow also tasks the account team for large orders. During warehouse downtime, events simply queue on the bus.',
            outcome:
              'Saves became instant and immune to warehouse health, missed events during a later outage replayed automatically from the last replay ID, and analytics added their own subscriber a month later without touching order code.',
          },
          keyTakeaways: [
            'Platform Events = business facts on a bus; CDC = record-change stream',
            'Publishers and subscribers evolve independently — that is the payoff',
            'Consumers must be idempotent; replay IDs cover disconnection windows',
            'Not everything is an event: request-reply questions remain callouts',
          ],
          resources: [
            {
              title: 'Platform Events Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/platform_events_basics',
              source: 'trailhead',
            },
            {
              title: 'Change Data Capture Basics (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/change-data-capture',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-dev-int-1',
          topic: 'API choice',
          prompt: 'Loading 3 million records into Salesforce should use…',
          options: ['REST API record-by-record', 'Bulk API 2.0', 'SOAP describe calls', 'Streaming API'],
          correctIndex: 1,
          explanation:
            'Bulk 2.0 processes CSV jobs asynchronously at scale with a tiny request footprint.',
        },
        {
          id: 'q-dev-int-2',
          topic: 'Composite',
          prompt: 'Creating an Account, then a Contact referencing it, in ONE API round trip uses…',
          options: [
            'Two sequential REST calls',
            'The Composite API with reference IDs between subrequests',
            'SOSL',
            'An outbound message',
          ],
          correctIndex: 1,
          explanation:
            'Composite chains subrequests with @{ref.id} references, optionally all-or-nothing.',
        },
        {
          id: 'q-dev-int-3',
          topic: 'Auth',
          prompt: 'The recommended auth flow for an unattended server-to-server integration is…',
          options: [
            'Username + password in the request body',
            'OAuth JWT Bearer flow with a certificate and a dedicated integration user',
            'Sharing an admin\'s session ID',
            'Anonymous access',
          ],
          correctIndex: 1,
          explanation:
            'JWT bearer avoids interactive login and stored passwords; least-privilege integration users bound it.',
        },
        {
          id: 'q-dev-int-4',
          topic: 'API limits',
          prompt: 'An org keeps hitting REQUEST_LIMIT_EXCEEDED. The structural fix is…',
          options: [
            'Retry harder',
            'Replace polling with events/deltas and move volume to Bulk API',
            'Buy a second org',
            'Disable the API',
          ],
          correctIndex: 1,
          explanation:
            'Allocation pressure is a design smell: push (events) + delta sync + bulk jobs slash request counts.',
        },
        {
          id: 'q-dev-int-5',
          topic: 'Callouts',
          prompt: 'Why do callouts fail after DML in the same transaction?',
          options: [
            'Salesforce blocks holding an open transaction across an external wait',
            'HTTP is disabled in triggers',
            'JSON serialization locks the record',
            'They don\'t — it always works',
          ],
          correctIndex: 0,
          explanation:
            'Uncommitted DML can\'t be held pending an external call; move the callout async (Queueable + AllowsCallouts).',
        },
        {
          id: 'q-dev-int-6',
          topic: 'Named Credentials',
          prompt: 'Named Credentials improve on hardcoded endpoints because they…',
          options: [
            'Make callouts synchronous',
            'Keep URL + auth in declarative metadata: per-env values, rotation without deployment',
            'Skip Remote Site Settings only',
            'Encrypt the request body',
          ],
          correctIndex: 1,
          explanation:
            'callout:Name endpoints externalize configuration and secrets — the security-review-approved pattern.',
        },
        {
          id: 'q-dev-int-7',
          topic: 'Callout testing',
          prompt: 'Apex tests handle callouts by…',
          options: [
            'Calling the real endpoint with test data',
            'Registering an HttpCalloutMock that returns canned responses',
            'Skipping any method containing Http',
            'Using SeeAllData',
          ],
          correctIndex: 1,
          explanation:
            'Tests must mock HTTP — and should cover failure responses, not just the happy path.',
        },
        {
          id: 'q-dev-int-8',
          topic: 'Events vs CDC',
          prompt: '"Notify systems when an order is PLACED (a business fact)" vs "replicate Account changes to a warehouse" map to…',
          options: [
            'CDC for both',
            'Platform Events for the fact; Change Data Capture for the replication',
            'Platform Events for both',
            'Outbound messages for both',
          ],
          correctIndex: 1,
          explanation:
            'Custom business facts = Platform Events; record-change streams = CDC.',
        },
        {
          id: 'q-dev-int-9',
          topic: 'Event consumers',
          prompt: 'Event subscribers should be idempotent because…',
          options: [
            'Events are always duplicated',
            'Redelivery/replay after disconnection can deliver an event more than once',
            'The bus randomizes payloads',
            'Idempotency increases throughput',
          ],
          correctIndex: 1,
          explanation:
            'Replay-based resume guarantees at-least-once semantics — consumers must tolerate repeats.',
        },
        {
          id: 'q-dev-int-10',
          topic: 'Event scope',
          prompt: 'Which requirement is NOT a good fit for events?',
          options: [
            'Fan-out notification that an order shipped',
            'Near-real-time data replication',
            'A synchronous "what is the current credit score?" lookup during save',
            'Decoupling order capture from fulfillment',
          ],
          correctIndex: 2,
          explanation:
            'Request-reply questions need synchronous answers — that is a callout, not a published event.',
        },
      ],
    },
  ],
};
