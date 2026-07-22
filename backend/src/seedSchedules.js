const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Schedule = require('./models/Schedule');

const DEPTS = ['Cardiology','Neurology','Emergency','ICU','General Ward','Pharmacy','OT','Pediatrics'];
const TASKS = {
  doctor:     ['Morning rounds','OPD consultations','Follow-up consultations','Surgical procedure','Case review','Emergency duty','ICU monitoring'],
  nurse:      ['Medication administration','Vital signs check','Wound dressing','Patient education','Night duty rounds','IV cannulation','Discharge planning'],
  pharmacist: ['Prescription dispensing','Inventory audit','Drug counseling','Stock verification','Controlled substance check'],
  wardboy:    ['Ward cleaning','Patient transport','Bed linen change','Equipment cleaning','Supply delivery'],
  sweeper:    ['Floor mopping','Waste disposal','Corridor cleaning','Bathroom sanitization'],
  otboy:      ['OT preparation','Instrument sterilization','Post-op cleaning','Supply stocking'],
  admin:      ['Staff review','Approval tasks','Budget review','Facility inspection','HR meeting'],
};

const SHIFTS = ['morning','afternoon','night','full'];
const SHIFT_TIMES = {
  morning:   { start:'08:00', end:'16:00' },
  afternoon: { start:'14:00', end:'22:00' },
  night:     { start:'22:00', end:'06:00' },
  full:      { start:'07:00', end:'19:00' },
};

function randPick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function datesForWeeks(weeks=2) {
  const dates = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = -7; i < weeks*7; i++) {
    const d = new Date(today); d.setDate(today.getDate()+i);
    if (d.getDay()!==0) dates.push(new Date(d)); // skip Sunday
  }
  return dates;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mediventra');
    const users = await User.find({ status:'approved', role:{ $ne:'patient' } });
    console.log(`Found ${users.length} staff users`);

    await Schedule.deleteMany({});
    const dates = datesForWeeks(3);
    const schedules = [];

    for (const user of users) {
      const tasks = TASKS[user.role] || TASKS.admin;
      for (const date of dates) {
        // 85% chance of having a shift on any given day
        if (Math.random() > 0.85) continue;
        const shift = randPick(SHIFTS);
        const st = SHIFT_TIMES[shift];
        schedules.push({
          user: user._id,
          role: user.role,
          date,
          shift,
          startTime: st.start,
          endTime: st.end,
          department: user.department || randPick(DEPTS),
          task: randPick(tasks),
          status: date < new Date() ? (Math.random()>0.1?'completed':'absent') : 'scheduled',
        });
      }
    }

    await Schedule.insertMany(schedules);
    console.log(`✅ Seeded ${schedules.length} schedules for ${users.length} staff`);
  } catch(e) { console.error(e); }
  await mongoose.disconnect();
}
seed();
