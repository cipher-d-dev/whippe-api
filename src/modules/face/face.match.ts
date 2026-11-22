/**
 * Face matching maths. The phone turns each face into a 1024-number "fingerprint"
 * (faceres model from the open-source Human library). The server compares
 * fingerprints here, so the reference never has to leave the API.
 *
 * `similarity` reproduces Human's own formula (Euclidean distance, multiplier 25,
 * normalised to 0.2–0.8) so scores mean the same thing on the phone and server:
 * 0 = nothing alike, 1 = identical.
 */

export const DESCRIPTOR_LENGTH = 1024;

export function similarity(a: number[], b: number[]): number {
  if (!a?.length || a.length !== b?.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  const dist = Math.round(100 * 25 * sum) / 100;
  if (dist === 0) return 1;
  const norm = (1 - Math.sqrt(dist) / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}

/**
 * Score a check-in: each live frame is compared with every reference frame and
 * keeps its best match; the check-in's score is the median of those, so one odd
 * frame (blur, a blink) can't make or break it.
 */
export function matchScore(live: number[][], reference: number[][]): number {
  if (!live.length || !reference.length) return 0;
  const best = live.map((l) => Math.max(...reference.map((r) => similarity(l, r)))).sort((x, y) => x - y);
  const mid = Math.floor(best.length / 2);
  return best.length % 2 ? best[mid] : Math.round(((best[mid - 1] + best[mid]) / 2) * 100) / 100;
}

/** How consistent the enrolment frames are with each other (low = blurry or different people). */
export function selfConsistency(frames: number[][]): number {
  if (frames.length < 2) return 1;
  const scores: number[] = [];
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) scores.push(similarity(frames[i], frames[j]));
  return Math.min(...scores);
}
