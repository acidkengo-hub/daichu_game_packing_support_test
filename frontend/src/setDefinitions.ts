// src/setDefinitions.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// セット商品定義 + localStorage CRUD
// 正規化テーブル v2 に基づく部品名で記述
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// --- 型定義 ---

export type SetComponent = {
  name: string;   // 正規化名（集約キー）
  qty: number;    // 1セットあたりの個数
};

export type SetDefinition = {
  id: string;                  // 安定した識別子（設定画面・CRUD用）
  label: string;
  codes: string[];             // 完全一致する商品コード（複数モールの別コードを格納）
  prefixes: string[];          // 前方一致する商品コードプレフィックス
  components: SetComponent[];
  packingAlerts?: string[];
  pickingExcludes?: string[];
};

// --- おまけソフト互換性ルール ---
export const OMAKE_SOFT_COMPAT: Record<string, string[]> = {
  PS1:  ["PS1ソフト"],
  PS2:  ["PS1ソフト", "PS2ソフト"],
  PS3:  ["PS1ソフト", "PS2ソフト", "PS3ソフト"],
  PS4:  ["PS4ソフト"],
  PSP:  ["PSPソフト"],
  DS:   ["DSソフト"],
  "3DS": ["DSソフト", "3DSソフト"],
  N64:  ["N64ソフト"],
  SFC:  ["SFCソフト"],
  "GB/GBA": ["GBAソフト"],
};

// --- デフォルトセット定義（152件） ---

const DEFAULT_SETS: SetDefinition[] = [
  // ============================================================
  // PS1
  // ============================================================
  { id: "pssyoki1090", label: "PS1 すぐ遊べるセット", codes: ["pssyoki1090"], prefixes: [], components: [
    { name: "PS1本体", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "PS1コントローラー", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
    { name: "PS1メモリーカード(互換)", qty: 1 },
  ]},
  { id: "mcpsmcps2set", label: "PS用&PS2用メモリーカードセット", codes: ["mcpsmcps2set", "mc1mc2set"], prefixes: [], components: [
    { name: "PS1メモリーカード(互換)", qty: 1 }, { name: "PS2メモリーカード(互換)", qty: 1 },
  ]},

  // ============================================================
  // PS2 厚型 (SCPH-10000〜50000)
  // ============================================================
  { id: "ps210-390001", label: "PS2厚型 すぐ遊べるセット", codes: ["ps210-390001", "PS210000-30000-00001", "PS210000-30000-00001-2", "ps2atsugatacolornml"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps210-390001_2", label: "PS2厚型 すぐ遊べるセット(2)", codes: ["ps210-390001_2"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps2109-3992502", label: "PS2厚型 コントローラー2個付", codes: ["ps2109-3992502", "PS210000-30000-00002"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 2 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps2103992003g", label: "PS2厚型 すぐ遊べるセット(g)", codes: ["ps2103992003g", "ps250000gokan"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps2103992503g2", label: "PS2厚型 コントローラー2個付(g2)", codes: ["ps2103992503g2", "PS210000-30000-j-2suguasoberu"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 2 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps21000039000hdmi", label: "PS2厚型 HDMI変換セット", codes: ["ps21000039000hdmi"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
    { name: "HDMIコンバーター(PS2用)", qty: 1 }, { name: "USBケーブル(コンバーター電源用)", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps2mc2sset", label: "PS2厚型 メモリーカード2種付", codes: ["ps2mc2sset", "ps210000-39000mc2set", "PS210000-39000mcset-2"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
    { name: "PS2メモリーカード(互換)", qty: 1 }, { name: "PS1メモリーカード(互換)", qty: 1 },
  ]},
  { id: "ps21000039000mcset-3", label: "PS2厚型 純正メモリーカード付", codes: ["ps21000039000mcset-3"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
    { name: "PS2メモリーカード(純正)", qty: 1 },
  ]},
  { id: "ps21000039000mcset", label: "PS2厚型 メモリーカード付カラー選択", codes: ["ps21000039000mcset", "PS210000-39000mcset", "ps2atsugatacolorset"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
    { name: "PS2メモリーカード(純正)", qty: 1 },
  ]},
  // ミッドナイトブラック（SCPH-50000NB）は通常の厚型と棚が分かれているため、
  // 本体を別の部品名にしてピッキングで別の行に数える（2026-10-09 現場の要望）。
  // 付属品は通常の厚型と同じ。
  { id: "ps250101701", label: "PS2厚型 SCPH-50000NB", codes: ["ps250101701", "PS250000MB0000001"], prefixes: [], components: [
    { name: "PS2本体(ミッドナイトブラック)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps2honntaijunseimem", label: "PS2厚型 純正メモカ付すぐ遊べる", codes: ["ps2honntaijunseimem"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
    { name: "PS2メモリーカード(純正)", qty: 1 },
  ]},
  { id: "2679-002774", label: "PS2 SCPH-50000NB すぐ遊べる", codes: ["2679-002774"], prefixes: [], components: [
    { name: "PS2本体(ミッドナイトブラック)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps220260219001", label: "PS2厚型 コントローラー2個+メモカ2種", codes: ["ps220260219001"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK2", qty: 2 }, { name: "AVケーブル(PS系)", qty: 1 },
    { name: "PS2メモリーカード(純正)", qty: 1 }, { name: "PS1メモリーカード(互換)", qty: 1 },
  ]},
  { id: "amazon20240822", label: "DUALSHOCK2 2個セット", codes: ["amazon20240822"], prefixes: [], components: [
    { name: "DUALSHOCK2", qty: 2 },
  ]},

  // メルカリ専売: PS2厚型 すぐ遊べるセット（メモリーカード2種付）
  { id: "amazon9060", label: "PS2厚型 すぐ遊べる(メモカ2種/メルカリ専売)", codes: ["amazon9060"], prefixes: [], components: [
    { name: "PS2本体(厚型)", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 },
    { name: "PS1メモリーカード(互換)", qty: 1 },
    { name: "PS2メモリーカード(互換)", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
    { name: "メガネケーブル", qty: 1 },
  ]},

  // ============================================================
  // PS2 薄型 (SCPH-70000〜90000)
  // ※全セットにACアダプタ(PS2薄型)+メガネケーブル必須（.md未記載分も補完済み）
  // ============================================================
  { id: "ps270-7701", label: "PS2薄型 すぐ遊べるセット", codes: ["ps270-7701", "PS27000-0-77000-00001", "ps27000-0-77000-00003"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000)", qty: 1 }, { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps270-77202", label: "PS2薄型 コントローラー2個付", codes: ["ps270-77202", "PS27000-0-77000-00002"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000)", qty: 1 }, { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 2 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps270-7733", label: "PS2薄型 純正コントローラー付", codes: ["ps270-7733"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000)", qty: 1 }, { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps270-773g2", label: "PS2薄型 コントローラー2個(g2)", codes: ["ps270-773g2", "ps2-70000j-2suguasoberu"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000)", qty: 1 }, { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 2 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps27077hdmi", label: "PS2薄型 HDMI変換セット", codes: ["ps27077hdmi"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000)", qty: 1 }, { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 1 },
    { name: "HDMIケーブル", qty: 1 }, { name: "HDMIコンバーター(PS2用)", qty: 1 },
    { name: "USBケーブル(コンバーター電源用)", qty: 1 }, { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "ps277000pk", label: "PS2薄型 ピンク", codes: ["ps277000pk"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000)", qty: 1 }, { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  // --- メルカリ専売: PS2薄型70000番台 メモリーカード2種付 ---
  // ★カラーが商品コードで固定されているため、本体の正規化名に色を含めている。
  //   （選べるカラーの商品は属性1から自動で色が付くが、これらは属性が空になる）
  { id: "ps2ususugugokan", label: "PS2薄型70000 すぐ遊べる(白/メルカリ専売)", codes: ["ps2ususugugokan"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000・ホワイト)", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 },
    { name: "PS1メモリーカード(互換)", qty: 1 },
    { name: "PS2メモリーカード(互換)", qty: 1 },
    { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},
  { id: "amazon9129", label: "PS2薄型70000 すぐ遊べる(黒/メルカリ専売)", codes: ["amazon9129"], prefixes: [], components: [
    { name: "PS2本体(薄型/70000・ブラック)", qty: 1 },
    { name: "DUALSHOCK2", qty: 1 },
    { name: "PS1メモリーカード(互換)", qty: 1 },
    { name: "PS2メモリーカード(互換)", qty: 1 },
    { name: "ACアダプタ(PS2薄型)", qty: 1 },
    { name: "メガネケーブル", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},

  // --- PS2薄型 90000番台 ---
  // ★90000番台はACアダプタ不要（メガネケーブルを本体に直挿しできる）。
  //   70000番台は専用ACアダプタが必要なため、本体の正規化名も型番別に分けている。
  { id: "ps290000sredset", label: "PS2薄型 90000 シナバーレッド", codes: ["ps290000sredset"], prefixes: [], components: [
    { name: "PS2本体(薄型/90000)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
    { name: "PS1メモリーカード(純正)", qty: 1 }, { name: "PS2メモリーカード(純正)", qty: 1 },
  ]},
  { id: "ps290sug021401", label: "PS2薄型 90000 すぐ遊べる", codes: ["ps290sug021401", "ps290000suguasoberugokan"], prefixes: [], components: [
    { name: "PS2本体(薄型/90000)", qty: 1 },
    { name: "メガネケーブル", qty: 1 }, { name: "DUALSHOCK2", qty: 1 },
    { name: "AVケーブル(PS系)", qty: 1 },
  ]},

  // ============================================================
  // PS3 初期型 (CECHA/CECHB/CECHH/CECHL)
  // ============================================================
  { id: "2679-002901", label: "PS3初期型 20GB CECHB00", codes: ["2679-002901"], prefixes: [], components: [
    { name: "PS3本体(CECHB00/20GB)", qty: 1 }, { name: "三芯ケーブル", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "ps360gcecha002", label: "PS3初期型 60GB CECHA00", codes: ["ps360gcecha002"], prefixes: [], components: [
    { name: "PS3本体(CECHA00/60GB)", qty: 1 }, { name: "三芯ケーブル", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "ps3syoki3color001", label: "PS3初期型 40GB+ CECHH/L", codes: ["ps3syoki3color001", "ps3-syoki-40gver"], prefixes: [], components: [
    { name: "PS3本体(CECHH00,CECHL00/40GB+)", qty: 1 }, { name: "三芯ケーブル", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "ps3ffset0001", label: "PS3 FF7限定モデル(CECHA00)", codes: ["ps3ffset0001"], prefixes: [], components: [
    { name: "PS3本体(CECHA00/60GB)", qty: 1 }, { name: "三芯ケーブル", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "AVケーブル(PS3初期型)", qty: 1 },
  ]},

  // ============================================================
  // PS3 中期型 (CECH-2000〜3000)
  // ※USBケーブル(miniB/太)は.md未記載だが実際は同梱（補完済み）
  // ============================================================
  { id: "ps3203012001", label: "PS3中期型 120GB", codes: ["ps3203012001", "PS32000-3000-00001"], prefixes: [], components: [
    { name: "PS3本体(中期型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "ps3203016101", label: "PS3中期型 160GB", codes: ["ps3203016101", "PS32000-3000-00002"], prefixes: [], components: [
    { name: "PS3本体(中期型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},

  // ============================================================
  // PS3 後期型 (CECH-4000)
  // ※USBケーブル(miniB/太)は.md未記載だが実際は同梱（補完済み）
  // ============================================================
  // ps34300500g（4300C 500GB チャコールブラック）も中身は同じ。容量の違いは本体内部なので部品名は共通
  { id: "ps3403set213001", label: "PS3後期型 250GB/500GB", codes: ["ps3403set213001", "ps3-4000j1suguasoberu", "ps34300500g"], prefixes: [], components: [
    { name: "PS3本体(後期型)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},

  // PS3 HDD換装パック（単品扱い）
  { id: "ps3500g213001", label: "PS3 HDD500GB換装パック", codes: ["ps3500g213001"], prefixes: [], components: []},

  // PS3 DUALSHOCK3 2個セット
  { id: "dualshock3200001", label: "DUALSHOCK3 2個セット", codes: ["dualshock3200001", "dualshock3-2setblack"], prefixes: [], components: [
    { name: "DUALSHOCK3", qty: 2 }, { name: "USBケーブル(miniB/太)", qty: 2 },
  ]},

  // DUALSHOCK3 単品（USBケーブル1本付）
  // ※ 商品コードが "duals3" で始まるため2個セットと誤って紐付けていた（2026-08-19 修正）
  { id: "duals3202101", label: "DUALSHOCK3 単品(USBケーブル付)", codes: ["duals3202101"], prefixes: [], components: [
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
  ]},

  // PS3/PS4用ケーブルセット
  { id: "ps4cableset001", label: "PS用ケーブルセット(メガネ+HDMI)", codes: ["ps4cableset001"], prefixes: [], components: [
    { name: "メガネケーブル", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ]},

  // ============================================================
  // PS4 1000番台 (CUH-1000〜1200)
  // 梱包ルール: 型番末尾Aを優先使用
  // ============================================================
  { id: "ps4jyunsei10001200", label: "PS4(1000番台) 純正コントローラー付", codes: ["ps4jyunsei10001200", "ps4-1000-1200-jyunsei"], prefixes: [], components: [
    { name: "PS4本体(1000番台)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK4", qty: 1 }, { name: "USBケーブル(microB/細)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["型番Aの本体を優先して使用してください（例: CUH-1000A）"]},
  { id: "2679-004195", label: "PS4(1000番台) 互換コントローラー付", codes: ["2679-004195"], prefixes: [], components: [
    { name: "PS4本体(1000番台)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "互換コントローラー(PS4有線)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["型番Aの本体を優先して使用してください（例: CUH-1000A）"]},

  // ============================================================
  // PS4 2000番台 (CUH-2000〜2200)
  // 梱包ルール: 型番末尾Aを優先使用
  // ============================================================
  { id: "ps4jyunsei200020200", label: "PS4(2000番台) 純正コントローラー付", codes: ["ps4jyunsei200020200", "ps4-2000-2200-jyunsei"], prefixes: [], components: [
    { name: "PS4本体(2000番台)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK4", qty: 1 }, { name: "USBケーブル(microB/細)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["型番Aの本体を優先して使用してください（例: CUH-2200A）"]},
  { id: "ps4gokan200020200", label: "PS4(2000番台) 互換コントローラー付", codes: ["ps4gokan200020200", "ps4-2000-2200gokan"], prefixes: [], components: [
    { name: "PS4本体(2000番台)", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "互換コントローラー(PS4有線)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["型番Aの本体を優先して使用してください（例: CUH-2200A）"]},

  // ============================================================
  // PS4 Pro / 7000番台 (CUH-7000〜7200)
  // ============================================================
  // PS4 Pro は本体の型番により電源ケーブルがメガネ型と二芯型に分かれる。
  // どちらが必要かは棚で本体を手に取った時点で判明するため、
  // 部品名は "メガネケーブル"（他PS系セットと合算される集約キー）のまま据え置き、
  // 梱包時のアラートで確認を促す方式にした。
  { id: "ps4projyunsei", label: "PS4 Pro 純正コントローラー付", codes: ["ps4projyunsei"], prefixes: [], components: [
    { name: "PS4 Pro本体", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK4", qty: 1 }, { name: "USBケーブル(microB/細)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["本体の型番を確認し、メガネケーブルか二芯ケーブルか正しい方を入れましたか？"]},
  // 属性1でカラー（jb ジェットブラック / gw グレイシャーホワイト）、
  // 属性2でコントローラーの数（con1 / con2）を選ぶ。
  // ここはコントローラー1個の既定値。con2 のときの切り替えは parsers.ts の buildProduct で行う。
  // カラーはピッキングの集約で部品名に付く（isColorRelevant）ので、ここでは分けない。
  { id: "ps4projyunsei002", label: "PS4 Pro 純正コントローラー付(カラー・個数選択)", codes: ["ps4projyunsei002"], prefixes: [], components: [
    { name: "PS4 Pro本体", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK4", qty: 1 }, { name: "USBケーブル(microB/細)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["本体の型番を確認し、メガネケーブルか二芯ケーブルか正しい方を入れましたか？"]},
  { id: "ps4projyunsei-kyu", label: "PS4 Pro 純正コントローラー付(旧)", codes: ["ps4projyunsei-kyu", "ps4projyunseikyu"], prefixes: [], components: [
    { name: "PS4 Pro本体", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "DUALSHOCK4", qty: 1 }, { name: "USBケーブル(microB/細)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["本体の型番を確認し、メガネケーブルか二芯ケーブルか正しい方を入れましたか？"]},
  { id: "2679-003352", label: "PS4 Pro 互換コントローラー(白)", codes: ["2679-003352"], prefixes: [], components: [
    { name: "PS4 Pro本体", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "互換コントローラー(PS4有線)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["本体の型番を確認し、メガネケーブルか二芯ケーブルか正しい方を入れましたか？"]},
  { id: "2679-004185", label: "PS4 Pro 7200 箱付", codes: ["2679-004185"], prefixes: [], components: [
    { name: "PS4 Pro本体", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "互換コントローラー(PS4有線)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["本体の型番を確認し、メガネケーブルか二芯ケーブルか正しい方を入れましたか？"]},
  { id: "2679-004394", label: "PS4 Pro ブラック", codes: ["2679-004394"], prefixes: [], components: [
    { name: "PS4 Pro本体", qty: 1 }, { name: "メガネケーブル", qty: 1 },
    { name: "互換コントローラー(PS4有線)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ], packingAlerts: ["本体の型番を確認し、メガネケーブルか二芯ケーブルか正しい方を入れましたか？"]},
  // DUALSHOCK4 2個セット
  { id: "DUALSHOCK4doublepack", label: "DUALSHOCK4 2個セット", codes: ["DUALSHOCK4doublepack"], prefixes: [], components: [
    { name: "DUALSHOCK4", qty: 2 }, { name: "USBケーブル(microB/細)", qty: 2 },
  ]},

  // DUALSHOCK4 単品（USBケーブル1本付・選べる5色）
  { id: "dualshock45colornew", label: "DUALSHOCK4 単品(USBケーブル付)", codes: ["dualshock45colornew"], prefixes: [], components: [
    { name: "DUALSHOCK4", qty: 1 }, { name: "USBケーブル(microB/細)", qty: 1 },
  ]},

  // DualSense 単品（PS5用・Type-Cケーブル付）
  { id: "dualsenseusbset", label: "DualSense 単品(USBケーブル付)", codes: ["dualsenseusbset"], prefixes: [], components: [
    { name: "DUALSENSE", qty: 1 }, { name: "USBケーブル(TypeC-A)", qty: 1 },
  ]},

  // ============================================================
  // PSP
  // ============================================================
  { id: "psp2000hontai", label: "PSP-2000 すぐ遊べるセット", codes: ["psp2000hontai", "psp-2000-hontai"], prefixes: [], components: [
    { name: "PSP本体", qty: 1 }, { name: "PSPバッテリー", qty: 1 },
    { name: "USBケーブル(PSP充電用)", qty: 1 }, { name: "おまけソフト(PSP)", qty: 1 },
  ]},
  { id: "psp3000-hontai", label: "PSP-3000 すぐ遊べるセット", codes: ["psp3000-hontai", "pap-3000-hontai"], prefixes: [], components: [
    { name: "PSP本体", qty: 1 }, { name: "PSPバッテリー", qty: 1 },
    { name: "USBケーブル(PSP充電用)", qty: 1 }, { name: "おまけソフト(PSP)", qty: 1 },
  ]},
  { id: "pspbatorig2", label: "PSPバッテリー2個セット", codes: ["pspbatorig2", "pspbattoriginal-02"], prefixes: [], components: [
    { name: "PSPバッテリー", qty: 2 },
  ]},
  { id: "pspbatorig3", label: "PSPバッテリー3個セット", codes: ["pspbatorig3", "pspbattoriginal-03"], prefixes: [], components: [
    { name: "PSPバッテリー", qty: 3 },
  ]},

  // ============================================================
  // PS Vita / Vita TV
  // ============================================================
  { id: "amazon20250502psvita", label: "PSVita すぐ遊べるセット", codes: ["amazon20250502psvita"], prefixes: [], components: [
    { name: "PSVita本体", qty: 1 }, { name: "USBケーブル(PSVita充電用)", qty: 1 },
  ]},
  { id: "vitatvwhiteset", label: "Vita TV すぐ遊べるセット", codes: ["vitatvwhiteset"], prefixes: [], components: [
    { name: "VitaTV本体", qty: 1 }, { name: "ACアダプタ(VitaTV)", qty: 1 },
    { name: "DUALSHOCK3", qty: 1 }, { name: "USBケーブル(miniB/太)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 }, { name: "Vitaメモリーカード 8GB", qty: 1 },
  ]},

  // ============================================================
  // DS / DS Lite / DSi / DSi LL
  // タッチペンはピッキング除外 → 梱包時アラート
  // ============================================================
  { id: "dslite8color", label: "DS Lite すぐ遊べるセット", codes: ["dslite8color"], prefixes: [], components: [
    { name: "DS Lite本体", qty: 1 }, { name: "GBAカバー(DS Lite)", qty: 1 },
    { name: "電源ケーブル(DS Lite)", qty: 1 }, { name: "おまけソフト(DS)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "dssyokigataset001", label: "DS初期型 すぐ遊べるセット", codes: ["dssyokigataset001"], prefixes: [], components: [
    { name: "DS本体(初期型)", qty: 1 }, { name: "USBケーブル(DS初期型充電用)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "dsisuguset001", label: "DSi すぐ遊べるセット", codes: ["dsisuguset001"], prefixes: [], components: [
    { name: "DSi本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "dsillsuguset001", label: "DSi LL すぐ遊べるセット", codes: ["dsillsuguset001"], prefixes: [], components: [
    { name: "DSi LL本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},

  // ============================================================
  // Switch 2
  // 属性1（外箱付き / 本体のみ / 外箱なし）で同梱物が変わる。
  // 実際の切り替えは parsers.ts の buildProduct で行う。
  // ここでは既定として「外箱なし すぐ遊べるセット」の内容を持たせる。
  // ============================================================
  { id: "2025122601", label: "Switch 2 すぐ遊べるセット", codes: ["2025122601"], prefixes: [], components: [
    { name: "Switch2本体", qty: 1 }, { name: "Switch2 Joy-Con(L+R)", qty: 1 },
    { name: "Switch2ドック", qty: 1 }, { name: "USBケーブル(Switch2)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},

  // ============================================================
  // 3DS / New 3DS / 3DS LL / New 3DS LL / 2DS LL
  // タッチペンはピッキング除外 → 梱包時アラート
  // ============================================================
  { id: "3dscolor6011801", label: "3DS すぐ遊べるセット", codes: [], prefixes: ["3dscolor6011801"], components: [
    { name: "3DS本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
    { name: "おまけソフト(3DS)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "3dscolor8jyun", label: "3DS 純正ACアダプタ+充電台付", codes: ["3dscolor8jyun", "3ds-jyunseiset-001"], prefixes: [], components: [
    { name: "3DS本体", qty: 1 }, { name: "ACアダプタ(3DS純正)", qty: 1 },
    { name: "充電台(3DS純正)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "3dscolor8sdusbsoft", label: "3DS SDカード付すぐ遊べる", codes: ["3dscolor8sdusbsoft", "3ds8color-sd-unb-soft"], prefixes: [], components: [
    { name: "3DS本体", qty: 1 }, { name: "SDカード(2GB)", qty: 1 },
    { name: "3DS充電USBケーブル", qty: 1 }, { name: "おまけソフト(3DS)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "new3dscolor21401", label: "New 3DS すぐ遊べるセット", codes: ["new3dscolor21401"], prefixes: [], components: [
    { name: "New3DS本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
    { name: "おまけソフト(3DS)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "new3dslcol621402", label: "New 3DS LL すぐ遊べるセット", codes: ["new3dslcol621402"], prefixes: [], components: [
    { name: "New3DSLL本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
    { name: "おまけソフト(3DS)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "3dsllsuguasoberu01", label: "3DS LL すぐ遊べるセット", codes: ["3dsllsuguasoberu01"], prefixes: [], components: [
    { name: "3DSLL本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
    { name: "おまけソフト(3DS)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "3dsllsuguset", label: "3DS LL すぐ遊べるセット(2)", codes: ["3dsllsuguset"], prefixes: [], components: [
    { name: "3DSLL本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
    { name: "おまけソフト(3DS)", qty: 1 },
  ], packingAlerts: ["本体にタッチペンは付属していますか？"], pickingExcludes: ["タッチペン"]},
  { id: "2dsllsuguasoberu01", label: "2DS LL すぐ遊べるセット", codes: ["2dsllsuguasoberu01"], prefixes: [], components: [
    { name: "2DSLL本体", qty: 1 }, { name: "3DS充電USBケーブル", qty: 1 },
  ]},
  { id: "monhun4set", label: "モンハン4本セット(3DSソフト)", codes: ["monhun4set"], prefixes: [], components: [
    { name: "モンスターハンター3トライG", qty: 1 }, { name: "モンスターハンター4", qty: 1 },
    { name: "モンスターハンター4G", qty: 1 }, { name: "モンスターハンタークロス", qty: 1 },
  ]},

  // ============================================================
  // N64 / SFC / SFCミニ / FCミニ / GC / GBA
  // ============================================================
  { id: "64asoberuset01", label: "N64 すぐ遊べるセット", codes: ["64asoberuset01", "n64setconr-2022021100001"], prefixes: [], components: [
    { name: "N64本体", qty: 1 }, { name: "N64コントローラー", qty: 1 },
    { name: "AVケーブル(N64/SFC)", qty: 1 }, { name: "ACアダプタ(N64)", qty: 1 },
    { name: "おまけソフト(N64)", qty: 1 },
  ]},
  { id: "sfcsuguasoberu", label: "SFC すぐ遊べるセット", codes: ["sfcsuguasoberu"], prefixes: [], components: [
    { name: "SFC本体", qty: 1 }, { name: "SFCコントローラー", qty: 1 },
    { name: "AVケーブル(N64/SFC)", qty: 1 }, { name: "ACアダプタ(SFC)", qty: 1 },
    { name: "おまけソフト(SFC)", qty: 1 },
  ]},
  { id: "sfcminisuguasoberu", label: "SFCミニ すぐ遊べるセット", codes: ["sfcminisuguasoberu"], prefixes: [], components: [
    { name: "SFCミニ本体", qty: 1 }, { name: "SFCコントローラー", qty: 1 },
    { name: "USBケーブル(SFCミニ電源用)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "sfccont2", label: "SFCコントローラー2個セット", codes: ["sfccont2"], prefixes: [], components: [
    { name: "SFCコントローラー", qty: 2 },
  ]},
  { id: "amazon2024121002", label: "FCミニ すぐ遊べるセット", codes: ["amazon2024121002"], prefixes: [], components: [
    { name: "FCミニ本体", qty: 1 }, { name: "USBケーブル(FCミニ電源用)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "gamecubeset", label: "ゲームキューブ すぐ遊べるセット", codes: ["gamecubeset"], prefixes: [], components: [
    { name: "GC本体", qty: 1 }, { name: "ACアダプタ(GC)", qty: 1 },
    { name: "GCコントローラー", qty: 1 }, { name: "AVケーブル(GC)", qty: 1 },
  ]},
  { id: "gbadvsp5color", label: "GBA SP すぐ遊べるセット", codes: ["gbadvsp5color"], prefixes: [], components: [
    { name: "GBA SP本体", qty: 1 }, { name: "ACアダプタ(GBA SP)", qty: 1 },
    { name: "おまけソフト(GBA)", qty: 1 },
  ]},
  // おまけソフトは GBA SP と同じ部品名にして、ピッキングで合算する
  { id: "gameboymicrosuguset", label: "GBミクロ すぐ遊べるセット", codes: ["gameboymicrosuguset"], prefixes: [], components: [
    { name: "GBミクロ本体", qty: 1 }, { name: "USBケーブル(GBミクロ充電用)", qty: 1 },
    { name: "おまけソフト(GBA)", qty: 1 },
  ]},
  { id: "gbapokesr2set", label: "GBA ポケモン ルビー&サファイア", codes: ["gbapokesr2set"], prefixes: [], components: [
    { name: "GBAポケモン ルビー", qty: 1 }, { name: "GBAポケモン サファイア", qty: 1 },
  ]},
  { id: "gbpokemon4set", label: "GB ポケモン 初代4本セット", codes: ["gbpokemon4set"], prefixes: [], components: [
    { name: "GBポケモン 赤", qty: 1 }, { name: "GBポケモン 緑", qty: 1 },
    { name: "GBポケモン 青", qty: 1 }, { name: "GBポケモン ピカチュウ", qty: 1 },
  ]},
  { id: "discsystemset01", label: "ディスクシステム すぐ遊べるセット", codes: ["discsystemset01"], prefixes: [], components: [
    { name: "ディスクシステム本体", qty: 1 }, { name: "電源アダプター(ディスクシステム)", qty: 1 },
  ]},

  // ============================================================
  // セガサターン / ドリームキャスト
  // ============================================================
  { id: "sssiguset2color", label: "セガサターン すぐ遊べるセット", codes: ["sssiguset2color"], prefixes: [], components: [
    { name: "SS本体", qty: 1 }, { name: "SSコントローラー", qty: 1 },
    { name: "AVケーブル(SS)", qty: 1 }, { name: "電源ケーブル(SS)", qty: 1 },
  ]},
  { id: "dreamcastsuguset", label: "ドリームキャスト すぐ遊べるセット", codes: ["dreamcastsuguset"], prefixes: [], components: [
    { name: "DC本体", qty: 1 }, { name: "DCコントローラー", qty: 1 },
    { name: "AVケーブル(DC)", qty: 1 }, { name: "電源ケーブル(DC)", qty: 1 },
  ]},

  // ============================================================
  // Wii 本体セット
  // ============================================================
  { id: "wiinomalset0001", label: "Wii すぐ遊べるセット(1人)", codes: ["wiinomalset0001", "wii-sguasoberuset"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
  ]},
  { id: "1", label: "Wii すぐ遊べるセット(蓋なし1人)", codes: ["1"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
  ]},
  { id: "wiinomal2pset0001", label: "Wii 2人ですぐ遊べるセット", codes: ["wiinomal2pset0001"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 2 }, { name: "Wiiヌンチャク", qty: 2 },
  ]},
  { id: "wii201huta", label: "Wii 2人すぐ遊べる(蓋なし)", codes: ["wii201huta"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 2 }, { name: "Wiiヌンチャク", qty: 2 },
  ]},
  { id: "wiiplusset0001", label: "Wii リモコンプラスセット", codes: ["wiiplusset0001"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコンプラス", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
  ]},
  // Wii HDMI変換アダプタ 単品（HDMIケーブル付）
  // 正規化名は wiihdmiset001 と共通にして、ピッキングで合算されるようにする
  { id: "wiihdmihenkanki", label: "Wii HDMI変換アダプタ(HDMIケーブル付)", codes: ["wiihdmihenkanki"], prefixes: [], components: [
    { name: "HDMI変換器(Wii用)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ]},

  { id: "wiihdmiset001", label: "Wii HDMI変換すぐ遊べる", codes: ["wiihdmiset001"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
    { name: "HDMI変換器(Wii用)", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "wiinomalbattset0001", label: "Wii 電池付すぐ遊べるセット", codes: ["wiinomalbattset0001"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
  ]},
  // 箱・説明書つきの完品セット。電池本数は属性1名から動的に追加される
  // （parsers.ts の WII_BATTERY_CODES を参照）
  { id: "wiikanpinset0001", label: "Wii 完品セット(箱・説明書付)", codes: ["wiikanpinset0001"], prefixes: [], components: [
    { name: "Wii外箱", qty: 1 }, { name: "Wii内箱", qty: 1 },
    { name: "Wii説明書", qty: 1 }, { name: "Wii本体", qty: 1 },
    { name: "Wii本体スタンド", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiリモコンジャケット", qty: 1 },
    { name: "Wiiヌンチャク", qty: 1 },
  ]},
  { id: "wiihuzokuhinset001", label: "Wii 付属品3点セット", codes: ["wiihuzokuhinset001"], prefixes: [], components: [
    { name: "ACアダプタ(Wii)", qty: 1 }, { name: "AVケーブル(Wii)", qty: 1 },
    { name: "Wiiセンサーバー", qty: 1 },
  ]},

  // ============================================================
  // Wii 4人セット（桃鉄・マリオ系）
  // ============================================================
  { id: "wii4pmariopartyset", label: "Wii 4人マリオパーティ8セット", codes: ["wii4pmariopartyset", "wii-4set-party8"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 4 }, { name: "Wiiヌンチャク", qty: 4 },
    { name: "Wiiソフト「マリオパーティ8」", qty: 1 },
  ]},
  { id: "wii4pmomotetsuset", label: "Wii 4人 桃鉄2010セット", codes: ["wii4pmomotetsuset", "wii4pset-momotetsu10"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 4 }, { name: "Wiiヌンチャク", qty: 4 },
    { name: "Wiiソフト「桃太郎電鉄2010」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},
  { id: "wii4pmomotetsuset2", label: "Wii 4人 桃鉄16セット", codes: ["wii4pmomotetsuset2", "wii4pset-momotetsu16"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 4 }, { name: "Wiiヌンチャク", qty: 4 },
    { name: "Wiiソフト「桃太郎電鉄16」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},
  // 桃鉄16 リモコン数バリエーション (1/2/3本)
  { id: "wii4pmomotetsuset21", label: "Wii 桃鉄16(リモコン1本)", codes: ["wii4pmomotetsuset21", "wiiset-momotetsu16"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
    { name: "Wiiソフト「桃太郎電鉄16」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},
  { id: "wii4pmomotetsuset22", label: "Wii 桃鉄16(リモコン2本)", codes: ["wii4pmomotetsuset22", "wii2set-momotetsu16"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 2 }, { name: "Wiiヌンチャク", qty: 2 },
    { name: "Wiiソフト「桃太郎電鉄16」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},
  { id: "wii4pmomotetsuset23", label: "Wii 桃鉄16(リモコン3本)", codes: ["wii4pmomotetsuset23", "wii3p-momotetsu16"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 3 }, { name: "Wiiヌンチャク", qty: 3 },
    { name: "Wiiソフト「桃太郎電鉄16」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},
  // 桃鉄2010 リモコン数バリエーション (1/2/3本)
  { id: "wii4pmomotetsuset1", label: "Wii 桃鉄2010(リモコン1本)", codes: ["wii4pmomotetsuset1", "wiiset-momotetsu10"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
    { name: "Wiiソフト「桃太郎電鉄2010」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},
  { id: "wii4pmmt2isn", label: "Wii 桃鉄2010(リモコン2本)", codes: ["wii4pmmt2isn", "wii2set-momotetsu10"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 2 }, { name: "Wiiヌンチャク", qty: 2 },
    { name: "Wiiソフト「桃太郎電鉄2010」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},
  { id: "wii4pmomotetsuset3", label: "Wii 桃鉄2010(リモコン3本)", codes: ["wii4pmomotetsuset3", "wii3pset-momotetsu10"], prefixes: [], components: [
    { name: "Wii本体", qty: 1 }, { name: "ACアダプタ(Wii)", qty: 1 },
    { name: "AVケーブル(Wii)", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
    { name: "Wiiリモコン", qty: 3 }, { name: "Wiiヌンチャク", qty: 3 },
    { name: "Wiiソフト「桃太郎電鉄2010」", qty: 1 }, { name: "おまけソフト(Wii)", qty: 2 },
  ]},

  // ============================================================
  // Wii ソフト+周辺機器セット
  // ============================================================
  // マリオカート+ハンドルセット
  { id: "wiihandmcset1", label: "マリオカートWii+ハンドル1個", codes: ["wiihandmcset1", "handle1-mcset"], prefixes: [], components: [
    { name: "Wiiソフト「マリオカートWii」", qty: 1 }, { name: "Wiiハンドル", qty: 1 },
  ]},
  { id: "wiihandmcset", label: "マリオカートWii+ハンドル2個", codes: ["wiihandmcset", "wiihandle-2-mcse"], prefixes: [], components: [
    { name: "Wiiソフト「マリオカートWii」", qty: 1 }, { name: "Wiiハンドル", qty: 2 },
  ]},
  { id: "wiihandmcset3", label: "マリオカートWii+ハンドル3個", codes: ["wiihandmcset3", "handle3-bcset"], prefixes: [], components: [
    { name: "Wiiソフト「マリオカートWii」", qty: 1 }, { name: "Wiiハンドル", qty: 3 },
  ]},
  { id: "wiihandmcset4", label: "マリオカートWii+ハンドル4個", codes: ["wiihandmcset4", "handle4-mcset"], prefixes: [], components: [
    { name: "Wiiソフト「マリオカートWii」", qty: 1 }, { name: "Wiiハンドル", qty: 4 },
  ]},
  { id: "wiihandle02", label: "Wiiハンドル2個セット", codes: ["wiihandle02", "wiihandle-2"], prefixes: [], components: [
    { name: "Wiiハンドル", qty: 2 },
  ]},
  // マリオパーティ+リモコンセット
  { id: "wii-marioparty-001", label: "マリオパーティ8+リモコン1本", codes: ["wii-marioparty-001", "remo-mp8set"], prefixes: [], components: [
    { name: "Wiiソフト「マリオパーティ8」", qty: 1 }, { name: "Wiiリモコン", qty: 1 },
  ]},
  { id: "wiimarioparty002", label: "マリオパーティ8+リモコン2本", codes: ["wiimarioparty002", "remo2-mp8set"], prefixes: [], components: [
    { name: "Wiiソフト「マリオパーティ8」", qty: 1 }, { name: "Wiiリモコン", qty: 2 },
  ]},
  { id: "wiimarioparty003", label: "マリオパーティ8+リモコン3本", codes: ["wiimarioparty003", "remo3-mp8set"], prefixes: [], components: [
    { name: "Wiiソフト「マリオパーティ8」", qty: 1 }, { name: "Wiiリモコン", qty: 3 },
  ]},
  { id: "wii-marioparty9-001", label: "マリオパーティ9+リモコン1本", codes: ["wii-marioparty9-001", "remo-mp9set"], prefixes: [], components: [
    { name: "Wiiソフト「マリオパーティ9」", qty: 1 }, { name: "Wiiリモコン", qty: 1 },
  ]},
  { id: "wiimarioparty9002", label: "マリオパーティ9+リモコン2本", codes: ["wiimarioparty9002", "remo2-mp9set"], prefixes: [], components: [
    { name: "Wiiソフト「マリオパーティ9」", qty: 1 }, { name: "Wiiリモコン", qty: 2 },
  ]},
  { id: "wii-marioparty9-003", label: "マリオパーティ9+リモコン3本", codes: ["wii-marioparty9-003", "remo3-mp9set"], prefixes: [], components: [
    { name: "Wiiソフト「マリオパーティ9」", qty: 1 }, { name: "Wiiリモコン", qty: 3 },
  ]},
  // スマブラ+クラコンセット
  { id: "wiiclaconsbr", label: "スマブラ+クラコンPro1個", codes: ["wiiclaconsbr"], prefixes: [], components: [
    { name: "Wiiソフト「大乱闘スマッシュブラザーズ」", qty: 1 }, { name: "WiiクラシックコントローラーPro", qty: 1 },
  ]},
  { id: "wiiclacon2sb", label: "スマブラ+クラコンPro2個", codes: ["wiiclacon2sb"], prefixes: [], components: [
    { name: "Wiiソフト「大乱闘スマッシュブラザーズ」", qty: 1 }, { name: "WiiクラシックコントローラーPro", qty: 2 },
  ]},
  // Wiiスポーツ系
  { id: "wiisportsrimonunset", label: "Wiiスポーツ+リモコン+ヌンチャク", codes: ["wiisportsrimonunset"], prefixes: [], components: [
    { name: "Wiiソフト「Wiiスポーツ」", qty: 1 }, { name: "Wiiリモコン", qty: 1 },
    { name: "Wiiヌンチャク", qty: 1 },
  ]},
  { id: "wiisprimnun01", label: "Wiiスポーツリゾート+リモコンプラス", codes: ["wiisprimnun01"], prefixes: [], components: [
    { name: "Wiiソフト「Wiiスポーツリゾート」", qty: 1 }, { name: "Wiiリモコンプラス", qty: 1 },
  ]},
  { id: "wiiremnunset", label: "Wiiリモコン+ヌンチャクセット", codes: ["wiiremnunset", "wiiremo-nun-wbset"], prefixes: [], components: [
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiヌンチャク", qty: 1 },
  ]},
  { id: "wiirimoc3001", label: "Wiiリモコン3本セット", codes: ["wiirimoc3001", "wiiremocon-w3"], prefixes: [], components: [
    { name: "Wiiリモコン", qty: 3 },
  ]},
  { id: "wiirimokonsennsa", label: "Wiiリモコン+センサーバーセット", codes: ["wiirimokonsennsa"], prefixes: [], components: [
    { name: "Wiiリモコン", qty: 1 }, { name: "Wiiセンサーバー", qty: 1 },
  ]},
  { id: "hajimewii01", label: "はじめてのWii+リモコン", codes: ["hajimewii01"], prefixes: [], components: [
    { name: "Wiiソフト「はじめてのWii」", qty: 1 }, { name: "Wiiリモコン", qty: 1 },
  ]},
  { id: "wii-balanceboadset01", label: "Wiiバランスボード+Fit", codes: ["wii-balanceboadset01"], prefixes: [], components: [
    { name: "Wiiバランスボード", qty: 1 }, { name: "Wiiソフト「WiiFit/Plus」", qty: 1 },
    { name: "単三電池", qty: 4 },
  ]},

  // ============================================================
  // Wii 太鼓の達人セット
  // ============================================================
  { id: "wiitatakon2setwii", label: "太鼓の達人Wii+タタコン2台", codes: ["wiitatakon2setwii", "tatakon-wii"], prefixes: [], components: [
    { name: "Wiiソフト「太鼓の達人Wii」", qty: 1 },
    { name: "タタコン本体", qty: 2 }, { name: "バチ", qty: 4 }, { name: "タタコン台座", qty: 2 },
  ]},
  { id: "wiitt22daime", label: "太鼓の達人2代目+タタコン2台", codes: ["wiitt22daime"], prefixes: [], components: [
    { name: "Wiiソフト「太鼓の達人Wiiドドーンと2代目」", qty: 1 },
    { name: "タタコン本体", qty: 2 }, { name: "バチ", qty: 4 }, { name: "タタコン台座", qty: 2 },
  ]},
  { id: "wiitt2kettei", label: "太鼓の達人決定版+タタコン2台", codes: ["wiitt2kettei", "tatakon-ketteiban"], prefixes: [], components: [
    { name: "Wiiソフト「太鼓の達人Wii決定版」", qty: 1 },
    { name: "タタコン本体", qty: 2 }, { name: "バチ", qty: 4 }, { name: "タタコン台座", qty: 2 },
  ]},
  { id: "wiitt2gouka", label: "太鼓の達人超豪華版+タタコン2台", codes: ["wiitt2gouka", "tatakon-goukaban"], prefixes: [], components: [
    { name: "Wiiソフト「太鼓の達人Wii超豪華版」", qty: 1 },
    { name: "タタコン本体", qty: 2 }, { name: "バチ", qty: 4 }, { name: "タタコン台座", qty: 2 },
  ]},
  { id: "wiittkn2settkmr", label: "太鼓の達人特盛り+タタコン2台", codes: ["wiittkn2settkmr"], prefixes: [], components: [
    { name: "WiiUソフト「太鼓の達人特盛り」", qty: 1 },
    { name: "タタコン本体", qty: 2 }, { name: "バチ", qty: 4 }, { name: "タタコン台座", qty: 2 },
  ]},
  { id: "wiitt2tokumo", label: "太鼓特盛り+タタコン2台+リモコン2本", codes: ["wiitt2tokumo", "tatakon-remo-tokumori"], prefixes: [], components: [
    { name: "WiiUソフト「太鼓の達人特盛り」", qty: 1 },
    { name: "タタコン本体", qty: 2 }, { name: "バチ", qty: 4 }, { name: "タタコン台座", qty: 2 },
    { name: "Wiiリモコン", qty: 2 },
  ]},
  // タタコン単品（ソフトなし）。部品名は太鼓の達人セットと同じにして、ピッキングで合算する
  { id: "tatakon-tanpin", label: "タタコン 単品(バチ2本・台座付)", codes: ["tatakon-tanpin"], prefixes: [], components: [
    { name: "タタコン本体", qty: 1 }, { name: "バチ", qty: 2 }, { name: "タタコン台座", qty: 1 },
  ]},

  // ============================================================
  // WiiU
  // ============================================================
  { id: "wiiupresuguset", label: "WiiUプレミアム すぐ遊べるセット", codes: ["wiiupresuguset"], prefixes: [], components: [
    { name: "WiiU本体(プレミアム)", qty: 1 }, { name: "WiiUゲームパッド", qty: 1 },
    { name: "ACアダプタ(WiiU本体)", qty: 1 }, { name: "ACアダプタ(WiiUゲームパッド)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "wiiu8gbsuguset", label: "WiiUベーシック すぐ遊べるセット", codes: ["wiiu8gbsuguset"], prefixes: [], components: [
    { name: "WiiU本体(ベーシック)", qty: 1 }, { name: "WiiUゲームパッド", qty: 1 },
    { name: "ACアダプタ(WiiU本体)", qty: 1 }, { name: "ACアダプタ(WiiUゲームパッド)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},

  // WiiUゲームパッド 単品（タッチペン確認の対象）
  { id: "wiiu-padonly", label: "WiiUゲームパッド 単品", codes: ["wiiu-padonly"], prefixes: [], components: [
    { name: "WiiUゲームパッド", qty: 1 },
  ]},
  { id: "wiiusyuhenset001", label: "WiiU付属ケーブル3点セット", codes: ["wiiusyuhenset001", "wiiucable3set"], prefixes: [], components: [
    { name: "ACアダプタ(WiiU本体)", qty: 1 }, { name: "ACアダプタ(WiiUゲームパッド)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},
  { id: "wiiustandset001", label: "WiiUゲームパッド スタンド2点セット", codes: ["wiiustandset001", "wiiusatndset"], prefixes: [], components: [
    { name: "WiiUプレイスタンド", qty: 1 }, { name: "WiiU充電スタンド", qty: 1 },
  ]},
  // WiiUソフトセット
  { id: "wiiuhandlemc8", label: "マリオカート8+Wiiハンドル2個", codes: ["wiiuhandlemc8"], prefixes: [], components: [
    { name: "WiiUソフト「マリオカート8」", qty: 1 }, { name: "Wiiハンドル", qty: 2 },
  ]},
  { id: "wiiumarioparty10001", label: "マリオパーティ10+リモコン1+センサー", codes: ["wiiumarioparty10001", "wiiu-marioparty10-001"], prefixes: [], components: [
    { name: "WiiUソフト「マリオパーティ10」", qty: 1 }, { name: "Wiiリモコン", qty: 1 },
    { name: "Wiiセンサーバー", qty: 1 },
  ]},
  { id: "wiiumarioparty10002", label: "マリオパーティ10+リモコン2+センサー", codes: ["wiiumarioparty10002", "wii-marioparty10-002"], prefixes: [], components: [
    { name: "WiiUソフト「マリオパーティ10」", qty: 1 }, { name: "Wiiリモコン", qty: 2 },
    { name: "Wiiセンサーバー", qty: 1 },
  ]},
  { id: "wiiumarioparty10003", label: "マリオパーティ10+リモコン3+センサー", codes: ["wiiumarioparty10003", "wii-marioparty10-003"], prefixes: [], components: [
    { name: "WiiUソフト「マリオパーティ10」", qty: 1 }, { name: "Wiiリモコン", qty: 3 },
    { name: "Wiiセンサーバー", qty: 1 },
  ]},
  { id: "wiiumarioparty10004", label: "マリオパーティ10+リモコン4+センサー", codes: ["wiiumarioparty10004", "wiiu-marioparty10-004"], prefixes: [], components: [
    { name: "WiiUソフト「マリオパーティ10」", qty: 1 }, { name: "Wiiリモコン", qty: 4 },
    { name: "Wiiセンサーバー", qty: 1 },
  ]},
  { id: "wiiusmabroporoconset", label: "スマブラWiiU+PROコン1個", codes: ["wiiusmabroporoconset"], prefixes: [], components: [
    { name: "WiiUソフト「大乱闘スマッシュブラザーズ」", qty: 1 },
    { name: "WiiU PROコントローラー", qty: 1 }, { name: "USBケーブル(WiiU PROコン充電用)", qty: 1 },
  ]},
  { id: "wiiusabpcon2", label: "スマブラWiiU+PROコン2個", codes: ["wiiusabpcon2"], prefixes: [], components: [
    { name: "WiiUソフト「大乱闘スマッシュブラザーズ」", qty: 1 },
    { name: "WiiU PROコントローラー", qty: 2 }, { name: "USBケーブル(WiiU PROコン充電用)", qty: 1 },
  ]},
  { id: "2023081305", label: "WiiUレンズクリーナーセット", codes: ["2023081305"], prefixes: [], components: [
    { name: "WiiUクリーニングディスク", qty: 1 }, { name: "クリーニング液", qty: 1 },
  ]},

  // ============================================================
  // Switch
  // ============================================================
  { id: "switch-sugu-set", label: "Switch すぐ遊べるセット", codes: ["switch-sugu-set", "switch-sugu-set02"], prefixes: [], components: [
    { name: "Switch本体", qty: 1 }, { name: "Joy-Con(L+R)", qty: 1 },
    { name: "Switchドック", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
    { name: "ACアダプタ(Switch)", qty: 1 },
  ]},
  { id: "switch-sugu-setkyu", label: "Switch すぐ遊べるセット(旧)", codes: ["switch-sugu-setkyu"], prefixes: [], components: [
    { name: "Switch本体", qty: 1 }, { name: "Joy-Con(L+R)", qty: 1 },
    { name: "Switchドック", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
    { name: "ACアダプタ(Switch)", qty: 1 },
  ]},
  { id: "switchel-sugu-set", label: "Switch有機EL すぐ遊べるセット", codes: ["switchel-sugu-set"], prefixes: [], components: [
    { name: "Switch本体(有機EL)", qty: 1 }, { name: "Joy-Con(L+R)", qty: 1 },
    { name: "Switchドック", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
    { name: "ACアダプタ(Switch)", qty: 1 },
  ]},
  { id: "switch-4con-sugu-set", label: "Switch Joy-Con4本セット", codes: ["switch-4con-sugu-set"], prefixes: [], components: [
    { name: "Switch本体", qty: 1 }, { name: "Joy-Con(L+R)", qty: 2 },
    { name: "Switchドック", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
    { name: "ACアダプタ(Switch)", qty: 1 },
  ]},
  { id: "switch-sd-sugu-s", label: "Switch SDカード付セット", codes: ["switch-sd-sugu-s"], prefixes: [], components: [
    { name: "Switch本体", qty: 1 }, { name: "Joy-Con(L+R)", qty: 1 },
    { name: "Switchドック", qty: 1 }, { name: "HDMIケーブル", qty: 1 },
    { name: "ACアダプタ(Switch)", qty: 1 }, { name: "SDカード(64GB)", qty: 1 },
  ]},
  { id: "switchnomal0002sd64", label: "Switch本体+SDカード", codes: ["switchnomal0002sd64"], prefixes: [], components: [
    { name: "Switch本体", qty: 1 }, { name: "SDカード(64GB)", qty: 1 },
  ]},
  { id: "switchjoyconstrap", label: "Joy-Conストラップ2本セット", codes: ["switchjoyconstrap", "switch-joyconstrap"], prefixes: [], components: [
    { name: "Joy-Conストラップ", qty: 2 },
  ]},
  { id: "2679-009814", label: "Switchドック+ACアダプタ+HDMI", codes: ["2679-009814", "switcheldocset"], prefixes: [], components: [
    { name: "Switchドック", qty: 1 }, { name: "ACアダプタ(Switch)", qty: 1 },
    { name: "HDMIケーブル", qty: 1 },
  ]},

  // ============================================================
  // その他（Wii付属品単品セット）
  // ============================================================
  { id: "merukari1000", label: "Wii付属品セット(カバー等)", codes: ["merukari1000"], prefixes: [], components: [
    { name: "Wiiリモコンカバー", qty: 1 }, { name: "Wiiリモコンスタンド", qty: 1 },
    { name: "スタンド用プレート(丸)", qty: 1 },
  ]},
];

export default DEFAULT_SETS;

// --- localStorage CRUD ---

const STORAGE_KEY = "game-packing-sets";

/**
 * セット定義を取得。ユーザー編集分があればそちらを優先。
 */
export function getSetDefinitions(): SetDefinition[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SetDefinition[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[setDefinitions] localStorage読み込みエラー:", err);
  }
  return [...DEFAULT_SETS];
}

/**
 * セット定義をlocalStorageに保存。
 */
export function saveSetDefinitions(definitions: SetDefinition[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(definitions));
  } catch (err) {
    console.error("[setDefinitions] localStorage保存エラー:", err);
  }
}

/**
 * 新しいセット定義を追加。
 */
export function addSetDefinition(def: SetDefinition): SetDefinition[] {
  const current = getSetDefinitions();
  const idx = current.findIndex((d) => d.id === def.id);
  if (idx >= 0) {
    current[idx] = def;
  } else {
    current.push(def);
  }
  saveSetDefinitions(current);
  return current;
}

/**
 * セット定義を削除。
 */
export function removeSetDefinition(id: string): SetDefinition[] {
  const current = getSetDefinitions().filter((d) => d.id !== id);
  saveSetDefinitions(current);
  return current;
}

/**
 * セット定義を更新。
 */
export function updateSetDefinition(
  id: string,
  updated: Partial<SetDefinition>
): SetDefinition[] {
  const current = getSetDefinitions();
  const idx = current.findIndex((d) => d.id === id);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...updated };
    saveSetDefinitions(current);
  } else {
    console.warn(`[setDefinitions] ID "${id}" が見つかりません`);
  }
  return current;
}

/**
 * デフォルト定義にリセット。
 */
export function resetToDefaults(): SetDefinition[] {
  localStorage.removeItem(STORAGE_KEY);
  return [...DEFAULT_SETS];
}

/**
 * 商品コードからセット定義を検索。
 * codes（完全一致）→ prefixes（前方一致）の順で照合。
 * 大文字小文字を区別しない。
 */
export function findSetDefinition(
  productCode: string
): SetDefinition | undefined {
  const defs = getSetDefinitions();
  const codeLower = productCode.toLowerCase();

  // Phase 1: codes 配列内の完全一致
  const exactMatch = defs.find((d) =>
    d.codes.some((c) => c.toLowerCase() === codeLower)
  );
  if (exactMatch) return exactMatch;

  // Phase 2: prefixes 配列内の前方一致（最長プレフィックス優先）
  let bestMatch: SetDefinition | undefined;
  let bestLen = 0;
  for (const d of defs) {
    for (const prefix of d.prefixes) {
      if (codeLower.startsWith(prefix.toLowerCase()) && prefix.length > bestLen) {
        bestMatch = d;
        bestLen = prefix.length;
      }
    }
  }

  return bestMatch;
}