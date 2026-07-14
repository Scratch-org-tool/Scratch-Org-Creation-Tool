# Developer Board — Email Alerts (Future Phase)

> **NOT IMPLEMENTED** — This document describes a planned feature. No email is sent today.

## Goal

Notify users when an assigned Azure DevOps work item (defect, user story, issue, etc.) is updated, even when they are not viewing Developer Board.

## Proposed architecture

### Trigger options

1. **Azure DevOps Service Hook** (preferred)
   - Subscribe to `workitem.updated` events
   - POST to a new webhook endpoint: `POST /defects/webhooks/work-item-updated`
   - Validate hook secret; map payload to internal work item id + changed fields

2. **Polling fallback**
   - Cron job every N minutes
   - Compare `System.ChangedDate` per assigned item against last-seen timestamp in DB

### Recipients

- `AppUser.email` for the assignee on the work item
- Optional: admins for critical priority items

### Delivery

- New `NotificationService` (SendGrid / SES / SMTP via env config)
- Email body: work item id, title, summary of changed fields, deep link:
  `/defects-command-centre?id={id}&project={project}`

### Opt-in

- User or org setting before enabling outbound email
- Rate limit to avoid alert storms on bulk updates

## Implementation checklist (when enabled)

- [ ] Add `WorkItemChangeNotification` Prisma model (last notified rev / changed date)
- [ ] Implement `DefectsWebhookController` with shared secret validation
- [ ] Implement `NotificationService` + env vars (`SMTP_*` or `SENDGRID_API_KEY`)
- [ ] Add user preference toggle in profile/settings
- [ ] Register ADO service hook in integration setup docs

## Related code (live today)

- History timeline: `GET /defects/work-items/:id/history` — in-app audit trail only
- Access control: assignee-scoped unless admin (`defects.service.ts`)
