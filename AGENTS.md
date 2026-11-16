# OneStudio: notes for coding agents

OneStudio is an iOS-only Expo app (Expo SDK 58, React Native 0.88, New Architecture) for
recording, editing and publishing short-form vertical video. Read `architecture-and-roadmap.md`
before making structural changes; it is the source of truth for scope and phases.

## The owner works from an iPhone only
- There is no Mac. Never suggest `expo run:ios`, Xcode or a local simulator.
- Native code is compiled by EAS Build. Builds reach the phone through TestFlight (`.eas/workflows/testflight.yml`).
- JS-only changes ship as EAS Updates (`.eas/workflows/update.yml`); Settings → "Check for update" pulls them.
- Never create or edit `ios/` or `android/`. They are generated (Continuous Native Generation). Configure native
  behaviour in `app.config.ts` and config plugins. Custom Swift lives in `modules/` as local Expo Modules.

## Expo changes every SDK. Don't trust memory
Check the installed package's `.d.ts` files in `node_modules` before using an Expo API.
Docs: https://docs.expo.dev/versions/v58.0.0/ (may be unreachable from cloud sessions).

## Commands
Cloud sessions can't reach api.expo.dev, so prefix Expo CLI commands with `EXPO_OFFLINE=1`.

```bash
EXPO_OFFLINE=1 npx expo install <package>   # always use instead of npm install for runtime deps
npx tsc --noEmit                            # typecheck
EXPO_OFFLINE=1 npx expo lint                # lint
EXPO_OFFLINE=1 npx expo export --platform ios --output-dir /tmp/os-export   # proves the JS bundle builds
EXPO_OFFLINE=1 npx expo prebuild --platform ios --no-install --clean && rm -rf ios   # proves config plugins apply
```
Run typecheck, lint and the iOS export before declaring a task done.

## Conventions
- Routes: `src/app/` (Expo Router). Screens stay thin; logic goes in `src/features/<feature>/`.
- Styling: NativeWind 4 (`className`). Colors only from `src/theme/tokens.js` (canvas, surface, raised, line, ink,
  muted, record, accent, accent-ink, danger). The UI is dark only.
- Imports use the `@/` alias for `src/`.
- Do not add `expo-av` (deprecated) or any ffmpeg-kit package (retired). Video processing is AVFoundation in
  `modules/onestudio-video`.
