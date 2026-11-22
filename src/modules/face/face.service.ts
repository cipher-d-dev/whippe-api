import mongoose from 'mongoose';
import { FaceProfile, FacePhotoStatus, IFaceProfileDocument } from './face.model';
import { EnrolFaceInput, ReviewFaceInput, decodePhoto } from './face.schema';
import { matchScore, selfConsistency } from './face.match';
import { Intern } from '../interns/intern.model';
import { InternshipStatus } from '../interns/intern.types';
import { Attendance } from '../attendance/attendance.model';
import { createNotification, notifyAllHR } from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.types';
import { getSettings } from '../settings/settings.service';
import { createError } from '../../middleware/error-handler';
import { uploadPrivateFile, downloadFile, deleteFile } from '../../lib/appwrite';

/** Enrolment frames that disagree this much are probably blurry or not one person. */
const MIN_ENROLMENT_CONSISTENCY = 0.4;
/** Liveness scores (0–1) from the phone below this count as a failed liveness check. */
const MIN_LIVENESS = 0.5;
/** Completed interns' face data is deleted this long after completion. */
export const FACE_DATA_RETENTION_DAYS = 30;

async function internForUser(userId: string) {
  const intern = await Intern.findOne({ user: userId });
  if (!intern) throw createError('No intern record found for this account.', 404);
  return intern;
}

function publicView(p: IFaceProfileDocument | null) {
  if (!p) return { status: 'NONE' as const };
  return {
    status: p.status,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt ?? null,
    rejectionReason: p.status === FacePhotoStatus.REJECTED ? p.rejectionReason ?? null : null,
  };
}

// ─── Intern ───────────────────────────────────────────────────────────────────

export async function getMyFace(userId: string) {
  const intern = await internForUser(userId);
  const [profile, settings] = await Promise.all([FaceProfile.findOne({ intern: intern._id }), getSettings()]);
  return { ...publicView(profile), required: settings.faceCheck.enabled };
}

export async function enrolFace(userId: string, input: EnrolFaceInput) {
  const intern = await internForUser(userId);

  if (selfConsistency(input.descriptors) < MIN_ENROLMENT_CONSISTENCY) {
    throw createError('We couldn\'t get a clear photo. Find good light, hold the phone steady and try again.', 422);
  }
  if (!input.liveness.blink || input.liveness.real < MIN_LIVENESS || input.liveness.live < MIN_LIVENESS) {
    throw createError('That didn\'t look like a live camera picture. Take it again, looking straight at the camera.', 422);
  }

  const existing = await FaceProfile.findOne({ intern: intern._id }).select('+photoKey');
  if (existing?.status === FacePhotoStatus.APPROVED) {
    throw createError('Your face photo is already approved. Ask HR if you need to change it.', 409);
  }

  const { buffer, ext } = decodePhoto(input.photo);
  const photoKey = await uploadPrivateFile(buffer, `face-${intern._id}.${ext}`);
  const oldKey = existing?.photoKey;

  const now = new Date();
  const profile = await FaceProfile.findOneAndUpdate(
    { intern: intern._id },
    {
      $set: {
        status: FacePhotoStatus.PENDING,
        photoKey,
        descriptors: input.descriptors,
        liveness: input.liveness,
        consentAt: now,
        submittedAt: now,
      },
      $unset: { reviewedBy: 1, reviewedAt: 1, rejectionReason: 1 },
    },
    { upsert: true, new: true },
  );

  if (oldKey && oldKey !== photoKey) deleteFile(oldKey).catch(() => undefined);

  notifyAllHR(
    NotificationType.FACE_PHOTO_SUBMITTED,
    'Face photo to approve',
    `${intern.firstName} ${intern.lastName} sent their face photo for check-in.`,
    { kind: 'Intern', id: String(intern._id) },
  ).catch(() => undefined);

  return publicView(profile);
}

// ─── HR ───────────────────────────────────────────────────────────────────────

export async function listFacePhotos(status?: string) {
  const filter = status ? { status } : {};
  const rows = await FaceProfile.find(filter)
    .sort({ status: 1, submittedAt: 1 })
    .populate('intern', 'firstName lastName internshipType department')
    .lean();
  return rows.map((r) => ({
    internId: String((r.intern as unknown as { _id: unknown })?._id ?? r.intern),
    intern: r.intern,
    status: r.status,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt ?? null,
    rejectionReason: r.rejectionReason ?? null,
    liveness: r.liveness ?? null,
  }));
}

export async function getInternFace(internId: string) {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);
  const p = await FaceProfile.findOne({ intern: internId });
  return publicView(p);
}

export async function reviewFace(internId: string, input: ReviewFaceInput, hrUserId: string) {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);
  const profile = await FaceProfile.findOne({ intern: internId });
  if (!profile) throw createError('This intern hasn\'t sent a face photo yet.', 404);

  profile.status = input.action === 'APPROVE' ? FacePhotoStatus.APPROVED : FacePhotoStatus.REJECTED;
  profile.reviewedBy = new mongoose.Types.ObjectId(hrUserId);
  profile.reviewedAt = new Date();
  profile.rejectionReason = input.action === 'REJECT' ? input.reason : undefined;
  await profile.save();

  const intern = await Intern.findById(internId).select('user');
  if (intern?.user) {
    createNotification(
      String(intern.user),
      NotificationType.FACE_PHOTO_REVIEWED,
      input.action === 'APPROVE' ? 'Face photo approved' : 'Please take a new face photo',
      input.action === 'APPROVE'
        ? 'HR approved your face photo. Your check-ins will now be matched to it.'
        : `HR asked for a new face photo: ${input.reason}`,
      { kind: 'Intern', id: internId },
    ).catch(() => undefined);
  }
  return publicView(profile);
}

export async function getFacePhoto(internId: string): Promise<Buffer> {
  if (!mongoose.isValidObjectId(internId)) throw createError('Invalid intern ID.', 400);
  const p = await FaceProfile.findOne({ intern: internId }).select('+photoKey');
  if (!p?.photoKey) throw createError('No face photo for this intern.', 404);
  return downloadFile(p.photoKey);
}

export async function getCheckInSelfie(attendanceId: string): Promise<Buffer> {
  if (!mongoose.isValidObjectId(attendanceId)) throw createError('Invalid attendance ID.', 400);
  const a = await Attendance.findById(attendanceId);
  if (!a?.selfieKey) throw createError('No selfie was saved with this check-in.', 404);
  return downloadFile(a.selfieKey);
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

export interface CheckInFaceResult {
  selfieKey?: string;
  faceScore?: number;
  livenessPassed?: boolean;
  flagReasons: string[];
}

/**
 * Face part of a check-in. Throws if the intern must enrol first; otherwise
 * returns what to store and any reasons to flag. Never rejects a check-in.
 */
export async function evaluateCheckInFace(
  internId: mongoose.Types.ObjectId,
  face: { photo: string; descriptors: number[][]; liveness: { blink: boolean; real: number; live: number } } | undefined,
): Promise<CheckInFaceResult> {
  const settings = await getSettings();
  if (!settings.faceCheck.enabled) return { flagReasons: [] };

  const profile = await FaceProfile.findOne({ intern: internId }).select('+descriptors');
  if (!profile) {
    throw createError('Take your face photo first. Open Me → Face photo, then check in.', 412);
  }
  if (profile.status === FacePhotoStatus.REJECTED) {
    throw createError('HR asked for a new face photo. Take it under Me → Face photo, then check in.', 412);
  }

  if (!face) return { flagReasons: ['NO_SELFIE'] };

  const result: CheckInFaceResult = { flagReasons: [] };
  try {
    const { buffer, ext } = decodePhoto(face.photo);
    result.selfieKey = await uploadPrivateFile(buffer, `checkin-${internId}-${Date.now()}.${ext}`);
  } catch (err) {
    console.warn('[face] Could not save check-in selfie:', err);
  }

  result.livenessPassed = face.liveness.blink && face.liveness.real >= MIN_LIVENESS && face.liveness.live >= MIN_LIVENESS;
  if (!result.livenessPassed) result.flagReasons.push('LIVENESS_FAILED');

  // Score is always recorded; it only flags once HR has approved the reference.
  result.faceScore = matchScore(face.descriptors, profile.descriptors);
  if (profile.status === FacePhotoStatus.APPROVED && result.faceScore < settings.faceCheck.threshold) {
    result.flagReasons.push('FACE_MISMATCH');
  }
  return result;
}

// ─── Retention ────────────────────────────────────────────────────────────────

/** Deletes face photos and check-in selfies of interns who completed more than 30 days ago. */
export async function deleteExpiredFaceData(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - FACE_DATA_RETENTION_DAYS * 86_400_000);
  const done = await Intern.find({ status: InternshipStatus.COMPLETED, completedAt: { $lte: cutoff } }).select('_id').lean();
  if (!done.length) return 0;
  const ids = done.map((d) => d._id);

  let removed = 0;
  const profiles = await FaceProfile.find({ intern: { $in: ids } }).select('+photoKey');
  for (const p of profiles) {
    await deleteFile(p.photoKey).catch(() => undefined);
    await p.deleteOne();
    removed++;
  }
  const selfies = await Attendance.find({ intern: { $in: ids }, selfieKey: { $exists: true } });
  for (const a of selfies) {
    if (a.selfieKey) await deleteFile(a.selfieKey).catch(() => undefined);
    a.selfieKey = undefined;
    await a.save();
    removed++;
  }
  return removed;
}
