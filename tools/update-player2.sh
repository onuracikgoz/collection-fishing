#!/bin/zsh
# Rebuilds the second test player, client/player2.app, from the current code.
# Unity must be closed on this project (batchmode cannot open a project the editor has open);
# with the editor open use the menu CollectionGame > Build Player 2 (macOS) instead.
set -e
cd "$(dirname "$0")/../client"
VERSION=$(grep m_EditorVersion: ProjectSettings/ProjectVersion.txt | awk '{print $2}')
UNITY="/Applications/Unity/Hub/Editor/$VERSION/Unity.app/Contents/MacOS/Unity"
if [ ! -x "$UNITY" ]; then echo "Unity $VERSION bulunamadı: $UNITY"; exit 1; fi
if [ -f Temp/UnityLockfile ] && lsof Temp/UnityLockfile >/dev/null 2>&1; then
  echo "Unity bu projede açık. Unity'de CollectionGame > Build Player 2 (macOS) menüsünü kullan, ya da Unity'yi kapatıp tekrar çalıştır."
  exit 1
fi
echo "player2.app derleniyor (birkaç dakika sürebilir)..."
"$UNITY" -batchmode -quit -projectPath . -executeMethod CollectionGame.EditorTools.BuildTools.BuildPlayer2 -logFile Logs/player2-build.log
echo "Hazır: client/player2.app  (aç: open client/player2.app)"
