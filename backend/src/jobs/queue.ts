import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';

// Shared Redis connection for BullMQ
export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Job names
export const JOB_ANALYZE_SYMPTOMS = 'analyzeSymptoms';

// Queues
export const llmQueue = new Queue('llm', { connection });

// Types
export interface AnalyzeSymptomsJobData {
  symptomFormId: string;
}
