import type { CameraPosition, CaptureStrategy } from '@modules/onestudio-camera';

export type Aspect = '9:16' | '16:9';

export type Take = {
  id: string;
  /** File name inside the session directory (absolute paths change between app installs). */
  file: string;
  durationMs: number;
  width: number;
  height: number;
};

export type RecordingSession = {
  id: string;
  version: 1;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** 'recording' until Done joins the takes; then 'done'. */
  status: 'recording' | 'done';
  aspect: Aspect;
  strategy: CaptureStrategy;
  position: CameraPosition;
  /** Optional cap on the total length of all takes. */
  maxDurationMs: number | null;
  takes: Take[];
  /** Set while a take is being written, so a take cut off by an app kill can be recovered. */
  pendingTake: { id: string; file: string } | null;
  scriptId: string | null;
  /** Teleprompter scroll offset per script, kept between takes and app launches. */
  scriptScroll: Record<string, number>;
  showTeleprompter: boolean;
  output: { file: string; durationMs: number; width: number; height: number } | null;
};
