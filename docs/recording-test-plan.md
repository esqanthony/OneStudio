# Recording screen: on-iPhone test plan

The native camera code (Swift) can only be checked on a real iPhone, after an EAS build reaches
TestFlight. Run these in order. If a step fails, note the step number and what you saw (a screenshot
helps), and send it to Claude.

**Which iPhone matters for test C:**
- On an **iPhone 17, 17 Pro, 17 Pro Max or iPhone Air**, 16:9 mode should say *"Full-quality landscape from the front camera"*.
- On any other iPhone, it should say *"Cropped from vertical video, about 1920×1080"* (or a lower number on older phones).

## A. Take-based recording (spec acceptance check 1)
1. Projects → **New recording**. Allow camera and microphone.
2. Tap **16:9**, then record **take 1**: say "one", tap the record button again to pause.
3. Record **take 2** ("two") and **take 3** ("three"). The bar at the top shows three separate blocks.
4. Tap **Delete last**. The third block disappears immediately.
5. Record **take 4** ("four"). Tap **Done**.
6. ✅ A "Joining takes…" progress appears, then the video opens.
7. ✅ It plays "one, two, four" in that order, and the info line says **16:9 landscape**.

## B. Session survives the app closing
1. New recording, record two takes.
2. Swipe the app away from the app switcher.
3. Reopen OneStudio. ✅ Projects shows **Unfinished recording · 2 takes**.
4. Tap **Continue**. ✅ The bar shows the 2 takes; record a third and tap Done. ✅ The video has all three.
5. Bonus: start a take, and while it's recording swipe the app away. Reopen and continue.
   ✅ The cut-off take is kept (minus up to the last 2 seconds).

## C. Landscape while holding the phone upright (spec acceptance check 2)
1. New recording, **16:9**, hold the phone upright, record ~10 seconds, tap Done.
2. ✅ The preview during recording was a wide 16:9 box in the middle of the screen.
3. On the video screen: **Share** → upload to YouTube (or **Save to Photos** and upload from the YouTube app).
4. ✅ YouTube shows it as a normal landscape video, the right way up, with sound.
5. ✅ Try flipping cameras after the first take. On iPhone 17 / Air (front camera) **Flip** is greyed out,
   because the back camera would record differently. On other phones flipping is allowed.

## D. Teleprompter (spec acceptance check 3)
1. On the camera, tap **Script** → **Paste from clipboard** (copy a few paragraphs first), or **New script**.
2. Go back, tap **Use this script**.
3. ✅ In 16:9 the script fills the area **above** the preview, right under the front camera.
   In 9:16 it's a smaller panel at the top of the preview.
4. Start a take, then **swipe the script up and down with your finger while recording**.
   ✅ Recording keeps going (the red block keeps growing) and the script scrolls.
5. Pause, tap **Delete last**. ✅ The script stays at the same line.
6. Tap **Prompter**: change text size, colour, background, line spacing and the reading-line highlight.
   ✅ Changes show on the camera screen straight away.
7. Swipe the app away and reopen → Continue. ✅ The script is at the same line.

## E. Limits and edge cases
1. Tap the **timer** tool until it says **1 min**. ✅ The bar now shows `/ 1:00`.
   Record until it stops by itself. ✅ "Reached the maximum length" appears.
2. While recording, take a phone call or go to the Home Screen. ✅ The take is saved, not lost.
3. Deny camera access (Settings → OneStudio), open the camera. ✅ "Camera access is off" with an
   **Open Settings** button.

## F. Slides in the video
1. Export your deck as images into Photos (Keynote: Share → Export → Images; Google Slides: download each slide).
2. On the camera, tap **Slides** → **Add slides from Photos**, and pick them **in order**.
3. Choose **Corner** or **Large**. Go back. ✅ The first slide shows on the preview where it'll be in the video.
4. Record a take and tap **›** a couple of times while talking. Tap the middle **1 / 5** button to hide the slide, and again to bring it back.
   ✅ Recording keeps going.
5. Record a second take. Delete it. ✅ The slide goes back to the one that was up when that take started.
6. Tap **Done**. ✅ In the video, each slide appears and changes at the moment you tapped.
7. Try **Only me**: ✅ the slide shows on screen with a dashed outline while recording, but not in the finished video.
