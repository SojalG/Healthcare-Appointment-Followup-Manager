import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client.js';
import { BellRing, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface FailedLog {
  id: string;
  type: 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'LEAVE_NOTICE';
  channel: 'EMAIL' | 'CALENDAR';
  recipientId: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  appointment?: {
    patient: {
      name: string;
      email: string;
    };
    doctor: {
      user: {
        name: string;
      };
    };
  } | null;
}

export const NotificationDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  // Fetch failed notification logs
  const { data: logsResponse, isLoading, refetch } = useQuery({
    queryKey: ['failed-notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/notifications/failed');
      return data.data as FailedLog[];
    }
  });

  const logs = logsResponse || [];

  // Retry notification mutation
  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      setRetryingId(id);
      await apiClient.post(`/admin/notifications/${id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failed-notifications'] });
      alert('Notification job successfully re-queued for retry!');
    },
    onError: (err: any) => {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to retry notification.');
    },
    onSettled: () => {
      setRetryingId(null);
    }
  });

  const handleRetry = (id: string) => {
    retryMutation.mutate(id);
  };

  const getChannelColor = (channel: string) => {
    return channel === 'EMAIL' 
      ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-150 dark:border-blue-900/30' 
      : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-150 dark:border-indigo-900/30';
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
          <h1 className="text-2xl md:text-3xl font-bold">Failed Notifications (Dead Letters)</h1>
          <p className="text-sm text-surface-650 mt-1">Monitor, review, and manually retry failed dispatch queue jobs.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 border border-surface-200 dark:border-surface-800 hover:bg-surface-50 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 self-start transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh List</span>
        </button>
      </div>

      <div className="glass-card p-6 bg-white/70 dark:bg-surface-900/50">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-primary-700 dark:text-primary-400">
          <BellRing size={20} />
          Failed Notification Logs
        </h3>

        {logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-surface-650 text-sm">No failed notification logs currently pending review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800">
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Patient / Recipient</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Notification details</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Attempts</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider">Last Error</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-surface-500 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isRetrying = retryingId === log.id;
                  const isErrorExpanded = expandedErrorId === log.id;
                  const patientName = log.appointment?.patient?.name || 'Unknown Patient';
                  const patientEmail = log.appointment?.patient?.email || log.recipientId;

                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        className="border-b border-surface-150 dark:border-surface-850 hover:bg-surface-50/50 dark:hover:bg-surface-900/10 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-surface-900 dark:text-surface-100">{patientName}</div>
                          <div className="text-xs text-surface-500 mt-0.5">{patientEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-surface-100 dark:bg-surface-800">
                              {log.type}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getChannelColor(log.channel)}`}>
                              {log.channel}
                            </span>
                          </div>
                          <div className="text-[10px] text-surface-400">
                            Created: {format(parseISO(log.createdAt), 'MMM d, yyyy @ h:mm a')}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-surface-700 dark:text-surface-300">
                          {log.attempts} / 3
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate">
                          {log.lastError ? (
                            <button
                              onClick={() => setExpandedErrorId(isErrorExpanded ? null : log.id)}
                              className="text-xs text-red-650 hover:text-red-750 font-semibold inline-flex items-center gap-1 hover:underline"
                            >
                              <span>{isErrorExpanded ? 'Hide Trace' : 'View Trace'}</span>
                              {isErrorExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          ) : (
                            <span className="text-surface-400 italic">None logged</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleRetry(log.id)}
                            disabled={isRetrying}
                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-550 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition-colors inline-flex items-center gap-1"
                          >
                            {isRetrying ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              'Retry Dispatch'
                            )}
                          </button>
                        </td>
                      </tr>
                      {isErrorExpanded && log.lastError && (
                        <tr>
                          <td colSpan={5} className="py-3 px-6 bg-red-500/5 border-b border-surface-150 dark:border-surface-850">
                            <div className="p-3.5 bg-white dark:bg-surface-950 border border-red-200 dark:border-red-950/20 rounded-xl space-y-1.5 max-w-3xl">
                              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                                Error Call Trace
                              </span>
                              <pre className="text-[10px] text-surface-700 dark:text-surface-300 whitespace-pre-wrap font-mono break-all leading-normal">
                                {log.lastError}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDashboard;
