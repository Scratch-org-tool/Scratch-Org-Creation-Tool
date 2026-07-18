# Lifecycle User Provisioning — Plan & Build Structure

Port the `scripts/apex/createLifecycleUsers.apex` / `LifecycleUserCreation` workflow (today a
manual post-deploy Anonymous Apex script run with `sf apex run`) into the app's existing
**User Provisioning** panel, as a guided "generate one user per role" flow.

## 1. Why the Apex script is not needed here

The Apex script must be executed *inside* an org. This application never deploys or executes
Apex for provisioning — and it does not need to, because the existing pipeline already performs
every step of the script through the Salesforce CLI:

| Apex script step | Existing app equivalent |
|---|---|
| Insert `User` records (Profile, Username, Alias, Bottler, locale fields) | `UserProvisionWorker.process` → `SfCliClient.createUser` (`sf data create record --sobject User`) |
| Second-pass update of restricted picklists (`cfs_ob__Onboarding_Role__c`, `cfs_ob__Modules__c`) | `UserProvisionWorker.applyOnboardingFields` → `SfCliClient.updateUser` (also sets `cfs_ob__u_Locations__c`) |
| Assign `Onboarding_Admin_Extension` to all, `Lifecycle_Super_User` to Master Data | Worker permset block using `CONA_ADMIN_EXTENSION_PERMSET` / `CONA_SUPER_USER_PERMSET` (`packages/shared/src/constants.ts`), Master Data check included |
| Retry/skip on invalid picklist values per bottler | `UserProvisionWorker.preflightUsers` validates values *before* insert, including dependent picklists (`buildPicklistDependencies`) — stronger than the Apex retry-after-failure approach |
| Re-runnability (deactivate old `.scratch` users) | Worker reconciles by `Username` (`findExistingUserId`) and reuses existing users instead of duplicating. Deactivation of previous runs is **not** implemented — see Phase 4 (optional) |

So the work is **not** "run the Apex from the app"; it is "add a generator UI + expansion logic
in front of the pipeline that already does the org-side work."

Differences from the Apex script to be aware of (decisions baked into this plan):

- **Locale**: worker hardcodes `en_US` / `America/New_York`; the Apex used `en_IN` / `Asia/Kolkata`.
  Keep `en_US` defaults; add optional locale fields only if requested later.
- **Profile**: Apex used `System Administrator` for all users. The generator sends
  `profile: "System Administrator"` by default (worker already resolves `ProfileId` by name).
- **CommunityNickname**: not set by the worker; Salesforce auto-generates it. No change needed.
- **Passwords**: neither the Apex script nor the app sets passwords; users need a reset or an
  admin-set password. Out of scope.

## 2. Feature summary (UX flow)

New **"Lifecycle roles"** mode in the User Provisioning panel (`/org-setup?tab=users-cona` hosts
the CONA form today; this becomes a sibling tab):

1. **Select target org** → auto-discovers `User` metadata via existing
   `GET /provisioning/orgs/:orgId/discover` (returns picklist values **and** decoded
   controller/dependency data for `cfs_ob__Onboarding_Role__c`, `cfs_ob__Bottler__c`,
   `cfs_ob__Modules__c`, `cfs_ob__u_Locations__c`, plus profiles and permission sets).
2. **Select bottler** (values from `cfs_ob__Bottler__c`, rendered with labels:
   `4600 — Reyes`, `4900 — Abarta`, `5000 — Northeast`).
3. **Modules & locations render filtered by the selected bottler** using the `dependencies`
   array the discover endpoint already returns (`validFor` per value). Defaults: all
   bottler-valid modules selected, bottler-valid locations selected. The current CONA form shows
   *all* values unfiltered — this filtering is new UI logic, no new API needed.
4. **Roles** multi-select from `cfs_ob__Onboarding_Role__c` (all values pre-selected; if the role
   field is dependent on bottler in the org, apply the same `validFor` filter). One user is
   created per selected role.
5. **Emails** — one or more:
   - 1 email → every generated user gets it (login is by username, not email).
   - 2+ emails → distributed across the role users with the existing deterministic shuffled
     round-robin (`allocateEmailPool` with `allowReuse: true`).
6. **Username convention** — a pattern input with tokens, live preview per role:
   - Tokens: `{role}` (role, no spaces, lowercased), `{bottler}` (`4600`), `{bottlerLabel}`
     (`reyes`), `{unique}` (stable per-batch entropy).
   - Default: `{role}.{bottlerLabel}.{unique}@lifecycle.scratch`.
   - Example for 4600/Reyes, role Requestor: `requestor.reyes.k3f9a2@lifecycle.scratch`.
     Removing `{unique}` gives the requested `requestorreyes@some.com` style — allowed, with a
     UI warning that Salesforce usernames are globally unique across all orgs (this is why the
     Apex script appended a timestamp). `{unique}` is seeded by the batch, so **retries of the
     same batch keep the same usernames** and the worker's reconcile-by-username stays idempotent.
7. **Create Users** → creates a `ProvisioningBatch` + `ProvisionedUser` rows, enqueues the
   existing `user-provision` queue job (`conaMode: true`), and the untouched worker performs:
   create → set role/modules/locations/bottler → assign permission sets
   (`Onboarding_Admin_Extension` all, `Lifecycle_Super_User` for Master Data).

## 3. What already exists (reuse, no changes)

- `apps/api/src/modules/provisioning/org-user-metadata.service.ts` — org metadata discovery incl.
  dependent-picklist decoding (`picklist-dependency.util.ts` / `decodeValidFor`).
- `apps/api/src/workers/user-provision.worker.ts` — the entire org-side execution: preflight,
  reconcile, create, onboarding fields, permsets, batch status, `fail_fast`/`continue` policies.
  Its `ConaUserInput` already accepts optional `username`, `profile`, `permissionSets`.
- `packages/shared/src/user-provision-template.ts` — `allocateEmailPool`,
  `stableDeterministicShuffle`, `normalizeRoleSlug`, username length/format guards.
- `packages/db` — `ProvisioningBatch` / `ProvisionedUser` with unique `(batchId, username)`.
- UI building blocks — org hooks (`useOrgs`), discover-on-select pattern, `GlassCard`,
  `FormSection`, checkbox-chip groups (see `cona-user-provisioning-form.tsx`).

## 4. Structure of the build

### 4.1 `packages/shared` — expansion logic (pure, unit-testable)

New file `src/lifecycle-user-generation.ts`, exported from the package index:

```ts
export const lifecycleUserGenerationSchema = z.object({
  orgId: z.string().uuid(),
  bottler: z.string().min(1),                  // picklist value, e.g. '4600'
  roles: z.array(z.string().min(1)).min(1),    // selected Onboarding Role values
  modules: z.array(z.string()).default([]),    // bottler-valid selection
  locations: z.array(z.string()).default([]),
  emails: z.array(z.string().email()).min(1),
  usernamePattern: z.string().min(3),          // must contain '@'
  profile: z.string().min(1).default('System Administrator'),
});

export interface LifecycleExpansionInput extends z.infer<typeof lifecycleUserGenerationSchema> {
  seed: string;            // batch id → deterministic emails + {unique}
  bottlerLabel: string;    // resolved from CONA_BOTTLER_LABELS
}

/** One ConaUserInput-shaped user per role: names, email allocation, patterned username. */
export function expandLifecycleUsers(input: LifecycleExpansionInput): Array<{
  firstName: string;       // role without spaces, e.g. 'MasterData'
  lastName: string;        // bottler label, e.g. 'Reyes'
  email: string;           // from allocateEmailPool(emails, roles.length, { seed, allowReuse: true })
  username: string;        // formatLifecycleUsername(pattern, { role, bottler, bottlerLabel, seed, ordinal })
  role: string;
  bottler: string;
  modules: string[];
  locations: string[];
  profile: string;
}>;

/** Token substitution + email-format and 80-char guards (same rules as formatProvisioningUsername). */
export function formatLifecycleUsername(pattern: string, values: {
  role: string; bottler: string; bottlerLabel: string; seed: string; ordinal: number;
}): string;
```

Also add to `src/constants.ts`:

```ts
export const CONA_BOTTLER_LABELS = { '5000': 'Northeast', '4900': 'Abarta', '4600': 'Reyes' } as const;
```

(labels currently live only in `apps/api/src/modules/data/bottler-config.ts` and hardcoded UI
options; the API bottler config should re-point at this constant.)

Tests: `src/lifecycle-user-generation.test.ts` — one-email fan-out, two-email shuffle
distribution and determinism per seed, token substitution, duplicate-username rejection,
80-char/format limits, `{unique}` stability for identical seeds.

### 4.2 `apps/api` — one new endpoint

`provisioning.controller.ts`:

```ts
@Post('lifecycle-users')
provisionLifecycleUsers(@Body() body: unknown, @CurrentUser() userId: string) {
  return this.provisioningService.provisionLifecycleUsers(body, userId);
}
```

`provisioning.service.ts` — `provisionLifecycleUsers(body, userId)`:

1. `lifecycleUserGenerationSchema.parse(body)`; `assertOrgOwned(orgId, userId, prisma)`.
2. Create `ProvisioningBatch` (status `queued`, `totalRows = roles.length`) to get the batch id,
   then `expandLifecycleUsers({ ...input, seed: batch.id, bottlerLabel })` and create the
   `ProvisionedUser` rows (mirrors `provisionFromCsv`, which is the only path with batch
   tracking today — the CONA path has none).
3. Enqueue `QUEUE_NAMES.USER_PROVISION`, job name `lifecycle_user_provision`, payload
   `{ orgId, batchId, users, conaMode: true }` — the worker switches on payload flags, not job
   name, so **no worker changes**.
4. Return `{ batchId, jobId, totalUsers, users }` (echoing usernames/emails for the UI receipt).

No preview endpoint: the web app already imports `@sfcc/shared`, so the live preview calls
`expandLifecycleUsers` client-side with a placeholder seed and re-renders as inputs change
(display usernames as "final entropy assigned on create" when `{unique}` is used).

Tests: extend `provisioning.service.spec.ts` — batch+rows created, queue payload shape,
ownership rejection, schema errors.

### 4.3 `apps/web` — new form + tab registration

New `apps/web/src/modules/provisioning/lifecycle-user-generator-form.tsx` (client component,
same skeleton as `cona-user-provisioning-form.tsx`):

- Org select → existing discover call; keep the full `PicklistFieldInfo` objects (the CONA form
  currently discards `dependencies` — this form uses them).
- Bottler select with labels from `CONA_BOTTLER_LABELS`.
- `validValuesForBottler(field, bottler)` helper: if `field.controllerName === 'cfs_ob__Bottler__c'`,
  keep values whose `dependencies[].validFor` includes the bottler; otherwise all values.
  Applied to modules, locations, and roles. Re-derive selections when bottler changes.
- Roles checkbox group (all pre-selected), modules/locations chip groups (bottler-valid
  pre-selected).
- Emails: chip/textarea input (comma or newline separated), validated client-side.
- Username pattern input, default `{role}.{bottlerLabel}.{unique}@lifecycle.scratch`, token
  legend, warning banner when `{unique}` is absent.
- Preview table (Role | First/Last | Email | Username) via shared `expandLifecycleUsers`.
- "Create users" → `POST /provisioning/lifecycle-users`; success alert with batch id.

Registration:

- `provisioning-workspace.tsx`: third tab `lifecycle` ("Lifecycle roles") rendering the form.
- `org-setup`: add `'users-lifecycle'` to `OrgSetupTab` / `ORG_SETUP_TABS`
  (`apps/web/src/modules/org-setup/types.ts`) and render the form in
  `org-setup-workspace.tsx` next to the existing `users-cona` panel.

### 4.4 Database

No schema changes. `ProvisioningBatch` / `ProvisionedUser` are reused as-is; `(batchId,
username)` uniqueness plus deterministic usernames give retry idempotency.

## 5. Phases

1. **Shared expansion logic** — schema, `expandLifecycleUsers`, `formatLifecycleUsername`,
   `CONA_BOTTLER_LABELS`, unit tests. No behavior change elsewhere.
2. **API endpoint** — service method + route + batch persistence + tests.
3. **UI** — generator form, dependency filtering, preview, tab registration.
4. **Optional (parity with Apex step 1)** — "Deactivate users from previous runs" toggle:
   worker gains a pre-step that queries active users matching the pattern's fixed suffix
   (e.g. `Username LIKE '%@lifecycle.scratch'`, excluding the connected user) and sets
   `IsActive = false` via `sf data update record`. Off by default; separate PR.

## 6. Verification

- Unit: shared expansion tests; provisioning service spec; existing worker spec still green
  (worker untouched).
- Integration (against a scratch org): create batch for 4600/Reyes with 2 emails and 9 roles →
  expect 18 rows? No — 9 users (one per role for the chosen bottler; the Apex's 18 = 9 roles × 2
  bottlers is achieved by running the flow once per bottler). Verify in-org with:

  ```sql
  SELECT Username, FirstName, LastName, cfs_ob__Bottler__c, cfs_ob__Onboarding_Role__c,
         cfs_ob__Modules__c, cfs_ob__u_Locations__c, IsActive
  FROM User WHERE Username LIKE '%@lifecycle.scratch'
  ORDER BY cfs_ob__Onboarding_Role__c
  ```

- Re-run the same batch → worker logs `Reconciled existing user` / `Skipping completed user`,
  no duplicates.
