import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // ── Database ──────────────────────────────────────────────────────────────
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // ── Auth ──────────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // ── CORS ──────────────────────────────────────────────────────────────────
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // ── Frontend URL (OAuth redirects) ────────────────────────────────────────
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // ── Office geofence — DAAR Communications HQ ─────────────────────────────
  OFFICE_LAT: z.coerce.number({ required_error: 'OFFICE_LAT is required' }),
  OFFICE_LNG: z.coerce.number({ required_error: 'OFFICE_LNG is required' }),
  OFFICE_RADIUS_METERS: z.coerce.number().positive().default(100),

  // ── Google OAuth ──────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_CALLBACK_URL: z.string().url('GOOGLE_CALLBACK_URL must be a valid URL'),

  // ── Web Push (VAPID) ──────────────────────────────────────────────────────
  // Optional in dev — push delivery is silently skipped when absent.
  VAPID_PUBLIC_KEY:  z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT:     z.string().optional(),

  // ── Appwrite Storage ──────────────────────────────────────────────────────
  // Required once file uploads are live. Leave as empty strings in dev
  // until a real Appwrite project is configured.
  APPWRITE_ENDPOINT: z.string().url('APPWRITE_ENDPOINT must be a valid URL').optional(),
  APPWRITE_PROJECT_ID: z.string().optional(),
  APPWRITE_BUCKET_ID: z.string().optional(),
  APPWRITE_API_KEY: z.string().optional(),

  // ── Email (Mailtrap) ──────────────────────────────────────────────────────
  // Credentials from https://mailtrap.io → Sending → API Tokens
  // Optional in dev — when absent, emails are logged to the console (stub mode).
  // Required in production (enforced below).
  MAILTRAP_TOKEN: z.string().optional(),
  // From-address shown to recipients. Must be a verified sender in Mailtrap
  // for production. The default works in stub/dev mode.
  EMAIL_FROM: z
    .string()
    .default('Whippie <no-reply@whippie.app>'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌  Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  const data = result.data;

  // In production, Appwrite vars must all be present
  if (data.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!data.APPWRITE_ENDPOINT) missing.push('APPWRITE_ENDPOINT');
    if (!data.APPWRITE_PROJECT_ID) missing.push('APPWRITE_PROJECT_ID');
    if (!data.APPWRITE_BUCKET_ID) missing.push('APPWRITE_BUCKET_ID');
    if (!data.APPWRITE_API_KEY) missing.push('APPWRITE_API_KEY');
    if (!data.MAILTRAP_TOKEN) missing.push('MAILTRAP_TOKEN');

    if (missing.length > 0) {
      console.error('❌  Missing required production environment variables:');
      missing.forEach((v) => console.error(`   ${v}`));
      process.exit(1);
    }
  }

  return data;
}

export const env = validateEnv();
export type Env = typeof env;
