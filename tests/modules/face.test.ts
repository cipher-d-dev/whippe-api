jest.mock('../../src/modules/face/face.model', () => {
  const actual = jest.requireActual('../../src/modules/face/face.model');
  return { ...actual, FaceProfile: { findOne: jest.fn(), findOneAndUpdate: jest.fn() } };
});
jest.mock('../../src/modules/interns/intern.model', () => ({ Intern: { findOne: jest.fn(), findById: jest.fn(), find: jest.fn() } }));
jest.mock('../../src/modules/settings/settings.service', () => ({ getSettings: jest.fn() }));
jest.mock('../../src/lib/appwrite', () => ({
  uploadPrivateFile: jest.fn(async () => 'file-123'),
  downloadFile: jest.fn(),
  deleteFile: jest.fn(async () => undefined),
}));
jest.mock('../../src/modules/notifications/notification.service', () => ({
  createNotification: jest.fn(async () => ({})),
  notifyAllHR: jest.fn(async () => undefined),
}));

import mongoose from 'mongoose';
import { FaceProfile, FacePhotoStatus } from '../../src/modules/face/face.model';
import { Intern } from '../../src/modules/interns/intern.model';
import { getSettings } from '../../src/modules/settings/settings.service';
import { similarity, matchScore, selfConsistency } from '../../src/modules/face/face.match';
import { enrolFace, evaluateCheckInFace } from '../../src/modules/face/face.service';
import { enrolFaceSchema } from '../../src/modules/face/face.schema';

// Deterministic 1024-number fingerprints: a "person" plus small noise.
function person(seed: number) {
  let x = seed;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280) - 0.5;
  return Array.from({ length: 1024 }, () => rnd() * 1.2);
}
const jitter = (v: number[], amount: number, seed = 7) => {
  let x = seed;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280) - 0.5;
  return v.map((n) => n + rnd() * amount);
};
const PHOTO = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg').toString('base64');
const internId = new mongoose.Types.ObjectId();
const settings = (enabled: boolean, threshold = 0.5) => (getSettings as jest.Mock).mockResolvedValue({ faceCheck: { enabled, threshold } });
const profile = (status: FacePhotoStatus, descriptors: number[][]) =>
  (FaceProfile.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ status, descriptors }) });

describe('face matching maths', () => {
  const a = person(1), b = person(2);
  it('scores the same face highly and different faces lower', () => {
    expect(similarity(a, a)).toBe(1);
    expect(similarity(a, jitter(a, 0.1))).toBeGreaterThan(0.8);
    expect(similarity(a, b)).toBeLessThan(similarity(a, jitter(a, 0.1)));
  });
  it('uses the median frame, so one bad frame does not decide', () => {
    const live = [jitter(a, 0.1, 3), jitter(a, 0.1, 5), b]; // one frame is someone else
    expect(matchScore(live, [a])).toBeGreaterThan(0.8);
  });
  it('spots enrolment frames that disagree', () => {
    expect(selfConsistency([a, jitter(a, 0.1)])).toBeGreaterThan(0.8);
    expect(selfConsistency([a, b])).toBeLessThan(selfConsistency([a, jitter(a, 0.1)]));
  });
});

describe('check-in face check', () => {
  const ref = person(11);
  const live = (d: number[]) => ({ photo: PHOTO, descriptors: [d, d, d], liveness: { blink: true, real: 0.9, live: 0.9 } });

  it('does nothing while switched off', async () => {
    settings(false);
    await expect(evaluateCheckInFace(internId, undefined)).resolves.toEqual({ flagReasons: [] });
  });

  it('asks interns without a photo to take one first', async () => {
    settings(true);
    (FaceProfile.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await expect(evaluateCheckInFace(internId, live(ref))).rejects.toMatchObject({ statusCode: 412 });
  });

  it('accepts a matching face and saves the selfie', async () => {
    settings(true);
    profile(FacePhotoStatus.APPROVED, [ref]);
    const out = await evaluateCheckInFace(internId, live(jitter(ref, 0.1)));
    expect(out.flagReasons).toEqual([]);
    expect(out.selfieKey).toBe('file-123');
    expect(out.faceScore).toBeGreaterThan(0.8);
  });

  it('flags a different face once the reference is approved', async () => {
    settings(true);
    profile(FacePhotoStatus.APPROVED, [ref]);
    const out = await evaluateCheckInFace(internId, live(person(99)));
    expect(out.flagReasons).toContain('FACE_MISMATCH');
  });

  it('records but does not flag while the reference waits for HR', async () => {
    settings(true);
    profile(FacePhotoStatus.PENDING, [ref]);
    const out = await evaluateCheckInFace(internId, live(person(99)));
    expect(out.flagReasons).not.toContain('FACE_MISMATCH');
    expect(typeof out.faceScore).toBe('number');
  });

  it('flags a missing selfie and a failed liveness check', async () => {
    settings(true);
    profile(FacePhotoStatus.APPROVED, [ref]);
    expect((await evaluateCheckInFace(internId, undefined)).flagReasons).toEqual(['NO_SELFIE']);
    const out = await evaluateCheckInFace(internId, { ...live(ref), liveness: { blink: false, real: 0.9, live: 0.9 } });
    expect(out.flagReasons).toContain('LIVENESS_FAILED');
  });
});

describe('enrolment', () => {
  const ref = person(21);
  beforeEach(() => {
    (Intern.findOne as jest.Mock).mockResolvedValue({ _id: internId, firstName: 'Tolani', lastName: 'Abubakar' });
    (FaceProfile.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    (FaceProfile.findOneAndUpdate as jest.Mock).mockResolvedValue({ status: FacePhotoStatus.PENDING, submittedAt: new Date() });
  });

  it('requires consent', () => {
    const parsed = enrolFaceSchema.safeParse({ body: { photo: PHOTO, descriptors: [ref], liveness: { blink: true, real: 1, live: 1 }, consent: false } });
    expect(parsed.success).toBe(false);
  });

  it('saves a clear live photo as waiting for HR', async () => {
    const out = await enrolFace('user-1', { photo: PHOTO, descriptors: [ref, jitter(ref, 0.1)], liveness: { blink: true, real: 0.9, live: 0.9 }, consent: true });
    expect(out.status).toBe(FacePhotoStatus.PENDING);
  });

  it('refuses frames of two different faces', async () => {
    await expect(enrolFace('user-1', { photo: PHOTO, descriptors: [ref, person(77)], liveness: { blink: true, real: 0.9, live: 0.9 }, consent: true }))
      .rejects.toMatchObject({ statusCode: 422 });
  });
});
