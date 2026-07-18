# Java Programming — Training Material & Video Scripts

> Generated from the Academy curriculum by `scripts/generate-training-docs.ts` — do not edit by hand.
> Update the curriculum under `apps/api/src/modules/learning/curriculum/` and re-run `npm run docs:training`.

**Level:** Intermediate · **Category:** Programming & platform skills · **Badge:** Java Practitioner · **Modules:** 3 · **Lessons:** 9 · **Estimated effort:** ~7h

Java powers the middleware, ETL jobs, and enterprise services that sit next to almost every Salesforce org — and Apex itself is deliberately Java-like, so every hour here sharpens your Apex too. This path covers the platform and syntax, object-oriented design with interfaces and collections, and the practical layer: exceptions, HTTP + JSON integration against Salesforce APIs, and building/testing with Maven and JUnit.

**Skills:** JVM & core syntax · OO design & interfaces · Collections & generics · HTTP, JSON, Maven & JUnit

## Contents

- **Module 1: Java Fundamentals**
  - Lesson 1.1: The Java platform: JVM, JDK, and your first class
  - Lesson 1.2: Types, operators, and control flow
  - Lesson 1.3: Methods, classes, and objects
- **Module 2: Object-Oriented Java**
  - Lesson 2.1: Inheritance and polymorphism
  - Lesson 2.2: Interfaces and clean contracts
  - Lesson 2.3: Collections, generics, and streams
- **Module 3: Practical Java: Errors, Integration & Tests**
  - Lesson 3.1: Exceptions and robust error handling
  - Lesson 3.2: HTTP + JSON: calling the Salesforce API from Java
  - Lesson 3.3: Building and testing: Maven and JUnit

## Module 1: Java Fundamentals

The JVM mental model, static typing, control flow, and methods — plus a running comparison with Apex so knowledge transfers both ways.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 1.1 — The Java platform: JVM, JDK, and your first class

**Lesson ID:** `java-platform-first-class` · **Reading time:** 15 min · **Video:** 5:00

> What actually happens between .java source and a running program, why "write once, run anywhere" matters, and where Java sits in a Salesforce landscape.

**Learning objectives**

- Distinguish the JDK, JRE, and JVM and what each is for
- Compile and run a minimal Java program
- Explain where Java appears around a Salesforce implementation

#### Concept explanation

##### JVM, JRE, JDK — three letters, one pipeline

Java source (.java) is compiled by javac into bytecode (.class) — a portable instruction format. The Java Virtual Machine (JVM) executes that bytecode on any operating system, applying just-in-time compilation for speed. The JRE is the runtime (JVM + core libraries); the JDK is the developer kit (JRE + compiler + tools) — you install the JDK, servers may run just a runtime.

This is "write once, run anywhere": the same .jar runs on a developer's Mac, a Linux container, and a Windows server. It is also why this platform's code-analysis tooling (PMD inside Salesforce Code Analyzer) just needs "Java 11+" — bytecode does not care about your OS.

##### Your first class, and why it looks like Apex

Everything in Java lives in a class. A program starts at public static void main(String[] args). Statements end with semicolons, blocks use braces, and — unlike JavaScript — every variable has a declared type checked at COMPILE time. Errors surface before the program ever runs.

If you know Apex, this is home territory: Apex's syntax, type system, and class model were designed after Java. The differences are environmental — Apex runs multi-tenant with governor limits and built-in SOQL; Java runs wherever you deploy it with no such guardrails and a vastly larger ecosystem.

*A complete Java program: one class, one main method, typed variables.*

```java
public class OrgReport {
    public static void main(String[] args) {
        String orgAlias = "uat-full";
        int connectedUsers = 42;
        boolean healthy = connectedUsers > 0;

        System.out.printf("Org %s healthy=%b users=%d%n",
                orgAlias, healthy, connectedUsers);
    }
}
// Compile and run:
//   javac OrgReport.java
//   java OrgReport
```

##### Where Java lives around Salesforce

Look around any enterprise Salesforce implementation and you will find Java: MuleSoft runs on the JVM, ETL and middleware services that call Salesforce APIs are commonly Spring Boot applications, Kafka consumers that process platform events are Java, and static-analysis tooling for Apex (PMD) is Java. Data engineering teams run JVM-based Spark jobs against Salesforce extracts.

For you this means two payoffs: reading Java lets you debug the OTHER side of an integration instead of waiting on another team, and writing basic Java lets you build the small connectors and utilities that glue a DevOps pipeline together.

#### Real-world example — Debugging an integration from both sides

- **Scenario:** Orders created in Salesforce arrived in the ERP with missing shipping data. The middleware team insisted "Salesforce sends it wrong"; the Salesforce team insisted the payload was correct. Tickets bounced between teams for two weeks.
- **Solution:** A Salesforce developer with basic Java literacy read the middleware's transformation class and found it parsing ShippingAddress with a field name from a legacy API version. She wrote a one-line fix and a failing-then-passing JUnit test to prove it.
- **Outcome:** The two-week ping-pong ended in an afternoon. The developer became the designated "integration translator", and cross-language literacy became a hiring criterion for the platform team.

#### Key takeaways

- javac compiles source to bytecode; the JVM runs it anywhere
- JDK = compiler + tools; JRE/runtime is what servers need
- Java is statically typed — whole bug classes die at compile time
- Apex is Java-shaped: learning one strengthens the other

#### Go deeper

- [Dev.java: Getting started](https://dev.java/learn/getting-started/) — Oracle's modern learning portal
- [The Java Tutorials](https://docs.oracle.com/javase/tutorial/)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why The Java platform: JVM, JDK, and your first class matters | intro |
| 2 | 0:30–1:15 | JVM, JRE, JDK — three letters, one pipeline | concept |
| 3 | 1:15–2:00 | Your first class, and why it looks like Apex | concept |
| 4 | 2:00–2:45 | Code walk-through — Your first class, and why it looks like Apex | demo |
| 5 | 2:45–3:30 | Where Java lives around Salesforce | demo |
| 6 | 3:30–4:15 | Real story — Debugging an integration from both sides | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why The Java platform: JVM, JDK, and your first class matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on The Java platform: JVM, JDK, and your first class. What actually happens between .java source and a running program, why "write once, run anywhere" matters, and where Java sits in a Salesforce landscape.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Java Fundamentals

**[0:30–1:15] JVM, JRE, JDK — three letters, one pipeline**

- **Narration (word-for-word):** Java source (.java) is compiled by javac into bytecode (.class) — a portable instruction format. The Java Virtual Machine (JVM) executes that bytecode on any operating system, applying just-in-time compilation for speed. The JRE is the runtime (JVM + core libraries); the JDK is the developer kit (JRE + compiler + tools) — you install the JDK, servers may run just a runtime. This is "write once, run anywhere": the same .jar runs on a developer's Mac, a Linux container, and a Windows server. It is also why this platform's code-analysis tooling (PMD inside Salesforce Code Analyzer) just needs "Java 11+" — bytecode does not care about your OS.
- **On screen:** Animated explainer diagram for "JVM, JRE, JDK — three letters, one pipeline": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Your first class, and why it looks like Apex**

- **Narration (word-for-word):** Everything in Java lives in a class. A program starts at public static void main(String[] args). Statements end with semicolons, blocks use braces, and — unlike JavaScript — every variable has a declared type checked at COMPILE time. Errors surface before the program ever runs. If you know Apex, this is home territory: Apex's syntax, type system, and class model were designed after Java. The differences are environmental — Apex runs multi-tenant with governor limits and built-in SOQL; Java runs wherever you deploy it with no such guardrails and a vastly larger ecosystem.
- **On screen:** Animated explainer diagram for "Your first class, and why it looks like Apex": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Your first class, and why it looks like Apex**

- **Narration (word-for-word):** Now watch the same idea in code. A complete Java program: one class, one main method, typed variables. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:45–3:30] Where Java lives around Salesforce**

- **Narration (word-for-word):** Let's actually do this together. Look around any enterprise Salesforce implementation and you will find Java: MuleSoft runs on the JVM, ETL and middleware services that call Salesforce APIs are commonly Spring Boot applications, Kafka consumers that process platform events are Java, and static-analysis tooling for Apex (PMD) is Java. Data engineering teams run JVM-based Spark jobs against Salesforce extracts. For you this means two payoffs: reading Java lets you debug the OTHER side of an integration instead of waiting on another team, and writing basic Java lets you build the small connectors and utilities that glue a DevOps pipeline together.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Look around any enterprise Salesforce implementation and you will find Java: MuleSoft runs on the JVM, ETL and middleware services that call Salesforce APIs are commonly Spring Boot applications, Kafka consumers that process platform events are Java, and static-analysis tooling for Apex (PMD) is Java.
  2. Data engineering teams run JVM-based Spark jobs against Salesforce extracts.

**[3:30–4:15] Real story — Debugging an integration from both sides**

- **Narration (word-for-word):** Here is why this matters in the real world. Orders created in Salesforce arrived in the ERP with missing shipping data. The middleware team insisted "Salesforce sends it wrong"; the Salesforce team insisted the payload was correct. Tickets bounced between teams for two weeks. What did they do? A Salesforce developer with basic Java literacy read the middleware's transformation class and found it parsing ShippingAddress with a field name from a legacy API version. She wrote a one-line fix and a failing-then-passing JUnit test to prove it. And the payoff: The two-week ping-pong ended in an afternoon.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Debugging an integration from both sides

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. javac compiles source to bytecode; the JVM runs it anywhere. JDK = compiler + tools; JRE/runtime is what servers need. Java is statically typed — whole bug classes die at compile time. Apex is Java-shaped: learning one strengthens the other.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is The Java platform: JVM, JDK, and your first class — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.2 — Types, operators, and control flow

**Lesson ID:** `java-types-control-flow` · **Reading time:** 18 min · **Video:** 5:00

> Primitives vs objects, strings done right, and the full branching/looping toolkit including modern switch.

**Learning objectives**

- Choose between primitives and wrapper types deliberately
- Compare strings correctly and build them efficiently
- Use if/else, switch expressions, and all loop forms

#### Concept explanation

##### Primitives, wrappers, and var

Java's primitives (int, long, double, boolean, char…) hold raw values with no methods — fast and never null. Each has an object wrapper (Integer, Long, Double, Boolean) used in collections and when "no value" must be representable. Autoboxing converts between them silently, but a null Integer unboxed into an int throws a NullPointerException — a classic production bug when database columns are nullable.

Since Java 10, var infers LOCAL variable types (var orgs = new ArrayList<String>()). The type is still static and fixed — var is inference, not dynamism. Use it when the right-hand side makes the type obvious.

##### Strings: equals, immutability, StringBuilder

Strings are immutable objects. Compare CONTENT with .equals() (or equalsIgnoreCase) — the == operator compares references and passes tests only by interning luck, then fails in production. This is the single most common Java beginner bug.

Because each concatenation allocates a new string, building large text in loops uses StringBuilder. Modern formatting favors String.format / formatted, and text blocks (""" … """) hold multi-line JSON/SQL templates cleanly — handy for request payloads in integration code.

*Content equality with equals(); StringBuilder for loops. Constant-first avoids NPEs.*

```java
String status = fetchStatus();          // may come from an API

if ("SUCCEEDED".equals(status)) {        // equals(), constant first = null-safe
    System.out.println("Deploy done");
}

StringBuilder report = new StringBuilder();
for (String failure : failures) {
    report.append("- ").append(failure).append('\n');
}
System.out.println(report);
```

##### Branching and looping, including modern switch

if/else and the classic for, enhanced for (for (Order o : orders)), while, and do/while behave as you expect from Apex. Modern Java adds switch EXPRESSIONS with arrows that return values and never fall through: String label = switch (status) { case PENDING -> "Waiting"; case FAILED -> "Fix required"; default -> "OK"; }.

Two habits from day one: keep loop bodies small (extract methods aggressively) and prefer enhanced-for unless you truly need the index. When a loop is really a transformation, the collections module will replace it with streams — but master explicit loops first.

#### Real-world example — The == comparison that only failed in production

- **Scenario:** A payment-status sync compared API status strings with ==. In unit tests the literals were interned so it passed; in production the strings arrived from HTTP responses as distinct objects, every comparison was false, and thousands of "completed" payments were re-queued for retry all weekend.
- **Solution:** All comparisons moved to constant-first equals() ("COMPLETED".equals(status)), an integration test with genuinely deserialized strings was added, and the team enabled a static-analysis rule that flags == on strings.
- **Outcome:** The retry storm ended, duplicate-processing safeguards were added, and the static-analysis gate has blocked the same bug pattern four times since — at review time instead of during a weekend incident.

#### Key takeaways

- Primitives are fast and never null; wrappers can be null — unbox carefully
- Compare strings with equals(), never == ; put the constant first
- StringBuilder for building text in loops
- Switch expressions return values and never fall through

#### Go deeper

- [Dev.java: Language basics](https://dev.java/learn/language-basics/)
- [Baeldung: Java String comparison](https://www.baeldung.com/java-compare-strings)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Types, operators, and control flow matters | intro |
| 2 | 0:30–1:15 | Primitives, wrappers, and var | concept |
| 3 | 1:15–2:00 | Strings: equals, immutability, StringBuilder | concept |
| 4 | 2:00–2:45 | Code walk-through — Strings: equals, immutability, StringBuilder | demo |
| 5 | 2:45–3:30 | Branching and looping, including modern switch | concept |
| 6 | 3:30–4:15 | Real story — The == comparison that only failed in production | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Types, operators, and control flow matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on Types, operators, and control flow. Primitives vs objects, strings done right, and the full branching/looping toolkit including modern switch. By the end of this video you will be able to choose between primitives and wrapper types deliberately; compare strings correctly and build them efficiently; use if/else, switch expressions, and all loop forms.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Java Fundamentals

**[0:30–1:15] Primitives, wrappers, and var**

- **Narration (word-for-word):** Java's primitives (int, long, double, boolean, char…) hold raw values with no methods — fast and never null. Each has an object wrapper (Integer, Long, Double, Boolean) used in collections and when "no value" must be representable. Autoboxing converts between them silently, but a null Integer unboxed into an int throws a NullPointerException — a classic production bug when database columns are nullable. Since Java 10, var infers LOCAL variable types (var orgs = new ArrayList<String>()). The type is still static and fixed — var is inference, not dynamism. Use it when the right-hand side makes the type obvious.
- **On screen:** Animated explainer diagram for "Primitives, wrappers, and var": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Strings: equals, immutability, StringBuilder**

- **Narration (word-for-word):** Strings are immutable objects. Compare CONTENT with .equals() (or equalsIgnoreCase) — the == operator compares references and passes tests only by interning luck, then fails in production. This is the single most common Java beginner bug. Because each concatenation allocates a new string, building large text in loops uses StringBuilder. Modern formatting favors String.format / formatted, and text blocks (""" … """) hold multi-line JSON/SQL templates cleanly — handy for request payloads in integration code.
- **On screen:** Animated explainer diagram for "Strings: equals, immutability, StringBuilder": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Strings: equals, immutability, StringBuilder**

- **Narration (word-for-word):** Now watch the same idea in code. Content equality with equals(); StringBuilder for loops. Constant-first avoids NPEs. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:45–3:30] Branching and looping, including modern switch**

- **Narration (word-for-word):** if/else and the classic for, enhanced for (for (Order o : orders)), while, and do/while behave as you expect from Apex. Modern Java adds switch EXPRESSIONS with arrows that return values and never fall through: String label = switch (status) { case PENDING -> "Waiting"; case FAILED -> "Fix required"; default -> "OK"; }. Two habits from day one: keep loop bodies small (extract methods aggressively) and prefer enhanced-for unless you truly need the index. When a loop is really a transformation, the collections module will replace it with streams — but master explicit loops first.
- **On screen:** Animated explainer diagram for "Branching and looping, including modern switch": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The == comparison that only failed in production**

- **Narration (word-for-word):** Here is why this matters in the real world. A payment-status sync compared API status strings with ==. In unit tests the literals were interned so it passed; in production the strings arrived from HTTP responses as distinct objects, every comparison was false, and thousands of "completed" payments were re-queued for retry all weekend. What did they do? All comparisons moved to constant-first equals() ("COMPLETED".equals(status)), an integration test with genuinely deserialized strings was added, and the team enabled a static-analysis rule that flags == on strings.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The == comparison that only failed in production

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Primitives are fast and never null; wrappers can be null — unbox carefully. Compare strings with equals(), never == ; put the constant first. StringBuilder for building text in loops. Switch expressions return values and never fall through.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Types, operators, and control flow — the idea, the practice, and the real-world payoff. Head back to the Java Fundamentals module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 1.3 — Methods, classes, and objects

**Lesson ID:** `java-methods-classes-objects` · **Reading time:** 18 min · **Video:** 5:00

> Designing a class properly: constructors, encapsulation, static vs instance, and value objects with records.

**Learning objectives**

- Write classes with constructors, fields, and encapsulated access
- Decide between static and instance members correctly
- Model immutable data with records

#### Concept explanation

##### Objects are state + behavior; constructors make them valid

A class declares fields (state) and methods (behavior); new invokes a constructor whose job is to establish a VALID object — required values provided, invariants checked, exceptions thrown on nonsense (a deployment with no target org should never exist as an object).

Encapsulation means fields are private and access flows through methods, so the class controls its own consistency. The getter/setter convention is standard, but do not add setters reflexively: an object whose every field is mutable from outside is just a struct with ceremony.

*Final fields for identity, validation in the constructor, state changed only through methods.*

```java
public class Deployment {
    private final String id;
    private final String targetOrg;
    private DeployStatus status = DeployStatus.PENDING;

    public Deployment(String id, String targetOrg) {
        if (targetOrg == null || targetOrg.isBlank()) {
            throw new IllegalArgumentException("targetOrg is required");
        }
        this.id = id;
        this.targetOrg = targetOrg;
    }

    public void markRunning() { this.status = DeployStatus.RUNNING; }
    public DeployStatus status() { return status; }
    public String targetOrg() { return targetOrg; }
}
```

##### static vs instance — whose data is it?

Instance members belong to each object (this deployment's status); static members belong to the class itself (a shared counter, a factory method, a constant like MAX_RETRIES). If a method uses no instance state, it can be static — utility methods usually are.

Resist static MUTABLE state: it is global state wearing a uniform, painful to test and dangerous under concurrency. Constants (static final) are always fine. Apex developers will recognize this instinct — static variables per-transaction in Apex become static-per-JVM in Java, a much longer lifetime with much more room for surprise.

##### Records: immutable data in one line

Most integration code shuttles data shapes around: an org summary, a deploy request, an API result. A record declares an immutable carrier in one line — public record OrgSummary(String alias, String instanceUrl, boolean sandbox) {} — and the compiler generates the constructor, accessors, equals/hashCode, and toString.

Records communicate intent ("this is data, not behavior") and remove boilerplate bugs (a hand-written equals that missed a field). Pair records for data with classes for behavior-rich domain objects and you have a modern, clean codebase shape.

#### Real-world example — The connector nobody could unit test

- **Scenario:** An in-house Salesforce connector kept all configuration in static mutable fields, set once at startup by whichever class loaded first. Tests could not run in parallel (they overwrote each other's config), and a memory leak in one batch job changed credentials for every subsequent job in the JVM.
- **Solution:** Configuration became an immutable record passed into constructors; the connector became an instance with its own state. Statics were reduced to true constants and a stateless factory method.
- **Outcome:** Tests ran in parallel and in any order, two hidden config-bleed bugs surfaced immediately and were fixed, and startup wiring became explicit instead of load-order magic.

#### Key takeaways

- Constructors enforce validity — invalid objects should be unconstructible
- Encapsulate: private fields, behavior-driven methods, no reflexive setters
- static = belongs to the class; avoid static mutable state
- Records model immutable data with generated equals/hashCode/toString

#### Go deeper

- [Dev.java: Classes and objects](https://dev.java/learn/classes-objects/)
- [Baeldung: Java records](https://www.baeldung.com/java-record-keyword)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Methods, classes, and objects matters | intro |
| 2 | 0:30–1:15 | Objects are state + behavior; constructors make them valid | concept |
| 3 | 1:15–2:00 | Code walk-through — Objects are state + behavior; constructors make them valid | demo |
| 4 | 2:00–2:45 | static vs instance — whose data is it? | concept |
| 5 | 2:45–3:30 | Records: immutable data in one line | concept |
| 6 | 3:30–4:15 | Real story — The connector nobody could unit test | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Methods, classes, and objects matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on Methods, classes, and objects. Designing a class properly: constructors, encapsulation, static vs instance, and value objects with records. By the end of this video you will be able to write classes with constructors, fields, and encapsulated access; decide between static and instance members correctly; model immutable data with records.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Java Fundamentals

**[0:30–1:15] Objects are state + behavior; constructors make them valid**

- **Narration (word-for-word):** A class declares fields (state) and methods (behavior); new invokes a constructor whose job is to establish a VALID object — required values provided, invariants checked, exceptions thrown on nonsense (a deployment with no target org should never exist as an object). Encapsulation means fields are private and access flows through methods, so the class controls its own consistency. The getter/setter convention is standard, but do not add setters reflexively: an object whose every field is mutable from outside is just a struct with ceremony.
- **On screen:** Animated explainer diagram for "Objects are state + behavior; constructors make them valid": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Code walk-through — Objects are state + behavior; constructors make them valid**

- **Narration (word-for-word):** Now watch the same idea in code. Final fields for identity, validation in the constructor, state changed only through methods. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:00–2:45] static vs instance — whose data is it?**

- **Narration (word-for-word):** Instance members belong to each object (this deployment's status); static members belong to the class itself (a shared counter, a factory method, a constant like MAX_RETRIES). If a method uses no instance state, it can be static — utility methods usually are. Resist static MUTABLE state: it is global state wearing a uniform, painful to test and dangerous under concurrency. Constants (static final) are always fine. Apex developers will recognize this instinct — static variables per-transaction in Apex become static-per-JVM in Java, a much longer lifetime with much more room for surprise.
- **On screen:** Animated explainer diagram for "static vs instance — whose data is it?": the key entities appear and connect exactly as the narration names them.

**[2:45–3:30] Records: immutable data in one line**

- **Narration (word-for-word):** Most integration code shuttles data shapes around: an org summary, a deploy request, an API result. A record declares an immutable carrier in one line — public record OrgSummary(String alias, String instanceUrl, boolean sandbox) {} — and the compiler generates the constructor, accessors, equals/hashCode, and toString. Records communicate intent ("this is data, not behavior") and remove boilerplate bugs (a hand-written equals that missed a field). Pair records for data with classes for behavior-rich domain objects and you have a modern, clean codebase shape.
- **On screen:** Animated explainer diagram for "Records: immutable data in one line": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The connector nobody could unit test**

- **Narration (word-for-word):** Here is why this matters in the real world. An in-house Salesforce connector kept all configuration in static mutable fields, set once at startup by whichever class loaded first. Tests could not run in parallel (they overwrote each other's config), and a memory leak in one batch job changed credentials for every subsequent job in the JVM. What did they do? Configuration became an immutable record passed into constructors; the connector became an instance with its own state. Statics were reduced to true constants and a stateless factory method.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The connector nobody could unit test

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Constructors enforce validity — invalid objects should be unconstructible. Encapsulate: private fields, behavior-driven methods, no reflexive setters. static = belongs to the class; avoid static mutable state. Records model immutable data with generated equals/hashCode/toString.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Methods, classes, and objects — the idea, the practice, and the real-world payoff. Head back to the Java Fundamentals module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 2: Object-Oriented Java

Inheritance and polymorphism used well, interfaces as contracts, and the collections framework with generics and streams.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 2.1 — Inheritance and polymorphism

**Lesson ID:** `java-inheritance-polymorphism` · **Reading time:** 18 min · **Video:** 5:00

> extends, method overriding, abstract classes, and why composition usually beats deep hierarchies.

**Learning objectives**

- Use extends and @Override correctly
- Explain dynamic dispatch with a concrete example
- Choose between inheritance and composition deliberately

#### Concept explanation

##### extends and overriding

A subclass inherits its parent's fields and methods and may OVERRIDE behavior: class SandboxOrg extends SalesforceOrg with its own refresh() implementation. Always annotate @Override — the compiler then catches signature typos that would otherwise silently create a NEW method instead of overriding.

super calls the parent (super(...) in constructors, super.method() in bodies). Abstract classes sit between interface and concrete class: they define shared logic plus abstract methods children MUST implement — the template-method pattern that batch frameworks (and Apex's Database.Batchable pattern) are built on.

##### Polymorphism: one call, many behaviors

Declare variables by the general type and let the runtime dispatch to the actual object's override: for (SalesforceOrg org : orgs) { org.refresh(); } runs sandbox logic for sandboxes and scratch-org logic for scratch orgs — no instanceof ladder, no switch on type.

This is THE mechanism that lets frameworks call your code: a deploy pipeline iterates List<PipelineStep> and each step's execute() does something different. New behavior = new subclass; existing pipeline code does not change. That is the open/closed principle in one sentence.

*Template method + polymorphism: the pipeline loop is closed; the step list is open.*

```java
public abstract class PipelineStep {
    public final void run() {                 // template method
        System.out.println("Starting " + name());
        execute();
        System.out.println("Finished " + name());
    }
    protected abstract String name();
    protected abstract void execute();
}

public class ValidateStep extends PipelineStep {
    @Override protected String name() { return "Validate metadata"; }
    @Override protected void execute() { /* check-only deploy */ }
}

public class TestStep extends PipelineStep {
    @Override protected String name() { return "Run Apex tests"; }
    @Override protected void execute() { /* run tests, gate on coverage */ }
}

// The pipeline never changes when new steps are added:
for (PipelineStep step : steps) { step.run(); }
```

##### Prefer composition; inherit narrowly

Inheritance is a strong coupling: children depend on parent internals, and deep hierarchies (A extends B extends C extends D) turn every base change into a minefield. Composition — a class HOLDING collaborators and delegating to them — is looser and easier to test: a DeployService that has a MetadataClient and a TestRunner beats one that inherits from AbstractDeployBase.

A practical rule: inherit only for a genuine is-a relationship with stable, framework-like base behavior (as in the template method above); compose for everything else. When in doubt, compose.

#### Real-world example — The base class everyone feared

- **Scenario:** An integration codebase had AbstractSyncJob with four levels of subclasses. A one-line change to the base class's retry logic altered timing for 23 jobs; two ran head-to-head with a nightly ERP window and corrupted a reconciliation. Nobody could predict blast radius, so nobody touched the base class.
- **Solution:** The team flattened the hierarchy: retry, logging, and scheduling became injected collaborators (composition), and only the genuine template — "extract, transform, load, in that order" — remained as a two-level abstract class.
- **Outcome:** Blast radius became visible in each job's constructor signature, per-job retry tuning became possible without touching shared code, and base-class change requests stopped requiring a week of regression testing.

#### Key takeaways

- Always @Override — the compiler catches signature mistakes
- Polymorphism removes instanceof ladders: one loop, many behaviors
- Template method = shared skeleton in an abstract class, steps in children
- Default to composition; reserve inheritance for true, stable is-a

#### Go deeper

- [Dev.java: Inheritance](https://dev.java/learn/inheritance/)
- [Effective Java (Bloch) — Item: favor composition](https://www.oreilly.com/library/view/effective-java/9780134686097/) — The canonical argument, worth owning

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Inheritance and polymorphism matters | intro |
| 2 | 0:30–1:15 | extends and overriding | concept |
| 3 | 1:15–2:00 | Polymorphism: one call, many behaviors | demo |
| 4 | 2:00–2:45 | Code walk-through — Polymorphism: one call, many behaviors | demo |
| 5 | 2:45–3:30 | Prefer composition; inherit narrowly | concept |
| 6 | 3:30–4:15 | Real story — The base class everyone feared | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Inheritance and polymorphism matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on Inheritance and polymorphism. extends, method overriding, abstract classes, and why composition usually beats deep hierarchies. By the end of this video you will be able to use extends and @Override correctly; explain dynamic dispatch with a concrete example; choose between inheritance and composition deliberately. And stick around — we close with a true-to-life story of a team that lived this exact problem.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Object-Oriented Java

**[0:30–1:15] extends and overriding**

- **Narration (word-for-word):** A subclass inherits its parent's fields and methods and may OVERRIDE behavior: class SandboxOrg extends SalesforceOrg with its own refresh() implementation. Always annotate @Override — the compiler then catches signature typos that would otherwise silently create a NEW method instead of overriding. super calls the parent (super(...) in constructors, super.method() in bodies). Abstract classes sit between interface and concrete class: they define shared logic plus abstract methods children MUST implement — the template-method pattern that batch frameworks (and Apex's Database.Batchable pattern) are built on.
- **On screen:** Animated explainer diagram for "extends and overriding": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Polymorphism: one call, many behaviors**

- **Narration (word-for-word):** Let's actually do this together. Declare variables by the general type and let the runtime dispatch to the actual object's override: for (SalesforceOrg org : orgs) { org.refresh(); } runs sandbox logic for sandboxes and scratch-org logic for scratch orgs — no instanceof ladder, no switch on type. This is THE mechanism that lets frameworks call your code: a deploy pipeline iterates List<PipelineStep> and each step's execute() does something different. New behavior = new subclass; existing pipeline code does not change. That is the open/closed principle in one sentence.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. This is THE mechanism that lets frameworks call your code: a deploy pipeline iterates List<PipelineStep> and each step's execute() does something different.
  2. That is the open/closed principle in one sentence.

**[2:00–2:45] Code walk-through — Polymorphism: one call, many behaviors**

- **Narration (word-for-word):** Now watch the same idea in code. Template method + polymorphism: the pipeline loop is closed; the step list is open. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:45–3:30] Prefer composition; inherit narrowly**

- **Narration (word-for-word):** Inheritance is a strong coupling: children depend on parent internals, and deep hierarchies (A extends B extends C extends D) turn every base change into a minefield. Composition — a class HOLDING collaborators and delegating to them — is looser and easier to test: a DeployService that has a MetadataClient and a TestRunner beats one that inherits from AbstractDeployBase. A practical rule: inherit only for a genuine is-a relationship with stable, framework-like base behavior (as in the template method above); compose for everything else. When in doubt, compose.
- **On screen:** Animated explainer diagram for "Prefer composition; inherit narrowly": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The base class everyone feared**

- **Narration (word-for-word):** Here is why this matters in the real world. An integration codebase had AbstractSyncJob with four levels of subclasses. A one-line change to the base class's retry logic altered timing for 23 jobs; two ran head-to-head with a nightly ERP window and corrupted a reconciliation. Nobody could predict blast radius, so nobody touched the base class. What did they do? The team flattened the hierarchy: retry, logging, and scheduling became injected collaborators (composition), and only the genuine template — "extract, transform, load, in that order" — remained as a two-level abstract class.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The base class everyone feared

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Always @Override — the compiler catches signature mistakes. Polymorphism removes instanceof ladders: one loop, many behaviors. Template method = shared skeleton in an abstract class, steps in children. Default to composition; reserve inheritance for true, stable is-a.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Inheritance and polymorphism — the idea, the practice, and the real-world payoff. Head back to the Object-Oriented Java module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.2 — Interfaces and clean contracts

**Lesson ID:** `java-interfaces-abstraction` · **Reading time:** 18 min · **Video:** 5:00

> Interfaces as capability contracts, functional interfaces with lambdas, and designing for swappable implementations.

**Learning objectives**

- Define and implement interfaces as capability contracts
- Use functional interfaces and lambda expressions
- Design services so implementations can be swapped in tests

#### Concept explanation

##### An interface is a promise, not a place for logic

An interface declares WHAT a type can do — interface MetadataClient { DeployResult deploy(DeployRequest request); } — and classes promise to fulfill it with implements. Callers depend on the interface, never the concrete class, so a SalesforceHttpMetadataClient in production and a FakeMetadataClient in tests are interchangeable.

A class can implement many interfaces (unlike single-class inheritance), which models capabilities cleanly: Comparable, AutoCloseable, and your own domain contracts. Default methods let interfaces evolve without breaking implementors, but keep real logic in classes.

##### Functional interfaces and lambdas

An interface with exactly ONE abstract method is functional, and a lambda can implement it inline: Predicate<Org> isSandbox = org -> org.isSandbox(); Runnable poll = () -> checkStatus(jobId). The JDK ships the core set — Predicate (test), Function (transform), Consumer (accept), Supplier (produce) — and the collections/streams world runs on them.

Method references (Org::alias) are lambdas that name an existing method. If you internalized JavaScript arrow functions in the previous path, lambdas are the same idea with static types: behavior passed as data.

*Depend on the interface; in tests a lambda IS the implementation.*

```java
public interface NotificationChannel {
    void send(String recipient, String message);
}

public class SlackChannel implements NotificationChannel {
    @Override public void send(String recipient, String message) {
        // POST to Slack webhook
    }
}

public class ReleaseNotifier {
    private final NotificationChannel channel;      // depends on the contract
    public ReleaseNotifier(NotificationChannel channel) { this.channel = channel; }

    public void releaseCompleted(String version) {
        channel.send("#releases", "Release " + version + " is live");
    }
}

// In tests — no Slack, no network, still fully exercised:
List<String> sent = new ArrayList<>();
ReleaseNotifier notifier = new ReleaseNotifier((to, msg) -> sent.add(to + ": " + msg));
```

##### Dependency injection without a framework

Passing collaborators into constructors (as above) is dependency injection — the design idea. Frameworks like Spring automate the wiring at scale, but the testability comes from the SHAPE: classes receive interfaces instead of constructing concrete dependencies internally.

The litmus test for your design: can you unit-test the class with no network, no database, and no Salesforce org, purely by handing it fakes? If yes, the contracts are in the right places. This is the same instinct as mocking HTTP callouts in Apex tests with HttpCalloutMock — Java just makes the pattern universal.

#### Real-world example — Tests that needed a live org

- **Scenario:** A middleware team's test suite created real records in a shared Salesforce sandbox. Tests took 40 minutes, failed whenever the sandbox was refreshed or another team's data collided, and engineers began skipping tests to merge — twice shipping regressions the suite would have caught.
- **Solution:** They introduced a SalesforceGateway interface covering the org interactions, injected it into every service, and gave tests an in-memory fake. A thin nightly contract-test suite still hit a real scratch org to verify the gateway itself.
- **Outcome:** The unit suite dropped from 40 minutes to 90 seconds and became deterministic, merges stopped bypassing tests, and sandbox refreshes stopped breaking CI for three teams.

#### Key takeaways

- Interfaces define capability; callers should depend on them, not classes
- One abstract method = functional interface = lambda-implementable
- Constructor injection makes every service testable with fakes
- Keep a thin real-integration suite; make the fast suite org-free

#### Go deeper

- [Dev.java: Interfaces](https://dev.java/learn/interfaces/)
- [Baeldung: Functional interfaces](https://www.baeldung.com/java-8-functional-interfaces)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Interfaces and clean contracts matters | intro |
| 2 | 0:30–1:15 | An interface is a promise, not a place for logic | concept |
| 3 | 1:15–2:00 | Functional interfaces and lambdas | concept |
| 4 | 2:00–2:45 | Code walk-through — Functional interfaces and lambdas | demo |
| 5 | 2:45–3:30 | Dependency injection without a framework | concept |
| 6 | 3:30–4:15 | Real story — Tests that needed a live org | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Interfaces and clean contracts matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on Interfaces and clean contracts. Interfaces as capability contracts, functional interfaces with lambdas, and designing for swappable implementations. By the end of this video you will be able to define and implement interfaces as capability contracts; use functional interfaces and lambda expressions; design services so implementations can be swapped in tests.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Object-Oriented Java

**[0:30–1:15] An interface is a promise, not a place for logic**

- **Narration (word-for-word):** An interface declares WHAT a type can do — interface MetadataClient { DeployResult deploy(DeployRequest request); } — and classes promise to fulfill it with implements. Callers depend on the interface, never the concrete class, so a SalesforceHttpMetadataClient in production and a FakeMetadataClient in tests are interchangeable. A class can implement many interfaces (unlike single-class inheritance), which models capabilities cleanly: Comparable, AutoCloseable, and your own domain contracts. Default methods let interfaces evolve without breaking implementors, but keep real logic in classes.
- **On screen:** Animated explainer diagram for "An interface is a promise, not a place for logic": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] Functional interfaces and lambdas**

- **Narration (word-for-word):** An interface with exactly ONE abstract method is functional, and a lambda can implement it inline: Predicate<Org> isSandbox = org -> org.isSandbox(); Runnable poll = () -> checkStatus(jobId). The JDK ships the core set — Predicate (test), Function (transform), Consumer (accept), Supplier (produce) — and the collections/streams world runs on them. Method references (Org::alias) are lambdas that name an existing method. If you internalized JavaScript arrow functions in the previous path, lambdas are the same idea with static types: behavior passed as data.
- **On screen:** Animated explainer diagram for "Functional interfaces and lambdas": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — Functional interfaces and lambdas**

- **Narration (word-for-word):** Now watch the same idea in code. Depend on the interface; in tests a lambda IS the implementation. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:45–3:30] Dependency injection without a framework**

- **Narration (word-for-word):** Passing collaborators into constructors (as above) is dependency injection — the design idea. Frameworks like Spring automate the wiring at scale, but the testability comes from the SHAPE: classes receive interfaces instead of constructing concrete dependencies internally. The litmus test for your design: can you unit-test the class with no network, no database, and no Salesforce org, purely by handing it fakes? If yes, the contracts are in the right places. This is the same instinct as mocking HTTP callouts in Apex tests with HttpCalloutMock — Java just makes the pattern universal.
- **On screen:** Animated explainer diagram for "Dependency injection without a framework": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — Tests that needed a live org**

- **Narration (word-for-word):** Here is why this matters in the real world. A middleware team's test suite created real records in a shared Salesforce sandbox. Tests took 40 minutes, failed whenever the sandbox was refreshed or another team's data collided, and engineers began skipping tests to merge — twice shipping regressions the suite would have caught. What did they do? They introduced a SalesforceGateway interface covering the org interactions, injected it into every service, and gave tests an in-memory fake. A thin nightly contract-test suite still hit a real scratch org to verify the gateway itself.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** Tests that needed a live org

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Interfaces define capability; callers should depend on them, not classes. One abstract method = functional interface = lambda-implementable. Constructor injection makes every service testable with fakes. Keep a thin real-integration suite; make the fast suite org-free.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Interfaces and clean contracts — the idea, the practice, and the real-world payoff. Head back to the Object-Oriented Java module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 2.3 — Collections, generics, and streams

**Lesson ID:** `java-collections-generics` · **Reading time:** 20 min · **Video:** 5:00

> List/Set/Map chosen correctly, generics that keep you honest, and stream pipelines for transformation-heavy code.

**Learning objectives**

- Choose the right collection (List, Set, Map) and implementation
- Read and write generic type signatures
- Transform data with stream pipelines: filter, map, collect, groupingBy

#### Concept explanation

##### The big three, and how to choose

List (ArrayList) keeps insertion order and allows duplicates — your default sequence. Set (HashSet) enforces uniqueness with O(1) membership checks — perfect for "have I seen this Id?". Map (HashMap) indexes values by key — the Java twin of Apex's Map<Id, SObject> idiom, and the backbone of "query once, look up in the loop".

Variants tune behavior: LinkedHashMap preserves insertion order (stable report output), TreeMap sorts by key, ArrayDeque handles stack/queue work. Choose by the QUESTION you ask the data — order? uniqueness? lookup by key? — not by habit.

##### Generics: the type system working for you

List<Deployment> tells the compiler (and every reader) exactly what is inside — no casting, no ClassCastException at 2 a.m. Generic methods abstract over element types: <T> Optional<T> firstMatch(List<T> items, Predicate<T> test).

You will mostly CONSUME generics, so learn to read the signatures: Map<String, List<DeployResult>> is "results grouped by some string key". Wildcards appear at API boundaries (List<? extends Number> accepts any number list); write them only when you design libraries — using them correctly matters more than producing them.

##### Streams: SOQL-like pipelines over memory

Streams chain transformations over collections: filter, map, sorted, then a terminal collect/count/anyMatch. They read like a query plan and eliminate accumulator boilerplate. groupingBy is the star for reporting: one line turns a flat list into Map<String, List<...>> by any key function.

Use streams for transformation-heavy logic; keep simple iterations as enhanced-for (a three-line loop does not need a pipeline). Avoid side effects inside stream operations — a stream that mutates external state is a loop in disguise, minus the readability.

*filter → sort → map → collect: transformation code that reads as intent.*

```java
record DeployResult(String org, String component, boolean success, int ms) {}

List<DeployResult> results = fetchResults();

// Failed component names, slowest first
List<String> worstFailures = results.stream()
        .filter(r -> !r.success())
        .sorted(Comparator.comparingInt(DeployResult::ms).reversed())
        .map(DeployResult::component)
        .toList();

// Results grouped per org — one line, no manual accumulator
Map<String, List<DeployResult>> byOrg = results.stream()
        .collect(Collectors.groupingBy(DeployResult::org));

// Average duration of successful deploys
double avgMs = results.stream()
        .filter(DeployResult::success)
        .mapToInt(DeployResult::ms)
        .average()
        .orElse(0);
```

#### Real-world example — The nightly report that took 40 minutes

- **Scenario:** A deployment-audit report compared each of 20,000 deployed components against a list of 15,000 tracked components using list.contains() inside a nested loop — 300 million comparisons. The nightly job took 40 minutes and regularly overlapped the morning data loads.
- **Solution:** The inner list became a HashSet (O(1) membership), and the grouping logic became a stream groupingBy. Total change: nine lines.
- **Outcome:** Runtime fell from 40 minutes to under 4 seconds. The team added "right collection for the question" to design reviews, and two similar O(n²) hotspots were found and fixed the same week.

#### Key takeaways

- List = order, Set = uniqueness, Map = lookup — choose by the question asked
- contains() on a List is O(n); on a HashSet it is O(1)
- Generics remove casts and turn wrong types into compile errors
- Streams express transformations; groupingBy replaces manual accumulators

#### Go deeper

- [Dev.java: The Collections Framework](https://dev.java/learn/api/collections-framework/)
- [Baeldung: Java 8 streams](https://www.baeldung.com/java-8-streams)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Collections, generics, and streams matters | intro |
| 2 | 0:30–1:15 | The big three, and how to choose | demo |
| 3 | 1:15–2:00 | Generics: the type system working for you | demo |
| 4 | 2:00–2:45 | Streams: SOQL-like pipelines over memory | demo |
| 5 | 2:45–3:30 | Code walk-through — Streams: SOQL-like pipelines over memory | demo |
| 6 | 3:30–4:15 | Real story — The nightly report that took 40 minutes | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Collections, generics, and streams matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on Collections, generics, and streams. List/Set/Map chosen correctly, generics that keep you honest, and stream pipelines for transformation-heavy code. By the end of this video you will be able to choose the right collection (List, Set, Map) and implementation; read and write generic type signatures; transform data with stream pipelines: filter, map, collect, groupingBy.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Object-Oriented Java

**[0:30–1:15] The big three, and how to choose**

- **Narration (word-for-word):** Let's actually do this together. List (ArrayList) keeps insertion order and allows duplicates — your default sequence. Set (HashSet) enforces uniqueness with O(1) membership checks — perfect for "have I seen this Id?". Map (HashMap) indexes values by key — the Java twin of Apex's Map<Id, SObject> idiom, and the backbone of "query once, look up in the loop". Variants tune behavior: LinkedHashMap preserves insertion order (stable report output), TreeMap sorts by key, ArrayDeque handles stack/queue work. Choose by the QUESTION you ask the data — order? uniqueness? lookup by key? — not by habit.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Set (HashSet) enforces uniqueness with O(1) membership checks — perfect for "have I seen this Id?".
  2. Map (HashMap) indexes values by key — the Java twin of Apex's Map<Id, SObject> idiom, and the backbone of "query once, look up in the loop".

**[1:15–2:00] Generics: the type system working for you**

- **Narration (word-for-word):** Let's actually do this together. List<Deployment> tells the compiler (and every reader) exactly what is inside — no casting, no ClassCastException at 2 a.m. Generic methods abstract over element types: <T> Optional<T> firstMatch(List<T> items, Predicate<T> test). You will mostly CONSUME generics, so learn to read the signatures: Map<String, List<DeployResult>> is "results grouped by some string key". Wildcards appear at API boundaries (List<? extends Number> accepts any number list); write them only when you design libraries — using them correctly matters more than producing them.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. You will mostly CONSUME generics, so learn to read the signatures: Map<String, List<DeployResult>> is "results grouped by some string key".
  2. extends Number> accepts any number list); write them only when you design libraries — using them correctly matters more than producing them.

**[2:00–2:45] Streams: SOQL-like pipelines over memory**

- **Narration (word-for-word):** Let's actually do this together. Streams chain transformations over collections: filter, map, sorted, then a terminal collect/count/anyMatch. They read like a query plan and eliminate accumulator boilerplate. groupingBy is the star for reporting: one line turns a flat list into Map<String, List<...>> by any key function. Use streams for transformation-heavy logic; keep simple iterations as enhanced-for (a three-line loop does not need a pipeline). Avoid side effects inside stream operations — a stream that mutates external state is a loop in disguise, minus the readability.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Streams chain transformations over collections: filter, map, sorted, then a terminal collect/count/anyMatch.
  2. They read like a query plan and eliminate accumulator boilerplate.
  3. groupingBy is the star for reporting: one line turns a flat list into Map<String, List<...>> by any key function.

**[2:45–3:30] Code walk-through — Streams: SOQL-like pipelines over memory**

- **Narration (word-for-word):** Now watch the same idea in code. filter → sort → map → collect: transformation code that reads as intent. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[3:30–4:15] Real story — The nightly report that took 40 minutes**

- **Narration (word-for-word):** Here is why this matters in the real world. A deployment-audit report compared each of 20,000 deployed components against a list of 15,000 tracked components using list.contains() inside a nested loop — 300 million comparisons. The nightly job took 40 minutes and regularly overlapped the morning data loads. What did they do? The inner list became a HashSet (O(1) membership), and the grouping logic became a stream groupingBy. Total change: nine lines. And the payoff: Runtime fell from 40 minutes to under 4 seconds. The team added "right collection for the question" to design reviews, and two similar O(n²) hotspots were found and fixed the same week.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The nightly report that took 40 minutes

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. List = order, Set = uniqueness, Map = lookup — choose by the question asked. contains() on a List is O(n); on a HashSet it is O(1). Generics remove casts and turn wrong types into compile errors. Streams express transformations; groupingBy replaces manual accumulators.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Collections, generics, and streams — the idea, the practice, and the real-world payoff. Head back to the Object-Oriented Java module, mark this lesson complete, and take the quiz to make it count.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

## Module 3: Practical Java: Errors, Integration & Tests

Exceptions handled like a professional, HTTP + JSON against the Salesforce REST API, and Maven + JUnit for builds you can trust.

*Module quiz: 8 questions · pass mark 70% · curated fallback bank of 10 questions.*

### Lesson 3.1 — Exceptions and robust error handling

**Lesson ID:** `java-exceptions` · **Reading time:** 18 min · **Video:** 5:00

> Checked vs unchecked, try-with-resources, exception translation, and error-handling patterns for integration code.

**Learning objectives**

- Differentiate checked and unchecked exceptions and when to use each
- Manage resources with try-with-resources
- Design exception handling for an integration boundary

#### Concept explanation

##### The exception model

Java separates unchecked exceptions (RuntimeException subclasses — programming errors like NullPointerException, IllegalArgumentException) from CHECKED exceptions (like IOException) that the compiler forces you to handle or declare with throws. Checked exceptions mark failures a correct program must still expect: networks drop, files vanish, APIs rate-limit.

Modern practice keeps checked exceptions at I/O boundaries and translates them into meaningful domain exceptions as they cross into your logic — callers should reason about "SalesforceUnavailableException", not "some IOException from somewhere".

##### try/catch/finally and try-with-resources

catch specific types first and act meaningfully: retry, translate, or enrich and rethrow. Catching Exception and logging-then-continuing is how corrupted state spreads — if you cannot act on it, let it propagate to a boundary that can.

Anything holding a resource (HTTP client, file, DB connection) implements AutoCloseable; try-with-resources closes it automatically even when exceptions fly: try (var client = HttpClient.newHttpClient()) { ... }. Leaked connections from missed finally blocks were a defining production failure of pre-Java-7 codebases — the pattern exists because the pain was real.

*Try-with-resources plus exception translation — the caller sees domain language, and the cause chain survives.*

```java
public List<String> readDeployManifest(Path file) {
    try (BufferedReader reader = Files.newBufferedReader(file)) {   // auto-closed
        return reader.lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                .toList();
    } catch (NoSuchFileException e) {
        throw new ManifestException("Manifest not found: " + file, e);   // translate
    } catch (IOException e) {
        throw new ManifestException("Could not read manifest " + file, e);
    }
}
```

##### Error handling at integration boundaries

Integration code plans for four outcomes on every call: success, RETRYABLE failure (timeout, 429, 503 — retry with exponential backoff and a cap), NON-retryable failure (400 validation, 401 auth — fix the input or credentials, never blind-retry), and the poison-message case (one bad record must not stop the batch — quarantine it and continue).

Always preserve the cause chain (new DomainException(msg, cause)) so the original stack trace survives, and log at the boundary with enough context to act: org, record id, attempt number. "Error: null" in a log is an unforced error.

#### Real-world example — The catch block that swallowed a week of orders

- **Scenario:** An order-sync service wrapped its whole loop in try { ... } catch (Exception e) { log.warn("sync issue"); }. When Salesforce credentials expired, every call threw, every exception was swallowed with a context-free warning, and the service reported "0 errors" for six days while syncing nothing.
- **Solution:** Auth failures became fatal (fail fast, page the on-call), retryable failures got backoff with a retry budget, per-record failures went to a quarantine table with payloads, and a heartbeat metric ("records synced per hour") backed an alert independent of logs.
- **Outcome:** The next credential expiry paged within four minutes instead of six days. The quarantine table turned "mystery data drift" into a reviewable queue, and the postmortem's "no silent catch-alls" rule went into the lint config.

#### Key takeaways

- Checked exceptions mark expectable I/O failures; translate them at boundaries
- try-with-resources makes leaks structurally impossible
- Classify failures: retry with backoff vs fail fast vs quarantine
- Never log-and-continue on exceptions you cannot act on

#### Go deeper

- [Dev.java: Exceptions](https://dev.java/learn/exceptions/)
- [Baeldung: try-with-resources](https://www.baeldung.com/java-try-with-resources)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Exceptions and robust error handling matters | intro |
| 2 | 0:30–1:15 | The exception model | concept |
| 3 | 1:15–2:00 | try/catch/finally and try-with-resources | concept |
| 4 | 2:00–2:45 | Code walk-through — try/catch/finally and try-with-resources | demo |
| 5 | 2:45–3:30 | Error handling at integration boundaries | concept |
| 6 | 3:30–4:15 | Real story — The catch block that swallowed a week of orders | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Exceptions and robust error handling matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on Exceptions and robust error handling. Checked vs unchecked, try-with-resources, exception translation, and error-handling patterns for integration code. By the end of this video you will be able to differentiate checked and unchecked exceptions and when to use each; manage resources with try-with-resources; design exception handling for an integration boundary.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Practical Java: Errors, Integration & Tests

**[0:30–1:15] The exception model**

- **Narration (word-for-word):** Java separates unchecked exceptions (RuntimeException subclasses — programming errors like NullPointerException, IllegalArgumentException) from CHECKED exceptions (like IOException) that the compiler forces you to handle or declare with throws. Checked exceptions mark failures a correct program must still expect: networks drop, files vanish, APIs rate-limit. Modern practice keeps checked exceptions at I/O boundaries and translates them into meaningful domain exceptions as they cross into your logic — callers should reason about "SalesforceUnavailableException", not "some IOException from somewhere".
- **On screen:** Animated explainer diagram for "The exception model": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] try/catch/finally and try-with-resources**

- **Narration (word-for-word):** catch specific types first and act meaningfully: retry, translate, or enrich and rethrow. Catching Exception and logging-then-continuing is how corrupted state spreads — if you cannot act on it, let it propagate to a boundary that can. Anything holding a resource (HTTP client, file, DB connection) implements AutoCloseable; try-with-resources closes it automatically even when exceptions fly: try (var client = HttpClient.newHttpClient()) { ... }. Leaked connections from missed finally blocks were a defining production failure of pre-Java-7 codebases — the pattern exists because the pain was real.
- **On screen:** Animated explainer diagram for "try/catch/finally and try-with-resources": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — try/catch/finally and try-with-resources**

- **Narration (word-for-word):** Now watch the same idea in code. Try-with-resources plus exception translation — the caller sees domain language, and the cause chain survives. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:45–3:30] Error handling at integration boundaries**

- **Narration (word-for-word):** Integration code plans for four outcomes on every call: success, RETRYABLE failure (timeout, 429, 503 — retry with exponential backoff and a cap), NON-retryable failure (400 validation, 401 auth — fix the input or credentials, never blind-retry), and the poison-message case (one bad record must not stop the batch — quarantine it and continue). Always preserve the cause chain (new DomainException(msg, cause)) so the original stack trace survives, and log at the boundary with enough context to act: org, record id, attempt number. "Error: null" in a log is an unforced error.
- **On screen:** Animated explainer diagram for "Error handling at integration boundaries": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The catch block that swallowed a week of orders**

- **Narration (word-for-word):** Here is why this matters in the real world. An order-sync service wrapped its whole loop in try { ... } catch (Exception e) { log.warn("sync issue"); }. When Salesforce credentials expired, every call threw, every exception was swallowed with a context-free warning, and the service reported "0 errors" for six days while syncing nothing. What did they do? Auth failures became fatal (fail fast, page the on-call), retryable failures got backoff with a retry budget, per-record failures went to a quarantine table with payloads, and a heartbeat metric ("records synced per hour") backed an alert independent of logs.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The catch block that swallowed a week of orders

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Checked exceptions mark expectable I/O failures; translate them at boundaries. try-with-resources makes leaks structurally impossible. Classify failures: retry with backoff vs fail fast vs quarantine. Never log-and-continue on exceptions you cannot act on.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Exceptions and robust error handling — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.2 — HTTP + JSON: calling the Salesforce API from Java

**Lesson ID:** `java-http-json` · **Reading time:** 20 min · **Video:** 5:00

> java.net.http.HttpClient, JSON with Jackson, OAuth client-credentials, and a resilient Salesforce query client.

**Learning objectives**

- Send requests with java.net.http.HttpClient including timeouts
- Map JSON to Java types with Jackson
- Authenticate to Salesforce with OAuth and query the REST API

#### Concept explanation

##### The built-in HttpClient

Since Java 11 the JDK ships a real HTTP client: build one HttpClient (reuse it — it pools connections), then per call build an HttpRequest with URI, method, headers, timeout, and body, and send() it for an HttpResponse. Like JavaScript's fetch, HTTP error statuses are NOT exceptions — check statusCode() yourself. Unlike fetch, you set connectTimeout and request timeout explicitly, and you should: a client without timeouts hangs threads.

sendAsync() returns CompletableFuture for concurrency — the JVM cousin of promises. For most integration jobs, synchronous send() on a worker thread is simpler and fine.

##### JSON with Jackson

Jackson's ObjectMapper converts JSON text to typed Java objects and back: mapper.readValue(json, QueryResponse.class). Records make perfect targets. Two configuration decisions matter in Salesforce work: ignore unknown fields (FAIL_ON_UNKNOWN_PROPERTIES=false) because API responses evolve, and map Salesforce's field names explicitly with @JsonProperty when they differ from your Java naming.

Define response types for the fields you USE, not the entire payload — a five-field record is easier to maintain than a hundred-field mirror of the API.

*A typed Salesforce query client: timeouts, status handling, and records as JSON targets.*

```java
record QueryResponse<T>(int totalSize, boolean done, List<T> records) {}
record AccountRow(@JsonProperty("Id") String id,
                  @JsonProperty("Name") String name) {}

public class SalesforceClient {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    private final String instanceUrl;
    private final String accessToken;

    public SalesforceClient(String instanceUrl, String accessToken) {
        this.instanceUrl = instanceUrl;
        this.accessToken = accessToken;
    }

    public List<AccountRow> queryAccounts(String soql) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(instanceUrl + "/services/data/v62.0/query?q="
                        + URLEncoder.encode(soql, StandardCharsets.UTF_8)))
                .header("Authorization", "Bearer " + accessToken)
                .timeout(Duration.ofSeconds(30))
                .GET().build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 401) throw new SalesforceAuthException("Token expired");
        if (response.statusCode() >= 300) {
            throw new SalesforceApiException("Query failed: HTTP " + response.statusCode()
                    + " " + response.body());
        }
        QueryResponse<AccountRow> parsed = mapper.readValue(response.body(),
                new TypeReference<QueryResponse<AccountRow>>() {});
        return parsed.records();
    }
}
```

##### OAuth and operational hygiene

Server-to-server integrations authenticate with the OAuth client-credentials flow (or JWT bearer): POST to /services/oauth2/token, receive an access_token and instance_url, attach the token as a Bearer header, and refresh on 401 — never store or hardcode passwords. Secrets belong in a vault or environment configuration, exactly like Named Credentials keep them out of Apex.

Operational hygiene for anything scheduled: respect rate limits (handle 429 with backoff), page through large query results by following nextRecordsUrl, batch writes through the composite APIs, and emit a per-run summary (fetched / written / failed) so success is measurable rather than assumed.

#### Real-world example — The 2 a.m. sync with no timeout

- **Scenario:** A Java sync service called Salesforce without request timeouts. During a Salesforce maintenance window, connections hung indefinitely; the fixed thread pool drained within minutes, and by morning every downstream feed was hours stale while the JVM looked "up" to monitoring.
- **Solution:** Every request received connect and request timeouts, hung-call detection was added around the pool, 401s triggered one token refresh then failed fast, and 429/5xx got capped exponential backoff with a per-run retry budget.
- **Outcome:** The next maintenance window produced clean timeout errors, automatic recovery within one polling cycle, and zero human involvement — the incident report shrank from three pages to one paragraph.

#### Key takeaways

- Reuse one HttpClient; set connect AND request timeouts always
- HTTP error statuses are not exceptions — check statusCode()
- Map only the JSON fields you use; tolerate unknown properties
- OAuth tokens from a vault; refresh on 401; back off on 429

#### Go deeper

- [Java HttpClient guide (Baeldung)](https://www.baeldung.com/java-9-http-client)
- [Salesforce REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why HTTP + JSON: calling the Salesforce API from Java matters | intro |
| 2 | 0:30–1:15 | The built-in HttpClient | demo |
| 3 | 1:15–2:00 | JSON with Jackson | concept |
| 4 | 2:00–2:45 | Code walk-through — JSON with Jackson | demo |
| 5 | 2:45–3:30 | OAuth and operational hygiene | concept |
| 6 | 3:30–4:15 | Real story — The 2 a.m. sync with no timeout | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why HTTP + JSON: calling the Salesforce API from Java matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on HTTP + JSON: calling the Salesforce API from Java. java.net.http.HttpClient, JSON with Jackson, OAuth client-credentials, and a resilient Salesforce query client. By the end of this video you will be able to send requests with java.net.http.HttpClient including timeouts; map JSON to Java types with Jackson; authenticate to Salesforce with OAuth and query the REST API.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Practical Java: Errors, Integration & Tests

**[0:30–1:15] The built-in HttpClient**

- **Narration (word-for-word):** Let's actually do this together. Since Java 11 the JDK ships a real HTTP client: build one HttpClient (reuse it — it pools connections), then per call build an HttpRequest with URI, method, headers, timeout, and body, and send() it for an HttpResponse. Like JavaScript's fetch, HTTP error statuses are NOT exceptions — check statusCode() yourself. Unlike fetch, you set connectTimeout and request timeout explicitly, and you should: a client without timeouts hangs threads. sendAsync() returns CompletableFuture for concurrency — the JVM cousin of promises. For most integration jobs, synchronous send() on a worker thread is simpler and fine.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. Since Java 11 the JDK ships a real HTTP client: build one HttpClient (reuse it — it pools connections), then per call build an HttpRequest with URI, method, headers, timeout, and body, and send() it for an HttpResponse.
  2. Like JavaScript's fetch, HTTP error statuses are NOT exceptions — check statusCode() yourself.
  3. Unlike fetch, you set connectTimeout and request timeout explicitly, and you should: a client without timeouts hangs threads.

**[1:15–2:00] JSON with Jackson**

- **Narration (word-for-word):** Jackson's ObjectMapper converts JSON text to typed Java objects and back: mapper.readValue(json, QueryResponse.class). Records make perfect targets. Two configuration decisions matter in Salesforce work: ignore unknown fields (FAIL_ON_UNKNOWN_PROPERTIES=false) because API responses evolve, and map Salesforce's field names explicitly with @JsonProperty when they differ from your Java naming. Define response types for the fields you USE, not the entire payload — a five-field record is easier to maintain than a hundred-field mirror of the API.
- **On screen:** Animated explainer diagram for "JSON with Jackson": the key entities appear and connect exactly as the narration names them.

**[2:00–2:45] Code walk-through — JSON with Jackson**

- **Narration (word-for-word):** Now watch the same idea in code. A typed Salesforce query client: timeouts, status handling, and records as JSON targets. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:45–3:30] OAuth and operational hygiene**

- **Narration (word-for-word):** Server-to-server integrations authenticate with the OAuth client-credentials flow (or JWT bearer): POST to /services/oauth2/token, receive an access_token and instance_url, attach the token as a Bearer header, and refresh on 401 — never store or hardcode passwords. Secrets belong in a vault or environment configuration, exactly like Named Credentials keep them out of Apex. Operational hygiene for anything scheduled: respect rate limits (handle 429 with backoff), page through large query results by following nextRecordsUrl, batch writes through the composite APIs, and emit a per-run summary (fetched / written / failed) so success is measurable rather than assumed.
- **On screen:** Animated explainer diagram for "OAuth and operational hygiene": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The 2 a.m. sync with no timeout**

- **Narration (word-for-word):** Here is why this matters in the real world. A Java sync service called Salesforce without request timeouts. During a Salesforce maintenance window, connections hung indefinitely; the fixed thread pool drained within minutes, and by morning every downstream feed was hours stale while the JVM looked "up" to monitoring. What did they do? Every request received connect and request timeouts, hung-call detection was added around the pool, 401s triggered one token refresh then failed fast, and 429/5xx got capped exponential backoff with a per-run retry budget.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The 2 a.m. sync with no timeout

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. Reuse one HttpClient; set connect AND request timeouts always. HTTP error statuses are not exceptions — check statusCode(). Map only the JSON fields you use; tolerate unknown properties. OAuth tokens from a vault; refresh on 401; back off on 429.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is HTTP + JSON: calling the Salesforce API from Java — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---

### Lesson 3.3 — Building and testing: Maven and JUnit

**Lesson ID:** `java-build-test` · **Reading time:** 18 min · **Video:** 5:00

> The Maven lifecycle and dependency management, JUnit 5 tests that document behavior, and mocking with Mockito.

**Learning objectives**

- Read a pom.xml and run the Maven build lifecycle
- Write JUnit 5 tests with clear arrange-act-assert structure
- Isolate collaborators with Mockito mocks

#### Concept explanation

##### Maven: convention over configuration

Maven defines a standard project layout (src/main/java, src/test/java) and a build LIFECYCLE: mvn compile → test → package → verify → install. Dependencies are declared in pom.xml with coordinates (groupId:artifactId:version) and arrive from Maven Central — no jars in git.

The practical commands: mvn clean verify runs everything a CI server would; mvn dependency:tree explains where a jar came from when versions clash. Gradle is the main alternative (same ideas, Groovy/Kotlin DSL); read either fluently and CI configs stop being mysterious.

##### JUnit 5: tests as executable documentation

A test class mirrors the class under test; each @Test method asserts ONE behavior with a name that reads as a sentence: retryableFailureIsRetriedThreeTimes(). Arrange-act-assert structure, assertEquals/assertTrue/assertThrows for outcomes, @BeforeEach for shared setup, @ParameterizedTest to run one behavior across many inputs.

If you write Apex tests, the shape is familiar — minus governor limits and @TestSetup data ceremony. The discipline that transfers both ways: test behavior through the public API, not implementation details, so refactors do not shatter the suite.

*Behavior-named tests that pin down the retry contract precisely.*

```java
class RetryPolicyTest {
    private final RetryPolicy policy = new RetryPolicy(3, Duration.ofMillis(10));

    @Test
    void succeedsOnSecondAttempt() {
        AtomicInteger calls = new AtomicInteger();
        String result = policy.run(() -> {
            if (calls.incrementAndGet() == 1) throw new RetryableException("blip");
            return "ok";
        });
        assertEquals("ok", result);
        assertEquals(2, calls.get());
    }

    @Test
    void nonRetryableFailureIsNotRetried() {
        AtomicInteger calls = new AtomicInteger();
        assertThrows(AuthException.class, () -> policy.run(() -> {
            calls.incrementAndGet();
            throw new AuthException("bad token");
        }));
        assertEquals(1, calls.get());   // exactly one attempt — no blind retry
    }
}
```

##### Mockito: isolating the unit

Mockito fabricates implementations of interfaces so you test ONE class with scripted collaborators: SalesforceGateway gateway = mock(SalesforceGateway.class); when(gateway.query(any())).thenReturn(rows); … verify(gateway, times(1)).query(contains("Account")).

Mock at architectural boundaries (HTTP gateways, repositories, clocks) — not every class you own; over-mocked tests assert wiring instead of behavior and break on every refactor. Combined with last lesson's constructor injection, this is the complete fast-suite recipe: real logic, fake edges, milliseconds per test.

#### Real-world example — The build that worked "only on Dev C's laptop"

- **Scenario:** A team's integration jar was built by one developer's IDE with manually downloaded jars in a lib/ folder. When he went on leave, a hotfix could not be built: nobody else had the same jar versions, and the one attempted build shipped a NoSuchMethodError to production.
- **Solution:** The project moved to Maven with all dependencies declared in pom.xml, a CI job ran mvn clean verify on every commit, and the deployable artifact became the CI output — laptops stopped being build servers.
- **Outcome:** Any teammate (and the CI server) could produce an identical, tested artifact from a clean checkout. The next hotfix shipped in 40 minutes, and "works on my machine" left the team vocabulary.

#### Key takeaways

- mvn clean verify from a clean checkout is the reproducibility bar
- Dependencies live in pom.xml, never as loose jars
- Name tests as behaviors; assert one thing per test
- Mock boundaries (gateways, clocks), not every class

#### Go deeper

- [Maven getting started guide](https://maven.apache.org/guides/getting-started/)
- [JUnit 5 user guide](https://junit.org/junit5/docs/current/user-guide/)

#### 5-minute video script

**Target runtime:** 5:00 · **Narration pace:** ~145 words/min · **Segments:** 8

| # | Time | Segment | Type |
|---|------|---------|------|
| 1 | 0:00–0:30 | Cold open — why Building and testing: Maven and JUnit matters | intro |
| 2 | 0:30–1:15 | Maven: convention over configuration | concept |
| 3 | 1:15–2:00 | JUnit 5: tests as executable documentation | demo |
| 4 | 2:00–2:45 | Code walk-through — JUnit 5: tests as executable documentation | demo |
| 5 | 2:45–3:30 | Mockito: isolating the unit | concept |
| 6 | 3:30–4:15 | Real story — The build that worked "only on Dev C's laptop" | story |
| 7 | 4:15–4:45 | Recap — lock it in | recap |
| 8 | 4:45–5:00 | Your next step | cta |

**[0:00–0:30] Cold open — why Building and testing: Maven and JUnit matters**

- **Narration (word-for-word):** Welcome to Java Programming, and this five-minute session on Building and testing: Maven and JUnit. The Maven lifecycle and dependency management, JUnit 5 tests that document behavior, and mocking with Mockito. By the end of this video you will be able to read a pom.xml and run the Maven build lifecycle; write JUnit 5 tests with clear arrange-act-assert structure; isolate collaborators with Mockito mocks.
- **On screen:** Title card with the lesson name over the academy backdrop; the three learning objectives slide in as chips, one per beat of the narration.
- **Lower third:** Java Programming · Practical Java: Errors, Integration & Tests

**[0:30–1:15] Maven: convention over configuration**

- **Narration (word-for-word):** Maven defines a standard project layout (src/main/java, src/test/java) and a build LIFECYCLE: mvn compile → test → package → verify → install. Dependencies are declared in pom.xml with coordinates (groupId:artifactId:version) and arrive from Maven Central — no jars in git. The practical commands: mvn clean verify runs everything a CI server would; mvn dependency:tree explains where a jar came from when versions clash. Gradle is the main alternative (same ideas, Groovy/Kotlin DSL); read either fluently and CI configs stop being mysterious.
- **On screen:** Animated explainer diagram for "Maven: convention over configuration": the key entities appear and connect exactly as the narration names them.

**[1:15–2:00] JUnit 5: tests as executable documentation**

- **Narration (word-for-word):** Let's actually do this together. A test class mirrors the class under test; each @Test method asserts ONE behavior with a name that reads as a sentence: retryableFailureIsRetriedThreeTimes(). Arrange-act-assert structure, assertEquals/assertTrue/assertThrows for outcomes, @BeforeEach for shared setup, @ParameterizedTest to run one behavior across many inputs. If you write Apex tests, the shape is familiar — minus governor limits and @TestSetup data ceremony. The discipline that transfers both ways: test behavior through the public API, not implementation details, so refactors do not shatter the suite.
- **On screen:** Screen capture following the numbered steps below; cursor highlighted, each completed step ticked in an overlay checklist.
- **Demo steps (screen capture):**
  1. A test class mirrors the class under test; each @Test method asserts ONE behavior with a name that reads as a sentence: retryableFailureIsRetriedThreeTimes().
  2. Arrange-act-assert structure, assertEquals/assertTrue/assertThrows for outcomes, @BeforeEach for shared setup, @ParameterizedTest to run one behavior across many inputs.

**[2:00–2:45] Code walk-through — JUnit 5: tests as executable documentation**

- **Narration (word-for-word):** Now watch the same idea in code. Behavior-named tests that pin down the retry contract precisely. Read it top to bottom with me and notice what each line contributes. Pause the video here and type it out yourself — typing it, not copying it, is what makes it stick.
- **On screen:** Editor view: the java snippet types itself line by line, with the line under discussion highlighted while the narration explains it.
- **Lower third:** Code: JAVA

**[2:45–3:30] Mockito: isolating the unit**

- **Narration (word-for-word):** Mockito fabricates implementations of interfaces so you test ONE class with scripted collaborators: SalesforceGateway gateway = mock(SalesforceGateway.class); when(gateway.query(any())).thenReturn(rows); … verify(gateway, times(1)).query(contains("Account")). Mock at architectural boundaries (HTTP gateways, repositories, clocks) — not every class you own; over-mocked tests assert wiring instead of behavior and break on every refactor. Combined with last lesson's constructor injection, this is the complete fast-suite recipe: real logic, fake edges, milliseconds per test.
- **On screen:** Animated explainer diagram for "Mockito: isolating the unit": the key entities appear and connect exactly as the narration names them.

**[3:30–4:15] Real story — The build that worked "only on Dev C's laptop"**

- **Narration (word-for-word):** Here is why this matters in the real world. A team's integration jar was built by one developer's IDE with manually downloaded jars in a lib/ folder. When he went on leave, a hotfix could not be built: nobody else had the same jar versions, and the one attempted build shipped a NoSuchMethodError to production. What did they do? The project moved to Maven with all dependencies declared in pom.xml, a CI job ran mvn clean verify on every commit, and the deployable artifact became the CI output — laptops stopped being build servers.
- **On screen:** Cinematic three-beat story sequence — the struggling team, the fix being applied, the calm after — timed to the scenario, solution, and outcome.
- **Lower third:** The build that worked "only on Dev C's laptop"

**[4:15–4:45] Recap — lock it in**

- **Narration (word-for-word):** Before you go, say these back to yourself. mvn clean verify from a clean checkout is the reproducibility bar. Dependencies live in pom.xml, never as loose jars. Name tests as behaviors; assert one thing per test. Mock boundaries (gateways, clocks), not every class.
- **On screen:** Takeaway cards stack one by one into a neat pile; each card pulses as it is spoken.

**[4:45–5:00] Your next step**

- **Narration (word-for-word):** That is Building and testing: Maven and JUnit — the idea, the practice, and the real-world payoff.
- **On screen:** Progress ring animates toward complete; the quiz button glows as the outro plays.

---
