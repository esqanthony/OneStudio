import * as Haptics from 'expo-haptics';
import { Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary';

const container: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-raised border border-line',
};
const label: Record<Variant, string> = {
  primary: 'text-accent-ink',
  secondary: 'text-ink',
};

export function Button({
  title,
  variant = 'primary',
  disabled,
  onPress,
  ...rest
}: PressableProps & { title: string; variant?: Variant }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      className={`h-14 items-center justify-center rounded-2xl px-6 active:opacity-80 ${container[variant]} ${disabled ? 'opacity-40' : ''}`}
      {...rest}>
      <Text className={`text-base font-bold ${label[variant]}`}>{title}</Text>
    </Pressable>
  );
}
