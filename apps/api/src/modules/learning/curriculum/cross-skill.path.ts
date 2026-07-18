import type { CurriculumPath } from './curriculum.types';

/**
 * Path 5 — Cross-Skill Career Accelerator (Intermediate).
 * Fills practical gaps often requested by delivery managers: org setup from
 * zero, JavaScript fundamentals for LWC, Java-to-Apex transition guidance,
 * and release-management execution discipline.
 */
export const crossSkillPath: CurriculumPath = {
  id: 'sf-cross-skill',
  title: 'Cross-Skill Career Accelerator',
  tagline: 'Blank org to release-ready engineer — the practical bridge track.',
  description:
    'A practical path for learners who need more than core Salesforce concepts: creating a clean training org from scratch, JavaScript fluency for Lightning Web Components, translating Java habits into Apex-safe patterns, and executing release management with production discipline.',
  level: 'intermediate',
  badge: 'Cross-Skill Ready',
  estimatedHours: 5,
  skills: [
    'Salesforce org bootstrap',
    'JavaScript for LWC',
    'Java to Apex translation',
    'Release management operations',
  ],
  modules: [
    {
      id: 'sf-cross-skill-bootcamp',
      title: 'Bootcamp: Blank Org to Production Rhythm',
      summary:
        'Hands-on bridging module covering starter environment setup, coding language foundations, and release execution.',
      lessons: [
        {
          id: 'cross-skill-blank-salesforce-training',
          title: 'Blank Salesforce training setup: from nothing to usable sandbox',
          summary:
            'Create a clean training baseline with sample users, seed data, and a practice workflow so learners can start safely.',
          durationMinutes: 15,
          objectives: [
            'Stand up a clean training environment using sandbox or scratch org strategy',
            'Configure baseline security, sample users, and starter permission sets',
            'Seed representative data so training scenarios behave like production',
          ],
          sections: [
            {
              heading: 'Start with an intentional blank baseline',
              body:
                'A training org should be intentionally empty, not accidentally messy. Define what "blank" means for your team: no legacy flows, no unmanaged packages, and only a minimal set of core objects and sample records. In most teams this means one scratch org definition plus a repeatable seed script.\n\nYour goal is reproducibility: a learner who joins today and a learner who joins next quarter should receive the same starting state.',
            },
            {
              heading: 'Bootstrap checklist for training orgs',
              body:
                'Use a short checklist every time: create environment, enable required features, create training users (admin + standard), assign baseline permission set groups, import sample data (accounts/cases/opportunities), and validate one end-to-end scenario.\n\nAvoid overloading the org with "future maybe" metadata. Minimal starting complexity improves learning speed and keeps troubleshooting simple.',
            },
            {
              heading: 'Treat setup as code, not ceremony',
              body:
                'Capture setup artifacts in version control: scratch definition files, data seed files, and permission templates. This makes onboarding deterministic and auditable. If training setup lives in someone\'s memory, training quality decays every cycle.',
            },
          ],
          realWorld: {
            title: 'Onboarding class stalled on day one',
            scenario:
              'A new-hire batch spent its first week fixing broken sandbox setup differences instead of learning Salesforce fundamentals.',
            solution:
              'The enablement team standardized one "blank training org" pipeline with seed data and baseline access templates, then rebuilt every learner environment from that recipe.',
            outcome:
              'Day-one setup time dropped from hours to minutes and instructor time shifted from environment fixes to actual concept coaching.',
          },
          keyTakeaways: [
            'A blank training org must be reproducible, not ad hoc',
            'Baseline users, permission sets, and seed data are part of setup',
            'Keep setup assets in source control to prevent drift',
            'Minimal metadata yields faster learning and fewer setup incidents',
          ],
          resources: [
            {
              title: 'Salesforce DX Setup (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/sfdx_app_dev',
              source: 'trailhead',
            },
            {
              title: 'Scratch Org Configuration Values',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.238.0.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm',
              source: 'developer',
            },
          ],
        },
        {
          id: 'cross-skill-javascript-training',
          title: 'JavaScript training for Salesforce developers (LWC-first)',
          summary:
            'Focus on modern JavaScript patterns that directly impact component quality in Lightning Web Components.',
          durationMinutes: 16,
          objectives: [
            'Use modern JavaScript syntax used in LWC codebases',
            'Apply array/object immutability for predictable reactivity',
            'Write asynchronous UI logic with async/await and robust error handling',
          ],
          sections: [
            {
              heading: 'The JavaScript subset that matters most in LWC',
              body:
                'For Salesforce UI work, prioritize ES modules, destructuring, spread syntax, template literals, map/filter/reduce, and async/await. Mastering these patterns has immediate ROI because LWC uses modern JavaScript directly.\n\nThe highest-impact habit is writing small pure transformation functions for UI data shaping; this keeps components easier to test and reason about.',
            },
            {
              heading: 'Reactivity and immutable updates',
              body:
                'In component state, mutate less and reassign more. Instead of pushing into an existing array, create a new array with spread syntax. Instead of mutating nested objects in place, clone and reassign.\n\nImmutable updates prevent stale UI bugs and align with LWC\'s rendering behavior.',
            },
            {
              heading: 'Async flows for real UI behavior',
              body:
                'Most interactive components fetch or save data asynchronously. Use async/await with try/catch, display loading states, and always surface failure feedback to users.\n\nA component that silently fails after a button click is a UX defect, even when backend logic is correct.',
            },
          ],
          realWorld: {
            title: 'Intermittent stale data in a sales console panel',
            scenario:
              'Agents saw old values after quick edits because component state was mutated in place and not consistently re-rendered.',
            solution:
              'Developers switched to immutable update patterns and centralized async error handling, then added tests around list transformation helpers.',
            outcome:
              'Stale-view defects disappeared and component behavior became predictable across browsers and rapid user interactions.',
          },
          keyTakeaways: [
            'Modern JS fluency directly improves LWC quality',
            'Immutable updates reduce stale UI and render glitches',
            'Async/await + clear loading/error states are mandatory UX hygiene',
            'Small pure helper functions keep components maintainable',
          ],
          resources: [
            {
              title: 'JavaScript Guide (MDN)',
              url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
              source: 'other',
            },
            {
              title: 'LWC Developer Guide',
              url: 'https://developer.salesforce.com/docs/platform/lwc/guide',
              source: 'developer',
            },
          ],
        },
        {
          id: 'cross-skill-java-training',
          title: 'Java training bridge: translating Java habits into Apex patterns',
          summary:
            'For Java developers entering Salesforce: what transfers cleanly and what must change because of governor limits.',
          durationMinutes: 15,
          objectives: [
            'Map familiar Java concepts to Apex equivalents safely',
            'Avoid Java patterns that become anti-patterns on Salesforce',
            'Design service-layer code with bulk and sharing constraints',
          ],
          sections: [
            {
              heading: 'What transfers from Java',
              body:
                'Object-oriented design transfers well: classes, interfaces, encapsulation, clear method contracts, and test-driven thinking. Collection literacy also transfers strongly and remains central in Apex design.',
            },
            {
              heading: 'What must change in Apex',
              body:
                'Server resources are shared in Salesforce multi-tenancy. Java habits like per-record database calls inside loops are catastrophic in Apex due to governor limits.\n\nThink "bulk first": collection inputs, one query per dataset, in-memory indexing, one DML boundary.',
            },
            {
              heading: 'Service architecture with platform constraints',
              body:
                'Use trigger-handler + service patterns with explicit sharing context (with sharing / without sharing). Separate orchestration from persistence and keep limit-sensitive logic observable (logs, metrics, tests at realistic volumes).\n\nApex architecture quality is measured not by elegance alone, but by predictable behavior under batch load.',
            },
          ],
          realWorld: {
            title: 'Experienced Java team, failing Apex deployment',
            scenario:
              'A Java-heavy team delivered correct logic but failed load testing because trigger code used per-record queries and updates.',
            solution:
              'They introduced Apex-specific architecture guidelines and mandatory 200-record bulk tests for trigger paths.',
            outcome:
              'Deployment passed at production volumes, and later features shipped faster because platform constraints were built into design from the start.',
          },
          keyTakeaways: [
            'Java fundamentals transfer, but runtime constraints differ dramatically',
            'Bulk-safe data access is non-negotiable in Apex',
            'Explicit sharing context and trigger separation improve safety',
            'Volume-oriented testing prevents last-minute release failure',
          ],
          resources: [
            {
              title: 'Apex Developer Guide',
              url: 'https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_dev_guide.htm',
              source: 'developer',
            },
            {
              title: 'Java Tutorials',
              url: 'https://docs.oracle.com/javase/tutorial/',
              source: 'other',
            },
          ],
        },
        {
          id: 'cross-skill-release-management',
          title: 'Release management training: plan, gate, release, recover',
          summary:
            'Operational release management for Salesforce teams: dependency checks, validation gates, communication, and rollback choreography.',
          durationMinutes: 18,
          objectives: [
            'Run release readiness with explicit dependency and risk checks',
            'Execute validated deployments with communication checkpoints',
            'Use rollback/hotfix playbooks when production behavior deviates',
          ],
          sections: [
            {
              heading: 'Readiness starts before deployment day',
              body:
                'Create a release checklist that includes metadata dependencies, permission impacts, test evidence, data migration preconditions, and stakeholder sign-offs. Run validation deploys ahead of the release window.\n\nReleases fail most often from missing prerequisites, not from unknown platform behavior.',
            },
            {
              heading: 'Execution rhythm during release windows',
              body:
                'Use a clear runbook: announce start, deploy validated package, verify smoke scenarios, confirm business owners, and close release communication. Keep one release captain and one technical operator to reduce command ambiguity.',
            },
            {
              heading: 'Recovery and hotfix discipline',
              body:
                'If behavior degrades, execute predefined rollback options: feature flags, revert + redeploy, or contained hotfix lane. Document incident timeline, root cause, and prevention actions.\n\nA release process is mature only when recovery is as practiced as deployment.',
            },
          ],
          realWorld: {
            title: 'Quarter-close release scare',
            scenario:
              'A late-evening deployment introduced a validation dependency miss and blocked order updates during a critical revenue window.',
            solution:
              'The team introduced pre-release validation gates, explicit dependency manifests, and a rehearsed hotfix lane from production tags.',
            outcome:
              'Subsequent releases moved to routine weekday windows with measurable reduction in failed-change incidents and faster recovery when issues occurred.',
          },
          keyTakeaways: [
            'Release readiness is evidence-driven, not calendar-driven',
            'Runbooks and roles reduce release-window confusion',
            'Rollback paths must be rehearsed before incidents',
            'Post-release learning closes the quality loop',
          ],
          resources: [
            {
              title: 'Application Lifecycle and Development Models (Trailhead)',
              url: 'https://trailhead.salesforce.com/content/learn/modules/application_lifecycle_and_development_models',
              source: 'trailhead',
            },
            {
              title: 'Salesforce Well-Architected',
              url: 'https://architect.salesforce.com/well-architected/overview',
              source: 'architect',
            },
          ],
        },
      ],
      quizBank: [
        {
          id: 'q-cross-1',
          topic: 'Training setup',
          prompt: 'What is the primary goal of a "blank training org" baseline?',
          options: [
            'Fill it with every package your company uses',
            'Make setup reproducible and consistent for every learner',
            'Mirror production data completely',
            'Disable all security settings',
          ],
          correctIndex: 1,
          explanation:
            'A training baseline should be deterministic and repeatable so all learners start from the same reliable state.',
        },
        {
          id: 'q-cross-2',
          topic: 'JavaScript',
          prompt: 'Which update pattern best supports predictable LWC reactivity?',
          options: [
            'Mutate arrays in place and trust re-rendering',
            'Use immutable updates (clone + reassign)',
            'Store all state in global variables',
            'Disable component caching',
          ],
          correctIndex: 1,
          explanation:
            'Immutable updates avoid stale UI behavior and align with how reactive updates are tracked.',
        },
        {
          id: 'q-cross-3',
          topic: 'Java to Apex',
          prompt: 'Why does per-record SOQL in loops fail in Apex even if logic is correct?',
          options: [
            'Apex doesn\'t support loops',
            'Governor limits are enforced per transaction',
            'SOQL only runs in tests',
            'Loops are slower than recursion',
          ],
          correctIndex: 1,
          explanation:
            'Apex transactions have strict query and DML ceilings; per-record patterns exceed them quickly.',
        },
        {
          id: 'q-cross-4',
          topic: 'Release management',
          prompt: 'Which practice reduces production release failures most directly?',
          options: [
            'Deploying only on Fridays',
            'Validation deploys and dependency checklists before the release window',
            'Skipping smoke tests to save time',
            'Combining hotfix and feature branches at deployment time',
          ],
          correctIndex: 1,
          explanation:
            'Pre-validation and dependency checks surface predictable issues before business-impact windows.',
        },
        {
          id: 'q-cross-5',
          topic: 'Training operations',
          prompt: 'Where should training-org setup assets live?',
          options: [
            'In one admin\'s local notes',
            'In source control as reusable setup artifacts',
            'Only in production org description fields',
            'Inside release emails',
          ],
          correctIndex: 1,
          explanation:
            'Version-controlled setup artifacts prevent onboarding drift and make environments reproducible.',
        },
        {
          id: 'q-cross-6',
          topic: 'JavaScript async',
          prompt: 'What should an LWC do when an async save fails?',
          options: [
            'Do nothing and retry silently',
            'Surface clear feedback and preserve recoverable state',
            'Refresh the entire browser automatically',
            'Disable the component permanently',
          ],
          correctIndex: 1,
          explanation:
            'Visible failure feedback and recoverable UX are required for trustworthy interactive components.',
        },
        {
          id: 'q-cross-7',
          topic: 'Apex architecture',
          prompt: 'What is a key service-layer responsibility in Apex?',
          options: [
            'Randomize execution order',
            'Separate orchestration from persistence with bulk-safe contracts',
            'Run all logic directly in trigger files',
            'Ignore sharing context in all classes',
          ],
          correctIndex: 1,
          explanation:
            'Service boundaries keep logic testable and bulk-safe while trigger layers stay minimal.',
        },
        {
          id: 'q-cross-8',
          topic: 'Release execution',
          prompt: 'Who should own coordination during a release window?',
          options: [
            'Everyone equally with no named owner',
            'A designated release captain with clear operator roles',
            'Only the newest team member',
            'An external stakeholder with no system access',
          ],
          correctIndex: 1,
          explanation:
            'Named release ownership reduces ambiguity and improves execution quality under pressure.',
        },
      ],
    },
  ],
};
