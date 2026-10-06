# Whippe — Agentic CLI Build Rules

This document is mandatory guidance for the coding agent.

## 1. Source of Truth

Use these documents in this order:

1. `01-WHIPPE-OVERVIEW.md`
2. `04-WHIPPE-PROJECT-STRUCTURE.md`
3. `05-WHIPPE-SHARED-BACKEND-DATA.md`
4. relevant application specification
5. relevant phase file
6. this file

If two documents conflict, stop and identify the conflict instead of silently inventing a third interpretation.

---

# 2. Work One Phase at a Time

Do not implement future phases automatically.

A phase may make small prerequisite changes, but future functionality must not be silently implemented.

---

# 3. Inspect Before Coding

Before changing code:

- inspect repository
- inspect package configuration
- inspect existing models
- inspect existing routes
- inspect existing auth
- inspect frontend patterns
- inspect shared packages
- identify consumers of changed APIs

Reuse existing conventions.

---

# 4. No Duplicate Architecture

Do not create:

- second authentication systems
- second API clients with conflicting conventions
- duplicate backend business logic
- duplicate models for the same entity
- separate HR and Supervisor backends

---

# 5. Backend Authority

Never trust the client for:

- role
- ownership
- attendance validity
- supervisor relationship
- evaluation authority
- document access

---

# 6. Do Not Overengineer

For approximately 100–200 interns:

Do not introduce:

- microservices
- Kubernetes
- Kafka
- event buses
- multiple databases
- distributed caching
- complex CQRS
- elaborate plugin systems

unless an explicit future requirement justifies them.

---

# 7. Phase Scaffolding

Every phase must identify:

- files/modules created
- existing files modified
- backend work
- frontend work
- API endpoints
- permissions
- validation
- tests
- definition of done

Do not create empty future files merely for symmetry.

---

# 8. API Changes

Before changing an API response:

- find consumers
- update shared types/contracts
- update all consumers
- test the affected flow

Do not silently rename fields.

---

# 9. Database Changes

When changing models:

- consider existing records
- add appropriate indexes
- avoid destructive migration
- consider backwards compatibility

---

# 10. UI

Every meaningful page needs:

- loading state
- error state
- empty state
- success feedback where appropriate

Do not use mock data once the real API exists.

---

# 11. Security

Never:

- commit secrets
- expose server secrets
- store plaintext passwords
- trust frontend role claims
- rely only on UI authorization
- expose another user's private data

---

# 12. Attendance

Attendance must be server-validated.

VPN/proxy detection is a signal, not absolute proof.

Location accuracy matters.

QR verification should use short-lived/rotating tokens where QR is used.

Provide an HR/manual review path for flagged cases.

---

# 13. AI

Do not add AI simply because it is possible.

When used:

- authorize first
- minimize data sent
- never expose provider credentials
- make output reviewable
- do not allow opaque final performance decisions

---

# 14. Testing

Each phase must test the new behaviour.

Important tests include:

- authorization
- validation
- ownership
- service logic
- critical UI flow
- important failure cases

---

# 15. Phase Completion Report

At the end of each phase, produce:

```text
IMPLEMENTED
- ...

FILES CREATED
- ...

FILES MODIFIED
- ...

API CHANGES
- ...

TESTS
- ...

KNOWN LIMITATIONS
- ...

NEXT PHASE
- ...
```

Never report a scaffold as a completed feature.
