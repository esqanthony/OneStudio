import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { LIMITS, TEXT_COLORS } from '@/features/teleprompter/types';
import { useTeleprompterStore } from '@/features/teleprompter/use-teleprompter-store';
import { colors } from '@/theme/tokens';

function Stepper({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) * 100) / 100);
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-surface px-4 py-3">
      <Text className="text-base text-ink">{label}</Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          disabled={value <= min}
          onPress={() => set(value - step)}
          className={`h-10 w-10 items-center justify-center rounded-full bg-raised ${value <= min ? 'opacity-35' : ''}`}>
          <Text className="text-xl font-bold text-ink">−</Text>
        </Pressable>
        <Text className="w-14 text-center text-base font-semibold tabular-nums text-ink">{display}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          disabled={value >= max}
          onPress={() => set(value + step)}
          className={`h-10 w-10 items-center justify-center rounded-full bg-raised ${value >= max ? 'opacity-35' : ''}`}>
          <Text className="text-xl font-bold text-ink">+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TeleprompterSettingsScreen() {
  const { settings, load, updateSettings } = useTeleprompterStore();
  useEffect(load, [load]);

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="gap-3 p-4 pb-16">
      <Stack.Screen options={{ title: 'Teleprompter' }} />

      <View
        className="items-center justify-center rounded-2xl px-4 py-6"
        style={{ backgroundColor: `rgba(40,40,44,${settings.backgroundOpacity})` }}>
        <Text
          style={{
            fontSize: settings.fontSize,
            lineHeight: Math.round(settings.fontSize * settings.lineSpacing),
            color: settings.textColor,
          }}
          className="text-center font-bold">
          Look here.{'\n'}Read naturally.
        </Text>
      </View>

      <Stepper
        label="Text size"
        value={settings.fontSize}
        display={`${settings.fontSize}`}
        {...LIMITS.fontSize}
        onChange={(fontSize) => updateSettings({ fontSize })}
      />
      <Stepper
        label="Line spacing"
        value={settings.lineSpacing}
        display={settings.lineSpacing.toFixed(1)}
        {...LIMITS.lineSpacing}
        onChange={(lineSpacing) => updateSettings({ lineSpacing })}
      />
      <Stepper
        label="Background"
        value={settings.backgroundOpacity}
        display={`${Math.round(settings.backgroundOpacity * 100)}%`}
        {...LIMITS.backgroundOpacity}
        onChange={(backgroundOpacity) => updateSettings({ backgroundOpacity })}
      />

      <View className="gap-3 rounded-2xl bg-surface px-4 py-3">
        <Text className="text-base text-ink">Text colour</Text>
        <View className="flex-row gap-3">
          {TEXT_COLORS.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`Text colour ${color}`}
              accessibilityState={{ selected: settings.textColor === color }}
              onPress={() => updateSettings({ textColor: color })}
              style={{ backgroundColor: color }}
              className={`h-10 w-10 rounded-full ${settings.textColor === color ? 'border-4 border-accent' : 'border border-line'}`}
            />
          ))}
        </View>
      </View>

      <View className="flex-row items-center justify-between rounded-2xl bg-surface px-4 py-3">
        <Text className="text-base text-ink">Highlight reading line</Text>
        <Switch
          value={settings.highlightReadingLine}
          onValueChange={(highlightReadingLine) => updateSettings({ highlightReadingLine })}
          trackColor={{ true: colors.accent }}
        />
      </View>
    </ScrollView>
  );
}
