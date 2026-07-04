import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client.js';
import { Calendar, User, Clock, ArrowRight, UserCheck, Stethoscope } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Appointment {
  id: string;
  patientId: string;
  slotStart: string;
  slotEnd: string;
  status: 'CONFIRMED' | 'PENDING_HOLD' | 'CANCELLED' | 'COMPLETED';
  patient: {
    name: string;
    email: string;
  };
  symptomForm?: {
    rawSymptoms: string;
    llmUrgency?: 'LOW' | 'MEDIUM' | 'HIGH';
    llmChiefComplaint?: string;
    llmStatus: 'SUCCESS' | 'FAILED' | 'PENDING';
  } | null;
  visitNote?: {
    id: string;
    doctorNotes: string;
  } | null;
}

export const DailyQueue: React.FC = () => {
  const navigate = useNavigate();

  // Fetch doctor's queue
  const { data: appointmentsResponse, isLoading } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: async () => {
      const { data } = await apiClient.get('/appointments/mine');
      return data.data as Appointment[];
    }
  });

  const appointments = appointmentsResponse || [];

  // Filter only active daily schedules (Confirmed or Completed)
  const activeQueue = appointments.filter(apt => 
    apt.status === 'CONFIRMED' || apt.status === 'COMPLETED'
  );

  // Sorting: COMPLETED items go to the bottom. Active items sorted by LLM Urgency (HIGH first, then MEDIUM, then LOW), then by start time.
  const sortedQueue = [...activeQueue].sort((a, b) => {
    if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
    if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;

    // Sort by Urgency
    const urgencyWeight = (urgency?: string) => {
      if (urgency === 'HIGH') return 3;
      if (urgency === 'MEDIUM') return 2;
      if (urgency === 'LOW') return 1;
      return 0;
    };

    const weightA = urgencyWeight(a.symptomForm?.llmUrgency);
    const weightB = urgencyWeight(b.symptomForm?.llmUrgency);

    if (weightA !== weightB) {
      return weightB - weightA; // Higher weight first
    }

    return parseISO(a.slotStart).getTime() - parseISO(b.slotStart).getTime();
  });

  const getUrgencyBadge = (urgency?: string) => {
    switch (urgency) {
      case 'HIGH':
        return (
          <span className="px-2.5 py-1 text-xs font-extrabold rounded-full bg-red-100 dark:bg-red-950/40 text-red-750 dark:text-red-400 border border-red-200 dark:border-red-900/30 animate-pulse">
            🚨 HIGH URGENCY
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
            ⚡ MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30">
            ROUTINE
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-surface-100 dark:bg-surface-800 text-surface-650 border border-surface-200 dark:border-surface-700">
            UNCATEGORIZED
          </span>
        );
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

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-surface-100">Patient Queue</h1>
          <p className="text-sm text-surface-600 mt-1">Review clinical intakes, symptoms and file visit notes.</p>
        </div>
      </div>

      {sortedQueue.length === 0 ? (
        <div className="glass-card p-12 text-center bg-white/50 dark:bg-surface-900/30">
          <div className="text-4xl mb-3">👨‍⚕️</div>
          <h3 className="text-lg font-bold">No consultations scheduled</h3>
          <p className="text-sm text-surface-600 mt-1">You currently have no patient appointments booked in your schedule.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedQueue.map((apt) => (
            <div 
              key={apt.id}
              className={`
                glass-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-l-4 transition-all duration-200
                ${apt.status === 'COMPLETED' 
                  ? 'border-l-surface-300 bg-white/40 dark:bg-surface-900/20 opacity-75' 
                  : apt.symptomForm?.llmUrgency === 'HIGH'
                    ? 'border-l-red-550 bg-red-500/5 dark:bg-red-500/5'
                    : apt.symptomForm?.llmUrgency === 'MEDIUM'
                      ? 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/5'
                      : 'border-l-primary-500 bg-white/70 dark:bg-surface-900/50'
                }
              `}
            >
              <div className="flex gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-950/40 rounded-xl flex items-center justify-center text-primary-700 dark:text-primary-400 font-bold shrink-0">
                  <User size={24} />
                </div>
                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-bold text-base truncate">{apt.patient.name}</h3>
                    {apt.status === 'COMPLETED' ? (
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded bg-surface-150 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                        RESOLVED
                      </span>
                    ) : (
                      getUrgencyBadge(apt.symptomForm?.llmUrgency)
                    )}
                  </div>
                  <p className="text-xs text-surface-500 truncate font-semibold">{apt.patient.email}</p>
                  
                  {/* Intakes / Chief Complaint summary */}
                  {apt.symptomForm && (
                    <div className="text-xs mt-2 p-3 bg-surface-50/50 dark:bg-surface-950/20 rounded-lg max-w-xl">
                      <span className="font-bold text-surface-500 text-[10px] uppercase block mb-1">Chief Complaint Intakes</span>
                      <p className="text-surface-700 dark:text-surface-300 italic truncate font-medium">
                        "{apt.symptomForm.llmChiefComplaint || apt.symptomForm.rawSymptoms}"
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-surface-650">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={13} />
                      {format(parseISO(apt.slotStart), 'MMMM d, yyyy')}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-surface-750">
                      <Clock size={13} />
                      {format(parseISO(apt.slotStart), 'h:mm a')} – {format(parseISO(apt.slotEnd), 'h:mm a')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                {apt.status === 'COMPLETED' ? (
                  <button
                    onClick={() => navigate(`/doctor/visit/${apt.id}`)}
                    className="px-4 py-2 bg-surface-100 hover:bg-surface-150 dark:bg-surface-800 dark:hover:bg-surface-850 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <UserCheck size={14} />
                    <span>Review Visit Notes</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/doctor/visit/${apt.id}`)}
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-550 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    <Stethoscope size={14} />
                    <span>Start Intakes & Visit</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyQueue;
