import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { doctorsRouter, doctorsPublicRouter } from './modules/doctors/doctors.routes.js';
import { appointmentsRouter } from './modules/appointments/appointments.routes.js';
import { symptomsRouter } from './modules/symptoms/symptoms.routes.js';
import { visitsRouter } from './modules/visits/visits.routes.js';
import { adminNotificationsRouter } from './modules/notifications/notifications.routes.js';

const app = express();

// --------------- Global Middleware ---------------
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// --------------- Health Check ---------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --------------- Routes ---------------
app.use('/auth', authRouter);
app.use('/admin/doctors', doctorsRouter);
app.use('/doctors', doctorsPublicRouter);
app.use('/appointments', appointmentsRouter);
app.use('/symptoms', symptomsRouter);
app.use('/visits', visitsRouter);
app.use('/admin/notifications', adminNotificationsRouter);
// Additional module routes will be mounted here as phases are built

// --------------- Error Handler (must be last) ---------------
app.use(errorHandler);

// --------------- Start Server ---------------
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`🏥 Healthcare API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});

export default app;
