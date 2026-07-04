import { Worker, Job } from 'bullmq';
import { connection, JOB_ANALYZE_SYMPTOMS } from '../queue.js';
import type { AnalyzeSymptomsJobData } from '../queue.js';
import prisma from '../../db/client.js';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';

let anthropic: Anthropic | null = null;
if (env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}


export const llmWorker = new Worker(
  'llm',
  async (job: Job<AnalyzeSymptomsJobData>) => {
    if (job.name === JOB_ANALYZE_SYMPTOMS) {
      const { symptomFormId } = job.data;

      // 1. Fetch form
      const form = await prisma.symptomForm.findUnique({
        where: { id: symptomFormId },
      });

      if (!form || form.llmStatus === 'SUCCESS') return;

      try {
        // 2. Call Anthropic with 15s timeout
        // (Mocking LLM in test env if no API key is provided, or for tests)
        if (env.NODE_ENV === 'test' || !env.ANTHROPIC_API_KEY) {
          // If the mock payload contains "SIMULATE_TIMEOUT", simulate a failure
          if (form.rawSymptoms.includes('SIMULATE_TIMEOUT')) {
            throw new Error('LLM Timeout Simulated');
          }

          // Mock response
          await new Promise((res) => setTimeout(res, 500));
          await prisma.symptomForm.update({
            where: { id: symptomFormId },
            data: {
              llmStatus: 'SUCCESS',
              llmUrgency: 'ROUTINE',
              llmChiefComplaint: 'Simulated chief complaint',
              llmQuestions: ['Question 1?', 'Question 2?'],
              llmRawResponse: '{"mocked": true}',
            },
          });
          return;
        }

        // Real Anthropic call
        if (!anthropic) throw new Error('Anthropic client not initialized (missing API key)');
        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          timeout: 15000, // 15s limit per spec
          system: `You are a medical triage assistant. Analyze the patient's raw symptoms.
Return a JSON object EXACTLY matching this schema, nothing else:
{
  "urgency": "ROUTINE" | "URGENT" | "EMERGENCY",
  "chiefComplaint": "Short 3-5 word summary",
  "questions": ["1-3 suggested questions for the doctor to ask"]
}`,
          messages: [{ role: 'user', content: form.rawSymptoms }],
        });

        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = JSON.parse(content);

        // 3. Update DB
        await prisma.symptomForm.update({
          where: { id: symptomFormId },
          data: {
            llmStatus: 'SUCCESS',
            llmUrgency: parsed.urgency || 'ROUTINE',
            llmChiefComplaint: parsed.chiefComplaint || 'Unknown',
            llmQuestions: parsed.questions || [],
            llmRawResponse: content,
          },
        });
      } catch (err: any) {
        // 4. Handle failure gracefully without blocking booking
        console.error(`LLM Job failed for form ${symptomFormId}:`, err.message);
        await prisma.symptomForm.update({
          where: { id: symptomFormId },
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

llmWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
});
