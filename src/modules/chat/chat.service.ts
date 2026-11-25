import mongoose from 'mongoose';
import {
  Conversation, ConversationKind, IConversationDocument, IMessageDocument, Message, ChatUpload,
} from './chat.model';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, SendMessageInput } from './chat.schema';
import { publishToUsers } from './chat.realtime';
import { User } from '../users/user.model';
import { Intern } from '../interns/intern.model';
import { Supervisor } from '../supervisors/supervisor.model';
import { InternshipStatus } from '../interns/intern.types';
import { AccountStatus, Role } from '../auth/auth.types';
import { sendPushToUser } from '../notifications/push.service';
import { createError } from '../../middleware/error-handler';
import { uploadPrivateFile, downloadFile, deleteFile } from '../../lib/appwrite';
import { sendEmail } from '../../lib/email';
import { renderChatNudgeEmail } from '../../lib/email-templates';
import { appUrlFor, staffPortalUrl } from '../../lib/urls';

type Id = mongoose.Types.ObjectId;
export interface ChatUser { id: string; role: Role }

/** Sender can edit for this long, and delete for everyone for this long. */
export const EDIT_WINDOW_MS = 15 * 60_000;
export const DELETE_WINDOW_MS = 24 * 60 * 60_000;
/** Intern chats are deleted this long after the internship is completed. */
export const CHAT_RETENTION_DAYS = 30;
/** Email someone about unread messages after this long, at most once a day per chat. */
export const NUDGE_AFTER_MS = 3 * 60 * 60_000;
const NUDGE_GAP_MS = 24 * 60 * 60_000;

const oid = (s: string | Id) => new mongoose.Types.ObjectId(String(s));
const same = (a: unknown, b: unknown) => String(a) === String(b);
const fullName = (u?: { firstName?: string; lastName?: string } | null) =>
  u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Someone' : 'Someone';

// ─── HR team (cached briefly: every intern chat goes to all of HR) ───────────

let hrCache: { at: number; ids: string[] } | null = null;
export async function hrUserIds(): Promise<string[]> {
  if (hrCache && Date.now() - hrCache.at < 60_000) return hrCache.ids;
  const hr = await User.find({ role: Role.HR, status: { $ne: AccountStatus.REJECTED } }).select('_id').lean();
  hrCache = { at: Date.now(), ids: hr.map((h) => String(h._id)) };
  return hrCache.ids;
}
export function clearHrCache() { hrCache = null; }

/** Everyone who should see a conversation's events. */
async function audience(conv: IConversationDocument): Promise<string[]> {
  const members = conv.members.map(String);
  return conv.kind === ConversationKind.INTERN_HR ? [...new Set([...members, ...(await hrUserIds())])] : members;
}

function canSee(conv: IConversationDocument, user: ChatUser): boolean {
  const member = conv.members.some((m) => same(m, user.id));
  if (conv.kind === ConversationKind.INTERN_HR) return user.role === Role.HR || (user.role === Role.INTERN && member);
  return member;
}

async function loadConversation(id: string, user: ChatUser): Promise<IConversationDocument> {
  const conv = await Conversation.findById(id);
  if (!conv || !canSee(conv, user)) throw createError('Chat not found.', 404);
  return conv;
}

function stateOf(conv: IConversationDocument, userId: string) {
  return conv.states.find((s) => same(s.user, userId));
}

/** Moves a person's read/delivered marks forward (never back). */
function advance(conv: IConversationDocument, userId: string, patch: { readAt?: Date; deliveredAt?: Date; nudgedAt?: Date }) {
  let s = stateOf(conv, userId);
  if (!s) {
    conv.states.push({ user: oid(userId) });
    s = conv.states[conv.states.length - 1];
  }
  if (patch.readAt && (!s.readAt || patch.readAt > s.readAt)) s.readAt = patch.readAt;
  const delivered = patch.deliveredAt ?? patch.readAt;
  if (delivered && (!s.deliveredAt || delivered > s.deliveredAt)) s.deliveredAt = delivered;
  if (patch.nudgedAt) s.nudgedAt = patch.nudgedAt;
  conv.markModified('states');
}

/**
 * Read/delivered marks of the *other* side, for ticks on my messages.
 * In an intern chat, HR counts as one side: any HR member reading = read.
 */
function otherSide(conv: IConversationDocument, user: ChatUser, hrIds: string[]) {
  const others = conv.states.filter((s) => {
    if (same(s.user, user.id)) return false;
    if (conv.kind === ConversationKind.INTERN_HR && user.role === Role.HR) {
      return conv.members.some((m) => same(m, s.user)); // HR sees the intern's marks
    }
    if (conv.kind === ConversationKind.INTERN_HR) return hrIds.includes(String(s.user));
    return true;
  });
  const max = (k: 'readAt' | 'deliveredAt') =>
    others.reduce<Date | null>((m, s) => (s[k] && (!m || s[k]! > m) ? s[k]! : m), null);
  return { readAt: max('readAt'), deliveredAt: max('deliveredAt') };
}

// ─── Views ───────────────────────────────────────────────────────────────────

type NameMap = Map<string, { name: string; role: string }>;

async function namesFor(ids: unknown[]): Promise<NameMap> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const users = await User.find({ _id: { $in: unique } }).select('firstName lastName role').lean();
  return new Map(users.map((u) => [String(u._id), { name: fullName(u), role: u.role }]));
}

function preview(m: { text?: string; attachments?: { mime?: string }[] }): string {
  const text = (m.text ?? '').trim();
  if (text) return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  const a = m.attachments?.[0];
  if (!a) return '';
  return a.mime?.startsWith('image/') ? '📷 Photo' : '📄 Document';
}

export function messageView(m: IMessageDocument | Record<string, any>, names: NameMap) {
  const deleted = !!m.deletedAt;
  const sender = names.get(String(m.sender));
  return {
    id: String(m._id),
    conversationId: String(m.conversation),
    sender: { id: String(m.sender), name: sender?.name ?? 'Someone', role: sender?.role ?? null },
    text: deleted ? '' : m.text ?? '',
    attachments: deleted ? [] : (m.attachments ?? []).map((a: any, index: number) => ({ index, name: a.name, mime: a.mime, size: a.size })),
    replyTo: m.replyTo
      ? {
          id: String(m.replyTo),
          senderName: names.get(String(m.replyPreview?.sender))?.name ?? 'Someone',
          text: m.replyPreview?.deleted ? '' : m.replyPreview?.text ?? '',
          deleted: !!m.replyPreview?.deleted,
        }
      : null,
    clientId: m.clientId ?? null,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    createdAt: m.createdAt,
  };
}

async function namesForMessages(msgs: (IMessageDocument | Record<string, any>)[]) {
  return namesFor(msgs.flatMap((m) => [m.sender, m.replyPreview?.sender]));
}

/** Who the conversation is "with", from the viewer's side. */
async function counterparts(convs: IConversationDocument[], user: ChatUser) {
  const internIds = convs.filter((c) => c.intern).map((c) => c.intern);
  const interns = await Intern.find({ _id: { $in: internIds } })
    .select('firstName lastName internshipType department user status')
    .populate('department', 'name')
    .lean();
  const internById = new Map(interns.map((i) => [String(i._id), i]));
  const otherIds = convs.flatMap((c) => c.members.filter((m) => !same(m, user.id)));
  const users = await User.find({ _id: { $in: otherIds } }).select('firstName lastName role lastSeenAt avatarUrl').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  let hrLastSeen: Date | null = null;
  if (user.role === Role.INTERN) {
    const last = await User.findOne({ role: Role.HR, lastSeenAt: { $exists: true } }).sort({ lastSeenAt: -1 }).select('lastSeenAt').lean();
    hrLastSeen = last?.lastSeenAt ?? null;
  }

  return (c: IConversationDocument) => {
    if (c.kind === ConversationKind.INTERN_HR) {
      if (user.role === Role.INTERN) return { kind: 'HR' as const, name: 'HR team', subtitle: 'DAAR Communications', lastSeenAt: hrLastSeen };
      const i = internById.get(String(c.intern));
      const u = userById.get(String(c.members[0]));
      return {
        kind: 'INTERN' as const,
        internId: String(c.intern),
        userId: String(c.members[0]),
        name: i ? fullName(i) : fullName(u),
        subtitle: (i?.department as unknown as { name?: string } | null)?.name ?? null,
        internshipType: i?.internshipType ?? null,
        lastSeenAt: u?.lastSeenAt ?? null,
      };
    }
    const otherId = c.members.find((m) => !same(m, user.id));
    const u = userById.get(String(otherId));
    return {
      kind: (u?.role === Role.HR ? 'HR_PERSON' : 'SUPERVISOR') as 'HR_PERSON' | 'SUPERVISOR',
      userId: String(otherId),
      name: fullName(u),
      subtitle: u?.role === Role.HR ? 'HR' : 'Supervisor',
      lastSeenAt: u?.lastSeenAt ?? null,
    };
  };
}

async function unreadCount(conv: IConversationDocument, userId: string): Promise<number> {
  const readAt = stateOf(conv, userId)?.readAt;
  if (!conv.lastMessageAt || (readAt && readAt >= conv.lastMessageAt)) return 0;
  if (conv.lastMessage && same(conv.lastMessage.sender, userId)) return 0; // I spoke last, so I've seen it
  return Message.countDocuments({
    conversation: conv._id,
    sender: { $ne: oid(userId) },
    deletedAt: { $exists: false },
    ...(readAt && { createdAt: { $gt: readAt } }),
  });
}

async function conversationView(conv: IConversationDocument, user: ChatUser, who: Awaited<ReturnType<typeof counterparts>>, hrIds: string[], names: NameMap) {
  const lm = conv.lastMessage;
  const other = otherSide(conv, user, hrIds);
  return {
    id: String(conv._id),
    kind: conv.kind,
    with: who(conv),
    lastMessage: lm?.id
      ? { id: String(lm.id), senderId: String(lm.sender), senderName: names.get(String(lm.sender))?.name ?? null, text: lm.deleted ? '' : lm.text, deleted: !!lm.deleted, at: lm.at }
      : null,
    lastMessageAt: conv.lastMessageAt ?? null,
    unread: await unreadCount(conv, user.id),
    myReadAt: stateOf(conv, user.id)?.readAt ?? null,
    otherReadAt: other.readAt,
    otherDeliveredAt: other.deliveredAt,
    createdAt: conv.createdAt,
  };
}

async function viewsOf(convs: IConversationDocument[], user: ChatUser) {
  const [who, hrIds, names] = await Promise.all([
    counterparts(convs, user),
    hrUserIds(),
    namesFor(convs.map((c) => c.lastMessage?.sender)),
  ]);
  return Promise.all(convs.map((c) => conversationView(c, user, who, hrIds, names)));
}

// ─── Conversations ───────────────────────────────────────────────────────────

function scopeFilter(user: ChatUser): Record<string, unknown> {
  if (user.role === Role.INTERN) return { kind: ConversationKind.INTERN_HR, members: oid(user.id) };
  if (user.role === Role.HR) return { $or: [{ kind: ConversationKind.INTERN_HR }, { kind: ConversationKind.STAFF_DM, members: oid(user.id) }] };
  return { kind: ConversationKind.STAFF_DM, members: oid(user.id) };
}

async function upsertConversation(filter: Record<string, unknown>, insert: Record<string, unknown>) {
  try {
    return await Conversation.findOneAndUpdate(filter, { $setOnInsert: insert }, { upsert: true, new: true });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return Conversation.findOne(filter); // opened twice at once
    throw err;
  }
}

/**
 * Opens (creating if needed) a chat:
 * - intern, no body → their chat with HR
 * - HR + internId → that intern's chat with HR
 * - HR + userId (a supervisor), or supervisor + userId (an HR person) → their DM
 */
export async function openConversation(user: ChatUser, body: { internId?: string; userId?: string }) {
  let conv: IConversationDocument | null = null;

  if (user.role === Role.INTERN) {
    const intern = await Intern.findOne({ user: oid(user.id) }).select('_id');
    if (!intern) throw createError('No intern record found for this account.', 404);
    conv = await upsertConversation(
      { kind: ConversationKind.INTERN_HR, intern: intern._id },
      { kind: ConversationKind.INTERN_HR, intern: intern._id, members: [oid(user.id)], states: [] },
    );
  } else if (body.internId) {
    if (user.role !== Role.HR) throw createError('Only HR can message interns.', 403);
    const intern = await Intern.findById(body.internId).select('user');
    if (!intern) throw createError('Intern not found.', 404);
    if (!intern.user) throw createError("This intern hasn't set up their account yet, so they can't receive messages.", 409);
    conv = await upsertConversation(
      { kind: ConversationKind.INTERN_HR, intern: intern._id },
      { kind: ConversationKind.INTERN_HR, intern: intern._id, members: [intern.user], states: [] },
    );
  } else if (body.userId) {
    if (same(body.userId, user.id)) throw createError("You can't message yourself.", 400);
    const other = await User.findById(body.userId).select('role');
    if (!other) throw createError('Person not found.', 404);
    const pair = user.role === Role.HR ? other.role === Role.SUPERVISOR : user.role === Role.SUPERVISOR && other.role === Role.HR;
    if (!pair) throw createError('Direct messages are between HR and supervisors.', 403);
    const dmKey = [user.id, body.userId].map(String).sort().join(':');
    conv = await upsertConversation(
      { kind: ConversationKind.STAFF_DM, dmKey },
      { kind: ConversationKind.STAFF_DM, dmKey, members: [oid(user.id), oid(body.userId)], states: [] },
    );
  } else {
    throw createError('Choose who to message.', 400);
  }

  if (!conv) throw createError("Couldn't open the chat. Try again.", 500);
  const [view] = await viewsOf([conv], user);
  return view;
}

export async function listConversations(user: ChatUser, q: { search?: string; kind?: string; limit: number }) {
  const filter = { $and: [scopeFilter(user), ...(q.kind ? [{ kind: q.kind }] : [])] };

  const convs = await Conversation.find(filter).sort({ lastMessageAt: -1, updatedAt: -1 }).limit(q.limit);
  let views = await viewsOf(convs, user);
  // HR's intern list only shows chats with messages, so it isn't padded with empty rows.
  views = views.filter((v) => v.lastMessage || v.kind === ConversationKind.STAFF_DM || user.role === Role.INTERN);
  if (q.search) {
    const s = q.search.toLowerCase();
    views = views.filter((v) => v.with.name.toLowerCase().includes(s) || (v.with.subtitle ?? '').toLowerCase().includes(s));
  }
  return views;
}

export async function getConversation(user: ChatUser, id: string) {
  const conv = await loadConversation(id, user);
  const [view] = await viewsOf([conv], user);
  return view;
}

/** Number of chats with unread messages (the badge). */
export async function unreadTotal(user: ChatUser): Promise<{ chats: number }> {
  const convs = await Conversation.find({ ...scopeFilter(user), lastMessageAt: { $exists: true } }).select('states lastMessage lastMessageAt');
  let chats = 0;
  for (const c of convs) {
    const readAt = stateOf(c, user.id)?.readAt;
    if (c.lastMessage && !same(c.lastMessage.sender, user.id) && !c.lastMessage.deleted && (!readAt || readAt < c.lastMessageAt!)) chats++;
  }
  return { chats };
}

/**
 * People this person can start a chat with: HR → interns (with an account) and
 * supervisors; supervisors → HR; interns → nobody (they have their HR chat).
 */
export async function listContacts(user: ChatUser) {
  if (user.role === Role.HR) {
    const [interns, sups] = await Promise.all([
      Intern.find({ status: { $in: [InternshipStatus.ACTIVE, InternshipStatus.ONBOARDING] }, user: { $exists: true, $ne: null } })
        .select('firstName lastName department internshipType')
        .populate('department', 'name')
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
      Supervisor.find({ isActive: true }).select('user firstName lastName departments').populate('departments', 'name').sort({ firstName: 1 }).lean(),
    ]);
    return {
      interns: interns.map((i) => ({
        internId: String(i._id),
        name: fullName(i),
        subtitle: (i.department as unknown as { name?: string } | null)?.name ?? null,
        internshipType: i.internshipType ?? null,
      })),
      people: sups.map((s) => ({
        userId: String(s.user),
        name: fullName(s),
        subtitle: ((s.departments ?? []) as unknown as { name?: string }[]).map((d) => d?.name).filter(Boolean).join(', ') || 'Supervisor',
        role: Role.SUPERVISOR,
      })),
    };
  }
  if (user.role === Role.SUPERVISOR) {
    const hr = await User.find({ role: Role.HR, status: AccountStatus.ACTIVE }).select('firstName lastName').sort({ firstName: 1 }).lean();
    return { interns: [], people: hr.map((h) => ({ userId: String(h._id), name: fullName(h), subtitle: 'HR', role: Role.HR })) };
  }
  return { interns: [], people: [] };
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function listMessages(
  user: ChatUser,
  id: string,
  q: { before?: string; after?: string; around?: string; limit: number },
) {
  const conv = await loadConversation(id, user);
  const base = { conversation: conv._id };
  let items: IMessageDocument[];
  let hasOlder = false;
  let hasNewer = false;

  if (q.after) {
    const rows = await Message.find({ ...base, _id: { $gt: oid(q.after) } }).sort({ _id: 1 }).limit(q.limit + 1);
    hasNewer = rows.length > q.limit;
    items = rows.slice(0, q.limit);
    hasOlder = true;
  } else if (q.around) {
    const half = Math.max(1, Math.floor(q.limit / 2));
    const target = await Message.findOne({ ...base, _id: oid(q.around) });
    if (!target) throw createError('That message is no longer here.', 404);
    const [older, newer] = await Promise.all([
      Message.find({ ...base, _id: { $lt: target._id } }).sort({ _id: -1 }).limit(half + 1),
      Message.find({ ...base, _id: { $gt: target._id } }).sort({ _id: 1 }).limit(half + 1),
    ]);
    hasOlder = older.length > half;
    hasNewer = newer.length > half;
    items = [...older.slice(0, half).reverse(), target, ...newer.slice(0, half)];
  } else {
    const rows = await Message.find({ ...base, ...(q.before && { _id: { $lt: oid(q.before) } }) })
      .sort({ _id: -1 })
      .limit(q.limit + 1);
    hasOlder = rows.length > q.limit;
    items = rows.slice(0, q.limit).reverse();
  }

  const [names, hrIds] = await Promise.all([namesForMessages(items), hrUserIds()]);
  const other = otherSide(conv, user, hrIds);
  return {
    messages: items.map((m) => messageView(m, names)),
    hasOlder,
    hasNewer,
    myReadAt: stateOf(conv, user.id)?.readAt ?? null,
    otherReadAt: other.readAt,
    otherDeliveredAt: other.deliveredAt,
  };
}

function pushTarget(userRole: Role | string, convId: string) {
  return userRole === Role.INTERN ? `${appUrlFor(Role.INTERN)}/chat` : `${staffPortalUrl()}/messages?c=${convId}`;
}

async function notifyNewMessage(conv: IConversationDocument, msg: IMessageDocument, sender: { name: string; role: string }) {
  const recipients = (await audience(conv)).filter((u) => !same(u, msg.sender));
  if (!recipients.length) return;
  const roles = await User.find({ _id: { $in: recipients } }).select('role').lean();
  const title = conv.kind === ConversationKind.INTERN_HR && sender.role === Role.HR ? `${sender.name} · HR` : sender.name;
  const body = preview(msg) || 'New message';
  await Promise.allSettled(
    roles.map((r) =>
      sendPushToUser(String(r._id), { title, body, tag: `chat-${conv._id}`, data: { url: pushTarget(r.role, String(conv._id)), conversationId: String(conv._id) } }),
    ),
  );
}

export async function sendMessage(user: ChatUser, id: string, input: SendMessageInput) {
  const conv = await loadConversation(id, user);

  if (input.clientId) {
    const dup = await Message.findOne({ conversation: conv._id, sender: oid(user.id), clientId: input.clientId });
    if (dup) return messageView(dup, await namesForMessages([dup])); // a retry of something already saved
  }

  let replyPreview;
  if (input.replyTo) {
    const original = await Message.findOne({ _id: oid(input.replyTo), conversation: conv._id });
    if (!original) throw createError("The message you're replying to is no longer here.", 404);
    replyPreview = { sender: original.sender, text: preview(original), deleted: !!original.deletedAt };
  }

  const uploads = input.uploads.length
    ? await ChatUpload.find({ _id: { $in: input.uploads.map(oid) }, owner: oid(user.id), usedAt: { $exists: false } })
    : [];
  if (uploads.length !== input.uploads.length) throw createError('An attachment has expired. Attach it again.', 400);

  const msg = await Message.create({
    conversation: conv._id,
    sender: oid(user.id),
    text: input.text.trim(),
    replyTo: input.replyTo ? oid(input.replyTo) : undefined,
    replyPreview,
    attachments: input.uploads.map((uid) => {
      const u = uploads.find((x) => same(x._id, uid))!;
      return { key: u.key, name: u.name, mime: u.mime, size: u.size };
    }),
    clientId: input.clientId,
  });
  if (uploads.length) await ChatUpload.updateMany({ _id: { $in: uploads.map((u) => u._id) } }, { $set: { usedAt: new Date() } });

  conv.lastMessage = { id: msg._id as Id, sender: msg.sender, text: preview(msg), at: msg.createdAt };
  conv.lastMessageAt = msg.createdAt;
  advance(conv, user.id, { readAt: msg.createdAt });
  await conv.save();

  const names = await namesForMessages([msg]);
  const view = messageView(msg, names);
  const to = await audience(conv);
  void publishToUsers(to, { name: 'message', data: { type: 'new', message: view } });
  void notifyNewMessage(conv, msg, names.get(user.id) ?? { name: 'Someone', role: user.role }).catch((e) => console.warn('[chat] push failed', e));
  return view;
}

async function ownMessage(user: ChatUser, messageId: string) {
  const msg = await Message.findById(messageId);
  if (!msg) throw createError('Message not found.', 404);
  const conv = await loadConversation(String(msg.conversation), user);
  if (!same(msg.sender, user.id)) throw createError('You can only change your own messages.', 403);
  if (msg.deletedAt) throw createError('This message was deleted.', 409);
  return { msg, conv };
}

async function refreshLastMessage(conv: IConversationDocument, msg: IMessageDocument) {
  if (conv.lastMessage && same(conv.lastMessage.id, msg._id)) {
    conv.lastMessage = { ...conv.lastMessage, text: msg.deletedAt ? '' : preview(msg), deleted: !!msg.deletedAt };
    conv.markModified('lastMessage');
    await conv.save();
  }
}

export async function editMessage(user: ChatUser, messageId: string, text: string) {
  const { msg, conv } = await ownMessage(user, messageId);
  if (Date.now() - msg.createdAt.getTime() > EDIT_WINDOW_MS) throw createError('Messages can only be edited for 15 minutes after sending.', 409);
  msg.text = text.trim();
  msg.editedAt = new Date();
  await msg.save();
  await Message.updateMany({ replyTo: msg._id }, { $set: { 'replyPreview.text': preview(msg) } });
  await refreshLastMessage(conv, msg);
  const view = messageView(msg, await namesForMessages([msg]));
  void publishToUsers(await audience(conv), { name: 'message', data: { type: 'update', message: view } });
  return view;
}

export async function deleteMessage(user: ChatUser, messageId: string) {
  const { msg, conv } = await ownMessage(user, messageId);
  if (Date.now() - msg.createdAt.getTime() > DELETE_WINDOW_MS) throw createError('Messages can only be deleted for everyone within a day of sending.', 409);
  const keys = msg.attachments.map((a) => a.key);
  msg.text = '';
  msg.attachments = [];
  msg.deletedAt = new Date();
  await msg.save();
  await Promise.all(keys.map((k) => deleteFile(k).catch(() => undefined)));
  await Message.updateMany({ replyTo: msg._id }, { $set: { 'replyPreview.text': '', 'replyPreview.deleted': true } });
  await refreshLastMessage(conv, msg);
  const view = messageView(msg, await namesForMessages([msg]));
  void publishToUsers(await audience(conv), { name: 'message', data: { type: 'update', message: view } });
  return view;
}

// ─── Read, delivered, typing ─────────────────────────────────────────────────

async function publishState(conv: IConversationDocument, userId: string) {
  const s = stateOf(conv, userId);
  void publishToUsers(await audience(conv), {
    name: 'state',
    data: { conversationId: String(conv._id), userId, readAt: s?.readAt ?? null, deliveredAt: s?.deliveredAt ?? null },
  });
}

export async function markRead(user: ChatUser, id: string) {
  const conv = await loadConversation(id, user);
  const upTo = conv.lastMessageAt ?? new Date();
  const before = stateOf(conv, user.id)?.readAt;
  if (before && before >= upTo) return { readAt: before };
  advance(conv, user.id, { readAt: upTo });
  await conv.save();
  await publishState(conv, user.id);
  return { readAt: upTo };
}

/** The app has received everything so far (called when it loads, and on each live message). */
export async function markDelivered(user: ChatUser) {
  const convs = await Conversation.find({ ...scopeFilter(user), lastMessageAt: { $exists: true } });
  let changed = 0;
  for (const c of convs) {
    const s = stateOf(c, user.id);
    if (c.lastMessage && same(c.lastMessage.sender, user.id)) continue;
    if (s?.deliveredAt && s.deliveredAt >= c.lastMessageAt!) continue;
    advance(c, user.id, { deliveredAt: c.lastMessageAt! });
    await c.save();
    await publishState(c, user.id);
    changed++;
  }
  return { updated: changed };
}

export async function typing(user: ChatUser, id: string) {
  const conv = await loadConversation(id, user);
  const me = (await namesFor([user.id])).get(user.id);
  const to = (await audience(conv)).filter((u) => !same(u, user.id));
  void publishToUsers(to, { name: 'typing', data: { conversationId: id, userId: user.id, name: me?.name ?? 'Someone' } });
}

const lastSeenWrites = new Map<string, number>();
/** "Last seen": written at most once a minute per person. */
export function touchLastSeen(userId: string) {
  const now = Date.now();
  if (now - (lastSeenWrites.get(userId) ?? 0) < 60_000) return;
  lastSeenWrites.set(userId, now);
  User.updateOne({ _id: oid(userId) }, { $set: { lastSeenAt: new Date(now) } }).catch(() => undefined);
}

// ─── Attachments ─────────────────────────────────────────────────────────────

/** Checks the file really is what its type says (first bytes), so nothing else can be passed off as a photo. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

export async function uploadAttachment(user: ChatUser, buffer: Buffer, name: string) {
  if (!buffer?.length) throw createError('The file is empty.', 400);
  if (buffer.length > MAX_UPLOAD_BYTES) throw createError('Files can be up to 8 MB.', 413);
  const mime = sniffMime(buffer);
  if (!mime || !ALLOWED_MIME.includes(mime)) throw createError('You can send photos (JPG, PNG, WebP, GIF) and PDFs.', 415);
  const safeName = name.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'file';
  const key = await uploadPrivateFile(buffer, safeName);
  const up = await ChatUpload.create({ owner: oid(user.id), key, name: safeName, mime, size: buffer.length });
  return { id: String(up._id), name: up.name, mime: up.mime, size: up.size };
}

export async function getAttachment(user: ChatUser, messageId: string, index: number) {
  const msg = await Message.findById(messageId);
  if (!msg) throw createError('File not found.', 404);
  await loadConversation(String(msg.conversation), user);
  const a = msg.attachments[index];
  if (!a || msg.deletedAt) throw createError('File not found.', 404);
  return { buffer: await downloadFile(a.key), mime: a.mime, name: a.name };
}

// ─── Housekeeping (runs from the cleanup job) ────────────────────────────────

/** Deletes intern chats 30 days after the internship is completed, and unsent uploads after a day. */
export async function deleteExpiredChats(now = new Date()): Promise<number> {
  let removed = 0;
  const cutoff = new Date(now.getTime() - CHAT_RETENTION_DAYS * 86_400_000);
  const done = await Intern.find({ status: InternshipStatus.COMPLETED, completedAt: { $lte: cutoff } }).select('_id').lean();
  if (done.length) {
    const convs = await Conversation.find({ kind: ConversationKind.INTERN_HR, intern: { $in: done.map((d) => d._id) } });
    for (const c of convs) {
      const withFiles = await Message.find({ conversation: c._id, 'attachments.0': { $exists: true } }).select('attachments');
      for (const m of withFiles) for (const a of m.attachments) await deleteFile(a.key).catch(() => undefined);
      const r = await Message.deleteMany({ conversation: c._id });
      removed += r.deletedCount ?? 0;
      await c.deleteOne();
    }
  }
  const stale = await ChatUpload.find({ usedAt: { $exists: false }, createdAt: { $lte: new Date(now.getTime() - 86_400_000) } });
  for (const u of stale) {
    await deleteFile(u.key).catch(() => undefined);
    await u.deleteOne();
  }
  return removed;
}

/**
 * Emails people who have had unread messages for a few hours: interns (from HR)
 * and supervisors/HR in direct messages. HR's intern inbox isn't emailed: they
 * work in the portal. At most one email per chat per day.
 */
export async function sendUnreadNudges(now = new Date()): Promise<number> {
  const convs = await Conversation.find({
    lastMessageAt: { $lte: new Date(now.getTime() - NUDGE_AFTER_MS), $gte: new Date(now.getTime() - 7 * 86_400_000) },
  });
  let sent = 0;
  for (const c of convs) {
    if (!c.lastMessage || c.lastMessage.deleted) continue;
    const recipients = c.members.filter((m) => !same(m, c.lastMessage!.sender)).map(String);
    for (const r of recipients) {
      const s = stateOf(c, r);
      if (s?.readAt && s.readAt >= c.lastMessageAt!) continue;
      if (s?.nudgedAt && (now.getTime() - s.nudgedAt.getTime() < NUDGE_GAP_MS || s.nudgedAt >= c.lastMessageAt!)) continue;
      const u = await User.findById(r).select('email firstName role');
      if (!u?.email) continue;
      const from = (await namesFor([c.lastMessage.sender])).get(String(c.lastMessage.sender));
      const email = renderChatNudgeEmail({
        firstName: u.firstName,
        fromName: c.kind === ConversationKind.INTERN_HR ? 'HR' : from?.name ?? 'Someone',
        link: pushTarget(u.role, String(c._id)),
      });
      const ok = await sendEmail({ to: u.email, subject: email.subject, html: email.html, text: email.text });
      if (ok) {
        advance(c, r, { nudgedAt: now });
        await c.save();
        sent++;
      }
    }
  }
  return sent;
}
