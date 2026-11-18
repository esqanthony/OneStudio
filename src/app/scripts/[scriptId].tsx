import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useRecordingStore } from '@/features/recording/use-recording-store';
import { useTeleprompterStore } from '@/features/teleprompter/use-teleprompter-store';
import { colors } from '@/theme/tokens';

export default function ScriptEditorScreen() {
  const { scriptId } = useLocalSearchParams<{ scriptId: string }>();
  const { scripts, load, updateScript, deleteScript } = useTeleprompterStore();
  useEffect(load, [load]);
  const script = scripts.find((s) => s.id === scriptId);

  const [title, setTitle] = useState(script?.title ?? '');
  const [body, setBody] = useState(script?.body ?? '');

  // Save as you type (each write is a small local JSON file).
  useEffect(() => {
    if (!script || (title === script.title && body === script.body)) return;
    const timer = setTimeout(() => updateScript(script.id, { title: title.trim() || 'Untitled script', body }), 400);
    return () => clearTimeout(timer);
  }, [title, body, script, updateScript]);

  if (!script) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Text className="text-muted">This script was deleted.</Text>
      </View>
    );
  }

  const remove = () =>
    Alert.alert('Delete script?', `"${script.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const session = useRecordingStore.getState().session;
          if (session?.scriptId === script.id) {
            useRecordingStore.getState().update((s) => ({ ...s, scriptId: null }));
          }
          deleteScript(script.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="gap-4 p-4 pb-24" keyboardDismissMode="interactive">
      <Stack.Screen
        options={{
          title: 'Edit script',
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={remove} hitSlop={10}>
              <Text className="text-base font-semibold text-danger">Delete</Text>
            </Pressable>
          ),
        }}
      />
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={colors.muted}
        className="rounded-2xl bg-surface px-4 py-3 text-xl font-bold text-ink"
        accessibilityLabel="Script title"
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Write or paste your script…"
        placeholderTextColor={colors.muted}
        multiline
        textAlignVertical="top"
        scrollEnabled={false}
        className="min-h-96 rounded-2xl bg-surface px-4 py-3 text-lg leading-7 text-ink"
        accessibilityLabel="Script text"
      />
    </ScrollView>
  );
}
