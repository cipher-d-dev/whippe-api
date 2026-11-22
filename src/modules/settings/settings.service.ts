import mongoose from 'mongoose';
import { Settings } from './settings.model';
import { UpdateSettingsInput } from './settings.schema';

export interface StipendRule { days: number; amount: number }

export interface AppSettings {
  labels: { INTERNSHIP: string; NYSC_IT: string };
  stations: string[];
  /** Expected working days per month and the full monthly stipend (naira). */
  stipend: { INTERNSHIP: StipendRule; NYSC_IT: StipendRule };
  updatedAt: string | null;
}

/** What the apps show until HR changes it. */
export const DEFAULT_SETTINGS: AppSettings = {
  labels: { INTERNSHIP: 'Intern', NYSC_IT: 'Corps member' },
  stations: ['AIT', 'Raypower', 'Faaji', 'DAAR Corporate'],
  // From HR: corps members work 16 days a month (4 a week) for ₦50,000;
  // students on industrial training work 20 days for ₦40,000.
  stipend: {
    INTERNSHIP: { days: 20, amount: 40_000 },
    NYSC_IT: { days: 16, amount: 50_000 },
  },
  updatedAt: null,
};

export async function getSettings(): Promise<AppSettings> {
  const doc = await Settings.findOne({ key: 'app' }).lean();
  return {
    labels: {
      INTERNSHIP: doc?.labels?.INTERNSHIP || DEFAULT_SETTINGS.labels.INTERNSHIP,
      NYSC_IT: doc?.labels?.NYSC_IT || DEFAULT_SETTINGS.labels.NYSC_IT,
    },
    stations: doc?.stations?.length ? doc.stations : DEFAULT_SETTINGS.stations,
    stipend: {
      INTERNSHIP: {
        days: doc?.stipend?.INTERNSHIP?.days ?? DEFAULT_SETTINGS.stipend.INTERNSHIP.days,
        amount: doc?.stipend?.INTERNSHIP?.amount ?? DEFAULT_SETTINGS.stipend.INTERNSHIP.amount,
      },
      NYSC_IT: {
        days: doc?.stipend?.NYSC_IT?.days ?? DEFAULT_SETTINGS.stipend.NYSC_IT.days,
        amount: doc?.stipend?.NYSC_IT?.amount ?? DEFAULT_SETTINGS.stipend.NYSC_IT.amount,
      },
    },
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export async function updateSettings(input: UpdateSettingsInput, actorId: string): Promise<AppSettings> {
  const set: Record<string, unknown> = { updatedBy: new mongoose.Types.ObjectId(actorId) };
  if (input.labels?.INTERNSHIP) set['labels.INTERNSHIP'] = input.labels.INTERNSHIP;
  if (input.labels?.NYSC_IT) set['labels.NYSC_IT'] = input.labels.NYSC_IT;
  if (input.stations) set['stations'] = input.stations;
  for (const type of ['INTERNSHIP', 'NYSC_IT'] as const) {
    const rule = input.stipend?.[type];
    if (rule?.days !== undefined) set[`stipend.${type}.days`] = rule.days;
    if (rule?.amount !== undefined) set[`stipend.${type}.amount`] = rule.amount;
  }
  await Settings.findOneAndUpdate({ key: 'app' }, { $set: set, $setOnInsert: { key: 'app' } }, { upsert: true });
  return getSettings();
}
