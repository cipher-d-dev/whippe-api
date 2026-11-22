import { z } from 'zod';
import { DESCRIPTOR_LENGTH } from './face.match';

// A JPEG from the phone's camera, as a data URL. ~40–150 KB in practice.
const MAX_PHOTO_CHARS = 700_000; // ≈ 500 KB of image after base64

export const photoField = z
  .string()
  .max(MAX_PHOTO_CHARS, 'Photo is too large')
  .regex(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/, 'Photo must be a JPEG, WebP or PNG data URL');

export const descriptorsField = z
  .array(z.array(z.number().finite()).length(DESCRIPTOR_LENGTH))
  .min(1)
  .max(5);

export const livenessField = z.object({
  blink: z.boolean(),
  real: z.number().min(0).max(1),
  live: z.number().min(0).max(1),
});

export const enrolFaceSchema = z.object({
  body: z.object({
    photo: photoField,
    descriptors: descriptorsField,
    liveness: livenessField,
    consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
  }),
});
export type EnrolFaceInput = z.infer<typeof enrolFaceSchema>['body'];

export const reviewFaceSchema = z.object({
  params: z.object({ internId: z.string().min(1) }),
  body: z.discriminatedUnion('action', [
    z.object({ action: z.literal('APPROVE') }),
    z.object({ action: z.literal('REJECT'), reason: z.string().trim().min(1, 'Tell them why').max(300) }),
  ]),
});
export type ReviewFaceInput = z.infer<typeof reviewFaceSchema>['body'];

export const listFaceSchema = z.object({
  query: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }),
});

/** Optional face payload sent with a check-in. */
export const checkInFaceField = z
  .object({
    photo: photoField,
    descriptors: descriptorsField,
    liveness: livenessField,
  })
  .optional();

export function decodePhoto(dataUrl: string): { buffer: Buffer; ext: string } {
  const [head, b64] = dataUrl.split(',', 2);
  const ext = head.includes('png') ? 'png' : head.includes('webp') ? 'webp' : 'jpg';
  return { buffer: Buffer.from(b64, 'base64'), ext };
}
