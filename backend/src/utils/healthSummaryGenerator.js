const PDFDocument = require('pdfkit');

// Builds a single consolidated "Health Summary" PDF for a patient — the
// kind of document someone can hand to a new hospital, a specialist, or
// an insurer without having to export half a dozen individual records.
// Pulls together: demographics, recent visit history, active
// prescriptions, issued certificates, and the latest vitals snapshot.
// This is a functional report, not a decorative certificate, so the
// styling stays plain and legible rather than ornate.
//
// Returns a Promise<Buffer> containing the finished PDF.
function generateHealthSummaryPDF({ patient, records, prescriptions, certificates, latestVitals, hospitalName }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primary = '#1648c9';
      const ink = '#0f172a';
      const muted = '#64748b';
      const line = '#e2e8f0';
      const W = doc.page.width - 100; // usable width inside margins

      const sectionTitle = (text) => {
        if (doc.y > doc.page.height - 120) doc.addPage();
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(13).fillColor(primary).text(text);
        doc.moveTo(50, doc.y + 2).lineTo(50 + W, doc.y + 2).lineWidth(1).stroke(line);
        doc.moveDown(0.5);
      };
      const kv = (label, value) => {
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(muted).text(label, { continued: true, width: 140 });
        doc.font('Helvetica').fontSize(10).fillColor(ink).text(`  ${value || '—'}`);
      };
      const emptyNote = (text) => doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(muted).text(text).moveDown(0.3);

      // ── Header / letterhead ──────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(20).fillColor(primary).text(hospitalName || 'Mediventra', { align: 'left' });
      doc.font('Helvetica').fontSize(10).fillColor(muted).text('Consolidated Health Summary', { align: 'left' });
      doc.moveTo(50, doc.y + 8).lineTo(50 + W, doc.y + 8).lineWidth(1.5).stroke(primary);
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(9).fillColor(muted)
        .text(`Generated ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, { align: 'right' });

      // ── Patient demographics ─────────────────────────────────────────
      sectionTitle('Patient Information');
      kv('Name', patient.name);
      kv('Age / Gender', [patient.age, patient.gender].filter(Boolean).join(' / '));
      kv('Blood Group', patient.bloodGroup);
      kv('Phone', patient.phone);
      doc.moveDown(0.4);

      // ── Latest vitals snapshot ───────────────────────────────────────
      sectionTitle('Latest Vitals Snapshot');
      if (!latestVitals) {
        emptyNote('No vitals logged yet.');
      } else {
        const vRow = [];
        if (latestVitals.bpSystolic != null && latestVitals.bpDiastolic != null) vRow.push(`BP ${latestVitals.bpSystolic}/${latestVitals.bpDiastolic} mmHg`);
        if (latestVitals.heartRate != null) vRow.push(`HR ${latestVitals.heartRate} bpm`);
        if (latestVitals.spo2 != null) vRow.push(`SpO2 ${latestVitals.spo2}%`);
        if (latestVitals.bloodGlucose != null) vRow.push(`Glucose ${latestVitals.bloodGlucose} mg/dL`);
        if (latestVitals.weight != null) vRow.push(`Weight ${latestVitals.weight} kg`);
        doc.font('Helvetica').fontSize(10).fillColor(ink).text(vRow.join('   ·   ') || 'No readings recorded.');
        doc.font('Helvetica').fontSize(8.5).fillColor(muted)
          .text(`Recorded ${new Date(latestVitals.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
      }
      doc.moveDown(0.4);

      // ── Recent visit / record history ────────────────────────────────
      sectionTitle(`Recent Records (last ${records.length})`);
      if (records.length === 0) {
        emptyNote('No health records on file.');
      } else {
        records.forEach(r => {
          doc.font('Helvetica-Bold').fontSize(10).fillColor(ink)
            .text(r.title, { continued: true })
            .font('Helvetica').fontSize(9).fillColor(muted)
            .text(`   ${new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
          doc.font('Helvetica').fontSize(9).fillColor(muted)
            .text(`${(r.type || '').replace(/_/g, ' ')}${r.doctor?.name ? ' · Dr. ' + r.doctor.name : ''}`);
          doc.moveDown(0.3);
        });
      }

      // ── Active prescriptions ─────────────────────────────────────────
      sectionTitle('Active Prescriptions');
      const active = prescriptions.filter(p => p.status === 'active');
      if (active.length === 0) {
        emptyNote('No active prescriptions.');
      } else {
        active.forEach(p => {
          doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text(p.diagnosis || 'Prescription');
          doc.font('Helvetica').fontSize(9).fillColor(muted)
            .text(`Dr. ${p.doctor?.name || 'Unknown'} · ${new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
          (p.medicines || []).forEach(m => {
            doc.font('Helvetica').fontSize(9).fillColor(ink)
              .text(`  •  ${m.name}${m.dosage ? ' — ' + m.dosage : ''}${m.duration ? ' (' + m.duration + ')' : ''}`);
          });
          doc.moveDown(0.3);
        });
      }

      // ── Certificates on file ──────────────────────────────────────────
      sectionTitle('Certificates on File');
      if (certificates.length === 0) {
        emptyNote('No certificates issued.');
      } else {
        certificates.forEach(c => {
          doc.font('Helvetica').fontSize(9.5).fillColor(ink)
            .text(`•  ${(c.type || '').replace(/_/g, ' ')} — ${c.purpose}`, { continued: true })
            .font('Helvetica').fontSize(8.5).fillColor(muted)
            .text(`   ${new Date(c.issuedDate || c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`);
        });
      }

      // ── Footer ────────────────────────────────────────────────────────
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(muted)
        .text('This summary is generated for informational purposes and does not replace original medical records or a physician\u2019s clinical judgment.',
          50, doc.page.height - 60, { width: W, align: 'center' });

      doc.end();
    } catch (err) { reject(err); }
  });
}

module.exports = { generateHealthSummaryPDF };
