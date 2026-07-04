import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext.js';
import { AlertCircle } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

type LoginFields = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFields) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      // Wait momentarily for state synchronization
      setTimeout(() => {
        // Find role from storage
        const token = localStorage.getItem('accessToken');
        if (token) {
          try {
            const payload = JSON.parse(window.atob(token.split('.')[1]));
            if (payload.role === 'PATIENT') navigate('/patient');
            else if (payload.role === 'DOCTOR') navigate('/doctor');
            else if (payload.role === 'ADMIN') navigate('/admin');
            else navigate('/');
          } catch {
            navigate('/');
          }
        } else {
          navigate('/');
        }
      }, 100);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50 dark:bg-surface-950">
      <div className="w-full max-w-md glass-card p-8 bg-white/80 dark:bg-surface-900/60 backdrop-blur-lg">
        <div className="text-center mb-8">
          <span className="text-4xl">🏥</span>
          <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mt-3">Welcome Back</h1>
          <p className="text-sm text-surface-650 mt-1">Sign in to your HealthConnect account</p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-900/30 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-650 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              {...register('email')}
              className="w-full px-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-950/30 focus:border-primary-500 focus:outline-none transition-colors"
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-650 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className="w-full px-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-950/30 focus:border-primary-500 focus:outline-none transition-colors"
            />
            {errors.password && (
              <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-primary-600 hover:bg-primary-550 text-white rounded-lg font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-surface-650">
          New to HealthConnect?{' '}
          <Link to="/register" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
