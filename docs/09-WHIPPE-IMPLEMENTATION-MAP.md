# Whippe — Implementation Map and Cross-Application Dependencies

## 1. Overall Sequence

```text
PHASE 0
Repository + architecture
        ↓
PHASE 1
Authentication + roles
        ↓
WEB 2–4
HR core
        ↓
WEB 5–7 + PWA 2–4
Supervisor ↔ Intern work
        ↓
WEB 8 + PWA 6
Attendance
        ↓
WEB 9 + PWA 8
Completion
        ↓
WEB 10–13 + PWA 7–10
Operational refinement
        ↓
WEB 14 + PWA 11
Optional AI
```

---

# 2. Cross-Application Contract

## Intern Creation

Web:

```text
HR creates intern
      ↓
API
      ↓
Intern record
      ↓
Intern can authenticate/use PWA
```

## Supervisor Assignment

Web:

```text
HR assigns supervisor
      ↓
API
      ↓
Supervisor relationship
      ↓
Supervisor Web sees intern
      ↓
Intern PWA can show appropriate supervisor information
```

## Tasks

```text
Supervisor Web
      ↓
POST /tasks
      ↓
API
      ↓
Intern PWA fetches task
      ↓
Intern submits
      ↓
API
      ↓
Supervisor Web reviews
```

## Reports

```text
Intern PWA
      ↓
Report submission
      ↓
API
      ↓
Supervisor Web review
      ↓
HR Web visibility
```

## Attendance

```text
Intern PWA
      ↓
Location/QR/signals
      ↓
Attendance API
      ↓
Verification
      ↓
Attendance record
      ↓
HR Web
```

## Completion

```text
End date approaching
      ↓
HR Web
      ↓
Outstanding requirements
      ↓
Supervisor/Intern complete work
      ↓
HR completes internship
      ↓
PWA shows completion state
```

---

# 3. What Must Be Shared

Shared:

- API
- database
- authentication identity
- role definitions
- business rules
- API contracts
- core types where genuinely reusable

Not shared blindly:

- Web UI
- PWA UI
- page layouts
- mobile-specific interaction logic

---

# 4. Application Ownership

### Web owns

HR/supervisor operational management.

### PWA owns

Intern daily interaction.

### API owns

Truth and rules.

### MongoDB owns

Persistence.

---

# 5. Recommended Milestones

## Milestone 1 — Foundation

Authentication works.

## Milestone 2 — HR Core

HR can create, onboard and assign an intern.

## Milestone 3 — Supervision

Supervisor can assign work and review it.

## Milestone 4 — Intern Daily Workflow

Intern can receive work and submit reports.

## Milestone 5 — Attendance

Intern can check in and HR can monitor it.

## Milestone 6 — Lifecycle Completion

HR can close an internship.

## Milestone 7 — Operational Release

Documents, notifications, dashboard refinement and security hardening.

## Milestone 8 — Optional Intelligence

AI only after the core system is stable.
