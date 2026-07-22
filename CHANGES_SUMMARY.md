# What changed — summary

## 🔐 Login / multi-user switching
- `/login` no longer locks you out if you're already signed in — it shows who you're
  logged in as and lets you sign in as someone else directly (auto logs out the old
  session first, rebinds the socket connection, no more stale dashboard).
- Fixed the socket connection so switching accounts always rejoins the **new** user's
  room instead of silently staying attached to the previous one.
- Login now redirects back to whatever page sent you there (e.g. an email's
  "Complete Documentation" link → `/settings?tab=profile`), instead of always
  dropping you on `/dashboard`.

## 👀 Admin: see logins, time spent, location, activity
- New `UserSession` + `ActivityLog` models track every login/logout, total time spent
  per day, and a "what are they doing" feed (page/action labels).
- Login location (city/region/country) is derived from IP via `geoip-lite` (fully
  offline, no external API calls) — **added `geoip-lite` to `backend/package.json`,
  run `npm install` to pull it in.**
- New **Admin → User Activity** page: per-user time-on-site today, last login IP +
  location, last activity, and full session/activity history on click.
- **Online Users** page now also shows each online user's login IP + location.
- Every staff dashboard (except admin/doctor) now has a small "Time on site today" widget.

## 🚨 Security incidents
- Added a real `closed` status + `PUT /stafflogs/:id/close`. Security (or the log's
  creator/team) can now mark their own incident reports complete and close them —
  this never existed before (the old `resolve` endpoint had no UI button anywhere).

## 💰 Salary — real bank validation
- Salary credit now **validates the employee's bank account** (account number, IFSC
  format, account holder) before moving money. If it's missing/invalid: the salary is
  marked `failed`, no money moves, and the employee gets an email asking them to update
  their bank details (Finance gets a "Retry" button once fixed).
- Successful credits now get a real transaction reference + masked account snapshot.

## 📊 Real analytics (no more hardcoded numbers)
- `AnalyticsPage.js` and the Admin/Doctor `Dashboard.js` charts (Patient Visits,
  Monthly Revenue, Department Performance, New Patient Registrations, Medicine Sales
  by Category) are now wired to real MongoDB aggregations instead of static sample
  arrays. Added `dailyVisits` and `medicineSalesByCategory` aggregations to the backend.

## 🧪 Lab dashboard → real-time updates
- When a lab report is marked completed/abnormal, the patient and doctor now get a
  live socket notification + the patient gets an email. Records page and Doctor
  dashboard auto-refresh instead of needing a manual reload.
- Doctor dashboard gained a "Lab Results Pending for My Patients" panel and a
  "Write Prescription" quick action.

## 💳 "Pay Now" button bug
- Found the root cause: the backend only ever set `appointment.paid = true`, but the
  frontend checked `appointment.paymentStatus`, which never existed. Added the field,
  kept it in sync everywhere payments are confirmed/refunded.

## 🏨 Receptionist check-in
- Removed the "Cancel" button from the room-assignment modal.
- Added "Assign to Wardboy" — pick a specific wardboy by name (or leave on "any
  available") right alongside the room; they get notified directly instead of a
  blind broadcast to everyone.

## ✉️ Registration email
- New accounts now get a confirmation email immediately (separate from the existing
  OTP and approval emails) — different wording for auto-approved patients vs.
  pending-approval staff.

## ✍️ Credit line
- "Designed & developed by Shubham Kumar" added to the sidebar footer and the login page.

---
**One manual step needed:** run `npm install` in `/backend` to pull in the new
`geoip-lite` dependency (used for IP → location lookups).
