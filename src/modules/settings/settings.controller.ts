import { Request, Response, NextFunction } from 'express';
import * as settingsService from './settings.service';
import { updateSettingsSchema } from './settings.schema';
import { getAuthUser } from '../../middleware/auth';

export async function getSettingsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await settingsService.getSettings();
    res.status(200).json({ success: true, data: { settings } });
  } catch (err) {
    next(err);
  }
}

export async function updateSettingsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = updateSettingsSchema.parse({ body: req.body });
    const settings = await settingsService.updateSettings(body, getAuthUser(req).id);
    res.status(200).json({ success: true, message: 'Settings saved.', data: { settings } });
  } catch (err) {
    next(err);
  }
}
