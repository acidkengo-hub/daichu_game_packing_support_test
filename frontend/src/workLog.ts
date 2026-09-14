/**
 * 梱包作業の記録ロジック
 *
 * 画面には一切表示しない。記録は作業開始の操作と同時に強制的に始まり、
 * 作業者には計測されていることを意識させない（要求仕様 4-2(1)）。
 *
 * このファイルは「いつ何が起きたか」を計算するだけで、
 * 送信は workLogQueue.ts が担当する。分けている理由は、
 * 通信が切れても計算は続けられるようにするため（要求仕様 8章 可用性）。
 */

// ===== 型 =====

/** 便 */
export type Bin = "午前便" | "午後便";

/** 配送方法。内部のキャリア名ではなく、記録に残す表記で持つ */
export type CarrierLabel = "宅急便" | "ネコポス";

/** ピッキングの種別（要求仕様 4-2(4)） */
export type PickingKind = "あり" | "なし" | "スキップ";

/** 回の終わり方（要求仕様 4-3(2)） */
export type EndKind = "担当終了" | "交替" | "全完了" | "自動終了";

/** 記録中の1回分の状態 */
export interface WorkSession {
  /** 日付（yyyy-MM-dd）。日をまたぐ作業は起きない前提（要求仕様 2章） */
  date: string;
  bin: Bin;
  carrier: CarrierLabel;
  worker: string;

  /** この回で「作業開始」を押した時刻（ミリ秒） */
  startedAt: number;

  /**
   * 伝票の時間を数え始める起点（ミリ秒）。
   * 「梱包から作業開始」なら作業開始の時点、
   * 「ピッキングから作業開始」なら梱包画面へ進んだ時点（要求仕様 4-2(5)）。
   * ピッキング中はまだ決まらないので null。
   */
  packingBaseAt: number | null;

  /** 直前の完了時刻（ミリ秒）。まだ1件も完了していなければ null */
  lastDoneAt: number | null;

  /** ピッキングを始めた時刻（ミリ秒）。「梱包から作業開始」なら null */
  pickingStartedAt: number | null;

  /** この回のピッキング種別 */
  picking: PickingKind;

  /** この回のピッキング時間の合計（秒） */
  pickingSec: number;

  /** この回で完了した件数。0件のまま終わった回は記録を残さない（要求仕様 4-2(3)） */
  doneCount: number;

  /** 最後に梱包の操作をした時刻（ミリ秒）。120分の自動終了の判定に使う */
  lastActionAt: number;

  /**
   * 入れ直しの区間。取り消してから再完了するまでの時間を覚えておき、
   * 次の伝票の時間から差し引く（要求仕様 4-2(6)）。
   */
  redoSpans: Array<{ from: number; to: number | null }>;

  /**
   * 完了した伝票の記録。取り消しのときに、どの送信を取り消すかを特定する。
   * キーは管理番号。
   */
  slipIds: Record<string, string>;

  /**
   * 取り消し中の管理番号。再完了したときに、それが入れ直しだと判別する。
   *
   * 入れ直しは「次の伝票の起点」にしてはいけない。
   * 取り消した伝票をやり直している間も、次の伝票の作業は続いているため
   * （要求仕様 4-2(6)）。
   */
  redoingOrderIds: string[];
}

/** localStorage に入れる全体の形 */
interface WorkLogState {
  session: WorkSession | null;
}

// ===== 定数 =====

const STORAGE_KEY = "game-packing-worklog";

/** 操作が途絶えてから自動終了までの時間（要求仕様 4-2(9)） */
export const AUTO_END_MS = 120 * 60 * 1000;

// ===== 保存と読み込み =====

/**
 * 記録中の状態を読み込む。
 *
 * 再読み込みやスリープの後もここから復帰する（要求仕様 4-2(12)、例外#14）。
 * 日付が変わっていた場合は、その回を捨てる。
 * 梱包作業が日付をまたぐことはない前提のため、
 * 日付が違う状態が残っていたら、前日の閉じ忘れとみなす。
 */
export function loadSession(): WorkSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const state = JSON.parse(raw) as WorkLogState;
    const session = state.session;
    if (!session) return null;

    if (session.date !== today()) return null;

    // 後から項目を足したときに、古い保存データで undefined にならないよう補う。
    // （README 9章「localStorage の読み込みには後方互換の補完を入れる」）
    return {
      ...session,
      redoSpans: session.redoSpans ?? [],
      slipIds: session.slipIds ?? {},
      redoingOrderIds: session.redoingOrderIds ?? [],
      pickingSec: session.pickingSec ?? 0,
      doneCount: session.doneCount ?? 0,
    };
  } catch (e) {
    console.error(
      "[workLog] 記録中の状態を読めませんでした\n" +
        "　→ DevTools → Application → Local Storage の " +
        STORAGE_KEY +
        " を確認してください",
      e
    );
    return null;
  }
}

/** 記録中の状態を保存する。null を渡すと記録中でなくなる */
export function saveSession(session: WorkSession | null): void {
  try {
    const state: WorkLogState = { session };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error(
      "[workLog] 記録中の状態を保存できませんでした\n" +
        "　→ localStorage の容量を確認してください。" +
        "梱包作業自体は続けられます",
      e
    );
  }
}

// ===== 記録の開始 =====

/**
 * 作業を開始する。
 *
 * fromPicking が true なら「ピッキングから作業開始」。
 * このときは梱包画面へ進むまで伝票の時間を数え始めない（要求仕様 4-2(5)）。
 */
export function startSession(params: {
  bin: Bin;
  carrier: CarrierLabel;
  worker: string;
  fromPicking: boolean;
  now?: number;
}): WorkSession {
  const now = params.now ?? Date.now();

  return {
    date: today(now),
    bin: params.bin,
    carrier: params.carrier,
    worker: params.worker,
    startedAt: now,
    packingBaseAt: params.fromPicking ? null : now,
    lastDoneAt: null,
    pickingStartedAt: params.fromPicking ? now : null,
    picking: params.fromPicking ? "あり" : "なし",
    pickingSec: 0,
    doneCount: 0,
    lastActionAt: now,
    redoSpans: [],
    slipIds: {},
    redoingOrderIds: [],
  };
}

/**
 * ピッキングを終えて梱包画面へ進んだ。
 *
 * skipped が true なら、全部チェックせずスキップで進んだということ。
 * ここで初めて伝票の時間の起点が決まる。
 */
export function enterPacking(
  session: WorkSession,
  skipped: boolean,
  now: number = Date.now()
): WorkSession {
  const next = { ...session, lastActionAt: now };

  if (session.pickingStartedAt !== null) {
    next.pickingSec =
      session.pickingSec + Math.round((now - session.pickingStartedAt) / 1000);
    next.pickingStartedAt = null;
    next.picking = skipped ? "スキップ" : "あり";
  }

  // すでに梱包していた場合（前後移動で戻ってきた等）は起点を動かさない。
  // 動かすと、それまで数えていた時間が消える。
  if (next.packingBaseAt === null) {
    next.packingBaseAt = now;
  }

  return next;
}

// ===== 伝票の完了 =====

/** 伝票1件の完了を記録した結果 */
export interface SlipResult {
  session: WorkSession;
  /** 送信する内容。呼び出し側が workLogQueue に渡す */
  event: {
    type: "slip";
    id: string;
    date: string;
    bin: Bin;
    carrier: CarrierLabel;
    worker: string;
    orderId: string;
    items: string[];
    doneAt: string;
    startedAt: string;
    durationSec: number;
  };
}

/**
 * 伝票を1件完了した。
 *
 * 伝票の時間 ＝ 直前の完了からこの完了までの経過
 *            − その間に行われた入れ直しの時間（要求仕様 4-2(6)）
 *
 * この引き算により、取り消しをはさんでも時間の途切れも二重計上も生まれない。
 */
export function completeSlip(
  session: WorkSession,
  params: { orderId: string; items: string[]; now?: number }
): SlipResult {
  const now = params.now ?? Date.now();

  // この伝票が取り消されたものを入れ直しているのかを先に判定する。
  const isRedo = session.redoingOrderIds.includes(params.orderId);

  // 起点がまだ決まっていない場合（ピッキング中に完了が来ることは通常ないが）、
  // この完了時刻を起点にして0秒として扱う。
  const from = session.lastDoneAt ?? session.packingBaseAt ?? now;

  let durationSec: number;
  let redoSpans = session.redoSpans;

  if (isRedo) {
    // 入れ直しの行。取り消した時点から再完了までを数える（要求仕様 4-2(6)）。
    const span = [...redoSpans].reverse().find((s) => s.to === null);
    const redoFrom = span ? span.from : now;
    durationSec = Math.max(0, Math.round((now - redoFrom) / 1000));

    // 区間を閉じる。次の伝票の時間から、この分が差し引かれる。
    let closed = false;
    redoSpans = redoSpans
      .slice()
      .reverse()
      .map((s) => {
        if (!closed && s.to === null) {
          closed = true;
          return { ...s, to: now };
        }
        return s;
      })
      .reverse();
  } else {
    // 通常の完了。直前の完了からこの完了まで、
    // その間に行われた入れ直しの時間を差し引く（要求仕様 4-2(6)）。
    const elapsed = now - from;
    const redo = redoMsWithin(redoSpans, from, now);
    durationSec = Math.max(0, Math.round((elapsed - redo) / 1000));

    // 使い終わった区間は捨てる。残すと次の伝票でも引かれてしまう。
    redoSpans = redoSpans.filter((s) => s.to === null);
  }

  const id = newEventId();

  const next: WorkSession = {
    ...session,
    // 入れ直しでは直前の完了を動かさない。
    // 動かすと、途切れず続いている次の伝票の作業が0秒になる。
    lastDoneAt: isRedo ? session.lastDoneAt : now,
    lastActionAt: now,
    doneCount: session.doneCount + 1,
    slipIds: { ...session.slipIds, [params.orderId]: id },
    redoSpans,
    redoingOrderIds: session.redoingOrderIds.filter(
      (o) => o !== params.orderId
    ),
  };

  return {
    session: next,
    event: {
      type: "slip",
      id,
      date: session.date,
      bin: session.bin,
      carrier: session.carrier,
      worker: session.worker,
      orderId: params.orderId,
      items: params.items,
      doneAt: toIso(now),
      startedAt: toIso(session.startedAt),
      durationSec,
    },
  };
}

/** 完了を取り消した結果 */
export interface CancelResult {
  session: WorkSession;
  event: {
    type: "cancel";
    id: string;
    date: string;
    bin: Bin;
    carrier: CarrierLabel;
    worker: string;
    slipId: string;
  } | null;
}

/**
 * 完了を取り消した。
 *
 * 記録中に送った完了であれば、その送信を取り消す指示を出す。
 * 記録していない伝票（担当終了後の取り寄せ品など）は event が null になる。
 */
export function cancelSlip(
  session: WorkSession,
  orderId: string,
  now: number = Date.now()
): CancelResult {
  const slipId = session.slipIds[orderId];

  const next: WorkSession = {
    ...session,
    lastActionAt: now,
    doneCount: Math.max(0, session.doneCount - 1),
    // 入れ直しの開始。再完了するまで to は null のまま。
    redoSpans: [...session.redoSpans, { from: now, to: null }],
    // この伝票を再び完了したら「入れ直し」だと分かるようにする
    redoingOrderIds: [...session.redoingOrderIds, orderId],
  };

  // 取り消した伝票を「まだ完了していない」状態に戻す
  const slipIds = { ...next.slipIds };
  delete slipIds[orderId];
  next.slipIds = slipIds;

  if (!slipId) {
    return { session: next, event: null };
  }

  return {
    session: next,
    event: {
      type: "cancel",
      id: newEventId(),
      date: session.date,
      bin: session.bin,
      carrier: session.carrier,
      worker: session.worker,
      slipId,
    },
  };
}

/**
 * 梱包の操作があったことを記録する（チェックを入れる等）。
 *
 * 120分の自動終了の判定に使う。画面に触れただけ（スクロール等）では
 * 呼ばないこと（要求仕様 4-2(9)）。
 */
export function touch(
  session: WorkSession,
  now: number = Date.now()
): WorkSession {
  return { ...session, lastActionAt: now };
}

// ===== 記録の終了 =====

/** 回を終えた結果 */
export interface EndResult {
  /** 記録中でなくなるので常に null */
  session: null;
  /**
   * 送信する内容。1件も完了していない回は記録を残さないため null
   * （要求仕様 4-2(3)、例外#10）
   */
  event: {
    type: "session";
    id: string;
    date: string;
    bin: Bin;
    carrier: CarrierLabel;
    worker: string;
    startedAt: string;
    endedAt: string;
    endKind: EndKind;
    picking: PickingKind;
    pickingSec: number;
  } | null;
}

/**
 * 回を終える。
 *
 * 終了時刻は「最後の梱包完了」の時刻を使う（要求仕様 4-2(3)）。
 * 担当終了を押した時刻ではない。押すまでの間は作業していないため。
 */
export function endSession(
  session: WorkSession,
  endKind: EndKind,
  now: number = Date.now()
): EndResult {
  if (session.doneCount === 0) {
    return { session: null, event: null };
  }

  // ピッキングの途中で終えた場合も、そこまでの時間は数える
  let pickingSec = session.pickingSec;
  if (session.pickingStartedAt !== null) {
    pickingSec += Math.round((now - session.pickingStartedAt) / 1000);
  }

  return {
    session: null,
    event: {
      type: "session",
      id: newEventId(),
      date: session.date,
      bin: session.bin,
      carrier: session.carrier,
      worker: session.worker,
      startedAt: toIso(session.startedAt),
      endedAt: toIso(session.lastDoneAt ?? now),
      endKind,
      picking: session.picking,
      pickingSec,
    },
  };
}

/**
 * 自動終了すべきかを判定する。
 *
 * 記録中に梱包の操作が120分なかった場合、最後の完了時刻で終了したことにする。
 * 休憩は最長60分のため、休憩で自動終了することは想定しない（要求仕様 4-2(9)）。
 */
export function shouldAutoEnd(
  session: WorkSession,
  now: number = Date.now()
): boolean {
  return now - session.lastActionAt >= AUTO_END_MS;
}

// ===== 作業者の変更 =====

/** 作業者を変更した結果 */
export interface ChangeWorkerResult {
  session: WorkSession;
  /** 交替の場合、前の作業者の回を閉じる送信内容。修正の場合は null */
  event: EndResult["event"];
  /** 交替（true）か、選び間違いの修正（false）か */
  isHandover: boolean;
}

/**
 * 作業者を変更する。
 *
 * 1件も完了していなければ「修正」とみなし、記録の作業者を上書きする。
 * 1件以上完了していれば「交替」とみなし、
 * 前の作業者の回を閉じて新しい回を始める（要求仕様 4-2(7)）。
 */
export function changeWorker(
  session: WorkSession,
  newWorker: string,
  now: number = Date.now()
): ChangeWorkerResult {
  if (session.doneCount === 0) {
    // 修正。時間の起点はそのまま引き継ぐ。
    // 名前を選び間違えただけで、作業は続いているため。
    return {
      session: { ...session, worker: newWorker, lastActionAt: now },
      event: null,
      isHandover: false,
    };
  }

  // 交替。前の回を閉じ、新しい回を始める。
  const ended = endSession(session, "交替", now);

  const next: WorkSession = {
    ...session,
    worker: newWorker,
    startedAt: now,
    // 新しい作業者の1件目は、交替した時点から数える
    packingBaseAt: now,
    lastDoneAt: null,
    pickingStartedAt: null,
    // ピッキングは引き継がない。新しい作業者はピッキングをしていない。
    picking: "なし",
    pickingSec: 0,
    doneCount: 0,
    lastActionAt: now,
    redoSpans: [],
    slipIds: {},
    redoingOrderIds: [],
  };

  return { session: next, event: ended.event, isHandover: true };
}

// ===== 小さな道具 =====

/** yyyy-MM-dd 形式の日付。GAS 側もこの形式で受け取る */
export function today(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * ミリ秒を ISO 形式の文字列にする。
 * タイムゾーンの表記を含めることで、GAS 側で時刻がずれない。
 */
export function toIso(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * 送信ごとの一意なID。
 * GAS 側はこのIDで重複を弾くため、再送しても二重に記録されない。
 */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // randomUUID が無い環境向けの代替。iPad Safari は対応しているが、
  // 念のため用意しておく。
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * from〜to の間に含まれる「入れ直しの時間」を合計する（ミリ秒）。
 *
 * 区間が一部だけ重なる場合は、重なった分だけを数える。
 * まだ再完了していない区間（to が null）は、to を now とみなす。
 */
function redoMsWithin(
  spans: Array<{ from: number; to: number | null }>,
  from: number,
  to: number
): number {
  let total = 0;
  for (const span of spans) {
    const spanTo = span.to ?? to;
    const start = Math.max(span.from, from);
    const end = Math.min(spanTo, to);
    if (end > start) total += end - start;
  }
  return total;
}