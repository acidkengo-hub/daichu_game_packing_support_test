/**
 * workLog.ts の計算を確かめる（開発用）
 *
 * テスト用のライブラリは入れず、node で直接実行できる形にしている。
 * 依存を増やさないため、および README の技術スタックを変えないため。
 *
 * 実行:
 *   cd frontend && npx tsx src/workLog.test.ts
 */

import {
  startSession,
  enterPacking,
  completeSlip,
  cancelSlip,
  endSession,
  changeWorker,
  shouldAutoEnd,
} from "./workLog";

// ===== 道具 =====

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  OK   ${label}`);
  } else {
    failed++;
    console.log(`  NG   ${label}`);
    console.log(`       期待: ${JSON.stringify(expected)}`);
    console.log(`       実際: ${JSON.stringify(actual)}`);
  }
}

/** 時刻を読みやすく書くための道具。"10:05" → ミリ秒 */
function at(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 8, 14, h, m, 0).getTime();
}

// ===== テスト1: 要求仕様 4-2(6) の例をそのまま =====

console.log("テスト1: 取り消しと再完了（要求仕様 4-2(6) の例）");
{
  // 10:00 梱包から作業開始
  let s = startSession({
    bin: "午前便",
    carrier: "宅急便",
    worker: "半田",
    fromPicking: false,
    now: at("10:00"),
  });

  // 10:05 伝票Aを完了 → 直前の完了がないので 10:00〜10:05 の5分
  const a1 = completeSlip(s, {
    orderId: "A",
    items: ["商品A"],
    now: at("10:05"),
  });
  s = a1.session;
  check("A（最初の完了）= 300秒", a1.event.durationSec, 300);

  // 10:07 Aを取り消し（このとき伝票Bに取りかかっている）
  const c = cancelSlip(s, "A", at("10:07"));
  s = c.session;
  check("取り消しの送信が作られる", c.event !== null, true);

  // 10:09 Aを再完了 → 取り消した 10:07 から 10:09 の2分
  const a2 = completeSlip(s, {
    orderId: "A",
    items: ["商品A"],
    now: at("10:09"),
  });
  s = a2.session;
  check("A（再完了）= 120秒", a2.event.durationSec, 120);

  // 10:12 伝票Bを完了
  // 10:05〜10:12 の7分から、入れ直しの2分を引いて5分
  const b = completeSlip(s, {
    orderId: "B",
    items: ["商品B"],
    now: at("10:12"),
  });
  s = b.session;
  check("B = 300秒（7分 − 入れ直し2分）", b.event.durationSec, 300);

  check("件数は2件（Aと B）", s.doneCount, 2);
}

// ===== テスト2: ピッキングありの場合の起点 =====

console.log("テスト2: ピッキングから作業開始したときの起点");
{
  // 10:00 ピッキングから作業開始
  let s = startSession({
    bin: "午前便",
    carrier: "宅急便",
    worker: "村崎",
    fromPicking: true,
    now: at("10:00"),
  });

  // 10:03 全部チェックして梱包へ
  s = enterPacking(s, false, at("10:03"));
  check("ピッキング種別は「あり」", s.picking, "あり");
  check("ピッキング時間は180秒", s.pickingSec, 180);

  // 10:08 1件目を完了 → ピッキング時間は含まれず、10:03 からの5分
  const r = completeSlip(s, {
    orderId: "C",
    items: ["商品C"],
    now: at("10:08"),
  });
  check("1件目 = 300秒（ピッキング時間を含まない）", r.event.durationSec, 300);
}

// ===== テスト3: スキップで梱包へ進んだ場合 =====

console.log("テスト3: スキップ");
{
  let s = startSession({
    bin: "午前便",
    carrier: "ネコポス",
    worker: "田村",
    fromPicking: true,
    now: at("13:00"),
  });
  s = enterPacking(s, true, at("13:02"));
  check("ピッキング種別は「スキップ」", s.picking, "スキップ");
  check("ピッキング時間は120秒", s.pickingSec, 120);
}

// ===== テスト4: 0件のまま終わった回は記録しない =====

console.log("テスト4: 1件も完了せずに担当終了（例外#10）");
{
  const s = startSession({
    bin: "午前便",
    carrier: "宅急便",
    worker: "半田",
    fromPicking: false,
    now: at("10:00"),
  });
  const r = endSession(s, "担当終了", at("10:05"));
  check("送信する内容がない", r.event, null);
}

// ===== テスト5: 終了時刻は最後の完了時刻 =====

console.log("テスト5: 終了時刻は担当終了を押した時刻ではない");
{
  let s = startSession({
    bin: "午前便",
    carrier: "宅急便",
    worker: "半田",
    fromPicking: false,
    now: at("10:00"),
  });
  s = completeSlip(s, { orderId: "D", items: ["商品D"], now: at("10:40") })
    .session;

  // 10:55 に担当終了を押したが、終了時刻は最後の完了 10:40
  const r = endSession(s, "担当終了", at("10:55"));
  check(
    "終了時刻は10:40",
    r.event?.endedAt.slice(11, 16),
    "10:40"
  );
}

// ===== テスト6: 作業者の変更 =====

console.log("テスト6: 作業者の変更（要求仕様 4-2(7)）");
{
  // 0件のときは「修正」
  let s = startSession({
    bin: "午前便",
    carrier: "宅急便",
    worker: "半田",
    fromPicking: false,
    now: at("10:00"),
  });
  const fix = changeWorker(s, "村崎", at("10:01"));
  check("0件なら修正（前の回を閉じない）", fix.isHandover, false);
  check("作業者が上書きされる", fix.session.worker, "村崎");

  // 1件以上なら「交替」
  s = completeSlip(s, { orderId: "E", items: ["商品E"], now: at("10:10") })
    .session;
  const handover = changeWorker(s, "田村", at("10:15"));
  check("1件以上なら交替", handover.isHandover, true);
  check("前の回が閉じられる", handover.event?.endKind, "交替");
  check("前の作業者は半田", handover.event?.worker, "半田");
  check("新しい回の作業者は田村", handover.session.worker, "田村");
  check("新しい回の件数は0", handover.session.doneCount, 0);
}

// ===== テスト7: 自動終了の判定 =====

console.log("テスト7: 120分の自動終了（要求仕様 4-2(9)）");
{
  let s = startSession({
    bin: "午前便",
    carrier: "宅急便",
    worker: "半田",
    fromPicking: false,
    now: at("10:00"),
  });
  s = completeSlip(s, { orderId: "F", items: ["商品F"], now: at("10:30") })
    .session;

  check("60分の休憩では終了しない", shouldAutoEnd(s, at("11:30")), false);
  check("119分では終了しない", shouldAutoEnd(s, at("12:29")), false);
  check("120分で終了する", shouldAutoEnd(s, at("12:30")), true);
}

// ===== 結果 =====

console.log("");
console.log(`合格 ${passed} 件 / 不合格 ${failed} 件`);
if (failed > 0) {
  console.log("※ 不合格がある状態で画面につながないこと");
  process.exit(1);
}