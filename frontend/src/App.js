import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import AppointmentsPage from './pages/AppointmentsPage';
import VideoCallPage from './pages/VideoCallPage';
import AmbulanceRequestPage from './pages/AmbulanceRequestPage';
import PatientsPage from './pages/PatientsPage';
import DoctorsPage from './pages/DoctorsPage';
import PharmacyPage from './pages/PharmacyPage';
import OrdersPage from './pages/OrdersPage';
import RecordsPage from './pages/RecordsPage';
import RemindersPage from './pages/RemindersPage';
import EmergencyPage from './pages/EmergencyPage';
import SymptomCheckerPage from './pages/SymptomCheckerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import UserApprovalPage from './pages/UserApprovalPage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import SettingsPage from './pages/SettingsPage';
import ChatPage from './pages/ChatPage';
import RoomsPage from './pages/RoomsPage';

import NoticeBoardPage from './pages/NoticeBoardPage';
import LeavePage from './pages/LeavePage';
import MyTimetablePage from './pages/MyTimetablePage';
import SalaryPage from './pages/SalaryPage';
import FinanceDashboard from './pages/FinanceDashboard';
import AdminTimetablePage from './pages/AdminTimetablePage';
import OnlineUsersPage from './pages/OnlineUsersPage';
import AuditLogPage from './pages/AuditLogPage';
import FeedbackGeneratorPage from './pages/FeedbackGeneratorPage';
import FamilyAccessPage from './pages/FamilyAccessPage';
import WearableSyncPage from './pages/WearableSyncPage';
import DischargeTimelinePage from './pages/DischargeTimelinePage';
import AIScribePage from './pages/AIScribePage';
import PeerConsultPage from './pages/PeerConsultPage';
import ResearchHubPage from './pages/ResearchHubPage';
import PredictiveStaffingPage from './pages/PredictiveStaffingPage';
import SentimentAnalyticsPage from './pages/SentimentAnalyticsPage';
import AssetTrackingPage from './pages/AssetTrackingPage';
import SmartTriagePage from './pages/SmartTriagePage';
import HandoverProtocolPage from './pages/HandoverProtocolPage';
import FridgeMonitorPage from './pages/FridgeMonitorPage';
import BloodDonationPage from './pages/BloodDonationPage';
import BloodBankPage from './pages/BloodBankPage';
import UserActivityPage from './pages/UserActivityPage';
import MyActivityPage from './pages/MyActivityPage';
import FailedPaymentsPage from './pages/FailedPaymentsPage';
import FeedbackPage from './pages/FeedbackPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import DoctorSeatingPage from './pages/DoctorSeatingPage';
import LabDashboardPage from './pages/LabDashboardPage';
import LabReportsPage from './pages/LabReportsPage';
import PaymentReceiptPage from './pages/PaymentReceiptPage';
import DietNutritionPage from './pages/DietNutritionPage';
import InsurancePage from './pages/InsurancePage';
import QueueDisplayPage from './pages/QueueDisplayPage';
import AdmissionsPage from './pages/AdmissionsPage';
import SurgeryPage from './pages/SurgeryPage';
import AttendancePage from './pages/AttendancePage';
import BillingPage from './pages/BillingPage';
import InventoryPage from './pages/InventoryPage';
import TPAPage from './pages/TPAPage';
import RadiologyPage from './pages/RadiologyPage';
import DialysisPage from './pages/DialysisPage';
import NABHPage from './pages/NABHPage';
import CertificatesPage from './pages/CertificatesPage';
import MaintenanceAdminPage from './pages/MaintenanceAdminPage';
import './assets/styles/global.css';

const MAINTENANCE_ROLES = ['electrician','plumber','it_technician','equipment_tech','biomedical','security','receptionist','ambulance_driver','sweeper'];
const ALL_STAFF = ['doctor','nurse','pharmacist','wardboy','sweeper','otboy','finance','lab_technician','radiology_tech','dialysis_tech',...MAINTENANCE_ROLES];

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div className="app-loading">
      <div style={{textAlign:'center'}}>
        <div className="spinner-lg"/>
        <p style={{color:'#94a3b8',fontSize:14,marginTop:12}}>Loading Mediventra…</p>
      </div>
    </div>
  );
  // Carry the page someone was trying to reach (e.g. a "Complete
  // Documentation" link from an email pointing at /settings?tab=profile)
  // through the login flow, instead of always dropping them on /dashboard
  // after signing in.
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const PublicRoute = ({ children, allowSwitch }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner-lg"/></div>;
  // Registration still bounces a logged-in user straight to their dashboard.
  // The login page, however, allows "switching accounts" — if someone is
  // already logged in but wants to sign in as a different user, they no
  // longer have to manually log out first; submitting new credentials here
  // simply replaces the current session.
  if (isAuthenticated && !allowSwitch) return <Navigate to="/dashboard" replace />;
  return children;
};

// The "/" route is the public marketing homepage for anyone not logged in;
// an already-signed-in user is sent straight to their dashboard instead.
const RootRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="spinner-lg"/></div>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />}/>
      <Route path="/login"    element={<PublicRoute allowSwitch><LoginPage /></PublicRoute>}/>
      <Route path="/oauth-callback" element={<OAuthCallbackPage />}/>
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>}/>
      <Route path="/queue-display" element={<QueueDisplayPage />}/>
      <Route path="/video-call/:appointmentId" element={<ProtectedRoute><VideoCallPage /></ProtectedRoute>}/>
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>

        {/* ── Universal ── */}
        <Route path="dashboard"    element={<Dashboard />}/>
        <Route path="settings"     element={<SettingsPage />}/>
        <Route path="notice-board" element={<NoticeBoardPage />}/>
        <Route path="leaves"       element={<LeavePage />}/>
        <Route path="my-timetable" element={<MyTimetablePage />}/>
        <Route path="reminders"    element={<RemindersPage />}/>
        <Route path="emergency"    element={<EmergencyPage />}/>
        <Route path="symptom-checker" element={<SymptomCheckerPage />}/>

        {/* ── Staff only ── */}
        <Route path="salary"  element={<ProtectedRoute roles={['admin',...ALL_STAFF]}><SalaryPage /></ProtectedRoute>}/>
        <Route path="chat"    element={<ProtectedRoute roles={['admin','patient',...ALL_STAFF]}><ChatPage /></ProtectedRoute>}/>

        {/* ── Clinical ── */}
        <Route path="appointments" element={<AppointmentsPage />}/>
        <Route path="patients"  element={<ProtectedRoute roles={['admin','doctor','nurse','receptionist']}><PatientsPage /></ProtectedRoute>}/>
        <Route path="doctors"   element={<ProtectedRoute roles={['admin']}><DoctorsPage /></ProtectedRoute>}/>
        <Route path="pharmacy"  element={<PharmacyPage />}/>
        <Route path="orders"    element={<OrdersPage />}/>
        <Route path="records"   element={<RecordsPage />}/>
        <Route path="analytics" element={<ProtectedRoute roles={['admin','doctor']}><AnalyticsPage /></ProtectedRoute>}/>
        <Route path="user-approval" element={<ProtectedRoute roles={['admin']}><UserApprovalPage /></ProtectedRoute>}/>
        <Route path="prescriptions" element={<ProtectedRoute roles={['doctor','admin','patient']}><PrescriptionsPage /></ProtectedRoute>}/>
        <Route path="rooms" element={<ProtectedRoute roles={['admin','doctor','nurse','wardboy','pharmacist','receptionist']}><RoomsPage /></ProtectedRoute>}/>
        <Route path="admissions" element={<ProtectedRoute roles={['admin','doctor','nurse','receptionist']}><AdmissionsPage /></ProtectedRoute>}/>
        <Route path="surgeries" element={<ProtectedRoute roles={['admin','doctor','nurse','otboy']}><SurgeryPage /></ProtectedRoute>}/>
        <Route path="attendance" element={<ProtectedRoute roles={['admin','doctor','nurse','pharmacist','wardboy','sweeper','otboy','finance','electrician','plumber','it_technician','equipment_tech','biomedical','security','receptionist','ambulance_driver','lab_technician','radiology_tech','dialysis_tech']}><AttendancePage /></ProtectedRoute>}/>
        <Route path="billing" element={<ProtectedRoute roles={['admin','finance','receptionist','patient']}><BillingPage /></ProtectedRoute>}/>
        <Route path="inventory" element={<ProtectedRoute roles={['admin','doctor','nurse','pharmacist','wardboy','sweeper','otboy','finance','electrician','plumber','it_technician','equipment_tech','biomedical','security','receptionist','ambulance_driver','lab_technician','radiology_tech','dialysis_tech']}><InventoryPage /></ProtectedRoute>}/>
        <Route path="tpa" element={<ProtectedRoute roles={['admin','finance','receptionist','doctor']}><TPAPage /></ProtectedRoute>}/>
        <Route path="radiology" element={<ProtectedRoute roles={['admin','doctor','radiology_tech','patient']}><RadiologyPage /></ProtectedRoute>}/>
        <Route path="dialysis" element={<ProtectedRoute roles={['admin','doctor','nurse','dialysis_tech','patient']}><DialysisPage /></ProtectedRoute>}/>
        <Route path="nabh" element={<ProtectedRoute roles={['admin']}><NABHPage /></ProtectedRoute>}/>
        <Route path="certificates" element={<ProtectedRoute roles={['doctor','admin','patient']}><CertificatesPage /></ProtectedRoute>}/>

        {/* ── Legacy dashboard routes — redirected to the single source of
             truth at /dashboard, which already has correct per-role routing.
             Kept (rather than deleted) so any old bookmark/link still works. ── */}
        <Route path="staff-dashboard" element={<Navigate to="/dashboard" replace />}/>
        <Route path="maintenance-dashboard" element={<Navigate to="/dashboard" replace />}/>
        <Route path="receptionist-dashboard" element={<Navigate to="/dashboard" replace />}/>

        {/* ── Admin-only ── */}
        <Route path="maintenance-admin" element={<ProtectedRoute roles={['admin']}><MaintenanceAdminPage /></ProtectedRoute>}/>
        <Route path="admin-timetable"   element={<ProtectedRoute roles={['admin']}><AdminTimetablePage /></ProtectedRoute>}/>
        <Route path="online-users"      element={<ProtectedRoute roles={['admin']}><OnlineUsersPage /></ProtectedRoute>}/>
        <Route path="audit-log"         element={<ProtectedRoute roles={['admin']}><AuditLogPage /></ProtectedRoute>}/>
        <Route path="feedback-generator" element={<ProtectedRoute roles={['admin']}><FeedbackGeneratorPage /></ProtectedRoute>}/>

        {/* Patient */}
        <Route path="family-access"      element={<ProtectedRoute roles={['patient']}><FamilyAccessPage /></ProtectedRoute>}/>
        <Route path="wearable-sync"      element={<ProtectedRoute roles={['patient']}><WearableSyncPage /></ProtectedRoute>}/>
        <Route path="discharge-timeline" element={<ProtectedRoute roles={['patient','doctor']}><DischargeTimelinePage /></ProtectedRoute>}/>

        {/* Doctor */}
        <Route path="ai-scribe"      element={<ProtectedRoute roles={['doctor']}><AIScribePage /></ProtectedRoute>}/>
        <Route path="peer-consult"   element={<ProtectedRoute roles={['doctor']}><PeerConsultPage /></ProtectedRoute>}/>
        <Route path="research-hub"   element={<ProtectedRoute roles={['doctor']}><ResearchHubPage /></ProtectedRoute>}/>

        {/* Admin */}
        <Route path="predictive-staffing" element={<ProtectedRoute roles={['admin']}><PredictiveStaffingPage /></ProtectedRoute>}/>
        <Route path="sentiment-analytics" element={<ProtectedRoute roles={['admin']}><SentimentAnalyticsPage /></ProtectedRoute>}/>
        <Route path="asset-tracking"      element={<ProtectedRoute roles={['admin']}><AssetTrackingPage /></ProtectedRoute>}/>

        {/* Nurse / Receptionist / Lab */}
        <Route path="smart-triage"       element={<ProtectedRoute roles={['nurse','receptionist','lab_technician','admin']}><SmartTriagePage /></ProtectedRoute>}/>
        <Route path="handover-protocol"  element={<ProtectedRoute roles={['nurse','receptionist','lab_technician','admin']}><HandoverProtocolPage /></ProtectedRoute>}/>
        <Route path="fridge-monitor"     element={<ProtectedRoute roles={['nurse','receptionist','lab_technician','admin']}><FridgeMonitorPage /></ProtectedRoute>}/>

        {/* Blood Bank */}
        <Route path="blood-donation" element={<ProtectedRoute roles={['patient']}><BloodDonationPage /></ProtectedRoute>}/>
        <Route path="ambulance-request" element={<ProtectedRoute roles={['patient']}><AmbulanceRequestPage /></ProtectedRoute>}/>
        <Route path="blood-bank"     element={<ProtectedRoute roles={['admin','nurse','lab_technician']}><BloodBankPage /></ProtectedRoute>}/>
        <Route path="user-activity"     element={<ProtectedRoute roles={['admin']}><UserActivityPage /></ProtectedRoute>}/>
        <Route path="my-activity"       element={<ProtectedRoute><MyActivityPage /></ProtectedRoute>}/>
        <Route path="failed-payments"   element={<ProtectedRoute roles={['admin','finance']}><FailedPaymentsPage /></ProtectedRoute>}/>
        <Route path="finance" element={<ProtectedRoute roles={['finance','admin']}><FinanceDashboard /></ProtectedRoute>}/>


        {/* ── New HMS Features ── */}
        <Route path="lab-dashboard" element={<ProtectedRoute roles={['admin','lab_technician']}><LabDashboardPage /></ProtectedRoute>}/>
        <Route path="lab-reports"   element={<LabReportsPage />}/>
        <Route path="payments/:id"  element={<PaymentReceiptPage />}/>
        <Route path="diet"          element={<DietNutritionPage />}/>
        <Route path="insurance"     element={<InsurancePage />}/>
        <Route path="feedback"      element={<ProtectedRoute roles={['patient']}><FeedbackPage /></ProtectedRoute>}/>
        <Route path="admin-feedback" element={<ProtectedRoute roles={['admin']}><AdminFeedbackPage /></ProtectedRoute>}/>
        <Route path="doctor-seating" element={<ProtectedRoute roles={['admin','doctor']}><DoctorSeatingPage /></ProtectedRoute>}/>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />}/>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
        <LanguageProvider>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{duration:4000,style:{borderRadius:'10px',fontSize:'13.5px',fontWeight:'500',fontFamily:"'Inter',system-ui,sans-serif"},success:{iconTheme:{primary:'#059669',secondary:'#fff'}},error:{iconTheme:{primary:'#dc2626',secondary:'#fff'}}}}/>
        </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
