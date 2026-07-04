import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../api/client.js';
import { Calendar, User, Clock, ArrowLeft, FileText, Plus, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Zod schema
const prescriptionItemSchema = z.object({
  drug: z.string().min(1, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required (e.g. 500mg)'),
  frequency: z.string().min(1, 'Frequency is required (e.g. 3x daily)'),
  duration: z.string().min(1, 'Duration is required (e.g. 5 days)'),
  instructions: z.string().optional(),
});

const visitNoteSchema = z.object({
  doctorNotes: z.string().min(10, 'Clinical notes must be at least 10 characters long'),
  prescription: z.array(prescriptionItemSchema),
});

type VisitNoteFields = z.infer<typeof visitNoteSchema>;

interface Appointment {
  id: string;
  slotStart: string;
  slotEnd: string;
  status: 'CONFIRMED' | 'PENDING_HOLD' | 'CANCELLED' | 'COMPLETED';
  patient: {
    name: string;
    email: string;
  };
  symptomForm?: {
    rawSymptoms: string;
    llmUrgency?: string;
    llmChiefComplaint?: string;
    llmQuestions?: string[] | string;
    llmStatus: string;
  } | null;
  visitNote?: {
    doctorNotes: string;
    prescription?: any;
    llmPatientSummary?: string;
    llmStatus: string;
  } | null;
}

export const VisitNoteForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);

  // Fetch appointment & details
  const { data: appointment, isLoading, isError } = useQuery({
    queryKey: ['appointment-visit', id],
    queryFn: async () => {
      const { data } = await apiClient.get('/appointments/mine');
      const list = data.data as Appointment[];
      const found = list.find((a) => a.id === id);
      if (!found) throw new Error('Appointment not found');
      return found;
    }
  });

  const isCompleted = appointment?.status === 'COMPLETED';

  // React Hook Form
  const { register, control, handleSubmit, formState: { errors } } = useForm<VisitNoteFields>({
    resolver: zodResolver(visitNoteSchema),
    defaultValues: {
      doctorNotes: '',
      prescription: [],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'prescription',
  });

  // Submit Visit Note Mutation
  const submitMutation = useMutation({
    mutationFn: async (data: VisitNoteFields) => {
      await apiClient.post('/visits', {
        appointmentId: id,
        doctorNotes: data.doctorNotes,
        prescription: data.prescription,
      });
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-visit', id] });
      setTimeout(() => {
        navigate('/doctor');
      }, 2000);
    }
  });

  const onSubmit = async (data: VisitNoteFields) => {
    try {
      await submitMutation.mutateAsync(data);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to file visit notes. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
        <div className="h-96 w-full bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
      </div>
    );
  }

  if (isError || !appointment) {
    return (
      <div className="text-center py-12 space-y-4 max-w-md mx-auto">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-xl font-bold">Consultation details not found</h2>
        <button onClick={() => navigate('/doctor')} className="btn-primary">
          Back to Queue
        </button>
      </div>
    );
  }

  // Parse functions
  const getQuestionsList = (questions: any): string[] => {
    if (!questions) return [];
    if (Array.isArray(questions)) return questions;
    try {
      if (typeof questions === 'string') {
        const parsed = JSON.parse(questions);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  };

  const getPrescriptionList = (prescription: any) => {
    if (!prescription) return [];
    if (Array.isArray(prescription)) return prescription;
    try {
      if (typeof prescription === 'string') {
        return JSON.parse(prescription);
      }
    } catch {}
    return [];
  };

  const symptomQuestions = getQuestionsList(appointment.symptomForm?.llmQuestions);
  const filedPrescriptions = getPrescriptionList(appointment.visitNote?.prescription);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/doctor')}
          className="p-2 border border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {isCompleted ? 'Review Consultation Record' : 'Consultation Intakes & Filing'}
          </h1>
          <p className="text-xs text-surface-500">Appointment ID: {appointment.id}</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 text-green-750 dark:text-green-300 rounded-xl border border-green-100 dark:border-green-900/30 text-sm">
          <CheckCircle size={20} className="shrink-0 text-green-600 dark:text-green-400" />
          <span>Visit notes filed and finalized successfully! Returning to patient queue...</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Intakes & Symptoms Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-5 bg-white/70 dark:bg-surface-900/50 space-y-3.5 text-sm">
            <h3 className="font-bold text-base text-primary-700 dark:text-primary-400">Patient Details</h3>
            <div className="flex items-center gap-2">
              <User size={16} className="text-surface-500" />
              <span className="font-bold">{appointment.patient.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-surface-500" />
              <span>
                {format(parseISO(appointment.slotStart), 'h:mm a')} – {format(parseISO(appointment.slotEnd), 'h:mm a')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-surface-500" />
              <span>{format(parseISO(appointment.slotStart), 'EEEE, MMMM d, yyyy')}</span>
            </div>
          </div>

          {appointment.symptomForm && (
            <div className="glass-card p-5 bg-white/70 dark:bg-surface-900/50 space-y-4 text-xs">
              <h3 className="font-bold text-sm text-primary-700 dark:text-primary-400 flex items-center gap-1.5">
                <FileText size={16} />
                Clinical Intakes Form
              </h3>
              
              <div>
                <span className="text-[10px] font-bold text-surface-500 uppercase block mb-1">Patient-Reported Symptoms</span>
                <p className="p-3 bg-surface-50 dark:bg-surface-950/20 border border-surface-200 dark:border-surface-850 rounded-lg text-surface-700 dark:text-surface-300 italic">
                  "{appointment.symptomForm.rawSymptoms}"
                </p>
              </div>

              {appointment.symptomForm.llmStatus === 'SUCCESS' && (
                <div className="space-y-3 pt-3 border-t border-surface-100 dark:border-surface-850">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-surface-500 uppercase">Triage Urgency</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      appointment.symptomForm.llmUrgency === 'HIGH' ? 'bg-red-500/10 text-red-500' : 'bg-primary-500/10 text-primary-500'
                    }`}>
                      {appointment.symptomForm.llmUrgency}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-surface-500 uppercase block mb-0.5">Chief Complaint</span>
                    <p className="font-bold text-surface-900 dark:text-surface-100">{appointment.symptomForm.llmChiefComplaint}</p>
                  </div>

                  {symptomQuestions.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-surface-500 uppercase block mb-1.5">Suggested Questions</span>
                      <ul className="space-y-1.5">
                        {symptomQuestions.map((q, idx) => (
                          <li key={idx} className="p-2 bg-primary-500/5 border border-primary-500/10 rounded-lg font-medium text-surface-700 dark:text-surface-300">
                            • {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: filing / view consult form */}
        <div className="lg:col-span-2 space-y-6">
          {isCompleted ? (
            /* READ-ONLY CONSULT VIEW */
            <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 space-y-6">
              <div>
                <h3 className="font-bold text-lg text-primary-700 dark:text-primary-400 mb-3">Clinical Visit Notes</h3>
                <p className="text-sm bg-surface-50 dark:bg-surface-850/50 p-4 border border-surface-200 dark:border-surface-800 rounded-xl leading-relaxed">
                  {appointment.visitNote?.doctorNotes}
                </p>
              </div>

              {appointment.visitNote?.llmPatientSummary && (
                <div className="border-t border-surface-100 dark:border-surface-850 pt-6">
                  <h4 className="font-bold text-sm text-surface-500 uppercase block mb-2.5">Generated Patient Guide (AI)</h4>
                  <p className="text-sm p-4 bg-primary-500/5 border border-primary-500/10 rounded-xl font-medium leading-relaxed">
                    {appointment.visitNote.llmPatientSummary}
                  </p>
                </div>
              )}

              {filedPrescriptions.length > 0 && (
                <div className="border-t border-surface-100 dark:border-surface-850 pt-6">
                  <h4 className="font-bold text-sm text-surface-500 uppercase block mb-3">Prescribed Medications</h4>
                  <div className="grid gap-3">
                    {filedPrescriptions.map((med: any, index: number) => (
                      <div 
                        key={index}
                        className="p-4 bg-white dark:bg-surface-950/20 border border-surface-250 dark:border-surface-850 rounded-xl flex items-center justify-between text-sm shadow-xs"
                      >
                        <div>
                          <span className="font-bold text-primary-700 dark:text-primary-400">{med.drug}</span>
                          <span className="ml-2 px-2 py-0.5 text-xs font-bold rounded bg-surface-100 dark:bg-surface-800">{med.dosage}</span>
                          <p className="text-xs text-surface-500 mt-1">Schedule: {med.frequency} for {med.duration}</p>
                        </div>
                        {med.instructions && (
                          <span className="text-xs bg-surface-50 dark:bg-surface-850/50 p-2 border border-surface-150 dark:border-surface-800 rounded-lg text-surface-650 font-medium">
                            {med.instructions}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ACTIVE VISIT FILING FORM */
            <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 space-y-6">
              <h3 className="font-bold text-lg text-primary-700 dark:text-primary-400">File Consultation Record</h3>

              {/* Doctor Clinical Notes */}
              <div>
                <label className="block text-xs font-semibold text-surface-650 uppercase tracking-wider mb-2">
                  Clinical Examination & Diagnoses Notes
                </label>
                <textarea
                  placeholder="Record your clinical summary, diagnosis, symptoms observed, and medical conclusions here..."
                  rows={6}
                  {...register('doctorNotes')}
                  className="w-full px-4 py-3 rounded-lg border border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-950/30 focus:border-primary-500 focus:outline-none text-sm transition-colors"
                />
                {errors.doctorNotes && (
                  <p className="text-xs text-red-500 mt-1">{errors.doctorNotes.message}</p>
                )}
              </div>

              {/* Prescription Dynamically Added Array */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-surface-650 uppercase tracking-wider">Prescribe Medications</span>
                  <button
                    type="button"
                    onClick={() => append({ drug: '', dosage: '', frequency: '', duration: '', instructions: '' })}
                    className="px-3 py-1.5 text-xs font-bold text-primary-650 hover:bg-primary-50 dark:hover:bg-primary-950/20 border border-primary-300 dark:border-primary-900 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Plus size={14} />
                    <span>Add Medication</span>
                  </button>
                </div>

                {fields.length === 0 ? (
                  <p className="text-xs text-surface-500 italic p-4 border border-dashed border-surface-200 dark:border-surface-800 rounded-lg text-center">
                    No medications added to this prescription yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div 
                        key={field.id}
                        className="p-4 bg-surface-50 dark:bg-surface-850/30 border border-surface-200 dark:border-surface-800 rounded-xl relative space-y-3"
                      >
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="absolute top-4 right-4 text-surface-400 hover:text-red-500 transition-colors"
                          title="Remove Medication"
                        >
                          <Trash2 size={16} />
                        </button>

                        <div className="grid sm:grid-cols-2 gap-3 pr-8">
                          <div>
                            <label className="block text-[10px] font-bold text-surface-500 uppercase mb-1">Drug Name</label>
                            <input
                              type="text"
                              placeholder="e.g. Amoxicillin"
                              {...register(`prescription.${index}.drug` as const)}
                              className="w-full px-3 py-1.5 text-xs border border-surface-200 dark:border-surface-800 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                            />
                            {errors.prescription?.[index]?.drug && (
                              <p className="text-[10px] text-red-500 mt-0.5">{errors.prescription[index]?.drug?.message}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-surface-500 uppercase mb-1">Dosage</label>
                            <input
                              type="text"
                              placeholder="e.g. 500mg"
                              {...register(`prescription.${index}.dosage` as const)}
                              className="w-full px-3 py-1.5 text-xs border border-surface-200 dark:border-surface-800 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                            />
                            {errors.prescription?.[index]?.dosage && (
                              <p className="text-[10px] text-red-500 mt-0.5">{errors.prescription[index]?.dosage?.message}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-surface-500 uppercase mb-1">Frequency</label>
                            <input
                              type="text"
                              placeholder="e.g. 3x daily"
                              {...register(`prescription.${index}.frequency` as const)}
                              className="w-full px-3 py-1.5 text-xs border border-surface-200 dark:border-surface-800 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                            />
                            {errors.prescription?.[index]?.frequency && (
                              <p className="text-[10px] text-red-500 mt-0.5">{errors.prescription[index]?.frequency?.message}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-surface-500 uppercase mb-1">Duration</label>
                            <input
                              type="text"
                              placeholder="e.g. 5 days"
                              {...register(`prescription.${index}.duration` as const)}
                              className="w-full px-3 py-1.5 text-xs border border-surface-200 dark:border-surface-800 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                            />
                            {errors.prescription?.[index]?.duration && (
                              <p className="text-[10px] text-red-500 mt-0.5">{errors.prescription[index]?.duration?.message}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-surface-500 uppercase mb-1">Special Instructions</label>
                          <input
                            type="text"
                            placeholder="e.g. Take with food, drink plenty of water"
                            {...register(`prescription.${index}.instructions` as const)}
                            className="w-full px-3 py-1.5 text-xs border border-surface-200 dark:border-surface-800 rounded-lg bg-white focus:outline-none focus:border-primary-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-surface-100 dark:border-surface-850">
                <button
                  type="button"
                  onClick={() => navigate('/doctor')}
                  className="px-5 py-2.5 border border-surface-200 dark:border-surface-850 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitMutation.isPending || success}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-550 text-white rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitMutation.isPending ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Filing & Generating AI summary...</span>
                    </>
                  ) : (
                    'Finalize Consultation Notes'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisitNoteForm;
