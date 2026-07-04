import { Queue } from 'bullmq';
import { connection } from './queue.js';

export const JOB_GENERATE_VISIT_SUMMARY = 'generateVisitSummary';

export const visitSummaryQueue = new Queue('visit-summary', { connection });

export interface GenerateVisitSummaryJobData {
  visitNoteId: string;
}
