// src/SettingsScreen.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// セット商品定義の CRUD 設定画面
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useMemo, useCallback } from "react";
import {
  type SetDefinition,
  type SetComponent,
  getSetDefinitions,
  addSetDefinition,
  removeSetDefinition,
  resetToDefaults,
} from "./setDefinitions";
import { isFlyerAlertEnabled, setFlyerAlertEnabled } from "./shopColors";
import {
  type FontSizeLevel,
  FONT_SIZE_LABELS,
  FONT_SIZE_PX,
  getFontSize,
  saveFontSize,
  applyFontSize,
} from "./uiSettings";

// ============================================================
// Props
// ============================================================

type Props = {
  onClose: () => void;
};

// ============================================================
// 編集用の空テンプレート
// ============================================================

const EMPTY_DEF: SetDefinition = {
  id: "",
  label: "",
  codes: [""],
  prefixes: [],
  components: [{ name: "", qty: 1 }],
  packingAlerts: [],
};

// ============================================================
// コンポーネント
// ============================================================

import WorkLogSettings from "./WorkLogSettings";

export default function SettingsScreen({ onClose }: Props) {
  const [definitions, setDefinitions] = useState<SetDefinition[]>(getSetDefinitions);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDef, setEditingDef] = useState<SetDefinition | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [flyerAlert, setFlyerAlert] = useState<boolean>(isFlyerAlertEnabled);
  const [fontSize, setFontSize] = useState<FontSizeLevel>(getFontSize);

  // --- 文字サイズの変更（選んだ瞬間に画面へ反映する） ---
  const handleChangeFontSize = useCallback((level: FontSizeLevel) => {
    setFontSize(level);
    saveFontSize(level);
    applyFontSize(level);
  }, []);

  // --- チラシ確認アラートのON/OFF ---
  const handleToggleFlyerAlert = useCallback(() => {
    setFlyerAlert((prev) => {
      const next = !prev;
      setFlyerAlertEnabled(next);
      return next;
    });
  }, []);

  // --- 検索フィルタ ---
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return definitions;
    const q = searchQuery.toLowerCase();
    return definitions.filter(
      (d) =>
        d.id.toLowerCase().includes(q) ||
        d.codes.some((c) => c.toLowerCase().includes(q)) ||
        d.label.toLowerCase().includes(q) ||
        d.components.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [definitions, searchQuery]);

  // --- 新規追加 ---
  const handleAdd = useCallback(() => {
    setEditingDef({ ...EMPTY_DEF, components: [{ name: "", qty: 1 }] });
    setIsNew(true);
  }, []);

  // --- 編集開始 ---
  const handleEdit = useCallback((def: SetDefinition) => {
    setEditingDef({ ...def, components: def.components.map((c) => ({ ...c })) });
    setIsNew(false);
  }, []);

  // --- 保存 ---
  const handleSave = useCallback(() => {
    if (!editingDef) return;

    // バリデーション
    const id = editingDef.id.trim();
    if (!id) {
      alert("IDを入力してください。");
      return;
    }
    const label = editingDef.label.trim();
    if (!label) {
      alert("表示名を入力してください。");
      return;
    }
    // 空コンポーネントを除去
    const validComponents = editingDef.components.filter(
      (c) => c.name.trim() !== ""
    );

    const defToSave: SetDefinition = {
      ...editingDef,
      id,
      label,
      codes: editingDef.codes.filter((c) => c.trim() !== ""),
      prefixes: editingDef.prefixes?.filter((p) => p.trim() !== "") ?? [],
      components: validComponents,
      packingAlerts: editingDef.packingAlerts?.filter((a) => a.trim()) ?? [],
    };

    const updated = addSetDefinition(defToSave);
    setDefinitions([...updated]);
    setEditingDef(null);
    setIsNew(false);
  }, [editingDef]);

  // --- 削除 ---
  const handleDelete = useCallback(
    (id: string) => {
      if (!confirm(`「${id}」を削除しますか？`)) return;
      const updated = removeSetDefinition(id);
      setDefinitions([...updated]);
      setEditingDef(null);
    },
    []
  );

  // --- リセット ---
  const handleReset = useCallback(() => {
    const updated = resetToDefaults();
    setDefinitions([...updated]);
    setShowResetConfirm(false);
  }, []);

  // --- コンポーネント編集ヘルパー ---
  const updateComponent = (idx: number, field: keyof SetComponent, value: string | number) => {
    if (!editingDef) return;
    const comps = [...editingDef.components];
    comps[idx] = { ...comps[idx], [field]: value };
    setEditingDef({ ...editingDef, components: comps });
  };

  const addComponent = () => {
    if (!editingDef) return;
    setEditingDef({
      ...editingDef,
      components: [...editingDef.components, { name: "", qty: 1 }],
    });
  };

  const removeComponent = (idx: number) => {
    if (!editingDef) return;
    const comps = editingDef.components.filter((_, i) => i !== idx);
    setEditingDef({ ...editingDef, components: comps.length > 0 ? comps : [{ name: "", qty: 1 }] });
  };

  // ============================================================
  // 編集フォーム
  // ============================================================

  if (editingDef) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
        <div className="max-w-[780px] mx-auto">
          {/* ヘッダ */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {isNew ? "新規セット定義" : "セット定義を編集"}
            </h2>
            <button
              onClick={() => { setEditingDef(null); setIsNew(false); }}
              className="px-4 py-2 text-gray-400 hover:text-white min-h-[48px]"
            >
              キャンセル
            </button>
          </div>

          {/* 基本情報 */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">商品コード(代表)</label>
              <input
                type="text"
                value={editingDef.id}
                onChange={(e) => setEditingDef({ ...editingDef, id: e.target.value })}
                placeholder="例: ps3203012001"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-lg"
                readOnly={!isNew}
              />
              {!isNew && (
                <p className="text-xs text-gray-500 mt-1">※既存定義のIDは変更できません</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">表示名</label>
              <input
                type="text"
                value={editingDef.label}
                onChange={(e) => setEditingDef({ ...editingDef, label: e.target.value })}
                placeholder="例: PS3中期型 120GB"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-lg"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">前方一致プレフィックス（任意・カンマ区切り）</label>
              <input
                type="text"
                value={(editingDef.prefixes ?? []).join(", ")}
                onChange={(e) => setEditingDef({ ...editingDef, prefixes: e.target.value ? e.target.value.split(",").map((s) => s.trim()) : [] })}
                placeholder="例: 3dscolor6011801"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-base"
              />
            </div>
          </div>

          {/* 同梱物リスト */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">同梱物（正規化名 × 数量）</label>
              <button
                onClick={addComponent}
                className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm min-h-[40px]"
              >
                ＋追加
              </button>
            </div>
            <div className="space-y-2">
              {editingDef.components.map((comp, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={comp.name}
                    onChange={(e) => updateComponent(idx, "name", e.target.value)}
                    placeholder="部品名（例: メガネケーブル）"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-base"
                  />
                  <span className="text-gray-500">×</span>
                  <input
                    type="number"
                    value={comp.qty}
                    onChange={(e) => updateComponent(idx, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-3 text-center text-base"
                  />
                  <button
                    onClick={() => removeComponent(idx)}
                    className="text-red-400 hover:text-red-300 px-2 py-3 min-w-[40px] min-h-[48px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 梱包時アラート */}
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-1">梱包時アラート（任意）</label>
            <input
              type="text"
              value={editingDef.packingAlerts?.[0] ?? ""}
              onChange={(e) =>
                setEditingDef({
                  ...editingDef,
                  packingAlerts: e.target.value ? [e.target.value] : [],
                })
              }
              placeholder="例: 型番Aの本体を優先して使用してください"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-base"
            />
          </div>

          {/* アクションボタン */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl text-lg font-bold min-h-[56px]"
            >
              保存
            </button>
            {!isNew && (
              <button
                onClick={() => handleDelete(editingDef.id)}
                className="px-6 bg-red-700 hover:bg-red-600 text-white py-4 rounded-xl text-lg min-h-[56px]"
              >
                削除
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 一覧画面
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="max-w-[780px] mx-auto">
        {/* ヘッダ */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">⚙ セット商品定義</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg min-h-[48px]"
          >
            閉じる
          </button>
        </div>

        {/* 表示設定 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-400 mb-1">表示設定</p>
          <p className="text-base font-bold mb-1">🔠 文字の大きさ</p>
          <p className="text-xs text-gray-500 mb-3">
            画面全体の文字が大きくなります（ボタンの押しやすさは変わりません）
          </p>
          <div className="flex gap-2">
            {(["small", "medium", "large"] as const).map((level) => (
              <button
                key={level}
                onClick={() => handleChangeFontSize(level)}
                className={`flex-1 rounded-lg border-2 py-3 min-h-[56px] transition-colors ${
                  fontSize === level
                    ? "bg-emerald-700 border-emerald-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                }`}
              >
                {/* 選択肢そのものを、その大きさで表示して違いが分かるようにする */}
                <span
                  className="font-bold"
                  style={{ fontSize: `${FONT_SIZE_PX[level]}px` }}
                >
                  {FONT_SIZE_LABELS[level]}
                </span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  {FONT_SIZE_PX[level]}px
                  {level === "small" && "（標準）"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 梱包オプション */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-400 mb-3">梱包オプション</p>
          <button
            onClick={handleToggleFlyerAlert}
            className="w-full flex items-center justify-between gap-3 min-h-[56px] text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold">📄 チラシ確認アラート</p>
              <p className="text-xs text-gray-500 mt-0.5">
                楽天市場・Yahoo!ショッピングの注文にチラシ同梱の確認を表示
              </p>
            </div>
            <span
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold ${
                flyerAlert
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-700 text-gray-400"
              }`}
            >
              {flyerAlert ? "ON" : "OFF"}
            </span>
          </button>
        </div>

        {/* 作業記録（担当者・送信先）。既存項目の下に置き、位置をずらさない */}
        <WorkLogSettings />

        <p className="text-sm text-gray-400 mb-4">
          登録数: {definitions.length}件 ／ 同梱物の正規化名がピッキング集約のキーになります
        </p>

        {/* 検索 + 追加 */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="品番・名前・部品名で検索..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-base"
          />
          <button
            onClick={handleAdd}
            className="px-4 bg-green-700 hover:bg-green-600 rounded-lg text-base font-bold min-h-[48px] whitespace-nowrap"
          >
            ＋ 新規
          </button>
        </div>

        {/* 一覧 */}
        <div className="space-y-2 mb-8">
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              {searchQuery ? "該当するセット定義がありません" : "セット定義がありません"}
            </p>
          )}
          {filtered.map((def) => (
            <button
              key={def.id}
              onClick={() => handleEdit(def)}
              className="w-full text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 
                         rounded-xl p-4 transition-colors min-h-[64px]"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate">{def.label}</p>
                  <p className="text-sm text-gray-400 truncate">
                    <span className="text-gray-500">{def.id}</span>
                    <span className="mx-2">·</span>
                    <span>{def.codes.length}コード</span>
                    <span className="mx-2">·</span>
                    <span>{def.components.length}部品</span>
                  </p>
                </div>
                <span className="text-gray-600 ml-2 text-xl">›</span>
              </div>
              {/* 部品プレビュー */}
              {def.components.length > 0 && (
                <p className="text-xs text-gray-500 mt-2 truncate">
                  {def.components
                    .map((c) => `${c.name}×${c.qty}`)
                    .join(", ")}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* リセットボタン */}
        <div className="border-t border-gray-800 pt-6">
          {showResetConfirm ? (
            <div className="bg-red-950 border border-red-800 rounded-xl p-4">
              <p className="text-red-300 mb-3">
                全てのカスタマイズを破棄し、デフォルト定義（{definitions.length}件）に戻しますか？
                この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-red-700 hover:bg-red-600 text-white py-3 rounded-lg font-bold min-h-[48px]"
                >
                  リセット実行
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg min-h-[48px]"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full text-center text-gray-500 hover:text-red-400 py-3 text-sm min-h-[48px]"
            >
              デフォルト定義にリセット
            </button>
          )}
        </div>
      </div>
    </div>
  );
}