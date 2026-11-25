/** The upload route receives raw file bytes even though the app also parses JSON. */
import express from 'express';
import type { Server } from 'http';

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'u1', role: 'INTERN' }; next(); },
  getAuthUser: (req: any) => req.user,
}));
jest.mock('../../src/modules/chat/chat.service', () => ({
  touchLastSeen: jest.fn(),
  uploadAttachment: jest.fn(async (_u: unknown, buf: Buffer, name: string) => ({ id: 'up1', name, size: buf.length })),
}));

import chatRouter from '../../src/modules/chat/chat.routes';
import { uploadAttachment } from '../../src/modules/chat/chat.service';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/chat', chatRouter);
let server: Server; let base = '';
beforeAll((done) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; done(); }); });
afterAll((done) => { server.close(() => done()); });

it('passes a 3 MB file through to the upload', async () => {
  const bytes = Buffer.alloc(3 * 1024 * 1024, 7);
  const res = await fetch(`${base}/chat/uploads?name=${encodeURIComponent('report.pdf')}`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes,
  });
  expect(res.status).toBe(201);
  const call = (uploadAttachment as jest.Mock).mock.calls[0];
  expect(call[1].length).toBe(bytes.length);
  expect(call[2]).toBe('report.pdf');
});
