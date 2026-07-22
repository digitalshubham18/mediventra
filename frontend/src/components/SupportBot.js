import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Every staff-facing account (everyone except patient/doctor/admin) is grouped
// as 'staff' for support-topic purposes, except ward/OT/cleaning roles which
// get their own dedicated topic group since they have a very different workflow.
const SUPPORT_STAFF_ROLES = ['wardboy', 'sweeper', 'otboy'];
function roleGroup(role) {
  if (!role) return 'patient';
  if (role === 'patient' || role === 'doctor' || role === 'admin') return role;
  if (SUPPORT_STAFF_ROLES.includes(role)) return 'support_staff';
  return 'staff';
}

const KB = [
  { roles:['all'], q:['login','sign in','how do i login','cant login','login problem','access','enter'],
    a:`**🔐 How to Login:**\n\n1. Go to the **Login Page** (you're on it!)\n2. Select your **Role** from the 5 role buttons\n3. Enter your **Email Address**\n4. Enter your **Password** (min 6 characters)\n5. Click **"Sign In"** button\n\n💡 **Demo Password:** \`password123\` for all test accounts\n🔑 Use **"Forgot password?"** link if needed\n👤 New here? Click **"Register here"** to create an account` },

  { roles:['all'], q:['register','sign up','create account','new account','new user'],
    a:`**📝 How to Register:**\n\n1. Click **"Register here"** on the login page\n2. Fill: Name, Email, Password, Role\n3. Add phone, department (for staff)\n4. Submit the form\n5. **Wait for Admin Approval** (24–48 hrs)\n\n⚠️ All non-patient roles need **admin approval** for security.\n📧 You'll be notified once approved.` },

  { roles:['all'], q:['forgot password','reset password','change password','password help'],
    a:`**🔑 Password Help:**\n\n**Forgot Password:**\nClick **"Forgot password?"** link on the login page to reset via email.\n\n**Change Password (logged in):**\n1. Go to ⚙️ Settings\n2. Click "Security" tab\n3. Enter current + new password\n\n**Minimum:** 6 characters · Mix letters & numbers for security.` },

  { roles:['patient'], q:['book appointment','schedule appointment','appointment booking','make appointment','how to book'],
    a:`**📅 Booking an Appointment:**\n\n1. Go to **📅 Appointments** in sidebar\n2. Click **"+ Book Appointment"**\n3. Select: Doctor, Department, Date, Time Slot\n4. Choose visit type (Consultation/Follow-up/etc.)\n5. Click **"Proceed to Pay"**\n6. Pay consultation fee (₹500–₹1500)\n7. ✅ Appointment confirmed instantly!\n\n⏰ Only available slots are shown · Reminders sent 24hrs before` },

  { roles:['patient'], q:['cancel appointment','reschedule','appointment cancel','change appointment'],
    a:`**❌ Cancel/Change Appointment:**\n\n1. Go to **📅 Appointments**\n2. Find your appointment in the list\n3. Click **"Cancel"** button\n\n⚠️ Cancellation policy:\n• 24+ hours before: Full refund possible\n• Same day: Contact hospital admin\n\n📞 Emergency cancellations: **+1-800-MEDIVEN**` },

  { roles:['patient'], q:['order medicine','buy medicine','pharmacy','order drugs','how to order','medicines'],
    a:`**💊 Ordering Medicine:**\n\n1. Go to **💊 Pharmacy**\n2. Browse/search by name or category\n3. Click **"Add to Cart"** 🛒\n4. Adjust quantities\n5. Click **"Checkout"**\n6. Complete **payment**\n7. ✅ Order confirmed!\n\n📦 Track in **🛒 Orders** section\n⚕️ Some medicines need a prescription\n🚚 Delivery within hospital: 30 min` },

  { roles:['all'], q:['payment','how to pay','payment methods','pay','card','upi','net banking','wallet','refund'],
    a:`**💳 Payment Methods:**\n\n💳 **Card** — Visa, Mastercard, Amex, Discover\n📱 **UPI** — Google Pay, PhonePe, PayTM, BHIM\n🏦 **Net Banking** — SBI, HDFC, ICICI, Axis, Kotak\n👝 **Wallet** — PayTM, PhonePe, Google Pay, Amazon Pay\n\n🔒 256-bit SSL · PCI DSS Compliant\n✅ Payment confirms appointments & orders instantly\n\n💡 **Test Card:** \`4111 1111 1111 1111\` (any future expiry, any CVV)` },

  { roles:['patient','doctor'], q:['health record','upload record','medical record','lab report','my records','view records','xray','scan','report'],
    a:`**📋 Health Records:**\n\n1. Go to **📋 Records** in sidebar\n2. View all past records, lab reports, X-rays\n3. Click **"+ Add Record"** to upload\n\n📎 **Supported formats:** PDF, JPG, PNG, DOCX, DICOM\n📦 **Max file size:** 50MB\n🏷️ **Types:** Lab Report, X-Ray, MRI, CT Scan, ECG, Prescription, Others\n\n🔒 Private — only the patient + treating doctor can view` },

  { roles:['all'], q:['emergency','sos','help emergency','alert','critical','accident','urgent'],
    a:`**🚨 Emergency / SOS:**\n\n**PATIENT SOS:**\n1. Go to **🚨 Emergency** in sidebar\n2. Press the big **red SOS button**\n3. Emergency team alerted instantly with your location\n\n**STAFF ALERTS:**\n• Red notifications appear in real-time for all online staff\n• All departments notified simultaneously\n\n📞 **24/7 Emergency Hotline:** +1-800-MEDIVEN (free)\n🚑 **Ambulance:** Dial **102**` },

  { roles:['admin','staff','doctor'], q:['room','ot','operation theater','ward','icu','bed','available room','room status','operation'],
    a:`**🏥 Rooms & OT Management:**\n\nGo to **🏥 Rooms & OT** in sidebar:\n\n🔪 **OT Rooms** — Availability & scheduled operations\n❤️ **ICU** — Real-time bed occupancy\n🛏️ **Wards** — General, Pediatric, Maternity, Orthopedic\n🚨 **Emergency Rooms** — Live status\n✅ **Recovery Rooms** — Post-op monitoring\n\n🟢 Available · 🔴 Occupied · 🟡 Cleaning · 🔧 Maintenance\n\nAdmins assign patients, doctors & nurses to rooms.` },

  { roles:['admin','staff','doctor','support_staff'], q:['timetable','schedule','shift','my schedule','duty','roster','work schedule','timing'],
    a:`**📆 Staff Timetable:**\n\n1. Go to **🏥 Rooms & OT** → **"Timetable" tab**\n2. View your weekly schedule\n3. Navigate weeks with ← → arrows\n\n**Shifts:**\n🌅 Morning: 08:00 – 16:00\n🌇 Afternoon: 14:00 – 22:00\n🌙 Night: 22:00 – 08:00\n☀️ Full Day: All day\n\n🛡️ Admins manage & assign schedules for all staff` },

  { roles:['all'], q:['chat','message','talk','contact','communicate','messaging','send message','direct message'],
    a:`**💬 Chat & Messaging:**\n\n1. Click **💬 Chat** in the sidebar\n2. Use **channels:**\n   • 🏥 General — hospital-wide\n   • ⚕️ Doctors — medical team\n   • 💉 Nurses — nursing staff\n   • 🚨 Emergency — critical alerts\n   • 💊 Pharmacy — pharmacy team\n3. Click any user for **Direct Message (DM)**\n\n🟢 Green dot = user is online\n⚡ Real-time via WebSocket · 🔒 Encrypted` },

  { roles:['support_staff'], q:['ward boy','wardboy','sweeper','cleaner','ot boy','support staff','otboy','cleaning'],
    a:`**🛏️ Support Staff (Ward Boy / OT Boy / Sweeper):**\n\nYour **dedicated dashboard** shows:\n\n✅ Your today's **task checklist** with progress\n📆 Your **duty schedule** & shift times\n🧹 **Rooms to clean** with one-click "Mark as Cleaned"\n📊 **Room stats** — cleaning needed, occupied, available\n\n🆔 Your unique staff ID shown on dashboard\n💬 **Chat** with hospital team anytime` },

  { roles:['doctor','patient'], q:['prescription','prescriptions','medicine prescription','view prescription','doctor prescription'],
    a:`**📝 Prescriptions:**\n\n**Doctors:**\n• Go to **📝 Prescriptions** to create/manage\n• Add medicines, dosage, duration per patient\n\n**Patients:**\n• View prescriptions in **📋 Records**\n• Use prescription to order from **💊 Pharmacy**\n\n⚕️ Some medicines require a valid prescription · Digital prescriptions accepted` },

  { roles:['patient'], q:['reminder','medication reminder','medicine reminder','pill','dose','notification'],
    a:`**⏰ Medication Reminders:**\n\n1. Go to **⏰ Reminders**\n2. Click **"+ Add Reminder"**\n3. Select medicine, frequency, time(s)\n4. Enable notifications in ⚙️ Settings\n\n✅ In-app notifications at medicine time\n📊 Adherence tracked & reported to your doctor\n📱 Works while app is open` },

  { roles:['patient'], q:['symptom','ai checker','diagnosis','check symptom','what do i have','health check','ai'],
    a:`**🤖 AI Symptom Checker:**\n\n1. Go to **🤖 AI Checker**\n2. Describe your symptoms\n3. AI suggests possible conditions\n4. Get specialist recommendations\n\n⚠️ **Important:** Guidance only — always see a real doctor!\n📅 Use results to book the right specialist` },

  { roles:['all'], q:['dashboard','home','overview','my dashboard','what can i see','after login'],
    a:`**📊 Your Dashboard (by role):**\n\n🛡️ **Admin:** Hospital stats, pending approvals, system alerts, revenue\n👨‍⚕️ **Doctor:** Today's appointments, my patients, recent records\n🧑 **Patient:** Upcoming appointments, reminders, orders\n💉 **Nurse:** Ward patients, assigned rooms, medication alerts\n💊 **Pharmacist:** Pending orders, low stock alerts\n🛏️ **Ward Boy/OT/Sweeper:** Tasks, cleaning rooms, today's shifts` },

  { roles:['doctor','admin'], q:['analytics','reports','statistics','data','graphs','revenue','performance'],
    a:`**📈 Analytics & Reports:**\n\nAvailable for **Admin** and **Doctor** roles:\n\n📊 Patient admissions over time\n💰 Revenue & payment trends\n📅 Appointment statistics\n🏥 Department performance\n💊 Medicine sales & inventory\n👥 Staff performance\n\nData updates in **real-time** as transactions occur.` },

  { roles:['all'], q:['settings','profile','account','update profile','my account','personal info','edit profile'],
    a:`**⚙️ Account Settings:**\n\n1. Go to **⚙️ Settings** in sidebar\n2. **Profile tab:** Update name, phone, address, blood group\n3. **Security tab:** Change password\n4. **Notifications tab:** Manage alert preferences\n5. **Upload:** Profile picture\n\n💾 Changes save instantly · 🔒 Never share your password` },

  { roles:['all'], q:['contact','phone number','helpline','help','support number','hospital number','contact us'],
    a:`**📞 Contact Mediventra:**\n\n📞 **Emergency Hotline:** +1-800-MEDIVEN (24/7 Free)\n📧 **Email:** support@mediventra.com\n💬 **Live Chat:** Use the chat button below (avg <2 min)\n🏥 **Hospital Address:** 123 Health Avenue, Medical District\n\n**Department Contacts:**\n• Appointments: +1-800-APPOINT\n• Pharmacy: +1-800-PHARMA1\n• Billing: +1-800-BILLING` },

  { roles:['all'], q:['blood bank','blood','donate blood','blood group','blood donation'],
    a:`**🩸 Blood Bank Services:**\n\nMediventra Blood Bank:\n• All blood groups available: A+, A-, B+, B-, AB+, AB-, O+, O-\n• Emergency blood requests: Contact **Emergency Room** or call **+1-800-MEDIVEN**\n• **Donation:** Walk in to the blood bank (Floor 1, Room BK-01)\n• Donors receive free health checkup + certificate\n\n🩸 Your blood group is stored in your health profile` },

  { roles:['all'], q:['ambulance','accident','transport','patient transport'],
    a:`**🚑 Ambulance & Transport:**\n\n• **Emergency Ambulance:** Dial **102** (free, 24/7)\n• **Hospital Ambulance:** +1-800-AMBULANCE\n• **Patient Transport (internal):** Contact ward nurse\n• **Inter-hospital transfer:** Contact admin desk\n\n⚡ Average response time: **8 minutes** within city limits\nAll ambulances equipped with AED, oxygen, first aid` },

  { roles:['patient'], q:['visiting hours','visit patient','see patient','visit','visitor','family'],
    a:`**👨‍👩‍👧 Visiting Hours:**\n\n🌅 **Morning:** 10:00 AM – 12:00 PM\n🌇 **Evening:** 5:00 PM – 7:00 PM\n\n**ICU:** 15 min windows, 2 visitors max\n**OT/Recovery:** No visitors allowed\n**General Wards:** As per schedule above\n\n📋 All visitors must register at the **reception desk**\n🆔 Photo ID required` },

  { roles:['patient'], q:['canteen','food','meals','diet','nutrition','eat'],
    a:`**🍽️ Hospital Canteen & Meals:**\n\n**Patient Meals:**\n• Included with admission (diet as per doctor's order)\n• Special diets: Diabetic, cardiac, renal — speak to your nurse\n\n**Hospital Canteen:**\n• Location: Ground Floor, near main entrance\n• Hours: 7:00 AM – 10:00 PM daily\n• Accepts cash & UPI payments\n\n🥗 Nutritionist available: Mon–Fri 10am–2pm` },

  { roles:['patient'], q:['insurance','cashless','claim','tpa','health insurance','mediclaim'],
    a:`**🏥 Insurance & Billing:**\n\n**Accepted Insurance:** Most major health insurers\n**Cashless Treatment:** Available for network hospitals\n**Process:**\n1. Show insurance card at admission\n2. TPA desk handles pre-authorization\n3. Bills settled directly with insurer\n\n📋 **Documents needed:** Insurance card, Photo ID, Policy number, and supporting bills/prescriptions/reports\n💼 **Billing Desk:** Ground Floor, Counter 3\n📞 **Billing helpline:** +1-800-BILLING` },

  { roles:['patient'], q:['discharge','go home','discharge process','when can i leave'],
    a:`**🏠 Discharge Process:**\n\n1. Doctor issues **discharge order**\n2. Nurse prepares **discharge summary**\n3. Visit **billing desk** to clear dues\n4. Collect **medicines & prescriptions**\n5. Get **follow-up appointment** if needed\n6. Sign discharge papers\n\n⏰ Process usually takes 2–4 hours after doctor's order\n📋 Discharge summary available in your **📋 Records** section` },
];

function getAnswer(input, group) {
  const q = input.toLowerCase().trim();
  const visible = KB.filter(e => e.roles.includes('all') || e.roles.includes(group));
  for (const entry of visible) {
    if (entry.q.some(k => q.includes(k))) return entry.a;
  }
  const words = q.split(/\s+/).filter(w => w.length > 3);
  for (const entry of visible) {
    if (words.some(w => entry.q.some(k => k.includes(w) || w.includes(k)))) return entry.a;
  }
  return null;
}

function renderMd(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/`(.*?)`/g,'<code style="background:rgba(0,0,0,.08);padding:1px 5px;border-radius:4px;font-size:11.5px;font-family:monospace">$1</code>')
    .replace(/\n/g,'<br/>');
}

const QUICK_TOPICS = [
  { roles:['all'],           label:'🔐 Login Help',       q:'how to login' },
  { roles:['patient'],       label:'📅 Book Appointment', q:'book appointment' },
  { roles:['patient'],       label:'💊 Order Medicine',   q:'order medicine' },
  { roles:['all'],           label:'💳 Payment Methods',  q:'payment methods' },
  { roles:['all'],           label:'🚨 Emergency SOS',    q:'emergency sos help' },
  { roles:['admin','staff','doctor'], label:'🏥 Room Status', q:'room ot ward status' },
  { roles:['admin','staff','doctor','support_staff'], label:'📆 My Schedule', q:'my schedule timetable' },
  { roles:['all'],           label:'💬 Chat System',      q:'chat messaging' },
  { roles:['patient','doctor'], label:'📋 Health Records', q:'health record upload' },
  { roles:['all'],           label:'📞 Contact Us',       q:'contact phone number' },
  { roles:['all'],           label:'🩸 Blood Bank',       q:'blood bank donate' },
  { roles:['all'],           label:'🚑 Ambulance',        q:'ambulance transport' },
  { roles:['doctor','admin'], label:'📈 Analytics',       q:'analytics reports statistics' },
  { roles:['support_staff'], label:'🧹 My Tasks',         q:'ward boy support staff tasks' },
  { roles:['patient'],       label:'🏥 Insurance Claim',  q:'insurance claim' },
];

const WELCOME_BY_GROUP = {
  patient: `👋 **Hello! I'm Mediventra Assistant.**\n\nI can instantly answer questions about:\n📅 Appointments · 💊 Pharmacy · 📋 Records\n💳 Payments · 🚨 Emergency · ⏰ Reminders\n🏥 Insurance · 🏠 Discharge · 🩸 Blood Bank\n\nType your question or tap a topic below!`,
  doctor: `👋 **Hello Doctor! I'm Mediventra Assistant.**\n\nI can help with:\n📋 Patient Records · 📝 Prescriptions · 📈 Analytics\n🏥 Rooms & OT · 📆 Schedules · 💬 Chat\n\nType your question or tap a topic below!`,
  admin: `👋 **Hello Admin! I'm Mediventra Assistant.**\n\nI can help with:\n🏥 Rooms & OT · 📆 Staff Timetables · 📈 Analytics\n👤 Approvals · 💬 Chat · ⚙️ Settings\n\nType your question or tap a topic below!`,
  staff: `👋 **Hello! I'm Mediventra Assistant.**\n\nI can help with:\n📆 My Schedule · 🏥 Rooms & OT Status · 💬 Chat\n⚙️ Settings · 📞 Contact Info\n\nType your question or tap a topic below!`,
  support_staff: `👋 **Hello! I'm Mediventra Assistant.**\n\nI can help with:\n🧹 Your Task Checklist · 📆 Duty Schedule\n💬 Chat with the team · ⚙️ Settings\n\nType your question or tap a topic below!`,
};

export default function SupportBot({ themeColor, user }) {
  const group = roleGroup(user?.role);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { id:0, from:'bot', text: WELCOME_BY_GROUP[group] || WELCOME_BY_GROUP.patient, ts:new Date() }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const color = themeColor || '#2563eb';
  const quickTopics = QUICK_TOPICS.filter(t => t.roles.includes('all') || t.roles.includes(group));

  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 3000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (open) { setUnread(0); setShowBubble(false); setTimeout(() => inputRef.current?.focus(), 200); } }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs, typing]);

  const addMsg = (from, text) => setMsgs(m => [...m, { id:Date.now()+Math.random(), from, text, ts:new Date() }]);

  const handleSend = (q = input.trim()) => {
    if (!q) return;
    addMsg('user', q);
    setInput('');
    setTyping(true);
    const delay = 500 + Math.random()*700;
    setTimeout(() => {
      setTyping(false);
      const ans = getAnswer(q, group);
      addMsg('bot', ans || `I don't have specific info on that. Here's what I can help with for your account:\n\n${quickTopics.map(t=>t.label).join(' | ')}\n\nFor complex queries: **support@mediventra.com** or **+1-800-MEDIVEN**`);
      if (!open) setUnread(u => u+1);
    }, delay);
  };

  const fmt = d => new Date(d).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'});

  return (
    <div style={{ position:'fixed', bottom:28, right:28, zIndex:99999, fontFamily:"'Outfit',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        @keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}
        @keyframes pulse3{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
        .sb-quick:hover{background:${color}!important;color:#fff!important;}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.1);border-radius:4px}
      `}</style>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0,scale:.92,y:12 }} animate={{ opacity:1,scale:1,y:0 }} exit={{ opacity:0,scale:.92,y:12 }}
            style={{ position:'absolute',bottom:72,right:0,width:370,height:560,background:'#fff',borderRadius:24,boxShadow:'0 32px 80px rgba(0,0,0,.22)',display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid #e8edf3' }}>

            {/* Header */}
            <div style={{ background:`linear-gradient(135deg,${color},#0ea5e9)`,padding:'14px 16px',flexShrink:0 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ duration:2,repeat:Infinity,repeatDelay:4 }}
                    style={{ width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>🤖</motion.div>
                  <div>
                    <div style={{ color:'#fff',fontWeight:800,fontSize:14 }}>Mediventra Assistant</div>
                    <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                      <motion.div animate={{ scale:[1,1.5,1] }} transition={{ duration:1.5,repeat:Infinity }}
                        style={{ width:6,height:6,borderRadius:'50%',background:'#4ade80' }} />
                      <span style={{ color:'rgba(255,255,255,.8)',fontSize:10.5 }}>Always online · Instant answers</span>
                    </div>
                  </div>
                </div>
                <button onClick={()=>setOpen(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',color:'#fff',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex:1,overflowY:'auto',padding:'12px 13px 6px',display:'flex',flexDirection:'column',gap:8,background:'#f8fafc' }}>
              {msgs.map(m => (
                <motion.div key={m.id} initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }}
                  style={{ display:'flex',gap:7,alignItems:'flex-end',flexDirection:m.from==='user'?'row-reverse':'row' }}>
                  {m.from==='bot' && (
                    <div style={{ width:26,height:26,borderRadius:'50%',background:`linear-gradient(135deg,${color},#0ea5e9)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0 }}>🤖</div>
                  )}
                  <div style={{ maxWidth:'82%' }}>
                    <div style={{
                      padding:'9px 12px',
                      borderRadius:m.from==='user'?'16px 4px 16px 16px':'4px 16px 16px 16px',
                      background:m.from==='user'?`linear-gradient(135deg,${color},${color}cc)`:'#fff',
                      color:m.from==='user'?'#fff':'#0f172a',
                      fontSize:13,lineHeight:1.55,
                      boxShadow:m.from==='user'?`0 4px 12px ${color}30`:'0 2px 8px rgba(0,0,0,.06)',
                      border:m.from==='bot'?'1px solid #e8edf3':'none'
                    }} dangerouslySetInnerHTML={{ __html:renderMd(m.text) }} />
                    <div style={{ fontSize:9.5,color:'#cbd5e1',marginTop:3,textAlign:m.from==='user'?'right':'left' }}>{fmt(m.ts)}</div>
                  </div>
                </motion.div>
              ))}

              {typing && (
                <div style={{ display:'flex',alignItems:'flex-end',gap:7 }}>
                  <div style={{ width:26,height:26,borderRadius:'50%',background:`linear-gradient(135deg,${color},#0ea5e9)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12 }}>🤖</div>
                  <div style={{ padding:'10px 14px',background:'#fff',borderRadius:'4px 16px 16px 16px',border:'1px solid #e8edf3',boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
                    {[0,1,2].map(i=><span key={i} style={{ display:'inline-block',width:6,height:6,borderRadius:'50%',background:'#94a3b8',margin:'0 2px',animation:`blink 1.2s ${i*.2}s ease-in-out infinite` }}/>)}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Quick topics */}
            <div style={{ padding:'8px 10px 4px',borderTop:'1px solid #f1f5f9',background:'#fff',flexShrink:0 }}>
              <div style={{ fontSize:9.5,color:'#cbd5e1',fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:6 }}>Quick Topics</div>
              <div style={{ display:'flex',gap:4,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none' }}>
                {quickTopics.map(t => (
                  <button key={t.q} className="sb-quick" onClick={() => handleSend(t.q)}
                    style={{ flexShrink:0,padding:'4px 9px',borderRadius:20,border:`1px solid ${color}25`,background:`${color}08`,color:color,fontSize:10.5,fontWeight:700,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',transition:'all .15s' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div style={{ padding:'8px 10px 12px',background:'#fff',display:'flex',gap:7,flexShrink:0 }}>
              <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}
                placeholder="Ask anything about Mediventra…"
                style={{ flex:1,padding:'10px 13px',border:'1.5px solid #e2e8f0',borderRadius:12,fontSize:13,fontFamily:'inherit',outline:'none',transition:'border-color .2s' }}
                onFocus={e=>e.target.style.borderColor=color}
                onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              <button onClick={()=>handleSend()}
                style={{ width:40,height:40,borderRadius:11,border:'none',background:input.trim()?`linear-gradient(135deg,${color},#0ea5e9)`:'#e2e8f0',color:input.trim()?'#fff':'#94a3b8',cursor:input.trim()?'pointer':'not-allowed',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',flexShrink:0 }}>↑</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip bubble */}
      <AnimatePresence>
        {showBubble && !open && (
          <motion.div initial={{ opacity:0,x:8 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:8 }}
            style={{ position:'absolute',bottom:14,right:70,background:'#fff',borderRadius:16,padding:'8px 14px',boxShadow:'0 8px 24px rgba(0,0,0,.15)',fontSize:12,color:'#374151',fontWeight:600,whiteSpace:'nowrap',border:'1px solid #e8edf3',cursor:'pointer' }}
            onClick={()=>setOpen(true)}>
            💬 Need help? Ask me anything!
            <div style={{ position:'absolute',right:-6,top:'50%',transform:'translateY(-50%)',width:0,height:0,borderTop:'6px solid transparent',borderBottom:'6px solid transparent',borderLeft:'6px solid #fff' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button onClick={()=>setOpen(o=>!o)}
        animate={open?{}:{ scale:[1,1.06,1] }}
        transition={{ repeat:Infinity,duration:2.5,ease:'easeInOut' }}
        style={{ width:58,height:58,borderRadius:'50%',background:`linear-gradient(135deg,${color},#0ea5e9)`,border:'3px solid rgba(255,255,255,.9)',cursor:'pointer',fontSize:24,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 8px 28px ${color}55`,position:'relative' }}>
        <AnimatePresence mode="wait">
          <motion.span key={open?'x':'bot'} initial={{ rotate:-90,opacity:0 }} animate={{ rotate:0,opacity:1 }} exit={{ rotate:90,opacity:0 }} transition={{ duration:.2 }}>
            {open?'✕':'🤖'}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Unread badge */}
      <AnimatePresence>
        {!open && unread > 0 && (
          <motion.div initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}
            style={{ position:'absolute',top:0,right:0,width:20,height:20,borderRadius:'50%',background:'#ef4444',border:'2.5px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:900 }}>
            {unread}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
