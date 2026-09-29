#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$root/android/gradlew" -p "$root/android" :app:lintDebug :app:assembleDebug
echo "APK: $root/android/app/build/outputs/apk/debug/app-debug.apk"
