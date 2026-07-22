const BugReport   = require('../models/BugReport');
const emailService = require('../utils/emailService');
const { logAction } = require('../utils/auditLog');
const { buildFileUrl, toAbsoluteUrl } = require('../middleware/upload');
const path = require('path');

// Where bug-report emails go. Falls back to the same account the app
// already sends other mail from (EMAIL_USER) if BUG_REPORT_EMAIL isn't
// set, so this works out of the box without extra configuration.
const BUG_EMAIL_TO = process.env.BUG_REPORT_EMAIL || process.env.EMAIL_USER;

const bugReportHTML = (report, absoluteScreenshotUrl) => `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12)">
<tr><td style="background:linear-gradient(135deg,#dc2626,#f87171);padding:28px;text-align:center">
  <div style="font-size:38px;margin-bottom:6px">🐞</div>
  <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0">New Bug Report</h1>
</td></tr>
<tr><td style="padding:30px">
  <table width="100%" style="margin-bottom:18px">
    <tr><td style="padding:4px 0;color:#64748b;font-size:12.5px;width:110px">Reported by</td><td style="padding:4px 0;color:#0f172a;font-size:13.5px;font-weight:700">${report.reportedByName || 'Unknown'} (${report.reportedByRole || '—'})</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:12.5px">Email</td><td style="padding:4px 0;color:#0f172a;font-size:13.5px">${report.reportedByEmail || '—'}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:12.5px">Page</td><td style="padding:4px 0;color:#0f172a;font-size:13.5px">${report.page || '—'}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;font-size:12.5px">Reported at</td><td style="padding:4px 0;color:#0f172a;font-size:13.5px">${new Date(report.createdAt || Date.now()).toLocaleString('en-IN')}</td></tr>
  </table>
  <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px 18px">
    <p style="margin:0 0 6px;color:#7f1d1d;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px">Description</p>
    <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${(report.description||'').replace(/</g,'&lt;')}</p>
  </div>
  ${absoluteScreenshotUrl ? `<div style="margin-top:16px"><p style="margin:0 0 8px;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px">Attached Screenshot</p><img src="${absoluteScreenshotUrl}" alt="Bug screenshot" style="width:100%;border-radius:12px;border:1px solid #e8edf3;display:block" /><p style="margin:8px 0 0;color:#94a3b8;font-size:11px">The original image file is also attached to this email.</p></div>` : ''}
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e8edf3;padding:16px 30px;text-align:center">
  <p style="color:#94a3b8;font-size:11.5px;margin:0">Mediventra · Bug Reporting System</p>
</td></tr>
</table></td></tr></table></body></html>`;

// ── POST /api/bugs ─────────────────────────────────────────────────────
exports.createBugReport = async (req, res) => {
  try {
    const { description, page } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, error: 'Please describe the bug before submitting.' });
    }

    const report = await BugReport.create({
      reportedBy:      req.user?.id,
      reportedByName:  req.user?.name || 'Unknown',
      reportedByRole:  req.user?.role || '',
      reportedByEmail: req.user?.email || '',
      description:     description.trim(),
      page:            page || '',
      screenshotUrl:   req.file ? buildFileUrl(req.file, 'bug-reports') : '',
    });

    if (BUG_EMAIL_TO) {
      const absoluteScreenshotUrl = toAbsoluteUrl(report.screenshotUrl, req);

      // Attach the ORIGINAL uploaded file to the email itself — not just
      // an inline <img> link. This guarantees the exact image the user
      // uploaded reaches the inbox regardless of email-client image
      // blocking, Cloudinary/local-storage differences, or any URL
      // resolution issue. req.file.path works as nodemailer's
      // attachment `path` whether it's a local filesystem path (disk
      // storage) or a remote https:// URL (Cloudinary) — both are
      // valid inputs nodemailer knows how to fetch from.
      const attachments = req.file ? [{
        filename: `bug-screenshot-${report._id}${path.extname(req.file.originalname || '') || '.png'}`,
        path: req.file.path,
      }] : undefined;

      emailService.sendGeneral({
        to: BUG_EMAIL_TO,
        subject: `🐞 New Bug Report from ${report.reportedByName} — Mediventra`,
        html: bugReportHTML(report, absoluteScreenshotUrl),
        text: `Bug report from ${report.reportedByName} (${report.reportedByRole})\nPage: ${report.page}\n\n${report.description}`,
        attachments,
      }).then(async (r) => {
        if (r.success) { report.emailSent = true; await report.save().catch(() => {}); }
      }).catch(console.error);
    }

    res.status(201).json({ success: true, data: report, message: 'Thanks — your bug report has been sent to the team!' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

// ── GET /api/bugs — admin only, lists reports ─────────────────────────
exports.getBugReports = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const reports = await BugReport.find(q).sort({ createdAt: -1 }).limit(300);
    res.json({ success: true, count: reports.length, data: reports });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ── PUT /api/bugs/:id — admin only, update status ──────────────────────
exports.updateBugReport = async (req, res) => {
  try {
    const { status } = req.body;
    const report = await BugReport.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    logAction({
      actor: req.user, action: 'bug_report_status_changed',
      description: `Marked bug report from ${report.reportedByName} as "${status}"`,
      targetType: 'BugReport', targetId: report._id,
    });
    res.json({ success: true, data: report });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};
