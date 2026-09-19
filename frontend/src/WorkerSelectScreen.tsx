import { useEffect, useState } from "react";
import { fetchWorkers } from "./workLogQueue";

/**
 * 担当者を選んで作業を開始する画面
 *
 * 既存の流れ（便 → 配送方法）の直後に挟む。
 * 開始を押さなければ作業に入れない構成にすることで、
 * 記録漏れが起きないようにする（要求仕様 8章）。
 *
 * 画面に時間・履歴は一切表示しない（要求仕様 4-2(1)）。
 * 文言も「担当者」「作業開始」で統一し、「計測」「時間」は使わない。
 */

interface Props {
  /** 表示用の便の名前（例: 午前便） */
  binLabel: string;
  /** 表示用の配送方法の名前（例: ヤマト宅急便） */
  carrierLabel: string;
  /** 件数。既存の配送方法選択画面と同じ情報を出して、迷わせない */
  orderCount: number;
  /** ピッキングの種類数。ピッキングから始める選択肢に添える */
  pickingCount: number;
  /** 前回この端末で選ばれた担当者。初期選択に使う */
  lastWorker: string | null;
  /**
   * 作業中の担当者変更として使うか。
   * true なら開始方法（ピッキング／梱包）を選ばせず、名前を選んだ時点で確定する。
   * 作業はすでに始まっているため、開始方法を選び直す意味がない。
   */
  changeMode?: boolean;
  onStart: (worker: string, fromPicking: boolean) => void;
  onBack: () => void;
}
export default function WorkerSelectScreen({
  binLabel,
  carrierLabel,
  orderCount,
  pickingCount,
  lastWorker,
  changeMode = false,
  onStart,
  onBack,
}: Props) {
  const [workers, setWorkers] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(lastWorker);

  useEffect(() => {
    void fetchWorkers().then((list) => {
      setWorkers(list ?? []);

      // 前回の担当者が一覧から消えていたら、選択を外す。
      // 消えた人の名前で記録が残るのを防ぐ。
      if (lastWorker && list && !list.includes(lastWorker)) {
        setSelected(null);
      }
    });
  }, [lastWorker]);

  // 一覧を読み込むまでは開始させない。
  // 前回の担当者を初期選択にしているため、
  // 読み込み前でも selected に値が入っている。
  // そのまま開始すると、一覧から消えた人の名前で記録が始まりうる。
  const canStart = selected !== null && workers !== null && workers.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="max-w-[780px] mx-auto">
        {/* ヘッダ。既存画面と同じ形にする */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-400 hover:text-white min-h-[48px]"
          >
            ← 戻る
          </button>
          <div className="text-center">
            <p className="text-sm text-gray-400">{binLabel}</p>
            <p className="text-base font-bold">{carrierLabel}</p>
          </div>
          <div className="w-[88px]" />
        </div>

        {/* 担当者 */}
        <p className="text-base font-bold mb-3">
          {changeMode ? "新しい担当者を選んでください" : "担当者を選んでください"}
        </p>

        {workers === null && (
          <p className="text-sm text-gray-500 mb-6">読み込んでいます…</p>
        )}

        {workers !== null && workers.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-300">
              担当者の一覧を読み込めませんでした
            </p>
            <p className="text-xs text-gray-500 mt-1">
              通信の状態を確認するか、設定画面から担当者を追加してください
            </p>
          </div>
        )}

        {workers !== null && workers.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-8">
            {workers.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setSelected(name);
                  // 変更のときは、選んだ時点で確定する。
                  // 開始方法を選び直す必要がないため。
                  if (changeMode) onStart(name, false);
                }}
                className={`rounded-xl border-2 py-4 min-h-[72px] text-lg font-bold transition-colors ${
                  selected === name
                    ? "bg-emerald-700 border-emerald-500 text-white"
                    : "bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-600"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* 作業開始。担当者を選ぶまで押せない。変更のときは出さない */}
        <div className={`space-y-3 ${changeMode ? "hidden" : ""}`}>
          <button
            onClick={() => selected && onStart(selected, true)}
            disabled={!canStart}
            className="w-full rounded-xl border-2 border-emerald-600 bg-emerald-800 hover:bg-emerald-700 disabled:bg-gray-900 disabled:border-gray-800 disabled:text-gray-600 py-5 min-h-[88px]"
          >
            <span className="block text-lg font-bold">
              📋 ピッキングから作業開始
            </span>
            <span className="block text-sm text-gray-300 mt-1">
              棚から商品を集めてから梱包する（{pickingCount}種）
            </span>
          </button>

          <button
            onClick={() => selected && onStart(selected, false)}
            disabled={!canStart}
            className="w-full rounded-xl border-2 border-blue-600 bg-blue-900 hover:bg-blue-800 disabled:bg-gray-900 disabled:border-gray-800 disabled:text-gray-600 py-5 min-h-[88px]"
          >
            <span className="block text-lg font-bold">
              📦 梱包から作業開始
            </span>
            <span className="block text-sm text-gray-300 mt-1">
              ピッキングを省略して梱包する（{orderCount}件）
            </span>
          </button>
        </div>

        {!canStart && !changeMode && workers !== null && workers.length > 0 && (
          <p className="text-sm text-gray-500 text-center mt-4">
            担当者を選ぶと開始できます
          </p>
        )}
      </div>
    </div>
  );
}