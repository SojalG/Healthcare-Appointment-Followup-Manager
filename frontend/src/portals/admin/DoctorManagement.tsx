import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import apiClient from '../../api/client.js';
import { Plus, Pencil, Trash2, X, AlertCircle } from 'lucide-react';

// Zod validation schemas
const workingHourSchema = z.object({
  weekday: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM format'),
});

const createDoctorSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  specialisation: z.string().min(2, 'Specialization is required'),
  slotDurationMin: z.number().min(10).max(120),
  workingHours: z.array(workingHourSchema),
});

type CreateDoctorFields = z.infer<typeof createDoctorSchema>;

interface Doctor {
  id: string;
  specialisation: string;
  slotDurationMin: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  workingHours: {
    weekday: number;
    startTime: string;
    endTime: string;
  }[];
}

export const DoctorManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Default working hours preset (Mon-Fri, 9am-5pm)
  const defaultWorkingHours = [
    { weekday: 1, startTime: '09:00', endTime: '17:00' },
    { weekday: 2, startTime: '09:00', endTime: '17:00' },
    { weekday: 3, startTime: '09:00', endTime: '17:00' },
    { weekday: 4, startTime: '09:00', endTime: '17:00' },
    { weekday: 5, startTime: '09:00', endTime: '17:00' },
  ];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateDoctorFields>({
    resolver: zodResolver(createDoctorSchema),
    defaultValues: {
      slotDurationMin: 30,
      workingHours: defaultWorkingHours,
    }
  });

  // Fetch doctors
  const { data: doctorsResponse, isLoading } = useQuery({
    queryKey: ['admin-doctors'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/doctors');
      return data.data as Doctor[];
    }
  });

  const doctors = doctorsResponse || [];

  // Create doctor mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateDoctorFields) => {
      await apiClient.post('/admin/doctors', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      setModalOpen(false);
      reset();
    }
  });

  // Update doctor mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CreateDoctorFields> }) => {
      await apiClient.put(`/admin/doctors/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
      setEditingDoctor(null);
    }
  });

  // Delete doctor profile mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/doctors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
    }
  });

  const onSubmitCreate = async (data: CreateDoctorFields) => {
    setErrorMsg(null);
    try {
      await createMutation.mutateAsync(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to create doctor profile.');
    }
  };

  const handleUpdate = async (id: string, spec: string, duration: number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        payload: { specialisation: spec, slotDurationMin: duration }
      });
      alert('Doctor profile updated successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update doctor profile.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this doctor profile? All associate working hours and slots will be removed.')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (err: any) {
        console.error(err);
        alert('Failed to delete doctor profile.');
      }
    }
  };

  const weekdayName = (dayNum: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum];
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Doctor Profiles Management</h1>
          <p className="text-sm text-surface-600 mt-1">Manage doctor accounts, specializations and working schedules.</p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setModalOpen(true);
          }}
          className="px-5 py-3 bg-primary-600 hover:bg-primary-550 text-white rounded-xl font-semibold shadow-sm inline-flex items-center gap-2 self-start transition-colors"
        >
          <Plus size={16} />
          <span>Add Doctor Account</span>
        </button>
      </div>

      {/* Grid of Doctors */}
      {doctors.length === 0 ? (
        <div className="glass-card p-12 text-center bg-white/50 dark:bg-surface-900/30">
          <p className="text-surface-650 text-sm">No doctors registered in the system yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {doctors.map((doc) => {
            const isEditingThis = editingDoctor?.id === doc.id;
            const displayName = doc.user?.name ?? doc.name ?? 'Unknown';
            const displayEmail = doc.user?.email ?? doc.email ?? '';
            return (
              <div 
                key={doc.id}
                className="glass-card p-6 bg-white/70 dark:bg-surface-900/50 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-surface-900 dark:text-surface-100">Dr. {displayName}</h3>
                      <p className="text-xs text-surface-500 font-semibold">{displayEmail}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (isEditingThis) {
                            setEditingDoctor(null);
                          } else {
                            setEditingDoctor(doc);
                          }
                        }}
                        className="p-2 border border-surface-200 dark:border-surface-800 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg text-surface-600 transition-colors"
                        title="Edit Doctor Settings"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 border border-red-200 dark:border-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                        title="Delete Doctor Profile"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {isEditingThis ? (
                    /* Inline edit mode */
                    <div className="p-4 bg-surface-100/50 dark:bg-surface-950/30 rounded-xl space-y-3 border border-surface-200 dark:border-surface-850">
                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Specialisation</label>
                        <input
                          type="text"
                          defaultValue={editingDoctor.specialisation}
                          id={`spec-${doc.id}`}
                          className="w-full px-3 py-1.5 text-xs border border-surface-250 dark:border-surface-800 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase mb-1">Slot Duration (Min)</label>
                        <input
                          type="number"
                          defaultValue={editingDoctor.slotDurationMin}
                          id={`duration-${doc.id}`}
                          className="w-full px-3 py-1.5 text-xs border border-surface-250 dark:border-surface-800 rounded-lg bg-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingDoctor(null)}
                          className="px-3 py-1.5 border border-surface-200 dark:border-surface-800 rounded-lg text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const spec = (document.getElementById(`spec-${doc.id}`) as HTMLInputElement).value;
                            const duration = parseInt((document.getElementById(`duration-${doc.id}`) as HTMLInputElement).value, 10);
                            handleUpdate(doc.id, spec, duration);
                          }}
                          className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Details view */
                    <div className="space-y-2">
                      <div className="flex gap-4 text-xs font-medium text-surface-650">
                        <span>Specialization: <strong className="text-surface-850">{doc.specialisation ?? doc.doctorProfile?.specialisation ?? '—'}</strong></span>
                        <span>Duration: <strong className="text-surface-850">{doc.slotDurationMin ?? doc.doctorProfile?.slotDurationMin ?? '—'} mins</strong></span>
                      </div>

                      {/* Working Hours */}
                      <div>
                        <span className="text-[10px] font-bold text-surface-500 uppercase block mb-1">Working Hours Schedule</span>
                        <div className="grid grid-cols-2 gap-2.5 p-3 bg-surface-50 dark:bg-surface-850/30 rounded-xl border border-surface-150 dark:border-surface-800">
                          {(doc.workingHours ?? doc.doctorProfile?.workingHours ?? []).map((wh, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-surface-600">{weekdayName(wh.weekday)}</span>
                              <span className="font-medium text-surface-750">{wh.startTime} – {wh.endTime}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL DIALOG OVERLAY */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/45 dark:bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-modal overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 dark:border-surface-800">
              <h3 className="font-bold text-lg text-surface-900 dark:text-surface-100">Create Doctor Profile</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitCreate)} className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-300 border border-red-100 dark:border-red-900/30 rounded-xl text-sm">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Doctor Name</label>
                  <input
                    type="text"
                    placeholder="Dr. Alexander"
                    {...register('name')}
                    className="w-full px-3 py-2 border border-surface-250 dark:border-surface-800 rounded-lg text-sm bg-white"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Specialisation</label>
                  <input
                    type="text"
                    placeholder="Pediatrics"
                    {...register('specialisation')}
                    className="w-full px-3 py-2 border border-surface-250 dark:border-surface-800 rounded-lg text-sm bg-white"
                  />
                  {errors.specialisation && <p className="text-xs text-red-500 mt-1">{errors.specialisation.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="doctor@healthconnect.com"
                    {...register('email')}
                    className="w-full px-3 py-2 border border-surface-250 dark:border-surface-800 rounded-lg text-sm bg-white"
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    {...register('password')}
                    className="w-full px-3 py-2 border border-surface-250 dark:border-surface-800 rounded-lg text-sm bg-white"
                  />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">Slot Duration (Minutes)</label>
                  <input
                    type="number"
                    placeholder="30"
                    {...register('slotDurationMin', { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-surface-250 dark:border-surface-800 rounded-lg text-sm bg-white"
                  />
                  {errors.slotDurationMin && <p className="text-xs text-red-500 mt-1">{errors.slotDurationMin.message}</p>}
                </div>
              </div>

              {/* Working Hours Preset Info */}
              <div className="p-4 bg-surface-50 dark:bg-surface-850/40 border border-surface-150 dark:border-surface-800 rounded-xl">
                <span className="font-bold text-xs uppercase block mb-1 text-surface-700">Working hours preset</span>
                <p className="text-xs text-surface-600 leading-relaxed font-medium">
                  By default, the doctor will be scheduled to work **Monday through Friday, 9:00 AM to 5:00 PM** (30-minute consult slots).
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 border border-surface-200 dark:border-surface-800 hover:bg-surface-50 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-550 text-white rounded-lg font-semibold shadow-sm transition-all"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorManagement;
