# WHIPPIE-API — AGENT HANDOFF DOCUMENT
# Generated: 2026-10-12 | All backend phases complete. Next: Frontend (Whippe Web — HR dashboard).

---

## WHAT THIS PROJECT IS

Whippe API — shared Express backend for DAAR Communications (parent company of AIT, Raypower, Faaji) intern management platform.
One building (DAAR Communications HQ), one geofence for attendance.
HR approves intern accounts by visually checking name + email — no screening reference number needed.
~100–200 interns/NYSC IT personnel expected.

**DO NOT:**
- Add Redis, BullMQ, microservices, Kafka, multiple databases
- Hardcode department names (departments are data, created by HR at runtime)
- Trust role/ownership from the client — backend enforces everything
- Introduce AI until Phase 11 explicitly

---

## REPO

GitHub: https://github.com/cipher-d-dev/whippe-api
Branch: main
All phases through Phase 13 are committed and pushed.

---

## STACK

- Node.js + TypeScript (strict mode)
- Express 4.22.3
- Mongoose 8.24.5 + MongoDB Atlas
- Zod 3 (validation)
- bcryptjs (12 rounds) — password hashing
- jsonwebtoken — JWT access + refresh tokens
- passport + passport-google-oauth20 — Google OAuth
- node-appwrite — Appwrite storage SDK
- jest + ts-jest — unit tests
- tsx — dev server

---

## KEY ARCHITECTURAL DECISIONS

### Authentication
- JWT access token: 15min, returned in response body, client stores in memory
- JWT refresh token: 7 days, raw token in HTTP-only SameSite=Strict cookie, SHA-256 hash stored in MongoDB User document
- Refresh token rotation on every /auth/refresh call (single-use semantics, no Redis)
- Token reuse detection wipes stored hash → forces re-login
- Google OAuth via Passport, no sessions, JWT issued on callback, redirects to FRONTEND_URL/auth/google/success#token=...
- bcrypt cost factor 12
- Auth routes (/signup, /login, /refresh) rate limited to 15 req/15min per IP

### Departments
- Free-form data, not enums — HR creates departments at runtime
- subsidiary field is a free-form string (e.g. "AIT", "Raypower", "Faaji", "Corporate")

### Supervisor deactivation
- When supervisor isActive=false → AUTOMATICALLY clears intern.supervisor field on all assigned interns
- HR then sees those interns as unassigned (no supervisor) and must reassign them

### Attendance / Geofence
- Single geofence: DAAR Communications HQ building (one location covers all subsidiaries)
- Configured via env vars: OFFICE_LAT, OFFICE_LNG, OFFICE_RADIUS_METERS
- REJECTED if outside geofence, FLAGGED if poor accuracy (>50m), ACCEPTED otherwise
- No GPS tracking — one check-in and one check-out per intern per day
- HR can manually correct flagged/rejected records

### File/Document Storage
- USE APPWRITE STORAGE (not AWS S3, not Cloudinary)
- Appwrite free tier: sufficient for 100-200 interns, supports any file type (PDFs, images)
- MongoDB stores only metadata: originalFilename, storageKey (Appwrite file ID), contentType, fileSizeBytes
- storageKey has select:false on Mongoose schema AND is stripped in toJSON transform — NEVER exposed to clients
- Upload flow: client calls GET /documents/:id/upload-info → gets {endpoint, projectId, bucketId, fileId} → uploads directly to Appwrite with client SDK → confirms via PATCH /documents/:id/upload
- Download flow: client calls GET /documents/:id/download → server fetches from Appwrite via server SDK, streams buffer back

### Paper documents
- PHYSICAL_RECEIVED status exists so HR can mark paper documents handed in at desk without requiring digital upload
- System supports both digital and physical tracking simultaneously

### Notifications
- Simple in-app only — no push, no email
- MongoDB records only — no Redis/BullMQ
- createNotification() internal utility called by services after key events
- 10 notification types — see API contract

### Audit Log
- AuditLog model records key HR actions (approve/reject, assignments, doc review, internship completion)
- logAction() internal utility — fire-and-forget (wrapped in .catch())
- Exposed via GET /api/v1/admin/history (HR only)

### Internship Completion
- HR explicitly closes internships via POST /interns/:id/complete
- Checklist must pass: all tasks resolved, no PENDING documents, at least 1 evaluation submitted
- Records completedAt + optional completionNote on Intern
- History preserved — NO deletion of user or intern records

---

## ENVIRONMENT VARIABLES

All in .env and .env.example. Required vars:

```
NODE_ENV=development
PORT=5000
MONGODB_URI=            # MongoDB Atlas connection string — MUST FILL
JWT_SECRET=             # Min 32 chars random string — MUST FILL
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
OFFICE_LAT=             # DAAR Communications HQ latitude — MUST FILL
OFFICE_LNG=             # DAAR Communications HQ longitude — MUST FILL
OFFICE_RADIUS_METERS=100
GOOGLE_CLIENT_ID=       # From Google Cloud Console — MUST FILL
GOOGLE_CLIENT_SECRET=   # From Google Cloud Console — MUST FILL
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# Appwrite Storage — required in production, optional in dev
APPWRITE_ENDPOINT=      # e.g. https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=
APPWRITE_BUCKET_ID=
APPWRITE_API_KEY=
```

Note: OBJECT_STORAGE_* vars are gone — replaced by APPWRITE_* in Phase 12.

---

## CURRENT FILE STRUCTURE

```
src/
├── config/
│   ├── env.ts              # Zod-validated env — APPWRITE_* required in production
│   └── database.ts
├── middleware/
│   ├── auth.ts             # authenticate() + getAuthUser() helper
│   ├── authorize.ts        # authorize(...roles) factory
│   ├── error-handler.ts    # createError() helper + global handler
│   └── not-found.ts
├── lib/
│   ├── token.ts            # JWT helpers, cookie helpers, hashRefreshToken
│   ├── passport.ts         # Google OAuth strategy (no sessions)
│   ├── cleanup.ts          # 24h job: deletes expired PENDING accounts
│   ├── geofence.ts         # haversineDistance + checkGeofence
│   └── appwrite.ts         # generateUploadInfo, downloadFile, deleteFile
├── modules/
│   ├── auth/               # auth.types, schema, service, controller, routes, google.controller
│   ├── users/              # user.model, user.types, users.schema, service, controller, routes
│   ├── interns/            # intern.types, model, schema, service, controller, routes
│   │                       # + exit.service, exit.controller, exit.routes (Phase 11)
│   ├── departments/        # department.model, schema, service, controller, routes
│   ├── supervisors/        # supervisor.model, schema, service, controller, routes
│   ├── attendance/         # attendance.types, model, schema, service, controller, routes
│   ├── tasks/              # task.types, model, schema, service, controller, routes
│   ├── submissions/        # submission.model, schema, service, controller, routes
│   ├── reports/            # report.model, schema, service, controller, routes
│   ├── evaluations/        # evaluation.types, model, schema, service, controller, routes
│   ├── documents/          # document.types, model, schema, service, controller, routes
│   ├── notifications/      # notification.types, model, schema, service, controller, routes
│   ├── timeline/           # audit-log.types/model/service, timeline.service, summary.service,
│   │                       # timeline.controller, timeline.routes
│   ├── placements/         # STUB ONLY
│   └── ai/                 # STUB ONLY
├── app.ts                  # All routers mounted here
└── server.ts               # Entry point, connects DB, starts cleanup job
```

---

## ALL MOUNTED ROUTES (app.ts)

```
/api/v1/auth              — signup, login, refresh, logout, me, google, google/callback
/api/v1/users             — HR verification queue, approve, reject, list, get
/api/v1/interns           — create, list, me, get, update, assign/remove dept+supervisor
/api/v1/interns           — exit-checklist, complete (exit router, same prefix)
/api/v1/departments       — create, list, get, update
/api/v1/supervisors       — create, list, me, get, update, /:id/interns
/api/v1/attendance        — check-in, list, get, correct
/api/v1/tasks             — create, list, get, update
/api/v1/submissions       — create, task/:taskId list, review
/api/v1/reports           — create, list, get, update, submit, review
/api/v1/evaluations       — create, list, get, update, submit
/api/v1/documents         — requirements CRUD, document records, physical/upload/review/checklist, upload-info, download
/api/v1/notifications     — list, read-all, /:id/read
/api/v1                   — interns/:id/timeline, interns/:id/summary, admin/history
```

---

## ALL PHASES COMPLETE

| Phase | Description | Commit |
|---|---|---|
| 0 | Foundation | 95dd06e |
| 1 | Auth & accounts + Google OAuth | aa02c4e |
| 2 | HR verification + cleanup job | 0e72c2c |
| 3 | Intern profile & internship record | 9167fbf |
| 4 | Departments, supervisors & assignments | 658f116 |
| 5 | Attendance with geofence | bfdd739 |
| 6 | Tasks, submissions, daily reports | 96d689c |
| 7 | Performance & evaluations | dfa11b4 |
| 8 | Documents & document tracking | 2af2aec |
| 9 | Notifications | 8ca3655 |
| 10 | Timeline, performance summary, admin history | 853d86a |
| 11 | Internship completion & exit | 815c23e |
| 12 | Hardening — Appwrite, rate limiting, indexes, tests | 6efbff7 |
| 13 | API contract document | (this commit) |

---

## API CONTRACT

See docs/API-CONTRACT.md — complete contract covering all 16 domains, every endpoint,
request/response shapes, roles, errors, and all enum values.

Frontend agents should read this document before building any UI.

---

## UNIT TESTS

49 tests across 5 suites — run with `npm test`:

- tests/lib/geofence.test.ts — haversine distance, geofence check
- tests/modules/auth.service.test.ts — signup, login, refresh, logout
- tests/modules/users.service.test.ts — approveUser, rejectUser
- tests/modules/exit.service.test.ts — getExitChecklist, completeInternship
- tests/modules/notification.service.test.ts — createNotification, list, markOneRead, markAllRead

---

## NEXT: FRONTEND — WHIPPE WEB (HR Dashboard)

Build order:
1. Whippe Web — HR dashboard first, then supervisor workspace
2. Whippe Intern PWA — after HR can manage data end-to-end

The HR dashboard must be built first because it is the control plane — intern accounts cannot
be approved, departments cannot be created, and supervisors cannot be assigned until HR
tooling exists.

Frontend stack (from docs/01-WHIPPE-OVERVIEW.md):
- Next.js + TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query (data fetching)
- Recharts (only where useful)

Key HR workflows to implement first:
1. Login / logout
2. Verification queue — approve/reject accounts
3. Create departments
4. Create supervisor profiles
5. Create intern records
6. Assign supervisors and departments to interns
7. Attendance monitoring
8. Document tracking
9. Admin history

---

## IMPORTANT NOTES FOR NEW INSTANCE

1. Always run `npx tsc --noEmit` before committing — keep it at exit 0
2. CRLF warnings on git commit are now silenced by .gitattributes
3. The PowerShell git push output shows exit code 1 but the push succeeds — the "error" is just
   PowerShell formatting the remote URL message. Confirm by checking `git log --oneline -1`
4. Do NOT use `insert` on tool writes for large files — use `create` for new files or `strReplace`
   for targeted edits
5. When app.ts import strReplace fails, read the exact current lines first before retrying
6. Supervisor deactivation auto-clears interns — this is intentional and documented
7. storageKey is NEVER sent to clients (select:false + toJSON strip) — maintain this
8. `getAuthUser(req)` helper in middleware/auth.ts extracts typed AuthenticatedUser from req.user
   — use this in all controllers instead of req.user directly
9. Role enum values: Role.HR, Role.SUPERVISOR, Role.INTERN (uppercase)
10. All business logic in services — controllers only parse input and call services
11. logAction() and createNotification() are always fire-and-forget — wrap in .catch(() => {})
12. tsconfig.json has no rootDir — tests/ and src/ are both included. Do not add rootDir back.
13. Appwrite vars are optional in dev — code handles missing vars gracefully with descriptive errors
