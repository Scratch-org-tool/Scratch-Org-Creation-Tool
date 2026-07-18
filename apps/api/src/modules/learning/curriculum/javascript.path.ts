import type { CurriculumPath } from './curriculum.types';

/**
 * Path 5 — JavaScript Engineering (category: javascript).
 * A from-scratch JavaScript track for Salesforce professionals. It builds the
 * language fundamentals every Lightning Web Component developer needs, then the
 * modern/async features that power real UIs and integrations.
 */
export const javascriptPath: CurriculumPath = {
  id: 'js-engineering',
  title: 'JavaScript Engineering',
  tagline: 'The language of the web — and of Lightning Web Components.',
  description:
    'Learn JavaScript from zero with examples aimed at Salesforce developers. You will master values, functions, closures, objects, and iteration, then modern asynchronous JavaScript, ES modules, classes, and how the same language powers Lightning Web Components.',
  category: 'javascript',
  level: 'beginner',
  badge: 'JavaScript Developer',
  estimatedHours: 7,
  skills: [
    'Core syntax & types',
    'Functions & closures',
    'Async/await & promises',
    'ES modules & classes',
    'LWC readiness',
  ],
  modules: [
    {
      id: 'js-fundamentals',
      title: 'JavaScript Fundamentals',
      summary:
        'Values, variables, functions, scope, closures, and the object/array model — the bedrock every JavaScript program is built on.',
      lessons: [
        {
          id: 'js-values-types',
          title: 'Values, variables, and types',
          summary:
            'Declare variables correctly with let/const, understand the primitive types, and avoid the classic coercion traps.',
          durationMinutes: 16,
          objectives: [
            'Choose between const and let (and know why var is avoided)',
            'Name the primitive types and how typeof reports them',
            'Predict the result of == vs === and truthy/falsy checks',
          ],
          sections: [
            {
              heading: 'Declaring variables: const first, let when needed',
              body:
                'Modern JavaScript uses two block-scoped declarations. `const` creates a binding you cannot reassign; `let` creates one you can. The old `var` is function-scoped and hoisted in confusing ways, so professional codebases avoid it entirely.\n\nDefault to `const`. Reach for `let` only when a value genuinely changes (a loop counter, an accumulator). This makes code easier to reason about: a `const` tells the next reader "this never changes".',
              code: {
                language: 'javascript',
                snippet:
                  'const taxRate = 0.2;      // never reassigned\nlet subtotal = 0;         // will change in the loop\n\nfor (const line of cart) {\n  subtotal += line.price * line.qty;\n}\n\nconst total = subtotal * (1 + taxRate);\n// subtotal = 5;  // OK (let)\n// taxRate = 0.1; // TypeError: Assignment to constant variable',
                caption: 'const does not make objects immutable — it stops the variable being reassigned.',
              },
            },
            {
              heading: 'Primitive types and typeof',
              body:
                'JavaScript has seven primitive types: string, number, boolean, null, undefined, bigint, and symbol. Everything else (arrays, functions, dates) is an object.\n\n- `typeof "hi"` → "string"\n- `typeof 42` → "number" (there is no separate int/float)\n- `typeof true` → "boolean"\n- `typeof undefined` → "undefined"\n- `typeof null` → "object" (a famous historical bug — remember it)\n- `typeof {}` and `typeof []` → "object"\n- `typeof function(){}` → "function"',
            },
            {
              heading: 'Equality and truthiness',
              body:
                'Always use strict equality `===` and `!==`. Loose `==` performs type coercion that produces surprises like `0 == ""` being true and `null == undefined` being true. Strict equality compares value and type with no coercion.\n\nConditionals coerce values to boolean. The falsy values are exactly: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, and `NaN`. Everything else is truthy — including `"0"`, `[]`, and `{}`. Use `??` (nullish coalescing) when you specifically want to default only on null/undefined, not on 0 or "".',
              code: {
                language: 'javascript',
                snippet:
                  "0 == '';        // true  (coercion!)\n0 === '';       // false (strict — different types)\nNaN === NaN;    // false (never equal to itself)\n\nconst discount = input ?? 0;   // keeps 0 if input is 0\nconst legacy = input || 0;     // WRONG: turns 0 into 0 too, but also '' and false",
                caption: 'Prefer === and ?? to sidestep coercion bugs.',
              },
            },
          ],
          realWorld: {
            title: 'A pricing bug from a loose truthy check',
            scenario:
              'An e-commerce component hid the price when a product was free because the code used `if (product.price) { show() }`. A price of 0 is falsy, so free products silently disappeared from the cart.',
            solution:
              'The team replaced the truthy check with an explicit `if (product.price != null)` and used `price ?? 0` when formatting, so a legitimate 0 stopped being treated as "missing".',
            outcome:
              'Free promotional items rendered correctly, and a class of coercion bugs was eliminated by adopting a lint rule banning loose equality and bare truthy checks on numbers.',
          },
          keyTakeaways: [
            'Default to const; use let only for values that change; never use var',
            'There are seven primitives; typeof null is the historical "object" quirk',
            'Use === / !== to avoid coercion; == has surprising rules',
            'Falsy values are false/0/""/null/undefined/NaN/0n — use ?? to default only on null/undefined',
          ],
          resources: [
            {
              title: 'MDN — JavaScript data types and structures',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures',
              source: 'other',
              note: 'The canonical language reference',
            },
            {
              title: 'Trailhead — Lightning Web Components Basics',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lightning-web-components-basics',
              source: 'trailhead',
              note: 'Where this JavaScript is applied in Salesforce',
            },
          ],
        },
        {
          id: 'js-functions-scope',
          title: 'Functions, scope, and closures',
          summary:
            'Write functions three ways, understand lexical scope, and use closures — the single most powerful idea in JavaScript.',
          durationMinutes: 18,
          objectives: [
            'Declare functions as declarations, expressions, and arrow functions',
            'Explain lexical (block) scope and the scope chain',
            'Use a closure to keep private state',
          ],
          sections: [
            {
              heading: 'Three ways to write a function',
              body:
                'A function declaration is hoisted and can be called before its definition. A function expression assigns a function to a variable. An arrow function is concise and, crucially, does not bind its own `this` — it inherits `this` from the surrounding scope, which is exactly what you want inside callbacks and LWC methods.',
              code: {
                language: 'javascript',
                snippet:
                  'function add(a, b) { return a + b; }          // declaration (hoisted)\nconst mul = function (a, b) { return a * b; }; // expression\nconst sq = (n) => n * n;                        // arrow (implicit return)\n\n[1, 2, 3].map((n) => sq(n)); // [1, 4, 9]',
                caption: 'Arrow functions shine as short callbacks.',
              },
            },
            {
              heading: 'Lexical scope and the scope chain',
              body:
                'Scope is decided by where code is written, not where it is called. An inner function can read variables from every enclosing scope (the "scope chain"), but outer scopes cannot see inner variables. `let` and `const` are block-scoped: a `{ }` block, an `if`, or a loop body each create a new scope.\n\nThis is why a variable declared with `let` inside a `for` loop is a fresh binding each iteration — a detail that used to bite developers who used `var`.',
            },
            {
              heading: 'Closures: functions that remember',
              body:
                'A closure is a function bundled with references to the variables that were in scope when it was created. The function "closes over" those variables and keeps them alive even after the outer function returns. Closures power private state, memoization, event handlers, and the module pattern.',
              code: {
                language: 'javascript',
                snippet:
                  'function createCounter() {\n  let count = 0;               // private — not reachable from outside\n  return {\n    increment() { count += 1; return count; },\n    reset() { count = 0; },\n  };\n}\n\nconst counter = createCounter();\ncounter.increment(); // 1\ncounter.increment(); // 2\n// count is invisible here; only the returned methods can touch it',
                caption: 'The returned methods close over `count`, giving true private state.',
              },
            },
          ],
          realWorld: {
            title: 'Debouncing a search box with a closure',
            scenario:
              'A record-search component fired an API call on every keystroke, hammering the server and returning stale results out of order.',
            solution:
              'A `debounce(fn, delay)` helper used a closure to remember a timer id between calls, cancelling the previous timeout so the query only ran once the user paused typing.',
            outcome:
              'API calls dropped by over 90%, the results stopped flickering, and the same tiny closure-based utility was reused across every search field in the app.',
          },
          keyTakeaways: [
            'Declarations hoist; expressions and arrows do not; arrows inherit this',
            'Scope is lexical — inner code sees outer variables, never the reverse',
            'let/const are block-scoped, giving fresh bindings per loop iteration',
            'A closure keeps its outer variables alive — the basis of private state and debouncing',
          ],
          resources: [
            {
              title: 'MDN — Closures',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures',
              source: 'other',
            },
            {
              title: 'MDN — Functions guide',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions',
              source: 'other',
            },
          ],
        },
        {
          id: 'js-objects-arrays',
          title: 'Objects, arrays, and iteration',
          summary:
            'Model data with objects and arrays, destructure and spread them, and transform collections with map/filter/reduce.',
          durationMinutes: 17,
          objectives: [
            'Create and read objects and arrays, including nested access',
            'Use destructuring, spread, and rest to write cleaner code',
            'Transform data immutably with map, filter, and reduce',
          ],
          sections: [
            {
              heading: 'Objects and arrays as your data model',
              body:
                'An object is a set of key/value pairs; an array is an ordered list. Together they model any JSON payload you will receive from a Salesforce API. Access properties with dot or bracket notation, and use optional chaining `?.` to read deep properties safely without crashing on undefined.',
              code: {
                language: 'javascript',
                snippet:
                  "const account = {\n  name: 'Acme',\n  owner: { alias: 'jdoe' },\n  contacts: [{ email: 'a@acme.com' }],\n};\n\naccount.name;                    // 'Acme'\naccount['name'];                 // same, dynamic key\naccount.owner?.alias;            // 'jdoe'\naccount.billing?.city ?? 'N/A';  // 'N/A' (no billing) — safe",
                caption: 'Optional chaining + nullish coalescing read nested data without errors.',
              },
            },
            {
              heading: 'Destructuring, spread, and rest',
              body:
                'Destructuring pulls values out of objects and arrays into variables. The spread operator `...` copies/merges arrays and objects (a shallow copy — perfect for immutable updates). The rest operator gathers "the remaining" items.',
              code: {
                language: 'javascript',
                snippet:
                  "const { name, owner } = account;          // object destructuring\nconst [first, ...others] = account.contacts; // array + rest\n\nconst updated = { ...account, name: 'Acme Inc' }; // copy + override\nconst combined = [...listA, ...listB];            // merge arrays",
                caption: 'Spread produces a new object/array instead of mutating the original.',
              },
            },
            {
              heading: 'Transforming collections immutably',
              body:
                'Prefer the array methods `map` (transform each item), `filter` (keep some items), and `reduce` (collapse to a single value) over manual `for` loops. They return new arrays, keep the original untouched, and read like a description of intent. This immutable style is exactly what frameworks like LWC and React expect.',
              code: {
                language: 'javascript',
                snippet:
                  'const opps = [\n  { name: "A", amount: 1000, stage: "Won" },\n  { name: "B", amount: 500,  stage: "Lost" },\n  { name: "C", amount: 2000, stage: "Won" },\n];\n\nconst wonTotal = opps\n  .filter((o) => o.stage === "Won")\n  .map((o) => o.amount)\n  .reduce((sum, amount) => sum + amount, 0); // 3000',
                caption: 'A readable pipeline: filter → map → reduce.',
              },
            },
          ],
          realWorld: {
            title: 'Turning an API payload into a dashboard summary',
            scenario:
              'A component received hundreds of opportunity records from an Apex controller and needed per-stage totals for a chart, but nested for-loops made the code hard to change.',
            solution:
              'The developer used reduce to build a `{ stage: total }` map in a single pass, then Object.entries to feed the chart component — no mutation, easy to test.',
            outcome:
              'The summary logic shrank to a few lines, unit tests became trivial (pure function of the input), and adding a new "average deal size" metric was a one-line change.',
          },
          keyTakeaways: [
            'Objects + arrays model any JSON; use ?. and ?? for safe nested reads',
            'Destructuring, spread, and rest reduce boilerplate and enable immutable copies',
            'map/filter/reduce return new arrays and express intent clearly',
            'Immutable data transforms are what LWC and modern frameworks expect',
          ],
          resources: [
            {
              title: 'MDN — Array methods',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
              source: 'other',
            },
            {
              title: 'MDN — Destructuring assignment',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'js-fund-q1',
          topic: 'Variables',
          prompt: 'Which declaration should you reach for by default in modern JavaScript?',
          options: ['var', 'let', 'const', 'function'],
          correctIndex: 2,
          explanation: 'Default to const; use let only when the value must be reassigned. var is avoided.',
        },
        {
          id: 'js-fund-q2',
          topic: 'Types',
          prompt: 'What does typeof null return?',
          options: ['"null"', '"object"', '"undefined"', '"number"'],
          correctIndex: 1,
          explanation: 'typeof null returns "object" — a well-known historical bug in the language.',
        },
        {
          id: 'js-fund-q3',
          topic: 'Equality',
          prompt: 'Why prefer === over ==?',
          options: [
            'It is faster to type',
            'It compares value and type without coercion',
            'It works only on numbers',
            'It is required in strict mode',
          ],
          correctIndex: 1,
          explanation: 'Strict equality avoids the surprising type coercion that == performs.',
        },
        {
          id: 'js-fund-q4',
          topic: 'Truthiness',
          prompt: 'Which value is truthy?',
          options: ['0', '""', '"0"', 'NaN'],
          correctIndex: 2,
          explanation: 'The string "0" is a non-empty string, which is truthy. 0, "", and NaN are falsy.',
        },
        {
          id: 'js-fund-q5',
          topic: 'Closures',
          prompt: 'A closure lets an inner function…',
          options: [
            'Run before it is defined',
            'Access variables from the scope where it was created',
            'Change the type of a variable',
            'Skip the scope chain',
          ],
          correctIndex: 1,
          explanation: 'A closure keeps references to the variables in scope at creation time.',
        },
        {
          id: 'js-fund-q6',
          topic: 'Arrow functions',
          prompt: 'What is special about `this` inside an arrow function?',
          options: [
            'It is always undefined',
            'It is inherited from the surrounding scope',
            'It refers to the global object',
            'It must be bound manually',
          ],
          correctIndex: 1,
          explanation: 'Arrow functions do not bind their own this; they use the enclosing lexical this.',
        },
        {
          id: 'js-fund-q7',
          topic: 'Arrays',
          prompt: 'Which method collapses an array to a single value?',
          options: ['map', 'filter', 'reduce', 'forEach'],
          correctIndex: 2,
          explanation: 'reduce accumulates the array into one value using an accumulator.',
        },
        {
          id: 'js-fund-q8',
          topic: 'Spread',
          prompt: 'What does `{ ...account, name: "New" }` produce?',
          options: [
            'A mutation of the original account',
            'A shallow copy with name overridden',
            'A deep clone of account',
            'A syntax error',
          ],
          correctIndex: 1,
          explanation: 'Spread creates a new object (shallow copy); the later key overrides.',
        },
        {
          id: 'js-fund-q9',
          topic: 'Optional chaining',
          prompt: 'What does `account.billing?.city` return when billing is undefined?',
          options: ['Throws an error', 'undefined', 'null', 'An empty string'],
          correctIndex: 1,
          explanation: 'Optional chaining short-circuits to undefined instead of throwing.',
        },
      ],
    },
    {
      id: 'js-modern-async',
      title: 'Modern & Asynchronous JavaScript',
      summary:
        'Promises, async/await, the event loop, ES modules, classes, DOM events, and how JavaScript drives Lightning Web Components.',
      lessons: [
        {
          id: 'js-async',
          title: 'Promises, async/await, and the event loop',
          summary:
            'Understand why JavaScript is single-threaded yet non-blocking, and write clean asynchronous code with async/await.',
          durationMinutes: 19,
          objectives: [
            'Explain the single-threaded event loop and the task/microtask queues',
            'Create and chain promises, handling success and failure',
            'Refactor promise chains into async/await with try/catch',
          ],
          sections: [
            {
              heading: 'One thread, never blocking',
              body:
                'JavaScript runs your code on a single thread. Long operations (network, timers) are handed to the host environment; when they finish, their callbacks are placed on a queue and the event loop runs them once the call stack is empty. This is why a slow fetch does not freeze the UI — but also why you must never block the thread with a long synchronous loop.\n\nPromise callbacks run on the higher-priority microtask queue, which is why a resolved promise runs before a setTimeout(…, 0).',
            },
            {
              heading: 'Promises',
              body:
                'A Promise represents a value that will exist later. It is pending, then either fulfilled (with a value) or rejected (with an error). `.then()` handles success, `.catch()` handles failure, and `.finally()` always runs. Promises chain: returning a value or promise from `.then` feeds the next one.',
              code: {
                language: 'javascript',
                snippet:
                  "fetch('/api/accounts')\n  .then((res) => {\n    if (!res.ok) throw new Error('HTTP ' + res.status);\n    return res.json();\n  })\n  .then((accounts) => render(accounts))\n  .catch((err) => showError(err.message))\n  .finally(() => hideSpinner());",
                caption: 'A promise chain: each .then returns a value for the next step.',
              },
            },
            {
              heading: 'async/await — promises that read like sync code',
              body:
                'An `async` function always returns a promise. Inside it, `await` pauses until a promise settles and gives you the value, so you write top-to-bottom code and handle errors with ordinary try/catch. Use `Promise.all` to await several independent operations concurrently instead of one after another.',
              code: {
                language: 'javascript',
                snippet:
                  "async function loadDashboard(accountId) {\n  try {\n    // Run both requests concurrently, then await both.\n    const [account, cases] = await Promise.all([\n      fetchJson(`/api/accounts/${accountId}`),\n      fetchJson(`/api/accounts/${accountId}/cases`),\n    ]);\n    return { account, openCases: cases.filter((c) => c.isOpen) };\n  } catch (err) {\n    console.error('Dashboard load failed', err);\n    throw err; // let the caller decide how to surface it\n  }\n}",
                caption: 'Promise.all runs requests in parallel; await keeps the code linear.',
              },
            },
          ],
          realWorld: {
            title: 'Cutting page load time in half with Promise.all',
            scenario:
              'A record page awaited three independent Apex calls one after another; each took ~300ms, so the page took nearly a second to populate.',
            solution:
              'The calls had no dependency on each other, so the developer fired them together with Promise.all and awaited the combined result.',
            outcome:
              'Total wait dropped to roughly the slowest single call (~300ms), the perceived performance improved dramatically, and the pattern became the team standard for independent data fetches.',
          },
          keyTakeaways: [
            'JavaScript is single-threaded; the event loop keeps it non-blocking',
            'Promises move from pending to fulfilled/rejected; chain with then/catch/finally',
            'async/await reads like synchronous code and uses try/catch for errors',
            'Promise.all runs independent async work concurrently to save time',
          ],
          resources: [
            {
              title: 'MDN — Using promises',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
              source: 'other',
            },
            {
              title: 'MDN — async function',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function',
              source: 'other',
            },
          ],
        },
        {
          id: 'js-modules-dom',
          title: 'ES modules, classes, and the DOM',
          summary:
            'Organize code with import/export, model behavior with classes, and respond to user events in the browser.',
          durationMinutes: 17,
          objectives: [
            'Split code into ES modules with named and default exports',
            'Define a class with fields, methods, and inheritance',
            'Attach event listeners and update the DOM',
          ],
          sections: [
            {
              heading: 'ES modules',
              body:
                'Modules let each file expose only what it chooses with `export` and consume others with `import`. This is the same module system LWC uses. Prefer named exports for utilities (many per file) and a default export for the single main thing a file provides.',
              code: {
                language: 'javascript',
                snippet:
                  "// money.js\nexport function format(amount, currency = 'USD') {\n  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);\n}\nexport const TAX_RATE = 0.2;\n\n// invoice.js\nimport { format, TAX_RATE } from './money.js';\nformat(1999.5); // \"$1,999.50\"",
                caption: 'Named exports keep utilities discoverable and tree-shakeable.',
              },
            },
            {
              heading: 'Classes',
              body:
                'A class is a template for objects with fields and methods. `constructor` initializes instances, `extends` inherits, and `super` calls the parent. LWC components are authored as classes that extend `LightningElement`, so this syntax is directly transferable.',
              code: {
                language: 'javascript',
                snippet:
                  "class Shape {\n  constructor(name) { this.name = name; }\n  describe() { return `A ${this.name}`; }\n}\n\nclass Circle extends Shape {\n  constructor(radius) {\n    super('circle');\n    this.radius = radius;\n  }\n  get area() { return Math.PI * this.radius ** 2; }\n}\n\nconst c = new Circle(2);\nc.describe(); // 'A circle'\nc.area;       // 12.566…",
                caption: 'extends/super give single inheritance; get defines a computed property.',
              },
            },
            {
              heading: 'The DOM and events',
              body:
                'In the browser, the DOM is the live tree of elements. You select nodes, listen for events, and update content or classes in response. Frameworks abstract most of this, but understanding it explains what LWC does under the hood — and how event bubbling lets a parent handle a child’s event.',
              code: {
                language: 'javascript',
                snippet:
                  "const button = document.querySelector('#save');\nbutton.addEventListener('click', (event) => {\n  event.preventDefault();\n  button.disabled = true;\n  button.textContent = 'Saving…';\n});",
                caption: 'addEventListener wires behavior to user interaction.',
              },
            },
          ],
          realWorld: {
            title: 'Sharing one formatting rule everywhere',
            scenario:
              'Currency was formatted inconsistently across a dozen components — some showed "$1000", others "1,000.00", confusing users and auditors.',
            solution:
              'A single money.js module exported one format() function; every component imported it instead of hand-rolling its own formatter.',
            outcome:
              'Formatting became consistent instantly, a later change to add currency codes touched exactly one file, and new components got correct formatting for free.',
          },
          keyTakeaways: [
            'ES modules expose only what you export; LWC uses the same system',
            'Classes bundle state + behavior; extends/super provide inheritance',
            'LWC components are classes extending LightningElement',
            'The DOM + addEventListener are what frameworks build on top of',
          ],
          resources: [
            {
              title: 'MDN — JavaScript modules',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules',
              source: 'other',
            },
            {
              title: 'MDN — Classes',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes',
              source: 'other',
            },
          ],
        },
        {
          id: 'js-in-salesforce',
          title: 'JavaScript in Salesforce: Lightning Web Components',
          summary:
            'See how everything you learned comes together in a real Lightning Web Component: modules, classes, decorators, and async Apex calls.',
          durationMinutes: 18,
          objectives: [
            'Read the structure of an LWC (html, js, meta.xml)',
            'Use reactive properties and the @wire / imperative Apex patterns',
            'Handle events and errors the LWC way',
          ],
          sections: [
            {
              heading: 'Anatomy of a Lightning Web Component',
              body:
                'An LWC is a folder with three files: a template (`.html`), a JavaScript class (`.js`) that extends `LightningElement`, and a configuration (`.js-meta.xml`). The class fields become reactive — when a tracked field changes, the template re-renders. Everything you learned about modules, classes, and arrow functions applies directly.',
              code: {
                language: 'javascript',
                snippet:
                  "import { LightningElement, api } from 'lwc';\n\nexport default class AccountTile extends LightningElement {\n  @api recordId;          // public, set by the parent\n  name = 'Loading…';      // reactive private field\n\n  handleRefresh = () => {  // arrow keeps `this` bound to the component\n    this.name = 'Refreshing…';\n  };\n}",
                caption: 'An LWC is just an ES module exporting a class — familiar territory.',
              },
            },
            {
              heading: 'Calling Apex: @wire vs imperative',
              body:
                'To read Salesforce data you call an Apex method. `@wire` declaratively provisions data and re-runs when its inputs change — great for read-only display. The imperative style calls the method like an async function, which you `await`, giving you full control for button clicks and DML.',
              code: {
                language: 'javascript',
                snippet:
                  "import { LightningElement, api } from 'lwc';\nimport getContacts from '@salesforce/apex/AccountController.getContacts';\n\nexport default class ContactList extends LightningElement {\n  @api recordId;\n  contacts = [];\n  error;\n\n  async connectedCallback() {\n    try {\n      this.contacts = await getContacts({ accountId: this.recordId });\n    } catch (e) {\n      this.error = e?.body?.message ?? 'Failed to load contacts';\n    }\n  }\n}",
                caption: 'Imperative Apex is an async call — the async/await you already know.',
              },
            },
            {
              heading: 'Events and errors',
              body:
                'Child components communicate upward by dispatching a `CustomEvent`; parents listen with `on<eventname>`. This is DOM event bubbling applied to components. Errors from Apex arrive as objects with a `body.message`, so surface them to the user rather than letting them vanish into the console.',
              code: {
                language: 'javascript',
                snippet:
                  "// child.js — notify the parent a row was selected\nthis.dispatchEvent(new CustomEvent('select', {\n  detail: { recordId: this.recordId },\n}));\n\n// parent.html\n// <c-child onselect={handleSelect}></c-child>",
                caption: 'CustomEvent + on<event> is the LWC parent/child contract.',
              },
            },
          ],
          realWorld: {
            title: 'From vanilla JS knowledge to a shipped component',
            scenario:
              'A new Salesforce developer who had only learned JavaScript basics was asked to build a contacts panel on the account page.',
            solution:
              'Because an LWC is "just" an ES module exporting a class with async methods, they reused everything from this track: imported an Apex method, awaited it in connectedCallback, mapped the results, and dispatched a CustomEvent on row click.',
            outcome:
              'The component shipped in a day, and the developer realized the "Salesforce-specific" part was small — the language fundamentals did the heavy lifting.',
          },
          keyTakeaways: [
            'An LWC is an ES module exporting a class that extends LightningElement',
            'Reactive fields re-render the template; @api exposes public properties',
            '@wire is declarative/read-only; imperative Apex is an awaited async call',
            'Components talk via CustomEvent + on<event>; always surface Apex errors',
          ],
          resources: [
            {
              title: 'Salesforce Developers — Lightning Web Components dev guide',
              url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc',
              source: 'developer',
            },
            {
              title: 'Trailhead — Lightning Web Components Basics',
              url: 'https://trailhead.salesforce.com/content/learn/modules/lightning-web-components-basics',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'js-async-q1',
          topic: 'Event loop',
          prompt: 'How many threads run your JavaScript code by default?',
          options: ['One', 'One per promise', 'As many as CPU cores', 'Two'],
          correctIndex: 0,
          explanation: 'JavaScript executes on a single thread; the event loop provides concurrency.',
        },
        {
          id: 'js-async-q2',
          topic: 'Promises',
          prompt: 'A promise can end in which two states?',
          options: [
            'Started and stopped',
            'Fulfilled and rejected',
            'True and false',
            'Open and closed',
          ],
          correctIndex: 1,
          explanation: 'A settled promise is either fulfilled (value) or rejected (error).',
        },
        {
          id: 'js-async-q3',
          topic: 'async/await',
          prompt: 'What does an async function always return?',
          options: ['undefined', 'A promise', 'The awaited value directly', 'A callback'],
          correctIndex: 1,
          explanation: 'async functions wrap their return value in a promise.',
        },
        {
          id: 'js-async-q4',
          topic: 'Concurrency',
          prompt: 'Which runs independent async calls concurrently?',
          options: ['await one by one', 'Promise.all', 'setTimeout', 'a for loop'],
          correctIndex: 1,
          explanation: 'Promise.all starts them together and resolves when all finish.',
        },
        {
          id: 'js-async-q5',
          topic: 'Modules',
          prompt: 'How do you expose multiple utilities from one file?',
          options: ['A single default export', 'Named exports', 'Global variables', 'JSON'],
          correctIndex: 1,
          explanation: 'Named exports let a module expose several members.',
        },
        {
          id: 'js-async-q6',
          topic: 'Classes',
          prompt: 'What does super() do in a subclass constructor?',
          options: [
            'Creates a new thread',
            'Calls the parent class constructor',
            'Defines a getter',
            'Exports the class',
          ],
          correctIndex: 1,
          explanation: 'super() invokes the parent constructor before using this.',
        },
        {
          id: 'js-async-q7',
          topic: 'LWC',
          prompt: 'An LWC JavaScript file is essentially…',
          options: [
            'A JSON config',
            'An ES module exporting a class extending LightningElement',
            'An Apex class',
            'An HTML template',
          ],
          correctIndex: 1,
          explanation: 'LWCs are ES modules exporting a class that extends LightningElement.',
        },
        {
          id: 'js-async-q8',
          topic: 'LWC data',
          prompt: 'Which Apex pattern is best for a button click that saves a record?',
          options: ['@wire', 'Imperative (awaited) Apex', 'A global variable', 'A CSS class'],
          correctIndex: 1,
          explanation: 'Imperative Apex gives explicit control for user-triggered actions/DML.',
        },
        {
          id: 'js-async-q9',
          topic: 'Events',
          prompt: 'How does an LWC child notify its parent?',
          options: [
            'By calling the parent method directly',
            'By dispatching a CustomEvent',
            'By editing the parent DOM',
            'By throwing an error',
          ],
          correctIndex: 1,
          explanation: 'Children dispatch a CustomEvent; parents listen with on<event>.',
        },
      ],
    },
  ],
};
