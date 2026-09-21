#!/bin/bash
# ==========================================================================
# 產生所有畫面的縮圖，給全景圖與變體比較頁使用。
#
# 為什麼不用 iframe：全景圖有 36 張畫面、變體頁有 15 格，用 iframe 會變成
# 五十幾個 iframe、將近五百個子資源請求。載入慢、常常有幾格還沒畫完就被
# 看到空白，在比賽現場的筆電上更不可靠。
#
# 縮圖改成預先產生的 PNG，載入是瞬間的，而且不會有「某幾格沒渲染」的問題。
# 代價是畫面改了要重跑這支腳本 —— 這就是重跑的方式：
#
#   bash prototype/tools/shoot.sh
#
# 需要 Chrome 或 Edge。
# ==========================================================================

set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd -W 2>/dev/null || pwd)"

CHROME=""
for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
         "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
         "$(command -v google-chrome 2>/dev/null)" \
         "$(command -v chromium 2>/dev/null)"; do
  [ -n "$c" ] && [ -x "$c" ] && CHROME="$c" && break
done
if [ -z "$CHROME" ]; then
  echo "找不到 Chrome 或 Edge，無法產生縮圖。"
  exit 1
fi

OUT="assets/thumbs"
mkdir -p "$OUT"

# 畫面清單：檔名[:查詢字串:輸出名]
SHOTS="
home
drawer
pickup
outofarea
ride
ride-done
notify
ridesettings
points
trips
export
payment
coupon
tasks
support
shop
invite
explore
map
place
place?id=neiwan:place-far
going
routes
route
fogmap
album
unlock
unlock?ride=1:unlock-ride
postcard
badge
lookback
week
elder
settings
push
push?when=night:push-night
variant-a-map
variant-a-map?mode=been:variant-a-map-been
variant-b-explore
variant-c-album
variant-a-album
variant-b-album
lookback?still=1:lookback
"

n=0
for entry in $SHOTS; do
  [ -z "$entry" ] && continue
  case "$entry" in
    *:*) url="${entry%%:*}"; name="${entry##*:}" ;;
    *)   url="$entry";       name="${entry%%\?*}" ;;
  esac

  # 補上 .html：清單裡寫的是畫面名，查詢字串要接在副檔名後面
  case "$url" in
    *\?*) file="${url%%\?*}.html?${url#*\?}" ;;
    *)    file="$url.html" ;;
  esac

  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --window-size=430,912 \
    --virtual-time-budget=4500 --default-background-color=00000000 \
    --screenshot="$ROOT/$OUT/$name.png" \
    "file:///$ROOT/screens/$file" >/dev/null 2>&1

  if [ -f "$OUT/$name.png" ]; then
    n=$((n+1)); printf '.'
  else
    printf '\n  失敗：%s\n' "$url"
  fi
done

echo ""
echo "完成：$n 張縮圖 → prototype/$OUT/"
