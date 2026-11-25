import { z } from 'zod';

const label = z.string().trim().min(1, 'Label cannot be empty').max(40);
const stipendRule = z
  .object({
    days: z.number().int().min(1, 'At least 1 day').max(31),
    amount: z.number().int().min(0).max(10_000_000),
  })
  .partial()
  .strict();

export const updateSettingsSchema = z.object({
  body: z
    .object({
      labels: z
        .object({ INTERNSHIP: label.optional(), NYSC_IT: label.optional() })
        .strict()
        .optional(),
      stations: z
        .array(z.string().trim().min(1).max(60))
        .min(1, 'Keep at least one station')
        .max(20)
        .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, 'Station names must be different')
        .optional(),
      allowance: z
        .object({ INTERNSHIP: z.boolean().optional(), NYSC_IT: z.boolean().optional() })
        .strict()
        .optional(),
      faceCheck: z
        .object({
          enabled: z.boolean().optional(), // accepted for older clients, ignored: face check is always on
          threshold: z.number().min(0.3).max(0.9).optional(),
        })
        .strict()
        .optional(),
      lateAfter: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 10:00').optional(),
      stipend: z
        .object({ INTERNSHIP: stipendRule.optional(), NYSC_IT: stipendRule.optional() })
        .strict()
        .optional(),
    })
    .strict(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>['body'];
