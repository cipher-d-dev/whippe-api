/** Private chats between interns: who can start them, privacy, block, report, retention. */
import { fakeModel, newId } from '../helpers/fake-model';

const models = {
  Conversation: fakeModel('Conversation'),
  Message: fakeModel('Message'),
  ChatUpload: fakeModel('ChatUpload'),
  User: fakeModel('User'),
  Intern: fakeModel('Intern'),
  Supervisor: fakeModel('Supervisor'),
};

jest.mock('../../src/modules/chat/chat.model', () => ({
  ...jest.requireActual('../../src/modules/chat/chat.model'),
  Conversation: models.Conversation,
  Message: models.Message,
  ChatUpload: models.ChatUpload,
}));
jest.mock('../../src/modules/users/user.model', () => ({ User: models.User }));
jest.mock('../../src/modules/interns/intern.model', () => ({ Intern: models.Intern }));
jest.mock('../../src/modules/supervisors/supervisor.model', () => ({ Supervisor: models.Supervisor }));
jest.mock('../../src/modules/notifications/push.service', () => ({ sendPushToUser: jest.fn(async () => undefined) }));
jest.mock('../../src/lib/appwrite', () => ({
  uploadPrivateFile: jest.fn(async () => `file-${Math.random().toString(36).slice(2)}`),
  downloadFile: jest.fn(async () => Buffer.from('x')),
  deleteFile: jest.fn(async () => undefined),
}));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn(async () => true) }));
jest.mock('../../src/lib/urls', () => ({ staffPortalUrl: () => 'https://staff.test', appUrlFor: () => 'https://app.test' }));
jest.mock('../../src/modules/chat/chat.realtime', () => ({ publishToUsers: jest.fn(async () => undefined) }));
jest.mock('../../src/modules/notifications/notification.service', () => ({ notifyAllHR: jest.fn(async () => undefined) }));

import * as chat from '../../src/modules/chat/chat.service';
import { publishToUsers } from '../../src/modules/chat/chat.realtime';
import { sendPushToUser } from '../../src/modules/notifications/push.service';
import { deleteFile } from '../../src/lib/appwrite';
import { sendEmail } from '../../src/lib/email';
import { Role } from '../../src/modules/auth/auth.types';

const flush = () => new Promise((r) => setTimeout(r, 0));
const person = (role: Role, firstName: string) => {
  const u = models.User.insert({ _id: newId(), role, firstName, lastName: 'T', email: `${firstName.toLowerCase()}@test.com`, status: 'ACTIVE' });
  return { id: String(u._id), role };
};

const hr1 = person(Role.HR, 'Cindy');
const hr2 = person(Role.HR, 'Bola');
const sup = person(Role.SUPERVISOR, 'Greg');
const sup2 = person(Role.SUPERVISOR, 'Ada');
const intern = person(Role.INTERN, 'Tolani');
const intern2 = person(Role.INTERN, 'Chiamaka');
const internRec = models.Intern.insert({ firstName: 'Tolani', lastName: 'T', user: intern.id, status: 'ACTIVE', internshipType: 'NYSC_IT' });
const intern2Rec = models.Intern.insert({ firstName: 'Chiamaka', lastName: 'T', user: intern2.id, status: 'ACTIVE' });
models.Intern.insert({ firstName: 'Noaccount', lastName: 'Yet', status: 'ACTIVE' });
models.Supervisor.insert({ user: sup.id, firstName: 'Greg', lastName: 'T', isActive: true, departments: [] });

import { notifyAllHR } from '../../src/modules/notifications/notification.service';

const intern3 = person(Role.INTERN, 'Abubakar');
models.Intern.insert({ firstName: 'Abubakar', lastName: 'T', user: intern3.id, status: 'COMPLETED', completedAt: new Date() });

describe('intern-to-intern chat', () => {
  let dm = '';

  it('interns can find other current interns, not themselves or finished ones', async () => {
    const c = await chat.listContacts(intern);
    expect(c.people.map((p) => p.name)).toEqual(['Chiamaka T']);
    await expect(chat.openConversation(intern, { userId: intern3.id })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('opens one private chat per pair, from either side', async () => {
    const a = await chat.openConversation(intern, { userId: intern2.id });
    const b = await chat.openConversation(intern2, { userId: intern.id });
    expect(a.id).toBe(b.id);
    expect(a.kind).toBe('INTERN_DM');
    expect(a.with).toMatchObject({ kind: 'INTERN_PERSON', name: 'Chiamaka T' });
    dm = a.id;
  });

  it('is private: HR and supervisors cannot see it until it is reported', async () => {
    await chat.sendMessage(intern, dm, { text: 'Hey, are you coming for the training?', uploads: [] });
    await expect(chat.listMessages(hr1, dm, { limit: 10 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(chat.listMessages(sup, dm, { limit: 10 })).rejects.toMatchObject({ statusCode: 404 });
    expect((await chat.listConversations(hr1, { limit: 100 })).some((c) => c.id === dm)).toBe(false);
    const mine = await chat.listConversations(intern2, { limit: 100 });
    expect(mine.find((c) => c.id === dm)).toMatchObject({ unread: 1, canSend: true });
  });

  it('blocking stops messages both ways until unblocked', async () => {
    await chat.setBlocked(intern2, dm, true);
    await expect(chat.sendMessage(intern, dm, { text: 'hello?', uploads: [] })).rejects.toMatchObject({ statusCode: 403 });
    await expect(chat.sendMessage(intern2, dm, { text: 'x', uploads: [] })).rejects.toMatchObject({ message: expect.stringContaining('Unblock') });
    const v = await chat.getConversation(intern, dm);
    expect(v.blocked).toEqual({ byMe: false, byThem: true });
    await chat.setBlocked(intern2, dm, false);
    await expect(chat.sendMessage(intern, dm, { text: 'hello?', uploads: [] })).resolves.toBeTruthy();
  });

  it('reporting shares the chat with HR to read, not to write or leave read ticks', async () => {
    const bad = await chat.sendMessage(intern, dm, { text: 'something rude', uploads: [] });
    await expect(chat.reportConversation(intern, dm, { reason: 'my own', messageId: bad.id })).rejects.toMatchObject({ statusCode: 400 });
    const r = await chat.reportConversation(intern2, dm, { reason: 'Rude messages', messageId: bad.id, block: true });
    expect(r.blocked.byMe).toBe(true);
    expect(notifyAllHR).toHaveBeenCalled();

    const hrView = (await chat.listConversations(hr1, { limit: 100 })).find((c) => c.id === dm)!;
    expect(hrView).toMatchObject({ canSend: false, unread: 0, with: { kind: 'INTERN_PAIR', name: 'Tolani T & Chiamaka T' } });
    expect(hrView.reports).toEqual([expect.objectContaining({ byName: 'Chiamaka T', reason: 'Rude messages', messageId: bad.id })]);

    const page = await chat.listMessages(hr1, dm, { limit: 10 });
    expect(page.messages.map((m) => m.text)).toContain('something rude');
    await expect(chat.sendMessage(hr1, dm, { text: 'HR here', uploads: [] })).rejects.toMatchObject({ statusCode: 403 });
    await chat.markRead(hr1, dm);
    const conv = models.Conversation.store.find((c) => String(c._id) === dm)!;
    expect(conv.states.some((s: any) => s.user === hr1.id)).toBe(false);

    // Interns never see the reports themselves
    expect((await chat.getConversation(intern, dm)).reports).toEqual([]);
    const resolved = await chat.resolveReport(hr1, dm);
    expect(resolved.reportResolvedAt).not.toBeNull();
    await expect(chat.resolveReport(intern, dm)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('only private intern chats can be blocked or reported', async () => {
    const hrChat = await chat.openConversation(intern, {});
    await expect(chat.setBlocked(intern, hrChat.id, true)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('is deleted 30 days after either intern finishes', async () => {
    Object.assign(internRec, { status: 'COMPLETED', completedAt: new Date(Date.now() - 31 * 86_400_000) });
    await chat.deleteExpiredChats();
    expect(models.Conversation.store.find((c) => String(c._id) === dm)).toBeUndefined();
  });
});
