import type { CurriculumPath } from './curriculum.types';

/**
 * Path 6 — Java Programming (Intermediate, programming track).
 * Apex is modeled on Java, integration middleware around Salesforce is very
 * often Java, and the platform's own code-analysis tooling (PMD) runs on it.
 * This track teaches practical Java for a Salesforce professional.
 */
export const javaPath: CurriculumPath = {
  id: 'java-training',
  title: 'Java Programming',
  tagline: 'The language Apex grew from — and the one your integrations speak.',
  description:
    'Java powers the middleware, ETL jobs, and enterprise services that sit next to almost every Salesforce org — and Apex itself is deliberately Java-like, so every hour here sharpens your Apex too. This path covers the platform and syntax, object-oriented design with interfaces and collections, and the practical layer: exceptions, HTTP + JSON integration against Salesforce APIs, and building/testing with Maven and JUnit.',
  level: 'intermediate',
  category: 'programming',
  badge: 'Java Practitioner',
  estimatedHours: 7,
  skills: ['JVM & core syntax', 'OO design & interfaces', 'Collections & generics', 'HTTP, JSON, Maven & JUnit'],
  modules: [
    {
      id: 'java-fundamentals',
      title: 'Java Fundamentals',
      summary:
        'The JVM mental model, static typing, control flow, and methods — plus a running comparison with Apex so knowledge transfers both ways.',
      lessons: [
        {
          id: 'java-platform-first-class',
          title: 'The Java platform: JVM, JDK, and your first class',
          summary:
            'What actually happens between .java source and a running program, why "write once, run anywhere" matters, and where Java sits in a Salesforce landscape.',
          durationMinutes: 15,
          objectives: [
            'Distinguish the JDK, JRE, and JVM and what each is for',
            'Compile and run a minimal Java program',
            'Explain where Java appears around a Salesforce implementation',
          ],
          sections: [
            {
              heading: 'JVM, JRE, JDK — three letters, one pipeline',
              body:
                'Java source (.java) is compiled by javac into bytecode (.class) — a portable instruction format. The Java Virtual Machine (JVM) executes that bytecode on any operating system, applying just-in-time compilation for speed. The JRE is the runtime (JVM + core libraries); the JDK is the developer kit (JRE + compiler + tools) — you install the JDK, servers may run just a runtime.\n\nThis is "write once, run anywhere": the same .jar runs on a developer\'s Mac, a Linux container, and a Windows server. It is also why this platform\'s code-analysis tooling (PMD inside Salesforce Code Analyzer) just needs "Java 11+" — bytecode does not care about your OS.',
            },
            {
              heading: 'Your first class, and why it looks like Apex',
              body:
                'Everything in Java lives in a class. A program starts at public static void main(String[] args). Statements end with semicolons, blocks use braces, and — unlike JavaScript — every variable has a declared type checked at COMPILE time. Errors surface before the program ever runs.\n\nIf you know Apex, this is home territory: Apex\'s syntax, type system, and class model were designed after Java. The differences are environmental — Apex runs multi-tenant with governor limits and built-in SOQL; Java runs wherever you deploy it with no such guardrails and a vastly larger ecosystem.',
              code: {
                language: 'java',
                snippet:
                  'public class OrgReport {\n    public static void main(String[] args) {\n        String orgAlias = "uat-full";\n        int connectedUsers = 42;\n        boolean healthy = connectedUsers > 0;\n\n        System.out.printf("Org %s healthy=%b users=%d%n",\n                orgAlias, healthy, connectedUsers);\n    }\n}\n// Compile and run:\n//   javac OrgReport.java\n//   java OrgReport',
                caption: 'A complete Java program: one class, one main method, typed variables.',
              },
            },
            {
              heading: 'Where Java lives around Salesforce',
              body:
                'Look around any enterprise Salesforce implementation and you will find Java: MuleSoft runs on the JVM, ETL and middleware services that call Salesforce APIs are commonly Spring Boot applications, Kafka consumers that process platform events are Java, and static-analysis tooling for Apex (PMD) is Java. Data engineering teams run JVM-based Spark jobs against Salesforce extracts.\n\nFor you this means two payoffs: reading Java lets you debug the OTHER side of an integration instead of waiting on another team, and writing basic Java lets you build the small connectors and utilities that glue a DevOps pipeline together.',
            },
          ],
          realWorld: {
            title: 'Debugging an integration from both sides',
            scenario:
              'Orders created in Salesforce arrived in the ERP with missing shipping data. The middleware team insisted "Salesforce sends it wrong"; the Salesforce team insisted the payload was correct. Tickets bounced between teams for two weeks.',
            solution:
              'A Salesforce developer with basic Java literacy read the middleware\'s transformation class and found it parsing ShippingAddress with a field name from a legacy API version. She wrote a one-line fix and a failing-then-passing JUnit test to prove it.',
            outcome:
              'The two-week ping-pong ended in an afternoon. The developer became the designated "integration translator", and cross-language literacy became a hiring criterion for the platform team.',
          },
          keyTakeaways: [
            'javac compiles source to bytecode; the JVM runs it anywhere',
            'JDK = compiler + tools; JRE/runtime is what servers need',
            'Java is statically typed — whole bug classes die at compile time',
            'Apex is Java-shaped: learning one strengthens the other',
          ],
          resources: [
            {
              title: 'Dev.java: Getting started',
              url: 'https://dev.java/learn/getting-started/',
              source: 'other',
              note: 'Oracle\'s modern learning portal',
            },
            {
              title: 'The Java Tutorials',
              url: 'https://docs.oracle.com/javase/tutorial/',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-types-control-flow',
          title: 'Types, operators, and control flow',
          summary:
            'Primitives vs objects, strings done right, and the full branching/looping toolkit including modern switch.',
          durationMinutes: 18,
          objectives: [
            'Choose between primitives and wrapper types deliberately',
            'Compare strings correctly and build them efficiently',
            'Use if/else, switch expressions, and all loop forms',
          ],
          sections: [
            {
              heading: 'Primitives, wrappers, and var',
              body:
                'Java\'s primitives (int, long, double, boolean, char…) hold raw values with no methods — fast and never null. Each has an object wrapper (Integer, Long, Double, Boolean) used in collections and when "no value" must be representable. Autoboxing converts between them silently, but a null Integer unboxed into an int throws a NullPointerException — a classic production bug when database columns are nullable.\n\nSince Java 10, var infers LOCAL variable types (var orgs = new ArrayList<String>()). The type is still static and fixed — var is inference, not dynamism. Use it when the right-hand side makes the type obvious.',
            },
            {
              heading: 'Strings: equals, immutability, StringBuilder',
              body:
                'Strings are immutable objects. Compare CONTENT with .equals() (or equalsIgnoreCase) — the == operator compares references and passes tests only by interning luck, then fails in production. This is the single most common Java beginner bug.\n\nBecause each concatenation allocates a new string, building large text in loops uses StringBuilder. Modern formatting favors String.format / formatted, and text blocks (""" … """) hold multi-line JSON/SQL templates cleanly — handy for request payloads in integration code.',
              code: {
                language: 'java',
                snippet:
                  'String status = fetchStatus();          // may come from an API\n\nif ("SUCCEEDED".equals(status)) {        // equals(), constant first = null-safe\n    System.out.println("Deploy done");\n}\n\nStringBuilder report = new StringBuilder();\nfor (String failure : failures) {\n    report.append("- ").append(failure).append(\'\\n\');\n}\nSystem.out.println(report);',
                caption: 'Content equality with equals(); StringBuilder for loops. Constant-first avoids NPEs.',
              },
            },
            {
              heading: 'Branching and looping, including modern switch',
              body:
                'if/else and the classic for, enhanced for (for (Order o : orders)), while, and do/while behave as you expect from Apex. Modern Java adds switch EXPRESSIONS with arrows that return values and never fall through: String label = switch (status) { case PENDING -> "Waiting"; case FAILED -> "Fix required"; default -> "OK"; }.\n\nTwo habits from day one: keep loop bodies small (extract methods aggressively) and prefer enhanced-for unless you truly need the index. When a loop is really a transformation, the collections module will replace it with streams — but master explicit loops first.',
            },
          ],
          realWorld: {
            title: 'The == comparison that only failed in production',
            scenario:
              'A payment-status sync compared API status strings with ==. In unit tests the literals were interned so it passed; in production the strings arrived from HTTP responses as distinct objects, every comparison was false, and thousands of "completed" payments were re-queued for retry all weekend.',
            solution:
              'All comparisons moved to constant-first equals() ("COMPLETED".equals(status)), an integration test with genuinely deserialized strings was added, and the team enabled a static-analysis rule that flags == on strings.',
            outcome:
              'The retry storm ended, duplicate-processing safeguards were added, and the static-analysis gate has blocked the same bug pattern four times since — at review time instead of during a weekend incident.',
          },
          keyTakeaways: [
            'Primitives are fast and never null; wrappers can be null — unbox carefully',
            'Compare strings with equals(), never == ; put the constant first',
            'StringBuilder for building text in loops',
            'Switch expressions return values and never fall through',
          ],
          resources: [
            {
              title: 'Dev.java: Language basics',
              url: 'https://dev.java/learn/language-basics/',
              source: 'other',
            },
            {
              title: 'Baeldung: Java String comparison',
              url: 'https://www.baeldung.com/java-compare-strings',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-methods-classes-objects',
          title: 'Methods, classes, and objects',
          summary:
            'Designing a class properly: constructors, encapsulation, static vs instance, and value objects with records.',
          durationMinutes: 18,
          objectives: [
            'Write classes with constructors, fields, and encapsulated access',
            'Decide between static and instance members correctly',
            'Model immutable data with records',
          ],
          sections: [
            {
              heading: 'Objects are state + behavior; constructors make them valid',
              body:
                'A class declares fields (state) and methods (behavior); new invokes a constructor whose job is to establish a VALID object — required values provided, invariants checked, exceptions thrown on nonsense (a deployment with no target org should never exist as an object).\n\nEncapsulation means fields are private and access flows through methods, so the class controls its own consistency. The getter/setter convention is standard, but do not add setters reflexively: an object whose every field is mutable from outside is just a struct with ceremony.',
              code: {
                language: 'java',
                snippet:
                  'public class Deployment {\n    private final String id;\n    private final String targetOrg;\n    private DeployStatus status = DeployStatus.PENDING;\n\n    public Deployment(String id, String targetOrg) {\n        if (targetOrg == null || targetOrg.isBlank()) {\n            throw new IllegalArgumentException("targetOrg is required");\n        }\n        this.id = id;\n        this.targetOrg = targetOrg;\n    }\n\n    public void markRunning() { this.status = DeployStatus.RUNNING; }\n    public DeployStatus status() { return status; }\n    public String targetOrg() { return targetOrg; }\n}',
                caption: 'Final fields for identity, validation in the constructor, state changed only through methods.',
              },
            },
            {
              heading: 'static vs instance — whose data is it?',
              body:
                'Instance members belong to each object (this deployment\'s status); static members belong to the class itself (a shared counter, a factory method, a constant like MAX_RETRIES). If a method uses no instance state, it can be static — utility methods usually are.\n\nResist static MUTABLE state: it is global state wearing a uniform, painful to test and dangerous under concurrency. Constants (static final) are always fine. Apex developers will recognize this instinct — static variables per-transaction in Apex become static-per-JVM in Java, a much longer lifetime with much more room for surprise.',
            },
            {
              heading: 'Records: immutable data in one line',
              body:
                'Most integration code shuttles data shapes around: an org summary, a deploy request, an API result. A record declares an immutable carrier in one line — public record OrgSummary(String alias, String instanceUrl, boolean sandbox) {} — and the compiler generates the constructor, accessors, equals/hashCode, and toString.\n\nRecords communicate intent ("this is data, not behavior") and remove boilerplate bugs (a hand-written equals that missed a field). Pair records for data with classes for behavior-rich domain objects and you have a modern, clean codebase shape.',
            },
          ],
          realWorld: {
            title: 'The connector nobody could unit test',
            scenario:
              'An in-house Salesforce connector kept all configuration in static mutable fields, set once at startup by whichever class loaded first. Tests could not run in parallel (they overwrote each other\'s config), and a memory leak in one batch job changed credentials for every subsequent job in the JVM.',
            solution:
              'Configuration became an immutable record passed into constructors; the connector became an instance with its own state. Statics were reduced to true constants and a stateless factory method.',
            outcome:
              'Tests ran in parallel and in any order, two hidden config-bleed bugs surfaced immediately and were fixed, and startup wiring became explicit instead of load-order magic.',
          },
          keyTakeaways: [
            'Constructors enforce validity — invalid objects should be unconstructible',
            'Encapsulate: private fields, behavior-driven methods, no reflexive setters',
            'static = belongs to the class; avoid static mutable state',
            'Records model immutable data with generated equals/hashCode/toString',
          ],
          resources: [
            {
              title: 'Dev.java: Classes and objects',
              url: 'https://dev.java/learn/classes-objects/',
              source: 'other',
            },
            {
              title: 'Baeldung: Java records',
              url: 'https://www.baeldung.com/java-record-keyword',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-java-fund-1',
          topic: 'Platform',
          prompt: 'What is the correct relationship between JDK, JRE, and JVM?',
          options: [
            'They are three names for the same installer',
            'JDK contains development tools + a runtime; the JVM is the engine that executes bytecode',
            'The JVM compiles source code; the JDK runs it',
            'JRE is only for web browsers',
          ],
          correctIndex: 1,
          explanation:
            'javac (in the JDK) compiles .java to bytecode; the JVM executes bytecode. The runtime (JRE) is JVM + core libraries.',
        },
        {
          id: 'q-java-fund-2',
          topic: 'Platform',
          prompt: 'Why does the same compiled .jar run on macOS, Linux, and Windows?',
          options: [
            'Java recompiles source on every machine',
            'Bytecode targets the JVM, and a JVM exists per operating system',
            'Operating systems now execute Java natively',
            'It does not — separate builds are required per OS',
          ],
          correctIndex: 1,
          explanation:
            '"Write once, run anywhere": the JVM abstracts the OS, so portable bytecode runs wherever a JVM is installed.',
        },
        {
          id: 'q-java-fund-3',
          topic: 'Types',
          prompt: 'What risk does unboxing a wrapper type (Integer → int) carry?',
          options: [
            'Precision loss on all values',
            'A NullPointerException when the wrapper is null',
            'Silent overflow to zero',
            'None — unboxing is always safe',
          ],
          correctIndex: 1,
          explanation:
            'Wrappers can be null (e.g. from a nullable DB column); unboxing null throws NPE at runtime. Check or default first.',
        },
        {
          id: 'q-java-fund-4',
          topic: 'Strings',
          prompt: 'Why is "COMPLETED".equals(status) preferred over status.equals("COMPLETED")?',
          options: [
            'It runs faster',
            'It is null-safe — a null status returns false instead of throwing',
            'It ignores case automatically',
            'The compiler requires constants first',
          ],
          correctIndex: 1,
          explanation:
            'Calling equals on the constant means a null variable cannot raise a NullPointerException — the comparison just returns false.',
        },
        {
          id: 'q-java-fund-5',
          topic: 'Strings',
          prompt: 'What does == compare when used on two String objects?',
          options: ['Character content', 'Object references', 'Lengths', 'Hash codes'],
          correctIndex: 1,
          explanation:
            '== asks "same object?", not "same text?". Content comparison requires equals() — the classic Java interview and production bug.',
        },
        {
          id: 'q-java-fund-6',
          topic: 'Control flow',
          prompt: 'What advantage do modern switch expressions (case X -> ...) have over classic switch statements?',
          options: [
            'They can return a value and never fall through',
            'They run in parallel',
            'They allow duplicate case labels',
            'They skip default handling entirely',
          ],
          correctIndex: 0,
          explanation:
            'Arrow cases are expressions: each case yields a value and there is no accidental fall-through between cases.',
        },
        {
          id: 'q-java-fund-7',
          topic: 'Classes',
          prompt: 'What is the constructor\'s primary responsibility?',
          options: [
            'Logging object creation',
            'Establishing a valid object — required values set, invariants enforced',
            'Registering the object with the JVM',
            'Allocating memory manually',
          ],
          correctIndex: 1,
          explanation:
            'Validate inputs and set required state in the constructor so invalid objects can never exist — callers then trust every instance.',
        },
        {
          id: 'q-java-fund-8',
          topic: 'static',
          prompt: 'Which member should be static?',
          options: [
            'A deployment\'s current status',
            'A shared constant like MAX_RETRIES',
            'The target org of one deployment',
            'A per-request HTTP session',
          ],
          correctIndex: 1,
          explanation:
            'Constants belong to the class, not any instance. Per-object state must remain instance-level; static mutable state is a testing hazard.',
        },
        {
          id: 'q-java-fund-9',
          topic: 'Records',
          prompt: 'What does public record OrgSummary(String alias, String url) {} generate for you?',
          options: [
            'Only a constructor',
            'Constructor, accessors, equals/hashCode, and toString for an immutable carrier',
            'A mutable JavaBean with setters',
            'A database table',
          ],
          correctIndex: 1,
          explanation:
            'Records are concise immutable data carriers with compiler-generated plumbing — ideal for API payload shapes.',
        },
        {
          id: 'q-java-fund-10',
          topic: 'Apex connection',
          prompt: 'Which statement about Java and Apex is accurate?',
          options: [
            'They are unrelated languages',
            'Apex syntax and its class model are deliberately Java-like, but Apex runs multi-tenant with governor limits',
            'Java runs inside Salesforce orgs',
            'Apex compiles to JVM bytecode',
          ],
          correctIndex: 1,
          explanation:
            'Apex was designed after Java, so skills transfer — the differences are the runtime environment and platform services, not core syntax.',
        },
      ],
    },
    {
      id: 'java-oop',
      title: 'Object-Oriented Java',
      summary:
        'Inheritance and polymorphism used well, interfaces as contracts, and the collections framework with generics and streams.',
      lessons: [
        {
          id: 'java-inheritance-polymorphism',
          title: 'Inheritance and polymorphism',
          summary:
            'extends, method overriding, abstract classes, and why composition usually beats deep hierarchies.',
          durationMinutes: 18,
          objectives: [
            'Use extends and @Override correctly',
            'Explain dynamic dispatch with a concrete example',
            'Choose between inheritance and composition deliberately',
          ],
          sections: [
            {
              heading: 'extends and overriding',
              body:
                'A subclass inherits its parent\'s fields and methods and may OVERRIDE behavior: class SandboxOrg extends SalesforceOrg with its own refresh() implementation. Always annotate @Override — the compiler then catches signature typos that would otherwise silently create a NEW method instead of overriding.\n\nsuper calls the parent (super(...) in constructors, super.method() in bodies). Abstract classes sit between interface and concrete class: they define shared logic plus abstract methods children MUST implement — the template-method pattern that batch frameworks (and Apex\'s Database.Batchable pattern) are built on.',
            },
            {
              heading: 'Polymorphism: one call, many behaviors',
              body:
                'Declare variables by the general type and let the runtime dispatch to the actual object\'s override: for (SalesforceOrg org : orgs) { org.refresh(); } runs sandbox logic for sandboxes and scratch-org logic for scratch orgs — no instanceof ladder, no switch on type.\n\nThis is THE mechanism that lets frameworks call your code: a deploy pipeline iterates List<PipelineStep> and each step\'s execute() does something different. New behavior = new subclass; existing pipeline code does not change. That is the open/closed principle in one sentence.',
              code: {
                language: 'java',
                snippet:
                  'public abstract class PipelineStep {\n    public final void run() {                 // template method\n        System.out.println("Starting " + name());\n        execute();\n        System.out.println("Finished " + name());\n    }\n    protected abstract String name();\n    protected abstract void execute();\n}\n\npublic class ValidateStep extends PipelineStep {\n    @Override protected String name() { return "Validate metadata"; }\n    @Override protected void execute() { /* check-only deploy */ }\n}\n\npublic class TestStep extends PipelineStep {\n    @Override protected String name() { return "Run Apex tests"; }\n    @Override protected void execute() { /* run tests, gate on coverage */ }\n}\n\n// The pipeline never changes when new steps are added:\nfor (PipelineStep step : steps) { step.run(); }',
                caption: 'Template method + polymorphism: the pipeline loop is closed; the step list is open.',
              },
            },
            {
              heading: 'Prefer composition; inherit narrowly',
              body:
                'Inheritance is a strong coupling: children depend on parent internals, and deep hierarchies (A extends B extends C extends D) turn every base change into a minefield. Composition — a class HOLDING collaborators and delegating to them — is looser and easier to test: a DeployService that has a MetadataClient and a TestRunner beats one that inherits from AbstractDeployBase.\n\nA practical rule: inherit only for a genuine is-a relationship with stable, framework-like base behavior (as in the template method above); compose for everything else. When in doubt, compose.',
            },
          ],
          realWorld: {
            title: 'The base class everyone feared',
            scenario:
              'An integration codebase had AbstractSyncJob with four levels of subclasses. A one-line change to the base class\'s retry logic altered timing for 23 jobs; two ran head-to-head with a nightly ERP window and corrupted a reconciliation. Nobody could predict blast radius, so nobody touched the base class.',
            solution:
              'The team flattened the hierarchy: retry, logging, and scheduling became injected collaborators (composition), and only the genuine template — "extract, transform, load, in that order" — remained as a two-level abstract class.',
            outcome:
              'Blast radius became visible in each job\'s constructor signature, per-job retry tuning became possible without touching shared code, and base-class change requests stopped requiring a week of regression testing.',
          },
          keyTakeaways: [
            'Always @Override — the compiler catches signature mistakes',
            'Polymorphism removes instanceof ladders: one loop, many behaviors',
            'Template method = shared skeleton in an abstract class, steps in children',
            'Default to composition; reserve inheritance for true, stable is-a',
          ],
          resources: [
            {
              title: 'Dev.java: Inheritance',
              url: 'https://dev.java/learn/inheritance/',
              source: 'other',
            },
            {
              title: 'Effective Java (Bloch) — Item: favor composition',
              url: 'https://www.oreilly.com/library/view/effective-java/9780134686097/',
              source: 'other',
              note: 'The canonical argument, worth owning',
            },
          ],
        },
        {
          id: 'java-interfaces-abstraction',
          title: 'Interfaces and clean contracts',
          summary:
            'Interfaces as capability contracts, functional interfaces with lambdas, and designing for swappable implementations.',
          durationMinutes: 18,
          objectives: [
            'Define and implement interfaces as capability contracts',
            'Use functional interfaces and lambda expressions',
            'Design services so implementations can be swapped in tests',
          ],
          sections: [
            {
              heading: 'An interface is a promise, not a place for logic',
              body:
                'An interface declares WHAT a type can do — interface MetadataClient { DeployResult deploy(DeployRequest request); } — and classes promise to fulfill it with implements. Callers depend on the interface, never the concrete class, so a SalesforceHttpMetadataClient in production and a FakeMetadataClient in tests are interchangeable.\n\nA class can implement many interfaces (unlike single-class inheritance), which models capabilities cleanly: Comparable, AutoCloseable, and your own domain contracts. Default methods let interfaces evolve without breaking implementors, but keep real logic in classes.',
            },
            {
              heading: 'Functional interfaces and lambdas',
              body:
                'An interface with exactly ONE abstract method is functional, and a lambda can implement it inline: Predicate<Org> isSandbox = org -> org.isSandbox(); Runnable poll = () -> checkStatus(jobId). The JDK ships the core set — Predicate (test), Function (transform), Consumer (accept), Supplier (produce) — and the collections/streams world runs on them.\n\nMethod references (Org::alias) are lambdas that name an existing method. If you internalized JavaScript arrow functions in the previous path, lambdas are the same idea with static types: behavior passed as data.',
              code: {
                language: 'java',
                snippet:
                  'public interface NotificationChannel {\n    void send(String recipient, String message);\n}\n\npublic class SlackChannel implements NotificationChannel {\n    @Override public void send(String recipient, String message) {\n        // POST to Slack webhook\n    }\n}\n\npublic class ReleaseNotifier {\n    private final NotificationChannel channel;      // depends on the contract\n    public ReleaseNotifier(NotificationChannel channel) { this.channel = channel; }\n\n    public void releaseCompleted(String version) {\n        channel.send("#releases", "Release " + version + " is live");\n    }\n}\n\n// In tests — no Slack, no network, still fully exercised:\nList<String> sent = new ArrayList<>();\nReleaseNotifier notifier = new ReleaseNotifier((to, msg) -> sent.add(to + ": " + msg));',
                caption: 'Depend on the interface; in tests a lambda IS the implementation.',
              },
            },
            {
              heading: 'Dependency injection without a framework',
              body:
                'Passing collaborators into constructors (as above) is dependency injection — the design idea. Frameworks like Spring automate the wiring at scale, but the testability comes from the SHAPE: classes receive interfaces instead of constructing concrete dependencies internally.\n\nThe litmus test for your design: can you unit-test the class with no network, no database, and no Salesforce org, purely by handing it fakes? If yes, the contracts are in the right places. This is the same instinct as mocking HTTP callouts in Apex tests with HttpCalloutMock — Java just makes the pattern universal.',
            },
          ],
          realWorld: {
            title: 'Tests that needed a live org',
            scenario:
              'A middleware team\'s test suite created real records in a shared Salesforce sandbox. Tests took 40 minutes, failed whenever the sandbox was refreshed or another team\'s data collided, and engineers began skipping tests to merge — twice shipping regressions the suite would have caught.',
            solution:
              'They introduced a SalesforceGateway interface covering the org interactions, injected it into every service, and gave tests an in-memory fake. A thin nightly contract-test suite still hit a real scratch org to verify the gateway itself.',
            outcome:
              'The unit suite dropped from 40 minutes to 90 seconds and became deterministic, merges stopped bypassing tests, and sandbox refreshes stopped breaking CI for three teams.',
          },
          keyTakeaways: [
            'Interfaces define capability; callers should depend on them, not classes',
            'One abstract method = functional interface = lambda-implementable',
            'Constructor injection makes every service testable with fakes',
            'Keep a thin real-integration suite; make the fast suite org-free',
          ],
          resources: [
            {
              title: 'Dev.java: Interfaces',
              url: 'https://dev.java/learn/interfaces/',
              source: 'other',
            },
            {
              title: 'Baeldung: Functional interfaces',
              url: 'https://www.baeldung.com/java-8-functional-interfaces',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-collections-generics',
          title: 'Collections, generics, and streams',
          summary:
            'List/Set/Map chosen correctly, generics that keep you honest, and stream pipelines for transformation-heavy code.',
          durationMinutes: 20,
          objectives: [
            'Choose the right collection (List, Set, Map) and implementation',
            'Read and write generic type signatures',
            'Transform data with stream pipelines: filter, map, collect, groupingBy',
          ],
          sections: [
            {
              heading: 'The big three, and how to choose',
              body:
                'List (ArrayList) keeps insertion order and allows duplicates — your default sequence. Set (HashSet) enforces uniqueness with O(1) membership checks — perfect for "have I seen this Id?". Map (HashMap) indexes values by key — the Java twin of Apex\'s Map<Id, SObject> idiom, and the backbone of "query once, look up in the loop".\n\nVariants tune behavior: LinkedHashMap preserves insertion order (stable report output), TreeMap sorts by key, ArrayDeque handles stack/queue work. Choose by the QUESTION you ask the data — order? uniqueness? lookup by key? — not by habit.',
            },
            {
              heading: 'Generics: the type system working for you',
              body:
                'List<Deployment> tells the compiler (and every reader) exactly what is inside — no casting, no ClassCastException at 2 a.m. Generic methods abstract over element types: <T> Optional<T> firstMatch(List<T> items, Predicate<T> test).\n\nYou will mostly CONSUME generics, so learn to read the signatures: Map<String, List<DeployResult>> is "results grouped by some string key". Wildcards appear at API boundaries (List<? extends Number> accepts any number list); write them only when you design libraries — using them correctly matters more than producing them.',
            },
            {
              heading: 'Streams: SOQL-like pipelines over memory',
              body:
                'Streams chain transformations over collections: filter, map, sorted, then a terminal collect/count/anyMatch. They read like a query plan and eliminate accumulator boilerplate. groupingBy is the star for reporting: one line turns a flat list into Map<String, List<...>> by any key function.\n\nUse streams for transformation-heavy logic; keep simple iterations as enhanced-for (a three-line loop does not need a pipeline). Avoid side effects inside stream operations — a stream that mutates external state is a loop in disguise, minus the readability.',
              code: {
                language: 'java',
                snippet:
                  'record DeployResult(String org, String component, boolean success, int ms) {}\n\nList<DeployResult> results = fetchResults();\n\n// Failed component names, slowest first\nList<String> worstFailures = results.stream()\n        .filter(r -> !r.success())\n        .sorted(Comparator.comparingInt(DeployResult::ms).reversed())\n        .map(DeployResult::component)\n        .toList();\n\n// Results grouped per org — one line, no manual accumulator\nMap<String, List<DeployResult>> byOrg = results.stream()\n        .collect(Collectors.groupingBy(DeployResult::org));\n\n// Average duration of successful deploys\ndouble avgMs = results.stream()\n        .filter(DeployResult::success)\n        .mapToInt(DeployResult::ms)\n        .average()\n        .orElse(0);',
                caption: 'filter → sort → map → collect: transformation code that reads as intent.',
              },
            },
          ],
          realWorld: {
            title: 'The nightly report that took 40 minutes',
            scenario:
              'A deployment-audit report compared each of 20,000 deployed components against a list of 15,000 tracked components using list.contains() inside a nested loop — 300 million comparisons. The nightly job took 40 minutes and regularly overlapped the morning data loads.',
            solution:
              'The inner list became a HashSet (O(1) membership), and the grouping logic became a stream groupingBy. Total change: nine lines.',
            outcome:
              'Runtime fell from 40 minutes to under 4 seconds. The team added "right collection for the question" to design reviews, and two similar O(n²) hotspots were found and fixed the same week.',
          },
          keyTakeaways: [
            'List = order, Set = uniqueness, Map = lookup — choose by the question asked',
            'contains() on a List is O(n); on a HashSet it is O(1)',
            'Generics remove casts and turn wrong types into compile errors',
            'Streams express transformations; groupingBy replaces manual accumulators',
          ],
          resources: [
            {
              title: 'Dev.java: The Collections Framework',
              url: 'https://dev.java/learn/api/collections-framework/',
              source: 'other',
            },
            {
              title: 'Baeldung: Java 8 streams',
              url: 'https://www.baeldung.com/java-8-streams',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-java-oop-1',
          topic: 'Overriding',
          prompt: 'Why should every overriding method carry the @Override annotation?',
          options: [
            'It improves runtime performance',
            'The compiler verifies a parent method is really being overridden, catching signature typos',
            'It is required for the method to be public',
            'It enables garbage collection of the parent method',
          ],
          correctIndex: 1,
          explanation:
            'Without @Override, a typo silently declares a NEW method and the parent behavior keeps running — a nasty hidden bug.',
        },
        {
          id: 'q-java-oop-2',
          topic: 'Polymorphism',
          prompt: 'for (PipelineStep step : steps) { step.run(); } executes different logic per element. What makes this work?',
          options: [
            'Reflection over class names',
            'Dynamic dispatch — the runtime calls each actual object\'s override',
            'The compiler inlines every subclass',
            'instanceof checks generated automatically',
          ],
          correctIndex: 1,
          explanation:
            'The variable is typed by the general class, but the method invoked belongs to the actual object — that is polymorphism.',
        },
        {
          id: 'q-java-oop-3',
          topic: 'Design',
          prompt: 'When is inheritance the right tool (versus composition)?',
          options: [
            'Whenever two classes share any code',
            'For a genuine is-a relationship with a stable, framework-like base (e.g., template method)',
            'Always — composition is legacy style',
            'Only for records',
          ],
          correctIndex: 1,
          explanation:
            'Inheritance couples children to parent internals. Reserve it for true is-a with stable base behavior; compose collaborators otherwise.',
        },
        {
          id: 'q-java-oop-4',
          topic: 'Interfaces',
          prompt: 'What does it mean for a service to "depend on an interface"?',
          options: [
            'It uses reflection to find classes',
            'Its constructor accepts the contract type, so any implementation (real or fake) can be supplied',
            'It can only run inside Spring',
            'It must be abstract itself',
          ],
          correctIndex: 1,
          explanation:
            'Depending on the contract instead of a concrete class is what makes implementations swappable — the key to fast, org-free tests.',
        },
        {
          id: 'q-java-oop-5',
          topic: 'Lambdas',
          prompt: 'Which interface can a lambda expression implement?',
          options: [
            'Any interface',
            'A functional interface — exactly one abstract method',
            'Only java.util.function.Function',
            'Interfaces with default methods only',
          ],
          correctIndex: 1,
          explanation:
            'A lambda provides the single abstract method\'s body. Predicate, Function, Consumer, Supplier, Runnable are the everyday set.',
        },
        {
          id: 'q-java-oop-6',
          topic: 'Collections',
          prompt: 'You need to check "have I already processed this record Id?" millions of times. Which collection?',
          options: ['ArrayList', 'HashSet', 'LinkedList', 'Stack'],
          correctIndex: 1,
          explanation:
            'HashSet gives O(1) contains() and enforces uniqueness. A List\'s contains() scans linearly — the classic accidental O(n²).',
        },
        {
          id: 'q-java-oop-7',
          topic: 'Collections',
          prompt: 'Which Java structure mirrors Apex\'s Map<Id, Account> "query once, look up in loop" idiom?',
          options: ['List<Account>', 'HashMap with the Id as key', 'TreeSet', 'int[]'],
          correctIndex: 1,
          explanation:
            'A HashMap keyed by identifier gives constant-time lookups inside loops — the same bulk-safe pattern in both languages.',
        },
        {
          id: 'q-java-oop-8',
          topic: 'Generics',
          prompt: 'What does Map<String, List<DeployResult>> tell a reader?',
          options: [
            'A map from strings to single results',
            'Results grouped into lists under string keys',
            'An immutable map',
            'A map that only holds successful results',
          ],
          correctIndex: 1,
          explanation:
            'Generic signatures document structure: each string key holds a LIST of results — exactly what groupingBy produces.',
        },
        {
          id: 'q-java-oop-9',
          topic: 'Streams',
          prompt: 'Which stream pipeline returns the names of failed components?',
          options: [
            'results.stream().map(DeployResult::component).filter(r -> !r.success()).toList()',
            'results.stream().filter(r -> !r.success()).map(DeployResult::component).toList()',
            'results.stream().collect(Collectors.counting())',
            'results.stream().anyMatch(r -> !r.success())',
          ],
          correctIndex: 1,
          explanation:
            'Filter while the success flag is still available, then map to the name. Mapping first discards the field you filter on.',
        },
        {
          id: 'q-java-oop-10',
          topic: 'Streams',
          prompt: 'What does Collectors.groupingBy(DeployResult::org) produce?',
          options: [
            'A sorted list of org names',
            'Map<String, List<DeployResult>> — results bucketed per org',
            'A count of distinct orgs',
            'A parallel stream',
          ],
          correctIndex: 1,
          explanation:
            'groupingBy classifies each element by the key function and collects the buckets into lists — one line of reporting power.',
        },
      ],
    },
    {
      id: 'java-practical',
      title: 'Practical Java: Errors, Integration & Tests',
      summary:
        'Exceptions handled like a professional, HTTP + JSON against the Salesforce REST API, and Maven + JUnit for builds you can trust.',
      lessons: [
        {
          id: 'java-exceptions',
          title: 'Exceptions and robust error handling',
          summary:
            'Checked vs unchecked, try-with-resources, exception translation, and error-handling patterns for integration code.',
          durationMinutes: 18,
          objectives: [
            'Differentiate checked and unchecked exceptions and when to use each',
            'Manage resources with try-with-resources',
            'Design exception handling for an integration boundary',
          ],
          sections: [
            {
              heading: 'The exception model',
              body:
                'Java separates unchecked exceptions (RuntimeException subclasses — programming errors like NullPointerException, IllegalArgumentException) from CHECKED exceptions (like IOException) that the compiler forces you to handle or declare with throws. Checked exceptions mark failures a correct program must still expect: networks drop, files vanish, APIs rate-limit.\n\nModern practice keeps checked exceptions at I/O boundaries and translates them into meaningful domain exceptions as they cross into your logic — callers should reason about "SalesforceUnavailableException", not "some IOException from somewhere".',
            },
            {
              heading: 'try/catch/finally and try-with-resources',
              body:
                'catch specific types first and act meaningfully: retry, translate, or enrich and rethrow. Catching Exception and logging-then-continuing is how corrupted state spreads — if you cannot act on it, let it propagate to a boundary that can.\n\nAnything holding a resource (HTTP client, file, DB connection) implements AutoCloseable; try-with-resources closes it automatically even when exceptions fly: try (var client = HttpClient.newHttpClient()) { ... }. Leaked connections from missed finally blocks were a defining production failure of pre-Java-7 codebases — the pattern exists because the pain was real.',
              code: {
                language: 'java',
                snippet:
                  'public List<String> readDeployManifest(Path file) {\n    try (BufferedReader reader = Files.newBufferedReader(file)) {   // auto-closed\n        return reader.lines()\n                .map(String::trim)\n                .filter(line -> !line.isEmpty() && !line.startsWith("#"))\n                .toList();\n    } catch (NoSuchFileException e) {\n        throw new ManifestException("Manifest not found: " + file, e);   // translate\n    } catch (IOException e) {\n        throw new ManifestException("Could not read manifest " + file, e);\n    }\n}',
                caption: 'Try-with-resources plus exception translation — the caller sees domain language, and the cause chain survives.',
              },
            },
            {
              heading: 'Error handling at integration boundaries',
              body:
                'Integration code plans for four outcomes on every call: success, RETRYABLE failure (timeout, 429, 503 — retry with exponential backoff and a cap), NON-retryable failure (400 validation, 401 auth — fix the input or credentials, never blind-retry), and the poison-message case (one bad record must not stop the batch — quarantine it and continue).\n\nAlways preserve the cause chain (new DomainException(msg, cause)) so the original stack trace survives, and log at the boundary with enough context to act: org, record id, attempt number. "Error: null" in a log is an unforced error.',
            },
          ],
          realWorld: {
            title: 'The catch block that swallowed a week of orders',
            scenario:
              'An order-sync service wrapped its whole loop in try { ... } catch (Exception e) { log.warn("sync issue"); }. When Salesforce credentials expired, every call threw, every exception was swallowed with a context-free warning, and the service reported "0 errors" for six days while syncing nothing.',
            solution:
              'Auth failures became fatal (fail fast, page the on-call), retryable failures got backoff with a retry budget, per-record failures went to a quarantine table with payloads, and a heartbeat metric ("records synced per hour") backed an alert independent of logs.',
            outcome:
              'The next credential expiry paged within four minutes instead of six days. The quarantine table turned "mystery data drift" into a reviewable queue, and the postmortem\'s "no silent catch-alls" rule went into the lint config.',
          },
          keyTakeaways: [
            'Checked exceptions mark expectable I/O failures; translate them at boundaries',
            'try-with-resources makes leaks structurally impossible',
            'Classify failures: retry with backoff vs fail fast vs quarantine',
            'Never log-and-continue on exceptions you cannot act on',
          ],
          resources: [
            {
              title: 'Dev.java: Exceptions',
              url: 'https://dev.java/learn/exceptions/',
              source: 'other',
            },
            {
              title: 'Baeldung: try-with-resources',
              url: 'https://www.baeldung.com/java-try-with-resources',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-http-json',
          title: 'HTTP + JSON: calling the Salesforce API from Java',
          summary:
            'java.net.http.HttpClient, JSON with Jackson, OAuth client-credentials, and a resilient Salesforce query client.',
          durationMinutes: 20,
          objectives: [
            'Send requests with java.net.http.HttpClient including timeouts',
            'Map JSON to Java types with Jackson',
            'Authenticate to Salesforce with OAuth and query the REST API',
          ],
          sections: [
            {
              heading: 'The built-in HttpClient',
              body:
                'Since Java 11 the JDK ships a real HTTP client: build one HttpClient (reuse it — it pools connections), then per call build an HttpRequest with URI, method, headers, timeout, and body, and send() it for an HttpResponse. Like JavaScript\'s fetch, HTTP error statuses are NOT exceptions — check statusCode() yourself. Unlike fetch, you set connectTimeout and request timeout explicitly, and you should: a client without timeouts hangs threads.\n\nsendAsync() returns CompletableFuture for concurrency — the JVM cousin of promises. For most integration jobs, synchronous send() on a worker thread is simpler and fine.',
            },
            {
              heading: 'JSON with Jackson',
              body:
                'Jackson\'s ObjectMapper converts JSON text to typed Java objects and back: mapper.readValue(json, QueryResponse.class). Records make perfect targets. Two configuration decisions matter in Salesforce work: ignore unknown fields (FAIL_ON_UNKNOWN_PROPERTIES=false) because API responses evolve, and map Salesforce\'s field names explicitly with @JsonProperty when they differ from your Java naming.\n\nDefine response types for the fields you USE, not the entire payload — a five-field record is easier to maintain than a hundred-field mirror of the API.',
              code: {
                language: 'java',
                snippet:
                  'record QueryResponse<T>(int totalSize, boolean done, List<T> records) {}\nrecord AccountRow(@JsonProperty("Id") String id,\n                  @JsonProperty("Name") String name) {}\n\npublic class SalesforceClient {\n    private final HttpClient http = HttpClient.newBuilder()\n            .connectTimeout(Duration.ofSeconds(10)).build();\n    private final ObjectMapper mapper = new ObjectMapper()\n            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);\n    private final String instanceUrl;\n    private final String accessToken;\n\n    public SalesforceClient(String instanceUrl, String accessToken) {\n        this.instanceUrl = instanceUrl;\n        this.accessToken = accessToken;\n    }\n\n    public List<AccountRow> queryAccounts(String soql) throws IOException, InterruptedException {\n        HttpRequest request = HttpRequest.newBuilder()\n                .uri(URI.create(instanceUrl + "/services/data/v62.0/query?q="\n                        + URLEncoder.encode(soql, StandardCharsets.UTF_8)))\n                .header("Authorization", "Bearer " + accessToken)\n                .timeout(Duration.ofSeconds(30))\n                .GET().build();\n\n        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());\n        if (response.statusCode() == 401) throw new SalesforceAuthException("Token expired");\n        if (response.statusCode() >= 300) {\n            throw new SalesforceApiException("Query failed: HTTP " + response.statusCode()\n                    + " " + response.body());\n        }\n        QueryResponse<AccountRow> parsed = mapper.readValue(response.body(),\n                new TypeReference<QueryResponse<AccountRow>>() {});\n        return parsed.records();\n    }\n}',
                caption: 'A typed Salesforce query client: timeouts, status handling, and records as JSON targets.',
              },
            },
            {
              heading: 'OAuth and operational hygiene',
              body:
                'Server-to-server integrations authenticate with the OAuth client-credentials flow (or JWT bearer): POST to /services/oauth2/token, receive an access_token and instance_url, attach the token as a Bearer header, and refresh on 401 — never store or hardcode passwords. Secrets belong in a vault or environment configuration, exactly like Named Credentials keep them out of Apex.\n\nOperational hygiene for anything scheduled: respect rate limits (handle 429 with backoff), page through large query results by following nextRecordsUrl, batch writes through the composite APIs, and emit a per-run summary (fetched / written / failed) so success is measurable rather than assumed.',
            },
          ],
          realWorld: {
            title: 'The 2 a.m. sync with no timeout',
            scenario:
              'A Java sync service called Salesforce without request timeouts. During a Salesforce maintenance window, connections hung indefinitely; the fixed thread pool drained within minutes, and by morning every downstream feed was hours stale while the JVM looked "up" to monitoring.',
            solution:
              'Every request received connect and request timeouts, hung-call detection was added around the pool, 401s triggered one token refresh then failed fast, and 429/5xx got capped exponential backoff with a per-run retry budget.',
            outcome:
              'The next maintenance window produced clean timeout errors, automatic recovery within one polling cycle, and zero human involvement — the incident report shrank from three pages to one paragraph.',
          },
          keyTakeaways: [
            'Reuse one HttpClient; set connect AND request timeouts always',
            'HTTP error statuses are not exceptions — check statusCode()',
            'Map only the JSON fields you use; tolerate unknown properties',
            'OAuth tokens from a vault; refresh on 401; back off on 429',
          ],
          resources: [
            {
              title: 'Java HttpClient guide (Baeldung)',
              url: 'https://www.baeldung.com/java-9-http-client',
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
          id: 'java-build-test',
          title: 'Building and testing: Maven and JUnit',
          summary:
            'The Maven lifecycle and dependency management, JUnit 5 tests that document behavior, and mocking with Mockito.',
          durationMinutes: 18,
          objectives: [
            'Read a pom.xml and run the Maven build lifecycle',
            'Write JUnit 5 tests with clear arrange-act-assert structure',
            'Isolate collaborators with Mockito mocks',
          ],
          sections: [
            {
              heading: 'Maven: convention over configuration',
              body:
                'Maven defines a standard project layout (src/main/java, src/test/java) and a build LIFECYCLE: mvn compile → test → package → verify → install. Dependencies are declared in pom.xml with coordinates (groupId:artifactId:version) and arrive from Maven Central — no jars in git.\n\nThe practical commands: mvn clean verify runs everything a CI server would; mvn dependency:tree explains where a jar came from when versions clash. Gradle is the main alternative (same ideas, Groovy/Kotlin DSL); read either fluently and CI configs stop being mysterious.',
            },
            {
              heading: 'JUnit 5: tests as executable documentation',
              body:
                'A test class mirrors the class under test; each @Test method asserts ONE behavior with a name that reads as a sentence: retryableFailureIsRetriedThreeTimes(). Arrange-act-assert structure, assertEquals/assertTrue/assertThrows for outcomes, @BeforeEach for shared setup, @ParameterizedTest to run one behavior across many inputs.\n\nIf you write Apex tests, the shape is familiar — minus governor limits and @TestSetup data ceremony. The discipline that transfers both ways: test behavior through the public API, not implementation details, so refactors do not shatter the suite.',
              code: {
                language: 'java',
                snippet:
                  'class RetryPolicyTest {\n    private final RetryPolicy policy = new RetryPolicy(3, Duration.ofMillis(10));\n\n    @Test\n    void succeedsOnSecondAttempt() {\n        AtomicInteger calls = new AtomicInteger();\n        String result = policy.run(() -> {\n            if (calls.incrementAndGet() == 1) throw new RetryableException("blip");\n            return "ok";\n        });\n        assertEquals("ok", result);\n        assertEquals(2, calls.get());\n    }\n\n    @Test\n    void nonRetryableFailureIsNotRetried() {\n        AtomicInteger calls = new AtomicInteger();\n        assertThrows(AuthException.class, () -> policy.run(() -> {\n            calls.incrementAndGet();\n            throw new AuthException("bad token");\n        }));\n        assertEquals(1, calls.get());   // exactly one attempt — no blind retry\n    }\n}',
                caption: 'Behavior-named tests that pin down the retry contract precisely.',
              },
            },
            {
              heading: 'Mockito: isolating the unit',
              body:
                'Mockito fabricates implementations of interfaces so you test ONE class with scripted collaborators: SalesforceGateway gateway = mock(SalesforceGateway.class); when(gateway.query(any())).thenReturn(rows); … verify(gateway, times(1)).query(contains("Account")).\n\nMock at architectural boundaries (HTTP gateways, repositories, clocks) — not every class you own; over-mocked tests assert wiring instead of behavior and break on every refactor. Combined with last lesson\'s constructor injection, this is the complete fast-suite recipe: real logic, fake edges, milliseconds per test.',
            },
          ],
          realWorld: {
            title: 'The build that worked "only on Dev C\'s laptop"',
            scenario:
              'A team\'s integration jar was built by one developer\'s IDE with manually downloaded jars in a lib/ folder. When he went on leave, a hotfix could not be built: nobody else had the same jar versions, and the one attempted build shipped a NoSuchMethodError to production.',
            solution:
              'The project moved to Maven with all dependencies declared in pom.xml, a CI job ran mvn clean verify on every commit, and the deployable artifact became the CI output — laptops stopped being build servers.',
            outcome:
              'Any teammate (and the CI server) could produce an identical, tested artifact from a clean checkout. The next hotfix shipped in 40 minutes, and "works on my machine" left the team vocabulary.',
          },
          keyTakeaways: [
            'mvn clean verify from a clean checkout is the reproducibility bar',
            'Dependencies live in pom.xml, never as loose jars',
            'Name tests as behaviors; assert one thing per test',
            'Mock boundaries (gateways, clocks), not every class',
          ],
          resources: [
            {
              title: 'Maven getting started guide',
              url: 'https://maven.apache.org/guides/getting-started/',
              source: 'other',
            },
            {
              title: 'JUnit 5 user guide',
              url: 'https://junit.org/junit5/docs/current/user-guide/',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-java-prac-1',
          topic: 'Exceptions',
          prompt: 'What distinguishes checked exceptions from unchecked ones?',
          options: [
            'Checked exceptions are faster',
            'The compiler forces checked exceptions to be handled or declared; unchecked (RuntimeException) are not',
            'Unchecked exceptions cannot carry messages',
            'Checked exceptions only occur in tests',
          ],
          correctIndex: 1,
          explanation:
            'Checked exceptions mark expectable failures (I/O, network) the compiler makes you confront; runtime exceptions signal programming errors.',
        },
        {
          id: 'q-java-prac-2',
          topic: 'Resources',
          prompt: 'What does try-with-resources guarantee?',
          options: [
            'The try block never throws',
            'AutoCloseable resources are closed even when exceptions occur',
            'All exceptions are logged automatically',
            'The block retries on failure',
          ],
          correctIndex: 1,
          explanation:
            'Resources declared in try (...) are closed in reverse order on exit — success or exception — making connection leaks structurally impossible.',
        },
        {
          id: 'q-java-prac-3',
          topic: 'Error strategy',
          prompt: 'An API call fails with HTTP 429 (rate limited). What is the correct response?',
          options: [
            'Fail the whole batch immediately',
            'Retry with exponential backoff and a capped retry budget',
            'Ignore and continue with the next call at full speed',
            'Switch to a different user\'s credentials',
          ],
          correctIndex: 1,
          explanation:
            '429 is retryable by definition — back off (e.g. 1s, 2s, 4s…), cap attempts, and respect any Retry-After header.',
        },
        {
          id: 'q-java-prac-4',
          topic: 'Error strategy',
          prompt: 'Why is catch (Exception e) { log.warn("issue"); } dangerous in a sync loop?',
          options: [
            'Logging is expensive',
            'It swallows every failure — including fatal ones like expired credentials — and reports false success',
            'It prevents garbage collection',
            'warn is the wrong log level',
          ],
          correctIndex: 1,
          explanation:
            'Blanket catch-and-continue hides systemic failures. Classify: fail fast on auth/config errors, retry transient ones, quarantine bad records.',
        },
        {
          id: 'q-java-prac-5',
          topic: 'HTTP',
          prompt: 'The JDK HttpClient receives an HTTP 500. What happens?',
          options: [
            'send() throws an IOException',
            'The response returns normally — you must check statusCode() yourself',
            'The client retries automatically',
            'The JVM terminates the connection pool',
          ],
          correctIndex: 1,
          explanation:
            'Like fetch in JavaScript, HTTP-level errors are data, not exceptions. Unchecked status codes become silent failures.',
        },
        {
          id: 'q-java-prac-6',
          topic: 'HTTP',
          prompt: 'Why must every outbound HTTP request set a timeout?',
          options: [
            'To reduce memory usage',
            'A hung connection otherwise blocks its thread indefinitely and can drain the whole pool',
            'Salesforce rejects requests without timeout headers',
            'Timeouts encrypt the connection',
          ],
          correctIndex: 1,
          explanation:
            'Without timeouts, a remote outage turns into YOUR outage: threads wait forever and the service stops doing any work.',
        },
        {
          id: 'q-java-prac-7',
          topic: 'JSON',
          prompt: 'Why configure Jackson to ignore unknown JSON properties for Salesforce responses?',
          options: [
            'It makes parsing faster',
            'Salesforce adds fields over time — strict parsing would break on every API evolution',
            'Unknown properties are always errors',
            'It enables streaming mode',
          ],
          correctIndex: 1,
          explanation:
            'API payloads evolve. Mapping only the fields you use, tolerantly, keeps integrations stable across releases.',
        },
        {
          id: 'q-java-prac-8',
          topic: 'OAuth',
          prompt: 'A stored access token starts returning 401. What should a well-built client do?',
          options: [
            'Retry the same token every second',
            'Request a fresh token via the OAuth flow once, then fail fast if still unauthorized',
            'Fall back to a hardcoded password',
            'Ignore the failures until midnight',
          ],
          correctIndex: 1,
          explanation:
            'Tokens expire by design — refresh and retry once. Persistent 401 after refresh is a configuration problem that must page a human.',
        },
        {
          id: 'q-java-prac-9',
          topic: 'Maven',
          prompt: 'What is the significance of `mvn clean verify` passing on a fresh checkout?',
          options: [
            'The IDE is configured correctly',
            'The build is reproducible: compile, tests, and packaging succeed with only declared dependencies',
            'The artifact is deployed to production',
            'The git history is clean',
          ],
          correctIndex: 1,
          explanation:
            'Clean-checkout builds prove there are no hidden local dependencies — the difference between a project and "works on my machine".',
        },
        {
          id: 'q-java-prac-10',
          topic: 'Testing',
          prompt: 'Where should Mockito mocks be applied?',
          options: [
            'On every class the unit touches',
            'At architectural boundaries — HTTP gateways, repositories, clocks',
            'Only on final classes',
            'On the class under test itself',
          ],
          correctIndex: 1,
          explanation:
            'Mock the edges so real logic is exercised. Over-mocking couples tests to implementation wiring and kills refactoring.',
        },
      ],
    },
  ],
};
