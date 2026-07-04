-- Double-Booking Prevention (§5)
-- Partial unique index: only one active appointment (PENDING_HOLD or CONFIRMED)
-- per doctor per time slot. The DB enforces this atomically, making concurrent
-- booking attempts safe without application-level locking.

CREATE UNIQUE INDEX uniq_doctor_slot_active
ON "appointments" (doctor_id, slot_start)
WHERE status IN ('PENDING_HOLD', 'CONFIRMED');