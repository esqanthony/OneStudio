# Getting OneStudio onto your iPhone (no Mac)

This is a one-time setup. Everything happens in Safari or in apps on your iPhone. After it's done:
- **Native changes:** every merge to `main` builds the app in the cloud and sends it to TestFlight automatically.
- **JS-only changes:** they arrive as over-the-air updates. Open the app, go to **Settings**, and tap **Check for update**.

> Apple and Expo rename menus often. If a label below doesn't match exactly, look for the closest one,
> or tell Claude what you see on screen.

## What you'll send back to Claude
None of these are secrets, so it's fine to paste them in chat:
1. Your **Expo username**
2. The **EAS project ID** (a UUID)
3. The **App Store Connect app ID**, a number like `6741234567` ("Apple ID" on the app's App Information page)
4. Confirmation of the **bundle ID**. The default is `com.esqanthony.onestudio`; tell Claude if you want a different one.

**Never paste these into chat:**
- the App Store Connect API key file (`.p8`)
- any password
- any access token

---

## Step 1: Apple Developer Program ($99/yr)
1. Install the **Apple Developer** app → **Account** → **Enroll**. Choose **Individual**.
2. Wait for the approval email. It can take a day or more.

Steps 3–5 need this approval. Steps 2 and 6 don't.

## Step 2: Expo project (free)
1. In Safari, go to **expo.dev** and sign up or sign in.
2. **Create a project** named `onestudio`.
3. Copy the **Project ID** and your **username**, and send both to Claude. Claude puts them in `app.config.ts`.

## Step 3: Register the bundle ID
1. In Safari, go to **developer.apple.com/account**.
2. Open **Certificates, Identifiers & Profiles** → **Identifiers** → **+** → **App IDs** → **App**.
3. Description: `OneStudio`. Bundle ID: **Explicit**, `com.esqanthony.onestudio`.
4. Capabilities: leave the defaults. Sign in with Apple gets added in Phase 4.
5. Save.

## Step 4: Create the app in App Store Connect
1. In Safari, go to **appstoreconnect.apple.com** (desktop-site mode is easier for this).
2. **Apps** → **+** → **New App**.
   - **Platform:** iOS
   - **Name:** OneStudio. App names are unique across the App Store. If it's taken, try something like "OneStudio: Creator Video".
   - **Language:** your language
   - **Bundle ID:** the one from Step 3
   - **SKU:** `onestudio`
3. Open the app → **App Information**. Copy the **Apple ID** number and send it to Claude.
4. Also: **Business** (or **Agreements, Tax, and Banking**) → accept the **Paid Apps** agreement and fill in tax and banking.
   - You don't need it until Phase 4 (subscriptions), but bank verification can take days, so start now.

## Step 5: App Store Connect API key, uploaded to Expo
This key lets EAS create your signing certificate and provisioning profile and upload builds to TestFlight. It replaces what Xcode would do on a Mac.

1. In App Store Connect, go to **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+**.
2. Name: `EAS`. Access: **Admin**. Generate it.
3. Note the **Key ID** and the **Issuer ID** shown above the list.
4. **Download** the `.p8` file to the Files app. Apple lets you download it **only once**.
5. On **expo.dev**, open your account's or project's **Credentials** page → **iOS** → add an **App Store Connect API Key**. Upload the `.p8` and enter the Key ID and Issuer ID.

## Step 6: Connect GitHub to Expo
1. On **expo.dev**, open the `onestudio` project → **Project settings** → **GitHub**.
2. Install the Expo GitHub app and connect the repository **esqanthony/OneStudio**.

From now on, pushes to `main` run the workflows in `.eas/workflows/`:

| Workflow | When it runs | What it does |
|---|---|---|
| `testflight.yml` | Native files change | Build → submit to TestFlight |
| `update.yml` | Every push to `main` | Publish an over-the-air update |

## Step 7: First build
1. When Claude has filled in the IDs, merge the pull request into `main` in the GitHub app.
2. On **expo.dev** → project → **Workflows**, watch the build. It takes about 15–25 minutes.
3. After submission, Apple processes the build for another 10–30 minutes.
4. In App Store Connect → your app → **TestFlight**, add yourself under **Internal Testing**.
5. Install the **TestFlight** app on your iPhone and tap **Install** on OneStudio.

**If the first build fails at the credentials step:** send Claude the log text from expo.dev (not the key itself). The fallback is a one-time credentials setup that Claude runs from a cloud session. That needs an Expo access token, which you'd save as a secret in the environment settings, never in chat.

## Step 8: Check it works (Phase 0 done)
- [ ] OneStudio opens to a black screen titled **Projects**, with a record-button graphic and a greyed-out **New project** button.
- [ ] The **Settings** tab shows Version `0.1.0`, a build number, and Update channel `production`.
- [ ] After Claude pushes a small text change to `main` and the update workflow finishes, tapping **Check for update** reloads the app with the change. "Running" then says `Update …` instead of `Built-in code`.
