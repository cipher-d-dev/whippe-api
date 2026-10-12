# Whippe API — Contract Document

**Version:** 1.0  
**Base URL:** `https://your-api-domain.com/api/v1`  
**Local dev:** `http://localhost:5000/api/v1`

---

## Table of Contents

1. [Foundations](#1-foundations)
   - [Authentication flow](#11-authentication-flow)
   - [Response envelope](#12-response-envelope)
   - [Pagination](#13-pagination)
   - [Common errors](#14-common-errors)
2. [Enums](#2-enums)
3. [Auth — `/auth`](#3-auth)
4. [Users — `/users`](#4-users)
5. [Interns — `/interns`](#5-interns)
6. [Departments — `/departments`](#6-departments)
7. [Supervisors — `/supervisors`](#7-supervisors)
8. [Attendance — `/attendance`](#8-attendance)
9. [Tasks — `/tasks`](#9-tasks)
10. [Submissions — `/submissions`](#10-submissions)
11. [Reports — `/reports`](#11-reports)
12. [Evaluations — `/evaluations`](#12-evaluations)
13. [Documents — `/documents`](#13-documents)
14. [Notifications — `/notifications`](#14-notifications)
15. [Timeline & Summary — `/interns/:id/timeline`, `/interns/:id/summary`](#15-timeline--summary)
16. [Admin History — `/admin/history`](#16-admin-history)

---

## 1. Foundations

### 1.1 Authentication flow

Whippe uses **JWT** with two tokens:

| Token | Lifetime | Where stored | How sent |
|---|---|---|---|
| Access token | 15 minutes | Client memory (JS variable) | `Authorization: Bearer <token>` header |
| Refresh token | 7 days | HTTP-only SameSite=Strict cookie | Automatic (browser sends cookie) |

**Never** store the access token in `localStorage` or `sessionStorage`.

**Acquiring tokens:**
1. `POST /auth/signup` or `POST /auth/login` → returns `accessToken` in body + sets refresh cookie
2. When access token expires, call `POST /auth/refresh` → returns new `accessToken` + rotates refresh cookie
3. On logout, call `POST /auth/logout` → server invalidates refresh token

**Sending the access token:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Roles:** `HR` · `SUPERVISOR` · `INTERN`  
Role is encoded in the JWT — the server always enforces it, never trust the client.

---

### 1.2 Response envelope

All endpoints return JSON. Successful responses:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

List endpoints add pagination fields at the top level:

```json
{
  "success": true,
  "data": [ ... ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

Error responses:

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

Validation errors (422):

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

---

### 1.3 Pagination

List endpoints accept these query parameters:

| Param | Type | Default | Max | Description |
|---|---|---|---|---|
| `page` | integer | `1` | — | Page number (1-indexed) |
| `limit` | integer | `20` | `100` | Results per page |

Response always includes `total`, `page`, `limit`, `totalPages`.

---

### 1.4 Common errors

| Status | When |
|---|---|
| `400` | Invalid input, malformed ID, bad request body |
| `401` | Missing or expired access token |
| `403` | Authenticated but not authorised for this action/resource |
| `404` | Resource not found |
| `409` | Conflict — duplicate, wrong state transition |
| `422` | Validation error (Zod) or business rule violation |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## 2. Enums

### Account status (`AccountStatus`)
| Value | Meaning |
|---|---|
| `PENDING_HR_VERIFICATION` | Account created, awaiting HR approval |
| `ACTIVE` | HR approved — full access |
| `REJECTED` | HR rejected — access blocked |

### Role
| Value | Who |
|---|---|
| `HR` | HR/Admin staff |
| `SUPERVISOR` | Intern supervisors |
| `INTERN` | Interns and NYSC IT personnel |

### Auth method
| Value | Meaning |
|---|---|
| `PASSWORD` | Email + password signup |
| `GOOGLE` | Google OAuth |

### Internship type (`InternshipType`)
| Value | Meaning |
|---|---|
| `INTERNSHIP` | Standard student placement |
| `NYSC_IT` | NYSC IT personnel |

### Internship status (`InternshipStatus`)
| Value | Meaning |
|---|---|
| `SCREENED` | Physical screening done, not yet onboarding |
| `ONBOARDING` | Account approved, completing requirements |
| `ACTIVE` | Fully active placement |
| `COMPLETED` | Internship ended — HR closed it |

### Attendance status (`AttendanceStatus`)
| Value | Meaning |
|---|---|
| `ACCEPTED` | Valid check-in/out |
| `FLAGGED` | Passed but suspicious — HR review needed |
| `REJECTED` | Failed server-side verification |
| `CORRECTED` | HR manually corrected the record |

### Check type (`CheckType`)
| Value | Meaning |
|---|---|
| `CHECK_IN` | Morning check-in |
| `CHECK_OUT` | End-of-day check-out |

### Task status (`TaskStatus`)
| Value | Meaning |
|---|---|
| `TODO` | Assigned, not started |
| `IN_PROGRESS` | Intern started work |
| `SUBMITTED` | Intern submitted work |
| `CHANGES_REQUESTED` | Supervisor requested changes |
| `COMPLETED` | Supervisor approved |

### Submission status (`SubmissionStatus`)
| Value | Meaning |
|---|---|
| `PENDING_REVIEW` | Submitted, awaiting review |
| `CHANGES_REQUESTED` | Supervisor requested changes |
| `APPROVED` | Supervisor approved |

### Report type (`ReportType`)
| Value | Meaning |
|---|---|
| `DAILY` | Daily work report |
| `WEEKLY` | Weekly summary |

### Report status (`ReportStatus`)
| Value | Meaning |
|---|---|
| `DRAFT` | Not yet submitted |
| `SUBMITTED` | Submitted for review |
| `REVIEWED` | Supervisor/HR reviewed |

### Evaluation status (`EvaluationStatus`)
| Value | Meaning |
|---|---|
| `DRAFT` | Supervisor still filling it in |
| `SUBMITTED` | Submitted — visible to intern |

### Document type (`DocumentType`)
| Value | Meaning |
|---|---|
| `ACCEPTANCE_LETTER` | — |
| `GUARANTOR_FORM` | — |
| `IDENTIFICATION` | — |
| `SCHOOL_LETTER` | — |
| `NYSC_CALL_UP` | — |
| `REPORT` | — |
| `EVALUATION` | — |
| `EXIT_DOCUMENT` | — |
| `OTHER` | — |

### Document status (`DocumentStatus`)
| Value | Meaning |
|---|---|
| `PENDING` | Not yet submitted |
| `DIGITAL_RECEIVED` | File uploaded |
| `PHYSICAL_RECEIVED` | Physical copy handed to HR |
| `VERIFIED` | HR accepted |
| `REJECTED` | HR rejected — needs resubmission |

### Notification type (`NotificationType`)
| Value | Triggered when |
|---|---|
| `ACCOUNT_APPROVED` | HR approves account |
| `ACCOUNT_REJECTED` | HR rejects account |
| `SUPERVISOR_ASSIGNED` | HR assigns supervisor to intern |
| `TASK_ASSIGNED` | Supervisor creates task for intern |
| `TASK_FEEDBACK` | Supervisor adds feedback to task |
| `SUBMISSION_APPROVED` | Supervisor approves submission |
| `SUBMISSION_CHANGES_REQUESTED` | Supervisor requests changes |
| `EVALUATION_SUBMITTED` | Supervisor submits evaluation |
| `DOCUMENT_STATUS_CHANGED` | HR reviews a document |
| `REPORT_REVIEWED` | Supervisor/HR reviews a report |

### Audit action (`AuditAction`)
| Value | When recorded |
|---|---|
| `ACCOUNT_APPROVED` | HR approves account |
| `ACCOUNT_REJECTED` | HR rejects account |
| `SUPERVISOR_ASSIGNED` | HR assigns supervisor |
| `SUPERVISOR_REMOVED` | HR removes supervisor |
| `DEPARTMENT_ASSIGNED` | HR assigns department |
| `DEPARTMENT_REMOVED` | HR removes department |
| `DOCUMENT_REVIEWED` | HR reviews document |
| `INTERNSHIP_COMPLETED` | HR completes internship |

---

## 3. Auth

> Rate limit: **15 requests per 15 minutes per IP** on signup, login, refresh.

---

### POST /auth/signup

Create a new account. Account enters `PENDING_HR_VERIFICATION` — HR must approve before full access is granted.

**Auth:** None

**Request body:**
```json
{
  "email": "intern@example.com",
  "password": "minLength8",
  "firstName": "Ada",
  "lastName": "Okafor",
  "role": "INTERN"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | Must be a valid email |
| `password` | string | Yes | Min 8 characters |
| `firstName` | string | Yes | — |
| `lastName` | string | Yes | — |
| `role` | `Role` | Yes | `INTERN` or `SUPERVISOR` |

**Response `201`:**
```json
{
  "success": true,
  "message": "Account created. Awaiting HR verification.",
  "data": {
    "user": { ...UserObject },
    "accessToken": "eyJ..."
  }
}
```
Refresh token is set as an HTTP-only cookie.

**Errors:** `409` email already exists · `422` validation error

---

### POST /auth/login

**Auth:** None

**Request body:**
```json
{
  "email": "intern@example.com",
  "password": "password123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": { ...UserObject },
    "accessToken": "eyJ..."
  }
}
```

**Errors:** `400` account uses Google sign-in · `401` invalid credentials · `403` account rejected

---

### POST /auth/refresh

Rotates both tokens. The current refresh token (cookie) is invalidated and replaced.

**Auth:** Refresh cookie (automatic)

**Request body:** None

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ..."
  }
}
```

**Errors:** `401` invalid/expired/reused refresh token

---

### POST /auth/logout

Invalidates the refresh token server-side. Client should discard the access token from memory.

**Auth:** Bearer token

**Response `200`:**
```json
{ "success": true, "message": "Logged out successfully." }
```

---

### GET /auth/me

Returns the authenticated user's account.

**Auth:** Bearer token

**Response `200`:**
```json
{
  "success": true,
  "data": { "user": { ...UserObject } }
}
```

---

### GET /auth/google

Redirects the browser to Google's OAuth consent screen.

**Auth:** None  
**Response:** `302` redirect

---

### GET /auth/google/callback

Google redirects here after consent. Server issues tokens and redirects to:

```
FRONTEND_URL/auth/google/success#token=<accessToken>
```

The access token is in the URL fragment (never hits the server). Refresh token is set as an HTTP-only cookie.

**Auth:** None (Google-provided code)

---

### UserObject shape

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "email": "intern@example.com",
  "firstName": "Ada",
  "lastName": "Okafor",
  "role": "INTERN",
  "status": "PENDING_HR_VERIFICATION",
  "authMethod": "PASSWORD",
  "verificationExpiresAt": "2026-11-11T10:00:00.000Z",
  "verifiedAt": null,
  "verifiedBy": null,
  "rejectedAt": null,
  "rejectedBy": null,
  "rejectionReason": null,
  "createdAt": "2026-10-12T10:00:00.000Z",
  "updatedAt": "2026-10-12T10:00:00.000Z"
}
```

> `passwordHash` and `refreshTokenHash` are **never** returned.

---

## 4. Users

> All routes require authentication.

---

### GET /users/verification-queue

Returns accounts awaiting HR verification, oldest first.

**Auth:** Bearer token  
**Roles:** `HR`  
**Query params:** `page`, `limit`

**Response `200`:** paginated list of `UserObject`

---

### GET /users

List all users with optional filters.

**Auth:** Bearer token  
**Roles:** `HR`  
**Query params:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | — |
| `limit` | integer | — |
| `status` | `AccountStatus` | Filter by status |
| `role` | `Role` | Filter by role |

**Response `200`:** paginated list of `UserObject`

---

### GET /users/:userId

**Auth:** Bearer token  
**Roles:** Any authenticated user  
**Notes:** Interns and supervisors can only fetch their own user record (enforced in controller).

**Response `200`:**
```json
{ "success": true, "data": { "user": { ...UserObject } } }
```

**Errors:** `400` invalid ID · `403` not own record · `404` not found

---

### PATCH /users/:userId/approve

Approve a pending account. Sets `status → ACTIVE`. Sends notification to user. Creates audit log entry.

**Auth:** Bearer token  
**Roles:** `HR`

**Response `200`:**
```json
{ "success": true, "message": "User approved.", "data": { "user": { ...UserObject } } }
```

**Errors:** `404` user not found · `409` account not in `PENDING_HR_VERIFICATION` state

---

### PATCH /users/:userId/reject

Reject a pending account. Sets `status → REJECTED`. Requires a reason. Sends notification. Creates audit log entry.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{ "reason": "Could not verify name against screened list." }
```

**Response `200`:**
```json
{ "success": true, "message": "User rejected.", "data": { "user": { ...UserObject } } }
```

**Errors:** `404` · `409` wrong state

---

## 5. Interns

> All routes require authentication.

---

### POST /interns

Create an intern record for an existing approved user.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{
  "userId": "64f1...",
  "firstName": "Ada",
  "lastName": "Okafor",
  "phone": "08012345678",
  "address": "12 Marina, Lagos",
  "institution": "University of Lagos",
  "course": "Computer Science",
  "level": "300L",
  "internshipType": "INTERNSHIP",
  "status": "ONBOARDING",
  "startDate": "2026-10-01",
  "endDate": "2027-03-31"
}
```

| Field | Required | Notes |
|---|---|---|
| `userId` | Yes | Must be an approved `INTERN` account |
| `firstName`, `lastName` | Yes | — |
| `institution`, `course` | Yes | — |
| `internshipType` | Yes | `INTERNSHIP` or `NYSC_IT` |
| `status` | No | Defaults to `SCREENED` |
| `phone`, `address`, `level`, `startDate`, `endDate` | No | — |

**Response `201`:**
```json
{ "success": true, "data": { "intern": { ...InternObject } } }
```

**Errors:** `404` user not found · `409` intern record already exists or user not active/not INTERN role

---

### GET /interns

List intern records.

**Auth:** Bearer token  
**Roles:** `HR`  
**Query params:**

| Param | Type | Description |
|---|---|---|
| `page`, `limit` | integer | Pagination |
| `status` | `InternshipStatus` | Filter |
| `internshipType` | `InternshipType` | Filter |
| `department` | ID string | Filter by department |
| `supervisor` | ID string | Filter by supervisor |
| `search` | string | Search firstName, lastName, institution, course |

**Response `200`:** paginated list of `InternObject`

---

### GET /interns/me

Returns the authenticated intern's own record.

**Auth:** Bearer token  
**Roles:** `INTERN`

**Response `200`:**
```json
{ "success": true, "data": { "intern": { ...InternObject } } }
```

---

### GET /interns/:id

**Auth:** Bearer token  
**Roles:** `HR`, `INTERN` (intern can only fetch own record)

**Response `200`:**
```json
{ "success": true, "data": { "intern": { ...InternObject } } }
```

---

### PATCH /interns/:id

Update intern record. Interns can only update a subset of fields.

**Auth:** Bearer token  
**Roles:** `HR`, `INTERN`

**Intern-permitted fields:** `phone`, `address`, `institution`, `course`, `level`  
**HR can also update:** `status`, `startDate`, `endDate`, `internshipType`

**Response `200`:**
```json
{ "success": true, "data": { "intern": { ...InternObject } } }
```

---

### PUT /interns/:id/department

Assign a department to an intern.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{ "departmentId": "64f1..." }
```

**Response `200`:**
```json
{ "success": true, "message": "Department assigned.", "data": { "intern": { ...InternObject } } }
```

---

### DELETE /interns/:id/department

Remove department assignment.

**Auth:** Bearer token  
**Roles:** `HR`

**Response `200`:**
```json
{ "success": true, "message": "Department removed.", "data": { "intern": { ...InternObject } } }
```

---

### PUT /interns/:id/supervisor

Assign a supervisor to an intern. Sends notification to intern. Creates audit log entry.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{ "supervisorId": "64f1..." }
```

**Response `200`:**
```json
{ "success": true, "message": "Supervisor assigned.", "data": { "intern": { ...InternObject } } }
```

---

### DELETE /interns/:id/supervisor

Remove supervisor assignment. Creates audit log entry.

**Auth:** Bearer token  
**Roles:** `HR`

**Response `200`:**
```json
{ "success": true, "message": "Supervisor removed.", "data": { "intern": { ...InternObject } } }
```

---

### GET /interns/:id/exit-checklist

Returns a structured checklist of outstanding items before the internship can be completed.

**Auth:** Bearer token  
**Roles:** `HR`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "checklist": {
      "internId": "64f1...",
      "internName": "Ada Okafor",
      "canComplete": false,
      "items": [
        { "label": "All tasks resolved", "passed": true },
        { "label": "No required documents pending submission", "passed": false, "detail": "2 document(s) not yet submitted" },
        { "label": "At least one evaluation submitted", "passed": true }
      ]
    }
  }
}
```

**Errors:** `409` internship already completed

---

### POST /interns/:id/complete

HR explicitly closes an internship. Sets `status → COMPLETED`. Fails if checklist has outstanding items. Creates audit log entry.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{ "completionNote": "Excellent performance throughout." }
```

| Field | Required | Notes |
|---|---|---|
| `completionNote` | No | Max 1000 chars |

**Response `200`:**
```json
{
  "success": true,
  "message": "Internship for Ada Okafor has been completed.",
  "data": {
    "internId": "64f1...",
    "internName": "Ada Okafor",
    "completedAt": "2026-10-12T13:00:00.000Z",
    "status": "COMPLETED"
  }
}
```

**Errors:** `409` already completed · `422` checklist items outstanding (message lists which)

---

### InternObject shape

```json
{
  "id": "64f1...",
  "user": { "id": "...", "email": "intern@example.com", "role": "INTERN", "status": "ACTIVE" },
  "firstName": "Ada",
  "lastName": "Okafor",
  "phone": "08012345678",
  "address": "12 Marina, Lagos",
  "institution": "University of Lagos",
  "course": "Computer Science",
  "level": "300L",
  "internshipType": "INTERNSHIP",
  "status": "ACTIVE",
  "startDate": "2026-10-01T00:00:00.000Z",
  "endDate": "2027-03-31T00:00:00.000Z",
  "completedAt": null,
  "completionNote": null,
  "department": { "id": "...", "name": "News", "subsidiary": "AIT" },
  "supervisor": { "id": "...", "firstName": "Emeka", "lastName": "Eze" },
  "createdAt": "2026-10-01T10:00:00.000Z",
  "updatedAt": "2026-10-12T10:00:00.000Z"
}
```

---

## 6. Departments

> All routes require authentication.

---

### POST /departments

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{
  "name": "News",
  "subsidiary": "AIT",
  "description": "TV news production team"
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Must be unique |
| `subsidiary` | No | e.g. `"AIT"`, `"Raypower"`, `"Faaji"`, `"Corporate"` |
| `description` | No | — |

**Response `201`:**
```json
{ "success": true, "data": { "department": { ...DepartmentObject } } }
```

---

### GET /departments

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`  
**Query params:** `page`, `limit`, `isActive` (boolean)

**Response `200`:** paginated list of `DepartmentObject`

---

### GET /departments/:id

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

---

### PATCH /departments/:id

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:** any subset of `name`, `subsidiary`, `description`, `isActive`

---

### DepartmentObject shape

```json
{
  "id": "64f1...",
  "name": "News",
  "subsidiary": "AIT",
  "description": "TV news production team",
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 7. Supervisors

> All routes require authentication.

---

### POST /supervisors

Create a supervisor profile for an existing `SUPERVISOR` role user.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{
  "userId": "64f1...",
  "firstName": "Emeka",
  "lastName": "Eze",
  "phone": "08098765432",
  "department": "64f1..."
}
```

| Field | Required |
|---|---|
| `userId` | Yes — must be an active `SUPERVISOR` account |
| `firstName`, `lastName` | Yes |
| `phone`, `department` | No |

**Response `201`:**
```json
{ "success": true, "data": { "supervisor": { ...SupervisorObject } } }
```

---

### GET /supervisors

**Auth:** Bearer token  
**Roles:** `HR`  
**Query params:** `page`, `limit`, `department` (ID), `isActive` (boolean)

---

### GET /supervisors/me

**Auth:** Bearer token  
**Roles:** `SUPERVISOR`

---

### GET /supervisors/:id

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR` (supervisor can only fetch own profile)

---

### PATCH /supervisors/:id

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:** any subset of `firstName`, `lastName`, `phone`, `department`, `isActive`

> **Important:** Setting `isActive: false` automatically clears `supervisor` from all assigned interns. HR must reassign them.

---

### GET /supervisors/:id/interns

Returns interns assigned to this supervisor.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR` (supervisor can only see own interns)

**Response `200`:**
```json
{ "success": true, "data": { "interns": [ ...InternObject ] } }
```

---

### SupervisorObject shape

```json
{
  "id": "64f1...",
  "user": { "id": "...", "email": "supervisor@example.com" },
  "firstName": "Emeka",
  "lastName": "Eze",
  "phone": "08098765432",
  "department": { "id": "...", "name": "News", "subsidiary": "AIT" },
  "isActive": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 8. Attendance

> All routes require authentication.

---

### POST /attendance/check-in

Intern submits a check-in or check-out. Server validates location against the DAAR Communications HQ geofence.

**Auth:** Bearer token  
**Roles:** `INTERN`

**Request body:**
```json
{
  "checkType": "CHECK_IN",
  "latitude": 6.4281,
  "longitude": 3.4219,
  "locationAccuracy": 15
}
```

| Field | Required | Notes |
|---|---|---|
| `checkType` | Yes | `CHECK_IN` or `CHECK_OUT` |
| `latitude` | Yes | Decimal degrees |
| `longitude` | Yes | Decimal degrees |
| `locationAccuracy` | No | Metres — poor accuracy (>50m) causes `FLAGGED` |

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "attendance": {
      "id": "...",
      "intern": "...",
      "date": "2026-10-12T00:00:00.000Z",
      "checkType": "CHECK_IN",
      "status": "ACCEPTED",
      "submittedAt": "2026-10-12T08:01:00.000Z",
      "distanceFromOffice": 42,
      "withinGeofence": true,
      "flagReasons": []
    }
  }
}
```

**Status rules:**
- `ACCEPTED` — within geofence, good accuracy
- `FLAGGED` — within geofence but `locationAccuracy > 50m`
- `REJECTED` — outside geofence

**Errors:** `409` already checked in/out today

---

### GET /attendance

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (intern sees only own records)  
**Query params:** `page`, `limit`, `intern` (ID, HR only), `status` (`AttendanceStatus`), `checkType`, `date` (ISO date string)

---

### GET /attendance/:id

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (ownership enforced)

---

### PATCH /attendance/:id/correct

HR manually corrects a flagged or rejected record.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{
  "status": "ACCEPTED",
  "correctionNote": "Confirmed intern was present — GPS signal issue."
}
```

**Response `200`:**
```json
{ "success": true, "data": { "attendance": { ...AttendanceObject } } }
```

---

## 9. Tasks

> All routes require authentication.

---

### POST /tasks

Create and assign a task to an intern.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`

**Request body:**
```json
{
  "title": "Write news script",
  "description": "Draft a 2-minute TV news script on the Lagos flood story.",
  "internId": "64f1...",
  "deadline": "2026-10-20T17:00:00.000Z"
}
```

| Field | Required |
|---|---|
| `title` | Yes — max 200 chars |
| `description` | Yes |
| `internId` | Yes |
| `deadline` | No |

> Supervisors can only assign tasks to their own interns.

**Response `201`:**
```json
{ "success": true, "data": { "task": { ...TaskObject } } }
```

---

### GET /tasks

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`  
**Query params:** `page`, `limit`, `status` (`TaskStatus`), `intern` (ID, HR only), `supervisor` (ID, HR only)

> - Interns see only their own tasks
> - Supervisors see only tasks they created
> - HR sees all

---

### GET /tasks/:id

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

---

### PATCH /tasks/:id

Update a task.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

**Intern can only update:** `status` → `IN_PROGRESS` only  
**Supervisor can update:** `title`, `description`, `deadline`, `status` (not `SUBMITTED`), `feedback`  
**HR can update:** all fields

**Response `200`:**
```json
{ "success": true, "data": { "task": { ...TaskObject } } }
```

---

### TaskObject shape

```json
{
  "id": "...",
  "title": "Write news script",
  "description": "Draft a 2-minute TV news script.",
  "intern": { "id": "...", "firstName": "Ada", "lastName": "Okafor" },
  "supervisor": { "id": "...", "firstName": "Emeka", "lastName": "Eze" },
  "createdBy": "...",
  "status": "TODO",
  "deadline": "2026-10-20T17:00:00.000Z",
  "feedback": null,
  "completedAt": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 10. Submissions

> All routes require authentication.

---

### POST /submissions

Intern submits work for a task. Sets task `status → SUBMITTED`.

**Auth:** Bearer token  
**Roles:** `INTERN`

**Request body:**
```json
{
  "taskId": "64f1...",
  "content": "Here is my completed news script: ..."
}
```

**Response `201`:**
```json
{ "success": true, "data": { "submission": { ...SubmissionObject } } }
```

**Errors:** `403` task not assigned to this intern · `409` task already completed

---

### GET /submissions/task/:taskId

List all submissions for a task.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

**Response `200`:**
```json
{ "success": true, "data": { "submissions": [ ...SubmissionObject ] } }
```

---

### PATCH /submissions/:id/review

Supervisor reviews a submission.

**Auth:** Bearer token  
**Roles:** `SUPERVISOR`

**Request body:**
```json
{
  "status": "APPROVED",
  "feedback": "Great work, well structured."
}
```

| Field | Required | Notes |
|---|---|---|
| `status` | Yes | `APPROVED` or `CHANGES_REQUESTED` |
| `feedback` | No | — |

**Effect:**
- `APPROVED` → task `status → COMPLETED`, `completedAt` set
- `CHANGES_REQUESTED` → task `status → CHANGES_REQUESTED`

**Response `200`:**
```json
{ "success": true, "data": { "submission": { ...SubmissionObject } } }
```

---

## 11. Reports

> All routes require authentication.

---

### POST /reports

Intern creates a report (saved as `DRAFT`).

**Auth:** Bearer token  
**Roles:** `INTERN`

**Request body:**
```json
{
  "type": "DAILY",
  "title": "Work report — 12 Oct 2026",
  "content": "Today I worked on the news script assignment...",
  "periodStart": "2026-10-12",
  "periodEnd": "2026-10-12"
}
```

**Response `201`:**
```json
{ "success": true, "data": { "report": { ...ReportObject } } }
```

---

### GET /reports

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (intern sees own only)  
**Query params:** `page`, `limit`, `status` (`ReportStatus`), `type` (`ReportType`), `intern` (ID, HR/supervisor)

---

### GET /reports/:id

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

---

### PATCH /reports/:id

Update a draft report. Only works while `status = DRAFT`.

**Auth:** Bearer token  
**Roles:** `INTERN` (own reports only)

---

### POST /reports/:id/submit

Submit a draft report. Sets `status → SUBMITTED`.

**Auth:** Bearer token  
**Roles:** `INTERN` (own reports only)

**Response `200`:**
```json
{ "success": true, "data": { "report": { ...ReportObject } } }
```

**Errors:** `409` already submitted or reviewed

---

### PATCH /reports/:id/review

Review a submitted report.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`

**Request body:**
```json
{ "feedback": "Good report, clearly written." }
```

**Response `200`:**
```json
{ "success": true, "data": { "report": { ...ReportObject } } }
```

**Errors:** `409` report not in `SUBMITTED` state

---

## 12. Evaluations

> All routes require authentication.

---

### POST /evaluations

Supervisor creates an evaluation for an assigned intern (saved as `DRAFT`).

**Auth:** Bearer token  
**Roles:** `SUPERVISOR`

**Request body:**
```json
{
  "internId": "64f1...",
  "scores": {
    "workQuality": 4,
    "reliability": 5,
    "communication": 4,
    "learningProgress": 4,
    "professionalism": 5
  },
  "comments": "Ada has shown excellent initiative and strong communication skills."
}
```

All scores: integer **1–5** (1 = poor, 5 = excellent).  
`comments`: required.

**Response `201`:**
```json
{ "success": true, "data": { "evaluation": { ...EvaluationObject } } }
```

---

### GET /evaluations

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`  
**Query params:** `page`, `limit`, `status`, `intern` (ID), `supervisor` (ID)

> Interns only see `SUBMITTED` evaluations for themselves.

---

### GET /evaluations/:id

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (intern only sees submitted, own)

---

### PATCH /evaluations/:id

Update a draft evaluation. Only while `status = DRAFT`.

**Auth:** Bearer token  
**Roles:** `SUPERVISOR` (own evaluations only)

**Request body:** `scores` (partial object), `comments`

---

### POST /evaluations/:id/submit

Submit an evaluation. Sets `status → SUBMITTED`. Intern receives notification.

**Auth:** Bearer token  
**Roles:** `SUPERVISOR` (own evaluations only)

**Response `200`:**
```json
{ "success": true, "data": { "evaluation": { ...EvaluationObject } } }
```

---

### EvaluationObject shape

```json
{
  "id": "...",
  "intern": { "id": "...", "firstName": "Ada", "lastName": "Okafor" },
  "supervisor": { "id": "...", "firstName": "Emeka", "lastName": "Eze" },
  "status": "SUBMITTED",
  "scores": {
    "workQuality": 4,
    "reliability": 5,
    "communication": 4,
    "learningProgress": 4,
    "professionalism": 5
  },
  "comments": "Ada has shown excellent initiative.",
  "submittedAt": "2026-10-12T11:00:00.000Z",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 13. Documents

> All routes require authentication.

---

### POST /documents/requirements

HR defines a document requirement (global — applies to all interns).

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{
  "type": "GUARANTOR_FORM",
  "label": "Guarantor Form",
  "description": "Must be signed and stamped.",
  "isRequired": true
}
```

**Response `201`:**
```json
{ "success": true, "data": { "requirement": { ...RequirementObject } } }
```

---

### GET /documents/requirements

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

---

### POST /documents

HR creates a document record for a specific intern.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{
  "internId": "64f1...",
  "requirementId": "64f1..."
}
```

**Response `201`:**
```json
{ "success": true, "data": { "document": { ...DocumentObject } } }
```

**Errors:** `409` record already exists for this intern + requirement

---

### GET /documents

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (intern sees own only)  
**Query params:** `page`, `limit`, `intern` (ID), `status` (`DocumentStatus`), `type` (`DocumentType`)

---

### GET /documents/:id

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

---

### GET /documents/:id/upload-info

Returns the Appwrite endpoint and a pre-generated file ID. Client uploads the file directly to Appwrite using the Appwrite client SDK with this file ID, then confirms via `PATCH /:id/upload`.

**Auth:** Bearer token  
**Roles:** `HR`, `INTERN`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "uploadInfo": {
      "endpoint": "https://cloud.appwrite.io/v1",
      "projectId": "your-project-id",
      "bucketId": "your-bucket-id",
      "fileId": "unique-64char-id"
    }
  }
}
```

**Frontend upload flow using the Appwrite client SDK (`appwrite` npm package):**

```js
import { Client, Storage } from 'appwrite';

// 1. Fetch upload info from the Whippe API
const { data: { uploadInfo } } = await api.get(`/documents/${docId}/upload-info`);

// 2. Initialise Appwrite client (browser-side)
const client = new Client()
  .setEndpoint(uploadInfo.endpoint)
  .setProject(uploadInfo.projectId);

const storage = new Storage(client);

// 3. Upload directly to Appwrite
// The SDK automatically splits large files into 5MB chunks and retries
// failed chunks — no extra code needed for chunked/resumable uploads.
// The onProgress callback gives you 0–100 progress for a progress bar.
await storage.createFile(
  uploadInfo.bucketId,
  uploadInfo.fileId,   // use the pre-generated ID from the server
  file,                // File object from <input type="file">
  [],                  // permissions — leave empty, bucket controls access
  (progress) => {
    console.log(`${progress.progress}%`);
  }
);

// 4. Confirm the upload with the Whippe API
await api.patch(`/documents/${docId}/upload`, {
  storageKey: uploadInfo.fileId,
  originalFilename: file.name,
  contentType: file.type,
  fileSizeBytes: file.size,
});
```

> **Important:** Always use the `fileId` returned by the server in step 1. Do not generate your own — the server needs to know the key before the upload happens so it can store it securely with `select: false`.

> **On upload failure:** Show a retry button and re-run from step 1 (fresh `fileId`). Files in the intern management context are small documents (PDFs, images) — a full retry is acceptable UX. Cross-session resumability is not implemented.

---

### PATCH /documents/:id/upload

After uploading the file to Appwrite, register the upload metadata.

**Auth:** Bearer token  
**Roles:** `HR`, `INTERN`

**Request body:**
```json
{
  "storageKey": "unique-64char-id",
  "originalFilename": "guarantor-form.pdf",
  "contentType": "application/pdf",
  "fileSizeBytes": 204800
}
```

Sets `status → DIGITAL_RECEIVED`.

**Response `200`:**
```json
{ "success": true, "message": "Upload registered.", "data": { "document": { ...DocumentObject } } }
```

---

### GET /documents/:id/download

Server fetches the file from Appwrite and streams it back. The `storageKey` is never exposed to the client.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (intern sees own only)

**Response `200`:** Binary file stream  
Headers: `Content-Type`, `Content-Disposition: attachment; filename="..."`, `Content-Length`

**Errors:** `404` no file uploaded yet

---

### PATCH /documents/:id/physical

HR marks a physical document as received at the desk.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{ "notes": "Original handed in — copy filed." }
```

Sets `status → PHYSICAL_RECEIVED`.

---

### PATCH /documents/:id/review

HR verifies or rejects a received document.

**Auth:** Bearer token  
**Roles:** `HR`

**Request body:**
```json
{
  "status": "VERIFIED",
  "rejectionReason": null,
  "notes": "Checked and filed."
}
```

| `status` allowed values | `DIGITAL_RECEIVED` or `PHYSICAL_RECEIVED` must exist first |
|---|---|
| `VERIFIED` | — |
| `REJECTED` | `rejectionReason` strongly recommended |

**Errors:** `409` document still in `PENDING` state

---

### GET /documents/checklist/:internId

Returns all document requirements with the intern's current status for each.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "checklist": [
      {
        "requirement": { "id": "...", "label": "Guarantor Form", "type": "GUARANTOR_FORM", "isRequired": true },
        "document": { "id": "...", "status": "VERIFIED" }
      },
      {
        "requirement": { "id": "...", "label": "School Letter", "type": "SCHOOL_LETTER", "isRequired": true },
        "document": null
      }
    ]
  }
}
```

---

## 14. Notifications

> All routes require authentication. Users can only access their own notifications.

---

### GET /notifications

Returns the authenticated user's notifications, newest first.

**Auth:** Bearer token  
**Roles:** Any  
**Query params:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | — |
| `limit` | integer | Default 20, max 100 |
| `read` | `true` \| `false` | Filter by read state |

**Response `200`:** paginated list of `NotificationObject`

---

### PATCH /notifications/read-all

Mark all of the authenticated user's notifications as read.

**Auth:** Bearer token  
**Roles:** Any

**Response `200`:**
```json
{ "success": true, "message": "5 notifications marked as read.", "count": 5 }
```

---

### PATCH /notifications/:id/read

Mark a single notification as read.

**Auth:** Bearer token  
**Roles:** Any (ownership enforced — can only mark own notifications)

**Response `200`:**
```json
{ "success": true, "data": { "notification": { ...NotificationObject } } }
```

**Errors:** `404` not found or not owned by user

---

### NotificationObject shape

```json
{
  "id": "...",
  "type": "TASK_ASSIGNED",
  "title": "New task assigned",
  "body": "You have been assigned a new task: \"Write news script\".",
  "read": false,
  "relatedEntity": {
    "kind": "Task",
    "id": "64f1..."
  },
  "createdAt": "2026-10-12T10:00:00.000Z"
}
```

> Notifications are created internally by the server — no client endpoint to create them.

---

## 15. Timeline & Summary

> All routes require authentication. Interns can only access their own data.

---

### GET /interns/:id/timeline

Returns a chronological feed of all significant events in the intern's placement.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (intern only sees own)  
**Query params:** `page`, `limit`

**Response `200`:** paginated list of `TimelineEvent`

```json
{
  "success": true,
  "data": [
    {
      "type": "TASK_ASSIGNED",
      "date": "2026-10-05T09:00:00.000Z",
      "title": "Task assigned: \"Write news script\"",
      "detail": "Due: Tue Oct 20 2026",
      "refId": "64f1...",
      "refKind": "Task"
    },
    {
      "type": "ATTENDANCE",
      "date": "2026-10-12T08:01:00.000Z",
      "title": "Checked in — ACCEPTED",
      "refId": "64f1...",
      "refKind": "Attendance"
    }
  ],
  "total": 24,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

**Timeline event types:** `ATTENDANCE` · `TASK_ASSIGNED` · `TASK_COMPLETED` · `SUBMISSION` · `REPORT` · `EVALUATION` · `DOCUMENT`

---

### GET /interns/:id/summary

Returns an aggregated performance summary for an intern.

**Auth:** Bearer token  
**Roles:** `HR`, `SUPERVISOR`, `INTERN` (intern only sees own)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "intern": {
        "id": "...",
        "firstName": "Ada",
        "lastName": "Okafor",
        "status": "ACTIVE",
        "internshipType": "INTERNSHIP",
        "startDate": "2026-10-01T00:00:00.000Z",
        "endDate": "2027-03-31T00:00:00.000Z"
      },
      "attendance": {
        "totalCheckIns": 12,
        "accepted": 11,
        "flagged": 1,
        "rejected": 0,
        "corrected": 0
      },
      "tasks": {
        "total": 5,
        "completed": 3,
        "inProgress": 1,
        "changesRequested": 0,
        "todo": 1,
        "completionRate": 60
      },
      "evaluations": {
        "count": 1,
        "averageScores": {
          "workQuality": 4.0,
          "reliability": 5.0,
          "communication": 4.0,
          "learningProgress": 4.0,
          "professionalism": 5.0,
          "overall": 4.4
        }
      },
      "documents": {
        "total": 3,
        "verified": 2,
        "pending": 1,
        "rejected": 0
      }
    }
  }
}
```

> `evaluations.averageScores` is `null` if no evaluations have been submitted.

---

## 16. Admin History

> HR only.

---

### GET /admin/history

Returns a paginated audit log of all important HR actions.

**Auth:** Bearer token  
**Roles:** `HR`  
**Query params:**

| Param | Type | Description |
|---|---|---|
| `page`, `limit` | integer | Pagination |
| `intern` | ID string | Filter by affected intern |
| `performedBy` | ID string | Filter by HR user |
| `action` | `AuditAction` | Filter by action type |

**Response `200`:** paginated list of `AuditLogObject`

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "action": "ACCOUNT_APPROVED",
      "performedBy": { "id": "...", "firstName": "Chioma", "lastName": "Adeyemi", "email": "hr@daar.com" },
      "targetUser": { "id": "...", "firstName": "Ada", "lastName": "Okafor", "email": "intern@example.com" },
      "targetIntern": null,
      "detail": null,
      "createdAt": "2026-10-12T10:05:00.000Z"
    }
  ],
  "total": 18,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

*End of API Contract — Whippe API v1.0*
