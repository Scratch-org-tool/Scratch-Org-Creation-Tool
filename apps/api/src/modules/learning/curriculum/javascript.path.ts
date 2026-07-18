import type { CurriculumPath } from './curriculum.types';

/**
 * Path 2 — JavaScript Engineering (Beginner).
 * A path from language mechanics to
 * production-quality Lightning Web Components.
 */
export const javascriptPath: CurriculumPath = {
  id: 'javascript-engineering',
  title: 'JavaScript Engineering',
  tagline: 'Modern JavaScript, resilient browser code, and tested LWC delivery.',
  description:
    'Build a dependable JavaScript foundation before applying it to Salesforce. This path moves from values, functions, modules, and data structures through asynchronous APIs, secure and accessible browser work, TypeScript contracts, Jest testing, and an end-to-end Lightning Web Component capstone.',
  level: 'beginner',
  badge: 'JavaScript Practitioner',
  estimatedHours: 12,
  skills: [
    'Modern JavaScript',
    'Data transformation',
    'Asynchronous APIs',
    'DOM, accessibility & web security',
    'TypeScript contracts',
    'Jest & LWC engineering',
  ],
  modules: [
    {
      id: 'jseng-language-data',
      title: 'Language & Data Foundations',
      summary:
        'Reason precisely about JavaScript values and scope, organize behavior with functions and modules, and transform collection data without accidental mutation.',
      lessons: [
        {
          id: 'jseng-language-fundamentals',
          title: 'Values, scope, functions & ES modules',
          summary:
            'Learn the runtime rules behind everyday JavaScript and turn small functions into explicit, reusable module APIs.',
          durationMinutes: 50,
          objectives: [
            'Distinguish JavaScript primitive values, object references, equality rules, and nullish states',
            'Predict lexical scope and use closures without leaking mutable global state',
            'Design focused functions with explicit inputs, outputs, defaults, and failure conditions',
            'Split an application into modern ECMAScript modules with clear named exports and imports',
          ],
          sections: [
            {
              heading: 'Values, references, and deliberate comparisons',
              body:
                'JavaScript has seven primitive types: string, number, bigint, boolean, undefined, symbol, and null. Primitives behave like values; objects, arrays, and functions are reference values. Copying an object variable copies the reference, so two variables can observe the same mutation. const prevents rebinding a variable, but it does not freeze the referenced object.\n\nPrefer strict equality (=== and !==) so JavaScript does not coerce operands before comparing them. Treat null as an intentional empty value and undefined as missing or not yet assigned. The nullish coalescing operator (??) supplies a default only for null or undefined, preserving meaningful values such as 0, false, and an empty string. Use Number.isNaN() rather than comparing with NaN, because NaN is not equal to itself.',
            },
            {
              heading: 'Lexical scope and closures',
              body:
                'let and const are block-scoped; a name declared inside a function or block is unavailable outside it. Name lookup is lexical: JavaScript resolves a name according to where the function was defined, not where it was called. This makes behavior predictable when callbacks run later.\n\nA closure is a function bundled with access to its surrounding lexical environment. Closures power factories, event handlers, and private state, but they can also retain large objects longer than expected. Capture only what the returned function needs, keep mutable state narrow, and expose behavior instead of exposing an internal variable for callers to change.',
              code: {
                language: 'javascript',
                snippet:
                  'const STANDARD_TAX_RATE = 0.2;\n\nexport function createInvoiceTotal({ taxRate = STANDARD_TAX_RATE } = {}) {\n  if (typeof taxRate !== "number" || !Number.isFinite(taxRate)) {\n    throw new TypeError("taxRate must be a finite number");\n  }\n\n  return function totalFor(lines) {\n    const subtotal = lines.reduce(\n      (sum, { price, quantity = 1 }) => sum + price * quantity,\n      0,\n    );\n    return subtotal * (1 + taxRate);\n  };\n}\n\nconst totalForUk = createInvoiceTotal();\nconsole.log(totalForUk([{ price: 25, quantity: 2 }]).toFixed(2)); // 60.00',
                caption:
                  'Save as pricing.mjs and run with Node: the returned function closes over a validated tax rate.',
              },
            },
            {
              heading: 'Functions as small contracts',
              body:
                'A useful function has a name that states intent, parameters that reveal required data, one coherent responsibility, and a predictable return value. Validate assumptions at the boundary, then keep the center of the function simple. Default parameters handle omitted arguments; destructured parameters make named options readable; rest parameters gather a variable number of inputs.\n\nFunction declarations are hoisted and work well for primary operations. Function expressions are values that can be passed to map(), event listeners, and promise methods. Arrow functions are concise and capture this lexically; they do not have their own this, arguments, or prototype, so they should not be used as constructors or as object methods that require a dynamic receiver. Pure functions, which do not mutate external state, are easiest to compose and test.',
            },
            {
              heading: 'Modern ECMAScript modules',
              body:
                'An ES module is a file with its own top-level scope. Named exports such as export function calculate() make the public API explicit; consumers use matching named imports such as import { calculate } from "./pricing.js". Static imports stay at the top level, enabling tooling to analyze dependencies. Imported bindings are read-only live views of the exporting module, not copied variables.\n\nUse named exports for most application code because refactoring tools can follow the same symbol name across files. Reserve a default export for a genuinely primary value and avoid modules that perform surprising work merely by being imported. Browsers load an entry module with <script type="module">; supported Node projects use .mjs or package configuration. Module code runs in strict mode, and relative browser specifiers include a path and usually a file extension.',
            },
          ],
          realWorld: {
            title: 'One pricing rule, five conflicting copies',
            scenario:
              'A sales portal calculated tax in a form handler, a summary panel, and three utility files. One copy treated a zero discount as missing, while another silently accepted a string tax rate. Customers saw different totals before and after checkout.',
            solution:
              'The team moved validation and calculation into a pure pricing module with named exports. A closure-based factory captured the configured tax rate, every caller passed structured line items, and strict equality plus nullish defaults replaced truthiness shortcuts.',
            outcome:
              'All screens produced the same totals, invalid configuration failed at startup with a clear error, and the pricing behavior could be tested once instead of through five user interfaces.',
          },
          keyTakeaways: [
            'const protects a binding from reassignment; it does not make an object immutable',
            'Use strict equality and nullish defaults to avoid surprising coercion and lost zero-like values',
            'Closures retain lexical state and are useful when that state is intentionally small and private',
            'Functions are easier to reuse when inputs, return values, side effects, and errors are explicit',
            'ES modules provide file scope and analyzable named import and export contracts',
          ],
          resources: [
            {
              title: 'JavaScript Guide',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
              source: 'other',
              note: 'MDN language guide',
            },
            {
              title: 'Functions',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions',
              source: 'other',
              note: 'MDN functions, scope, and closures',
            },
            {
              title: 'JavaScript Modules',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules',
              source: 'other',
              note: 'MDN module syntax and loading',
            },
          ],
        },
        {
          id: 'jseng-collections-transformations',
          title: 'Collections, immutability, errors & transformation',
          summary:
            'Choose the right collection, derive new data safely, and make malformed input fail in an observable, useful way.',
          durationMinutes: 55,
          objectives: [
            'Select arrays, Map, or Set according to ordering, lookup, and uniqueness requirements',
            'Build readable filter-map-reduce pipelines and indexed transformations',
            'Apply immutable update patterns while recognizing shallow-copy limitations',
            'Throw, propagate, and handle Error objects at the boundary that can recover',
          ],
          sections: [
            {
              heading: 'Arrays are ordered sequences, not universal lookup tables',
              body:
                'Arrays preserve order and provide transformation methods with distinct jobs: filter() selects elements, map() converts each selected element, find() returns the first match, some() and every() answer predicates, and reduce() combines a sequence into one result. Prefer the method that states the intent rather than forcing every task into reduce().\n\nThese methods do not mutate the source array, although a callback can still mutate objects inside it. A pipeline such as orders.filter(isPaid).map(toRow) makes intermediate meaning visible. For large data sets, a single well-named loop can avoid multiple allocations and remain clearer than a deeply chained expression; readability and measured performance both matter.',
            },
            {
              heading: 'Map for keyed lookup; Set for uniqueness',
              body:
                'Map stores key-value pairs and accepts keys of any type, including object identity. It is a better semantic fit than a plain object for a dynamic lookup table: it has size, clear iteration order, and methods such as get(), set(), has(), and delete() without prototype-key surprises. Use a plain object for a record with a fixed set of named fields.\n\nSet stores each value once. It is ideal for membership checks and deduplication when SameValueZero equality is appropriate. Converting an array to new Set(values) removes duplicate primitive values, while duplicate object-shaped records still need a stable key such as an Id because distinct object references are distinct Set members.',
              code: {
                language: 'javascript',
                snippet:
                  'class DataShapeError extends Error {\n  constructor(message) {\n    super(message);\n    this.name = "DataShapeError";\n  }\n}\n\nfunction summarizePaidOrders(orders) {\n  if (!Array.isArray(orders)) {\n    throw new DataShapeError("orders must be an array");\n  }\n\n  const seenOrderIds = new Set();\n  const revenueByCustomer = new Map();\n\n  for (const order of orders) {\n    if (\n      typeof order !== "object" ||\n      order === null ||\n      typeof order.id !== "string" ||\n      typeof order.customerId !== "string" ||\n      !Number.isFinite(order.total)\n    ) {\n      throw new DataShapeError("each order needs string ids and a finite total");\n    }\n    if (seenOrderIds.has(order.id)) continue;\n    seenOrderIds.add(order.id);\n    if (order.status !== "paid") continue;\n\n    const previous = revenueByCustomer.get(order.customerId) ?? 0;\n    revenueByCustomer.set(order.customerId, previous + order.total);\n  }\n\n  return Array.from(revenueByCustomer, ([customerId, revenue]) => ({\n    customerId,\n    revenue,\n  })).sort((a, b) => b.revenue - a.revenue);\n}\n\nconst source = [\n  { id: "O-1", customerId: "C-1", total: 80, status: "paid" },\n  { id: "O-2", customerId: "C-1", total: 20, status: "paid" },\n  { id: "O-2", customerId: "C-1", total: 20, status: "paid" },\n  { id: "O-3", customerId: "C-2", total: 50, status: "draft" },\n];\n\nconsole.log(summarizePaidOrders(source));\nconsole.log(source.length); // 4: the input was not mutated',
                caption:
                  'An executable transformation using Set for deduplication, Map for aggregation, validation for bad data, and a new result array.',
              },
            },
            {
              heading: 'Immutability is controlled change',
              body:
                'Immutable code derives a new value instead of modifying a value another part of the application may still use. Add an array item with [...items, item], replace one with items.map(), remove one with items.filter(), and update an object with { ...record, status: "Closed" }. Stable inputs make rendering, caching, and tests easier because change is represented by a new reference.\n\nSpread syntax is shallow. The new outer object still shares nested objects unless those levels are copied too. Copy only the branch being changed, use structuredClone() when its supported data model is appropriate, or adopt a project-approved immutable-state tool for deeply nested state. Object.freeze() is also shallow and is mainly useful for catching accidental writes during development, not for turning arbitrary object graphs into persistent data structures.',
            },
            {
              heading: 'Errors should preserve context and recovery boundaries',
              body:
                'Throw an Error, TypeError, or a domain-specific Error subclass when a function cannot fulfill its contract. Include actionable context without secrets. Do not throw strings: Error objects carry a name, message, stack, and can retain an underlying cause. A catch block should recover, translate the error, add context and rethrow, or report it; silently swallowing an exception converts a visible failure into corrupt or missing behavior.\n\nPlace try/catch around the smallest operation whose failure you can handle. Parsing imported data may recover by marking one file invalid; an inner arithmetic helper usually cannot. finally runs whether the operation succeeds or fails and is appropriate for deterministic cleanup such as releasing a UI busy state. Validation errors are expected input outcomes; programmer errors should remain loud enough to reach tests and monitoring.',
            },
          ],
          realWorld: {
            title: 'Duplicate orders inflated a customer dashboard',
            scenario:
              'A retrying integration delivered several paid orders twice. A dashboard appended every payload to an array and mutated totals in place, so duplicate deliveries inflated revenue and stale UI references made the defect intermittent.',
            solution:
              'The ingestion boundary validated each record, used a Set of order IDs for idempotent deduplication, aggregated revenue in a Map keyed by customer ID, and returned a newly sorted summary array. Invalid rows raised a typed error for the import monitor.',
            outcome:
              'Repeated deliveries produced identical totals, the UI rerendered consistently from new references, and operations received an actionable error instead of a partially corrupted dashboard.',
          },
          keyTakeaways: [
            'Use arrays for ordered sequences, Map for dynamic keyed lookup, and Set for unique membership',
            'Choose transformation methods by intent and prefer a clear loop over an unreadable chain',
            'Immutable updates create new references, but spread and Object.freeze are shallow',
            'Validate data at trust boundaries before a transformation depends on its shape',
            'Catch an error only where code can recover, translate it, add context, or clean up',
          ],
          resources: [
            {
              title: 'Indexed Collections',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Indexed_collections',
              source: 'other',
              note: 'MDN arrays and array methods',
            },
            {
              title: 'Map',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map',
              source: 'other',
              note: 'MDN keyed collections reference',
            },
            {
              title: 'Set',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set',
              source: 'other',
              note: 'MDN unique collections reference',
            },
            {
              title: 'Control Flow and Error Handling',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling',
              source: 'other',
              note: 'MDN exceptions and cleanup',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'js-q-language-data-01',
          topic: 'Bindings and values',
          prompt:
            'What happens when const customer = { status: "new" }; is followed by customer.status = "active";?',
          options: [
            'A SyntaxError occurs because every const value is deeply immutable',
            'The property changes because const prevents rebinding, not object mutation',
            'A new customer object is created automatically',
            'The assignment is ignored in every JavaScript runtime',
          ],
          correctIndex: 1,
          explanation:
            'const prevents assigning a different value to the customer binding. It does not freeze the object referenced by that binding, so its status property can change.',
        },
        {
          id: 'js-q-language-data-02',
          topic: 'Equality',
          prompt: 'Which statement about 0 === false is correct?',
          options: [
            'It is true because both values are falsy',
            'It is true only inside an if statement',
            'It is false because strict equality does not coerce different types',
            'It throws because numbers and booleans cannot be compared',
          ],
          correctIndex: 2,
          explanation:
            'Strict equality compares without type coercion. Number 0 and boolean false have different types, so the expression is false even though both are falsy in a condition.',
        },
        {
          id: 'js-q-language-data-03',
          topic: 'Closures',
          prompt: 'Why can a function returned by a factory still read a factory parameter later?',
          options: [
            'Every parameter is copied into the global object',
            'The returned function closes over the lexical environment where it was created',
            'JavaScript reruns the factory before every call',
            'Function parameters are stored in localStorage',
          ],
          correctIndex: 1,
          explanation:
            'A closure retains access to bindings in its defining lexical environment, even after the outer function has returned.',
        },
        {
          id: 'js-q-language-data-04',
          topic: 'Arrow functions',
          prompt: 'Which property of an arrow function is important when deciding whether to use it?',
          options: [
            'It creates a new dynamic this value on every call',
            'It can always be called with new',
            'It captures this lexically and has no own arguments object',
            'It is automatically asynchronous',
          ],
          correctIndex: 2,
          explanation:
            'Arrow functions do not define their own this or arguments and cannot be constructors. Their lexical this is useful for callbacks but wrong for methods needing a dynamic receiver.',
        },
        {
          id: 'js-q-language-data-05',
          topic: 'ES modules',
          prompt:
            'A module contains export function formatDate() {}. Which static import consumes that named export?',
          options: [
            'import formatDate from "./dates.js";',
            'require("./dates.js").default;',
            'import { formatDate } from "./dates.js";',
            'include formatDate from "./dates.js";',
          ],
          correctIndex: 2,
          explanation:
            'A named export is imported with braces and its exported name. A brace-free import consumes a default export instead.',
        },
        {
          id: 'js-q-language-data-06',
          topic: 'Array transformations',
          prompt:
            'Which array method is intended to produce one transformed output element for each input element?',
          options: ['filter()', 'map()', 'find()', 'some()'],
          correctIndex: 1,
          explanation:
            'map() creates a new array from callback results. filter() selects elements, find() returns the first match, and some() returns a boolean.',
        },
        {
          id: 'js-q-language-data-07',
          topic: 'Map and Set',
          prompt: 'When is Map a better fit than a plain object?',
          options: [
            'When a record has a fixed set of JSON field names',
            'When every key must be converted to a string',
            'When dynamic keys can include object identities and the collection is iterated',
            'When duplicate values must be removed automatically',
          ],
          correctIndex: 2,
          explanation:
            'Map accepts keys of any type, preserves insertion order for iteration, and provides an explicit collection API. Set, not Map, represents unique membership.',
        },
        {
          id: 'js-q-language-data-08',
          topic: 'Immutable updates',
          prompt:
            'Which expression returns an array where the matching record is updated without mutating the source array?',
          options: [
            'records.push(updatedRecord)',
            'records[index].status = "Closed"',
            'records.sort((a, b) => a.id.localeCompare(b.id))',
            'records.map((record) => record.id === id ? { ...record, status: "Closed" } : record)',
          ],
          correctIndex: 3,
          explanation:
            'map() creates a new outer array, and object spread creates a new object for the changed record. The other options mutate the existing array or one of its objects.',
        },
      ],
    },
    {
      id: 'jseng-async-browser',
      title: 'Async APIs & Secure Browser Interfaces',
      summary:
        'Coordinate asynchronous work, make cancelable and resilient HTTP requests, and build accessible DOM interactions that remain safe in an LWC security context.',
      lessons: [
        {
          id: 'jseng-promises-resilient-fetch',
          title: 'Promises, async/await & resilient API handling',
          summary:
            'Turn network uncertainty into explicit success, failure, timeout, cancellation, and retry behavior.',
          durationMinutes: 60,
          objectives: [
            'Explain promise states and choose sequential or concurrent composition intentionally',
            'Use async/await with error propagation and cleanup that preserves the original failure',
            'Handle fetch responses, HTTP status, content type, and JSON parsing as separate concerns',
            'Cancel obsolete requests and retry only transient, safe operations with bounded backoff',
          ],
          sections: [
            {
              heading: 'Promises represent one eventual result',
              body:
                'A Promise is pending and then settles exactly once as fulfilled with a value or rejected with a reason. Calling then(), catch(), or finally() returns a new promise, which is why errors and transformed values flow through a chain. Promise handlers run as microtasks after the current synchronous stack finishes; creating a promise does not move CPU-heavy work to another thread.\n\nAwait independent operations concurrently with Promise.all([a(), b()]) when all results are required and one rejection should fail the group. Use Promise.allSettled() when every outcome must be inspected. Do not accidentally serialize independent work by awaiting the first request before starting the second, and do not start unbounded thousands of requests when a concurrency limit is needed.',
            },
            {
              heading: 'async/await makes control flow visible',
              body:
                'An async function always returns a promise. await pauses only that async function until the operand settles; it does not block the browser. A rejection is thrown at the await expression, so ordinary try/catch/finally expresses recovery and cleanup. If the current layer cannot recover, let the rejection propagate or rethrow it with meaningful context and a cause.\n\nKeep the try block narrow so it is clear which operation failed. Set loading state before the operation and clear it in finally. Never combine await with a catch that logs and returns undefined unless undefined is an intentional, documented fallback; otherwise callers can mistake failure for valid missing data.',
            },
            {
              heading: 'fetch has transport and application-level outcomes',
              body:
                'fetch() rejects for failures such as an invalid URL, network failure, or cancellation. It normally fulfills for HTTP 404 and 500 responses, so code must check response.ok or response.status before reading success data. Body readers such as json() are asynchronous and can reject independently when the body is malformed or an abort occurs.\n\nVerify the response shape at the trust boundary. A Content-Type check detects an HTML login page returned where JSON was expected, but it does not prove that parsed JSON has required fields. Add runtime validation before application code relies on the payload. Include authentication and correlation details through approved platform mechanisms, never by logging tokens or embedding secrets in browser code.',
              code: {
                language: 'javascript',
                snippet:
                  'class HttpError extends Error {\n  constructor(status, statusText) {\n    super(`HTTP ${status}: ${statusText}`);\n    this.name = "HttpError";\n    this.status = status;\n  }\n}\n\nfunction wait(ms, signal) {\n  return new Promise((resolve, reject) => {\n    const timer = setTimeout(finish, ms);\n\n    function cleanup() {\n      clearTimeout(timer);\n      signal?.removeEventListener("abort", abort);\n    }\n    function finish() {\n      cleanup();\n      resolve();\n    }\n    function abort() {\n      cleanup();\n      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));\n    }\n\n    if (signal?.aborted) abort();\n    else signal?.addEventListener("abort", abort, { once: true });\n  });\n}\n\nasync function fetchJson(url, { signal, retries = 2, fetchImpl = fetch } = {}) {\n  let attempt = 0;\n\n  while (true) {\n    try {\n      const response = await fetchImpl(url, {\n        headers: { Accept: "application/json" },\n        signal,\n      });\n      if (!response.ok) throw new HttpError(response.status, response.statusText);\n\n      const contentType = response.headers.get("content-type") ?? "";\n      if (!contentType.includes("application/json")) {\n        throw new TypeError(`Expected JSON, received ${contentType || "unknown content"}`);\n      }\n      return await response.json();\n    } catch (error) {\n      if (signal?.aborted) throw error;\n      const retryable = !(error instanceof HttpError) || error.status >= 500;\n      if (!retryable || attempt >= retries) throw error;\n      await wait(100 * 2 ** attempt, signal);\n      attempt += 1;\n    }\n  }\n}\n\nlet calls = 0;\nconst fakeFetch = async () => {\n  calls += 1;\n  return calls === 1\n    ? new Response("busy", { status: 503, statusText: "Unavailable" })\n    : new Response(JSON.stringify({ accounts: [{ id: "A-1" }] }), {\n        headers: { "Content-Type": "application/json" },\n      });\n};\n\n(async () => {\n  const controller = new AbortController();\n  const timeout = setTimeout(() => controller.abort(), 2_000);\n  try {\n    console.log(await fetchJson("https://example.test/accounts", {\n      signal: controller.signal,\n      fetchImpl: fakeFetch,\n    }));\n  } finally {\n    clearTimeout(timeout);\n  }\n})();',
                caption:
                  'A modern browser or Node runtime can execute this deterministic example: a fake 503 response is retried once, while the request remains cancelable.',
              },
            },
            {
              heading: 'Cancellation, retries, and stale-result protection',
              body:
                'Pass an AbortSignal into APIs that support cancellation. A search interface should abort the prior fetch when the query changes and abort outstanding work when its owner is removed. An AbortSignal is one-use: after it is aborted, create a new controller for the next operation. Cancellation is expected control flow, so distinguish AbortError from an outage before showing an error to the user.\n\nRetry transient network failures, selected 5xx responses, and sometimes 429 according to Retry-After. Bound attempts, add exponential backoff with jitter in production, and honor cancellation during the wait. Automatic retries are safest for idempotent reads; retrying a non-idempotent create can duplicate business data unless the API accepts an idempotency key. When an API cannot be canceled, retain a request sequence number and ignore a late response that no longer matches the latest request.',
            },
          ],
          realWorld: {
            title: 'A type-ahead search showed the wrong account',
            scenario:
              'A user typed "Acme" quickly. Four searches ran concurrently, and the slow response for "A" arrived last, replacing the precise results for "Acme". During an outage, every keystroke also retried indefinitely and amplified traffic.',
            solution:
              'The component aborted the previous fetch for each new query, checked response.ok and the JSON shape, ignored AbortError as expected control flow, and used a maximum of two backoff retries only for transient idempotent reads. A request sequence guard provided stale-result protection for a non-cancelable adapter.',
            outcome:
              'Only the latest query could update the screen, outages produced a useful retry message without a request storm, and telemetry separated user cancellation from real service failures.',
          },
          keyTakeaways: [
            'Promise handlers run asynchronously, but promises do not make CPU work multithreaded',
            'Start independent operations before awaiting them when concurrency is intended',
            'fetch normally fulfills on HTTP errors, so inspect response.ok or status explicitly',
            'Cancellation prevents obsolete work; a sequence guard prevents obsolete results from winning',
            'Retry only bounded, transient, and safe operations, with backoff and cancellation support',
          ],
          resources: [
            {
              title: 'Using Promises',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises',
              source: 'other',
              note: 'MDN promise composition and errors',
            },
            {
              title: 'async function',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function',
              source: 'other',
              note: 'MDN async/await reference',
            },
            {
              title: 'Using the Fetch API',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
              source: 'other',
              note: 'MDN response and body handling',
            },
            {
              title: 'AbortSignal',
              url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal',
              source: 'other',
              note: 'MDN cancellation contract',
            },
          ],
        },
        {
          id: 'jseng-dom-accessibility-security',
          title: 'Events, DOM, accessibility & XSS-safe LWC context',
          summary:
            'Build event-driven interfaces with semantic markup, safe rendering primitives, and a correct mental model of Shadow DOM and Lightning Web Security.',
          durationMinutes: 60,
          objectives: [
            'Handle browser events with delegation, predictable propagation, and lifecycle cleanup',
            'Update the DOM through semantic elements while preserving keyboard and screen-reader behavior',
            'Render untrusted text without creating an HTML or URL injection sink',
            'Work within LWC ownership, Shadow DOM, Content Security Policy, and Lightning Web Security boundaries',
          ],
          sections: [
            {
              heading: 'Events are the interface between behavior and time',
              body:
                'addEventListener() registers behavior without overwriting other listeners. event.target is the deepest dispatch target visible in the current scope; event.currentTarget is the element whose listener is running. Events usually travel through capture, target, and bubble phases. Event delegation places one bubbling listener on a stable ancestor and resolves the actionable descendant with closest(), which is efficient for dynamic lists.\n\nUse preventDefault() only to replace a defined browser default, not as a general event stopper. Use stopPropagation() sparingly because it hides events from owners higher in the tree. Match listener lifetimes to UI lifetimes: retain the same function reference and remove global listeners, observers, and timers during teardown. In LWC, prefer declarative template listeners; clean up imperative listeners attached outside the component.',
              code: {
                language: 'javascript',
                snippet:
                  'const records = [\n  { id: "A-1", name: "Acme" },\n  { id: "A-2", name: "<img src=x onerror=alert(1)>" },\n];\n\nconst region = document.createElement("section");\nregion.setAttribute("aria-labelledby", "account-heading");\n\nconst heading = document.createElement("h2");\nheading.id = "account-heading";\nheading.textContent = "Choose an account";\n\nconst list = document.createElement("ul");\nconst status = document.createElement("p");\nstatus.setAttribute("role", "status");\nstatus.setAttribute("aria-live", "polite");\n\nfor (const record of records) {\n  const item = document.createElement("li");\n  const button = document.createElement("button");\n  button.type = "button";\n  button.dataset.recordId = record.id;\n  button.textContent = record.name;\n  item.append(button);\n  list.append(item);\n}\n\nlist.addEventListener("click", (event) => {\n  const button = event.target instanceof Element\n    ? event.target.closest("button[data-record-id]")\n    : null;\n  if (!button || !list.contains(button)) return;\n\n  const record = records.find(({ id }) => id === button.dataset.recordId);\n  status.textContent = record ? `Selected ${record.name}` : "Account not found";\n});\n\nregion.append(heading, list, status);\ndocument.body.append(region);',
                caption:
                  'Run in a browser console: semantic buttons support keyboard use, one delegated listener handles the list, and textContent displays the hostile-looking name as harmless text.',
              },
            },
            {
              heading: 'DOM structure is also an accessibility API',
              body:
                'Use the native element whose semantics match the action: button for an action, a for navigation, label with an input, and headings in a meaningful hierarchy. Native controls provide keyboard behavior, focusability, roles, and states that a clickable div does not. Supply visible labels, useful alternative text, and an announced status region for important asynchronous updates. ARIA supplements native semantics; it should not recreate semantics already built into HTML.\n\nDo not remove focus indicators. After an operation, move focus only when the workflow requires it, such as placing focus in an opened modal and restoring it to the opener on close. Test with only a keyboard, browser accessibility inspection, and a screen reader. In LWC, prefer Lightning base components when they meet the requirement because they package SLDS behavior and accessibility, while still verifying labels, errors, and focus in the composed experience.',
            },
            {
              heading: 'Safe rendering keeps data out of parser contexts',
              body:
                'Cross-site scripting occurs when attacker-controlled data is interpreted as executable markup, script, a dangerous URL, or an inline handler. For plain text, assign textContent or let an LWC template expression render the value; both keep the value in a text context. Build structure with createElement() and properties. Do not concatenate user data into innerHTML, outerHTML, insertAdjacentHTML(), script text, style text, or javascript: URLs.\n\nIf a requirement truly accepts rich HTML, use a security-reviewed sanitizer configured for the exact policy and keep sanitization close to the rendering sink. Escaping for HTML text is not interchangeable with URL, CSS, or JavaScript-context protection. Validate protocols for user-supplied links, avoid eval() and Function(), and treat server data as untrusted even when it originated from a familiar Salesforce field.',
            },
            {
              heading: 'Shadow DOM ownership and Lightning Web Security',
              body:
                'LWC uses Shadow DOM semantics to encapsulate component internals. Query only DOM the component owns, preferably through template references or this.template querying where appropriate; do not reach through another component to manipulate its private nodes. Events crossing a shadow boundary can be retargeted, so expose stable public properties, methods, and CustomEvent contracts rather than depending on internal markup.\n\nLightning Web Security creates JavaScript sandboxes by namespace and distorts selected platform APIs to prevent unsafe cross-namespace behavior. LWS sanitizes strings inserted through sinks such as innerHTML according to allowlists, but Salesforce explicitly notes that it does not validate input text. LWS and Content Security Policy are defense-in-depth, not permission to render unsanitized markup or store secrets client-side. Use supported APIs, test third-party libraries with LWS enabled, and preserve browser-standard behavior wherever possible.',
            },
          ],
          realWorld: {
            title: 'A case feed exposed both keyboard and injection defects',
            scenario:
              'A custom case feed rendered subject lines with innerHTML and used clickable div elements. A subject containing HTML created an injection path, keyboard users could not open a case, and one listener per row leaked when filters rebuilt the list.',
            solution:
              'The team rendered subjects as text, replaced div actions with labeled buttons, announced selection changes in a status region, and delegated one click listener from the stable list. The LWC version used template event handlers, component-owned DOM, and a small composed CustomEvent contract.',
            outcome:
              'The security test payload displayed literally, keyboard and screen-reader acceptance tests passed, and repeated filtering no longer increased listener count or response time.',
          },
          keyTakeaways: [
            'event.target identifies the visible dispatch target; event.currentTarget identifies the active listener owner',
            'Native semantic controls provide behavior and accessibility that generic elements do not',
            'Use textContent or escaped LWC template expressions for untrusted plain text',
            'Shadow DOM makes component internals private; communicate through intentional public APIs and events',
            'LWS is defense-in-depth and does not replace input validation or context-safe rendering',
          ],
          resources: [
            {
              title: 'Introduction to Events',
              url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events',
              source: 'other',
              note: 'MDN event handling fundamentals',
            },
            {
              title: 'Communicate with Events',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/events.html',
              source: 'developer',
              note: 'Official LWC event guidance',
            },
            {
              title: 'Component Accessibility',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/create-components-accessibility.html',
              source: 'developer',
              note: 'Official LWC accessibility guidance',
            },
            {
              title: 'Lightning Web Security Sanitization',
              url: 'https://developer.salesforce.com/docs/platform/lightning-components-security/guide/lws-sanitize.html',
              source: 'developer',
              note: 'Official sanitization boundaries and warning',
            },
            {
              title: 'How Lightning Web Security Works',
              url: 'https://developer.salesforce.com/docs/platform/lightning-components-security/guide/lws-architecture.html',
              source: 'developer',
              note: 'Namespace sandbox and distortion model',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'js-q-async-browser-01',
          topic: 'Promise scheduling',
          prompt:
            'A fulfilled promise receives a then() handler while synchronous code is still running. When does the handler execute?',
          options: [
            'Immediately, in the middle of the current statement',
            'As a microtask after the current synchronous call stack finishes',
            'Only after a one-second timer',
            'On a new CPU thread created by the promise',
          ],
          correctIndex: 1,
          explanation:
            'Promise reactions are queued as microtasks. They run after the current stack completes; a promise does not itself create a worker thread.',
        },
        {
          id: 'js-q-async-browser-02',
          topic: 'Promise composition',
          prompt: 'What does Promise.all([first, second]) do if second rejects?',
          options: [
            'It fulfills with only the first result',
            'It remains pending forever',
            'It rejects the aggregate promise with that rejection',
            'It converts the rejection to undefined automatically',
          ],
          correctIndex: 2,
          explanation:
            'Promise.all requires every input to fulfill and rejects when any input rejects. Promise.allSettled is the alternative when every outcome must be collected.',
        },
        {
          id: 'js-q-async-browser-03',
          topic: 'Fetch responses',
          prompt: 'How does fetch() normally handle an HTTP 404 response?',
          options: [
            'It fulfills with a Response whose ok property is false',
            'It rejects before a Response exists',
            'It retries until the server returns 200',
            'It fulfills directly with parsed JSON',
          ],
          correctIndex: 0,
          explanation:
            'fetch rejects for request or network failures, but HTTP error statuses normally produce a fulfilled Response. Application code must inspect ok or status.',
        },
        {
          id: 'js-q-async-browser-04',
          topic: 'Cancellation',
          prompt: 'What is the correct way to make a fetch request cancelable?',
          options: [
            'Pass an AbortController signal to fetch and later call controller.abort()',
            'Call Promise.cancel() on the result',
            'Set response.ok to false',
            'Reuse an already-aborted signal for every later request',
          ],
          correctIndex: 0,
          explanation:
            'fetch accepts an AbortSignal. Calling abort on its controller rejects outstanding work; an aborted signal is one-use and a later operation needs a new controller.',
        },
        {
          id: 'js-q-async-browser-05',
          topic: 'Resilient retries',
          prompt: 'Which request is generally safest to retry automatically after a transient failure?',
          options: [
            'A payment creation with no idempotency protection',
            'An idempotent read with bounded attempts and backoff',
            'Every failed request in an infinite tight loop',
            'A canceled request that the user explicitly abandoned',
          ],
          correctIndex: 1,
          explanation:
            'Idempotent reads do not create duplicate business actions. Retries still need a bound, backoff, and cancellation; writes require an API-level idempotency strategy.',
        },
        {
          id: 'js-q-async-browser-06',
          topic: 'DOM events',
          prompt: 'Inside a delegated listener on a list, what does event.currentTarget refer to?',
          options: [
            'The deepest child originally clicked',
            'The element whose listener is currently executing',
            'The window in every event',
            'The last element appended to the list',
          ],
          correctIndex: 1,
          explanation:
            'currentTarget is the listener owner. target is the dispatch target visible at that listener and may be a descendant or a retargeted component boundary.',
        },
        {
          id: 'js-q-async-browser-07',
          topic: 'Accessibility',
          prompt: 'What is the best starting element for an action a user can click or activate with a keyboard?',
          options: [
            'A div with only a click listener',
            'A span with a color change',
            'A native button with an accessible name',
            'An image with no alternative text',
          ],
          correctIndex: 2,
          explanation:
            'A native button supplies action semantics, focusability, and keyboard activation. Its visible text or accessibility attributes must also provide a meaningful name.',
        },
        {
          id: 'js-q-async-browser-08',
          topic: 'XSS and Lightning Web Security',
          prompt:
            'How should an LWC display an untrusted case subject that is required to be plain text?',
          options: [
            'Concatenate it into innerHTML because LWS validates all input',
            'Evaluate it and display the returned value',
            'Disable LWS sanitization for the component',
            'Render it through a template text expression and keep it out of HTML parsing sinks',
          ],
          correctIndex: 3,
          explanation:
            'Template text rendering keeps the value in a text context. LWS sanitizes selected inserted markup but does not validate input text and does not justify unsafe innerHTML composition.',
        },
      ],
    },
    {
      id: 'jseng-typed-quality',
      title: 'Typed Contracts, Testing & LWC Delivery',
      summary:
        'Add TypeScript contracts and runtime narrowing, verify behavior with Jest, debug systematically, and assemble the practices into an LWC-oriented capstone.',
      lessons: [
        {
          id: 'jseng-typescript-lwc-contracts',
          title: 'TypeScript types, narrowing & Salesforce contracts',
          summary:
            'Use TypeScript to make assumptions reviewable, then validate the runtime boundaries where static types cannot protect an LWC.',
          durationMinutes: 60,
          objectives: [
            'Use inference, interfaces, unions, generics, and readonly types without falling back to any',
            'Narrow unknown data with control flow, type predicates, and discriminated unions',
            'Design compile-time contracts while retaining runtime validation at external boundaries',
            'Apply Salesforce type definitions carefully within the current LWC TypeScript Developer Preview workflow',
          ],
          sections: [
            {
              heading: 'Types document the values code is allowed to use',
              body:
                'TypeScript adds static analysis to JavaScript and then erases types when it emits JavaScript. Let the compiler infer obvious local values, but annotate public function parameters, return values, exported models, and state boundaries. Interfaces describe extendable object shapes; type aliases can also express unions, tuples, primitives, and mapped types. Generics preserve a relationship between input and output types rather than replacing uncertainty with any.\n\nPrefer unknown for a value whose type has not been established. any opts out of checking and lets an unsafe value spread through the program. readonly properties and ReadonlyArray communicate that a caller must not mutate through that reference, but they are compile-time restrictions, not runtime freezing. Keep strict compiler settings and fix unsafe assumptions instead of silencing them with broad assertions.',
            },
            {
              heading: 'Narrow before use',
              body:
                'Control-flow analysis narrows a union after checks such as typeof value === "string", value instanceof Error, property existence, or a discriminant comparison. A user-defined predicate such as isContact(value): value is Contact centralizes a reusable runtime check. Avoid assertions that merely tell the compiler to trust unverified network data.\n\nDiscriminated unions model state without impossible combinations: { kind: "loading" }, { kind: "ready", data }, or { kind: "error", message }. A switch on kind gives each branch the correct fields. Passing the default branch to a function that accepts never makes a newly added state produce a compile error until every switch handles it.',
              code: {
                language: 'typescript',
                snippet:
                  'interface Contact {\n  readonly id: string;\n  readonly name: string;\n  readonly email?: string;\n}\n\ntype ContactState =\n  | { kind: "loading" }\n  | { kind: "ready"; contacts: readonly Contact[] }\n  | { kind: "error"; message: string };\n\nfunction isContact(value: unknown): value is Contact {\n  if (typeof value !== "object" || value === null) return false;\n  const candidate = value as Record<string, unknown>;\n  return (\n    typeof candidate.id === "string" &&\n    typeof candidate.name === "string" &&\n    (candidate.email === undefined || typeof candidate.email === "string")\n  );\n}\n\nfunction parseContacts(payload: unknown): readonly Contact[] {\n  if (!Array.isArray(payload)) throw new TypeError("Expected a contact array");\n  return payload.map((item, index) => {\n    if (!isContact(item)) throw new TypeError(`Invalid contact at index ${index}`);\n    return { ...item };\n  });\n}\n\nfunction assertNever(value: never): never {\n  throw new Error(`Unhandled state: ${JSON.stringify(value)}`);\n}\n\nfunction statusMessage(state: ContactState): string {\n  switch (state.kind) {\n    case "loading":\n      return "Loading contacts";\n    case "ready":\n      return `${state.contacts.length} contacts loaded`;\n    case "error":\n      return `Could not load contacts: ${state.message}`;\n    default:\n      return assertNever(state);\n  }\n}\n\nconst contacts = parseContacts([{ id: "C-1", name: "Ada" }]);\nconsole.log(statusMessage({ kind: "ready", contacts }));',
                caption:
                  'Compile and run this TypeScript example: unknown input is checked at runtime and a discriminated union makes every UI state explicit.',
              },
            },
            {
              heading: 'Static contracts end at runtime boundaries',
              body:
                'A type annotation does not inspect JSON, an Apex return value, local storage, a message event, or a third-party library. Receive these values as unknown when practical and parse them into trusted domain models. Validation can be a focused predicate as shown here or a project-standard schema validator; return useful field context without exposing sensitive values.\n\nSeparate transport shapes from UI models. An adapter can validate an Apex DTO, normalize Salesforce field names, apply null handling once, and return a readonly domain object. The LWC then renders a stable contract instead of repeating optional chaining and coercion throughout event handlers. Type CustomEvent detail and public component properties as narrow contracts, while remembering that callers and server responses still require runtime defenses.',
            },
            {
              heading: 'Applying TypeScript to Lightning Web Components',
              body:
                'Salesforce currently documents TypeScript for LWC as a Developer Preview. The documented workflow supplies Salesforce type definitions, including the @salesforce/lightning-types package, but the LWC compiler does not itself compile TypeScript; projects must transform TypeScript to JavaScript before deployment. Preview limitations and setup requirements can change, so follow the current Salesforce guide rather than assuming a generic web configuration is deployable.\n\nAdopt it incrementally around high-value contracts: pure data adapters, component state unions, @api surfaces, event detail, wire or imperative Apex results, and tested utilities. Keep generated JavaScript out of hand-edited logic according to project conventions. If a production team cannot accept preview features, the same design discipline remains available in JavaScript through small modules, JSDoc types, runtime validators, ESLint, and Jest.',
            },
          ],
          realWorld: {
            title: 'A nullable Apex field broke only one customer org',
            scenario:
              'An account-health LWC asserted that an Apex response matched its TypeScript interface. One org had legacy records where a nested score object was null, so rendering failed even though the editor and build showed no error.',
            solution:
              'The boundary accepted the response as unknown, validated required fields, converted nullable transport fields into an explicit ready or incomplete domain state, and used a discriminated union for loading, success, empty, and error rendering. The team also documented the preview compilation step.',
            outcome:
              'Legacy data produced an intentional incomplete-state message instead of a blank component, every state was covered by compile-time exhaustiveness and Jest tests, and developers stopped treating assertions as runtime validation.',
          },
          keyTakeaways: [
            'Type inference reduces noise, while exported and boundary contracts deserve explicit types',
            'unknown requires proof before use; any disables the proof system',
            'Discriminated unions represent valid states and never checks enforce exhaustive handling',
            'TypeScript types are erased, so external data still needs runtime validation',
            'LWC TypeScript is currently a Developer Preview with a separate compile-to-JavaScript step',
          ],
          resources: [
            {
              title: 'TypeScript for the New Programmer',
              url: 'https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html',
              source: 'other',
              note: 'Official TypeScript introduction',
            },
            {
              title: 'Narrowing',
              url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html',
              source: 'other',
              note: 'Official control-flow and predicate guide',
            },
            {
              title: 'TypeScript for Lightning Web Components (Developer Preview)',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/ts.html',
              source: 'developer',
              note: 'Current Salesforce setup, limits, and compilation workflow',
            },
            {
              title: 'Work with Salesforce Data',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/data-guideline.html',
              source: 'developer',
              note: 'Official LWC data-access guidance',
            },
          ],
        },
        {
          id: 'jseng-jest-capstone',
          title: 'Jest, linting, debugging & the LWC capstone',
          summary:
            'Create a fast quality loop and prove an accessible, resilient account explorer from pure transformations through component behavior.',
          durationMinutes: 70,
          objectives: [
            'Write deterministic Jest tests around behavior, errors, async work, DOM output, and component events',
            'Use linting, type checking, formatting, and focused test commands as distinct feedback layers',
            'Debug from a reproducible symptom with breakpoints, network evidence, and readable LWC source',
            'Design and verify an end-to-end LWC capstone that integrates modules, data contracts, state, accessibility, and security',
          ],
          sections: [
            {
              heading: 'Test observable behavior at the cheapest useful boundary',
              body:
                'Unit tests should make a promise about behavior: given an input or interaction, assert the returned value, rendered state, event, or failure visible to a caller. Use Arrange-Act-Assert, descriptive test names, and controlled fixtures. Test pure adapters directly; test an LWC through its public API and shadow DOM output rather than private methods or internal implementation order.\n\nSalesforce uses Jest with @salesforce/sfdx-lwc-jest for local LWC tests. Create the component with createElement(), append it to the document, provide mocked wire or Apex results, perform a real DOM interaction, await pending microtasks, and assert output or events. Remove appended elements after each test. Jest does not connect to an org or run in a real browser, so retain targeted integration, accessibility, and org-level acceptance tests.',
            },
            {
              heading: 'Deterministic tests make transformations safe to change',
              body:
                'Cover a representative success, meaningful boundary values, invalid input, and a regression for every repaired defect. Assert outcomes rather than line coverage alone. A test can freeze fixture objects to expose accidental writes, while equality assertions verify the new value. For asynchronous code, return or await the promise so Jest knows when the test is complete; use resolved and rejected mocks instead of real networks.\n\nMock only at a boundary the code genuinely owns. A tiny fake Apex adapter or wire test utility keeps outcomes controlled; mocking every internal function couples tests to implementation and makes refactoring expensive. Keep fixtures small enough that a failure explains itself.',
              code: {
                language: 'javascript',
                snippet:
                  'function toAccountRows(records) {\n  if (!Array.isArray(records)) throw new TypeError("records must be an array");\n  return records.map(({ Id, Name, AnnualRevenue = 0 }) => ({\n    id: Id,\n    name: Name,\n    revenue: Number(AnnualRevenue),\n  }));\n}\n\ndescribe("toAccountRows", () => {\n  test("normalizes Salesforce fields for the view", () => {\n    expect(toAccountRows([\n      { Id: "001-A", Name: "Acme", AnnualRevenue: 2500 },\n    ])).toEqual([\n      { id: "001-A", name: "Acme", revenue: 2500 },\n    ]);\n  });\n\n  test("does not mutate a frozen input", () => {\n    const source = Object.freeze([\n      Object.freeze({ Id: "001-A", Name: "Acme", AnnualRevenue: null }),\n    ]);\n    expect(toAccountRows(source)[0].revenue).toBe(0);\n    expect(source[0]).toEqual({ Id: "001-A", Name: "Acme", AnnualRevenue: null });\n  });\n\n  test("rejects a non-array boundary value", () => {\n    expect(() => toAccountRows(null)).toThrow(TypeError);\n  });\n});',
                caption:
                  'Save as accountRows.test.js in a Jest project: the suite verifies normalization, immutability, and the invalid-input contract.',
              },
            },
            {
              heading: 'Lint, type-check, test, then debug with evidence',
              body:
                'Each feedback tool answers a different question. A formatter makes layout consistent. ESLint detects configured syntax, correctness, and maintainability hazards. TypeScript checks static contracts. Jest executes examples. Run the fastest relevant checks while editing and the project-required suite before delivery; never disable a rule without understanding the invariant it protects.\n\nFor a runtime defect, first record exact reproduction steps and expected versus actual behavior. Read the first relevant error and stack, enable pause on exceptions, inspect values and call frames, and use the Network panel to separate transport, HTTP, payload, and rendering failures. Salesforce Debug Mode serves less optimized LWC code and richer warnings but slows that user, so enable it only while debugging. Form one hypothesis, gather evidence, make the smallest change, and add a regression test.',
            },
            {
              heading: 'Capstone: an account health explorer LWC',
              body:
                'Build an LWC that accepts a search term, loads account-health records through a replaceable Salesforce data adapter, and presents loading, empty, ready, and error states. Put normalization and runtime validation in a pure module. Deduplicate by record ID, derive a sorted readonly view, and use a request sequence token so a late non-cancelable Apex result cannot replace a newer search. Keep secrets and external credentials server-side.\n\nThe template uses a labeled lightning-input, a real submit action, an announced status, and semantic result controls. Render names as text, expose selection through a small CustomEvent detail containing only the record ID, and never query another component internals. Jest tests cover each state, rapid out-of-order searches, malformed data, keyboard-equivalent button interaction, safe hostile-looking text, and the selection event. Lint, type-check where the preview workflow is approved, run Jest, then exercise the component in an LWS-enabled scratch org with keyboard and screen-reader checks.\n\nDefinition of done: modules have explicit contracts; no input mutation or unhandled rejection occurs; stale results cannot win; errors offer a retry path; DOM output is semantic and XSS-safe; tests do not call a real org; and the README-level handoff records assumptions, commands, and the TypeScript preview build step.',
            },
          ],
          realWorld: {
            title: 'The capstone becomes a release-ready account explorer',
            scenario:
              'A prototype account search worked on the happy path but directly consumed Apex field names, displayed only a spinner on failure, allowed old searches to overwrite new ones, and had no proof that a hostile account name was rendered safely.',
            solution:
              'The team extracted and tested a validating adapter, represented UI state as a discriminated union, added a request sequence guard and retry action, used semantic LWC controls and text rendering, emitted a minimal selection event, and built Jest fixtures for success, empty, malformed, rejected, and out-of-order responses.',
            outcome:
              'The component passed lint, type, Jest, keyboard, LWS, and scratch-org acceptance checks. A later Apex field change failed one focused contract test instead of silently breaking the UI in production.',
          },
          keyTakeaways: [
            'Test public behavior and controlled boundaries rather than private implementation details',
            'Await asynchronous work in Jest and replace remote dependencies with deterministic mocks',
            'Formatting, linting, type checking, and tests catch different classes of defects',
            'Debugging begins with reproducible evidence and a falsifiable hypothesis',
            'A production LWC combines validated data, explicit state, stale-result protection, semantic DOM, safe rendering, and layered tests',
          ],
          resources: [
            {
              title: 'Getting Started with Jest',
              url: 'https://jestjs.io/docs/getting-started',
              source: 'other',
              note: 'Official Jest fundamentals',
            },
            {
              title: 'Testing Asynchronous Code',
              url: 'https://jestjs.io/docs/asynchronous',
              source: 'other',
              note: 'Official async completion patterns',
            },
            {
              title: 'Test Lightning Web Components',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/testing.html',
              source: 'developer',
              note: 'Official Salesforce Jest guidance',
            },
            {
              title: 'Write Jest Tests for the Wire Service',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/unit-testing-using-wire-utility.html',
              source: 'developer',
              note: 'Official wire adapter test utilities',
            },
            {
              title: 'Debug Lightning Web Components',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide/debug-intro.html',
              source: 'developer',
              note: 'Official browser and Salesforce debugging workflow',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'js-q-typed-quality-01',
          topic: 'unknown and any',
          prompt: 'Why is unknown safer than any for an unverified API payload?',
          options: [
            'unknown automatically validates every field at runtime',
            'unknown requires narrowing before property access, while any bypasses checking',
            'unknown converts the payload to an empty object',
            'unknown can contain only strings and numbers',
          ],
          correctIndex: 1,
          explanation:
            'unknown represents a value whose type has not been proved. TypeScript requires a check or predicate before use; any opts out of those checks.',
        },
        {
          id: 'js-q-typed-quality-02',
          topic: 'Discriminated unions',
          prompt:
            'What makes { kind: "loading" } | { kind: "ready"; data: Item[] } convenient to narrow?',
          options: [
            'The shared kind property has distinct literal values',
            'Every branch has exactly the same fields',
            'TypeScript runs a network request for each branch',
            'The union is converted to a class at runtime',
          ],
          correctIndex: 0,
          explanation:
            'The literal kind property is a discriminant. Checking it lets control-flow analysis select the matching branch and its available fields.',
        },
        {
          id: 'js-q-typed-quality-03',
          topic: 'Runtime contracts',
          prompt:
            'Why should JSON parsed from an Apex or HTTP response still be validated in a TypeScript application?',
          options: [
            'Interfaces are erased and do not inspect runtime values',
            'JSON cannot contain arrays in TypeScript',
            'TypeScript encrypts only validated objects',
            'The compiler automatically changes every server response',
          ],
          correctIndex: 0,
          explanation:
            'TypeScript checks source code and erases its types during compilation. External data can violate a declared interface, so the runtime boundary must establish its shape.',
        },
        {
          id: 'js-q-typed-quality-04',
          topic: 'Readonly types',
          prompt: 'What does readonly on a TypeScript property guarantee by itself?',
          options: [
            'The entire object graph is deeply frozen at runtime',
            'The database field can never change',
            'Checked code cannot assign through that property reference',
            'The property is removed from emitted JavaScript',
          ],
          correctIndex: 2,
          explanation:
            'readonly is a compile-time restriction on assignment through the typed reference. It does not perform runtime freezing or automatically make nested values readonly.',
        },
        {
          id: 'js-q-typed-quality-05',
          topic: 'LWC TypeScript',
          prompt: 'Which statement matches the current official Salesforce LWC TypeScript guidance?',
          options: [
            'It is a Developer Preview and TypeScript must be compiled to JavaScript before deployment',
            'Every org compiles arbitrary TypeScript on the server with no project setup',
            'TypeScript is required for all Lightning Web Components',
            'Salesforce types remove the need to validate Apex responses',
          ],
          correctIndex: 0,
          explanation:
            'Salesforce documents LWC TypeScript as a Developer Preview. The LWC compiler does not compile TypeScript, so the documented project workflow transforms it before deployment.',
        },
        {
          id: 'js-q-typed-quality-06',
          topic: 'Jest test design',
          prompt: 'What should an LWC Jest test prefer to assert?',
          options: [
            'The exact order of every private helper call',
            'Observable DOM, events, and public behavior after controlled input',
            'A live production org response',
            'Only that every source line executed',
          ],
          correctIndex: 1,
          explanation:
            'Behavior-focused tests survive internal refactoring. Local LWC Jest tests use controlled mocks and assert public properties, interactions, rendered output, and events.',
        },
        {
          id: 'js-q-typed-quality-07',
          topic: 'Asynchronous tests',
          prompt: 'Why must a Jest test return or await the promise under test?',
          options: [
            'Otherwise Jest can finish the test before the asynchronous assertion runs',
            'Otherwise JavaScript changes the promise into a callback',
            'It forces every promise onto a separate thread',
            'It connects Jest to a Salesforce org',
          ],
          correctIndex: 0,
          explanation:
            'Jest needs the returned or awaited promise to know when asynchronous work settles. Without it, the test can pass or finish before a later assertion or rejection occurs.',
        },
        {
          id: 'js-q-typed-quality-08',
          topic: 'Capstone resilience',
          prompt:
            'An imperative Apex search cannot be canceled. What prevents an older slow result from replacing the newest results?',
          options: [
            'Mutating the previous result array',
            'Removing every catch block',
            'Comparing a captured request sequence token before committing state',
            'Using innerHTML to render results faster',
          ],
          correctIndex: 2,
          explanation:
            'Each request captures a sequence value. Only the response matching the current latest sequence may update state, so a late obsolete response is ignored.',
        },
      ],
    },
  ],
};
