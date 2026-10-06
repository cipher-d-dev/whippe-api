# Whippe — Phase Execution Checklist

Use this checklist for every implementation phase.

## Before Coding

- [ ] Read the relevant phase.
- [ ] Read the project structure.
- [ ] Inspect current repository.
- [ ] Inspect existing implementation.
- [ ] Identify dependencies.
- [ ] Identify existing API consumers.
- [ ] Confirm no duplicate module already exists.

## During Coding

- [ ] Follow existing structure.
- [ ] Keep business logic in backend services.
- [ ] Add validation.
- [ ] Add authorization.
- [ ] Connect UI to real API.
- [ ] Handle loading.
- [ ] Handle empty state.
- [ ] Handle errors.
- [ ] Add tests.
- [ ] Avoid future-phase implementation.

## Before Completion

- [ ] Run type checking.
- [ ] Run linting.
- [ ] Run relevant tests.
- [ ] Manually test the primary workflow.
- [ ] Check authorization boundaries.
- [ ] Check mobile/desktop behaviour as applicable.
- [ ] Check database indexes/queries where applicable.
- [ ] Check that no secrets were added.
- [ ] Check API compatibility.

## Completion Report

Return:

```text
PHASE:
<phase name>

IMPLEMENTED:
- ...

FILES CREATED:
- ...

FILES MODIFIED:
- ...

API:
- ...

DATABASE:
- ...

PERMISSIONS:
- ...

TESTS:
- ...

KNOWN LIMITATIONS:
- ...

DEFERRED:
- ...

NEXT PHASE:
- ...
```

Do not say “complete” when only scaffolding has been created.

---

# Definition of a Good Phase

A good phase leaves the repository in a state where:

1. the project still runs,
2. the new feature actually works,
3. existing features still work,
4. the next phase has a clear dependency path,
5. the code follows the established architecture,
6. no unnecessary infrastructure was introduced.
