# Phase 5 — Visit Notes & Prescriptions

## Overview
Phase 5 implements the doctor's visit workflow. After an appointment takes place, the doctor can add a detailed clinical note and structured prescriptions. The system immediately marks the appointment as `COMPLETED`. An asynchronous job is then triggered to generate a patient-friendly summary of the visit using an LLM.

## Key Decisions
1. **Separation of Notes and Summaries:** Doctors write notes using medical terminology. Patients need simple language. An LLM bridges this gap by summarizing the doctor's raw text and the structured prescription into a one-paragraph, jargon-free summary.
2. **Structured Prescriptions:** Prescriptions are saved as structured JSON rather than raw text. This is crucial for Phase 8 (Medication Reminders), where we will use the dosage and frequency fields to generate scheduled BullMQ reminder jobs.
3. **Asynchronous LLM Processing:** Like Phase 4, the LLM call is handled by a background worker (`visit-summary.worker.ts`) to prevent blocking the doctor's save operation.

## API Endpoints (Requires Auth)
- `POST /visits`: (Doctor Only) Saves the visit note and prescription. Requires the doctor to own the appointment.
- `GET /visits/appointment/:appointmentId`: Retrieves the full visit note, prescription, and LLM summary. Secured so patients can only see their own notes, and doctors can only see notes for their own appointments.

## Background Jobs
- **Worker Process:** `visit-summary` queue consumed by `visit-summary.worker.ts`.
- **Mocking:** In test environments, the summary is mocked to ensure reliable testing. Simulation of timeout failures is supported via the `SIMULATE_TIMEOUT` trigger.
