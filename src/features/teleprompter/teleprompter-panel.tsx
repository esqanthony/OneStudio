import { useEffect, useRef } from 'react';
import {
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import type { Script, TeleprompterSettings } from './types';

/** Fraction of the panel height where the reading line sits (close to the lens). */
const READING_LINE = 0.3;

/**
 * Manually scrolled script. Touching it never affects recording: it's a plain ScrollView
 * on top of (or above) the camera, and the record button is a separate control.
 */
export function TeleprompterPanel({
  script,
  settings,
  height,
  initialOffset,
  onOffsetChange,
}: {
  script: Script;
  settings: TeleprompterSettings;
  height: number;
  initialOffset: number;
  onOffsetChange: (offset: number) => void;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const restoredFor = useRef<string | null>(null);
  const lineHeight = Math.round(settings.fontSize * settings.lineSpacing);
  const readingLineTop = Math.round(height * READING_LINE);

  // Restore the saved position once per script, after the text has laid out.
  useEffect(() => {
    restoredFor.current = null;
  }, [script.id]);

  const restore = () => {
    if (restoredFor.current === script.id) return;
    restoredFor.current = script.id;
    if (initialOffset > 0) {
      scrollRef.current?.scrollTo({ y: initialOffset, animated: false });
    }
  };

  const save = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onOffsetChange(Math.max(0, Math.round(e.nativeEvent.contentOffset.y)));
  };

  return (
    <View style={{ height, backgroundColor: `rgba(0,0,0,${settings.backgroundOpacity})` }} className="overflow-hidden">
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={restore}
        onScrollEndDrag={save}
        onMomentumScrollEnd={save}
        showsVerticalScrollIndicator
        indicatorStyle="white"
        contentContainerStyle={{
          paddingHorizontal: 20,
          // Let the first line start on the reading line and the last line reach it.
          paddingTop: readingLineTop,
          paddingBottom: height - readingLineTop,
        }}>
        <Text
          style={{ fontSize: settings.fontSize, lineHeight, color: settings.textColor }}
          className="font-bold"
          accessibilityLabel={`Script: ${script.title}`}>
          {script.body.trim() || 'This script is empty. Edit it from the Script button.'}
        </Text>
      </ScrollView>

      {settings.highlightReadingLine ? (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 border-y border-accent/70 bg-accent/15"
          style={{ top: readingLineTop - 4, height: lineHeight + 8 }}>
          <View className="absolute bottom-0 left-0 top-0 w-1.5 bg-accent" />
        </View>
      ) : null}
    </View>
  );
}
