# OneStudio — Architecture & Roadmap

_Status: proposal, awaiting approval. No app code has been written._
_Written 2026-11-16. Package versions were checked against the npm registry that day._

OneStudio is a native iOS app (built with Expo) for recording, editing and publishing short-form vertical video to TikTok, YouTube Shorts, Instagram Reels, X and LinkedIn.

**Hard constraint:** the developer has only an iPhone, with no Mac and no computer. All native compiling happens on EAS Build (Expo's cloud macOS machines). Distribution is through TestFlight. Code is written in Claude Code cloud sessions against this GitHub repo.

---

## 0. What's in this directory today

The repo is empty apart from a one-line `README.md`, so there is no existing code to work around.

---

## 1. Stack, packages and folder structure

### 1.1 Platform baseline (verified)

| Item | Version | Notes |
|---|---|---|
| Expo SDK | **58** (`expo@58.0.25`, published 2026-11-12) | Current latest |
| React Native | 0.88.1 | Pinned by SDK 58 |
| React | 19.3.0 | Pinned by SDK 58 |
| Architecture | New Architecture only | Every package below supports it |
| Language | TypeScript (strict) | |

Expo Go **cannot** run this app, because the camera and video modules are custom native code. We use a **development build** (`expo-dev-client`) and **TestFlight builds**, both compiled by EAS.

### 1.2 Package choices

"Bundled" means the package is part of Expo SDK 58's own `bundledNativeModules.json`, so Expo guarantees it works with this SDK. Third-party packages were checked for recent releases and New Architecture support. Their real build compatibility with SDK 58 gets proven in Phase 0 and Phase 1 builds, before anything depends on them.

| Area | Package | Version / last publish | Why |
|---|---|---|---|
| Routing | `expo-router` | 58.0.31 · Nov 2026 · bundled | File-based routes, typed links |
| Styling | `nativewind` + `tailwindcss@3.4.x` | 4.2.7 · Sep 2026 | Stable line. **NativeWind 5 is still a release candidate** (5.0.0-rc.1, Nov 2026), so we stay on 4.x and upgrade when 5 is stable. |
| Animation / gestures | `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets` | 4.7.1 / ~3.3 / 0.13 · bundled | Timeline scrubbing, trim handles, drag-to-reorder |
| **Camera** | `react-native-vision-camera` + `react-native-nitro-modules` + `react-native-nitro-image` | 5.2.4 · Oct 2026 | Format, FPS and HDR control, zoom, stabilization. Needed now for 60fps and later for 4K/60. v5 is a rewrite (Apr 2026) with frequent releases since then. **Fallback:** `expo-camera` (bundled, 58.0.14), which records fine but gives less control over format and FPS. |
| **Video processing / export** | **Our own local Expo Module (Swift + AVFoundation)** at `modules/onestudio-video` | n/a: our code, compiled by EAS | See §1.3. Replaces ffmpeg-kit. |
| Playback (single clips) | `expo-video` | 58.0.14 · bundled | Clip review and the media picker |
| Thumbnails / filmstrip | `expo-video-thumbnails` (or native `AVAssetImageGenerator` in our module) | 58.0.3 · bundled | |
| Overlay rendering | `@shopify/react-native-skia` | 2.14.0 · bundled | Draws text and watermark overlays. The same drawing is turned into an image for export, so the export matches the preview exactly. |
| Audio (voiceover, preview) | `expo-audio` | 58.0.12 · bundled | **Not `expo-av`**, which is deprecated and no longer in the SDK's bundled modules. Audio mixing for export happens in the native module (`AVMutableAudioMix`). |
| Files | `expo-file-system` (new `File`/`Paths` API) | 58.0.13 · bundled | Clips are stored in the app's documents directory |
| Save to Photos | `expo-media-library` | 58.0.14 · bundled | |
| Share sheet | `expo-sharing` | 58.0.23 · bundled | |
| Copy caption | `expo-clipboard` | 58.0.4 · bundled | |
| Open target app | `expo-linking` / `Linking.openURL` | bundled | e.g. `tiktok://`, `instagram://`, `youtube://` |
| Local project database | `expo-sqlite` | 58.0.17 · bundled | Projects are saved locally first and work offline |
| App state | `zustand` | 5.1.0 · Nov 2026 | Editor state with an undo stack |
| Keep screen on while recording | `expo-keep-awake` | bundled | Already a dependency of `expo` |
| Haptics | `expo-haptics` | bundled | |
| **Supabase** | `@supabase/supabase-js` | 2.119.0 · Nov 2026 | Sessions are stored through the `expo-sqlite` localStorage polyfill, the pattern Supabase's own Expo guide uses |
| Sign in with Apple | `expo-apple-authentication` | 58.0.3 · bundled | Native Apple sign-in button, passed to Supabase auth |
| Secrets on device | `expo-secure-store` | 58.0.3 · bundled | |
| **RevenueCat** | `react-native-purchases` + `react-native-purchases-ui` | 11.0.2 · Nov 2026 | Peer dependency is RN ≥ 0.80, which RN 0.88 satisfies. `-ui` provides ready-made paywalls that review well. |
| Dev builds | `expo-dev-client` | 58.0.20 · bundled | |
| OTA JS updates | `expo-updates` (EAS Update) | bundled | **Important for a phone-only workflow** (§4.1) |
| Captions (later phase) | `expo-speech-recognition` (Apple on-device) and/or `whisper.rn` | 58.0.1 · Oct 2026 / 0.7.4 · Nov 2026 | See §2 |

**Rejected:**
- `ffmpeg-kit-react-native`: npm marks it deprecated ("Package no longer supported"), and its last release was Jan 2025.
- `react-native-video-trim`: actively maintained, but it uses FFmpegKit internally and ships its own trimming UI. That brings back the same dependency risk, and it can't do a multi-clip timeline.
- `expo-av`: deprecated.
- `react-native-compressor`: maintained, but it compresses and doesn't compose clips.

### 1.3 Video processing: why a custom AVFoundation module

Since ffmpeg-kit is retired, the realistic choices on iOS are:

1. **A community ffmpeg-kit fork.** Small maintainer teams, large binaries (30–60 MB), GPL/LGPL licensing questions, and the same risk of being abandoned again.
2. **Apple AVFoundation through a local Expo Module.** Apple maintains it, it's hardware-accelerated, it adds zero binary size, and it already does everything v1 needs plus most of the full vision. **Recommended.**

AVFoundation covers every feature on the wishlist:

| Feature | AVFoundation API |
|---|---|
| Concatenate, trim, split, reorder | `AVMutableComposition` with `insertTimeRange` |
| Speed changes | `scaleTimeRange` |
| Text overlays and watermark | `AVMutableVideoComposition` with a Core Image handler that composites overlay images rendered by Skia |
| Voiceover and music mix | Extra audio tracks plus `AVMutableAudioMix` volume ramps |
| 1080p / 4K, 30 / 60fps, HEVC / H.264 | `AVAssetExportSession` presets, or `AVAssetWriter` for exact bitrates |
| Live preview that matches the export | `AVPlayer` playing the same composition, shown in a native view the module provides |

The module is created with `npx create-expo-module --local`. It is Swift code in this repo, and EAS compiles it on its Macs. No Mac is needed on our side.

**The honest tradeoff:** native errors only show up in EAS build logs and crash reports, not in an Xcode debugger. To keep that manageable:
- Keep the Swift side small, with a JSON "edit description" in and a file path out.
- Put all editing logic in TypeScript.
- Log heavily.
- Ship it on TestFlight, which collects crash logs automatically.

Module interface (draft):

```ts
compose(project: EditDecisionList, opts: { resolution: '1080p' | '4k'; fps: 30 | 60; watermark: boolean }): Promise<{ uri: string }>
// plus: progress events, cancel(), <OneStudioPreviewView edl={...} /> native view, thumbnails(uri, times)
```

### 1.4 Folder structure

```
OneStudio/
├── src/
│   ├── app/                      # Expo Router routes (SDK 58 convention). Screens only, thin.
│   │   ├── _layout.tsx           # Providers: theme, RevenueCat, Supabase, gesture root
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx       # Native tabs
│   │   │   ├── index.tsx         # Projects list
│   │   │   └── settings.tsx      # Account, subscription, legal, delete account, build/update info
│   │   ├── record/[projectId].tsx    # Camera
│   │   ├── edit/[projectId].tsx      # Timeline editor
│   │   ├── export/[projectId].tsx    # Export + share / Copy Caption & Open App
│   │   ├── paywall.tsx           # Modal
│   │   └── auth.tsx              # Optional Sign in with Apple
│   ├── features/
│   │   ├── camera/               # Segmented recorder, progress bar, undo, safe zones
│   │   ├── editor/               # Timeline, trim handles, split, reorder, text overlays
│   │   ├── export/               # Presets, progress, share, caption hand-off
│   │   ├── projects/             # Project model, SQLite repo, file storage
│   │   ├── paywall/              # RevenueCat entitlements hook, paywall wrapper
│   │   └── auth/                 # Supabase session, account deletion
│   ├── components/ui/            # Buttons, sheets, sliders (NativeWind)
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── purchases.ts
│   │   ├── platforms.ts          # Safe-zone specs, caption limits, URL schemes per platform
│   │   └── edl.ts                # Edit decision list types + pure functions (unit-tested)
│   ├── stores/                   # zustand stores (editor + undo history)
│   ├── theme/tokens.js           # Color tokens shared by Tailwind and code
│   └── global.css                # Tailwind entry
├── modules/
│   └── onestudio-video/          # Local Expo Module (Swift, AVFoundation)
├── supabase/
│   ├── migrations/               # SQL: profiles, projects metadata, RLS policies
│   └── functions/delete-account/ # Edge Function (App Store 5.1.1(v))
├── .eas/workflows/               # testflight.yml (native changes), update.yml (OTA on every push)
├── .github/workflows/ci.yml      # Typecheck, lint, iOS bundle on every push
├── docs/setup-from-iphone.md     # One-time account and pipeline setup, all from the phone
├── assets/                       # Icon, splash, fonts
├── app.config.ts
├── eas.json
├── tailwind.config.js
└── architecture-and-roadmap.md
```

**Data rule:** video files never leave the device in v1. Supabase stores only account and project metadata (title, platform targets, caption text, timestamps). This keeps storage costs at zero and keeps the privacy questionnaire simple.

---

## 2. On-device vs. cloud

| Capability | On-device | Cloud | Recommendation |
|---|---|---|---|
| Recording | ✅ VisionCamera | — | On-device |
| Trim / split / reorder / speed | ✅ AVFoundation | — | On-device |
| Text overlays, watermark | ✅ Skia + AVFoundation | — | On-device |
| Export 1080p (and later 4K/60) | ✅ Hardware encoder. A 60s 1080p export takes a few seconds on recent iPhones. | Cloud rendering is costly and slow to upload | On-device |
| Voiceover recording and mixing | ✅ expo-audio + AVAudioMix | — | On-device |
| **Auto-captions** | **Option A: Apple Speech** (`expo-speech-recognition` file transcription with `requiresOnDeviceRecognition`). Free, no model download, timed segments. Accuracy is good for clear speech; less so for slang, names and music beds. **Option B: `whisper.rn`** (whisper.cpp with Metal/Core ML). Better accuracy and word timestamps, but the model is a 75–150 MB download (tiny/base), and it's slower and battery-heavy on longer clips. | **OpenAI Whisper API** (or similar) through a Supabase Edge Function. Best accuracy. Roughly $0.006/min of audio (verify current price), plus upload time, plus a privacy disclosure. | Start with **A** (free, private). Add **B** as a downloadable "high accuracy" option if A isn't good enough. Use cloud only if both disappoint. Either way, captions come after v1. |
| Per-platform caption adaptation | ✅ Rules: character limits (X 280, IG 2,200, TikTok ~4,000, LinkedIn 3,000, YT Shorts title 100), hashtag count, @-handles | Optional LLM rewrite through an Edge Function | Rules first (free, instant). LLM rewrite later as a Pro feature. |
| Music | Only user-imported files from Files | Licensed library (e.g. Epidemic-style APIs) costs money and has licence terms | Defer. Don't bundle copyrighted music. |
| Direct posting | — | ✅ Requires each platform's API, OAuth, and their own app approval | Defer (§3) |
| Auth, subscription status | — | ✅ Supabase, RevenueCat | Cloud |

---

## 3. Recommended v1 (built to pass App Store review)

Your proposed v1 is right. I'd make three small changes:

1. **Add platform safe-zone overlays** to v1. They're a pure UI overlay (about a day of work), a strong reason to choose this app, and carry no review risk.
2. **Make sign-in optional.** Recording, editing and exporting must work without an account (Guideline 5.1.1). If accounts exist at all, v1 must include **in-app account deletion** (5.1.1(v)) and offer **Sign in with Apple**. Simplest compliant v1: Sign in with Apple only, optional, used for project metadata sync. Supabase could even be pushed to v1.1 if you want the smallest possible first release.
3. **Keep the "Pro" value obvious.** Free tier: watermark and 1080p30. Pro: no watermark, 1080p60, unlimited projects (later 4K, captions, teleprompter). A paywall that removes nothing but a watermark is allowed, but reviewers and users respond better to clear value.

### v1 includes
- Multi-clip camera: hold or tap to record segments, segmented progress bar, undo last segment, front/back flip, 15/60/180s length caps, safe-zone overlay toggle per platform
- Projects list (saved locally)
- Timeline editor: trim, split, reorder (drag), delete clip, text overlays (font, colour, position, start/end time)
- Export: 1080p30 H.264 (Pro: 1080p60), watermark on the free tier, progress bar and cancel, save to Photos
- Share: iOS share sheet, plus **"Copy Caption & Open App"** (copies the caption, then opens TikTok, Instagram, YouTube, X or LinkedIn by URL scheme; the user picks the video from their camera roll there)
- Paywall: RevenueCat. Monthly $9.99, yearly $79.99, 7-day free trial on both (configured in App Store Connect as an introductory offer). Restore Purchases, Terms and Privacy links on the paywall.
- Settings: subscription management link, restore, privacy policy, terms, optional sign-in, delete account

### Deferred
| Feature | Target | Why |
|---|---|---|
| Auto-captions | v1.1 | Prove Apple Speech quality first; burned-in captions need a styling UI |
| Teleprompter | v1.1 | Cheap (scrolling text over the camera), but not core |
| Speed changes | v1.1 | Easy in AVFoundation, but adds timeline UI complexity |
| Voiceover | v1.2 | |
| Music (user-imported) | v1.2 | Licensing |
| 4K/60 export | v1.2 | Technically cheap; deferred to limit QA and storage issues |
| Caption adapted per platform | v1.2 | Rules engine first |
| Multi-track timeline | v2 | Big UI effort |
| **Direct API posting** | v2+ | Each platform has its own gatekeeping: TikTok Content Posting API needs an app audit before public posting; YouTube Data API needs OAuth verification and has upload quotas; Instagram needs a Business/Creator account and Meta app review; X API posting requires a paid tier; LinkedIn video posting needs partner/product approval. Expect weeks to months per platform, and it needs a backend to store tokens. |

### App Store review risks and mitigations
| Risk | Guideline | Mitigation |
|---|---|---|
| Subscription disclosure | 3.1.2 | Price, period, trial length and auto-renew terms shown on the paywall; Terms (EULA) and Privacy links in the paywall and in App Store metadata; Restore button |
| Forced login | 5.1.1 | Login optional; the core flow works signed out |
| Account deletion | 5.1.1(v) | Settings → Delete Account → Edge Function deletes the auth user and their rows |
| Third-party login | 4.8 | Only Sign in with Apple, so compliant automatically |
| Permission strings | 5.1.1 | Clear camera, microphone, Photos (add-only) and speech purpose strings in `app.config.ts` |
| Privacy manifest | — | Expo generates `PrivacyInfo.xcprivacy`; we declare required-reason APIs in config |
| Trademarks | 5.2.5 | Use platform names as plain text ("Optimized for TikTok") and no logos in the icon or screenshots |
| Too thin / wrapper | 4.2 | Not an issue: real native camera and editor |
| Trial abuse / review account | 2.1 | Provide review notes; make sure IAP products are "Ready to Submit" and attached to the first version |

---

## 4. Phased plan (every phase ends installable on your iPhone)

### 4.1 Phone-only workflow (applies to every phase)

1. Claude writes code in a cloud session and pushes to GitHub.
2. An **EAS Workflow** (`.eas/workflows/*.yml`, triggered by a GitHub push through Expo's GitHub integration) runs `eas build --platform ios --profile production` and then `eas submit` to **TestFlight**. You install from the TestFlight app. No CLI is needed on your side.
3. For JavaScript-only changes, **EAS Update** pushes new JS to the installed build over the air in about a minute, with no rebuild. Native rebuilds (new native packages, Swift module changes) happen only a few times per phase.
4. Optional: a **development build** (`expo-dev-client`, internal distribution). Register your iPhone once by opening a link from `eas device:create` in Safari, and turn on Developer Mode in iOS Settings. It loads updates from EAS Update channels. A Metro dev server running in a cloud container generally can't reach your phone, so expect TestFlight + EAS Update to be the main loop.
5. Crash logs: TestFlight → Feedback/Crashes in App Store Connect (works on mobile web). Sentry (`@sentry/react-native`, free tier) is optional from Phase 2.

**One-time setup needed from you:** follow `docs/setup-from-iphone.md`. You connect the GitHub repo to your Expo project and upload an App Store Connect API key to expo.dev, so builds run on EAS without anyone using the CLI. An Expo access token is needed only as a fallback, if Claude must run `eas` from a cloud session (Expo's API host is blocked from this cloud environment by default).

### Phase 0: Skeleton and pipeline (≈1–2 days)
- `create-expo-app` (SDK 58, TypeScript), Expo Router tabs, NativeWind dark theme tokens, app icon placeholder
- `eas.json` (development / preview / production profiles), EAS Workflow build → TestFlight, EAS Update channel
- Bundle ID `com.<you>.onestudio`, App Store Connect app record
- **Test on iPhone:** OneStudio installs from TestFlight and shows the Projects / Settings tabs in dark UI. Push a text change and watch it arrive through EAS Update.
- _Exit criteria:_ the pipeline works end to end from a git push.

### Phase 1: Camera (≈1 week)
- VisionCamera v5 with permissions, 9:16 preview, front/back, tap-to-focus, pinch zoom
- Segmented recording: progress bar with segment markers, undo last segment, max-length caps, haptics, keep-awake
- Safe-zone overlays (TikTok, Reels, Shorts) from `src/lib/platforms.ts`
- Projects saved to SQLite + files; review clips with `expo-video`
- **Spike first:** if VisionCamera v5 fails to build on SDK 58, switch to `expo-camera` (decision within the first day)
- **Test on iPhone:** record 3 segments, undo one, kill the app, reopen, and the project is still there.

### Phase 2: Native video module + export (≈1–1.5 weeks)
_Done before the editor because it's the riskiest piece._
- `modules/onestudio-video`: concatenate clips → 1080p30 H.264 MP4 with progress and cancel
- Watermark compositing (Skia-rendered PNG)
- Save to Photos, share sheet, "Copy Caption & Open App" (caption field on the export screen)
- **Test on iPhone:** record 3 clips, export, the video appears in Photos with the watermark, then share it to TikTok/IG drafts.

### Phase 3: Timeline editor (≈2 weeks)
- Edit decision list model in TypeScript (pure, unit-tested) with zustand undo/redo
- Filmstrip thumbnails, trim handles, split at playhead, drag reorder, delete
- Native preview view playing the composition (matches the export)
- Text overlays: add, edit, drag, time range; rendered via Skia in both preview and export
- **Test on iPhone:** cut a 3-clip project down, add 2 text overlays, and the export matches the preview.

### Phase 4: Monetization and accounts (≈1 week)
- App Store Connect: subscription group, monthly $9.99 and yearly $79.99 products, 7-day free-trial introductory offers
- RevenueCat: products, `pro` entitlement, offering, paywall (`react-native-purchases-ui`)
- Gating: watermark removal and 1080p60 for Pro; Restore; manage-subscription link
- Supabase: project, `profiles` and `projects` tables with RLS, Sign in with Apple, delete-account Edge Function
- **Test on iPhone:** buy in the sandbox (TestFlight purchases are free sandbox purchases), the watermark disappears, restore works, and delete account works.

### Phase 5: Polish and App Store submission (≈1 week)
- Onboarding (3 screens), empty states, error handling, export edge cases (low storage, interruption by a phone call)
- Privacy policy and terms pages (free GitHub Pages site from this repo)
- App Store listing: screenshots taken on your iPhone, description, keywords, privacy "nutrition label", review notes
- Submit for review
- **Test on iPhone:** a full external TestFlight pass with a few creator friends before submitting.

### After v1
- **v1.1:** captions (Apple Speech → whisper.rn if needed), teleprompter, speed
- **v1.2:** voiceover, user-imported music, 4K/60, per-platform caption adaptation
- **v2:** multi-track timeline; direct posting (one platform at a time, starting with YouTube, which has the most predictable API approval)

**Rough total to v1 submission: 6–8 weeks** of build sessions, depending on your testing turnaround.

---

## 5. Costs and accounts

_Prices are from my knowledge as of late 2026. Check each vendor's pricing page before you rely on them._

| Account | Cost | Needed by | Notes |
|---|---|---|---|
| **Apple Developer Program** | **$99/year** | Phase 0 | Enroll as an **Individual** (faster; organization enrollment needs a D-U-N-S number). Can be done in the Apple Developer app on iPhone. Approval can take 1–2 days or more. **Start today.** |
| App Store Connect: **Paid Apps Agreement**, tax and banking | Free | Phase 4 | Required before subscriptions work, even in the sandbox. Do it early; bank verification can take days. |
| App Store **Small Business Program** | Free | Before launch | Apple's commission drops from 30% to 15% (under $1M/yr) |
| **Expo / EAS** | Free tier, then ~$19/mo (Starter) | Phase 0 | The free tier has a limited monthly number of iOS builds and a lower-priority queue. EAS Update is free up to a monthly-active-user limit. Upgrade only if builds become a bottleneck. |
| **GitHub** | Free | Now | You have it (this repo) |
| **Supabase** | Free tier, then $25/mo (Pro) | Phase 4 | Free projects pause after about a week of inactivity, which is fine during development. Go Pro around launch. |
| **RevenueCat** | Free up to ~$2.5k monthly tracked revenue, then ~1% | Phase 4 | |
| Sentry (optional) | Free tier | Phase 2+ | Crash reporting |
| Cloud captions (optional) | ~$0.006/audio-minute | v1.1 only if needed | Not needed if on-device captions are good enough |
| Domain (optional) | ~$12/yr | Phase 5 | GitHub Pages works free without one |
| Direct-posting APIs | X: paid API tier; others free but need approval | v2+ | |

**Minimum spend to ship v1:** $99/year (Apple). Everything else can stay on free tiers until you have paying users.

### What you can do entirely from your iPhone
- ✅ Apple Developer enrollment (Apple Developer app)
- ✅ App Store Connect: app record, subscriptions, agreements, TestFlight, submission (Safari, plus parts in the App Store Connect app)
- ✅ Expo, Supabase, RevenueCat and GitHub accounts and dashboards (Safari)
- ✅ Directing code changes (Claude Code in the Claude app), with builds and submission through EAS Workflows
- ✅ Installing and testing (TestFlight app); sandbox purchases
- ✅ App Store screenshots (taken on device)
- ⚠️ Fiddly but possible: pasting long config values (RevenueCat API key, Supabase URL/keys) into environment settings. Public keys can go in `app.config.ts`. Secret keys go only into EAS / Supabase secret settings.
- ❌ Nothing in this plan requires a Mac. The one thing you lose is live Xcode debugging of the Swift module; build logs, TestFlight crash reports and logging replace it.

---

## 6. Open decisions for you

1. **Camera library:** VisionCamera v5 (recommended) or `expo-camera` (simpler, less control)?
2. **Supabase in v1:** optional Sign in with Apple + metadata sync (as planned), or push Supabase to v1.1 for the smallest first release?
3. **Free-tier limits:** watermark + 1080p30 only, or also a project cap?
4. **Bundle ID / app name availability:** check that "OneStudio" is free in App Store Connect when you create the app record. If it's taken, you'll need a variant like "OneStudio: Creator Video".
