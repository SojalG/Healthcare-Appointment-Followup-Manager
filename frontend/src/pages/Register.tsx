import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext.js';
import { AlertCircle, CheckCircle } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterFields = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterFields) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await registerUser(data.email, data.password, data.name);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-50 dark:bg-surface-950">
      <div className="w-full max-w-md glass-card p-8 bg-white/80 dark:bg-surface-900/60 backdrop-blur-lg">
        <div className="text-center mb-8">
          <span className="text-4xl">🏥</span>
          <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mt-3">Create Account</h1>
          <p className="text-sm text-surface-650 mt-1">Register a patient account at HealthConnect</p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 dark:bg-red-950/20 text-red-750 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-900/30 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-green-50 dark:bg-green-950/20 text-green-750 dark:text-green-300 rounded-xl border border-green-100 dark:border-green-900/30 text-sm">
            <CheckCircle size={20} className="shrink-0 text-green-600 dark:text-green-400" />
            <span>Registration successful! Redirecting to login page...</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-650 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              {...register('name')}
              className="w-full px-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-950/30 focus:border-primary-500 focus:outline-none transition-colors"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

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

          <div>
            <label className="block text-xs font-semibold text-surface-650 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              className="w-full px-4 py-2.5 rounded-lg border border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-950/30 focus:border-primary-500 focus:outline-none transition-colors"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || success}
            className="w-full py-3 bg-primary-600 hover:bg-primary-550 text-white rounded-lg font-medium shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        <div className="text-center mt-6 text-sm text-surface-650">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
