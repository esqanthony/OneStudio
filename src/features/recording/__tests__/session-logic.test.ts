import { describe, expect, it } from '@jest/globals';
import type { CameraCapabilities } from '@modules/onestudio-camera';

import {
  addTake,
  canFlip,
  createSession,
  cropOutputSize,
  deleteLastTake,
  flip,
  isLocked,
  nextMaxDuration,
  progressBar,
  remainingMs,
  resolveStrategy,
  setAspect,
} from '../session-logic';
import type { Take } from '../types';

const iphone17: CameraCapabilities = {
  nativeLandscapeFront: true,
  nativeLandscapeBack: false,
  hasFrontCamera: true,
  hasBackCamera: true,
  cropSourceFront: { width: 2160, height: 3840 },
  cropSourceBack: { width: 2160, height: 3840 },
};
const olderPhone: CameraCapabilities = { ...iphone17, nativeLandscapeFront: false };

const take = (id: string, durationMs: number): Take => ({ id, file: `take-${id}.mov`, durationMs, width: 1920, height: 1080 });
const fresh = (caps: CameraCapabilities = iphone17) => createSession({ id: 's1', now: 0, caps });

describe('take-based recording', () => {
  it('record 3, delete last, record 1 more keeps takes 1, 2 and 4 in order', () => {
    let s = fresh();
    s = addTake(s, take('1', 1000));
    s = addTake(s, take('2', 1000));
    s = addTake(s, take('3', 1000));
    const result = deleteLastTake(s);
    expect(result.removed?.id).toBe('3');
    s = addTake(result.session, take('4', 1000));
    expect(s.takes.map((t) => t.id)).toEqual(['1', '2', '4']);
  });

  it('deleting repeatedly removes newest first and stops at empty', () => {
    let s = addTake(addTake(fresh(), take('1', 500)), take('2', 500));
    s = deleteLastTake(s).session;
    expect(s.takes.map((t) => t.id)).toEqual(['1']);
    s = deleteLastTake(s).session;
    expect(deleteLastTake(s).removed).toBeNull();
  });

  it('tracks remaining time against the cap', () => {
    const s = { ...addTake(fresh(), take('1', 20_000)), maxDurationMs: 60_000 };
    expect(remainingMs(s, 5_000)).toBe(35_000);
    expect(remainingMs(fresh())).toBeNull();
  });

  it('max length cycles and skips caps already exceeded', () => {
    let s = fresh();
    expect(nextMaxDuration(s)).toBe(60_000);
    s = { ...addTake(s, take('1', 90_000)), maxDurationMs: null };
    expect(nextMaxDuration(s)).toBe(180_000);
  });
});

describe('progress bar', () => {
  it('lays out each take as its own block, then the live take', () => {
    const bar = progressBar([take('1', 15_000), take('2', 15_000)], 6_000, 60_000);
    expect(bar.segments).toEqual([
      { id: '1', start: 0, width: 0.25 },
      { id: '2', start: 0.25, width: 0.25 },
    ]);
    expect(bar.live).toEqual({ id: 'live', start: 0.5, width: 0.1 });
  });

  it('without a cap spans at least a minute and grows', () => {
    expect(progressBar([take('1', 10_000)], 0, null).scaleMs).toBe(60_000);
    expect(progressBar([take('1', 100_000)], 0, null).scaleMs).toBe(120_000);
  });
});

describe('landscape strategy', () => {
  it('uses native landscape on the front camera of supported phones, crop elsewhere', () => {
    expect(resolveStrategy('16:9', 'front', iphone17)).toBe('native-landscape');
    expect(resolveStrategy('16:9', 'back', iphone17)).toBe('crop');
    expect(resolveStrategy('16:9', 'front', olderPhone)).toBe('crop');
    expect(resolveStrategy('9:16', 'front', iphone17)).toBe('portrait');
  });

  it('locks aspect and strategy once a take exists', () => {
    let s = setAspect(fresh(), '16:9', iphone17);
    expect(s.strategy).toBe('native-landscape');
    s = addTake(s, take('1', 1000));
    expect(isLocked(s)).toBe(true);
    expect(setAspect(s, '9:16', iphone17)).toBe(s);
  });

  it('blocks a camera flip that would change the strategy mid-session', () => {
    const native = addTake(setAspect(fresh(), '16:9', iphone17), take('1', 1000));
    expect(canFlip(native, iphone17)).toBe(false);
    expect(flip(native, iphone17)).toBe(native);

    const cropped = addTake(setAspect(fresh(olderPhone), '16:9', olderPhone), take('1', 1000));
    expect(canFlip(cropped, olderPhone)).toBe(true);
    expect(flip(cropped, olderPhone).strategy).toBe('crop');
  });

  it('reports the crop output size for the warning', () => {
    expect(cropOutputSize(olderPhone, 'front')).toEqual({ width: 1920, height: 1080 });
    expect(cropOutputSize({ ...olderPhone, cropSourceFront: { width: 1080, height: 1920 } }, 'front')).toEqual({
      width: 1080,
      height: 606,
    });
  });
});
