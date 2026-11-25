import mongoose, { Document, Schema } from 'mongoose';

/**
 * Chat between HR and interns, and direct messages between an HR person and a
 * supervisor.
 *
 * - INTERN_HR: one per intern, with the HR team as a whole. Any HR member can
 *   read and reply. `members` holds only the intern's user; HR is implied.
 * - STAFF_DM: one per HR person + supervisor pair. `members` holds both.
 * - INTERN_DM: one per pair of interns. Private; either can block the other or
 *   report it, and a reported chat can then be read (not written) by HR.
 */
export enum ConversationKind {
  INTERN_HR = 'INTERN_HR',
  STAFF_DM = 'STAFF_DM',
  INTERN_DM = 'INTERN_DM',   // two interns, private to them (HR only sees it if one reports it)
}

export interface IChatReport {
  by: mongoose.Types.ObjectId;
  at: Date;
  message?: mongoose.Types.ObjectId;
  reason: string;
}

/** Per-person progress through a conversation. Ticks and unread counts come from these. */
export interface IMemberState {
  user: mongoose.Types.ObjectId;
  readAt?: Date;        // has seen every message up to here
  deliveredAt?: Date;   // their app has received every message up to here
  nudgedAt?: Date;      // last "you have unread messages" email
}

export interface ILastMessage {
  id: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  text: string;          // short preview ("📷 Photo" for attachments)
  at: Date;
  deleted?: boolean;
}

export interface IConversation {
  kind: ConversationKind;
  intern?: mongoose.Types.ObjectId;       // INTERN_HR: the Intern record
  members: mongoose.Types.ObjectId[];     // User ids (see above)
  dmKey?: string;                         // STAFF_DM / INTERN_DM: sorted "userA:userB", unique
  lastMessage?: ILastMessage;
  lastMessageAt?: Date;
  states: IMemberState[];
  blockedBy: mongoose.Types.ObjectId[];   // members who have blocked the other
  reports: IChatReport[];
  reportResolvedAt?: Date;                // HR marked the latest reports as reviewed
  reportResolvedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export interface IConversationDocument extends IConversation, Document {}

const conversationSchema = new Schema<IConversationDocument>(
  {
    kind: { type: String, enum: Object.values(ConversationKind), required: true },
    intern: { type: Schema.Types.ObjectId, ref: 'Intern' },
    members: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    dmKey: { type: String },
    lastMessage: {
      id: Schema.Types.ObjectId,
      sender: Schema.Types.ObjectId,
      text: String,
      at: Date,
      deleted: Boolean,
    },
    lastMessageAt: Date,
    states: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        readAt: Date,
        deliveredAt: Date,
        nudgedAt: Date,
      },
    ],
    blockedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reports: [
      {
        _id: false,
        by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, required: true },
        message: { type: Schema.Types.ObjectId, ref: 'Message' },
        reason: { type: String, required: true },
      },
    ],
    reportResolvedAt: Date,
    reportResolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
conversationSchema.index({ intern: 1 }, { unique: true, partialFilterExpression: { kind: ConversationKind.INTERN_HR } });
conversationSchema.index({ dmKey: 1 }, { unique: true, partialFilterExpression: { kind: ConversationKind.STAFF_DM } });
conversationSchema.index({ kind: 1, dmKey: 1 }, { unique: true, partialFilterExpression: { kind: ConversationKind.INTERN_DM } });
conversationSchema.index({ kind: 1, 'reports.0.at': 1 });
conversationSchema.index({ members: 1, lastMessageAt: -1 });
conversationSchema.index({ kind: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversationDocument>('Conversation', conversationSchema);

// ─── Messages ────────────────────────────────────────────────────────────────

export interface IAttachment {
  key: string;          // private file in Appwrite; served through the API only
  name: string;
  mime: string;
  size: number;
}

export interface IReplyPreview {
  sender: mongoose.Types.ObjectId;
  text: string;          // first ~140 characters, or "📷 Photo"
  deleted?: boolean;
}

export interface IMessage {
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  text: string;
  replyTo?: mongoose.Types.ObjectId;
  replyPreview?: IReplyPreview;
  attachments: IAttachment[];
  clientId?: string;     // the sender's temporary id, so a retried send isn't saved twice
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface IMessageDocument extends IMessage, Document {}

const messageSchema = new Schema<IMessageDocument>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    replyPreview: { sender: Schema.Types.ObjectId, text: String, deleted: Boolean },
    attachments: [
      { _id: false, key: { type: String, required: true }, name: String, mime: String, size: Number },
    ],
    clientId: String,
    editedAt: Date,
    deletedAt: Date,
  },
  { timestamps: true },
);
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, sender: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

export const Message = mongoose.model<IMessageDocument>('Message', messageSchema);

// ─── Uploads waiting to be sent ──────────────────────────────────────────────
// A file is uploaded first, then attached to a message by id. Only the person
// who uploaded it can attach it. Unused uploads are deleted after a day.

export interface IChatUpload {
  owner: mongoose.Types.ObjectId;
  key: string;
  name: string;
  mime: string;
  size: number;
  usedAt?: Date;
  createdAt: Date;
}
export interface IChatUploadDocument extends IChatUpload, Document {}

const chatUploadSchema = new Schema<IChatUploadDocument>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
chatUploadSchema.index({ usedAt: 1, createdAt: 1 });

export const ChatUpload = mongoose.model<IChatUploadDocument>('ChatUpload', chatUploadSchema);
