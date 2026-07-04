import { Worker, Job } from 'bullmq';
import { connection } from '../queue.js';
import { JOB_GENERATE_VISIT_SUMMARY } from '../visit-queue.js';
import type { GenerateVisitSummaryJobData } from '../visit-queue.js';
import prisma from '../../db/client.js';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';

let anthropic: Anthropic | null = null;
if (env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export const visitSummaryWorker = new Worker(
  'visit-summary',
  async (job: Job<GenerateVisitSummaryJobData>) => {
    if (job.name === JOB_GENERATE_VISIT_SUMMARY) {
      const { visitNoteId } = job.data;

      const note = await prisma.visitNote.findUnique({
        where: { id: visitNoteId },
        include: { appointment: { include: { symptomForm: true } } },
      });

      if (!note || note.llmStatus === 'SUCCESS') return;

      try {
        if (env.NODE_ENV === 'test' || !env.ANTHROPIC_API_KEY) {
          if (note.doctorNotes.includes('SIMULATE_TIMEOUT')) {
            throw new Error('LLM Timeout Simulated');
          }
          await new Promise((res) => setTimeout(res, 500));
          await prisma.visitNote.update({
            where: { id: visitNoteId },
            data: {
              llmStatus: 'SUCCESS',
              llmPatientSummary: 'Mock patient summary: Drink water and rest.',
              llmRawResponse: '{"mocked": true}',
            },
          });
          return;
        }

        if (!anthropic) throw new Error('Anthropic client not initialized');

        // Combine symptoms, notes, and prescriptions for context
        const inputData = `
Patient Symptoms: ${note.appointment.symptomForm?.rawSymptoms ?? 'None'}
Doctor Notes: ${note.doctorNotes}
Prescriptions: ${JSON.stringify(note.prescription)}
`;

        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          timeout: 15000,
          system: `You are a medical assistant. Summarize the doctor's visit notes and prescriptions into a simple, easy-to-understand, 1-paragraph summary for the patient. Use plain language. Do NOT use medical jargon. Do NOT give medical advice beyond what the doctor prescribed.`,
          messages: [{ role: 'user', content: inputData }],
        });

        const content = response.content[0].type === 'text' ? response.content[0].text : '';

        await prisma.visitNote.update({
          where: { id: visitNoteId },
          data: {
            llmStatus: 'SUCCESS',
            llmPatientSummary: content.trim(),
            llmRawResponse: content,
          },
        });
      } catch (err: any) {
        console.error(`Visit Summary LLM Job failed for note ${visitNoteId}:`, err.message);
        await prisma.visitNote.update({
          where: { id: visitNoteId },
          data: {
            llmStatus: 'FAILED',
            llmRawResponse: err.message,
          },
        });
      }
    }
  },
  { connection, concurrency: 5 },
);

visitSummaryWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
});
