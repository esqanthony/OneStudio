import { describe, expect, it } from '@jest/globals';

import { addTake, createSession, deleteLastTake } from '../session-logic';
import { addSlides, deck, moveSlide, overlayTimeline, removeSlide, showSlide, slideRect, stepSlide } from '../slides-logic';
import type { RecordingSession, Take } from '../types';

const withSlides = (): RecordingSession =>
  addSlides({ ...createSession({ id: 's', now: 0, caps: null, aspect: '16:9' }), slideLayout: 'corner' }, [
    { id: 'a', file: 'slide-a.jpg' },
    { id: 'b', file: 'slide-b.jpg' },
    { id: 'c', file: 'slide-c.jpg' },
  ]);

/** Simulates one take: start, optional slide changes at given times, then finish. */
function recordTake(session: RecordingSession, id: string, durationMs: number, changes: [number, string | null][] = []) {
  let s: RecordingSession = { ...session, pendingTake: { id, file: `take-${id}.mov` } };
  s = { ...s, pendingTake: { ...s.pendingTake!, slideEvents: [{ atMs: 0, slideId: s.currentSlideId }] } };
  for (const [atMs, slideId] of changes) s = showSlide(s, slideId, atMs);
  const take: Take = { id, file: `take-${id}.mov`, durationMs, width: 1920, height: 1080, slideEvents: s.pendingTake!.slideEvents };
  return addTake(s, take);
}

describe('slides', () => {
  it('starts on the first imported slide and steps through the deck', () => {
    const s = withSlides();
    expect(s.currentSlideId).toBe('a');
    expect(stepSlide(s, 1)).toBe('b');
    expect(stepSlide({ ...s, currentSlideId: 'c' }, 1)).toBe('c');
    expect(stepSlide({ ...s, currentSlideId: null }, 1)).toBe('a');
  });

  it('builds the video timeline across takes, merging a slide that stays up', () => {
    let s = withSlides();
    s = recordTake(s, '1', 4000, [[1500, 'b']]); // a 0–1.5s, b 1.5–4s
    s = recordTake(s, '2', 3000, [[1000, null]]); // b stays up 4–5s, then no slide
    expect(overlayTimeline(s)).toEqual([
      { slideId: 'a', file: 'slide-a.jpg', startMs: 0, endMs: 1500 },
      { slideId: 'b', file: 'slide-b.jpg', startMs: 1500, endMs: 5000 },
    ]);
  });

  it('deleting a take rewinds to the slide that take started on', () => {
    let s = withSlides();
    s = recordTake(s, '1', 2000, [[1000, 'b']]);
    s = recordTake(s, '2', 2000, [[500, 'c']]); // started on b
    expect(s.currentSlideId).toBe('c');
    s = deleteLastTake(s).session;
    expect(s.currentSlideId).toBe('b');
    expect(overlayTimeline(s).map((x) => x.slideId)).toEqual(['a', 'b']);
  });

  it('changing slides before a take starts sets its opening slide', () => {
    let s: RecordingSession = { ...withSlides(), pendingTake: { id: '1', file: 'take-1.mov', slideEvents: [{ atMs: 0, slideId: 'a' }] } };
    s = showSlide(s, 'b', null);
    expect(s.pendingTake?.slideEvents).toEqual([{ atMs: 0, slideId: 'b' }]);
  });

  it('new sessions default to slides only you see', () => {
    expect(createSession({ id: 's', now: 0, caps: null }).slideLayout).toBe('guide');
  });

  it('guide layout keeps slides out of the video', () => {
    const s = recordTake(withSlides(), '1', 2000);
    expect(overlayTimeline({ ...s, slideLayout: 'guide' })).toEqual([]);
  });

  it('removing a slide used in a take hides it but keeps it in the video', () => {
    const s = recordTake(withSlides(), '1', 2000);
    const used = removeSlide(s, 'a');
    expect(used.deleteFile).toBeNull();
    expect(deck(used.session).map((x) => x.id)).toEqual(['b', 'c']);
    expect(used.session.currentSlideId).toBe('b');
    expect(overlayTimeline(used.session)[0].file).toBe('slide-a.jpg');

    const unused = removeSlide(withSlides(), 'c');
    expect(unused.deleteFile).toBe('slide-c.jpg');
  });

  it('reorders the deck', () => {
    expect(deck(moveSlide(withSlides(), 'c', -1)).map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('slide boxes stay inside the frame', () => {
    for (const aspect of ['16:9', '9:16'] as const) {
      for (const layout of ['corner', 'large'] as const) {
        const r = slideRect(aspect, layout);
        expect(r.x + r.width).toBeLessThanOrEqual(1);
        expect(r.y + r.height).toBeLessThanOrEqual(0.8 + (aspect === '16:9' ? 0.2 : 0));
      }
    }
  });
});
