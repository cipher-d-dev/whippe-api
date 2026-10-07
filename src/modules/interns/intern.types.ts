// ─── Internship type ──────────────────────────────────────────────────────────

export enum InternshipType {
  INTERNSHIP = 'INTERNSHIP',   // Standard intern placement
  NYSC_IT = 'NYSC_IT',         // NYSC IT personnel
}

// ─── Internship status ────────────────────────────────────────────────────────
// Separate from account status — see 05-WHIPPE-SHARED-BACKEND-DATA.md

export enum InternshipStatus {
  SCREENED = 'SCREENED',         // Physical screening done, account not yet verified
  ONBOARDING = 'ONBOARDING',     // Account approved, completing onboarding requirements
  ACTIVE = 'ACTIVE',             // Fully active placement
  COMPLETED = 'COMPLETED',       // Internship ended successfully
}
