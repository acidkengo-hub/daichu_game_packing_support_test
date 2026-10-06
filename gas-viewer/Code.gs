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
 *   login / searchSlips / listWorkers / summarize / dailyReport の5つだけ
 *   （＋何も返さない debugSearch / debugSummary / debugDailyReport）。
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
/**
 * 「すべて」の表に返す行の上限。
 * 1日の梱包は60〜150件あり、300行では2〜5日分で上限に達していた（2026-10-04）。
 * 1000行で、1人の担当分ならおよそ1〜2週間分。それより古い日は、
 * 作業日のボタンから1日ずつ取り直す（1日分なら上限に当たらない）。
 */
var SEARCH_LIMIT = 1000;

/**
 * 「長い梱包」とみなす所要時間（秒）。
 * 20分を超えるのは、梱包以外の対応をはさんだ場合と見られる（現場の感覚、2026-10-04）。
 * 集計の中央値からは外し、件数を別に数える。画面側（Index.html の LONG_SEC）と同じ値にすること。
 */
var LONG_SEC = 20 * 60;

/** 集計結果を覚えておく時間（秒）。記録は日中増えていくので短めにする */
var SUMMARY_CACHE_SEC = 5 * 60;

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

/**
 * 作業記録シートの列（1始まり）。梱包ツール用 GAS の HEADER_WORK と同じ並び。
 * 「終わり方」には、その回の最後の伝票の完了時刻が入る
 * （例：担当終了(12:43:11)→全完了(13:10:00)）。
 */
var WORK = { DATE: 1, BIN: 2, CARRIER: 3, WORKER: 4, START: 5, END: 6, COUNT: 7, MINUTES: 8, ENDING: 11 };
var WORK_WIDTH = 11;

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
 * query の項目（すべて省略可。期間だけで探してもよい）:
 *   shopOrderNo … ショップの注文番号（部分一致）
 *   mgmtNo      … 管理番号（部分一致）
 *   product     … 商品名（部分一致、大文字小文字を区別しない）
 *   worker      … 作業者（完全一致）
 *   from, to    … 期間（yyyy-MM-dd）。省略時は先月の1日〜今日
 *
 * 返り値:
 *   rows      … 該当した行（新しい順、SEARCH_LIMIT 行まで）
 *   truncated … 上限で打ち切ったか
 *   days      … 期間内の作業日ごとの伝票の件数と20分以上の件数（古い順）。
 *                上限で打ち切っても、最後まで読んで数える。
 *                画面はこれで作業日のボタンを作り、欠けている日は1日ずつ取り直す
 *   months    … 見た月
 */
function searchSlips(token, query) {
  requireToken_(token);
  query = query || {};

  var shopOrderNo = norm_(query.shopOrderNo);
  var mgmtNo = norm_(query.mgmtNo);
  var product = norm_(query.product).toLowerCase();
  var worker = norm_(query.worker);

  // 以前は「どれか1つは必ず入れる」決まりにしていた（一度に読み込みすぎないため）。
  // 作業日ごとに1日分を取り直せるようになったので、期間だけで探してもよいことにした。
  // 「この1週間に誰が何を梱包したか」を全員分見られる（2026-10-04）。

  var range = resolveRange_(query.from, query.to);
  var ss = openBook_();
  var endings = readEndings_(ss, range.months, range.from, range.to);
  var rows = [];
  var truncated = false;
  var days = {};   // date → { slips: {伝票のキー: true}, count, longCount }
  var returned = {}; // 返し始めた伝票のキー。上限で同梱の伝票を途中で切らないために使う

  // 新しい月から順に見る。上限に達しても読み続け、作業日ごとの件数だけは最後まで数える。
  for (var m = range.months.length - 1; m >= 0; m--) {
    var sheet = ss.getSheetByName("伝票_" + range.months[m]);
    if (!sheet) continue;

    var last = sheet.getLastRow();
    if (last < 2) continue;

    var values = sheet.getRange(2, 1, last - 1, SLIP_WIDTH).getValues();
    // 作業の最初と最後の伝票は、絞り込む前の全部の伝票で決める
    var bounds = sessionBounds_(values, range.from, range.to, endings);

    for (var i = values.length - 1; i >= 0; i--) {
      var r = values[i];
      var date = cellText_(r[SLIP.DATE - 1], "yyyy-MM-dd");

      if (date < range.from || date > range.to) continue;
      if (worker && String(r[SLIP.WORKER - 1]) !== worker) continue;
      if (shopOrderNo && String(r[SLIP.SHOP_ORDER - 1]).indexOf(shopOrderNo) < 0) continue;
      if (mgmtNo && String(r[SLIP.MGMT_NO - 1]).indexOf(mgmtNo) < 0) continue;
      if (product && String(r[SLIP.PRODUCT - 1]).toLowerCase().indexOf(product) < 0) continue;

      var doneAt = cellText_(r[SLIP.DONE_AT - 1], "HH:mm:ss");
      var receiveId = String(r[SLIP.RECEIVE_ID - 1]);
      var durRaw = r[SLIP.DURATION - 1];
      var cancelled = String(r[SLIP.CANCEL - 1]) === "取り消し";
      var markKey = sessionKey_(r, date) + "|" + doneAt;
      var startMark = bounds.start[markKey] || "";
      var endMark = bounds.end[markKey] || "";
      var isFirst = startMark !== "";   // 開始・再開。20分以上と中央値から外す

      // 作業日ごとの件数。同梱の伝票は複数行あるので、画面と同じキーで1件に数える
      var d = days[date] || (days[date] = { slips: {}, count: 0, longCount: 0 });
      var slipKey = receiveId || (String(r[SLIP.MGMT_NO - 1]) + doneAt);
      if (!d.slips[slipKey]) {
        d.slips[slipKey] = true;
        d.count++;
      }
      // 20分以上は、所要時間の入っている行（同梱の1行目）で数える。
      // 取り消しと、作業の最初の伝票（準備の時間を含むことがある）は数えない
      if (durRaw !== "" && durRaw !== null && !cancelled && !isFirst && Number(durRaw) >= LONG_SEC) {
        d.longCount++;
      }

      // 上限に達したら、それ以上は返さない。
      // ただし返し始めた伝票の残りの行（同梱の2行目以降）は返す。
      // 切ってしまうと、画面でその伝票の商品が欠けて見えるため。
      if (rows.length >= SEARCH_LIMIT && !returned[slipKey]) {
        truncated = true;
        continue;
      }
      returned[slipKey] = true;

      rows.push({
        date: date,
        bin: String(r[SLIP.BIN - 1]),
        carrier: String(r[SLIP.CARRIER - 1]),
        mgmtNo: String(r[SLIP.MGMT_NO - 1]),
        shopOrderNo: String(r[SLIP.SHOP_ORDER - 1] || ""),
        product: String(r[SLIP.PRODUCT - 1]),
        code: String(r[SLIP.CODE - 1] || ""),
        worker: String(r[SLIP.WORKER - 1]),
        doneAt: doneAt,
        durationSec: durRaw === "" ? null : Number(durRaw),
        cancelled: cancelled,
        receiveId: receiveId,
        isFirst: isFirst,       // 開始・再開の伝票（20分以上と中央値から外す）
        startMark: startMark,   // "開始" / "再開" / ""
        endMark: endMark,       // "担当終了" / "交替" / "全完了" / "自動終了" / "作業中" / 
      });
    }
  }

  var dayList = Object.keys(days).sort().map(function (k) {
    return { date: k, count: days[k].count, longCount: days[k].longCount };
  });

  return { rows: rows, truncated: truncated, days: dayList, months: range.months };
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

// ===== 集計 =====

/**
 * 配送方法ごとに、全体と担当者ごとの件数・中央値・20分以上の件数、
 * 週ごとの推移を返す。
 *
 * period: "thisMonth"（今月） / "lastMonth"（先月） / "last3"（今月＋前の2か月）
 *
 * 配送方法で分ける理由:
 *   ネコポスはソフト中心で数十秒、宅急便は本体セット中心で数分かかる。
 *   混ぜて集計すると、ネコポスを多く担当した人ほど速く見え、比較が成り立たない。
 *
 * 数え方:
 *   - 所要時間の入っている行だけを数える（同梱の伝票は1行目にだけ入っている）
 *   - 取り消しになった伝票は外す（やり直す前の時間のため）
 *   - 件数には20分以上も含める。中央値は20分以上を外して計算する
 *   - 開始・再開の伝票は、件数には入れるが、中央値と20分以上からは外す
 *     （ピッキングや準備の時間を含むことがあるため。sessionBounds_ を参照）
 *
 * ⚠️ 1件あたりの時間は、何を梱包したかで大きく変わる。
 * 人どうしの差は「腕前の差」ではなく「担当分の中身の差」を含む。
 *
 * 返り値:
 *   { from, to, longSec,
 *     carriers: [ { carrier, count, longCount, medianSec,
 *                   workers: [ { name, count, longCount, medianSec,
 *                                weeks: [ { week, count, longCount, medianSec } ] } ] } ] }
 */
function summarize(token, period) {
  requireToken_(token);

  var range = periodRange_(period);
  // 数え方を変えたら名前も変える（古い形の結果が5分間残っていて、取り違えないように）
  var cacheKey = "sum4_" + range.from + "_" + range.to;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var ss = openBook_();
  var endings = readEndings_(ss, range.months, range.from, range.to);
  var byCarrier = {};

  for (var m = 0; m < range.months.length; m++) {
    var sheet = ss.getSheetByName("伝票_" + range.months[m]);
    if (!sheet) continue;
    var last = sheet.getLastRow();
    if (last < 2) continue;

    var values = sheet.getRange(2, 1, last - 1, SLIP_WIDTH).getValues();
    var bounds = sessionBounds_(values, range.from, range.to, endings);
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      var dur = r[SLIP.DURATION - 1];
      if (dur === "" || dur === null) continue;              // 同梱の2行目以降
      if (String(r[SLIP.CANCEL - 1]) === "取り消し") continue;

      var date = cellText_(r[SLIP.DATE - 1], "yyyy-MM-dd");
      if (date < range.from || date > range.to) continue;

      var name = String(r[SLIP.WORKER - 1]).trim();
      var carrier = String(r[SLIP.CARRIER - 1]).trim();
      if (!name || !carrier) continue;

      var sec = Number(dur);
      var c = byCarrier[carrier] || (byCarrier[carrier] = newBucket_());
      c.workers = c.workers || {};
      var w = c.workers[name] || (c.workers[name] = newBucket_());
      w.weeks = w.weeks || {};
      var week = weekStart_(date);
      var wk = w.weeks[week] || (w.weeks[week] = newBucket_());

      // 開始・再開の伝票は、件数には入れるが、中央値と20分以上からは外す
      var first = !!bounds.start[sessionKey_(r, date) + "|" + cellText_(r[SLIP.DONE_AT - 1], "HH:mm:ss")];
      addSec_(c, sec, first);
      addSec_(w, sec, first);
      addSec_(wk, sec, first);
    }
  }

  // 宅急便を先、ネコポスを次に。それ以外があれば後ろに並べる
  var order = { "宅急便": 0, "ネコポス": 1 };
  var carriers = Object.keys(byCarrier)
    .sort(function (a, b) {
      return (a in order ? order[a] : 9) - (b in order ? order[b] : 9);
    })
    .map(function (carrierName) {
      var c = byCarrier[carrierName];
      var workers = Object.keys(c.workers).map(function (name) {
        var w = c.workers[name];
        var weeks = Object.keys(w.weeks).sort().map(function (k) {
          var x = w.weeks[k];
          return { week: k, count: x.count, longCount: x.long, medianSec: median_(x.secs) };
        });
        return { name: name, count: w.count, longCount: w.long, medianSec: median_(w.secs), weeks: weeks };
      });
      workers.sort(function (a, b) { return b.count - a.count; });
      return {
        carrier: carrierName,
        count: c.count,
        longCount: c.long,
        medianSec: median_(c.secs),
        workers: workers,
      };
    });

  var result = { from: range.from, to: range.to, longSec: LONG_SEC, carriers: carriers };
  try {
    cache.put(cacheKey, JSON.stringify(result), SUMMARY_CACHE_SEC);
  } catch (e) {
    // 100KB を超えたら覚えておかないだけ。集計そのものは返す
  }
  return result;
}

/**
 * 作業のまとまり（同じ日・便・配送方法・担当者）ごとに、
 * 伝票に付ける「始まり」と「終わり」の印を決める。
 *
 * 始まりの印（startMark）:
 *   "開始" … その日の最初の伝票
 *   "再開" … 担当終了・自動終了の次の伝票（戻ってきた後の1件目）
 *   どちらも、ピッキングや伝票一覧を見ながらの準備の時間を含むことがある
 *   （2026-10-05 に実データで確認。ピッキングを12秒で飛ばした後、1件目が42分48秒）。
 *   そこで「20分以上」の件数と中央値から外す。件数には入れる。
 *
 * 終わりの印（endMark）:
 *   "担当終了" / "交替" / "全完了" / "自動終了"
 *       … 作業記録シートの「終わり方」に書かれた時刻と、完了時刻が同じ伝票
 *   "作業中" … 終わり方が空欄のまま、今日の最後の伝票
 *
 * 商品名などで絞り込む前の、期間内の全部の伝票を見て決める。
 * 絞り込んだ後で決めると、絞り込んだ中の最初を取り違えるため。
 *
 * endings: readEndings_ の返り値（まとまりのキー → [{kind, time}]）
 * 返り値: { start: {キー|時刻: "開始"/"再開"}, end: {キー|時刻: 印} }
 */
function sessionBounds_(values, from, to, endings) {
  // まとまりごとに、伝票の完了時刻（同梱は1行目で数える）を集める
  var times = {};
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var dur = r[SLIP.DURATION - 1];
    if (dur === "" || dur === null) continue;
    var date = cellText_(r[SLIP.DATE - 1], "yyyy-MM-dd");
    if (date < from || date > to) continue;
    var key = sessionKey_(r, date);
    (times[key] || (times[key] = [])).push(cellText_(r[SLIP.DONE_AT - 1], "HH:mm:ss"));
  }

  var today = Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd");
  var start = {}, end = {};

  Object.keys(times).forEach(function (key) {
    var ts = times[key].sort();
    var list = (endings && endings[key]) || [];

    start[key + "|" + ts[0]] = "開始";

    list.forEach(function (e) {
      end[key + "|" + e.time] = e.kind;
      // 担当終了・自動終了の後に、同じまとまりで作業を再開した1件目
      if (e.kind === "担当終了" || e.kind === "自動終了") {
        for (var j = 0; j < ts.length; j++) {
          if (ts[j] > e.time) {
            if (!start[key + "|" + ts[j]]) start[key + "|" + ts[j]] = "再開";
            break;
          }
        }
      }
    });

    // 終わり方が空欄のまま、今日の最後の伝票は「作業中」
    var lastT = ts[ts.length - 1];
    var lastClosed = list.some(function (e) { return e.time >= lastT; });
    if (!lastClosed && key.substring(0, 10) === today) {
      end[key + "|" + lastT] = "作業中";
    }
  });

  return { start: start, end: end };
}

/**
 * 作業記録シートの「終わり方」を読み、まとまりごとの終わり方の一覧を返す。
 * 例：担当終了(12:43:11)→全完了(13:10:00)
 *   → [{kind:"担当終了", time:"12:43:11"}, {kind:"全完了", time:"13:10:00"}]
 */
function readEndings_(ss, months, from, to) {
  var map = {};
  months.forEach(function (month) {
    var sheet = ss.getSheetByName("作業記録_" + month);
    if (!sheet) return;
    var last = sheet.getLastRow();
    if (last < 2) return;
    var values = sheet.getRange(2, 1, last - 1, WORK_WIDTH).getValues();
    values.forEach(function (r) {
      var date = cellText_(r[WORK.DATE - 1], "yyyy-MM-dd");
      if (date < from || date > to) return;
      var key = [date, r[WORK.BIN - 1], r[WORK.CARRIER - 1], String(r[WORK.WORKER - 1]).trim()].join("|");
      var text = String(r[WORK.ENDING - 1] || "");
      var re = /([^→()]+)\((\d{2}:\d{2}:\d{2})\)/g;
      var m, list = [];
      while ((m = re.exec(text)) !== null) list.push({ kind: m[1].trim(), time: m[2] });
      map[key] = list;
    });
  });
  return map;
}

/** 作業のまとまりのキー（作業記録シートの1行と同じ単位） */
function sessionKey_(r, date) {
  return [date, r[SLIP.BIN - 1], r[SLIP.CARRIER - 1], String(r[SLIP.WORKER - 1]).trim()].join("|");
}

/** 集計の入れ物 */
function newBucket_() {
  return { count: 0, long: 0, secs: [] };
}

/**
 * 1件分を入れる。20分以上は件数だけ数え、中央値には入れない。
 * 作業の最初の伝票（first）は件数だけ数え、20分以上にも中央値にも入れない。
 */
function addSec_(bucket, sec, first) {
  bucket.count++;
  if (first) return;
  if (sec >= LONG_SEC) bucket.long++;
  else bucket.secs.push(sec);
}

// ===== 日報 =====

/**
 * 1日分の日報の数字をまとめて返す。文章に整えるのは画面側（Index.html）。
 * Asana への日報に貼る文章を作るために使う（2026-10-05 社員さんの要望）。
 *
 * date: yyyy-MM-dd
 *
 * 数え方は集計画面と同じ:
 *   - 1件あたりは中央値。開始・再開の伝票と20分以上は外す
 *   - 取り消しになった伝票は数えない
 *   - 「1日の合計」「担当者ごとの合計」の1件あたりは、午前と午後の伝票を
 *     まとめて取り直す（便ごとの中央値を平均すると、件数の違いが反映されないため）
 *   - 作業時間は作業記録シートの「作業時間(分)」（中断していた時間を含まない）
 *
 * 返り値:
 *   { date,
 *     bins:    [ { bin, carriers: [{carrier, count, longCount, medianSec}],
 *                  lines: [{worker, carrier, count, start, end, minutes, ending}] } ],
 *     total:   { carriers: [{carrier, count, longCount, medianSec}], longCount },
 *     persons: [ { name, carriers: [{carrier, count, medianSec}], minutes, minutesByBin: {便: 分} } ],
 *     health:  { slipCount, workCount, missingOrderNo, openEndings: [{worker, bin, carrier}] } }
 */
function dailyReport(token, date) {
  requireToken_(token);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(norm_(date))) {
    throw new Error("日付を選んでください");
  }
  date = norm_(date);
  var month = date.substring(0, 7);
  var ss = openBook_();
  var endings = readEndings_(ss, [month], date, date);

  // ---- 伝票 ----
  var slipSheet = ss.getSheetByName("伝票_" + month);
  var slipValues = [];
  if (slipSheet && slipSheet.getLastRow() >= 2) {
    slipValues = slipSheet.getRange(2, 1, slipSheet.getLastRow() - 1, SLIP_WIDTH).getValues();
  }
  var bounds = sessionBounds_(slipValues, date, date, endings);

  var binBuckets = {};     // 便 → 配送方法 → 入れ物
  var totalBuckets = {};   // 配送方法 → 入れ物
  var personBuckets = {};  // 担当者 → 配送方法 → 入れ物
  var slipCount = 0;
  var missingOrderNo = 0;

  slipValues.forEach(function (r) {
    var dur = r[SLIP.DURATION - 1];
    if (dur === "" || dur === null) return;                   // 同梱の2行目以降
    if (String(r[SLIP.CANCEL - 1]) === "取り消し") return;
    var d = cellText_(r[SLIP.DATE - 1], "yyyy-MM-dd");
    if (d !== date) return;

    var bin = String(r[SLIP.BIN - 1]).trim();
    var carrier = String(r[SLIP.CARRIER - 1]).trim();
    var name = String(r[SLIP.WORKER - 1]).trim();
    var doneAt = cellText_(r[SLIP.DONE_AT - 1], "HH:mm:ss");
    var first = !!bounds.start[sessionKey_(r, d) + "|" + doneAt];
    var sec = Number(dur);

    slipCount++;
    if (!String(r[SLIP.SHOP_ORDER - 1] || "").trim()) missingOrderNo++;

    var b = binBuckets[bin] || (binBuckets[bin] = {});
    addSec_(b[carrier] || (b[carrier] = newBucket_()), sec, first);
    addSec_(totalBuckets[carrier] || (totalBuckets[carrier] = newBucket_()), sec, first);
    var p = personBuckets[name] || (personBuckets[name] = {});
    addSec_(p[carrier] || (p[carrier] = newBucket_()), sec, first);
  });

  // ---- 作業記録 ----
  var workSheet = ss.getSheetByName("作業記録_" + month);
  var lines = {};          // 便 → [行]
  var minutesByPerson = {}; // 担当者 → 便 → 分
  var workCount = 0;
  var openEndings = [];
  if (workSheet && workSheet.getLastRow() >= 2) {
    workSheet.getRange(2, 1, workSheet.getLastRow() - 1, WORK_WIDTH).getValues().forEach(function (r) {
      if (cellText_(r[WORK.DATE - 1], "yyyy-MM-dd") !== date) return;
      var bin = String(r[WORK.BIN - 1]).trim();
      var carrier = String(r[WORK.CARRIER - 1]).trim();
      var name = String(r[WORK.WORKER - 1]).trim();
      var minutes = Number(r[WORK.MINUTES - 1]) || 0;
      var key = [date, bin, carrier, name].join("|");
      var list = endings[key] || [];
      var ending = list.length ? list[list.length - 1].kind : "";

      workCount += Number(r[WORK.COUNT - 1]) || 0;
      if (!ending) openEndings.push({ worker: name, bin: bin, carrier: carrier });

      (lines[bin] || (lines[bin] = [])).push({
        worker: name,
        carrier: carrier,
        count: Number(r[WORK.COUNT - 1]) || 0,
        start: cellText_(r[WORK.START - 1], "HH:mm:ss"),
        end: cellText_(r[WORK.END - 1], "HH:mm:ss"),
        minutes: minutes,
        ending: ending,
      });
      var m = minutesByPerson[name] || (minutesByPerson[name] = {});
      m[bin] = (m[bin] || 0) + minutes;
    });
  }

  // ---- まとめる ----
  function carrierList(buckets) {
    return sortCarriers_(Object.keys(buckets)).map(function (c) {
      var x = buckets[c];
      return { carrier: c, count: x.count, longCount: x.long, medianSec: median_(x.secs) };
    });
  }

  var binOrder = { "午前便": 0, "午後便": 1 };
  var binNames = Object.keys(binBuckets).concat(Object.keys(lines))
    .filter(function (v, i, a) { return a.indexOf(v) === i; })
    .sort(function (a, b) { return (a in binOrder ? binOrder[a] : 9) - (b in binOrder ? binOrder[b] : 9); });

  var bins = binNames.map(function (bin) {
    var ls = (lines[bin] || []).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    return { bin: bin, carriers: carrierList(binBuckets[bin] || {}), lines: ls };
  });

  var totalCarriers = carrierList(totalBuckets);
  var persons = Object.keys(personBuckets).map(function (name) {
    var byBin = minutesByPerson[name] || {};
    var minutes = 0;
    Object.keys(byBin).forEach(function (k) { minutes += byBin[k]; });
    var cs = carrierList(personBuckets[name]).map(function (c) {
      return { carrier: c.carrier, count: c.count, medianSec: c.medianSec };
    });
    var count = cs.reduce(function (n, c) { return n + c.count; }, 0);
    return { name: name, carriers: cs, minutes: Math.round(minutes * 10) / 10, minutesByBin: byBin, count: count };
  });
  persons.sort(function (a, b) { return b.count - a.count; });

  return {
    date: date,
    bins: bins,
    total: {
      carriers: totalCarriers,
      longCount: totalCarriers.reduce(function (n, c) { return n + c.longCount; }, 0),
    },
    persons: persons,
    health: {
      slipCount: slipCount,
      workCount: workCount,
      missingOrderNo: missingOrderNo,
      openEndings: openEndings,
    },
  };
}

/** 配送方法を、宅急便 → ネコポス → それ以外の順に並べる */
function sortCarriers_(names) {
  var order = { "宅急便": 0, "ネコポス": 1 };
  return names.slice().sort(function (a, b) {
    return (a in order ? order[a] : 9) - (b in order ? order[b] : 9);
  });
}

/** 期間の選択肢から、始まりと終わりの日付と、読む月を決める */
function periodRange_(period) {
  var now = new Date();
  var today = Utilities.formatDate(now, tz_(), "yyyy-MM-dd");
  var y = Number(today.substring(0, 4));
  var m = Number(today.substring(5, 7));

  function firstOf(yy, mm) {
    while (mm < 1) { mm += 12; yy--; }
    return yy + "-" + (mm < 10 ? "0" + mm : mm) + "-01";
  }
  function lastOf(yy, mm) {
    var d = new Date(yy, mm, 0); // mm 月の末日（mm は1始まり）
    return Utilities.formatDate(d, tz_(), "yyyy-MM-dd");
  }

  var from, to;
  if (period === "lastMonth") {
    var py = m === 1 ? y - 1 : y;
    var pm = m === 1 ? 12 : m - 1;
    from = firstOf(py, pm);
    to = lastOf(py, pm);
  } else if (period === "last3") {
    from = firstOf(y, m - 2);
    to = today;
  } else {
    from = firstOf(y, m);
    to = today;
  }
  return resolveRange_(from, to);
}

/** その日を含む週の月曜日（yyyy-MM-dd） */
function weekStart_(dateStr) {
  var d = new Date(dateStr + "T00:00:00");
  var dow = d.getDay();                 // 0=日曜 … 6=土曜
  var back = dow === 0 ? 6 : dow - 1;   // 月曜まで戻る日数
  d.setDate(d.getDate() - back);
  return Utilities.formatDate(d, tz_(), "yyyy-MM-dd");
}

/** 中央値（秒）。データが無ければ null */
function median_(arr) {
  if (!arr.length) return null;
  var a = arr.slice().sort(function (x, y) { return x - y; });
  var mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
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

/**
 * エディタから実行して、集計が動くかを確かめる。
 * 配送方法ごと・担当者ごとの件数・中央値・20分以上の件数と、週の数だけをログに出す。
 */
function debugSummary() {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put("tok_" + token, "1", 60);

  ["thisMonth", "lastMonth", "last3"].forEach(function (p) {
    var r = summarize(token, p);
    console.log("[" + p + "] " + r.from + " 〜 " + r.to);
    r.carriers.forEach(function (c) {
      console.log("  ■" + c.carrier + ": " + c.count + "件 / 中央値 " + c.medianSec +
        "秒 / 20分以上 " + c.longCount + "件");
      c.workers.forEach(function (w) {
        console.log("    " + w.name + ": " + w.count + "件 / 中央値 " + w.medianSec +
          "秒 / 20分以上 " + w.longCount + "件 / " + w.weeks.length + "週");
      });
    });
  });
}

/**
 * エディタから実行して、日報の数字が出るかを確かめる。今日の日付で作る。
 * 名前・件数・時間だけをログに出す（注文番号などは出さない）。
 */
function debugDailyReport() {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put("tok_" + token, "1", 60);
  var today = Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd");
  var r = dailyReport(token, today);
  console.log(JSON.stringify(r, null, 2));
}