import type { Aspect, RecordingSession, Slide, SlideLayout } from './types';

/** Normalized rectangle (0–1) inside the video frame, origin top-left. */
export type NormalizedRect = { x: number; y: number; width: number; height: number };

/**
 * Where the slide box sits in the frame. The slide is fitted inside the box, keeping its shape.
 * Preview and export both use these, so what you see while recording is what ends up in the video.
 */
export function slideRect(aspect: Aspect, layout: SlideLayout): NormalizedRect {
  if (aspect === '16:9') {
    return layout === 'large'
      ? { x: 0.42, y: 0.2, width: 0.55, height: 0.6 } // right side; you on the left
      : { x: 0.62, y: 0.05, width: 0.35, height: 0.38 }; // top-right corner
  }
  // 9:16: keep slides off the top (face) and the bottom 20% (platform captions and buttons).
  return layout === 'large'
    ? { x: 0.04, y: 0.5, width: 0.92, height: 0.29 }
    : { x: 0.52, y: 0.56, width: 0.44, height: 0.17 };
}

export function deck(session: RecordingSession): Slide[] {
  return session.slides.filter((s) => !s.hidden);
}

export function addSlides(session: RecordingSession, slides: Slide[]): RecordingSession {
  if (slides.length === 0) return session;
  return {
    ...session,
    slides: [...session.slides, ...slides],
    currentSlideId: session.currentSlideId ?? slides[0].id,
  };
}

function isUsedByTakes(session: RecordingSession, slideId: string): boolean {
  const inTake = session.takes.some((t) => t.slideEvents?.some((e) => e.slideId === slideId));
  const inPending = session.pendingTake?.slideEvents?.some((e) => e.slideId === slideId) ?? false;
  return inTake || inPending;
}

/**
 * Takes the slide out of the deck. Returns the file to delete, or null when recorded takes
 * still show the slide (then it is only hidden, so the joined video keeps it).
 */
export function removeSlide(
  session: RecordingSession,
  slideId: string
): { session: RecordingSession; deleteFile: string | null } {
  const slide = session.slides.find((s) => s.id === slideId);
  if (!slide) return { session, deleteFile: null };
  const visible = deck(session);
  const index = visible.findIndex((s) => s.id === slideId);
  const neighbour = visible[index + 1] ?? visible[index - 1] ?? null;
  const used = isUsedByTakes(session, slideId);
  return {
    session: {
      ...session,
      slides: used
        ? session.slides.map((s) => (s.id === slideId ? { ...s, hidden: true } : s))
        : session.slides.filter((s) => s.id !== slideId),
      currentSlideId:
        session.currentSlideId === slideId ? (neighbour && neighbour.id !== slideId ? neighbour.id : null) : session.currentSlideId,
    },
    deleteFile: used ? null : slide.file,
  };
}

export function moveSlide(session: RecordingSession, slideId: string, delta: -1 | 1): RecordingSession {
  const visible = deck(session);
  const index = visible.findIndex((s) => s.id === slideId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= visible.length) return session;
  const reordered = [...visible];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return { ...session, slides: [...reordered, ...session.slides.filter((s) => s.hidden)] };
}

/** Next / previous slide in the deck. From "no slide", next goes to the first slide. */
export function stepSlide(session: RecordingSession, delta: -1 | 1): string | null {
  const visible = deck(session);
  if (visible.length === 0) return null;
  const index = visible.findIndex((s) => s.id === session.currentSlideId);
  if (index < 0) return delta === 1 ? visible[0].id : visible[visible.length - 1].id;
  const next = Math.min(visible.length - 1, Math.max(0, index + delta));
  return visible[next].id;
}

/**
 * Shows a slide (or none). While a take is being recorded the change is logged with its
 * time into the take, so the joined video switches slides at the same moment.
 */
export function showSlide(
  session: RecordingSession,
  slideId: string | null,
  atMsIntoTake: number | null
): RecordingSession {
  if (slideId === session.currentSlideId) return session;
  const pending = session.pendingTake;
  if (!pending || atMsIntoTake === null) {
    // Not recording yet (or the take hasn't started): this becomes the take's opening slide.
    return {
      ...session,
      currentSlideId: slideId,
      pendingTake: pending ? { ...pending, slideEvents: [{ atMs: 0, slideId }] } : null,
    };
  }
  const events = pending.slideEvents ?? [{ atMs: 0, slideId: session.currentSlideId }];
  return {
    ...session,
    currentSlideId: slideId,
    pendingTake: { ...pending, slideEvents: [...events, { atMs: Math.max(0, Math.round(atMsIntoTake)), slideId }] },
  };
}

export type OverlaySegment = { slideId: string; file: string; startMs: number; endMs: number };

/**
 * When each slide is on screen in the joined video. Takes are laid end to end; a slide that
 * stays up across a take boundary becomes one continuous segment.
 */
export function overlayTimeline(session: RecordingSession): OverlaySegment[] {
  if (session.slideLayout === 'guide') return [];
  const files = new Map(session.slides.map((s) => [s.id, s.file]));
  const segments: OverlaySegment[] = [];
  let offset = 0;
  for (const take of session.takes) {
    const events = [...(take.slideEvents ?? [])].sort((a, b) => a.atMs - b.atMs);
    events.forEach((event, i) => {
      const start = Math.min(event.atMs, take.durationMs);
      const end = Math.min(events[i + 1]?.atMs ?? take.durationMs, take.durationMs);
      const file = event.slideId ? files.get(event.slideId) : undefined;
      if (!event.slideId || !file || end - start < 1) return;
      const last = segments.at(-1);
      if (last && last.slideId === event.slideId && Math.abs(last.endMs - (offset + start)) < 1) {
        last.endMs = offset + end;
      } else {
        segments.push({ slideId: event.slideId, file, startMs: offset + start, endMs: offset + end });
      }
    });
    offset += take.durationMs;
  }
  return segments;
}
