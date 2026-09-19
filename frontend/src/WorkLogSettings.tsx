import { useCallback, useEffect, useState } from "react";
import {
  loadConfig,
  saveConfig,
  pendingCount,
  fetchWorkers,
  addWorker,
  removeWorker,
  testConnection,
  testKey,
  type QueueConfig,
} from "./workLogQueue";

/**
 * 作業記録の設定
 *
 * 既存の設定画面のいちばん下に置く。
 * 上や途中に挟むと既存項目の位置がずれ、現場が戸惑うため
 * （要求仕様 8章「既存ツールと見た目をなるべく変えない」）。
 *
 * 画面の文言に「計測」「時間」は使わない。
 * 担当記録として自然な言葉にする（要求仕様 4-2(1)）。
 */

/**
 * 送信先の設定を開くための暗証番号。
 *
 * これは秘密ではなく「誤操作を防ぐ仕切り」。
 * localStorage を見れば読めるため、悪意ある人は止められない。
 * 本当の守りは登録キーが担う。
 *
 * 作業者の追加・削除には暗証番号をかけていない。
 * 人の入れ替わりのたびに必要になる操作で、
 * ここを塞ぐと辻川さんの不在時に誰も追加できなくなるため。
 */
const ADMIN_PIN = "2334";

export default function WorkLogSettings() {
  const [config, setConfig] = useState<QueueConfig | null>(null);
  const [workers, setWorkers] = useState<string[]>([]);
  const [pending, setPending] = useState(0);

  // 送信先の設定の開閉と暗証番号
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // 入力中の値。保存するまで反映しない
  const [urlInput, setUrlInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // 作業者の追加・削除
  const [newWorker, setNewWorker] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // ============================================================
  // 読み込み
  // ============================================================

  useEffect(() => {
    const c = loadConfig();
    setConfig(c);
    setUrlInput(c?.url ?? "");
    setKeyInput(c?.key ?? "");
    setPending(pendingCount());

    if (c) {
      void fetchWorkers().then((list) => {
        if (list) setWorkers(list);
      });
    }
  }, []);

  // 未送信の件数は、送信が進むと減る。開いている間は定期的に見直す。
  useEffect(() => {
    const timer = setInterval(() => setPending(pendingCount()), 3000);
    return () => clearInterval(timer);
  }, []);

  // ============================================================
  // 暗証番号
  // ============================================================

  const handlePin = useCallback((value: string) => {
    setPinInput(value);
    setPinError(false);

    if (value.length === 4) {
      if (value === ADMIN_PIN) {
        setUnlocked(true);
        setPinInput("");
      } else {
        setPinError(true);
        setPinInput("");
      }
    }
  }, []);

  // ============================================================
  // 送信先の設定
  // ============================================================

  const handleSaveConfig = useCallback(() => {
    const url = urlInput.trim();
    const key = keyInput.trim();

    if (!url || !key) {
      setTestResult("URLと登録キーの両方を入力してください");
      return;
    }

    const next = { url, key };
    saveConfig(next);
    setConfig(next);
    setTestResult("保存しました");

    void fetchWorkers().then((list) => {
      if (list) setWorkers(list);
    });
  }, [urlInput, keyInput]);

  const handleTest = useCallback(async () => {
    const url = urlInput.trim();
    const key = keyInput.trim();
    if (!url || !key) {
      setTestResult("URLと登録キーの両方を入力してください");
      return;
    }

    setTesting(true);
    setTestResult("確認しています…");

    // まず GET でつながるかを見る。
    // つながらないのにキーを試すと、原因が分からなくなる。
    const conn = await testConnection({ url, key });
    if (!conn.ok) {
      setTestResult(conn.message);
      setTesting(false);
      return;
    }

    // 次に登録キーを確かめる。
    // 書き込みの応答は読めないため、実際に書いてみて判定する。
    const keyResult = await testKey({ url, key });
    setTestResult(`${conn.message} / ${keyResult.message}`);
    setTesting(false);

    const list = await fetchWorkers();
    if (list) setWorkers(list);
  }, [urlInput, keyInput]);

  // ============================================================
  // 作業者
  // ============================================================

  const handleAddWorker = useCallback(async () => {
    const name = newWorker.trim();
    if (!name || busy) return;

    setBusy(true);
    const list = await addWorker(name);
    setBusy(false);

    if (list) {
      setWorkers(list);
      setNewWorker("");
    } else {
      alert(
        "追加できませんでした。\n" +
          "通信の状態と、送信先の設定を確認してください。"
      );
    }
  }, [newWorker, busy]);

  const handleRemoveWorker = useCallback(
    async (name: string) => {
      if (busy) return;

      setBusy(true);
      const list = await removeWorker(name);
      setBusy(false);
      setConfirmRemove(null);

      if (list) {
        setWorkers(list);
      } else {
        alert("削除できませんでした。通信の状態を確認してください。");
      }
    },
    [busy]
  );

  // ============================================================
  // 表示
  // ============================================================

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <p className="text-sm text-gray-400 mb-3">作業記録</p>

      {/* 未送信。0件が常態なので、あるときだけ出す */}
      {pending > 0 && (
        <div className="bg-amber-900/30 border border-amber-800 rounded-lg px-3 py-2 mb-3">
          <p className="text-sm text-amber-300">
            未送信 {pending} 件（通信が戻ると自動で送られます）
          </p>
        </div>
      )}

      {/* 設定されていないときの案内 */}
      {!config && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 mb-3">
          <p className="text-sm text-gray-300">
            送信先が未設定のため、作業記録は残りません
          </p>
        </div>
      )}

      {/* 担当者 */}
      <p className="text-base font-bold mb-1">👤 担当者</p>
      <p className="text-xs text-gray-500 mb-3">
        作業開始のときに選ぶ名前です。2台のiPadで同じ一覧を使います
      </p>

      <div className="space-y-2 mb-3">
        {workers.length === 0 && (
          <p className="text-sm text-gray-500">
            {config ? "読み込めませんでした" : "送信先を設定すると表示されます"}
          </p>
        )}

        {workers.map((name) => (
          <div key={name} className="flex items-center gap-2">
            <span className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-base">
              {name}
            </span>

            {confirmRemove === name ? (
              <>
                <button
                  onClick={() => void handleRemoveWorker(name)}
                  disabled={busy}
                  className="px-4 min-h-[48px] bg-red-700 hover:bg-red-600 disabled:bg-gray-700 rounded-lg text-sm font-bold"
                >
                  削除する
                </button>
                <button
                  onClick={() => setConfirmRemove(null)}
                  className="px-4 min-h-[48px] text-gray-400 hover:text-white text-sm"
                >
                  やめる
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmRemove(name)}
                className="px-4 min-h-[48px] bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg text-sm text-gray-400"
              >
                削除
              </button>
            )}
          </div>
        ))}
      </div>

      {confirmRemove && (
        <p className="text-xs text-gray-500 mb-3">
          ※ 削除しても、その人の過去の記録は残ります
        </p>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newWorker}
          onChange={(e) => setNewWorker(e.target.value)}
          placeholder="担当者を追加"
          disabled={!config || busy}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-base disabled:opacity-50"
        />
        <button
          onClick={() => void handleAddWorker()}
          disabled={!config || busy || !newWorker.trim()}
          className="px-4 min-h-[48px] bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-bold"
        >
          ＋追加
        </button>
      </div>

      {/* 送信先の設定。暗証番号で開く */}
      <div className="border-t border-gray-800 pt-3">
        {!unlocked ? (
          <div>
            <p className="text-sm text-gray-500 mb-2">
              🔒 送信先の設定（管理者のみ）
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) =>
                  handlePin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="暗証番号4桁"
                className="w-40 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-base text-center tracking-widest"
              />
              {pinError && (
                <span className="text-sm text-red-400">番号が違います</span>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-base font-bold mb-1">📤 送信先の設定</p>
            <p className="text-xs text-gray-500 mb-3">
              変更すると記録の保存先が変わります。通常は触りません
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  送信先URL
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="デプロイのウェブアプリURL"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  登録キー
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="32文字"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm"
                />
              </div>

              {testResult && (
                <p className="text-sm text-gray-300 bg-gray-800 rounded-lg px-3 py-2">
                  {testResult}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 min-h-[56px] bg-green-700 hover:bg-green-600 rounded-lg font-bold"
                >
                  保存
                </button>
                <button
                  onClick={() => void handleTest()}
                  disabled={testing}
                  className="flex-1 min-h-[56px] bg-gray-800 border border-gray-700 hover:border-gray-600 disabled:opacity-50 rounded-lg"
                >
                  {testing ? "確認中…" : "接続を確認"}
                </button>
              </div>

              <button
                onClick={() => setUnlocked(false)}
                className="w-full min-h-[48px] text-sm text-gray-500 hover:text-gray-300"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}