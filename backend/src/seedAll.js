/**
 * Mediventra — Complete Database Seeder
 * Run once after first install: node src/seedAll.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const User = require('./models/User');
  const Appointment = require('./models/Appointment');
  const Medicine = require('./models/Medicine');
  const { Alert } = require('./models/Models');

  // ── Demo Users ───────────────────────────────────────────────────────
  const DEMOS = [
    { name:'Admin User',        email:'admin@hospital.com',      password:'Admin@123',     role:'admin',       department:'Administration',  status:'approved', emailVerified:true },
    { name:'Dr. Arjun Sharma',  email:'doctor@hospital.com',     password:'Doctor@123',    role:'doctor',      department:'Cardiology',      specialization:'Cardiology',  status:'approved', emailVerified:true },
    { name:'Dr. Priya Mehta',   email:'doctor2@hospital.com',    password:'Doctor@123',    role:'doctor',      department:'Neurology',       specialization:'Neurology',   status:'approved', emailVerified:true },
    { name:'Dr. Komal Gupta',   email:'doctor3@hospital.com',    password:'Doctor@123',    role:'doctor',      department:'Surgery',         specialization:'General Surgery', status:'approved', emailVerified:true },
    { name:'Nurse Kavita',      email:'nurse@hospital.com',      password:'Nurse@123',     role:'nurse',       department:'ICU',             status:'approved', emailVerified:true },
    { name:'Rahul Patient',     email:'patient@hospital.com',    password:'Patient@123',   role:'patient',     bloodGroup:'B+',              status:'approved', emailVerified:true },
    { name:'Ananya Singh',      email:'patient2@hospital.com',   password:'Patient@123',   role:'patient',     bloodGroup:'O+',              status:'approved', emailVerified:true },
    { name:'Vijay Kumar',       email:'patient3@hospital.com',   password:'Patient@123',   role:'patient',     bloodGroup:'A+',              status:'approved', emailVerified:true },
    { name:'Finance Officer',   email:'finance@hospital.com',    password:'Finance@123',   role:'finance',     department:'Finance',         status:'approved', emailVerified:true },
    { name:'Ward Boy Ramu',     email:'wardboy@hospital.com',    password:'Wardboy@123',   role:'wardboy',     department:'Ward A',          status:'approved', emailVerified:true },
    { name:'Suresh Plumber',    email:'plumber@hospital.com',    password:'Plumber@123',   role:'plumber',     department:'Maintenance',     status:'approved', emailVerified:true },
    { name:'Reception Desk',    email:'reception@hospital.com',  password:'Reception@123', role:'receptionist',department:'Reception',       status:'approved', emailVerified:true },
    { name:'IT Support',        email:'it@hospital.com',         password:'IT@1234',       role:'it_technician',department:'IT Department',  status:'approved', emailVerified:true },
    { name:'Security Guard',    email:'security@hospital.com',   password:'Security@123',  role:'security',    department:'Security',        status:'approved', emailVerified:true },
    { name:'Pharmacist Mehta',  email:'pharmacy@hospital.com',   password:'Pharmacy@123',  role:'pharmacist',  department:'Pharmacy',        status:'approved', emailVerified:true },
    { name:'Ram Electrician',   email:'electric@hospital.com',   password:'Electric@123',  role:'electrician', department:'Maintenance',     status:'approved', emailVerified:true },
  ];

  const userMap = {};
  for (const demo of DEMOS) {
    try {
      let u = await User.findOne({ email: demo.email });
      if (!u) {
        u = await User.create({ ...demo, joiningDate: new Date('2023-01-01') });
        console.log(`  ✅ Created: ${demo.email}`);
      } else {
        u.status = 'approved'; u.emailVerified = true;
        await u.save({ validateBeforeSave: false });
        console.log(`  ⚡ Updated: ${demo.email}`);
      }
      userMap[demo.email] = u;
    } catch (e) { console.log(`  ❌ ${demo.email}: ${e.message}`); }
  }

  // ── Medicines ──────────────────────────────────────────────────────
  if (await Medicine.countDocuments() < 5) {
    await Medicine.insertMany([
      { name:'Paracetamol 500mg',  category:'Analgesic',    price:5,   stock:500, unit:'tablet',  requiresPrescription:false, manufacturer:'Generic Pharma', reorderLevel:50 },
      { name:'Amoxicillin 250mg',  category:'Antibiotic',   price:12,  stock:200, unit:'capsule', requiresPrescription:true,  manufacturer:'AmorPharma',     reorderLevel:30 },
      { name:'Metformin 500mg',    category:'Antidiabetic', price:8,   stock:300, unit:'tablet',  requiresPrescription:true,  manufacturer:'DiabaCare',      reorderLevel:40 },
      { name:'Atorvastatin 10mg',  category:'Cholesterol',  price:15,  stock:150, unit:'tablet',  requiresPrescription:true,  manufacturer:'CardioMed',      reorderLevel:20 },
      { name:'Omeprazole 20mg',    category:'Antacid',      price:9,   stock:250, unit:'capsule', requiresPrescription:false, manufacturer:'GastroCare',     reorderLevel:30 },
      { name:'Amlodipine 5mg',     category:'Antihypert',   price:10,  stock:200, unit:'tablet',  requiresPrescription:true,  manufacturer:'HeartMed',       reorderLevel:25 },
      { name:'Cetirizine 10mg',    category:'Antiallergic', price:6,   stock:400, unit:'tablet',  requiresPrescription:false, manufacturer:'AllerPharma',    reorderLevel:50 },
      { name:'Vitamin D3 1000IU',  category:'Supplement',   price:20,  stock:350, unit:'tablet',  requiresPrescription:false, manufacturer:'VitaCore',       reorderLevel:40 },
      { name:'Azithromycin 500mg', category:'Antibiotic',   price:25,  stock:100, unit:'tablet',  requiresPrescription:true,  manufacturer:'AntiBio Labs',   reorderLevel:15 },
      { name:'Ibuprofen 400mg',    category:'NSAID',        price:7,   stock:300, unit:'tablet',  requiresPrescription:false, manufacturer:'PainCare',       reorderLevel:40 },
      { name:'Insulin Glargine',   category:'Antidiabetic', price:850, stock:50,  unit:'vial',    requiresPrescription:true,  manufacturer:'InsulMed',       reorderLevel:10 },
      { name:'Losartan 50mg',      category:'Antihypert',   price:11,  stock:180, unit:'tablet',  requiresPrescription:true,  manufacturer:'BPCare',         reorderLevel:25 },
    ]);
    console.log('  ✅ 12 medicines seeded');
  }

  // ── Appointments ──────────────────────────────────────────────────
  if (await Appointment.countDocuments() < 5) {
    const doctors  = await User.find({ role:'doctor', status:'approved' });
    const patients = await User.find({ role:'patient', status:'approved' });
    if (doctors.length && patients.length) {
      const slots = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','02:00 PM','02:30 PM','03:00 PM'];
      const appts = [];
      for (let i=0; i<15; i++) {
        const d = new Date();
        d.setDate(d.getDate() + (i-7));
        appts.push({
          patient:    patients[i%patients.length]._id,
          doctor:     doctors[i%doctors.length]._id,
          date:       d,
          timeSlot:   slots[i%slots.length],
          department: doctors[i%doctors.length].department || 'General',
          type:       i%3===0 ? 'Follow-up' : 'Consultation',
          reason:     ['Chest pain','Headache','Routine checkup','Back pain','Fever'][i%5],
          status:     i<5 ? 'confirmed' : i<10 ? 'pending' : 'completed',
          fee:        [500,600,700,800,550][i%5],
          paid:       i<5,
        });
      }
      await Appointment.insertMany(appts);
      console.log(`  ✅ ${appts.length} appointments seeded`);
    }
  }

  // ── Alerts ───────────────────────────────────────────────────────
  if (await Alert.countDocuments() < 3) {
    const patients = await User.find({ role:'patient', status:'approved' }).limit(3);
    const doctors  = await User.find({ role:'doctor',  status:'approved' }).limit(2);
    if (patients.length && doctors.length) {
      await Alert.insertMany([
        { type:'SOS',      severity:'critical', message:'Patient reported severe chest pain — immediate attention required', patient:patients[0]?._id, doctor:doctors[0]?._id, status:'pending',  location:'Ward A - Bed 3' },
        { type:'Vitals',   severity:'high',     message:'Blood pressure reading 170/100 — monitoring required',            patient:patients[1]?._id, doctor:doctors[0]?._id, status:'pending',  location:'OPD Room 2' },
        { type:'Medication',severity:'medium',  message:'Missed morning insulin dose — follow up required',               patient:patients[2]?._id, doctor:doctors[1]?._id, status:'resolved', location:'ICU - Bed 1' },
      ]);
      console.log('  ✅ 3 emergency alerts seeded');
    }
  }

  console.log('\n🎉 Seed complete! Login credentials:');
  console.log('─'.repeat(60));
  for (const d of DEMOS.slice(0,8)) {
    console.log(`  ${d.role.padEnd(15)} ${d.email.padEnd(30)} ${d.password}`);
  }
  await mongoose.disconnect();
}

seed().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
