import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client.js';
import { Calendar, User, Clock, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';

interface Appointment {
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
  holdExpiresAt?: string;
  symptomForm?: {
    id: string;
    rawSymptoms: string;
    llmUrgency?: string;
  } | null;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Fetch all user's appointments
  const { data: appointmentsResponse, isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data } = await apiClient.get('/appointments/mine');
      return data.data as Appointment[];
    }
  });

  const appointments = appointmentsResponse || [];

  // Cancel Appointment Mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  });

  // Expired holds filter helper
  const isHoldActive = (apt: Appointment) => {
    if (apt.status !== 'PENDING_HOLD') return true;
    if (!apt.holdExpiresAt) return false;
    return isAfter(parseISO(apt.holdExpiresAt), new Date());
  };

  const upcomingApts = appointments.filter(apt => 
    (apt.status === 'CONFIRMED' || apt.status === 'PENDING_HOLD') && isHoldActive(apt)
  );

  const pastApts = appointments.filter(apt => 
    apt.status === 'COMPLETED' || 
    (apt.status === 'PENDING_HOLD' && !isHoldActive(apt)) ||
    apt.status === 'CANCELLED'
  );

  const handleCancel = async (id: string) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      try {
        await cancelMutation.mutateAsync(id);
      } catch (err) {
        console.error(err);
        alert('Failed to cancel appointment. Please try again.');
      }
    }
  };

  const getStatusBadge = (apt: Appointment) => {
    if (apt.status === 'PENDING_HOLD') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
          <Clock size={12} className="animate-pulse" />
          Pending Hold
        </span>
      );
    }
    if (apt.status === 'CONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
          Confirmed
        </span>
      );
    }
    if (apt.status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-750 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30">
        Cancelled
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
        <div className="h-64 w-full bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
      </div>
    );
  }

  const activeList = activeTab === 'upcoming' ? upcomingApts : pastApts;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-primary-600 to-primary-800 text-white rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Your Patient Portal</h1>
          <p className="text-primary-100 mt-1">Book consultations, manage symptoms, and view prescriptions.</p>
        </div>
        <button
          onClick={() => navigate('/patient/book')}
          className="self-start md:self-auto px-5 py-3 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <span>Schedule Appointment</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-surface-200 dark:border-surface-850 gap-6">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all duration-200 ${
            activeTab === 'upcoming'
              ? 'border-primary-600 text-primary-700 dark:text-primary-400'
              : 'border-transparent text-surface-500 hover:text-surface-850'
          }`}
        >
          Upcoming Consultations ({upcomingApts.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`pb-4 text-sm font-semibold tracking-wide border-b-2 transition-all duration-200 ${
            activeTab === 'past'
              ? 'border-primary-600 text-primary-700 dark:text-primary-400'
              : 'border-transparent text-surface-500 hover:text-surface-850'
          }`}
        >
          Past & Cancelled ({pastApts.length})
        </button>
      </div>

      {/* List content */}
      {activeList.length === 0 ? (
        <div className="glass-card p-12 text-center bg-white/50 dark:bg-surface-900/30">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-lg font-bold">No consultations found</h3>
          <p className="text-sm text-surface-650 mt-1 mb-6">
            {activeTab === 'upcoming' 
              ? 'You do not have any upcoming medical appointments.'
              : 'No past consult records found.'}
          </p>
          {activeTab === 'upcoming' && (
            <button
              onClick={() => navigate('/patient/book')}
              className="btn-primary"
            >
              Book Your First Slot
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {activeList.map((apt) => (
            <div 
              key={apt.id}
              className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-surface-900/50"
            >
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-950/40 rounded-xl flex items-center justify-center text-primary-700 dark:text-primary-400 shrink-0">
                  <User size={24} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base truncate">Dr. {apt.doctor.user.name}</h3>
                  <p className="text-xs text-primary-650 dark:text-primary-400 font-medium">{apt.doctor.specialisation}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-surface-650">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={13} />
                      {format(parseISO(apt.slotStart), 'EEEE, MMMM d, yyyy')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} />
                      {format(parseISO(apt.slotStart), 'h:mm a')} – {format(parseISO(apt.slotEnd), 'h:mm a')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {getStatusBadge(apt)}

                {apt.status === 'PENDING_HOLD' && (
                  <div className="w-full md:w-auto text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 p-2 bg-amber-500/10 rounded-lg">
                    <AlertCircle size={14} />
                    <span>Incomplete — Submit symptoms below to confirm!</span>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/patient/appointment/${apt.id}`)}
                  className="px-4 py-2 border border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800 text-sm font-semibold rounded-lg transition-colors"
                >
                  View Details
                </button>

                {apt.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleCancel(apt.id)}
                    className="p-2 border border-red-200 dark:border-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                    title="Cancel Appointment"
                  >
                    <Trash2 size={16} />
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

export default Dashboard;
