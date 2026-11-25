/**
 * Chat: who can see what, messages, replies, ticks, unread counts, edits,
 * deletes, attachments and retention — against an in-memory database.
 */
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

describe('chat', () => {
  let convId = '';

  it('an intern opens their HR chat; HR opening the same intern gets the same chat', async () => {
    const c = await chat.openConversation(intern, {});
    expect(c.with.name).toBe('HR team');
    const again = await chat.openConversation(hr1, { internId: String(internRec._id) });
    expect(again.id).toBe(c.id);
    expect(again.with.name).toBe('Tolani T');
    convId = c.id;
  });

  it('lists who each person can start a chat with', async () => {
    const hr = await chat.listContacts(hr1);
    expect(hr.interns.map((i) => i.name).sort()).toEqual(['Chiamaka T', 'Tolani T']); // not the one without an account
    expect(hr.people).toEqual([expect.objectContaining({ userId: sup.id, role: 'SUPERVISOR' })]);
    const s = await chat.listContacts(sup);
    expect(s.interns).toEqual([]);
    expect(s.people.map((p) => p.userId).sort()).toEqual([hr1.id, hr2.id].sort());
    expect((await chat.listContacts(intern)).people.map((p) => p.name)).toEqual(['Chiamaka T']); // other interns only
  });

  it('keeps people out of chats that are not theirs', async () => {
    await expect(chat.listMessages(intern2, convId, { limit: 40 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(chat.listMessages(sup, convId, { limit: 40 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(chat.openConversation(sup, { internId: String(intern2Rec._id) })).rejects.toMatchObject({ statusCode: 403 });
    await expect(chat.openConversation(sup, { userId: sup2.id })).rejects.toMatchObject({ statusCode: 403 });
    await expect(chat.openConversation(intern, { userId: hr1.id })).rejects.toMatchObject({ statusCode: 404 }); // HR is reached through the HR chat
  });

  it('sends to the whole HR team, pushes, and counts unread per person', async () => {
    (publishToUsers as jest.Mock).mockClear();
    const m = await chat.sendMessage(intern, convId, { text: 'Good morning, my check-in failed', uploads: [], clientId: 'c1' });
    await flush();
    const [to, event] = (publishToUsers as jest.Mock).mock.calls[0];
    expect(new Set(to)).toEqual(new Set([intern.id, hr1.id, hr2.id]));
    expect(event).toMatchObject({ name: 'message', data: { type: 'new', message: { id: m.id, text: 'Good morning, my check-in failed' } } });
    expect((sendPushToUser as jest.Mock).mock.calls.map((c) => c[0]).sort()).toEqual([hr1.id, hr2.id].sort());

    expect(await chat.unreadTotal(hr1)).toEqual({ chats: 1 });
    expect(await chat.unreadTotal(intern)).toEqual({ chats: 0 });
    const [row] = await chat.listConversations(hr1, { limit: 100 });
    expect(row).toMatchObject({ unread: 1, lastMessage: { text: 'Good morning, my check-in failed' } });
  });

  it('a retried send is not saved twice', async () => {
    await chat.sendMessage(intern, convId, { text: 'Good morning, my check-in failed', uploads: [], clientId: 'c1' });
    expect(models.Message.store.filter((m) => m.clientId === 'c1')).toHaveLength(1);
  });

  it('replies carry a quote, and ticks follow delivered/read', async () => {
    const original = models.Message.store[0];
    const reply = await chat.sendMessage(hr1, convId, { text: 'Try again near the gate', replyTo: String(original._id), uploads: [] });
    expect(reply.replyTo).toMatchObject({ id: String(original._id), senderName: 'Tolani T', text: 'Good morning, my check-in failed' });

    // HR replied, so HR's side has read the intern's message: the intern sees blue ticks.
    let page = await chat.listMessages(intern, convId, { limit: 40 });
    expect(page.otherReadAt).not.toBeNull();
    // The intern hasn't received HR's reply yet.
    page = await chat.listMessages(hr1, convId, { limit: 40 });
    expect(page.otherDeliveredAt && new Date(page.otherDeliveredAt) >= new Date(reply.createdAt)).toBe(false);

    await chat.markDelivered(intern);
    page = await chat.listMessages(hr1, convId, { limit: 40 });
    expect(new Date(page.otherDeliveredAt!) >= new Date(reply.createdAt)).toBe(true);
    expect(page.otherReadAt && new Date(page.otherReadAt) >= new Date(reply.createdAt)).toBe(false);

    expect(await chat.unreadTotal(intern)).toEqual({ chats: 1 });
    await chat.markRead(intern, convId);
    expect(await chat.unreadTotal(intern)).toEqual({ chats: 0 });
    page = await chat.listMessages(hr1, convId, { limit: 40 });
    expect(new Date(page.otherReadAt!) >= new Date(reply.createdAt)).toBe(true);
  });

  it('pages older messages and can jump to one', async () => {
    for (let i = 0; i < 12; i++) await chat.sendMessage(intern, convId, { text: `msg ${i}`, uploads: [] });
    const latest = await chat.listMessages(intern, convId, { limit: 5 });
    expect(latest.messages.map((m) => m.text)).toEqual(['msg 7', 'msg 8', 'msg 9', 'msg 10', 'msg 11']);
    expect(latest.hasOlder).toBe(true);
    const older = await chat.listMessages(intern, convId, { before: latest.messages[0].id, limit: 5 });
    expect(older.messages.at(-1)!.text).toBe('msg 6');
    const target = models.Message.store[0];
    const around = await chat.listMessages(intern, convId, { around: String(target._id), limit: 4 });
    expect(around.messages[0].id).toBe(String(target._id));
    expect(around.hasNewer).toBe(true);
  });

  it('edits within 15 minutes and deletes for everyone, updating quotes', async () => {
    const original = models.Message.store[0];
    const edited = await chat.editMessage(intern, String(original._id), 'My check-in failed twice');
    expect(edited.editedAt).not.toBeNull();
    const quoting = models.Message.store.find((m) => String(m.replyTo) === String(original._id))!;
    expect(quoting.replyPreview.text).toBe('My check-in failed twice');

    await expect(chat.editMessage(hr1, String(original._id), 'hack')).rejects.toMatchObject({ statusCode: 403 });

    original.createdAt = new Date(Date.now() - 20 * 60_000);
    await expect(chat.editMessage(intern, String(original._id), 'late')).rejects.toMatchObject({ statusCode: 409 });

    const del = await chat.deleteMessage(intern, String(original._id));
    expect(del).toMatchObject({ text: '', deletedAt: expect.any(Date) });
    expect(quoting.replyPreview).toMatchObject({ deleted: true, text: '' });
  });

  it('accepts real photos and PDFs only, and attaches them once', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
    await expect(chat.uploadAttachment(intern, Buffer.from('MZ' + 'x'.repeat(20)), 'virus.png')).rejects.toMatchObject({ statusCode: 415 });
    const up = await chat.uploadAttachment(intern, png, 'screen shot.png');
    expect(up).toMatchObject({ mime: 'image/png', name: 'screen shot.png' });

    await expect(chat.sendMessage(intern2, (await chat.openConversation(intern2, {})).id, { text: '', uploads: [up.id] }))
      .rejects.toMatchObject({ statusCode: 400 }); // not theirs

    const m = await chat.sendMessage(intern, convId, { text: '', uploads: [up.id] });
    expect(m.attachments).toEqual([{ index: 0, name: 'screen shot.png', mime: 'image/png', size: png.length, duration: null }]);
    const conv = models.Conversation.store.find((c) => String(c._id) === convId)!;
    expect(conv.lastMessage.text).toBe('📷 Photo');
    await expect(chat.sendMessage(intern, convId, { text: 'again', uploads: [up.id] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(chat.getAttachment(intern2, m.id, 0)).rejects.toMatchObject({ statusCode: 404 });
    await expect(chat.getAttachment(hr2, m.id, 0)).resolves.toMatchObject({ mime: 'image/png' });
  });

  it('reacts once per person: add, change, remove', async () => {
    const m = await chat.sendMessage(intern, convId, { text: 'Is Friday a holiday?', uploads: [] });
    let v = await chat.react(hr1, m.id, '👍');
    v = await chat.react(hr2, m.id, '👍');
    expect(v.reactions).toEqual([{ emoji: '👍', users: [{ id: hr1.id, name: 'Cindy T' }, { id: hr2.id, name: 'Bola T' }] }]);
    v = await chat.react(hr1, m.id, '😂');
    expect(v.reactions.map((r) => [r.emoji, r.users.length])).toEqual([['👍', 1], ['😂', 1]]);
    v = await chat.react(hr1, m.id, '😂');
    expect(v.reactions.map((r) => r.emoji)).toEqual(['👍']);
  });

  it('sends stickers and voice notes, with list previews', async () => {
    await chat.sendMessage(hr1, convId, { text: '', uploads: [], sticker: 'thank-you' });
    let conv = models.Conversation.store.find((c) => String(c._id) === convId)!;
    expect(conv.lastMessage.text).toBe('✨ Sticker');

    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(40)]);
    await expect(chat.uploadAttachment(intern, webm, 'voice.webm')).rejects.toMatchObject({ statusCode: 415 }); // not as a file
    const up = await chat.uploadAttachment(intern, webm, 'voice.webm', { kind: 'voice', duration: 12.4 });
    expect(up).toMatchObject({ mime: 'audio/webm', duration: 12 });
    const m = await chat.sendMessage(intern, convId, { text: '', uploads: [up.id] });
    expect(m.attachments[0]).toMatchObject({ mime: 'audio/webm', duration: 12 });
    conv = models.Conversation.store.find((c) => String(c._id) === convId)!;
    expect(conv.lastMessage.text).toBe('🎤 Voice message (0:12)');
  });

  it('a muted chat sends no push notifications to that person', async () => {
    await chat.setMute(hr1, convId, '8h');
    (sendPushToUser as jest.Mock).mockClear();
    await chat.sendMessage(intern, convId, { text: 'Hello again', uploads: [] });
    await flush();
    expect((sendPushToUser as jest.Mock).mock.calls.map((c) => c[0])).toEqual([hr2.id]);
    expect((await chat.getConversation(hr1, convId)).mutedUntil).not.toBeNull();
    await chat.setMute(hr1, convId, 'off');
    expect((await chat.getConversation(hr1, convId)).mutedUntil).toBeNull();
  });

  it('chat info lists shared photos, voice notes and links', async () => {
    await chat.sendMessage(intern, convId, { text: 'See https://daar.com/careers and http://x.test/a.', uploads: [] });
    const info = await chat.chatInfo(intern, convId);
    expect(info.profile).toMatchObject({ name: 'HR team', team: ['Bola T', 'Cindy T'] });
    expect(info.media.map((f) => f.name)).toContain('screen shot.png');
    expect(info.voice).toHaveLength(1);
    expect(info.links.map((l) => l.url)).toEqual(['https://daar.com/careers', 'http://x.test/a']);
  });

  it('HR and a supervisor can DM; other HR cannot see it', async () => {
    const dm = await chat.openConversation(hr1, { userId: sup.id });
    const same = await chat.openConversation(sup, { userId: hr1.id });
    expect(same.id).toBe(dm.id);
    await chat.sendMessage(sup, dm.id, { text: 'Can Tolani leave early Friday?', uploads: [] });
    await expect(chat.listMessages(hr2, dm.id, { limit: 10 })).rejects.toMatchObject({ statusCode: 404 });
    const supList = await chat.listConversations(sup, { limit: 100 });
    expect(supList.map((c) => c.id)).toEqual([dm.id]);
    const hrDms = await chat.listConversations(hr1, { kind: 'STAFF_DM', limit: 100 });
    expect(hrDms.map((c) => c.with.name)).toEqual(['Greg T']);
  });

  it('emails people about messages unread for hours, at most once a day', async () => {
    const dm = models.Conversation.store.find((c) => c.kind === 'STAFF_DM')!;
    const later = new Date(dm.lastMessageAt.getTime() + chat.NUDGE_AFTER_MS + 60_000);
    (sendEmail as jest.Mock).mockClear();
    expect(await chat.sendUnreadNudges(later)).toBe(1);
    expect((sendEmail as jest.Mock).mock.calls[0][0].to).toBe('cindy@test.com');
    expect(await chat.sendUnreadNudges(new Date(later.getTime() + 60_000))).toBe(0);
  });

  it('deletes an intern chat and its files 30 days after the internship ends', async () => {
    (deleteFile as jest.Mock).mockClear();
    Object.assign(internRec, { status: 'COMPLETED', completedAt: new Date(Date.now() - 31 * 86_400_000) });
    const removed = await chat.deleteExpiredChats();
    expect(removed).toBeGreaterThan(10);
    expect(models.Conversation.store.find((c) => String(c._id) === convId)).toBeUndefined();
    expect(models.Message.store.some((m) => String(m.conversation) === convId)).toBe(false);
    expect(deleteFile).toHaveBeenCalled();
    expect(models.Conversation.store.some((c) => c.kind === 'STAFF_DM')).toBe(true); // DMs are kept
  });
});
