import mongoose from 'mongoose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/modules/users/user.model', () => ({
  User: { findOne: jest.fn(), findById: jest.fn(), create: jest.fn(), countDocuments: jest.fn(), findByIdAndDelete: jest.fn() },
}));
jest.mock('../../src/modules/notifications/notification.service', () => ({ createNotification: jest.fn(), notifyAllHR: jest.fn() }));
jest.mock('../../src/modules/timeline/audit-log.service', () => ({ logAction: jest.fn().mockResolvedValue({}) }));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../src/modules/settings/settings.model', () => ({
  Settings: { findOne: jest.fn(), findOneAndUpdate: jest.fn() },
}));
jest.mock('../../src/modules/documents/document.model', () => ({
  DocumentRequirement: { findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() },
  DocumentRecord: { countDocuments: jest.fn() },
}));

import { User } from '../../src/modules/users/user.model';
import { Settings } from '../../src/modules/settings/settings.model';
import { DocumentRecord, DocumentRequirement } from '../../src/modules/documents/document.model';
import { sendEmail } from '../../src/lib/email';
import { inviteHr, deleteUser } from '../../src/modules/users/users.service';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../../src/modules/settings/settings.service';
import { deleteRequirement } from '../../src/modules/documents/document.service';
import { updateSettingsSchema } from '../../src/modules/settings/settings.schema';
import { appUrlFor, staffPortalUrl } from '../../src/lib/urls';
import { Role, AccountStatus } from '../../src/modules/auth/auth.types';

const actorId = new mongoose.Types.ObjectId().toString();
const lean = (v: unknown) => ({ lean: jest.fn().mockResolvedValue(v) });
const selectable = (v: unknown) => ({ select: jest.fn().mockResolvedValue(v) });

beforeEach(() => jest.clearAllMocks());

describe('staff URLs', () => {
  it('fall back to FRONTEND_URL when ADMIN_URL is not set', () => {
    expect(staffPortalUrl()).toBe('http://localhost:3000');
  });
  it('send interns to the intern app', () => {
    expect(appUrlFor(Role.INTERN)).toBe('http://localhost:3000');
  });
});

describe('inviteHr', () => {
  const input = { firstName: 'Cindy', lastName: 'Uduma', email: 'cindy@example.com' };

  it('creates an active HR account and emails a temporary password', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockImplementation(async (doc) => ({ ...doc, id: 'new-id' }));
    (User.findById as jest.Mock).mockReturnValue(selectable({ firstName: 'Funmi', lastName: 'Adeyemi' }));

    const user = await inviteHr(input, actorId);

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'cindy@example.com', role: Role.HR, status: AccountStatus.ACTIVE,
    }));
    expect((user as unknown as { passwordHash: string }).passwordHash).toMatch(/^\$2/);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'cindy@example.com' }));
    const mail = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(mail.text).toContain('Funmi Adeyemi');
    expect(mail.text).toContain('http://localhost:3000/login');
  });

  it('refuses an email that already belongs to a supervisor, and says why', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({ role: Role.SUPERVISOR });
    await expect(inviteHr(input, actorId)).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('supervisor') });
    expect(User.create).not.toHaveBeenCalled();
  });
});

describe('deleteUser guards', () => {
  it('stops HR removing their own account', async () => {
    await expect(deleteUser(actorId, actorId)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('stops removing the last HR account', async () => {
    const target = new mongoose.Types.ObjectId().toString();
    (User.findById as jest.Mock).mockReturnValue(selectable({ role: Role.HR }));
    (User.countDocuments as jest.Mock).mockResolvedValue(1);
    await expect(deleteUser(target, actorId)).rejects.toMatchObject({ statusCode: 409 });
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
  });
});

describe('settings', () => {
  it('returns defaults before HR has saved anything', async () => {
    (Settings.findOne as jest.Mock).mockReturnValue(lean(null));
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('only sets the fields that were sent', async () => {
    (Settings.findOneAndUpdate as jest.Mock).mockResolvedValue({});
    (Settings.findOne as jest.Mock).mockReturnValue(lean({ labels: { NYSC_IT: 'Corps member (NYSC)' }, updatedAt: new Date() }));
    const out = await updateSettings({ labels: { NYSC_IT: 'Corps member (NYSC)' } }, actorId);
    const set = (Settings.findOneAndUpdate as jest.Mock).mock.calls[0][1].$set;
    expect(set['labels.NYSC_IT']).toBe('Corps member (NYSC)');
    expect(set).not.toHaveProperty('labels.INTERNSHIP');
    expect(out.labels).toEqual({ INTERNSHIP: 'Intern', NYSC_IT: 'Corps member (NYSC)' });
  });

  it('rejects duplicate station names and empty labels', () => {
    expect(updateSettingsSchema.safeParse({ body: { stations: ['AIT', 'ait'] } }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ body: { labels: { NYSC_IT: '  ' } } }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ body: { labels: { NYSC_IT: 'Corper' } } }).success).toBe(true);
  });
});

describe('deleteRequirement', () => {
  const id = new mongoose.Types.ObjectId().toString();
  it('refuses while interns have documents filed under it', async () => {
    (DocumentRecord.countDocuments as jest.Mock).mockResolvedValue(3);
    await expect(deleteRequirement(id)).rejects.toMatchObject({ statusCode: 409 });
    expect(DocumentRequirement.findByIdAndDelete).not.toHaveBeenCalled();
  });
  it('removes it when unused', async () => {
    (DocumentRecord.countDocuments as jest.Mock).mockResolvedValue(0);
    (DocumentRequirement.findByIdAndDelete as jest.Mock).mockResolvedValue({ _id: id });
    await expect(deleteRequirement(id)).resolves.toBeUndefined();
  });
});
