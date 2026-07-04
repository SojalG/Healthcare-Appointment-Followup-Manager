# Phase 6: Notifications

## Features Implemented
- Created `NotificationLog` model with `NotificationType`, `NotificationChannel`, and `NotificationStatus`.
- Integrated `bullmq` worker for asynchronous notification dispatching.
- Implemented `enqueueNotification` helper for tracking jobs in DB and Queue.
- Added a mocked `EmailService` using `nodemailer` with `jsonTransport`.
- Updated `appointments.service.ts` to trigger asynchronous emails upon appointment confirmation and cancellation.

## File Changes
- `src/jobs/notification-queue.ts`: Queue setup for notifications.
- `src/jobs/workers/notification.worker.ts`: Worker implementation using Nodemailer.
- `src/services/email.service.ts`: Abstraction for email sending.
- `src/modules/appointments/appointments.service.ts`: Wired up notification triggers.
- `prisma/schema.prisma`: Added schema definitions.

## Acceptance Tests
- `src/tests/phase6-notifications.test.ts` implemented and passing.
