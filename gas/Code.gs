/**
 * 梱包作業記録API — DAICHU Game Packing Support
 *
 * 梱包支援ツール（iPad）から送られてくる作業の記録を、
 * このスクリプトが紐づいているスプレッドシートに書き込む。
 *
 * 【重要】このスクリプトは「書き込み専用」に近い設計にしている。
 *   記録（時刻・伝票）を読み出す口は作らない。
 *   読み出せるのは作業者の名前一覧だけ（2台のiPadで同じ一覧を使うため）。
 *
 * 【原本の場所】
 *   リポジトリ game-packing-support の gas/Code.gs
 *   エディタ上で直接直したら、必ずリポジトリ側にも反映すること。
 */

// ===== 設定 =====

/** スクリプトプロパティのキー名（登録キーの保管場所） */
var PROP_KEY = "REGISTRATION_KEY";

/** 作業者一覧のシート名（月で分けない） */
var SHEET_WORKERS = "作業者";

/** 受信済みIDの控え（重複を弾くため。月で分けない） */
var SHEET_RECEIVED = "_受信ID";

/** 受信済みIDを保持する日数。これより古い控えは自動で捨てる */
var RECEIVED_KEEP_DAYS = 7;

/** 作業記録シートの列（1始まり。順番を変えたら COL_WORK_* も全部直すこと） */
var HEADER_WORK = [
  "日付",
  "便",
  "配送方法",
  "作業者",
  "開始時刻",
  "終了時刻",
  "件数",
  "作業時間(分)",
  "ピッキング",
  "ピッキング時間(分)",
  "終わり方",
];
var COL_WORK_DATE = 1;
var COL_WORK_BIN = 2;
var COL_WORK_CARRIER = 3;
var COL_WORK_WORKER = 4;
var COL_WORK_START = 5;
var COL_WORK_END = 6;
var COL_WORK_COUNT = 7;
var COL_WORK_MINUTES = 8;
var COL_WORK_PICKING = 9;
var COL_WORK_PICK_MIN = 10;
var COL_WORK_ENDKIND = 11;

/** 伝票シートの列（1始まり） */
var HEADER_SLIP = [
  "日付",
  "便",
  "配送方法",
  "管理番号",
  "商品名",
  "作業者",
  "完了時刻",
  "所要時間(秒)",
  "取り消し",
  "受信ID",
];
var COL_SLIP_ORDER = 4;
var COL_SLIP_CANCEL = 9;
var COL_SLIP_ID = 10;

/** ピッキングの強さ。大きいほど優先して残す（あり ＞ スキップ ＞ なし） */
var PICKING_RANK = { "なし": 0, "スキップ": 1, "あり": 2 };

/**
 * 書式なしテキストに固定する列（1始まり）。
 *
 * スプレッドシートは「2026-09-14」を日付に、「10:05:12」を時刻に、
 * 「00089769」を数値に、それぞれ自動で変換する。
 * 変換されると、読み戻したときに元の文字列と一致しなくなり、
 * 行の突き合わせ（findWorkRow）も時刻の大小比較も成立しない。
 *
 * 数値として扱う列（件数・作業時間・所要時間）は含めないこと。
 * 含めるとスプレッドシート上で合計や平均が計算できなくなる。
 */
var TEXT_COLUMNS = {
  "作業記録": [COL_WORK_DATE, COL_WORK_START, COL_WORK_END],
  "伝票": [1, COL_SLIP_ORDER, 7],  // 日付, 管理番号, 完了時刻
};

// ===== 入口 =====

/**
 * ブラウザで開いたときの応答。
 * 記録は一切返さない。デプロイが生きているかを目視で確かめるためだけのもの。
 */
/**
 * GET で読み取れるもの。
 *
 * 【なぜ GET なのか】
 * POST の応答はブラウザから読めない。GAS は応答を
 * script.googleusercontent.com の使い捨てURLへ転送するが、
 * POST 経由だとその転送先が 404 を返す（2026-09-14 に実測）。
 * GET 経由なら 200 で読める。
 *
 * 【なぜ登録キーを求めないのか】
 * GET でキーを渡すとURLに残り、ブラウザの履歴やログに記録される。
 * ここで読めるのは作業者の名前一覧だけで、
 * 時刻・伝票・管理番号といった記録は一切返さない。
 * 名前は店頭で働いている以上隠しきれる情報ではないと判断した
 * （辻川さんの判断、2026-09-14）。
 * 書き込みは引き続きキーで守るため、例外#20 は維持される。
 */
function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || "";
  var callback = params.callback || "";

  var result;

  if (action === "workers.list") {
    result = { ok: true, workers: listWorkers() };
  } else {
    // 既定の応答。デプロイされている版を外から確かめるための印。
    result = {
      ok: true,
      message: "梱包作業記録API は動作しています",
      build: "2026-09-16-jsonp",
      hasCellText: (typeof cellText === "function"),
    };
  }

  // callback が指定されていれば JSONP で返す。
  //
  // 【なぜ JSONP なのか】
  // GAS は応答を script.googleusercontent.com へ転送する。
  // ページ内の fetch はこの転送先で 404 になる。
  // fetch の credentials は既定で same-origin のため、
  // 別ドメインである転送先へ Cookie が送られないことが原因と見られる
  // （2026-09-16 に調査。アドレスバーから開く、curl で叩く場合は成功する）。
  //
  // <script> タグによる読み込みは、アドレスバーと同じ扱いで転送に追従するため、
  // この制約を受けない。
  //
  // ここで返すのは作業者の名前一覧だけで、
  // 時刻・伝票・管理番号といった記録は一切返さない。
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(result) + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return textJson(result);
}

/**
 * ツールからの送信を受ける唯一の入口。
 *
 * 本文は text/plain で送られてくる JSON。
 * （application/json にするとブラウザが事前確認の通信を挟み、
 *   GAS はそれに応答できないため通信自体が失敗する）
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // 2台のiPadが同時に送ると、同じ行を同時に書き換えて片方が消える。
    // 書き込みの間は1つずつ通す。
    lock.waitLock(30000);
  } catch (err) {
    return textJson({
      ok: false,
      error: "混み合っています（30秒待っても順番が来ませんでした）\n" +
        "　→ 端末側は未送信として保持し、後で再送してください",
    });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return textJson({
        ok: false,
        error: "本文が空です\n" +
          "　→ 送信側の fetch で body を指定しているか確認してください",
      });
    }

    var req;
    try {
      req = JSON.parse(e.postData.contents);
    } catch (err) {
      return textJson({
        ok: false,
        error: "本文をJSONとして読めませんでした\n" +
          "　→ 送信側で JSON.stringify しているか確認してください",
      });
    }

    if (!isValidKey(req.key)) {
      return textJson({
        ok: false,
        error: "登録キーが違います\n" +
          "　→ スクリプトプロパティ " + PROP_KEY + " と、" +
          "端末の設定画面に入れたキーを突き合わせてください",
      });
    }

    switch (req.action) {
      case "log":
        return textJson(handleLog(req.events));
      case "workers.list":
        return textJson({ ok: true, workers: listWorkers() });
      case "workers.add":
        return textJson(addWorker(req.name));
      case "workers.remove":
        return textJson(removeWorker(req.name));
      default:
        return textJson({
          ok: false,
          error: "action が不明です: " + req.action + "\n" +
            "　→ log / workers.list / workers.add / workers.remove のいずれか",
        });
    }
  } catch (err) {
    return textJson({
      ok: false,
      error: "処理中にエラーが発生しました: " + err.message + "\n" +
        "　→ Apps Script の「実行数」画面でログを確認してください",
    });
  } finally {
    // 書き込みを確定させてからロックを解く。
    //
    // スプレッドシートへの書き込みは保留され、すぐには他の実行から読めない。
    // これを呼ばないと、次の doPost が古い状態を読み、
    // 既にある行を見つけられずに新しい行を作ってしまう
    // （2026-09-19 に実測。伝票1件ごとに作業記録が1行ずつ増えた）。
    try {
      SpreadsheetApp.flush();
    } catch (err) {
      console.error("flush に失敗しました: " + err.message);
    }
    lock.releaseLock();
  }
}

/** 登録キーの照合 */
function isValidKey(key) {
  var expected = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  if (!expected) return false;
  if (!key || typeof key !== "string") return false;
  if (key.length !== expected.length) return false;
  return key === expected;
}

// ===== 記録の受け取り =====

/**
 * 出来事の配列をまとめて処理する。
 * 1件ずつの成否を返し、端末側は成功したものだけを未送信キューから消す。
 */
function handleLog(events) {
  if (!events || !events.length) {
    return { ok: false, error: "events が空です" };
  }

  var received = loadReceivedIds();
  var accepted = [];
  var failed = [];

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    try {
      if (!ev.id) throw new Error("id がありません");

      if (received[ev.id]) {
        // すでに受け取っている。二重に書かず、成功として返す。
        // （前回の返事だけが通信の切断で失われた場合にここへ来る）
        accepted.push(ev.id);
        continue;
      }

      if (ev.type === "slip") {
        writeSlip(ev);
      } else if (ev.type === "cancel") {
        markCancelled(ev);
      } else if (ev.type === "session") {
        writeSession(ev);
      } else {
        throw new Error("type が不明です: " + ev.type);
      }

      rememberId(ev.id);
      received[ev.id] = true;
      accepted.push(ev.id);
    } catch (err) {
      failed.push({ id: ev.id || null, error: err.message });
    }
  }

  return { ok: failed.length === 0, accepted: accepted, failed: failed };
}

/**
 * 伝票1件の完了を記録する。
 * 伝票シートに商品ごとの行を足し、作業記録シートの集計も更新する。
 */
function writeSlip(ev) {
  requireFields(ev, ["date", "bin", "carrier", "worker", "orderId", "doneAt"]);

  var sheet = monthlySheet("伝票", ev.date, HEADER_SLIP);
  var items = (ev.items && ev.items.length) ? ev.items : [""];
  var doneTime = formatTime(ev.doneAt);
  var rows = [];

  for (var i = 0; i < items.length; i++) {
    rows.push([
      ev.date,
      ev.bin,
      ev.carrier,
      ev.orderId,
      items[i],
      ev.worker,
      doneTime,
      // 所要時間は伝票の1行目にだけ入れる。
      // 全行に同じ値を入れると、合計したときに同梱の数だけ二重に数えられる。
      i === 0 ? Math.round(ev.durationSec || 0) : "",
      "有効",
      // 受信IDは取り消しの印を付けるときに行を探す手がかり。
      // 同梱で複数行になっても同じIDを入れる。
      ev.id,
    ]);
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER_SLIP.length)
    .setValues(rows);

  updateWorkRecord(ev, {
    addCount: 1,
    addSeconds: ev.durationSec || 0,
    endAt: ev.doneAt,
    startAt: ev.startedAt,
  });
}

/**
 * 完了の取り消しを記録する。
 *
 * 伝票シートと作業記録シートで扱いが違う。
 *   伝票シート  … 起きたことを残す台帳。元の行は消さず、印だけ書き換える（4-2(6)）
 *   作業記録シート … 今の実態を表す集計。件数を1減らす
 *
 * 時間は減らさない。入れ直しにかかった時間も実際に働いた時間であり、
 * 4-2(6) は「最初の完了と再完了の両方を作業時間に含める」と定めている。
 * 再完了されれば通常の完了として件数が1増え、元に戻る。
 */
function markCancelled(ev) {
  requireFields(ev, ["date", "bin", "carrier", "worker", "slipId"]);

  var sheet = monthlySheet("伝票", ev.date, HEADER_SLIP);
  var last = sheet.getLastRow();
  if (last < 2) throw new Error("伝票シートに行がありません: " + ev.date);

  var ids = sheet.getRange(2, COL_SLIP_ID, last - 1, 1).getValues();
  var hit = 0;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === ev.slipId) {
      sheet.getRange(i + 2, COL_SLIP_CANCEL).setValue("取り消し");
      hit++;
    }
  }

  if (hit === 0) {
    throw new Error(
      "取り消す対象の行が見つかりません（受信ID: " + ev.slipId + "）\n" +
      "　→ 伝票シートの「受信ID」列を検索して存在を確認してください"
    );
  }

  updateWorkRecord(ev, { addCount: -1 });
}

/**
 * 回の終わりを記録する。
 * 1件も完了していない回は端末側から送られてこない（4-2(3)）。
 */
function writeSession(ev) {
  requireFields(ev, ["date", "bin", "carrier", "worker", "endKind"]);

  updateWorkRecord(ev, {
    addCount: 0,
    addSeconds: 0,
    startAt: ev.startedAt,
    endAt: ev.endedAt,
    endKind: ev.endKind,
    endKindAt: ev.endedAt,
    picking: ev.picking,
    addPickingSeconds: ev.pickingSec || 0,
  });
}

/**
 * 作業記録シートの1行を作る、または更新する。
 *
 * 「日付 × 便 × 配送方法 × 作業者」が同じなら、何回に分かれていても1行にまとめる。
 */
function updateWorkRecord(ev, patch) {
  var sheet = monthlySheet("作業記録", ev.date, HEADER_WORK);
  var row = findWorkRow(sheet, ev);

  if (row < 0) {
    sheet.appendRow([
      ev.date, ev.bin, ev.carrier, ev.worker,
      "", "", 0, 0, "なし", 0, "",
    ]);
    row = sheet.getLastRow();
  }

  var cur = sheet.getRange(row, 1, 1, HEADER_WORK.length).getValues()[0];

  // 開始時刻は「最も早い」ものを残す。
  // HH:mm:ss と桁を固定しているので、文字列のまま大小を比べられる。
  if (patch.startAt) {
    var newStart = formatTime(patch.startAt);
    var curStart = cellText(cur[COL_WORK_START - 1], "HH:mm:ss");
    if (!curStart || newStart < curStart) cur[COL_WORK_START - 1] = newStart;
  }

  // 終了時刻は「最も遅い」ものを残す
  if (patch.endAt) {
    var newEnd = formatTime(patch.endAt);
    var curEnd = cellText(cur[COL_WORK_END - 1], "HH:mm:ss");
    if (!curEnd || newEnd > curEnd) cur[COL_WORK_END - 1] = newEnd;
  }

  if (patch.addCount) {
    cur[COL_WORK_COUNT - 1] = (Number(cur[COL_WORK_COUNT - 1]) || 0) + patch.addCount;
  }

  if (patch.addSeconds) {
    var min = (Number(cur[COL_WORK_MINUTES - 1]) || 0) + patch.addSeconds / 60;
    cur[COL_WORK_MINUTES - 1] = Math.round(min * 10) / 10;
  }

  if (patch.addPickingSeconds) {
    var pmin = (Number(cur[COL_WORK_PICK_MIN - 1]) || 0) + patch.addPickingSeconds / 60;
    cur[COL_WORK_PICK_MIN - 1] = Math.round(pmin * 10) / 10;
  }

  // ピッキングは「強い方」を残す（あり ＞ スキップ ＞ なし）。
  // 弱い方で上書きすると、ピッキング時間に数値があるのに「なし」という
  // 矛盾した行になり、閲覧者が読み違える。
  if (patch.picking) {
    var curRank = PICKING_RANK[cur[COL_WORK_PICKING - 1]] || 0;
    var newRank = PICKING_RANK[patch.picking] || 0;
    if (newRank > curRank) cur[COL_WORK_PICKING - 1] = patch.picking;
  }

  // 終わり方は上書きせず、起きた順に連ねる。
  // 「担当終了(10:40)→全完了(13:10)」のように書くことで、
  // 途中で抜けたのか一度で終わったのかを後から読み分けられる。
  if (patch.endKind) {
    var label = patch.endKind + "(" + formatTime(patch.endKindAt) + ")";
    var curKind = cur[COL_WORK_ENDKIND - 1];
    cur[COL_WORK_ENDKIND - 1] = curKind ? curKind + "→" + label : label;
  }

  sheet.getRange(row, 1, 1, HEADER_WORK.length).setValues([cur]);
}

/** 作業記録シートから、同じ「日付×便×配送方法×作業者」の行番号を探す（なければ -1） */
/** 作業記録シートから、同じ「日付×便×配送方法×作業者」の行番号を探す（なければ -1） */
function findWorkRow(sheet, ev) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;

  var values = sheet.getRange(2, 1, last - 1, COL_WORK_WORKER).getValues();
  for (var i = 0; i < values.length; i++) {
    // シートから読んだ値は Date になっていることがあるため、
    // 必ず cellText を通してから比べる（2026-09-14 の調査で確定）。
    if (
      cellText(values[i][COL_WORK_DATE - 1], "yyyy-MM-dd") === ev.date &&
      String(values[i][COL_WORK_BIN - 1]) === ev.bin &&
      String(values[i][COL_WORK_CARRIER - 1]) === ev.carrier &&
      String(values[i][COL_WORK_WORKER - 1]) === ev.worker
    ) {
      return i + 2;
    }
  }
  return -1;
}

// ===== 閉じ忘れの保険 =====

/**
 * 終わり方が空のままの行を「自動終了」で閉じる。
 * 1日1回、深夜に動かすトリガーとして設定する。
 *
 * 端末が120分の自動終了を判定する前に電源が落ちた、
 * あるいは翌日まで開かれなかった場合、session が永久に届かない。
 * その穴を受け側でふさぐ。
 */
function closeOpenRecords() {
  var today = Utilities.formatDate(new Date(), tz(), "yyyy-MM-dd");
  var name = "作業記録_" + today.substring(0, 7);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) return;

  var last = sheet.getLastRow();
  if (last < 2) return;

  var values = sheet.getRange(2, 1, last - 1, HEADER_WORK.length).getValues();
  var closed = 0;
  for (var i = 0; i < values.length; i++) {
    if (!values[i][COL_WORK_ENDKIND - 1]) {
      var at = values[i][COL_WORK_END - 1] || "";
      sheet.getRange(i + 2, COL_WORK_ENDKIND)
        .setValue("自動終了" + (at ? "(" + at + ")" : ""));
      closed++;
    }
  }
  console.log("closeOpenRecords: " + closed + "行を自動終了で閉じました");
}

// ===== 作業者の管理 =====

function listWorkers() {
  var sheet = workersSheet();
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var values = sheet.getRange(2, 1, last - 1, 1).getValues();
  var names = [];
  for (var i = 0; i < values.length; i++) {
    var name = String(values[i][0]).trim();
    if (name) names.push(name);
  }
  return names;
}

function addWorker(name) {
  if (!name || !String(name).trim()) {
    return { ok: false, error: "名前が空です" };
  }
  var trimmed = String(name).trim();
  var current = listWorkers();
  for (var i = 0; i < current.length; i++) {
    if (current[i] === trimmed) {
      return { ok: true, workers: current };  // すでにいる。何もしない。
    }
  }
  workersSheet().appendRow([trimmed]);
  return { ok: true, workers: listWorkers() };
}

/**
 * 作業者を一覧から外す。
 * 過去の記録は消さない（作業記録・伝票シートには手を触れない）。
 */
function removeWorker(name) {
  if (!name) return { ok: false, error: "名前が空です" };

  var sheet = workersSheet();
  var last = sheet.getLastRow();
  if (last < 2) return { ok: true, workers: [] };

  var values = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]).trim() === String(name).trim()) {
      sheet.deleteRow(i + 2);
    }
  }
  return { ok: true, workers: listWorkers() };
}

function workersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_WORKERS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_WORKERS);
    sheet.getRange(1, 1).setValue("作業者");
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, 4, 1).setValues([["辻川"], ["半田"], ["村崎"], ["田村"]]);
  }
  return sheet;
}

// ===== シートの用意 =====

/**
 * 月ごとのシートを取り出す。無ければ見出し付きで作る。
 * 例: 伝票_2026-09 / 作業記録_2026-09
 */
function monthlySheet(prefix, dateStr, header) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    throw new Error(
      "日付の形式が違います: " + dateStr + "（yyyy-MM-dd で送ってください）\n" +
      "　→ 端末側 workLog.ts の日付の作り方を確認してください"
    );
  }

  var name = prefix + "_" + String(dateStr).substring(0, 7);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");

    // 日付・時刻・管理番号を、送った文字列のまま保つ。
    // 自動変換を許すと、読み戻した値が送信値と一致しなくなる。
    var cols = TEXT_COLUMNS[prefix] || [];
    for (var c = 0; c < cols.length; c++) {
      sheet.getRange(1, cols[c], sheet.getMaxRows(), 1).setNumberFormat("@");
    }
  }
  return sheet;
}

// ===== 受信IDの控え（二重記録を防ぐ） =====

function receivedSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_RECEIVED);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RECEIVED);
    sheet.getRange(1, 1, 1, 2).setValues([["受信ID", "受信日時"]]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  return sheet;
}

function loadReceivedIds() {
  var sheet = receivedSheet();
  var last = sheet.getLastRow();
  var map = {};
  if (last < 2) return map;

  var values = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    map[String(values[i][0])] = true;
  }
  return map;
}

function rememberId(id) {
  receivedSheet().appendRow([String(id), new Date()]);
}

/**
 * 古い受信IDの控えを捨てる。1日1回のトリガーで動かす。
 * 端末が未送信を抱えたまま数日眠る可能性を考え、7日は残す。
 */
function purgeReceivedIds() {
  var sheet = receivedSheet();
  var last = sheet.getLastRow();
  if (last < 2) return;

  var limit = new Date().getTime() - RECEIVED_KEEP_DAYS * 24 * 60 * 60 * 1000;
  var values = sheet.getRange(2, 2, last - 1, 1).getValues();
  var removed = 0;

  for (var i = values.length - 1; i >= 0; i--) {
    var at = values[i][0];
    if (at instanceof Date && at.getTime() < limit) {
      sheet.deleteRow(i + 2);
      removed++;
    }
  }
  console.log("purgeReceivedIds: " + removed + "件の控えを削除しました");
}

// ===== 小さな道具 =====

function tz() {
  return Session.getScriptTimeZone();
}

/** ISO形式の時刻を HH:mm:ss の文字列にする（比較にも使うため桁を固定する） */
function formatTime(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error(
      "時刻を読めませんでした: " + iso + "\n" +
      "　→ 端末側から ISO 形式（2026-09-14T10:05:12+09:00）で送ってください"
    );
  }
  return Utilities.formatDate(d, tz(), "HH:mm:ss");
}

/**
 * シートから読んだ値を、比較できる文字列に揃える。
 *
 * 列をテキストに固定していれば文字列で返るが、
 * 過去に作られたシートや手作業の編集で Date が混じる可能性がある。
 * 比較の手前で必ず通すことで、行の取り違えを防ぐ。
 */
function cellText(value, pattern) {
  if (value === null || value === undefined || value === "") return "";

  // ⚠️ instanceof Date は使えない。
  // スプレッドシートのサービスが返す Date は、
  // スクリプト実行環境の Date とは別の型として扱われ、
  // instanceof が false になる（2026-09-19 に実測）。
  // 代わりに getTime を持つかどうかで判定する。
  if (value && typeof value.getTime === "function") {
    return Utilities.formatDate(value, tz(), pattern);
  }

  return String(value);
}

function requireFields(ev, fields) {
  for (var i = 0; i < fields.length; i++) {
    if (ev[fields[i]] === undefined || ev[fields[i]] === null || ev[fields[i]] === "") {
      throw new Error(
        fields[i] + " がありません（type: " + ev.type + "）\n" +
        "　→ 端末側 workLog.ts の送信データの組み立てを確認してください"
      );
    }
  }
}

function textJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}