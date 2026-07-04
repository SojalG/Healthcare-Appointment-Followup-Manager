# Phase 2 — Doctor & Slot Management

## Overview
Phase 2 implements the core doctor profiles, working hours, leave management, and on-the-fly virtual slot generation.

## Key Decisions
1. **Virtual Slot Generation:** Slots are NOT pre-materialized in a database table. Instead, they are generated on-the-fly by intersecting a doctor's working hours for the requested weekday with their slot duration, and filtering out active bookings or leave days.
2. **Flexible Working Hours:** Doctors can have multiple working hour blocks per day.
3. **Leave Management:** Simple whole-day leave management blocks out entire days from slot generation.

## API Endpoints

### Admin Routes (Requires Auth + Admin Role)
- `POST /admin/doctors`: Creates a User, DoctorProfile, and WorkingHours in a single transaction.
- `GET /admin/doctors`: Lists all doctors.
- `GET /admin/doctors/:id`: Retrieves a specific doctor with profile and working hours.
- `PUT /admin/doctors/:id`: Updates doctor details.
- `DELETE /admin/doctors/:id`: Deletes a doctor (cascade deletes profile and working hours).

### Public Routes (Requires Auth, Any Role)
- `GET /doctors`: Searches doctors (optionally by `specialisation`).
- `GET /doctors/:id/slots?date=YYYY-MM-DD`: Returns an array of `Slot` objects (start, end, available) for the requested date.

## Prisma Schema Additions
- `DoctorProfile`: Links to `User`. Contains `specialisation` and `slotDurationMin`.
- `WorkingHours`: Links to `DoctorProfile`. Contains `weekday`, `startTime`, and `endTime`.
- `Leave`: Links to `DoctorProfile`. Contains `date` and `reason`.
