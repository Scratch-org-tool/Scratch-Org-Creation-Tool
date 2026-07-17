# Developer Board — Email Alerts

> **IMPLEMENTED** — work-item webhooks, SMTP delivery, per-user opt-in, and
> admin channel controls are live. This page documents setup and behavior.

## Goal

Notify users when an assigned work item (defect, user story, issue, etc.) is
updated, even when they are not viewing Developer Board.

## How it works

1. **Azure DevOps Service Hook** (or any custom producer) POSTs to
   `POST /api/defects/webhooks/work-item-updated` with the shared secret in the
   `x-webhook-secret` header (or `?secret=` query parameter).
2. The payload is normalized (`workitem.updated` service-hook shape and a
   simplified custom JSON shape are both accepted).
3. Duplicate revisions are ignored via the `WorkItemChangeNotification` ledger
   (unique per provider + project + item; stores the last notified revision and
   changed date).
4. The assignee is resolved to an `AppUser` by email (case-insensitive). If the
   assignee has no account, the event is recorded and skipped.
5. An in-app notification (category **Developer Board work items**) is created
   and streamed to the bell inbox.
6. An email copy is sent when ALL of the following are true:
   - the admin master notification switch is on (Admin > Notifications),
   - the **Email** channel is enabled there,
   - SMTP is configured on the server,
   - the user opted in under **Account > Email alerts**,
   - the item has not been emailed in the last 2 minutes (per-item throttle to
     avoid alert storms on bulk updates).

## Configuration

```env
# apps/api/.env
DEFECTS_WEBHOOK_SECRET="generate-a-long-random-secret"

SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false        # true for implicit TLS / port 465
SMTP_USER=""             # optional
SMTP_PASS=""             # optional
MAIL_FROM="SF DevOps Command Center <no-reply@example.com>"
PUBLIC_APP_URL="https://devops.example.com"   # used for deep links in emails
```

### Registering the Azure DevOps service hook

1. Project settings > Service hooks > Create subscription > **Web Hooks**.
2. Trigger: **Work item updated** (scope to a team/area path as desired).
3. URL: `https://<your-host>/api/defects/webhooks/work-item-updated`
4. HTTP header: `x-webhook-secret: <DEFECTS_WEBHOOK_SECRET>`

### Custom payload shape

Non-ADO producers can POST:

```json
{
  "provider": "custom",
  "projectId": "P1",
  "projectName": "Project One",
  "workItemId": "42",
  "title": "Fix login bug",
  "state": "Active",
  "revision": 7,
  "changedDate": "2026-07-17T02:00:00.000Z",
  "changedFields": ["State", "AssignedTo"],
  "assigneeEmail": "dev@example.com"
}
```

## Email deep link

`/defects-command-centre?id={workItemId}&project={projectName|projectId}` —
prefixed with `PUBLIC_APP_URL` when set.

## Related code

- Webhook: `apps/api/src/modules/defects/defects-webhook.controller.ts` /
  `defects-webhook.service.ts`
- SMTP transport: `apps/api/src/modules/notifications/mail.service.ts`
- Delivery gating: `NotificationsService.deliverEmail`
  (`apps/api/src/modules/notifications/notifications.service.ts`)
- Per-user opt-in: `GET/PATCH /api/notifications/preferences` + the
  **Email alerts** toggle on `/account`
- Dedupe ledger: `WorkItemChangeNotification`
  (`packages/db/prisma/schema.prisma`)
- History timeline (in-app audit trail): `GET /defects/work-items/:id/history`
