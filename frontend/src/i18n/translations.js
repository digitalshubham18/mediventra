// Core UI translations. This deliberately covers the highest-traffic,
// always-visible surfaces (navigation, common buttons, auth screens)
// rather than attempting to translate every string in an app this large —
// see the LanguageContext comment for the reasoning. Add more keys here as
// specific screens are translated; anything missing falls back to English.
const translations = {
  en: {
    // Nav sections
    'nav.overview': 'Overview', 'nav.myHealth': 'My Health', 'nav.health': 'Health',
    'nav.clinical': 'Clinical', 'nav.schedule': 'Schedule', 'nav.facility': 'Facility',
    'nav.dashboard': 'Dashboard', 'nav.appointments': 'Appointments', 'nav.myRecords': 'My Records',
    'nav.records': 'Records', 'nav.prescriptions': 'Prescriptions', 'nav.certificates': 'Certificates',
    'nav.labResults': 'My Lab Results', 'nav.labReports': 'Lab Reports', 'nav.diet': 'Diet & Nutrition',
    'nav.insurance': 'Insurance', 'nav.settings': 'Settings', 'nav.logout': 'Log Out',
    'nav.noticeBoard': 'Notice Board', 'nav.leaves': 'Leaves', 'nav.myTimetable': 'My Timetable',

    // Common actions
    'action.save': 'Save', 'action.cancel': 'Cancel', 'action.submit': 'Submit', 'action.close': 'Close',
    'action.edit': 'Edit', 'action.delete': 'Delete', 'action.confirm': 'Confirm', 'action.back': 'Back',
    'action.continue': 'Continue', 'action.search': 'Search', 'action.loading': 'Loading…',

    // Auth
    'auth.welcomeBack': 'Welcome back', 'auth.signInSubtitle': 'Sign in to continue to your dashboard',
    'auth.email': 'Email Address', 'auth.password': 'Password', 'auth.forgotPassword': 'Forgot password?',
    'auth.signIn': 'Sign In', 'auth.noAccount': "Don't have an account?", 'auth.createOne': 'Create one',
    'auth.alreadyHaveAccount': 'Already have an account?', 'auth.signInLink': 'Sign in',
    'auth.selectRole': 'Select your role', 'auth.yourDetails': 'Your Details',
    'auth.verifyEmail': 'Verify Your Email', 'auth.fullName': 'Full Name',

    // Greetings
    'greeting.morning': 'Good morning', 'greeting.afternoon': 'Good afternoon', 'greeting.evening': 'Good evening',

    // Common nouns/labels used across many dashboards — added so pages can
    // adopt translation incrementally without inventing new keys each time.
    'common.patient': 'Patient', 'common.patients': 'Patients', 'common.doctor': 'Doctor', 'common.doctors': 'Doctors',
    'common.appointment': 'Appointment', 'common.appointments': 'Appointments', 'common.status': 'Status',
    'common.date': 'Date', 'common.time': 'Time', 'common.department': 'Department', 'common.reason': 'Reason',
    'common.phone': 'Phone', 'common.email': 'Email', 'common.name': 'Name', 'common.age': 'Age',
    'common.actions': 'Actions', 'common.notes': 'Notes', 'common.type': 'Type', 'common.payment': 'Payment',
    'common.pending': 'Pending', 'common.confirmed': 'Confirmed', 'common.completed': 'Completed', 'common.cancelled': 'Cancelled',
    'common.today': 'Today', 'common.yesterday': 'Yesterday', 'common.room': 'Room', 'common.bed': 'Bed',
    'common.wardboy': 'Ward Boy', 'common.nurse': 'Nurse', 'common.assign': 'Assign', 'common.verify': 'Verify',
    'common.checkIn': 'Check In', 'common.checkOut': 'Check Out', 'common.book': 'Book', 'common.reschedule': 'Reschedule',
    'common.viewAll': 'View All', 'common.noData': 'No data found', 'common.yes': 'Yes', 'common.no': 'No',
    'common.total': 'Total', 'common.amount': 'Amount', 'common.download': 'Download', 'common.print': 'Print',
    'common.overview': 'Overview', 'common.details': 'Details', 'common.required': 'Required',

    // Receptionist dashboard tabs
    'reception.checkin': 'Patient Check-In', 'reception.bedRequests': 'Bed Requests', 'reception.queue': 'Queue',
    'reception.visitors': 'Visitors', 'reception.checklist': 'Checklist', 'reception.mayNeedBed': 'May need a bed',

    // Dashboard greeting / patient overview — the very first screen most
    // users see, so worth covering fully.
    'dash.myHealthDashboard': 'My Health Dashboard', 'dash.welcomeBack': 'Welcome back',
    'dash.upcomingAppointments': 'Upcoming Appointments', 'dash.noUpcoming': 'No upcoming appointments',
    'dash.recentActivity': 'Recent Activity', 'dash.quickActions': 'Quick Actions',
    'dash.bookAppointment': 'Book Appointment', 'dash.viewRecords': 'View Records',
    'dash.myPrescriptions': 'My Prescriptions', 'dash.myBills': 'My Bills',

    // Patients list / table (staff-facing, high traffic)
    'patients.title': 'Patients', 'patients.subtitle': 'Search and manage patient records',
    'patients.addPatient': 'Add Patient', 'patients.searchPlaceholder': 'Search by name, phone, or email…',
    'patients.bloodGroup': 'Blood Group', 'patients.lastVisit': 'Last Visit', 'patients.registeredOn': 'Registered On',
    'patients.viewProfile': 'View Profile', 'patients.noPatients': 'No patients found',

    // Appointment statuses & booking
    'appt.book': 'Book Appointment', 'appt.selectDoctor': 'Select Doctor', 'appt.selectDate': 'Select Date',
    'appt.selectTime': 'Select Time Slot', 'appt.reasonForVisit': 'Reason for Visit',
    'appt.statusPending': 'Pending', 'appt.statusConfirmed': 'Confirmed', 'appt.statusCompleted': 'Completed',
    'appt.statusCancelled': 'Cancelled', 'appt.statusNoShow': 'No Show', 'appt.cancel': 'Cancel Appointment',

    // Module / feature names (used in nav + module headers)
    'mod.billing': 'Billing & Invoicing', 'mod.inventory': 'Inventory', 'mod.tpa': 'TPA & Insurance',
    'mod.radiology': 'Radiology', 'mod.dialysis': 'Dialysis', 'mod.nabh': 'NABH Compliance',
    'mod.surgeries': 'OT Scheduling', 'mod.attendance': 'Attendance', 'mod.salary': 'Salary',
    'mod.admissions': 'IPD Admissions', 'mod.pharmacy': 'Pharmacy', 'mod.bloodBank': 'Blood Bank',

    // Common medical/vitals terms
    'med.diagnosis': 'Diagnosis', 'med.symptoms': 'Symptoms', 'med.vitals': 'Vitals',
    'med.bloodPressure': 'Blood Pressure', 'med.pulse': 'Pulse', 'med.temperature': 'Temperature',
    'med.weight': 'Weight', 'med.height': 'Height', 'med.allergies': 'Allergies', 'med.medication': 'Medication',
    'med.dosage': 'Dosage', 'med.followUp': 'Follow-up',

    // Days & months
    'day.mon':'Mon','day.tue':'Tue','day.wed':'Wed','day.thu':'Thu','day.fri':'Fri','day.sat':'Sat','day.sun':'Sun',
    'month.jan':'January','month.feb':'February','month.mar':'March','month.apr':'April','month.may':'May','month.jun':'June',
    'month.jul':'July','month.aug':'August','month.sep':'September','month.oct':'October','month.nov':'November','month.dec':'December',
  },
};

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export default translations;
