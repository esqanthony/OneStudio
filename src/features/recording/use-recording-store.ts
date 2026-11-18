import { create } from 'zustand';

import type { CameraCapabilities } from '@modules/onestudio-camera';
import { OneStudioCamera } from '@modules/onestudio-camera';
import { newId } from '@/lib/id';

import { createSession, MIN_TAKE_MS } from './session-logic';
import { deleteSessionFile, findActiveSession, saveSession, sessionFile } from './session-storage';
import type { RecordingSession } from './types';

type RecordingStore = {
  session: RecordingSession | null;
  /** Loads the unfinished session (recovering a take cut off by an app kill) or starts a new one. */
  open: (caps: CameraCapabilities | null) => Promise<RecordingSession>;
  /** Applies a change and saves it to disk immediately. */
  update: (change: (session: RecordingSession) => RecordingSession) => void;
  close: () => void;
};

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  session: null,

  open: async (caps) => {
    let session = findActiveSession();
    if (session?.pendingTake) {
      session = await recoverPendingTake(session);
    }
    if (!session) {
      session = createSession({ id: newId(), now: Date.now(), caps });
    }
    saveSession(session);
    set({ session });
    return session;
  },

  update: (change) => {
    const current = get().session;
    if (!current) return;
    const next = change(current);
    if (next === current) return;
    const stamped = { ...next, updatedAt: Date.now() };
    saveSession(stamped);
    set({ session: stamped });
  },

  close: () => set({ session: null }),
}));

/** Keeps a take that was being written when the app was killed, if the file is playable. */
async function recoverPendingTake(session: RecordingSession): Promise<RecordingSession> {
  const pending = session.pendingTake;
  if (!pending) return session;
  const file = sessionFile(session.id, pending.file);
  const info = file.exists ? await OneStudioCamera.probeVideoAsync(file.uri).catch(() => null) : null;
  if (info && info.durationMs >= MIN_TAKE_MS) {
    return {
      ...session,
      pendingTake: null,
      takes: [...session.takes, { id: pending.id, file: pending.file, ...info }],
    };
  }
  deleteSessionFile(session.id, pending.file);
  return { ...session, pendingTake: null };
}
