# FragOut mobile

The primary FragOut app for iOS and Android, built with Expo 58 / React Native 0.88. The same code has a browser preview at [localhost:3000/mobile](http://localhost:3000/mobile).

## Use the local preview

Start the backend with the launcher in the parent folder. It serves the exported mobile preview and the desktop companion. The preview has its own session; signing into the same FragOut account links the same collection.

Use **Home** to search your collection, add a fragrance or scan a bottle. Journal and Settings are available in the header.

Confirm the house, release and concentration when you add or scan a bottle. FragDex opens after saving. Tap a bottle in Collection to return to it. Tap a rating or a site link to open the in-app browser. **Sources & credits** lists the references and **Edit bottle** opens your personal notes. Install a new native build to pick up the browser component.

Tap the lightbulb to open **Find a scent**. Search by fragrance, house, note, mood, vibe or occasion. Compact picks sit beneath search. Open **Filters** for mood, vibe and pairing. Pair experiments require explicit selection. **Match outfit** accepts a selfie, another image, typed text or dictation. Wear logs and saved looks keep the choices from their match.

Tap the heart on a layering suggestion to like it. **Liked combos** on Home opens every liked pair, including earlier saves. Tap a filled heart to remove the like.

Colors shift with the season and the device's local time. Choose your hemisphere in **Settings → Conditions**.

Qwen runs through Ollama on the backend computer/server. It has no API fee. Optional OpenAI/Claude API keys belong to each user and are saved encrypted by that backend. Photos go only to the selected destination when analysis is requested. A chat subscription is separate from API access.

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

`eas.json` also includes development, preview APK, and production profiles for a future signed build. No EAS build, app-store submission, Apple/Google account, or paid service was used. Building an APK/IPA needs the appropriate native build tools and signing credentials. Do not commit signing keys.

## Verification commands

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run export:web
npm.cmd run export:native
npx.cmd expo install --check
```

The web export goes to `../public/mobile`; native Hermes code bundles go to `native-dist`. Hermes bundles are inputs to a native build, not installable APK/IPA files. Both platform exports and the browser flow were tested. Physical-device camera, microphone, sharing, secure storage, signing and app-store acceptance remain unverified.

Native session tokens are origin-bound in SecureStore; the browser preview keeps its token in memory. Provider connections currently use encrypted API keys, not OAuth. Session/server changes abort old requests and prevent delayed login/export work from crossing accounts.

Photo archiving is off by default. Selfie app copies are removed on submission; default processing retains no backend image. Bottle photos are removed after label reading, before confirming/adding the bottle. Only app-owned cache copies are deleted; gallery originals remain. Browser Blob URLs are revoked, and startup/session changes sweep orphan app copies. Android backups and iOS file sharing are disabled in the native configuration.

Opt into **Photo privacy → Archive outfit-fragrance looks**, review the outfit, then use **Archive look** on a selected result. Pending photos expire after 15 minutes; explicitly saved photos are encrypted and owner-only under Journal → Saved looks. Turning archiving off deletes saved looks/photos and revokes old in-flight retention consent. Unsaved clothing descriptions and recommendation copies expire after 15 minutes. Cleanup runs on access/startup and every minute while the backend runs. JSON exports exclude photo bytes and provider keys. Model bytes still go to the selected provider; its separate retention policies apply. See the [security assessment](../docs/SECURITY_REPORT.md) for tested behavior and device/provider boundaries.

Primary references: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/), [SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/), [speech recognition package](https://github.com/jamsch/expo-speech-recognition), [local native builds](https://docs.expo.dev/guides/local-app-overview/).
