// src/App.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DAICHU Game Packing Support — メインUI
// フェーズ: home → picking → packing → complete
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { parseCSV, type ParsedData, type CarrierData, type PickingItem, type Order } from "./parsers";
import { type Platform, PLATFORMS, POKEMON_BATTERY_GROUP } from "./platformDetector";
import { findSetDefinition } from "./setDefinitions";
import { getSetImageUrl } from "./imageMapping";
import { detectShop, isFlyerAlertEnabled, FLYER_ALERT_TEXT } from "./shopColors";
import { initFontSize } from "./uiSettings";
import WorkerSelectScreen from "./WorkerSelectScreen";
import {
  type WorkSession,
  loadSession,
  saveSession,
  startSession,
  enterPacking,
  completeSlip,
  cancelSlip,
  endSession,
  shouldAutoEnd,
} from "./workLog";
import { isConfigured, enqueue, startQueue } from "./workLogQueue";
import {
  type WorkDay,
  type ShipmentSlot,
  type PackingSortMode,
  SLOT_LABELS,
  SLOT_ICONS,
  loadWorkDay,
  saveWorkDay,
  clearWorkDay,
  createWorkDay,
  createSession,
  collectMgmtNos,
  extractNewOrders,
  getSessionProgress,
  hasSeenGuide,
  markGuideSeen,
} from "./shipmentStore";
import SettingsScreen from "./SettingsScreen";
// --- RPG梱包モード（DAICHUクエスト / シークレット） ---
// ロゴ7回タップで解除される隠し機能。既存の梱包ロジックは変更せず、
// 表示だけを差し替える構成にしている
import {
  registerTap,
  isRetroModeEnabled,
  toggleRetroMode,
  disableRetroMode,
} from "./secretUnlock";
import { buildMonster } from "./monsterDefinitions";
import RpgPackingScreen from "./RpgPackingScreen";
import QuestTitleScreen from "./QuestTitleScreen";
import QuestClearScreen, { type DefeatedRecord } from "./QuestClearScreen";

// ============================================================
// フェーズ型
// ============================================================

type Phase =
  | "home"
  | "workerSelect"  // 担当者を選んで作業開始（記録が有効なときだけ通る）
  | "picking"
  | "pickingSummary"
  | "packing"
  | "packingSummary"
  | "settings";

// ============================================================
// 型番ハイライト
// PS2/PS3/PS4/PS5の型番をテキストから検出し、強調表示するJSXを返す
// ============================================================

// split + regex のマッチ判定を正確に行うバージョン
function renderWithModelHighlight(text: string): React.ReactNode {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /(SCPH-\d{4,5}[A-Z]?|CECH[A-Z]\d{2,3}|CECH-\d{4,5}[A-Z]?|CUH-\d{4,5}[A-Z]?|CFI-\d{4,5}[A-Z]?\d{0,2}|CFH-\d{4,5}[A-Z]?\d{0,2})/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // マッチ前のテキスト
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    // ハイライトされた型番
    result.push(
      <span key={match.index} className="bg-yellow-400 text-gray-900 font-bold px-1 mx-0.5 rounded text-sm">
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  // 残りのテキスト
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : text;
}

// ============================================================
// App
// ============================================================

export default function App() {
  // --- 状態 ---
  const [phase, setPhase] = useState<Phase>("home");
  // 午前便/午後便を保持する1日分の作業データ（localStorageから復元）
  const [workDay, setWorkDay] = useState<WorkDay | null>(loadWorkDay);
  const [activeSlot, setActiveSlot] = useState<ShipmentSlot | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<"takkyubin" | "nekopos" | null>(null);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // ピッキング
  const [pickingChecked, setPickingChecked] = useState<Record<string, boolean>>({});
  const [pickingViewMode, setPickingViewMode] = useState<"list" | "card">("list");
  const [currentPlatformIdx, setCurrentPlatformIdx] = useState(0);
  // 梱包
  const [currentPackingIdx, setCurrentPackingIdx] = useState(0);
  /** 梱包の並べ替えモード（伝票順 / ハード別） */
  const [packingSortMode, setPackingSortMode] = useState<PackingSortMode>("default");
  const [packingSetChecked, setPackingSetChecked] = useState<Record<string, Record<string, boolean>>>({});
  /** 梱包完了した管理番号（現在のキャリア分） */
  const [packingDoneList, setPackingDoneList] = useState<string[]>([]);
  // 画像モーダル
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  // 初回説明バナー
  const [showPickingGuide, setShowPickingGuide] = useState(false);
  const [showPackingGuide, setShowPackingGuide] = useState(false);

  // --- 起動時に保存済みの文字サイズを適用する ---
  // ルート要素の font-size を変えるだけなので、画面全体が比例して拡大される。
  useEffect(() => {
    initFontSize();
  }, []);

  // ============================================================
  // RPG梱包モード（DAICHUクエスト / シークレット）
  // ============================================================
  /** レトロモードが有効か。localStorage から初期値を復元する */
  const [rpgMode, setRpgMode] = useState<boolean>(isRetroModeEnabled);

  // ============================================================
  // 作業記録
  //
  // 画面には一切表示しない（要求仕様 4-2(1)）。
  // 記録が有効なのは、送信先が設定されていて、かつRPGモードでないときだけ。
  // 未設定なら担当者選択を飛ばし、今までどおり作業できる（作業を止めない）。
  // ============================================================

  const [workSession, setWorkSession] = useState<WorkSession | null>(loadSession);

  /** 担当者選択のあとに進む先を覚えておく */
  const [pendingStart, setPendingStart] = useState<{
    carrier: "takkyubin" | "nekopos";
    startIdx?: number;
  } | null>(null);

  /** 前回この端末で選ばれた担当者。毎回選び直す手間を省く */
  const [lastWorker, setLastWorker] = useState<string | null>(
    () => localStorage.getItem("game-packing-last-worker")
  );

  /** 記録中の状態を変えるときは、必ず保存も行う（再読み込みで復帰するため） */
  const updateSession = useCallback((next: WorkSession | null) => {
    setWorkSession(next);
    saveSession(next);
  }, []);

  // 前回の未送信分を送る仕組みを動かす（例外#15、#16）
  useEffect(() => {
    startQueue();
  }, []);

  // 開き直したときに、120分を過ぎていれば自動終了する（要求仕様 4-2(9)）
  useEffect(() => {
    if (!workSession) return;
    if (!shouldAutoEnd(workSession)) return;

    enqueue(endSession(workSession, "自動終了").event);
    setWorkSession(null);
    saveSession(null);
  }, [workSession]);
  /** タイトル画面を表示中か。解除直後に1回だけ出す「幕開け」 */
  const [showQuestTitle, setShowQuestTitle] = useState(false);
  /** ロゴ連打のヒント表示（4回目以降に出る小さなドット） */
  const [tapHint, setTapHint] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 現在の便セッション ---
  const activeSession = useMemo(() => {
    if (!workDay || !activeSlot) return null;
    return workDay[activeSlot];
  }, [workDay, activeSlot]);

  // --- 現在の便の注文データ ---
  const parsedData: ParsedData | null = activeSession?.data ?? null;

  // --- 現在のキャリアデータ ---
  const carrierData: CarrierData | null = useMemo(() => {
    if (!parsedData || !selectedCarrier) return null;
    return parsedData[selectedCarrier];
  }, [parsedData, selectedCarrier]);

  // --- 進捗をセッションに書き戻して永続化 ---
  useEffect(() => {
    if (!workDay || !activeSlot || !selectedCarrier) return;
    const session = workDay[activeSlot];
    if (!session) return;

    const updatedSession = {
      ...session,
      pickingChecked: { ...session.pickingChecked, [selectedCarrier]: pickingChecked },
      packingSetChecked: packingSetChecked,
      packingIdx: { ...session.packingIdx, [selectedCarrier]: currentPackingIdx },
      packingSortMode,
      packingDone: { ...session.packingDone, [selectedCarrier]: packingDoneList },
    };
    const updatedWorkDay: WorkDay = { ...workDay, [activeSlot]: updatedSession };

    setWorkDay(updatedWorkDay);
    saveWorkDay(updatedWorkDay);
    // workDay自身を依存に入れると無限ループになるため意図的に除外している
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickingChecked, packingSetChecked, currentPackingIdx, packingDoneList, packingSortMode, activeSlot, selectedCarrier]);

  // --- ピッキング進捗 ---
  const pickingProgress = useMemo(() => {
    if (!carrierData) return { done: 0, total: 0 };
    const total = carrierData.pickingItems.length;
    const done = carrierData.pickingItems.filter((item) => pickingChecked[item.name]).length;
    return { done, total };
  }, [carrierData, pickingChecked]);

  // --- 梱包進捗 ---
  /**
   * 梱包画面で表示する注文の並び。
   *
   * carrierData.orders 自体は書き換えず、派生した配列を作る。
   * これによりピッキングやRPGモードへの影響がない。
   *
   * 完了記録（packingDoneList）は管理番号ベースなので、
   * 並び順が変わっても進捗は壊れない。
   */
  const sortedOrders: Order[] = useMemo(() => {
    if (!carrierData) return [];
    if (packingSortMode === "default") return carrierData.orders;

    // ハード別: PLATFORMS の表示順に並べ、同一ハード内は元の順序を維持する
    const orderOf = (o: Order) => {
      const p = o.products[0]?.platform ?? "その他";
      const idx = PLATFORMS.indexOf(p as Platform);
      return idx === -1 ? 999 : idx;
    };
    return carrierData.orders
      .map((o, i) => ({ o, i }))
      .sort((a, b) => {
        const d = orderOf(a.o) - orderOf(b.o);
        return d !== 0 ? d : a.i - b.i; // 安定ソート
      })
      .map((x) => x.o);
  }, [carrierData, packingSortMode]);

  const currentOrder: Order | null = useMemo(() => {
    if (currentPackingIdx >= sortedOrders.length) return null;
    return sortedOrders[currentPackingIdx] ?? null;
  }, [sortedOrders, currentPackingIdx]);

  // ============================================================
  // RPG梱包モード用の導出値
  // ============================================================

  /**
   * 1注文あたりのチェック項目数を数える。
   *
   * 梱包画面の allCheckItems と同じ数え方をしている。
   * これがモンスターのHPと経験値の元になる。
   * 完全に同じ数にするためアラート類も含めているが、
   * ここでは概算として扱う（クリア画面の集計用）
   */
  const countOrderItems = useCallback((order: Order): number => {
    let count = 0;
    for (const product of order.products) {
      if (product.isSet && product.setComponents.length > 0) {
        for (const comp of product.setComponents) {
          count += comp.qty * product.qty;
        }
      } else {
        count += product.qty;
      }
    }
    return Math.max(1, count);
  }, []);

  /** 注文の代表プラットフォーム。最初の商品のものを使う */
  const getOrderPlatform = useCallback((order: Order) => {
    return order.products[0]?.platform ?? "その他";
  }, []);

  /** 注文の表示名。セット名または商品名 */
  const getOrderLabel = useCallback((order: Order): string => {
    const p = order.products[0];
    if (!p) return "なぞの しなもの";
    return p.name || p.shortName || "なぞの しなもの";
  }, []);

  /**
   * クリア画面用の戦績。完了記録から導出する。
   *
   * 新しい state を持たず既存の packingDoneList から計算しているため、
   * 進捗管理とズレることが構造的にない
   */
  const questResult = useMemo(() => {
    if (!carrierData) {
      return { defeated: [] as DefeatedRecord[], totalItems: 0, totalExp: 0 };
    }
    const doneSet = new Set(packingDoneList);
    const doneOrders = carrierData.orders.filter((o) => doneSet.has(o.mgmtNo));

    let totalItems = 0;
    let totalExp = 0;
    const defeated: DefeatedRecord[] = doneOrders.map((order, i) => {
      const items = countOrderItems(order);
      // 最後に倒した1体をボス扱いにする
      const isBoss = i === doneOrders.length - 1;
      const m = buildMonster(getOrderPlatform(order), getOrderLabel(order), items, isBoss);
      totalItems += items;
      totalExp += m.exp;
      return {
        name: m.name,
        shape: m.shape,
        palette: m.palette,
        detail: m.detail,
        tier: m.tier,
        exp: m.exp,
        isBoss,
      };
    });

    return { defeated, totalItems, totalExp };
  }, [carrierData, packingDoneList, countOrderItems, getOrderPlatform, getOrderLabel]);

  // ============================================================
  // ハンドラ
  // ============================================================

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      const data = await parseCSV(file);

      if (!workDay || !workDay.morning) {
        // --- 初回アップロード: 午前便として登録 ---
        const wd = workDay ?? createWorkDay();
        const session = createSession("morning", data, collectMgmtNos(data));
        const updated: WorkDay = { ...wd, morning: session };
        setWorkDay(updated);
        saveWorkDay(updated);
        setNotice(`午前便として ${session.data.takkyubin.totalOrders + session.data.nekopos.totalOrders} 件を登録しました`);
      } else {
        // --- 2回目以降: 既存の管理番号との差分を午後便として登録 ---
        const existing = [
          ...workDay.morning.mgmtNos,
          ...(workDay.afternoon?.mgmtNos ?? []),
        ];
        const { data: newData, newOrderCount, newMgmtNos } = extractNewOrders(data, existing);

        if (newOrderCount === 0) {
          setNotice("追加された注文はありませんでした。");
        } else {
          // 既存の午後便がある場合は統合せず上書き（同日中の再取り込みを想定）
          const session = createSession("afternoon", newData, newMgmtNos);
          // 既存の午後便の進捗があれば引き継ぐ
          if (workDay.afternoon) {
            session.pickingChecked = workDay.afternoon.pickingChecked;
            session.packingSetChecked = workDay.afternoon.packingSetChecked;
            session.packingIdx = workDay.afternoon.packingIdx;
          }
          const updated: WorkDay = { ...workDay, afternoon: session };
          setWorkDay(updated);
          saveWorkDay(updated);
          setNotice(`午後便として ${newOrderCount} 件の新規注文を検出しました`);
        }
      }

      setActiveSlot(null);
      setSelectedCarrier(null);
      setPhase("home");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CSV解析に失敗しました。";
      setError(msg);
      console.error("[App] CSV解析エラー:", err);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [workDay]);

  /** 便（午前便/午後便）を選択 */
  const handleSlotSelect = useCallback((slot: ShipmentSlot) => {
    setActiveSlot(slot);
    setSelectedCarrier(null);
    setNotice("");
  }, []);

  /**
   * 配送方法を選んだあとの処理。
   *
   * 記録が有効なら、ここで担当者選択を挟む（要求仕様 3章 After）。
   * 開始を押さなければ作業に入れない構成にすることで、記録漏れを防ぐ。
   */
  const handleCarrierSelect = useCallback((carrier: "takkyubin" | "nekopos", startIdx?: number) => {
    // RPGモード中、または送信先が未設定のときは、今までどおりの流れにする
    // （要求仕様 4-2(11)、未設定時は作業を止めない方針）
    if (!isConfigured() || rpgMode) {
      applyCarrierSelect(carrier, startIdx);
      return;
    }

    setPendingStart({ carrier, startIdx });
    setPhase("workerSelect");
  }, [rpgMode]);

  /**
   * 実際に画面を切り替える。進捗の復元だけを行い、記録には関わらない。
   * 担当者選択を経由する場合も、しない場合も、最後はここを通る。
   */
  const applyCarrierSelect = useCallback((carrier: "takkyubin" | "nekopos", startIdx?: number) => {
    // 選択した便・キャリアの保存済み進捗を復元する
    const session = workDay && activeSlot ? workDay[activeSlot] : null;
    setSelectedCarrier(carrier);
    setPickingChecked(session?.pickingChecked?.[carrier] ?? {});
    setPackingSetChecked(session?.packingSetChecked ?? {});
    setPackingDoneList(session?.packingDone?.[carrier] ?? []);
    setPackingSortMode(session?.packingSortMode ?? "default");
    setCurrentPackingIdx(startIdx ?? session?.packingIdx?.[carrier] ?? 0);
    setCurrentPlatformIdx(0);
    // 初回のみ説明バナーを表示
    if (startIdx !== undefined) {
      setShowPackingGuide(!hasSeenGuide("packing"));
      setPhase("packing");
    } else {
      setShowPickingGuide(!hasSeenGuide("picking"));
      setPhase("picking");
    }
  }, [workDay, activeSlot]);

  /**
   * 担当者を選んで作業を開始した。
   *
   * ここで記録が始まる。押した時点が開始時刻になる（要求仕様 3章 After 3）。
   */
  const handleStartWork = useCallback((worker: string, fromPicking: boolean) => {
    if (!pendingStart || !activeSlot) return;

    const carrierLabel = pendingStart.carrier === "takkyubin" ? "宅急便" : "ネコポス";
    const binLabel = activeSlot === "morning" ? "午前便" : "午後便";

    const session = startSession({
      bin: binLabel,
      carrier: carrierLabel,
      worker,
      fromPicking,
    });

    updateSession(session);
    setLastWorker(worker);
    localStorage.setItem("game-packing-last-worker", worker);

    // 「ピッキングから」なら startIdx なし、「梱包から」なら 0 を渡す。
    // 既存の分岐（startIdx の有無）がそのまま対応している。
    applyCarrierSelect(pendingStart.carrier, fromPicking ? undefined : 0);
    setPendingStart(null);
  }, [pendingStart, activeSlot, updateSession, applyCarrierSelect]);

  /** 中断位置から梱包を再開 */
  const handleResume = useCallback((slot: ShipmentSlot, carrier: "takkyubin" | "nekopos", index: number) => {
    setActiveSlot(slot);
    const session = workDay?.[slot] ?? null;
    setSelectedCarrier(carrier);
    setPickingChecked(session?.pickingChecked?.[carrier] ?? {});
    setPackingSetChecked(session?.packingSetChecked ?? {});
    setPackingDoneList(session?.packingDone?.[carrier] ?? []);
    setPackingSortMode(session?.packingSortMode ?? "default");
    setCurrentPackingIdx(index);
    setShowPackingGuide(!hasSeenGuide("packing"));
    setNotice("");
    setPhase("packing");
  }, [workDay]);

  const handlePickingToggle = useCallback((itemName: string) => {
    setPickingChecked((prev) => ({ ...prev, [itemName]: !prev[itemName] }));
  }, []);

  const handlePickingComplete = useCallback(() => {
    setPhase("pickingSummary");
  }, []);

  /**
   * ピッキングを終えて梱包へ進む。
   * ここで伝票の時間の起点が決まる（要求仕様 4-2(5)）。
   */
  const handleStartPacking = useCallback((skipped = false) => {
    if (workSession) {
      updateSession(enterPacking(workSession, skipped));
    }
    setShowPackingGuide(!hasSeenGuide("packing"));
    setPhase("packing");
  }, [workSession, updateSession]);

  const handlePackingSetToggle = useCallback((mgmtNo: string, compName: string) => {
    setPackingSetChecked((prev) => {
      const orderMap = { ...(prev[mgmtNo] || {}) };
      orderMap[compName] = !orderMap[compName];
      return { ...prev, [mgmtNo]: orderMap };
    });
  }, []);

  /** 梱包完了を記録して次の未完了注文へ */
  /**
   * 並べ替えモードを切り替える。
   *
   * 切り替えると表示順が変わるため、そのままでは別の注文に飛んでしまう。
   * 切り替え前に見ていた管理番号を、切り替え後の配列で探し直して位置を合わせる。
   */
  const handleToggleSortMode = useCallback(() => {
    if (!carrierData) return;
    const keepMgmtNo = currentOrder?.mgmtNo;
    const nextMode: PackingSortMode =
      packingSortMode === "default" ? "platform" : "default";

    // 切り替え後の並びを先に計算して、同じ注文の位置を求める
    let nextList: Order[];
    if (nextMode === "default") {
      nextList = carrierData.orders;
    } else {
      const orderOf = (o: Order) => {
        const p = o.products[0]?.platform ?? "その他";
        const idx = PLATFORMS.indexOf(p as Platform);
        return idx === -1 ? 999 : idx;
      };
      nextList = carrierData.orders
        .map((o, i) => ({ o, i }))
        .sort((a, b) => {
          const d = orderOf(a.o) - orderOf(b.o);
          return d !== 0 ? d : a.i - b.i;
        })
        .map((x) => x.o);
    }

    const nextIdx = keepMgmtNo
      ? nextList.findIndex((o) => o.mgmtNo === keepMgmtNo)
      : 0;

    setPackingSortMode(nextMode);
    setCurrentPackingIdx(nextIdx >= 0 ? nextIdx : 0);
  }, [carrierData, currentOrder, packingSortMode]);

  const handleCompleteOrder = useCallback((mgmtNo: string) => {
    if (!carrierData) return;
    const nextDone = packingDoneList.includes(mgmtNo)
      ? packingDoneList
      : [...packingDoneList, mgmtNo];
    setPackingDoneList(nextDone);

    // 伝票1件の完了を記録する。
    // 商品名はセット単位の名前（shortName || name）を使う。
    // 内訳ではなくセット名を残すことで、
    // 「PS2セットは時間がかかる」といった比較ができる（要求仕様 1章）。
    let sessionAfterComplete = workSession;
    if (workSession) {
      const order = carrierData.orders.find((o) => o.mgmtNo === mgmtNo);
      const items = order
        ? order.products.map((p) => p.shortName || p.name)
        : [];

      const result = completeSlip(workSession, { orderId: mgmtNo, items });
      enqueue(result.event);
      sessionAfterComplete = result.session;
      updateSession(result.session);
    }

    // 次の未完了注文を探す（現在位置より後 → 見つからなければ先頭から）
    // ★並べ替え中は表示順（sortedOrders）を基準にする
    const doneSet = new Set(nextDone);
    const orders = sortedOrders;
    let nextIdx = -1;
    for (let i = currentPackingIdx + 1; i < orders.length; i++) {
      if (!doneSet.has(orders[i].mgmtNo)) { nextIdx = i; break; }
    }
    if (nextIdx === -1) {
      for (let i = 0; i < orders.length; i++) {
        if (!doneSet.has(orders[i].mgmtNo)) { nextIdx = i; break; }
      }
    }

    if (nextIdx === -1) {
      // 全件完了。自動で担当終了にする（要求仕様 4-2(8)、例外#9）
      if (sessionAfterComplete) {
        enqueue(endSession(sessionAfterComplete, "全完了").event);
        updateSession(null);
      }
      setPhase("packingSummary");
    } else {
      setCurrentPackingIdx(nextIdx);
    }
  }, [carrierData, sortedOrders, packingDoneList, currentPackingIdx, workSession, updateSession]);

  /** 完了記録を取り消して再編集可能にする */
  const handleUncompleteOrder = useCallback((mgmtNo: string) => {
    setPackingDoneList((prev) => prev.filter((no) => no !== mgmtNo));

    // 取り消しを記録する。元の行は消さず、印だけが変わる（要求仕様 4-2(6)）。
    // 記録していない伝票（担当終了後の取り寄せ品など）なら、
    // cancelSlip が null を返すので何も送られない。
    if (workSession) {
      const result = cancelSlip(workSession, mgmtNo);
      enqueue(result.event);
      updateSession(result.session);
    }
  }, [workSession, updateSession]);

  /** 便選択画面に戻る（データは保持） */
  const handleBackToHome = useCallback(() => {
    setSelectedCarrier(null);
    setActiveSlot(null);
    setPhase("home");
  }, []);

  /**
   * ロゴのタップ。7回連続でシークレットモードをトグルする。
   *
   * 判定本体は secretUnlock.ts の純粋関数に切り出してあるため、
   * ここでは結果を受けて画面状態を更新するだけ。
   */
  const handleLogoTap = useCallback(() => {
    const result = registerTap();
    setTapHint(result.showHint ? result.count : 0);

    if (!result.reached) return;

    const enabled = toggleRetroMode();
    setRpgMode(enabled);
    setTapHint(0);
    // ONにしたときだけタイトル画面を出す。OFFのときは静かに戻す
    setShowQuestTitle(enabled);
  }, []);

  /** 新しい日を開始（全データ削除） */
  const handleClearAll = useCallback(() => {
    if (!confirm("本日の全データ（午前便・午後便の進捗を含む）を削除します。よろしいですか？")) return;
    clearWorkDay();
    // レトロモードも同時に解除する。翌朝出勤した人が意図せず
    // ゲームモードを引き継がないようにするため。
    // 再開には改めて7回タップが必要になる
    disableRetroMode();
    setRpgMode(false);
    setShowQuestTitle(false);
    setWorkDay(null);
    setActiveSlot(null);
    setSelectedCarrier(null);
    setPickingChecked({});
    setCurrentPackingIdx(0);
    setPackingSetChecked({});
    setPackingDoneList([]);
    setError("");
    setNotice("");
    setPhase("home");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ============================================================
  // DAICHUクエスト タイトル画面（シークレット解除直後に1回だけ）
  // ============================================================
  // 既存のホーム画面は改造せず、その手前に差し込む方式にしている。
  // ホーム画面はCSV取込・便選択・進捗再開・データ削除を担う重い画面で、
  // レトロ化すると既存機能を壊すリスクがあるため
  if (showQuestTitle) {
    return <QuestTitleScreen onStart={() => setShowQuestTitle(false)} />;
  }

  // ============================================================
  // 設定画面
  // ============================================================

  if (phase === "settings") {
    return <SettingsScreen onClose={() => setPhase("home")} />;
  }

  // 担当者を選んで作業開始（記録が有効なときだけ通る）
  if (phase === "workerSelect" && pendingStart && activeSlot) {
    const carrierInfo =
      pendingStart.carrier === "takkyubin"
        ? parsedData?.takkyubin
        : parsedData?.nekopos;

    return (
      <WorkerSelectScreen
        binLabel={`${SLOT_ICONS[activeSlot]} ${SLOT_LABELS[activeSlot]}`}
        carrierLabel={carrierInfo?.label ?? ""}
        orderCount={carrierInfo?.orders.length ?? 0}
        pickingCount={carrierInfo?.pickingItems.length ?? 0}
        lastWorker={lastWorker}
        onStart={handleStartWork}
        onBack={() => {
          setPendingStart(null);
          setPhase("home");
        }}
      />
    );
  }

  // ============================================================
  // ホーム画面（CSVアップロード + キャリア選択）
  // ============================================================

  if (phase === "home") {
    const slots: ShipmentSlot[] = ["morning", "afternoon"];
    const hasAnySession = !!(workDay?.morning || workDay?.afternoon);

    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        {/* ヘッダ */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          {/*
            ロゴ7回タップでシークレットモードを解除する。
            iPad Safari では長押しがテキスト選択メニューを、
            ダブルタップがズームを発動させるため、連続タップのみを使う。
            select-none で文字選択も抑止している。
          */}
          <h1
            onClick={handleLogoTap}
            className="text-lg font-bold text-emerald-400 select-none cursor-default flex items-baseline gap-1"
          >
            🎮 GAME PACKING SUPPORT
            {/* 4回目以降だけ小さなドットが出る。解除までの目安になる */}
            {tapHint > 0 && (
              <span className="text-emerald-700 text-[10px] tracking-tighter">
                {"·".repeat(tapHint)}
              </span>
            )}
          </h1>
          <button
            onClick={() => setPhase("settings")}
            className="text-gray-400 hover:text-white px-3 py-2 min-h-[44px]"
          >
            ⚙ 設定
          </button>
        </header>

        <div className="flex-1 flex flex-col items-center p-6 max-w-[780px] mx-auto w-full">
          {/* CSVアップロード（常時表示） */}
          <div className="w-full mb-6">
            <label className="block w-full cursor-pointer">
              <div className="border-2 border-dashed border-gray-700 hover:border-emerald-500 
                              rounded-2xl p-6 text-center transition-colors">
                <p className="text-2xl mb-1">📄</p>
                <p className="text-gray-300 text-base">
                  {isLoading
                    ? "解析中..."
                    : hasAnySession
                      ? "午後便のCSVをアップロード"
                      : "CROSS MALL 注文詳細CSVをアップロード"}
                </p>
                {hasAnySession && (
                  <p className="text-xs text-gray-500 mt-1">
                    新しい管理番号だけを午後便として抽出します
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
            </label>
            {error && <p className="mt-3 text-red-400 text-center text-sm">{error}</p>}
            {notice && <p className="mt-3 text-emerald-400 text-center text-sm">{notice}</p>}
          </div>

          {/* 便の選択 */}
          {hasAnySession && !activeSlot && (
            <div className="w-full">
              <p className="text-gray-400 text-center mb-4">作業する便を選択してください</p>
              <div className="space-y-3">
                {slots.map((slot) => {
                  const session = workDay?.[slot];
                  if (!session) return null;
                  const prog = getSessionProgress(session);
                  const isMorning = slot === "morning";
                  const pickPct = prog.pickingTotal > 0 ? (prog.pickingDone / prog.pickingTotal) * 100 : 0;
                  const packPct = prog.packingTotal > 0 ? (prog.packingDone / prog.packingTotal) * 100 : 0;
                  const allDone = prog.packingTotal > 0 && prog.packingDone >= prog.packingTotal;
                  return (
                    <div
                      key={slot}
                      className={`w-full rounded-2xl p-5 border-2 ${
                        isMorning
                          ? "bg-sky-950 border-sky-700"
                          : "bg-orange-950 border-orange-700"
                      }`}
                    >
                      <button onClick={() => handleSlotSelect(slot)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xl font-bold ${isMorning ? "text-sky-300" : "text-orange-300"}`}>
                            {SLOT_ICONS[slot]} {SLOT_LABELS[slot]}
                          </p>
                          <span className="text-2xl font-bold text-gray-200">{prog.totalOrders}件</span>
                        </div>

                        {/* ピッキング進捗 */}
                        <div className="mt-3">
                          <div className="flex justify-between text-sm text-gray-400 mb-1">
                            <span>ピッキング</span>
                            <span>
                              {prog.pickingDone}/{prog.pickingTotal}
                              {prog.pickingTotal > 0 && prog.pickingDone === prog.pickingTotal && " ✓"}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pickPct}%` }} />
                          </div>
                        </div>

                        {/* 梱包進捗 */}
                        <div className="mt-2">
                          <div className="flex justify-between text-sm text-gray-400 mb-1">
                            <span>梱包</span>
                            <span>
                              {prog.packingDone}/{prog.packingTotal}
                              {allDone && " ✓"}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${packPct}%` }} />
                          </div>
                        </div>

                        {/* 中断位置 */}
                        {prog.resumeAt && prog.packingDone > 0 && (
                          <p className="mt-2 text-xs text-amber-400">
                            ⏸ {prog.resumeAt.label} {prog.resumeAt.index + 1}番目の注文で中断中
                          </p>
                        )}
                        {allDone && (
                          <p className="mt-2 text-xs text-emerald-400">✅ この便は完了しました</p>
                        )}
                      </button>

                      {/* 中断位置から再開 */}
                      {prog.resumeAt && prog.packingDone > 0 && (
                        <button
                          onClick={() => handleResume(slot, prog.resumeAt!.carrier, prog.resumeAt!.index)}
                          className="w-full mt-3 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-base font-bold min-h-[48px]"
                        >
                          ▶ 中断した場所から再開
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleClearAll}
                className="w-full mt-6 text-gray-500 hover:text-red-400 py-3 text-sm min-h-[48px]"
              >
                新しい日を開始（全データ削除）
              </button>
            </div>
          )}

          {/* キャリア選択 */}
          {parsedData && activeSlot && (
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                  activeSlot === "morning" ? "bg-sky-700 text-sky-100" : "bg-orange-700 text-orange-100"
                }`}>
                  {SLOT_ICONS[activeSlot]} {SLOT_LABELS[activeSlot]}
                </span>
                <span className="text-gray-400 text-sm">配送方法を選択</span>
              </div>
              <div className="space-y-4">
                {/* 宅急便 */}
                <button
                  onClick={() => handleCarrierSelect("takkyubin")}
                  disabled={parsedData.takkyubin.totalOrders === 0}
                  className={`w-full rounded-2xl p-6 text-left transition-all min-h-[80px] ${
                    parsedData.takkyubin.totalOrders > 0
                      ? "bg-blue-950 border-2 border-blue-700 hover:border-blue-500"
                      : "bg-gray-900 border-2 border-gray-800 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <p className="text-xl font-bold text-blue-300">📦 ヤマト宅急便</p>
                  <p className="text-gray-400 mt-1">
                    {parsedData.takkyubin.totalOrders}件 ／ ピッキング{parsedData.takkyubin.pickingItems.length}種
                  </p>
                </button>

                {/* ネコポス */}
                <button
                  onClick={() => handleCarrierSelect("nekopos")}
                  disabled={parsedData.nekopos.totalOrders === 0}
                  className={`w-full rounded-2xl p-6 text-left transition-all min-h-[80px] ${
                    parsedData.nekopos.totalOrders > 0
                      ? "bg-amber-950 border-2 border-amber-700 hover:border-amber-500"
                      : "bg-gray-900 border-2 border-gray-800 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <p className="text-xl font-bold text-amber-300">✉️ ヤマトネコポス</p>
                  <p className="text-gray-400 mt-1">
                    {parsedData.nekopos.totalOrders}件 ／ ピッキング{parsedData.nekopos.pickingItems.length}種
                  </p>
                </button>
              </div>

              <button
                onClick={() => setActiveSlot(null)}
                className="w-full mt-6 text-gray-500 hover:text-gray-300 py-3 text-sm min-h-[48px]"
              >
                ← 便の選択に戻る
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // ピッキング画面（プラットフォーム別グルーピング）
  // ============================================================

  if (phase === "picking" && carrierData) {
    // プラットフォーム別にグルーピング
    const platformGroups = new Map<Platform, PickingItem[]>();
    for (const item of carrierData.pickingItems) {
      const group = platformGroups.get(item.platform) || [];
      group.push(item);
      platformGroups.set(item.platform, group);
    }

    // プラットフォーム順でソートされた配列
    const sortedPlatforms = Array.from(platformGroups.keys()).sort((a, b) => {
      const idxA = PLATFORMS.indexOf(a);
      const idxB = PLATFORMS.indexOf(b);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    const allChecked = pickingProgress.done === pickingProgress.total && pickingProgress.total > 0;

    // カードモード用: 現在表示中のプラットフォーム
    const safeIdx = Math.min(currentPlatformIdx, sortedPlatforms.length - 1);
    const currentPlatform = sortedPlatforms[safeIdx];
    const currentItems = currentPlatform ? platformGroups.get(currentPlatform) || [] : [];
    const cardGroupDone = currentItems.filter((i) => pickingChecked[i.name]).length;

    // ---- チェックボックス行の共通レンダー ----
    const renderPickingItem = (item: PickingItem) => {
      const checked = !!pickingChecked[item.name];
      return (
        <button
          key={item.name}
          onClick={() => handlePickingToggle(item.name)}
          className={`w-full flex items-center gap-3 rounded-xl p-4 text-left 
                      transition-all min-h-[60px] ${
            checked
              ? "bg-gray-900/50 border border-gray-800"
              : "bg-gray-900 border border-gray-700 hover:border-emerald-600"
          }`}
        >
          <div className={`w-7 h-7 rounded-md border-2 flex items-center justify-center shrink-0 ${
            checked ? "bg-emerald-600 border-emerald-500" : "border-gray-600"
          }`}>
            {checked && <span className="text-white text-sm">✓</span>}
          </div>
          <div className={`flex-1 min-w-0 ${checked ? "opacity-40" : ""}`}>
            <p className={`text-base break-words ${checked ? "line-through" : "font-medium"}`}>
              {renderWithModelHighlight(item.name)}
            </p>
            {item.sources.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5 break-words">
                {item.sources.join(" + ")}
              </p>
            )}
          </div>
          <span className={`text-xl font-bold shrink-0 ${
            checked ? "text-gray-600" : "text-emerald-400"
          }`}>
            ×{item.totalQty}
          </span>
        </button>
      );
    };

    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        {/* ヘッダ */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-[780px] mx-auto">
            <div className="flex items-center justify-between">
              <button onClick={() => { setSelectedCarrier(null); setPhase("home"); }} className="text-gray-400 hover:text-white min-h-[44px] px-2">
                ← 戻る
              </button>
              <h2 className="font-bold text-emerald-400 flex items-center gap-2">
                {activeSlot && (
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    activeSlot === "morning" ? "bg-sky-700 text-sky-100" : "bg-orange-700 text-orange-100"
                  }`}>
                    {SLOT_ICONS[activeSlot]} {SLOT_LABELS[activeSlot]}
                  </span>
                )}
                <span>ピッキング ─ {carrierData.label}</span>
              </h2>
              <span className="text-sm font-bold text-emerald-300">
                {pickingProgress.done}/{pickingProgress.total} 種
              </span>
            </div>
            {/* プログレスバー + ビュー切替 */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${pickingProgress.total > 0 ? (pickingProgress.done / pickingProgress.total) * 100 : 0}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-gray-400 w-10 text-right">
                {pickingProgress.total > 0 ? Math.round((pickingProgress.done / pickingProgress.total) * 100) : 0}%
              </span>
              <button
                onClick={() => {
                  setPickingViewMode((m) => (m === "list" ? "card" : "list"));
                  setCurrentPlatformIdx(0);
                }}
                className="shrink-0 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded min-h-[32px]"
              >
                {pickingViewMode === "list" ? "📇 カード" : "📋 一覧"}
              </button>
            </div>
          </div>
        </header>

        {/* 初回説明バナー */}
        {showPickingGuide && (
          <div className="bg-emerald-950 border-b border-emerald-800 px-4 py-3">
            <div className="max-w-[780px] mx-auto flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-emerald-300 font-bold text-sm">📋 棚から商品を集めてチェックしましょう</p>
                <p className="text-emerald-400/70 text-xs mt-1">
                  ハード（プラットフォーム）別に並んでいます。すべて集め終わったら梱包へ進みます。
                </p>
              </div>
              <button
                onClick={() => { markGuideSeen("picking"); setShowPickingGuide(false); }}
                className="shrink-0 text-emerald-400 hover:text-white text-sm px-3 py-2 min-h-[40px]"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* ===== 一覧モード ===== */}
        {pickingViewMode === "list" && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-[780px] mx-auto space-y-6 pt-1">
              {sortedPlatforms.map((platform) => {
                const items = platformGroups.get(platform)!;
                const groupDone = items.filter((i) => pickingChecked[i.name]).length;
                const groupTotal = items.length;
                const isPokemonGroup = platform === POKEMON_BATTERY_GROUP;
                return (
                  <div key={platform}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                        isPokemonGroup
                          ? "bg-yellow-700 text-yellow-100"
                          : "bg-emerald-800 text-emerald-200"
                      }`}>
                        {isPokemonGroup ? "⚡ " : ""}{platform}
                      </span>
                      <span className="text-gray-500 text-sm">{groupDone}/{groupTotal}</span>
                      {groupDone === groupTotal && groupTotal > 0 && (
                        <span className="text-emerald-400 text-sm">✓</span>
                      )}
                    </div>
                    {isPokemonGroup && (
                      <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-3 mb-2 text-sm text-yellow-300">
                        ⚡ こちらの商品はピッキングしたのちにまとめて電池交換してください
                      </div>
                    )}
                    <div className="space-y-1">
                      {items.map(renderPickingItem)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== カードモード ===== */}
        {pickingViewMode === "card" && currentPlatform && (
          <div className="flex-1 flex flex-col p-4">
            <div className="max-w-[780px] mx-auto w-full flex-1 flex flex-col">
              {/* プラットフォームナビ */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentPlatformIdx((i) => Math.max(0, i - 1))}
                  disabled={safeIdx === 0}
                  className={`px-4 py-2 rounded-lg text-lg font-bold min-h-[48px] min-w-[60px] ${
                    safeIdx === 0
                      ? "bg-gray-900 text-gray-700 cursor-not-allowed"
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  }`}
                >
                  ‹
                </button>

                <div className="text-center flex-1">
                  <span className={`px-4 py-2 rounded-xl text-xl font-bold ${
                    currentPlatform === POKEMON_BATTERY_GROUP
                      ? "bg-yellow-700 text-yellow-100"
                      : "bg-emerald-700 text-emerald-100"
                  }`}>
                    {currentPlatform === POKEMON_BATTERY_GROUP ? "⚡ " : ""}{currentPlatform}
                  </span>
                  <p className="text-gray-500 text-sm mt-1">
                    {safeIdx + 1}/{sortedPlatforms.length} プラットフォーム ─ {cardGroupDone}/{currentItems.length}
                    {cardGroupDone === currentItems.length && currentItems.length > 0 && " ✓"}
                  </p>
                </div>

                <button
                  onClick={() => setCurrentPlatformIdx((i) => Math.min(sortedPlatforms.length - 1, i + 1))}
                  disabled={safeIdx >= sortedPlatforms.length - 1}
                  className={`px-4 py-2 rounded-lg text-lg font-bold min-h-[48px] min-w-[60px] ${
                    safeIdx >= sortedPlatforms.length - 1
                      ? "bg-gray-900 text-gray-700 cursor-not-allowed"
                      : "bg-gray-800 hover:bg-gray-700 text-white"
                  }`}
                >
                  ›
                </button>
              </div>

              {/* カード内アイテム */}
              {currentPlatform === POKEMON_BATTERY_GROUP && (
                <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-3 mb-2 text-sm text-yellow-300">
                  ⚡ こちらの商品はピッキングしたのちにまとめて電池交換してください
                </div>
              )}
              <div className="flex-1 overflow-y-auto space-y-1">
                {currentItems.map(renderPickingItem)}
              </div>
            </div>
          </div>
        )}

        {/* 底部ボタン（常に表示） */}
        <div className="sticky bottom-0 bg-gray-950 border-t border-gray-800 p-4">
          <div className="max-w-[780px] mx-auto space-y-2">
            {allChecked ? (
              <button
                onClick={handlePickingComplete}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 
                           rounded-xl text-lg font-bold min-h-[56px] transition-colors"
              >
                ピッキング完了 → 梱包へ
              </button>
            ) : (
              <button
                onClick={handlePickingComplete}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 
                           rounded-xl text-base min-h-[48px] transition-colors"
              >
                梱包へスキップ（{pickingProgress.done}/{pickingProgress.total}）
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // ピッキング完了サマリー
  // ============================================================

  if (phase === "pickingSummary" && carrierData) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-[780px] w-full text-center">
          <p className="text-5xl mb-4">✅</p>
          <h2 className="text-2xl font-bold text-emerald-400 mb-2">ピッキング完了</h2>
          <p className="text-gray-400 mb-6">
            {carrierData.label} ─ {pickingProgress.done}/{pickingProgress.total}種をチェックしました
          </p>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 text-left">
            <p className="text-blue-300 font-bold mb-1">📦 次は梱包作業です</p>
            <p className="text-gray-400 text-sm">
              {carrierData.totalOrders}件の注文を1件ずつ梱包します。
              各注文で全項目にチェックを入れると「梱包完了」ボタンが押せるようになります。
            </p>
          </div>

          <button
            onClick={() => handleStartPacking(false)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 
                       rounded-xl text-lg font-bold min-h-[56px]"
          >
            梱包を開始（{carrierData.totalOrders}件）
          </button>
          <button
            onClick={() => setPhase("picking")}
            className="w-full mt-3 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl text-base min-h-[48px]"
          >
            ← ピッキングに戻る
          </button>
          <button
            onClick={handleBackToHome}
            className="w-full mt-3 text-gray-500 hover:text-gray-300 py-3 text-sm min-h-[48px]"
          >
            便の選択に戻る
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // 梱包画面（1注文ずつ）
  // ============================================================

  // Image modal for all phases
  const imageModalEl = imageModalUrl ? (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={() => setImageModalUrl(null)}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setImageModalUrl(null)}
          className="absolute -top-3 -right-3 bg-gray-700 hover:bg-gray-600 text-white 
                     w-10 h-10 rounded-full text-xl z-10 flex items-center justify-center"
        >
          ✕
        </button>
        <img
          src={imageModalUrl ?? undefined}
          alt="商品画像"
          className="max-w-full max-h-[85vh] rounded-xl object-contain"
          onError={(e) => { (e.target as HTMLImageElement).alt = "画像の読み込みに失敗"; }}
        />
      </div>
    </div>
  ) : null;

  if (phase === "packing" && carrierData && currentOrder) {
    const mgmtNo = currentOrder.mgmtNo;
    const orderChecks = packingSetChecked[mgmtNo] || {};

    // モール判定（枠色・バッジ・チラシ対象の決定に使用）
    const shop = detectShop(currentOrder.shopName);

    // 全商品のセットチェックリストを構築
    const allCheckItems: { label: string; key: string; isAlert?: boolean; index?: number; total?: number }[] = [];

    // チラシ同梱アラート（楽天・ヤフショのみ、設定でON時）
    //   ヤマト宅急便 → 商品によらず常に表示
    //   ヤマトネコポス → 本体を含む商品 or PSPオリジナルバッテリーがある場合のみ表示
    //                   （ソフト単品・ケーブル単品などにはチラシを入れないため）
    const flyerNeededForOrder =
      selectedCarrier === "takkyubin" ||
      currentOrder.products.some((p) => p.isFlyerTarget);

    if (shop.needsFlyer && isFlyerAlertEnabled() && flyerNeededForOrder) {
      allCheckItems.push({
        label: FLYER_ALERT_TEXT,
        key: `alert_${FLYER_ALERT_TEXT}`,
        isAlert: true,
      });
    }

    // 梱包時アラートを収集 → チェック項目として追加
    for (const product of currentOrder.products) {
      for (const alert of product.packingAlerts) {
        const alertKey = `alert_${alert}`;
        if (!allCheckItems.some((item) => item.key === alertKey)) {
          allCheckItems.push({ label: alert, key: alertKey, isAlert: true });
        }
      }
      // タッチペン確認: セット商品か単品かを問わず、
      // 本体（DS/3DS）またはゲームパッド（WiiU）を含む商品で表示する
      if (product.needsTouchPen) {
        const tpAlert = product.platform === "WiiU"
          ? "ゲームパッドにタッチペンは付属していますか？"
          : "本体にタッチペンは付属していますか？";
        const tpKey = `alert_${tpAlert}`;
        if (!allCheckItems.some((item) => item.key === tpKey)) {
          allCheckItems.push({ label: tpAlert, key: tpKey, isAlert: true });
        }
      }
    }

    for (let pIdx = 0; pIdx < currentOrder.products.length; pIdx++) {
      const product = currentOrder.products[pIdx];
      if (product.isSet && product.setComponents.length > 0) {
        for (const comp of product.setComponents) {
          const totalCount = comp.qty * product.qty;
          for (let i = 0; i < totalCount; i++) {
            const key = `p${pIdx}_${product.code}_${comp.name}_${i}`;
            allCheckItems.push({
              label: comp.name,
              key,
              index: totalCount > 1 ? i + 1 : undefined,
              total: totalCount > 1 ? totalCount : undefined,
            });
          }
        }
      } else {
        const totalCount = product.qty;
        for (let i = 0; i < totalCount; i++) {
          const key = `p${pIdx}_${product.code}_single_${i}`;
          allCheckItems.push({
            label: product.shortName || product.name,
            key,
            index: totalCount > 1 ? i + 1 : undefined,
            total: totalCount > 1 ? totalCount : undefined,
          });
        }
      }
    }

    const allItemsChecked =
      allCheckItems.length > 0 &&
      allCheckItems.every((item) => !!orderChecks[item.key]);
    const uncheckedCount = allCheckItems.filter((item) => !orderChecks[item.key]).length;
    const checkedCount = allCheckItems.length - uncheckedCount;
    const isThisOrderDone = packingDoneList.includes(mgmtNo);
    const doneCount = carrierData.orders.filter((o) => packingDoneList.includes(o.mgmtNo)).length;
    const donePct = carrierData.orders.length > 0 ? (doneCount / carrierData.orders.length) * 100 : 0;

    // ============================================================
    // RPG梱包モード（DAICHUクエスト）
    // ============================================================
    // 既存の allCheckItems などをそのまま渡すだけで成立する。
    // 下の既存JSXには一切手を入れていない
    if (rpgMode) {
      // 残り1件（この注文を倒せば全完了）ならボス扱いにする
      const isLast = doneCount === carrierData.orders.length - 1 && !isThisOrderDone;
      const monster = buildMonster(
        currentOrder.products[0]?.platform ?? "その他",
        getOrderLabel(currentOrder),
        allCheckItems.length,
        isLast
      );
      // 宛先の組み立て（既存画面と同じ情報を出す）
      const recipient = currentOrder.recipientName || currentOrder.ordererName || "ななしの ぼうけんしゃ";

      return (
        <RpgPackingScreen
          monster={monster}
          orderKey={mgmtNo}
          items={allCheckItems}
          checked={orderChecks}
          currentIndex={currentPackingIdx}
          totalCount={carrierData.orders.length}
          doneCount={doneCount}
          totalExp={questResult.totalExp}
          isLast={isLast}
          recipientName={recipient}
          deliveryDate={currentOrder.deliveryDate || ""}
          isDone={isThisOrderDone}
          onToggle={(key) => handlePackingSetToggle(mgmtNo, key)}
          onComplete={() => handleCompleteOrder(mgmtNo)}
          onPrev={() => setCurrentPackingIdx((i) => Math.max(0, i - 1))}
          onNext={() =>
            setCurrentPackingIdx((i) => Math.min(carrierData.orders.length - 1, i + 1))
          }
          onExit={() => setPhase("pickingSummary")}
        />
      );
    }

    return (
      <>
      {imageModalEl}
      <div className={`min-h-screen bg-gray-950 text-gray-100 flex flex-col border-4 ${shop.frame}`}>
        {/* ヘッダ */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
          <div className="max-w-[780px] mx-auto">
            {/* 上段: 戻る / 便バッジ / キャリア */}
            <div className="flex items-center justify-between">
              <button onClick={() => setPhase("pickingSummary")} className="text-gray-400 hover:text-white min-h-[44px] px-2">
                ← 戻る
              </button>
              <div className="flex items-center gap-2">
                {activeSlot && (
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    activeSlot === "morning" ? "bg-sky-700 text-sky-100" : "bg-orange-700 text-orange-100"
                  }`}>
                    {SLOT_ICONS[activeSlot]} {SLOT_LABELS[activeSlot]}
                  </span>
                )}
                <span className="text-sm text-gray-400">{carrierData.label}</span>
              </div>
              {/* 並べ替え切替 */}
              <button
                onClick={handleToggleSortMode}
                className={`shrink-0 text-xs px-2 py-1 rounded min-h-[32px] ${
                  packingSortMode === "platform"
                    ? "bg-emerald-800 hover:bg-emerald-700 text-emerald-100"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                }`}
              >
                {packingSortMode === "platform" ? "🎮 ハード別" : "📋 伝票順"}
              </button>
            </div>

            {/* 中段: 前後移動と現在位置 */}
            <div className="flex items-center justify-between gap-2 mt-2">
              <button
                onClick={() => setCurrentPackingIdx((i) => Math.max(0, i - 1))}
                disabled={currentPackingIdx === 0}
                className={`px-4 py-2 rounded-lg text-xl font-bold min-h-[48px] min-w-[56px] ${
                  currentPackingIdx === 0
                    ? "bg-gray-900 text-gray-700 cursor-not-allowed"
                    : "bg-gray-800 hover:bg-gray-700 text-white"
                }`}
              >
                ‹
              </button>

              <div className="text-center flex-1">
                <p className="font-bold text-blue-400 text-lg">
                  {currentPackingIdx + 1} / {sortedOrders.length} 件目
                </p>
                {/* ハード別のときは、そのハードの中で何件目かも出す */}
                {packingSortMode === "platform" && currentOrder && (() => {
                  const pf = currentOrder.products[0]?.platform ?? "その他";
                  const same = sortedOrders.filter(
                    (o) => (o.products[0]?.platform ?? "その他") === pf
                  );
                  const posInPf = same.findIndex((o) => o.mgmtNo === currentOrder.mgmtNo) + 1;
                  return (
                    <p className="text-sm">
                      <span className="bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded font-bold">
                        {pf}
                      </span>
                      <span className="text-gray-400 ml-2">
                        {posInPf} / {same.length} 件目
                      </span>
                    </p>
                  );
                })()}
                <p className="text-xs text-gray-500">
                  ✓ 完了 {doneCount}件 ／ 残り {sortedOrders.length - doneCount}件
                </p>
              </div>

              <button
                onClick={() => setCurrentPackingIdx((i) => Math.min(sortedOrders.length - 1, i + 1))}
                disabled={currentPackingIdx >= sortedOrders.length - 1}
                className={`px-4 py-2 rounded-lg text-xl font-bold min-h-[48px] min-w-[56px] ${
                  currentPackingIdx >= sortedOrders.length - 1
                    ? "bg-gray-900 text-gray-700 cursor-not-allowed"
                    : "bg-gray-800 hover:bg-gray-700 text-white"
                }`}
              >
                ›
              </button>
            </div>

            {/* 完了ベースのプログレスバー */}
            <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${donePct}%` }}
              />
            </div>
          </div>
        </header>

        {/* 初回説明バナー */}
        {showPackingGuide && (
          <div className="bg-blue-950 border-b border-blue-800 px-4 py-3">
            <div className="max-w-[780px] mx-auto flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-blue-300 font-bold text-sm">📦 商品を1件ずつ梱包します</p>
                <p className="text-blue-400/70 text-xs mt-1">
                  全項目にチェックを入れると下部の「梱包完了」ボタンが押せます。上部の ‹ › で前後の注文を確認できます。
                </p>
              </div>
              <button
                onClick={() => { markGuideSeen("packing"); setShowPackingGuide(false); }}
                className="shrink-0 text-blue-400 hover:text-white text-sm px-3 py-2 min-h-[40px]"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[780px] mx-auto">
            {/* 宛先情報 */}
            <div className={`bg-gray-900 rounded-xl p-4 mb-4 border-2 ${
              isThisOrderDone ? "border-emerald-600" : shop.cardBorder
            }`}>
              {isThisOrderDone && (
                <div className="bg-emerald-900/50 border border-emerald-700 rounded-lg px-3 py-2 mb-3">
                  <p className="text-emerald-300 text-sm font-bold">✓ この注文は梱包完了しています</p>
                </div>
              )}
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-lg font-bold flex-1">{currentOrder.recipientName} 様</p>
                <span className={`shrink-0 px-3 py-1 rounded-lg text-sm font-bold ${shop.badge}`}>
                  {shop.label}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                〒{currentOrder.recipientPostal} {currentOrder.recipientAddr}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                管理番号: {currentOrder.mgmtNo}
              </p>
              {currentOrder.deliveryDate && (
                <p className="text-sm text-amber-400 mt-1">
                  📅 配送希望日: {currentOrder.deliveryDate}
                </p>
              )}
            </div>

            {/* アラート（チェック付き） */}
            {allCheckItems.filter((item) => item.isAlert).length > 0 && (
              <div className="bg-amber-950 border border-amber-700 rounded-xl overflow-hidden mb-4">
                {allCheckItems
                  .filter((item) => item.isAlert)
                  .map((item) => {
                    const checked = !!orderChecks[item.key];
                    return (
                      <button
                        key={item.key}
                        onClick={() => handlePackingSetToggle(mgmtNo, item.key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-amber-800 
                                    last:border-b-0 min-h-[56px] transition-colors ${
                          checked ? "bg-amber-950/50" : "hover:bg-amber-900/50"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                          checked ? "bg-amber-500 border-amber-400" : "border-amber-600"
                        }`}>
                          {checked && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className={`flex-1 text-sm ${checked ? "line-through text-amber-700" : "text-amber-300"}`}>
                          ⚠️ {item.label}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* 商品ごとのセクション */}
            {currentOrder.products.map((product, pIdx) => (
              <div key={`${product.code}_${pIdx}`} className="mb-4">
                {/* 商品ヘッダ — カラー・数量・画像ボタン */}
                <div className="bg-gray-900 rounded-t-xl p-3 border border-gray-800 border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-base break-words flex-1">{renderWithModelHighlight(product.shortName || product.name)}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {(() => {
                        const setDef = findSetDefinition(product.code);
                        const imgUrl = setDef ? getSetImageUrl(setDef.id) : null;
                        return imgUrl ? (
                          <button
                            onClick={() => setImageModalUrl(imgUrl)}
                            className="bg-blue-800 hover:bg-blue-700 text-white px-2 py-1 rounded-lg text-sm min-h-[36px]"
                          >
                            📷
                          </button>
                        ) : null;
                      })()}
                      {product.qty > 1 && (
                        <span className="bg-red-600 text-white text-lg font-bold px-3 py-1 rounded-lg">
                          ×{product.qty}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{product.code}</p>
                  {product.attr1 && (
                    <p className="text-base text-amber-300 font-bold mt-1">
                      {/* 見出しはCSVの属性グループ１名（列16）を使う。
                          「カラー」だけでなく「セット内容」「容量」等が入るため。
                          値がないCSVや合成Productでは従来どおり「カラー」にフォールバックする */}
                      {product.attr1Group || "カラー"}: {product.attr1}
                    </p>
                  )}
                  {product.attr2 && (
                    <p className="text-sm text-gray-400">{product.attr2}</p>
                  )}
                  {product.isSet && (
                    <span className="inline-block mt-1 text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded">
                      セット商品
                    </span>
                  )}
                </div>

                {/* チェックリスト */}
                <div className="border border-gray-800 rounded-b-xl overflow-hidden">
                  {allCheckItems
                    .filter((item) => !item.isAlert && item.key.startsWith(`p${pIdx}_${product.code}_`))
                    .map((item) => {
                      const checked = !!orderChecks[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => handlePackingSetToggle(mgmtNo, item.key)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-800 
                                      last:border-b-0 min-h-[56px] transition-colors ${
                            checked ? "bg-gray-900/50" : "bg-gray-900 hover:bg-gray-800"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                            checked ? "bg-blue-600 border-blue-500" : "border-gray-600"
                          }`}>
                            {checked && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className={`flex-1 break-words ${checked ? "line-through text-gray-600" : "text-gray-200"}`}>
                            {item.label}
                          </span>
                          {item.total && (
                            <span className={`shrink-0 text-sm font-bold px-2 py-0.5 rounded ${
                              checked ? "bg-gray-800 text-gray-600" : "bg-blue-900 text-blue-300"
                            }`}>
                              {item.index}/{item.total}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部: 梱包完了ボタンのみ（移動は上部の矢印から） */}
        <div className="sticky bottom-0 bg-gray-950 border-t border-gray-800 p-4">
          <div className="max-w-[780px] mx-auto">
            {isThisOrderDone ? (
              <button
                onClick={() => handleUncompleteOrder(mgmtNo)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-emerald-300 py-4 
                           rounded-xl text-lg font-bold min-h-[56px] border-2 border-emerald-700"
              >
                ✓ 梱包完了済み（タップで取り消して再編集）
              </button>
            ) : (
              <>
                <button
                  onClick={() => allItemsChecked && handleCompleteOrder(mgmtNo)}
                  disabled={!allItemsChecked}
                  className={`w-full py-4 rounded-xl text-lg font-bold min-h-[56px] transition-all ${
                    allItemsChecked
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-blue-950/50 text-blue-300/30 cursor-not-allowed border border-blue-900/50"
                  }`}
                >
                  梱包完了して次へ
                </button>
                {!allItemsChecked && (
                  <p className="text-center text-amber-400 text-sm mt-2">
                    あと {uncheckedCount} 項目チェックしてください（{checkedCount}/{allCheckItems.length}）
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

  // ============================================================
  // 梱包完了サマリー
  // ============================================================

  if (phase === "packingSummary" && carrierData) {
    // ============================================================
    // RPG梱包モード: クリア画面
    // ============================================================
    if (rpgMode) {
      // 別キャリアが残っていれば「つぎの びんへ」を出す
      const otherKey = selectedCarrier === "takkyubin" ? "nekopos" : "takkyubin";
      const other = parsedData?.[otherKey];
      const nextCarrier =
        other && other.totalOrders > 0
          ? { label: other.label, count: other.totalOrders }
          : null;

      return (
        <QuestClearScreen
          carrierLabel={carrierData.label}
          defeated={questResult.defeated}
          totalItems={questResult.totalItems}
          totalExp={questResult.totalExp}
          // 経過時間の起点。取込時刻が取れない場合は現在時刻を渡し、
          // 「1ふん」と表示されるだけで画面は壊れない
          startedAtIso={activeSession?.uploadedAt ?? new Date().toISOString()}
          nextCarrier={nextCarrier}
          onNextCarrier={() => handleCarrierSelect(otherKey)}
          onBackToHome={handleBackToHome}
        />
      );
    }

    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-[780px] w-full text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h2 className="text-2xl font-bold text-blue-400 mb-2">全注文の梱包が完了しました</h2>
          <p className="text-gray-400 mb-8">
            {carrierData.label} ─ {carrierData.totalOrders}件
          </p>

          <div className="space-y-3">
            {/* 別キャリアがあればそちらへ */}
            {parsedData && selectedCarrier === "takkyubin" && parsedData.nekopos.totalOrders > 0 && (
              <button
                onClick={() => handleCarrierSelect("nekopos")}
                className="w-full bg-amber-700 hover:bg-amber-600 text-white py-4 
                           rounded-xl text-lg font-bold min-h-[56px]"
              >
                ✉️ ネコポス（{parsedData.nekopos.totalOrders}件）を開始
              </button>
            )}
            {parsedData && selectedCarrier === "nekopos" && parsedData.takkyubin.totalOrders > 0 && (
              <button
                onClick={() => handleCarrierSelect("takkyubin")}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white py-4 
                           rounded-xl text-lg font-bold min-h-[56px]"
              >
                📦 宅急便（{parsedData.takkyubin.totalOrders}件）を開始
              </button>
            )}
            <button
              onClick={handleBackToHome}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-4 
                         rounded-xl text-lg min-h-[56px]"
            >
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 画像モーダル（全フェーズで表示可能）
  // ============================================================

  const imageModal = imageModalUrl && (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={() => setImageModalUrl(null)}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setImageModalUrl(null)}
          className="absolute -top-3 -right-3 bg-gray-700 hover:bg-gray-600 text-white 
                     w-10 h-10 rounded-full text-xl z-10 flex items-center justify-center"
        >
          ✕
        </button>
        <img
          src={imageModalUrl ?? undefined}
          alt="商品画像"
          className="max-w-full max-h-[85vh] rounded-xl object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "";
            (e.target as HTMLImageElement).alt = "画像の読み込みに失敗しました";
          }}
        />
      </div>
    </div>
  );

  // ============================================================
  // フォールバック
  // ============================================================

  return (
    <>
      {imageModal}
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">予期しない状態です</p>
          <button
            onClick={handleBackToHome}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl min-h-[48px]"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </>
  );
}