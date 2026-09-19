/**
 * 作業記録の送信キュー
 *
 * 記録の計算は workLog.ts、送信はこのファイルが担当する。
 * 分けている理由は、通信が切れても計算は続けられるようにするため
 * （要求仕様 8章 可用性）。
 *
 * 【重要】未送信の記録は、既存の作業データとは別のキーに保存する。
 * 「新しい日を開始（全データ削除）」で消えてはいけないため（例外#16）。
 */

// ===== 型 =====

/** 送信する出来事。workLog.ts が作ったものをそのまま受け取る */
export type WorkLogEvent = Record<string, unknown> & { id: string };

/** 送信先の設定 */
export interface QueueConfig {
  url: string;
  key: string;
}

// ===== 定数 =====

/**
 * 未送信の記録を置く場所。
 * 既存の作業データ（WorkDay）とは別のキーにすること。
 * 全データ削除でこのキーを消さないよう、App 側でも注意する。
 */
const QUEUE_KEY = "game-packing-worklog-queue";

/** 送信先の設定を置く場所。登録キーを含むため、コードには書かない（§4-3） */
const CONFIG_KEY = "game-packing-worklog-config";

/**
 * 作業者の一覧を端末に控えておく場所。
 *
 * GAS の応答は、ページ内の fetch から読むと不定期に404になる
 * （2026-09-16 に実測。ブラウザで直接開く、curl で叩く、では成功する）。
 * 読めなかったときに作業が止まらないよう、前回読めた一覧を使う。
 * 要求仕様 8章「通信が切れても梱包作業は続けられる」に沿う。
 */
const WORKERS_CACHE_KEY = "game-packing-workers-cache";

/** 溜めてから送るまでの待ち時間（ミリ秒） */
const FLUSH_DELAY_MS = 3000;

/** 失敗したときに次に試すまでの時間（ミリ秒） */
const RETRY_DELAY_MS = 60 * 1000;

/** 1回に送る最大件数。多すぎると GAS の実行時間を超える */
const MAX_BATCH = 30;

// ===== 設定の読み書き =====

/**
 * 送信先の設定を読む。
 *
 * ⚠️ 登録キーは暗号化されずに localStorage に保存される。
 * iPad を手に取って開発者ツールを使える人なら読める。
 * 店内の共用 iPad という前提で、この水準を許容している（2026-09 の判断）。
 */
export function loadConfig(): QueueConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as QueueConfig;
    if (!config.url || !config.key) return null;
    return config;
  } catch (e) {
    console.error(
      "[workLogQueue] 設定を読めませんでした\n" +
        "　→ 設定画面から登録キーを入力し直してください",
      e
    );
    return null;
  }
}

export function saveConfig(config: QueueConfig | null): void {
  if (config === null) {
    localStorage.removeItem(CONFIG_KEY);
    return;
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/** 記録が有効かどうか。設定が入っていなければ記録しない */
export function isConfigured(): boolean {
  return loadConfig() !== null;
}

// ===== キューの読み書き =====

function loadQueue(): WorkLogEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const queue = JSON.parse(raw) as WorkLogEvent[];
    return Array.isArray(queue) ? queue : [];
  } catch (e) {
    console.error(
      "[workLogQueue] 未送信の記録を読めませんでした\n" +
        "　→ DevTools → Application → Local Storage の " +
        QUEUE_KEY +
        " を確認してください",
      e
    );
    return [];
  }
}

function saveQueue(queue: WorkLogEvent[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error(
      "[workLogQueue] 未送信の記録を保存できませんでした\n" +
        "　→ localStorage の容量を確認してください。" +
        "梱包作業自体は続けられます",
      e
    );
  }
}

/** 未送信の件数。設定画面で状況を見るために使う */
export function pendingCount(): number {
  return loadQueue().length;
}

// ===== 送信 =====

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sending = false;

/**
 * 出来事をキューに入れる。
 *
 * すぐには送らず、少し待ってからまとめて送る。
 * 伝票を完了するたびに送ると、繁忙期100件超の日に通信が増えるため。
 */
export function enqueue(event: WorkLogEvent | null): void {
  if (!event) return;
  if (!isConfigured()) return;

  const queue = loadQueue();
  queue.push(event);
  saveQueue(queue);

  scheduleFlush(FLUSH_DELAY_MS);
}

/** 送信を予約する。すでに予約があれば何もしない */
function scheduleFlush(delay: number): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, delay);
}

/**
 * 溜まっている記録を送る。
 *
 * 【応答を読まない理由】
 * GAS は応答を script.googleusercontent.com の使い捨てURLへ転送するが、
 * POST 経由だとその転送先が不定期に404を返す（2026-09-14 に実測）。
 * 一方、書き込み自体は成功している（HTMLが返った回もシートに記録されていた）。
 * そのため「送れたら成功」とみなし、応答を待たずにキューから消す。
 *
 * 誤って消してしまうリスクより、永久に再送し続けるリスクの方が大きい。
 * 同じ記録を何度送っても、受け側がIDで重複を弾くため二重記録にはならない。
 *
 * 失敗しても例外を投げない。梱包作業を止めないため（要求仕様 8章）。
 */
export async function flush(): Promise<void> {
  if (sending) return;

  const config = loadConfig();
  if (!config) return;

  const queue = loadQueue();
  if (queue.length === 0) return;

  sending = true;
  const batch = queue.slice(0, MAX_BATCH);
  const batchIds = new Set(batch.map((e) => e.id));

  try {
    await fetch(config.url, {
      method: "POST",
      // application/json にすると、ブラウザが事前確認の通信を挟む。
      // GAS はそれに応答できないため、通信自体が失敗する。
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        key: config.key,
        action: "log",
        events: batch,
      }),
      // 応答は読めないので、読もうとしない。
      // no-cors にすると転送先の404で例外にならず、
      // 「送信できた」ことだけが分かる。
      mode: "no-cors",
    });

    // ここに来たら、少なくとも送信は完了している。
    // この間に増えた分を消さないよう、読み直してから絞り込む。
    const current = loadQueue();
    saveQueue(current.filter((e) => !batchIds.has(e.id)));

    // まだ残っていれば続けて送る
    if (loadQueue().length > 0) {
      scheduleFlush(FLUSH_DELAY_MS);
    }
  } catch (e) {
    // 通信の切断はここに来る。キューはそのまま残り、後で再送される
    // （例外#15）。梱包作業は止めない。
    console.warn(
      "[workLogQueue] 送信できませんでした。後で再送します\n" +
        `　→ 未送信 ${loadQueue().length} 件`,
      e
    );
    scheduleFlush(RETRY_DELAY_MS);
  } finally {
    sending = false;
  }
}

/**
 * 再送の仕組みを動かし始める。
 *
 * ツールを開いたときに1回呼ぶ。前回の未送信分がここで送られる。
 * 通信が戻ったときにも送る（オフラインからの復帰）。
 */
export function startQueue(): void {
  if (pendingCount() > 0) {
    scheduleFlush(FLUSH_DELAY_MS);
  }

  window.addEventListener("online", () => {
    if (pendingCount() > 0) scheduleFlush(0);
  });

  // 画面に戻ってきたときにも試す。
  // iPad はスリープ中にタイマーが止まるため、復帰の合図が要る。
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && pendingCount() > 0) {
      scheduleFlush(FLUSH_DELAY_MS);
    }
  });
}

// ===== 作業者の一覧 =====

/**
 * JSONP で読み取る。
 *
 * 【なぜ fetch ではなく script タグなのか】
 * GAS は応答を script.googleusercontent.com へ転送する。
 * ページ内の fetch はこの転送先で 404 になる。
 * fetch の credentials は既定で same-origin のため、
 * 別ドメインである転送先へ Cookie が送られないことが原因と見られる
 * （2026-09-16 に調査。アドレスバーから開く、curl で叩く場合は成功する）。
 *
 * script タグによる読み込みは、アドレスバーと同じ扱いで転送に追従するため、
 * この制約を受けない。
 *
 * 【なぜ登録キーを付けないのか】
 * URLに残ると履歴やログに記録される。
 * 読めるのは作業者の名前一覧だけで、記録は一切返さない設計にしてある。
 */
function getJsonp<T>(url: string, action: string, timeoutMs = 5000): Promise<T | null> {
  return new Promise((resolve) => {
    // 呼び出しごとに違う名前を使う。
    // 同じ名前を使い回すと、遅れて届いた古い応答が新しい呼び出しを上書きする。
    const name = `__workLogCb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);

      // 関数はすぐに消さない。
      // 諦めた後に応答が届くと、参照エラーが出るため
      // （通信が遅いときに実際に発生。2026-09-19）。
      // 中身を空にしておき、少し待ってから消す。
      (window as unknown as Record<string, unknown>)[name] = () => {};
      setTimeout(() => {
        delete (window as unknown as Record<string, unknown>)[name];
      }, 60000);
    };

    // 応答が来ないまま終わる場合に備える。
    // 後始末をしないと、script タグと関数が残り続ける。
    const timer = setTimeout(() => {
      console.warn(
        `[workLogQueue] ${action} の応答がありませんでした（${timeoutMs / 1000}秒）\n` +
          "　→ 通信の状態を確認してください"
      );
      cleanup();
      resolve(null);
    }, timeoutMs);

    (window as unknown as Record<string, unknown>)[name] = (data: T) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      console.error(
        `[workLogQueue] ${action} を読み込めませんでした\n` +
          "　→ 設定画面のURLと、通信の状態を確認してください"
      );
      cleanup();
      resolve(null);
    };

    script.src =
      `${url}?action=${encodeURIComponent(action)}&callback=${name}`;
    document.head.appendChild(script);
  });
}

/**
 * 作業者の一覧を取り出す。
 *
 * 記録（時刻・伝票）は読み出さない。名前の一覧だけを読む例外
 * （2台のiPadで同じ一覧を使うため。要求仕様 4-3(4)）。
 */
/**
 * 作業者の一覧を取り出す。
 *
 * 記録（時刻・伝票）は読み出さない。名前の一覧だけを読む例外
 * （2台のiPadで同じ一覧を使うため。要求仕様 4-3(4)）。
 *
 * 読めたら端末に控える。読めなければ前回の控えを返す。
 * 控えもなければ null（初回に通信できなかった場合のみ）。
 */
/**
 * 作業者の一覧を取り出す。
 *
 * 記録（時刻・伝票）は読み出さない。名前の一覧だけを読む例外
 * （2台のiPadで同じ一覧を使うため。要求仕様 4-3(4)）。
 *
 * GAS の応答は断続的に失敗する（2026-09-19 に実測）。
 * JSONP にしたことで頻度は下がったが、ゼロにはならない。
 * そこで次の順に手を尽くす。
 *   1. 読む
 *   2. 失敗したら1度だけやり直す
 *   3. それでも駄目なら前回の控えを使う
 *
 * 2 を入れたのは、初回は控えが無く、
 * 失敗すると担当者を選べなくなるため。
 */
export async function fetchWorkers(): Promise<string[] | null> {
  const config = loadConfig();
  if (!config) return null;

  let result = await getJsonp<{ ok: boolean; workers?: string[] }>(
    config.url,
    "workers.list"
  );

  // 1度だけやり直す。すぐ再試行すると同じ理由で失敗しやすいので少し待つ。
  if (!result || !result.ok) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await getJsonp<{ ok: boolean; workers?: string[] }>(
      config.url,
      "workers.list"
    );
  }

  if (result && result.ok && result.workers) {
    saveWorkersCache(result.workers);
    return result.workers;
  }

  // 読めなかった。前回の控えで代替する。
  const cached = loadWorkersCache();
  if (cached) {
    console.warn(
      `[workLogQueue] 担当者の一覧を読めなかったため、前回の一覧を使います（${cached.length}名）`
    );
    return cached;
  }

  return null;
}

/**
 * 端末に控えた作業者の一覧を読む。
 *
 * 画面はまずこれを表示し、裏で fetchWorkers を呼んで更新する。
 * 毎回サーバーから読むと、短時間に繰り返したとき失敗しやすい
 * （2026-09-19 に実測。5回中2回が5秒以内に返らなかった）。
 * 作業者の顔ぶれは1日に何度も変わらないので、控えで十分。
 */
export function cachedWorkers(): string[] | null {
  return loadWorkersCache();
}

function loadWorkersCache(): string[] | null {
  try {
    const raw = localStorage.getItem(WORKERS_CACHE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) && list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

/** 作業者の一覧を端末に控える */
function saveWorkersCache(workers: string[]): void {
  try {
    localStorage.setItem(WORKERS_CACHE_KEY, JSON.stringify(workers));
  } catch (e) {
    console.warn("[workLogQueue] 担当者の一覧を控えられませんでした", e);
  }
}

/**
 * 作業者を追加する。
 *
 * 書き込みなので POST。応答は読めないため、
 * 少し待ってから GET で一覧を取り直し、反映されたかを確かめる。
 */
export async function addWorker(name: string): Promise<string[] | null> {
  return changeWorkers("workers.add", name);
}

/** 作業者を一覧から外す。過去の記録は残る（要求仕様 4-3(4)） */
export async function removeWorker(name: string): Promise<string[] | null> {
  return changeWorkers("workers.remove", name);
}

async function changeWorkers(
  action: string,
  name: string
): Promise<string[] | null> {
  const config = loadConfig();
  if (!config) return null;

  const label = action === "workers.add" ? "追加" : "削除";

  try {
    await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: config.key, action, name }),
      mode: "no-cors",
    });
  } catch (e) {
    console.error(
      `[workLogQueue] 作業者の${label}を送れませんでした\n` +
        "　→ 通信の状態を確認してください",
      e
    );
    return null;
  }

  // 書き込みが反映されるまで少し待つ。
  // GAS の処理が終わる前に読むと、変更前の一覧が返ってくる。
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 取り直しに失敗すると古い控えが返り、追加・削除が反映されていないように見える。
  // その場合は控えを捨ててから読み直す。
  const before = loadWorkersCache();
  const after = await fetchWorkers();

  if (after && before && after.join() === before.join()) {
    console.warn(
      "[workLogQueue] 一覧が変わっていません。" +
        "反映に時間がかかっているか、登録キーが違う可能性があります"
    );
  }

  return after;
}

/**
 * 設定が正しいかを確かめる。設定画面で使う。
 *
 * ⚠️ 確かめられるのは「URLが正しく、GASが動いていること」まで。
 * 登録キーが正しいかは、書き込みの応答が読めないため確認できない。
 * キーの確認は、作業者を1名追加してみて一覧に現れるかで判定する。
 */
export async function testConnection(
  config: QueueConfig
): Promise<{ ok: boolean; message: string }> {
  const result = await getJsonp<{ ok: boolean; workers?: string[] }>(
    config.url,
    "workers.list"
  );

  if (!result) {
    return {
      ok: false,
      message: "つながりませんでした。URLと通信の状態を確認してください",
    };
  }

  if (!result.ok) {
    return { ok: false, message: "応答が不正です。URLを確認してください" };
  }

  // 接続を確認できたら、この機会に控えを作っておく。
  // iPad のセットアップ時に必ず通る経路なので、
  // 以降は読み取りに失敗しても担当者を選べる。
  if (result.workers && result.workers.length > 0) {
    saveWorkersCache(result.workers);
  }

  return {
    ok: true,
    message: `つながりました（作業者 ${result.workers?.length ?? 0} 名）`,
  };
}

/**
 * 登録キーが正しいかを確かめる。
 *
 * 仮の名前を追加してみて、一覧に現れるかで判定する。
 * 現れたらキーは正しいので、その名前を削除して元に戻す。
 *
 * 書き込みの応答が読めない以上、実際に書いてみるしか確かめる方法がない。
 */
export async function testKey(
  config: QueueConfig
): Promise<{ ok: boolean; message: string }> {
  const probe = `__確認用_${Date.now()}`;

  const saved = loadConfig();
  saveConfig(config);

  try {
    const after = await addWorker(probe);

    if (!after) {
      return {
        ok: false,
        message: "確認できませんでした。通信の状態を確認してください",
      };
    }

    if (!after.includes(probe)) {
      return {
        ok: false,
        message: "登録キーが違います。設定画面で入力し直してください",
      };
    }

    // 後始末。確認用の名前を消す。
    await removeWorker(probe);
    return { ok: true, message: "登録キーは正しく設定されています" };
  } finally {
    if (!saved) saveConfig(config);
  }
}