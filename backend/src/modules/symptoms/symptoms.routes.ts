import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as symptomsController from './symptoms.controller.js';

export const symptomsRouter = Router();

symptomsRouter.use(authenticate);

symptomsRouter.post('/', symptomsController.submitSymptoms);
symptomsRouter.get('/appointment/:appointmentId', symptomsController.getSymptoms);
