// ─── Document type ────────────────────────────────────────────────────────────
// Free-form label — HR creates document requirements with any type they need.
// These are the common initial types; new ones can be added without code changes
// by creating a DocumentRequirement with a custom type string.

export enum DocumentType {
  ACCEPTANCE_LETTER = 'ACCEPTANCE_LETTER',
  GUARANTOR_FORM = 'GUARANTOR_FORM',
  IDENTIFICATION = 'IDENTIFICATION',
  SCHOOL_LETTER = 'SCHOOL_LETTER',
  NYSC_CALL_UP = 'NYSC_CALL_UP',
  REPORT = 'REPORT',
  EVALUATION = 'EVALUATION',
  EXIT_DOCUMENT = 'EXIT_DOCUMENT',
  OTHER = 'OTHER',
}

// ─── Document status ──────────────────────────────────────────────────────────
// Supports both digital and physical document workflows.

export enum DocumentStatus {
  PENDING = 'PENDING',              // Not yet submitted (digital or physical)
  DIGITAL_RECEIVED = 'DIGITAL_RECEIVED',   // File uploaded
  PHYSICAL_RECEIVED = 'PHYSICAL_RECEIVED', // Physical copy handed in at desk
  VERIFIED = 'VERIFIED',            // HR has checked and accepted it
  REJECTED = 'REJECTED',            // HR rejected — needs resubmission
}
