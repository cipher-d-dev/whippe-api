# WHIPPE API PHASES

---

## AGENT STANDING RULE — ENV VARS & OUTSTANDING ITEMS

At the end of every phase the coding agent must produce an **OUTSTANDING ITEMS** section that lists:

1. Every new environment variable introduced in the phase — variable name, purpose, whether required or optional, and a placeholder value to add to `.env.example` and `.env`.
2. Any external credential or service that must be configured before the feature works (OAuth apps, object storage buckets, etc.).
3. Any decision that was deferred and what is needed to unblock it.

If a feature requires an env var or external credential that is not yet available, the agent must:
- Add the variable as a placeholder to `.env.example` and `.env` immediately.
- Note what the owner needs to fill in.
- Never silently skip the feature without documenting why.

---

## Purpose

This document defines the implementation phases for the Whippe backend API.

The API is the shared backend for:

- `whippe-web` — HR and Supervisor web application
- `whippe-intern` — Intern PWA

The API is responsible for:

- authentication and authorization
- business rules
- validation
- account and internship state
- data persistence
- relationships between interns, supervisors and departments
- attendance
- tasks and work records
- performance and evaluations
- documents
- notifications
- reports and timeline data
- internship completion and exit records

The web application and intern PWA must consume the API rather than implementing their own business rules.

---

# API BUILD PRINCIPLES

1. Build the API phase by phase.
2. Complete and verify the current phase before moving to the next.
3. Do not implement future features early unless required by the current phase.
4. Business rules belong in the API.
5. Frontends must not be treated as authoritative for permissions, account state, internship state or important workflow rules.
6. Validate incoming data at the API boundary.
7. Enforce role-based access on the backend.
8. Keep account status separate from internship status.
9. Keep physical/paper processes that AIT still requires representable in the digital system.
10. Store document metadata in MongoDB while actual files can use object storage.
11. Keep important administrative actions traceable.
12. Prefer simple infrastructure appropriate for the expected size of the internship programme.
13. Do not introduce Redis, queues, microservices, AI services or other infrastructure unless a real requirement calls for them.
14. Each phase must leave the API in a runnable and testable state.
15. Do not invent frontend requirements that are not defined by the Whippe product documents.

---

# PHASE 0 — API FOUNDATION

## Goal

Create the basic Express API foundation before implementing Whippe business functionality.

## Scope

Set up:

- Node.js
- TypeScript
- Express
- Mongoose
- MongoDB connection
- environment configuration
- application bootstrap
- server startup
- routing structure
- middleware structure
- centralized error handling
- request validation foundation
- logging foundation
- CORS configuration
- basic security middleware
- health-check endpoint
- API response/error conventions
- development and production scripts

## Expected result

The API can:

- start successfully
- connect to MongoDB
- respond to a health check
- load configuration safely
- handle errors consistently
- accept future modules without restructuring the project

No Whippe business-domain implementation should be completed in this phase.

---

# PHASE 1 — AUTHENTICATION, ACCOUNTS & ACCESS CONTROL

## Goal

Implement the foundation for user identity and access.

## Scope

Implement:

- user/account model
- account creation
- manual signup
- login
- logout/session handling
- password hashing
- authenticated-user retrieval
- Google authentication
- role handling
- authentication middleware
- authorization middleware
- protected routes

Initial roles:

- HR
- Supervisor
- Intern

Account state must be represented independently from internship state.

Account states should support the onboarding workflow, including:

- pending
- approved
- rejected
- expired/deleted as applicable

## Token Strategy

**Decided: JWT with HTTP-only cookie for the refresh token. No Redis.**

### Access token
- Format: JWT
- Lifetime: 15 minutes
- Storage: client app memory only (JS variable / React state)
- Transmission: `Authorization: Bearer <token>` header on every authenticated request
- Never stored in localStorage, sessionStorage, or a cookie
- Lost on page refresh — intentional; the refresh token recovers it

### Refresh token
- Format: JWT (or random opaque token)
- Lifetime: 7 days
- Client storage: HTTP-only, Secure, SameSite=Strict cookie — JS cannot read it
- Server storage: a SHA-256 hash of the raw token stored on the User document in MongoDB
- The raw token is never persisted anywhere on the server

### Token rotation (refresh)
Every call to `POST /auth/refresh`:
1. Reads the refresh token from the HTTP-only cookie
2. Hashes it and compares against the stored hash on the User document
3. On match: issues a new access token (in response body) and a new refresh token (new cookie + new hash replaces old hash in MongoDB)
4. On mismatch: rejects with 401 — token already used or tampered

This gives single-use refresh token semantics without Redis.

### Logout
1. Server nulls the stored refresh token hash on the User document
2. Server clears the HTTP-only cookie
3. Client discards the in-memory access token

The token is permanently invalid after logout even if someone captured the cookie value.

### Token storage summary

| What | Where | JS-readable |
|---|---|---|
| Access token | Client app memory | Yes (short-lived, intentional) |
| Refresh token (raw) | HTTP-only cookie | No |
| Refresh token (hash) | MongoDB User document | Server only |

### Password hashing
Use **bcrypt** (cost factor 12) for password hashing.
Argon2id is acceptable but bcrypt is the chosen default for simplicity.

### Environment variables required
- `JWT_SECRET` — signs both access and refresh tokens (min 32 chars)

## Important rule

Google authentication is only an authentication method.

A successful Google login does **not** automatically mean that the intern has been approved by HR.

The backend remains responsible for determining what an account is allowed to access.

## Expected result

The API can reliably determine:

- who the user is
- how the user authenticated
- what role the user has
- whether the account is allowed to access protected functionality

---

# PHASE 2 — INTERN REGISTRATION & HR ACCOUNT VERIFICATION

## Goal

Implement the digital onboarding flow that begins after physical screening at AIT.

## Workflow

The intended flow is:

1. Intern completes the required physical screening at AIT.
2. Intern creates an account through the Whippe intern application.
3. Intern may register using:
   - Google
   - manual account signup
4. The account enters a pending verification state.
5. HR reviews the account.
6. HR either:
   - approves the account
   - rejects the account
7. Approved accounts can proceed into the intern experience.
8. Rejected accounts cannot use protected intern functionality.
9. Accounts that remain unverified for 30 days are expired/deleted according to the account lifecycle rules.

## Scope

Implement backend support for:

- pending account verification
- HR verification queue
- account verification details
- HR approval
- HR rejection
- verification timestamps
- verification status
- rejection information where required
- account expiry handling
- deletion/cleanup of expired unverified accounts
- authorization around verification actions
- audit information for important HR actions

The API must enforce the 30-day rule.

The frontend must not be responsible for deciding whether an account has expired.

## Important separation

Account verification and internship status are different concepts.

For example:

```text
Account Status
    Pending
    Approved
    Rejected
    Expired/Deleted

Internship Status
    Not Started
    Active
    Ending/Completing
    Completed
```

The exact internship-state values should follow the established Whippe data model rather than being invented by the frontend.

## Expected result

HR can verify newly registered interns through the API, while unverified accounts remain restricted.

---

# PHASE 3 — INTERN PROFILE & INTERNSHIP RECORD

## Goal

Create the actual intern record used throughout the internship.

## Scope

Implement support for:

- intern profile
- personal information
- contact information
- school information
- course/programme information
- internship/placement information
- placement dates
- unit/department information
- internship status
- supervisor relationship
- profile updates
- HR access to intern records
- intern access to their own permitted information

The intern's account and internship record should remain logically separate.

An account identifies the user.

The internship record represents the person's participation in the AIT internship programme.

## Expected result

Whippe has a reliable digital intern record that later modules can reference.

---

# PHASE 4 — DEPARTMENTS, SUPERVISORS & INTERN ASSIGNMENTS

## Goal

Create the relationships between interns, supervisors and organisational units.

## Scope

Implement:

- department/unit records
- supervisor records
- supervisor information
- intern-supervisor assignments
- assignment status
- assignment history where required
- HR assignment and reassignment
- access restrictions based on assignments

## Access rules

HR can manage assignments.

Supervisors can access interns assigned to them.

Interns can access their own assignment information.

A supervisor must not automatically have access to every intern in the system.

The API must enforce this scope.

## Expected result

The system can reliably determine:

```text
Intern → Department/Unit
Intern → Supervisor
Supervisor → Assigned Interns
```

---

# PHASE 5 — ATTENDANCE

## Goal

Implement the attendance records used by HR, supervisors and interns.

## Scope

Implement:

- attendance records
- check-in
- check-out where applicable
- attendance date/time
- attendance status
- attendance history
- intern attendance view
- supervisor attendance access
- HR attendance access
- attendance summaries

The API should be authoritative for attendance timestamps and record validity.

The attendance implementation should support the Whippe concept of workplace attendance verification while allowing the approved attendance mechanism to evolve.

The system should also allow appropriate correction/administrative handling where the established workflow requires it.

## Expected result

Attendance becomes a structured digital record instead of information that HR has to manually calculate from separate records.

---

# PHASE 6 — TASKS, NOTES & DAILY WORK

## Goal

Support the actual work being assigned and completed during the internship.

## Scope

Implement:

- task creation
- task assignment
- task descriptions
- deadlines
- task status
- task submission
- supervisor review
- completion
- requests for changes where required
- task history
- intern notes
- personal to-do items
- daily work records/reports where applicable

The API must enforce who can:

- create tasks
- assign tasks
- update tasks
- submit work
- review work
- mark work complete

## Expected result

Supervisors can manage intern work through the API, while interns can see and update the work assigned to them.

---

# PHASE 7 — PERFORMANCE & SUPERVISOR EVALUATIONS

## Goal

Create the structured performance records used during the internship.

## Scope

Implement:

- evaluation records
- evaluation criteria
- supervisor feedback
- scores where applicable
- evaluation comments
- evaluation history
- HR access/review
- performance summaries

The API should preserve the actual evaluation records rather than replacing them with an automatically generated judgment.

AI-based summaries, if introduced later, must not replace the human supervisor or HR decision.

## Expected result

Whippe can maintain a structured performance record combining information such as:

- attendance
- task completion
- work reports
- supervisor feedback
- evaluations

---

# PHASE 8 — DOCUMENTS & DOCUMENT TRACKING

## Goal

Digitally track intern documents while allowing AIT to continue using physical documents where necessary.

## Scope

Implement:

- document records
- document types
- document status
- upload metadata
- document ownership
- document review
- document approval/status changes
- document history
- required-document tracking
- secure document access

The system should support documents such as:

- acceptance-related documents
- intern records
- required onboarding documents
- reports
- evaluation-related documents
- exit documents

Where actual files are stored outside MongoDB, MongoDB should contain the relevant metadata and storage reference.

## Important principle

Whippe does not need to force AIT to eliminate paper processes.

The API should allow a document or requirement to be digitally tracked even when the actual physical document remains part of the existing workflow.

## Expected result

HR can see what documents exist, what is missing and what has been processed without relying entirely on physical files.

---

# PHASE 9 — NOTIFICATIONS

## Goal

Provide a backend notification system for important events.

## Scope

Implement notification records and notification state.

Potential notification events include:

- account approval
- account rejection
- supervisor assignment
- task assignment
- task review
- evaluation events
- document status changes
- attendance-related events
- internship/exit reminders

The first implementation should remain simple.

Do not introduce a complex queue or notification infrastructure unless actual requirements justify it.

## Expected result

The API can create and expose notifications to the appropriate users.

External delivery methods such as email or push notifications can be added when required.

---

# PHASE 10 — INTERN TIMELINE, REPORTS & ADMINISTRATIVE HISTORY

## Goal

Provide the structured information needed for HR to understand an intern's complete internship history.

## Intern timeline

The API should expose important internship events such as:

- onboarding
- account verification
- document submission
- supervisor assignment
- attendance activity
- tasks
- work reports
- supervisor reviews
- evaluations
- completion
- exit

The timeline should be based on actual system records rather than duplicated manually entered information where possible.

## Reports

Support structured data for:

- intern records
- attendance summaries
- task/work summaries
- performance summaries
- document status
- internship status
- completion/exit information

HR should be able to retrieve/filter relevant records without manually combining information from separate systems.

## Administrative history

Important administrative changes should remain traceable.

Examples include:

- account approval/rejection
- supervisor assignment
- important profile changes
- evaluation actions
- document status changes
- internship completion/exit actions

## Expected result

The API provides the data required for HR dashboards, intern timelines and operational reporting.

---

# PHASE 11 — INTERNSHIP COMPLETION & EXIT

## Goal

Handle the end of an intern's placement.

## Scope

Implement support for:

- internship completion
- placement end dates
- final evaluation
- final report/status
- exit checklist
- outstanding requirements
- returned-property tracking where required
- final attendance/performance record
- exit records
- certificate/document generation metadata where required

The system should preserve the intern's historical record after completion.

Completing an internship must not mean deleting the user's entire account or internship history.

## Expected result

HR can move an intern from active placement through a controlled completion/exit process while retaining the internship record.

---

# PHASE 12 — API HARDENING & PRODUCTION READINESS

## Goal

Strengthen the API after the main business functionality exists.

## Scope

Review and harden:

- authentication security
- authorization
- validation
- error handling
- database constraints
- indexes
- uniqueness rules
- state transitions
- data integrity
- sensitive-data handling
- file access
- account expiry/cleanup
- auditability
- API logging
- configuration
- production environment handling

Test important workflows end-to-end.

Particular attention should be given to:

- signup
- login
- Google authentication
- HR account approval/rejection
- 30-day unverified-account handling
- role restrictions
- supervisor/intern access boundaries
- attendance
- task ownership
- document access
- internship completion

## Expected result

The API is stable enough to serve the actual Whippe applications rather than being merely a development prototype.

---

# PHASE 13 — API CONTRACT & FRONTEND INTEGRATION READINESS

## Goal

Freeze and document the API contract that `whippe-web` and `whippe-intern` will consume.

## Scope

Document and verify:

- endpoint structure
- HTTP methods
- authentication requirements
- role requirements
- request schemas
- response schemas
- validation errors
- common API errors
- pagination where applicable
- filtering where applicable
- sorting where applicable
- state values
- important business rules

The API should have stable contracts for the frontend applications.

The web and intern applications should not need to guess:

- what an endpoint accepts
- what it returns
- what state values mean
- which role can perform an action
- whether an account is allowed to perform an action

## Expected result

`whippe-web` and `whippe-intern` can be implemented against a clearly defined, stable API.

---

# PHASE DEPENDENCY

The intended implementation order is:

```text
Phase 0
   ↓
Phase 1
   ↓
Phase 2
   ↓
Phase 3
   ↓
Phase 4
   ↓
Phase 5
   ↓
Phase 6
   ↓
Phase 7
   ↓
Phase 8
   ↓
Phase 9
   ↓
Phase 10
   ↓
Phase 11
   ↓
Phase 12
   ↓
Phase 13
```

Some implementation details may be introduced earlier when technically required by a current phase, but future business functionality should not be implemented prematurely.

---

# API IMPLEMENTATION WORKFLOW

For every phase, the coding agent should:

1. Read this API phase document.
2. Read the relevant Whippe architecture/data documentation.
3. Inspect the current API repository.
4. Identify the requirements for the current phase.
5. Identify the files/modules that need to be created or changed.
6. Implement only the current phase.
7. Preserve existing functionality.
8. Add appropriate validation and authorization.
9. Test the affected functionality.
10. Verify the API still builds and starts.
11. Report what was implemented.
12. Report any ambiguity or requirement that needs a product decision.
13. Stop before implementing the next phase.

---

# DEFINITION OF DONE

An API phase is complete only when:

- its defined functionality is implemented
- relevant data models exist
- validation exists
- authorization exists where required
- business rules are enforced by the backend
- database operations work correctly
- errors are handled consistently
- affected workflows have been tested
- the API builds successfully
- the API starts successfully
- existing functionality still works
- no unrelated future phase has been implemented

---

# IMPORTANT AGENT RULE

Do not treat this document as permission to invent missing product requirements.

If an implementation detail is not defined by the Whippe documentation, the coding agent should identify the ambiguity instead of silently deciding a complex product rule.

The goal is to build the API that Whippe actually requires, not a generic enterprise internship-management backend.