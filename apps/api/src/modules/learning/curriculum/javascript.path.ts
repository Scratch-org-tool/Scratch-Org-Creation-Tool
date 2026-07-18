import type { CurriculumPath } from './curriculum.types';

/**
 * Path — JavaScript Training (Beginner).
 * LWC-ready JavaScript fundamentals: language core, async, DOM/modules,
 * and modern patterns used in Lightning Web Components.
 */
export const javascriptPath: CurriculumPath = {
  id: 'js-fundamentals',
  title: 'JavaScript Training',
  tagline: 'LWC-ready JavaScript — from variables to modules and async.',
  description:
    'Build the JavaScript foundation Lightning Web Components expect. You will cover variables and types, functions, arrays and objects, promises and async/await, DOM basics, ES modules, and the modern syntax you will read in every LWC bundle — with Salesforce-flavored examples throughout.',
  level: 'beginner',
  badge: 'JavaScript Foundations',
  estimatedHours: 8,
  skills: [
    'Variables & types',
    'Functions',
    'Arrays & objects',
    'Async & promises',
    'DOM basics',
    'ES modules',
    'Modern JS for LWC',
  ],
  modules: [
    {
      id: 'js-fundamentals-core',
      title: 'Language Core',
      summary:
        'Values, types, functions, and the collections you will reshape constantly in component logic.',
      lessons: [
        {
          id: 'js-variables-types',
          title: 'Variables, types, and equality',
          summary:
            'let, const, primitives vs objects, and the equality rules that cause subtle LWC bugs.',
          durationMinutes: 20,
          objectives: [
            'Choose between const and let appropriately',
            'Identify JavaScript primitive types and typeof results',
            'Explain == vs === and why LWC code prefers strict equality',
          ],
          sections: [
            {
              heading: 'const by default, let when it changes',
              body:
                'Modern JavaScript (and LWC style guides) prefer const for bindings that are not reassigned, and let when the variable must change. Avoid var — it is function-scoped and hoisted in ways that surprise newcomers.\n\nconst does not make objects immutable; it only prevents reassigning the binding. You can still push to a const array or set a property on a const object.',
              code: {
                language: 'javascript',
                snippet:
                  "const accountId = '001xx000003DGbY';\nlet retryCount = 0;\n\nconst filters = { status: 'Open' };\nfilters.priority = 'High'; // allowed — object contents changed\n// filters = {}; // TypeError — binding reassignment blocked",
                caption: 'const for bindings; mutate object contents only when intentional.',
              },
            },
            {
              heading: 'Types you will actually meet',
              body:
                'Primitives: string, number, boolean, null, undefined, bigint, symbol. Everything else is an object (including arrays and functions).\n\ntypeof null is "object" — a historical quirk. Prefer explicit null checks. In LWC wire results and Apex returns, missing values often arrive as undefined or null; normalize them before rendering.',
              code: {
                language: 'javascript',
                snippet:
                  "typeof 'Acme'        // 'string'\ntypeof 42            // 'number'\ntypeof true          // 'boolean'\ntypeof undefined     // 'undefined'\ntypeof null          // 'object'  // quirk\ntypeof { name: 'a' } // 'object'\ntypeof [1, 2]        // 'object'\nArray.isArray([1, 2]) // true — use this for arrays",
                caption: 'Use Array.isArray; do not trust typeof for arrays or null.',
              },
            },
            {
              heading: 'Strict equality in UI logic',
              body:
                '=== compares value and type without coercion. == coerces types ("5" == 5 is true). Coercion bugs show up in template conditionals and Apex string/Id comparisons.\n\nAlways write === / !== in component JavaScript unless you have a deliberate reason not to.',
              code: {
                language: 'javascript',
                snippet:
                  "const status = 'Open';\nif (status === 'Open') {\n  // safe — no coercion\n}\n\nconst countFromInput = '3';\nNumber(countFromInput) === 3; // convert explicitly, then compare",
                caption: 'Convert deliberately, then compare with ===.',
              },
            },
          ],
          realWorld: {
            title: 'A stage badge never lights up',
            scenario:
              'An LWC shows a green badge when opportunity.StageName == "Closed Won". In the org the stage label was customized, but the API value remained ClosedWon without a space. The loose mental model mixed UI label and API value; the badge never appeared.',
            solution:
              'The developer logged the wire result, compared with === against the API value ClosedWon, and displayed the label separately from the logic check.',
            outcome:
              'The badge rendered correctly, and the team adopted a habit: drive logic from API values, show labels to humans.',
          },
          keyTakeaways: [
            'Prefer const; use let only when reassigning',
            'typeof is incomplete — know the null and array pitfalls',
            'Use === and explicit conversions',
            'LWC data often includes null/undefined — normalize before use',
          ],
          resources: [
            {
              title: 'MDN: Grammar and types',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types',
              source: 'other',
              note: 'MDN guide',
            },
            {
              title: 'MDN: Equality comparisons',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness',
              source: 'other',
            },
          ],
        },
        {
          id: 'js-functions',
          title: 'Functions: declarations, arrows, and this',
          summary:
            'Write reusable functions the way LWC class methods and callbacks expect.',
          durationMinutes: 20,
          objectives: [
            'Write function declarations and arrow functions',
            'Use default parameters and rest parameters',
            'Explain how arrow functions capture this — and why that matters in LWC',
          ],
          sections: [
            {
              heading: 'Declarations and expressions',
              body:
                'Function declarations are hoisted; arrow functions are expressions bound to variables. In LWC class components, event handlers are usually class methods or arrows assigned as fields so this refers to the component instance.',
              code: {
                language: 'javascript',
                snippet:
                  "function formatAmount(amount, currency = 'USD') {\n  return new Intl.NumberFormat('en-US', {\n    style: 'currency',\n    currency,\n  }).format(amount);\n}\n\nconst toIdSet = (ids) => new Set(ids.filter(Boolean));\n\nformatAmount(1200); // '$1,200.00'",
                caption: 'Default parameters keep call sites clean.',
              },
            },
            {
              heading: 'Arrow functions and this',
              body:
                'Arrow functions do not bind their own this; they close over the surrounding this. That is why arrows work well as callbacks inside LWC methods.\n\nPassing a plain method reference like button.addEventListener("click", this.handleClick) can lose this unless you bind it. In LWC templates, onClick={handleClick} wires the method correctly for you.',
              code: {
                language: 'javascript',
                snippet:
                  "export default class OpportunityPanel {\n  selectedIds = [];\n\n  handleSelect = (event) => {\n    // arrow field: this is always the component\n    this.selectedIds = [...this.selectedIds, event.target.value];\n  };\n\n  summarize(ids) {\n    return ids.reduce((total, _) => total + 1, 0);\n  }\n}",
                caption: 'Arrow class fields preserve component this in callbacks.',
              },
            },
            {
              heading: 'Rest and spread at call boundaries',
              body:
                'Rest gathers remaining arguments; spread expands arrays/objects into slots or literals. Both appear constantly when copying arrays immutably for LWC reactivity (@track legacy patterns and modern field reassignment).',
              code: {
                language: 'javascript',
                snippet:
                  "function firstError(...messages) {\n  return messages.find((m) => Boolean(m)) ?? null;\n}\n\nconst base = { status: 'Open' };\nconst withOwner = { ...base, ownerId: '005xx000001abc' };\nconst ids = ['001', '002'];\nconst allIds = [...ids, '003'];",
                caption: 'Immutable copies with spread — a daily LWC habit.',
              },
            },
          ],
          realWorld: {
            title: 'Checkbox handler clears the wrong selection',
            scenario:
              'A developer passed this.toggleRow into a child callback. Inside toggleRow, this was undefined (or the child), so selectedIds never updated on the parent.',
            solution:
              'They converted the handler to an arrow class field and passed the stable reference to the child via a public method / event instead of relying on borrowed this.',
            outcome:
              'Selection state stayed on the parent component, and the bug did not reappear when more callbacks were added.',
          },
          keyTakeaways: [
            'Prefer small, named functions with default parameters',
            'Arrow functions inherit this — useful for LWC handlers',
            'Rest/spread replace awkward apply/concat patterns',
            'Template event wiring binds component methods correctly',
          ],
          resources: [
            {
              title: 'MDN: Functions',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions',
              source: 'other',
            },
            {
              title: 'MDN: Arrow functions',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions',
              source: 'other',
            },
          ],
        },
        {
          id: 'js-arrays-objects',
          title: 'Arrays and objects for component data',
          summary:
            'Map, filter, reduce, destructuring, and safe object access — the daily toolkit for transforming Apex results.',
          durationMinutes: 25,
          objectives: [
            'Transform arrays with map, filter, and find',
            'Destructure objects and arrays cleanly',
            'Build lookup Maps and avoid mutating shared state accidentally',
          ],
          sections: [
            {
              heading: 'Treat Apex lists as arrays of plain objects',
              body:
                'Wire adapters and imperative Apex return JSON-like objects. Your job in the LWC is to shape them for the template: add label fields, filter closed rows, or sort by amount.\n\nPrefer map/filter that return new arrays over in-place splice/sort when the array is rendered — reassigning a new array is the clearest signal for re-render.',
              code: {
                language: 'javascript',
                snippet:
                  "const opportunities = [\n  { Id: '0061', Name: 'Acme Renew', Amount: 12000, IsClosed: false },\n  { Id: '0062', Name: 'Globex New', Amount: 4000, IsClosed: true },\n];\n\nconst openRows = opportunities\n  .filter((opp) => !opp.IsClosed)\n  .map((opp) => ({\n    id: opp.Id,\n    label: `${opp.Name} — ${opp.Amount}`,\n  }));",
                caption: 'Filter then map into the shape your template needs.',
              },
            },
            {
              heading: 'Destructuring and optional chaining',
              body:
                'Destructuring pulls fields out in one line. Optional chaining (?.) and nullish coalescing (??) keep template-prep code from throwing when related records are missing.',
              code: {
                language: 'javascript',
                snippet:
                  "function accountCity(account) {\n  const { Name, BillingCity } = account ?? {};\n  return BillingCity ?? 'City not set';\n}\n\nconst primaryContactName =\n  opportunity?.Contact?.Name ?? 'No primary contact';",
                caption: 'Safe navigation for related records returned from Apex.',
              },
            },
            {
              heading: 'Lookups with Map',
              body:
                'When you need repeated access by Id, build a Map once. This mirrors the Apex Map<Id, sObject> habit and keeps template helpers O(1).',
              code: {
                language: 'javascript',
                snippet:
                  "const accounts = [\n  { Id: '001A', Name: 'Acme' },\n  { Id: '001B', Name: 'Globex' },\n];\n\nconst accountsById = new Map(accounts.map((a) => [a.Id, a]));\nconst name = accountsById.get('001A')?.Name;",
                caption: 'Map from Id to record — same instinct as Apex bulk patterns.',
              },
            },
          ],
          realWorld: {
            title: 'Datatable columns show [object Object]',
            scenario:
              'A developer bound an Apex wrapper list directly to lightning-datatable without mapping fields to the fieldName keys the columns expected.',
            solution:
              'They mapped each record into a flat row object with the exact keys declared in the columns array, converting nested owner names into ownerName.',
            outcome:
              'The table rendered readable cells, and the same mapper became the single place to adjust presentation later.',
          },
          keyTakeaways: [
            'map/filter/find express transforms without noisy loops',
            'Destructuring and ?. / ?? harden UI code against missing data',
            'Map lookups beat repeated array.find in hot paths',
            'Return new arrays/objects when shaping reactive view models',
          ],
          resources: [
            {
              title: 'MDN: Working with objects',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_objects',
              source: 'other',
            },
            {
              title: 'MDN: Array',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-js-core-1',
          topic: 'Variables',
          prompt: 'Which binding should you prefer when the value will not be reassigned?',
          options: ['var', 'let', 'const', 'static'],
          correctIndex: 2,
          explanation: 'const communicates intent and prevents accidental reassignment of the binding.',
        },
        {
          id: 'q-js-core-2',
          topic: 'Variables',
          prompt: 'What does const prevent?',
          options: [
            'Mutating properties of an object held by the binding',
            'Reassigning the binding itself',
            'Importing the file into LWC',
            'Using the variable inside functions',
          ],
          correctIndex: 1,
          explanation: 'const locks the binding, not deep immutability of objects/arrays.',
        },
        {
          id: 'q-js-core-3',
          topic: 'Types',
          prompt: 'How should you check whether a value is an array?',
          options: [
            'typeof value === "array"',
            'Array.isArray(value)',
            'value instanceof String',
            'value === []',
          ],
          correctIndex: 1,
          explanation: 'typeof arrays is "object"; Array.isArray is the reliable check.',
        },
        {
          id: 'q-js-core-4',
          topic: 'Equality',
          prompt: 'Why prefer === over == in LWC logic?',
          options: [
            '=== is faster in every engine always',
            '== is illegal in modules',
            '=== avoids type coercion surprises',
            '=== converts strings to numbers automatically',
          ],
          correctIndex: 2,
          explanation: 'Strict equality does not coerce types, preventing subtle UI bugs.',
        },
        {
          id: 'q-js-core-5',
          topic: 'Functions',
          prompt: 'What is a practical reason to use an arrow function as an LWC class field handler?',
          options: [
            'Arrows are required by Salesforce',
            'Arrows lexically capture this as the component instance',
            'Arrows disable Lightning Locker',
            'Arrows run on the server',
          ],
          correctIndex: 1,
          explanation: 'Arrow functions inherit this from the surrounding class instance scope.',
        },
        {
          id: 'q-js-core-6',
          topic: 'Functions',
          prompt: 'What does the syntax currency = "USD" in a parameter list define?',
          options: [
            'A rest parameter',
            'A default parameter',
            'A typed parameter',
            'An imported constant',
          ],
          correctIndex: 1,
          explanation: 'Default parameters supply a value when the argument is undefined.',
        },
        {
          id: 'q-js-core-7',
          topic: 'Arrays',
          prompt: 'Which method returns a new array of transformed elements?',
          options: ['forEach', 'map', 'push', 'splice'],
          correctIndex: 1,
          explanation: 'map transforms each element into a new array; forEach is for side effects.',
        },
        {
          id: 'q-js-core-8',
          topic: 'Objects',
          prompt: 'What does opportunity?.Contact?.Name return if Contact is null?',
          options: [
            'Throws TypeError always',
            'undefined (without throwing)',
            'null as a string',
            'The Account Name instead',
          ],
          correctIndex: 1,
          explanation: 'Optional chaining short-circuits to undefined when a reference is nullish.',
        },
        {
          id: 'q-js-core-9',
          topic: 'Objects',
          prompt: 'What does ?? (nullish coalescing) fall back on?',
          options: [
            'Only when the left side is null or undefined',
            'When the left side is any falsy value including 0 and ""',
            'Only when the left side is false',
            'Only inside templates',
          ],
          correctIndex: 0,
          explanation: '?? triggers only for null/undefined, so 0 and empty string are preserved.',
        },
        {
          id: 'q-js-core-10',
          topic: 'Map',
          prompt: 'Why build Map(accounts.map(a => [a.Id, a]))?',
          options: [
            'Maps are required to call Apex',
            'Fast Id-based lookups without repeated array scans',
            'To convert the array into a string',
            'To bypass field-level security',
          ],
          correctIndex: 1,
          explanation: 'A Map keyed by Id gives efficient repeated lookups — the JS cousin of Apex Maps.',
        },
      ],
    },
    {
      id: 'js-fundamentals-async-dom',
      title: 'Async JavaScript & the DOM',
      summary:
        'Promises, async/await, error handling, and just enough DOM to understand what LWC abstracts.',
      lessons: [
        {
          id: 'js-async-promises',
          title: 'Promises and async/await',
          summary:
            'Model asynchronous Apex calls and HTTP requests with promises — then write them clearly with async/await.',
          durationMinutes: 25,
          objectives: [
            'Explain pending, fulfilled, and rejected promise states',
            'Rewrite promise chains with async/await and try/catch',
            'Run independent async work concurrently with Promise.all',
          ],
          sections: [
            {
              heading: 'Why UI code is asynchronous',
              body:
                'Imperative Apex, fetch, and many browser APIs return results later. A Promise represents that future result. LWC imperative Apex returns a Promise, so the same skills transfer directly.',
              code: {
                language: 'javascript',
                snippet:
                  "import getOpenOpportunities from '@salesforce/apex/OppController.getOpenOpportunities';\n\nasync loadOpportunities() {\n  try {\n    const rows = await getOpenOpportunities({ accountId: this.recordId });\n    this.opportunities = rows;\n  } catch (error) {\n    this.errorMessage = error?.body?.message ?? error.message;\n  }\n}",
                caption: 'Imperative Apex with async/await and user-safe error extraction.',
              },
            },
            {
              heading: 'Promise.all for independent calls',
              body:
                'If two requests do not depend on each other, start them together. Promise.all fails fast if either rejects; Promise.allSettled waits for all and lets you inspect each outcome.',
              code: {
                language: 'javascript',
                snippet:
                  "async function loadPanel(accountId) {\n  const [account, contacts] = await Promise.all([\n    fetchAccount(accountId),\n    fetchContacts(accountId),\n  ]);\n  return { account, contacts };\n}",
                caption: 'Concurrent reads shorten panel load time.',
              },
            },
            {
              heading: 'Do not forget loading state',
              body:
                'Async UX needs three states: loading, success, error. Set a loading flag before await and clear it in finally so spinners do not stick when a call fails.',
              code: {
                language: 'javascript',
                snippet:
                  "async refresh() {\n  this.isLoading = true;\n  this.errorMessage = undefined;\n  try {\n    this.rows = await loadRows();\n  } catch (e) {\n    this.errorMessage = 'Unable to refresh.';\n  } finally {\n    this.isLoading = false;\n  }\n}",
                caption: 'finally clears loading whether the call succeeds or fails.',
              },
            },
          ],
          realWorld: {
            title: 'Double-click creates two Cases',
            scenario:
              'A "Submit" button called imperative Apex without disabling the button. Users double-clicked; two Cases were inserted.',
            solution:
              'The handler set isSaving = true immediately, disabled the button in the template while saving, awaited Apex once, and cleared isSaving in finally.',
            outcome:
              'Duplicate Cases stopped, and the same pattern became the team checklist for every mutating button.',
          },
          keyTakeaways: [
            'Promises model eventual success or failure',
            'async/await + try/catch is the readable default',
            'Promise.all overlaps independent work',
            'Always manage loading and error UI around awaits',
          ],
          resources: [
            {
              title: 'MDN: Using promises',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
              source: 'other',
            },
            {
              title: 'Call Apex Methods Imperatively (LWC Docs)',
              url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.apex_imperative',
              source: 'developer',
            },
          ],
        },
        {
          id: 'js-dom-basics',
          title: 'DOM basics (and what LWC handles for you)',
          summary:
            'Understand elements, events, and queries so LWC templates and shadow DOM are not magic.',
          durationMinutes: 20,
          objectives: [
            'Describe nodes, elements, and event bubbling at a practical level',
            'Contrast document.querySelector with LWC template queries',
            'Explain why LWC prefers declarative templates over manual DOM writes',
          ],
          sections: [
            {
              heading: 'The DOM is a tree',
              body:
                'The browser turns HTML into a tree of nodes. JavaScript can read and change that tree — document.querySelector(".total") and element.textContent = "…" are classic DOM APIs.\n\nLWC still uses the DOM under the hood, but you usually declare HTML in the template and bind data. Direct DOM manipulation fights the framework and breaks under shadow DOM encapsulation.',
              code: {
                language: 'javascript',
                snippet:
                  "// Classic DOM (for mental model — avoid in LWC render paths)\nconst el = document.querySelector('#status');\nif (el) {\n  el.textContent = 'Synced';\n  el.classList.add('status_success');\n}",
                caption: 'Raw DOM updates — know them, rarely write them inside LWC.',
              },
            },
            {
              heading: 'Events: listen, handle, optionally compose',
              body:
                'Clicks and input changes are events. In LWC you write onClick={handleClick} in the template. Child-to-parent communication uses CustomEvent with detail payloads; set bubbles and composed when the event must cross shadow boundaries.',
              code: {
                language: 'javascript',
                snippet:
                  "handleSaveClick() {\n  this.dispatchEvent(\n    new CustomEvent('save', {\n      detail: { recordId: this.recordId },\n      bubbles: true,\n      composed: true,\n    }),\n  );\n}",
                caption: 'CustomEvent detail carries typed payload to parents.',
              },
            },
            {
              heading: 'Querying inside an LWC',
              body:
                'Use this.template.querySelector / querySelectorAll to reach elements in your template after render — for focus management or reading a canvas, not for stuffing business text into random divs.\n\nCall queries after the template has rendered (for example in a handler or renderedCallback with care). Prefer data bindings for visible values.',
              code: {
                language: 'javascript',
                snippet:
                  "focusFirstInvalid() {\n  const invalid = this.template.querySelector('[data-field].slds-has-error');\n  invalid?.focus();\n}",
                caption: 'Query for UX (focus), not for storing business state.',
              },
            },
          ],
          realWorld: {
            title: 'querySelector returned null in tests and in the UI',
            scenario:
              'A developer called this.template.querySelector("lightning-input") in connectedCallback to set a value. The element was not rendered yet, so the query returned null.',
            solution:
              'They bound the value with @api/@track fields in the template and moved focus-only logic into a button handler after render.',
            outcome:
              'The null errors disappeared, and state lived in JavaScript fields — the LWC-idiomatic place.',
          },
          keyTakeaways: [
            'The DOM is a tree; frameworks synchronize it for you',
            'Prefer template bindings over manual textContent updates',
            'CustomEvent is the child-to-parent contract',
            'this.template.querySelector is for targeted UX, not state storage',
          ],
          resources: [
            {
              title: 'MDN: Introduction to the DOM',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction',
              source: 'other',
            },
            {
              title: 'LWC Events (Docs)',
              url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.events',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-js-async-1',
          topic: 'Promises',
          prompt: 'Which states can a Promise be in?',
          options: [
            'open, closed, deferred',
            'pending, fulfilled, rejected',
            'sync, async, parallel',
            'get, post, patch',
          ],
          correctIndex: 1,
          explanation: 'A Promise starts pending, then settles as fulfilled or rejected.',
        },
        {
          id: 'q-js-async-2',
          topic: 'async/await',
          prompt: 'What does await do inside an async function?',
          options: [
            'Blocks the entire browser process forever',
            'Pauses the function until the Promise settles and returns its value',
            'Converts the function into Apex',
            'Disables Lightning Data Service',
          ],
          correctIndex: 1,
          explanation: 'await yields until settlement, then resumes with the fulfilled value or throws on rejection.',
        },
        {
          id: 'q-js-async-3',
          topic: 'Errors',
          prompt: 'How do you typically catch a rejected await?',
          options: [
            'with sharing',
            'try/catch around the await',
            'typeof check',
            'Array.isArray',
          ],
          correctIndex: 1,
          explanation: 'Rejected promises throw at await; try/catch handles them.',
        },
        {
          id: 'q-js-async-4',
          topic: 'Concurrency',
          prompt: 'When is Promise.all appropriate?',
          options: [
            'When tasks must run strictly one after another',
            'When independent async tasks can run concurrently and all must succeed',
            'Only for DOM events',
            'Only inside Apex',
          ],
          correctIndex: 1,
          explanation: 'Promise.all overlaps independent work and rejects if any input rejects.',
        },
        {
          id: 'q-js-async-5',
          topic: 'UX',
          prompt: 'Why clear isLoading in a finally block?',
          options: [
            'finally runs only on success',
            'finally runs after success or failure, so the spinner cannot stick',
            'finally uploads the file',
            'finally is required by ESLint only',
          ],
          correctIndex: 1,
          explanation: 'finally always runs, which makes it ideal for clearing loading flags.',
        },
        {
          id: 'q-js-async-6',
          topic: 'Apex from LWC',
          prompt: 'Imperative Apex calls from LWC return:',
          options: [
            'A SOQL cursor',
            'A Promise',
            'A Visualforce page',
            'A Database.SaveResult only',
          ],
          correctIndex: 1,
          explanation: 'Imperative Apex is asynchronous and returns a Promise in JavaScript.',
        },
        {
          id: 'q-js-async-7',
          topic: 'DOM',
          prompt: 'Why avoid document.querySelector to update business values inside an LWC?',
          options: [
            'The DOM does not exist in browsers',
            'It fights LWC rendering and shadow DOM encapsulation',
            'querySelector is illegal in JavaScript modules',
            'It only works in Apex',
          ],
          correctIndex: 1,
          explanation: 'LWC owns rendering; bind data in templates instead of hand-editing DOM nodes.',
        },
        {
          id: 'q-js-async-8',
          topic: 'Events',
          prompt: 'Which API sends data from a child LWC to a parent?',
          options: [
            'process.env',
            'CustomEvent with a detail payload',
            'Window.alert',
            'SOQL',
          ],
          correctIndex: 1,
          explanation: 'Children dispatch CustomEvent; parents listen in the template.',
        },
        {
          id: 'q-js-async-9',
          topic: 'Queries',
          prompt: 'How do you query an element inside your LWC template?',
          options: [
            'document.getElementById only',
            'this.template.querySelector',
            'Schema.getGlobalDescribe',
            'window.lwc.find',
          ],
          correctIndex: 1,
          explanation: 'this.template scopes queries to the component template.',
        },
        {
          id: 'q-js-async-10',
          topic: 'Timing',
          prompt: 'Why might this.template.querySelector return null in connectedCallback?',
          options: [
            'LWC forbids all queries',
            'The template may not have rendered child elements yet',
            'JavaScript cannot read HTML',
            'The component has no shadow root ever',
          ],
          correctIndex: 1,
          explanation: 'Query after render or rely on bindings; connectedCallback is often too early.',
        },
      ],
    },
    {
      id: 'js-fundamentals-modules-lwc',
      title: 'ES Modules & Modern JS for LWC',
      summary:
        'Import/export, LWC class components, and the modern syntax you will see in every Salesforce frontend repo.',
      lessons: [
        {
          id: 'js-es-modules',
          title: 'ES modules: import and export',
          summary:
            'Split code into files with explicit exports — the module system LWC and modern tooling require.',
          durationMinutes: 20,
          objectives: [
            'Write named and default exports',
            'Import symbols into an LWC or utility module',
            'Recognize Salesforce module imports such as @salesforce/apex and @salesforce/schema',
          ],
          sections: [
            {
              heading: 'Why modules exist',
              body:
                'Without modules, every script shared a global scope. ES modules give each file its own scope and an explicit public surface via export. LWC components are modules: the .js file default-exports a class.',
              code: {
                language: 'javascript',
                snippet:
                  "// utils/currency.js\nexport function formatUsd(amount) {\n  return new Intl.NumberFormat('en-US', {\n    style: 'currency',\n    currency: 'USD',\n  }).format(amount);\n}\n\nexport const ZERO_USD = formatUsd(0);",
                caption: 'Named exports for reusable utilities.',
              },
            },
            {
              heading: 'Default export for the component class',
              body:
                'LWC expects a default export of a LightningElement subclass. Utilities should prefer named exports so imports stay refactor-friendly.',
              code: {
                language: 'javascript',
                snippet:
                  "import { LightningElement, api } from 'lwc';\nimport { formatUsd } from 'c/currencyUtils';\nimport getQuote from '@salesforce/apex/QuoteController.getQuote';\n\nexport default class QuoteHeader extends LightningElement {\n  @api recordId;\n  formattedTotal;\n\n  async connectedCallback() {\n    const quote = await getQuote({ quoteId: this.recordId });\n    this.formattedTotal = formatUsd(quote.TotalPrice);\n  }\n}",
                caption: 'Default-export the component; named-import helpers and Apex.',
              },
            },
            {
              heading: 'Salesforce import prefixes',
              body:
                '@salesforce/apex/... imports Apex methods. @salesforce/schema/... imports object/field schema references. c/myUtils imports a local module from the same namespace. These look like paths but are resolved by the LWC compiler — they are not Node.js filesystem paths.',
            },
          ],
          realWorld: {
            title: 'Copy-pasted formatters drift apart',
            scenario:
              'Three LWCs each pasted a currency formatter. Finance changed rounding rules; only one component was updated. Quotes disagreed on the same record page.',
            solution:
              'The team extracted formatUsd into c/currencyUtils, deleted the copies, and imported the named export everywhere.',
            outcome:
              'One change updated every surface, and code review began rejecting pasted utility functions.',
          },
          keyTakeaways: [
            'Modules isolate scope and declare explicit exports',
            'LWC components default-export a LightningElement class',
            'Prefer named exports for shared utilities',
            '@salesforce/* imports are platform module IDs, not file paths',
          ],
          resources: [
            {
              title: 'MDN: JavaScript modules',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules',
              source: 'other',
            },
            {
              title: 'LWC: HTML Templates (Docs)',
              url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.create_components_html_intro',
              source: 'developer',
            },
          ],
        },
        {
          id: 'js-modern-for-lwc',
          title: 'Modern syntax you will see in LWC',
          summary:
            'Classes, private fields, template literals, destructuring in parameters, and immutable update patterns.',
          durationMinutes: 25,
          objectives: [
            'Read and write ES class fields used in LWC',
            'Use template literals and destructured parameters fluently',
            'Update arrays/objects immutably so UI state stays predictable',
          ],
          sections: [
            {
              heading: 'Classes are how LWC components are defined',
              body:
                'LWC components are classes extending LightningElement. Instance fields hold reactive state. Methods become event handlers. Decorators like @api and @wire are compiler features layered on this class model.',
              code: {
                language: 'javascript',
                snippet:
                  "import { LightningElement, api, wire } from 'lwc';\nimport { getRecord, getFieldValue } from 'lightning/uiRecordApi';\nimport NAME_FIELD from '@salesforce/schema/Account.Name';\n\nexport default class AccountBanner extends LightningElement {\n  @api recordId;\n  error;\n\n  @wire(getRecord, { recordId: '$recordId', fields: [NAME_FIELD] })\n  wiredAccount({ data, error }) {\n    if (data) {\n      this.accountName = getFieldValue(data, NAME_FIELD);\n      this.error = undefined;\n    } else if (error) {\n      this.error = error;\n    }\n  }\n\n  accountName = '';\n}",
                caption: 'Class fields + @wire — everyday LWC shape.',
              },
            },
            {
              heading: 'Template literals and destructuring',
              body:
                'Template literals build strings without noisy concatenation. Destructuring in parameters keeps handlers short when reading event.detail.',
              code: {
                language: 'javascript',
                snippet:
                  "handleSearch({ detail }) {\n  const { searchTerm, includeClosed } = detail;\n  this.headline = `Results for \"${searchTerm}\"`;\n  this.includeClosed = includeClosed ?? false;\n}",
                caption: 'Destructure event.detail at the boundary.',
              },
            },
            {
              heading: 'Immutable updates for list UI state',
              body:
                'Reassign new arrays/objects when changing view state. Mutating nested fields in place is harder to reason about and easier to get wrong when passing data to children.',
              code: {
                language: 'javascript',
                snippet:
                  "addId(id) {\n  if (this.selectedIds.includes(id)) return;\n  this.selectedIds = [...this.selectedIds, id];\n}\n\nupdateStatus(rowId, status) {\n  this.rows = this.rows.map((row) =>\n    row.id === rowId ? { ...row, status } : row,\n  );\n}",
                caption: 'Spread + map create new references the UI can track.',
              },
            },
          ],
          realWorld: {
            title: 'Child table never refreshed after parent save',
            scenario:
              'A parent mutated this.rows[i].status = "Done" in place. The child datatable received the same array reference and left stale cells on screen.',
            solution:
              'The parent reassigned this.rows = this.rows.map(...) to produce a new array with an updated row object.',
            outcome:
              'The child re-rendered immediately, and the team documented immutable updates as a front-end convention.',
          },
          keyTakeaways: [
            'LWC components are ES classes with fields and methods',
            'Template literals and destructuring reduce boilerplate',
            'Immutable reassignment keeps list UI predictable',
            'Learn to read @wire/@api as compiler-powered class features',
          ],
          resources: [
            {
              title: 'LWC Developer Guide',
              url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc',
              source: 'developer',
            },
            {
              title: 'MDN: Classes',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-js-mod-1',
          topic: 'Modules',
          prompt: 'What do ES modules provide that plain global scripts do not?',
          options: [
            'Automatic Apex generation',
            'Per-file scope with explicit exports',
            'Database transactions',
            'SOQL parsing',
          ],
          correctIndex: 1,
          explanation: 'Modules isolate scope and expose only exported symbols.',
        },
        {
          id: 'q-js-mod-2',
          topic: 'Modules',
          prompt: 'What must an LWC component JavaScript file default-export?',
          options: [
            'A CSS string',
            'A LightningElement subclass',
            'A SOQL query',
            'A Visualforce controller',
          ],
          correctIndex: 1,
          explanation: 'The LWC runtime expects a default-exported component class.',
        },
        {
          id: 'q-js-mod-3',
          topic: 'Imports',
          prompt: 'What does import getQuote from "@salesforce/apex/QuoteController.getQuote" represent?',
          options: [
            'A filesystem relative path on the server disk',
            'A platform module ID resolved by the LWC compiler',
            'A CSS custom property',
            'A Flow API name',
          ],
          correctIndex: 1,
          explanation: 'Salesforce module imports are compiler-resolved IDs, not Node path lookups.',
        },
        {
          id: 'q-js-mod-4',
          topic: 'Exports',
          prompt: 'For a shared formatter used by many components, which export style is usually best?',
          options: [
            'Default export of a giant object only',
            'Named exports of small functions',
            'Attach it to window',
            'Put it in a static resource and eval it',
          ],
          correctIndex: 1,
          explanation: 'Named exports keep imports explicit and tree-shake/refactor friendly.',
        },
        {
          id: 'q-js-mod-5',
          topic: 'LWC class',
          prompt: 'In LWC, @api on a field typically means:',
          options: [
            'The field is private to the module',
            'The field is public for parent components to set',
            'The field is stored in Apex static memory',
            'The field becomes a SOQL alias',
          ],
          correctIndex: 1,
          explanation: '@api marks a reactive public property for composition.',
        },
        {
          id: 'q-js-mod-6',
          topic: 'Syntax',
          prompt: 'What does `Results for "${term}"` use?',
          options: [
            'XML entities',
            'A template literal',
            'JSON.parse',
            'A regex literal only',
          ],
          correctIndex: 1,
          explanation: 'Backtick strings with ${} interpolation are template literals.',
        },
        {
          id: 'q-js-mod-7',
          topic: 'Destructuring',
          prompt: 'In handleSearch({ detail }), what is being destructured?',
          options: [
            'The first element of an array argument',
            'The detail property of the event object parameter',
            'A CSS module',
            'An Apex namespace',
          ],
          correctIndex: 1,
          explanation: 'Parameter destructuring pulls detail off the event in one step.',
        },
        {
          id: 'q-js-mod-8',
          topic: 'Immutability',
          prompt: 'Why prefer this.rows = this.rows.map(...) over mutating this.rows[i].status?',
          options: [
            'map is required by Apex',
            'A new array reference makes UI updates easier to reason about',
            'Mutation is illegal in JavaScript',
            'map runs on the server',
          ],
          correctIndex: 1,
          explanation: 'Reassigning new data helps keep reactive UI state predictable.',
        },
        {
          id: 'q-js-mod-9',
          topic: 'Wire',
          prompt: 'What is @wire primarily used for in LWC?',
          options: [
            'Declaring CSS variables',
            'Declaratively provisioning data from Apex or Lightning Data Service',
            'Creating change sets',
            'Encrypting field history',
          ],
          correctIndex: 1,
          explanation: '@wire connects components to data providers declaratively.',
        },
        {
          id: 'q-js-mod-10',
          topic: 'Modern JS',
          prompt: 'Which pattern adds an id to a list without mutating the original array in place?',
          options: [
            'this.selectedIds.push(id)',
            'this.selectedIds = [...this.selectedIds, id]',
            'this.selectedIds.splice(0, 0, id)',
            'delete this.selectedIds',
          ],
          correctIndex: 1,
          explanation: 'Spread creates a new array with the additional element.',
        },
      ],
    },
  ],
};
