import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { useRecordingStore } from '@/features/recording/use-recording-store';
import { useTeleprompterStore } from '@/features/teleprompter/use-teleprompter-store';

/** Script library. Opened with `pick=1` from the camera to choose the session's script. */
export default function ScriptsScreen() {
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const picking = pick === '1';
  const insets = useSafeAreaInsets();
  const { scripts, load, createScript } = useTeleprompterStore();
  const selectedId = useRecordingStore((s) => s.session?.scriptId ?? null);

  useEffect(load, [load]);

  const use = (id: string) => {
    useRecordingStore.getState().update((s) => ({ ...s, scriptId: id, showTeleprompter: true }));
    router.back();
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    const script = createScript(text);
    router.push({ pathname: '/scripts/[scriptId]', params: { scriptId: script.id } });
  };

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ title: picking ? 'Choose a script' : 'Scripts' }} />
      <FlatList
        data={scripts}
        keyExtractor={(s) => s.id}
        contentContainerClassName="gap-3 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
        ListEmptyComponent={
          <Text className="py-10 text-center text-base text-muted">
            No scripts yet. Write one, or paste one you copied from Notes or a doc.
          </Text>
        }
        renderItem={({ item }) => (
          <View className={`rounded-2xl border bg-surface p-4 ${item.id === selectedId ? 'border-accent' : 'border-line'}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.title}`}
              onPress={() => router.push({ pathname: '/scripts/[scriptId]', params: { scriptId: item.id } })}>
              <Text className="text-lg font-bold text-ink" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
                {item.body.trim() || 'Empty'}
              </Text>
            </Pressable>
            {picking ? (
              <View className="mt-3">
                <Button title={item.id === selectedId ? 'In use' : 'Use this script'} onPress={() => use(item.id)} />
              </View>
            ) : null}
          </View>
        )}
      />
      <View className="absolute bottom-0 left-0 right-0 gap-3 border-t border-line bg-canvas px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          title="New script"
          onPress={() => {
            const script = createScript();
            router.push({ pathname: '/scripts/[scriptId]', params: { scriptId: script.id } });
          }}
        />
        <Button title="Paste from clipboard" variant="secondary" onPress={paste} />
      </View>
    </View>
  );
}
