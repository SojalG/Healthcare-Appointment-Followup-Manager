import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client.js';
import { Calendar, User, Clock, ArrowLeft, ShieldAlert, Pill, FileText, CheckSquare, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AppointmentDetail {
  id: string;
  doctor: {
    user: {
      name: string;
    };
    specialisation: string;
  };
  slotStart: string;
  slotEnd: string;
  status: 'PENDING_HOLD' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  symptomForm?: {
    rawSymptoms: string;
    llmUrgency?: 'LOW' | 'MEDIUM' | 'HIGH';
    llmChiefComplaint?: string;
    llmQuestions?: string[] | string; // JSON parsed or array
    llmStatus: 'SUCCESS' | 'FAILED' | 'PENDING';
  } | null;
  visitNote?: {
    doctorNotes: string;
    prescription?: {
      drug: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }[] | string;
    llmPatientSummary?: string;
    llmStatus: 'SUCCESS' | 'FAILED' | 'PENDING';
  } | null;
}

export const AppointmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: appointment, isLoading, isError } = useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/appointments/mine`);
      const list = data.data as AppointmentDetail[];
      const found = list.find((a) => a.id === id);
      if (!found) throw new Error('Appointment not found');
      return found;
    }
  });

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'HIGH': return 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30';
      case 'MEDIUM': return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/30';
      case 'LOW': return 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30';
      default: return 'bg-surface-50 text-surface-650';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">Confirmed</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-750 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">Completed</span>;
      case 'PENDING_HOLD':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 text-amber-500">Hold</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30">Cancelled</span>;
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
        <p className="text-sm text-surface-650">We couldn't retrieve the requested consultation records.</p>
        <button onClick={() => navigate('/patient')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Helper to safely parse questions string/array
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

  // Helper to parse prescription array
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
  const prescriptionItems = getPrescriptionList(appointment.visitNote?.prescription);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/patient')}
          className="p-2 border border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Consultation details</h1>
          <p className="text-xs text-surface-500">ID: {appointment.id}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Doctor Card & Appointment Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-950/40 rounded-xl flex items-center justify-center text-primary-700 dark:text-primary-400 font-bold shrink-0">
                <User size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base">Dr. {appointment.doctor.user.name}</h3>
                <p className="text-xs text-primary-650 dark:text-primary-400 font-semibold">{appointment.doctor.specialisation}</p>
              </div>
            </div>

            <div className="border-t border-surface-100 dark:border-surface-850 pt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-surface-500" />
                <span>{format(parseISO(appointment.slotStart), 'MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-surface-500" />
                <span>{format(parseISO(appointment.slotStart), 'h:mm a')} – {format(parseISO(appointment.slotEnd), 'h:mm a')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-surface-500 font-semibold text-xs uppercase">Status</span>
                {getStatusBadge(appointment.status)}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Symptoms and Visit Notes details */}
        <div className="md:col-span-2 space-y-6">
          {/* 1. Symptoms Form & AI Clinical Triage Summary */}
          {appointment.symptomForm && (
            <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 space-y-6">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2 text-primary-700 dark:text-primary-400">
                  <FileText size={18} />
                  Symptom Information
                </h3>
                <p className="text-sm text-surface-800 mt-3 p-4 bg-surface-50 dark:bg-surface-850/50 rounded-xl border border-surface-200 dark:border-surface-800">
                  {appointment.symptomForm.rawSymptoms}
                </p>
              </div>

              {/* AI Triage Section */}
              <div className="border-t border-surface-100 dark:border-surface-850 pt-6">
                <h4 className="font-bold text-sm mb-3">AI Clinical Triage Summary</h4>

                {appointment.symptomForm.llmStatus === 'PENDING' && (
                  <div className="flex items-center gap-2 text-sm text-surface-650 py-2">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Analyzing symptoms... AI summary will appear shortly.</span>
                  </div>
                )}

                {appointment.symptomForm.llmStatus === 'FAILED' && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <ShieldAlert size={16} />
                    <span>AI clinical triage summary unavailable — see raw symptoms details above.</span>
                  </div>
                )}

                {appointment.symptomForm.llmStatus === 'SUCCESS' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Urgency Level</span>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getUrgencyColor(appointment.symptomForm.llmUrgency)}`}>
                        {appointment.symptomForm.llmUrgency}
                      </span>
                    </div>

                    {appointment.symptomForm.llmChiefComplaint && (
                      <div>
                        <span className="text-xs font-semibold text-surface-500 uppercase block mb-1">Chief Complaint Summary</span>
                        <p className="text-sm font-semibold">{appointment.symptomForm.llmChiefComplaint}</p>
                      </div>
                    )}

                    {symptomQuestions.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-surface-500 uppercase block mb-2">Suggested Consultation Questions</span>
                        <ul className="grid gap-2">
                          {symptomQuestions.map((q, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 p-3 bg-primary-500/5 rounded-lg border border-primary-500/10 text-xs">
                              <CheckSquare size={14} className="text-primary-600 shrink-0 mt-0.5" />
                              <span className="font-medium">{q}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. Doctor Visit Notes and Prescriptions (AI patient summary) */}
          {appointment.status === 'COMPLETED' && (
            <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 space-y-6">
              <h3 className="font-bold text-lg flex items-center gap-2 text-primary-700 dark:text-primary-400">
                <Pill size={18} />
                Visit Notes & Prescriptions
              </h3>

              {appointment.visitNote ? (
                <div className="space-y-6">
                  {/* Doctor Notes */}
                  {appointment.visitNote.doctorNotes && (
                    <div>
                      <span className="text-xs font-semibold text-surface-500 uppercase block mb-2">Clinical Visit Summary</span>
                      <p className="text-sm bg-surface-50 dark:bg-surface-850/50 border border-surface-200 dark:border-surface-800 p-4 rounded-xl">
                        {appointment.visitNote.doctorNotes}
                      </p>
                    </div>
                  )}

                  {/* AI Patient Friendly Summary */}
                  <div className="border-t border-surface-100 dark:border-surface-850 pt-6 space-y-3">
                    <h4 className="font-bold text-sm">AI Patient-Friendly Guide</h4>

                    {appointment.visitNote.llmStatus === 'PENDING' && (
                      <div className="flex items-center gap-2 text-sm text-surface-650 py-2">
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Simplifying doctor notes... patient guide will appear shortly.</span>
                      </div>
                    )}

                    {appointment.visitNote.llmStatus === 'FAILED' && (
                      <div className="flex items-center gap-2.5 p-3.5 bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium">
                        <ShieldAlert size={16} />
                        <span>AI post-visit summary summary unavailable — see raw doctor notes above.</span>
                      </div>
                    )}

                    {appointment.visitNote.llmStatus === 'SUCCESS' && appointment.visitNote.llmPatientSummary && (
                      <p className="text-sm leading-relaxed p-4 bg-primary-500/5 border border-primary-500/10 rounded-xl font-medium">
                        {appointment.visitNote.llmPatientSummary}
                      </p>
                    )}
                  </div>

                  {/* Prescription grid list */}
                  {prescriptionItems.length > 0 && (
                    <div className="border-t border-surface-100 dark:border-surface-850 pt-6">
                      <span className="text-xs font-semibold text-surface-500 uppercase block mb-3">Prescribed Medications</span>
                      <div className="grid gap-3">
                        {prescriptionItems.map((med: any, index: number) => (
                          <div 
                            key={index}
                            className="p-4 bg-white dark:bg-surface-950/20 border border-surface-200 dark:border-surface-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                          >
                            <div>
                              <span className="font-bold text-primary-700 dark:text-primary-400">{med.drug}</span>
                              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded bg-surface-100 dark:bg-surface-800">{med.dosage}</span>
                              <p className="text-xs text-surface-600 mt-1 font-medium">
                                Schedule: {med.frequency} for {med.duration}
                              </p>
                            </div>
                            {med.instructions && (
                              <div className="text-xs bg-surface-50 dark:bg-surface-850/50 p-2.5 rounded-lg border border-surface-150 dark:border-surface-800 text-surface-650 sm:max-w-xs leading-relaxed font-semibold">
                                <span className="font-bold block mb-0.5 text-surface-500 text-[10px] uppercase">Instructions</span>
                                {med.instructions}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-surface-500 italic">No notes are prescription details filed for this visit yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetail;
