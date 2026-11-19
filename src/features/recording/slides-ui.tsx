import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { sessionFile } from './session-storage';
import { deck, slideRect } from './slides-logic';
import type { RecordingSession } from './types';

/**
 * The current slide drawn over the camera preview, at the same place and size it will have in
 * the video. In "guide" layout it's marked as visible only to you.
 */
export function SlideOverlay({
  session,
  frameWidth,
  frameHeight,
}: {
  session: RecordingSession;
  frameWidth: number;
  frameHeight: number;
}) {
  const slide = session.slides.find((s) => s.id === session.currentSlideId);
  if (!slide) return null;
  const guide = session.slideLayout === 'guide';
  const rect = slideRect(session.aspect, guide ? 'large' : session.slideLayout);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: rect.x * frameWidth,
        top: rect.y * frameHeight,
        width: rect.width * frameWidth,
        height: rect.height * frameHeight,
        opacity: guide ? 0.85 : 1,
      }}
      className={guide ? 'rounded-lg border-2 border-dashed border-accent' : ''}>
      <Image
        source={{ uri: sessionFile(session.id, slide.file).uri }}
        style={{ flex: 1, borderRadius: 6 }}
        contentFit="contain"
        accessibilityLabel="Current slide"
      />
      {guide ? (
        <View className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-accent">Only you see this</Text>
        </View>
      ) : null}
    </View>
  );
}

function ArrowButton({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      className={`h-12 w-16 items-center justify-center rounded-2xl bg-raised ${disabled ? 'opacity-35' : ''}`}>
      <Text className="text-2xl font-bold text-ink">{glyph}</Text>
    </Pressable>
  );
}

/** Big previous / next buttons so slides can be changed mid-sentence without looking. */
export function SlideControls({
  session,
  onStep,
  onToggleHidden,
}: {
  session: RecordingSession;
  onStep: (delta: -1 | 1) => void;
  onToggleHidden: () => void;
}) {
  const visible = deck(session);
  if (visible.length === 0) return null;
  const index = visible.findIndex((s) => s.id === session.currentSlideId);
  const showing = index >= 0;
  return (
    <View className="flex-row items-center justify-center gap-2">
      <ArrowButton label="Previous slide" glyph="‹" disabled={showing && index === 0} onPress={() => onStep(-1)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showing ? `Slide ${index + 1} of ${visible.length}. Tap to hide` : 'No slide showing. Tap to show'}
        onPress={onToggleHidden}
        className="h-12 min-w-24 items-center justify-center rounded-2xl bg-black/60 px-3">
        <Text className="text-sm font-bold tabular-nums text-ink">
          {showing ? `${index + 1} / ${visible.length}` : 'Hidden'}
        </Text>
        <Text className="text-[10px] text-muted">{showing ? 'tap to hide' : 'tap to show'}</Text>
      </Pressable>
      <ArrowButton
        label="Next slide"
        glyph="›"
        disabled={showing && index === visible.length - 1}
        onPress={() => onStep(1)}
      />
    </View>
  );
}
