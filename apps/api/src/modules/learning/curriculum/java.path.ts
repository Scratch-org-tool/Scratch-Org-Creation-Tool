import type { CurriculumPath } from './curriculum.types';

/**
 * Path 6 — Java Programming (category: java).
 * A from-scratch Java track. Java is the closest cousin to Apex, so this path
 * doubles as a way for Salesforce developers to deepen their language
 * fundamentals: syntax, OOP, collections, exceptions, streams, and concurrency.
 */
export const javaPath: CurriculumPath = {
  id: 'java-programming',
  title: 'Java Programming',
  tagline: 'Strongly-typed, object-oriented engineering fundamentals.',
  description:
    'Learn Java from the ground up. This track covers syntax and control flow, object-oriented design with classes and interfaces, the collections framework and generics, robust error handling, and modern Java (streams, lambdas, concurrency). Apex borrows heavily from Java, so these skills transfer straight to Salesforce development.',
  category: 'java',
  level: 'beginner',
  badge: 'Java Developer',
  estimatedHours: 7,
  skills: [
    'Syntax & types',
    'Object-oriented design',
    'Collections & generics',
    'Exceptions & resources',
    'Streams & concurrency',
  ],
  modules: [
    {
      id: 'java-fundamentals',
      title: 'Java Fundamentals',
      summary:
        'The static type system, control flow, and object-oriented building blocks — classes, objects, interfaces, and the collections you use every day.',
      lessons: [
        {
          id: 'java-syntax',
          title: 'Syntax, types, and control flow',
          summary:
            'Write and run your first Java program, understand primitive vs reference types, and control flow with conditionals and loops.',
          durationMinutes: 16,
          objectives: [
            'Structure a class with a main method and run it',
            'Distinguish primitive types from reference types',
            'Use if/switch and the loop family correctly',
          ],
          sections: [
            {
              heading: 'Everything lives in a class',
              body:
                'Java is compiled and statically typed: you declare types, the compiler checks them, and it produces bytecode that runs on the JVM. Every program starts in a `public static void main(String[] args)` method inside a class. Apex developers will find this instantly familiar — Apex classes and method signatures are modeled on Java.',
              code: {
                language: 'java',
                snippet:
                  'public class Hello {\n    public static void main(String[] args) {\n        String name = "world";\n        System.out.println("Hello, " + name + "!");\n    }\n}',
                caption: 'Compile with javac Hello.java, run with java Hello.',
              },
            },
            {
              heading: 'Primitive vs reference types',
              body:
                'Java has eight primitives: byte, short, int, long, float, double, char, and boolean. They hold values directly. Everything else — String, arrays, your own classes — is a reference type held via a reference (like an object pointer). Each primitive has a wrapper class (int/Integer, boolean/Boolean) used when an object is required, such as in collections.\n\n- Primitives cannot be null; references can.\n- Use `equals()` to compare object contents; `==` on references compares identity.',
              code: {
                language: 'java',
                snippet:
                  'int count = 5;              // primitive\nInteger boxed = count;      // autoboxing to wrapper\n\nString a = "sf";\nString b = "sf";\nboolean sameRef = (a == b);         // may be true (interned) — do NOT rely on it\nboolean sameValue = a.equals(b);    // true — the correct content check',
                caption: 'Compare object content with equals(), not ==.',
              },
            },
            {
              heading: 'Control flow',
              body:
                'Java offers `if/else if/else`, a `switch` (including the modern arrow form), and three loops: `for`, enhanced `for-each`, and `while`. Prefer the for-each loop when you just need each element.',
              code: {
                language: 'java',
                snippet:
                  'int[] amounts = {100, 250, 90};\nint total = 0;\nfor (int amount : amounts) {   // for-each\n    total += amount;\n}\n\nString tier = switch (total / 100) {   // switch expression\n    case 0, 1 -> "Bronze";\n    case 2, 3 -> "Silver";\n    default   -> "Gold";\n};',
                caption: 'The switch expression returns a value directly.',
              },
            },
          ],
          realWorld: {
            title: 'A type error caught at compile time, not in production',
            scenario:
              'A batch job summed order amounts stored as text. In a dynamically typed script it silently concatenated strings ("100" + "250" = "100250") and shipped a wrong total.',
            solution:
              'Rewritten in Java, the amounts were declared as int; passing a String where an int was expected failed at compile time, forcing an explicit, correct parse with Integer.parseInt.',
            outcome:
              'The bug was impossible to ship — the compiler rejected it — illustrating why static typing is valued for financial and enterprise logic.',
          },
          keyTakeaways: [
            'Java is compiled and statically typed; execution starts in main()',
            'Eight primitives hold values; everything else is a reference type',
            'Compare object content with equals(); == on references is identity',
            'Use for-each for iteration and switch expressions for value selection',
          ],
          resources: [
            {
              title: 'Oracle — The Java Tutorials: Language Basics',
              url: 'https://docs.oracle.com/javase/tutorial/java/nutsandbolts/index.html',
              source: 'other',
            },
            {
              title: 'Salesforce Developers — Apex Developer Guide (Java parallels)',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/',
              source: 'developer',
              note: 'Apex syntax mirrors Java',
            },
          ],
        },
        {
          id: 'java-oop',
          title: 'Classes, objects, and interfaces',
          summary:
            'Model the world with classes, control access with encapsulation, and design to interfaces for flexible, testable code.',
          durationMinutes: 19,
          objectives: [
            'Define classes with fields, constructors, and methods',
            'Apply encapsulation and the four OOP pillars',
            'Program to interfaces and use polymorphism',
          ],
          sections: [
            {
              heading: 'Classes and encapsulation',
              body:
                'A class bundles state (fields) and behavior (methods). Encapsulation means keeping fields `private` and exposing controlled access through methods, so an object can enforce its own invariants. This is the first of the four OOP pillars: encapsulation, inheritance, polymorphism, and abstraction.',
              code: {
                language: 'java',
                snippet:
                  'public class Account {\n    private String name;\n    private double balance;      // guarded — cannot go negative\n\n    public Account(String name) { this.name = name; }\n\n    public void deposit(double amount) {\n        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");\n        balance += amount;\n    }\n    public double getBalance() { return balance; }\n}',
                caption: 'Private fields + methods let the class protect its own state.',
              },
            },
            {
              heading: 'Inheritance and polymorphism',
              body:
                'A class can `extends` another to reuse and specialize behavior, overriding methods with `@Override`. Polymorphism means code written against a base type works for any subtype at runtime — the JVM dispatches to the actual object’s method.',
              code: {
                language: 'java',
                snippet:
                  'class Notification {\n    void send(String to) { System.out.println("Generic to " + to); }\n}\nclass EmailNotification extends Notification {\n    @Override\n    void send(String to) { System.out.println("Email to " + to); }\n}\n\nNotification n = new EmailNotification();\nn.send("a@acme.com"); // "Email to a@acme.com" — runtime dispatch',
                caption: '@Override + runtime dispatch is polymorphism in action.',
              },
            },
            {
              heading: 'Interfaces: program to a contract',
              body:
                'An interface declares what an object can do without saying how. Classes `implements` an interface, and callers depend on the interface, not the concrete class. This decoupling makes code testable (swap a real implementation for a fake) and extensible (add new implementations without touching callers).',
              code: {
                language: 'java',
                snippet:
                  'interface PaymentGateway {\n    boolean charge(double amount);\n}\n\nclass StripeGateway implements PaymentGateway {\n    public boolean charge(double amount) { /* call Stripe */ return true; }\n}\n\nclass Checkout {\n    private final PaymentGateway gateway;   // depends on the interface\n    Checkout(PaymentGateway gateway) { this.gateway = gateway; }\n    boolean pay(double amount) { return gateway.charge(amount); }\n}',
                caption: 'Constructor injection of an interface = easy testing + flexibility.',
              },
            },
          ],
          realWorld: {
            title: 'Swapping payment providers without a rewrite',
            scenario:
              'A checkout service hard-coded calls to one payment provider. When the company added a second provider for a new region, the change rippled through dozens of classes.',
            solution:
              'They introduced a PaymentGateway interface; Checkout depended only on it. Adding a new provider meant writing one new class that implements the interface.',
            outcome:
              'The second provider was added with zero changes to Checkout, unit tests used a fake gateway, and the codebase followed the "depend on abstractions" principle from then on.',
          },
          keyTakeaways: [
            'Classes bundle state + behavior; private fields enforce invariants',
            'The four OOP pillars: encapsulation, inheritance, polymorphism, abstraction',
            'Override with @Override; the JVM dispatches to the real subtype',
            'Program to interfaces to decouple, test, and extend code',
          ],
          resources: [
            {
              title: 'Oracle — Interfaces and Inheritance',
              url: 'https://docs.oracle.com/javase/tutorial/java/IandI/index.html',
              source: 'other',
            },
            {
              title: 'Oracle — Classes and Objects',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/index.html',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-collections',
          title: 'Collections and generics',
          summary:
            'Choose the right data structure — List, Set, Map — and make them type-safe with generics.',
          durationMinutes: 17,
          objectives: [
            'Pick between List, Set, and Map for a given need',
            'Use generics for compile-time type safety',
            'Iterate and transform collections idiomatically',
          ],
          sections: [
            {
              heading: 'The core collection types',
              body:
                'The Java Collections Framework gives you interfaces with multiple implementations:\n\n- `List` (ordered, allows duplicates) — usually `ArrayList`.\n- `Set` (no duplicates) — `HashSet` for speed, `LinkedHashSet` to keep insertion order.\n- `Map` (key → value) — `HashMap`, or `LinkedHashMap` for order.\n\nProgram against the interface (`List<String> x = new ArrayList<>()`) so you can change the implementation later. Apex has the same List/Set/Map trio, so this maps directly.',
            },
            {
              heading: 'Generics for type safety',
              body:
                'Generics (`<Type>`) let a collection know what it contains, so the compiler stops you putting the wrong type in and removes casts when you take items out. This turns whole classes of runtime ClassCastExceptions into compile errors.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.*;\n\nList<String> names = new ArrayList<>();\nnames.add("Ada");\n// names.add(42);            // compile error — good!\nString first = names.get(0);  // no cast needed\n\nMap<String, Integer> stockBySku = new HashMap<>();\nstockBySku.put("SKU-1", 10);\nint qty = stockBySku.getOrDefault("SKU-9", 0); // 0 if missing',
                caption: 'Generics catch type mistakes at compile time.',
              },
            },
            {
              heading: 'Iterating and grouping',
              body:
                'Use the for-each loop for simple iteration, and Map.entrySet() to walk key/value pairs. When you need to build a summary, accumulate into a Map — the same technique you would use in Apex trigger handlers to bucket records by a field.',
              code: {
                language: 'java',
                snippet:
                  'List<String> orders = List.of("Won", "Lost", "Won", "Won");\nMap<String, Integer> counts = new HashMap<>();\nfor (String stage : orders) {\n    counts.merge(stage, 1, Integer::sum);   // increment or start at 1\n}\n// counts = {Won=3, Lost=1}',
                caption: 'Map.merge is a clean way to count/group.',
              },
            },
          ],
          realWorld: {
            title: 'De-duplicating an import feed',
            scenario:
              'A nightly import produced duplicate customer records because the same email arrived in multiple source files, inflating counts and breaking reports.',
            solution:
              'The importer collected emails into a HashSet before inserting; the Set silently dropped duplicates, and a HashMap keyed by email held the winning record.',
            outcome:
              'Duplicates disappeared, the import ran faster (O(1) lookups instead of scanning a list), and the same Set/Map pattern later solved a duplicate-contact problem in Apex.',
          },
          keyTakeaways: [
            'List = ordered w/ duplicates, Set = unique, Map = key→value',
            'Declare the interface type; instantiate a concrete implementation',
            'Generics move type errors from runtime to compile time',
            'Accumulate into Maps to count/group — the same pattern as Apex',
          ],
          resources: [
            {
              title: 'Oracle — Collections Framework overview',
              url: 'https://docs.oracle.com/javase/tutorial/collections/index.html',
              source: 'other',
            },
            {
              title: 'Oracle — Generics',
              url: 'https://docs.oracle.com/javase/tutorial/java/generics/index.html',
              source: 'other',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'java-fund-q1',
          topic: 'Entry point',
          prompt: 'Where does a Java program begin executing?',
          options: ['The first class', 'public static void main(String[] args)', 'A constructor', 'An interface'],
          correctIndex: 1,
          explanation: 'Execution begins in the main method with that exact signature.',
        },
        {
          id: 'java-fund-q2',
          topic: 'Types',
          prompt: 'How many primitive types does Java have?',
          options: ['Four', 'Six', 'Eight', 'Unlimited'],
          correctIndex: 2,
          explanation: 'byte, short, int, long, float, double, char, boolean — eight primitives.',
        },
        {
          id: 'java-fund-q3',
          topic: 'Equality',
          prompt: 'How should you compare two Strings for equal content?',
          options: ['==', 'equals()', 'compareTo() only', 'hashCode()'],
          correctIndex: 1,
          explanation: 'equals() compares content; == compares references.',
        },
        {
          id: 'java-fund-q4',
          topic: 'Encapsulation',
          prompt: 'Encapsulation is best achieved by…',
          options: [
            'Making all fields public',
            'Keeping fields private and exposing methods',
            'Using static everywhere',
            'Avoiding classes',
          ],
          correctIndex: 1,
          explanation: 'Private fields with controlled accessor methods protect invariants.',
        },
        {
          id: 'java-fund-q5',
          topic: 'Polymorphism',
          prompt: 'What does @Override indicate?',
          options: [
            'A new field',
            'A method replacing a superclass method',
            'A generic type',
            'A checked exception',
          ],
          correctIndex: 1,
          explanation: '@Override marks a method that overrides one inherited from a supertype.',
        },
        {
          id: 'java-fund-q6',
          topic: 'Interfaces',
          prompt: 'Why depend on an interface instead of a concrete class?',
          options: [
            'It runs faster',
            'It decouples callers so implementations can be swapped/tested',
            'Interfaces cannot have methods',
            'It avoids generics',
          ],
          correctIndex: 1,
          explanation: 'Depending on abstractions makes code flexible and testable.',
        },
        {
          id: 'java-fund-q7',
          topic: 'Collections',
          prompt: 'Which collection forbids duplicate elements?',
          options: ['List', 'Set', 'Map', 'Array'],
          correctIndex: 1,
          explanation: 'A Set holds unique elements; duplicates are dropped.',
        },
        {
          id: 'java-fund-q8',
          topic: 'Generics',
          prompt: 'What is the main benefit of generics?',
          options: [
            'Smaller files',
            'Compile-time type safety and fewer casts',
            'Faster loops',
            'Automatic multithreading',
          ],
          correctIndex: 1,
          explanation: 'Generics catch type errors at compile time and remove casts.',
        },
        {
          id: 'java-fund-q9',
          topic: 'Maps',
          prompt: 'Which is a clean way to count occurrences into a Map?',
          options: ['map.add()', 'map.merge(key, 1, Integer::sum)', 'map.size()', 'map.clear()'],
          correctIndex: 1,
          explanation: 'merge increments an existing count or seeds it — ideal for grouping.',
        },
      ],
    },
    {
      id: 'java-robust',
      title: 'Writing Robust Java',
      summary:
        'Handle failures with exceptions and try-with-resources, transform data with lambdas and the Streams API, and run work safely in parallel.',
      lessons: [
        {
          id: 'java-exceptions',
          title: 'Exceptions and try-with-resources',
          summary:
            'Distinguish checked from unchecked exceptions, handle them without swallowing errors, and release resources automatically.',
          durationMinutes: 16,
          objectives: [
            'Explain checked vs unchecked exceptions',
            'Use try/catch/finally and try-with-resources correctly',
            'Throw meaningful exceptions instead of returning error codes',
          ],
          sections: [
            {
              heading: 'Checked vs unchecked',
              body:
                'A checked exception (extends Exception) must be declared or handled — the compiler enforces it, which is good for recoverable, expected failures like I/O. An unchecked exception (extends RuntimeException) signals a programming error (null dereference, bad argument) and does not need declaring. Never catch an exception just to ignore it — an empty catch block hides bugs.',
            },
            {
              heading: 'try / catch / finally and custom exceptions',
              body:
                'Catch the most specific exception you can handle, add context, and rethrow or translate it into a domain-specific exception. `finally` always runs — historically used to close resources.',
              code: {
                language: 'java',
                snippet:
                  'class OrderException extends RuntimeException {\n    OrderException(String message, Throwable cause) { super(message, cause); }\n}\n\ntry {\n    int qty = Integer.parseInt(input);   // may throw NumberFormatException\n    process(qty);\n} catch (NumberFormatException e) {\n    throw new OrderException("Quantity \'" + input + "\' is not a number", e);\n}',
                caption: 'Translate low-level errors into meaningful domain exceptions (keep the cause).',
              },
            },
            {
              heading: 'try-with-resources',
              body:
                'Anything implementing AutoCloseable (files, DB connections, HTTP clients) can be declared in a try-with-resources header; Java closes it automatically, in reverse order, even if an exception is thrown. This replaces error-prone manual finally blocks.',
              code: {
                language: 'java',
                snippet:
                  'import java.io.*;\n\ntry (BufferedReader reader = new BufferedReader(new FileReader("data.csv"))) {\n    String line;\n    while ((line = reader.readLine()) != null) {\n        process(line);\n    }\n} // reader.close() is called automatically here\ncatch (IOException e) {\n    log.error("Could not read data.csv", e);\n}',
                caption: 'The resource is closed automatically — no leaked file handles.',
              },
            },
          ],
          realWorld: {
            title: 'A file-handle leak that crashed a nightly job',
            scenario:
              'A report job opened thousands of files in a loop but closed them in a finally block that a refactor accidentally removed. After a few hours the JVM ran out of file descriptors and the job crashed.',
            solution:
              'Every file open was rewritten as try-with-resources, guaranteeing closure regardless of exceptions or future edits.',
            outcome:
              'The leak became structurally impossible, the job ran to completion, and code review adopted "no manual close — use try-with-resources" as a rule.',
          },
          keyTakeaways: [
            'Checked = recoverable/declared; unchecked = programming errors',
            'Never swallow exceptions; add context and rethrow meaningfully',
            'finally always runs; prefer try-with-resources for AutoCloseable',
            'try-with-resources closes resources automatically and safely',
          ],
          resources: [
            {
              title: 'Oracle — Exceptions',
              url: 'https://docs.oracle.com/javase/tutorial/essential/exceptions/index.html',
              source: 'other',
            },
            {
              title: 'Oracle — try-with-resources',
              url: 'https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-streams',
          title: 'Lambdas and the Streams API',
          summary:
            'Write functional-style data pipelines with lambdas, method references, and streams — declarative, readable, and parallelizable.',
          durationMinutes: 18,
          objectives: [
            'Write lambdas and method references',
            'Build stream pipelines with filter/map/collect',
            'Group and summarize with Collectors',
          ],
          sections: [
            {
              heading: 'Lambdas and functional interfaces',
              body:
                'A lambda is a short anonymous function assignable to a functional interface (an interface with one abstract method) such as Predicate, Function, or Consumer. A method reference (`Class::method`) is even shorter when a lambda just calls one method. These are the building blocks of streams — and they mirror the arrow functions from the JavaScript track.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.function.*;\n\nPredicate<String> isLong = s -> s.length() > 5;\nFunction<String, Integer> len = String::length;   // method reference\n\nisLong.test("Salesforce"); // true\nlen.apply("Apex");          // 4',
                caption: 'Lambdas implement single-method interfaces inline.',
              },
            },
            {
              heading: 'Stream pipelines',
              body:
                'A stream is a lazy pipeline over a data source. Intermediate operations (filter, map, sorted) return a new stream; a terminal operation (collect, count, reduce, forEach) triggers execution. Streams do not mutate the source and read as a description of the transformation.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.*;\nimport java.util.stream.*;\n\nrecord Opp(String name, double amount, String stage) {}\n\nList<Opp> opps = List.of(\n    new Opp("A", 1000, "Won"),\n    new Opp("B", 500, "Lost"),\n    new Opp("C", 2000, "Won"));\n\ndouble wonTotal = opps.stream()\n    .filter(o -> o.stage().equals("Won"))\n    .mapToDouble(Opp::amount)\n    .sum();   // 3000.0',
                caption: 'filter → map → sum: the same shape as the JavaScript pipeline.',
              },
            },
            {
              heading: 'Grouping and summarizing',
              body:
                'The Collectors utility turns a stream into grouped or aggregated results. groupingBy builds a Map keyed by a classifier; downstream collectors (counting, summingDouble, averagingInt) summarize each group in one pass.',
              code: {
                language: 'java',
                snippet:
                  'import static java.util.stream.Collectors.*;\n\nMap<String, Double> totalByStage = opps.stream()\n    .collect(groupingBy(Opp::stage, summingDouble(Opp::amount)));\n// {Won=3000.0, Lost=500.0}',
                caption: 'groupingBy + summingDouble = a pivot table in one line.',
              },
            },
          ],
          realWorld: {
            title: 'Replacing 40 lines of loops with a stream',
            scenario:
              'A revenue report used nested loops and mutable maps to compute totals per region and per stage; the code was long and a source of off-by-one bugs.',
            solution:
              'The team rewrote it with streams and Collectors.groupingBy, expressing the pivot declaratively in a handful of lines.',
            outcome:
              'The report logic became self-documenting, bugs vanished with the mutable state, and switching to a parallel stream sped up the largest report without changing the logic.',
          },
          keyTakeaways: [
            'Lambdas/method references implement single-method interfaces concisely',
            'Streams are lazy pipelines: intermediate ops + one terminal op',
            'Streams do not mutate their source — safer than manual loops',
            'Collectors.groupingBy summarizes data like a pivot table',
          ],
          resources: [
            {
              title: 'Oracle — Aggregate Operations (streams)',
              url: 'https://docs.oracle.com/javase/tutorial/collections/streams/index.html',
              source: 'other',
            },
            {
              title: 'Oracle — Lambda Expressions',
              url: 'https://docs.oracle.com/javase/tutorial/java/javaOO/lambdaexpressions.html',
              source: 'other',
            },
          ],
        },
        {
          id: 'java-concurrency',
          title: 'Concurrency essentials',
          summary:
            'Run work in parallel safely with the ExecutorService, understand shared-state hazards, and know how this compares to Apex async.',
          durationMinutes: 18,
          objectives: [
            'Submit tasks to an ExecutorService instead of raw threads',
            'Recognize race conditions and how to avoid them',
            'Relate Java concurrency to Apex asynchronous processing',
          ],
          sections: [
            {
              heading: 'Threads, and why you rarely touch them directly',
              body:
                'The JVM can run many threads. Creating threads by hand is error-prone, so modern Java uses the Executor framework: you submit tasks to a managed thread pool and get back a Future (a handle to the eventual result). This is the same idea as the promises you saw in JavaScript, and as future/queueable Apex on the platform.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.concurrent.*;\nimport java.util.*;\n\nExecutorService pool = Executors.newFixedThreadPool(4);\ntry {\n    List<Future<Integer>> futures = new ArrayList<>();\n    for (String url : urls) {\n        futures.add(pool.submit(() -> download(url).length()));\n    }\n    int total = 0;\n    for (Future<Integer> f : futures) total += f.get(); // waits for each\n} finally {\n    pool.shutdown();\n}',
                caption: 'A thread pool + Futures run downloads concurrently, then collect results.',
              },
            },
            {
              heading: 'Shared state and race conditions',
              body:
                'When two threads read and write the same variable without coordination, you get a race condition — lost updates and corrupted state. Avoid it by not sharing mutable state, using immutable objects, or using thread-safe types such as AtomicInteger and ConcurrentHashMap. Prefer designs where each task owns its data and results are combined at the end.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.concurrent.atomic.AtomicInteger;\n\nAtomicInteger processed = new AtomicInteger();\n// Safe from many threads:\nprocessed.incrementAndGet();\n\n// UNSAFE from many threads (lost updates):\n// int count = 0; count++;  // read-modify-write is not atomic',
                caption: 'AtomicInteger makes increments safe across threads.',
              },
            },
            {
              heading: 'From Java threads to Apex async',
              body:
                'Salesforce runs on a multi-tenant platform, so it does not expose raw threads. Instead it gives you managed asynchronous options that solve the same problems: Queueable and Future methods for background work, Batch Apex for large data volumes, and Platform Events for decoupling. The mental model — hand off work, don’t block, combine results — is identical to Java’s Executor pattern, which is why understanding one accelerates the other.',
            },
          ],
          realWorld: {
            title: 'Parallelizing an integration sync safely',
            scenario:
              'A service synced data from 20 external endpoints sequentially, taking 20+ seconds and occasionally corrupting a shared counter when a quick fix "went parallel" without care.',
            solution:
              'The work moved to a fixed thread pool with Futures; the shared counter became an AtomicInteger and per-endpoint results were merged only after all Futures completed.',
            outcome:
              'Sync time dropped to a few seconds, the counter corruption disappeared, and the same "own your data, combine at the end" discipline later guided the team’s Queueable Apex design.',
          },
          keyTakeaways: [
            'Use ExecutorService + Future, not hand-managed threads',
            'Race conditions come from unsynchronized shared mutable state',
            'Prefer immutability and thread-safe types (AtomicInteger, ConcurrentHashMap)',
            'Apex async (Queueable, Batch, Platform Events) mirrors Java’s Executor model',
          ],
          resources: [
            {
              title: 'Oracle — Concurrency (Executors)',
              url: 'https://docs.oracle.com/javase/tutorial/essential/concurrency/executors.html',
              source: 'other',
            },
            {
              title: 'Trailhead — Asynchronous Apex',
              url: 'https://trailhead.salesforce.com/content/learn/modules/asynchronous_apex',
              source: 'trailhead',
              note: 'The Salesforce equivalent of Java concurrency',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'java-rob-q1',
          topic: 'Exceptions',
          prompt: 'A checked exception is one that…',
          options: [
            'Extends RuntimeException',
            'The compiler forces you to declare or handle',
            'Cannot be caught',
            'Only occurs in tests',
          ],
          correctIndex: 1,
          explanation: 'Checked exceptions must be declared or caught; the compiler enforces it.',
        },
        {
          id: 'java-rob-q2',
          topic: 'Error handling',
          prompt: 'What is wrong with an empty catch block?',
          options: [
            'It is slower',
            'It silently hides errors/bugs',
            'It is a syntax error',
            'It closes resources',
          ],
          correctIndex: 1,
          explanation: 'Swallowing exceptions hides failures and makes bugs hard to find.',
        },
        {
          id: 'java-rob-q3',
          topic: 'Resources',
          prompt: 'try-with-resources requires the resource to implement…',
          options: ['Serializable', 'AutoCloseable', 'Runnable', 'Comparable'],
          correctIndex: 1,
          explanation: 'AutoCloseable resources are closed automatically at block end.',
        },
        {
          id: 'java-rob-q4',
          topic: 'Lambdas',
          prompt: 'A lambda can be assigned to…',
          options: [
            'Any class',
            'A functional interface (one abstract method)',
            'A primitive',
            'A static field only',
          ],
          correctIndex: 1,
          explanation: 'Lambdas implement functional interfaces with a single abstract method.',
        },
        {
          id: 'java-rob-q5',
          topic: 'Streams',
          prompt: 'Which is a terminal stream operation?',
          options: ['filter', 'map', 'sorted', 'collect'],
          correctIndex: 3,
          explanation: 'collect is terminal; filter/map/sorted are intermediate.',
        },
        {
          id: 'java-rob-q6',
          topic: 'Streams',
          prompt: 'Do stream pipelines mutate their source collection?',
          options: ['Yes, always', 'No', 'Only with map', 'Only in parallel'],
          correctIndex: 1,
          explanation: 'Streams produce results without mutating the source.',
        },
        {
          id: 'java-rob-q7',
          topic: 'Concurrency',
          prompt: 'Preferred way to run many tasks concurrently in modern Java?',
          options: ['new Thread() per task', 'ExecutorService thread pool', 'A while(true) loop', 'System.gc()'],
          correctIndex: 1,
          explanation: 'A managed thread pool via ExecutorService is safer and more efficient.',
        },
        {
          id: 'java-rob-q8',
          topic: 'Concurrency',
          prompt: 'A race condition is caused by…',
          options: [
            'Too many comments',
            'Unsynchronized shared mutable state',
            'Using interfaces',
            'Immutable objects',
          ],
          correctIndex: 1,
          explanation: 'Concurrent read-modify-write on shared state causes races.',
        },
        {
          id: 'java-rob-q9',
          topic: 'Apex parallel',
          prompt: 'Which Salesforce feature is the closest analog to Java’s Executor tasks?',
          options: ['SOQL', 'Queueable/Batch Apex', 'Validation rules', 'Page layouts'],
          correctIndex: 1,
          explanation: 'Asynchronous Apex (Queueable, Batch) provides managed background work.',
        },
      ],
    },
  ],
};
