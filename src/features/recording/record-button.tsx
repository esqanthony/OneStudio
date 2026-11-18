import { Pressable, View } from 'react-native';

/** Tap to start a take, tap again to pause (which saves the take). */
export function RecordButton({
  recording,
  disabled,
  onPress,
}: {
  recording: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Pause and save take' : 'Record a take'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      className={`h-20 w-20 items-center justify-center rounded-full border-4 border-ink ${disabled ? 'opacity-40' : ''}`}>
      <View className={recording ? 'h-8 w-8 rounded-lg bg-record' : 'h-16 w-16 rounded-full bg-record'} />
    </Pressable>
  );
}
