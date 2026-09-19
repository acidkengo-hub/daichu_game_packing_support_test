import { useState } from "react";

/**
 * 作業中のメニュー
 *
 * 梱包画面・ピッキング画面のヘッダにある「← 戻る」をタップすると開く。
 *
 * 【なぜ「戻る」に集約したのか】
 * 「便の選択に戻る」「作業者を変更」「担当終了」はどれも画面を離れる操作で、
 * 性質が同じ。ヘッダ上段は既に3要素で埋まっており、
 * ここに足すと窮屈になる（要求仕様 8章「見た目をなるべく変えない」）。
 * また、画面下部の「梱包完了」から最も遠い位置になるため、
 * 既存の「移動と完了の分離」を損なわない。
 *
 * 画面に時間・履歴は一切表示しない（要求仕様 4-2(1)）。
 * 文言も「担当者」「担当終了」で統一し、「計測」「時間」は使わない。
 */

interface Props {
  /** 記録中かどうか。記録していないときは担当者の項目を出さない */
  recording: boolean;
  /** 記録中の担当者名。確認の文面に使う */
  worker: string | null;
  /** 担当終了を出すか。ピッキング画面では出さない（0件では記録が残らないため） */
  showEnd: boolean;
  onBack: () => void;
  onChangeWorker: () => void;
  onEndWork: () => void;
  onClose: () => void;
}

export default function WorkMenuSheet({
  recording,
  worker,
  showEnd,
  onBack,
  onChangeWorker,
  onEndWork,
  onClose,
}: Props) {
  // 担当終了は取り消せないため、確認を挟む（要求仕様 4-2(8)、5章）
  const [confirmEnd, setConfirmEnd] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
      onClick={onClose}
    >
      {/* 中身をタップしたときに閉じないようにする */}
      <div
        className="w-full max-w-[780px] bg-gray-900 text-gray-100 border-t border-gray-700 rounded-t-2xl p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {confirmEnd ? (
          <>
            <p className="text-base font-bold mb-1">担当を終了しますか？</p>
            <p className="text-sm text-gray-400 mb-4">
              {worker ? `${worker}さんの担当分を終了します。` : ""}
              終了は取り消せません
            </p>

            <button
              onClick={onEndWork}
              className="w-full min-h-[64px] bg-red-700 hover:bg-red-600 rounded-xl text-lg font-bold mb-2"
            >
              はい、担当終了する
            </button>
            <button
              onClick={() => setConfirmEnd(false)}
              className="w-full min-h-[56px] bg-gray-800 hover:bg-gray-700 rounded-xl text-base text-gray-300"
            >
              やめる
            </button>
          </>
        ) : (
          <>
            {recording && worker && (
              <p className="text-sm text-gray-400 mb-3">担当者：{worker}</p>
            )}

            <button
              onClick={onBack}
              className="w-full min-h-[64px] bg-gray-800 hover:bg-gray-700 rounded-xl text-base mb-2 text-left px-4"
            >
              <span className="font-bold">← 便の選択に戻る</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                作業の進み具合は保存されます
              </span>
            </button>

            {recording && (
              <button
                onClick={onChangeWorker}
                className="w-full min-h-[64px] bg-gray-800 hover:bg-gray-700 rounded-xl text-base mb-2 text-left px-4"
              >
                <span className="font-bold">👤 担当者を変更</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  別の人に交替するとき、名前を選び間違えたとき
                </span>
              </button>
            )}

            {recording && showEnd && (
              <button
                onClick={() => setConfirmEnd(true)}
                className="w-full min-h-[64px] bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-base mb-2 text-left px-4"
              >
                <span className="font-bold">✓ 担当終了</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  自分の担当分が終わったとき
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full min-h-[56px] text-base text-gray-400 hover:text-white"
            >
              キャンセル
            </button>
          </>
        )}
      </div>
    </div>
  );
}