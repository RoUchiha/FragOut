# FragOut mobile

The primary FragOut app for iOS and Android, built with Expo 58 / React Native 0.88. The same code has a browser preview at [localhost:3000/mobile](http://localhost:3000/mobile).

## Use the local preview

Start the backend with the launcher in the parent folder. It serves the exported mobile preview and the desktop companion. The preview has its own session; signing into the same FragOut account links the same collection.

Today, outfit matching, collection, bottle label suggestions, pairing, journal, account settings, export and provider connections are implemented. Take an outfit selfie, choose an image, type, or use dictation. Review the description, choose an occasion, then request a fragrance, pair, or both. Detailed clothing edits are optional. Pair experiments require explicit selection.

Qwen runs through Ollama on the backend computer/server. It has no API fee. Optional OpenAI/Claude API keys belong to each user and are saved encrypted by that backend. Photos go only to the selected destination when analysis is requested. A chat subscription is separate from API access.

## Run on a phone

```powershell
# In this folder, with Node 24+:
npm.cmd ci
# Set to an HTTPS FragOut backend you control, or a private LAN address for development:
$env:EXPO_PUBLIC_API_URL='https://your-fragout-server.example'
npm.cmd start
```

The computer's `localhost` is not the phone's `localhost`. The supplied backend launcher listens only on loopback. For local phone development, run the backend explicitly on the LAN with `npx.cmd next dev --hostname 0.0.0.0 --port 3000` from the parent folder, then use its private IP address. Keep this on a trusted development network. Release builds require HTTPS; broad cleartext exceptions are not enabled. Remote key entry always requires HTTPS. Keys can also be connected by signing into the mobile preview on the backend computer.

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

The native session token uses SecureStore; the browser preview keeps its token in memory. Neither carries provider secrets. Temporary picker copies are cleared when discarded or a screen closes, with OS cache cleanup as a fallback. User originals in the photo library are not deleted. Server-side image resizing strips metadata; raw photos are not saved to the database. Structured descriptions expire after 24 hours and are purged on the next API activity or startup. Provider processing/retention follows that provider's policies.

Primary references: [Expo SDK](https://docs.expo.dev/versions/latest/), [ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [speech recognition package](https://github.com/jamsch/expo-speech-recognition), [local native builds](https://docs.expo.dev/guides/local-app-overview/).
