import type { CurriculumPath } from './curriculum.types';

/**
 * Java Integration Engineering (Advanced).
 * Modern Java engineering for teams building secure, observable, and
 * production-grade integrations with Salesforce.
 */
export const javaIntegrationPath: CurriculumPath = {
  id: 'java-integration-engineering',
  title: 'Java Integration Engineering',
  tagline: 'Build dependable Java services at the Salesforce boundary.',
  description:
    'Move from Java syntax to production integration engineering. This path connects the Java and Apex mental models, develops sound object-oriented and concurrent code, establishes reproducible builds and tests, and culminates in a resilient Spring Boot service that uses Salesforce APIs securely and operates safely under failure and load.',
  level: 'advanced',
  badge: 'Java Integration Engineer',
  estimatedHours: 12,
  skills: [
    'Modern Java',
    'Object-oriented design',
    'Collections, generics, and streams',
    'Maven and Gradle',
    'JUnit 5 and Mockito',
    'OAuth 2.0 and Salesforce APIs',
    'Spring Boot',
    'Resilient event-driven integration',
  ],
  modules: [
    {
      id: 'javaeng-language-design',
      title: 'Modern Java Language & Design',
      summary:
        'Build the right Java mental model, then apply types, records, collections, generics, streams, and concurrency without importing unsafe habits from Apex.',
      lessons: [
        {
          id: 'java-modern-syntax-apex-model',
          title:
            'Modern Java syntax, types, records, and the Apex mental model',
          summary:
            'Use modern Java deliberately and understand where its runtime, type system, persistence model, and resource constraints differ from Apex.',
          durationMinutes: 50,
          objectives: [
            'Model immutable domain data with records, enums, and exhaustive switch expressions',
            'Choose correctly among primitives, references, BigDecimal, Optional, and nullable values',
            'Translate Apex experience into Java without assuming governor limits, transactions, or persistence semantics are the same',
            'Design explicit boundaries for validation, errors, time, and external data',
          ],
          sections: [
            {
              heading: 'Modern syntax should make invariants visible',
              body: 'Records are concise nominal data carriers: their generated accessors, value-based equals/hashCode, and final components are ideal for API DTOs, commands, and immutable snapshots. A compact constructor is still the place to reject invalid state and defensively copy mutable inputs. Records are shallowly immutable, so a final List component is not safe unless the list itself is copied.\n\nSwitch expressions return a value and, when used over an enum or sealed hierarchy, make missing cases visible at compile time. Local variable type inference with var can remove repetition when the right-hand side is obvious, but it should not hide a business type behind a factory with an unclear return value.',
              code: {
                language: 'java',
                snippet:
                  'import java.math.BigDecimal;\nimport java.util.List;\nimport java.util.Objects;\n\npublic record AccountSnapshot(\n    String externalId,\n    String name,\n    BigDecimal annualRevenue,\n    List<String> tags\n) {\n    public AccountSnapshot {\n        if (externalId == null || externalId.isBlank()) {\n            throw new IllegalArgumentException("externalId is required");\n        }\n        name = Objects.requireNonNull(name, "name");\n        annualRevenue = Objects.requireNonNull(annualRevenue, "annualRevenue");\n        tags = List.copyOf(tags);\n    }\n\n    public Segment segment() {\n        return annualRevenue.compareTo(new BigDecimal("10000000")) >= 0\n            ? Segment.STRATEGIC\n            : Segment.STANDARD;\n    }\n\n    public String routingQueue() {\n        return switch (segment()) {\n            case STANDARD -> "general-success";\n            case STRATEGIC -> "enterprise-success";\n        };\n    }\n\n    public enum Segment { STANDARD, STRATEGIC }\n}',
                caption:
                  'A record validates its invariant, copies its collection, uses BigDecimal for money, and exhaustively maps an enum.',
              },
            },
            {
              heading: 'Types, null, value equality, and precision',
              body: 'Java primitives such as int and boolean always have a value; reference variables can be null. Wrapper types such as Integer are references, can be null, and may be unboxed implicitly—turning an innocent comparison into a NullPointerException. Use Objects.equals(a, b) for null-safe reference equality, and use equals rather than == for String and other values. The == operator asks whether two references identify the same object.\n\nUse BigDecimal for currency and other exact decimal business values. Construct it from a decimal string, compare it with compareTo, and define rounding explicitly when division is not exact. Optional is a useful return type for a value that may be absent; it is usually a poor record field, method parameter, or persistence property. At JSON and database boundaries, decide explicitly whether missing, JSON null, blank, and zero mean different things.',
            },
            {
              heading: 'Java is not Apex running somewhere else',
              body: 'The syntax is familiar, but the execution model is not. Apex runs inside a Salesforce transaction with platform-provided persistence, per-transaction governor limits, and automatic rollback for an unhandled failure. A Java service is a long-lived process with many concurrent requests. It owns connection pools, thread usage, heap pressure, timeouts, shutdown behavior, and any local database transaction. An HTTP call to Salesforce is never part of the Java database transaction or the Salesforce transaction as one atomic unit.\n\nApex DML and SOQL are language-integrated platform operations; Java talks to Salesforce over a network API and must handle authentication, latency, partial failure, pagination, and schema evolution. Apex sharing keywords have no Java equivalent: a Java integration receives the access of the Salesforce principal whose token it uses. Conversely, Java does not have Apex governor counters per request, but it still faces finite CPU, memory, sockets, downstream quotas, and container limits. Unbounded work is unsafe in both environments for different reasons.',
            },
            {
              heading: 'Make boundary semantics explicit',
              body: 'Treat data entering from JSON, environment configuration, a queue, or Salesforce as untrusted. Parse into transport DTOs, validate required shape, then map into domain types whose constructors enforce invariants. Preserve useful failure categories—validation, authentication, authorization, quota, transient transport, and permanent remote rejection—instead of converting every problem into RuntimeException.\n\nTime is another boundary. Use Instant for a machine timestamp, LocalDate for a date without time, and ZonedDateTime only when a named time zone matters. Inject Clock into logic that asks for "now" so tests remain deterministic. Never log access tokens, JWT assertions, private keys, complete customer payloads, or raw error bodies that can contain sensitive data.',
            },
          ],
          realWorld: {
            title: 'A revenue router survives its first international rollout',
            scenario:
              'A team ported an Apex account-routing class to Java. It represented revenue as double, compared customer IDs with ==, accepted null tags, and assumed a thrown exception would roll back both its local audit row and a completed Salesforce update. International decimal values were rounded, duplicate IDs sometimes failed equality checks, and retries produced contradictory audit states.',
            solution:
              'The team introduced validated records, BigDecimal values built from JSON decimals, value equality, immutable collection copies, and an explicit integration workflow. Local audit state became an idempotent state machine, while Salesforce writes used an external ID so a retry converged on the same record.',
            outcome:
              'Revenue classification became exact, malformed messages failed before any side effect, and replaying a failed message no longer created duplicate Salesforce records or misleading audit history.',
          },
          keyTakeaways: [
            'Records reduce ceremony but are only shallowly immutable; copy mutable components',
            'Use value equality for domain values and BigDecimal for exact decimal arithmetic',
            'Optional is primarily a return type, not a universal substitute for null',
            'Java services own concurrency, resources, and network failure in ways Apex code does not',
            'A local transaction and a Salesforce API transaction are not one atomic transaction',
          ],
          resources: [
            {
              title: 'The Java Language — Records',
              url: 'https://dev.java/learn/records/',
              source: 'other',
              note: 'Official Java learning material on record semantics and patterns',
            },
            {
              title: 'Java Language Basics',
              url: 'https://dev.java/learn/language-basics/',
              source: 'other',
              note: 'Official Java language guide',
            },
            {
              title: 'JEP 395: Records',
              url: 'https://openjdk.org/jeps/395',
              source: 'other',
              note: 'The OpenJDK specification history for records',
            },
          ],
        },
        {
          id: 'java-oo-collections-concurrency',
          title:
            'OO design, collections, generics, streams, and safe concurrency',
          summary:
            'Compose narrow interfaces, select collections by semantics, preserve type safety with generics, and make concurrency bounded and observable.',
          durationMinutes: 55,
          objectives: [
            'Design cohesive domain services with composition, immutable values, and narrow ports',
            'Choose List, Set, Map, and concurrent collections based on ordering and ownership semantics',
            'Write reusable generic APIs and stream pipelines without unsafe casts or hidden side effects',
            'Run independent work concurrently with bounded executors, cancellation, and immutable task inputs',
          ],
          sections: [
            {
              heading: 'Prefer cohesive objects and composition at boundaries',
              body: 'Good object-oriented design is about assigning behavior and protecting invariants, not maximizing inheritance. Keep domain objects small, make dependencies explicit in constructors, and depend on an interface at a boundary you own. A SalesforceGateway can describe what the application needs without leaking HTTP, OAuth, or vendor DTOs into business logic. One production adapter implements it; tests can provide a focused fake or mock.\n\nFavor composition over inheriting from a framework base class. Inheritance is appropriate for a genuine substitutable "is-a" relationship with a stable contract; it is not a shortcut for code reuse. Records and final classes are strong defaults. Expose unmodifiable views or copies rather than handing callers internal mutable collections.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.List;\nimport java.util.Objects;\n\ninterface SalesforceAccountGateway {\n    UpsertResult upsertByExternalId(AccountChange change);\n}\n\nrecord AccountChange(String externalId, String name, List<String> tags) {\n    AccountChange {\n        Objects.requireNonNull(externalId, "externalId");\n        Objects.requireNonNull(name, "name");\n        tags = List.copyOf(tags);\n    }\n}\n\nrecord UpsertResult(String salesforceId, boolean created) {}\n\nfinal class AccountSyncService {\n    private final SalesforceAccountGateway gateway;\n\n    AccountSyncService(SalesforceAccountGateway gateway) {\n        this.gateway = Objects.requireNonNull(gateway, "gateway");\n    }\n\n    UpsertResult synchronize(AccountChange change) {\n        return gateway.upsertByExternalId(change);\n    }\n}',
                caption:
                  'The application owns a narrow port; immutable domain values stay independent of HTTP and Salesforce DTOs.',
              },
            },
            {
              heading: 'Collections communicate business semantics',
              body: 'Use List when order and duplicates are meaningful, Set when uniqueness is the rule, and Map when values are addressed by a unique key. Pick an implementation only after the contract: ArrayList is a strong general-purpose list; HashSet and HashMap offer expected constant-time lookup without iteration order; LinkedHashMap preserves insertion order; TreeMap sorts by a comparator. Mutable keys can disappear logically from a hash map when fields used by equals/hashCode change, so keys should be immutable.\n\nReturn List.copyOf, Set.copyOf, Map.copyOf, or an immutable collector when callers must not mutate the result. ConcurrentHashMap protects its own operations but does not make a multi-step business sequence automatically atomic; use compute, merge, or an explicit lock when the operation spans read-modify-write. A thread-safe collection cannot repair a thread-unsafe object stored inside it.',
            },
            {
              heading:
                'Generics and streams preserve intent when used carefully',
              body: 'Generics move type errors to compilation. A List<Account> is not a subtype of List<Object>, because writing a Contact through the latter would corrupt the former. For APIs, remember PECS: a source that only produces T can use ? extends T; a destination that consumes T can use ? super T. Avoid raw types and unchecked casts at JSON or reflection boundaries—carry a Class<T> or an explicit type token instead.\n\nStreams are best for finite, in-memory transformations: filter, map, flatMap, group, reduce, and collect. Keep stream operations stateless and non-interfering. Do not mutate shared lists from peek or forEach, do not hide remote calls in map, and do not assume encounter order after choosing an unordered or parallel operation. A loop is clearer when control flow, checked failures, batching, or rate limiting dominates the work.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.Collection;\nimport java.util.Map;\nimport java.util.function.Function;\nimport java.util.stream.Collectors;\n\nfinal class Indexes {\n    private Indexes() {}\n\n    static <T, K> Map<K, T> firstByKey(\n        Collection<? extends T> values,\n        Function<? super T, ? extends K> keyFunction\n    ) {\n        return values.stream().collect(Collectors.toUnmodifiableMap(\n            keyFunction,\n            Function.identity(),\n            (first, ignored) -> first\n        ));\n    }\n}',
                caption:
                  'A generic immutable index accepts subtype sources and rejects duplicate-key ambiguity with an explicit merge rule.',
              },
            },
            {
              heading: 'Safe concurrency is bounded, owned, and observable',
              body: 'Concurrency helps when independent tasks spend time waiting, but it multiplies pressure on Salesforce, connection pools, and memory. Give each task immutable input, avoid shared mutation, and inject an application-owned executor with a documented queue and concurrency limit. CompletableFuture can coordinate independent calls, but every future still needs a timeout, an exception policy, and cancellation behavior. Preserve interruption when using blocking APIs.\n\nVirtual threads make blocking code cheaper; they do not make a remote system faster or remove rate limits. Protect downstream services with a semaphore or another explicit bulkhead even when using virtual threads. Avoid parallelStream for blocking API calls: it uses the shared common ForkJoinPool by default, gives poor control over concurrency, and can starve unrelated work in the same process.',
              code: {
                language: 'java',
                snippet:
                  'import java.util.List;\nimport java.util.concurrent.CompletableFuture;\nimport java.util.concurrent.Executor;\n\nfinal class ParallelAccountReader {\n    private final AccountReader reader;\n    private final Executor boundedExecutor;\n\n    ParallelAccountReader(AccountReader reader, Executor boundedExecutor) {\n        this.reader = reader;\n        this.boundedExecutor = boundedExecutor;\n    }\n\n    List<AccountSnapshot> fetch(List<String> ids) {\n        var futures = ids.stream()\n            .map(id -> CompletableFuture.supplyAsync(\n                () -> reader.fetch(id), boundedExecutor))\n            .toList();\n\n        return futures.stream()\n            .map(CompletableFuture::join)\n            .toList();\n    }\n}\n\ninterface AccountReader {\n    AccountSnapshot fetch(String id);\n}',
                caption:
                  'Tasks share no mutable accumulator and run only on a caller-supplied bounded executor; production code also applies timeouts and failure policy.',
              },
            },
          ],
          realWorld: {
            title: 'The parallel stream that exhausted the connection pool',
            scenario:
              'A nightly synchronizer changed a sequential stream to parallelStream and performed one Salesforce call inside map. On a larger host the common pool created more simultaneous work than the HTTP connection pool and Salesforce quota could sustain. Requests queued without useful timeouts, while unrelated common-pool work slowed down.',
            solution:
              'The team separated transformation from I/O, indexed records with a pure stream, and submitted remote reads to a dedicated bounded executor. Each call received a deadline, failures were classified, and metrics reported active tasks, queue depth, latency, and throttling.',
            outcome:
              'Throughput became predictable, the service stayed below its Salesforce allocation, and a slow remote API no longer starved unrelated work in the JVM.',
          },
          keyTakeaways: [
            'Own narrow interfaces at integration boundaries and favor composition over framework inheritance',
            'Choose collection contracts before implementations, and keep map keys immutable',
            'Use PECS for generic producers and consumers; eliminate raw types and unchecked casts',
            'Streams should describe side-effect-free in-memory transformations, not disguise network workflows',
            'Virtual threads reduce thread cost but do not replace downstream concurrency limits',
          ],
          resources: [
            {
              title: 'Java Collections Framework',
              url: 'https://dev.java/learn/api/collections-framework/',
              source: 'other',
              note: 'Official guidance on collection interfaces and implementations',
            },
            {
              title: 'Java Stream API',
              url: 'https://dev.java/learn/api/streams/',
              source: 'other',
              note: 'Official stream pipeline tutorials',
            },
            {
              title: 'JEP 444: Virtual Threads',
              url: 'https://openjdk.org/jeps/444',
              source: 'other',
              note: 'OpenJDK semantics and goals for virtual threads',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'javaeng-language-q1',
          topic: 'Records',
          prompt:
            'A record contains a List<String> component received from a caller. What best protects the record from later caller mutation?',
          options: [
            'Declare the record component final explicitly',
            'Assign List.copyOf(component) in the compact constructor',
            'Return the list through an Optional',
            'Override toString and omit the list',
          ],
          correctIndex: 1,
          explanation:
            'Record components are final references, not deeply immutable objects. List.copyOf creates an unmodifiable snapshot; final alone, Optional, and toString do not prevent mutation through the caller’s original list.',
        },
        {
          id: 'javaeng-language-q2',
          topic: 'Value semantics',
          prompt:
            'Which comparison is correct for two possibly null Java String values?',
          options: [
            'left == right',
            'left.compareTo(right) == 0',
            'Objects.equals(left, right)',
            'left.hashCode() == right.hashCode()',
          ],
          correctIndex: 2,
          explanation:
            'Objects.equals is null-safe and delegates to value equality. == compares identities, compareTo dereferences null, and equal hash codes do not guarantee equal values.',
        },
        {
          id: 'javaeng-language-q3',
          topic: 'Java and Apex',
          prompt:
            'A Java service writes its local database, then calls Salesforce REST. Which statement is accurate?',
          options: [
            'Both writes automatically share one Salesforce transaction',
            'A Java exception always rolls back a completed Salesforce call',
            'The operations need an explicit consistency and recovery design',
            'Apex governor limits make the local database write atomic',
          ],
          correctIndex: 2,
          explanation:
            'The local database and Salesforce are separate transactional resources. Without a deliberately configured distributed protocol—which Salesforce REST does not provide here—recovery requires idempotency, an outbox/saga, or reconciliation; exceptions and governor limits do not create atomicity.',
        },
        {
          id: 'javaeng-language-q4',
          topic: 'Numeric types',
          prompt:
            'What is the safest default representation for an exact currency amount in Java?',
          options: [
            'double constructed from the JSON decimal',
            'float rounded after every operation',
            'BigDecimal constructed from the decimal text',
            'long with an undocumented scale',
          ],
          correctIndex: 2,
          explanation:
            'BigDecimal from decimal text preserves decimal intent and supports explicit scale and rounding. Binary floating point cannot exactly represent many decimal fractions; an undocumented scaled long is error-prone even though a documented minor-unit model can be valid.',
        },
        {
          id: 'javaeng-language-q5',
          topic: 'Collections',
          prompt:
            'A workflow needs one AccountSnapshot per immutable external ID with fast lookup and no ordering promise. Which collection contract fits best?',
          options: [
            'ArrayList<AccountSnapshot>',
            'HashMap<String, AccountSnapshot>',
            'TreeSet<AccountSnapshot>',
            'ArrayDeque<AccountSnapshot>',
          ],
          correctIndex: 1,
          explanation:
            'A map directly models lookup by unique key, and HashMap supplies expected constant-time access without an ordering contract. The list and deque require scans; a tree set requires ordering and is not key-addressed in this shape.',
        },
        {
          id: 'javaeng-language-q6',
          topic: 'Generics',
          prompt:
            'A method only reads Number values from a caller-provided list. Which parameter is most flexible and type-safe?',
          options: [
            'List<Object>',
            'List<Number>',
            'List<? extends Number>',
            'List',
          ],
          correctIndex: 2,
          explanation:
            'A producer should use ? extends Number, allowing List<Integer>, List<BigDecimal>, and other Number subtypes. Generic lists are invariant, while a raw List discards compile-time safety.',
        },
        {
          id: 'javaeng-language-q7',
          topic: 'Streams',
          prompt:
            'Which operation is the strongest candidate for a stream pipeline?',
          options: [
            'Transform an in-memory list into an immutable map with an explicit duplicate-key rule',
            'Call Salesforce once per element with retries hidden inside map',
            'Append concurrently to a shared ArrayList from parallel forEach',
            'Consume an unbounded event subscription with manual acknowledgements',
          ],
          correctIndex: 0,
          explanation:
            'Finite in-memory transformation is where streams are clearest. Network retries, shared concurrent mutation, and an unbounded acknowledged subscription require explicit lifecycle, backpressure, and failure control.',
        },
        {
          id: 'javaeng-language-q8',
          topic: 'Concurrency',
          prompt:
            'What remains necessary after replacing platform threads with virtual threads?',
          options: [
            'Nothing; virtual threads remove downstream limits',
            'A bulkhead that bounds concurrent calls to Salesforce',
            'A parallelStream for every request',
            'A synchronized block around the entire service',
          ],
          correctIndex: 1,
          explanation:
            'Virtual threads make blocked threads cheaper but can generate enormous downstream concurrency. A semaphore, bounded dispatcher, or equivalent bulkhead still protects API quotas and connection capacity; parallel streams and global locking do not solve that requirement.',
        },
      ],
    },
    {
      id: 'javaeng-build-quality',
      title: 'Build, Configuration, Testing & Operations',
      summary:
        'Create reproducible Maven or Gradle projects, control dependency risk, externalize configuration, and prove behavior with tests and production-grade diagnostics.',
      lessons: [
        {
          id: 'java-build-dependencies-configuration',
          title:
            'Maven/Gradle structure, dependency hygiene, and configuration',
          summary:
            'Structure a maintainable service, make builds reproducible, centralize dependency policy, and keep deploy-time configuration and secrets out of artifacts.',
          durationMinutes: 50,
          objectives: [
            'Lay out single- and multi-module Java projects using conventional source and resource boundaries',
            'Use Maven or Gradle wrappers, BOMs or version catalogs, lock data, and verification controls',
            'Detect dependency convergence, vulnerability, provenance, and accidental scope problems',
            'Bind validated external configuration without committing environment secrets',
          ],
          sections: [
            {
              heading: 'Conventions make a project navigable',
              body: 'Both Maven and Gradle understand the conventional layout: src/main/java for production Java, src/main/resources for classpath resources, src/test/java for tests, and src/test/resources for test fixtures. Keep generated output under the build directory, never under source. Packages should reflect stable ownership and architecture rather than technical junk drawers such as utils.\n\nA growing integration commonly separates a domain/application module from adapters and the executable app. The core must not depend on Spring or Salesforce transport DTOs; adapters depend inward on owned ports. Start with one module when the boundary is small—premature modules add build friction—but split when dependency direction, independent reuse, or test isolation has become concrete.',
              code: {
                language: 'text',
                snippet:
                  'salesforce-sync/\n├── pom.xml                  # or settings.gradle.kts + build.gradle.kts\n├── mvnw / mvnw.cmd          # or gradlew / gradlew.bat\n├── sync-domain/\n│   └── src/{main,test}/java/\n├── salesforce-adapter/\n│   └── src/{main,test}/java/\n└── sync-app/\n    ├── src/main/java/\n    ├── src/main/resources/application.yml\n    └── src/test/{java,resources}/',
                caption:
                  'A small multi-module shape keeps domain policy inward and deployable framework code at the edge.',
              },
            },
            {
              heading: 'Maven and Gradle should express one dependency policy',
              body: 'Commit the Maven Wrapper or Gradle Wrapper so local development and CI invoke the approved build tool distribution. In Maven, inherit a controlled parent and import an approved BOM in dependencyManagement; child dependencies then omit versions. In Gradle, use a version catalog and platforms, enable dependency locking, and make repositories exclusive or centrally declared. Plugin versions belong in parent pluginManagement or the version catalog as well.\n\nDeclare only direct dependencies and use the narrowest scope: test libraries must not leak onto the runtime classpath, and compileOnly is not a substitute for a runtime requirement. Review the resolved graph, not just the build file. Maven dependency:tree and Gradle dependencies/dependencyInsight reveal evictions, duplicates, and surprising transitives.',
              code: {
                language: 'xml',
                snippet:
                  '<!-- Child POM: the approved parent/BOM centrally manages versions. -->\n<dependencies>\n  <dependency>\n    <groupId>org.springframework.boot</groupId>\n    <artifactId>spring-boot-starter-web</artifactId>\n  </dependency>\n  <dependency>\n    <groupId>org.springframework.boot</groupId>\n    <artifactId>spring-boot-starter-actuator</artifactId>\n  </dependency>\n  <dependency>\n    <groupId>org.springframework.boot</groupId>\n    <artifactId>spring-boot-starter-test</artifactId>\n    <scope>test</scope>\n  </dependency>\n</dependencies>',
                caption:
                  'Leaf modules consume centrally managed coordinates; they do not scatter dependency versions across the repository.',
              },
            },
            {
              heading: 'Dependency hygiene is more than a vulnerability scan',
              body: 'A healthy supply chain verifies provenance and integrity, minimizes repositories, and fails on unexpected graph changes. Generate an SBOM, scan direct and transitive components, review licenses, enable checksum or dependency verification, and update through small automated pull requests whose tests run before merge. A reported CVE still needs reachability and deployment context analysis, but "transitive" never means harmless.\n\nConvergence prevents two versions of the same library from producing linkage failures such as NoSuchMethodError at runtime. Prefer the framework BOM’s tested set over one-off overrides; when an override is necessary, document the reason and remove it once upstream policy catches up. Exclude a transitive dependency only after identifying which direct component relied on it and adding an explicit supported replacement if needed.',
            },
            {
              heading: 'Configuration varies by environment; artifacts do not',
              body: 'Build one artifact and supply environment-specific configuration at deployment. Spring Boot can bind environment variables, files, command-line arguments, and application YAML into a typed @ConfigurationProperties record. Validate required URLs, timeouts, and limits at startup so a bad release fails before consuming traffic. Keep harmless defaults for local ergonomics, but require explicit production values for identities and endpoints.\n\nSecrets never belong in Git, a container image, a JAR, a test fixture, or a logged configuration dump. Mount them from a secret manager as a file or inject a short-lived credential reference. Separate a Salesforce client ID from its private key, support rotation, and avoid defaulting to production endpoints. Profiles are useful for grouped behavior, but dozens of profile-specific files become an unreviewable configuration language.',
              code: {
                language: 'yaml',
                snippet:
                  'integration:\n  salesforce:\n    instance-url: ${SALESFORCE_INSTANCE_URL}\n    api-version: ${SALESFORCE_API_VERSION}\n    client-id: ${SALESFORCE_CLIENT_ID}\n    private-key-path: ${SALESFORCE_PRIVATE_KEY_PATH}\n    connect-timeout: ${SALESFORCE_CONNECT_TIMEOUT:3s}\n    request-timeout: ${SALESFORCE_REQUEST_TIMEOUT:20s}\n\nmanagement:\n  endpoints:\n    web:\n      exposure:\n        include: health,info,metrics',
                caption:
                  'The same YAML shape works everywhere; deployment supplies identities, endpoints, and the secret-file path.',
              },
            },
          ],
          realWorld: {
            title: 'One artifact replaces four environment builds',
            scenario:
              'A Java integration had separate POM files and application.properties files for test, staging, and production. A production-only dependency override caused a NoSuchMethodError, while a copied sandbox password remained in the repository history.',
            solution:
              'The team adopted the Maven Wrapper, a centrally managed BOM, dependency convergence checks, and one deployable artifact. Typed external configuration came from the deployment platform, and a secret manager mounted the JWT private key with a rotation procedure.',
            outcome:
              'The exact artifact tested in staging reached production, graph drift disappeared, secret scanning stayed clean, and a missing production value now stopped startup instead of failing during the first customer sync.',
          },
          keyTakeaways: [
            'Use conventional source layout and split modules only around real dependency boundaries',
            'Commit a build wrapper and centralize versions through a parent/BOM or version catalog',
            'Inspect and verify the resolved dependency graph, including transitives and plugins',
            'Build one immutable artifact and supply validated configuration at deployment',
            'Store secret material outside source, artifacts, logs, and ordinary configuration files',
          ],
          resources: [
            {
              title: 'Maven Standard Directory Layout',
              url: 'https://maven.apache.org/guides/introduction/introduction-to-the-standard-directory-layout.html',
              source: 'other',
              note: 'Canonical Maven project structure',
            },
            {
              title: 'Maven Dependency Mechanism',
              url: 'https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html',
              source: 'other',
              note: 'Dependency management, mediation, and scope',
            },
            {
              title: 'Gradle Dependency Management',
              url: 'https://docs.gradle.org/current/userguide/dependency_management.html',
              source: 'other',
              note: 'Official dependency constraints, catalogs, locking, and verification guidance',
            },
            {
              title: 'Spring Boot Externalized Configuration',
              url: 'https://docs.spring.io/spring-boot/reference/features/external-config.html',
              source: 'other',
              note: 'Official configuration source and binding behavior',
            },
          ],
        },
        {
          id: 'java-testing-debugging-observability',
          title: 'JUnit 5, Mockito, debugging, and observability',
          summary:
            'Build a fast, trustworthy test portfolio and diagnose production behavior with safe logs, metrics, traces, health probes, and disciplined debugging.',
          durationMinutes: 55,
          objectives: [
            'Write focused JUnit 5 tests with clear arrange-act-assert behavior and deterministic inputs',
            'Use Mockito at owned boundaries without coupling tests to implementation details',
            'Separate unit, slice, integration, contract, and end-to-end responsibilities',
            'Correlate failures with structured logs, low-cardinality metrics, traces, and health signals',
          ],
          sections: [
            {
              heading: 'JUnit tests should explain a contract',
              body: 'A useful test names one observable rule, arranges only relevant state, performs one behavior, and asserts the result plus essential side effects. JUnit 5 lifecycle hooks reduce genuine shared setup, while parameterized tests cover a rule’s boundary table without copy-paste. Use nested test classes when they clarify contexts. A test should fail for one understandable reason.\n\nControl nondeterminism: inject Clock, supply IDs, use temporary directories, and replace arbitrary sleeps with a synchronization point or bounded await. Never make ordinary unit tests depend on the developer’s time zone, network, environment credentials, or execution order. Assert outcomes rather than private methods.',
            },
            {
              heading:
                'Mockito is for interaction boundaries, not every object',
              body: 'Mock a port when the important contract is how the subject collaborates with an expensive or nondeterministic dependency. Keep value objects and straightforward domain collaborators real. Stubbing every getter creates brittle tests that mirror implementation rather than behavior. Strict stubbing is valuable because unused setup often signals a confused test.\n\nVerify only interactions that carry business meaning, such as one idempotent upsert and no event publication after rejection. Argument captors are appropriate when the constructed command itself is the outcome; broad any() matchers can hide a malformed request. Do not mock types you do not own as a substitute for an adapter contract.',
              code: {
                language: 'java',
                snippet:
                  'import static org.junit.jupiter.api.Assertions.assertEquals;\nimport static org.mockito.Mockito.verify;\nimport static org.mockito.Mockito.verifyNoMoreInteractions;\nimport static org.mockito.Mockito.when;\n\nimport java.util.List;\nimport org.junit.jupiter.api.Test;\nimport org.junit.jupiter.api.extension.ExtendWith;\nimport org.mockito.InjectMocks;\nimport org.mockito.Mock;\nimport org.mockito.junit.jupiter.MockitoExtension;\n\n@ExtendWith(MockitoExtension.class)\nfinal class AccountSyncServiceTest {\n    @Mock SalesforceAccountGateway gateway;\n    @InjectMocks AccountSyncService service;\n\n    @Test\n    void returnsTheSalesforceIdentityFromAnIdempotentUpsert() {\n        var change = new AccountChange("erp-42", "Acme", List.of("priority"));\n        var remote = new UpsertResult("001-example", true);\n        when(gateway.upsertByExternalId(change)).thenReturn(remote);\n\n        var result = service.synchronize(change);\n\n        assertEquals(remote, result);\n        verify(gateway).upsertByExternalId(change);\n        verifyNoMoreInteractions(gateway);\n    }\n}',
                caption:
                  'The test uses real immutable values and mocks only the owned remote-system port.',
              },
            },
            {
              heading: 'Use a test portfolio, not one oversized test type',
              body: 'Unit tests exercise domain decisions in milliseconds. Framework slice tests validate focused wiring such as JSON and HTTP error mapping. Integration tests start real infrastructure where semantics matter—a relational database, broker, or HTTP stub—and contract tests pin assumptions about Salesforce request and response shapes. A small end-to-end suite proves the deployed path with non-production credentials.\n\nMockito cannot prove JSON field names, TLS behavior, database constraints, or transaction boundaries. For an HTTP adapter, test representative success, pagination, 401 refresh, 403 quota failure, 429 or transient backoff, malformed JSON, timeout, and redaction. Keep recorded payloads synthetic and minimal. Quarantine is not a long-term strategy for flaky tests: find the race, leaked shared state, clock assumption, or uncontrolled external dependency.',
            },
            {
              heading:
                'Debug with evidence and design observability before incidents',
              body: 'Start debugging from a reproducible symptom, correlation ID, time window, deployment identity, and changed inputs. Read the complete exception chain and preserve causes when translating exceptions. A local debugger is useful for deterministic code, but production incidents usually require telemetry and a production-like replay rather than pausing a live process.\n\nEmit structured logs with operation, outcome, correlation ID, event ID, and safe Salesforce request identifiers; never emit tokens or full customer payloads. Metrics should answer rate, errors, and duration, plus queue depth, retries, quota headroom, and circuit state. Keep metric labels low-cardinality—outcome or operation, not account ID. Distributed traces connect message receipt, local persistence, and Salesforce calls, while liveness and readiness answer different questions: whether the process must restart and whether it should receive traffic.',
              code: {
                language: 'java',
                snippet:
                  'import org.slf4j.Logger;\nimport org.slf4j.LoggerFactory;\nimport org.slf4j.MDC;\n\nfinal class CorrelatedSyncLogger {\n    private static final Logger log = LoggerFactory.getLogger(CorrelatedSyncLogger.class);\n\n    void recordSuccess(String correlationId, String externalId, String requestId) {\n        try (var ignored = MDC.putCloseable("correlationId", correlationId)) {\n            log.info(\n                "salesforce_account_upsert outcome=success externalId={} requestId={}",\n                externalId,\n                requestId\n            );\n        }\n    }\n}',
                caption:
                  'A correlation field is scoped and removed automatically; structured fields contain identifiers, not credentials or payloads.',
              },
            },
          ],
          realWorld: {
            title: 'A retry storm becomes a five-minute diagnosis',
            scenario:
              'An integration intermittently duplicated work after timeouts. Its tests mocked the concrete HTTP client, logs said only "sync failed", metrics had account IDs as labels, and the health endpoint reported UP even when the worker queue had stopped draining.',
            solution:
              'The team moved mocking to an owned gateway, added adapter tests for timeout-after-write behavior, and made the operation idempotent. Correlation IDs linked message and HTTP spans; retry counts and queue age became bounded-cardinality metrics; readiness failed when the consumer could no longer make progress.',
            outcome:
              'The next incident was traced to one deployment and one timeout path in minutes, replay was safe, the metrics backend stopped suffering cardinality spikes, and traffic drained before unhealthy workers accumulated a backlog.',
          },
          keyTakeaways: [
            'Test observable contracts with deterministic time, IDs, and inputs',
            'Mock owned boundaries selectively; real value objects make tests clearer',
            'Adapter and integration tests cover semantics that Mockito cannot prove',
            'Preserve exception causes and correlate logs, metrics, and traces across boundaries',
            'Use low-cardinality labels and distinguish liveness from readiness',
          ],
          resources: [
            {
              title: 'JUnit 5 User Guide',
              url: 'https://docs.junit.org/current/user-guide/',
              source: 'other',
              note: 'Official JUnit tests, extensions, and parameterized-test reference',
            },
            {
              title: 'Mockito Documentation',
              url: 'https://site.mockito.org/',
              source: 'other',
              note: 'Official Mockito documentation and API links',
            },
            {
              title: 'Spring Boot Actuator Reference',
              url: 'https://docs.spring.io/spring-boot/reference/actuator/',
              source: 'other',
              note: 'Official production-ready health, metrics, and observability features',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'javaeng-quality-q1',
          topic: 'Project structure',
          prompt:
            'Where should ordinary production Java source live in a conventional Maven or Gradle project?',
          options: [
            'src/java/main',
            'src/main/java',
            'main/src/java',
            'build/generated/java',
          ],
          correctIndex: 1,
          explanation:
            'Both tools recognize src/main/java by convention. The other paths require custom configuration or are intended for generated build output, which should not become the hand-written source root.',
        },
        {
          id: 'javaeng-quality-q2',
          topic: 'Dependency management',
          prompt:
            'What is the primary benefit of a centrally managed BOM or Gradle platform in a multi-module service?',
          options: [
            'It removes the need to test upgrades',
            'It gives related dependencies one compatible version policy',
            'It packages all dependencies into source control',
            'It prevents every possible transitive vulnerability',
          ],
          correctIndex: 1,
          explanation:
            'A BOM or platform aligns a tested dependency family and avoids version drift across modules. It does not replace tests, vendor binaries into source, or guarantee that no dependency has a vulnerability.',
        },
        {
          id: 'javaeng-quality-q3',
          topic: 'Reproducible builds',
          prompt: 'Why commit the Maven Wrapper or Gradle Wrapper?',
          options: [
            'To commit the complete local dependency cache',
            'To run the repository’s approved build-tool distribution consistently',
            'To bypass checksum verification',
            'To embed production secrets in the build',
          ],
          correctIndex: 1,
          explanation:
            'The wrapper bootstraps a declared build-tool distribution consistently in developer and CI environments. Dependencies remain in repositories/caches, integrity checks still matter, and secrets do not belong in the wrapper.',
        },
        {
          id: 'javaeng-quality-q4',
          topic: 'Configuration',
          prompt:
            'A required Salesforce instance URL is absent in production. What behavior is preferable?',
          options: [
            'Default silently to the production login host',
            'Discover a random instance from DNS',
            'Fail startup through validated typed configuration',
            'Wait until the first customer event and then log the full configuration',
          ],
          correctIndex: 2,
          explanation:
            'Startup validation makes a bad deployment fail before it consumes traffic. Silent production defaults and late discovery increase blast radius, while dumping configuration can expose secrets.',
        },
        {
          id: 'javaeng-quality-q5',
          topic: 'JUnit 5',
          prompt:
            'Which technique makes time-dependent unit tests deterministic?',
          options: [
            'Call Instant.now repeatedly and widen the assertion tolerance',
            'Inject a Clock and use a fixed clock in the test',
            'Sleep until the expected second',
            'Run tests only in UTC production containers',
          ],
          correctIndex: 1,
          explanation:
            'An injected Clock gives production real time and tests controlled time. Tolerances and sleeps remain timing-sensitive, and a container time zone does not control the current instant.',
        },
        {
          id: 'javaeng-quality-q6',
          topic: 'Mockito',
          prompt:
            'Which dependency is the best Mockito candidate in a domain-service unit test?',
          options: [
            'An immutable AccountChange record',
            'A simple BigDecimal value',
            'The service’s owned SalesforceAccountGateway port',
            'Every private helper method in the service',
          ],
          correctIndex: 2,
          explanation:
            'The owned gateway is a nondeterministic remote boundary whose collaboration can matter. Values should stay real, and private implementation details should be exercised through public behavior rather than mocked.',
        },
        {
          id: 'javaeng-quality-q7',
          topic: 'Observability',
          prompt:
            'Which metric label is safe as a generally low-cardinality dimension?',
          options: [
            'salesforceAccountId',
            'rawExceptionMessage',
            'outcome with values success, retryable, or permanent_failure',
            'jwtAssertion',
          ],
          correctIndex: 2,
          explanation:
            'A small controlled outcome set produces bounded time series. Account IDs and exception text are unbounded, while a JWT assertion is both secret and high-cardinality.',
        },
        {
          id: 'javaeng-quality-q8',
          topic: 'Health probes',
          prompt:
            'What should readiness communicate for an integration worker?',
          options: [
            'Whether the process should be killed immediately',
            'Whether this instance can currently accept or make progress on work',
            'Whether every historical Salesforce call succeeded',
            'Whether heap usage has ever exceeded fifty percent',
          ],
          correctIndex: 1,
          explanation:
            'Readiness removes an instance from work routing when it cannot safely progress. Liveness answers whether restart is appropriate; neither probe is a history report or a single arbitrary heap threshold.',
        },
      ],
    },
    {
      id: 'javaeng-salesforce-services',
      title: 'Salesforce API & Service Engineering',
      summary:
        'Authenticate correctly, select and consume Salesforce APIs, then operate a resilient Spring Boot integration under retries, quotas, events, and deployment change.',
      lessons: [
        {
          id: 'java-oauth-salesforce-apis',
          title: 'OAuth 2.0, JWT, Salesforce APIs, JSON, and pagination',
          summary:
            'Acquire and protect tokens, choose REST, Composite, or Bulk API by workload, and build a defensive Java client for evolving JSON and paginated results.',
          durationMinutes: 60,
          objectives: [
            'Choose an appropriate server-to-server OAuth flow and explain the JWT bearer assertion',
            'Protect credentials and access tokens through their complete lifecycle',
            'Select Salesforce REST, Composite, or Bulk API based on transaction and volume needs',
            'Deserialize evolving JSON safely and follow Salesforce pagination URLs until done',
          ],
          sections: [
            {
              heading: 'OAuth grants access; JWT can be the client assertion',
              body: 'A Salesforce External Client App—or an existing Connected App—defines the client identity, scopes, policies, certificate, and permitted users. For the OAuth JWT bearer flow, the Java service creates a short-lived JWT assertion signed with its private key. The issuer is the app’s client ID, the subject is the integration user, the audience is the intended Salesforce login host, and expiration is brief. Salesforce verifies the certificate and returns an access token plus the instance URL. The private key never goes to Salesforce.\n\nJWT bearer is useful for a headless service acting as a named user without storing a user password or refresh token. Client credentials is another server-to-server option where app policy selects the run-as user. Choose deliberately according to org policy. A Salesforce access token should be treated as an opaque bearer secret—it is not guaranteed to be a JWT just because a JWT assertion obtained it.',
            },
            {
              heading: 'Token handling is a security and concurrency problem',
              body: 'Request only necessary OAuth scopes and grant the integration user least-privilege object, field, and record access. Load the signing key from a managed secret, restrict file and process access, rotate the corresponding certificate, and never log assertions or tokens. Use the returned instance_url for API calls rather than continuing against the login host.\n\nCache tokens centrally with their effective expiry and refresh a little early. Coordinate concurrent refresh so an expired token does not trigger a stampede. On 401, invalidate only the token that failed, obtain a fresh token, and replay only when the operation is safe to replay. A 403 can mean authorization or quota and is not fixed by repeatedly refreshing credentials.',
            },
            {
              heading: 'Choose REST, Composite, or Bulk by unit of work',
              body: 'REST resources are direct and excellent for interactive reads, individual external-ID upserts, and modest query workflows. The Composite resource groups dependent subrequests, references earlier results, and can request allOrNone behavior; it reduces round trips but does not turn unrelated external systems into one transaction. Keep payload and subrequest limits in the design.\n\nBulk API 2.0 is asynchronous and designed for large ingest or query jobs. Upload or define the job, poll its state with backoff, and consume success, failure, or result files as streams. Do not send hundreds of thousands of rows as one REST loop or one giant in-memory JSON document. Select API shape from volume, latency, atomicity, error-recovery, and result-delivery needs—not from whichever endpoint the first prototype used.',
            },
            {
              heading:
                'JSON and pagination must tolerate evolution without hiding corruption',
              body: 'Salesforce query responses include records, totalSize, done, and—until the final page—nextRecordsUrl. Follow that server-provided relative URL; do not reconstruct a locator or add the original SOQL again. Stream pages into bounded processing rather than retaining an unbounded result. The compact example below returns a list, so its caller must bound the query; a large export should pass each page to a consumer instead. Enforce the expected Salesforce host before following any resolved URL.\n\nMap only fields the application owns, tolerate harmless unknown fields, and fail on missing required business data. Salesforce error responses are JSON arrays with errorCode, message, and sometimes fields; classify by status and code while redacting content. Preserve request identifiers from response headers for support. The API version belongs in validated configuration so an upgrade is tested and deployed intentionally.',
              code: {
                language: 'java',
                snippet:
                  'import com.fasterxml.jackson.annotation.JsonIgnoreProperties;\nimport com.fasterxml.jackson.annotation.JsonProperty;\nimport com.fasterxml.jackson.databind.ObjectMapper;\nimport java.io.IOException;\nimport java.net.URI;\nimport java.net.URLEncoder;\nimport java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\nimport java.nio.charset.StandardCharsets;\nimport java.util.ArrayList;\nimport java.util.List;\n\nfinal class SalesforceQueryClient {\n    private final HttpClient http;\n    private final ObjectMapper json;\n    private final URI instanceUrl;\n    private final String apiVersion;\n\n    SalesforceQueryClient(HttpClient http, ObjectMapper json, URI instanceUrl, String apiVersion) {\n        this.http = http;\n        this.json = json;\n        this.instanceUrl = instanceUrl;\n        this.apiVersion = apiVersion;\n    }\n\n    List<AccountRow> queryAll(String soql, String accessToken)\n        throws IOException, InterruptedException {\n        var encoded = URLEncoder.encode(soql, StandardCharsets.UTF_8);\n        URI next = instanceUrl.resolve(\n            "/services/data/" + apiVersion + "/query?q=" + encoded);\n        var accounts = new ArrayList<AccountRow>();\n\n        while (next != null) {\n            var request = HttpRequest.newBuilder(next)\n                .header("Authorization", "Bearer " + accessToken)\n                .header("Accept", "application/json")\n                .GET()\n                .build();\n            var response = http.send(request, HttpResponse.BodyHandlers.ofString());\n            if (response.statusCode() != 200) {\n                throw new IOException("Salesforce query failed with HTTP " + response.statusCode());\n            }\n\n            var page = json.readValue(response.body(), AccountPage.class);\n            accounts.addAll(page.records());\n            next = page.done() ? null : checkedNextPage(page.nextRecordsUrl());\n        }\n        return List.copyOf(accounts);\n    }\n\n    private URI checkedNextPage(String path) throws IOException {\n        if (path == null) {\n            throw new IOException("Incomplete query page has no nextRecordsUrl");\n        }\n        var candidate = instanceUrl.resolve(path);\n        if (!instanceUrl.getHost().equalsIgnoreCase(candidate.getHost())) {\n            throw new IOException("Rejected pagination URL for an unexpected host");\n        }\n        return candidate;\n    }\n\n    @JsonIgnoreProperties(ignoreUnknown = true)\n    record AccountPage(boolean done, List<AccountRow> records, String nextRecordsUrl) {}\n\n    @JsonIgnoreProperties(ignoreUnknown = true)\n    record AccountRow(\n        @JsonProperty("Id") String id,\n        @JsonProperty("Name") String name\n    ) {}\n}',
                caption:
                  'The client uses the configured API version, follows nextRecordsUrl, rejects a host change, tolerates unknown JSON fields, and never logs the token.',
              },
            },
          ],
          realWorld: {
            title: 'A nightly export stops losing records',
            scenario:
              'A Java job queried changed accounts through REST, assumed the first records array was complete, and called the login host with a long-lived token stored in application.properties. It silently exported only the first page and broke when the org moved instances.',
            solution:
              'The service adopted JWT bearer authentication with a secret-managed key, cached short-lived tokens, used the returned instance URL, and followed every nextRecordsUrl until done. It streamed each page to downstream storage and tracked record and page counts.',
            outcome:
              'Exports reconciled exactly to totalSize, instance migration required no code change, no bearer secret remained in source, and operators could distinguish authentication, authorization, quota, and malformed-data failures.',
          },
          keyTakeaways: [
            'A JWT bearer assertion is signed client proof; the returned access token remains an opaque secret',
            'Use least privilege, secret-managed keys, coordinated token refresh, and the returned instance URL',
            'REST serves interactive work, Composite reduces related round trips, and Bulk API 2.0 handles large asynchronous jobs',
            'Follow nextRecordsUrl until done instead of reconstructing Salesforce query locators',
            'Tolerate unknown JSON fields but validate business-required data and classify Salesforce errors',
          ],
          resources: [
            {
              title: 'Salesforce OAuth 2.0 JWT Bearer Flow',
              url: 'https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_jwt_flow.htm&type=5',
              source: 'help',
              note: 'Official configuration and assertion requirements',
            },
            {
              title: 'Salesforce REST API Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm',
              source: 'developer',
              note: 'REST resources, queries, Composite, headers, and errors',
            },
            {
              title: 'Bulk API 2.0 Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm',
              source: 'developer',
              note: 'Official asynchronous ingest and query workflow',
            },
          ],
        },
        {
          id: 'java-spring-resilient-integration-service',
          title:
            'Spring Boot integration service: resilience, events, and deployment',
          summary:
            'Assemble a Spring Boot boundary that retries safely, respects Salesforce capacity, processes replayable events idempotently, and deploys with controlled lifecycle and telemetry.',
          durationMinutes: 65,
          objectives: [
            'Configure a Spring Boot integration client with validated endpoints, timeouts, and retry policy',
            'Apply exponential backoff, jitter, Retry-After, bulkheads, and quota-aware rate control',
            'Process replayed events with durable idempotency and convergent Salesforce external-ID writes',
            'Deploy an observable service with graceful shutdown, probes, immutable artifacts, and safe rollout controls',
          ],
          sections: [
            {
              heading: 'Spring Boot should wire policy around a narrow core',
              body: 'Keep controllers, message listeners, JSON DTOs, OAuth, and HTTP adapters at the application edge. Domain and application services depend on owned interfaces. Spring configuration composes those pieces and binds typed settings; it should not turn domain objects into service locators or make every class aware of the container.\n\nSet connect and per-request deadlines explicitly. Connection pools, executors, and ObjectMapper instances are application-owned reusable beans rather than objects constructed per request. Validate that the instance URL is HTTPS, the API version is present, durations are positive, and retry limits are sensible. Credentials come from a dedicated provider, not from a singleton String printed by configuration diagnostics.',
              code: {
                language: 'java',
                snippet:
                  'import java.net.URI;\nimport java.net.http.HttpClient;\nimport java.time.Duration;\nimport java.util.Objects;\nimport org.springframework.boot.context.properties.ConfigurationProperties;\nimport org.springframework.boot.context.properties.EnableConfigurationProperties;\nimport org.springframework.context.annotation.Bean;\nimport org.springframework.context.annotation.Configuration;\n\n@ConfigurationProperties("integration.salesforce")\nrecord SalesforceProperties(\n    URI instanceUrl,\n    String apiVersion,\n    Duration connectTimeout,\n    Duration requestTimeout,\n    int maxAttempts,\n    Duration initialBackoff,\n    Duration maxBackoff\n) {\n    SalesforceProperties {\n        Objects.requireNonNull(instanceUrl, "instanceUrl");\n        Objects.requireNonNull(apiVersion, "apiVersion");\n        Objects.requireNonNull(connectTimeout, "connectTimeout");\n        Objects.requireNonNull(requestTimeout, "requestTimeout");\n        Objects.requireNonNull(initialBackoff, "initialBackoff");\n        Objects.requireNonNull(maxBackoff, "maxBackoff");\n        if (!"https".equalsIgnoreCase(instanceUrl.getScheme())) {\n            throw new IllegalArgumentException("Salesforce instanceUrl must use HTTPS");\n        }\n        if (apiVersion.isBlank() || maxAttempts < 1) {\n            throw new IllegalArgumentException("API version and maxAttempts are required");\n        }\n        if (connectTimeout.isNegative() || connectTimeout.isZero()\n            || requestTimeout.isNegative() || requestTimeout.isZero()) {\n            throw new IllegalArgumentException("Timeouts must be positive");\n        }\n    }\n}\n\n@Configuration\n@EnableConfigurationProperties(SalesforceProperties.class)\nclass SalesforceClientConfiguration {\n    @Bean\n    HttpClient salesforceHttpClient(SalesforceProperties properties) {\n        return HttpClient.newBuilder()\n            .connectTimeout(properties.connectTimeout())\n            .build();\n    }\n}',
                caption:
                  'Typed configuration fails startup for an unsafe endpoint or invalid deadline; the reusable client is container-managed.',
              },
            },
            {
              heading:
                'Retry only what can succeed and only when replay is safe',
              body: 'Retry transient connection failures, selected 5xx responses, and throttling responses when the operation is idempotent. Use capped exponential backoff with jitter so replicas do not retry in lockstep, honor Retry-After when Salesforce supplies it, and enforce an overall deadline. Authentication gets at most a coordinated token refresh; validation and authorization failures are permanent until configuration or data changes. Daily API quota exhaustion is not repaired by a tight retry loop.\n\nAn external-ID upsert is naturally safer to replay than create. For non-idempotent operations, supply a durable idempotency key or record enough state to reconcile an unknown outcome after timeout. A circuit breaker limits repeated calls during a sustained outage, a bulkhead caps in-flight work, and rate control shapes throughput before Salesforce rejects it. Read Sforce-Limit-Info to observe API consumption, but treat it as feedback—not permission to race to the remaining ceiling.',
            },
            {
              heading: 'Events are at-least-once; make the handler convergent',
              body: 'Platform events and Change Data Capture can be consumed through Salesforce Pub/Sub API. Store replay progress only after durable handling, expect redelivery, and understand each event’s retention window. A replay ID is an opaque position, not a business identifier. Partitioning and multiple consumers can change arrival order, so use an entity version or event timestamp when stale updates must not overwrite newer state.\n\nUse a durable inbox keyed by the event’s stable business/event identifier. Claim work atomically, distinguish processing/completed/failed states, and retain records at least as long as redelivery is possible. Pair that with Salesforce external-ID upserts so a crash after the remote write but before local completion converges on retry. For outbound events coupled to a local database change, write an outbox row in the same local transaction and publish it asynchronously; never claim exactly-once delivery across a database, broker, and Salesforce.',
              code: {
                language: 'java',
                snippet:
                  'import org.springframework.stereotype.Service;\n\n@Service\nfinal class AccountChangedHandler {\n    private final EventInbox inbox;\n    private final SalesforceAccountGateway gateway;\n\n    AccountChangedHandler(EventInbox inbox, SalesforceAccountGateway gateway) {\n        this.inbox = inbox;\n        this.gateway = gateway;\n    }\n\n    HandlingResult handle(AccountChanged event) {\n        if (!inbox.claim(event.eventId())) {\n            return HandlingResult.DUPLICATE;\n        }\n        try {\n            gateway.upsertByExternalId(event.change());\n            inbox.complete(event.eventId());\n            return HandlingResult.APPLIED;\n        } catch (RuntimeException failure) {\n            inbox.markFailed(event.eventId(), failure.getClass().getSimpleName());\n            throw failure;\n        }\n    }\n}\n\nrecord AccountChanged(String eventId, AccountChange change) {}\n\nenum HandlingResult { APPLIED, DUPLICATE }\n\ninterface EventInbox {\n    boolean claim(String eventId);\n    void complete(String eventId);\n    void markFailed(String eventId, String failureType);\n}',
                caption:
                  'The durable inbox suppresses completed replays; external-ID upsert makes an unknown remote outcome converge on retry.',
              },
            },
            {
              heading: 'Deploy for replacement, draining, and diagnosis',
              body: 'Produce one immutable executable artifact or container image, identify it by digest, and promote it through environments. Run as a non-root user with a read-only filesystem where practical, mount secrets at runtime, set JVM/container memory deliberately, and emit build identity in the info endpoint. Use multiple replicas only after event partitioning and idempotency are correct.\n\nLiveness should fail only when restart can help. Readiness should stop new work during startup, dependency incapacity, or shutdown. On termination, stop polling or accepting HTTP, finish or safely abandon in-flight work within a grace period, persist acknowledgements only after completion, and close executors and clients. A rolling or canary deployment needs compatibility across old and new message/schema versions, dashboards for errors, latency, queue age, retries, and quota, plus an automatic or practiced rollback decision.',
              code: {
                language: 'yaml',
                snippet:
                  'server:\n  shutdown: graceful\n\nspring:\n  lifecycle:\n    timeout-per-shutdown-phase: ${SHUTDOWN_TIMEOUT:30s}\n\nmanagement:\n  endpoint:\n    health:\n      probes:\n        enabled: true\n  endpoints:\n    web:\n      exposure:\n        include: health,info,metrics,prometheus\n\nintegration:\n  salesforce:\n    instance-url: ${SALESFORCE_INSTANCE_URL}\n    api-version: ${SALESFORCE_API_VERSION}\n    connect-timeout: ${SALESFORCE_CONNECT_TIMEOUT:3s}\n    request-timeout: ${SALESFORCE_REQUEST_TIMEOUT:20s}\n    max-attempts: ${SALESFORCE_MAX_ATTEMPTS:4}\n    initial-backoff: ${SALESFORCE_INITIAL_BACKOFF:250ms}\n    max-backoff: ${SALESFORCE_MAX_BACKOFF:10s}',
                caption:
                  'Deployment controls lifecycle and policy through validated environment configuration, without rebuilding the artifact.',
              },
            },
          ],
          realWorld: {
            title:
              'An event-driven account service rides through a Salesforce incident',
            scenario:
              'A Spring Boot consumer processed account events with unbounded concurrency and immediate retries. During a Salesforce slowdown, hundreds of replicas retried together, exhausted the daily API allocation, acknowledged some messages before writes completed, and created duplicates after restart.',
            solution:
              'The service introduced a bounded bulkhead, capped exponential backoff with full jitter, Retry-After support, and quota telemetry. A durable inbox claimed events, Salesforce updates became external-ID upserts, acknowledgements followed completion, and graceful shutdown stopped intake before draining in-flight work.',
            outcome:
              'During the next outage the queue grew predictably without exhausting the quota, recovery drained at a controlled rate, replay produced no duplicate accounts, and canary dashboards gave operators a clear rollback signal.',
          },
          keyTakeaways: [
            'Let Spring Boot compose adapters around a framework-independent core and validated typed settings',
            'Retry only transient, replay-safe work with deadlines, capped backoff, jitter, and Retry-After',
            'Bound concurrency and shape demand before Salesforce quotas become an incident',
            'Combine a durable inbox with external-ID upserts for convergent at-least-once event handling',
            'Deploy immutable artifacts with graceful draining, meaningful probes, telemetry, and rollback controls',
          ],
          resources: [
            {
              title: 'Spring Boot Reference',
              url: 'https://docs.spring.io/spring-boot/reference/',
              source: 'other',
              note: 'Official configuration, lifecycle, testing, and operations reference',
            },
            {
              title: 'Spring REST Clients',
              url: 'https://docs.spring.io/spring-framework/reference/integration/rest-clients.html',
              source: 'other',
              note: 'Official synchronous and reactive HTTP client guidance',
            },
            {
              title: 'Salesforce Pub/Sub API',
              url: 'https://developer.salesforce.com/docs/platform/pub-sub-api/overview',
              source: 'developer',
              note: 'Official event subscription, publishing, and replay model',
            },
            {
              title: 'Salesforce API Usage Headers',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/headers_api_usage.htm',
              source: 'developer',
              note: 'Official Sforce-Limit-Info response-header behavior',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'javaeng-integration-q1',
          topic: 'OAuth and JWT',
          prompt:
            'In Salesforce OAuth JWT bearer flow, what does the Java service send to Salesforce?',
          options: [
            'Its private key so Salesforce can sign a token',
            'A short-lived assertion signed by its private key',
            'A permanent access token embedded in the JAR',
            'The integration user’s plaintext password on every API call',
          ],
          correctIndex: 1,
          explanation:
            'The client signs a short-lived JWT assertion locally; Salesforce validates it with the Connected App certificate. The private key and passwords are not sent, and access tokens must not be embedded in artifacts.',
        },
        {
          id: 'javaeng-integration-q2',
          topic: 'OAuth token use',
          prompt:
            'Where should API calls go after a successful Salesforce token response?',
          options: [
            'Always to login.salesforce.com',
            'To the instance_url returned with the token',
            'To the certificate’s issuer URL',
            'To any Salesforce host found through a web search',
          ],
          correctIndex: 1,
          explanation:
            'The returned instance_url identifies the correct Salesforce instance for API calls. The login host handles authentication; certificate metadata and arbitrary hosts are not API routing instructions.',
        },
        {
          id: 'javaeng-integration-q3',
          topic: 'API selection',
          prompt:
            'Which API is the best starting point for ingesting several million rows asynchronously?',
          options: [
            'One REST create request per row',
            'A single unbounded Composite request',
            'Bulk API 2.0 ingest',
            'Apex SOAP login repeated for each row',
          ],
          correctIndex: 2,
          explanation:
            'Bulk API 2.0 is designed for large asynchronous ingest jobs with result handling. Per-row REST wastes round trips, Composite has bounded request shape, and repeated login is neither an ingest strategy nor safe token management.',
        },
        {
          id: 'javaeng-integration-q4',
          topic: 'Pagination',
          prompt:
            'A Salesforce query response has done=false. What should the client do next?',
          options: [
            'Repeat the original SOQL and discard duplicates',
            'Increment an undocumented page number',
            'Resolve and request the supplied nextRecordsUrl',
            'Assume totalSize means all records are already present',
          ],
          correctIndex: 2,
          explanation:
            'Salesforce supplies nextRecordsUrl with its opaque query locator. Rebuilding pagination can skip or duplicate records, while totalSize describes the result size rather than the current page contents.',
        },
        {
          id: 'javaeng-integration-q5',
          topic: 'Retries',
          prompt:
            'Which failure should normally NOT enter an immediate exponential retry loop?',
          options: [
            'A transient connection reset before a safe idempotent request completes',
            'A selected temporary 503 response',
            'A permanent field-validation error in the request',
            'A throttling response with Retry-After',
          ],
          correctIndex: 2,
          explanation:
            'Retry cannot repair invalid data; it wastes quota and delays diagnosis. Transient transport and selected server failures may be retried when safe, while throttling should honor Retry-After and the overall deadline.',
        },
        {
          id: 'javaeng-integration-q6',
          topic: 'Idempotency',
          prompt:
            'Why pair a durable event inbox with Salesforce external-ID upsert?',
          options: [
            'To guarantee exactly-once delivery across every system',
            'To make redelivery detectable and repeated remote writes converge',
            'To avoid storing any event state',
            'To turn a replay ID into a Salesforce record ID',
          ],
          correctIndex: 1,
          explanation:
            'The inbox records handling state, and external-ID upsert targets the same logical record after an unknown outcome. This supports convergent at-least-once processing; it does not create global exactly-once delivery or eliminate state.',
        },
        {
          id: 'javaeng-integration-q7',
          topic: 'Rate limits',
          prompt: 'What is the safest interpretation of Sforce-Limit-Info?',
          options: [
            'A target telling every replica to consume the remainder immediately',
            'Feedback for quota monitoring and demand shaping',
            'Proof that the next request cannot be throttled',
            'A replacement for application-level concurrency limits',
          ],
          correctIndex: 1,
          explanation:
            'The header provides usage feedback for telemetry and control. It is not a reservation, does not account for races across every caller, and does not replace bulkheads or rate shaping.',
        },
        {
          id: 'javaeng-integration-q8',
          topic: 'Deployment',
          prompt:
            'What should a graceful shutdown do first for an event-consuming integration?',
          options: [
            'Acknowledge every buffered event immediately',
            'Delete the idempotency inbox',
            'Stop taking new work, then drain or safely release in-flight work',
            'Disable liveness permanently before the process starts',
          ],
          correctIndex: 2,
          explanation:
            'Stopping intake bounds the drain set; completed work can then be acknowledged and unfinished work safely redelivered. Premature acknowledgement loses work, deleting state creates duplicates, and probe misuse does not implement lifecycle safety.',
        },
      ],
    },
  ],
};
