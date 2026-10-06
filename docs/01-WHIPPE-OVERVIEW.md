# Whippe — Product Overview

## 1. Purpose

**Whippe** is AIT's internal intern management and operations platform.

Its purpose is to reduce the manual work involved in managing interns and NYSC IT personnel while preserving paper-based processes where AIT still needs them.

Whippe is not a replacement for AIT's entire HR system. It is focused specifically on the intern lifecycle:

> onboarding → assignment → attendance → work → supervision → evaluation → completion

AIT is expected to have approximately 100–200 interns/NYSC IT personnel. The system should therefore be reliable, secure and maintainable, but it should **not** be engineered like a massive enterprise platform.

---

# 2. Intern Onboarding Lifecycle

Whippe's intern onboarding begins **after the intern completes AIT's physical screening process**.

The account lifecycle is separate from the internship lifecycle.

```text
PHYSICAL SCREENING COMPLETED
        ↓
Intern is permitted to create/claim a Whippe account
        ↓
Google account OR manual account signup
        ↓
PENDING HR VERIFICATION
        ↓
HR approves or rejects the account
        ├── APPROVED → ACTIVE ACCOUNT
        └── REJECTED → ACCESS BLOCKED

Pending accounts that remain unverified for 30 days
        ↓
AUTOMATIC DELETION
```

Google authentication proves ownership of the Google account. It does **not** constitute AIT/HR verification.

A pending account has restricted access until HR verification. It is not a fully active intern account.

The 30-day expiry rule applies only while the account remains pending HR verification. Once approved, that pending-account expiry no longer applies.

Account status and internship status are separate concepts.

---

# 3. Functional Applications

Whippe has two user-facing applications.

## 2.1 Whippe Web

A desktop-first responsive web application used by:

- HR/Admin
- Supervisors

It is **one application**, not separate HR and Supervisor applications.

Role-based permissions determine what each user can see and do.

### HR

- Intern records
- Onboarding
- Document tracking
- Departments/placements
- Supervisor assignment
- Attendance monitoring
- Task/progress monitoring
- Reports
- Evaluations
- Documents/printing
- Internship exit/completion
- Operational dashboard
- Audit/security information where appropriate

### Supervisor

- Assigned interns
- Intern details relevant to supervision
- Tasks
- Task submissions
- Feedback
- Reports
- Evaluations
- Relevant attendance/progress

Supervisors must not receive HR-level access simply because they use the same application.

---

## 2.2 Whippe Intern PWA

A mobile-first Progressive Web App used by interns and NYSC IT personnel.

It avoids requiring App Store distribution or Android APK sideloading.

### Intern capabilities

- Authentication
- Dashboard
- Attendance/check-in
- Presence verification
- Tasks
- Task submissions
- Reports
- Notes
- Personal to-dos
- Notifications
- Internship timeline
- Relevant documents
- Optional AI assistance

A native React Native application is **not part of the initial build**.

It should only be considered later if real testing proves that browser/PWA capabilities are insufficient for required attendance or device-security behaviour.

---

# 4. Shared Backend

Both applications use one custom backend.

```text
Whippe Web ───────┐
                  │
                  ▼
           Express API
                  │
                  ▼
            MongoDB Atlas
                  ▲
                  │
Whippe PWA ───────┘
```

The clients never connect directly to MongoDB.

All important business rules are enforced by the backend.

---

# 5. Agreed Stack

## Repository

- Git
- pnpm workspaces
- Simple monorepo
- No Turborepo initially
- No Nx initially

The purpose of the monorepo is simply to keep the applications and shared packages together.

## Web

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Recharts only where useful

## Intern PWA

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui where useful
- TanStack Query
- PWA/service-worker support

The PWA is a separate application because it has a different user experience, even though it shares the same backend.

## Backend

- Node.js
- TypeScript
- Express
- Mongoose
- MongoDB Atlas
- Zod

## Authentication

- Secure HTTP-only cookie/session approach is preferred for browser clients.
- Passwords must use Argon2id or bcrypt.
- Backend owns role/permission checks.

The exact session implementation can be selected during Phase 0, but it must not expose sensitive authentication material to client-side JavaScript unnecessarily.

## Files

Use an S3-compatible object-storage provider for uploaded documents/files.

MongoDB stores file metadata and storage references, not large file contents.

## Later/Optional Infrastructure

Only introduce these when an actual requirement exists:

- Redis
- BullMQ
- Push notification transport
- AI provider
- Native React Native client

Do not add them to Phase 0.

---

# 6. Core Product Areas

1. Authentication and authorization
2. Intern records
3. Departments and placements
4. Supervisor assignment
5. Onboarding
6. Documents
7. Attendance
8. Tasks
9. Task submissions
10. Reports
11. Evaluations
12. Notifications
13. Internship timeline
14. Exit/completion
15. Dashboard/reporting
16. Audit/security
17. Optional AI assistance

---

# 7. Build Philosophy

Whippe is built **application-by-application using vertical slices**.

This does not mean:

> finish every frontend screen → then build backend → then connect everything.

Instead:

> foundation → backend capability → application UI → permissions → tests → usable workflow

Each phase must produce something concrete.

---

# 8. Application Build Order

### Stage 1
Repository + backend foundation + Web foundation + PWA foundation.

### Stage 2
Web HR core:
- intern records
- departments
- supervisors
- onboarding
- documents

### Stage 3
Web supervisor workflow:
- supervisor workspace
- tasks
- submissions

### Stage 4
PWA intern workflow:
- dashboard
- tasks
- submissions
- reports

### Stage 5
Attendance:
- backend verification
- PWA check-in
- HR monitoring

### Stage 6
Completion:
- evaluations
- exit
- timeline
- completion

### Stage 7
Operational refinement:
- notifications
- document generation
- reporting
- hardening

### Stage 8
Optional AI.

---

# 9. Product Rules

## Paper processes

Do not force AIT to abandon paper.

Whippe should be able to record:

- digital document received
- physical document received
- pending
- verified
- rejected

## Attendance

Do not use continuous hourly GPS tracking as the default.

Use a layered verification approach:

- location/geofence
- rotating QR where appropriate
- timestamp
- GPS accuracy
- network/IP risk
- VPN/proxy risk
- available browser/device signals
- mock-location indicators where technically available
- anomaly/flagging
- controlled HR correction

No single signal should be treated as perfect proof.

## AI

AI is an assistant.

It can summarize, explain, organize and draft.

It should not:

- secretly listen to conversations
- secretly monitor interns
- make unexplained final performance decisions
- bypass permissions

## Scale

Do not add:

- microservices
- Kubernetes
- Kafka
- multiple databases
- complex distributed caching

unless a real requirement appears.

---

# 10. Definition of Done

A feature is not complete because its UI exists.

It is complete when:

- backend capability exists
- validation exists
- authorization exists
- data persists correctly
- UI uses the real API
- loading/error/empty states exist
- important edge cases are handled
- relevant tests pass
- existing workflows remain functional
