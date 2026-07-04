# Phase 9: Reliability Pass

## Features Implemented

### 1. Custom Exponential Backoff Strategy
- Configured a custom exponential backoff strategy (`customExponential`) for BullMQ queues and workers to handle transient failures cleanly.
- In test mode, it retries with short delays (50ms, 100ms, 150ms) to keep execution fast.
- In production mode, it retries with longer intervals:
  - Attempt 1: 1 minute
  - Attempt 2: 5 minutes
  - Attempt 3: 20 minutes
- If all 3 attempts fail, the job terminates and lands in the `FAILED` status, logging the exact error message.

### 2. Idempotency Key Handling
- Implemented idempotency checks on `/appointments/hold` using doctor ID and slot start times as a combined key.
- Ensures duplicate requests return the same initial hold response without double-booking or throwing generic database conflict errors.
- If a hold is active, subsequent identical hold requests return the existing hold details.
- Handles race conditions gracefully under heavy concurrency.

### 3. Dead-Letter System & Database Status Tracking
- Designed the `NotificationLog` model to track notification attempts, statuses (`PENDING`, `SENT`, `FAILED`), and error details.
- Retries update the log record count dynamically.
- Final failures set the log status to `FAILED` and record the last error trace.
- Created administration endpoints under `/admin/dead-letters`:
  - `GET /admin/dead-letters`: Lists all failed notifications.
  - `POST /admin/dead-letters/:id/retry`: Resubmits a failed job back to the BullMQ queue to execute another retry attempt.
