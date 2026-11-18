import { Text, View } from 'react-native';

import { formatDuration, progressBar, totalDurationMs } from './session-logic';
import type { Take } from './types';

/** Thin bar along the top: one white block per take, a red block for the take in progress. */
export function SegmentedProgressBar({
  takes,
  liveMs,
  maxDurationMs,
}: {
  takes: Take[];
  liveMs: number;
  maxDurationMs: number | null;
}) {
  const { segments, live } = progressBar(takes, liveMs, maxDurationMs);
  const elapsed = totalDurationMs(takes) + liveMs;

  return (
    <View className="gap-1.5 px-3 pt-2">
      <View
        className="h-2 overflow-hidden rounded-full bg-white/25"
        accessibilityRole="progressbar"
        accessibilityLabel={`${takes.length} takes, ${formatDuration(elapsed)} recorded`}>
        {segments.map((segment) => (
          <View
            key={segment.id}
            className="absolute bottom-0 top-0 border-r-2 border-black bg-ink"
            style={{ left: `${segment.start * 100}%`, width: `${segment.width * 100}%` }}
          />
        ))}
        {live ? (
          <View
            className="absolute bottom-0 top-0 bg-record"
            style={{ left: `${live.start * 100}%`, width: `${live.width * 100}%` }}
          />
        ) : null}
      </View>
      <View className="flex-row justify-between">
        <Text className="text-xs font-semibold text-ink">
          {takes.length} {takes.length === 1 ? 'take' : 'takes'}
        </Text>
        <Text className="text-xs font-semibold tabular-nums text-ink">
          {formatDuration(elapsed)}
          {maxDurationMs != null ? ` / ${formatDuration(maxDurationMs)}` : ''}
        </Text>
      </View>
    </View>
  );
}
