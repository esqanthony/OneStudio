import { Directory, File } from 'expo-file-system';

import { documentsDir, readJson, writeJson } from '@/lib/json-file';

import type { RecordingSession } from './types';

const SESSION_FILE = 'session.json';

export function sessionsRoot(): Directory {
  return documentsDir('sessions');
}

export function sessionDir(sessionId: string): Directory {
  return documentsDir('sessions', sessionId);
}

/** A file inside a session's folder (takes, the joined video). */
export function sessionFile(sessionId: string, name: string): File {
  return new File(sessionDir(sessionId), name);
}

export function saveSession(session: RecordingSession): void {
  writeJson(sessionFile(session.id, SESSION_FILE), session);
}

export function loadSession(sessionId: string): RecordingSession | null {
  const stored = readJson<RecordingSession | null>(sessionFile(sessionId, SESSION_FILE), null);
  if (!stored) return null;
  // Fill in fields added after the session was first saved.
  return {
    ...stored,
    slides: stored.slides ?? [],
    currentSlideId: stored.currentSlideId ?? null,
    slideLayout: stored.slideLayout ?? 'corner',
  };
}

/** All sessions, newest first. */
export function listSessions(): RecordingSession[] {
  const root = sessionsRoot();
  if (!root.exists) return [];
  return root
    .list()
    .filter((entry): entry is Directory => entry instanceof Directory)
    .map((dir) => loadSession(dir.name))
    .filter((s): s is RecordingSession => s !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The session still being recorded, if any (there is at most one). */
export function findActiveSession(): RecordingSession | null {
  return listSessions().find((s) => s.status === 'recording') ?? null;
}

export function deleteSession(sessionId: string): void {
  const dir = sessionDir(sessionId);
  if (dir.exists) dir.delete();
}

export function deleteSessionFile(sessionId: string, name: string): void {
  const file = sessionFile(sessionId, name);
  if (file.exists) file.delete();
}
