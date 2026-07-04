import { llmWorker } from './jobs/workers/llm.worker.js';
import { visitSummaryWorker } from './jobs/workers/visit-summary.worker.js';
import { notificationWorker } from './jobs/workers/notification.worker.js';
import { medicationReminderWorker } from './jobs/workers/medication-reminder.worker.js';

console.log('👷 Background worker started');
console.log('Listening for jobs on queues: [llm, visit-summary, notifications, medication-reminders]');

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await llmWorker.close();
  await visitSummaryWorker.close();
  await notificationWorker.close();
  await medicationReminderWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await llmWorker.close();
  await visitSummaryWorker.close();
  await notificationWorker.close();
  await medicationReminderWorker.close();
  process.exit(0);
});
