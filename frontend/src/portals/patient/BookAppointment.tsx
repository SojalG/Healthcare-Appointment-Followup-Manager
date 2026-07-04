import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../api/client.js';
import { Search, Clock, ArrowLeft, AlertTriangle, Timer } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';

// Zod schemas
const symptomSchema = z.object({
  rawSymptoms: z.string().min(10, 'Symptoms description must be at least 10 characters long'),
});

type SymptomFields = z.infer<typeof symptomSchema>;

interface Doctor {
  id: string;
  user: {
    name: string;
  };
  specialisation: string;
}

interface Slot {
  start: string;
  end: string;
  available: boolean;
}

export const BookAppointment: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes in seconds
  const [holdError, setHoldError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 1. Fetch doctors with search query
  const { data: doctorsResponse, isLoading: loadingDoctors } = useQuery({
    queryKey: ['doctors', searchTerm],
    queryFn: async () => {
      const { data } = await apiClient.get('/doctors', {
        params: { specialisation: searchTerm || undefined }
      });
      return data.data as Doctor[];
    }
  });
  const doctors = doctorsResponse || [];

  // 2. Fetch slots for selected doctor and date
  const { data: slotsResponse, isLoading: loadingSlots } = useQuery({
    queryKey: ['slots', selectedDoctor?.id, selectedDate],
    queryFn: async () => {
      if (!selectedDoctor) return [] as Slot[];
      const { data } = await apiClient.get(`/doctors/${selectedDoctor.id}/slots`, {
        params: { date: selectedDate }
      });
      return data.data as Slot[];
    },
    enabled: !!selectedDoctor
  });
  const slots = slotsResponse || [];

  // Hold Slot Mutation
  const holdMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor || !selectedSlot) throw new Error('Missing doctor or slot');
      const { data } = await apiClient.post('/appointments/hold', {
        doctorId: selectedDoctor.id,
        slotStart: selectedSlot.start
      });
      return data.data;
    }
  });

  // Hold Countdown Timer Effect
  useEffect(() => {
    if (step !== 3 || !holdExpiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((holdExpiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        clearInterval(interval);
        alert('Your slot hold has expired. Please select a slot again.');
        setStep(2);
        setSelectedSlot(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, holdExpiresAt]);

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSelectedSlot(null);
    setStep(2);
  };

  const handleHoldSlot = async () => {
    setHoldError(null);
    try {
      const holdData = await holdMutation.mutateAsync();
      setAppointmentId(holdData.id);
      setHoldExpiresAt(new Date(holdData.holdExpiresAt));
      setStep(3);
    } catch (err: any) {
      console.error(err);
      setHoldError(err.response?.data?.message || 'This slot is no longer available. Please select another slot.');
    }
  };

  // Symptom Form handling
  const { register, handleSubmit, formState: { errors } } = useForm<SymptomFields>({
    resolver: zodResolver(symptomSchema)
  });

  const onConfirm = async (data: SymptomFields) => {
    if (!appointmentId) return;
    setConfirming(true);
    try {
      // 1. Submit symptoms
      await apiClient.post('/symptoms', {
        appointmentId,
        rawSymptoms: data.rawSymptoms
      });

      // 2. Confirm booking
      await apiClient.post(`/appointments/${appointmentId}/confirm`);

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      navigate('/patient');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to confirm appointment. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const formatTimeRemaining = () => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Navigation and Title */}
      <div className="flex items-center gap-4">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => (s - 1) as any)}
            className="p-2 border border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold">Schedule an Appointment</h1>
          <p className="text-sm text-surface-650">Step {step} of 3</p>
        </div>
      </div>

      {/* STEP 1: Search & Pick Doctor */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-surface-500" size={18} />
              <input
                type="text"
                placeholder="Search by specialization (e.g. Cardiology, General)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 focus:outline-none focus:border-primary-500 text-sm transition-colors"
              />
            </div>
          </div>

          {loadingDoctors ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="h-32 bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
              <div className="h-32 bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-12 glass-card bg-white/50 dark:bg-surface-900/30">
              <p className="text-surface-650">No doctors matching that specialization found.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleSelectDoctor(doc)}
                  className="glass-card p-5 cursor-pointer bg-white/70 dark:bg-surface-900/50 hover:border-primary-500 hover:shadow-card-hover transition-all flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-bold text-lg text-surface-900 dark:text-surface-100">Dr. {doc.user.name}</h3>
                    <p className="text-xs text-primary-650 dark:text-primary-400 font-semibold uppercase tracking-wider mt-1">
                      {doc.specialisation}
                    </p>
                  </div>
                  <button className="mt-4 text-xs font-bold text-primary-600 dark:text-primary-400 self-start hover:underline inline-flex items-center gap-1">
                    <span>Select Doctor</span>
                    <Clock size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Pick Date & Slot */}
      {step === 2 && selectedDoctor && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar Picker Column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-5 bg-white/70 dark:bg-surface-900/50">
              <h3 className="font-bold text-base mb-3">Selected Doctor</h3>
              <p className="font-semibold text-surface-900 dark:text-surface-100">Dr. {selectedDoctor.user.name}</p>
              <p className="text-xs text-primary-650 dark:text-primary-400">{selectedDoctor.specialisation}</p>
            </div>

            <div className="glass-card p-5 bg-white/70 dark:bg-surface-900/50">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2">
                Consultation Date
              </label>
              <input
                type="date"
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot(null);
                }}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:border-primary-500 bg-white dark:bg-surface-950/30 text-sm"
              />
            </div>
          </div>

          {/* Slot Selection Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50">
              <h3 className="font-bold text-lg mb-4">Available Slots for {format(parseISO(selectedDate), 'MMMM d, yyyy')}</h3>

              {holdError && (
                <div className="flex items-center gap-3 p-4 mb-4 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-xl text-sm">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{holdError}</span>
                </div>
              )}

              {loadingSlots ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="h-10 bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
                  <div className="h-10 bg-surface-200 dark:bg-surface-800 rounded animate-pulse"></div>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-surface-650 text-sm">No available slots on this day. Please select a different date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {slots.map((slot, index) => (
                    <button
                      key={index}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        py-2.5 px-3 text-xs font-semibold rounded-lg border transition-all duration-200
                        ${!slot.available
                          ? 'bg-surface-100 dark:bg-surface-900/30 border-surface-200 dark:border-surface-850 text-surface-400 cursor-not-allowed line-through'
                          : selectedSlot?.start === slot.start
                            ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                            : 'bg-white dark:bg-surface-950/20 border-surface-200 dark:border-surface-800 hover:border-primary-500'
                        }
                      `}
                    >
                      {format(parseISO(slot.start), 'h:mm a')}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  disabled={!selectedSlot || holdMutation.isPending}
                  onClick={handleHoldSlot}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-550 text-white rounded-lg font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {holdMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Hold Selected Slot'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Pre-visit Symptom Form & Confirmation */}
      {step === 3 && selectedDoctor && selectedSlot && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Expiry Timer banner */}
          <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-200 dark:border-amber-900/30 rounded-xl text-amber-700 dark:text-amber-400 font-semibold text-sm">
            <span className="flex items-center gap-1.5">
              <Timer size={18} className="animate-pulse" />
              Slot Hold Active
            </span>
            <span>Expires in: {formatTimeRemaining()}</span>
          </div>

          <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-4">Confirm Appointment Details</h3>
              <div className="grid grid-cols-2 gap-4 p-4 bg-surface-50 dark:bg-surface-850/50 rounded-xl text-sm">
                <div>
                  <span className="text-xs text-surface-500 uppercase block font-semibold mb-0.5">Doctor</span>
                  <span className="font-bold text-surface-900 dark:text-surface-100">Dr. {selectedDoctor.user.name}</span>
                </div>
                <div>
                  <span className="text-xs text-surface-500 uppercase block font-semibold mb-0.5">Specialization</span>
                  <span className="font-medium text-surface-700 dark:text-surface-300">{selectedDoctor.specialisation}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-surface-500 uppercase block font-semibold mb-0.5">Time Slot</span>
                  <span className="font-medium text-surface-750">
                    {format(parseISO(selectedSlot.start), 'EEEE, MMMM d, yyyy')} @ {format(parseISO(selectedSlot.start), 'h:mm a')}
                  </span>
                </div>
              </div>
            </div>

            {/* Symptoms Description Form */}
            <form onSubmit={handleSubmit(onConfirm)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-650 uppercase tracking-wider mb-1.5">
                  Describe Your Symptoms
                </label>
                <textarea
                  placeholder="Please describe what symptoms you are experiencing, how long they have lasted, and any other relevant details..."
                  rows={5}
                  {...register('rawSymptoms')}
                  className="w-full px-4 py-3 rounded-lg border border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-950/30 focus:border-primary-500 focus:outline-none text-sm transition-colors"
                />
                {errors.rawSymptoms && (
                  <p className="text-xs text-red-500 mt-1">{errors.rawSymptoms.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 border border-surface-200 dark:border-surface-850 hover:bg-surface-50 dark:hover:bg-surface-800 rounded-lg text-sm font-semibold transition-colors"
                >
                  Change Slot
                </button>
                <button
                  type="submit"
                  disabled={confirming}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-550 text-white rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {confirming ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Confirm Consultation'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookAppointment;
