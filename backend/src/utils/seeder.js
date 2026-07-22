const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Medicine = require('../models/Medicine');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const { HealthRecord, Reminder, Alert } = require('../models/Models');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB for seeding...');

    // Clear all
    await Promise.all([
      User.deleteMany(), Medicine.deleteMany(), Appointment.deleteMany(),
      Order.deleteMany(), HealthRecord.deleteMany(), Reminder.deleteMany(), Alert.deleteMany()
    ]);
    console.log('🧹 Cleared existing data');

    const hashedPwd = await bcrypt.hash('password123', 12);

    // Users
    const users = await User.insertMany([
      { name: 'Admin User', email: 'admin@mediventra.com', password: hashedPwd, role: 'admin', status: 'approved', department: 'Administration', phone: '+1-555-0100' },
      { name: 'Dr. Sarah Johnson', email: 'doctor@mediventra.com', password: hashedPwd, role: 'doctor', status: 'approved', department: 'Cardiology', specialization: 'Cardiologist', phone: '+1-555-0101' },
      { name: 'John Smith', email: 'patient@mediventra.com', password: hashedPwd, role: 'patient', status: 'approved', phone: '+1-555-0102', age: 34, bloodGroup: 'A+', weight: 72, height: 175 },
      { name: 'Nurse Maria Lopez', email: 'nurse@mediventra.com', password: hashedPwd, role: 'nurse', status: 'approved', department: 'General Ward', phone: '+1-555-0103' },
      { name: 'Dr. Robert Chen', email: 'rchen@mediventra.com', password: hashedPwd, role: 'doctor', status: 'approved', department: 'Neurology', specialization: 'Neurologist', phone: '+1-555-0104' },
      { name: 'Dr. Emily Ross', email: 'eross@mediventra.com', password: hashedPwd, role: 'doctor', status: 'approved', department: 'Orthopedics', specialization: 'Orthopedic Surgeon', phone: '+1-555-0106' },
      { name: 'Raj Patel', email: 'pharma@mediventra.com', password: hashedPwd, role: 'pharmacist', status: 'approved', department: 'Pharmacy', phone: '+1-555-0107' },
      { name: 'Alex Thompson', email: 'alex@gmail.com', password: hashedPwd, role: 'patient', status: 'pending', phone: '+1-555-0108', age: 28 },
      { name: 'Emma Wilson', email: 'emma@gmail.com', password: hashedPwd, role: 'patient', status: 'approved', phone: '+1-555-0109', age: 45, bloodGroup: 'B+' },
    ]);

    const [admin, doctorSarah, patientJohn, , doctorRobert, doctorEmily, , , patientEmma] = users;
    console.log('👥 Users seeded');

    // Medicines
    const medicines = await Medicine.insertMany([
      { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Pain Relief', description: 'Pain and fever relief', price: 5.99, stock: 245, minStock: 50, requiresPrescription: false, dosageForm: 'Tablet', strength: '500mg', manufacturer: 'PharmaCo', icon: '💊' },
      { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', category: 'Antibiotics', description: 'Antibiotic for bacterial infections', price: 12.49, stock: 80, minStock: 30, requiresPrescription: true, dosageForm: 'Capsule', strength: '250mg', manufacturer: 'MediLab', icon: '💊' },
      { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Anti-inflammatory', description: 'Pain and inflammation relief', price: 7.99, stock: 156, minStock: 50, requiresPrescription: false, dosageForm: 'Tablet', strength: '400mg', manufacturer: 'PharmaCo', icon: '🔴' },
      { name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Gastric', description: 'Acid reflux and ulcer treatment', price: 9.50, stock: 92, minStock: 30, requiresPrescription: true, dosageForm: 'Capsule', strength: '20mg', manufacturer: 'GastroPharma', icon: '🟡' },
      { name: 'Cetirizine 10mg', genericName: 'Cetirizine', category: 'Allergy', description: 'Antihistamine for allergy relief', price: 4.75, stock: 210, minStock: 60, requiresPrescription: false, dosageForm: 'Tablet', strength: '10mg', manufacturer: 'AllergyMed', icon: '🟢' },
      { name: 'Metformin 500mg', genericName: 'Metformin HCl', category: 'Diabetes', description: 'Blood sugar management', price: 8.25, stock: 130, minStock: 40, requiresPrescription: true, dosageForm: 'Tablet', strength: '500mg', manufacturer: 'DiabetesCare', icon: '⚪' },
      { name: 'Atorvastatin 10mg', genericName: 'Atorvastatin', category: 'Cholesterol', description: 'LDL cholesterol reduction', price: 14.99, stock: 68, minStock: 40, requiresPrescription: true, dosageForm: 'Tablet', strength: '10mg', manufacturer: 'CardioMed', icon: '🔵' },
      { name: 'Vitamin D3 1000IU', genericName: 'Cholecalciferol', category: 'Supplements', description: 'Bone health and immunity', price: 11.99, stock: 320, minStock: 80, requiresPrescription: false, dosageForm: 'Tablet', strength: '1000IU', manufacturer: 'VitaPlus', icon: '🌟' },
      { name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotics', description: 'Z-pack antibiotic', price: 18.50, stock: 45, minStock: 20, requiresPrescription: true, dosageForm: 'Tablet', strength: '500mg', manufacturer: 'MediLab', icon: '💊' },
      { name: 'Losartan 50mg', genericName: 'Losartan Potassium', category: 'Cardiac', description: 'Blood pressure control', price: 16.75, stock: 88, minStock: 30, requiresPrescription: true, dosageForm: 'Tablet', strength: '50mg', manufacturer: 'CardioMed', icon: '❤️' },
      { name: 'Salbutamol Inhaler', genericName: 'Albuterol', category: 'Respiratory', description: 'Bronchodilator for asthma', price: 22.00, stock: 55, minStock: 20, requiresPrescription: true, dosageForm: 'Inhaler', strength: '100mcg', manufacturer: 'BreathEasy', icon: '💨' },
      { name: 'Aspirin 81mg', genericName: 'Acetylsalicylic Acid', category: 'Cardiac', description: 'Blood thinner – cardiac protection', price: 3.99, stock: 400, minStock: 100, requiresPrescription: false, dosageForm: 'Tablet', strength: '81mg', manufacturer: 'PharmaCo', icon: '💊' },
    ]);
    console.log('💊 Medicines seeded');

    // Appointments
    const today = new Date();
    const appts = await Appointment.insertMany([
      { patient: patientJohn._id, doctor: doctorSarah._id, date: new Date(today.setDate(today.getDate())), timeSlot: '09:00 AM', department: 'Cardiology', type: 'Consultation', status: 'confirmed', notes: 'Regular cardiac checkup', fee: 150 },
      { patient: patientEmma._id, doctor: doctorRobert._id, date: new Date(), timeSlot: '10:30 AM', department: 'Neurology', type: 'Follow-up', status: 'pending', fee: 200 },
      { patient: patientJohn._id, doctor: doctorEmily._id, date: new Date(Date.now() + 86400000), timeSlot: '02:00 PM', department: 'Orthopedics', type: 'Surgery Consult', status: 'confirmed', notes: 'Knee pain evaluation', fee: 180 },
      { patient: patientEmma._id, doctor: doctorSarah._id, date: new Date(Date.now() + 86400000 * 2), timeSlot: '11:00 AM', department: 'Cardiology', type: 'Checkup', status: 'pending', fee: 150 },
      { patient: patientJohn._id, doctor: doctorRobert._id, date: new Date(Date.now() + 86400000 * 3), timeSlot: '03:30 PM', department: 'Neurology', type: 'Consultation', status: 'confirmed', notes: 'Recurring headaches', fee: 200 },
    ]);
    console.log('📅 Appointments seeded');

    // Orders
    await Order.insertMany([
      { patient: patientJohn._id, items: [{ medicine: medicines[0]._id, medicineName: medicines[0].name, quantity: 2, unitPrice: 5.99, subtotal: 11.98 }, { medicine: medicines[2]._id, medicineName: medicines[2].name, quantity: 1, unitPrice: 7.99, subtotal: 7.99 }], totalAmount: 19.97, status: 'delivered', deliveryAddress: { street: '123 Main St', city: 'New York', state: 'NY', zip: '10001' }, paymentStatus: 'paid', statusHistory: [{ status: 'processing' }, { status: 'shipped' }, { status: 'delivered' }], deliveredAt: new Date(Date.now() - 86400000 * 5) },
      { patient: patientEmma._id, items: [{ medicine: medicines[1]._id, medicineName: medicines[1].name, quantity: 1, unitPrice: 12.49, subtotal: 12.49 }], totalAmount: 12.49, status: 'processing', prescriptionRequired: true, deliveryAddress: { street: '456 Oak Ave', city: 'Brooklyn', state: 'NY', zip: '11201' }, statusHistory: [{ status: 'processing' }] },
      { patient: patientJohn._id, items: [{ medicine: medicines[4]._id, medicineName: medicines[4].name, quantity: 2, unitPrice: 4.75, subtotal: 9.50 }, { medicine: medicines[7]._id, medicineName: medicines[7].name, quantity: 1, unitPrice: 11.99, subtotal: 11.99 }], totalAmount: 21.49, status: 'shipped', deliveryAddress: { street: '789 Pine Rd', city: 'Queens', state: 'NY', zip: '11354' }, statusHistory: [{ status: 'processing' }, { status: 'shipped' }] },
    ]);
    console.log('🛒 Orders seeded');

    // Health Records
    await HealthRecord.insertMany([
      { patient: patientJohn._id, doctor: doctorSarah._id, type: 'Blood Report', title: 'Complete Blood Count - March 2025', description: 'Routine blood panel', notes: 'All values normal. LDL slightly elevated at 142 mg/dL.', fileName: 'blood_report_march.pdf', fileUrl: '/uploads/records/sample.pdf' },
      { patient: patientJohn._id, doctor: doctorSarah._id, type: 'ECG', title: 'ECG Report - February 2025', notes: 'Slight T-wave irregularity noted. Follow-up recommended.', fileName: 'ecg_feb.pdf', fileUrl: '/uploads/records/sample.pdf' },
      { patient: patientJohn._id, doctor: doctorEmily._id, type: 'X-Ray', title: 'Chest X-Ray - January 2025', notes: 'No fractures. Clear lung fields. Normal cardiac silhouette.', fileName: 'xray_jan.pdf', fileUrl: '/uploads/records/sample.pdf' },
      { patient: patientEmma._id, doctor: doctorRobert._id, type: 'MRI', title: 'Brain MRI - March 2025', notes: 'No lesions or abnormalities found. Normal study.', fileName: 'mri_mar.pdf', fileUrl: '/uploads/records/sample.pdf' },
    ]);
    console.log('📋 Health records seeded');

    // Reminders
    await Reminder.insertMany([
      { patient: patientJohn._id, medicine: medicines[5]._id, medicineName: 'Metformin 500mg', dose: '1 tablet', frequency: 'Twice Daily', times: ['08:00', '20:00'], startDate: new Date(), status: 'active', prescribedBy: doctorSarah._id },
      { patient: patientJohn._id, medicine: medicines[6]._id, medicineName: 'Atorvastatin 10mg', dose: '1 tablet', frequency: 'Once Daily', times: ['21:00'], startDate: new Date(), status: 'active', prescribedBy: doctorSarah._id },
      { patient: patientEmma._id, medicine: medicines[3]._id, medicineName: 'Omeprazole 20mg', dose: '1 capsule', frequency: 'Once Daily', times: ['07:30'], startDate: new Date(), status: 'active', prescribedBy: doctorRobert._id },
    ]);
    console.log('⏰ Reminders seeded');

    // Alerts
    await Alert.insertMany([
      { patient: patientJohn._id, triggeredBy: patientJohn._id, type: 'SOS', severity: 'critical', message: 'Emergency: Chest pain, difficulty breathing', status: 'resolved', respondedBy: doctorSarah._id, respondedAt: new Date(Date.now() - 3600000), resolvedAt: new Date(Date.now() - 1800000), resolutionNotes: 'Patient stabilised. Prescribed nitroglycerin.' },
      { patient: patientEmma._id, triggeredBy: patientEmma._id, type: 'Medication', severity: 'medium', message: 'Missed dose: Amoxicillin 250mg – 08:00 AM', status: 'pending' },
      { patient: patientJohn._id, triggeredBy: admin._id, type: 'Vitals', severity: 'high', message: 'High BP detected: 165/102 mmHg', status: 'pending' },
    ]);
    console.log('🚨 Alerts seeded');

    console.log('\n✅ Database seeded successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DEMO CREDENTIALS (all passwords: password123)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin      → admin@mediventra.com');
    console.log('Doctor     → doctor@mediventra.com');
    console.log('Patient    → patient@mediventra.com');
    console.log('Nurse      → nurse@mediventra.com');
    console.log('Pharmacist → pharma@mediventra.com');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
};

seed();