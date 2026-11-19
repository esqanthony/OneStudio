import type { ExpoConfig } from 'expo/config';

/**
 * Values that are not secret but are account-specific. Fill them in once
 * (see docs/setup-from-iphone.md), or override them with environment variables.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '5bf7c612-e2b2-41f9-879f-d4e7c18af92b';
const EXPO_OWNER = process.env.EXPO_OWNER ?? 'esqanthony';
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? 'com.esqanthony.onestudio';

const CAMERA_TEXT = 'OneStudio uses the camera to record your video takes.';
const MICROPHONE_TEXT = 'OneStudio records sound with your video takes.';
const PHOTOS_TEXT = 'OneStudio adds slides from your Photos and saves your finished videos there.';

const config: ExpoConfig = {
  name: 'OneStudio',
  slug: 'onestudio',
  owner: EXPO_OWNER,
  version: '0.1.0',
  scheme: 'onestudio',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription: CAMERA_TEXT,
      NSMicrophoneUsageDescription: MICROPHONE_TEXT,
    },
  },
  android: {
    package: IOS_BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-media-library',
      {
        photosPermission: PHOTOS_TEXT,
        savePhotosPermission: 'OneStudio saves your finished videos to Photos.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        // Repeat the app's own texts: `false` here would delete them from Info.plist.
        photosPermission: PHOTOS_TEXT,
        cameraPermission: CAMERA_TEXT,
        microphonePermission: MICROPHONE_TEXT,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  runtimeVersion: { policy: 'fingerprint' },
  updates: EAS_PROJECT_ID ? { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } : undefined,
  extra: {
    eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
  },
};

export default config;
