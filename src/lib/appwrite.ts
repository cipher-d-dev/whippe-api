/**
 * Appwrite Storage helpers
 *
 * Upload flow:
 *   1. Client calls POST /documents/:id/upload-info to get an upload token.
 *   2. Server returns { endpoint, projectId, bucketId, fileId } — a pre-generated
 *      unique file ID that the client uses when uploading directly to Appwrite
 *      using the Appwrite client SDK.
 *   3. Client uploads the file, then confirms by calling
 *      POST /documents/:id/register-upload with { storageKey: fileId, ...metadata }.
 *
 * Download flow:
 *   Client calls GET /documents/:id/download → server fetches the file
 *   from Appwrite using the server API key and streams it back.
 *   storageKey is never sent to the client directly.
 *
 * When APPWRITE_* env vars are not set (development without Appwrite),
 * all helpers throw a descriptive error rather than crashing silently.
 */

import { Client, Storage, ID } from 'node-appwrite';
import { env } from '../config/env';

// ─── Lazy client — only initialised when Appwrite vars are present ────────────

function getClient(): Client {
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
    throw new Error(
      'Appwrite is not configured. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.',
    );
  }

  return new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY);
}

function getBucketId(): string {
  if (!env.APPWRITE_BUCKET_ID) {
    throw new Error('Appwrite is not configured. Set APPWRITE_BUCKET_ID.');
  }
  return env.APPWRITE_BUCKET_ID;
}

// ─── Upload info ──────────────────────────────────────────────────────────────
// Returns the information the client needs to upload a file directly to Appwrite.
// The server pre-generates a unique fileId so it can store it as the storageKey
// before the upload completes.

export interface UploadInfo {
  endpoint: string;
  projectId: string;
  bucketId: string;
  fileId: string;   // Pre-generated — client must use this exact ID when uploading
}

export function generateUploadInfo(): UploadInfo {
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID) {
    throw new Error(
      'Appwrite is not configured. Set APPWRITE_ENDPOINT and APPWRITE_PROJECT_ID.',
    );
  }

  return {
    endpoint: env.APPWRITE_ENDPOINT,
    projectId: env.APPWRITE_PROJECT_ID,
    bucketId: getBucketId(),
    fileId: ID.unique(),
  };
}

// ─── Download ─────────────────────────────────────────────────────────────────
// Downloads a file from Appwrite by its storage key (file ID).
// Returns a Buffer — the controller streams it to the client.

export async function downloadFile(storageKey: string): Promise<Buffer> {
  const client = getClient();
  const storage = new Storage(client);
  const bucketId = getBucketId();

  const result = await storage.getFileDownload(bucketId, storageKey);

  // node-appwrite returns an ArrayBuffer
  return Buffer.from(result);
}

// ─── Delete ───────────────────────────────────────────────────────────────────
// Removes a file from Appwrite storage.
// Called internally if a document record is deleted or replaced.

export async function deleteFile(storageKey: string): Promise<void> {
  const client = getClient();
  const storage = new Storage(client);
  const bucketId = getBucketId();

  await storage.deleteFile(bucketId, storageKey);
}
