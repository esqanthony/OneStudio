import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OneStudioCamera,
  OneStudioCameraView,
  type CameraCapabilities,
  type CameraReadyEvent,
  type OneStudioCameraViewRef,
  type TakeFinishedEvent,
} from '@modules/onestudio-camera';
import { Button } from '@/components/ui/button';
import { ToolButton } from '@/components/ui/tool-button';
import { RecordButton } from '@/features/recording/record-button';
import { SegmentedProgressBar } from '@/features/recording/segmented-progress-bar';
import {
  addTake,
  canFlip,
  cropOutputSize,
  deleteLastTake,
  flip,
  formatMaxDuration,
  isLocked,
  MIN_TAKE_MS,
  nextMaxDuration,
  remainingMs,
  setAspect,
} from '@/features/recording/session-logic';
import { deleteSessionFile, sessionFile } from '@/features/recording/session-storage';
import { overlayTimeline, showSlide, slideRect, stepSlide } from '@/features/recording/slides-logic';
import { SlideControls, SlideOverlay } from '@/features/recording/slides-ui';
import { useRecordingStore } from '@/features/recording/use-recording-store';
import { TeleprompterPanel } from '@/features/teleprompter/teleprompter-panel';
import { useTeleprompterStore } from '@/features/teleprompter/use-teleprompter-store';
import { useAppState } from '@/hooks/use-app-state';
import { newId } from '@/lib/id';

type Phase = 'idle' | 'starting' | 'recording' | 'stopping' | 'joining';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function RecordScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isFocused = useIsFocused();
  const appState = useAppState();
  const cameraRef = useRef<OneStudioCameraViewRef>(null);

  const session = useRecordingStore((s) => s.session);
  const update = useRecordingStore((s) => s.update);
  const open = useRecordingStore((s) => s.open);
  const close = useRecordingStore((s) => s.close);

  const loadTeleprompter = useTeleprompterStore((s) => s.load);
  const scripts = useTeleprompterStore((s) => s.scripts);
  const promptSettings = useTeleprompterStore((s) => s.settings);

  const [caps, setCaps] = useState<CameraCapabilities | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [camera, setCamera] = useState<CameraReadyEvent | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [liveMs, setLiveMs] = useState(0);
  const [joinProgress, setJoinProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const startedAt = useRef<number | null>(null);
  const finishWaiters = useRef<(() => void)[]>([]);

  // Permissions, device capabilities, then the unfinished session (or a new one).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      loadTeleprompter();
      let perms = await OneStudioCamera.getPermissionsAsync();
      if (!perms.camera || !perms.microphone) {
        perms = await OneStudioCamera.requestPermissionsAsync();
      }
      if (cancelled) return;
      if (!perms.camera) {
        setPermission('denied');
        return;
      }
      if (!perms.microphone) {
        setNotice('Microphone access is off, so takes will have no sound. You can turn it on in Settings.');
      }
      const deviceCaps = await OneStudioCamera.getCapabilitiesAsync();
      if (cancelled) return;
      setCaps(deviceCaps);
      await open(deviceCaps);
      if (!cancelled) setPermission('granted');
    })().catch((e) => setNotice(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [loadTeleprompter, open]);

  // Live duration of the take in progress.
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => {
      if (startedAt.current) setLiveMs(Date.now() - startedAt.current);
    }, 100);
    return () => clearInterval(timer);
  }, [phase]);

  // Leaving the app ends the take (it is saved, not lost).
  useEffect(() => {
    if (appState !== 'active' && phase === 'recording') {
      cameraRef.current?.stopTakeAsync();
    }
  }, [appState, phase]);

  const cameraMatchesSession =
    !!session && !!camera && camera.strategy === session.strategy && camera.position === session.position;

  const onCameraReady = useCallback(
    (ready: CameraReadyEvent) => {
      setCamera(ready);
      const current = useRecordingStore.getState().session;
      if (!current || ready.strategy === current.strategy) return;
      if (!isLocked(current)) {
        // Native landscape wasn't available after all: use the crop fallback for this session.
        update((s) => ({ ...s, strategy: ready.strategy }));
      } else {
        setNotice("The camera can't record in this session's mode any more. Tap Done to finish it, or start a new one.");
      }
    },
    [update]
  );

  const onTakeFinished = useCallback(
    (result: TakeFinishedEvent) => {
      startedAt.current = null;
      setLiveMs(0);
      setPhase((p) => (p === 'joining' ? p : 'idle'));

      const current = useRecordingStore.getState().session;
      const pending = current?.pendingTake;
      if (current && pending) {
        if (result.success && (result.durationMs ?? 0) >= MIN_TAKE_MS) {
          update((s) =>
            addTake(s, {
              id: pending.id,
              file: pending.file,
              durationMs: result.durationMs ?? 0,
              width: result.width ?? 0,
              height: result.height ?? 0,
              slideEvents: pending.slideEvents ?? [{ atMs: 0, slideId: current.currentSlideId }],
            })
          );
        } else {
          deleteSessionFile(current.id, pending.file);
          update((s) => ({ ...s, pendingTake: null }));
        }
      }

      if (result.reason === 'maxDuration') {
        setNotice('Reached the maximum length for this session.');
      } else if (result.reason === 'interrupted') {
        setNotice(
          result.success
            ? 'Recording was interrupted. The take was saved.'
            : `The take couldn't be saved${result.error ? `: ${result.error}` : '.'}`
        );
      }
      finishWaiters.current.splice(0).forEach((resolve) => resolve());
    },
    [update]
  );

  const toggleRecord = async () => {
    const current = useRecordingStore.getState().session;
    if (!current) return;
    if (phase === 'recording') {
      setPhase('stopping');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await cameraRef.current?.stopTakeAsync();
      return;
    }
    if (phase !== 'idle') return;
    const remaining = remainingMs(current);
    if (remaining !== null && remaining < 500) {
      setNotice('This session has reached its maximum length. Delete a take or raise the limit.');
      return;
    }
    const id = newId();
    const file = `take-${id}.mov`;
    update((s) => ({ ...s, pendingTake: { id, file, slideEvents: [{ atMs: 0, slideId: s.currentSlideId }] } }));
    setPhase('starting');
    setNotice(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await cameraRef.current?.startTakeAsync(
        sessionFile(current.id, file).uri,
        remaining !== null ? remaining / 1000 : null
      );
    } catch (e) {
      update((s) => ({ ...s, pendingTake: null }));
      setPhase('idle');
      setNotice(errorMessage(e));
    }
  };

  /** Changes slide; while recording, the change is timed so the video switches at the same moment. */
  const changeSlide = (slideId: string | null) => {
    const atMs = phase === 'recording' && startedAt.current ? Date.now() - startedAt.current : null;
    update((s) => showSlide(s, slideId, atMs));
    Haptics.selectionAsync();
  };

  const stepSlides = (delta: -1 | 1) => {
    const current = useRecordingStore.getState().session;
    if (current) changeSlide(stepSlide(current, delta));
  };

  /** Hide the slide, or bring back the one that was showing (or the first). */
  const lastShownSlide = useRef<string | null>(null);
  const toggleSlideHidden = () => {
    const current = useRecordingStore.getState().session;
    if (!current) return;
    if (current.currentSlideId) {
      lastShownSlide.current = current.currentSlideId;
      changeSlide(null);
    } else {
      const visible = current.slides.filter((sl) => !sl.hidden);
      const back = visible.find((sl) => sl.id === lastShownSlide.current) ?? visible[0];
      if (back) changeSlide(back.id);
    }
  };

  const deleteLast = () => {
    const current = useRecordingStore.getState().session;
    if (!current || phase !== 'idle') return;
    const { session: next, removed } = deleteLastTake(current);
    if (!removed) return;
    update(() => next);
    deleteSessionFile(current.id, removed.file);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const finish = async () => {
    if (phase === 'recording') {
      const stopped = new Promise<void>((resolve) => finishWaiters.current.push(resolve));
      setPhase('stopping');
      await cameraRef.current?.stopTakeAsync();
      await stopped;
    }
    const current = useRecordingStore.getState().session;
    if (!current) return;
    if (current.takes.length === 0) {
      setNotice('Record at least one take first.');
      return;
    }
    setPhase('joining');
    setJoinProgress(0);
    const subscription = OneStudioCamera.addListener('onJoinProgress', ({ progress }) => setJoinProgress(progress));
    try {
      const outputName = `final-${Date.now()}.mp4`;
      const rect = current.slideLayout === 'guide' ? null : slideRect(current.aspect, current.slideLayout);
      const overlays = rect
        ? overlayTimeline(current).map((segment) => ({
            imageUri: sessionFile(current.id, segment.file).uri,
            startMs: segment.startMs,
            endMs: segment.endMs,
            rect,
          }))
        : [];
      const result = await OneStudioCamera.joinTakesAsync({
        uris: current.takes.map((t) => sessionFile(current.id, t.file).uri),
        aspect: current.aspect,
        outputUri: sessionFile(current.id, outputName).uri,
        overlays,
      });
      update((s) => ({
        ...s,
        status: 'done',
        output: { file: outputName, durationMs: result.durationMs, width: result.width, height: result.height },
      }));
      close();
      router.replace({ pathname: '/edit/[sessionId]', params: { sessionId: current.id } });
    } catch (e) {
      setPhase('idle');
      setNotice(`Couldn't join the takes: ${errorMessage(e)}`);
    } finally {
      subscription.remove();
    }
  };

  const leave = async () => {
    if (phase === 'recording') {
      const stopped = new Promise<void>((resolve) => finishWaiters.current.push(resolve));
      await cameraRef.current?.stopTakeAsync();
      await stopped;
    }
    close();
    router.back();
  };

  if (permission === 'denied') {
    return (
      <View className="flex-1 items-center justify-center gap-6 bg-canvas px-8">
        <Text className="text-center text-2xl font-bold text-ink">Camera access is off</Text>
        <Text className="text-center text-base text-muted">
          OneStudio needs the camera and microphone to record takes. Turn them on in Settings.
        </Text>
        <View className="w-full gap-3">
          <Button title="Open Settings" onPress={() => Linking.openSettings()} />
          <Button title="Close" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (!session || permission !== 'granted') {
    return <View className="flex-1 bg-canvas" />;
  }

  const landscape = session.aspect === '16:9';
  const locked = isLocked(session);
  const busy = phase !== 'idle';
  const script = scripts.find((s) => s.id === session.scriptId) ?? null;
  const showPrompt = session.showTeleprompter && script !== null;
  const cropSize = session.strategy === 'crop' ? cropOutputSize(caps, session.position) : null;

  const camera_ = (
    <OneStudioCameraView
      ref={cameraRef}
      style={{ flex: 1 }}
      position={session.position}
      strategy={session.strategy}
      active={isFocused && appState === 'active' && phase !== 'joining'}
      onCameraReady={(e) => onCameraReady(e.nativeEvent)}
      onTakeStarted={() => {
        startedAt.current = Date.now();
        setLiveMs(0);
        setPhase('recording');
      }}
      onTakeFinished={(e) => onTakeFinished(e.nativeEvent)}
      onCameraError={(e) => setNotice(e.nativeEvent.message)}
    />
  );

  const prompt = (height: number) =>
    script ? (
      <TeleprompterPanel
        script={script}
        settings={promptSettings}
        height={height}
        initialOffset={session.scriptScroll[script.id] ?? 0}
        onOffsetChange={(offset) =>
          update((s) => ({ ...s, scriptScroll: { ...s.scriptScroll, [script.id]: offset } }))
        }
      />
    ) : null;

  const tools = (
    <>
      <ToolButton
        icon={landscape ? 'rectangle' : 'rectangle.portrait'}
        label={session.aspect}
        accessibilityLabel={`Aspect ${session.aspect}${locked ? ', locked for this session' : ''}`}
        disabled={locked || busy}
        onPress={() => update((s) => setAspect(s, landscape ? '9:16' : '16:9', caps))}
      />
      <ToolButton
        icon="arrow.triangle.2.circlepath.camera"
        label="Flip"
        disabled={busy || !canFlip(session, caps)}
        onPress={() => update((s) => flip(s, caps))}
      />
      <ToolButton
        icon="timer"
        label={formatMaxDuration(session.maxDurationMs)}
        accessibilityLabel={`Maximum length: ${formatMaxDuration(session.maxDurationMs)}`}
        disabled={busy}
        onPress={() => update((s) => ({ ...s, maxDurationMs: nextMaxDuration(s) }))}
      />
      <ToolButton
        icon="text.alignleft"
        label="Script"
        active={showPrompt}
        onPress={() => router.push({ pathname: '/scripts', params: { pick: '1' } })}
      />
      {script ? (
        <ToolButton
          icon={session.showTeleprompter ? 'eye' : 'eye.slash'}
          label={session.showTeleprompter ? 'Hide' : 'Show'}
          onPress={() => update((s) => ({ ...s, showTeleprompter: !s.showTeleprompter }))}
        />
      ) : null}
      <ToolButton icon="textformat.size" label="Prompter" onPress={() => router.push('/teleprompter-settings')} />
      <ToolButton
        icon="photo.on.rectangle"
        label="Slides"
        active={session.slides.some((sl) => !sl.hidden)}
        disabled={phase === 'starting' || phase === 'stopping' || phase === 'joining'}
        onPress={() => router.push('/slides')}
      />
    </>
  );

  const controls = (
    <View className="flex-row items-center justify-between px-6">
      <View className="w-24 items-start">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete last take"
          disabled={busy || session.takes.length === 0}
          onPress={deleteLast}
          className={`items-center gap-1 rounded-2xl bg-black/50 px-3 py-2 ${busy || session.takes.length === 0 ? 'opacity-35' : ''}`}>
          <Text className="text-lg text-ink">⌫</Text>
          <Text className="text-[11px] font-semibold text-ink">Delete last</Text>
        </Pressable>
      </View>
      <RecordButton
        recording={phase === 'recording'}
        disabled={!cameraMatchesSession || phase === 'starting' || phase === 'stopping' || phase === 'joining'}
        onPress={toggleRecord}
      />
      <View className="w-24 items-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done, join takes"
          disabled={phase === 'starting' || phase === 'stopping' || phase === 'joining' || (session.takes.length === 0 && phase !== 'recording')}
          onPress={finish}
          className={`h-12 items-center justify-center rounded-2xl bg-accent px-5 ${session.takes.length === 0 && phase !== 'recording' ? 'opacity-35' : ''}`}>
          <Text className="text-base font-bold text-accent-ink">Done</Text>
        </Pressable>
      </View>
    </View>
  );

  const banner = notice ? (
    <Pressable onPress={() => setNotice(null)} className="mx-3 rounded-xl bg-raised/95 px-4 py-2">
      <Text className="text-sm text-ink">{notice}</Text>
    </Pressable>
  ) : null;

  const closeButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close camera"
      onPress={leave}
      hitSlop={10}
      className="h-9 w-9 items-center justify-center rounded-full bg-black/50">
      <Text className="text-lg font-bold text-ink">✕</Text>
    </Pressable>
  );

  const joiningOverlay =
    phase === 'joining' ? (
      <View className="absolute inset-0 items-center justify-center gap-4 bg-black/80">
        <Text className="text-xl font-bold text-ink">Joining takes… {Math.round(joinProgress * 100)}%</Text>
        <Button title="Cancel" variant="secondary" onPress={() => OneStudioCamera.cancelJoinAsync()} />
      </View>
    ) : null;

  if (landscape) {
    const previewHeight = Math.round((screenWidth * 9) / 16);
    return (
      <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 8 }}>
        <View className="flex-row items-start gap-2 pr-3">
          <View className="flex-1">
            <SegmentedProgressBar takes={session.takes} liveMs={liveMs} maxDurationMs={session.maxDurationMs} />
          </View>
          <View className="pt-1">{closeButton}</View>
        </View>

        {/* Teleprompter sits between the lens and the landscape preview, so eyes stay near the camera. */}
        <View className="mt-2 flex-1" onLayout={(e) => setPanelHeight(Math.round(e.nativeEvent.layout.height))}>
          {showPrompt && panelHeight > 0 ? (
            prompt(panelHeight)
          ) : (
            <Pressable
              onPress={() => router.push({ pathname: '/scripts', params: { pick: '1' } })}
              className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-base text-muted">
                {script ? 'Teleprompter hidden.' : 'Tap to add a script. It shows here, right under the camera.'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: previewHeight }} className="bg-black">
          {camera_}
          <SlideOverlay session={session} frameWidth={screenWidth} frameHeight={previewHeight} />
        </View>

        <Text className="px-4 pt-1.5 text-center text-[11px] text-muted">
          {session.strategy === 'native-landscape'
            ? 'Full-quality landscape from the front camera. Keep holding your phone upright.'
            : cropSize
              ? `Cropped from vertical video, about ${cropSize.width}×${cropSize.height}. Front cameras on iPhone 17 and iPhone Air record landscape at full quality.`
              : 'Cropped from vertical video at reduced resolution.'}
        </Text>

        <View className="pt-2">
          <SlideControls session={session} onStep={stepSlides} onToggleHidden={toggleSlideHidden} />
        </View>
        <View className="flex-row flex-wrap justify-center gap-1 py-2">{tools}</View>
        {banner}
        <View className="pt-2">{controls}</View>
        {joiningOverlay}
      </View>
    );
  }

  // 9:16: the preview is exactly the recorded frame; everything else floats on top of it.
  const available = screenHeight - insets.top - insets.bottom;
  const previewHeight = Math.min(available, Math.round((screenWidth * 16) / 9));
  const previewWidth = Math.round((previewHeight * 9) / 16);
  return (
    <View className="flex-1 items-center bg-canvas" style={{ paddingTop: insets.top }}>
      <View style={{ width: previewWidth, height: previewHeight }} className="overflow-hidden rounded-2xl bg-black">
        {camera_}
        <SlideOverlay session={session} frameWidth={previewWidth} frameHeight={previewHeight} />

        <View className="absolute left-0 right-0 top-0">
          <View className="flex-row items-start gap-2 pr-3">
            <View className="flex-1">
              <SegmentedProgressBar takes={session.takes} liveMs={liveMs} maxDurationMs={session.maxDurationMs} />
            </View>
            <View className="pt-1">{closeButton}</View>
          </View>
          {showPrompt ? <View className="mx-3 mt-2 overflow-hidden rounded-xl">{prompt(Math.round(previewHeight * 0.26))}</View> : null}
        </View>

        <View className="absolute right-2 gap-1 rounded-2xl bg-black/35 py-1" style={{ top: previewHeight * 0.36 }}>
          {tools}
        </View>

        <View className="absolute bottom-0 left-0 right-0 gap-2 pb-5">
          {banner}
          <SlideControls session={session} onStep={stepSlides} onToggleHidden={toggleSlideHidden} />
          {controls}
        </View>
      </View>
      {joiningOverlay}
    </View>
  );
}
