# JavaScript Mastery — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Intermediate · **Category:** Programming & platform skills · **Badge:** JavaScript Craftsman · **Modules:** 3 · **Lessons:** 9 · **Estimated effort:** ~7h

JavaScript runs every Lightning Web Component, every browser DevTools session, and most automation scripts in a modern Salesforce team. This path builds the language from first principles — values, functions, and objects — through modern ES6+ syntax and asynchronous programming, and finishes where Salesforce developers live: the DOM, REST APIs, and the exact patterns Lightning Web Components are built on.

**Skills:** Language fundamentals · Modern ES6+ syntax · Async & promises · DOM, REST & LWC patterns

## Contents

- **Module 1: JavaScript Fundamentals**
  - Lesson 1.1: Values, types, and variables
  - Lesson 1.2: Control flow and functions
  - Lesson 1.3: Arrays and objects: shaping data
- **Module 2: Modern JavaScript (ES6+)**
  - Lesson 2.1: Modern syntax that changed the language
  - Lesson 2.2: Modules and classes
  - Lesson 2.3: Asynchronous JavaScript: promises and async/await
- **Module 3: JavaScript in the Browser & LWC**
  - Lesson 3.1: The DOM and events
  - Lesson 3.2: fetch, JSON, and REST APIs
  - Lesson 3.3: JavaScript patterns that power LWC

## Module 1: JavaScript Fundamentals

Values, types, variables, control flow, functions, arrays, and objects — the mental model everything else builds on.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 1.1 — Values, types, and variables

**Lesson ID:** `js-values-types-variables` · **Reading time:** 15 min · **Video:** 5:00

> What JavaScript actually is, how dynamic typing works, and how to declare variables you can trust.

**Learning objectives**

- Explain where JavaScript runs and why Salesforce developers need it
- Name the primitive types and predict simple type coercions
- Choose correctly between const and let, and avoid var

#### Concept explanation

##### One language, everywhere your work runs

JavaScript is the only language web browsers execute natively — which makes it the language of Lightning Web Components, Visualforce enhancements, browser DevTools, and every embedded widget your users touch. The same language also runs on servers through Node.js, which is why the Salesforce CLI, most deployment scripts, and this very platform are written in it.

Unlike Apex, JavaScript is not compiled inside Salesforce and has no governor limits — it runs on the user's machine (or your build server). That freedom cuts both ways: you gain instant feedback and a huge ecosystem, and you take on responsibility for correctness that the platform will not enforce for you.

##### Dynamic types without surprises

JavaScript has a small set of primitive types: string, number, boolean, null, undefined, bigint, and symbol — plus objects for everything else. A variable has no fixed type; the VALUE it currently holds does. typeof tells you what you are looking at.

Coercion is where beginners get burned: the == operator converts types before comparing ("5" == 5 is true), while === compares value AND type ("5" === 5 is false). Professional JavaScript uses === and !== everywhere. The other classic: undefined means "never assigned", while null means "deliberately empty" — the difference matters when an Apex method returns no data versus an empty payload.

*Strict equality (===) removes an entire class of production bugs.*

```javascript
const orgLimit = 100000;          // number
const orgName = 'UAT Full Copy';  // string
let isConnected = false;          // boolean — will change later

console.log(typeof orgLimit);     // 'number'
console.log('5' == 5);            // true  — coerced, avoid
console.log('5' === 5);           // false — strict, always use
console.log(null == undefined);   // true  — the one coercion trap to memorize
```

##### const by default, let when it changes, var never

const declares a binding that cannot be reassigned — your default for everything. let declares a block-scoped variable for values that genuinely change (loop counters, accumulators). var is the legacy form with function-wide scope and "hoisting" behavior that creates bugs; modern codebases (including LWC) simply never use it.

Note the nuance: const prevents REASSIGNMENT, not mutation. A const array can still be pushed to; a const object's fields can still change. That is fine in practice — the discipline you want is "one name, one meaning" inside any scope.

#### Real-world example — The equality bug that hid a data-loader failure

- **Scenario:** A team's custom data-load monitor compared record counts with ==. The API returned counts as strings, the UI stored expectations as numbers — "2500" == 2500 passed, so a partial load of 2,500 out of 25,000 records showed green because a separate truncation bug also cut a digit.
- **Solution:** They switched every comparison to === and added an explicit Number() conversion at the API boundary, so mismatched types failed loudly in testing instead of silently agreeing in production.
- **Outcome:** The next partial load failed the dashboard immediately, was re-run the same afternoon, and the team adopted a lint rule (eqeqeq) so the class of bug cannot return.

#### Key takeaways

- JavaScript runs in the browser (LWC, DevTools) and on servers (Node, the SF CLI)
- Values have types; variables do not — use typeof to inspect
- Always use === / !==; convert types explicitly at boundaries
- Declare with const by default, let when reassignment is real, var never

#### Go deeper

- [MDN: JavaScript first steps](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps) — The canonical reference for the language
- [Modern JavaScript Development (Trailhead)](https://trailhead.salesforce.com/content/learn/modules/modern-javascript-development) — Salesforce's own JS refresher for LWC work

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Values, types, and variables matters | intro |
| 2 | 0:30–1:15 | One language, everywhere your work runs | concept |
| 3 | 1:15–2:00 | Dynamic types without surprises | concept |
| 4 | 2:00–2:45 | Code walk-through — Dynamic types without surprises | demo |
| 5 | 2:45–3:30 | const by default, let when it changes, var never | concept |
| 6 | 3:30–4:15 | Real story — The equality bug that hid a data-loader failure | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Values, types, and variables matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on Values, types, and variables. What JavaScript actually is, how dynamic typing works, and how to declare variables you can trust. By the end of this video you will be able to explain where JavaScript runs and why Salesforce developers need it; name the primitive types and predict simple type coercions; choose correctly between const and let, and avoid var.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · JavaScript Fundamentals

**[0:30–1:15] One language, everywhere your work runs**

- **Narration (word-for-word):** JavaScript is the only language web browsers execute natively — which makes it the language of Lightning Web Components, Visualforce enhancements, browser DevTools, and every embedded widget your users touch. The same language also runs on servers through Node.js, which is why the Salesforce CLI, most deployment scripts, and this very platform are written in it. Unlike Apex, JavaScript is not compiled inside Salesforce and has no governor limits — it runs on the user's machine (or your build server). That freedom cuts both ways: you gain instant feedback and a huge ecosystem, and you take on responsibility for correctness that the platform will not enforce for you.
- **On screen:** Animated explainer diagram for "One language, everywhere your work runs": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Dynamic types without surprises**

- **Narration (word-for-word):** JavaScript has a small set of primitive types: string, number, boolean, null, undefined, bigint, and symbol — plus objects for everything else. A variable has no fixed type; the VALUE it currently holds does. typeof tells you what you are looking at. Coercion is where beginners get burned: the == operator converts types before comparing ("5" == 5 is true), while === compares value AND type ("5" === 5 is false). Professional JavaScript uses === and !== everywhere. The other classic: undefined means "never assigned", while null means "deliberately empty" — the difference matters when an Apex method returns no data versus an empty payload.
- **On screen:** Animated explainer diagram for "Dynamic types without surprises": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Dynamic types without surprises**

- **Narration (word-for-word):** Now watch the same idea in code. Strict equality (===) removes an entire class of production bugs. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:45–3:30] const by default, let when it changes, var never**

- **Narration (word-for-word):** const declares a binding that cannot be reassigned — your default for everything. let declares a block-scoped variable for values that genuinely change (loop counters, accumulators). var is the legacy form with function-wide scope and "hoisting" behavior that creates bugs; modern codebases (including LWC) simply never use it. Note the nuance: const prevents REASSIGNMENT, not mutation. A const array can still be pushed to; a const object's fields can still change. That is fine in practice — the discipline you want is "one name, one meaning" inside any scope.
- **On screen:** Animated explainer diagram for "const by default, let when it changes, var never": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The equality bug that hid a data-loader failure**

- **Narration (word-for-word):** Here is why this matters in the real world. A team's custom data-load monitor compared record counts with ==. The API returned counts as strings, the UI stored expectations as numbers — "2500" == 2500 passed, so a partial load of 2,500 out of 25,000 records showed green because a separate truncation bug also cut a digit. What did they do? They switched every comparison to === and added an explicit Number() conversion at the API boundary, so mismatched types failed loudly in testing instead of silently agreeing in production.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The equality bug that hid a data-loader failure

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. JavaScript runs in the browser (LWC, DevTools) and on servers (Node, the SF CLI). Values have types; variables do not — use typeof to inspect. Always use === / !==; convert types explicitly at boundaries. Declare with const by default, let when reassignment is real, var never.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Values, types, and variables — the idea, the practice, and the real-world payoff. Head back to the JavaScript Fundamentals module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — Control flow and functions

**Lesson ID:** `js-control-flow-functions` · **Reading time:** 18 min · **Video:** 5:00

> if/else, loops, and the three ways to write functions — plus scope and closures explained without mystery.

**Learning objectives**

- Use if/else, switch, and the ternary operator appropriately
- Write function declarations, expressions, and arrow functions
- Explain scope and closures with a practical example

#### Concept explanation

##### Branching and looping

if / else if / else covers most decisions; switch reads better when one value routes to many cases (like a deployment status: Pending, InProgress, Succeeded, Failed). The ternary operator (condition ? a : b) is for choosing a VALUE inline — great for display labels, wrong for multi-step logic.

For iteration, modern code prefers for...of to loop values of any array ("for (const org of orgs)"), classic for when you need the index, and while for "until something happens" polling loops — like waiting on a deploy status. for...in walks object KEYS and surprises people on arrays; reserve it for objects.

##### Three ways to write a function

Function declarations (function name() {}) are hoisted — callable before their definition — and read well for top-level operations. Function expressions assign a function to a const. Arrow functions (=>) are the compact modern form used for callbacks and array transforms.

The real difference is "this": arrow functions do not create their own this — they inherit it from the surrounding scope. That is exactly why LWC event handlers and array callbacks written as arrows "just work" while old-style function callbacks needed .bind(this). Default parameters (function deploy(target, validateOnly = false)) and rest parameters (...args) round out the everyday toolkit.

*Declarations for named operations, arrows for callbacks and utilities.*

```javascript
function summarize(results) {                 // declaration — hoisted
    return results.filter(isFailure).length;
}

const isFailure = (result) => !result.success; // arrow — inherits `this`

const retry = async (fn, attempts = 3) => {    // default parameter
    for (let i = 1; i <= attempts; i++) {
        try { return await fn(); }
        catch (err) { if (i === attempts) throw err; }
    }
};
```

##### Scope and closures — the feature everything relies on

Scope is "where a name is visible": block scope for let/const, plus the chain of enclosing functions. A closure is simply a function that REMEMBERS the scope it was created in, even after that scope has finished running.

Closures are not an interview trick — they are how real code is structured. A function that returns a configured function ("makeLogger(prefix)"), a debounced search handler that remembers its timer, a counter that keeps private state without globals: all closures. Once you can predict what a closure captures, callbacks and event handlers stop feeling magical.

*A closure keeps jobId and attempts alive between calls — no globals needed.*

```javascript
function makePoller(jobId) {
    let attempts = 0;                       // private state, captured
    return async function poll() {
        attempts += 1;
        const status = await fetchStatus(jobId);
        console.log(`Attempt ${attempts}: ${status}`);
        return status;
    };
}

const pollDeploy = makePoller('0Af...');    // remembers jobId + attempts
await pollDeploy();                          // Attempt 1: InProgress
await pollDeploy();                          // Attempt 2: Succeeded
```

#### Real-world example — A flaky "Cancel deploy" button

- **Scenario:** A deployment console's Cancel button sometimes cancelled the WRONG job. The click handler was wired inside a classic for loop with var i, so every handler closed over the same final loop variable — a textbook closure-over-var bug.
- **Solution:** Changing var to let gave each loop iteration its own binding, and the team refactored the handlers to arrow functions that captured the specific job object rather than an index.
- **Outcome:** Cancellations became deterministic, and the incident became the team's go-to onboarding story for why block scoping and closures must be understood, not memorized.

#### Key takeaways

- Use for...of for values, classic for when you need the index, while for polling
- Arrow functions inherit this — the reason they fit callbacks and LWC handlers
- A closure is a function plus the variables it captured at creation
- Block scoping (let/const) eliminates the classic loop-handler bug

#### Go deeper

- [MDN: Functions guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions)
- [MDN: Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures) — The clearest closure explanation in print

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Control flow and functions matters | intro |
| 2 | 0:30–1:06 | Branching and looping | concept |
| 3 | 1:06–1:42 | Three ways to write a function | demo |
| 4 | 1:42–2:18 | Code walk-through — Three ways to write a function | demo |
| 5 | 2:18–2:54 | Scope and closures — the feature everything relies on | concept |
| 6 | 2:54–3:30 | Code walk-through — Scope and closures — the feature everything relies on | demo |
| 7 | 3:30–4:15 | Real story — A flaky "Cancel deploy" button | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Control flow and functions matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on Control flow and functions. if/else, loops, and the three ways to write functions — plus scope and closures explained without mystery. By the end of this video you will be able to use if/else, switch, and the ternary operator appropriately; write function declarations, expressions, and arrow functions; explain scope and closures with a practical example.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · JavaScript Fundamentals

**[0:30–1:06] Branching and looping**

- **Narration (word-for-word):** if / else if / else covers most decisions; switch reads better when one value routes to many cases (like a deployment status: Pending, InProgress, Succeeded, Failed). The ternary operator (condition ? a : b) is for choosing a VALUE inline — great for display labels, wrong for multi-step logic.
- **On screen:** Animated explainer diagram for "Branching and looping": the key entities appear and connect exactly as the narration names them.

**[1:06–1:42] Three ways to write a function**

- **Narration (word-for-word):** Let's actually do this together. Function declarations (function name() {}) are hoisted — callable before their definition — and read well for top-level operations. Function expressions assign a function to a const. Arrow functions (=>) are the compact modern form used for callbacks and array transforms. The real difference is "this": arrow functions do not create their own this — they inherit it from the surrounding scope.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. The real difference is "this": arrow functions do not create their own this — they inherit it from the surrounding scope.
  2. Default parameters (function deploy(target, validateOnly = false)) and rest parameters (...args) round out the everyday toolkit.

**[1:42–2:18] Code walk-through — Three ways to write a function**

- **Narration (word-for-word):** Now watch the same idea in code. Declarations for named operations, arrows for callbacks and utilities. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:18–2:54] Scope and closures — the feature everything relies on**

- **Narration (word-for-word):** Scope is "where a name is visible": block scope for let/const, plus the chain of enclosing functions. A closure is simply a function that REMEMBERS the scope it was created in, even after that scope has finished running. Closures are not an interview trick — they are how real code is structured. A function that returns a configured function ("makeLogger(prefix)"), a debounced search handler that remembers its timer, a counter that keeps private state without globals: all closures.
- **On screen:** Animated explainer diagram for "Scope and closures — the feature everything relies on": the key entities appear and connect exactly as the narration names them.

**[2:54–3:30] Code walk-through — Scope and closures — the feature everything relies on**

- **Narration (word-for-word):** Now watch the same idea in code. A closure keeps jobId and attempts alive between calls — no globals needed. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[3:30–4:15] Real story — A flaky "Cancel deploy" button**

- **Narration (word-for-word):** Here is why this matters in the real world. A deployment console's Cancel button sometimes cancelled the WRONG job. The click handler was wired inside a classic for loop with var i, so every handler closed over the same final loop variable — a textbook closure-over-var bug. What did they do? Changing var to let gave each loop iteration its own binding, and the team refactored the handlers to arrow functions that captured the specific job object rather than an index. And the payoff: Cancellations became deterministic, and the incident became the team's go-to onboarding story for why block scoping and closures must be understood, not memorized.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A flaky "Cancel deploy" button

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Use for...of for values, classic for when you need the index, while for polling. Arrow functions inherit this — the reason they fit callbacks and LWC handlers. A closure is a function plus the variables it captured at creation. Block scoping (let/const) eliminates the classic loop-handler bug.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Control flow and functions — the idea, the practice, and the real-world payoff. Head back to the JavaScript Fundamentals module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.3 — Arrays and objects: shaping data

**Lesson ID:** `js-arrays-objects` · **Reading time:** 18 min · **Video:** 5:00

> map, filter, reduce, object literals, optional chaining, and immutable updates — the daily bread of UI and script work.

**Learning objectives**

- Transform lists with map, filter, find, some/every, and reduce
- Read and write nested objects safely with optional chaining
- Update data immutably with spread — the pattern LWC reactivity expects

#### Concept explanation

##### Arrays: transform, don't mutate-in-place

Salesforce work is list work: records, deploy results, org members. The core methods — map (transform each item), filter (keep some), find (first match), some/every (boolean checks), reduce (fold to one value) — replace almost every manual loop and read as intent instead of mechanics.

Each takes a callback and returns a NEW array (except reduce, which returns whatever you build). Chaining them ("results.filter(r => !r.success).map(r => r.fullName)") is the JavaScript equivalent of a SOQL query over in-memory data. Know the mutators too — push, splice, sort — and remember sort mutates in place and compares as strings unless you pass a comparator.

*filter → map → reduce reads like the sentence you would say out loud.*

```javascript
const results = [
    { fullName: 'AccountTrigger', success: true,  time: 340 },
    { fullName: 'CaseFlow',       success: false, time: 45  },
    { fullName: 'OppHandler',     success: false, time: 210 },
];

const failures   = results.filter(r => !r.success).map(r => r.fullName);
const totalTime  = results.reduce((sum, r) => sum + r.time, 0);
const allPassed  = results.every(r => r.success);

console.log(failures);   // ['CaseFlow', 'OppHandler']
console.log(totalTime);  // 595
console.log(allPassed);  // false
```

##### Objects: literals, access, and safe navigation

Objects are labeled boxes of key/value pairs — the shape of every API response you will ever parse. Dot access (org.alias) for known keys, bracket access (org[fieldName]) for dynamic ones. Object.keys / values / entries turn objects back into arrays for iteration.

Optional chaining (response?.result?.records) returns undefined instead of throwing when a link in the chain is missing — the polite way to read deep API payloads. Pair it with the nullish coalescing operator (?? "default") to supply fallbacks only when the value is null/undefined, not when it is legitimately 0 or false.

##### Immutable updates with spread — why LWC cares

The spread operator (...) copies arrays and objects: {...org, status: "Connected"} builds a NEW object with one field changed; [...list, newItem] builds a NEW array with one more element. Destructuring goes the other way, unpacking values into names: const { alias, instanceUrl } = org.

This is not style preference. LWC (like React) detects changes by reference: if you mutate an object in place, the framework may not re-render because the reference did not change. Teams that internalize "change = new object" ship reactive UIs that update reliably; teams that mutate chase ghost bugs.

*Spread-to-copy is the update pattern LWC and React reactivity are built around.*

```javascript
const org = { alias: 'uat', status: 'Disconnected', modules: ['data'] };

// WRONG for reactive UIs — same reference, framework may not notice
org.status = 'Connected';

// RIGHT — a new object; every consumer sees a new reference
const connected = { ...org, status: 'Connected' };

// Arrays too
const withDeploy = { ...connected, modules: [...connected.modules, 'deployment'] };

const { alias, status } = withDeploy;   // destructuring
console.log(alias, status);             // 'uat' 'Connected'
```

#### Real-world example — The dashboard that stopped refreshing

- **Scenario:** An LWC org-health dashboard updated its data by pushing into an existing array property. The wire data changed, the console.log showed fresh values — but the table on screen never re-rendered, and users kept acting on stale deploy statuses.
- **Solution:** The team replaced in-place mutation with immutable updates: this.rows = [...this.rows, newRow] and row edits via this.rows = this.rows.map(...). References changed, so the framework re-rendered.
- **Outcome:** The dashboard became trustworthy again, and "new data means new object" went into the team's LWC code-review checklist — the single most common fix in their component reviews.

#### Key takeaways

- map/filter/reduce express intent — prefer them to manual loops
- Optional chaining (?.) and nullish coalescing (??) make API payloads safe to read
- Spread copies; destructuring unpacks — learn both directions
- LWC detects change by reference: update immutably or the UI will not react

#### Go deeper

- [MDN: Array methods reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
- [JavaScript.info: Objects](https://javascript.info/object) — Deep, readable chapter series

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Arrays and objects: shaping data matters | intro |
| 2 | 0:30–1:06 | Arrays: transform, don't mutate-in-place | demo |
| 3 | 1:06–1:42 | Code walk-through — Arrays: transform, don't mutate-in-place | demo |
| 4 | 1:42–2:18 | Objects: literals, access, and safe navigation | concept |
| 5 | 2:18–2:54 | Immutable updates with spread — why LWC cares | concept |
| 6 | 2:54–3:30 | Code walk-through — Immutable updates with spread — why LWC cares | demo |
| 7 | 3:30–4:15 | Real story — The dashboard that stopped refreshing | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Arrays and objects: shaping data matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on Arrays and objects: shaping data. map, filter, reduce, object literals, optional chaining, and immutable updates — the daily bread of UI and script work. By the end of this video you will be able to transform lists with map, filter, find, some/every, and reduce; read and write nested objects safely with optional chaining; update data immutably with spread — the pattern LWC reactivity expects.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · JavaScript Fundamentals

**[0:30–1:06] Arrays: transform, don't mutate-in-place**

- **Narration (word-for-word):** Let's actually do this together. Salesforce work is list work: records, deploy results, org members. The core methods — map (transform each item), filter (keep some), find (first match), some/every (boolean checks), reduce (fold to one value) — replace almost every manual loop and read as intent instead of mechanics. Each takes a callback and returns a NEW array (except reduce, which returns whatever you build). Chaining them ("results.filter(r => !r.success).map(r => r.fullName)") is the JavaScript equivalent of a SOQL query over in-memory data.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Salesforce work is list work: records, deploy results, org members.
  2. The core methods — map (transform each item), filter (keep some), find (first match), some/every (boolean checks), reduce (fold to one value) — replace almost every manual loop and read as intent instead of mechanics.

**[1:06–1:42] Code walk-through — Arrays: transform, don't mutate-in-place**

- **Narration (word-for-word):** Now watch the same idea in code. filter → map → reduce reads like the sentence you would say out loud. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[1:42–2:18] Objects: literals, access, and safe navigation**

- **Narration (word-for-word):** Objects are labeled boxes of key/value pairs — the shape of every API response you will ever parse. Dot access (org.alias) for known keys, bracket access (org[fieldName]) for dynamic ones. Object.keys / values / entries turn objects back into arrays for iteration. Optional chaining (response?.result?.records) returns undefined instead of throwing when a link in the chain is missing — the polite way to read deep API payloads. Pair it with the nullish coalescing operator (??
- **On screen:** Animated explainer diagram for "Objects: literals, access, and safe navigation": the key entities appear and connect exactly as the narration names them.

**[2:18–2:54] Immutable updates with spread — why LWC cares**

- **Narration (word-for-word):** The spread operator (...) copies arrays and objects: {...org, status: "Connected"} builds a NEW object with one field changed; [...list, newItem] builds a NEW array with one more element. Destructuring goes the other way, unpacking values into names: const { alias, instanceUrl } = org. This is not style preference. LWC (like React) detects changes by reference: if you mutate an object in place, the framework may not re-render because the reference did not change.
- **On screen:** Animated explainer diagram for "Immutable updates with spread — why LWC cares": the key entities appear and connect exactly as the narration names them.

**[2:54–3:30] Code walk-through — Immutable updates with spread — why LWC cares**

- **Narration (word-for-word):** Now watch the same idea in code. Spread-to-copy is the update pattern LWC and React reactivity are built around. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[3:30–4:15] Real story — The dashboard that stopped refreshing**

- **Narration (word-for-word):** Here is why this matters in the real world. An LWC org-health dashboard updated its data by pushing into an existing array property. The wire data changed, the console.log showed fresh values — but the table on screen never re-rendered, and users kept acting on stale deploy statuses. What did they do? The team replaced in-place mutation with immutable updates: this.rows = [...this.rows, newRow] and row edits via this.rows = this.rows.map(...). References changed, so the framework re-rendered. And the payoff: The dashboard became trustworthy again, and "new data means new object" went into the team's LWC code-review checklist — the single most common fix in their component reviews.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The dashboard that stopped refreshing

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. map/filter/reduce express intent — prefer them to manual loops. Optional chaining (?.) and nullish coalescing (??) make API payloads safe to read. Spread copies; destructuring unpacks — learn both directions. LWC detects change by reference: update immutably or the UI will not react.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Arrays and objects: shaping data — the idea, the practice, and the real-world payoff. Head back to the JavaScript Fundamentals module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: Modern JavaScript (ES6+)

The syntax and structure of current codebases: template literals, destructuring, modules, classes, and asynchronous programming with promises and async/await.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 2.1 — Modern syntax that changed the language

**Lesson ID:** `js-modern-syntax` · **Reading time:** 15 min · **Video:** 5:00

> Template literals, destructuring in depth, spread/rest, and short-circuit patterns — the difference between 2010 code and today's.

**Learning objectives**

- Build strings with template literals instead of concatenation
- Destructure objects and arrays in parameters, returns, and imports
- Use spread/rest and default values to write flexible functions

#### Concept explanation

##### Template literals: strings you can read

Backtick strings interpolate expressions with ${...} and span multiple lines without escape gymnastics. Every log line, error message, and generated snippet in a modern codebase uses them: `Deploy ${id} finished in ${seconds}s`.

They also enable tagged templates (a function that processes a template), which libraries use for things like HTML escaping and GraphQL queries. You will mostly consume those rather than write them — but recognize the syntax when you see it.

##### Destructuring everywhere

Destructuring unpacks values by shape. In assignments: const { alias, instanceUrl } = org. In function parameters — the big one — it replaces "options objects plus manual reads" with a self-documenting signature: function connect({ alias, sandbox = false }) {}.

Array destructuring pairs with functions that return multiple values: const [first, ...rest] = queue. Renaming (const { Id: recordId } = record) keeps external field names out of your internal style. Once destructuring is in your fingers, code reviews get shorter because intent is visible in the signature.

*Destructured parameters with defaults: the signature documents itself.*

```javascript
function deployMetadata({ sourceOrg, targetOrg, checkOnly = true, tests = [] }) {
    console.log(`Deploying ${sourceOrg} -> ${targetOrg} (checkOnly=${checkOnly})`);
    return run({ sourceOrg, targetOrg, checkOnly, tests });
}

// Call sites read like configuration:
deployMetadata({ sourceOrg: 'dev', targetOrg: 'uat' });
deployMetadata({ sourceOrg: 'uat', targetOrg: 'prod', checkOnly: false,
                 tests: ['AccountTriggerTest'] });
```

##### Spread, rest, and short-circuit idioms

Spread expands (merge objects, clone arrays, pass an array as arguments); rest collects (function log(...messages)). Together they replace most uses of arguments, concat, and Object.assign.

The everyday logical idioms: value ?? fallback (default only for null/undefined), flag && doThing() (call when truthy), and ||= / ??= for lazy initialization. Used sparingly they make code tighter; overused they make it cryptic — a good rule is one short-circuit per line.

#### Real-world example — An options object nobody could call correctly

- **Scenario:** A shared deploy helper took seven positional parameters ("deploy(src, tgt, true, false, null, undefined, 300)"). Call sites were unreadable, arguments were regularly transposed, and one swapped boolean silently turned validation-only deploys into real ones in a staging org.
- **Solution:** The helper was rewritten to a single destructured options parameter with defaults, making every call site self-describing and making the dangerous flag (checkOnly) explicit and defaulted to safe.
- **Outcome:** The transposition class of bug disappeared, new team members could use the helper without reading its source, and the safe-by-default signature was adopted as the team standard for utilities.

#### Key takeaways

- Template literals replace string concatenation everywhere
- Destructured parameters with defaults are the modern options pattern
- Spread expands, rest collects — they are two sides of ...
- Prefer ?? over || for defaults when 0 or false are valid values

#### Go deeper

- [MDN: Destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)
- [JavaScript.info: Modern JavaScript](https://javascript.info/) — Free, current, and thorough

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Modern syntax that changed the language matters | intro |
| 2 | 0:30–1:15 | Template literals: strings you can read | demo |
| 3 | 1:15–2:00 | Destructuring everywhere | concept |
| 4 | 2:00–2:45 | Code walk-through — Destructuring everywhere | demo |
| 5 | 2:45–3:30 | Spread, rest, and short-circuit idioms | demo |
| 6 | 3:30–4:15 | Real story — An options object nobody could call correctly | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Modern syntax that changed the language matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on Modern syntax that changed the language. Template literals, destructuring in depth, spread/rest, and short-circuit patterns — the difference between 2010 code and today's. By the end of this video you will be able to build strings with template literals instead of concatenation; destructure objects and arrays in parameters, returns, and imports; use spread/rest and default values to write flexible functions.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · Modern JavaScript (ES6+)

**[0:30–1:15] Template literals: strings you can read**

- **Narration (word-for-word):** Let's actually do this together. Backtick strings interpolate expressions with ${...} and span multiple lines without escape gymnastics. Every log line, error message, and generated snippet in a modern codebase uses them: `Deploy ${id} finished in ${seconds}s`. They also enable tagged templates (a function that processes a template), which libraries use for things like HTML escaping and GraphQL queries. You will mostly consume those rather than write them — but recognize the syntax when you see it.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. They also enable tagged templates (a function that processes a template), which libraries use for things like HTML escaping and GraphQL queries.
  2. You will mostly consume those rather than write them — but recognize the syntax when you see it.

**[1:15–2:00] Destructuring everywhere**

- **Narration (word-for-word):** Destructuring unpacks values by shape. In assignments: const { alias, instanceUrl } = org. In function parameters — the big one — it replaces "options objects plus manual reads" with a self-documenting signature: function connect({ alias, sandbox = false }) {}. Array destructuring pairs with functions that return multiple values: const [first, ...rest] = queue. Renaming (const { Id: recordId } = record) keeps external field names out of your internal style. Once destructuring is in your fingers, code reviews get shorter because intent is visible in the signature.
- **On screen:** Animated explainer diagram for "Destructuring everywhere": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Destructuring everywhere**

- **Narration (word-for-word):** Now watch the same idea in code. Destructured parameters with defaults: the signature documents itself. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:45–3:30] Spread, rest, and short-circuit idioms**

- **Narration (word-for-word):** Let's actually do this together. Spread expands (merge objects, clone arrays, pass an array as arguments); rest collects (function log(...messages)). Together they replace most uses of arguments, concat, and Object.assign. The everyday logical idioms: value ?? fallback (default only for null/undefined), flag && doThing() (call when truthy), and ||= / ??= for lazy initialization. Used sparingly they make code tighter; overused they make it cryptic — a good rule is one short-circuit per line.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Spread expands (merge objects, clone arrays, pass an array as arguments); rest collects (function log(...messages)).
  2. Together they replace most uses of arguments, concat, and Object.assign.

**[3:30–4:15] Real story — An options object nobody could call correctly**

- **Narration (word-for-word):** Here is why this matters in the real world. A shared deploy helper took seven positional parameters ("deploy(src, tgt, true, false, null, undefined, 300)"). Call sites were unreadable, arguments were regularly transposed, and one swapped boolean silently turned validation-only deploys into real ones in a staging org. What did they do? The helper was rewritten to a single destructured options parameter with defaults, making every call site self-describing and making the dangerous flag (checkOnly) explicit and defaulted to safe.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** An options object nobody could call correctly

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Template literals replace string concatenation everywhere. Destructured parameters with defaults are the modern options pattern. Spread expands, rest collects — they are two sides of .... Prefer ?? over || for defaults when 0 or false are valid values.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Modern syntax that changed the language — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Modules and classes

**Lesson ID:** `js-modules-classes` · **Reading time:** 18 min · **Video:** 5:00

> import/export, how LWC files are modules, class syntax, getters, and when a plain object beats a class.

**Learning objectives**

- Split code across ES modules with named and default exports
- Write classes with fields, methods, getters, and inheritance
- Recognize LWC components as standard ES modules and classes

#### Concept explanation

##### ES modules: one file, one responsibility

Modules give every file its own scope: nothing leaks globally, and you say exactly what crosses the boundary. Named exports (export const parseOrg = ...) are the workhorse — they refactor cleanly and autocomplete well. A default export is the module's single main thing; LWC uses exactly one default export per component.

Imports mirror the exports: import { parseOrg } from "./org-utils"; import MyComponent from "./myComponent". Circular imports (A imports B imports A) are the classic module smell — when you hit one, extract the shared piece into a third module instead of fighting the loader.

##### Classes without ceremony

A class bundles state (fields) and behavior (methods) behind a constructor: class DeployJob { constructor(id) { this.id = id; } }. Class fields can be declared inline with defaults, getters compute derived values on access, and static members belong to the class itself.

Under the hood classes are prototype sugar — which matters only in that instanceof, method overriding, and super calls all behave predictably. extends models "is-a" relationships; use it sparingly. For pure data, a plain object literal is lighter than a class; reach for classes when behavior and state genuinely travel together.

*Fields, a getter, and a fluent method — everyday class JavaScript.*

```javascript
class DeployJob {
    static MAX_POLLS = 60;
    status = 'Pending';                 // class field with default

    constructor(id, targetOrg) {
        this.id = id;
        this.targetOrg = targetOrg;
    }
    get isDone() {                      // derived, computed on access
        return ['Succeeded', 'Failed'].includes(this.status);
    }
    advance(next) {
        this.status = next;
        return this;
    }
}

const job = new DeployJob('0Af000...', 'uat');
job.advance('InProgress');
console.log(job.isDone);               // false
```

##### LWC is "just" modules and classes

Open any Lightning Web Component: import { LightningElement, api } from "lwc"; export default class OrgCard extends LightningElement { @api org; get title() { ... } }. That is a standard ES module with a default-exported class extending a base class, plus decorators.

This is the payoff of the whole module: once modules, classes, fields, and getters are second nature, LWC stops being a framework to memorize and becomes a thin, learnable layer — lifecycle hooks and decorators — over the JavaScript you already own.

#### Real-world example — Untangling a 3,000-line utils file

- **Scenario:** A team's LWC codebase had grown a single utils.js imported by 40 components. Unrelated helpers shared state through module-level variables, a rename broke three components nobody expected, and tree-shaking was impossible — every component shipped all 3,000 lines.
- **Solution:** They split the file into focused modules (dates.js, orgFormat.js, deployPolling.js) with named exports only, enforced one-responsibility-per-module in review, and let the bundler drop unused code per component.
- **Outcome:** Component bundles shrank measurably, renames became mechanical IDE operations, and the "where does this helper live" question stopped consuming code-review time.

#### Key takeaways

- Named exports for utilities; one default export for a module's main thing
- Classes = constructor + fields + methods + getters; extends for true is-a only
- Plain objects beat classes for pure data
- Every LWC component is a normal ES module exporting a class

#### Go deeper

- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [LWC Dev Guide: Component structure](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-introduction.html) — See modules + classes in LWC context

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Modules and classes matters | intro |
| 2 | 0:30–1:15 | ES modules: one file, one responsibility | demo |
| 3 | 1:15–2:00 | Classes without ceremony | concept |
| 4 | 2:00–2:45 | Code walk-through — Classes without ceremony | demo |
| 5 | 2:45–3:30 | LWC is "just" modules and classes | concept |
| 6 | 3:30–4:15 | Real story — Untangling a 3,000-line utils file | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Modules and classes matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on Modules and classes. import/export, how LWC files are modules, class syntax, getters, and when a plain object beats a class. By the end of this video you will be able to split code across ES modules with named and default exports; write classes with fields, methods, getters, and inheritance; recognize LWC components as standard ES modules and classes.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · Modern JavaScript (ES6+)

**[0:30–1:15] ES modules: one file, one responsibility**

- **Narration (word-for-word):** Let's actually do this together. Modules give every file its own scope: nothing leaks globally, and you say exactly what crosses the boundary. Named exports (export const parseOrg = ...) are the workhorse — they refactor cleanly and autocomplete well. A default export is the module's single main thing; LWC uses exactly one default export per component. Imports mirror the exports: import { parseOrg } from "./org-utils"; import MyComponent from "./myComponent". Circular imports (A imports B imports A) are the classic module smell — when you hit one, extract the shared piece into a third module instead of fighting the loader.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Named exports (export const parseOrg = ...) are the workhorse — they refactor cleanly and autocomplete well.
  2. A default export is the module's single main thing; LWC uses exactly one default export per component.

**[1:15–2:00] Classes without ceremony**

- **Narration (word-for-word):** A class bundles state (fields) and behavior (methods) behind a constructor: class DeployJob { constructor(id) { this.id = id; } }. Class fields can be declared inline with defaults, getters compute derived values on access, and static members belong to the class itself. Under the hood classes are prototype sugar — which matters only in that instanceof, method overriding, and super calls all behave predictably. extends models "is-a" relationships; use it sparingly. For pure data, a plain object literal is lighter than a class; reach for classes when behavior and state genuinely travel together.
- **On screen:** Animated explainer diagram for "Classes without ceremony": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Classes without ceremony**

- **Narration (word-for-word):** Now watch the same idea in code. Fields, a getter, and a fluent method — everyday class JavaScript. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:45–3:30] LWC is "just" modules and classes**

- **Narration (word-for-word):** Open any Lightning Web Component: import { LightningElement, api } from "lwc"; export default class OrgCard extends LightningElement { @api org; get title() { ... } }. That is a standard ES module with a default-exported class extending a base class, plus decorators. This is the payoff of the whole module: once modules, classes, fields, and getters are second nature, LWC stops being a framework to memorize and becomes a thin, learnable layer — lifecycle hooks and decorators — over the JavaScript you already own.
- **On screen:** Animated explainer diagram for "LWC is "just" modules and classes": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Untangling a 3,000-line utils file**

- **Narration (word-for-word):** Here is why this matters in the real world. A team's LWC codebase had grown a single utils.js imported by 40 components. Unrelated helpers shared state through module-level variables, a rename broke three components nobody expected, and tree-shaking was impossible — every component shipped all 3,000 lines. What did they do? They split the file into focused modules (dates.js, orgFormat.js, deployPolling.js) with named exports only, enforced one-responsibility-per-module in review, and let the bundler drop unused code per component. And the payoff: Component bundles shrank measurably, renames became mechanical IDE operations, and the "where does this helper live" question stopped consuming code-review time.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Untangling a 3,000-line utils file

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Named exports for utilities; one default export for a module's main thing. Classes = constructor + fields + methods + getters; extends for true is-a only. Plain objects beat classes for pure data. Every LWC component is a normal ES module exporting a class.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Modules and classes — the idea, the practice, and the real-world payoff. Head back to the Modern JavaScript (ES6+) module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.3 — Asynchronous JavaScript: promises and async/await

**Lesson ID:** `js-async` · **Reading time:** 20 min · **Video:** 5:00

> The event loop in one picture, promises as values, async/await with real error handling, and running work in parallel.

**Learning objectives**

- Explain why JavaScript is non-blocking and what the event loop does
- Consume and create promises; handle errors with try/catch and .catch
- Run independent operations in parallel with Promise.all / allSettled

#### Concept explanation

##### One thread, never blocked

JavaScript runs on a single thread. Instead of waiting for slow work (network calls, timers), it hands the work to the environment and continues; when the work finishes, a callback is queued and the event loop runs it once the current code completes. That is why a UI stays responsive while three API calls are in flight — and why nothing you write should ever "sleep" the thread.

The practical consequence: any function that touches the network is asynchronous, returns immediately, and delivers its result LATER. Every Apex call from LWC, every fetch, every Salesforce CLI invocation from Node follows this shape.

##### Promises, then async/await

A promise is an object representing a future result: pending, then fulfilled with a value or rejected with an error. You can chain (.then) and trap errors (.catch), but modern code prefers async/await: inside an async function, await pauses THAT FUNCTION (not the thread) until the promise settles, and rejected promises become throwable errors you handle with try/catch.

Two rules prevent 90% of async bugs. First: an async function ALWAYS returns a promise — callers must await it (a missing await is the classic silent bug). Second: handle errors at the level that can act on them; a swallowed .catch(() => {}) hides failures the user needed to see.

*A polling loop with await: sequential-looking code, fully non-blocking.*

```javascript
async function waitForDeploy(jobId) {
    for (let i = 0; i < 60; i++) {
        const res = await fetch(`/api/deploys/${jobId}`);
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
        const { status } = await res.json();
        if (status === 'Succeeded') return status;
        if (status === 'Failed') throw new Error('Deployment failed');
        await new Promise(resolve => setTimeout(resolve, 5000)); // poll delay
    }
    throw new Error('Timed out waiting for deployment');
}

try {
    await waitForDeploy('0Af000...');
    console.log('Ready to release');
} catch (err) {
    console.error(err.message);   // one place, real handling
}
```

##### Parallelism on purpose

Sequential awaits run one after another — correct when step B needs step A's result, wasteful when the calls are independent. Promise.all([a, b, c]) starts everything at once and awaits all results together, failing fast if ANY rejects. Promise.allSettled never short-circuits — you get every outcome, ideal for "check all 12 orgs and report each".

The habit to build: when you write two consecutive awaits, ask whether the second needs the first. Three independent 2-second API calls are 6 seconds sequential and 2 seconds with Promise.all — users feel that difference on every page load.

*Promise.all for speed; allSettled when every result matters individually.*

```javascript
// Sequential: ~6s. Parallel: ~2s.
const [limits, orgs, jobs] = await Promise.all([
    fetch('/api/limits').then(r => r.json()),
    fetch('/api/orgs').then(r => r.json()),
    fetch('/api/jobs?active=true').then(r => r.json()),
]);

// Health-check every org; one bad org must not hide the others
const checks = await Promise.allSettled(orgs.map(o => pingOrg(o.alias)));
const down = checks
    .map((c, i) => ({ alias: orgs[i].alias, ok: c.status === 'fulfilled' }))
    .filter(c => !c.ok);
```

#### Real-world example — The environment page that took nine seconds

- **Scenario:** An environment overview loaded org limits, connected orgs, and recent jobs with three sequential awaits, then pinged each of six orgs one by one. The page took nine seconds; users assumed the tool was broken and kept a spreadsheet instead.
- **Solution:** The three independent fetches moved into one Promise.all, and the six pings into Promise.allSettled so a single unreachable sandbox no longer failed the whole page — its card simply showed "unreachable".
- **Outcome:** Load time dropped to just over two seconds, the spreadsheet died, and the team added a lint rule flagging consecutive awaits on independent calls.

#### Key takeaways

- JavaScript never blocks: slow work completes later via the event loop
- await pauses the function, not the thread; async functions return promises
- A missing await is the classic silent bug — lint for floating promises
- Promise.all for independent speed; allSettled when each result must be reported

#### Go deeper

- [MDN: Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [JavaScript.info: Async/await](https://javascript.info/async-await)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Asynchronous JavaScript: promises and async/await matters | intro |
| 2 | 0:30–1:06 | One thread, never blocked | concept |
| 3 | 1:06–1:42 | Promises, then async/await | concept |
| 4 | 1:42–2:18 | Code walk-through — Promises, then async/await | demo |
| 5 | 2:18–2:54 | Parallelism on purpose | demo |
| 6 | 2:54–3:30 | Code walk-through — Parallelism on purpose | demo |
| 7 | 3:30–4:15 | Real story — The environment page that took nine seconds | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Asynchronous JavaScript: promises and async/await matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on Asynchronous JavaScript: promises and async/await. The event loop in one picture, promises as values, async/await with real error handling, and running work in parallel.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · Modern JavaScript (ES6+)

**[0:30–1:06] One thread, never blocked**

- **Narration (word-for-word):** JavaScript runs on a single thread. Instead of waiting for slow work (network calls, timers), it hands the work to the environment and continues; when the work finishes, a callback is queued and the event loop runs it once the current code completes. That is why a UI stays responsive while three API calls are in flight — and why nothing you write should ever "sleep" the thread. The practical consequence: any function that touches the network is asynchronous, returns immediately, and delivers its result LATER.
- **On screen:** Animated explainer diagram for "One thread, never blocked": the key entities appear and connect exactly as the narration names them.

**[1:06–1:42] Promises, then async/await**

- **Narration (word-for-word):** A promise is an object representing a future result: pending, then fulfilled with a value or rejected with an error. You can chain (.then) and trap errors (.catch), but modern code prefers async/await: inside an async function, await pauses THAT FUNCTION (not the thread) until the promise settles, and rejected promises become throwable errors you handle with try/catch. Two rules prevent 90% of async bugs. First: an async function ALWAYS returns a promise — callers must await it (a missing await is the classic silent bug).
- **On screen:** Animated explainer diagram for "Promises, then async/await": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Code walk-through — Promises, then async/await**

- **Narration (word-for-word):** Now watch the same idea in code. A polling loop with await: sequential-looking code, fully non-blocking. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:18–2:54] Parallelism on purpose**

- **Narration (word-for-word):** Let's actually do this together. Sequential awaits run one after another — correct when step B needs step A's result, wasteful when the calls are independent. Promise.all([a, b, c]) starts everything at once and awaits all results together, failing fast if ANY rejects. Promise.allSettled never short-circuits — you get every outcome, ideal for "check all 12 orgs and report each". The habit to build: when you write two consecutive awaits, ask whether the second needs the first.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Sequential awaits run one after another — correct when step B needs step A's result, wasteful when the calls are independent.
  2. Promise.allSettled never short-circuits — you get every outcome, ideal for "check all 12 orgs and report each".

**[2:54–3:30] Code walk-through — Parallelism on purpose**

- **Narration (word-for-word):** Now watch the same idea in code. Promise.all for speed; allSettled when every result matters individually. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[3:30–4:15] Real story — The environment page that took nine seconds**

- **Narration (word-for-word):** Here is why this matters in the real world. An environment overview loaded org limits, connected orgs, and recent jobs with three sequential awaits, then pinged each of six orgs one by one. The page took nine seconds; users assumed the tool was broken and kept a spreadsheet instead. What did they do? The three independent fetches moved into one Promise.all, and the six pings into Promise.allSettled so a single unreachable sandbox no longer failed the whole page — its card simply showed "unreachable".
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The environment page that took nine seconds

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. JavaScript never blocks: slow work completes later via the event loop. await pauses the function, not the thread; async functions return promises. A missing await is the classic silent bug — lint for floating promises. Promise.all for independent speed; allSettled when each result must be reported.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Asynchronous JavaScript: promises and async/await — the idea, the practice, and the real-world payoff. Head back to the Modern JavaScript (ES6+) module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: JavaScript in the Browser & LWC

The DOM, events, fetch and REST APIs, and the exact JavaScript patterns Lightning Web Components run on — closing the loop back to Salesforce.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 3.1 — The DOM and events

**Lesson ID:** `js-dom-events` · **Reading time:** 18 min · **Video:** 5:00

> Selecting and updating elements, listening to events, bubbling and delegation — and how LWC templates wrap the same machinery.

**Learning objectives**

- Select and update DOM elements safely
- Wire event listeners and read event payloads
- Explain bubbling and use event delegation deliberately

#### Concept explanation

##### The DOM is a live tree

The browser parses HTML into the Document Object Model — a tree of element nodes that JavaScript can query and change, and the page updates instantly. document.querySelector(css) / querySelectorAll are the selection workhorses; element.textContent, classList, and setAttribute are the safe updaters.

Safety rule that security reviews enforce: use textContent for user-supplied text. innerHTML parses its input as HTML — feeding it untrusted data is a cross-site-scripting (XSS) vulnerability. In LWC you rarely touch the DOM directly (templates do it), but refreshing DevTools-level DOM literacy is what makes you dangerous at debugging any UI.

##### Events: the browser's notification system

Every interaction fires an event: click, input, change, submit, keydown. addEventListener(type, handler) subscribes; the handler receives an event object with .target (the element), value payloads, and control methods like preventDefault() (stop a form's native submit) and stopPropagation().

Events BUBBLE: after firing on the target they travel up through ancestors. That enables delegation — one listener on a container handling clicks from hundreds of rows by inspecting event.target — the pattern behind every data table, and the reason LWC can bind onclick on a parent element cheaply.

*Event delegation: one listener, unlimited rows, no per-row wiring.*

```javascript
// One listener handles every row's Retry button — even rows added later
const table = document.querySelector('#deploy-table');
table.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="retry"]');
    if (!button) return;                       // click was elsewhere
    const jobId = button.dataset.jobId;        // from data-job-id="..."
    retryDeploy(jobId);
});
```

##### The same ideas inside LWC

LWC templates declare listeners inline — <button onclick={handleRetry}> — and the framework manages addEventListener for you. Custom events carry data upward from child to parent components: this.dispatchEvent(new CustomEvent("select", { detail: { orgId } })), which the parent handles as onselect.

Inside a component you query only your own template (this.template.querySelector) because shadow DOM isolates each component's markup. All the mental models from this lesson — targets, payloads, bubbling — transfer directly; LWC just scopes and formalizes them.

#### Real-world example — A 500-row table with 500 listeners

- **Scenario:** A deployment-history table attached three listeners to every row at render time. With 500 rows the page allocated 1,500 listeners, scrolling stuttered on mid-range laptops, and rows added by live polling arrived with no listeners at all — their buttons simply did nothing.
- **Solution:** The team replaced per-row wiring with one delegated listener on the table body, reading the action and row id from data-* attributes on the clicked button.
- **Outcome:** Interaction became instant, dynamically added rows worked automatically, and the delegation pattern moved into the team's component playbook.

#### Key takeaways

- querySelector + textContent/classList cover most DOM updates safely
- Never feed untrusted data to innerHTML — that is XSS
- Events bubble; delegation puts one listener where hundreds existed
- LWC formalizes the same system: template bindings + CustomEvent up

#### Go deeper

- [MDN: Introduction to events](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events)
- [LWC Dev Guide: Handle events](https://developer.salesforce.com/docs/platform/lwc/guide/events.html)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why The DOM and events matters | intro |
| 2 | 0:30–1:15 | The DOM is a live tree | concept |
| 3 | 1:15–2:00 | Events: the browser's notification system | concept |
| 4 | 2:00–2:45 | Code walk-through — Events: the browser's notification system | demo |
| 5 | 2:45–3:30 | The same ideas inside LWC | demo |
| 6 | 3:30–4:15 | Real story — A 500-row table with 500 listeners | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why The DOM and events matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on The DOM and events. Selecting and updating elements, listening to events, bubbling and delegation — and how LWC templates wrap the same machinery. By the end of this video you will be able to select and update DOM elements safely; wire event listeners and read event payloads; explain bubbling and use event delegation deliberately.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · JavaScript in the Browser & LWC

**[0:30–1:15] The DOM is a live tree**

- **Narration (word-for-word):** The browser parses HTML into the Document Object Model — a tree of element nodes that JavaScript can query and change, and the page updates instantly. document.querySelector(css) / querySelectorAll are the selection workhorses; element.textContent, classList, and setAttribute are the safe updaters. Safety rule that security reviews enforce: use textContent for user-supplied text. innerHTML parses its input as HTML — feeding it untrusted data is a cross-site-scripting (XSS) vulnerability. In LWC you rarely touch the DOM directly (templates do it), but refreshing DevTools-level DOM literacy is what makes you dangerous at debugging any UI.
- **On screen:** Animated explainer diagram for "The DOM is a live tree": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Events: the browser's notification system**

- **Narration (word-for-word):** Every interaction fires an event: click, input, change, submit, keydown. addEventListener(type, handler) subscribes; the handler receives an event object with .target (the element), value payloads, and control methods like preventDefault() (stop a form's native submit) and stopPropagation(). Events BUBBLE: after firing on the target they travel up through ancestors. That enables delegation — one listener on a container handling clicks from hundreds of rows by inspecting event.target — the pattern behind every data table, and the reason LWC can bind onclick on a parent element cheaply.
- **On screen:** Animated explainer diagram for "Events: the browser's notification system": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Events: the browser's notification system**

- **Narration (word-for-word):** Now watch the same idea in code. Event delegation: one listener, unlimited rows, no per-row wiring. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:45–3:30] The same ideas inside LWC**

- **Narration (word-for-word):** Let's actually do this together. LWC templates declare listeners inline — <button onclick={handleRetry}> — and the framework manages addEventListener for you. Custom events carry data upward from child to parent components: this.dispatchEvent(new CustomEvent("select", { detail: { orgId } })), which the parent handles as onselect. Inside a component you query only your own template (this.template.querySelector) because shadow DOM isolates each component's markup. All the mental models from this lesson — targets, payloads, bubbling — transfer directly; LWC just scopes and formalizes them.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. LWC templates declare listeners inline — <button onclick={handleRetry}> — and the framework manages addEventListener for you.
  2. Custom events carry data upward from child to parent components: this.dispatchEvent(new CustomEvent("select", { detail: { orgId } })), which the parent handles as onselect.

**[3:30–4:15] Real story — A 500-row table with 500 listeners**

- **Narration (word-for-word):** Here is why this matters in the real world. A deployment-history table attached three listeners to every row at render time. With 500 rows the page allocated 1,500 listeners, scrolling stuttered on mid-range laptops, and rows added by live polling arrived with no listeners at all — their buttons simply did nothing. What did they do? The team replaced per-row wiring with one delegated listener on the table body, reading the action and row id from data-* attributes on the clicked button. And the payoff: Interaction became instant, dynamically added rows worked automatically, and the delegation pattern moved into the team's component playbook.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** A 500-row table with 500 listeners

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. querySelector + textContent/classList cover most DOM updates safely. Never feed untrusted data to innerHTML — that is XSS. Events bubble; delegation puts one listener where hundreds existed. LWC formalizes the same system: template bindings + CustomEvent up.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is The DOM and events — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — fetch, JSON, and REST APIs

**Lesson ID:** `js-fetch-apis` · **Reading time:** 18 min · **Video:** 5:00

> Calling REST endpoints properly: requests, headers, JSON parsing, status handling, and a hardened helper you will reuse everywhere.

**Learning objectives**

- Make GET/POST requests with fetch, headers, and JSON bodies
- Handle HTTP status codes and network errors distinctly
- Serialize and parse JSON confidently, including failure modes

#### Concept explanation

##### JSON: the wire format of everything

Every Salesforce REST response, every webhook, every config file in this platform is JSON: objects, arrays, strings, numbers, booleans, null. JSON.parse turns text into data (and throws on malformed input — catch it at boundaries); JSON.stringify goes the other way, with pretty-printing via JSON.stringify(data, null, 2) for logs.

Mind the type gaps: JSON has no dates (they travel as ISO strings you convert with new Date(iso)), no undefined, and no comments. A field that is missing, null, or an empty string are three DIFFERENT states — good API code decides explicitly what each means.

##### fetch, done properly

fetch(url, options) returns a promise of a Response. Two traps define competent usage. First: fetch only REJECTS on network failure — a 404 or 500 still fulfills, so you must check response.ok / response.status yourself. Second: the body is read asynchronously (await response.json()), and reading it twice throws.

Requests with bodies set method, a Content-Type header, and a stringified body. Authenticated APIs (like this platform's) add an Authorization header per request. AbortController adds timeouts — a fetch with no timeout is a hung spinner waiting to happen.

*A hardened fetch helper: status checking, JSON, auth, and a real timeout.*

```javascript
async function api(path, { method = 'GET', body, token, timeoutMs = 15000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(path, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${detail || response.statusText}`);
        }
        return response.status === 204 ? null : await response.json();
    } finally {
        clearTimeout(timer);
    }
}

const job = await api('/api/deploys', {
    method: 'POST',
    body: { sourceOrg: 'dev', targetOrg: 'uat', checkOnly: true },
    token: sessionToken,
});
```

##### Talking to Salesforce's REST API

The same shape reaches Salesforce directly: GET {instanceUrl}/services/data/v62.0/query?q=SELECT+Id+FROM+Account with an Authorization: Bearer {accessToken} header returns { totalSize, done, records }. Composite endpoints batch multiple operations in one round trip.

From LWC you will usually go through Apex (sharing and secrets stay server-side) — but understanding the raw HTTP layer is what lets you read debug logs, use Workbench/Postman fluently, and script integrations from Node when no UI exists. API-literacy is a superpower during incidents.

#### Real-world example — The integration that "never failed"

- **Scenario:** A nightly Node sync pushed records into Salesforce and logged "sync complete" every night. Weeks later, thousands of records were missing: the API had been returning 400 errors for a renamed field, but the script never checked response.ok — fetch does not reject on HTTP errors, so the failures passed silently.
- **Solution:** Every call moved to a shared helper that throws on non-2xx with the response body in the message, plus a summary that counts successes and failures and exits non-zero when anything failed.
- **Outcome:** The very next run failed loudly with the exact field error in the log, the mapping was fixed within an hour, and the helper became mandatory in code review for any script touching an API.

#### Key takeaways

- fetch fulfills on 404/500 — always check response.ok yourself
- JSON has no dates or undefined; decide what missing vs null means
- Add auth per request and a timeout via AbortController
- One hardened API helper, reused everywhere, prevents silent failures

#### Go deeper

- [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [Salesforce REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why fetch, JSON, and REST APIs matters | intro |
| 2 | 0:30–1:15 | JSON: the wire format of everything | concept |
| 3 | 1:15–2:00 | fetch, done properly | demo |
| 4 | 2:00–2:45 | Code walk-through — fetch, done properly | demo |
| 5 | 2:45–3:30 | Talking to Salesforce's REST API | concept |
| 6 | 3:30–4:15 | Real story — The integration that "never failed" | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why fetch, JSON, and REST APIs matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on fetch, JSON, and REST APIs. Calling REST endpoints properly: requests, headers, JSON parsing, status handling, and a hardened helper you will reuse everywhere. By the end of this video you will be able to make GET/POST requests with fetch, headers, and JSON bodies; handle HTTP status codes and network errors distinctly; serialize and parse JSON confidently, including failure modes.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · JavaScript in the Browser & LWC

**[0:30–1:15] JSON: the wire format of everything**

- **Narration (word-for-word):** Every Salesforce REST response, every webhook, every config file in this platform is JSON: objects, arrays, strings, numbers, booleans, null. JSON.parse turns text into data (and throws on malformed input — catch it at boundaries); JSON.stringify goes the other way, with pretty-printing via JSON.stringify(data, null, 2) for logs. Mind the type gaps: JSON has no dates (they travel as ISO strings you convert with new Date(iso)), no undefined, and no comments. A field that is missing, null, or an empty string are three DIFFERENT states — good API code decides explicitly what each means.
- **On screen:** Animated explainer diagram for "JSON: the wire format of everything": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] fetch, done properly**

- **Narration (word-for-word):** Let's actually do this together. fetch(url, options) returns a promise of a Response. Two traps define competent usage. First: fetch only REJECTS on network failure — a 404 or 500 still fulfills, so you must check response.ok / response.status yourself. Second: the body is read asynchronously (await response.json()), and reading it twice throws. Requests with bodies set method, a Content-Type header, and a stringified body. Authenticated APIs (like this platform's) add an Authorization header per request. AbortController adds timeouts — a fetch with no timeout is a hung spinner waiting to happen.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Two traps define competent usage.
  2. First: fetch only REJECTS on network failure — a 404 or 500 still fulfills, so you must check response.ok / response.status yourself.

**[2:00–2:45] Code walk-through — fetch, done properly**

- **Narration (word-for-word):** Now watch the same idea in code. A hardened fetch helper: status checking, JSON, auth, and a real timeout. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:45–3:30] Talking to Salesforce's REST API**

- **Narration (word-for-word):** The same shape reaches Salesforce directly: GET {instanceUrl}/services/data/v62.0/query?q=SELECT+Id+FROM+Account with an Authorization: Bearer {accessToken} header returns { totalSize, done, records }. Composite endpoints batch multiple operations in one round trip. From LWC you will usually go through Apex (sharing and secrets stay server-side) — but understanding the raw HTTP layer is what lets you read debug logs, use Workbench/Postman fluently, and script integrations from Node when no UI exists. API-literacy is a superpower during incidents.
- **On screen:** Animated explainer diagram for "Talking to Salesforce's REST API": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The integration that "never failed"**

- **Narration (word-for-word):** Here is why this matters in the real world. A nightly Node sync pushed records into Salesforce and logged "sync complete" every night. Weeks later, thousands of records were missing: the API had been returning 400 errors for a renamed field, but the script never checked response.ok — fetch does not reject on HTTP errors, so the failures passed silently. What did they do? Every call moved to a shared helper that throws on non-2xx with the response body in the message, plus a summary that counts successes and failures and exits non-zero when anything failed.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The integration that "never failed"

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. fetch fulfills on 404/500 — always check response.ok yourself. JSON has no dates or undefined; decide what missing vs null means. Add auth per request and a timeout via AbortController. One hardened API helper, reused everywhere, prevents silent failures.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is fetch, JSON, and REST APIs — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.3 — JavaScript patterns that power LWC

**Lesson ID:** `js-lwc-patterns` · **Reading time:** 20 min · **Video:** 5:00

> Decorators, reactivity, getters in templates, debouncing, and component communication — LWC as applied JavaScript.

**Learning objectives**

- Map @api, @track, and @wire to plain JavaScript concepts
- Drive templates with getters and immutable state updates
- Debounce user input and communicate between components correctly

#### Concept explanation

##### Decorators are annotations on class members

@api marks a class field as a public property a parent can set (or App Builder can configure). @track forces deep observation of an object/array field — needed only when you MUTATE nested data, which you can usually avoid by reassigning immutably instead. @wire declares a reactive data dependency: when its parameters change, the framework re-invokes the adapter.

Strip the decorators away and it is all fundamentals: public fields, change detection by reference (the immutability lesson), and functions re-run when inputs change. That is why strong JavaScript makes LWC feel small.

##### Templates read state; getters shape it

An LWC template binds to fields and getters: {status}, {formattedDate}, for:each iteration, lwc:if conditions. The discipline that keeps components maintainable is: fields hold RAW state; getters derive everything presentational (labels, filtered lists, css classes). Getters re-evaluate on re-render, so they stay in sync automatically — no manual "update the label too" bookkeeping.

Handlers stay thin: read the event, update state immutably, let getters and the template do the rest. When a handler grows past a screen, extract logic into a plain module — plain functions are unit-testable without mounting a component.

*Raw state in fields, presentation in getters — the maintainable LWC shape.*

```javascript
import { LightningElement, api } from 'lwc';

export default class DeployList extends LightningElement {
    @api deployments = [];
    filter = 'all';

    get visibleDeployments() {          // derived — never stored
        if (this.filter === 'failed') {
            return this.deployments.filter(d => !d.success);
        }
        return this.deployments;
    }
    get emptyMessage() {
        return this.filter === 'failed'
            ? 'No failed deployments — nice.'
            : 'No deployments yet.';
    }
    handleFilterChange(event) {
        this.filter = event.detail.value; // raw state changes; getters follow
    }
}
```

##### Debouncing and component communication

Search-as-you-type must not fire an Apex call per keystroke. Debouncing waits until typing pauses: store a timer, clear it on each keystroke, run the search when 300ms pass quietly — a closure over a timer id, nothing more.

Communication follows the platform rules: parent → child through @api properties; child → parent through CustomEvent; unrelated components through Lightning Message Service. Resist back-channel hacks (querying another component's internals) — they break shadow-DOM encapsulation and every future refactor.

*A ten-line debounce: the difference between 1 API call and 15 per search.*

```javascript
searchTerm = '';
delayTimer;

handleSearchInput(event) {
    const value = event.target.value;
    clearTimeout(this.delayTimer);
    this.delayTimer = setTimeout(() => {
        this.searchTerm = value;        // @wire(search, { term: '$searchTerm' })
    }, 300);                            // re-fires only after typing pauses
}
```

#### Real-world example — Search that hammered the org

- **Scenario:** An account search component fired an Apex call on every keystroke. Typing "enterprise" produced ten calls; under month-end load the org's concurrent Apex limit was breached and unrelated integrations started failing with REQUEST_LIMIT_EXCEEDED.
- **Solution:** The team added a 300ms debounce to the input handler and moved the search to a reactive @wire on the debounced term, so only settled queries reached the server.
- **Outcome:** API calls per search session dropped by roughly 90%, the limit breaches stopped, and the debounce helper was published in the team's shared LWC utilities module.

#### Key takeaways

- Decorators annotate plain class members — the concepts underneath are standard JS
- Fields hold raw state; getters derive presentation; handlers stay thin
- Debounce user input before it reaches the server
- Parent → @api down; child → CustomEvent up; unrelated → message service

#### Go deeper

- [LWC Dev Guide: Reactivity](https://developer.salesforce.com/docs/platform/lwc/guide/js-props-reactivity.html)
- [Trailhead: Build Lightning Web Components](https://trailhead.salesforce.com/content/learn/trails/build-lightning-web-components) — Hands-on component building trail

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 9

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why JavaScript patterns that power LWC matters | intro |
| 2 | 0:30–1:06 | Decorators are annotations on class members | concept |
| 3 | 1:06–1:42 | Templates read state; getters shape it | concept |
| 4 | 1:42–2:18 | Code walk-through — Templates read state; getters shape it | demo |
| 5 | 2:18–2:54 | Debouncing and component communication | demo |
| 6 | 2:54–3:30 | Code walk-through — Debouncing and component communication | demo |
| 7 | 3:30–4:15 | Real story — Search that hammered the org | story |
| 8 | 4:15–4:45 | Recap — lock it in | recap |
| 9 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why JavaScript patterns that power LWC matters**

- **Narration (word-for-word):** Welcome to JavaScript Mastery, and this five-minute session on JavaScript patterns that power LWC. Decorators, reactivity, getters in templates, debouncing, and component communication — LWC as applied JavaScript. By the end of this video you will be able to map @api, @track, and @wire to plain JavaScript concepts; drive templates with getters and immutable state updates; debounce user input and communicate between components correctly.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** JavaScript Mastery · JavaScript in the Browser & LWC

**[0:30–1:06] Decorators are annotations on class members**

- **Narration (word-for-word):** @api marks a class field as a public property a parent can set (or App Builder can configure). @track forces deep observation of an object/array field — needed only when you MUTATE nested data, which you can usually avoid by reassigning immutably instead. @wire declares a reactive data dependency: when its parameters change, the framework re-invokes the adapter. Strip the decorators away and it is all fundamentals: public fields, change detection by reference (the immutability lesson), and functions re-run when inputs change.
- **On screen:** Animated explainer diagram for "Decorators are annotations on class members": the key entities appear and connect exactly as the narration names them.

**[1:06–1:42] Templates read state; getters shape it**

- **Narration (word-for-word):** An LWC template binds to fields and getters: {status}, {formattedDate}, for:each iteration, lwc:if conditions. The discipline that keeps components maintainable is: fields hold RAW state; getters derive everything presentational (labels, filtered lists, css classes). Getters re-evaluate on re-render, so they stay in sync automatically — no manual "update the label too" bookkeeping. Handlers stay thin: read the event, update state immutably, let getters and the template do the rest.
- **On screen:** Animated explainer diagram for "Templates read state; getters shape it": the key entities appear and connect exactly as the narration names them.

**[1:42–2:18] Code walk-through — Templates read state; getters shape it**

- **Narration (word-for-word):** Now watch the same idea in code. Raw state in fields, presentation in getters — the maintainable LWC shape. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[2:18–2:54] Debouncing and component communication**

- **Narration (word-for-word):** Let's actually do this together. Search-as-you-type must not fire an Apex call per keystroke. Debouncing waits until typing pauses: store a timer, clear it on each keystroke, run the search when 300ms pass quietly — a closure over a timer id, nothing more. Communication follows the platform rules: parent → child through @api properties; child → parent through CustomEvent; unrelated components through Lightning Message Service. Resist back-channel hacks (querying another component's internals) — they break shadow-DOM encapsulation and every future refactor.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Search-as-you-type must not fire an Apex call per keystroke.
  2. Debouncing waits until typing pauses: store a timer, clear it on each keystroke, run the search when 300ms pass quietly — a closure over a timer id, nothing more.

**[2:54–3:30] Code walk-through — Debouncing and component communication**

- **Narration (word-for-word):** Now watch the same idea in code. A ten-line debounce: the difference between 1 API call and 15 per search. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the javascript snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVASCRIPT

**[3:30–4:15] Real story — Search that hammered the org**

- **Narration (word-for-word):** Here is why this matters in the real world. An account search component fired an Apex call on every keystroke. Typing "enterprise" produced ten calls; under month-end load the org's concurrent Apex limit was breached and unrelated integrations started failing with REQUEST_LIMIT_EXCEEDED. What did they do? The team added a 300ms debounce to the input handler and moved the search to a reactive @wire on the debounced term, so only settled queries reached the server. And the payoff: API calls per search session dropped by roughly 90%, the limit breaches stopped, and the debounce helper was published in the team's shared LWC utilities module.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Search that hammered the org

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Decorators annotate plain class members — the concepts underneath are standard JS. Fields hold raw state; getters derive presentation; handlers stay thin. Debounce user input before it reaches the server. Parent → @api down; child → CustomEvent up; unrelated → message service.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is JavaScript patterns that power LWC — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
