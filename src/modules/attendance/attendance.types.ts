export enum AttendanceStatus {
  ACCEPTED = 'ACCEPTED',     // Valid check-in
  REJECTED = 'REJECTED',     // Failed server-side verification
  FLAGGED = 'FLAGGED',       // Passed but suspicious — HR review needed
  CORRECTED = 'CORRECTED',   // HR manually corrected the record
}

export enum CheckType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}
