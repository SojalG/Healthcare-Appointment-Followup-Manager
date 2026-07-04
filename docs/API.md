# API Reference

All backend endpoints are listed below, grouped by domain. Unless marked **Public**, all requests require a bearer JWT token in the `Authorization` header: `Authorization: Bearer <token>`.

---

## 1. Authentication

### Register Patient
- **Method / Path**: `POST /auth/register`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "patient@test.com",
    "password": "Password123!",
    "name": "John Doe",
    "phone": "+1234567890"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": {
      "user": { "id": "uuid", "email": "patient@test.com", "name": "John Doe", "role": "PATIENT" },
      "accessToken": "jwt-token",
      "refreshToken": "jwt-token"
    }
  }
  ```

### Login
- **Method / Path**: `POST /auth/login`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "user@test.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "user": { "id": "uuid", "email": "user@test.com", "name": "Name", "role": "DOCTOR" },
      "accessToken": "jwt-token",
      "refreshToken": "jwt-token"
    }
  }
  ```

### Refresh Token
- **Method / Path**: `POST /auth/refresh`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "refreshToken": "jwt-token"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "accessToken": "jwt-token",
      "refreshToken": "jwt-token"
    }
  }
  ```

### Get Profile
- **Method / Path**: `GET /auth/profile`
- **Auth**: Bearer (Any Role)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "email": "user@test.com", "name": "Name", "role": "ADMIN" }
  }
  ```

---

## 2. Doctors (Public & Doctor Profile)

### Search Doctors
- **Method / Path**: `GET /doctors`
- **Query Params**: `specialisation` (optional, case-insensitive filter)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": [
      { "id": "profile-uuid", "specialisation": "Cardiology", "slotDurationMin": 30, "user": { "name": "Dr. Smith" } }
    ]
  }
  ```

### Get Available Slots
- **Method / Path**: `GET /doctors/:id/slots`
- **Query Params**: `date` (format `YYYY-MM-DD`, required)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": [
      { "start": "2026-07-06T09:00:00.000Z", "end": "2026-07-06T09:30:00.000Z", "available": true }
    ]
  }
  ```

### Declare Leave
- **Method / Path**: `POST /doctors/me/leaves`
- **Auth**: Bearer (DOCTOR role only)
- **Request Body**:
  ```json
  {
    "date": "2026-07-10",
    "reason": "Annual checkup"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "doctorId": "doc-uuid", "date": "2026-07-10T00:00:00.000Z", "reason": "Annual checkup" }
  }
  ```

---

## 3. Doctor Administration (Admin Only)

### List All Doctors
- **Method / Path**: `GET /admin/doctors`
- **Auth**: Bearer (ADMIN role only)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "uuid",
        "email": "doc@test.com",
        "name": "Dr. Alexander",
        "doctorProfile": {
          "id": "uuid",
          "specialisation": "Pediatrics",
          "slotDurationMin": 30,
          "workingHours": [{ "weekday": 1, "startTime": "09:00", "endTime": "17:00" }],
          "leaves": [{ "date": "2026-07-10T00:00:00.000Z", "reason": "Sick leave" }]
        }
      }
    ]
  }
  ```

### Create Doctor
- **Method / Path**: `POST /admin/doctors`
- **Auth**: Bearer (ADMIN role only)
- **Request Body**:
  ```json
  {
    "email": "doctor@test.com",
    "password": "Password123!",
    "name": "Dr. Sarah",
    "specialisation": "Dermatology",
    "slotDurationMin": 30,
    "workingHours": [
      { "weekday": 1, "startTime": "09:00", "endTime": "17:00" }
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": { "id": "user-uuid", "email": "doctor@test.com", "doctorProfile": { "id": "profile-uuid" } }
  }
  ```

---

## 4. Appointments

### Hold Slot
- **Method / Path**: `POST /appointments/hold`
- **Request Body**:
  ```json
  {
    "doctorId": "profile-uuid",
    "slotStart": "2026-07-06T10:00:00.000Z"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "status": "PENDING_HOLD", "holdExpiresAt": "2026-07-02T23:12:00.000Z" }
  }
  ```

### Confirm Appointment
- **Method / Path**: `POST /appointments/:id/confirm`
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "status": "CONFIRMED" }
  }
  ```

### Cancel Appointment
- **Method / Path**: `DELETE /appointments/:id`
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "status": "CANCELLED" }
  }
  ```

### Reschedule Appointment
- **Method / Path**: `POST /appointments/:id/reschedule`
- **Request Body**:
  ```json
  {
    "newSlotStart": "2026-07-07T11:00:00.000Z"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": { "id": "new-uuid", "status": "CONFIRMED" }
  }
  ```

### Get My Appointments
- **Method / Path**: `GET /appointments/mine`
- **Response (200 OK)**:
  - If PATIENT: Returns list of appointments patient booked.
  - If DOCTOR: Returns list of appointments scheduled for doctor, including symptom intakes.

---

## 5. Symptom Intake Forms

### Submit Symptoms
- **Method / Path**: `POST /symptoms`
- **Request Body**:
  ```json
  {
    "appointmentId": "uuid",
    "rawSymptoms": "I have been experiencing a mild fever and throat pain for 3 days."
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "llmStatus": "PENDING", "rawSymptoms": "..." }
  }
  ```

### Get Symptoms
- **Method / Path**: `GET /symptoms/appointment/:appointmentId`
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "llmStatus": "SUCCESS", "llmUrgency": "LOW", "llmChiefComplaint": "Throat discomfort" }
  }
  ```

---

## 6. Post-Visit Notes & Reminders

### Save Visit Notes (Doctor Only)
- **Method / Path**: `POST /visits`
- **Auth**: Bearer (DOCTOR role only)
- **Request Body**:
  ```json
  {
    "appointmentId": "uuid",
    "doctorNotes": "Patient has throat infection. Take Amoxicillin.",
    "prescription": [
      { "drug": "Amoxicillin", "dosage": "500mg", "frequency": "Every 8 hours", "duration": "5 days", "instructions": "After food" }
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "llmStatus": "PENDING" }
  }
  ```

### Get Visit Summary
- **Method / Path**: `GET /visits/appointment/:appointmentId`
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": { "id": "uuid", "doctorNotes": "...", "llmPatientSummary": "...", "llmStatus": "SUCCESS" }
  }
  ```

---

## 7. Admin Dead Letters (Notification Dashboard)

### Get Failed Notifications
- **Method / Path**: `GET /admin/notifications/failed`
- **Auth**: Bearer (ADMIN role only)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": [
      { "id": "log-uuid", "type": "CONFIRMATION", "channel": "EMAIL", "attempts": 3, "lastError": "SMTP timeout" }
    ]
  }
  ```

### Retry Failed Notification
- **Method / Path**: `POST /admin/notifications/:id/retry`
- **Auth**: Bearer (ADMIN role only)
- **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": { "id": "log-uuid", "status": "PENDING", "attempts": 0 }
  }
  ```
