# Salesforce Academy — Training Explanations & 5-Minute Video Scripts

This document is the production companion for the newer Academy training tracks. For **every
concept (lesson)** added to the Academy it gives:

1. **Concept** — a plain-language explanation of what the lesson teaches.
2. **Real-world example** — a scenario → solution → outcome you can narrate on camera.
3. **A 5-minute video script** — timecoded, word-for-word narration with on-screen direction, so a
   presenter (or an AI avatar tool like HeyGen / Synthesia) can record a video and an admin can
   upload it against that lesson's **Video session**.

> Tracks covered here: **Salesforce Integration & API Mastery**, **JavaScript Engineering**,
> **Java Programming**, and **Release Management & DevOps**. The four original Salesforce paths
> (Foundations, Admin, Developer, Architect) already ship with in-app video-session scripts; this
> doc focuses on the concepts newly added.

## How to use this document

- Each lesson below maps 1:1 to a lesson id in the curriculum (`apps/api/src/modules/learning/curriculum/*.path.ts`).
- Record one video per lesson. Aim for **5 minutes** (~600–700 spoken words at a natural pace).
- Upload the finished video against the matching lesson via the admin video-upload flow (the
  "Video session" tab on each lesson). Uploaded videos are gated by the **`capability:video`**
  Academy permission, so only learners an admin has granted video access will see them.
- The bracketed timecodes are a guide, not a straitjacket — keep the energy up and the demos tight.

## Script conventions

- **NARRATION:** exactly what the presenter says.
- **ON SCREEN:** what the viewer sees (slides, screen recording, code, diagrams, click-paths).
- **[m:ss–m:ss]** marks the segment window inside the 5 minutes.
- Every script follows the same arc: **hook → concept(s) → live demo/code → real-world story → recap + next step.**

---

## Track: Salesforce Integration & API Mastery

### 1. Outbound REST callouts with Named Credentials  (`sf-int-rest-callouts`)

**Concept.** How to make Salesforce call an external REST API from Apex without hard-coding the URL
or secrets. You register the endpoint + authentication once as a **Named Credential**, then
reference it as `callout:Name` in an `HttpRequest`, and parse the JSON response into typed Apex.

**Real-world example.** A team hard-coded a vendor API key in Apex. A forced key rotation meant a
code change and redeploy in every org, and the old key leaked in Git history. Moving the endpoint
and key into a Named Credential turned rotation into a 2-minute Setup change with no code — closing
a security finding for good.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: title card "Callouts without secrets in your code".
  NARRATION: "Every real Salesforce org eventually needs to talk to another system — a payment
  gateway, a weather service, an ERP. Today you'll make Salesforce call an external API from Apex,
  the professional way: no URLs pasted into code, and no API keys sitting in your repo."
- **[0:30–1:30] The problem + Named Credentials.**
  ON SCREEN: split slide — left "the wrong way" (hard-coded URL + key), right "Named Credential".
  NARRATION: "The tempting way is to paste the endpoint and a key straight into Apex. Don't. Secrets
  end up in version control, and rotating a key becomes a redeploy. Salesforce gives us Named
  Credentials: you register the endpoint and its authentication once, in Setup, and Salesforce
  injects the credentials at runtime. Your code just references it by name."
- **[1:30–3:00] The callout, live.**
  ON SCREEN: Setup → Named Credentials creating "Weather_API"; then the Apex `HttpRequest` code.
  NARRATION: "Here's a Named Credential called Weather_API. Now in Apex I build an HttpRequest, and
  notice the endpoint starts with `callout:Weather_API` — Salesforce fills in the real host and auth.
  I set the method, and — this is important — I always set a timeout so a slow partner can't hang my
  transaction. I send it with the Http class, and I check the status code before trusting the body."
- **[3:00–3:50] Parsing JSON.**
  ON SCREEN: `JSON.deserializeUntyped` vs a typed wrapper class.
  NARRATION: "For a quick value, deserializeUntyped works. But for real payloads, define a small
  Apex class that mirrors the JSON and use JSON.deserialize — you get type safety and readable code.
  One more rule to burn in: never make a callout *after* a DML statement in the same transaction.
  Do your callouts first, then your DML."
- **[3:50–4:30] Real-world story.**
  NARRATION: "A team I know hard-coded a vendor key in Apex. When security forced a rotation, they
  had to edit and redeploy every org — and the old key was sitting in Git history. They moved it into
  a Named Credential, and rotation became a two-minute change in Setup. No code, no deploy."
- **[4:30–5:00] Recap + next.**
  ON SCREEN: three bullets — Named Credential, timeout + status check, callouts before DML.
  NARRATION: "So: never hard-code endpoints or secrets, always set a timeout and check the status,
  and keep callouts before DML. Next up — letting external systems call *into* Salesforce."

### 2. Exposing Apex as REST & SOAP web services  (`sf-int-apex-rest`)

**Concept.** How to let an external system call *into* Salesforce by publishing a custom endpoint
with `@RestResource` and `@HttpPost`/`@HttpGet`, when to prefer a custom Apex service over the
standard APIs, and how to keep the endpoint thin and secure.

**Real-world example.** A partner portal created an order with five separate standard API calls,
which was slow and could half-fail, orphaning records. A single Apex REST endpoint accepted the whole
order and created everything in one transaction — all-or-nothing — cutting latency and eliminating
partial failures.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: arrow flipping from "Salesforce → out" to "in → Salesforce".
  NARRATION: "Last time Salesforce called out. Now we flip the arrow: we'll let another system call
  *into* Salesforce, through an endpoint we design ourselves in Apex."
- **[0:30–1:20] When to build one.**
  ON SCREEN: slide — Standard APIs (REST/SOAP/Bulk/Composite) vs custom Apex REST.
  NARRATION: "Salesforce already ships powerful standard APIs. So build a custom Apex service only
  when you want a purpose-built operation that wraps business logic — like 'create an order and its
  line items in one call' — instead of making the caller orchestrate five requests."
- **[1:20–3:00] Building the endpoint.**
  ON SCREEN: the `@RestResource(urlMapping='/v1/orders/*')` class with an `@HttpPost createOrder`.
  NARRATION: "I annotate a global class with RestResource and a URL mapping, then add an HttpPost
  method. The endpoint lives under services slash apexrest. Watch what the method does: it validates
  input, delegates the real work to a service class, and returns a small result object that
  Salesforce serializes to JSON automatically. Keep the endpoint thin — it's a doorway, not the room."
- **[3:00–3:50] SOAP + security.**
  ON SCREEN: a note on `webservice` methods; then "with sharing" + CRUD/FLS highlighted.
  NARRATION: "Some legacy systems still need SOAP — Apex supports it with webservice methods — but
  prefer REST for anything new. And whatever you expose is an attack surface: run 'with sharing' and
  check object and field permissions. The caller authenticates with OAuth, which we'll cover soon."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A partner portal used to create an order with five standard calls. It was slow, and if
  the third call failed you got orphaned records. They replaced it with one Apex REST endpoint that
  created the whole order in a single transaction — so it either fully succeeded or fully rolled back.
  Latency dropped and partial failures vanished."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Custom endpoints wrap business logic, stay thin, and enforce security. Next: when you
  don't want a request/response call at all — event-driven integration."

### 3. Event-driven integration: Platform Events & Change Data Capture  (`sf-int-events`)

**Concept.** Decoupling systems with publish/subscribe so a producer never waits on a consumer.
Platform Events are custom events you publish with `EventBus.publish`; Change Data Capture streams
record create/update/delete events automatically with no code.

**Real-world example.** An ERP refreshed from Salesforce by a nightly batch, so data was up to a day
stale and caused overselling. Enabling Change Data Capture let the ERP subscribe and update within
seconds — cutting latency from 24 hours to near real time and retiring the fragile batch.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: two gears connected by a rigid rod (request/reply) vs by a conveyor belt (events).
  NARRATION: "Sometimes the best integration is the one where nobody waits. That's event-driven
  integration, and it's how resilient systems talk to each other."
- **[0:30–1:20] Why events.**
  ON SCREEN: slide — request/reply couples in time; pub/sub decouples.
  NARRATION: "In request/reply, the caller waits for the callee. If the callee is slow, everyone's
  slow. With events, a producer publishes 'this happened' and moves on. Any number of consumers react
  whenever they can. That's more resilient and it scales."
- **[1:20–2:50] Platform Events.**
  ON SCREEN: defining an `Order_Shipped__e` event; publishing with `EventBus.publish`; a subscriber trigger.
  NARRATION: "A Platform Event is a custom event definition — notice the __e suffix. Publishing is
  just a call to EventBus.publish, so it feels like familiar DML and it's bulk-friendly. Subscribers
  can be Apex triggers, Flows, or external systems over the streaming API. Here a trigger on the event
  notifies the customer when their order ships."
- **[2:50–3:50] Change Data Capture.**
  ON SCREEN: enabling CDC on Order + Product; an external subscriber updating.
  NARRATION: "Sometimes you don't need a custom event — you just need to know a record changed.
  That's Change Data Capture. Enable it on an object and Salesforce publishes create, update, delete,
  and undelete events automatically, no code. External systems subscribe to stay in sync in near
  real time. Rule of thumb: custom business event, use a Platform Event; 'a record changed', use CDC."
- **[3:50–4:35] Real-world story.**
  NARRATION: "An ERP used to sync from Salesforce with a nightly batch, so inventory could be a day
  out of date — and they oversold. They turned on Change Data Capture; the ERP now updates within
  seconds of each change. Latency went from a day to near real time, and the nightly batch was
  retired."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Events decouple producers and consumers, Platform Events carry your payload, CDC streams
  record changes for free. Next we'll name the patterns that tie all of this together."

### 4. The enterprise integration patterns  (`sf-int-patterns`)

**Concept.** The five patterns that describe most Salesforce integrations — Request and Reply,
Fire and Forget, Batch Data Synchronization, Remote Call-In, and UI/Data Virtualization — and how to
match a pattern to a business need, including the synchronous-vs-asynchronous trade-off.

**Real-world example.** A trigger made a synchronous callout to a tax service on every Opportunity
save; a 5,000-record load hit limits and every save failed. Switching to an asynchronous,
event-driven approach (publish an event, a queueable consumer calls the service in bulk) made bulk
loads succeed and user saves instant again.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a 2x2 of icons for the patterns.
  NARRATION: "Before you write a line of integration code, pick the right *pattern*. Choosing well
  here matters more than any clever code you'll write."
- **[0:30–2:15] The five patterns.**
  ON SCREEN: one line per pattern with an example.
  NARRATION: "Five patterns cover most needs. Request and Reply: Salesforce calls out and waits —
  good for an instant answer like address validation. Fire and Forget: Salesforce sends and doesn't
  wait — Platform Events, notifications. Batch Data Synchronization: scheduled bulk import/export for
  large volumes. Remote Call-In: an external system calls into Salesforce to create or update data.
  And UI or Data Virtualization: show external data live, without storing it, using Salesforce
  Connect."
- **[2:15–3:20] Sync vs async.**
  ON SCREEN: a slider from synchronous to asynchronous with pros/cons.
  NARRATION: "Synchronous is simple but it couples systems and burns strict limits — callout time,
  concurrency. Asynchronous adds resilience and scale, but you accept eventual consistency. The
  classic mistake is a synchronous callout inside a trigger during a bulk load. Don't make a slow
  partner able to fail a user's save."
- **[3:20–4:10] Choosing well + story.**
  ON SCREEN: three questions — now or later? one record or millions? who starts it?
  NARRATION: "Ask three questions: does the user need the answer right now, or can it happen later?
  One record, or millions? Who initiates — Salesforce, or the other system? A team once put a
  synchronous tax callout in an Opportunity trigger. A five-thousand-record load blew the limits and
  every save failed. They moved it to an event plus a queueable consumer that called the service in
  bulk. Loads succeeded, saves were instant."
- **[4:10–5:00] Recap + next.**
  NARRATION: "Know the five patterns, weigh sync against async, and never force a synchronous callout
  into a bulk trigger. Next: how these integrations authenticate — OAuth and credentials."

### 5. OAuth 2.0, Named & External Credentials  (`sf-int-auth`)

**Concept.** How integrations authenticate with OAuth 2.0 — short-lived, scoped tokens instead of
shared passwords — which flow to pick (JWT Bearer for server-to-server, Authorization Code for
user-context), and how External Credentials (auth) pair with Named Credentials (endpoint).

**Real-world example.** A backend integration logged in with a stored username and password; a
password reset broke it and storing the password failed a security review. Moving to the JWT Bearer
flow with a dedicated integration user — configured via External + Named Credentials — removed the
stored password and passed the review.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a password with a red X, a token with a green check.
  NARRATION: "If your integration stores a password, you have a problem waiting to happen. Let's do
  authentication the modern way: OAuth."
- **[0:30–1:30] OAuth in one picture.**
  ON SCREEN: client → authorization server → access token → API.
  NARRATION: "OAuth lets a client get a short-lived, scoped access token to call an API — without
  ever sharing a password. Because tokens expire and are limited in scope, a leak is contained and
  revocable. Salesforce plays both sides: it hands tokens to external apps, and it gets tokens to
  call external APIs."
- **[1:30–2:50] Pick the right flow.**
  ON SCREEN: table — JWT Bearer, Authorization Code, Client Credentials, and a crossed-out
  Username-Password.
  NARRATION: "Match the flow to the scenario. JWT Bearer: server-to-server, no human — perfect for
  CI/CD and backend jobs. Authorization Code: a user grants access in a browser, for apps acting on
  their behalf. Client Credentials: pure system-to-system with a dedicated integration user. And
  avoid the old Username-Password flow — it stores credentials and lacks the safety of tokens."
- **[2:50–3:50] External + Named Credentials.**
  ON SCREEN: Setup showing an External Credential (auth) linked to a Named Credential (endpoint);
  then the clean Apex callout.
  NARRATION: "Modern Salesforce splits this into two pieces. A Named Credential defines the endpoint.
  An External Credential defines the authentication — the OAuth flow, the tokens, and a permission set
  that grants access. Admins manage auth centrally and rotate secrets without code. Look how clean the
  Apex stays: just `callout:ERP_System` — no tokens, no client secret, no refresh logic."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A backend integration used to log in with a stored username and password. A routine
  password reset broke it, and storing that password failed a security review. They switched to JWT
  Bearer with a dedicated integration user, configured through External and Named Credentials. No
  password stored anywhere, and tokens can be revoked instantly."
- **[4:35–5:00] Recap + next.**
  NARRATION: "OAuth gives short-lived scoped tokens; JWT for servers, Authorization Code for users;
  auth lives in credentials, not code. Last stop: making integrations survive the real world."

### 6. Bulk-safe, resilient integrations within limits  (`sf-int-resilience`)

**Concept.** Designing integrations that survive governor limits, partial failures, and retries:
bulkify callouts/DML, use asynchronous Apex for many callouts, allow partial success, retry transient
errors with backoff, and make operations idempotent and observable.

**Real-world example.** An order integration threw on the partner's occasional HTTP 500, rolling back
the entire nightly batch and losing every order for the night. Allowing partial success, retrying
transient errors, and upserting on an external id meant a partner hiccup only affected a handful of
rows, which retried automatically.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: "Works in the demo" vs "Works at 2 a.m. under load".
  NARRATION: "Anyone can make an integration work in a demo. The difference between a demo and
  production is how it behaves under load, and when the other side misbehaves. Let's make it bullet-proof."
- **[0:30–1:40] Bulkify + go async.**
  ON SCREEN: a callout-in-a-loop with a red X; a Queueable implementing `Database.AllowsCallouts`.
  NARRATION: "Salesforce enforces governor limits — a cap on callouts and DML per transaction. So
  never put a callout or DML inside a loop over records. Collect the work and act once. And when you
  need many callouts, move to asynchronous Apex — a Queueable that allows callouts — which gives you
  more capacity and never blocks the user's save."
- **[1:40–3:00] Partial success + retries.**
  ON SCREEN: `Database.insert(records, false)` looping over SaveResults into a log object.
  NARRATION: "Bulk operations can partly fail. Insert with allOrNone set to false so good rows commit,
  then inspect each SaveResult and log the failures instead of throwing away the whole batch. For
  transient errors — timeouts, 429s, 500s — retry with backoff, but cap the attempts and record what
  failed so nothing is silently lost."
- **[3:00–3:50] Idempotency + observability.**
  ON SCREEN: `upsert` on an external id; a log record with a correlation id.
  NARRATION: "Networks retry, so make operations idempotent: key on an external id and upsert, so a
  duplicate delivery can't create duplicate records. And make it observable — log correlation ids and
  statuses so you can answer 'did message X arrive?'. That's exactly what this platform's Monitoring
  and job logs give you."
- **[3:50–4:35] Real-world story.**
  NARRATION: "An order integration used to throw whenever the partner returned a 500, rolling back the
  entire nightly batch — losing every order for the night. They allowed partial success, retried
  transient errors, and made the upsert idempotent on an external id. Now a partner hiccup touches only
  the failed rows, which retry themselves."
- **[4:35–5:00] Recap + close.**
  NARRATION: "Bulkify and go async, allow partial success, retry transients, be idempotent and
  observable. Do that, and your integration survives the real world. That completes the Integration
  track — go build something that connects."

## Track: JavaScript Engineering

### 1. Values, variables, and types  (`js-values-types`)

**Concept.** Declaring variables with `const`/`let` (and why `var` is avoided), the seven primitive
types and how `typeof` reports them, and the coercion traps around `==` vs `===` and truthy/falsy —
plus `??` for defaulting only on null/undefined.

**Real-world example.** A cart hid the price of free products because `if (product.price)` treats `0`
as falsy. Switching to an explicit `!= null` check and `price ?? 0` fixed it and killed a whole class
of coercion bugs.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: title "JavaScript: get the fundamentals right".
  NARRATION: "JavaScript runs the web — and it runs Lightning Web Components. Before frameworks, you
  need the fundamentals. Let's start with values, variables, and the traps that bite beginners."
- **[0:30–1:30] const, let, not var.**
  ON SCREEN: code — `const taxRate`, `let subtotal`, a for-of loop.
  NARRATION: "Two declarations matter: const, which you can't reassign, and let, which you can. Old
  var is function-scoped and hoists in confusing ways, so professionals skip it. Default to const —
  it tells the next reader 'this never changes' — and reach for let only when a value truly changes,
  like a loop accumulator."
- **[1:30–2:30] Types + typeof.**
  ON SCREEN: a list of the seven primitives; `typeof` results including `null → "object"`.
  NARRATION: "There are seven primitive types — string, number, boolean, null, undefined, bigint,
  symbol — and everything else is an object. There's one number type, no separate int and float. And
  a famous quirk: typeof null returns the string 'object'. It's a historical bug; just remember it."
- **[2:30–3:45] Equality + truthiness.**
  ON SCREEN: `0 == '' // true` vs `0 === '' // false`; the falsy list.
  NARRATION: "Always use triple-equals. Double-equals coerces types and gives you surprises like zero
  equals empty string being true. Conditions coerce to boolean, and the falsy values are exactly
  false, zero, empty string, null, undefined, NaN, and zero-n. Everything else — including the string
  '0' and an empty array — is truthy."
- **[3:45–4:30] Real-world story + `??`.**
  ON SCREEN: buggy `if (product.price)`; fixed with `!= null` and `price ?? 0`.
  NARRATION: "Here's a real bug: a cart hid the price of *free* products, because a price of zero is
  falsy, so `if (product.price)` skipped them. The fix: check `price != null`, and use the nullish
  operator — `price ?? 0` — which defaults only on null or undefined, never on a real zero."
- **[4:30–5:00] Recap + next.**
  NARRATION: "Const by default, know your types and the null quirk, triple-equals and nullish
  coalescing. Next: functions, scope, and the superpower called closures."

### 2. Functions, scope, and closures  (`js-functions-scope`)

**Concept.** The three ways to write functions (declaration, expression, arrow — and how arrows
inherit `this`), lexical/block scope and the scope chain, and closures — functions that "remember"
the variables in scope when they were created, enabling private state and debouncing.

**Real-world example.** A search box fired an API call on every keystroke, returning stale,
out-of-order results. A `debounce` helper used a closure to remember a timer between calls, cutting
API calls by over 90% and stopping the flicker.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: "Closures — the most powerful idea in JavaScript".
  NARRATION: "If you learn one JavaScript idea deeply, make it closures. But first, three ways to
  write a function and the rules of scope."
- **[0:30–1:30] Three functions.**
  ON SCREEN: declaration, expression, arrow side by side; `.map((n) => sq(n))`.
  NARRATION: "A function declaration is hoisted — callable before it's defined. An expression assigns
  a function to a variable. An arrow function is concise and — crucially — doesn't bind its own
  `this`; it inherits `this` from around it, which is exactly what you want inside callbacks and LWC
  methods."
- **[1:30–2:30] Lexical scope.**
  ON SCREEN: nested functions; inner reads outer, outer can't read inner.
  NARRATION: "Scope is decided by where code is written, not where it's called. An inner function can
  read variables from every enclosing scope — the scope chain — but outer scopes can't see inner
  variables. And let and const are block-scoped, so each loop iteration gets a fresh binding."
- **[2:30–3:40] Closures.**
  ON SCREEN: `createCounter()` returning methods that close over a private `count`.
  NARRATION: "A closure is a function bundled with the variables that were in scope when it was
  created — it keeps them alive even after the outer function returns. Here, createCounter returns
  methods that share a private count variable. Nothing outside can touch count; only the returned
  methods can. That's true private state, built from a closure."
- **[3:40–4:30] Real-world story.**
  ON SCREEN: a debounce helper storing a timer id in a closure.
  NARRATION: "A search box once fired an API call on every keystroke — hammering the server, results
  arriving out of order. The fix was a debounce helper: it uses a closure to remember a timer between
  calls and cancels the previous one, so the query only runs when you pause typing. API calls dropped
  over ninety percent."
- **[4:30–5:00] Recap + next.**
  NARRATION: "Declarations hoist, arrows inherit this, scope is lexical, and closures capture their
  surroundings. Next: modeling data with objects and arrays."

### 3. Objects, arrays, and iteration  (`js-objects-arrays`)

**Concept.** Modeling JSON with objects and arrays, safe nested access with `?.` and `??`,
destructuring/spread/rest for cleaner code and immutable copies, and transforming collections with
`map`/`filter`/`reduce`.

**Real-world example.** A component built per-stage totals from hundreds of records using nested
loops that were hard to change. Rewriting it with `reduce` into a `{ stage: total }` map made the
logic a few lines, trivially testable, and easy to extend.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a JSON payload morphing into a dashboard number.
  NARRATION: "Data from Salesforce arrives as JSON — objects and arrays. Learn to model and transform
  it cleanly and half your code writes itself."
- **[0:30–1:30] Objects, arrays, safe access.**
  ON SCREEN: an `account` object; `account.owner?.alias`; `account.billing?.city ?? 'N/A'`.
  NARRATION: "An object is key-value pairs; an array is an ordered list — together they model any API
  payload. Read with dot or bracket notation, and use optional chaining, the question-dot, to read
  deep properties without crashing on undefined. Pair it with nullish coalescing for a safe default."
- **[1:30–2:30] Destructuring, spread, rest.**
  ON SCREEN: `const { name, owner } = account`; `{ ...account, name: 'Acme Inc' }`.
  NARRATION: "Destructuring pulls values into variables in one line. The spread operator copies and
  merges arrays and objects — a shallow copy, which is perfect for immutable updates: here I make a
  new object with the name overridden, without mutating the original. Rest gathers 'the remaining'
  items."
- **[2:30–3:50] map, filter, reduce.**
  ON SCREEN: the opps pipeline `filter → map → reduce` producing 3000.
  NARRATION: "Prefer three array methods over manual loops: map transforms each item, filter keeps
  some, and reduce collapses to a single value. They return new arrays, leave the original untouched,
  and read like a description of intent. Here I filter to Won, map to amounts, and reduce to a total.
  This immutable style is exactly what LWC expects."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A component needed per-stage totals from hundreds of opportunities. The original used
  nested loops and mutable maps — hard to change. Rewritten with a single reduce into a stage-to-total
  map, it shrank to a few lines, unit tests became trivial, and adding an 'average deal size' metric
  was one line."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Objects and arrays model JSON, question-dot reads it safely, and map-filter-reduce
  transforms it immutably. Next: asynchronous JavaScript."

### 4. Promises, async/await, and the event loop  (`js-async`)

**Concept.** Why JavaScript is single-threaded yet non-blocking (the event loop and microtask
queue), how promises move from pending to fulfilled/rejected, how `async/await` reads like
synchronous code with `try/catch`, and using `Promise.all` for concurrency.

**Real-world example.** A record page awaited three independent Apex calls one after another (~1s
total). Firing them together with `Promise.all` cut the wait to roughly the slowest single call.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a single lane with cars queueing but never colliding.
  NARRATION: "JavaScript has one thread, yet a slow network call never freezes your UI. The secret is
  the event loop — and the tools you'll use daily are promises and async/await."
- **[0:30–1:20] The event loop.**
  ON SCREEN: call stack, task queue, microtask queue.
  NARRATION: "Your code runs on a single thread. Long operations — network, timers — are handed off;
  when they finish, their callbacks queue up, and the event loop runs them once the stack is clear.
  Promise callbacks go on a higher-priority microtask queue, which is why a resolved promise beats a
  setTimeout of zero."
- **[1:20–2:30] Promises.**
  ON SCREEN: a `fetch().then().catch().finally()` chain.
  NARRATION: "A promise represents a value that will exist later — pending, then either fulfilled with
  a value or rejected with an error. then handles success, catch handles failure, finally always runs.
  And they chain: returning a value from a then feeds the next one. Here I fetch, check the status,
  parse JSON, render, handle errors, and hide the spinner."
- **[2:30–3:45] async/await + Promise.all.**
  ON SCREEN: `loadDashboard` awaiting `Promise.all([...])` inside try/catch.
  NARRATION: "An async function always returns a promise, and inside it await pauses until a promise
  settles and hands you the value — so you write top-to-bottom code and use ordinary try/catch. When
  operations are independent, don't await them one by one; start them together with Promise.all and
  await the whole set."
- **[3:45–4:35] Real-world story.**
  NARRATION: "A record page awaited three independent Apex calls in sequence — about three hundred
  milliseconds each, nearly a second total. They had no dependency on each other, so the fix was
  Promise.all: fire all three together. Total wait dropped to roughly the slowest single call. Same
  data, a third of the time."
- **[4:35–5:00] Recap + next.**
  NARRATION: "One thread, an event loop, promises that settle, async/await for readable code, and
  Promise.all for concurrency. Next: organizing code with modules and classes."

### 5. ES modules, classes, and the DOM  (`js-modules-dom`)

**Concept.** Splitting code into ES modules with `import`/`export`, modeling behavior with classes
(`constructor`, `extends`, `super`, getters), and responding to user events by listening on the DOM
— all directly transferable to LWC.

**Real-world example.** Currency was formatted inconsistently across a dozen components. A single
`money.js` module exporting one `format()` made formatting consistent instantly, and a later change
touched exactly one file.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: scattered files snapping into tidy modules.
  NARRATION: "Real apps are many files, not one. ES modules, classes, and the DOM are how you organize
  and wire them — and they're exactly what LWC is built on."
- **[0:30–1:30] ES modules.**
  ON SCREEN: `money.js` with named exports; `invoice.js` importing them.
  NARRATION: "Modules let each file expose only what it chooses with export, and consume others with
  import — the same system LWC uses. Prefer named exports for utilities, where a file has several, and
  a default export for the one main thing a file provides."
- **[1:30–2:40] Classes.**
  ON SCREEN: `class Shape` and `class Circle extends Shape` with a `get area()`.
  NARRATION: "A class is a template for objects, with fields and methods. The constructor initializes
  instances, extends inherits, and super calls the parent. A getter defines a computed property. This
  matters because an LWC component is authored as a class that extends LightningElement — so this
  syntax transfers directly."
- **[2:40–3:40] The DOM + events.**
  ON SCREEN: `querySelector` + `addEventListener('click', ...)`.
  NARRATION: "In the browser, the DOM is the live tree of elements. You select a node, listen for an
  event, and update content or state in response. Frameworks abstract most of this away, but
  understanding it explains what LWC does under the hood — and how event bubbling lets a parent handle
  a child's event."
- **[3:40–4:30] Real-world story.**
  NARRATION: "Currency used to be formatted a dozen different ways across an app — '$1000' here,
  '1,000.00' there — confusing users and auditors. One money.js module exported a single format
  function; every component imported it. Formatting became consistent overnight, and later adding
  currency codes changed exactly one file."
- **[4:30–5:00] Recap + next.**
  NARRATION: "Modules expose what you export, classes bundle state and behavior, the DOM plus
  addEventListener is what frameworks build on. Next: all of it, together, in a Lightning Web
  Component."

### 6. JavaScript in Salesforce: Lightning Web Components  (`js-in-salesforce`)

**Concept.** How everything so far comes together in an LWC — the three-file structure, reactive
`@api` properties, calling Apex with `@wire` vs imperatively (awaited), and parent/child
communication with `CustomEvent`.

**Real-world example.** A developer who'd only learned JavaScript basics built a contacts panel in a
day, because an LWC is "just" an ES module exporting a class with async methods — the fundamentals
did the heavy lifting.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: the JS logo turning into the LWC logo.
  NARRATION: "Everything you've learned — modules, classes, arrows, async — now pays off. Let's build
  a real Lightning Web Component and watch the fundamentals do the work."
- **[0:30–1:20] Anatomy of an LWC.**
  ON SCREEN: a folder with `.html`, `.js`, `.js-meta.xml`; the `AccountTile` class.
  NARRATION: "An LWC is a folder with three files: a template, a JavaScript class that extends
  LightningElement, and a config XML. Class fields are reactive — change a tracked field and the
  template re-renders. The `@api` decorator makes a property public, set by the parent. Everything
  you know about modules, classes, and arrow functions applies directly."
- **[1:20–2:50] Calling Apex.**
  ON SCREEN: `@wire` vs imperative `await getContacts(...)` in `connectedCallback`.
  NARRATION: "To read Salesforce data you call an Apex method. `@wire` declaratively provisions data
  and re-runs when its inputs change — great for read-only display. The imperative style calls the
  method like the async function it is; you await it, which gives you full control for button clicks
  and DML. Here I await getContacts in connectedCallback and catch errors into a field."
- **[2:50–3:50] Events + errors.**
  ON SCREEN: `dispatchEvent(new CustomEvent('select', { detail }))`; parent `onselect`.
  NARRATION: "Children talk to parents by dispatching a CustomEvent; the parent listens with on-plus-
  the-event-name. That's DOM event bubbling applied to components. And Apex errors arrive as objects
  with a body-dot-message — surface them to the user, don't let them vanish into the console."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A new developer who'd only learned JavaScript basics was asked to build a contacts panel
  on the account page. Because an LWC is just an ES module exporting a class with async methods, they
  reused everything from this track — imported an Apex method, awaited it, mapped the results,
  dispatched an event on row click. Shipped in a day."
- **[4:35–5:00] Recap + close.**
  NARRATION: "An LWC is a class extending LightningElement, reactive fields re-render, @wire is
  declarative and imperative Apex is an awaited call, and components talk with CustomEvents. The
  'Salesforce-specific' part is small — your JavaScript fundamentals carry you. That's the track."

## Track: Java Programming

### 1. Syntax, types, and control flow  (`java-syntax`)

**Concept.** Running a first Java program from `main`, the difference between primitive and reference
types (and comparing objects with `equals()` not `==`), and control flow with `if`, the `switch`
expression, and the loop family. Apex mirrors Java, so these skills transfer.

**Real-world example.** A batch job summed order amounts stored as text; a dynamically typed script
silently concatenated strings ("100" + "250" = "100250"). In Java the type error was caught at
compile time, forcing a correct `Integer.parseInt`.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: "Java — and why it makes you a better Apex developer".
  NARRATION: "Java is strongly typed and object-oriented, and Apex is modeled directly on it. Learn
  Java and you deepen your Salesforce coding at the same time. Let's start from `main`."
- **[0:30–1:20] Everything in a class.**
  ON SCREEN: the `Hello` class with `public static void main`.
  NARRATION: "Java is compiled and statically typed: you declare types, the compiler checks them, and
  it produces bytecode for the JVM. Every program starts in a public static void main method inside a
  class. If you've written Apex, this signature already feels like home."
- **[1:20–2:40] Primitive vs reference.**
  ON SCREEN: eight primitives; `a == b` vs `a.equals(b)`.
  NARRATION: "Java has eight primitive types that hold values directly — int, double, boolean, and so
  on. Everything else — String, arrays, your own classes — is a reference type. Two rules to burn in:
  primitives can't be null but references can; and to compare object *content*, use the equals method
  — double-equals on references compares identity, not value."
- **[2:40–3:45] Control flow.**
  ON SCREEN: a for-each loop summing amounts; a switch expression returning a tier.
  NARRATION: "You get if-else, a switch — including the modern arrow form — and three loops: classic
  for, enhanced for-each, and while. Prefer for-each when you just need each element. And the switch
  *expression* returns a value directly, which is cleaner than assigning inside cases."
- **[3:45–4:35] Real-world story.**
  NARRATION: "A batch job summed order amounts that were stored as text. In a dynamically typed
  script it silently concatenated them — '100' plus '250' became the string '100250' — and shipped a
  wrong total. Rewritten in Java, passing a String where an int was expected failed at compile time,
  forcing an explicit, correct parse. The bug was impossible to ship."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Compiled and typed, start in main, primitives versus references, equals for content,
  and clean control flow. Next: object-oriented design — the heart of Java."

### 2. Classes, objects, and interfaces  (`java-oop`)

**Concept.** Modeling with classes and encapsulation (private fields guarding invariants), the four
OOP pillars, inheritance and polymorphism with `@Override`, and programming to interfaces for
decoupled, testable code.

**Real-world example.** A checkout hard-coded one payment provider; adding a second rippled through
dozens of classes. Introducing a `PaymentGateway` interface meant a new provider was one new class,
with zero changes to `Checkout`.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: "Program to interfaces, not implementations".
  NARRATION: "Object-oriented design is Java's heart, and one principle will save you again and again:
  depend on abstractions. Let's build up to it."
- **[0:30–1:40] Classes + encapsulation.**
  ON SCREEN: `Account` with private `balance` and a guarded `deposit`.
  NARRATION: "A class bundles state — fields — and behavior — methods. Encapsulation means keeping
  fields private and exposing controlled methods, so the object enforces its own rules. Here balance
  is private and deposit rejects a non-positive amount, so balance can never be corrupted from
  outside. That's the first of the four pillars: encapsulation, inheritance, polymorphism,
  abstraction."
- **[1:40–2:50] Inheritance + polymorphism.**
  ON SCREEN: `EmailNotification extends Notification` with `@Override`; runtime dispatch.
  NARRATION: "A class can extend another to reuse and specialize behavior, overriding methods — mark
  them with the Override annotation. Polymorphism means code written against the base type works for
  any subtype: I hold an EmailNotification in a Notification variable, call send, and the JVM
  dispatches to the email version at runtime."
- **[2:50–3:55] Interfaces.**
  ON SCREEN: `PaymentGateway` interface; `Checkout` taking it via the constructor.
  NARRATION: "An interface declares *what* an object can do without saying *how*. Classes implement
  it, and callers depend on the interface, not the concrete class. Checkout takes a PaymentGateway in
  its constructor — so I can pass a real Stripe gateway in production and a fake one in tests, and add
  new providers without touching Checkout."
- **[3:55–4:35] Real-world story.**
  NARRATION: "A checkout service hard-coded calls to one payment provider. When the company added a
  second for a new region, the change rippled through dozens of classes. They introduced a
  PaymentGateway interface; Checkout depended only on it. The second provider became one new class,
  with zero changes to Checkout, and tests used a fake gateway."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Classes encapsulate, the four pillars, Override plus runtime dispatch, and program to
  interfaces to decouple and test. Next: the collections you'll use every day."

### 3. Collections and generics  (`java-collections`)

**Concept.** Choosing between `List`, `Set`, and `Map`, programming to the interface while
instantiating a concrete class, and using generics for compile-time type safety — plus accumulating
into Maps to count/group (the same pattern as Apex).

**Real-world example.** A nightly import produced duplicate customers because the same email arrived
in multiple files. Collecting emails into a `HashSet` dropped duplicates and sped the import with
O(1) lookups.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: three buckets labeled List, Set, Map.
  NARRATION: "Pick the right container and half your bugs disappear. Java gives you three you'll use
  constantly — List, Set, and Map — and generics to keep them type-safe."
- **[0:30–1:40] The core types.**
  ON SCREEN: `List<String> x = new ArrayList<>()`; Set and Map examples.
  NARRATION: "List is ordered and allows duplicates — usually ArrayList. Set holds unique elements —
  HashSet for speed, LinkedHashSet to keep order. Map is key to value — HashMap, or LinkedHashMap for
  order. Always declare the interface type and instantiate a concrete class, so you can swap the
  implementation later. Apex has the very same List, Set, and Map trio."
- **[1:40–2:50] Generics.**
  ON SCREEN: `names.add(42)` failing to compile; `getOrDefault`.
  NARRATION: "Generics — the angle brackets — tell a collection what it holds, so the compiler stops
  you putting the wrong type in and removes casts on the way out. Try to add a number to a list of
  strings and it won't compile. That turns whole classes of runtime cast exceptions into compile
  errors you fix in seconds."
- **[2:50–3:50] Iterating + grouping.**
  ON SCREEN: `counts.merge(stage, 1, Integer::sum)` building `{Won=3, Lost=1}`.
  NARRATION: "Use for-each for simple iteration, and entrySet to walk key-value pairs. To build a
  summary, accumulate into a Map — here merge increments an existing count or seeds it at one. This
  is exactly the technique you use in Apex trigger handlers to bucket records by a field."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A nightly import created duplicate customers because the same email arrived in several
  files. They collected emails into a HashSet before inserting; the Set silently dropped duplicates,
  and a HashMap keyed by email held the winning record. Duplicates vanished and the import got faster
  — O(1) lookups instead of scanning a list."
- **[4:35–5:00] Recap + next.**
  NARRATION: "List, Set, Map for the right job; declare the interface; generics for safety; Maps to
  group. Next: writing robust Java that survives failure."

### 4. Exceptions and try-with-resources  (`java-exceptions`)

**Concept.** Checked vs unchecked exceptions, handling them without swallowing errors, translating
low-level failures into meaningful domain exceptions, and closing resources automatically with
try-with-resources.

**Real-world example.** A report job opened thousands of files but a refactor removed the `finally`
that closed them; the JVM ran out of file handles and crashed. Rewriting every open as
try-with-resources made the leak structurally impossible.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: "Handle failure on purpose".
  NARRATION: "Robust code plans for things going wrong. In Java that means exceptions used well — and
  resources that always close, even when they don't."
- **[0:30–1:30] Checked vs unchecked.**
  ON SCREEN: `Exception` vs `RuntimeException`; an empty catch with a red X.
  NARRATION: "A checked exception extends Exception and the compiler forces you to declare or handle
  it — good for expected, recoverable failures like I/O. An unchecked exception extends
  RuntimeException and signals a programming bug like a null dereference. And never write an empty
  catch block — swallowing an exception hides the very bug you need to see."
- **[1:30–2:45] try/catch + custom exceptions.**
  ON SCREEN: catching `NumberFormatException`, rethrowing an `OrderException` that keeps the cause.
  NARRATION: "Catch the most specific exception you can actually handle, add context, and translate it
  into a domain exception — keeping the original as the cause. Here a bad quantity throws a
  NumberFormatException, and I rethrow an OrderException that says which value was invalid. Now the
  error message is meaningful to whoever's on call."
- **[2:45–3:50] try-with-resources.**
  ON SCREEN: a `BufferedReader` in a try-with-resources header.
  NARRATION: "Anything that implements AutoCloseable — files, connections, HTTP clients — can go in a
  try-with-resources header, and Java closes it automatically, in reverse order, even if an exception
  is thrown. This replaces error-prone manual finally blocks entirely."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A report job opened thousands of files in a loop and closed them in a finally block —
  until a refactor accidentally removed it. After a few hours the JVM ran out of file descriptors and
  crashed. They rewrote every open as try-with-resources, which guarantees closure no matter what.
  The leak became structurally impossible."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Checked versus unchecked, never swallow, translate with context, and try-with-resources
  for anything closeable. Next: functional Java with lambdas and streams."

### 5. Lambdas and the Streams API  (`java-streams`)

**Concept.** Lambdas and method references implementing functional interfaces, lazy stream pipelines
(intermediate ops + one terminal op) that don't mutate the source, and grouping/summarizing with
`Collectors.groupingBy`.

**Real-world example.** A revenue report used nested loops and mutable maps and was buggy. Rewriting
it with streams and `groupingBy` made it self-documenting, and switching to a parallel stream sped up
the largest report with no logic change.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: 40 lines of loops collapsing into 3 lines of stream.
  NARRATION: "Modern Java lets you describe *what* you want instead of *how* to loop. Lambdas and
  streams turn pages of loops into a few readable lines."
- **[0:30–1:30] Lambdas + method references.**
  ON SCREEN: `Predicate<String> isLong = s -> s.length() > 5`; `String::length`.
  NARRATION: "A lambda is a short anonymous function you assign to a functional interface — one with
  a single abstract method, like Predicate or Function. And a method reference, Class-colon-colon-
  method, is even shorter when a lambda just calls one method. If you did the JavaScript track, these
  are Java's arrow functions."
- **[1:30–2:45] Stream pipelines.**
  ON SCREEN: `opps.stream().filter(...).mapToDouble(...).sum()`.
  NARRATION: "A stream is a lazy pipeline over a data source. Intermediate operations like filter and
  map return a new stream; a terminal operation like sum, collect, or count triggers the work. Nothing
  mutates the source. Here I filter to Won opportunities, map to their amounts, and sum — the exact
  shape of the JavaScript pipeline, in Java."
- **[2:45–3:50] Grouping with Collectors.**
  ON SCREEN: `groupingBy(Opp::stage, summingDouble(Opp::amount))` → `{Won=3000.0, Lost=500.0}`.
  NARRATION: "The Collectors utility turns a stream into grouped or aggregated results. groupingBy
  builds a Map keyed by a classifier, and a downstream collector like summingDouble summarizes each
  group in one pass. That's a pivot table in a single line."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A revenue report computed totals per region and per stage with nested loops and mutable
  maps — long, and a source of off-by-one bugs. Rewritten with streams and groupingBy, it became
  self-documenting, the bugs disappeared with the mutable state, and switching to a parallel stream
  sped up the biggest report without changing a line of logic."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Lambdas implement single-method interfaces, streams are lazy pipelines that don't
  mutate, and groupingBy pivots your data. Last Java lesson: doing work in parallel, safely."

### 6. Concurrency essentials  (`java-concurrency`)

**Concept.** Running work in parallel with an `ExecutorService` and `Future` instead of raw threads,
recognizing and avoiding race conditions (immutability, `AtomicInteger`, `ConcurrentHashMap`), and
how this maps to Apex asynchronous processing.

**Real-world example.** A service synced 20 endpoints sequentially (20+ seconds) and a careless
"go parallel" corrupted a shared counter. A fixed thread pool with Futures plus an `AtomicInteger`
cut the time to a few seconds and fixed the corruption.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: tasks fanning out across worker lanes.
  NARRATION: "Doing many things at once is powerful — and dangerous if you share data carelessly.
  Let's do concurrency the safe, modern way, and connect it to Apex."
- **[0:30–1:40] Executors + Futures.**
  ON SCREEN: `Executors.newFixedThreadPool(4)`, submitting tasks, collecting `Future.get()`.
  NARRATION: "The JVM can run many threads, but creating them by hand is error-prone. Modern Java uses
  the Executor framework: you submit tasks to a managed thread pool and get back a Future — a handle
  to the eventual result. It's the same idea as JavaScript promises, and as future and queueable Apex
  on the platform. Here four workers download URLs concurrently, then I collect each result."
- **[1:40–2:50] Race conditions.**
  ON SCREEN: `count++` flagged unsafe; `AtomicInteger.incrementAndGet()` safe.
  NARRATION: "When two threads read and write the same variable without coordination, you get a race
  condition — lost updates, corrupted state. A plain count-plus-plus is actually read, modify, write,
  and it's not atomic. Avoid the problem: don't share mutable state, use immutable objects, or use
  thread-safe types like AtomicInteger and ConcurrentHashMap."
- **[2:50–3:45] Java to Apex.**
  ON SCREEN: mapping — Executor → Queueable/Batch; shared state → per-record work.
  NARRATION: "Salesforce is multi-tenant, so it doesn't expose raw threads. Instead it gives you
  managed asynchronous options that solve the same problems: Queueable and future methods for
  background work, Batch Apex for large volumes, Platform Events for decoupling. The mental model —
  hand off work, don't block, combine results at the end — is identical to Java's Executor pattern."
- **[3:45–4:35] Real-world story.**
  NARRATION: "A service synced twenty external endpoints one after another — over twenty seconds — and
  a quick 'let's go parallel' corrupted a shared counter. They moved to a fixed thread pool with
  Futures, made the counter an AtomicInteger, and merged results only after every Future completed.
  Sync time dropped to a few seconds and the corruption disappeared. That same discipline later shaped
  their Queueable Apex."
- **[4:35–5:00] Recap + close.**
  NARRATION: "Use Executors and Futures, beware unsynchronized shared state, prefer immutability and
  thread-safe types, and remember Apex async mirrors this exactly. That completes the Java track."

## Track: Release Management & DevOps

### 1. Environments and release strategy  (`rm-environments`)

**Concept.** Designing a path to production (dev → integration → QA → UAT → prod), why source
control (not the org) is the modern source of truth, and promoting one known-good artifact forward on
a predictable cadence with freeze windows.

**Real-world example.** A team built in production and copied changes with change sets; nobody knew
what was live and two admins overwrote each other. Moving to Git as the source of truth with a
promotion path made every change a reviewed, reversible commit.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: "From 'click deploy' chaos to calm releases".
  NARRATION: "Shipping Salesforce changes should be boring — in the best way. This track is how you
  get there. It starts with environments and a release strategy."
- **[0:30–1:40] The path to production.**
  ON SCREEN: a pipeline dev → integration → QA (Partial Copy) → UAT (Full) → prod.
  NARRATION: "A healthy pipeline flows through several environments. Developers build in scratch orgs
  or developer sandboxes. Features integrate in a shared sandbox. QA validates in a Partial Copy with
  realistic data. Business users sign off in a Full sandbox — UAT. Only then does the change reach
  production. Each stage catches a different class of problem before real users feel it."
- **[1:40–2:50] Source of truth.**
  ON SCREEN: Git as authoritative; orgs as disposable targets; change sets crossed out.
  NARRATION: "Here's the mindset shift: Git, not any org, is the source of truth. Metadata is
  retrieved into a repository, reviewed as code, and deployed forward — and orgs become disposable
  targets you can rebuild. Change sets are click-based with no history, no review, hard to reverse.
  Source control plus DX gives you reviewed diffs, full history, and automated deploys."
- **[2:50–3:50] Promotion + cadence.**
  ON SCREEN: one artifact moving QA → UAT → prod; a calendar with a freeze window.
  NARRATION: "Changes are promoted, never rebuilt by hand — the same versioned artifact that passed
  QA is what deploys to UAT and production. Pick a cadence — continuous, weekly, or fixed windows —
  and protect production with freeze windows around critical business periods. Predictability turns
  releases from events into routine."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A team built directly in production and moved changes with change sets. Nobody knew
  exactly what was live, two admins overwrote each other's work, and a bad change took a day to unpick.
  They retrieved everything into Git, made the repo authoritative, and defined a scratch-org to
  sandbox to UAT to production path with pull-request review. Every change became reviewable and
  reversible; rollback became 'deploy the previous tag'."
- **[4:35–5:00] Recap + next.**
  NARRATION: "A staged path catches issues early, Git is the source of truth, and you promote one
  known-good artifact on a predictable cadence. Next: the tooling — Salesforce DX."

### 2. Salesforce DX and source-driven development  (`rm-sfdx`)

**Concept.** The DX project format and `sfdx-project.json`, the core `sf` CLI commands (login,
retrieve, deploy, test), and scratch orgs as disposable, reproducible environments.

**Real-world example.** Two developers' sandboxes had drifted apart and a QA defect couldn't be
reproduced. Defining the org shape in a scratch definition file and creating fresh scratch orgs per
feature made every environment identical — and the defect reproduced immediately.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a terminal with the `sf` CLI.
  NARRATION: "Source-driven development is powered by Salesforce DX and the sf command line. Let's
  turn your org into versionable source — and spin up clean orgs on demand."
- **[0:30–1:30] DX project format.**
  ON SCREEN: `force-app` folders; `sfdx-project.json`.
  NARRATION: "A DX project stores metadata as source under a package directory — usually force-app —
  described by sfdx-project.json. This source format splits big bundles into readable files, so diffs
  are meaningful and merges are possible, unlike the old monolithic metadata format."
- **[1:30–2:50] The CLI you'll use daily.**
  ON SCREEN: `sf org login web`, `sf project retrieve start`, `sf project deploy start ... RunLocalTests`.
  NARRATION: "A handful of sf commands cover most work. Authorize an org — it opens a browser.
  Retrieve metadata into source. Deploy source to an org, and notice I run local tests as part of the
  deploy. This platform's deployment UI wraps these very commands."
- **[2:50–3:55] Scratch orgs.**
  ON SCREEN: `sf org create scratch --definition-file ...`; push + open.
  NARRATION: "A scratch org is a short-lived org spun up from a definition file. Each developer, or
  each CI job, gets a clean org, pushes source into it, tests, and throws it away. That eliminates
  'works in my sandbox' drift, and it's the engine behind this platform's scratch-org automation."
- **[3:55–4:35] Real-world story.**
  NARRATION: "Two developers kept hitting different bugs because their sandboxes had drifted apart over
  months of manual tweaks, and a defect QA reported wouldn't reproduce. They defined their org shape
  in a scratch definition file and created a fresh scratch org from source per feature and per CI run.
  Environments became identical, the elusive defect reproduced immediately, and onboarding dropped
  from days to minutes."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Source format makes metadata diffable, sfdx-project.json defines the project, a few sf
  commands do the work, and scratch orgs are clean and reproducible. Next: Git branching."

### 3. Version control with Git: branching models  (`rm-git`)

**Concept.** The everyday Git workflow (branch → commit → push → pull request), choosing a branching
model (feature branches, GitFlow, trunk-based), and resolving conflicts with branch protection on
`main`.

**Real-world example.** Before Git, two admins editing the same flow overwrote each other through
change sets, losing a day's work. Feature branches with pull-request review turned overlapping edits
into a visible merge conflict resolved before merge.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a branch diagram.
  NARRATION: "Git is how teams change the same project without stepping on each other. Let's cover the
  everyday workflow, pick a branching model, and protect your main line."
- **[0:30–1:40] The everyday workflow.**
  ON SCREEN: `git checkout -b`, `add`, `commit`, `push`, open PR.
  NARRATION: "Work happens on a short-lived feature branch off the main line. You commit small,
  meaningful changes, push, and open a pull request for review and automated checks. Only reviewed,
  green pull requests merge back — that's where your quality gates live."
- **[1:40–2:50] Branching models.**
  ON SCREEN: three diagrams — feature branches, GitFlow, trunk-based.
  NARRATION: "Pick a model that fits your cadence. Feature branches into main: simple, each feature
  branches and merges back after review. GitFlow: long-lived develop and release branches, good for
  scheduled releases. Trunk-based: very short branches merged frequently behind feature flags, good
  for continuous delivery. Most Salesforce teams start with feature branches into a protected main."
- **[2:50–3:50] Conflicts + protection.**
  ON SCREEN: a merge conflict; merge vs rebase; branch protection settings.
  NARRATION: "A merge conflict happens when two branches change the same lines — Git pauses so you
  resolve them. Merge keeps history as-is; rebase rewrites your branch onto the latest main for a
  linear history — but never rebase a shared branch. And protect main with required reviews and status
  checks, so nothing merges without passing CI. That guardrail is what makes fast releases safe."
- **[3:50–4:35] Real-world story.**
  NARRATION: "Before Git, two admins edited the same flow and overwrote each other through change
  sets — a full day of work, gone. With feature branches and pull-request review, overlapping edits
  to the same metadata now produce a visible merge conflict that's resolved before merge. Lost work
  stopped, and branch protection meant production only ever got reviewed, CI-verified changes."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Branch, commit, push, pull request; a model that fits your cadence; resolve conflicts
  and protect main. Next: automating all of this with CI/CD."

### 4. Building a CI/CD pipeline  (`rm-cicd`)

**Concept.** Continuous Integration vs Continuous Delivery, pipeline stages as gates (validate →
test → analyze → deploy), and defining the pipeline as versioned YAML — shown with a real GitHub
Actions example.

**Real-world example.** A team deployed manually on Fridays; a change that broke an Apex test slipped
through and failed in production on Monday. A CI job running tests and a check-only deploy on every
pull request caught it in the PR.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a red pipeline blocking a merge, then green.
  NARRATION: "CI/CD replaces risky manual deploys with an automated pipeline that tests every change
  and can release at the push of a button. Let's build the mental model and read a real one."
- **[0:30–1:20] CI vs CD.**
  ON SCREEN: definitions side by side.
  NARRATION: "Continuous Integration means every change is automatically built and tested as it
  merges, so integration problems surface immediately. Continuous Delivery means those validated
  changes can be released to any environment on demand — or automatically. Together they turn
  deployment from a nail-biter into a routine."
- **[1:20–2:40] Pipeline stages as gates.**
  ON SCREEN: validate → test → analyze → deploy, each a gate.
  NARRATION: "A Salesforce pipeline runs on each pull request and on merge. Validate: a check-only
  deploy of the changed metadata. Test: run Apex tests with a coverage threshold. Analyze: run the
  Code Analyzer or PMD for quality and security. Deploy: on merge to main, deploy for real to the next
  environment. Each stage is a gate — a red stage blocks the merge or the deploy."
- **[2:40–3:50] Pipeline as code.**
  ON SCREEN: the GitHub Actions YAML validating a PR with `--dry-run` + `RunLocalTests`.
  NARRATION: "Pipelines are declared as YAML checked into the repo, so the process itself is versioned
  and reviewed. Here's a minimal GitHub Actions workflow: on a pull request, it installs the CLI,
  authorizes an org with the JWT flow, and runs a dry-run deploy with local tests. If anything fails,
  the pull request goes red."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A team deployed manually on Friday afternoons. A change broke an Apex test, nobody
  re-ran the full suite, and it failed in production on Monday. They added a CI job that runs local
  tests and a check-only validation on every pull request, blocking merge on failure. The broken test
  was caught in the PR, and Friday deploys became a non-event."
- **[4:35–5:00] Recap + next.**
  NARRATION: "CI tests everything, CD makes releasing push-button, stages are gates, and the pipeline
  is versioned code. Next: how you package what you ship."

### 5. Packaging: change sets, unlocked packages, and the Metadata API  (`rm-packaging`)

**Concept.** The spectrum of deployment mechanisms (change sets → Metadata API deploys → unlocked
packages), the `package.xml` manifest that scopes a deployment, and versioning metadata as unlocked
packages for clean upgrades and ownership.

**Real-world example.** A large org deployed everything as one giant blob, so a small billing change
risked collateral breakage. Carving the org into unlocked packages let each release version only the
affected package and roll back by installing the previous version.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: a giant metadata blob splitting into labeled packages.
  NARRATION: "How you bundle and move metadata decides how safe your releases are. Let's go from
  click-based change sets to versioned, modular packages."
- **[0:30–1:40] Ways to move metadata.**
  ON SCREEN: change sets → Metadata API → unlocked packages.
  NARRATION: "From least to most mature: change sets are UI-only with no versioning — avoid them for
  anything repeatable. Metadata API deploys script the movement of a defined set of components — this
  is what the sf CLI and this platform use. Unlocked packages are versioned, modular bundles you
  build, install, and upgrade like software releases."
- **[1:40–2:45] The manifest.**
  ON SCREEN: a `package.xml` listing two Apex classes.
  NARRATION: "The Metadata API works against a manifest — package.xml — that lists exactly which
  components to retrieve or deploy. It's the contract for what's in a deployment, and it's how this
  platform's org-to-org tools scope a change precisely, so you never accidentally ship something you
  didn't intend."
- **[2:45–3:50] Unlocked packages.**
  ON SCREEN: `sf package create`, `sf package version create`, `sf package install`.
  NARRATION: "An unlocked package turns a directory of metadata into a versioned artifact. You create
  the package once, then create a new version for each release and install or upgrade it in target
  orgs. That gives you dependency management and clean upgrades instead of ad-hoc deploys."
- **[3:50–4:35] Real-world story.**
  NARRATION: "A large org deployed everything as one giant blob, so a small billing change forced
  re-deploying unrelated components and risked collateral breakage. They carved the org into unlocked
  packages — Billing, Sales, Service. Each release versioned only the affected package, teams owned
  their packages, and rolling back meant installing the previous version instead of untangling a
  monolith."
- **[4:35–5:00] Recap + next.**
  NARRATION: "Change sets don't version, Metadata API deploys are scriptable, unlocked packages are
  versioned modules, and package.xml scopes precisely. Last lesson: governance and this platform."

### 6. Release governance, approvals, and this platform  (`rm-governance`)

**Concept.** The human and audit layer — approvals, release notes, audit trails, rollback plans —
plus drift detection and post-deploy validation, and how the DevOps Command Center's modules automate
the whole discipline.

**Real-world example.** A finance customer failed a control review because they couldn't show who
approved a production change or what it contained. Adopting release records with mandatory approvals,
auto-generated notes, and an audit trail passed the next audit cleanly.

**5-minute video script**

- **[0:00–0:30] Hook.**
  ON SCREEN: "Automation makes it fast; governance makes it trustworthy".
  NARRATION: "You've automated deployment. Now make it trustworthy. Governance is the safety net
  around all that speed — and it's what this platform is built to provide."
- **[0:30–1:30] Governance.**
  ON SCREEN: approvals, release notes, audit trail, rollback plan.
  NARRATION: "Governance adds four things: approvals — a human sign-off before production; release
  notes — what changed and why; an audit trail — who deployed what, when; and rollback plans. For
  regulated industries this isn't optional; it's how you prove you're in control."
- **[1:30–2:40] Drift, validation, monitoring.**
  ON SCREEN: drift comparison; post-deploy smoke tests; a monitoring dashboard.
  NARRATION: "Even with a clean pipeline, orgs drift when someone edits production directly. Drift
  detection compares the live org against source and flags the differences to reconcile. Post-deploy
  validation runs smoke tests after a release, and monitoring tracks job outcomes so a failed deploy
  pages someone — instead of being discovered by users."
- **[2:40–3:55] This platform.**
  ON SCREEN: a tour — Environment Center, Deployment Center, Releases, Drift, Quality, Calendar, Monitoring.
  NARRATION: "The DevOps Command Center is this whole track, made operational. Environment Center and
  scratch-org automation manage reproducible orgs. Deployment, Metadata, and Data Deployment move
  changes org-to-org with previews and rollback. Releases groups deployments and work items with
  approvals and AI-generated release notes. Drift Monitoring, Apex Quality, Calendar, and Monitoring
  are your governance and visibility layer. Understanding the concepts makes you far more effective
  with the tool."
- **[3:55–4:35] Real-world story.**
  NARRATION: "A finance customer failed a control review — they couldn't show who approved a
  production change or what it contained. They adopted release records with mandatory approvals,
  auto-generated release notes tying deployments to work items, and an immutable audit trail. The next
  audit passed cleanly: every change had an approver, a change list, and a timestamp, and drift
  monitoring proved production matched source."
- **[4:35–5:00] Recap + close.**
  NARRATION: "Governance adds approvals, notes, audit, and rollback; drift and validation keep you
  honest; and this platform automates it end to end. That completes the Release Management and DevOps
  track — now go ship with confidence."

---

## Appendix: recording & upload checklist

- Record at 1080p, 16:9. Keep each video at or under **5 minutes**.
- For screen/code segments, zoom the editor font so code is legible on mobile.
- Keep accurate labels in slides/overlays (per the Academy's principle that generated media never
  reproduces exact product UI or text).
- Name the file after the lesson id (e.g. `js-async.mp4`) before uploading.
- Upload against the matching lesson's **Video session**. Remember uploaded videos only appear for
  learners granted the **Video sessions** capability in **Admin → User Access → Salesforce Academy
  features**.

