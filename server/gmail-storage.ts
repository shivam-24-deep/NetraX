// Where a user's Gmail connection lives. Two implementations behind one
// interface:
//
//  * File store  - local development: one gitignored JSON file, one mailbox
//                  (the original single-analyst behaviour).
//  * Supabase    - deployed: one row per user in public.gmail_connections,
//                  read and written with THAT USER's own Supabase login token, so
//                  row-level security guarantees nobody can touch another user's
//                  connection and this server never needs the service-role key.
//
// The Google tokens inside the row are AES-256-GCM encrypted with a key that only
// this server has (GMAIL_TOKEN_KEY). Anyone who can read the row — including the
// user's own browser, which can query the table — sees only ciphertext.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface GmailConnection {
  access_token: string;
  refresh_token: string;
  /** epoch ms when access_token expires */
  expiry: number;
  /** Gmail message ids already seen (baseline at connect time + everything returned since). */
  seen_ids: string[];
  /** The connected Google account's address, for display. */
  email?: string;
}

export interface GmailStore {
  load(): Promise<GmailConnection | null>;
  save(connection: GmailConnection): Promise<void>;
  remove(): Promise<void>;
}

const MAX_SEEN_IDS = 1000;

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

function keyFrom(material: string): Buffer {
  return crypto.createHash("sha256").update(material).digest();
}

export function encryptSecret(plain: string, keyMaterial: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFrom(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

/** Throws if the key is wrong or the data was tampered with (GCM authenticates). */
export function decryptSecret(blob: string, keyMaterial: string): string {
  const raw = Buffer.from(blob, "base64");
  if (raw.length < 12 + 16 + 1) throw new Error("Encrypted value is too short");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyFrom(keyMaterial), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// File store (local development)
// ---------------------------------------------------------------------------

export function createFileStore(dir: string = import.meta.dirname): GmailStore {
  const tokensPath = path.join(dir, ".gmail-tokens.json");
  const seenPath = path.join(dir, ".gmail-seen.json");
  return {
    async load() {
      try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf-8")) as Omit<GmailConnection, "seen_ids">;
        let seen: string[] = [];
        try {
          seen = JSON.parse(fs.readFileSync(seenPath, "utf-8")) as string[];
        } catch {
          // no baseline yet
        }
        return { ...tokens, seen_ids: seen };
      } catch {
        return null;
      }
    },
    async save({ seen_ids, ...tokens }) {
      fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), "utf-8");
      fs.writeFileSync(seenPath, JSON.stringify(seen_ids.slice(-MAX_SEEN_IDS)), "utf-8");
    },
    async remove() {
      for (const p of [tokensPath, seenPath]) {
        try {
          fs.unlinkSync(p);
        } catch {
          // already gone
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Supabase store (deployed, per user)
// ---------------------------------------------------------------------------

export class GmailStorageError extends Error {}

export function createSupabaseGmailStore(options: {
  url: string;
  anonKey: string;
  /** The signed-in user's Supabase access token — row-level security scopes every call to them. */
  userJwt: string;
  userId: string;
  encryptionKey: string;
  fetchImpl?: typeof fetch;
}): GmailStore {
  const { url, anonKey, userJwt, userId, encryptionKey, fetchImpl = fetch } = options;
  const table = `${url.replace(/\/+$/, "")}/rest/v1/gmail_connections`;
  const headers = { apikey: anonKey, Authorization: `Bearer ${userJwt}`, "Content-Type": "application/json" };

  async function call(input: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(input, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new GmailStorageError("Could not reach the database.");
    }
    if (res.ok) return res;
    const text = await res.text().catch(() => "");
    if (res.status === 404 || /PGRST205|does not exist/.test(text)) {
      throw new GmailStorageError("The Gmail table is missing — run supabase/migrations/20260920120000_gmail_connections.sql.");
    }
    throw new GmailStorageError(`Database error (${res.status}).`);
  }

  return {
    async load() {
      const res = await call(`${table}?select=secret,seen_ids,google_email&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" });
      const rows = (await res.json()) as { secret: string; seen_ids: string[]; google_email: string | null }[];
      const row = rows[0];
      if (!row) return null;
      try {
        const tokens = JSON.parse(decryptSecret(row.secret, encryptionKey)) as Pick<GmailConnection, "access_token" | "refresh_token" | "expiry">;
        return { ...tokens, seen_ids: row.seen_ids ?? [], email: row.google_email ?? undefined };
      } catch {
        // Wrong key (rotated) or corrupted: unusable, the user has to reconnect.
        return null;
      }
    },
    async save({ access_token, refresh_token, expiry, seen_ids, email }) {
      await call(`${table}?on_conflict=user_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: userId,
          secret: encryptSecret(JSON.stringify({ access_token, refresh_token, expiry }), encryptionKey),
          seen_ids: seen_ids.slice(-MAX_SEEN_IDS),
          google_email: email ?? null,
        }),
      });
    },
    async remove() {
      await call(`${table}?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
    },
  };
}
