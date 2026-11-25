import { createTokenRequest, realtimeEnabled, resetRealtimeClient } from '../../src/modules/chat/chat.realtime';

describe('chat live updates', () => {
  afterEach(() => { delete process.env['ABLY_API_KEY']; resetRealtimeClient(); });

  it('is off without a key (apps fall back to checking)', async () => {
    expect(realtimeEnabled()).toBe(false);
    expect(await createTokenRequest('u1')).toBeNull();
  });

  it('gives each person listen-only access to their own channel', async () => {
    process.env['ABLY_API_KEY'] = 'appid.keyid:secretsecretsecret';
    resetRealtimeClient();
    const t = await createTokenRequest('abc123');
    expect(t?.clientId).toBe('abc123');
    expect(JSON.parse(String(t?.capability))).toEqual({ 'user:abc123': ['subscribe'] });
  });
});
