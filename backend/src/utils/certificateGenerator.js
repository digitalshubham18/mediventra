const PDFDocument = require('pdfkit');

// Generates a proper-looking Blood Donation Certificate: ornate double
// border, hospital letterhead, a drawn blood-drop emblem, the donor's
// name set large and prominent, donation details, a certificate
// number for authenticity, and a signature block (uses the hospital's
// uploaded signature image if one has been configured, otherwise a
// clean printed signature line — never a fabricated signature).
//
// Returns a Buffer containing the finished PDF.
function generateBloodDonationCertificate({
  donorName, bloodGroup, donationDate, unitsCollected, certificateNo,
  hospitalName, signatoryName, signatoryTitle, signatureImagePath,
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;   // ~842
      const H = doc.page.height;  // ~595
      const maroon = '#7a1f2b';
      const gold   = '#c8a24a';
      const ink    = '#26221f';
      const softbg = '#fbf8f2';

      // ── Background & borders ──────────────────────────────────────────
      doc.rect(0, 0, W, H).fill(softbg);
      doc.rect(24, 24, W - 48, H - 48).lineWidth(2.5).stroke(gold);
      doc.rect(34, 34, W - 68, H - 68).lineWidth(1).stroke(maroon);

      // Corner flourishes (simple decorative quarter-circles)
      const corner = (x, y, sx, sy) => {
        doc.save();
        doc.translate(x, y).scale(sx, sy);
        doc.moveTo(0, 34).quadraticCurveTo(0, 0, 34, 0).lineWidth(1.4).stroke(gold);
        doc.moveTo(0, 22).quadraticCurveTo(0, 0, 22, 0).lineWidth(1.4).stroke(gold);
        doc.restore();
      };
      corner(34, 34, 1, 1);
      corner(W - 34, 34, -1, 1);
      corner(34, H - 34, 1, -1);
      corner(W - 34, H - 34, -1, -1);

      // ── Blood-drop emblem (drawn, not an image) ─────────────────────────
      const cx = W / 2, cy = 78;
      doc.save();
      doc.moveTo(cx, cy - 24)
         .bezierCurveTo(cx + 20, cy + 2, cx + 15, cy + 26, cx, cy + 26)
         .bezierCurveTo(cx - 15, cy + 26, cx - 20, cy + 2, cx, cy - 24)
         .fill(maroon);
      doc.restore();

      // ── Header text ──────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(22).fillColor(maroon)
        .text((hospitalName || 'Mediventra').toUpperCase(), 0, 116, { align: 'center', width: W });
      doc.font('Helvetica').fontSize(11).fillColor(ink)
        .text('Blood Bank & Donation Center', 0, 144, { align: 'center', width: W, characterSpacing: 1.5 });

      doc.moveTo(W/2 - 90, 164).lineTo(W/2 + 90, 164).lineWidth(0.75).stroke(gold);

      // ── Title ────────────────────────────────────────────────────────
      doc.font('Times-Bold').fontSize(34).fillColor(ink)
        .text('Certificate of Blood Donation', 0, 182, { align: 'center', width: W });

      doc.font('Helvetica').fontSize(12).fillColor(ink)
        .text('This certificate is proudly presented to', 0, 232, { align: 'center', width: W });

      // ── Donor name ───────────────────────────────────────────────────
      doc.font('Times-Bold').fontSize(40).fillColor(maroon)
        .text(donorName, 60, 260, { align: 'center', width: W - 120 });
      doc.moveTo(W/2 - 160, 312).lineTo(W/2 + 160, 312).lineWidth(1).stroke(gold);

      // ── Body ─────────────────────────────────────────────────────────
      const dateStr = new Date(donationDate).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
      doc.font('Helvetica').fontSize(13).fillColor(ink).text(
        `in recognition of their voluntary and selfless contribution of ${unitsCollected} unit${unitsCollected>1?'s':''} of blood ` +
        `(Blood Group ${bloodGroup}) on ${dateStr}, helping save lives at ${hospitalName || 'Mediventra'}.`,
        90, 330, { align: 'center', width: W - 180, lineGap: 4 }
      );

      doc.font('Times-Italic').fontSize(13).fillColor(maroon)
        .text('"The gift of blood is the gift of life."', 0, 384, { align: 'center', width: W });

      // ── Signature block ──────────────────────────────────────────────
      const sigY = H - 130;
      const sigLineWidth = 190;
      const leftX = 110;
      const rightX = W - 110 - sigLineWidth;

      // Left: date & certificate number (authenticity block)
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ink).text('Date of Issue', leftX, sigY);
      doc.font('Helvetica').fontSize(11).text(dateStr, leftX, sigY + 14);
      doc.moveTo(leftX, sigY + 34).lineTo(leftX + sigLineWidth, sigY + 34).lineWidth(0.75).stroke(ink);
      doc.font('Helvetica').fontSize(8.5).fillColor('#6b6560').text(`Certificate No. ${certificateNo}`, leftX, sigY + 40);

      // Right: signatory
      if (signatureImagePath) {
        try { doc.image(signatureImagePath, rightX + sigLineWidth/2 - 55, sigY - 38, { width: 110, height: 40 }); } catch {}
      }
      doc.moveTo(rightX, sigY + 34).lineTo(rightX + sigLineWidth, sigY + 34).lineWidth(0.75).stroke(ink);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(ink)
        .text(signatoryName || 'Authorized Signatory', rightX, sigY + 40, { width: sigLineWidth, align: 'center' });
      doc.font('Helvetica').fontSize(9.5).fillColor('#6b6560')
        .text(signatoryTitle || 'Chief Medical Officer', rightX, sigY + 54, { width: sigLineWidth, align: 'center' });

      // Seal (drawn circle, center-bottom)
      const sealX = W / 2, sealY = sigY + 4;
      doc.circle(sealX, sealY, 30).lineWidth(1.4).stroke(gold);
      doc.circle(sealX, sealY, 25).lineWidth(0.75).stroke(gold);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(gold)
        .text('OFFICIAL', sealX - 30, sealY - 10, { width: 60, align: 'center' });
      doc.text('SEAL', sealX - 30, sealY + 1, { width: 60, align: 'center' });

      doc.end();
    } catch (err) { reject(err); }
  });
}

module.exports = { generateBloodDonationCertificate };
