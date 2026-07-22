/**
 * Mediventra — Complete Seed Script
 * Run: node src/seedAll.js
 * Seeds: medicines, appointments, alerts, salary records, demo data
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB:', process.env.MONGO_URI);

  const User        = require('../models/User');
  const Appointment = require('../models/Appointment');
  const Medicine    = require('../models/Medicine');
  const Order       = require('../models/Order');
  const { Alert }   = require('../models/Models');

  // ── 1. ENSURE DEMO USERS ────────────────────────────────────────────
  const DEMOS = [
    { name:'Admin User',       email:'admin@hospital.com',    password:'Admin@123',     role:'admin',      department:'Administration', joiningDate: new Date('2022-01-15') },
    { name:'Arjun Sharma', email:'doctor@hospital.com',   password:'Doctor@123',    role:'doctor',     department:'Cardiology',  specialization:'Cardiology', joiningDate: new Date('2022-03-10') },
    { name:'Priya Mehta',  email:'doctor2@hospital.com',  password:'Doctor@123',    role:'doctor',     department:'Neurology',   specialization:'Neurology',  joiningDate: new Date('2022-05-20') },
    // { name:'Dr. Komal Gupta',  email:'doctor3@hospital.com',  password:'Doctor@123',    role:'doctor',     department:'Surgery',     specialization:'Surgery',    joiningDate: new Date('2022-07-01') },
    { name:'Kavita',     email:'nurse@hospital.com',    password:'Nurse@123',     role:'nurse',      department:'ICU',         joiningDate: new Date('2022-04-12') },
    { name:'Rahul',    email:'patient@hospital.com',  password:'Patient@123',   role:'patient',    bloodGroup:'B+',          joiningDate: new Date('2023-01-05') },
    { name:'Ananya Singh',     email:'patient2@hospital.com', password:'Patient@123',   role:'patient',    bloodGroup:'O+',          joiningDate: new Date('2023-03-18') },
    { name:'Vijay Kumar',      email:'patient3@hospital.com', password:'Patient@123',   role:'patient',    bloodGroup:'A+',          joiningDate: new Date('2023-06-25') },
    { name:'Officer',  email:'finance@hospital.com',  password:'Finance@123',   role:'finance',    department:'Finance',      joiningDate: new Date('2022-08-01') },
    { name:'Ramu',    email:'wardboy@hospital.com',  password:'Wardboy@123',   role:'wardboy',    department:'Ward A',       joiningDate: new Date('2023-02-14') },
    { name:'Suresh',   email:'plumber@hospital.com',  password:'Plumber@123',   role:'plumber',    department:'Maintenance',  joiningDate: new Date('2023-05-09') },
    { name:'Reception Desk',   email:'reception@hospital.com',password:'Reception@123', role:'receptionist',department:'Reception',   joiningDate: new Date('2023-01-20') },
  ];

  const userMap = {};
  for (const demo of DEMOS) {
    let u = await User.findOne({ email: demo.email });
    if (!u) {
      u = await User.create({ ...demo, status:'approved', emailVerified:true });
      console.log(`✅ Created user: ${demo.email}`);
    } else {
      u.status = 'approved'; u.emailVerified = true;
      if (demo.joiningDate) u.joiningDate = demo.joiningDate;
      await u.save({ validateBeforeSave: false });
    }
    userMap[demo.role] = userMap[demo.role] || u;
    userMap[demo.email] = u;
  }

  // ── 2. MEDICINES ────────────────────────────────────────────────────
  const medCount = await Medicine.countDocuments();
  if (medCount < 5) {
    const meds = [
      { name:'Paracetamol 500mg',  category:'Analgesic',    description:'Pain & fever relief', price:5,   stock:500, unit:'tablet', manufacturer:'Generic Pharma',  requiresPrescription:false, reorderLevel:50 },
      { name:'Amoxicillin 250mg',  category:'Antibiotic',   description:'Bacterial infections', price:12,  stock:200, unit:'capsule',manufacturer:'AmorPharma',     requiresPrescription:true,  reorderLevel:30 },
      { name:'Metformin 500mg',    category:'Antidiabetic', description:'Type 2 diabetes',      price:8,   stock:300, unit:'tablet', manufacturer:'DiabaCare',       requiresPrescription:true,  reorderLevel:40 },
      { name:'Atorvastatin 10mg',  category:'Cholesterol',  description:'Cholesterol control',  price:15,  stock:150, unit:'tablet', manufacturer:'CardioMed',       requiresPrescription:true,  reorderLevel:20 },
      { name:'Omeprazole 20mg',    category:'Antacid',      description:'Acid reflux relief',   price:9,   stock:250, unit:'capsule',manufacturer:'GastroCare',      requiresPrescription:false, reorderLevel:30 },
      { name:'Amlodipine 5mg',     category:'Antihypert.',  description:'Blood pressure',       price:10,  stock:200, unit:'tablet', manufacturer:'HeartMed',        requiresPrescription:true,  reorderLevel:25 },
      { name:'Pantoprazole 40mg',  category:'Antacid',      description:'Stomach acid',         price:14,  stock:180, unit:'tablet', manufacturer:'GastroCare',      requiresPrescription:true,  reorderLevel:20 },
      { name:'Cetirizine 10mg',    category:'Antiallergic', description:'Allergy relief',       price:6,   stock:400, unit:'tablet', manufacturer:'AllerPharma',     requiresPrescription:false, reorderLevel:50 },
      { name:'Vitamin D3 1000IU',  category:'Supplement',   description:'Vitamin D supplement', price:20,  stock:350, unit:'tablet', manufacturer:'VitaCore',        requiresPrescription:false, reorderLevel:40 },
      { name:'Azithromycin 500mg', category:'Antibiotic',   description:'Respiratory infections',price:25, stock:100, unit:'tablet', manufacturer:'AntiBio Labs',    requiresPrescription:true,  reorderLevel:15 },
      { name:'Ibuprofen 400mg',    category:'NSAID',        description:'Pain & inflammation',  price:7,   stock:300, unit:'tablet', manufacturer:'PainCare',        requiresPrescription:false, reorderLevel:40 },
      { name:'Insulin Glargine',   category:'Antidiabetic', description:'Basal insulin',        price:850, stock:50,  unit:'vial',  manufacturer:'InsulMed',        requiresPrescription:true,  reorderLevel:10 },
    ];
    await Medicine.insertMany(meds);
    console.log(`✅ Seeded ${meds.length} medicines`);
  } else {
    console.log(`ℹ️  Medicines already seeded (${medCount})`);
  }

  // ── 3. APPOINTMENTS ─────────────────────────────────────────────────
  const apptCount = await Appointment.countDocuments();
  if (apptCount < 5) {
    const doctors  = await User.find({ role:'doctor', status:'approved' }).limit(3);
    const patients = await User.find({ role:'patient', status:'approved' }).limit(5);
    if (doctors.length && patients.length) {
      const slots = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','02:00 PM','02:30 PM','03:00 PM','03:30 PM'];
      const types = ['consultation','follow_up','consultation','consultation','emergency'];
      const depts = ['Cardiology','Neurology','Surgery','Cardiology','Orthopedics'];
      const reasons= ['Chest pain and shortness of breath','Regular follow-up','Pre-surgical consultation','Routine cardiac checkup','Back pain assessment'];
      const appts = [];
      for (let i = 0; i < 15; i++) {
        const d = new Date();
        d.setDate(d.getDate() + (i - 5));
        const doc = doctors[i % doctors.length];
        const pat = patients[i % patients.length];
        appts.push({
          patient:    pat._id,
          doctor:     doc._id,
          date:       d,
          timeSlot:   slots[i % slots.length],
          department: depts[i % depts.length],
          type:       types[i % types.length],
          reason:     reasons[i % reasons.length],
          status:     i < 5 ? 'confirmed' : i < 10 ? 'pending' : 'completed',
          fee:        [500,600,800,700,550][i%5],
          paid:       i < 5,
          symptoms:   ['fever','headache','fatigue','chest pain','nausea'][i%5],
        });
      }
      await Appointment.insertMany(appts);
      console.log(`✅ Seeded ${appts.length} appointments`);
    }
  } else {
    console.log(`ℹ️  Appointments already seeded (${apptCount})`);
  }

  // ── 4. EMERGENCY ALERTS ─────────────────────────────────────────────
  const alertCount = await Alert.countDocuments();
  if (alertCount < 3) {
    const patients = await User.find({ role:'patient', status:'approved' }).limit(3);
    const doctors  = await User.find({ role:'doctor',  status:'approved' }).limit(2);
    const alerts = [
      { type:'SOS',        severity:'critical', message:'Patient reported severe chest pain, immediate attention required', patient:patients[0]?._id, doctor:doctors[0]?._id, status:'pending',  location:'Ward A - Bed 3' },
      { type:'Medication', severity:'high',     message:'Medication reminder — missed morning dose of Metformin',         patient:patients[1]?._id, doctor:doctors[0]?._id, status:'pending',  location:'OPD' },
      { type:'Vitals',     severity:'medium',   message:'Blood pressure reading 160/100 — monitoring required',           patient:patients[2]?._id, doctor:doctors[1]?._id, status:'resolved', location:'ICU - Bed 1' },
      { type:'SOS',        severity:'critical', message:'Patient fell down in corridor near pharmacy', patient:patients[0]?._id, doctor:doctors[1]?._id, status:'pending', location:'Corridor B' },
    ];
    await Alert.insertMany(alerts.filter(a => a.patient));
    console.log(`✅ Seeded emergency alerts`);
  } else {
    console.log(`ℹ️  Alerts already seeded (${alertCount})`);
  }

  console.log('\n🎉 Seed complete! Login credentials:');
  console.log('  Admin:      admin@hospital.com     / Admin@123');
  console.log('  Doctor:     doctor@hospital.com    / Doctor@123');
  console.log('  Nurse:      nurse@hospital.com     / Nurse@123');
  console.log('  Patient:    patient@hospital.com   / Patient@123');
  console.log('  Finance:    finance@hospital.com   / Finance@123');
  console.log('  Receptionist: reception@hospital.com / Reception@123');
  await mongoose.disconnect();
}
run().catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1); });
