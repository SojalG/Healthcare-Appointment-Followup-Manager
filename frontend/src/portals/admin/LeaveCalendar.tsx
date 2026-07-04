import React from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client.js';
import { Calendar, UserMinus } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Doctor {
  id: string;
  name?: string;
  specialisation?: string;
  user?: {
    name: string;
    email: string;
  };
  doctorProfile?: {
    specialisation?: string;
    leaves?: {
      date: string;
      reason?: string;
    }[];
  };
}

export const LeaveCalendar: React.FC = () => {
  // Fetch doctors and their leaves
  const { data: doctorsResponse, isLoading } = useQuery({
    queryKey: ['admin-doctors'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/doctors');
      return data.data as Doctor[];
    }
  });

  const doctors = doctorsResponse || [];

  // Flatten leaves list to sort and display chronologically
  const allLeaves: { doctorName: string; specialisation: string; date: string; reason?: string }[] = [];
  doctors.forEach(doc => {
    // Safely extract leaves
    const leaves = doc.doctorProfile?.leaves || [];
    
    leaves.forEach(l => {
      allLeaves.push({
        // Safely extract name depending on how the backend structured it
        doctorName: doc.name || doc.user?.name || 'Unknown',
        // Safely extract specialisation
        specialisation: doc.doctorProfile?.specialisation || doc.specialisation || 'General',
        date: l.date,
        reason: l.reason
      });
    });
  });

  const sortedLeaves = [...allLeaves].sort((a, b) => 
    parseISO(a.date).getTime() - parseISO(b.date).getTime()
  );

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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Doctor Leaves Schedule</h1>
        <p className="text-sm text-surface-650 mt-1">Centralized schedule of all active doctor leaves and vacation days.</p>
      </div>

      <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-primary-700 dark:text-primary-400">
          <UserMinus size={20} />
          Scheduled Absence Days
        </h3>

        {sortedLeaves.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-surface-650 text-sm">No leaves declared by any doctor currently.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800">
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Doctor</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Specialisation</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Absence Date</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Reason Details</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaves.map((leave, index) => (
                  <tr 
                    key={index}
                    className="border-b border-surface-150 dark:border-surface-850 hover:bg-surface-50 dark:hover:bg-surface-900/30 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-bold text-surface-900 dark:text-surface-100">
                      Dr. {leave.doctorName}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-primary-650 dark:text-primary-400">
                      {leave.specialisation}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Calendar size={14} className="text-surface-500" />
                        <span>{format(parseISO(leave.date), 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 italic text-surface-650">
                      {leave.reason ? `"${leave.reason}"` : <span className="text-surface-400">No reason provided</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveCalendar;
