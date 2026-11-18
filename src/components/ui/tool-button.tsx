import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, Text } from 'react-native';

import { colors } from '@/theme/tokens';

/** Icon + short label, used for the recording screen's tool row. */
export function ToolButton({
  icon,
  label,
  onPress,
  disabled,
  active,
  accessibilityLabel,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`min-w-14 items-center gap-1 rounded-xl px-2 py-1.5 ${active ? 'bg-white/20' : ''} ${disabled ? 'opacity-35' : ''}`}>
      <SymbolView name={icon} size={22} tintColor={active ? colors.accent : colors.ink} />
      <Text className="text-[11px] font-semibold text-ink" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
