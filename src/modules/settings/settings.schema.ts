import { z } from 'zod';

const label = z.string().trim().min(1, 'Label cannot be empty').max(40);

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
    })
    .strict(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>['body'];
