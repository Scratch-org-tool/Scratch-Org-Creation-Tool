import type { CurriculumPath } from './curriculum.types';

/**
 * Path 5 — JavaScript Mastery (Intermediate, programming track).
 * The language track behind every Lightning Web Component, browser console
 * session, and Node-based DevOps script in this platform. Written for someone
 * who can navigate Salesforce but has never owned JavaScript properly.
 */
export const javascriptPath: CurriculumPath = {
  id: 'js-training',
  title: 'JavaScript Mastery',
  tagline: 'Own the language behind LWC, the browser, and every DevOps script.',
  description:
    'JavaScript runs every Lightning Web Component, every browser DevTools session, and most automation scripts in a modern Salesforce team. This path builds the language from first principles — values, functions, and objects — through modern ES6+ syntax and asynchronous programming, and finishes where Salesforce developers live: the DOM, REST APIs, and the exact patterns Lightning Web Components are built on.',
  level: 'intermediate',
  category: 'programming',
  badge: 'JavaScript Craftsman',
  estimatedHours: 7,
  skills: ['Language fundamentals', 'Modern ES6+ syntax', 'Async & promises', 'DOM, REST & LWC patterns'],
  modules: [
    {
      id: 'js-fundamentals',
      title: 'JavaScript Fundamentals',
      summary:
        'Values, types, variables, control flow, functions, arrays, and objects — the mental model everything else builds on.',
      lessons: [
        {
          id: 'js-values-types-variables',
          title: 'Values, types, and variables',
          summary:
            'What JavaScript actually is, how dynamic typing works, and how to declare variables you can trust.',
          durationMinutes: 15,
          objectives: [
            'Explain where JavaScript runs and why Salesforce developers need it',
            'Name the primitive types and predict simple type coercions',
            'Choose correctly between const and let, and avoid var',
          ],
          sections: [
            {
              heading: 'One language, everywhere your work runs',
              body:
                'JavaScript is the only language web browsers execute natively — which makes it the language of Lightning Web Components, Visualforce enhancements, browser DevTools, and every embedded widget your users touch. The same language also runs on servers through Node.js, which is why the Salesforce CLI, most deployment scripts, and this very platform are written in it.\n\nUnlike Apex, JavaScript is not compiled inside Salesforce and has no governor limits — it runs on the user\'s machine (or your build server). That freedom cuts both ways: you gain instant feedback and a huge ecosystem, and you take on responsibility for correctness that the platform will not enforce for you.',
            },
            {
              heading: 'Dynamic types without surprises',
              body:
                'JavaScript has a small set of primitive types: string, number, boolean, null, undefined, bigint, and symbol — plus objects for everything else. A variable has no fixed type; the VALUE it currently holds does. typeof tells you what you are looking at.\n\nCoercion is where beginners get burned: the == operator converts types before comparing ("5" == 5 is true), while === compares value AND type ("5" === 5 is false). Professional JavaScript uses === and !== everywhere. The other classic: undefined means "never assigned", while null means "deliberately empty" — the difference matters when an Apex method returns no data versus an empty payload.',
              code: {
                language: 'javascript',
                snippet:
                  "const orgLimit = 100000;          // number\nconst orgName = 'UAT Full Copy';  // string\nlet isConnected = false;          // boolean — will change later\n\nconsole.log(typeof orgLimit);     // 'number'\nconsole.log('5' == 5);            // true  — coerced, avoid\nconsole.log('5' === 5);           // false — strict, always use\nconsole.log(null == undefined);   // true  — the one coercion trap to memorize",
                caption: 'Strict equality (===) removes an entire class of production bugs.',
              },
            },
            {
              heading: 'const by default, let when it changes, var never',
              body:
                'const declares a binding that cannot be reassigned — your default for everything. let declares a block-scoped variable for values that genuinely change (loop counters, accumulators). var is the legacy form with function-wide scope and "hoisting" behavior that creates bugs; modern codebases (including LWC) simply never use it.\n\nNote the nuance: const prevents REASSIGNMENT, not mutation. A const array can still be pushed to; a const object\'s fields can still change. That is fine in practice — the discipline you want is "one name, one meaning" inside any scope.',
            },
          ],
          realWorld: {
            title: 'The equality bug that hid a data-loader failure',
            scenario:
              'A team\'s custom data-load monitor compared record counts with ==. The API returned counts as strings, the UI stored expectations as numbers — "2500" == 2500 passed, so a partial load of 2,500 out of 25,000 records showed green because a separate truncation bug also cut a digit.',
            solution:
              'They switched every comparison to === and added an explicit Number() conversion at the API boundary, so mismatched types failed loudly in testing instead of silently agreeing in production.',
            outcome:
              'The next partial load failed the dashboard immediately, was re-run the same afternoon, and the team adopted a lint rule (eqeqeq) so the class of bug cannot return.',
          },
          keyTakeaways: [
            'JavaScript runs in the browser (LWC, DevTools) and on servers (Node, the SF CLI)',
            'Values have types; variables do not — use typeof to inspect',
            'Always use === / !==; convert types explicitly at boundaries',
            'Declare with const by default, let when reassignment is real, var never',
          ],
          resources: [
            {
              title: 'MDN: JavaScript first steps',
              url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps',
              source: 'other',
              note: 'The canonical reference for the language',
            },
            {
              title: 'Modern JavaScript Development (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/modern-javascript-development',
              source: 'trailhead',
              note: 'Salesforce\'s own JS refresher for LWC work',
            },
          ],
        },
        {
          id: 'js-control-flow-functions',
          title: 'Control flow and functions',
          summary:
            'if/else, loops, and the three ways to write functions — plus scope and closures explained without mystery.',
          durationMinutes: 18,
          objectives: [
            'Use if/else, switch, and the ternary operator appropriately',
            'Write function declarations, expressions, and arrow functions',
            'Explain scope and closures with a practical example',
          ],
          sections: [
            {
              heading: 'Branching and looping',
              body:
                'if / else if / else covers most decisions; switch reads better when one value routes to many cases (like a deployment status: Pending, InProgress, Succeeded, Failed). The ternary operator (condition ? a : b) is for choosing a VALUE inline — great for display labels, wrong for multi-step logic.\n\nFor iteration, modern code prefers for...of to loop values of any array ("for (const org of orgs)"), classic for when you need the index, and while for "until something happens" polling loops — like waiting on a deploy status. for...in walks object KEYS and surprises people on arrays; reserve it for objects.',
            },
            {
              heading: 'Three ways to write a function',
              body:
                'Function declarations (function name() {}) are hoisted — callable before their definition — and read well for top-level operations. Function expressions assign a function to a const. Arrow functions (=>) are the compact modern form used for callbacks and array transforms.\n\nThe real difference is "this": arrow functions do not create their own this — they inherit it from the surrounding scope. That is exactly why LWC event handlers and array callbacks written as arrows "just work" while old-style function callbacks needed .bind(this). Default parameters (function deploy(target, validateOnly = false)) and rest parameters (...args) round out the everyday toolkit.',
              code: {
                language: 'javascript',
                snippet:
                  "function summarize(results) {                 // declaration — hoisted\n    return results.filter(isFailure).length;\n}\n\nconst isFailure = (result) => !result.success; // arrow — inherits `this`\n\nconst retry = async (fn, attempts = 3) => {    // default parameter\n    for (let i = 1; i <= attempts; i++) {\n        try { return await fn(); }\n        catch (err) { if (i === attempts) throw err; }\n    }\n};",
                caption: 'Declarations for named operations, arrows for callbacks and utilities.',
              },
            },
            {
              heading: 'Scope and closures — the feature everything relies on',
              body:
                'Scope is "where a name is visible": block scope for let/const, plus the chain of enclosing functions. A closure is simply a function that REMEMBERS the scope it was created in, even after that scope has finished running.\n\nClosures are not an interview trick — they are how real code is structured. A function that returns a configured function ("makeLogger(prefix)"), a debounced search handler that remembers its timer, a counter that keeps private state without globals: all closures. Once you can predict what a closure captures, callbacks and event handlers stop feeling magical.',
              code: {
                language: 'javascript',
                snippet:
                  "function makePoller(jobId) {\n    let attempts = 0;                       // private state, captured\n    return async function poll() {\n        attempts += 1;\n        const status = await fetchStatus(jobId);\n        console.log(`Attempt ${attempts}: ${status}`);\n        return status;\n    };\n}\n\nconst pollDeploy = makePoller('0Af...');    // remembers jobId + attempts\nawait pollDeploy();                          // Attempt 1: InProgress\nawait pollDeploy();                          // Attempt 2: Succeeded",
                caption: 'A closure keeps jobId and attempts alive between calls — no globals needed.',
              },
            },
          ],
          realWorld: {
            title: 'A flaky "Cancel deploy" button',
            scenario:
              'A deployment console\'s Cancel button sometimes cancelled the WRONG job. The click handler was wired inside a classic for loop with var i, so every handler closed over the same final loop variable — a textbook closure-over-var bug.',
            solution:
              'Changing var to let gave each loop iteration its own binding, and the team refactored the handlers to arrow functions that captured the specific job object rather than an index.',
            outcome:
              'Cancellations became deterministic, and the incident became the team\'s go-to onboarding story for why block scoping and closures must be understood, not memorized.',
          },
          keyTakeaways: [
            'Use for...of for values, classic for when you need the index, while for polling',
            'Arrow functions inherit this — the reason they fit callbacks and LWC handlers',
            'A closure is a function plus the variables it captured at creation',
            'Block scoping (let/const) eliminates the classic loop-handler bug',
          ],
          resources: [
            {
              title: 'MDN: Functions guide',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions',
              source: 'other',
            },
            {
              title: 'MDN: Closures',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures',
              source: 'other',
              note: 'The clearest closure explanation in print',
            },
          ],
        },
        {
          id: 'js-arrays-objects',
          title: 'Arrays and objects: shaping data',
          summary:
            'map, filter, reduce, object literals, optional chaining, and immutable updates — the daily bread of UI and script work.',
          durationMinutes: 18,
          objectives: [
            'Transform lists with map, filter, find, some/every, and reduce',
            'Read and write nested objects safely with optional chaining',
            'Update data immutably with spread — the pattern LWC reactivity expects',
          ],
          sections: [
            {
              heading: 'Arrays: transform, don\'t mutate-in-place',
              body:
                'Salesforce work is list work: records, deploy results, org members. The core methods — map (transform each item), filter (keep some), find (first match), some/every (boolean checks), reduce (fold to one value) — replace almost every manual loop and read as intent instead of mechanics.\n\nEach takes a callback and returns a NEW array (except reduce, which returns whatever you build). Chaining them ("results.filter(r => !r.success).map(r => r.fullName)") is the JavaScript equivalent of a SOQL query over in-memory data. Know the mutators too — push, splice, sort — and remember sort mutates in place and compares as strings unless you pass a comparator.',
              code: {
                language: 'javascript',
                snippet:
                  "const results = [\n    { fullName: 'AccountTrigger', success: true,  time: 340 },\n    { fullName: 'CaseFlow',       success: false, time: 45  },\n    { fullName: 'OppHandler',     success: false, time: 210 },\n];\n\nconst failures   = results.filter(r => !r.success).map(r => r.fullName);\nconst totalTime  = results.reduce((sum, r) => sum + r.time, 0);\nconst allPassed  = results.every(r => r.success);\n\nconsole.log(failures);   // ['CaseFlow', 'OppHandler']\nconsole.log(totalTime);  // 595\nconsole.log(allPassed);  // false",
                caption: 'filter → map → reduce reads like the sentence you would say out loud.',
              },
            },
            {
              heading: 'Objects: literals, access, and safe navigation',
              body:
                'Objects are labeled boxes of key/value pairs — the shape of every API response you will ever parse. Dot access (org.alias) for known keys, bracket access (org[fieldName]) for dynamic ones. Object.keys / values / entries turn objects back into arrays for iteration.\n\nOptional chaining (response?.result?.records) returns undefined instead of throwing when a link in the chain is missing — the polite way to read deep API payloads. Pair it with the nullish coalescing operator (?? "default") to supply fallbacks only when the value is null/undefined, not when it is legitimately 0 or false.',
            },
            {
              heading: 'Immutable updates with spread — why LWC cares',
              body:
                'The spread operator (...) copies arrays and objects: {...org, status: "Connected"} builds a NEW object with one field changed; [...list, newItem] builds a NEW array with one more element. Destructuring goes the other way, unpacking values into names: const { alias, instanceUrl } = org.\n\nThis is not style preference. LWC (like React) detects changes by reference: if you mutate an object in place, the framework may not re-render because the reference did not change. Teams that internalize "change = new object" ship reactive UIs that update reliably; teams that mutate chase ghost bugs.',
              code: {
                language: 'javascript',
                snippet:
                  "const org = { alias: 'uat', status: 'Disconnected', modules: ['data'] };\n\n// WRONG for reactive UIs — same reference, framework may not notice\norg.status = 'Connected';\n\n// RIGHT — a new object; every consumer sees a new reference\nconst connected = { ...org, status: 'Connected' };\n\n// Arrays too\nconst withDeploy = { ...connected, modules: [...connected.modules, 'deployment'] };\n\nconst { alias, status } = withDeploy;   // destructuring\nconsole.log(alias, status);             // 'uat' 'Connected'",
                caption: 'Spread-to-copy is the update pattern LWC and React reactivity are built around.',
              },
            },
          ],
          realWorld: {
            title: 'The dashboard that stopped refreshing',
            scenario:
              'An LWC org-health dashboard updated its data by pushing into an existing array property. The wire data changed, the console.log showed fresh values — but the table on screen never re-rendered, and users kept acting on stale deploy statuses.',
            solution:
              'The team replaced in-place mutation with immutable updates: this.rows = [...this.rows, newRow] and row edits via this.rows = this.rows.map(...). References changed, so the framework re-rendered.',
            outcome:
              'The dashboard became trustworthy again, and "new data means new object" went into the team\'s LWC code-review checklist — the single most common fix in their component reviews.',
          },
          keyTakeaways: [
            'map/filter/reduce express intent — prefer them to manual loops',
            'Optional chaining (?.) and nullish coalescing (??) make API payloads safe to read',
            'Spread copies; destructuring unpacks — learn both directions',
            'LWC detects change by reference: update immutably or the UI will not react',
          ],
          resources: [
            {
              title: 'MDN: Array methods reference',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
              source: 'other',
            },
            {
              title: 'JavaScript.info: Objects',
              url: 'https://javascript.info/object',
              source: 'other',
              note: 'Deep, readable chapter series',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-js-fund-1',
          topic: 'Types',
          prompt: 'What does "5" === 5 evaluate to in JavaScript, and why?',
          options: [
            'true — the values are equal after coercion',
            'false — strict equality compares type and value, and the types differ',
            'true — numbers are always coerced to strings',
            'It throws a TypeError',
          ],
          correctIndex: 1,
          explanation:
            'The === operator never coerces: a string and a number are different types, so the comparison is false. Use === everywhere and convert explicitly.',
        },
        {
          id: 'q-js-fund-2',
          topic: 'Variables',
          prompt: 'Which declaration should be your default for a value that is never reassigned?',
          options: ['var', 'let', 'const', 'global'],
          correctIndex: 2,
          explanation:
            'const communicates "one name, one meaning" and prevents accidental reassignment. Reach for let only when the binding genuinely changes; var is legacy.',
        },
        {
          id: 'q-js-fund-3',
          topic: 'Types',
          prompt: 'What is the practical difference between null and undefined?',
          options: [
            'They are interchangeable in all code',
            'undefined means never assigned; null means deliberately empty',
            'null is a string; undefined is a number',
            'undefined can only appear in strict mode',
          ],
          correctIndex: 1,
          explanation:
            'undefined is the absence of assignment; null is an intentional "no value" a developer (or API) set. APIs often use null to mean "cleared on purpose".',
        },
        {
          id: 'q-js-fund-4',
          topic: 'Functions',
          prompt: 'What is special about how arrow functions handle `this`?',
          options: [
            'They create a fresh `this` on every call',
            'They inherit `this` from the scope where they were defined',
            'They cannot access `this` at all',
            '`this` inside an arrow always refers to the window object',
          ],
          correctIndex: 1,
          explanation:
            'Arrows have no own `this` — they capture the surrounding scope\'s. That is why they are ideal for callbacks and class-field handlers in LWC.',
        },
        {
          id: 'q-js-fund-5',
          topic: 'Closures',
          prompt: 'A function returned from another function still uses the outer function\'s variables. What is this called?',
          options: ['Hoisting', 'A closure', 'Prototypal inheritance', 'Currying'],
          correctIndex: 1,
          explanation:
            'A closure is a function bundled with the scope it was created in — the returned function keeps the outer variables alive.',
        },
        {
          id: 'q-js-fund-6',
          topic: 'Arrays',
          prompt: 'Which method chain returns the names of only the failed results?',
          options: [
            'results.map(r => r.name).filter(r => !r.success)',
            'results.filter(r => !r.success).map(r => r.name)',
            'results.reduce(r => r.name)',
            'results.forEach(r => !r.success && r.name)',
          ],
          correctIndex: 1,
          explanation:
            'Filter first (keep failures), then map to names. Mapping first would discard the success flag before you filter on it.',
        },
        {
          id: 'q-js-fund-7',
          topic: 'Arrays',
          prompt: 'What does reduce do?',
          options: [
            'Removes elements matching a predicate',
            'Sorts the array in descending order',
            'Folds an array into a single accumulated value',
            'Splits an array into equal chunks',
          ],
          correctIndex: 2,
          explanation:
            'reduce runs a callback with an accumulator across every element — sums, lookups by id, and grouped maps are all one-liner reduces.',
        },
        {
          id: 'q-js-fund-8',
          topic: 'Objects',
          prompt: 'What does response?.result?.records evaluate to when result is missing?',
          options: [
            'It throws "cannot read properties of undefined"',
            'undefined — optional chaining short-circuits safely',
            'null — optional chaining converts gaps to null',
            'An empty array',
          ],
          correctIndex: 1,
          explanation:
            'Optional chaining stops at the first null/undefined link and yields undefined instead of throwing — ideal for deep API payloads.',
        },
        {
          id: 'q-js-fund-9',
          topic: 'Immutability',
          prompt: 'Why do LWC and React codebases update state with {...obj, field: value} instead of obj.field = value?',
          options: [
            'The spread form runs faster',
            'Frameworks detect changes by reference — a new object triggers re-render, a mutation may not',
            'Direct assignment is a syntax error in strict mode',
            'Spread automatically persists the change to the server',
          ],
          correctIndex: 1,
          explanation:
            'Change detection compares references. Mutating in place keeps the same reference, so the UI can silently skip re-rendering.',
        },
        {
          id: 'q-js-fund-10',
          topic: 'Control flow',
          prompt: 'Which loop is the modern default for iterating the VALUES of an array?',
          options: ['for...in', 'for...of', 'while(true)', 'do...while'],
          correctIndex: 1,
          explanation:
            'for...of iterates values directly. for...in iterates keys (and surprises on arrays); reserve it for objects.',
        },
      ],
    },
    {
      id: 'js-modern',
      title: 'Modern JavaScript (ES6+)',
      summary:
        'The syntax and structure of current codebases: template literals, destructuring, modules, classes, and asynchronous programming with promises and async/await.',
      lessons: [
        {
          id: 'js-modern-syntax',
          title: 'Modern syntax that changed the language',
          summary:
            'Template literals, destructuring in depth, spread/rest, and short-circuit patterns — the difference between 2010 code and today\'s.',
          durationMinutes: 15,
          objectives: [
            'Build strings with template literals instead of concatenation',
            'Destructure objects and arrays in parameters, returns, and imports',
            'Use spread/rest and default values to write flexible functions',
          ],
          sections: [
            {
              heading: 'Template literals: strings you can read',
              body:
                'Backtick strings interpolate expressions with ${...} and span multiple lines without escape gymnastics. Every log line, error message, and generated snippet in a modern codebase uses them: `Deploy ${id} finished in ${seconds}s`.\n\nThey also enable tagged templates (a function that processes a template), which libraries use for things like HTML escaping and GraphQL queries. You will mostly consume those rather than write them — but recognize the syntax when you see it.',
            },
            {
              heading: 'Destructuring everywhere',
              body:
                'Destructuring unpacks values by shape. In assignments: const { alias, instanceUrl } = org. In function parameters — the big one — it replaces "options objects plus manual reads" with a self-documenting signature: function connect({ alias, sandbox = false }) {}.\n\nArray destructuring pairs with functions that return multiple values: const [first, ...rest] = queue. Renaming (const { Id: recordId } = record) keeps external field names out of your internal style. Once destructuring is in your fingers, code reviews get shorter because intent is visible in the signature.',
              code: {
                language: 'javascript',
                snippet:
                  "function deployMetadata({ sourceOrg, targetOrg, checkOnly = true, tests = [] }) {\n    console.log(`Deploying ${sourceOrg} -> ${targetOrg} (checkOnly=${checkOnly})`);\n    return run({ sourceOrg, targetOrg, checkOnly, tests });\n}\n\n// Call sites read like configuration:\ndeployMetadata({ sourceOrg: 'dev', targetOrg: 'uat' });\ndeployMetadata({ sourceOrg: 'uat', targetOrg: 'prod', checkOnly: false,\n                 tests: ['AccountTriggerTest'] });",
                caption: 'Destructured parameters with defaults: the signature documents itself.',
              },
            },
            {
              heading: 'Spread, rest, and short-circuit idioms',
              body:
                'Spread expands (merge objects, clone arrays, pass an array as arguments); rest collects (function log(...messages)). Together they replace most uses of arguments, concat, and Object.assign.\n\nThe everyday logical idioms: value ?? fallback (default only for null/undefined), flag && doThing() (call when truthy), and ||= / ??= for lazy initialization. Used sparingly they make code tighter; overused they make it cryptic — a good rule is one short-circuit per line.',
            },
          ],
          realWorld: {
            title: 'An options object nobody could call correctly',
            scenario:
              'A shared deploy helper took seven positional parameters ("deploy(src, tgt, true, false, null, undefined, 300)"). Call sites were unreadable, arguments were regularly transposed, and one swapped boolean silently turned validation-only deploys into real ones in a staging org.',
            solution:
              'The helper was rewritten to a single destructured options parameter with defaults, making every call site self-describing and making the dangerous flag (checkOnly) explicit and defaulted to safe.',
            outcome:
              'The transposition class of bug disappeared, new team members could use the helper without reading its source, and the safe-by-default signature was adopted as the team standard for utilities.',
          },
          keyTakeaways: [
            'Template literals replace string concatenation everywhere',
            'Destructured parameters with defaults are the modern options pattern',
            'Spread expands, rest collects — they are two sides of ...',
            'Prefer ?? over || for defaults when 0 or false are valid values',
          ],
          resources: [
            {
              title: 'MDN: Destructuring assignment',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment',
              source: 'other',
            },
            {
              title: 'JavaScript.info: Modern JavaScript',
              url: 'https://javascript.info/',
              source: 'other',
              note: 'Free, current, and thorough',
            },
          ],
        },
        {
          id: 'js-modules-classes',
          title: 'Modules and classes',
          summary:
            'import/export, how LWC files are modules, class syntax, getters, and when a plain object beats a class.',
          durationMinutes: 18,
          objectives: [
            'Split code across ES modules with named and default exports',
            'Write classes with fields, methods, getters, and inheritance',
            'Recognize LWC components as standard ES modules and classes',
          ],
          sections: [
            {
              heading: 'ES modules: one file, one responsibility',
              body:
                'Modules give every file its own scope: nothing leaks globally, and you say exactly what crosses the boundary. Named exports (export const parseOrg = ...) are the workhorse — they refactor cleanly and autocomplete well. A default export is the module\'s single main thing; LWC uses exactly one default export per component.\n\nImports mirror the exports: import { parseOrg } from "./org-utils"; import MyComponent from "./myComponent". Circular imports (A imports B imports A) are the classic module smell — when you hit one, extract the shared piece into a third module instead of fighting the loader.',
            },
            {
              heading: 'Classes without ceremony',
              body:
                'A class bundles state (fields) and behavior (methods) behind a constructor: class DeployJob { constructor(id) { this.id = id; } }. Class fields can be declared inline with defaults, getters compute derived values on access, and static members belong to the class itself.\n\nUnder the hood classes are prototype sugar — which matters only in that instanceof, method overriding, and super calls all behave predictably. extends models "is-a" relationships; use it sparingly. For pure data, a plain object literal is lighter than a class; reach for classes when behavior and state genuinely travel together.',
              code: {
                language: 'javascript',
                snippet:
                  "class DeployJob {\n    static MAX_POLLS = 60;\n    status = 'Pending';                 // class field with default\n\n    constructor(id, targetOrg) {\n        this.id = id;\n        this.targetOrg = targetOrg;\n    }\n    get isDone() {                      // derived, computed on access\n        return ['Succeeded', 'Failed'].includes(this.status);\n    }\n    advance(next) {\n        this.status = next;\n        return this;\n    }\n}\n\nconst job = new DeployJob('0Af000...', 'uat');\njob.advance('InProgress');\nconsole.log(job.isDone);               // false",
                caption: 'Fields, a getter, and a fluent method — everyday class JavaScript.',
              },
            },
            {
              heading: 'LWC is "just" modules and classes',
              body:
                'Open any Lightning Web Component: import { LightningElement, api } from "lwc"; export default class OrgCard extends LightningElement { @api org; get title() { ... } }. That is a standard ES module with a default-exported class extending a base class, plus decorators.\n\nThis is the payoff of the whole module: once modules, classes, fields, and getters are second nature, LWC stops being a framework to memorize and becomes a thin, learnable layer — lifecycle hooks and decorators — over the JavaScript you already own.',
            },
          ],
          realWorld: {
            title: 'Untangling a 3,000-line utils file',
            scenario:
              'A team\'s LWC codebase had grown a single utils.js imported by 40 components. Unrelated helpers shared state through module-level variables, a rename broke three components nobody expected, and tree-shaking was impossible — every component shipped all 3,000 lines.',
            solution:
              'They split the file into focused modules (dates.js, orgFormat.js, deployPolling.js) with named exports only, enforced one-responsibility-per-module in review, and let the bundler drop unused code per component.',
            outcome:
              'Component bundles shrank measurably, renames became mechanical IDE operations, and the "where does this helper live" question stopped consuming code-review time.',
          },
          keyTakeaways: [
            'Named exports for utilities; one default export for a module\'s main thing',
            'Classes = constructor + fields + methods + getters; extends for true is-a only',
            'Plain objects beat classes for pure data',
            'Every LWC component is a normal ES module exporting a class',
          ],
          resources: [
            {
              title: 'MDN: JavaScript modules',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules',
              source: 'other',
            },
            {
              title: 'LWC Dev Guide: Component structure',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/create-components-introduction.html',
              source: 'developer',
              note: 'See modules + classes in LWC context',
            },
          ],
        },
        {
          id: 'js-async',
          title: 'Asynchronous JavaScript: promises and async/await',
          summary:
            'The event loop in one picture, promises as values, async/await with real error handling, and running work in parallel.',
          durationMinutes: 20,
          objectives: [
            'Explain why JavaScript is non-blocking and what the event loop does',
            'Consume and create promises; handle errors with try/catch and .catch',
            'Run independent operations in parallel with Promise.all / allSettled',
          ],
          sections: [
            {
              heading: 'One thread, never blocked',
              body:
                'JavaScript runs on a single thread. Instead of waiting for slow work (network calls, timers), it hands the work to the environment and continues; when the work finishes, a callback is queued and the event loop runs it once the current code completes. That is why a UI stays responsive while three API calls are in flight — and why nothing you write should ever "sleep" the thread.\n\nThe practical consequence: any function that touches the network is asynchronous, returns immediately, and delivers its result LATER. Every Apex call from LWC, every fetch, every Salesforce CLI invocation from Node follows this shape.',
            },
            {
              heading: 'Promises, then async/await',
              body:
                'A promise is an object representing a future result: pending, then fulfilled with a value or rejected with an error. You can chain (.then) and trap errors (.catch), but modern code prefers async/await: inside an async function, await pauses THAT FUNCTION (not the thread) until the promise settles, and rejected promises become throwable errors you handle with try/catch.\n\nTwo rules prevent 90% of async bugs. First: an async function ALWAYS returns a promise — callers must await it (a missing await is the classic silent bug). Second: handle errors at the level that can act on them; a swallowed .catch(() => {}) hides failures the user needed to see.',
              code: {
                language: 'javascript',
                snippet:
                  "async function waitForDeploy(jobId) {\n    for (let i = 0; i < 60; i++) {\n        const res = await fetch(`/api/deploys/${jobId}`);\n        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);\n        const { status } = await res.json();\n        if (status === 'Succeeded') return status;\n        if (status === 'Failed') throw new Error('Deployment failed');\n        await new Promise(resolve => setTimeout(resolve, 5000)); // poll delay\n    }\n    throw new Error('Timed out waiting for deployment');\n}\n\ntry {\n    await waitForDeploy('0Af000...');\n    console.log('Ready to release');\n} catch (err) {\n    console.error(err.message);   // one place, real handling\n}",
                caption: 'A polling loop with await: sequential-looking code, fully non-blocking.',
              },
            },
            {
              heading: 'Parallelism on purpose',
              body:
                'Sequential awaits run one after another — correct when step B needs step A\'s result, wasteful when the calls are independent. Promise.all([a, b, c]) starts everything at once and awaits all results together, failing fast if ANY rejects. Promise.allSettled never short-circuits — you get every outcome, ideal for "check all 12 orgs and report each".\n\nThe habit to build: when you write two consecutive awaits, ask whether the second needs the first. Three independent 2-second API calls are 6 seconds sequential and 2 seconds with Promise.all — users feel that difference on every page load.',
              code: {
                language: 'javascript',
                snippet:
                  "// Sequential: ~6s. Parallel: ~2s.\nconst [limits, orgs, jobs] = await Promise.all([\n    fetch('/api/limits').then(r => r.json()),\n    fetch('/api/orgs').then(r => r.json()),\n    fetch('/api/jobs?active=true').then(r => r.json()),\n]);\n\n// Health-check every org; one bad org must not hide the others\nconst checks = await Promise.allSettled(orgs.map(o => pingOrg(o.alias)));\nconst down = checks\n    .map((c, i) => ({ alias: orgs[i].alias, ok: c.status === 'fulfilled' }))\n    .filter(c => !c.ok);",
                caption: 'Promise.all for speed; allSettled when every result matters individually.',
              },
            },
          ],
          realWorld: {
            title: 'The environment page that took nine seconds',
            scenario:
              'An environment overview loaded org limits, connected orgs, and recent jobs with three sequential awaits, then pinged each of six orgs one by one. The page took nine seconds; users assumed the tool was broken and kept a spreadsheet instead.',
            solution:
              'The three independent fetches moved into one Promise.all, and the six pings into Promise.allSettled so a single unreachable sandbox no longer failed the whole page — its card simply showed "unreachable".',
            outcome:
              'Load time dropped to just over two seconds, the spreadsheet died, and the team added a lint rule flagging consecutive awaits on independent calls.',
          },
          keyTakeaways: [
            'JavaScript never blocks: slow work completes later via the event loop',
            'await pauses the function, not the thread; async functions return promises',
            'A missing await is the classic silent bug — lint for floating promises',
            'Promise.all for independent speed; allSettled when each result must be reported',
          ],
          resources: [
            {
              title: 'MDN: Using promises',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
              source: 'other',
            },
            {
              title: 'JavaScript.info: Async/await',
              url: 'https://javascript.info/async-await',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-js-mod-1',
          topic: 'Template literals',
          prompt: 'Which string syntax supports ${expression} interpolation?',
          options: ['Single quotes', 'Double quotes', 'Backticks (template literals)', 'All string forms'],
          correctIndex: 2,
          explanation:
            'Only backtick template literals interpolate expressions and span multiple lines naturally.',
        },
        {
          id: 'q-js-mod-2',
          topic: 'Destructuring',
          prompt: 'What does function connect({ alias, sandbox = false }) demonstrate?',
          options: [
            'Two positional parameters',
            'A destructured options parameter with a default value',
            'A rest parameter',
            'A generator function',
          ],
          correctIndex: 1,
          explanation:
            'The function takes one object and unpacks alias and sandbox from it, defaulting sandbox to false — the modern options-object pattern.',
        },
        {
          id: 'q-js-mod-3',
          topic: 'Modules',
          prompt: 'How many default exports may one ES module have?',
          options: ['Unlimited', 'One', 'One per class', 'Zero — default exports were removed'],
          correctIndex: 1,
          explanation:
            'A module may have any number of named exports but at most one default export — LWC components use exactly one.',
        },
        {
          id: 'q-js-mod-4',
          topic: 'Classes',
          prompt: 'What is a getter in a class?',
          options: [
            'A method that must be called with parentheses',
            'A property computed on access, defined with the get keyword',
            'A static factory function',
            'A private field',
          ],
          correctIndex: 1,
          explanation:
            'get title() { ... } computes a derived value each time .title is read — LWC templates bind to getters constantly.',
        },
        {
          id: 'q-js-mod-5',
          topic: 'LWC connection',
          prompt: 'Structurally, what is a Lightning Web Component\'s JavaScript file?',
          options: [
            'A proprietary Salesforce format',
            'An ES module that default-exports a class extending LightningElement',
            'A JSON manifest',
            'An immediately-invoked function expression',
          ],
          correctIndex: 1,
          explanation:
            'LWC deliberately builds on web standards: standard module, standard class, plus decorators like @api.',
        },
        {
          id: 'q-js-mod-6',
          topic: 'Event loop',
          prompt: 'While a fetch call is in flight, what does the JavaScript thread do?',
          options: [
            'Blocks until the response arrives',
            'Continues running other code; the response callback is queued for later',
            'Spawns a second thread per request',
            'Pauses all rendering',
          ],
          correctIndex: 1,
          explanation:
            'The environment performs the I/O; JavaScript stays free. When the response lands, the continuation is queued and the event loop runs it.',
        },
        {
          id: 'q-js-mod-7',
          topic: 'Async/await',
          prompt: 'What does an async function ALWAYS return?',
          options: ['undefined', 'The awaited value directly', 'A promise', 'An iterator'],
          correctIndex: 2,
          explanation:
            'async wraps the return value in a promise — which is why callers must await (or .then) it, and why a missing await slips by silently.',
        },
        {
          id: 'q-js-mod-8',
          topic: 'Error handling',
          prompt: 'Inside an async function, how do you handle a rejected awaited promise?',
          options: [
            'You cannot — rejections crash the page',
            'With try/catch around the await',
            'With window.onerror only',
            'By setting promise.rejected = false',
          ],
          correctIndex: 1,
          explanation:
            'await converts rejection into a thrown error, so ordinary try/catch is the handling mechanism.',
        },
        {
          id: 'q-js-mod-9',
          topic: 'Parallelism',
          prompt: 'Three independent 2-second API calls: how long with Promise.all versus sequential awaits?',
          options: [
            '~2s parallel vs ~6s sequential',
            '~6s in both cases',
            '~2s in both cases',
            'Promise.all cannot run calls in parallel',
          ],
          correctIndex: 0,
          explanation:
            'Promise.all starts all three immediately and resolves when the slowest finishes; sequential awaits add the durations.',
        },
        {
          id: 'q-js-mod-10',
          topic: 'Parallelism',
          prompt: 'When should you prefer Promise.allSettled over Promise.all?',
          options: [
            'When you need the fastest single result',
            'When every individual outcome must be reported even if some fail',
            'When promises must run one at a time',
            'Never — allSettled is deprecated',
          ],
          correctIndex: 1,
          explanation:
            'allSettled never short-circuits: you receive fulfilled/rejected status per promise — ideal for health checks across many orgs.',
        },
      ],
    },
    {
      id: 'js-browser-lwc',
      title: 'JavaScript in the Browser & LWC',
      summary:
        'The DOM, events, fetch and REST APIs, and the exact JavaScript patterns Lightning Web Components run on — closing the loop back to Salesforce.',
      lessons: [
        {
          id: 'js-dom-events',
          title: 'The DOM and events',
          summary:
            'Selecting and updating elements, listening to events, bubbling and delegation — and how LWC templates wrap the same machinery.',
          durationMinutes: 18,
          objectives: [
            'Select and update DOM elements safely',
            'Wire event listeners and read event payloads',
            'Explain bubbling and use event delegation deliberately',
          ],
          sections: [
            {
              heading: 'The DOM is a live tree',
              body:
                'The browser parses HTML into the Document Object Model — a tree of element nodes that JavaScript can query and change, and the page updates instantly. document.querySelector(css) / querySelectorAll are the selection workhorses; element.textContent, classList, and setAttribute are the safe updaters.\n\nSafety rule that security reviews enforce: use textContent for user-supplied text. innerHTML parses its input as HTML — feeding it untrusted data is a cross-site-scripting (XSS) vulnerability. In LWC you rarely touch the DOM directly (templates do it), but refreshing DevTools-level DOM literacy is what makes you dangerous at debugging any UI.',
            },
            {
              heading: 'Events: the browser\'s notification system',
              body:
                'Every interaction fires an event: click, input, change, submit, keydown. addEventListener(type, handler) subscribes; the handler receives an event object with .target (the element), value payloads, and control methods like preventDefault() (stop a form\'s native submit) and stopPropagation().\n\nEvents BUBBLE: after firing on the target they travel up through ancestors. That enables delegation — one listener on a container handling clicks from hundreds of rows by inspecting event.target — the pattern behind every data table, and the reason LWC can bind onclick on a parent element cheaply.',
              code: {
                language: 'javascript',
                snippet:
                  "// One listener handles every row's Retry button — even rows added later\nconst table = document.querySelector('#deploy-table');\ntable.addEventListener('click', (event) => {\n    const button = event.target.closest('button[data-action=\"retry\"]');\n    if (!button) return;                       // click was elsewhere\n    const jobId = button.dataset.jobId;        // from data-job-id=\"...\"\n    retryDeploy(jobId);\n});",
                caption: 'Event delegation: one listener, unlimited rows, no per-row wiring.',
              },
            },
            {
              heading: 'The same ideas inside LWC',
              body:
                'LWC templates declare listeners inline — <button onclick={handleRetry}> — and the framework manages addEventListener for you. Custom events carry data upward from child to parent components: this.dispatchEvent(new CustomEvent("select", { detail: { orgId } })), which the parent handles as onselect.\n\nInside a component you query only your own template (this.template.querySelector) because shadow DOM isolates each component\'s markup. All the mental models from this lesson — targets, payloads, bubbling — transfer directly; LWC just scopes and formalizes them.',
            },
          ],
          realWorld: {
            title: 'A 500-row table with 500 listeners',
            scenario:
              'A deployment-history table attached three listeners to every row at render time. With 500 rows the page allocated 1,500 listeners, scrolling stuttered on mid-range laptops, and rows added by live polling arrived with no listeners at all — their buttons simply did nothing.',
            solution:
              'The team replaced per-row wiring with one delegated listener on the table body, reading the action and row id from data-* attributes on the clicked button.',
            outcome:
              'Interaction became instant, dynamically added rows worked automatically, and the delegation pattern moved into the team\'s component playbook.',
          },
          keyTakeaways: [
            'querySelector + textContent/classList cover most DOM updates safely',
            'Never feed untrusted data to innerHTML — that is XSS',
            'Events bubble; delegation puts one listener where hundreds existed',
            'LWC formalizes the same system: template bindings + CustomEvent up',
          ],
          resources: [
            {
              title: 'MDN: Introduction to events',
              url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events',
              source: 'other',
            },
            {
              title: 'LWC Dev Guide: Handle events',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/events.html',
              source: 'developer',
            },
          ],
        },
        {
          id: 'js-fetch-apis',
          title: 'fetch, JSON, and REST APIs',
          summary:
            'Calling REST endpoints properly: requests, headers, JSON parsing, status handling, and a hardened helper you will reuse everywhere.',
          durationMinutes: 18,
          objectives: [
            'Make GET/POST requests with fetch, headers, and JSON bodies',
            'Handle HTTP status codes and network errors distinctly',
            'Serialize and parse JSON confidently, including failure modes',
          ],
          sections: [
            {
              heading: 'JSON: the wire format of everything',
              body:
                'Every Salesforce REST response, every webhook, every config file in this platform is JSON: objects, arrays, strings, numbers, booleans, null. JSON.parse turns text into data (and throws on malformed input — catch it at boundaries); JSON.stringify goes the other way, with pretty-printing via JSON.stringify(data, null, 2) for logs.\n\nMind the type gaps: JSON has no dates (they travel as ISO strings you convert with new Date(iso)), no undefined, and no comments. A field that is missing, null, or an empty string are three DIFFERENT states — good API code decides explicitly what each means.',
            },
            {
              heading: 'fetch, done properly',
              body:
                'fetch(url, options) returns a promise of a Response. Two traps define competent usage. First: fetch only REJECTS on network failure — a 404 or 500 still fulfills, so you must check response.ok / response.status yourself. Second: the body is read asynchronously (await response.json()), and reading it twice throws.\n\nRequests with bodies set method, a Content-Type header, and a stringified body. Authenticated APIs (like this platform\'s) add an Authorization header per request. AbortController adds timeouts — a fetch with no timeout is a hung spinner waiting to happen.',
              code: {
                language: 'javascript',
                snippet:
                  "async function api(path, { method = 'GET', body, token, timeoutMs = 15000 } = {}) {\n    const controller = new AbortController();\n    const timer = setTimeout(() => controller.abort(), timeoutMs);\n    try {\n        const response = await fetch(path, {\n            method,\n            headers: {\n                'Content-Type': 'application/json',\n                ...(token ? { Authorization: `Bearer ${token}` } : {}),\n            },\n            body: body ? JSON.stringify(body) : undefined,\n            signal: controller.signal,\n        });\n        if (!response.ok) {\n            const detail = await response.text().catch(() => '');\n            throw new Error(`HTTP ${response.status}: ${detail || response.statusText}`);\n        }\n        return response.status === 204 ? null : await response.json();\n    } finally {\n        clearTimeout(timer);\n    }\n}\n\nconst job = await api('/api/deploys', {\n    method: 'POST',\n    body: { sourceOrg: 'dev', targetOrg: 'uat', checkOnly: true },\n    token: sessionToken,\n});",
                caption: 'A hardened fetch helper: status checking, JSON, auth, and a real timeout.',
              },
            },
            {
              heading: 'Talking to Salesforce\'s REST API',
              body:
                'The same shape reaches Salesforce directly: GET {instanceUrl}/services/data/v62.0/query?q=SELECT+Id+FROM+Account with an Authorization: Bearer {accessToken} header returns { totalSize, done, records }. Composite endpoints batch multiple operations in one round trip.\n\nFrom LWC you will usually go through Apex (sharing and secrets stay server-side) — but understanding the raw HTTP layer is what lets you read debug logs, use Workbench/Postman fluently, and script integrations from Node when no UI exists. API-literacy is a superpower during incidents.',
            },
          ],
          realWorld: {
            title: 'The integration that "never failed"',
            scenario:
              'A nightly Node sync pushed records into Salesforce and logged "sync complete" every night. Weeks later, thousands of records were missing: the API had been returning 400 errors for a renamed field, but the script never checked response.ok — fetch does not reject on HTTP errors, so the failures passed silently.',
            solution:
              'Every call moved to a shared helper that throws on non-2xx with the response body in the message, plus a summary that counts successes and failures and exits non-zero when anything failed.',
            outcome:
              'The very next run failed loudly with the exact field error in the log, the mapping was fixed within an hour, and the helper became mandatory in code review for any script touching an API.',
          },
          keyTakeaways: [
            'fetch fulfills on 404/500 — always check response.ok yourself',
            'JSON has no dates or undefined; decide what missing vs null means',
            'Add auth per request and a timeout via AbortController',
            'One hardened API helper, reused everywhere, prevents silent failures',
          ],
          resources: [
            {
              title: 'MDN: Using the Fetch API',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
              source: 'other',
            },
            {
              title: 'Salesforce REST API Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'js-lwc-patterns',
          title: 'JavaScript patterns that power LWC',
          summary:
            'Decorators, reactivity, getters in templates, debouncing, and component communication — LWC as applied JavaScript.',
          durationMinutes: 20,
          objectives: [
            'Map @api, @track, and @wire to plain JavaScript concepts',
            'Drive templates with getters and immutable state updates',
            'Debounce user input and communicate between components correctly',
          ],
          sections: [
            {
              heading: 'Decorators are annotations on class members',
              body:
                '@api marks a class field as a public property a parent can set (or App Builder can configure). @track forces deep observation of an object/array field — needed only when you MUTATE nested data, which you can usually avoid by reassigning immutably instead. @wire declares a reactive data dependency: when its parameters change, the framework re-invokes the adapter.\n\nStrip the decorators away and it is all fundamentals: public fields, change detection by reference (the immutability lesson), and functions re-run when inputs change. That is why strong JavaScript makes LWC feel small.',
            },
            {
              heading: 'Templates read state; getters shape it',
              body:
                'An LWC template binds to fields and getters: {status}, {formattedDate}, for:each iteration, lwc:if conditions. The discipline that keeps components maintainable is: fields hold RAW state; getters derive everything presentational (labels, filtered lists, css classes). Getters re-evaluate on re-render, so they stay in sync automatically — no manual "update the label too" bookkeeping.\n\nHandlers stay thin: read the event, update state immutably, let getters and the template do the rest. When a handler grows past a screen, extract logic into a plain module — plain functions are unit-testable without mounting a component.',
              code: {
                language: 'javascript',
                snippet:
                  "import { LightningElement, api } from 'lwc';\n\nexport default class DeployList extends LightningElement {\n    @api deployments = [];\n    filter = 'all';\n\n    get visibleDeployments() {          // derived — never stored\n        if (this.filter === 'failed') {\n            return this.deployments.filter(d => !d.success);\n        }\n        return this.deployments;\n    }\n    get emptyMessage() {\n        return this.filter === 'failed'\n            ? 'No failed deployments — nice.'\n            : 'No deployments yet.';\n    }\n    handleFilterChange(event) {\n        this.filter = event.detail.value; // raw state changes; getters follow\n    }\n}",
                caption: 'Raw state in fields, presentation in getters — the maintainable LWC shape.',
              },
            },
            {
              heading: 'Debouncing and component communication',
              body:
                'Search-as-you-type must not fire an Apex call per keystroke. Debouncing waits until typing pauses: store a timer, clear it on each keystroke, run the search when 300ms pass quietly — a closure over a timer id, nothing more.\n\nCommunication follows the platform rules: parent → child through @api properties; child → parent through CustomEvent; unrelated components through Lightning Message Service. Resist back-channel hacks (querying another component\'s internals) — they break shadow-DOM encapsulation and every future refactor.',
              code: {
                language: 'javascript',
                snippet:
                  "searchTerm = '';\ndelayTimer;\n\nhandleSearchInput(event) {\n    const value = event.target.value;\n    clearTimeout(this.delayTimer);\n    this.delayTimer = setTimeout(() => {\n        this.searchTerm = value;        // @wire(search, { term: '$searchTerm' })\n    }, 300);                            // re-fires only after typing pauses\n}",
                caption: 'A ten-line debounce: the difference between 1 API call and 15 per search.',
              },
            },
          ],
          realWorld: {
            title: 'Search that hammered the org',
            scenario:
              'An account search component fired an Apex call on every keystroke. Typing "enterprise" produced ten calls; under month-end load the org\'s concurrent Apex limit was breached and unrelated integrations started failing with REQUEST_LIMIT_EXCEEDED.',
            solution:
              'The team added a 300ms debounce to the input handler and moved the search to a reactive @wire on the debounced term, so only settled queries reached the server.',
            outcome:
              'API calls per search session dropped by roughly 90%, the limit breaches stopped, and the debounce helper was published in the team\'s shared LWC utilities module.',
          },
          keyTakeaways: [
            'Decorators annotate plain class members — the concepts underneath are standard JS',
            'Fields hold raw state; getters derive presentation; handlers stay thin',
            'Debounce user input before it reaches the server',
            'Parent → @api down; child → CustomEvent up; unrelated → message service',
          ],
          resources: [
            {
              title: 'LWC Dev Guide: Reactivity',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/js-props-reactivity.html',
              source: 'developer',
            },
            {
              title: 'Trailhead: Build Lightning Web Components',
              url: 'https://trailhead.salesforce.com/content/learn/trails/build-lightning-web-components',
              source: 'trailhead',
              note: 'Hands-on component building trail',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-js-web-1',
          topic: 'DOM safety',
          prompt: 'Why is element.innerHTML dangerous with user-supplied text?',
          options: [
            'It is slower than textContent',
            'It parses the text as HTML, enabling cross-site scripting (XSS)',
            'It only works in Chrome',
            'It cannot render Unicode',
          ],
          correctIndex: 1,
          explanation:
            'innerHTML executes whatever markup (including script-bearing payloads) the string contains. Use textContent for untrusted data.',
        },
        {
          id: 'q-js-web-2',
          topic: 'Events',
          prompt: 'What is event delegation?',
          options: [
            'Assigning events to a web worker',
            'One listener on a container handling events that bubble up from many children',
            'Automatically retrying failed event handlers',
            'Delegating events to the server',
          ],
          correctIndex: 1,
          explanation:
            'Because events bubble, a single ancestor listener can serve unlimited (even future) children by inspecting event.target.',
        },
        {
          id: 'q-js-web-3',
          topic: 'Events',
          prompt: 'Which method stops a form from performing its native page-reloading submit?',
          options: ['event.stopPropagation()', 'event.preventDefault()', 'event.cancel()', 'return null'],
          correctIndex: 1,
          explanation:
            'preventDefault() suppresses the browser\'s default action; stopPropagation() only stops bubbling to ancestors.',
        },
        {
          id: 'q-js-web-4',
          topic: 'fetch',
          prompt: 'A fetch call receives an HTTP 500 response. What happens to the promise?',
          options: [
            'It rejects with the server error',
            'It fulfills — you must check response.ok yourself',
            'It retries automatically',
            'It returns null',
          ],
          correctIndex: 1,
          explanation:
            'fetch only rejects on network-level failure. HTTP error statuses fulfill normally — unchecked, they become silent failures.',
        },
        {
          id: 'q-js-web-5',
          topic: 'JSON',
          prompt: 'How do dates travel in JSON payloads?',
          options: [
            'As native Date objects',
            'As ISO-8601 strings you convert with new Date(iso)',
            'As Unix epoch booleans',
            'JSON cannot carry date information',
          ],
          correctIndex: 1,
          explanation:
            'JSON has no date type — APIs send ISO strings ("2026-07-18T10:30:00Z") and clients parse them explicitly.',
        },
        {
          id: 'q-js-web-6',
          topic: 'HTTP',
          prompt: 'Which headers does a JSON POST to an authenticated API typically need?',
          options: [
            'Accept-Language and Range',
            'Content-Type: application/json and Authorization: Bearer <token>',
            'Cache-Control only',
            'No headers are ever required',
          ],
          correctIndex: 1,
          explanation:
            'Content-Type declares the body format; the Authorization bearer token authenticates the caller — the pattern this platform\'s API uses.',
        },
        {
          id: 'q-js-web-7',
          topic: 'LWC decorators',
          prompt: 'What does @api on an LWC class field do?',
          options: [
            'Makes the field private',
            'Exposes it as a public property a parent (or App Builder) can set',
            'Caches the field in localStorage',
            'Marks it as an Apex method',
          ],
          correctIndex: 1,
          explanation:
            '@api defines the component\'s public contract — parents pass data down through these properties.',
        },
        {
          id: 'q-js-web-8',
          topic: 'LWC reactivity',
          prompt: 'A component mutates an object field in place (this.org.status = "Connected") and the template does not update. Why?',
          options: [
            'Templates only render once',
            'Change detection is by reference — the mutation kept the same reference',
            'The field name is reserved',
            'Objects cannot appear in templates',
          ],
          correctIndex: 1,
          explanation:
            'Reassign immutably (this.org = { ...this.org, status: "Connected" }) so the reference changes and the framework re-renders.',
        },
        {
          id: 'q-js-web-9',
          topic: 'Debouncing',
          prompt: 'What does debouncing a search input achieve?',
          options: [
            'It encrypts each keystroke',
            'It delays the search until typing pauses, collapsing many calls into one',
            'It caches all previous results forever',
            'It disables the input while a call is in flight',
          ],
          correctIndex: 1,
          explanation:
            'Clearing and resetting a timer per keystroke means only the final, settled term triggers the server call.',
        },
        {
          id: 'q-js-web-10',
          topic: 'Component communication',
          prompt: 'How should a child LWC notify its parent that a row was selected?',
          options: [
            'Mutate the parent\'s fields directly',
            'Dispatch a CustomEvent with the payload in detail',
            'Write to window.selectedRow',
            'Call the parent\'s Apex controller',
          ],
          correctIndex: 1,
          explanation:
            'this.dispatchEvent(new CustomEvent("select", { detail })) is the sanctioned upward channel; parents bind onselect.',
        },
      ],
    },
  ],
};
