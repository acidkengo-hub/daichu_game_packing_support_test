/**
 * 梱包作業記録ビューア — DAICHU Game Packing Support
 *
 * 梱包作業記録のスプレッドシートを「読むだけ」の閲覧ページ。
 * スプレッドシートは誰にも共有せず、記録はこのページからだけ見られるようにする。
 *
 * 【守りの仕組み】
 *   - 実行ユーザーは所有者（専用アカウント）。閲覧者のアカウントに関係なく読める
 *   - 社員さん共通のパスワードで入る。照合はこのサーバー側だけで行う
 *   - 正しければ合言葉（トークン）を発行し、6時間有効にする
 *   - 記録を返す関数は、すべて最初にトークンを確かめる
 *
 * 【画面から呼べる関数】
 *   login / searchSlips / listWorkers の3つだけ（＋何も返さない debugSearch）。
 *   補助関数は名前の末尾に「_」を付け、画面から呼べないようにしている。
 *
 * 【書き込まない】
 *   このスクリプトは記録を一切書き換えない。書き込みは梱包ツール用の GAS だけが行う。
 *
 * 【原本の場所】
 *   リポジトリ game-packing-support の gas-viewer/Code.gs
 *   梱包ツール用の gas/Code.gs とは別物。取り違えて貼らないこと。
 */

// ===== 設定 =====

var PROP_SPREADSHEET_ID = "SPREADSHEET_ID";
var PROP_PASSWORD = "VIEW_PASSWORD";

/** ログインの有効時間（秒）。CacheService の上限が6時間のため */
var TOKEN_TTL_SEC = 6 * 60 * 60;

/** パスワードの失敗を数える時間（秒）と回数の上限 */
var FAIL_WINDOW_SEC = 10 * 60;
var FAIL_LIMIT = 5;

/** 検索結果の上限（行） */
var SEARCH_LIMIT = 300;

/** 検索で見る月数の上限。期間を広げすぎると読み込みが重くなるため */
var SEARCH_MAX_MONTHS = 12;

/**
 * 伝票シートの列（1始まり）。
 * 梱包ツール用 GAS（gas/Code.gs）の HEADER_SLIP と同じ並びであること。
 * 向こうで列を足すときは、必ず末尾に足す決まりになっている。
 */
var SLIP = {
  DATE: 1, BIN: 2, CARRIER: 3, MGMT_NO: 4, PRODUCT: 5, WORKER: 6,
  DONE_AT: 7, DURATION: 8, CANCEL: 9, RECEIVE_ID: 10, SHOP_ORDER: 11, CODE: 12,
};
var SLIP_WIDTH = 12;

// ===== 入口 =====

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("梱包作業記録ビューア")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// ===== ログイン =====

/**
 * パスワードを照合し、正しければトークンを返す。
 * 画面から google.script.run.login(password) で呼ぶ。
 */
function login(password) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get("login_fails") || 0);

  if (fails >= FAIL_LIMIT) {
    throw new Error(
      "パスワードの入力に続けて失敗したため、しばらく受け付けません。10分ほど待ってから試してください"
    );
  }

  var expected = PropertiesService.getScriptProperties().getProperty(PROP_PASSWORD);
  if (!expected) {
    throw new Error(
      "パスワードが設定されていません\n" +
        "　→ スクリプトプロパティ " + PROP_PASSWORD + " を確認してください"
    );
  }

  if (typeof password !== "string" || password !== expected) {
    // 失敗の回数を数える。最初の失敗から10分で数え直しになる。
    cache.put("login_fails", String(fails + 1), FAIL_WINDOW_SEC);
    throw new Error("パスワードが違います");
  }

  cache.remove("login_fails");
  var token = Utilities.getUuid();
  cache.put("tok_" + token, "1", TOKEN_TTL_SEC);
  return token;
}

/** トークンが有効か確かめる。無効なら例外を投げる */
function requireToken_(token) {
  if (typeof token !== "string" || !token) {
    throw new Error("ログインが必要です");
  }
  var ok = CacheService.getScriptCache().get("tok_" + token);
  if (!ok) {
    throw new Error("ログインの有効期限が切れました。もう一度パスワードを入れてください");
  }
}

// ===== 検索 =====

/**
 * 伝票の記録を検索する。
 *
 * query の項目（すべて省略可。ただし何か1つは指定すること）:
 *   shopOrderNo … ショップの注文番号（部分一致）
 *   mgmtNo      … 管理番号（部分一致）
 *   product     … 商品名（部分一致、大文字小文字を区別しない）
 *   worker      … 作業者（完全一致）
 *   from, to    … 期間（yyyy-MM-dd）。省略時は今月と先月
 *
 * 返り値: { rows: [...], truncated: 上限で打ち切ったか, months: 見た月 }
 */
function searchSlips(token, query) {
  requireToken_(token);
  query = query || {};

  var shopOrderNo = norm_(query.shopOrderNo);
  var mgmtNo = norm_(query.mgmtNo);
  var product = norm_(query.product).toLowerCase();
  var worker = norm_(query.worker);

  if (!shopOrderNo && !mgmtNo && !product && !worker) {
    throw new Error("注文番号・管理番号・商品名・作業者のどれか1つは入れてください");
  }

  var range = resolveRange_(query.from, query.to);
  var ss = openBook_();
  var rows = [];
  var truncated = false;

  // 新しい月から順に見る。上限に達したら、それ以上古い月は読まない。
  for (var m = range.months.length - 1; m >= 0 && !truncated; m--) {
    var sheet = ss.getSheetByName("伝票_" + range.months[m]);
    if (!sheet) continue;

    var last = sheet.getLastRow();
    if (last < 2) continue;

    var values = sheet.getRange(2, 1, last - 1, SLIP_WIDTH).getValues();

    for (var i = values.length - 1; i >= 0; i--) {
      var r = values[i];
      var date = cellText_(r[SLIP.DATE - 1], "yyyy-MM-dd");

      if (date < range.from || date > range.to) continue;
      if (worker && String(r[SLIP.WORKER - 1]) !== worker) continue;
      if (shopOrderNo && String(r[SLIP.SHOP_ORDER - 1]).indexOf(shopOrderNo) < 0) continue;
      if (mgmtNo && String(r[SLIP.MGMT_NO - 1]).indexOf(mgmtNo) < 0) continue;
      if (product && String(r[SLIP.PRODUCT - 1]).toLowerCase().indexOf(product) < 0) continue;

      rows.push({
        date: date,
        bin: String(r[SLIP.BIN - 1]),
        carrier: String(r[SLIP.CARRIER - 1]),
        mgmtNo: String(r[SLIP.MGMT_NO - 1]),
        shopOrderNo: String(r[SLIP.SHOP_ORDER - 1] || ""),
        product: String(r[SLIP.PRODUCT - 1]),
        code: String(r[SLIP.CODE - 1] || ""),
        worker: String(r[SLIP.WORKER - 1]),
        doneAt: cellText_(r[SLIP.DONE_AT - 1], "HH:mm:ss"),
        durationSec: r[SLIP.DURATION - 1] === "" ? null : Number(r[SLIP.DURATION - 1]),
        cancelled: String(r[SLIP.CANCEL - 1]) === "取り消し",
        receiveId: String(r[SLIP.RECEIVE_ID - 1]),
      });

      if (rows.length >= SEARCH_LIMIT) {
        truncated = true;
        break;
      }
    }
  }

  return { rows: rows, truncated: truncated, months: range.months };
}

/** 作業者の一覧。検索画面の選択肢に使う */
function listWorkers(token) {
  requireToken_(token);
  var sheet = openBook_().getSheetByName("作業者");
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (n) { return n; });
}

// ===== 小さな道具 =====

function openBook_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_SPREADSHEET_ID);
  if (!id) {
    throw new Error(
      "スプレッドシートが設定されていません\n" +
        "　→ スクリプトプロパティ " + PROP_SPREADSHEET_ID + " を確認してください"
    );
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error(
      "スプレッドシートを開けませんでした（" + e.message + "）\n" +
        "　→ " + PROP_SPREADSHEET_ID + " の値と、所有者のアカウントを確認してください"
    );
  }
}

function tz_() {
  return Session.getScriptTimeZone();
}

function norm_(v) {
  return (v === null || v === undefined) ? "" : String(v).trim();
}

/**
 * シートから読んだ値を、比べられる文字列に揃える。
 *
 * ⚠️ instanceof Date は使わない。スプレッドシートのサービスが返す Date は
 * スクリプトの Date とは別の型として扱われ、instanceof が false になる
 * （梱包ツール用 GAS で 2026-09-19 に実測）。getTime の有無で判定する。
 */
function cellText_(value, pattern) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value.getTime === "function") {
    return Utilities.formatDate(value, tz_(), pattern);
  }
  return String(value);
}

/**
 * 期間を決め、その間に含まれる月（yyyy-MM）の一覧を作る。
 * 省略時は先月の1日〜今日。
 */
function resolveRange_(from, to) {
  var today = Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd");
  var re = /^\d{4}-\d{2}-\d{2}$/;

  var toStr = re.test(norm_(to)) ? norm_(to) : today;
  var fromStr;
  if (re.test(norm_(from))) {
    fromStr = norm_(from);
  } else {
    var d = new Date(toStr.substring(0, 7) + "-01T00:00:00");
    d.setMonth(d.getMonth() - 1);
    fromStr = Utilities.formatDate(d, tz_(), "yyyy-MM-dd");
  }

  if (fromStr > toStr) {
    throw new Error("期間の始まりが終わりより後になっています");
  }

  var months = [];
  var y = Number(fromStr.substring(0, 4));
  var mo = Number(fromStr.substring(5, 7));
  var endKey = toStr.substring(0, 7);
  while (true) {
    var key = y + "-" + (mo < 10 ? "0" + mo : mo);
    months.push(key);
    if (key >= endKey) break;
    mo++;
    if (mo > 12) { mo = 1; y++; }
    if (months.length > SEARCH_MAX_MONTHS) {
      throw new Error("期間は" + SEARCH_MAX_MONTHS + "か月以内にしてください");
    }
  }

  return { from: fromStr, to: toStr, months: months };
}

// ===== エディタからの動作確認用 =====
//
// ⚠️ google.script.run は、名前が「_」で終わらない関数をすべて画面から呼べる。
// そのため補助関数にはすべて「_」を付けている。
// debugSearch は画面から呼ばれても何も返さない（ログに件数を出すだけ）ので、
// 「_」を付けずにエディタの実行メニューに出るようにしている。

/**
 * エディタから実行して、読み出しが動くかを確かめる。
 * パスワード照合を通さず、内部でトークンを発行して検索する。
 * 結果の件数と、1件目の項目名だけをログに出す（記録の中身は出さない）。
 */
function debugSearch() {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put("tok_" + token, "1", 60);

  var workers = listWorkers(token);
  console.log("作業者: " + workers.length + "名");

  var result = searchSlips(token, { worker: workers[0] || "辻川" });
  console.log("見た月: " + result.months.join(", "));
  console.log("該当: " + result.rows.length + "行 / 打ち切り: " + result.truncated);
  if (result.rows.length > 0) {
    console.log("1件目の項目: " + Object.keys(result.rows[0]).join(", "));
    console.log("1件目の注文番号あり: " + !!result.rows[0].shopOrderNo);
  }
}