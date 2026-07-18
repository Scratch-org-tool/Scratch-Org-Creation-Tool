import type { CurriculumPath } from './curriculum.types';

/**
 * Path — Java Training (Intermediate).
 * Bridge language skills toward Apex: classes, types, collections,
 * exceptions, OOP, and unit testing with explicit Apex comparisons.
 */
export const javaPath: CurriculumPath = {
  id: 'java-fundamentals',
  title: 'Java Training',
  tagline: 'Java that transfers — classes, collections, and tests on the road to Apex.',
  description:
    'Learn core Java with Salesforce developers in mind. Classes and objects, types, collections, exceptions, OOP design, and unit testing are taught with side-by-side notes on how Apex borrows Java syntax — and where the platform runtime intentionally differs.',
  level: 'intermediate',
  badge: 'Java Foundations',
  estimatedHours: 8,
  skills: [
    'Classes & objects',
    'Types & generics intro',
    'Collections',
    'Exceptions',
    'OOP design',
    'Unit testing',
    'Apex comparison literacy',
  ],
  modules: [
    {
      id: 'java-fundamentals-language',
      title: 'Java Language Essentials',
      summary:
        'Classes, objects, fields, methods, and the type system — the shared vocabulary with Apex.',
      lessons: [
        {
          id: 'java-classes-objects',
          title: 'Classes, objects, and methods',
          summary:
            'Define classes, construct instances, and keep behavior next to the data it owns — the same shape Apex service classes use.',
          durationMinutes: 25,
          objectives: [
            'Declare a class with fields, constructors, and methods',
            'Distinguish class (static) members from instance members',
            'Map Java class structure to typical Apex service/trigger-handler classes',
          ],
          sections: [
            {
              heading: 'A class is a blueprint; an object is an instance',
              body:
                'Java organizes code into classes. Fields hold state; methods define behavior; constructors initialize new instances. Apex uses the same mental model: public class AccountService { ... } looks intentionally familiar to Java developers.',
              code: {
                language: 'java',
                snippet:
                  "public class TrainingSession {\n    private final String name;\n    private int capacity;\n\n    public TrainingSession(String name, int capacity) {\n        this.name = name;\n        this.capacity = capacity;\n    }\n\n    public boolean hasSeat() {\n        return capacity > 0;\n    }\n\n    public void reserveSeat() {\n        if (!hasSeat()) {\n            throw new IllegalStateException(\"No seats left\");\n        }\n        capacity--;\n    }\n}",
                caption: 'Encapsulation: private fields, public behavior.',
              },
            },
            {
              heading: 'static vs instance',
              body:
                'static members belong to the type, not one object. Utility methods are often static. Instance methods use per-object state.\n\nApex likewise uses static methods heavily in service classes because triggers and Flows often call entry points without constructing objects. The trade-off is the same in both languages: too much static state becomes hard to test.',
              code: {
                language: 'java',
                snippet:
                  "public final class Ids {\n    private Ids() {}\n\n    public static boolean isBlank(String id) {\n        return id == null || id.isBlank();\n    }\n}\n\n// Usage\nif (Ids.isBlank(accountId)) {\n    throw new IllegalArgumentException(\"accountId required\");\n}",
                caption: 'Static helpers with a private constructor — utility class pattern.',
              },
            },
            {
              heading: 'Bridge note: what Apex keeps and drops',
              body:
                'Apex keeps classes, constructors, methods, access modifiers (with platform nuances), and static members. Apex does not give you a general-purpose JVM ecosystem — no arbitrary JARs, and execution is bounded by governor limits.\n\nWhen you write Java here, focus on clarity and small classes. Those habits transfer. When you write Apex later, add bulkification and limits on top of the same structure.',
            },
          ],
          realWorld: {
            title: 'Trigger logic turns into a 400-line blob',
            scenario:
              'A team new to Salesforce pasted validation, callouts prep, and field stamping into one trigger. Reviews stalled because nobody could test a single behavior.',
            solution:
              'They extracted an AccountService Java-style class (ported to Apex) with small methods: applySegment, collectIds, stampOwner. The trigger became a three-line dispatcher.',
            outcome:
              'Unit tests targeted service methods directly, and later LWC/Apex callers reused the same service without duplicating rules.',
          },
          keyTakeaways: [
            'Classes bundle state and behavior; objects are instances',
            'static means type-level; use it for utilities and Apex-style entry points',
            'Small methods beat monolith triggers/controllers',
            'Apex syntax feels like Java; the runtime rules are stricter',
          ],
          resources: [
            {
              title: 'Oracle: Classes and Objects',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/classes.html',
              source: 'other',
              note: 'Oracle Java Tutorials',
            },
            {
              title: 'Apex Developer Guide — Classes',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'java-types-generics',
          title: 'Types, nullability habits, and generics intro',
          summary:
            'Primitives vs reference types, wrappers, and generic collections — plus how Apex types compare.',
          durationMinutes: 20,
          objectives: [
            'Contrast primitives and reference types',
            'Use parameterized collections like List<String>',
            'Call out Apex type differences that surprise Java developers',
          ],
          sections: [
            {
              heading: 'Primitives and references',
              body:
                'Java primitives (int, boolean, double, …) are not objects. Each has a wrapper (Integer, Boolean, Double) when you need nullability or collection storage.\n\nApex looks similar (Integer, Boolean, Decimal, String, Id) but does not expose the same primitive/wrapper split in daily code — think in terms of typed variables and null checks.',
              code: {
                language: 'java',
                snippet:
                  "int seatCount = 40;          // primitive — cannot be null\nInteger overflowAt = null;   // wrapper — may be unknown\n\nif (overflowAt != null && seatCount >= overflowAt) {\n    System.out.println(\"At capacity threshold\");\n}",
                caption: 'Use wrappers when absence (null) is a valid state.',
              },
            },
            {
              heading: 'Generics keep collections honest',
              body:
                'List<String> tells the compiler what the list holds. Without generics, you cast and hope. Apex collections are also typed: List<Account>, Map<Id, Account> — same intent, slightly different syntax.',
              code: {
                language: 'java',
                snippet:
                  "import java.util.ArrayList;\nimport java.util.List;\n\nList<String> stageNames = new ArrayList<>();\nstageNames.add(\"Prospecting\");\nstageNames.add(\"Closed Won\");\n\nfor (String stage : stageNames) {\n    System.out.println(stage.toUpperCase());\n}",
                caption: 'Typed List — no casts required in the loop.',
              },
            },
            {
              heading: 'Decimal money and Id strings',
              body:
                'In enterprise Java you might use BigDecimal for money. Apex exposes Decimal and a dedicated Id type. Habit to carry over: never use floating-point binary types for currency math when an exact decimal type exists.',
              code: {
                language: 'java',
                snippet:
                  "import java.math.BigDecimal;\nimport java.math.RoundingMode;\n\nBigDecimal amount = new BigDecimal(\"19.99\");\nBigDecimal tax = amount.multiply(new BigDecimal(\"0.08\"))\n        .setScale(2, RoundingMode.HALF_UP);",
                caption: 'Exact decimal arithmetic — the cousin of Apex Decimal.',
              },
            },
          ],
          realWorld: {
            title: 'Discount math drifts by a cent',
            scenario:
              'A Java integration calculated Opportunity discounts with double, then wrote results to Salesforce. Finance reconciliation failed on penny rounding.',
            solution:
              'The service switched to BigDecimal with an explicit scale/rounding mode aligned with the Apex Decimal logic used in-org.',
            outcome:
              'Quote totals matched between the integration and Salesforce reports within the agreed rounding policy.',
          },
          keyTakeaways: [
            'Primitives cannot be null; wrappers can',
            'Generic collections document and enforce element types',
            'Prefer decimal types for money',
            'Apex types rhyme with Java but omit JVM wrapper subtleties',
          ],
          resources: [
            {
              title: 'Oracle: Generics',
              url: 'https://docs.oracle.com/javase/tutorial/java/generics/index.html',
              source: 'other',
            },
            {
              title: 'Oracle: Numbers and Strings',
              url: 'https://docs.oracle.com/javase/tutorial/java/data/index.html',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-collections',
          title: 'Collections: List, Set, Map',
          summary:
            'Master the three structures you will use constantly in Java and Apex bulk patterns.',
          durationMinutes: 25,
          objectives: [
            'Choose List vs Set vs Map for a given problem',
            'Iterate and transform collections idiomatically',
            'Relate each structure to Apex bulkification patterns',
          ],
          sections: [
            {
              heading: 'Pick the structure by access pattern',
              body:
                'List: ordered, allows duplicates, index access. Set: uniqueness, fast containment checks. Map: key → value lookups.\n\nIn Apex, the winning bulk pattern is almost always Map<Id, sObject> after one query. Learning Map deeply in Java makes that Apex idiom feel natural.',
              code: {
                language: 'java',
                snippet:
                  "import java.util.*;\n\nList<String> orderedIds = new ArrayList<>();\norderedIds.add(\"001A\");\norderedIds.add(\"001B\");\n\nSet<String> uniqueIds = new HashSet<>(orderedIds);\nuniqueIds.add(\"001A\"); // no duplicate stored\n\nMap<String, String> nameById = new HashMap<>();\nnameById.put(\"001A\", \"Acme\");\nString name = nameById.getOrDefault(\"001A\", \"Unknown\");",
                caption: 'List for order, Set for uniqueness, Map for lookup.',
              },
            },
            {
              heading: 'Iterate without fighting the collection',
              body:
                'Prefer enhanced for-loops or stream pipelines for readability. When removing while iterating, use an Iterator (Java) — the same class of bug appears in Apex when modifying a list incorrectly during iteration.',
              code: {
                language: 'java',
                snippet:
                  "Map<String, Integer> openCasesByAccount = Map.of(\n    \"001A\", 2,\n    \"001B\", 5\n);\n\nList<String> hotAccounts = openCasesByAccount.entrySet().stream()\n    .filter(e -> e.getValue() >= 5)\n    .map(Map.Entry::getKey)\n    .toList();\n\n// Classic loop equivalent\nList<String> hotAccountsLoop = new ArrayList<>();\nfor (Map.Entry<String, Integer> e : openCasesByAccount.entrySet()) {\n    if (e.getValue() >= 5) {\n        hotAccountsLoop.add(e.getKey());\n    }\n}",
                caption: 'Filter a Map into a List of keys — stream or loop.',
              },
            },
            {
              heading: 'Bridge note: Apex collections',
              body:
                'Apex: List<T>, Set<T>, Map<K,V> with SOQL integration — new Map<Id, Account>([SELECT Id, Name FROM Account WHERE Id IN :ids]). Java Maps do not query databases by themselves; you populate them after JDBC/API calls.\n\nCarry the habit, not the SOQL: collect keys → fetch once → put in Map → loop with get.',
            },
          ],
          realWorld: {
            title: 'Integration loops the API once per Account',
            scenario:
              'A Java middleware job called Salesforce REST once per Account to fetch contacts. The job hit API limits at 8 a.m. every Monday.',
            solution:
              'The job collected Account Ids into a Set, queried contacts in chunks, and built Map<String, List<ContactDto>> in memory before processing.',
            outcome:
              'API calls dropped by an order of magnitude — the same bulk mindset Apex developers learn for SOQL.',
          },
          keyTakeaways: [
            'List/Set/Map solve different access problems',
            'Maps are the backbone of bulk-friendly processing',
            'Filter/map pipelines express transforms clearly',
            'Apex adds SOQL-powered Map construction on top of the same ideas',
          ],
          resources: [
            {
              title: 'Oracle: Collections Framework',
              url: 'https://docs.oracle.com/javase/tutorial/collections/index.html',
              source: 'other',
            },
            {
              title: 'Apex Collections (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_basics_and_database',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-java-lang-1',
          topic: 'Classes',
          prompt: 'In Java, what does a constructor do?',
          options: [
            'Deletes the class from memory permanently',
            'Initializes a new instance of the class',
            'Converts Java to Apex automatically',
            'Registers a Salesforce trigger',
          ],
          correctIndex: 1,
          explanation: 'Constructors run when you create a new object with new.',
        },
        {
          id: 'q-java-lang-2',
          topic: 'static',
          prompt: 'A static method belongs to:',
          options: [
            'A single instance only',
            'The class/type itself',
            'The garbage collector',
            'The Salesforce release',
          ],
          correctIndex: 1,
          explanation: 'static members are type-level, not per-instance.',
        },
        {
          id: 'q-java-lang-3',
          topic: 'Encapsulation',
          prompt: 'Why make fields private and expose methods?',
          options: [
            'Java requires all fields to be private always',
            'To control how state changes and preserve invariants',
            'Private fields sync to Salesforce automatically',
            'It disables unit testing',
          ],
          correctIndex: 1,
          explanation: 'Encapsulation protects invariants behind validated behavior.',
        },
        {
          id: 'q-java-lang-4',
          topic: 'Types',
          prompt: 'Which can hold null?',
          options: ['int', 'boolean primitive', 'Integer', 'char'],
          correctIndex: 2,
          explanation: 'Wrapper types are references and may be null; primitives cannot.',
        },
        {
          id: 'q-java-lang-5',
          topic: 'Generics',
          prompt: 'What does List<String> communicate?',
          options: [
            'The list stores only strings (compile-time checked)',
            'The list is stored in Salesforce',
            'The list cannot grow',
            'The list is synchronized globally',
          ],
          correctIndex: 0,
          explanation: 'Generics parameterize the element type for safety and clarity.',
        },
        {
          id: 'q-java-lang-6',
          topic: 'Money',
          prompt: 'Why prefer BigDecimal over double for currency?',
          options: [
            'BigDecimal is always faster',
            'Binary floating point can introduce rounding errors',
            'double cannot store numbers',
            'BigDecimal is required by the JVM license',
          ],
          correctIndex: 1,
          explanation: 'Decimal types avoid binary floating-point representation issues for money.',
        },
        {
          id: 'q-java-lang-7',
          topic: 'Collections',
          prompt: 'Which structure enforces uniqueness of elements?',
          options: ['List', 'Set', 'array only', 'BigDecimal'],
          correctIndex: 1,
          explanation: 'Sets store unique elements; lists allow duplicates.',
        },
        {
          id: 'q-java-lang-8',
          topic: 'Collections',
          prompt: 'Which structure is best for Id → record lookups?',
          options: ['List only', 'Set only', 'Map', 'char[]'],
          correctIndex: 2,
          explanation: 'Maps provide keyed lookup — central to bulk patterns in Java and Apex.',
        },
        {
          id: 'q-java-lang-9',
          topic: 'Apex bridge',
          prompt: 'Which habit transfers most directly from Java Maps to Apex?',
          options: [
            'Query inside every loop',
            'Collect Ids, query once, put results in a Map, then loop',
            'Store all data in static UI colors',
            'Avoid typed collections',
          ],
          correctIndex: 1,
          explanation: 'Bulkification uses Maps after a single query — same instinct in both languages.',
        },
        {
          id: 'q-java-lang-10',
          topic: 'Apex bridge',
          prompt: 'What is a key difference between typical Java services and Apex?',
          options: [
            'Apex has no classes',
            'Apex execution is constrained by governor limits in a multi-tenant runtime',
            'Java cannot use maps',
            'Apex forbids methods',
          ],
          correctIndex: 1,
          explanation: 'Apex looks like Java but runs under platform governor limits.',
        },
      ],
    },
    {
      id: 'java-fundamentals-oop-errors',
      title: 'OOP Design & Exceptions',
      summary:
        'Interfaces, inheritance, composition, and disciplined error handling — patterns Apex developers still need.',
      lessons: [
        {
          id: 'java-oop',
          title: 'OOP: interfaces, inheritance, and composition',
          summary:
            'Model behavior contracts with interfaces and prefer composition when inheritance gets brittle.',
          durationMinutes: 25,
          objectives: [
            'Define an interface and implement it in a class',
            'Use inheritance carefully for shared behavior',
            'Prefer composition for flexible design — in Java and Apex',
          ],
          sections: [
            {
              heading: 'Interfaces define capabilities',
              body:
                'An interface says what something can do, not how. Callers depend on the interface, so you can swap implementations (in-memory fake vs HTTP client) in tests.',
              code: {
                language: 'java',
                snippet:
                  "public interface CaseNotifier {\n    void notifyOwner(String caseId, String message);\n}\n\npublic class EmailCaseNotifier implements CaseNotifier {\n    @Override\n    public void notifyOwner(String caseId, String message) {\n        // send email\n    }\n}\n\npublic class LoggingCaseNotifier implements CaseNotifier {\n    @Override\n    public void notifyOwner(String caseId, String message) {\n        System.out.println(caseId + \": \" + message);\n    }\n}",
                caption: 'Same contract, different implementations for prod vs tests.',
              },
            },
            {
              heading: 'Inheritance vs composition',
              body:
                'Inheritance (extends) shares implementation but couples hierarchies. Composition holds a collaborator and delegates. Apex supports interfaces and virtual/abstract classes with limits — composition with service classes is still the practical default for business logic.',
              code: {
                language: 'java',
                snippet:
                  "public class CaseService {\n    private final CaseNotifier notifier;\n\n    public CaseService(CaseNotifier notifier) {\n        this.notifier = notifier;\n    }\n\n    public void escalate(String caseId) {\n        // domain logic...\n        notifier.notifyOwner(caseId, \"Escalated\");\n    }\n}",
                caption: 'Dependency injection via constructor — easy to test.',
              },
            },
            {
              heading: 'Bridge note: Apex OOP features',
              body:
                'Apex has interfaces, virtual/override, and abstract classes, but no full Java reflection ecosystem and tighter governor constraints. Designing small services with clear collaborators still pays off when you port ideas into Apex handlers and factories.',
            },
          ],
          realWorld: {
            title: 'Cannot unit test a class that emails users',
            scenario:
              'A Java job emailed case owners directly from deep domain methods. Tests either sent real email or skipped the class entirely.',
            solution:
              'The team introduced a CaseNotifier interface and injected a no-op/logging implementation in tests.',
            outcome:
              'Domain tests ran offline in milliseconds, and production still used the email implementation.',
          },
          keyTakeaways: [
            'Interfaces define contracts for swappable behavior',
            'Composition + injection beats deep inheritance for most business logic',
            'Test doubles implement the same interfaces as production collaborators',
            'Apex OOP is smaller than Java but rewards the same design instincts',
          ],
          resources: [
            {
              title: 'Oracle: Interfaces and Inheritance',
              url: 'https://docs.oracle.com/javase/tutorial/java/IandI/index.html',
              source: 'other',
            },
            {
              title: 'Apex — Interfaces',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_interfaces.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'java-exceptions',
          title: 'Exceptions and error strategy',
          summary:
            'Checked vs unchecked exceptions, meaningful messages, and how Apex exception handling compares.',
          durationMinutes: 20,
          objectives: [
            'Use try/catch/finally and throw appropriately',
            'Explain checked vs unchecked exceptions in Java',
            'Contrast with Apex exception patterns used in services',
          ],
          sections: [
            {
              heading: 'Fail clearly, catch narrowly',
              body:
                'Throw when your method cannot honor its contract. Catch when you can recover or translate the error for a caller. Empty catch blocks hide defects — in Java and in Apex.',
              code: {
                language: 'java',
                snippet:
                  "public int parseCapacity(String raw) {\n    try {\n        int value = Integer.parseInt(raw);\n        if (value < 0) {\n            throw new IllegalArgumentException(\"capacity must be >= 0\");\n        }\n        return value;\n    } catch (NumberFormatException ex) {\n        throw new IllegalArgumentException(\"capacity must be a number: \" + raw, ex);\n    }\n}",
                caption: 'Translate low-level failures into domain-meaningful errors.',
              },
            },
            {
              heading: 'Checked vs unchecked',
              body:
                'Java checked exceptions (extends Exception but not RuntimeException) must be declared or handled. Unchecked (RuntimeException) need not. Modern APIs often prefer unchecked for avoidable programming errors.\n\nApex does not use Java-style checked exceptions — you catch Exception (or more specific types) when needed, and unhandled exceptions roll back the transaction.',
              code: {
                language: 'java',
                snippet:
                  "public interface AccountClient {\n    AccountDto fetch(String id); // prefer unchecked for most failures\n}\n\npublic class SalesforceAccountClient implements AccountClient {\n    @Override\n    public AccountDto fetch(String id) {\n        try {\n            return httpGet(id);\n        } catch (InterruptedException ex) {\n            Thread.currentThread().interrupt();\n            throw new IllegalStateException(\"Interrupted fetching \" + id, ex);\n        }\n    }\n}",
                caption: 'Wrap and rethrow with context; restore interrupt status.',
              },
            },
            {
              heading: 'Bridge note: Apex transactions',
              body:
                'In Apex, an unhandled exception aborts the execution context and rolls back DML from that context (with some async nuances). That makes “catch everything and ignore” especially dangerous — the database may look fine while business rules silently failed.\n\nPrefer catching at boundaries (REST, LWC-callable Apex) to return clean errors, not in the core domain where you cannot recover.',
            },
          ],
          realWorld: {
            title: 'Sync job reports success while records never update',
            scenario:
              'A Java sync caught Exception around the Salesforce update call, logged “error”, and still returned HTTP 200 to the scheduler.',
            solution:
              'The catch translated failures into a job result object with failed Ids, returned non-success to the scheduler, and alerted on non-zero failures.',
            outcome:
              'Operations saw failures the same morning instead of days later during reconciliation.',
          },
          keyTakeaways: [
            'Catch to recover or translate — not to silence',
            'Include context in exception messages',
            'Java checked exceptions are a language feature Apex does not mirror',
            'Unhandled Apex exceptions roll back work — do not swallow them casually',
          ],
          resources: [
            {
              title: 'Oracle: Exceptions',
              url: 'https://docs.oracle.com/javase/tutorial/essential/exceptions/index.html',
              source: 'other',
            },
            {
              title: 'Apex Exception Handling',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_exception_handling.htm',
              source: 'developer',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-java-oop-1',
          topic: 'Interfaces',
          prompt: 'What is the main design benefit of coding to an interface?',
          options: [
            'Interfaces make code slower automatically',
            'Callers can depend on a contract and swap implementations',
            'Interfaces replace unit tests',
            'Interfaces deploy to Salesforce sandboxes',
          ],
          correctIndex: 1,
          explanation: 'Interfaces enable polymorphism and easier testing with alternate implementations.',
        },
        {
          id: 'q-java-oop-2',
          topic: 'Composition',
          prompt: 'Constructor injection of a collaborator is an example of:',
          options: [
            'Composition / dependency injection',
            'Multiple inheritance of state',
            'SOQL aggregation',
            'Checked exception erasure',
          ],
          correctIndex: 0,
          explanation: 'The class holds a collaborator and delegates — composition with injection.',
        },
        {
          id: 'q-java-oop-3',
          topic: 'Inheritance',
          prompt: 'A risk of deep inheritance hierarchies is:',
          options: [
            'They are illegal in Java',
            'Tight coupling and fragile overrides',
            'They disable garbage collection',
            'They force Apex triggers',
          ],
          correctIndex: 1,
          explanation: 'Deep hierarchies couple types and make changes hazardous.',
        },
        {
          id: 'q-java-oop-4',
          topic: 'Exceptions',
          prompt: 'What is wrong with an empty catch block?',
          options: [
            'It is a syntax error in all Java versions',
            'It swallows failures and hides defects',
            'It speeds up tests too much',
            'It converts code to Apex',
          ],
          correctIndex: 1,
          explanation: 'Empty catches silence errors that callers and operators need to see.',
        },
        {
          id: 'q-java-oop-5',
          topic: 'Exceptions',
          prompt: 'IllegalArgumentException is typically used when:',
          options: [
            'The JVM is out of memory',
            'A caller passed an invalid argument',
            'A SOQL query returns zero rows',
            'A deployment fails validation',
          ],
          correctIndex: 1,
          explanation: 'It signals illegal arguments from the caller.',
        },
        {
          id: 'q-java-oop-6',
          topic: 'Checked exceptions',
          prompt: 'Java checked exceptions must be:',
          options: [
            'Ignored silently forever',
            'Declared in the method signature or handled',
            'Stored in a List only',
            'Converted to CSS',
          ],
          correctIndex: 1,
          explanation: 'Checked exceptions are part of the method contract unless caught.',
        },
        {
          id: 'q-java-oop-7',
          topic: 'Apex bridge',
          prompt: 'In Apex, an unhandled exception in a trigger context typically:',
          options: [
            'Commits partial DML and continues quietly',
            'Rolls back the transaction work for that execution context',
            'Emails Salesforce support automatically',
            'Converts the trigger to a Flow',
          ],
          correctIndex: 1,
          explanation: 'Unhandled exceptions abort and roll back the execution context’s DML.',
        },
        {
          id: 'q-java-oop-8',
          topic: 'Design',
          prompt: 'Why inject a LoggingCaseNotifier in tests?',
          options: [
            'To send more real emails',
            'To exercise domain logic without external side effects',
            'To bypass the compiler',
            'To create scratch orgs',
          ],
          correctIndex: 1,
          explanation: 'Test doubles replace external side effects while preserving the contract.',
        },
        {
          id: 'q-java-oop-9',
          topic: 'Exceptions',
          prompt: 'When catching NumberFormatException and throwing IllegalArgumentException, you should usually:',
          options: [
            'Drop the original exception',
            'Pass the original exception as the cause',
            'Catch Throwable and ignore it',
            'Return null with no log',
          ],
          correctIndex: 1,
          explanation: 'Chaining the cause preserves the stack for debugging.',
        },
        {
          id: 'q-java-oop-10',
          topic: 'OOP',
          prompt: 'Which statement best matches a practical Apex/Java design habit?',
          options: [
            'Put all logic in one static method with 50 parameters',
            'Keep services small and depend on clear collaborator contracts',
            'Never write interfaces',
            'Catch Exception everywhere and return null',
          ],
          correctIndex: 1,
          explanation: 'Small services with clear dependencies stay testable in both languages.',
        },
      ],
    },
    {
      id: 'java-fundamentals-testing',
      title: 'Unit Testing Discipline',
      summary:
        'JUnit-style tests, assertions, and the coverage mindset you will need again in Apex.',
      lessons: [
        {
          id: 'java-unit-testing',
          title: 'Unit tests with clear arrange-act-assert',
          summary:
            'Write fast, deterministic tests that document behavior — the same discipline Apex @isTest methods demand.',
          durationMinutes: 25,
          objectives: [
            'Structure tests with arrange-act-assert',
            'Assert on behavior and edge cases, not only happy paths',
            'Compare Java testing habits with Apex Test.startTest/stopTest patterns',
          ],
          sections: [
            {
              heading: 'Tests are executable specifications',
              body:
                'A good unit test names a behavior, sets up minimal state, exercises one action, and asserts outcomes. If a test needs a database, network, or Salesforce org, it is an integration test — still valuable, but slower and broader.',
              code: {
                language: 'java',
                snippet:
                  "import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\n\nclass TrainingSessionTest {\n    @Test\n    void reserveSeat_decrementsCapacity() {\n        TrainingSession session = new TrainingSession(\"Onboarding\", 2);\n\n        session.reserveSeat();\n\n        assertTrue(session.hasSeat());\n        session.reserveSeat();\n        assertFalse(session.hasSeat());\n    }\n\n    @Test\n    void reserveSeat_whenEmpty_throws() {\n        TrainingSession session = new TrainingSession(\"Onboarding\", 0);\n        assertThrows(IllegalStateException.class, session::reserveSeat);\n    }\n}",
                caption: 'Happy path + edge case — both required.',
              },
            },
            {
              heading: 'Fakes beat brittle end-to-end for unit scope',
              body:
                'Inject fakes for notifiers, clocks, and HTTP clients. Assert that CaseService.escalate calls notifier.notifyOwner — without sending mail.\n\nIn Apex, you similarly isolate logic in services and use test data factories; callouts require HTTP mocks. The instinct is identical: unit tests should not depend on flaky externals.',
              code: {
                language: 'java',
                snippet:
                  "class RecordingNotifier implements CaseNotifier {\n    String lastCaseId;\n    String lastMessage;\n\n    public void notifyOwner(String caseId, String message) {\n        lastCaseId = caseId;\n        lastMessage = message;\n    }\n}\n\n@Test\nvoid escalate_notifiesOwner() {\n    RecordingNotifier notifier = new RecordingNotifier();\n    CaseService service = new CaseService(notifier);\n\n    service.escalate(\"500xx000001\");\n\n    assertEquals(\"500xx000001\", notifier.lastCaseId);\n    assertEquals(\"Escalated\", notifier.lastMessage);\n}",
                caption: 'Recording fake captures collaborator calls.',
              },
            },
            {
              heading: 'Bridge note: Apex testing differences',
              body:
                'Apex requires test classes annotated with @isTest and enforces coverage gates for deployment. Test.startTest()/Test.stopTest() reset governor limits and run async work. You must insert test data in the test (or use @TestSetup); you cannot see most org data.\n\nBring from Java: descriptive test names, assert edge cases, and keep domain logic off the trigger/UI edge so it is testable.',
            },
          ],
          realWorld: {
            title: 'Deployment blocked at 68% Apex coverage',
            scenario:
              'A team wrote Java-quality domain logic in Apex but only tested the happy path through a UI click path in a sandbox. Production deployment failed the coverage gate.',
            solution:
              'They added @isTest methods directly against service classes — including null inputs and empty lists — the same cases they already tested in their Java port of the algorithm.',
            outcome:
              'Coverage cleared the gate, and a previously missed empty-list bug was caught before release.',
          },
          keyTakeaways: [
            'Arrange-act-assert keeps tests readable',
            'Edge cases are part of the spec, not optional',
            'Fakes isolate unit tests from email/HTTP/DB',
            'Apex adds coverage gates and test-data isolation on top of the same discipline',
          ],
          resources: [
            {
              title: 'JUnit 5 User Guide',
              url: 'https://junit.org/junit5/docs/current/user-guide/',
              source: 'other',
            },
            {
              title: 'Apex Testing (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_testing',
              source: 'trailhead',
            },
          ],
        },
        {
          id: 'java-testing-quality',
          title: 'Assertions, coverage, and regression habits',
          summary:
            'Write assertions that fail loudly, avoid over-mocking, and use tests as a regression net before refactors.',
          durationMinutes: 20,
          objectives: [
            'Choose precise assertions over generic truthiness checks',
            'Explain what coverage measures — and what it does not',
            'Use tests as a safety net when refactoring toward Apex-ready designs',
          ],
          sections: [
            {
              heading: 'Assert on meaningful outcomes',
              body:
                'assertTrue(list.size() > 0) is weaker than assertEquals(1, list.size()) and assertEquals("Acme", list.get(0).name()). Strong assertions document expected behavior for the next reader.',
              code: {
                language: 'java',
                snippet:
                  "assertAll(\n    () -> assertEquals(1, results.size()),\n    () -> assertEquals(\"001A\", results.get(0).id()),\n    () -> assertEquals(\"Acme\", results.get(0).name())\n);",
                caption: 'assertAll reports multiple failures in one run.',
              },
            },
            {
              heading: 'Coverage is necessary, not sufficient',
              body:
                'Coverage shows which lines ran, not whether they were asserted. A test can execute a branch and still miss the bug if it never checks the result.\n\nSalesforce deployment coverage gates exist to prevent untested Apex from shipping — treat them as a floor. Aim for meaningful assertions on critical paths, especially bulk empty/non-empty inputs.',
            },
            {
              heading: 'Regression net before you refactor',
              body:
                'When extracting a Java algorithm you plan to reimplement in Apex, lock behavior with tests first. Port the tests’ examples into Apex asserts afterward.\n\nShared examples (input list → output map) become a living contract between the two runtimes.',
              code: {
                language: 'java',
                snippet:
                  "@Test\nvoid indexById_skipsNulls() {\n    List<AccountDto> input = List.of(\n        new AccountDto(\"001A\", \"Acme\"),\n        new AccountDto(null, \"Ignore\")\n    );\n\n    Map<String, AccountDto> indexed = AccountIndexer.indexById(input);\n\n    assertEquals(1, indexed.size());\n    assertTrue(indexed.containsKey(\"001A\"));\n}",
                caption: 'A concrete example you can re-assert in Apex later.',
              },
            },
          ],
          realWorld: {
            title: 'Refactor changes discount tiers silently',
            scenario:
              'A developer cleaned up a pricing method. Coverage stayed high because tests only called the method without checking returned amounts.',
            solution:
              'The team rewrote tests with table-driven examples for each tier boundary and failed the build when amounts drifted.',
            outcome:
              'The next refactor was fearless — tests caught a boundary off-by-one before customers did.',
          },
          keyTakeaways: [
            'Precise assertions encode the real specification',
            'Coverage without asserts is a vanity metric',
            'Table-style examples make boundary bugs obvious',
            'Porting Java → Apex is safer when examples are locked in tests first',
          ],
          resources: [
            {
              title: 'Oracle: FAQ — Testing',
              url: 'https://docs.oracle.com/javase/tutorial/essential/exceptions/index.html',
              source: 'other',
              note: 'Pair with your team’s JUnit docs',
            },
            {
              title: 'Get Started with Apex Unit Tests (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/apex_testing',
              source: 'trailhead',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-java-test-1',
          topic: 'Structure',
          prompt: 'Arrange-act-assert refers to:',
          options: [
            'Deploy, validate, roll back',
            'Setup data, exercise behavior, verify outcomes',
            'Plan, code, merge',
            'Query, update, commit only',
          ],
          correctIndex: 1,
          explanation: 'AAA is the standard unit-test narrative structure.',
        },
        {
          id: 'q-java-test-2',
          topic: 'Assertions',
          prompt: 'Which assertion is stronger for a single expected id?',
          options: [
            'assertTrue(list.size() > 0)',
            'assertEquals(\"001A\", list.get(0).id())',
            'assertNotNull(list)',
            'assertDoesNotThrow(() -> {})',
          ],
          correctIndex: 1,
          explanation: 'Asserting the exact value documents and enforces the expected result.',
        },
        {
          id: 'q-java-test-3',
          topic: 'Fakes',
          prompt: 'A recording fake CaseNotifier is useful because it:',
          options: [
            'Sends production email',
            'Captures calls for assertions without side effects',
            'Increases governor limits',
            'Writes to Object Manager',
          ],
          correctIndex: 1,
          explanation: 'Fakes let you assert interactions without external effects.',
        },
        {
          id: 'q-java-test-4',
          topic: 'Coverage',
          prompt: 'Line coverage primarily tells you:',
          options: [
            'That every branch’s results were asserted correctly',
            'Which lines executed during tests',
            'That production is bug-free',
            'That SOQL is selective',
          ],
          correctIndex: 1,
          explanation: 'Coverage measures execution, not assertion quality.',
        },
        {
          id: 'q-java-test-5',
          topic: 'Apex bridge',
          prompt: 'Why does Salesforce enforce Apex test coverage for many deployments?',
          options: [
            'To replace sandboxes',
            'To prevent untested Apex from shipping to production',
            'To compile Java on the server',
            'To disable triggers',
          ],
          correctIndex: 1,
          explanation: 'Coverage gates are a platform quality gate for Apex deployments.',
        },
        {
          id: 'q-java-test-6',
          topic: 'Apex bridge',
          prompt: 'Test.startTest()/Test.stopTest() in Apex are commonly used to:',
          options: [
            'Open the App Launcher',
            'Reset limits and run async work in tests',
            'Create change sets',
            'Grant login access',
          ],
          correctIndex: 1,
          explanation: 'They demarcate the code under test for limits and asynchronous execution.',
        },
        {
          id: 'q-java-test-7',
          topic: 'Edge cases',
          prompt: 'Why test empty-list inputs for bulk-style methods?',
          options: [
            'Empty lists are impossible',
            'Bulk code often breaks on zero-size collections',
            'Empty lists disable Java',
            'Coverage ignores empty lists',
          ],
          correctIndex: 1,
          explanation: 'Triggers and batch paths frequently run on empty or single-record lists.',
        },
        {
          id: 'q-java-test-8',
          topic: 'Regression',
          prompt: 'Best first step before refactoring a pricing function?',
          options: [
            'Delete existing tests to write cleaner ones later',
            'Lock unit examples/assertions around current behavior',
            'Deploy straight to production',
            'Remove edge-case checks',
          ],
          correctIndex: 1,
          explanation: 'Tests provide a regression net so refactors cannot silently change behavior.',
        },
        {
          id: 'q-java-test-9',
          topic: 'assertThrows',
          prompt: 'assertThrows(IllegalStateException.class, session::reserveSeat) verifies:',
          options: [
            'That the method returns null',
            'That the method throws the expected exception type',
            'That the method is static',
            'That garbage collection ran',
          ],
          correctIndex: 1,
          explanation: 'It asserts an exception type is thrown by the executable.',
        },
        {
          id: 'q-java-test-10',
          topic: 'Scope',
          prompt: 'A fast test that never touches network/DB is typically a:',
          options: [
            'Manual UAT script only',
            'Unit test',
            'Full sandbox refresh',
            'Change set validation',
          ],
          correctIndex: 1,
          explanation: 'Unit tests isolate pure logic with fakes/in-memory state.',
        },
      ],
    },
  ],
};
