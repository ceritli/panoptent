#!/bin/sh
# Chrome eklentisini paketler / Packages the Chrome extension.
# Ortak seçim katmanını (media/overlay.js) kopyalar ve panoptent-chrome-<sürüm>.zip oluşturur.
set -e
cd "$(dirname "$0")"
cp ../media/overlay.js overlay.js
cp ../media/i18n.js i18n.js
VER=$(node -p "require('./manifest.json').version")
OUT="../panoptent-chrome-$VER.zip"
rm -f "$OUT"
zip -qr "$OUT" manifest.json background.js content.js i18n.js overlay.js popup.html popup.js icons
echo "panoptent-chrome-$VER.zip"
