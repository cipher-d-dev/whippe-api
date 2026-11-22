import mongoose from 'mongoose';
import { Settings } from './settings.model';
import { UpdateSettingsInput } from './settings.schema';

export interface AppSettings {
  labels: { INTERNSHIP: string; NYSC_IT: string };
  stations: string[];
  updatedAt: string | null;
}

/** What the apps show until HR changes it. */
export const DEFAULT_SETTINGS: AppSettings = {
  labels: { INTERNSHIP: 'Intern', NYSC_IT: 'Corps member' },
  stations: ['AIT', 'Raypower', 'Faaji', 'DAAR Corporate'],
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
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export async function updateSettings(input: UpdateSettingsInput, actorId: string): Promise<AppSettings> {
  const set: Record<string, unknown> = { updatedBy: new mongoose.Types.ObjectId(actorId) };
  if (input.labels?.INTERNSHIP) set['labels.INTERNSHIP'] = input.labels.INTERNSHIP;
  if (input.labels?.NYSC_IT) set['labels.NYSC_IT'] = input.labels.NYSC_IT;
  if (input.stations) set['stations'] = input.stations;
  await Settings.findOneAndUpdate({ key: 'app' }, { $set: set, $setOnInsert: { key: 'app' } }, { upsert: true });
  return getSettings();
}
