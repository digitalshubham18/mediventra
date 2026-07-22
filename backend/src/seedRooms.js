const mongoose = require('mongoose');
require('dotenv').config();
const OTRoom = require('./models/OTRoom');

const ROOMS = [
  { name:'Operation Theater 1',  type:'OT',        number:'OT-01', floor:3, capacity:1, status:'available', equipment:['Anesthesia Machine','Surgical Lights','ECG Monitor','Ventilator','Defibrillator'] },
  { name:'Operation Theater 2',  type:'OT',        number:'OT-02', floor:3, capacity:1, status:'occupied',  equipment:['Anesthesia Machine','Surgical Lights','Laparoscopic Tower','Electrosurgical Unit'] },
  { name:'Operation Theater 3',  type:'OT',        number:'OT-03', floor:3, capacity:1, status:'maintenance', equipment:['Orthopedic Set','C-Arm X-Ray','Anesthesia Machine'] },
  { name:'ICU - Critical Care',  type:'ICU',       number:'ICU-01',floor:2, capacity:6, occupiedBeds:4, status:'occupied', equipment:['Ventilators','Cardiac Monitors','Infusion Pumps','Defibrillator'] },
  { name:'ICU - Cardiac',        type:'ICU',       number:'ICU-02',floor:2, capacity:4, occupiedBeds:2, status:'occupied', equipment:['ECG Machine','Cardiac Monitors','Pacemaker','Ventilators'] },
  { name:'ICU - Neuro',          type:'ICU',       number:'ICU-03',floor:2, capacity:4, occupiedBeds:1, status:'occupied', equipment:['EEG Machine','ICP Monitor','Ventilators'] },
  { name:'Emergency Room 1',     type:'Emergency', number:'ER-01', floor:1, capacity:4, occupiedBeds:2, status:'occupied', equipment:['Crash Cart','Defibrillator','Suction Machine','X-Ray Portable'] },
  { name:'Emergency Room 2',     type:'Emergency', number:'ER-02', floor:1, capacity:4, occupiedBeds:0, status:'available', equipment:['Crash Cart','ECG Machine','Pulse Oximeter'] },
  { name:'Recovery Room',        type:'Recovery',  number:'RR-01', floor:3, capacity:8, occupiedBeds:3, status:'occupied', equipment:['Pulse Oximeters','IV Stands','Call Bells','Oxygen Ports'] },
  { name:'Ward A - General',     type:'Ward',      number:'WA-01', floor:4, capacity:20,occupiedBeds:14,status:'occupied', equipment:['Beds','Oxygen Ports','Nurse Call System'] },
  { name:'Ward B - Pediatric',   type:'Ward',      number:'WB-01', floor:4, capacity:15,occupiedBeds:8, status:'occupied', equipment:['Pediatric Beds','Incubators','Play Area'] },
  { name:'Ward C - Maternity',   type:'Ward',      number:'WC-01', floor:5, capacity:12,occupiedBeds:5, status:'occupied', equipment:['Delivery Beds','Fetal Monitor','Bassinet'] },
  { name:'Ward D - Orthopedic',  type:'Ward',      number:'WD-01', floor:4, capacity:16,occupiedBeds:9, status:'occupied', equipment:['Traction Equipment','Fracture Beds','Physiotherapy Tools'] },
  { name:'General Room 101',     type:'General',   number:'GR-101',floor:1, capacity:2, occupiedBeds:1, status:'occupied', equipment:['Standard Beds','TV','AC'] },
  { name:'General Room 102',     type:'General',   number:'GR-102',floor:1, capacity:2, occupiedBeds:0, status:'available', equipment:['Standard Beds','TV','AC'] },
  { name:'General Room 103',     type:'General',   number:'GR-103',floor:1, capacity:2, occupiedBeds:0, status:'cleaning', equipment:['Standard Beds','TV','AC'] },
  { name:'General Room 201',     type:'General',   number:'GR-201',floor:2, capacity:1, occupiedBeds:1, status:'occupied', equipment:['Private Bed','En-suite','TV','Refrigerator'] },
  { name:'General Room 202',     type:'General',   number:'GR-202',floor:2, capacity:1, occupiedBeds:0, status:'reserved', equipment:['Private Bed','En-suite','TV','Refrigerator'] },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mediventra');
    const existing = await OTRoom.countDocuments();
    if (existing === 0) {
      await OTRoom.insertMany(ROOMS);
      console.log(`✅ Seeded ${ROOMS.length} rooms`);
    } else {
      console.log(`ℹ️  Rooms already exist (${existing}), skipping seed`);
    }
  } catch(e) { console.error(e); }
  await mongoose.disconnect();
}
seed();
