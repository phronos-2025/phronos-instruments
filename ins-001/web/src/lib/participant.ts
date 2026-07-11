/**
 * Participant identity - INS-001
 *
 * Replaces Supabase anonymous auth. A participant is a UUID + HMAC token minted
 * by the API and kept in localStorage, exactly as durable as the anonymous JWT
 * it replaces (clearing browser storage loses history either way).
 *
 * There is no supabase-js in the browser any more, and no anon key in the bundle.
 */

const STORAGE_KEY = 'phronos.participant.v1';

interface Participant {
  participant_id: string;
  token: string;
}

let cached: Participant | null = null;
let inflight: Promise<Participant> | null = null;

function apiBase(): string {
  const raw = (import.meta.env.PUBLIC_API_URL as string) || 'http://localhost:8000';
  const trimmed = raw.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function read(): Participant | null {
  if (cached) return cached;
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.participant_id && parsed?.token) {
      cached = parsed;
      return cached;
    }
  } catch {
    /* fall through to mint */
  }
  return null;
}

function write(p: Participant): void {
  cached = p;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode / storage disabled — keep the in-memory copy for this session */
  }
}

/**
 * Return the current participant, minting and persisting one on first use.
 * Concurrent callers during the initial mint share a single request.
 */
export async function getParticipant(): Promise<Participant> {
  const existing = read();
  if (existing) return existing;

  if (!inflight) {
    inflight = fetch(`${apiBase()}/api/v1/participants/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to create participant: HTTP ${res.status}`);
        const p = (await res.json()) as Participant;
        write(p);
        return p;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Headers to authenticate a request as the current participant. */
export async function participantHeaders(): Promise<Record<string, string>> {
  const p = await getParticipant();
  return {
    'Content-Type': 'application/json',
    'X-Participant-Id': p.participant_id,
    'X-Participant-Token': p.token,
  };
}

/** The participant id if one exists locally, without minting. */
export function currentParticipantId(): string | null {
  return read()?.participant_id ?? null;
}
