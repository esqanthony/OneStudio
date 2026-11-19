import type { CameraPosition, CaptureStrategy } from '@modules/onestudio-camera';

export type Aspect = '9:16' | '16:9';

/** A slide image copied into the session folder. */
export type Slide = {
  id: string;
  /** File name inside the session directory. */
  file: string;
  /** Removed from the deck but kept because recorded takes still show it. */
  hidden?: boolean;
};

/** Which slide was on screen from `atMs` into a take (null = no slide). */
export type SlideEvent = { atMs: number; slideId: string | null };

/**
 * corner / large: the slide is drawn into the video at that size.
 * guide: only you see it while recording; it is not in the video.
 */
export type SlideLayout = 'corner' | 'large' | 'guide';

export type Take = {
  id: string;
  /** File name inside the session directory (absolute paths change between app installs). */
  file: string;
  durationMs: number;
  width: number;
  height: number;
  /** Slide changes during this take. Missing on takes recorded before slides existed. */
  slideEvents?: SlideEvent[];
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
  pendingTake: { id: string; file: string; slideEvents?: SlideEvent[] } | null;
  scriptId: string | null;
  /** Teleprompter scroll offset per script, kept between takes and app launches. */
  scriptScroll: Record<string, number>;
  showTeleprompter: boolean;
  slides: Slide[];
  currentSlideId: string | null;
  slideLayout: SlideLayout;
  output: { file: string; durationMs: number; width: number; height: number } | null;
};
