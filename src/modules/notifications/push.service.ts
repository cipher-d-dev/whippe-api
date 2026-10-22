import webpush from 'web-push';
import mongoose from 'mongoose';
import { env } from '../../config/env';
import { PushSubscription } from './push-subscription.model';

// ─── VAPID setup ─────────────────────────────────────────────────────────────

let _vapidReady = false;

function ensureVapid(): boolean {
  if (_vapidReady) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return false;
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  _vapidReady = true;
  return true;
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  // Upsert: if this exact endpoint already belongs to this user, update the keys.
  // If it's a new endpoint for this user, create a fresh record.
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      user:     new mongoose.Types.ObjectId(userId),
      endpoint: subscription.endpoint,
      keys:     subscription.keys,
    },
    { upsert: true, new: true },
  );
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

export async function removePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await PushSubscription.deleteOne({
    user:     new mongoose.Types.ObjectId(userId),
    endpoint,
  });
}

// ─── Send push to a user ──────────────────────────────────────────────────────
// Called internally by createNotification.

export interface PushPayload {
  title: string;
  body:  string;
  icon?: string;
  badge?: string;
  tag?:  string;
  data?: Record<string, unknown>;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapid()) {
    // VAPID not configured — skip silently (dev fallback)
    return;
  }

  const subscriptions = await PushSubscription.find({
    user: new mongoose.Types.ObjectId(userId),
  });

  if (subscriptions.length === 0) return;

  const json = JSON.stringify({
    title:  payload.title,
    body:   payload.body,
    icon:   payload.icon  ?? '/icons/icon-192x192.png',
    badge:  payload.badge ?? '/icons/icon-192x192.png',
    tag:    payload.tag,
    data:   payload.data ?? {},
  });

  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          },
          json,
        );
      } catch (err: unknown) {
        // 410 Gone or 404 Not Found → subscription is expired/revoked
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          staleEndpoints.push(sub.endpoint);
        }
        // Other errors (network glitch etc.) — log but don't crash
        console.warn(`[push] Failed to deliver to ${sub.endpoint.slice(0, 40)}…`, status);
      }
    }),
  );

  // Clean up expired subscriptions
  if (staleEndpoints.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: staleEndpoints } });
  }
}

// ─── VAPID public key (for the client) ───────────────────────────────────────

export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}
