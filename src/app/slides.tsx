import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { deleteSessionFile, sessionFile } from '@/features/recording/session-storage';
import { addSlides, deck, moveSlide, removeSlide } from '@/features/recording/slides-logic';
import type { Slide, SlideLayout } from '@/features/recording/types';
import { useRecordingStore } from '@/features/recording/use-recording-store';
import { newId } from '@/lib/id';

const LAYOUTS: { value: SlideLayout; label: string; hint: string }[] = [
  { value: 'corner', label: 'Corner', hint: 'Small, top-right. In the video.' },
  { value: 'large', label: 'Large', hint: 'Big, beside you. In the video.' },
  { value: 'guide', label: 'Only me', hint: 'You see it while recording. Not in the video.' },
];

/** Slides for the current recording session: import from Photos, order, layout. */
export default function SlidesScreen() {
  const insets = useSafeAreaInsets();
  const session = useRecordingStore((s) => s.session);
  const update = useRecordingStore((s) => s.update);
  const [status, setStatus] = useState<string | null>(null);

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-8">
        <Text className="text-center text-base text-muted">Open the camera first, then add slides from there.</Text>
      </View>
    );
  }

  const importFromPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: 0,
      quality: 1,
    });
    if (result.canceled) return;
    try {
      const slides: Slide[] = result.assets.map((asset) => {
        const id = newId();
        const ext = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase() || 'jpg';
        const name = `slide-${id}.${ext}`;
        new File(asset.uri).copySync(sessionFile(session.id, name));
        return { id, file: name };
      });
      update((s) => addSlides(s, slides));
      setStatus(`Added ${slides.length} ${slides.length === 1 ? 'slide' : 'slides'}.`);
    } catch (e) {
      setStatus(`Couldn't add slides: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const remove = (slideId: string) => {
    const { session: next, deleteFile } = removeSlide(session, slideId);
    update(() => next);
    if (deleteFile) deleteSessionFile(session.id, deleteFile);
  };

  const slides = deck(session);

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ title: 'Slides' }} />
      <FlatList
        data={slides}
        keyExtractor={(s) => s.id}
        contentContainerClassName="gap-3 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View className="gap-3 pb-2">
            <Text className="text-sm font-semibold uppercase text-muted">Show slides</Text>
            <View className="flex-row gap-2">
              {LAYOUTS.map((layout) => {
                const selected = session.slideLayout === layout.value;
                return (
                  <Pressable
                    key={layout.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => update((s) => ({ ...s, slideLayout: layout.value }))}
                    className={`flex-1 gap-1 rounded-2xl border p-3 ${selected ? 'border-accent bg-raised' : 'border-line bg-surface'}`}>
                    <Text className={`text-base font-bold ${selected ? 'text-accent' : 'text-ink'}`}>{layout.label}</Text>
                    <Text className="text-xs text-muted">{layout.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-xs text-muted">
              You can change this any time, even after recording. It{"'"}s applied when you tap Done.
            </Text>
            {status ? <Text className="text-sm text-ink">{status}</Text> : null}
            <Text className="pt-2 text-sm font-semibold uppercase text-muted">
              {slides.length} {slides.length === 1 ? 'slide' : 'slides'}, in order
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="py-8 text-center text-base text-muted">
            No slides yet. Export your deck as images (Keynote: Share → Export → Images), then add them from Photos.
            Pick them in order.
          </Text>
        }
        renderItem={({ item, index }) => (
          <View
            className={`flex-row items-center gap-3 rounded-2xl border bg-surface p-2 ${item.id === session.currentSlideId ? 'border-accent' : 'border-line'}`}>
            <Text className="w-6 text-center text-base font-bold text-muted">{index + 1}</Text>
            <Image
              source={{ uri: sessionFile(session.id, item.file).uri }}
              style={{ width: 112, height: 63, borderRadius: 6, backgroundColor: '#000' }}
              contentFit="contain"
            />
            <View className="flex-1 flex-row justify-end gap-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move slide ${index + 1} up`}
                disabled={index === 0}
                onPress={() => update((s) => moveSlide(s, item.id, -1))}
                className={`h-10 w-10 items-center justify-center rounded-full bg-raised ${index === 0 ? 'opacity-35' : ''}`}>
                <Text className="text-lg text-ink">↑</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move slide ${index + 1} down`}
                disabled={index === slides.length - 1}
                onPress={() => update((s) => moveSlide(s, item.id, 1))}
                className={`h-10 w-10 items-center justify-center rounded-full bg-raised ${index === slides.length - 1 ? 'opacity-35' : ''}`}>
                <Text className="text-lg text-ink">↓</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove slide ${index + 1}`}
                onPress={() => remove(item.id)}
                className="h-10 w-10 items-center justify-center rounded-full bg-raised">
                <Text className="text-lg text-danger">✕</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      <View className="absolute bottom-0 left-0 right-0 border-t border-line bg-canvas px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button title="Add slides from Photos" onPress={importFromPhotos} />
      </View>
    </View>
  );
}
