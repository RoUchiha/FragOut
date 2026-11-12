# FragOut mobile

The primary FragOut app for iOS and Android, built with Expo 58 / React Native 0.88. The same code has a browser preview at [localhost:3000/mobile](http://localhost:3000/mobile).

## Use the local preview

Start the backend with the launcher in the parent folder. It serves the exported mobile preview and the desktop companion. The preview has its own session; signing into the same FragOut account links the same collection.

Use **Home** to search your collection, add a fragrance or scan a bottle. Journal and Settings are available in the header.

Confirm the house, release and concentration when you add or scan a bottle. FragDex opens after saving. Tap a bottle in Collection to return to it. Tap a rating or a site link to open the in-app browser. **Sources & credits** lists the references and **Edit bottle** opens your personal notes. Install a new native build to pick up the browser component.

Tap the lightbulb to open **Find a scent**. Search by fragrance, house, note, mood, vibe or occasion. Compact picks sit beneath search. Open **Filters** for mood, vibe and pairing. Pair experiments require explicit selection. **Match outfit** accepts a selfie, another image, typed text or dictation. Wear logs and saved looks keep the choices from their match.

Tap the heart on a layering suggestion to like it. **Liked combos** on Home opens every liked pair, including earlier saves. Tap a filled heart to remove the like.

Colors shift with the season and the device's local time. Choose your hemisphere in **Settings → Conditions**.

Qwen runs through Ollama on the backend. It has no API fee. The backend encrypts each user's OpenAI or Anthropic API key. Cloud analysis names the provider and the inputs it will receive before the user sends them.

## Run on a phone

```powershell
# In this folder, with Node 24+:
npm.cmd ci
# Set to an HTTPS FragOut backend you control, or a private LAN address for development:
$env:EXPO_PUBLIC_API_URL='https://your-fragout-server.example'
npm.cmd start
```

The computer's `localhost` is not the phone's `localhost`. The supplied backend launcher listens only on loopback. Production native builds need an HTTPS server address; an unset address opens the connection screen. The browser preview always uses its document origin.

For local phone development only, set the backend's `FRAGOUT_PUBLIC_ORIGIN` to its exact private LAN origin (for example `http://192.168.1.8:3000`), set `FRAGOUT_ALLOW_LAN_HTTP=true`, and run `npx.cmd next dev --hostname 0.0.0.0 --port 3000` from the parent folder. Set the mobile development build's `EXPO_PUBLIC_API_URL` to that same origin. The exception requires development mode on both sides; release builds reject plaintext LAN connections. Use a trusted development network. Remote key entry always requires HTTPS. Keys can also be connected by signing into the mobile preview on the backend computer. A hosted server needs an explicit HTTPS public origin, persistent private disk and a trusted proxy that sanitizes forwarded headers.

For the dedicated Dictate button, use a development/production native build. `expo-speech-recognition` is not included in Expo Go. The keyboard microphone remains a fallback. Speech recognition uses the phone's OS service, whose processing and availability depend on device settings. FragOut receives transcribed text, not a recorded audio upload. Camera and speech permissions are requested only when used. On the web, camera/dictation depend on browser support and permission.

To compile native development builds with the platform tools installed:

```powershell
npx.cmd expo run:android
# On macOS with Xcode:
npx.cmd expo run:ios
```

## Store builds

Both platforms use `app.fragout.mobile`. The Expo SDK 58 build profiles support Android 7+ and iOS 16.4+. The production Android profile creates a Play App Bundle. The iOS profile uses the matching macOS/Xcode image for App Store builds. [Expo platform support](https://docs.expo.dev/versions/v58.0.0/) · [Expo build images](https://docs.expo.dev/build-reference/infrastructure/)

Connect the Expo project to the owner's account and set `EXPO_PUBLIC_API_URL` in the EAS production environment to the live HTTPS backend. On that backend, configure `FRAGOUT_PUBLIC_ORIGIN` and a real `FRAGOUT_PRIVACY_CONTACT_EMAIL`. Use its `/privacy` and `/delete-account` addresses in the store listings. Keep the backend reachable during app review.

From this folder, use the Android preview profile for an installable test APK and the production profile for store signing.

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest build --platform android --profile preview
npx.cmd eas-cli@latest build --platform all --profile production
```

Store signing uses the app's Google Play upload key and the owner's Apple distribution credentials. Store submission follows device testing and review of the listings' privacy disclosures. [Google Play signing](https://developer.android.com/studio/publish/app-signing) · [Expo iOS release builds](https://docs.expo.dev/submit/ios/)

## Mobile banners

Home has one inline adaptive banner below the collection. To place it on another native screen, import `AdBanner` from `src/ads` and add `<AdBanner />` inside the app's `AdsProvider`. Pass `gutter` for horizontal padding and `maxWidth` for a narrower container. An empty slot takes up zero space and receives no touches or accessibility focus. Leave space between a loaded banner and nearby buttons.

For live ads, set the two public AdMob IDs for each platform you want to enable. `.env.example` lists the four variables. In EAS, put them in the environment for the build profile and rebuild the native app. Each platform can be enabled independently. Publish the applicable consent messages in AdMob Privacy & messaging. FragOut uses Google UMP before requesting non-personalized ads and shows **Ad privacy** in Settings when Google requires it. Verify your publisher's `app-ads.txt` at the root of the developer website listed in the stores. [Google UMP](https://developers.google.com/admob/android/privacy) · [AdMob app verification](https://support.google.com/admob/answer/14538460)

Set `FRAGOUT_ADS_TEST_MODE=true` in a local or preview build to use Google's sample ads without a publisher account. For local Android testing, set the variable before running `npx.cmd expo prebuild --clean --platform android` and `npx.cmd expo run:android`. On macOS use the corresponding iOS commands. Ads require a native build. For a store build with ads enabled, update the Play Console ads declaration and the stores' data disclosures. [Google test ads](https://developers.google.com/admob/android/test-ads) · [Play disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure) · [App Store disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure)

## Verification commands

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run export:web
npm.cmd run export:native
npx.cmd expo install --check
npx.cmd expo-doctor@latest
```

The web export goes to `../public/mobile`. Android and iOS Hermes bundles go to `native-dist` for use by the native builds. Check camera, dictation, secure storage, sharing, and account deletion on signed device builds before submission.

Native session tokens are origin-bound in SecureStore; the browser preview keeps its token in memory. Provider connections currently use encrypted API keys, not OAuth. Session/server changes abort old requests and prevent delayed login/export work from crossing accounts.

Photo archiving is off by default. Selfie app copies are removed on submission; default processing retains no backend image. Bottle photos are removed after label reading, before confirming/adding the bottle. Only app-owned cache copies are deleted; gallery originals remain. Browser Blob URLs are revoked, and startup/session changes sweep orphan app copies. Android backups and iOS file sharing are disabled in the native configuration.

Opt into **Photo privacy → Archive outfit-fragrance looks**, review the outfit, then use **Archive look** on a selected result. Pending photos expire after 15 minutes; explicitly saved photos are encrypted and owner-only under Journal → Saved looks. Turning archiving off deletes saved looks/photos and revokes old in-flight retention consent. Unsaved clothing descriptions and recommendation copies expire after 15 minutes. Cleanup runs on access/startup and every minute while the backend runs. JSON exports exclude photo bytes and provider keys. Model bytes still go to the selected provider; its separate retention policies apply. See the [security assessment](../docs/SECURITY_REPORT.md) for tested behavior and device/provider boundaries.

Primary references: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [speech recognition package](https://github.com/jamsch/expo-speech-recognition), [local native builds](https://docs.expo.dev/guides/local-app-overview/).
