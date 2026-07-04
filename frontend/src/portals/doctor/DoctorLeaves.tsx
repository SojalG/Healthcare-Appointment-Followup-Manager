import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../api/client.js';
import { Calendar, AlertCircle, CheckCircle, CalendarDays } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

const leaveSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reason: z.string().optional(),
});

type LeaveFields = z.infer<typeof leaveSchema>;

export const DoctorLeaves: React.FC = () => {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeaveFields>({
    resolver: zodResolver(leaveSchema)
  });

  const { data: doctorsResponse, isLoading } = useQuery({
    queryKey: ['admin-doctors'], // Reuse list doctors query
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/doctors');
      return data.data;
    }
  });

  const doctors = doctorsResponse || [];
  
  // Find current doctor profile
  const token = localStorage.getItem('accessToken');
  let currentDoctorUserId = '';
  if (token) {
    try {
      const payload = JSON.parse(window.atob(token.split('.')[1]));
      currentDoctorUserId = payload.id;
    } catch {}
  }

  const currentDoctor = doctors.find((d: any) => d.id === currentDoctorUserId);
  const leavesList = currentDoctor?.doctorProfile?.leaves || [];

  // Declare leave mutation
  const declareMutation = useMutation({
    mutationFn: async (data: LeaveFields) => {
      await apiClient.post('/doctors/me/leaves', {
        date: data.date,
        reason: data.reason
      });
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      reset();
      setTimeout(() => setSuccess(false), 3000);
    }
  });

  const onSubmit = async (data: LeaveFields) => {
    setErrorMsg(null);
    try {
      await declareMutation.mutateAsync(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to declare leave. Check for duplicates.');
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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Declare Leave Days</h1>
        <p className="text-sm text-surface-650 mt-1">Schedule leaves. Overlapping appointments will be automatically cancelled.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Form to Submit Leave */}
        <div className="md:col-span-1">
          <form 
            onSubmit={handleSubmit(onSubmit)} 
            className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 space-y-4"
          >
            <h3 className="font-bold text-base text-primary-700 dark:text-primary-400 flex items-center gap-1.5 mb-2">
              <CalendarDays size={18} />
              Declare New Leave
            </h3>

            {errorMsg && (
              <div className="flex items-center gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-300 border border-red-100 dark:border-red-900/30 rounded-xl text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2.5 p-3.5 bg-green-50 dark:bg-green-950/20 text-green-750 dark:text-green-300 border border-green-100 dark:border-green-900/30 rounded-xl text-xs">
                <CheckCircle size={16} className="shrink-0 text-green-600" />
                <span>Leave submitted. Conflicting bookings cancelled.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Leave Date</label>
              <input
                type="date"
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                {...register('date')}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:border-primary-500 bg-black text-sm"
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Reason (Optional)</label>
              <textarea
                placeholder="e.g. Annual leave, Medical conference"
                rows={3}
                {...register('reason')}
                className="w-full px-3 py-2 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:border-primary-500 bg-black text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={declareMutation.isPending}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-550 text-white rounded-lg font-semibold shadow-sm transition-all"
            >
              {declareMutation.isPending ? 'Filing leave...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>

        {/* Right Column: List of Existing Leaves */}
        <div className="md:col-span-2 space-y-4">
          <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50">
            <h3 className="font-bold text-lg mb-4">Your Declared Leaves</h3>
            
            {leavesList.length === 0 ? (
              <p className="text-sm text-surface-500 italic">No leaves declared yet.</p>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {leavesList.map((leave: any, index: number) => (
                  <div 
                    key={index}
                    className="p-4 bg-white dark:bg-surface-950/20 border border-surface-200 dark:border-surface-850 rounded-xl space-y-2 text-sm"
                  >
                    <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 font-bold">
                      <Calendar size={16} />
                      <span>{format(parseISO(leave.date), 'MMMM d, yyyy')}</span>
                    </div>
                    {leave.reason && (
                      <p className="text-xs text-surface-650 bg-surface-50 dark:bg-surface-850/50 p-2 rounded border border-surface-150 dark:border-surface-800 italic">
                        "{leave.reason}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorLeaves;
