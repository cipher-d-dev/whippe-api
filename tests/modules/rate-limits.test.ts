/** Office colleagues share one IP: one person's failed sign-ins mustn't lock out the rest. */
import express from 'express';
import type { Server } from 'http';

jest.mock('../../src/modules/auth/auth.controller', () => new Proxy({}, {
  get: () => (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true }),
}));

import authRouter from '../../src/modules/auth/auth.routes';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

let server: Server;
let base = '';
beforeAll((done) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as { port: number }).port}`; done(); }); });
afterAll((done) => { server.close(() => done()); });
const post = (path: string, body: unknown = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.status);

describe('sign-in rate limit', () => {
  it('counts attempts per email, not per office', async () => {
    for (let i = 0; i < 15; i++) expect(await post('/auth/login', { email: 'a@daar.com', password: 'x' })).toBe(200);
    expect(await post('/auth/login', { email: 'a@daar.com', password: 'x' })).toBe(429);
    expect(await post('/auth/login', { email: 'B@daar.com', password: 'x' })).toBe(200);
  });

  it('page-load token refreshes from one office are not capped at 15', async () => {
    for (let i = 0; i < 40; i++) expect(await post('/auth/refresh')).toBe(200);
  });
});
