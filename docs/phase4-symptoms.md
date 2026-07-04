# Phase 4 — Pre-Visit Symptom Form & LLM Triage

## Overview
Phase 4 introduces a pre-visit symptom form that patients fill out after holding a slot but before confirming it (or after confirmation). Once submitted, an asynchronous job uses an LLM (Anthropic Claude 3 Haiku) to triage the symptoms.

## Key Decisions
1. **Asynchronous LLM Processing:** LLM calls are notoriously variable in latency and can fail. To avoid blocking the booking flow, the symptom submission endpoint immediately returns a 201 Created and enqueues a job to BullMQ.
2. **Graceful Degradation:** The LLM job has a strict 15-second timeout. If the LLM API times out or returns an error, the worker catches the error, marks the `llmStatus` as `FAILED`, and logs the raw response. The application flow continues unaffected.
3. **Structured Extraction:** The LLM is prompted to return a strict JSON schema containing:
   - `urgency`: ROUTINE, URGENT, EMERGENCY
   - `chiefComplaint`: Short summary
   - `questions`: Suggested follow-up questions for the doctor

## API Endpoints (Requires Auth)
- `POST /symptoms`: Submits raw symptoms and enqueues the LLM job. Returns `llmStatus: PENDING`.
- `GET /symptoms/appointment/:appointmentId`: Retrieves the symptom form and its LLM triage results.

## Background Jobs
- **Worker Process:** `src/worker.ts` handles the `llm` queue.
- **Mocking:** In test environments (or if no API key is provided), the worker mocks the LLM response to ensure tests are fast and reliable. A mock payload containing `SIMULATE_TIMEOUT` will test the error handling path.
