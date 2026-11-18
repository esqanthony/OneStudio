import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { formatDuration, totalDurationMs } from '@/features/recording/session-logic';
import { deleteSession, listSessions } from '@/features/recording/session-storage';
import type { RecordingSession } from '@/features/recording/types';

export default function ProjectsScreen() {
  const [sessions, setSessions] = useState<RecordingSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      setSessions(listSessions());
    }, [])
  );

  const active = sessions.find((s) => s.status === 'recording' && (s.takes.length > 0 || s.pendingTake));
  const done = sessions.filter((s) => s.status === 'done');

  const discard = (session: RecordingSession) =>
    Alert.alert('Discard this session?', `${session.takes.length} takes will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          deleteSession(session.id);
          setSessions(listSessions());
        },
      },
    ]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <View className="px-5 pt-4">
        <Text className="text-4xl font-extrabold text-ink">Projects</Text>
      </View>

      <FlatList
        data={done}
        keyExtractor={(s) => s.id}
        contentContainerClassName="gap-3 px-5 pt-4 pb-40"
        ListHeaderComponent={
          <View className="gap-3 pb-2">
            {active ? (
              <View className="gap-3 rounded-2xl border border-record bg-surface p-4">
                <Text className="text-lg font-bold text-ink">Unfinished recording</Text>
                <Text className="text-sm text-muted">
                  {active.aspect} · {active.takes.length} {active.takes.length === 1 ? 'take' : 'takes'} ·{' '}
                  {formatDuration(totalDurationMs(active.takes))}
                </Text>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button title="Continue" onPress={() => router.push('/record')} />
                  </View>
                  <View className="flex-1">
                    <Button title="Discard" variant="secondary" onPress={() => discard(active)} />
                  </View>
                </View>
              </View>
            ) : (
              <Button title="New recording" onPress={() => router.push('/record')} />
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center gap-2 pt-16">
            <View className="h-20 w-20 items-center justify-center rounded-full border-4 border-ink">
              <View className="h-10 w-10 rounded-full bg-record" />
            </View>
            <Text className="pt-4 text-2xl font-bold text-ink">No videos yet</Text>
            <Text className="text-center text-base text-muted">Record in takes, then tap Done to join them.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/edit/[sessionId]', params: { sessionId: item.id } })}
            onLongPress={() => discard(item)}
            className="flex-row items-center justify-between rounded-2xl bg-surface p-4 active:opacity-80">
            <View className="flex-1 pr-3">
              <Text className="text-base font-bold text-ink" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="text-sm text-muted">
                {item.aspect} · {formatDuration(item.output?.durationMs ?? 0)}
              </Text>
            </View>
            <Text className="text-2xl text-muted">›</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
