# Mediventra — Hospital Management System

A full-stack HMS: Node/Express/MongoDB backend, React frontend.

## Project structure
```
backend/     Express API (MongoDB via Mongoose)
frontend/    React app (Create React App)
```

## First-time setup

### Backend
```bash
cd backend
npm install
cp .env.example .env   # then fill in real values — see comments in the file
npm run dev             # starts on http://localhost:5001
```

`.env` needs at minimum `MONGO_URI` and `JWT_SECRET` to boot. Everything else
(email, payments, Cloudinary, social login, etc.) is optional — those
features simply won't work until configured, the app still runs.

**Never commit your real `.env` file.** It's already gitignored.

### Frontend
```bash
cd frontend
npm install
npm start                # starts on http://localhost:3000
```

### Seed demo data (optional)
```bash
cd backend
npm run seed:demos       # creates demo accounts across every role
npm run seed:all         # seeds rooms + shift schedules
```

## Running tests

```bash
cd backend
npm test
```

This runs the Jest unit test suite (fast, no external services required) —
currently covering salary calculation (including the late-attendance fine)
and appointment time-slot parsing (the 1-hour-ahead booking rule). These are
intentionally dependency-free unit tests; adding true integration tests
against a real database would need `mongodb-memory-server` or a dedicated
test MongoDB instance, which needs outbound internet access to download the
MongoDB binary the first time it runs.

The frontend does not currently have an automated test suite.

## Security notes

- Rotate any credential that was ever committed to `.env` in a shared copy
  of this project — treat it as compromised.
- `JWT_SECRET` should be a long random string (`openssl rand -hex 64`).
  Anyone with this value can forge valid login tokens for any account.
- File uploads default to local disk storage (`backend/uploads`), which most
  hosting platforms wipe on every restart/redeploy. Configure Cloudinary
  (`CLOUDINARY_*` env vars) for anything beyond local development.
