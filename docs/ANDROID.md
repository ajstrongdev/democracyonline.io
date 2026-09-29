# Oscana on Android

This is a native server picker and a full-screen in-app game view powered by Android WebView. It does not bundle the game or maintain a separate copy of game data. The official `https://oscana.nya.je` server is always listed first; add other **HTTPS origins** with **Add server**. Added servers are stored on the phone. Tap a server to open it. Android Back moves through the page's history, then returns to the picker; tapping the Oscana launcher icon again also returns to the picker. Removing a server removes it from the picker, **not** from WebView's site data.

The game occupies the app's content area without a browser toolbar; the Android status/navigation bars remain. WebView requires the phone's Android System WebView provider, but does not require Chrome or Digital Asset Links verification. Navigation to a different origin opens in an external app rather than silently replacing the chosen server. Logins and browser storage are scoped by origin **inside WebView** and are separate from Chrome/Vanadium's site data. Switching servers does not sign out of the other instance. Only add instances you trust to run inside this app; do not enter passwords into unfamiliar servers.

**Notifications are not supported in this version.** Android WebView does not provide the existing browser Web Push/PushManager flow, so website notification opt-in and delivery will not work in the embedded view. A follow-up needs native push (such as FCM) plus server-side registration, routing, and notification tap handling. The website still supports Web Push when opened in a supported browser.

## Build and install a test APK

Install JDK 17 and the Android SDK with **Android SDK Platform 35** and **Build Tools 35.0.0** (Android Studio's SDK Manager can install both). If you installed Platform 36 for the earlier browser-based launcher, you can leave it installed, but Platform 35 is needed for this build. Set `ANDROID_HOME` to the SDK directory or create an untracked `android/local.properties` with `sdk.dir=/absolute/path/to/Android/Sdk`. Ensure `java` is on PATH. The checked-in Gradle wrapper downloads Gradle on first run; internet access is required for Android build tooling.

From the repository root:

```sh
pnpm android:build
```

The script runs Android lint and assembles `android/app/build/outputs/apk/debug/app-debug.apk`. It does **not** run the web app build or connect to a database. To install it:

- **USB:** Enable Developer options and USB debugging on the phone, install Android Platform Tools, connect the phone, authorize the computer, then run `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
- **Without USB:** Transfer that APK to your phone (for example, by file transfer), open it in the phone's Files app, and allow installation from that source when Android asks. Do not install APKs from untrusted sources.

GitHub Actions **Android APK** runs the same command on Android-related pushes/PRs (or manually via workflow dispatch) and uploads a downloadable `oscana-android-debug-apk` artifact. Download and extract the artifact ZIP before installing. Each CI runner generates its own **debug signing key**. A CI debug APK is for testing only; another CI run may not update an already installed build without uninstalling it, and uninstalling clears the app's saved server list and WebView data. For a distributable build, configure a stable private release signing key and build a signed release APK or AAB; never commit the keystore or its passwords.

## Practical limitations

The server must be online; no offline copy is bundled. Links outside the selected server open in another app. Native Push and notification tap-through are follow-up work. Before distributing, check sign-in, navigation, and server switching on a phone with an up-to-date Android System WebView. A web manifest at `/manifest.webmanifest` is for the standalone browser experience and is not used by this Android app.
