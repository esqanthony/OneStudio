import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/ui/button';
import { formatDuration } from '@/features/recording/session-logic';
import { loadSession, sessionFile } from '@/features/recording/session-storage';

/**
 * Editor entry point. For now: preview the joined video, save it to Photos or share it.
 * Trim, split, reorder and text overlays arrive in the editor phase.
 */
export default function EditScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { width } = useWindowDimensions();
  const session = useMemo(() => loadSession(sessionId), [sessionId]);
  const uri = session?.output ? sessionFile(session.id, session.output.file).uri : null;
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  const [status, setStatus] = useState<string | null>(null);

  if (!session?.output || !uri) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-8">
        <Stack.Screen options={{ title: 'Video' }} />
        <Text className="text-center text-base text-muted">This video isn{"'"}t available.</Text>
      </View>
    );
  }

  const { output } = session;
  const landscape = output.width > output.height;
  const previewWidth = landscape ? width - 32 : Math.min(width - 32, 300);
  const previewHeight = (previewWidth * output.height) / output.width;

  const saveToPhotos = async () => {
    try {
      const permission = await requestPermissionsAsync(true);
      if (!permission.granted) {
        setStatus('Allow OneStudio to add to Photos in Settings to save videos.');
        return;
      }
      await Asset.create(uri);
      setStatus('Saved to Photos.');
    } catch (e) {
      setStatus(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const share = () => Sharing.shareAsync(uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="items-center gap-5 p-4 pb-16">
      <Stack.Screen options={{ title: 'Your video' }} />
      <View style={{ width: previewWidth, height: previewHeight }} className="overflow-hidden rounded-2xl bg-black">
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" nativeControls />
      </View>

      <Text className="text-base text-muted">
        {output.width}×{output.height} · {landscape ? '16:9 landscape' : '9:16 vertical'} ·{' '}
        {formatDuration(output.durationMs)} · {session.takes.length} {session.takes.length === 1 ? 'take' : 'takes'}
      </Text>

      <View className="w-full gap-3">
        <Button title="Save to Photos" onPress={saveToPhotos} />
        <Button title="Share" variant="secondary" onPress={share} />
        {status ? <Text className="text-center text-sm text-muted">{status}</Text> : null}
      </View>

      <Text className="text-center text-sm text-muted">
        Trimming, splitting and text overlays are coming in the editor update.
      </Text>
    </ScrollView>
  );
}
