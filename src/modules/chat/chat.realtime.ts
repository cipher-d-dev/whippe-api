/**
 * Live updates through Ably.
 *
 * Every person has one private channel, `user:<userId>`, that only they can
 * listen on (the API issues them a token for it). The server publishes chat
 * events there after saving to MongoDB, so Ably never holds the record.
 *
 * Without ABLY_API_KEY (local dev, or before it's set on Render) everything
 * here is a no-op and the apps fall back to checking every few seconds.
 */
import Ably from 'ably';

let rest: Ably.Rest | null | undefined;

function client(): Ably.Rest | null {
  if (rest !== undefined) return rest;
  const key = process.env['ABLY_API_KEY'];
  rest = key ? new Ably.Rest({ key }) : null;
  return rest;
}

export const userChannel = (userId: string) => `user:${userId}`;

export function realtimeEnabled(): boolean {
  return client() !== null;
}

/** A signed token request the browser trades with Ably for a token. Listen-only, own channel. */
export async function createTokenRequest(userId: string) {
  const c = client();
  if (!c) return null;
  return c.auth.createTokenRequest({
    clientId: userId,
    capability: { [userChannel(userId)]: ['subscribe'] },
    ttl: 60 * 60 * 1000,
  });
}

export type ChatEvent =
  | { name: 'message'; data: unknown }        // new, edited or deleted message
  | { name: 'state'; data: unknown }          // someone read / received messages
  | { name: 'typing'; data: unknown };

/** Sends an event to each user. Never throws: a failed live update is caught up by the next fetch. */
export async function publishToUsers(userIds: string[], event: ChatEvent): Promise<void> {
  const c = client();
  if (!c || userIds.length === 0) return;
  const unique = [...new Set(userIds)];
  await Promise.allSettled(
    unique.map((id) => c.channels.get(userChannel(id)).publish(event.name, event.data)),
  ).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) console.warn(`[chat] ${failed} live update(s) failed to send`);
  });
}

/** For tests. */
export function resetRealtimeClient() {
  rest = undefined;
}
