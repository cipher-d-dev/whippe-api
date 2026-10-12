# Whippe API

The shared Express backend for Whippe — DAAR Communications' intern management platform.

Serves both **Whippe Web** (HR/Supervisor) and **Whippe Intern PWA** across AIT, Raypower, and Faaji.

---

## Stack

- Node.js + TypeScript (strict mode)
- Express 4
- Mongoose + MongoDB Atlas
- Zod (validation)
- JWT — access + refresh tokens (HTTP-only cookie)
- bcryptjs — password hashing
- Passport + Google OAuth 2.0
- Appwrite — file/document storage
- Jest + ts-jest — unit tests

---

## Prerequisites

- Node.js 20+
- npm
- MongoDB Atlas connection string (or local MongoDB)
- Google OAuth credentials (Cloud Console)
- Appwrite project (for file uploads — optional in development)

---

## Getting started

**1. Install dependencies**

```bash
npm install
```

**2. Set up environment**

```bash
copy .env.example .env
```

Fill in your values. Minimum required for local development:

```env
MONGODB_URI=mongodb://localhost:27017/whippe
JWT_SECRET=a-random-string-of-at-least-32-characters
OFFICE_LAT=6.4281
OFFICE_LNG=3.4219
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback
```

See the full environment variable reference below.

**3. Start the development server**

```bash
npm run dev
```

The server starts on `http://localhost:5000` by default (set `PORT` in `.env` to change).

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with hot reload via `tsx watch` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build (`dist/server.js`) |
| `npm run typecheck` | Type-check without emitting files |
| `npm test` | Run all unit tests |
| `npm run test:watch` | Run tests in watch mode |

---

## Health check

```
GET /health
```

Returns `200` when the server is running:

```json
{
  "success": true,
  "message": "Whippe API is running",
  "environment": "development",
  "timestamp": "2026-10-12T10:00:00.000Z"
}
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `PORT` | No | `5000` | Port the server listens on |
| `MONGODB_URI` | **Yes** | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Secret for signing JWTs (min 32 chars) |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Comma-separated list of allowed origins |
| `FRONTEND_URL` | No | `http://localhost:3000` | Used for Google OAuth redirect |
| `OFFICE_LAT` | **Yes** | — | DAAR HQ latitude (geofence) |
| `OFFICE_LNG` | **Yes** | — | DAAR HQ longitude (geofence) |
| `OFFICE_RADIUS_METERS` | No | `100` | Geofence radius in metres |
| `GOOGLE_CLIENT_ID` | **Yes** | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **Yes** | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | **Yes** | — | Google OAuth callback URL |
| `APPWRITE_ENDPOINT` | Prod only | — | Appwrite API endpoint |
| `APPWRITE_PROJECT_ID` | Prod only | — | Appwrite project ID |
| `APPWRITE_BUCKET_ID` | Prod only | — | Appwrite storage bucket ID |
| `APPWRITE_API_KEY` | Prod only | — | Appwrite API key (server-side) |

The server exits immediately on startup if any required variable is missing or invalid.
In `production`, the `APPWRITE_*` variables are also required.

---

## Project structure

```
src/
├── config/
│   ├── env.ts              # Zod-validated environment config
│   └── database.ts         # Mongoose connection
├── middleware/
│   ├── auth.ts             # authenticate() + getAuthUser() helper
│   ├── authorize.ts        # authorize(...roles) middleware factory
│   ├── error-handler.ts    # createError() + global error handler
│   └── not-found.ts
├── lib/
│   ├── token.ts            # JWT sign/verify, cookie helpers
│   ├── passport.ts         # Google OAuth strategy
│   ├── cleanup.ts          # Scheduled job: delete expired pending accounts
│   ├── geofence.ts         # Haversine distance + geofence check
│   └── appwrite.ts         # Appwrite storage helpers
├── modules/                # One folder per domain
│   ├── auth/
│   ├── users/
│   ├── interns/            # includes exit.service/controller/routes
│   ├── departments/
│   ├── supervisors/
│   ├── attendance/
│   ├── tasks/
│   ├── submissions/
│   ├── reports/
│   ├── evaluations/
│   ├── documents/
│   ├── notifications/
│   └── timeline/           # audit-log, timeline, summary
├── app.ts                  # Express app setup, all routers mounted
└── server.ts               # Entry point
tests/
├── lib/
│   └── geofence.test.ts
└── modules/
    ├── auth.service.test.ts
    ├── users.service.test.ts
    ├── exit.service.test.ts
    └── notification.service.test.ts
```

Each module follows: `model → schema → service → controller → routes → types`.

---

## API

Full API contract: [`docs/API-CONTRACT.md`](./docs/API-CONTRACT.md)

Base path: `/api/v1`

| Domain | Base route |
|---|---|
| Auth | `/auth` |
| Users | `/users` |
| Interns | `/interns` |
| Departments | `/departments` |
| Supervisors | `/supervisors` |
| Attendance | `/attendance` |
| Tasks | `/tasks` |
| Submissions | `/submissions` |
| Reports | `/reports` |
| Evaluations | `/evaluations` |
| Documents | `/documents` |
| Notifications | `/notifications` |
| Intern timeline | `/interns/:id/timeline` |
| Intern summary | `/interns/:id/summary` |
| Admin history | `/admin/history` |

---

## Implementation phases

| Phase | Description | Status |
|---|---|---|
| 0 | Foundation — Express, Mongoose, config, health check | ✅ Done |
| 1 | Authentication, accounts, Google OAuth | ✅ Done |
| 2 | Intern registration & HR account verification | ✅ Done |
| 3 | Intern profile & internship record | ✅ Done |
| 4 | Departments, supervisors & assignments | ✅ Done |
| 5 | Attendance with geofence | ✅ Done |
| 6 | Tasks, submissions & daily reports | ✅ Done |
| 7 | Performance & evaluations | ✅ Done |
| 8 | Documents & document tracking | ✅ Done |
| 9 | Notifications | ✅ Done |
| 10 | Timeline, performance summary & admin history | ✅ Done |
| 11 | Internship completion & exit | ✅ Done |
| 12 | Hardening & production readiness | ✅ Done |
| 13 | API contract & frontend integration readiness | ✅ Done |
