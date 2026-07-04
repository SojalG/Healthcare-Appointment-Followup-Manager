# Phase 7: Leave Management & Conflict Handling

## Features Implemented
- **Leave Creation with Cascading Cancellations**: Doctors can declare leaves using `POST /doctors/me/leaves`. In a single transaction, the system upserts the `Leave` record, queries overlapping `CONFIRMED` or `PENDING_HOLD` appointments, and marks them as `CANCELLED`.
- **Reschedule Link with Preserved Symptoms**: The rescheduling service (`rescheduleAppointment`) cancels the old appointment and holds a new slot in a transaction. If a `symptomForm` is present on the old appointment, it is cloned and attached to the new appointment so the patient does not have to re-fill the form.
- **Asynchronous Leave Notice Dispatch**: For each cancelled appointment, the system triggers a `LEAVE_NOTICE` email notification asynchronously outside of the database transaction using BullMQ.
- **Worker Support for Leave Notice**: Updated `notification.worker.ts` to process `LEAVE_NOTICE` notifications and send patient-friendly notifications explaining that the doctor is on leave.

## File Changes
- [doctors.routes.ts](file:///C:/Users/ratha/.gemini/antigravity-ide/scratch/healthcare-platform/backend/src/modules/doctors/doctors.routes.ts): Exposed `POST /me/leaves` endpoint to doctors.
- [doctors.controller.ts](file:///C:/Users/ratha/.gemini/antigravity-ide/scratch/healthcare-platform/backend/src/modules/doctors/doctors.controller.ts): Imported `createLeaveSchema` and wired it to `doctorsService.declareLeave`.
- [doctors.service.ts](file:///C:/Users/ratha/.gemini/antigravity-ide/scratch/healthcare-platform/backend/src/modules/doctors/doctors.service.ts): Implemented transactional leave declaration, cascading cancellation of appointments, and enqueuing of `LEAVE_NOTICE` notifications.
- [notification.worker.ts](file:///C:/Users/ratha/.gemini/antigravity-ide/scratch/healthcare-platform/backend/src/jobs/workers/notification.worker.ts): Added support for processing and formatting `LEAVE_NOTICE` emails.
- [test-runner.ts](file:///C:/Users/ratha/.gemini/antigravity-ide/scratch/healthcare-platform/backend/src/tests/test-runner.ts): Created reusable testing asserts and runner.
- [test-utils.ts](file:///C:/Users/ratha/.gemini/antigravity-ide/scratch/healthcare-platform/backend/src/tests/test-utils.ts): Created reusable HTTP request client helper.

## Acceptance Tests
- [phase7-leaves.test.ts](file:///C:/Users/ratha/.gemini/antigravity-ide/scratch/healthcare-platform/backend/src/tests/phase7-leaves.test.ts) updated to use correct API credentials and is passing.
