import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { LANGUAGES } from '../../i18n/translations';
import { getSocket } from '../../utils/socket';
import { alertsAPI, getFileUrl, notificationsAPI, attendanceAPI, facilityAPI } from '../../utils/api';
import FaceCapture from '../FaceCapture';
import toast from 'react-hot-toast';
import SupportBot from '../SupportBot';
import BugReportWidget from '../BugReportWidget';
import PendingFeedbackPrompt from '../PendingFeedbackPrompt';

// Maps nav section/item labels to translation keys where one exists —
// anything not listed here just falls back to its original English label,
// so this can be extended incrementally without breaking untranslated items.
const NAV_SECTION_KEY = { 'Overview':'nav.overview', 'My Health':'nav.myHealth', 'Clinical':'nav.clinical', 'Schedule':'nav.schedule', 'Facility':'nav.facility', 'Health':'nav.health' };
const NAV_ITEM_KEY = { 'dashboard':'nav.dashboard', 'appointments':'nav.appointments', 'records':'nav.records', 'prescriptions':'nav.prescriptions', 'certificates':'nav.certificates', 'lab-reports':'nav.labResults', 'diet':'nav.diet', 'insurance':'nav.insurance', 'settings':'nav.settings', 'notice-board':'nav.noticeBoard', 'leaves':'nav.leaves', 'my-timetable':'nav.myTimetable' };

const NAV = {
  admin: [
    { sec:'Overview', items:[{id:'dashboard',icon:'📊',label:'Dashboard'},{id:'analytics',icon:'📈',label:'Analytics'}]},
    { sec:'Management', items:[{id:'patients',icon:'👥',label:'Patients'},{id:'doctors',icon:'🩺',label:'Doctors'},{id:'user-approval',icon:'👤',label:'Approvals',badge:'pending'},{id:'appointments',icon:'📅',label:'Appointments'}]},
    { sec:'Hospital', items:[{id:'pharmacy',icon:'💊',label:'Pharmacy'},{id:'orders',icon:'🛒',label:'Orders'},{id:'records',icon:'📋',label:'Records'},{id:'lab-reports',icon:'🔬',label:'Lab Reports'},{id:'lab-dashboard',icon:'🧪',label:'Lab Dashboard'},{id:'diet',icon:'🥗',label:'Diet & Nutrition'},{id:'emergency',icon:'🚨',label:'Emergency',badge:'alerts'}]},
    { sec:'Facility', items:[{id:'rooms',icon:'🏥',label:'Rooms & OT'},{id:'admissions',icon:'🛏️',label:'IPD Admissions'},{id:'surgeries',icon:'🔪',label:'OT Scheduling'},{id:'maintenance-admin',icon:'🔧',label:'Maintenance Hub',badge:'maint'},{id:'asset-tracking',icon:'📍',label:'Asset Tracking'},{id:'blood-bank',icon:'🩸',label:'Blood Bank'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Smart Insights', items:[{id:'predictive-staffing',icon:'📈',label:'Predictive Staffing'},{id:'sentiment-analytics',icon:'💬',label:'Sentiment Analytics'}]},
    { sec:'Timetable', items:[{id:'admin-timetable',icon:'📆',label:'All Timetables'},{id:'my-timetable',icon:'🗓️',label:'My Schedule'}]},
    { sec:'HR & Staff', items:[{id:'leaves',icon:'🌴',label:'Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'online-users',icon:'🟢',label:'Online Users'},{id:'user-activity',icon:'🕒',label:'User Activity'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'audit-log',icon:'📜',label:'Audit Log'},{id:'feedback-generator',icon:'📝',label:'Feedback Generator'}]},
    { sec:'Finance Oversight', items:[{id:'billing',icon:'🧾',label:'Billing & Invoicing'},{id:'tpa',icon:'🛡️',label:'TPA & Insurance'},{id:'failed-payments',icon:'⚠️',label:'Failed Payments'}]},
    { sec:'Clinical Services', items:[{id:'radiology',icon:'🩻',label:'Radiology'},{id:'dialysis',icon:'💉',label:'Dialysis'},{id:'nabh',icon:'🏅',label:'NABH Compliance'}]},
    { sec:'Patient Experience', items:[{id:'admin-feedback',icon:'💬',label:'Patient Feedback'},{id:'doctor-seating',icon:'🪑',label:'Doctor Seating'}]},
    { sec:'Tools', items:[{id:'reminders',icon:'⏰',label:'Reminders'},{id:'symptom-checker',icon:'🤖',label:'AI Checker'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  doctor: [
    { sec:'Practice', items:[{id:'dashboard',icon:'📊',label:'Dashboard'},{id:'appointments',icon:'📅',label:'Appointments'},{id:'patients',icon:'👥',label:'Patients'}]},
    { sec:'Clinical', items:[{id:'records',icon:'📋',label:'Records'},{id:'prescriptions',icon:'📝',label:'Prescriptions'},{id:'certificates',icon:'📄',label:'Certificates'},{id:'lab-reports',icon:'🔬',label:'Lab Reports'},{id:'diet',icon:'🥗',label:'Diet & Nutrition'},{id:'emergency',icon:'🚨',label:'Alerts',badge:'alerts'}]},
    { sec:'Smart Tools', items:[{id:'ai-scribe',icon:'🎙️',label:'AI Scribe'},{id:'peer-consult',icon:'🔗',label:'Peer Consultation'},{id:'research-hub',icon:'📚',label:'Research Hub'},{id:'discharge-timeline',icon:'🩹',label:'Recovery Timeline'}]},
    { sec:'Schedule', items:[{id:'my-timetable',icon:'📅',label:'My Timetable'},{id:'rooms',icon:'🏥',label:'Rooms & OT'},{id:'admissions',icon:'🛏️',label:'IPD Admissions'},{id:'surgeries',icon:'🔪',label:'OT Scheduling'},{id:'radiology',icon:'🩻',label:'Radiology'},{id:'dialysis',icon:'💉',label:'Dialysis'},{id:'tpa',icon:'🛡️',label:'TPA & Insurance'},{id:'doctor-seating',icon:'🪑',label:'My Seating Area'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'notice-board',icon:'📢',label:'Notice Board'}]},
    { sec:'Tools', items:[{id:'symptom-checker',icon:'🤖',label:'AI Checker'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  patient: [
    { sec:'My Health', items:[{id:'dashboard',icon:'📊',label:'Dashboard'},{id:'appointments',icon:'📅',label:'Appointments'},{id:'records',icon:'📋',label:'My Records'},{id:'prescriptions',icon:'📝',label:'Prescriptions'},{id:'certificates',icon:'📄',label:'Certificates'}]},
    { sec:'Pharmacy', items:[{id:'pharmacy',icon:'💊',label:'Order Medicine'},{id:'orders',icon:'🛒',label:'My Orders'},{id:'reminders',icon:'⏰',label:'Reminders'}]},
    { sec:'Health', items:[{id:'lab-reports',icon:'🔬',label:'My Lab Results'},{id:'radiology',icon:'🩻',label:'My Imaging'},{id:'dialysis',icon:'💉',label:'My Dialysis'},{id:'diet',icon:'🥗',label:'My Diet Plan'},{id:'insurance',icon:'🛡️',label:'Insurance'},{id:'billing',icon:'🧾',label:'My Bills'}]},
    { sec:'More Tools', items:[{id:'family-access',icon:'👨‍👩‍👧',label:'Family Access'},{id:'wearable-sync',icon:'⌚',label:'Wearable Sync'},{id:'discharge-timeline',icon:'🩹',label:'Recovery Timeline'},{id:'blood-donation',icon:'🩸',label:'Blood Donation'},{id:'ambulance-request',icon:'🚑',label:'Ambulance'}]},
    { sec:'Help', items:[{id:'emergency',icon:'🚨',label:'SOS Emergency'},{id:'symptom-checker',icon:'🤖',label:'AI Checker'},{id:'chat',icon:'💬',label:'Chat with My Doctor'},{id:'feedback',icon:'💬',label:'Feedback'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  nurse: [
    { sec:'Nursing Care', items:[{id:'dashboard',icon:'💉',label:'My Ward Dashboard'},{id:'patients',icon:'👥',label:'Patients'},{id:'records',icon:'📋',label:'Records'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'rooms',icon:'🏥',label:'Rooms'},{id:'admissions',icon:'🛏️',label:'IPD Admissions'},{id:'surgeries',icon:'🔪',label:'OT Schedule'},{id:'dialysis',icon:'💉',label:'Dialysis'},{id:'chat',icon:'💬',label:'Ward Chat'}]},
    { sec:'Clinical Alerts', items:[{id:'emergency',icon:'🚨',label:'Alerts'},{id:'reminders',icon:'⏰',label:'Med Reminders'}]},
    { sec:'More Tools', items:[{id:'smart-triage',icon:'🚦',label:'Smart Triage Queue'},{id:'handover-protocol',icon:'🔄',label:'Handover Protocol'},{id:'fridge-monitor',icon:'🌡️',label:'Fridge Monitor'},{id:'blood-bank',icon:'🩸',label:'Blood Bank'}]},
    { sec:'Nursing HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  pharmacist: [
    { sec:'Dispensary', items:[{id:'dashboard',icon:'💊',label:'My Pharmacy Dashboard'},{id:'pharmacy',icon:'📦',label:'Inventory'},{id:'orders',icon:'🛒',label:'Prescription Orders'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Pharmacy HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  wardboy: [
    { sec:'Ward Duty', items:[{id:'dashboard',icon:'🛏️',label:'My Duty Dashboard'},{id:'rooms',icon:'🏥',label:'Rooms & Beds'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Ward Boy HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  sweeper: [
    { sec:'Housekeeping', items:[{id:'dashboard',icon:'🧹',label:'My Cleaning Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'}]},
    { sec:'Housekeeping HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'chat',icon:'💬',label:'Chat'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  otboy: [
    { sec:'OT Support', items:[{id:'dashboard',icon:'🔪',label:'My OT Dashboard'},{id:'rooms',icon:'🏥',label:'OT Rooms'},{id:'surgeries',icon:'📋',label:"Today's Surgeries"}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'}]},
    { sec:'OT Staff HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'chat',icon:'💬',label:'Chat'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  radiology_tech: [
    { sec:'Radiology', items:[{id:'dashboard',icon:'🩻',label:'My Dashboard'},{id:'radiology',icon:'🩻',label:'Imaging Orders'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'}]},
    { sec:'Radiology HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'chat',icon:'💬',label:'Chat'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  dialysis_tech: [
    { sec:'Dialysis Unit', items:[{id:'dashboard',icon:'💉',label:'My Dashboard'},{id:'dialysis',icon:'💉',label:'Dialysis Sessions'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'}]},
    { sec:'Dialysis HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'chat',icon:'💬',label:'Chat'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  finance: [
    { sec:'Finance Desk', items:[{id:'dashboard',icon:'💰',label:'My Finance Dashboard'},{id:'billing',icon:'🧾',label:'Billing & Invoicing'},{id:'tpa',icon:'🛡️',label:'TPA & Insurance'},{id:'salary',icon:'💵',label:'Salary Mgmt'},{id:'failed-payments',icon:'⚠️',label:'Failed Payments'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Timetable'}]},
    { sec:'Finance HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'chat',icon:'💬',label:'Chat'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  receptionist: [
    { sec:'Front Desk', items:[{id:'dashboard',icon:'🏨',label:'My Front Desk Hub'},{id:'appointments',icon:'📅',label:'Appointments'},{id:'patients',icon:'👥',label:'Patients'},{id:'billing',icon:'🧾',label:'Billing & Invoicing'},{id:'tpa',icon:'🛡️',label:'TPA & Insurance'}]},
    { sec:'Hospital Floor', items:[{id:'rooms',icon:'🏥',label:'Rooms & Beds'},{id:'admissions',icon:'🛏️',label:'IPD Admissions'},{id:'emergency',icon:'🚨',label:'Emergency'}]},
    { sec:'More Tools', items:[{id:'smart-triage',icon:'🚦',label:'Smart Triage Queue'},{id:'handover-protocol',icon:'🔄',label:'Handover Protocol'},{id:'fridge-monitor',icon:'🌡️',label:'Fridge Monitor'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Front Desk HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  lab_technician: [
    { sec:'Laboratory', items:[{id:'lab-dashboard',icon:'🔬',label:'Lab Dashboard'},{id:'lab-reports',icon:'📋',label:'Lab Reports'}]},
    { sec:'More Tools', items:[{id:'smart-triage',icon:'🚦',label:'Smart Triage Queue'},{id:'handover-protocol',icon:'🔄',label:'Handover Protocol'},{id:'fridge-monitor',icon:'🌡️',label:'Fridge Monitor'},{id:'blood-bank',icon:'🩸',label:'Blood Bank'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Lab HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],

  // ── Facility & specialist staff ─────────────────────────────────────
  // These 7 roles previously fell through to one identical generic
  // template (maintNav()) that only swapped the icon — every one of
  // them looked like the same sidebar. Each already has a fully unique,
  // purpose-built dashboard (see Dashboard.js's role redirect — patrol
  // log for security, ticket queue for IT, calibration checklist for
  // biomedical, etc.) that was just never reflected in the sidebar.
  security: [
    { sec:'Security Ops', items:[{id:'dashboard',icon:'🔐',label:'My Security Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Security HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  electrician: [
    { sec:'Electrical Work', items:[{id:'dashboard',icon:'⚡',label:'My Work Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Maintenance HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  plumber: [
    { sec:'Plumbing Work', items:[{id:'dashboard',icon:'🔧',label:'My Work Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Maintenance HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  it_technician: [
    { sec:'IT Support', items:[{id:'dashboard',icon:'💻',label:'My Ticket Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'IT Staff HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  equipment_tech: [
    { sec:'Equipment Care', items:[{id:'dashboard',icon:'🔩',label:'My Service Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Maintenance HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  biomedical: [
    { sec:'Biomedical Engineering', items:[{id:'dashboard',icon:'🩺',label:'My Calibration Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Maintenance HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
  ambulance_driver: [
    { sec:'Ambulance Ops', items:[{id:'dashboard',icon:'🚑',label:'My Dispatch Dashboard'}]},
    { sec:'Duty Roster', items:[{id:'my-timetable',icon:'📅',label:'My Shift Timetable'},{id:'chat',icon:'💬',label:'Chat'}]},
    { sec:'Fleet HR', items:[{id:'leaves',icon:'🌴',label:'My Leaves'},{id:'attendance',icon:'🕒',label:'Attendance'},{id:'inventory',icon:'📦',label:'Inventory'},{id:'salary',icon:'💰',label:'My Salary'},{id:'reminders',icon:'⏰',label:'Reminders'},{id:'notice-board',icon:'📢',label:'Notice Board'},{id:'settings',icon:'⚙️',label:'Settings'}]},
    { sec:'Account', items:[{id:'my-activity',icon:'🕒',label:'My Activity'}]},
  ],
};

const ROLE_COLORS = { admin:'#6366f1',doctor:'#0891b2',patient:'#7c3aed',nurse:'#db2777',pharmacist:'#d97706',wardboy:'#059669',sweeper:'#f59e0b',otboy:'#8b5cf6',finance:'#8b5cf6',electrician:'#f59e0b',plumber:'#0891b2',it_technician:'#6366f1',equipment_tech:'#8b5cf6',biomedical:'#059669',security:'#374151',receptionist:'#db2777',ambulance_driver:'#dc2626',lab_technician:'#0d9488',radiology_tech:'#0e7490',dialysis_tech:'#be123c' };
const ROLE_LABELS = { admin:'Administrator',doctor:'Doctor',patient:'Patient',nurse:'Nurse',pharmacist:'Pharmacist',wardboy:'Ward Boy',sweeper:'Sweeper',otboy:'OT Boy',finance:'Finance Officer',electrician:'Electrician',plumber:'Plumber',it_technician:'IT Technician',equipment_tech:'Equipment Tech',biomedical:'Biomedical Eng.',security:'Security Officer',receptionist:'Receptionist',ambulance_driver:'Ambulance Driver',lab_technician:'Lab Technician',radiology_tech:'Radiology Tech',dialysis_tech:'Dialysis Tech' };

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage() || {};
  const { isDark, toggleTheme } = useTheme() || {};
  const navigate  = useNavigate();
  const location  = useLocation();
  const [collapsed, setCollapsed]   = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [notifs, setNotifs]         = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [maintCount, setMaintCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [clockBusy, setClockBusy] = useState(false);
  const [faceClockModal, setFaceClockModal] = useState(false);
  const page = location.pathname.replace('/','');
  const ac   = ROLE_COLORS[user?.role] || '#1648c9';

  // Every role now has its own explicit, unique nav config above — no
  // more generic fallback template that made several roles' sidebars
  // look identical.
  const navConfig = NAV[user?.role] || NAV.patient;

  // Auto-collapse the sidebar to its icon-only width on narrow viewports —
  // the full 222px sidebar plus content doesn't fit a phone screen. Users
  // can still tap to expand it temporarily; this just sets a sane default
  // and reacts to real resizes (e.g. rotating a tablet).
  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 900) setCollapsed(true); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Real auto-logout ──────────────────────────────────────────────────
  // When the user has "Auto-logout" switched on in Settings, sign them out
  // automatically after 30 minutes with no mouse/keyboard/touch activity —
  // previously this toggle was stored but never actually did anything.
  useEffect(() => {
    if (!user?.notificationPrefs?.autoLogout) return;
    const IDLE_LIMIT_MS = 30 * 60 * 1000;
    const WARNING_BEFORE_MS = 60 * 1000; // warn 1 minute before logging out
    let idleTimer, warnTimer, warned = false;

    const doLogout = () => {
      toast.error('You\u2019ve been signed out after 30 minutes of inactivity.', { duration: 6000 });
      logout().then(() => navigate('/login'));
    };
    const showWarning = () => {
      warned = true;
      toast('⏳ You\u2019ll be signed out in 1 minute due to inactivity — move your mouse to stay logged in.', { duration: 8000, icon:'⏳' });
    };
    const resetTimer = () => {
      warned = false;
      clearTimeout(idleTimer); clearTimeout(warnTimer);
      warnTimer = setTimeout(showWarning, IDLE_LIMIT_MS - WARNING_BEFORE_MS);
      idleTimer = setTimeout(doLogout, IDLE_LIMIT_MS);
    };

    const events = ['mousemove','mousedown','keydown','touchstart','scroll'];
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(idleTimer); clearTimeout(warnTimer);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [user?.notificationPrefs?.autoLogout, logout, navigate]);

  // Persisted notification history — survives page reloads, unlike the
  // purely session-live socket feed below.
  useEffect(() => {
    const uid = user?._id || user?.id;
    if (!uid) return;
    notificationsAPI.getMine({ limit: 20 }).then(res => {
      const mapped = (res.data.data || []).map(n => ({
        id: n._id, title: n.title, msg: n.message, icon: n.icon || '🔔',
        bg: n.icon === '⚠️' || n.icon === '❌' ? '#fef2f2' : n.icon === '✅' || n.icon === '💰' || n.icon === '💸' ? '#f0fdf4' : '#eff6ff',
        read: n.read, link: n.link,
      }));
      setNotifs(mapped);
    }).catch(() => {});
  }, [user?._id, user?.id]);

  // Smart attendance — staff (not patients) see a Clock In/Out control in
  // the header reflecting today's check-in/out state.
  useEffect(() => {
    if (!user || user.role === 'patient') return;
    attendanceAPI.getMine().then(res => setTodayAttendance(res.data.data?.today || null)).catch(() => {});
  }, [user]);

  const doClockAction = async () => {
    setClockBusy(true);
    try {
      const hasCheckedIn = !!todayAttendance?.checkInTime;
      const res = hasCheckedIn ? await attendanceAPI.checkOut() : await attendanceAPI.checkIn();
      setTodayAttendance(res.data.data);
      toast.success(res.data.message || (hasCheckedIn ? 'Checked out' : 'Checked in'));
    } catch (e) { toast.error(e.response?.data?.error || 'Attendance action failed'); }
    setClockBusy(false);
  };

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => facilityAPI.getUnreadCounts().then(res => setChatUnread(res.data.total || 0)).catch(() => {});
    fetchUnread();
    const socket = getSocket();
    if (socket) socket.on('new_message', fetchUnread);
    return () => { if (socket) socket.off('new_message', fetchUnread); };
  }, [user]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const uid = user?._id || user?.id;
    if (uid) socket.emit('join_user_room', uid, { name: user?.name, role: user?.role });

    socket.on('emergency_alert', d => {
      toast.error(`🚨 SOS: ${d.patientName}`, {duration:8000});
      setAlertCount(c=>c+1);
      setNotifs(p=>[{id:Date.now(),title:'🚨 Emergency SOS',msg:`${d.patientName} – ${d.message}`,icon:'🚨',bg:'#fef2f2',read:false},...p.slice(0,19)]);
    });
    socket.on('task_assigned', d => {
      toast(`📋 New task: ${d.title}`, {duration:5000});
      setNotifs(p=>[{id:Date.now(),title:'New Task Assigned',msg:d.title,icon:'📋',bg:'#eff6ff',read:false},...p.slice(0,19)]);
    });
    socket.on('leave_reviewed', d => {
      toast(`${d.status==='approved'?'✅':'❌'} Leave ${d.status}`);
      setNotifs(p=>[{id:Date.now(),title:`Leave ${d.status}`,msg:`${d.userName} – ${d.type}`,icon:'🌴',bg:'#f0fdf4',read:false},...p.slice(0,19)]);
    });
    socket.on('schedule_assigned', d => {
      toast(`📅 New shift: ${new Date(d.date).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}`);
      setNotifs(p=>[{id:Date.now(),title:'Shift Scheduled',msg:`New shift assigned`,icon:'📅',bg:'#eff6ff',read:false},...p.slice(0,19)]);
    });
    // Maintenance alerts — ALL staff except patients
    socket.on('room_maintenance', d => {
      if (user?.role==='patient') return;
      toast(`🔧 ${d.name} under maintenance`, {duration:7000,style:{background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e'}});
      setMaintCount(c=>c+1);
      setNotifs(p=>[{id:Date.now(),title:'🔧 Room Maintenance',msg:`${d.name} · Room ${d.number}`,icon:'🔧',bg:'#fffbeb',read:false,urgent:true},...p.slice(0,19)]);
    });
    socket.on('room_maintenance_end', d => {
      if (user?.role==='patient') return;
      toast.success(`✅ ${d.name} maintenance complete`);
      setNotifs(p=>[{id:Date.now(),title:'✅ Maintenance Complete',msg:`${d.name} · Now ${d.newStatus}`,icon:'✅',bg:'#f0fdf4',read:false},...p.slice(0,19)]);
    });
    socket.on('low_stock_alert', d => {
      if (['admin','pharmacist'].includes(user?.role)) toast.error(`⚠️ Low stock: ${d.count} item(s)`);
    });
    socket.on('blood_donation_scheduled', d => {
      toast.success(`🩸 Blood donation scheduled for ${d.dateStr} at ${d.timeStr}`, {duration:8000});
      setNotifs(p=>[{id:Date.now(),title:'🩸 Donation Scheduled',msg:`Scheduled for ${d.dateStr} at ${d.timeStr}`,icon:'🩸',bg:'#fef2f2',read:false},...p.slice(0,19)]);
    });
    socket.on('patient_vitals_alert', d => {
      if (user?.role !== 'doctor') return;
      toast.error(`⚠️ ${d.patientName}: ${d.reasons[0]}`, {duration:9000});
      setNotifs(p=>[{id:Date.now(),title:`⚠️ Abnormal Vitals — ${d.patientName}`,msg:d.reasons.join(' · '),icon:'⚠️',bg:'#fef2f2',read:false,urgent:true},...p.slice(0,19)]);
    });
    socket.on('ambulance_requested', d => {
      if (!['ambulance_driver','admin','receptionist'].includes(user?.role)) return;
      toast.error(`${d.isEmergency?'🚨 EMERGENCY':'🚑'} Ambulance requested by ${d.patientName} — ${d.from}`, {duration:9000});
      setNotifs(p=>[{id:Date.now(),title:`${d.isEmergency?'🚨 EMERGENCY':'🚑'} Ambulance Request`,msg:`${d.patientName} · ${d.from} → ${d.to}`,icon:'🚑',bg:d.isEmergency?'#fef2f2':'#fffbeb',read:false,urgent:d.isEmergency},...p.slice(0,19)]);
    });
    socket.on('video_call_scheduled', d => {
      toast.success(`📹 Video consultation confirmed for ${d.dateStr} at ${d.timeSlot}`, {duration:8000});
      setNotifs(p=>[{id:Date.now(),title:'📹 Video Call Scheduled',msg:`Dr. ${d.doctorName} · ${d.dateStr} at ${d.timeSlot}`,icon:'📹',bg:'#eff6ff',read:false},...p.slice(0,19)]);
    });
    socket.on('transfer_requested', d => {
      if (!['wardboy','admin'].includes(user?.role)) return;
      toast(`${d.priority==='urgent'?'🚨 URGENT':'🛏️'} Transfer requested: ${d.patientName} (${d.fromLocation} → ${d.toLocation})`, {duration:8000, icon:'🛏️'});
      setNotifs(p=>[{id:Date.now(),title:`🛏️ Transfer Request${d.priority==='urgent'?' — URGENT':''}`,msg:`${d.patientName} · ${d.fromLocation} → ${d.toLocation}`,icon:'🛏️',bg:d.priority==='urgent'?'#fef2f2':'#fffbeb',read:false,urgent:d.priority==='urgent'},...p.slice(0,19)]);
    });
    socket.on('queue_token_created', d => {
      if (!['receptionist','admin','doctor','nurse'].includes(user?.role)) return;
      toast(`🎫 Walk-in token #${d.tokenNumber} — ${d.department}`, {duration:5000, icon:'🎫'});
    });
    // Generic persisted-notification feed — backs every notify() call on
    // the server. Types already handled by a dedicated listener above
    // (which also show a differently-worded toast) are skipped here so
    // the same event doesn't produce two entries.
    const HANDLED_ELSEWHERE = new Set(['task_assigned','leave_reviewed','vitals_alert','video_call_scheduled']);
    socket.on('notification', d => {
      if (HANDLED_ELSEWHERE.has(d.type)) return;
      toast(`${d.icon||'🔔'} ${d.title}`, { duration: 6000 });
      setNotifs(p=>[{ id:d._id, title:d.title, msg:d.message, icon:d.icon||'🔔',
        bg: d.icon==='⚠️'||d.icon==='❌' ? '#fef2f2' : d.icon==='✅'||d.icon==='💰'||d.icon==='💸' ? '#f0fdf4' : '#eff6ff',
        read:false, link:d.link, urgent: d.icon==='⚠️' },...p.slice(0,19)]);
    });
    return () => {
      ['emergency_alert','task_assigned','leave_reviewed','schedule_assigned','room_maintenance','room_maintenance_end','low_stock_alert','blood_donation_scheduled','patient_vitals_alert','ambulance_requested','video_call_scheduled','transfer_requested','queue_token_created','notification'].forEach(e=>socket.off(e));
    };
  }, [user]);

  const triggerSOS = useCallback(async () => {
    try { await alertsAPI.create({type:'SOS',severity:'critical',message:'Emergency SOS from dashboard'}); toast.error('🚨 SOS ACTIVATED!',{duration:8000}); }
    catch { toast.error('SOS sent!'); }
  }, []);

  const initials = user?.name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'U';
  const unread   = notifs.filter(n=>!n.read).length;

  return (
    <div className="hms-layout">
      {/* ── SIDEBAR ── */}
      <motion.aside animate={{width:collapsed?56:222}} transition={{duration:.25,ease:[.4,0,.2,1]}}
        style={{background:'var(--sidebar)',display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',flexShrink:0,zIndex:10}}>
        {/* Logo */}
        <div style={{padding:'16px 12px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid rgba(255,255,255,.06)',minHeight:60}}>
          <div style={{width:34,height:34,background:`linear-gradient(135deg,${ac},#0891b2)`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>🏥</div>
          {!collapsed&&<motion.div initial={{opacity:0}} animate={{opacity:1}} style={{flex:1,overflow:'hidden'}}>
            <div style={{color:'#fff',fontWeight:800,fontSize:14,whiteSpace:'nowrap'}}>Mediventra</div>
            <div style={{color:'#64748b',fontSize:10,whiteSpace:'nowrap',letterSpacing:.5}}>HMS v4.0</div>
          </motion.div>}
          <button onClick={()=>setCollapsed(c=>!c)}
            style={{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.1)',color:'#94a3c8',cursor:'pointer',padding:'5px 7px',borderRadius:7,fontSize:12,flexShrink:0,transition:'all .2s',display:'flex',alignItems:'center',justifyContent:'center'}}
            title={collapsed?'Expand sidebar':'Collapse sidebar'}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.15)';e.currentTarget.style.color='#fff'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.07)';e.currentTarget.style.color='#94a3c8'}}>
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
        {/* Nav */}
        <nav style={{flex:1,overflowY:'auto',overflowX:'hidden',padding:'8px 0'}}>
          {navConfig.map(section=>(
            <div key={section.sec}>
              {!collapsed&&<div style={{color:'#475569',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'1.2px',padding:'9px 16px 3px',whiteSpace:'nowrap'}}>{NAV_SECTION_KEY[section.sec] && t ? t(NAV_SECTION_KEY[section.sec]) : section.sec}</div>}
              {section.items.map(item=>{
                const isActive=page===item.id||(item.id==='dashboard'&&page==='');
                return (
                  <button key={item.id} onClick={()=>navigate(`/${item.id}`)}
                    style={{display:'flex',alignItems:'center',gap:9,padding:collapsed?'9px 11px':'8px 12px',cursor:'pointer',borderRadius:7,transition:'all .15s',color:isActive?'#fff':'#94a3c8',background:isActive?`${ac}30`:'transparent',border:`1px solid ${isActive?`${ac}50`:'transparent'}`,width:'calc(100% - 12px)',margin:'1px 6px',fontSize:12.5,fontWeight:600,position:'relative',justifyContent:collapsed?'center':'flex-start'}}>
                    {isActive&&<span style={{position:'absolute',left:-6,top:'50%',transform:'translateY(-50%)',width:3,height:16,background:ac,borderRadius:'0 3px 3px 0'}}/>}
                    <span style={{fontSize:15,width:18,textAlign:'center',flexShrink:0}}>{item.icon}</span>
                    {!collapsed&&<span style={{whiteSpace:'nowrap',flex:1}}>{NAV_ITEM_KEY[item.id] && t ? t(NAV_ITEM_KEY[item.id]) : item.label}</span>}
                    {!collapsed&&item.badge==='alerts'&&alertCount>0&&<span style={{background:'#dc2626',color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10}}>{alertCount}</span>}
                    {!collapsed&&item.badge==='maint'&&maintCount>0&&<span style={{background:'#f59e0b',color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10}}>{maintCount}</span>}
                    {!collapsed&&item.badge==='pending'&&<span style={{background:'#f59e0b',color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10}}>!</span>}
                    {!collapsed&&item.id==='chat'&&chatUnread>0&&<span style={{background:'#dc2626',color:'#fff',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:10,minWidth:14,textAlign:'center'}}>{chatUnread>9?'9+':chatUnread}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        {/* User footer */}
        <div style={{padding:8,borderTop:'1px solid rgba(255,255,255,.06)'}}>
          <button onClick={logout} style={{display:'flex',alignItems:'center',gap:8,padding:8,borderRadius:8,cursor:'pointer',border:'none',background:'transparent',width:'100%',justifyContent:collapsed?'center':'flex-start',transition:'background .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.07)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            {user?.avatar ? (
              <img src={getFileUrl(user.avatar)} alt={user.name}
                style={{width:30,height:30,borderRadius:'50%',objectFit:'cover',border:`1.5px solid ${ac}`,flexShrink:0}} />
            ) : (
              <div style={{width:30,height:30,borderRadius:'50%',background:`linear-gradient(135deg,${ac},#0891b2)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:11,flexShrink:0}}>{initials}</div>
            )}
            {!collapsed&&<div style={{flex:1,minWidth:0,textAlign:'left'}}>
              <div style={{color:'#e2e8f0',fontSize:12,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user?.name}</div>
              <div style={{color:'#475569',fontSize:10,whiteSpace:'nowrap'}}>{ROLE_LABELS[user?.role]||user?.role}</div>
            </div>}
            {!collapsed&&<span style={{color:'#475569',fontSize:11}}>🚪</span>}
          </button>
          {!collapsed && (
            <div style={{ textAlign:'center', padding:'7px 4px 3px' }}>
              <span style={{ fontFamily:"'Caveat',cursive", fontSize:15.5, fontWeight:600, color:'#7c8db5', letterSpacing:.3 }}>
                Designed &amp; developed by <span style={{ color:'#a9bbe0', fontWeight:700 }}>Shubham Kumar</span>
              </span>
            </div>
          )}
        </div>
      </motion.aside>

      {/* ── MAIN ── */}
      <div className="content-area">
        {/* Topbar */}
        <header style={{height:60,background:'var(--card)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 20px',gap:12,flexShrink:0,zIndex:9,boxShadow:'var(--shadow)'}}>
          <div className="header-search" style={{flex:1,maxWidth:300,position:'relative'}}>
            <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:14}}>🔍</span>
            <input className="form-input" style={{paddingLeft:34,borderRadius:22,background:'var(--bg)',fontSize:13}} placeholder="Search patients, medicines…"/>
          </div>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>
            {user?.role!=='patient' && (
              <button onClick={doClockAction} disabled={clockBusy || (todayAttendance?.checkInTime && todayAttendance?.checkOutTime)}
                title={todayAttendance?.checkInTime ? (todayAttendance?.checkOutTime ? 'Already checked out today' : 'Clock out') : 'Clock in'}
                style={{
                  display:'flex', alignItems:'center', gap:6, border:'none', borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                  background: todayAttendance?.checkOutTime ? '#f1f5f9' : todayAttendance?.checkInTime ? '#fef2f2' : '#f0fdf4',
                  color: todayAttendance?.checkOutTime ? '#64748b' : todayAttendance?.checkInTime ? '#dc2626' : '#15803d',
                }}>
                <span className="header-clock-label">{todayAttendance?.checkOutTime ? `✅ Done — ${(todayAttendance.workedMinutes/60).toFixed(1)}h` : todayAttendance?.checkInTime ? '⏻ Clock Out' : '🕒 Clock In'}</span>
                <span className="header-clock-icon" style={{display:'none'}}>{todayAttendance?.checkOutTime ? '✅' : todayAttendance?.checkInTime ? '⏻' : '🕒'}</span>
              </button>
            )}
            {user?.role!=='patient' && !(todayAttendance?.checkInTime && todayAttendance?.checkOutTime) && (
              <button onClick={()=>setFaceClockModal(true)} title="Clock in/out with face recognition"
                style={{ border:'1px solid #e2e8f0', borderRadius:20, padding:'6px 10px', fontSize:13, cursor:'pointer', background:'#fff' }}>📸</button>
            )}
            {user?.role!=='patient'&&<button onClick={triggerSOS} className="sos-button sos-button-sm">🚨<span>SOS</span></button>}
            {/* Theme toggle */}
            <button onClick={toggleTheme} className="theme-toggle" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {isDark ? '☀️' : '🌙'}
            </button>
            {/* Language switcher — hidden while only one language is available */}
            {LANGUAGES.length > 1 && (
            <div style={{position:'relative'}}>
              <button onClick={()=>setLangOpen(o=>!o)} title="Language" style={{background:'none',border:'none',cursor:'pointer',padding:7,borderRadius:8,fontSize:16,color:'#475569',transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                🌐
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                    style={{position:'absolute',right:0,top:'100%',marginTop:6,background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'var(--shadow-lg)',minWidth:150,zIndex:60,overflow:'hidden'}}>
                    {LANGUAGES.map(l=>(
                      <button key={l.code} onClick={()=>{setLanguage?.(l.code);setLangOpen(false);}}
                        style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'10px 14px',border:'none',background:language===l.code?'var(--primary-xl)':'var(--card)',cursor:'pointer',fontSize:13,fontWeight:language===l.code?700:500,color:'var(--text)',fontFamily:'inherit',textAlign:'left'}}>
                        <span style={{fontSize:16}}>{l.flag}</span>{l.label}{language===l.code && <span style={{marginLeft:'auto',color:'#0ea5e9'}}>✓</span>}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}
            {/* Notifications */}
            <div style={{position:'relative'}}>
              <button onClick={()=>setNotifsOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:7,borderRadius:8,fontSize:17,color:'#475569',transition:'all .15s',position:'relative'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                🔔{unread>0&&<span style={{position:'absolute',top:5,right:5,width:8,height:8,background:'#dc2626',borderRadius:'50%',border:'2px solid #fff'}}/>}
              </button>
              <AnimatePresence>
                {notifsOpen&&(
                  <motion.div initial={{opacity:0,y:-8,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-8}} transition={{duration:.16}}
                    style={{position:'absolute',top:46,right:0,width:340,background:'#fff',borderRadius:16,boxShadow:'0 20px 60px rgba(15,23,42,.18)',border:'1px solid #e2e8f0',zIndex:50}}>
                    <div style={{padding:'14px 16px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontWeight:800,fontSize:14,color:'#0f172a'}}>Notifications{unread>0&&<span style={{marginLeft:8,background:'#dc2626',color:'#fff',fontSize:10,padding:'2px 6px',borderRadius:10,fontWeight:700}}>{unread}</span>}</span>
                      <button onClick={()=>{ notificationsAPI.markAllRead().catch(()=>{}); setNotifs(n=>n.map(x=>({...x,read:true}))); }} style={{background:'none',border:'none',color:'#64748b',fontSize:12,cursor:'pointer',fontWeight:600}}>Mark all read</button>
                    </div>
                    <div style={{maxHeight:340,overflowY:'auto'}}>
                      {notifs.length===0?(
                        <div style={{padding:'32px 16px',textAlign:'center',color:'#94a3b8',fontSize:13}}><div style={{fontSize:28,marginBottom:8}}>🔕</div>No notifications yet</div>
                      ):notifs.map(n=>(
                        <div key={n.id} style={{padding:'10px 14px',borderBottom:'1px solid #f1f5f9',display:'flex',gap:10,cursor:'pointer',background:n.read?'#fff':'#f8faff',borderLeft:n.urgent?'3px solid #f59e0b':'3px solid transparent'}}
                          onClick={()=>{
                            setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x));
                            if (typeof n.id === 'string' && n.id.length === 24) notificationsAPI.markRead(n.id).catch(()=>{});
                            if (n.link) { setNotifsOpen(false); navigate(n.link); }
                          }}>
                          <div style={{width:34,height:34,borderRadius:'50%',background:n.bg||'#e8effe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>{n.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12.5,fontWeight:700,color:'#0f172a'}}>{n.title}</div>
                            <div style={{fontSize:11.5,color:'#94a3b8',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div style={{width:1,height:22,background:'#e2e8f0',margin:'0 4px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'4px 8px',borderRadius:9,transition:'background .15s'}}
              onClick={()=>navigate('/settings')} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {user?.avatar ? (
                <img src={getFileUrl(user.avatar)} alt={user.name}
                  style={{width:34,height:34,borderRadius:'50%',objectFit:'cover',border:`1.5px solid ${ac}`}} />
              ) : (
                <div style={{width:34,height:34,borderRadius:'50%',background:`linear-gradient(135deg,${ac},#0891b2)`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:12}}>{initials}</div>
              )}
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{user?.name}</div>
                <div style={{fontSize:10.5,color:'#94a3b8'}}>{ROLE_LABELS[user?.role]||user?.role}</div>
              </div>
            </div>
          </div>
        </header>
        {/* Page */}
        <main className="page-content">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.25,ease:[.22,1,.36,1]}}>
              <Outlet/>
              <SupportBot user={user}/>
              <BugReportWidget/>
              <PendingFeedbackPrompt/>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {/* Floating expand tab — visible when sidebar is collapsed */}
      {collapsed && (
        <motion.button
          initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:.1}}
          onClick={()=>setCollapsed(false)}
          title="Expand sidebar"
          style={{position:'fixed',left:56,top:'50%',transform:'translateY(-50%)',zIndex:20,background:'#1648c9',border:'none',borderRadius:'0 8px 8px 0',padding:'14px 6px',cursor:'pointer',boxShadow:'4px 0 16px rgba(22,72,201,.4)',display:'flex',alignItems:'center',justifyContent:'center'}}
        >
          <span style={{color:'#fff',fontSize:12,fontWeight:800}}>▶</span>
        </motion.button>
      )}
      {notifsOpen&&<div style={{position:'fixed',inset:0,zIndex:49}} onClick={()=>setNotifsOpen(false)}/>}
      {langOpen&&<div style={{position:'fixed',inset:0,zIndex:49}} onClick={()=>setLangOpen(false)}/>}
      {faceClockModal && (
        <FaceCapture
          mode={todayAttendance?.checkInTime ? 'checkout' : 'checkin'}
          onDone={(data)=>{ setTodayAttendance(data); setFaceClockModal(false); }}
          onClose={()=>setFaceClockModal(false)}
        />
      )}
    </div>
  );
}
