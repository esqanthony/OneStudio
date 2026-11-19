import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { sessionFile } from './session-storage';
import { deck, slideRect } from './slides-logic';
import type { RecordingSession } from './types';

/** The slide currently up, if any. */
export function currentSlideUri(session: RecordingSession): string | null {
  const slide = session.slides.find((s) => s.id === session.currentSlideId);
  return slide ? sessionFile(session.id, slide.file).uri : null;
}

/**
 * "Only me" slide: shown just under the front camera so your eyes stay near the lens.
 * Never recorded.
 */
export function GuideSlide({ uri, height }: { uri: string; height: number }) {
  return (
    <View style={{ height }} className="overflow-hidden rounded-xl bg-black/80 p-1">
      <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" accessibilityLabel="Current slide" />
    </View>
  );
}

/**
 * Slide drawn over the camera preview at the place and size it will have in the video
 * (Corner / Large layouts only).
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
  const uri = currentSlideUri(session);
  if (!uri || session.slideLayout === 'guide') return null;
  const rect = slideRect(session.aspect, session.slideLayout);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: rect.x * frameWidth,
        top: rect.y * frameHeight,
        width: rect.width * frameWidth,
        height: rect.height * frameHeight,
      }}>
      <Image source={{ uri }} style={{ flex: 1, borderRadius: 6 }} contentFit="contain" accessibilityLabel="Current slide" />
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
