import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DIET_TYPES = ['Regular','Soft','Liquid','Low Salt','Low Fat','Diabetic','High Protein','High Calorie','Renal','Vegetarian','Vegan','Gluten-Free'];

const DEFAULT_MEALS = {
  Regular:       { Breakfast:'Idli (3 pcs), Sambar, Coconut Chutney, 1 Glass Milk', 'Morning Snack':'1 Banana or Seasonal Fruit', Lunch:'Rice, Dal, Mix Vegetable Sabzi, Curd, Salad (Cucumber+Tomato)', 'Evening Snack':'Tea, Marie Biscuits (4)', Dinner:'3 Chapati, Paneer/Chicken Sabzi, Dal, Green Salad' },
  Diabetic:      { Breakfast:'Oats Porridge (no sugar), 2 Egg Whites, 1 Cup Green Tea', 'Morning Snack':'Cucumber & Carrot Slices, Buttermilk', Lunch:'Brown Rice (small portion), Grilled Fish/Chicken, Green Salad, Dal', 'Evening Snack':'Handful Mixed Nuts (Almonds, Walnuts)', Dinner:'2 Multigrain Chapati, Methi Sabzi, Moong Dal, Salad' },
  'Low Salt':    { Breakfast:'Oats Upma (no salt), 1 Banana, 200ml Low-fat Milk', 'Morning Snack':'Fresh Apple', Lunch:'Plain Steamed Rice, Boiled Dal (no salt), Boiled Gourd Sabzi, Curd', 'Evening Snack':'Coconut Water (natural)', Dinner:'3 Chapati, Boiled Vegetables, Unsalted Moong Dal' },
  'High Protein':{ Breakfast:'4 Egg Omelette, 2 Brown Bread Slices, 1 Glass Full-cream Milk', 'Morning Snack':'Protein Shake + 1 Banana', Lunch:'Rice, Chicken Curry (200g), Rajma Dal, Curd, Salad', 'Evening Snack':'Boiled Eggs (2), 1 Glass Milk + Badam', Dinner:'3 Chapati, Paneer Bhurji (150g), Chicken, Green Vegetables' },
  'High Calorie':{ Breakfast:'Poha with Peanuts, Bread Butter (2 slices), 1 Glass Whole Milk + 2 tbsp Ghee', 'Morning Snack':'Banana Milkshake, 4 Dates', Lunch:'Biryani (Rice+Chicken), Raita, Salad, Papad, Pickle', 'Evening Snack':'Samosa/Pakoda (2), Lassi', Dinner:'4 Chapati with Ghee, Dal Makhani, Paneer, Kheer (1 bowl)' },
  Soft:          { Breakfast:'Semolina Porridge, Mashed Banana, 1 Cup Warm Milk', 'Morning Snack':'Mashed Apple/Pear', Lunch:'Well-cooked Khichdi, Curd, Mashed Dal', 'Evening Snack':'Warm Milk, Soft Biscuit', Dinner:'Soft Khichdi, Mashed Vegetables, Plain Curd' },
  Liquid:        { Breakfast:'Warm Milk (200ml), Fruit Juice (Apple/Orange – no pulp)', 'Morning Snack':'Coconut Water / Butter Milk', Lunch:'Clear Vegetable Soup, Rice Gruel (Kanji)', 'Evening Snack':'Warm Dal Water, Glucose Water', Dinner:'Chicken/Vegetable Broth, Warm Milk' },
  Renal:         { Breakfast:'White Rice Puffs, Apple Juice, 1 Cup Low-potassium Tea', 'Morning Snack':'White Bread (toasted), Jam', Lunch:'White Rice, Cauliflower Sabzi (boiled, drained), Arbi, Boiled Egg White', 'Evening Snack':'Low-potassium Crackers, Lemonade (no salt)', Dinner:'3 White Chapati, Cabbage Sabzi (boiled), Egg White' },
};

const STORAGE_KEY = 'hms_dietplans';
function loadPlans() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } }
function savePlans(p) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {} }

// Helper to build empty meal plan for custom / unknown diet type
function emptyMeals() {
  return { Breakfast:'', 'Morning Snack':'', Lunch:'', 'Evening Snack':'', Dinner:'' };
}

function getMealsForType(type) {
  return DEFAULT_MEALS[type] ? { ...DEFAULT_MEALS[type] } : emptyMeals();
}

export default function DietNutritionPage() {
  const { user } = useAuth();
  const isAdmin   = ['admin','nurse','doctor'].includes(user?.role);
  const isPatient = user?.role === 'patient';

  const [plans,     setPlans]     = useState([]);
  const [patients,  setPatients]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editPlan,  setEditPlan]  = useState(null);  // existing plan being edited
  const [viewPlan,  setViewPlan]  = useState(null);
  const [form, setForm] = useState({
    patient:'', dietType:'Regular',
    allergies:'', conditions:'', notes:'',
    startDate: new Date().toISOString().split('T')[0],
    duration:'7 days',
    meals: getMealsForType('Regular'),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setPlans(loadPlans());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setEditPlan(null);
    setForm({ patient:'', dietType:'Regular', allergies:'', conditions:'', notes:'', startDate: new Date().toISOString().split('T')[0], duration:'7 days', meals: getMealsForType('Regular') });
    setShowModal(true);
    try {
      const res = await usersAPI.getAll({ role:'patient', status:'approved', limit:200 });
      const list = res?.data?.data || [];
      setPatients(list);
      setForm(f => ({ ...f, patient: list[0]?._id || '' }));
    } catch { toast.error('Could not load patients'); }
  };

  const openEdit = (plan) => {
    setEditPlan(plan);
    setForm({
      patient:    plan.patientId || '',
      dietType:   plan.dietType,
      allergies:  plan.allergies  || '',
      conditions: plan.conditions || '',
      notes:      plan.notes      || '',
      startDate:  plan.startDate,
      duration:   plan.duration,
      meals:      plan.meals ? { ...plan.meals } : getMealsForType(plan.dietType),
    });
    setShowModal(true);
  };

  const handleDietTypeChange = (type) => {
    setForm(f => ({
      ...f,
      dietType: type,
      // Pre-fill with defaults but keep any changes the user already made
      meals: getMealsForType(type),
    }));
  };

  const savePlan = (e) => {
    e.preventDefault();
    if (!form.patient && !editPlan) { toast.error('Select a patient'); return; }

    const patObj = patients.find(p => p._id === form.patient);
    const existing = loadPlans();

    if (editPlan) {
      // Editing existing plan
      const updated = existing.map(p => p.id === editPlan.id
        ? { ...p, dietType:form.dietType, allergies:form.allergies, conditions:form.conditions, notes:form.notes, startDate:form.startDate, duration:form.duration, meals:form.meals, editedBy:user?.name, editedAt:new Date().toISOString() }
        : p
      );
      savePlans(updated);
      setPlans(updated);
      toast.success('✅ Diet plan updated!');
    } else {
      const plan = {
        id:          String(Date.now()),
        patientId:   form.patient,
        patientName: patObj?.name || '',
        doctorName:  user?.name,
        dietType:    form.dietType,
        allergies:   form.allergies,
        conditions:  form.conditions,
        notes:       form.notes,
        startDate:   form.startDate,
        duration:    form.duration,
        meals:       form.meals,
        createdAt:   new Date().toISOString(),
      };
      const updated = [plan, ...existing];
      savePlans(updated);
      setPlans(updated);
      toast.success(`✅ Diet plan assigned to ${patObj?.name}`);
    }
    setShowModal(false);
  };

  const deletePlan = (id) => {
    if (!window.confirm('Delete this diet plan?')) return;
    const updated = loadPlans().filter(p => p.id !== id);
    savePlans(updated);
    setPlans(updated);
    if (viewPlan?.id === id) setViewPlan(null);
    toast.success('Deleted');
  };

  const myPlans = isPatient ? plans.filter(p => p.patientId === (user?._id||user?.id)) : plans;

  const DIET_COLORS = {
    Regular:'#059669', Diabetic:'#0891b2', 'Low Salt':'#6366f1', 'High Protein':'#ef4444',
    'High Calorie':'#d97706', Soft:'#8b5cf6', Liquid:'#0ea5e9', Renal:'#f59e0b',
    Vegetarian:'#22c55e', Vegan:'#10b981', 'Gluten-Free':'#ec4899', 'Low Fat':'#14b8a6',
  };
  const dc = (type) => DIET_COLORS[type] || '#64748b';

  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #e2e8f0', borderRadius:9, fontSize:13.5, outline:'none', fontFamily:'inherit', background:'#fff' };
  const lbl = { display:'block', fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:.4 };

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:'#0f172a' }}>🥗 Diet &amp; Nutrition</div>
          <div style={{ fontSize:13, color:'#94a3b8', marginTop:3 }}>
            {isPatient ? 'Your personalised meal plan' : 'Assign & edit patient diet plans with full meal customisation'}
          </div>
        </div>
        {isAdmin && (
          <button onClick={openCreate}
            style={{ padding:'10px 22px', background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:11, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Assign Diet Plan
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div>
      ) : myPlans.length === 0 ? (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:'52px', textAlign:'center' }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🥗</div>
          <div style={{ fontWeight:700, fontSize:16, color:'#0f172a', marginBottom:6 }}>No diet plans yet</div>
          {isAdmin && <button onClick={openCreate} style={{ marginTop:8, padding:'9px 20px', background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Create First Plan</button>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
          {myPlans.map(plan => (
            <motion.div key={plan.id} whileHover={{ y:-2 }}
              style={{ background:'#fff', border:`2px solid ${dc(plan.dietType)}20`, borderRadius:16, padding:'18px', cursor:'pointer', borderTop:`4px solid ${dc(plan.dietType)}` }}
              onClick={() => setViewPlan(plan)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:`${dc(plan.dietType)}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🥗</div>
                <span style={{ padding:'4px 10px', background:`${dc(plan.dietType)}15`, color:dc(plan.dietType), borderRadius:9, fontSize:11.5, fontWeight:700 }}>{plan.dietType}</span>
              </div>
              <div style={{ fontWeight:800, fontSize:15, color:'#0f172a', marginBottom:3 }}>{plan.patientName}</div>
              <div style={{ fontSize:12.5, color:'#64748b', marginBottom:4 }}>
                {new Date(plan.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} · {plan.duration}
              </div>
              {plan.allergies && <div style={{ fontSize:12, color:'#dc2626', marginBottom:4 }}>⚠️ Allergies: {plan.allergies}</div>}
              <div style={{ fontSize:12, color:'#94a3b8', marginBottom:10 }}>By Dr. {plan.doctorName}{plan.editedBy?` · Edited by ${plan.editedBy}`:''}</div>
              {isAdmin && (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={e=>{e.stopPropagation();openEdit(plan);}}
                    style={{ flex:1, padding:'6px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, color:'#1d4ed8', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    ✏️ Edit Plan
                  </button>
                  <button onClick={e=>{e.stopPropagation();deletePlan(plan.id);}}
                    style={{ flex:1, padding:'6px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, color:'#dc2626', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    🗑 Delete
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto' }}
            onClick={e=>{if(e.target===e.currentTarget)setShowModal(false);}}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:700, maxHeight:'94vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid #f1f5f9', position:'sticky', top:0, background:'#fff', zIndex:5, borderRadius:'20px 20px 0 0' }}>
                <div style={{ fontWeight:900, fontSize:17, color:'#0f172a' }}>{editPlan?'✏️ Edit Diet Plan':'🥗 Assign Diet Plan'}</div>
                <button onClick={()=>setShowModal(false)} style={{ width:32, height:32, borderRadius:'50%', border:'1.5px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:15, color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>✕</button>
              </div>
              <form onSubmit={savePlan}>
                <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:16 }}>

                  {/* Patient (only for new plans) */}
                  {!editPlan && (
                    <div>
                      <label style={lbl}>Patient *</label>
                      <select value={form.patient} onChange={e=>setForm(f=>({...f,patient:e.target.value}))} style={inp} required>
                        <option value="">— Select patient —</option>
                        {patients.map(p=><option key={p._id} value={p._id}>{p.name} {p.age?`(${p.age}y)`:''}</option>)}
                      </select>
                    </div>
                  )}
                  {editPlan && (
                    <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#1e40af', fontWeight:600 }}>
                      📋 Editing plan for: {editPlan.patientName}
                    </div>
                  )}

                  {/* Diet type + dates */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lbl}>Diet Type *</label>
                      <select value={form.dietType} onChange={e=>handleDietTypeChange(e.target.value)} style={inp}>
                        {DIET_TYPES.map(d=><option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Start Date</label>
                      <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={inp}/>
                    </div>
                    <div>
                      <label style={lbl}>Duration</label>
                      <select value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} style={inp}>
                        {['3 days','5 days','7 days','10 days','14 days','1 month','Ongoing'].map(d=><option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Meal plan — FULLY EDITABLE */}
                  <div>
                    <div style={{ fontWeight:800, fontSize:13.5, color:'#0f172a', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:22, height:22, borderRadius:7, background:'#059669', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900 }}>🥗</span>
                      Meal Plan <span style={{ fontSize:11.5, color:'#94a3b8', fontWeight:500 }}>— Pre-filled from {form.dietType} template, edit as needed</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {Object.entries(form.meals).map(([meal, value]) => (
                        <div key={meal}>
                          <label style={{ ...lbl, color:'#059669', marginBottom:4 }}>{meal}</label>
                          <textarea
                            value={value}
                            onChange={e => setForm(f=>({ ...f, meals:{ ...f.meals, [meal]:e.target.value } }))}
                            rows={2}
                            placeholder={`Enter ${meal} meal items…`}
                            style={{ ...inp, resize:'vertical', lineHeight:1.5 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Allergies / conditions / notes */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <label style={lbl}>Food Allergies / Restrictions</label>
                      <input value={form.allergies} onChange={e=>setForm(f=>({...f,allergies:e.target.value}))} placeholder="e.g. Nuts, Shellfish, Dairy" style={inp}/>
                    </div>
                    <div>
                      <label style={lbl}>Medical Conditions</label>
                      <input value={form.conditions} onChange={e=>setForm(f=>({...f,conditions:e.target.value}))} placeholder="e.g. Diabetes, CKD, HTN" style={inp}/>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Additional Instructions</label>
                    <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
                      placeholder="Special instructions for dietary team, kitchen staff…"
                      style={{ ...inp, resize:'vertical' }}/>
                  </div>
                </div>

                <div style={{ display:'flex', gap:10, justifyContent:'flex-end', padding:'14px 24px', borderTop:'1px solid #f1f5f9', position:'sticky', bottom:0, background:'#fff', borderRadius:'0 0 20px 20px' }}>
                  <button type="button" onClick={()=>setShowModal(false)} style={{ padding:'10px 20px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:9, fontWeight:600, cursor:'pointer', color:'#475569', fontFamily:'inherit' }}>Cancel</button>
                  <button type="submit" style={{ padding:'10px 22px', background:'linear-gradient(135deg,#059669,#047857)', border:'none', borderRadius:9, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {editPlan?'💾 Save Changes':'✅ Assign Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VIEW PLAN MODAL ── */}
      <AnimatePresence>
        {viewPlan && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
            onClick={()=>setViewPlan(null)}>
            <motion.div initial={{ scale:.96 }} animate={{ scale:1 }} exit={{ scale:.96 }} onClick={e=>e.stopPropagation()}
              style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:600, maxHeight:'92vh', overflowY:'auto', padding:'26px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:18 }}>
                <div>
                  <h3 style={{ margin:0, fontWeight:900, fontSize:18, color:'#0f172a' }}>{viewPlan.patientName}'s Diet Plan</h3>
                  <div style={{ fontSize:12.5, color:'#94a3b8', marginTop:3 }}>{viewPlan.dietType} · {viewPlan.duration} · Dr. {viewPlan.doctorName}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {isAdmin && <button onClick={()=>{setViewPlan(null);openEdit(viewPlan);}} style={{ padding:'6px 12px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, color:'#1d4ed8', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✏️ Edit</button>}
                  <button onClick={()=>setViewPlan(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' }}>✕</button>
                </div>
              </div>
              {viewPlan.allergies && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#dc2626', fontWeight:600 }}>⚠️ Allergies: {viewPlan.allergies}</div>}
              {viewPlan.conditions && <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#92400e', fontWeight:600 }}>🏥 Conditions: {viewPlan.conditions}</div>}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:14, color:'#0f172a', marginBottom:12 }}>📅 Daily Meal Schedule</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {Object.entries(viewPlan.meals || {}).map(([meal, items]) => (
                    <div key={meal} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 14px', background:'#f8fafc', borderRadius:11, border:'1px solid #e2e8f0' }}>
                      <div style={{ fontWeight:700, fontSize:12.5, color:'#059669', minWidth:130, flexShrink:0 }}>{meal}</div>
                      <div style={{ fontSize:13, color:'#64748b', lineHeight:1.5 }}>{items || <span style={{ color:'#94a3b8', fontStyle:'italic' }}>Not specified</span>}</div>
                    </div>
                  ))}
                </div>
              </div>
              {viewPlan.notes && <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 14px', fontSize:13, color:'#15803d' }}><strong>Notes:</strong> {viewPlan.notes}</div>}
              <div style={{ marginTop:12, fontSize:11.5, color:'#94a3b8', textAlign:'right' }}>
                Created {new Date(viewPlan.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                {viewPlan.editedAt && ` · Edited ${new Date(viewPlan.editedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
