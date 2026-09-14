#!/bin/bash
# 梱包作業記録API の動作確認
#
# 使い方:
#   export URL='（デプロイのウェブアプリURL）'
#   read -s "KEY?登録キー: "; echo    # zsh の場合
#   bash gas/test.sh
#
# 事前に、スプレッドシートの 伝票_YYYY-MM / 作業記録_YYYY-MM タブを削除し、
# _受信ID の2行目以降を空にしておくこと。

set -u

if [ -z "${URL:-}" ]; then echo "URL が未設定です"; exit 1; fi
if [ -z "${KEY:-}" ]; then echo "KEY が未設定です"; exit 1; fi

D=$(date +%F)

send() {
  echo "--- $1 ---"
  curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
    --data-binary "$2" "$URL" | head -c 300
  echo
  sleep 1
}

send "テスト4: 伝票1件を記録" \
  "{\"key\":\"$KEY\",\"action\":\"log\",\"events\":[{\"type\":\"slip\",\"id\":\"test-001\",\"date\":\"$D\",\"bin\":\"午前便\",\"carrier\":\"宅急便\",\"worker\":\"半田\",\"orderId\":\"00089769\",\"items\":[\"PS2薄型 すぐ遊べるセット\",\"メモリーカード\"],\"doneAt\":\"${D}T10:05:12+09:00\",\"startedAt\":\"${D}T10:00:00+09:00\",\"durationSec\":312}]}"

send "テスト5: 同じものを再送（二重記録されないこと）" \
  "{\"key\":\"$KEY\",\"action\":\"log\",\"events\":[{\"type\":\"slip\",\"id\":\"test-001\",\"date\":\"$D\",\"bin\":\"午前便\",\"carrier\":\"宅急便\",\"worker\":\"半田\",\"orderId\":\"00089769\",\"items\":[\"PS2薄型 すぐ遊べるセット\",\"メモリーカード\"],\"doneAt\":\"${D}T10:05:12+09:00\",\"startedAt\":\"${D}T10:00:00+09:00\",\"durationSec\":312}]}"

send "テスト6-1: 取り消し" \
  "{\"key\":\"$KEY\",\"action\":\"log\",\"events\":[{\"type\":\"cancel\",\"id\":\"test-c01\",\"date\":\"$D\",\"bin\":\"午前便\",\"carrier\":\"宅急便\",\"worker\":\"半田\",\"slipId\":\"test-001\"}]}"

send "テスト6-2: 再完了" \
  "{\"key\":\"$KEY\",\"action\":\"log\",\"events\":[{\"type\":\"slip\",\"id\":\"test-002\",\"date\":\"$D\",\"bin\":\"午前便\",\"carrier\":\"宅急便\",\"worker\":\"半田\",\"orderId\":\"00089769\",\"items\":[\"PS2薄型 すぐ遊べるセット\",\"メモリーカード\"],\"doneAt\":\"${D}T10:09:00+09:00\",\"startedAt\":\"${D}T10:00:00+09:00\",\"durationSec\":120}]}"

send "テスト7-1: 担当終了（ピッキングはスキップ）" \
  "{\"key\":\"$KEY\",\"action\":\"log\",\"events\":[{\"type\":\"session\",\"id\":\"test-s01\",\"date\":\"$D\",\"bin\":\"午前便\",\"carrier\":\"宅急便\",\"worker\":\"半田\",\"startedAt\":\"${D}T10:00:00+09:00\",\"endedAt\":\"${D}T10:40:00+09:00\",\"endKind\":\"担当終了\",\"picking\":\"スキップ\",\"pickingSec\":180}]}"

send "テスト7-2: 再開して1件、全完了（ピッキングあり）" \
  "{\"key\":\"$KEY\",\"action\":\"log\",\"events\":[{\"type\":\"slip\",\"id\":\"test-003\",\"date\":\"$D\",\"bin\":\"午前便\",\"carrier\":\"宅急便\",\"worker\":\"半田\",\"orderId\":\"00089770\",\"items\":[\"3DS本体(ブラック)\"],\"doneAt\":\"${D}T13:10:00+09:00\",\"startedAt\":\"${D}T13:00:00+09:00\",\"durationSec\":240},{\"type\":\"session\",\"id\":\"test-s02\",\"date\":\"$D\",\"bin\":\"午前便\",\"carrier\":\"宅急便\",\"worker\":\"半田\",\"startedAt\":\"${D}T13:00:00+09:00\",\"endedAt\":\"${D}T13:10:00+09:00\",\"endKind\":\"全完了\",\"picking\":\"あり\",\"pickingSec\":120}]}"

echo "=== 完了。スプレッドシートを確認してください ==="