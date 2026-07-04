import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import ProtectedRoute from './components/ProtectedRoute.js';
import Layout from './components/Layout.js';

// Auth Pages
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';

// Patient Portal
import { Dashboard as PatientDashboard } from './portals/patient/Dashboard.js';
import { BookAppointment } from './portals/patient/BookAppointment.js';
import { AppointmentDetail } from './portals/patient/AppointmentDetail.js';

// Doctor Portal
import { DailyQueue } from './portals/doctor/DailyQueue.js';
import { VisitNoteForm } from './portals/doctor/VisitNoteForm.js';
import { DoctorLeaves } from './portals/doctor/DoctorLeaves.js';

// Admin Portal
import { DoctorManagement } from './portals/admin/DoctorManagement.js';
import { LeaveCalendar } from './portals/admin/LeaveCalendar.js';
import { NotificationDashboard } from './portals/admin/NotificationDashboard.js';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const HomeRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'PATIENT') return <Navigate to="/patient" replace />;
  if (user.role === 'DOCTOR') return <Navigate to="/doctor" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Patient Portal Pages */}
            <Route
              path="/patient"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <Layout>
                    <PatientDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/book"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <Layout>
                    <BookAppointment />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/appointment/:id"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <Layout>
                    <AppointmentDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Doctor Portal Pages */}
            <Route
              path="/doctor"
              element={
                <ProtectedRoute allowedRoles={['DOCTOR']}>
                  <Layout>
                    <DailyQueue />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/visit/:id"
              element={
                <ProtectedRoute allowedRoles={['DOCTOR']}>
                  <Layout>
                    <VisitNoteForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/leaves"
              element={
                <ProtectedRoute allowedRoles={['DOCTOR']}>
                  <Layout>
                    <DoctorLeaves />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Admin Portal Pages */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Layout>
                    <DoctorManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leaves"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Layout>
                    <LeaveCalendar />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dead-letters"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Layout>
                    <NotificationDashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Default Route Redirect */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
