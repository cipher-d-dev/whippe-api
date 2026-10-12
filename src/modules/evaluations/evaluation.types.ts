export enum EvaluationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

// Structured scoring categories — 1 to 5 scale
export interface EvaluationScores {
  workQuality: number;       // 1–5
  reliability: number;       // 1–5
  communication: number;     // 1–5
  learningProgress: number;  // 1–5
  professionalism: number;   // 1–5
}
