# WHIPPIE-API — AGENT HANDOFF DOCUMENT
# Generated: 2026-10-12 | For use by a new Kiro instance to continue from exactly where this session left off.

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
All phases through Phase 8 are committed and pushed.

---

## STACK

- Node.js + TypeScript (strict mode)
- Express 4.22.3
- Mongoose 8.24.5 + MongoDB Atlas
- Zod 3 (validation)
- bcryptjs (12 rounds) — password hashing
- jsonwebtoken — JWT access + refresh tokens
- passport + passport-google-oauth20 — Google OAuth
- tsx — dev server

---

## KEY ARCHITECTURAL DECISIONS (AGREED IN THIS SESSION)

### Authentication
- JWT access token: 15min, returned in response body, client stores in memory
- JWT refresh token: 7 days, raw token in HTTP-only SameSite=Strict cookie, SHA-256 hash stored in MongoDB User document
- Refresh token rotation on every /auth/refresh call (single-use semantics, no Redis)
- Token reuse detection wipes stored hash → forces re-login
- Google OAuth via Passport, no sessions, JWT issued on callback, redirects to FRONTEND_URL/auth/google/success#token=...
- bcrypt cost factor 12

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
- **USE APPWRITE STORAGE** (not AWS S3, not Cloudinary)
- Appwrite free tier: sufficient for 100-200 interns, supports any file type (PDFs, images)
- MongoDB stores only metadata: originalFilename, storageKey (Appwrite file ID), contentType, fileSizeBytes
- storageKey has select:false on Mongoose schema AND is stripped in toJSON transform — NEVER exposed to clients
- Actual Appwrite integration (presigned upload, download URLs) = Phase 12 hardening task
- Current state: intern POSTs storageKey directly after uploading to Appwrite themselves (placeholder flow)

### Paper documents
- PHYSICAL_RECEIVED status exists so HR can mark paper documents handed in at desk without requiring digital upload
- System supports both digital and physical tracking simultaneously

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

# Phase 12 — Appwrite Storage (fill when implementing Phase 12)
APPWRITE_ENDPOINT=      # e.g. https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=
APPWRITE_BUCKET_ID=
APPWRITE_API_KEY=
```

Note: OBJECT_STORAGE_* vars in .env.example are outdated stubs. Replace with APPWRITE_* when implementing Phase 12. Update env.ts Zod schema accordingly.

---

## CURRENT FILE STRUCTURE

```
src/
├── config/
│   ├── env.ts              # Zod-validated env — add APPWRITE_* vars in Phase 12
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
│   └── geofence.ts         # haversineDistance + checkGeofence
├── modules/
│   ├── auth/               # auth.types, schema, service, controller, routes, google.controller
│   ├── users/              # user.model, user.types, users.schema, service, controller, routes
│   ├── interns/            # intern.types, model, schema, service, controller, routes
│   ├── departments/        # department.model, schema, service, controller, routes
│   ├── supervisors/        # supervisor.model, schema, service, controller, routes
│   ├── attendance/         # attendance.types, model, schema, service, controller, routes
│   ├── tasks/              # task.types, model, schema, service, controller, routes
│   ├── submissions/        # submission.model, schema, service, controller, routes
│   ├── reports/            # report.model, schema, service, controller, routes
│   ├── evaluations/        # evaluation.types, model, schema, service, controller, routes
│   ├── documents/          # document.types, model, schema, service, controller, routes
│   ├── notifications/      # STUB ONLY — routes file exists, empty
│   ├── timeline/           # STUB ONLY
│   ├── placements/         # STUB ONLY
│   └── ai/                 # STUB ONLY
├── app.ts                  # All routers mounted here
└── server.ts               # Entry point, connects DB, starts cleanup job
```

---

## ALL MOUNTED ROUTES (app.ts)

```
/api/v1/auth         — signup, login, refresh, logout, me, google, google/callback
/api/v1/users        — HR verification queue, approve, reject, list, get
/api/v1/interns      — create, list, me, get, update, assign/remove department+supervisor
/api/v1/departments  — create, list, get, update
/api/v1/supervisors  — create, list, me, get, update, /:id/interns
/api/v1/attendance   — check-in, list, get, correct
/api/v1/tasks        — create, list, get, update
/api/v1/submissions  — create, task/:taskId list, review
/api/v1/reports      — create, list, get, update, submit, review
/api/v1/evaluations  — create, list, get, update, submit
/api/v1/documents    — requirements CRUD, document records, physical/upload/review, checklist
```

---

## PHASES COMPLETE

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

---

## NEXT: PHASE 9 — NOTIFICATIONS

### What to build
- Notification model: recipient (User ref), type (enum), title, body, read (bool), relatedEntity (optional ref), createdAt
- Simple in-app notifications only — NO push, NO email yet (those are optional later)
- NO Redis/BullMQ — simple MongoDB records

### Notification types to support
```
ACCOUNT_APPROVED
ACCOUNT_REJECTED
SUPERVISOR_ASSIGNED
TASK_ASSIGNED
TASK_FEEDBACK
SUBMISSION_APPROVED
SUBMISSION_CHANGES_REQUESTED
EVALUATION_SUBMITTED
DOCUMENT_STATUS_CHANGED
REPORT_REVIEWED
```

### API
```
GET  /api/v1/notifications        — authenticated user's own notifications (paginated)
PATCH /api/v1/notifications/:id/read   — mark one as read
PATCH /api/v1/notifications/read-all  — mark all as read
```

### Key rules
- Notifications are private — user sees only their own
- Backend creates notifications internally (service calls from other services)
- No client can create notifications directly
- Export a createNotification(userId, type, title, body, relatedEntity?) utility function
  that other services call — e.g. auth.service calls it after approveUser

---

## PHASE 10 — TIMELINE, REPORTS & ADMIN HISTORY

- Intern timeline: aggregate events from existing records (attendance, tasks, reports, evaluations, document changes)
- Performance summaries: aggregate attendance + task completion + evaluations per intern
- Admin history: important HR actions (account approval/rejection, supervisor assignment, document status changes)
- No new models needed — read from existing collections and assemble

---

## PHASE 11 — INTERNSHIP COMPLETION & EXIT

- Exit checklist: outstanding tasks, pending documents, final evaluation
- completedAt field on Intern model, status → COMPLETED
- HR explicitly closes an internship
- History preserved — do NOT delete user or intern record

---

## PHASE 12 — HARDENING & PRODUCTION READINESS

### Key items
- Wire Appwrite Storage: implement presigned upload URLs, download URL generation
  Add APPWRITE_* env vars to env.ts Zod schema (currently placeholders)
- Rate limiting on auth routes (stricter than global 200/15min)
- Audit logging for critical HR actions
- Review all ownership checks
- Add .gitattributes to fix CRLF warnings on Windows

---

## PHASE 13 — API CONTRACT

- Document all endpoints, request/response shapes, role requirements, error codes
- Can be done as OpenAPI/Swagger or as a Markdown contract document

---

## IMPORTANT NOTES FOR NEW INSTANCE

1. Always run `npx tsc --noEmit` before committing — keep it at exit 0
2. CRLF warnings on git commit are harmless (Windows line endings) — ignore them
3. The PowerShell git push output shows exit code 1 but the push succeeds — the "error" is just PowerShell formatting the remote URL message. Confirm by checking `git log --oneline -1`
4. Do NOT use `insert` on tool writes — it caused file concatenation bugs in this session. Always use `create` for new files or `strReplace` for targeted edits
5. When app.ts import strReplace fails, read the exact current lines first before retrying
6. Supervisor deactivation auto-clears interns — this is intentional and documented
7. storageKey is NEVER sent to clients (select:false + toJSON strip) — maintain this in Phase 12
8. `getAuthUser(req)` helper in middleware/auth.ts extracts typed AuthenticatedUser from req.user — use this in all controllers instead of req.user directly
9. Role enum values: Role.HR, Role.SUPERVISOR, Role.INTERN (uppercase)
10. All business logic in services — controllers only parse input and call services
