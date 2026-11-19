import type { CameraCapabilities, CameraPosition, CaptureStrategy } from '@modules/onestudio-camera';

import type { Aspect, RecordingSession, Take } from './types';

/** Takes shorter than this are treated as accidental taps and discarded. */
export const MIN_TAKE_MS = 300;

export const MAX_DURATION_OPTIONS: (number | null)[] = [null, 60_000, 180_000, 600_000];

export function createSession(params: {
  id: string;
  now: number;
  caps: CameraCapabilities | null;
  aspect?: Aspect;
  position?: CameraPosition;
}): RecordingSession {
  const aspect = params.aspect ?? '9:16';
  const position = params.position ?? 'front';
  return {
    id: params.id,
    version: 1,
    title: new Date(params.now).toLocaleString(),
    createdAt: params.now,
    updatedAt: params.now,
    status: 'recording',
    aspect,
    position,
    strategy: resolveStrategy(aspect, position, params.caps),
    maxDurationMs: null,
    takes: [],
    pendingTake: null,
    scriptId: null,
    scriptScroll: {},
    showTeleprompter: true,
    slides: [],
    currentSlideId: null,
    slideLayout: 'corner',
    output: null,
  };
}

/**
 * 9:16 records vertically. 16:9 uses the front camera's native landscape mode when the
 * device has it (iPhone 17 series, iPhone Air) and otherwise crops a 16:9 band from vertical video.
 */
export function resolveStrategy(
  aspect: Aspect,
  position: CameraPosition,
  caps: CameraCapabilities | null
): CaptureStrategy {
  if (aspect === '9:16') return 'portrait';
  const native = position === 'front' ? caps?.nativeLandscapeFront : caps?.nativeLandscapeBack;
  return native ? 'native-landscape' : 'crop';
}

/** Once a take exists, aspect and capture strategy are fixed for the session. */
export function isLocked(session: RecordingSession): boolean {
  return session.takes.length > 0 || session.pendingTake !== null;
}

export function totalDurationMs(takes: Take[]): number {
  return takes.reduce((sum, take) => sum + take.durationMs, 0);
}

/** Time left before the session cap, or null when there is no cap. */
export function remainingMs(session: RecordingSession, liveMs = 0): number | null {
  if (session.maxDurationMs == null) return null;
  return Math.max(0, session.maxDurationMs - totalDurationMs(session.takes) - liveMs);
}

export function setAspect(
  session: RecordingSession,
  aspect: Aspect,
  caps: CameraCapabilities | null
): RecordingSession {
  if (isLocked(session) || session.aspect === aspect) return session;
  return { ...session, aspect, strategy: resolveStrategy(aspect, session.position, caps) };
}

/** Flipping is allowed only if the other camera records the same way as the session. */
export function canFlip(session: RecordingSession, caps: CameraCapabilities | null): boolean {
  const other: CameraPosition = session.position === 'front' ? 'back' : 'front';
  const hasOther = other === 'front' ? caps?.hasFrontCamera : caps?.hasBackCamera;
  if (hasOther === false) return false;
  if (!isLocked(session)) return true;
  return resolveStrategy(session.aspect, other, caps) === session.strategy;
}

export function flip(session: RecordingSession, caps: CameraCapabilities | null): RecordingSession {
  if (!canFlip(session, caps)) return session;
  const position: CameraPosition = session.position === 'front' ? 'back' : 'front';
  const strategy = isLocked(session)
    ? session.strategy
    : resolveStrategy(session.aspect, position, caps);
  return { ...session, position, strategy };
}

/** Cycles Off → 1 min → 3 min → 10 min, skipping caps the takes already exceed. */
export function nextMaxDuration(session: RecordingSession): number | null {
  const total = totalDurationMs(session.takes);
  const options = MAX_DURATION_OPTIONS.filter((o) => o === null || o > total + 1000);
  const index = options.indexOf(session.maxDurationMs);
  return options[(index + 1) % options.length] ?? null;
}

export function addTake(session: RecordingSession, take: Take): RecordingSession {
  return { ...session, takes: [...session.takes, take], pendingTake: null };
}

/** Removes the newest take. Returns the removed take so its file can be deleted. */
export function deleteLastTake(session: RecordingSession): {
  session: RecordingSession;
  removed: Take | null;
} {
  const removed = session.takes.at(-1) ?? null;
  if (!removed) return { session, removed: null };
  // Go back to the slide that was showing when the deleted take started, so the retake matches.
  const startSlide = removed.slideEvents?.[0];
  return {
    session: {
      ...session,
      takes: session.takes.slice(0, -1),
      currentSlideId: startSlide ? startSlide.slideId : session.currentSlideId,
    },
    removed,
  };
}

export type BarSegment = { id: string; start: number; width: number };

/**
 * Layout for the segmented progress bar, as fractions of the bar width.
 * With a cap the bar spans the cap; without one it spans at least a minute and grows.
 */
export function progressBar(
  takes: Take[],
  liveMs: number,
  maxDurationMs: number | null
): { segments: BarSegment[]; live: BarSegment | null; scaleMs: number } {
  const total = totalDurationMs(takes) + liveMs;
  const scaleMs = maxDurationMs ?? Math.max(60_000, Math.ceil((total * 1.2) / 30_000) * 30_000);
  let cursor = 0;
  const segments = takes.map((take) => {
    const segment = {
      id: take.id,
      start: Math.min(1, cursor / scaleMs),
      width: Math.min(1, take.durationMs / scaleMs),
    };
    cursor += take.durationMs;
    return segment;
  });
  const live =
    liveMs > 0
      ? { id: 'live', start: Math.min(1, cursor / scaleMs), width: Math.min(1 - cursor / scaleMs, liveMs / scaleMs) }
      : null;
  return { segments, live, scaleMs };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatMaxDuration(ms: number | null): string {
  if (ms == null) return 'No limit';
  return ms % 60_000 === 0 ? `${ms / 60_000} min` : formatDuration(ms);
}

/** The landscape size crop mode will produce, for the warning shown to the user. */
export function cropOutputSize(
  caps: CameraCapabilities | null,
  position: CameraPosition
): { width: number; height: number } | null {
  const source = position === 'front' ? caps?.cropSourceFront : caps?.cropSourceBack;
  if (!source) return null;
  const width = Math.floor(Math.min(1920, source.width) / 2) * 2;
  return { width, height: Math.floor((width * 9) / 16 / 2) * 2 };
}
