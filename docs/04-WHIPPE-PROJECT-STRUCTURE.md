# Whippe — Repository, Scaffolding and File Structure

This document defines the initial project structure.

The structure is deliberately simple.

Do not introduce Turborepo, Nx, microservices or another orchestration layer unless the project later demonstrates a need.

---

# 1. Repository

Use a pnpm workspace monorepo.

```text
whippe/
├── apps/
│   ├── web/
│   ├── intern-pwa/
│   └── api/
│
├── packages/
│   └── shared/
│
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

---

# 2. apps/api

The Express backend is modular by domain.

```text
apps/api/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   └── database.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── authorize.ts
│   │   ├── error-handler.ts
│   │   └── not-found.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── interns/
│   │   ├── departments/
│   │   ├── supervisors/
│   │   ├── placements/
│   │   ├── documents/
│   │   ├── attendance/
│   │   ├── tasks/
│   │   ├── submissions/
│   │   ├── reports/
│   │   ├── evaluations/
│   │   ├── notifications/
│   │   ├── timeline/
│   │   └── ai/
│   │
│   ├── lib/
│   ├── utils/
│   ├── app.ts
│   └── server.ts
│
├── tests/
├── package.json
└── tsconfig.json
```

Each domain module should normally contain only what it needs.

Example:

```text
modules/interns/
├── intern.model.ts
├── intern.schema.ts
├── intern.service.ts
├── intern.controller.ts
├── intern.routes.ts
└── intern.types.ts
```

A module may have additional files when complexity genuinely requires them.

Do not create empty files simply to satisfy a pattern.

---

# 3. apps/web

```text
apps/web/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── interns/
│   │   ├── onboarding/
│   │   ├── attendance/
│   │   ├── tasks/
│   │   ├── reports/
│   │   ├── supervisors/
│   │   ├── documents/
│   │   ├── evaluations/
│   │   └── exit/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
│
├── features/
│   ├── interns/
│   ├── onboarding/
│   ├── attendance/
│   ├── tasks/
│   ├── reports/
│   ├── supervisors/
│   ├── documents/
│   └── evaluations/
│
├── lib/
│   ├── api/
│   ├── auth/
│   └── utils/
│
├── hooks/
├── types/
├── public/
└── package.json
```

Pages/routes should stay thin.

Feature-specific API hooks, components and UI logic should live under the relevant feature where practical.

---

# 4. apps/intern-pwa

```text
apps/intern-pwa/
├── app/
│   ├── (auth)/
│   ├── (app)/
│   │   ├── home/
│   │   ├── attendance/
│   │   ├── tasks/
│   │   ├── reports/
│   │   ├── notes/
│   │   ├── notifications/
│   │   ├── timeline/
│   │   └── profile/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
│
├── features/
│   ├── attendance/
│   ├── tasks/
│   ├── reports/
│   ├── notes/
│   ├── notifications/
│   └── timeline/
│
├── lib/
│   ├── api/
│   ├── auth/
│   └── pwa/
│
├── hooks/
├── types/
├── public/
└── package.json
```

The PWA should share API contracts with Web where practical rather than recreating them.

---

# 5. packages/shared

Use this package for genuinely shared code.

```text
packages/shared/
├── src/
│   ├── types/
│   ├── schemas/
│   └── constants/
├── package.json
└── tsconfig.json
```

Only put code here when both clients or backend genuinely benefit from sharing it.

Do not turn `shared` into a dumping ground.

---

# 6. Domain Module Convention

Backend modules should generally follow:

```text
model
schema
service
controller
routes
types
```

Responsibilities:

### Model
MongoDB/Mongoose representation.

### Schema
Zod request validation.

### Service
Business logic.

### Controller
Translate HTTP request → service call → HTTP response.

### Routes
Endpoint definitions + middleware.

### Types
Types genuinely specific to that domain.

---

# 7. Frontend Feature Convention

Feature folders should contain feature-specific:

- components
- hooks
- API functions
- types
- utilities

Pages should compose these pieces rather than becoming enormous files.

---

# 8. Naming

Use consistent names.

Examples:

```text
intern.model.ts
intern.service.ts
intern.routes.ts
intern.controller.ts
```

React components:

```text
InternTable.tsx
InternForm.tsx
InternStatusBadge.tsx
```

Do not randomly mix naming conventions.

---

# 9. Environment

Root:

```text
.env.example
```

API environment includes things such as:

```text
NODE_ENV
PORT
MONGODB_URI
SESSION_SECRET
OBJECT_STORAGE_*
```

Client environment contains only values safe for client exposure.

Never put database credentials or private API keys in frontend environment variables.

---

# 10. Scaffolding Rule

Phase 0 creates the repository and architectural skeleton.

Later phases create domain modules and feature folders only when that feature is introduced.

Do not pre-create every future file as empty placeholders.
