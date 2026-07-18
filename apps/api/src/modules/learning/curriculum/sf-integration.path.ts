import type { CurriculumPath } from './curriculum.types';

/**
 * Path 8 — Salesforce Integration & API Mastery (category: salesforce).
 * The "extra" Salesforce track requested for advanced integration work: Apex
 * callouts with Named Credentials, exposing Apex as REST/SOAP services,
 * event-driven integration, the classic integration patterns, OAuth/identity,
 * and resilient, bulk-safe design.
 */
export const sfIntegrationPath: CurriculumPath = {
  id: 'sf-integration',
  title: 'Salesforce Integration & API Mastery',
  tagline: 'Connect Salesforce to anything — securely, at scale.',
  description:
    'Go beyond the platform’s built-in features and connect Salesforce to the outside world. Learn outbound Apex callouts with Named Credentials, how to expose Apex as REST and SOAP web services, event-driven integration with Platform Events and Change Data Capture, the five enterprise integration patterns, OAuth 2.0 and identity, and how to build integrations that are bulk-safe and resilient.',
  category: 'salesforce',
  level: 'advanced',
  badge: 'Integration Specialist',
  estimatedHours: 7,
  skills: [
    'Apex callouts',
    'Apex REST/SOAP services',
    'Platform Events & CDC',
    'Integration patterns',
    'OAuth & Named Credentials',
  ],
  modules: [
    {
      id: 'sf-int-inbound-outbound',
      title: 'Calling Out & Being Called',
      summary:
        'Outbound REST callouts with Named Credentials, exposing Apex as REST/SOAP web services, and event-driven integration with Platform Events and Change Data Capture.',
      lessons: [
        {
          id: 'sf-int-rest-callouts',
          title: 'Outbound REST callouts with Named Credentials',
          summary:
            'Make Salesforce call an external API from Apex without hard-coding endpoints or secrets, and parse the JSON response safely.',
          durationMinutes: 18,
          objectives: [
            'Register an endpoint + auth as a Named Credential',
            'Make an HTTP callout from Apex and handle the response',
            'Parse JSON into strongly-typed Apex objects',
          ],
          sections: [
            {
              heading: 'Never hard-code endpoints or secrets',
              body:
                'The wrong way to integrate is to paste a URL and an API key into Apex. Salesforce provides Named Credentials: you register the endpoint and authentication once in Setup, add the host to Remote Site Settings (or let the Named Credential cover it), and reference it by name in code. Salesforce injects the credentials at runtime, so secrets never live in your code or repo, and rotating a key is a config change — not a deploy.',
            },
            {
              heading: 'Making the callout',
              body:
                'An HTTP callout uses HttpRequest and Http. Prefix the endpoint with `callout:<NamedCredential>` and Salesforce handles the base URL and auth headers. Always set a timeout, check the status code, and never make a callout after a DML statement in the same transaction (Salesforce forbids it — do callouts first, then DML).',
              code: {
                language: 'apex',
                snippet:
                  "public with sharing class WeatherService {\n    public class WeatherServiceException extends Exception {}\n\n    public static Decimal getTemperature(String city) {\n        HttpRequest req = new HttpRequest();\n        req.setEndpoint('callout:Weather_API/current?city=' + EncodingUtil.urlEncode(city, 'UTF-8'));\n        req.setMethod('GET');\n        req.setTimeout(10000); // 10s — always set a timeout\n\n        HttpResponse res = new Http().send(req);\n        if (res.getStatusCode() != 200) {\n            throw new WeatherServiceException('Weather API returned ' + res.getStatusCode());\n        }\n        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());\n        return (Decimal) ((Map<String, Object>) body.get('main')).get('temp');\n    }\n}",
                caption: 'callout:Named_Credential keeps the URL + auth out of code.',
              },
            },
            {
              heading: 'Parse JSON into typed objects',
              body:
                'deserializeUntyped is quick for one field, but for real payloads define an Apex class matching the JSON and use JSON.deserialize for type safety and readability. This is the same "model your data" discipline from the JavaScript and Java tracks.',
              code: {
                language: 'apex',
                snippet:
                  "public class WeatherResponse {\n    public Main main;\n    public String name;\n    public class Main { public Decimal temp; public Integer humidity; }\n}\n\nWeatherResponse parsed =\n    (WeatherResponse) JSON.deserialize(res.getBody(), WeatherResponse.class);\nSystem.debug(parsed.name + ': ' + parsed.main.temp);",
                caption: 'Typed deserialization is safer and self-documenting.',
              },
            },
          ],
          realWorld: {
            title: 'Rotating an API key without a deployment',
            scenario:
              'An integration hard-coded a vendor API key in an Apex class. When security policy forced a key rotation, every environment needed a code change and redeploy, and the old key leaked in Git history.',
            solution:
              'The endpoint and key moved into a Named Credential; Apex referenced callout:Vendor_API. Rotating the key became an update in Setup with no code change.',
            outcome:
              'Secrets left the codebase entirely, rotations became a 2-minute config task per org, and a security finding was closed permanently.',
          },
          keyTakeaways: [
            'Use Named Credentials — never hard-code endpoints or secrets',
            'Reference callout:Name; set a timeout and check the status code',
            'Do callouts before DML in a transaction (callouts-after-DML is disallowed)',
            'Deserialize JSON into typed Apex classes for real payloads',
          ],
          resources: [
            {
              title: 'Salesforce Developers — Apex Callouts (Named Credentials)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_callouts_named_credentials.htm',
              source: 'developer',
            },
            {
              title: 'Trailhead — Apex Integration Services',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_integration_services',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'sf-int-apex-rest',
          title: 'Exposing Apex as REST & SOAP web services',
          summary:
            'Let external systems call into Salesforce by publishing your own REST endpoint (and know when SOAP still applies).',
          durationMinutes: 18,
          objectives: [
            'Publish an Apex REST resource with @RestResource',
            'Handle GET/POST and return structured responses',
            'Know when to use standard APIs vs custom Apex services',
          ],
          sections: [
            {
              heading: 'When to build a custom API',
              body:
                'Salesforce already exposes powerful standard APIs (REST, SOAP, Bulk, Composite). Build a custom Apex REST service only when you need a purpose-built endpoint that encapsulates business logic — for example "create an order and its line items in one call" — rather than making the caller orchestrate many standard requests.',
            },
            {
              heading: 'Apex REST with @RestResource',
              body:
                'Annotate a global class with @RestResource(urlMapping=...) and add methods annotated with @HttpGet, @HttpPost, etc. The RestContext gives you the request and response. The endpoint lives under /services/apexrest/. Keep the method thin — validate input, call a service class, return a serializable result.',
              code: {
                language: 'apex',
                snippet:
                  "@RestResource(urlMapping='/v1/orders/*')\nglobal with sharing class OrderApi {\n    global class OrderResult { global Id orderId; global String status; }\n\n    @HttpPost\n    global static OrderResult createOrder(String accountId, List<String> skus) {\n        // Validate\n        if (String.isBlank(accountId) || skus == null || skus.isEmpty()) {\n            throw new AuraHandledException('accountId and skus are required');\n        }\n        // Delegate business logic to a service class\n        Id orderId = OrderService.create(accountId, skus);\n        OrderResult result = new OrderResult();\n        result.orderId = orderId;\n        result.status = 'created';\n        return result; // serialized to JSON automatically\n    }\n}",
                caption: 'A custom REST endpoint at /services/apexrest/v1/orders.',
              },
            },
            {
              heading: 'SOAP and security',
              body:
                'Some enterprise/legacy systems still require SOAP; Apex supports it via global webservice methods and WSDL generation, but prefer REST for new work. Whichever you choose, the caller authenticates with OAuth (covered next), and your service must respect object/field security — use "with sharing" and check CRUD/FLS, because an exposed endpoint is an attack surface.',
            },
          ],
          realWorld: {
            title: 'One call instead of five',
            scenario:
              'A partner portal created an order by making five separate standard API calls (account lookup, order, three line items), which was slow and could half-fail, leaving orphaned records.',
            solution:
              'A single Apex REST endpoint accepted the whole order and created everything in one transaction, so it either fully succeeded or fully rolled back.',
            outcome:
              'Latency dropped, partial failures disappeared thanks to transactional integrity, and the partner’s integration code shrank to a single request.',
          },
          keyTakeaways: [
            'Standard APIs cover most needs; custom Apex REST encapsulates business logic',
            '@RestResource + @HttpGet/@HttpPost publish endpoints under /services/apexrest/',
            'Keep endpoints thin; delegate to service classes; return serializable results',
            'Enforce sharing + CRUD/FLS — an exposed endpoint is an attack surface',
          ],
          resources: [
            {
              title: 'Salesforce Developers — Apex REST',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_rest_intro.htm',
              source: 'developer',
            },
            {
              title: 'Trailhead — Apex Web Services',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_integration_services/apex_integration_webservices',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'sf-int-events',
          title: 'Event-driven integration: Platform Events & Change Data Capture',
          summary:
            'Decouple systems with a publish/subscribe model so producers and consumers never block each other.',
          durationMinutes: 17,
          objectives: [
            'Explain event-driven vs request/response integration',
            'Publish and subscribe to a Platform Event',
            'Use Change Data Capture to stream record changes',
          ],
          sections: [
            {
              heading: 'Why events',
              body:
                'Request/response integration couples systems in time: the caller waits for the callee. Event-driven integration decouples them — a producer publishes an event and moves on; any number of consumers react whenever they can. This improves resilience (a slow consumer never blocks the producer) and scalability, and is ideal for "notify other systems that X happened".',
            },
            {
              heading: 'Platform Events',
              body:
                'A Platform Event is a custom event definition (like an sObject ending in __e). Apex, Flow, or external systems publish events; subscribers include Apex triggers, Flows, and external clients over the streaming API. Publishing is just DML on the event, so it is familiar and bulk-friendly.',
              code: {
                language: 'apex',
                snippet:
                  "// Publish\nOrder_Shipped__e evt = new Order_Shipped__e(\n    Order_Id__c = orderId,\n    Carrier__c = 'DHL'\n);\nDatabase.SaveResult sr = EventBus.publish(evt);\n\n// Subscribe (trigger on the event)\ntrigger OrderShippedTrigger on Order_Shipped__e (after insert) {\n    for (Order_Shipped__e e : Trigger.new) {\n        NotificationService.notifyCustomer(e.Order_Id__c, e.Carrier__c);\n    }\n}",
                caption: 'Publish with EventBus.publish; subscribe with an after-insert trigger.',
              },
            },
            {
              heading: 'Change Data Capture (CDC)',
              body:
                'CDC publishes change events automatically whenever records of a selected object are created, updated, deleted, or undeleted — no code to publish. External systems subscribe to keep their data in sync in near real time. Choose CDC when the trigger is "a record changed"; choose Platform Events when you define a custom business event with your own payload.',
            },
          ],
          realWorld: {
            title: 'Keeping an ERP in sync without nightly batches',
            scenario:
              'An ERP was refreshed from Salesforce by a nightly batch, so inventory and order data were up to a day stale, causing overselling.',
            solution:
              'They enabled Change Data Capture on Order and Product objects; the ERP subscribed and updated itself within seconds of each change.',
            outcome:
              'Data latency fell from ~24 hours to near real time, overselling stopped, and the fragile nightly batch was retired.',
          },
          keyTakeaways: [
            'Events decouple producers and consumers in time — more resilient/scalable',
            'Platform Events are custom (__e); publish via EventBus.publish, subscribe via triggers/Flows/streaming',
            'CDC auto-publishes record change events with no code',
            'Custom business event → Platform Event; "a record changed" → CDC',
          ],
          resources: [
            {
              title: 'Salesforce Developers — Platform Events',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.platform_events.meta/platform_events/',
              source: 'developer',
            },
            {
              title: 'Trailhead — Change Data Capture Basics',
              url: 'https://trailhead.salesforce.com/content/learn/modules/change-data-capture',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'sf-int-io-q1',
          topic: 'Named Credentials',
          prompt: 'Why use a Named Credential for a callout?',
          options: [
            'It makes callouts faster',
            'It keeps endpoints/secrets out of code and injects auth at runtime',
            'It bypasses Remote Site Settings validation',
            'It is required for SOQL',
          ],
          correctIndex: 1,
          explanation: 'Named Credentials externalize the endpoint + auth so secrets never live in code.',
        },
        {
          id: 'sf-int-io-q2',
          topic: 'Callouts',
          prompt: 'Within one transaction, callouts must occur…',
          options: ['After DML', 'Before any DML', 'Only in triggers', 'Only in batch'],
          correctIndex: 1,
          explanation: 'Salesforce disallows callouts after DML in the same transaction.',
        },
        {
          id: 'sf-int-io-q3',
          topic: 'JSON',
          prompt: 'For a real payload, the safest parsing approach is…',
          options: [
            'String.split',
            'JSON.deserialize into a typed Apex class',
            'Regex',
            'Ignore the body',
          ],
          correctIndex: 1,
          explanation: 'Typed deserialization is safer and more readable than untyped parsing.',
        },
        {
          id: 'sf-int-io-q4',
          topic: 'Apex REST',
          prompt: 'Which annotation exposes an Apex class as a REST endpoint?',
          options: ['@AuraEnabled', '@RestResource', '@InvocableMethod', '@future'],
          correctIndex: 1,
          explanation: '@RestResource(urlMapping=...) publishes the class under /services/apexrest/.',
        },
        {
          id: 'sf-int-io-q5',
          topic: 'API design',
          prompt: 'When is a custom Apex REST service the right choice?',
          options: [
            'Always, instead of standard APIs',
            'When you need a purpose-built endpoint encapsulating business logic',
            'Never',
            'Only for reports',
          ],
          correctIndex: 1,
          explanation: 'Use standard APIs by default; build custom services for bespoke business operations.',
        },
        {
          id: 'sf-int-io-q6',
          topic: 'Security',
          prompt: 'An exposed Apex endpoint should…',
          options: [
            'Skip sharing for speed',
            'Enforce sharing and CRUD/FLS checks',
            'Store the API key in code',
            'Return all fields regardless of access',
          ],
          correctIndex: 1,
          explanation: 'Endpoints are attack surfaces; enforce sharing and field/object security.',
        },
        {
          id: 'sf-int-io-q7',
          topic: 'Events',
          prompt: 'The main advantage of event-driven integration is…',
          options: [
            'The producer waits for every consumer',
            'Producers and consumers are decoupled in time',
            'It requires no configuration',
            'It only works synchronously',
          ],
          correctIndex: 1,
          explanation: 'Pub/sub decouples systems so a slow consumer never blocks the producer.',
        },
        {
          id: 'sf-int-io-q8',
          topic: 'Platform Events',
          prompt: 'How do you publish a Platform Event from Apex?',
          options: ['insert', 'EventBus.publish', 'System.enqueueJob', 'Database.query'],
          correctIndex: 1,
          explanation: 'EventBus.publish sends the event to the event bus.',
        },
        {
          id: 'sf-int-io-q9',
          topic: 'CDC',
          prompt: 'Change Data Capture is the best fit when the trigger is…',
          options: [
            'A custom business event with your own payload',
            '"A record was created/updated/deleted"',
            'A scheduled report',
            'A login',
          ],
          correctIndex: 1,
          explanation: 'CDC auto-publishes record change events; custom payloads use Platform Events.',
        },
      ],
    },
    {
      id: 'sf-int-patterns-security',
      title: 'Patterns, Security & Resilience',
      summary:
        'The five enterprise integration patterns, OAuth 2.0 and Named/External Credentials, and how to build bulk-safe, resilient integrations within governor limits.',
      lessons: [
        {
          id: 'sf-int-patterns',
          title: 'The enterprise integration patterns',
          summary:
            'Choose the right pattern — Request/Reply, Fire-and-Forget, Batch, Remote Call-In, and Data Virtualization — for each integration.',
          durationMinutes: 16,
          objectives: [
            'Name the core Salesforce integration patterns',
            'Match a business need to the right pattern',
            'Understand synchronous vs asynchronous trade-offs',
          ],
          sections: [
            {
              heading: 'Five patterns to know',
              body:
                'Salesforce’s integration architecture centers on a handful of patterns:\n\n- Request and Reply: Salesforce calls out and waits for a response (synchronous). Good for immediate needs like an address validation.\n- Fire and Forget: Salesforce publishes/sends and does not wait (Platform Events, outbound messages). Good for notifications.\n- Batch Data Synchronization: bulk import/export on a schedule for large volumes.\n- Remote Call-In: an external system calls into Salesforce (Apex REST, standard APIs) to create/update data.\n- UI/Data Virtualization: display external data live without storing it (Salesforce Connect / external objects).',
            },
            {
              heading: 'Synchronous vs asynchronous',
              body:
                'Synchronous patterns are simple but couple systems and count against strict limits (callout time, concurrency). Asynchronous patterns (events, queueable, batch) add resilience and scale but require you to handle eventual consistency. A common mistake is forcing a synchronous callout inside a trigger on a bulk load — prefer async so a slow partner never fails a user’s save.',
            },
            {
              heading: 'Choosing well',
              body:
                'Ask three questions: Does the user need the answer right now (sync) or can it happen later (async)? How much data — one record (event/callout) or millions (batch)? Who initiates — Salesforce (callout) or the other system (call-in)? The answers point directly at the pattern, and choosing correctly is often more impactful than any single line of code.',
            },
          ],
          realWorld: {
            title: 'Fixing a trigger that failed under bulk load',
            scenario:
              'A trigger made a synchronous callout to a tax service on every Opportunity save. A data load of 5,000 records hit callout and time limits, and every save failed.',
            solution:
              'They switched to an asynchronous, event-driven approach: the trigger published an event; a queueable consumer called the tax service in bulk with retries.',
            outcome:
              'Bulk loads succeeded, user saves were instant again, and the integration scaled — a direct payoff from matching the pattern to the need.',
          },
          keyTakeaways: [
            'Know the five patterns: Request/Reply, Fire-and-Forget, Batch, Remote Call-In, Virtualization',
            'Sync is simple but coupling + limits; async is resilient but eventually consistent',
            'Never force a synchronous callout inside a bulk trigger',
            'Pattern choice (sync/async, volume, initiator) often matters more than code',
          ],
          resources: [
            {
              title: 'Salesforce Architects — Integration Patterns and Practices',
              url: 'https://architect.salesforce.com/decision-guides/integration-patterns',
              source: 'architect',
            },
            {
              title: 'Trailhead — Integration Architecture',
              url: 'https://trailhead.salesforce.com/content/learn/modules/integration-patterns-and-practices',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'sf-int-auth',
          title: 'OAuth 2.0, Named & External Credentials',
          summary:
            'Authenticate integrations the modern way with OAuth flows, and configure External Credentials for per-user or per-integration auth.',
          durationMinutes: 17,
          objectives: [
            'Explain the OAuth 2.0 flows relevant to integrations',
            'Choose the right flow for server-to-server vs user context',
            'Configure External + Named Credentials for auth',
          ],
          sections: [
            {
              heading: 'OAuth 2.0 in one picture',
              body:
                'OAuth lets a client obtain an access token to call an API on behalf of a user or system, without sharing passwords. Tokens are short-lived and scoped, so a leak is limited and revocable. Salesforce is both an OAuth provider (external apps get tokens to call Salesforce) and a consumer (Salesforce gets tokens to call external APIs).',
            },
            {
              heading: 'Pick the right flow',
              body:
                'Match the flow to the scenario:\n\n- JWT Bearer flow: server-to-server, no user interaction — ideal for CI/CD and backend integrations (this platform authorizes orgs this way).\n- Web Server (Authorization Code) flow: a user grants access in a browser — for apps acting on a user’s behalf.\n- Client Credentials flow: pure system-to-system with a dedicated integration user.\n\nAvoid the deprecated Username-Password flow; it stores credentials and lacks the safety of token-based flows.',
            },
            {
              heading: 'External and Named Credentials',
              body:
                'The modern setup separates two concerns: a Named Credential defines the endpoint/URL, and an External Credential defines the authentication (the OAuth flow, tokens, and a permission set that grants access). This lets admins manage auth centrally, support per-user tokens, and rotate secrets without code — the secure foundation for every callout you write.',
              code: {
                language: 'apex',
                snippet:
                  "// With External + Named Credentials configured, code stays clean:\nHttpRequest req = new HttpRequest();\nreq.setEndpoint('callout:ERP_System/api/v2/orders'); // auth handled by the credential\nreq.setMethod('GET');\nHttpResponse res = new Http().send(req);\n// No tokens, no client secret, no refresh logic in Apex.",
                caption: 'Auth lives in configuration; Apex just references the credential.',
              },
            },
          ],
          realWorld: {
            title: 'Replacing stored passwords with JWT',
            scenario:
              'A backend integration logged in with a stored username and password (Username-Password flow). A password reset broke the integration, and storing the password failed a security review.',
            solution:
              'They moved to the JWT Bearer flow with a certificate and a dedicated integration user, configured via External + Named Credentials — no password stored anywhere.',
            outcome:
              'The integration survived password policies, passed the security review, and tokens could be revoked instantly if ever compromised.',
          },
          keyTakeaways: [
            'OAuth issues short-lived, scoped tokens — no password sharing',
            'JWT Bearer = server-to-server; Authorization Code = on behalf of a user',
            'Avoid the deprecated Username-Password flow',
            'External Credential = auth, Named Credential = endpoint; managed in config, not code',
          ],
          resources: [
            {
              title: 'Salesforce Help — External Credentials and Named Credentials',
              url: 'https://help.salesforce.com/s/articleView?id=sf.nc_named_creds_and_ext_creds.htm',
              source: 'help',
            },
            {
              title: 'Trailhead — Identity Basics / OAuth',
              url: 'https://trailhead.salesforce.com/content/learn/modules/identity_login',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'sf-int-resilience',
          title: 'Bulk-safe, resilient integrations within limits',
          summary:
            'Design integrations that survive governor limits, partial failures, and retries — the difference between a demo and production.',
          durationMinutes: 18,
          objectives: [
            'Bulkify callouts and DML to respect governor limits',
            'Handle partial success and implement safe retries',
            'Make integrations idempotent and observable',
          ],
          sections: [
            {
              heading: 'Bulkify everything',
              body:
                'Salesforce enforces governor limits (e.g. 100 callouts, 150 DML statements per transaction). Never put a callout or DML inside a loop over records. Instead, collect work and act once. For many callouts, use asynchronous Apex (Queueable) which allows more callouts and does not block the user.',
              code: {
                language: 'apex',
                snippet:
                  "// BAD: callout per record — blows the limit on bulk loads\n// for (Account a : accounts) { makeCallout(a); }\n\n// GOOD: process in an async, bulk-aware job\npublic class SyncAccountsQueueable implements Queueable, Database.AllowsCallouts {\n    private List<Id> accountIds;\n    public SyncAccountsQueueable(List<Id> ids) { this.accountIds = ids; }\n    public void execute(QueueableContext ctx) {\n        for (Id accountId : accountIds) {\n            // one callout each, within a job sized to stay under limits\n            ExternalSync.push(accountId);\n        }\n    }\n}",
                caption: 'Queueable + Database.AllowsCallouts keeps bulk work under limits.',
              },
            },
            {
              heading: 'Partial success and retries',
              body:
                'Bulk operations can partially fail. Use Database.insert(records, false) to allow partial success and inspect each SaveResult, logging failures rather than throwing away the whole batch. For transient errors (timeouts, HTTP 429/5xx), retry with backoff — but cap the attempts and record failures so they are not lost.',
              code: {
                language: 'apex',
                snippet:
                  "Database.SaveResult[] results = Database.insert(records, false); // allOrNone = false\nfor (Integer i = 0; i < results.size(); i++) {\n    if (!results[i].isSuccess()) {\n        IntegrationLog__c log = new IntegrationLog__c(\n            Record_Ref__c = records[i].ExternalId__c,\n            Error__c = results[i].getErrors()[0].getMessage()\n        );\n        insert log; // capture, don't swallow\n    }\n}",
                caption: 'Partial success + a log object means one bad row never fails the batch.',
              },
            },
            {
              heading: 'Idempotency and observability',
              body:
                'Networks retry; make operations idempotent so a duplicate delivery does not create duplicate records — key on an external id and upsert instead of insert. Finally, make integrations observable: log correlation ids, statuses, and errors so you can answer "did message X arrive?" This is exactly what this platform’s Monitoring and job logs provide for its own pipelines.',
            },
          ],
          realWorld: {
            title: 'Surviving a partner outage',
            scenario:
              'An order integration threw an exception whenever the partner API returned an occasional 500, rolling back the entire nightly batch and losing all orders for the night.',
            solution:
              'They allowed partial success, retried transient errors with backoff, made the upsert idempotent on an external id, and logged every failure to a custom object.',
            outcome:
              'A partner hiccup now affected only the handful of failed rows, which retried automatically; nightly volume stopped being all-or-nothing, and operators could see exactly what failed and why.',
          },
          keyTakeaways: [
            'Never callout/DML in a loop; bulkify and use Queueable for many callouts',
            'Allow partial success and inspect SaveResults; log, don’t swallow, failures',
            'Retry transient errors with capped backoff',
            'Make operations idempotent (upsert on external id) and observable via logs',
          ],
          resources: [
            {
              title: 'Salesforce Developers — Governor Limits',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm',
              source: 'developer',
            },
            {
              title: 'Trailhead — Asynchronous Apex (Queueable)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/asynchronous_apex',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'sf-int-ps-q1',
          topic: 'Patterns',
          prompt: 'Which pattern fits "notify other systems that something happened, don’t wait"?',
          options: ['Request and Reply', 'Fire and Forget', 'Data Virtualization', 'Remote Call-In'],
          correctIndex: 1,
          explanation: 'Fire and Forget (e.g. Platform Events) publishes without waiting.',
        },
        {
          id: 'sf-int-ps-q2',
          topic: 'Patterns',
          prompt: 'Displaying external data live without storing it in Salesforce is…',
          options: ['Batch sync', 'Data/UI Virtualization (Salesforce Connect)', 'Fire and Forget', 'Request and Reply'],
          correctIndex: 1,
          explanation: 'Salesforce Connect / external objects virtualize external data.',
        },
        {
          id: 'sf-int-ps-q3',
          topic: 'Sync vs async',
          prompt: 'A synchronous callout inside a bulk trigger is risky because…',
          options: [
            'It is too readable',
            'It can hit callout/time limits and fail user saves',
            'It cannot use JSON',
            'It requires SOAP',
          ],
          correctIndex: 1,
          explanation: 'Per-record callouts on bulk loads breach limits and block saves.',
        },
        {
          id: 'sf-int-ps-q4',
          topic: 'OAuth',
          prompt: 'Which OAuth flow suits server-to-server (no user) integrations like CI/CD?',
          options: ['JWT Bearer', 'Implicit', 'Username-Password', 'Device'],
          correctIndex: 0,
          explanation: 'JWT Bearer authorizes backend integrations without user interaction.',
        },
        {
          id: 'sf-int-ps-q5',
          topic: 'OAuth',
          prompt: 'Why prefer OAuth tokens over stored passwords?',
          options: [
            'Tokens never expire',
            'Tokens are short-lived, scoped, and revocable',
            'Passwords are encrypted client-side',
            'Tokens are faster to type',
          ],
          correctIndex: 1,
          explanation: 'Short-lived, scoped tokens limit and contain any leak.',
        },
        {
          id: 'sf-int-ps-q6',
          topic: 'Credentials',
          prompt: 'In the modern model, what does an External Credential define?',
          options: [
            'The endpoint URL',
            'The authentication (OAuth flow, tokens, permissions)',
            'The Apex class name',
            'The org edition',
          ],
          correctIndex: 1,
          explanation: 'External Credentials define auth; Named Credentials define the endpoint.',
        },
        {
          id: 'sf-int-ps-q7',
          topic: 'Limits',
          prompt: 'To make many callouts on a bulk operation, you should…',
          options: [
            'Loop callouts in the trigger',
            'Use asynchronous Apex (Queueable with AllowsCallouts)',
            'Disable governor limits',
            'Use a formula field',
          ],
          correctIndex: 1,
          explanation: 'Async Apex provides higher callout capacity and does not block users.',
        },
        {
          id: 'sf-int-ps-q8',
          topic: 'Resilience',
          prompt: 'Allowing partial success on a bulk insert means…',
          options: [
            'The whole batch fails on one bad row',
            'Good rows commit; failures are captured individually',
            'No rows are saved',
            'Errors are ignored silently',
          ],
          correctIndex: 1,
          explanation: 'Database.insert(records, false) commits good rows and reports per-row errors.',
        },
        {
          id: 'sf-int-ps-q9',
          topic: 'Idempotency',
          prompt: 'The best way to avoid duplicates from a retried message is to…',
          options: [
            'Insert every time',
            'Upsert keyed on an external id (idempotent)',
            'Disable retries',
            'Delete then insert',
          ],
          correctIndex: 1,
          explanation: 'Upserting on an external id makes repeated deliveries harmless.',
        },
      ],
    },
  ],
};
