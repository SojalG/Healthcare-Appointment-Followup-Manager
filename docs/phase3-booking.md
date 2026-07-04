# Phase 3 — Search & Booking

## Overview
Phase 3 implements the core booking engine, handling slot holds, confirmations, cancellations, and rescheduling. The critical focus is on concurrency safety to prevent double-booking.

## Key Decisions
1. **Database-Level Concurrency Safety:** Instead of using application-level check-and-insert (which is susceptible to race conditions), we rely on a PostgreSQL partial unique index:
   ```sql
   CREATE UNIQUE INDEX uniq_doctor_slot_active
   ON "appointments" (doctor_id, slot_start)
   WHERE status IN ('PENDING_HOLD', 'CONFIRMED');
   ```
   If two patients simultaneously attempt to hold the same slot, the database atomically rejects one with a unique constraint violation (Prisma code `P2002`), which we map to an HTTP 409 Conflict.
2. **Two-Step Booking (Hold then Confirm):** Patients first "hold" a slot (`PENDING_HOLD`), which reserves it for a configurable duration (default 5 minutes). After completing subsequent steps (like the symptom form in Phase 4), they confirm the booking.
3. **Rescheduling as a Transaction:** Rescheduling atomically cancels the old appointment and holds a new slot in a single transaction, preserving any attached symptom form data.

## API Endpoints (Requires Auth)
- `POST /appointments/hold`: Holds a slot for the authenticated user.
- `POST /appointments/:id/confirm`: Confirms a previously held slot.
- `DELETE /appointments/:id`: Cancels an appointment.
- `POST /appointments/:id/reschedule`: Reschedules an appointment to a new slot.
- `GET /appointments/mine`: Retrieves all appointments for the authenticated user.

## Background Jobs (Upcoming)
- A background worker will periodically sweep and delete `PENDING_HOLD` appointments whose `holdExpiresAt` is in the past.
