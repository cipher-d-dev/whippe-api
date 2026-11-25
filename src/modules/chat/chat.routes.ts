import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticate, getAuthUser } from '../../middleware/auth';
import * as chat from './chat.service';
import { createTokenRequest, realtimeEnabled } from './chat.realtime';
import {
  attachmentSchema, conversationIdSchema, editMessageSchema, listConversationsSchema, listMessagesSchema,
  messageIdSchema, openConversationSchema, sendMessageSchema, uploadQuerySchema,
} from './chat.schema';

const router = Router();
router.use(authenticate);
// Any chat call counts as "seen" (written at most once a minute).
router.use((req, _res, next) => { chat.touchLastSeen(getAuthUser(req).id); next(); });

type H = (req: Request, res: Response) => Promise<void>;
const wrap = (h: H) => (req: Request, res: Response, next: NextFunction) => h(req, res).catch(next);
const me = (req: Request) => {
  const u = getAuthUser(req);
  return { id: u.id, role: u.role };
};

// Live updates: a signed Ably token request for the person's own channel.
router.get('/realtime-token', wrap(async (req, res) => {
  const tokenRequest = await createTokenRequest(me(req).id);
  res.json({ success: true, data: { enabled: realtimeEnabled(), tokenRequest } });
}));

router.get('/unread', wrap(async (req, res) => {
  res.json({ success: true, data: await chat.unreadTotal(me(req)) });
}));

router.post('/delivered', wrap(async (req, res) => {
  res.json({ success: true, data: await chat.markDelivered(me(req)) });
}));

router.get('/conversations', wrap(async (req, res) => {
  const { query } = listConversationsSchema.parse({ query: req.query });
  res.json({ success: true, data: { conversations: await chat.listConversations(me(req), query) } });
}));

router.post('/conversations', wrap(async (req, res) => {
  const { body } = openConversationSchema.parse({ body: req.body ?? {} });
  res.json({ success: true, data: { conversation: await chat.openConversation(me(req), body) } });
}));

router.get('/conversations/:id', wrap(async (req, res) => {
  const { params } = conversationIdSchema.parse({ params: req.params });
  res.json({ success: true, data: { conversation: await chat.getConversation(me(req), params.id) } });
}));

router.get('/conversations/:id/messages', wrap(async (req, res) => {
  const { params, query } = listMessagesSchema.parse({ params: req.params, query: req.query });
  res.json({ success: true, data: await chat.listMessages(me(req), params.id, query) });
}));

router.post('/conversations/:id/messages', wrap(async (req, res) => {
  const { params, body } = sendMessageSchema.parse({ params: req.params, body: req.body });
  res.status(201).json({ success: true, data: { message: await chat.sendMessage(me(req), params.id, body) } });
}));

router.post('/conversations/:id/read', wrap(async (req, res) => {
  const { params } = conversationIdSchema.parse({ params: req.params });
  res.json({ success: true, data: await chat.markRead(me(req), params.id) });
}));

router.post('/conversations/:id/typing', wrap(async (req, res) => {
  const { params } = conversationIdSchema.parse({ params: req.params });
  await chat.typing(me(req), params.id);
  res.json({ success: true });
}));

router.patch('/messages/:messageId', wrap(async (req, res) => {
  const { params, body } = editMessageSchema.parse({ params: req.params, body: req.body });
  res.json({ success: true, data: { message: await chat.editMessage(me(req), params.messageId, body.text) } });
}));

router.delete('/messages/:messageId', wrap(async (req, res) => {
  const { params } = messageIdSchema.parse({ params: req.params });
  res.json({ success: true, data: { message: await chat.deleteMessage(me(req), params.messageId) } });
}));

router.get('/messages/:messageId/attachments/:index', wrap(async (req, res) => {
  const { params } = attachmentSchema.parse({ params: req.params });
  const file = await chat.getAttachment(me(req), params.messageId, params.index);
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(file.buffer);
}));

// Upload the raw file bytes (body), name in ?name=. Returns an id to attach to a message.
router.post(
  '/uploads',
  express.raw({ type: () => true, limit: '8mb' }),
  wrap(async (req, res) => {
    const { query } = uploadQuerySchema.parse({ query: req.query });
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    res.status(201).json({ success: true, data: { upload: await chat.uploadAttachment(me(req), body, query.name) } });
  }),
);

export default router;
