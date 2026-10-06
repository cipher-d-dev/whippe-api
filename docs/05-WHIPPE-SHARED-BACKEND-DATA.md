# Whippe — Shared Backend and Data Architecture

## 1. Purpose

One Express API serves both Whippe Web and Whippe PWA.

The backend owns:

- authentication
- authorization
- business rules
- database access
- file access
- attendance verification
- notifications
- AI integration

---

# 2. Account and Intern Lifecycle

Account state and internship state are separate.

## Account status

```text
PENDING_HR_VERIFICATION
ACTIVE
REJECTED
```

Pending accounts carry:

```text
createdAt
verificationExpiresAt
verifiedAt
verifiedBy
rejectedAt
rejectedBy
```

`verificationExpiresAt` is 30 days after account creation.

Once HR verifies an account, the pending-account expiry no longer applies.

## Internship status

The intern record has its own lifecycle, for example:

```text
SCREENED
ONBOARDING
ACTIVE
COMPLETED
```

The exact final states should reflect AIT's confirmed process.

Do not combine account status and internship status into one field.

---

# 3. Physical Screening and Account Creation

Physical screening occurs before Whippe account activation.

The system must be able to associate the account created after screening with the appropriate AIT intern/screening record.

The exact matching method must be confirmed with AIT. Do not invent a particular identifier unless AIT requires it.

Supported signup methods:

- Google
- manual email/password signup

Both create a `PENDING_HR_VERIFICATION` account.

Google authentication is not AIT/HR verification.

Only HR/Admin can approve the account.

---

# 4. Core Models

Initial model set:

```text
User
Intern
Staff/Supervisor
Department
Placement
Document
DocumentRequirement
Attendance
Task
TaskSubmission
Report
Evaluation
Notification
AuditLog
```

Do not add a model unless a real domain requirement exists.

---

# 5. Relationships

Examples:

```text
User
 ├── Intern
 └── Staff/Supervisor

Intern
 ├── Department
 ├── Placement
 ├── Supervisor
 ├── Documents
 ├── Attendance
 ├── Tasks
 ├── Reports
 ├── Evaluations
 └── Timeline events

Task
 ├── creator
 ├── assigned intern
 ├── supervisor
 └── submissions
```

MongoDB is acceptable for these relationships.

Use Mongoose references and service-layer validation.

---

# 4. Authentication

The backend identifies the authenticated user.

It must not trust:

- role supplied by the client
- user ID supplied by the client for ownership checks
- supervisor identity supplied by the client

The authenticated identity comes from the validated session/token.

---

# 5. Authorization

Examples:

### HR
Can manage organisation-wide intern operations.

### Supervisor
Can access assigned interns.

### Intern
Can access only their own intern-facing data.

Authorization belongs in backend middleware/services.

---

# 6. API Domains

Initial domains:

```text
/auth
/users
/interns
/departments
/supervisors
/placements
/documents
/attendance
/tasks
/submissions
/reports
/evaluations
/notifications
/timeline
/ai
```

---

# 7. Files

Files live in object storage.

MongoDB stores:

- original filename
- storage key
- content type
- size
- related intern/document
- status
- upload metadata

Do not store large uploaded PDFs/images directly in MongoDB by default.

---

# 8. Attendance

A check-in request may include:

- authenticated user
- timestamp
- coordinates
- location accuracy
- QR token
- available device/browser information

Server-side signals may include network/IP information.

The server evaluates the configured rules.

Record:

- accepted
- rejected
- flagged
- manually corrected

A suspicious attempt should remain auditable.

---

# 9. Indexing

Add indexes for actual common queries, such as:

- intern status
- department
- supervisor
- internship end date
- attendance date + intern
- task assignee + status
- report intern + date
- notification recipient + read state

Do not blindly index every field.

---

# 10. Background Work

Do not install Redis/BullMQ initially.

When required, they may support:

- reminders
- notifications
- scheduled summaries
- internship-ending alerts

---

# 11. AI

AI lives behind the API.

```text
Client
  ↓
Express
  ↓
Authentication
  ↓
Authorization
  ↓
AI service
  ↓
Provider
```

No provider key is exposed to a browser.


---

# 12. Pending Account Cleanup

Pending accounts must not remain indefinitely.

The backend must identify:

```text
status = PENDING_HR_VERIFICATION
AND verificationExpiresAt <= now
```

and delete the expired pending account according to the approved retention policy.

The cleanup must not delete active/verified accounts.

The cleanup must be safe to run repeatedly.

Redis/BullMQ is not required for the initial implementation; a simple scheduled backend job is sufficient.

---

# 13. Verification Audit

HR approval/rejection should record:

- account
- HR user
- action
- timestamp
- reason where applicable

An account must never silently become active with no audit trail.
