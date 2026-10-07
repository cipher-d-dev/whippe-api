# Whippe API

The shared Express backend for Whippe — AIT's intern management platform.

Serves both **Whippe Web** (HR/Supervisor) and **Whippe Intern PWA**.

---

## Stack

- Node.js + TypeScript
- Express
- Mongoose + MongoDB Atlas
- Zod (validation)
- JWT (authentication)

---

## Prerequisites

- Node.js 20+
- npm
- A running MongoDB instance (local or Atlas)

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

Open `.env` and fill in your values — at minimum:

```env
MONGODB_URI=mongodb://localhost:27017/whippe
JWT_SECRET=a-random-string-of-at-least-32-characters
```

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
  "timestamp": "2026-10-07T10:00:00.000Z"
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
| `OBJECT_STORAGE_ENDPOINT` | No | — | Object storage endpoint (Phase 8+) |
| `OBJECT_STORAGE_BUCKET` | No | — | Storage bucket name |
| `OBJECT_STORAGE_ACCESS_KEY` | No | — | Storage access key |
| `OBJECT_STORAGE_SECRET_KEY` | No | — | Storage secret key |
| `OBJECT_STORAGE_REGION` | No | — | Storage region |

The server will exit immediately on startup if any required variable is missing or invalid.

---

## Project structure

```
src/
├── config/
│   ├── env.ts          # Zod-validated environment config
│   └── database.ts     # Mongoose connection
├── middleware/
│   ├── error-handler.ts
│   └── not-found.ts
├── modules/            # One folder per domain
│   ├── auth/
│   ├── users/
│   ├── interns/
│   ├── departments/
│   ├── supervisors/
│   ├── placements/
│   ├── documents/
│   ├── attendance/
│   ├── tasks/
│   ├── submissions/
│   ├── reports/
│   ├── evaluations/
│   ├── notifications/
│   ├── timeline/
│   └── ai/
├── app.ts              # Express app setup
└── server.ts           # Entry point
```

Each module will follow the pattern: `model → schema → service → controller → routes → types`.

---

## Implementation phases

See [`docs/11-WHIPPIE-API-PHASES.md`](./docs/11-WHIPPIE-API-PHASES.md) for the full phase plan.

| Phase | Description | Status |
|---|---|---|
| 0 | Foundation — Express, Mongoose, config, health check | ✅ Done |
| 1 | Authentication, accounts, access control | 🔜 Next |
| 2 | Intern registration & HR account verification | — |
| 3 | Intern profile & internship record | — |
| 4 | Departments, supervisors & assignments | — |
| 5 | Attendance | — |
| 6 | Tasks, notes & daily work | — |
| 7 | Performance & evaluations | — |
| 8 | Documents & document tracking | — |
| 9 | Notifications | — |
| 10 | Timeline, reports & admin history | — |
| 11 | Internship completion & exit | — |
| 12 | Hardening & production readiness | — |
| 13 | API contract & frontend integration readiness | — |
