import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { publicAPI, getFileUrl } from '../utils/api';

const NAV_LINKS = [
  { id: 'top', label: 'Home' },
  { id: 'about', label: 'About Us' },
  { id: 'services', label: 'Services' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'tips', label: 'Health Tips' },
  { id: 'contact', label: 'Contact Us' },
];

const SERVICES = [
  { icon: '🩺', title: 'Specialist Clinics', desc: 'Consult experienced specialists across cardiology, pediatrics, orthopedics and more.' },
  { icon: '🛏️', title: 'Inpatient Care', desc: 'Comfortable wards and private rooms with round-the-clock nursing care.' },
  { icon: '🚑', title: '24-Hour Emergency', desc: 'A fully staffed emergency department ready for you, day or night.' },
  { icon: '🩻', title: 'Radiology & Imaging', desc: 'X-ray, ultrasound and CT diagnostics read by experienced radiologists.' },
  { icon: '🔬', title: 'Laboratory Services', desc: 'Fast, accurate pathology and diagnostic testing on site.' },
  { icon: '💊', title: 'Pharmacy', desc: 'An in-house pharmacy stocked with the medicines your treatment needs.' },
];

const FACILITIES = [
  { icon: '❤️‍🩹', title: 'ICU', desc: 'Critical care with continuous monitoring' },
  { icon: '🛌', title: 'VIP Rooms', desc: 'Private rooms for a comfortable stay' },
  { icon: '⚕️', title: 'Operation Theatres', desc: 'Modern OTs for surgical procedures' },
  { icon: '🧪', title: 'Laboratory', desc: 'On-site diagnostics and testing' },
  { icon: '🚑', title: 'Ambulance Service', desc: 'Rapid response, 24 hours a day' },
];

const HEALTH_TIPS = [
  { tag: 'Heart Health', icon: '❤️', title: 'Simple Habits for a Healthier Heart', excerpt: 'Small, consistent changes — regular movement, less salt, better sleep — add up to real cardiovascular benefits over time.' },
  { tag: 'Child Care', icon: '🧒', title: 'Why On-Time Immunization Matters', excerpt: "Keeping to the recommended vaccine schedule is one of the most effective ways to protect a child's long-term health." },
  { tag: 'Nutrition', icon: '🥗', title: 'Building a Balanced Plate', excerpt: 'A mix of whole grains, lean protein and vegetables at each meal supports steady energy and long-term wellness.' },
  { tag: 'Elder Care', icon: '👵', title: 'Supporting Healthy Aging', excerpt: 'Regular check-ups, gentle activity and social connection all play a meaningful role in aging well.' },
];

function useScrollTo() {
  return (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

function Initials({ name, size = 64 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// Original flat-illustration hero scene — a clinician caring for a patient
// — built as inline SVG rather than a stock photo.
function HeroIllustration() {
  return (
    <svg viewBox="0 0 520 480" style={{ width: '100%', height: 'auto', maxWidth: 480 }}>
      <defs>
        <linearGradient id="blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#eff6ff" />
        </linearGradient>
        <linearGradient id="coat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eef2f7" />
        </linearGradient>
      </defs>
      <path fill="url(#blob)" d="M260 20c110 0 220 60 230 170 9 100-70 190-190 220-110 28-230-10-270-110C-9 210 40 100 140 50 175 32 215 20 260 20Z" />

      <rect x="70" y="330" width="330" height="26" rx="10" fill="#bfdbfe" />
      <rect x="90" y="300" width="290" height="46" rx="16" fill="#eaf2ff" stroke="#c7ddfd" strokeWidth="2" />
      <rect x="100" y="270" width="80" height="46" rx="14" fill="#ffffff" stroke="#c7ddfd" strokeWidth="2" />

      <circle cx="150" cy="255" r="30" fill="#ffd8b0" />
      <path d="M122 246c2-18 16-30 30-30s26 12 28 28c-8-6-18-9-29-9-10 0-20 4-29 11Z" fill="#5b3a29" />
      <rect x="118" y="278" width="66" height="46" rx="18" fill="#93c5fd" />
      <circle cx="139" cy="252" r="3.2" fill="#33261f" />
      <circle cx="163" cy="252" r="3.2" fill="#33261f" />
      <path d="M140 263c5 5 15 5 20 0" stroke="#33261f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="205" cy="300" r="16" fill="#d9a066" />
      <circle cx="193" cy="288" r="6" fill="#d9a066" />
      <circle cx="217" cy="288" r="6" fill="#d9a066" />
      <circle cx="199" cy="299" r="2" fill="#5b3a29" />
      <circle cx="211" cy="299" r="2" fill="#5b3a29" />

      <g transform="translate(268,150)">
        <circle cx="60" cy="34" r="28" fill="#ffd8b0" />
        <path d="M32 30c1-18 14-30 28-30s26 11 28 27c-9-7-18-10-28-10-11 0-21 4-28 13Z" fill="#241a14" />
        <rect x="18" y="60" width="84" height="150" rx="26" fill="url(#coat)" stroke="#dbe4ee" strokeWidth="2" />
        <rect x="46" y="60" width="28" height="150" fill="#eef4fb" />
        <circle cx="60" cy="90" r="4" fill="#c9d6e4" />
        <circle cx="60" cy="112" r="4" fill="#c9d6e4" />
        <path d="M20 78c-16 6-22 20-20 36 2 14 12 22 24 22" stroke="#94a9c2" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="24" cy="138" r="7" fill="#94a9c2" />
        <path d="M100 78c16 6 22 20 20 36" stroke="#94a9c2" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="54" cy="52" r="3" fill="#33261f" />
        <circle cx="66" cy="52" r="3" fill="#33261f" />
        <path d="M52 62c4 4 12 4 16 0" stroke="#33261f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>

      <g opacity="0.9">
        <rect x="420" y="60" width="14" height="42" rx="4" fill="#2563eb" />
        <rect x="406" y="74" width="42" height="14" rx="4" fill="#2563eb" />
      </g>
      <path d="M40 90h20l8-20 12 40 10-24 6 12h20" stroke="#0ea5e9" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx="440" cy="220" r="7" fill="#93c5fd" />
      <circle cx="60" cy="180" r="5" fill="#93c5fd" />
    </svg>
  );
}

function HospitalIllustration() {
  return (
    <svg viewBox="0 0 480 360" style={{ width: '100%', height: 'auto' }}>
      <rect x="40" y="140" width="400" height="180" rx="14" fill="#eaf2ff" stroke="#cfe0fb" strokeWidth="2" />
      <rect x="60" y="60" width="180" height="260" rx="14" fill="#ffffff" stroke="#cfe0fb" strokeWidth="2" />
      {Array.from({ length: 4 }).map((_, row) => (
        Array.from({ length: 3 }).map((_, col) => (
          <rect key={`${row}-${col}`} x={82 + col * 52} y={84 + row * 52} width="34" height="34" rx="4" fill="#bfdbfe" />
        ))
      ))}
      <rect x="150" y="264" width="40" height="56" rx="4" fill="#2563eb" />
      <g transform="translate(255,40)">
        <rect x="0" y="0" width="14" height="42" rx="4" fill="#2563eb" />
        <rect x="-14" y="14" width="42" height="14" rx="4" fill="#2563eb" />
      </g>
      <rect x="260" y="180" width="150" height="140" rx="10" fill="#dbeafe" />
      {Array.from({ length: 3 }).map((_, row) => (
        Array.from({ length: 3 }).map((_, col) => (
          <rect key={`b${row}-${col}`} x={276 + col * 46} y={198 + row * 40} width="30" height="26" rx="4" fill="#ffffff" />
        ))
      ))}
      <rect x="0" y="320" width="480" height="10" fill="#cfe0fb" />
      <rect x="20" y="300" width="70" height="24" rx="6" fill="#fff" stroke="#cfe0fb" />
      <circle cx="35" cy="312" r="6" fill="#ef4444" />
      <rect x="46" y="309" width="30" height="6" rx="2" fill="#94a3b8" />
    </svg>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const scrollTo = useScrollTo();
  const [stats, setStats] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [info, setInfo] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const carouselRef = useRef(null);

  useEffect(() => {
    publicAPI.getStats().then(r => setStats(r.data.data)).catch(() => {});
    publicAPI.getDoctors().then(r => setDoctors(r.data.data || [])).catch(() => {});
    publicAPI.getHospitalInfo().then(r => setInfo(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollCarousel = (dir) => {
    if (carouselRef.current) carouselRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  const hospitalName = info?.hospitalName || 'Mediventra';

  const statCards = [
    { icon: '👨‍⚕️', value: stats ? `${stats.doctorCount}+` : '—', label: 'Specialist Doctors' },
    { icon: '🧑‍🤝‍🧑', value: stats ? `${stats.patientCount}+` : '—', label: 'Patients Served' },
    { icon: '🛏️', value: stats ? `${stats.roomCount}+` : '—', label: 'Patient Rooms' },
    ...(stats?.satisfactionPct != null ? [{ icon: '⭐', value: `${stats.satisfactionPct}%`, label: 'Patient Satisfaction' }] : []),
  ];

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", color: '#0f172a', background: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap');
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .lp-h1, .lp-h2, .lp-h3, .lp-logo { font-family:'Sora',system-ui,sans-serif; }
        .lp-navlink { position:relative; }
        .lp-navlink::after { content:''; position:absolute; left:0; right:0; bottom:-4px; height:2px; background:#2563eb; transform:scaleX(0); transition:transform .2s; }
        .lp-navlink:hover::after { transform:scaleX(1); }
        .lp-card { transition: transform .2s ease, box-shadow .2s ease; }
        .lp-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(15,23,42,.08); }
        .lp-carousel::-webkit-scrollbar { display:none; }
        @media (max-width: 900px) {
          .lp-hero-grid { grid-template-columns: 1fr !important; }
          .lp-hero-illustration { order: -1; max-width: 320px !important; margin: 0 auto; }
          .lp-about-grid { grid-template-columns: 1fr !important; }
          .lp-nav-links { display: none !important; }
          .lp-signin-link { display: none !important; }
        }
      `}</style>

      <header id="top" style={{
        position: 'sticky', top: 0, zIndex: 50, background: scrolled ? 'rgba(255,255,255,.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none', borderBottom: scrolled ? '1px solid #eef2f7' : '1px solid transparent',
        transition: 'all .25s',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="lp-logo" style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 17, cursor: 'pointer' }} onClick={() => scrollTo('top')}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 17 }}>✚</span>
            <span>{hospitalName}</span>
          </div>
          <nav className="lp-nav-links" style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
            {NAV_LINKS.map(l => (
              <span key={l.id} className="lp-navlink" onClick={() => scrollTo(l.id)} style={{ fontSize: 13.5, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>{l.label}</span>
            ))}
          </nav>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="lp-signin-link" onClick={() => navigate('/login')} style={{ fontSize: 13.5, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>Sign In</span>
            <button onClick={() => navigate('/register')} style={{ padding: '10px 20px', borderRadius: 30, border: 'none', background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 16px rgba(37,99,235,.3)' }}>
              Book Online
            </button>
          </div>
        </div>
      </header>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '48px 24px 0' }}>
        <div className="lp-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 40, alignItems: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#eff6ff', color: '#2563eb', padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, marginBottom: 18 }}>
              ❤️ Your Health, Our Priority
            </div>
            <h1 className="lp-h1" style={{ fontSize: 44, lineHeight: 1.12, fontWeight: 800, margin: '0 0 18px', letterSpacing: '-0.02em' }}>
              Exceptional Care for <span style={{ color: '#2563eb' }}>You and Your Family</span>
            </h1>
            <p style={{ fontSize: 15.5, color: '#64748b', lineHeight: 1.7, maxWidth: 480, marginBottom: 28 }}>
              {hospitalName} brings together experienced specialists, round-the-clock emergency support and modern facilities — all in one place, so you can focus on getting better.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/register')} style={{ padding: '13px 26px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 24px rgba(37,99,235,.32)' }}>
                Book an Appointment →
              </button>
              <button onClick={() => scrollTo('services')} style={{ padding: '13px 26px', borderRadius: 14, border: '1.5px solid #dbe4ee', background: '#fff', color: '#1e293b', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Explore Services
              </button>
            </div>
          </motion.div>

          <motion.div className="lp-hero-illustration" initial={{ opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .6, delay: .1 }}>
            <HeroIllustration />
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .5 }}
          style={{ marginTop: 36, marginBottom: 8, background: '#fff', border: '1px solid #eef2f7', borderRadius: 20, boxShadow: '0 20px 44px rgba(15,23,42,.06)', padding: '22px 28px', display: 'grid', gridTemplateColumns: `repeat(${statCards.length},1fr)`, gap: 16 }}>
          {statCards.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', borderRight: i < statCards.length - 1 ? '1px solid #f1f5f9' : 'none', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 19 }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      <section id="about" style={{ maxWidth: 1180, margin: '0 auto', padding: '96px 24px 20px' }}>
        <div className="lp-about-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 50, alignItems: 'center' }}>
          <HospitalIllustration />
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#eff6ff', color: '#2563eb', padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 14 }}>🏥 About Us</div>
            <h2 className="lp-h2" style={{ fontSize: 30, fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.01em' }}>
              {hospitalName} — Built Around <span style={{ color: '#2563eb' }}>Your Wellbeing</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: 14.5, lineHeight: 1.75, marginBottom: 26 }}>
              We're committed to professional, compassionate healthcare — combining experienced medical teams, modern equipment and a genuinely comfortable environment for every patient who walks through our doors.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {[['🕐', '24-Hour Care', 'Emergency & inpatient support around the clock'], ['👨‍⚕️', 'Expert Medical Staff', 'Experienced, credentialed specialists'], ['🏗️', 'Modern Facilities', 'Up-to-date equipment and clean, comfortable wards'], ['🤝', 'Patient-First Approach', 'Every decision centers on your comfort and outcome']].map(([icon, t, d]) => (
                <div key={t} style={{ display: 'flex', gap: 11 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="services" style={{ maxWidth: 1180, margin: '0 auto', padding: '96px 24px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 34, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>OUR SERVICES</div>
            <h2 className="lp-h2" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Comprehensive Care, All in One Place</h2>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
          {SERVICES.map(s => (
            <div key={s.title} className="lp-card" onClick={() => navigate('/register')} style={{ cursor: 'pointer', background: '#fff', border: '1px solid #eef2f7', borderRadius: 18, padding: '26px 22px' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{s.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>{s.desc}</div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#2563eb' }}>Book this service →</span>
            </div>
          ))}
        </div>
      </section>

      <section id="doctors" style={{ maxWidth: 1180, margin: '0 auto', padding: '96px 24px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 30, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>OUR DOCTORS</div>
            <h2 className="lp-h2" style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Experienced Specialists You Can Trust</h2>
          </div>
          {doctors.length > 3 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => scrollCarousel(-1)} style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid #dbe4ee', background: '#fff', cursor: 'pointer', fontSize: 15 }}>←</button>
              <button onClick={() => scrollCarousel(1)} style={{ width: 38, height: 38, borderRadius: '50%', border: '1.5px solid #dbe4ee', background: '#fff', cursor: 'pointer', fontSize: 15 }}>→</button>
            </div>
          )}
        </div>
        {doctors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', background: '#f8fafc', borderRadius: 18 }}>
            Our doctor directory is being set up — check back soon, or book an appointment and we'll match you with the right specialist.
          </div>
        ) : (
          <div ref={carouselRef} className="lp-carousel" style={{ display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 8 }}>
            {doctors.map(d => (
              <div key={d._id} className="lp-card" style={{ scrollSnapAlign: 'start', flex: '0 0 240px', background: '#fff', border: '1px solid #eef2f7', borderRadius: 18, padding: '22px 18px', textAlign: 'center' }}>
                {d.avatar ? (
                  <img src={getFileUrl(d.avatar)} alt={d.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px' }} />
                ) : (
                  <div style={{ margin: '0 auto 14px', width: 72, display: 'flex', justifyContent: 'center' }}><Initials name={d.name} size={72} /></div>
                )}
                <div style={{ fontWeight: 700, fontSize: 14 }}>Dr. {d.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{d.specialization || d.department || 'General Medicine'}</div>
                {d.rating != null && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 6, fontWeight: 700 }}>⭐ {d.rating.toFixed(1)}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 26 }}>
          <button onClick={() => navigate('/register')} style={{ padding: '12px 26px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            See All Doctors & Book →
          </button>
        </div>
      </section>

      <section id="facilities" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)', padding: '90px 24px', marginTop: 90 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>OUR FACILITIES</div>
          <h2 className="lp-h2" style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Modern Facilities for Better Care</h2>
          <p style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 34, maxWidth: 460 }}>A comfortable environment and well-equipped spaces designed to support your recovery.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
            {FACILITIES.map(f => (
              <div key={f.title} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, padding: '22px 18px' }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{f.title}</div>
                <div style={{ color: '#93a3bb', fontSize: 12, lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tips" style={{ maxWidth: 1180, margin: '0 auto', padding: '96px 24px 20px' }}>
        <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>HEALTH TIPS</div>
        <h2 className="lp-h2" style={{ fontSize: 28, fontWeight: 800, margin: '0 0 30px' }}>Wellness Guidance from Our Team</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
          {HEALTH_TIPS.map(t => (
            <div key={t.title} className="lp-card" style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ height: 90, background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>{t.icon}</div>
              <div style={{ padding: '18px' }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '3px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: .4 }}>{t.tag}</span>
                <div style={{ fontWeight: 700, fontSize: 14, margin: '12px 0 8px', lineHeight: 1.35 }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6 }}>{t.excerpt}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" style={{ maxWidth: 1180, margin: '90px auto 0', padding: '0 24px' }}>
        <div style={{ background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', borderRadius: 24, padding: '40px 36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24, marginBottom: (info?.contactPhone || info?.contactEmail || info?.address) ? 24 : 0 }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Need Medical Assistance?</div>
              <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 13.5 }}>We're here to help, every day of the week.</div>
            </div>
            <button onClick={() => navigate('/register')} style={{ padding: '13px 26px', borderRadius: 14, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              Book Appointment Now
            </button>
          </div>
          {(info?.contactPhone || info?.contactEmail || info?.address) && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,.25)', paddingTop: 24 }}>
              {info?.contactPhone && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px' }}>
                  <span style={{ fontSize: 18 }}>📞</span>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700 }}>CALL US</div>
                    <a href={`tel:${info.contactPhone}`} style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', textDecoration: 'none' }}>{info.contactPhone}</a>
                  </div>
                </div>
              )}
              {info?.contactEmail && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px' }}>
                  <span style={{ fontSize: 18 }}>✉️</span>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700 }}>EMAIL US</div>
                    <a href={`mailto:${info.contactEmail}`} style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', textDecoration: 'none', wordBreak: 'break-all' }}>{info.contactEmail}</a>
                  </div>
                </div>
              )}
              {info?.address && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 260px' }}>
                  <span style={{ fontSize: 18 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700 }}>VISIT US</div>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.address)}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', textDecoration: 'none' }}>{info.address}</a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <footer style={{ maxWidth: 1180, margin: '0 auto', padding: '50px 24px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div className="lp-logo" style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 15 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>✚</span>
          {hospitalName}
        </div>
        <div style={{ fontSize: 12.5, color: '#94a3b8' }}>© {new Date().getFullYear()} {hospitalName}. All rights reserved.</div>
        <div style={{ fontSize: 12.5, color: '#2563eb', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/login')}>Hospital Staff Sign In →</div>
      </footer>
    </div>
  );
}
