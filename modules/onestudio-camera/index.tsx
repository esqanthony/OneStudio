import { NativeModule, requireNativeModule, requireNativeView } from 'expo';
import { forwardRef, type ComponentType, type Ref } from 'react';
import type { ViewProps } from 'react-native';

/** How takes are captured. Fixed for a whole recording session. */
export type CaptureStrategy = 'portrait' | 'native-landscape' | 'crop';
export type CameraPosition = 'front' | 'back';

export type CameraCapabilities = {
  /** Front camera can record 16:9 while the phone is upright (iPhone 17 series, iPhone Air). */
  nativeLandscapeFront: boolean;
  nativeLandscapeBack: boolean;
  hasFrontCamera: boolean;
  hasBackCamera: boolean;
  /** Vertical frame size used in crop mode; the 16:9 band is cut from it. */
  cropSourceFront?: { width: number; height: number };
  cropSourceBack?: { width: number; height: number };
};

export type CameraReadyEvent = {
  /** The strategy actually in use. Can differ from the requested one (native → crop fallback). */
  strategy: CaptureStrategy;
  position: CameraPosition;
  /** Size of each recorded frame, upright. */
  width: number;
  height: number;
};

export type TakeFinishedEvent = {
  uri: string;
  /** The file is playable and can be kept. */
  success: boolean;
  reason: 'stopped' | 'maxDuration' | 'interrupted';
  durationMs?: number;
  width?: number;
  height?: number;
  error?: string;
};

/** Normalized (0–1) rectangle in the output frame, origin top-left. */
export type OverlayRect = { x: number; y: number; width: number; height: number };

/** An image drawn on top of the joined video between two times, fitted into `rect`. */
export type JoinOverlay = { imageUri: string; startMs: number; endMs: number; rect: OverlayRect };

export type VideoInfo = { durationMs: number; width: number; height: number };
export type JoinResult = VideoInfo & { uri: string };

type OneStudioCameraEvents = { onJoinProgress: (event: { progress: number }) => void };

declare class OneStudioCameraModuleType extends NativeModule<OneStudioCameraEvents> {
  getPermissionsAsync(): Promise<{ camera: boolean; microphone: boolean }>;
  requestPermissionsAsync(): Promise<{ camera: boolean; microphone: boolean }>;
  getCapabilitiesAsync(): Promise<CameraCapabilities>;
  probeVideoAsync(uri: string): Promise<VideoInfo | null>;
  joinTakesAsync(options: {
    uris: string[];
    aspect: '9:16' | '16:9';
    outputUri: string;
    overlays?: JoinOverlay[];
  }): Promise<JoinResult>;
  cancelJoinAsync(): Promise<void>;
}

export const OneStudioCamera = requireNativeModule<OneStudioCameraModuleType>('OneStudioCamera');

export type OneStudioCameraViewProps = ViewProps & {
  position: CameraPosition;
  strategy: CaptureStrategy;
  active: boolean;
  onCameraReady?: (e: { nativeEvent: CameraReadyEvent }) => void;
  onTakeStarted?: (e: { nativeEvent: { uri: string } }) => void;
  onTakeFinished?: (e: { nativeEvent: TakeFinishedEvent }) => void;
  onCameraError?: (e: { nativeEvent: { message: string } }) => void;
};

export type OneStudioCameraViewRef = {
  /** Starts writing a take to `uri`. Resolves once the request is queued; watch onTakeStarted. */
  startTakeAsync(uri: string, maxDurationSeconds: number | null): Promise<void>;
  /** Stops the current take. The result arrives in onTakeFinished. */
  stopTakeAsync(): Promise<void>;
};

const NativeView: ComponentType<OneStudioCameraViewProps & { ref?: Ref<OneStudioCameraViewRef> }> =
  requireNativeView('OneStudioCamera');

export const OneStudioCameraView = forwardRef<OneStudioCameraViewRef, OneStudioCameraViewProps>(
  function OneStudioCameraView(props, ref) {
    return <NativeView {...props} ref={ref} />;
  }
);
