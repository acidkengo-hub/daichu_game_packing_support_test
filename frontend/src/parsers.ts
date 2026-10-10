// src/parsers.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CROSS MALL 注文詳細CSV 解析
// ゲーム・リサイクル部門用（宅急便/ネコポス）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import Papa from "papaparse";
import { detectPlatform, comparePlatform, isPokemonBatteryProduct, POKEMON_BATTERY_GROUP, isWiiCampaignProduct, calcWiiCampaignBonus, WII_CAMPAIGN_BONUS_NAME, WII_CAMPAIGN_BONUS_CODE, needsTouchPenCheck, isFlyerTargetProduct, type Platform } from "./platformDetector";
import { findSetDefinition, type SetComponent } from "./setDefinitions";

// ============================================================
// 型定義
// ============================================================

export type Product = {
  code: string;          // 商品コード (col 14)
  skuCode: string;       // SKUコード (col 40)
  name: string;          // 商品名 (col 15)
  shortName: string;     // 品目 (col 41)
  attr1: string;         // 属性１名 (col 18)
  /**
   * 属性グループ１名 (col 16)。「カラー」「セット内容」「容量」など選択肢の見出し。
   * CSVに値がない場合や、おまけ商品など合成したProductでは undefined になる。
   */
  attr1Group?: string;
  attr2: string;         // 属性２名 (col 21)
  qty: number;           // 数量 (col 36)
  platform: Platform;    // 自動判定プラットフォーム
  isSet: boolean;        // セット商品フラグ
  setComponents: SetComponent[];  // セット同梱物リスト
  packingAlerts: string[];        // 梱包時アラート
  /** タッチペン確認アラートが必要か（DS/3DSの本体、WiiUのゲームパッド） */
  needsTouchPen: boolean;
  /** チラシ同梱の対象になりうるか（本体を含む商品 or PSPオリジナルバッテリー） */
  isFlyerTarget: boolean;
};

export type Order = {
  mgmtNo: string;         // 管理番号 (col 0)
  shopName: string;        // 店舗名 (col 1)
  ordererName: string;     // 注文者氏名 (col 2)
  recipientName: string;   // 届け先氏名 (col 3)
  recipientPostal: string; // 届け先郵便番号 (col 4)
  recipientAddr: string;   // 届け先住所（結合済み）
  recipientTel: string;    // 届け先TEL (col 8)
  deliveryDate: string;    // 配送希望日 (col 11)
  /**
   * ショップの注文番号（楽天・Yahoo!・Amazonなど）。
   * CSV定義の末尾に足した列で、位置ではなく見出しの名前「注文番号」で探す。
   * 古い定義のCSVでは列が無く、空文字になる。
   * 作業記録に残し、クレーム時の検索に使う（2026-10 追加）。
   */
  shopOrderNo: string;
  products: Product[];
  totalItems: number;
};

/** ピッキングアイテム（同梱物展開済み・プラットフォーム別集約） */
export type PickingItem = {
  name: string;           // 正規化部品名（集約キー）
  platform: Platform;     // プラットフォーム
  totalQty: number;       // 合計必要数
  sources: string[];      // 由来説明（例: "PS3中期型セット×2"）
  checked: boolean;       // ピッキング済みフラグ
};

export type CarrierData = {
  label: string;             // "ヤマト宅急便" or "ヤマトネコポス"
  orders: Order[];
  pickingItems: PickingItem[];
  totalPickingQty: number;
  totalOrders: number;
};

export type ParsedData = {
  takkyubin: CarrierData;
  nekopos: CarrierData;
};

// ============================================================
// CSV 列インデックス (0-based)
// ============================================================

const COL = {
  MGMT_NO:        0,   // 管理番号
  SHOP_NAME:      1,   // 店舗名
  ORDERER_NAME:   2,   // 注文者氏名
  RECIPIENT_NAME: 3,   // 届け先氏名
  POSTAL:         4,   // 届け先郵便番号
  PREF:           5,   // 届け先都道府県
  ADDR1:          6,   // 届け先住所１
  ADDR2:          7,   // 届け先住所２
  TEL:            8,   // 届け先TEL
  CARRIER:       10,   // 配送便名
  DELIVERY_DATE: 11,   // 配送希望日
  PRODUCT_CODE:  14,   // 商品コード
  PRODUCT_NAME:  15,   // 商品名
  ATTR1_GROUP:   16,   // 属性グループ１名（「カラー」「セット内容」等）
  ATTR1_CODE:    17,   // 属性１コード（SKUの一部。表示名より安定した判定キー）
  ATTR1_NAME:    18,   // 属性１名
  ATTR2_CODE:    20,   // 属性２コード（ps4projyunsei002 のコントローラー数の判定に使う）
  ATTR2_NAME:    21,   // 属性２名
  QTY:           36,   // 数量
  SKU_CODE:      40,   // SKUコード
  SHORT_NAME:    41,   // 品目
} as const;

// ============================================================
// キャリア判定
// ============================================================

type CarrierType = "takkyubin" | "nekopos";

function detectCarrier(carrierStr: string): CarrierType {
  const s = carrierStr.trim();
  if (s.includes("ネコポス")) return "nekopos";
  // "ヤマト（発払い）" やその他 → 宅急便扱い
  return "takkyubin";
}

// ============================================================
// セーフなフィールド取得
// ============================================================

function getField(row: string[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  return (row[index] ?? "").trim();
}

function getNumField(row: string[], index: number): number {
  const val = parseInt(getField(row, index), 10);
  return isNaN(val) ? 1 : val;
}

/**
 * 全角スペース・連続スペース・前後空白を正規化。
 * 「PS2 本体　【すぐ遊べるセッ」と「PS2 本体 【すぐ遊べるセッ」の分裂を防ぐ。
 */
function normalizeSpaces(s: string): string {
  return s.replace(/[\s\u3000]+/g, " ").trim();
}

/**
 * 本体やコントローラーなど、カラーが重要な部品かどうかを判定。
 * trueの場合、ピッキング集約時にカラーを名前に付加する。
 */
function isColorRelevant(componentName: string): boolean {
  return (
    componentName.includes("本体") ||
    componentName.includes("コントローラ") ||
    componentName.includes("DUALSHOCK") ||
    componentName.includes("Joy-Con") ||
    componentName.includes("リモコン")
  );
}

/**
 * 属性1名で電池本数が変わるWiiセットの商品コード（小文字で保持）。
 *
 * 属性1名には「シロ」「クロ」「シロ(電池2本セット)」「クロ(電池4本セット)」等が入る。
 * ここに載っていないコードでは電池の動的追加を行わない
 * （「電池」を含む他プラットフォーム商品での誤爆を防ぐため）。
 *
 * 新しい電池付きWiiセットが増えたら、この配列に1行追加する。
 */
const WII_BATTERY_CODES = [
  "wiihdmiset001",
  "wiikanpinset0001",
  "wiinomal2pset0001",
  "wiinomalbattset0001",
  "wiinomalset0001",
  "wiiplusset0001",
];

// ============================================================
// Product 構築（セット定義照合含む）
// ============================================================

function buildProduct(row: string[]): Product {
  const code = getField(row, COL.PRODUCT_CODE);
  const rawShortName = getField(row, COL.SHORT_NAME);
  const rawName = getField(row, COL.PRODUCT_NAME);
  // スペース正規化（全角/半角スペースの差による分裂を防止）
  const shortName = normalizeSpaces(rawShortName);
  const name = normalizeSpaces(rawName);
  const attr1 = getField(row, COL.ATTR1_NAME);
  // 属性1コードは表示名と違いモール管理画面での文言変更に影響されない。
  // 大小の揺れに備えて小文字で保持する
  const attr1Code = getField(row, COL.ATTR1_CODE).toLowerCase();
  const attr2Code = getField(row, COL.ATTR2_CODE).toLowerCase();
  let platform: Platform | string = detectPlatform(shortName, code);

  // Switch 2 判定（商品コード or 商品名から。既存Switchより優先）
  if (
    code === "2025122601" ||
    /switch\s*2|スイッチ\s*[2２]/i.test(name) ||
    /switch\s*2|スイッチ\s*[2２]/i.test(shortName)
  ) {
    platform = "Switch2" as Platform;
  }

  // ポケモン電池交換対象 → 特別グループに分類
  const isPokemon = isPokemonBatteryProduct(code);
  if (isPokemon) {
    platform = POKEMON_BATTERY_GROUP as unknown as Platform;
  }

  // 品目がCROSS MALLの文字数制限で切られている場合は商品名（フル）を使う
  const displayName =
    shortName && shortName.length >= 20
      ? shortName
      : name.length > shortName.length
        ? name
        : shortName || name;

  const setDef = findSetDefinition(code);
  const isSet = !!setDef && setDef.components.length > 0;

  // 電池セットの動的計算:
  //   属性1名の「電池N本」から単三電池の本数を決める。
  //   対象は WII_BATTERY_CODES に限定（他商品の「電池」表記での誤爆を防ぐ）。
  //   「シロ」「クロ」のように電池の記載がない場合は電池を追加しない。
  //   ただし wiinomalbattset0001 は商品自体が「電池付」なので、
  //   記載がなくても2本を維持する（従来動作の後方互換）。
  let components = setDef?.components ? [...setDef.components] : [];
  if (setDef && WII_BATTERY_CODES.includes(code.toLowerCase())) {
    // 楽天側で全角数字が入る可能性があるため半角に寄せてから照合する
    const attrNorm = attr1.replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );
    const matched = attrNorm.match(/電池\s*(\d+)\s*本/);

    let batteryQty = 0;
    if (matched) {
      batteryQty = parseInt(matched[1], 10);
    } else if (code.toLowerCase() === "wiinomalbattset0001") {
      batteryQty = 2;
    }

    // 既存の電池componentがなければ追加（定義側と二重計上しない）
    if (batteryQty > 0 && !components.some((c) => c.name === "単三電池")) {
      components = [...components, { name: "単三電池", qty: batteryQty }];
    }
  }

  // カラーランダムの動的計算: DS系・3DS系・PSPでカラーランダムを選択された場合、
  // おまけソフトを2本にする（指定カラーは1本のまま）
  if (setDef && (platform === "DS" || platform === "3DS" || platform === "PSP") && attr1.includes("ランダム")) {
    components = components.map((c) =>
      c.name.startsWith("おまけソフト") ? { ...c, qty: 2 } : c
    );
  }

  // Switch 2 の構成切替: 属性1で3パターンに分岐する
  //   「本体のみ」    → 本体1点のみ
  //   「外箱付き」    → 外箱 + 純正ACアダプター込みの完全版
  //   それ以外(外箱なし) → セット定義の既定値をそのまま使う
  if (setDef && setDef.id === "2025122601") {
    if (attr1.includes("本体のみ")) {
      components = [{ name: "Switch2本体", qty: 1 }];
    } else if (attr1.includes("外箱付")) {
      components = [
        { name: "Switch2外箱", qty: 1 },
        { name: "Switch2本体", qty: 1 },
        { name: "Switch2 Joy-Con(L+R)", qty: 1 },
        { name: "Switch2ドック", qty: 1 },
        { name: "USBケーブル(Switch2)", qty: 1 },
        { name: "HDMIケーブル", qty: 1 },
        { name: "ACアダプタ(Switch2純正)", qty: 1 },
      ];
    }
  }

  // ディスクシステムの構成切替: 属性1コードで3パターンに分岐する
  //   hontai    → 本体のみ
  //   acset     → 本体 + 電源アダプター（セット定義の既定値をそのまま使う）
  //   acramset  → 本体 + 電源アダプター + RAMアダプター
  // 属性1名（「本体のみ」等）ではなく属性1コードで判定している。
  // 表示名はモール側で変更されうるが、コードはSKUの一部なので安定しているため
  if (setDef && setDef.id === "discsystemset01") {
    if (attr1Code === "hontai") {
      components = [{ name: "ディスクシステム本体", qty: 1 }];
    } else if (attr1Code === "acramset") {
      components = [
        { name: "ディスクシステム本体", qty: 1 },
        { name: "電源アダプター(ディスクシステム)", qty: 1 },
        { name: "RAMアダプター(ディスクシステム)", qty: 1 },
      ];
    }
  }

  // PS4 Pro（ps4projyunsei002）のコントローラー数: 属性2コードで切り替える
  //   con1 → セット定義の既定値（コントローラー1個・USBケーブル1本）
  //   con2 → コントローラー2個・USBケーブル2本（DUALSHOCK4 2個セットに合わせる）
  // 表示名（「1個」「2個」）ではなく属性2コードで判定する。理由はディスクシステムと同じ
  if (setDef && setDef.id === "ps4projyunsei002" && attr2Code === "con2") {
    components = components.map((c) =>
      c.name === "DUALSHOCK4" || c.name === "USBケーブル(microB/細)" ? { ...c, qty: 2 } : c
    );
  }

  // ポケモン用梱包アラート
  const alerts = setDef?.packingAlerts ? [...setDef.packingAlerts] : [];
  if (isPokemon) {
    alerts.push("ポケモンソフトは電池交換を行いましたか？");
  }
  // Switch 2 外箱付きの注意喚起
  if (setDef && setDef.id === "2025122601" && attr1.includes("外箱付")) {
    alerts.push("外箱はマリオカート版の場合がありますが中身は通常版です");
  }

  // --- タッチペン確認 / チラシ対象の判定 ---
  // セット商品なら同梱物名、単品なら商品名・品目で判定する。
  // 判定ロジックは platformDetector 側に集約している（付属品の誤判定を防ぐため）。
  const namesToCheck = components.length > 0
    ? components.map((c) => c.name)
    : [displayName, name];

  const needsTouchPen = needsTouchPenCheck(platform as Platform, namesToCheck);
  const isFlyerTarget = isFlyerTargetProduct(code, namesToCheck);

  return {
    code,
    skuCode: getField(row, COL.SKU_CODE),
    name,
    shortName: displayName,
    attr1,
    attr1Group: getField(row, COL.ATTR1_GROUP),
    attr2: getField(row, COL.ATTR2_NAME),
    qty: getNumField(row, COL.QTY),
    platform: platform as Platform,
    isSet,
    setComponents: components,
    packingAlerts: alerts,
    needsTouchPen,
    isFlyerTarget,
  };
}

// ============================================================
// ピッキングリスト構築（セット展開 + プラットフォーム横断集約）
// ============================================================

export function buildPickingItems(orders: Order[]): PickingItem[] {
  // 集約マップ: name → { platform, totalQty, sources }
  const aggregated = new Map<
    string,
    { platform: Platform; totalQty: number; sources: string[] }
  >();

  for (const order of orders) {
    for (const product of order.products) {
      if (product.isSet && product.setComponents.length > 0) {
        // --- セット商品: 同梱物に分解して集約 ---
        for (const comp of product.setComponents) {
          // カラーが重要な部品（本体・コントローラー等）はカラーを集約キーに含める
          let key = comp.name;
          if (isColorRelevant(comp.name) && product.attr1) {
            key = `${comp.name}(${product.attr1})`;
          }

          const addQty = comp.qty * product.qty;
          const sourceDesc = `${product.shortName}×${product.qty}`;

          const existing = aggregated.get(key);
          if (existing) {
            existing.totalQty += addQty;
            if (!existing.sources.includes(sourceDesc)) {
              existing.sources.push(sourceDesc);
            }
          } else {
            aggregated.set(key, {
              platform: product.platform,
              totalQty: addQty,
              sources: [sourceDesc],
            });
          }
        }
      } else {
        // --- 単品商品: そのまま集約 ---
        // 単品もスペースを正規化してから集約キーにする
        const baseName = normalizeSpaces(product.shortName || product.name);
        // 単品のカラー付き集約（同じ商品名でもカラー違いは分ける）
        const key = product.attr1 ? `${baseName}(${product.attr1})` : baseName;
        const addQty = product.qty;

        const existing = aggregated.get(key);
        if (existing) {
          existing.totalQty += addQty;
        } else {
          aggregated.set(key, {
            platform: product.platform,
            totalQty: addQty,
            sources: [],
          });
        }
      }
    }
  }

  // Map → PickingItem[]（プラットフォーム順ソート）
  const items: PickingItem[] = Array.from(aggregated.entries()).map(
    ([name, data]) => ({
      name,
      platform: data.platform,
      totalQty: data.totalQty,
      sources: data.sources,
      checked: false,
    })
  );

  items.sort((a, b) => {
    const platformCmp = comparePlatform(a.platform, b.platform);
    if (platformCmp !== 0) return platformCmp;
    return a.name.localeCompare(b.name, "ja");
  });

  return items;
}

// ============================================================
// メインパース関数
// ============================================================

export function parseCSV(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("[parsers] ファイル読み込みに失敗しました。"));
    };

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          throw new Error("[parsers] ファイル内容が空です。");
        }

        // Shift_JIS → UTF-8 変換
        const decoder = new TextDecoder("shift_jis");
        const csvText = decoder.decode(arrayBuffer);

        // PapaParse で解析
        const parsed = Papa.parse<string[]>(csvText, {
          header: false,
          skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
          console.warn("[parsers] CSVパース警告:", parsed.errors);
        }

        const rows = parsed.data;
        if (rows.length < 2) {
          throw new Error("[parsers] CSVにデータ行がありません（ヘッダのみ）。");
        }

        // 注文番号の列は、位置ではなく見出しの名前で探す。
        // CSV定義の末尾に後から足した列のため、今後さらに列を足しても
        // 位置がずれないようにする。見つからなければ -1 で、
        // getField が空文字を返す（古い定義のCSVでも梱包作業は止まらない）。
        const shopOrderCol = rows[0].findIndex((h) => (h ?? "").trim() === "注文番号");
        if (shopOrderCol < 0) {
          console.warn(
            "[parsers] 「注文番号」の列が見つかりません。作業記録の注文番号は空欄になります\n" +
              "　→ CROSS MALL のCSV定義の末尾に「注文番号」があるか確認してください"
          );
        }

        // ヘッダ行をスキップ（最初の行）
        const dataRows = rows.slice(1);

        // --- 管理番号ごとにグルーピング + キャリア振り分け ---
        const takkyubinOrders = new Map<string, { order: Partial<Order>; products: Product[] }>();
        const nekoposOrders = new Map<string, { order: Partial<Order>; products: Product[] }>();

        for (const row of dataRows) {
          if (row.length < 42) {
            console.warn("[parsers] 列数不足の行をスキップ:", row.slice(0, 3));
            continue;
          }

          const mgmtNo = getField(row, COL.MGMT_NO);
          if (!mgmtNo) continue;

          const carrier = detectCarrier(getField(row, COL.CARRIER));
          const targetMap = carrier === "nekopos" ? nekoposOrders : takkyubinOrders;

          const product = buildProduct(row);

          if (!targetMap.has(mgmtNo)) {
            // 新規注文
            const addr = [
              getField(row, COL.PREF),
              getField(row, COL.ADDR1),
              getField(row, COL.ADDR2),
            ]
              .filter(Boolean)
              .join(" ");

            targetMap.set(mgmtNo, {
              order: {
                mgmtNo,
                shopName: getField(row, COL.SHOP_NAME),
                ordererName: getField(row, COL.ORDERER_NAME),
                recipientName: getField(row, COL.RECIPIENT_NAME),
                recipientPostal: getField(row, COL.POSTAL),
                recipientAddr: addr,
                recipientTel: getField(row, COL.TEL),
                deliveryDate: getField(row, COL.DELIVERY_DATE),
                shopOrderNo: getField(row, shopOrderCol),
              },
              products: [product],
            });
          } else {
            // 既存注文に商品追加
            targetMap.get(mgmtNo)!.products.push(product);
          }
        }

        // --- Wii同時購入キャンペーンの適用 ---
        // 商品名に「同時購入キャンペーン対象商品」を含む商品の合計点数に応じて
        // おまけソフトを付与する（2点→1枚、3点→2枚…＝点数−1）。
        // 注文単位の判定なので、商品単位の buildProduct ではなくここで行う。
        //
        // ★おまけソフトは「独立した商品」として追加する。
        //   既存商品の setComponents に足すと、梱包チェックリスト・ピッキング集計が
        //   comp.qty × product.qty で個数を計算するため、
        //   数量2以上の商品に付けると枚数が倍化してしまう（実際に発生した不具合）。
        //   qty:1 の専用商品にすれば掛け算の影響を受けない。
        const applyWiiCampaign = (products: Product[]): Product[] => {
          // 二重付与を防ぐ（同じCSVを読み直した場合など）
          if (products.some((p) => p.code === WII_CAMPAIGN_BONUS_CODE)) {
            return products;
          }

          const campaignProducts = products.filter((p) => isWiiCampaignProduct(p.name));
          const campaignQty = campaignProducts.reduce((sum, p) => sum + p.qty, 0);
          const bonusQty = calcWiiCampaignBonus(campaignQty);

          if (bonusQty <= 0) return products;

          const bonusProduct: Product = {
            code: WII_CAMPAIGN_BONUS_CODE,
            skuCode: WII_CAMPAIGN_BONUS_CODE,
            name: WII_CAMPAIGN_BONUS_NAME,
            shortName: `${WII_CAMPAIGN_BONUS_NAME} ×${bonusQty}`,
            attr1: "",
            attr2: "",
            qty: 1, // ★必ず1。個数は setComponents 側で表現する
            platform: "Wii" as Platform,
            isSet: true,
            setComponents: [{ name: WII_CAMPAIGN_BONUS_NAME, qty: bonusQty }],
            packingAlerts: [
              `同時購入キャンペーン対象が${campaignQty}点です。おまけソフトを${bonusQty}枚同梱してください`,
            ],
            // おまけソフト自体は本体ではないので、両フラグとも false
            needsTouchPen: false,
            isFlyerTarget: false,
          };

          console.log(
            `[parsers] Wii同時購入キャンペーン適用: 対象${campaignQty}点 → おまけソフト${bonusQty}枚`
          );
          return [...products, bonusProduct];
        };

        // --- Order オブジェクト生成 ---
        const buildOrders = (
          map: Map<string, { order: Partial<Order>; products: Product[] }>
        ): Order[] => {
          return Array.from(map.values()).map(({ order, products }) => {
            const finalProducts = applyWiiCampaign(products);
            return {
              mgmtNo: order.mgmtNo!,
              shopName: order.shopName ?? "",
              ordererName: order.ordererName ?? "",
              recipientName: order.recipientName ?? "",
              recipientPostal: order.recipientPostal ?? "",
              recipientAddr: order.recipientAddr ?? "",
              recipientTel: order.recipientTel ?? "",
              deliveryDate: order.deliveryDate ?? "",
              shopOrderNo: order.shopOrderNo ?? "",
              products: finalProducts,
              totalItems: finalProducts.reduce((sum, p) => sum + p.qty, 0),
            };
          });
        };

        const takkyubinOrderList = buildOrders(takkyubinOrders);
        const nekoposOrderList = buildOrders(nekoposOrders);

        // --- ピッキングリスト構築（セット展開 + 集約） ---
        const takkyubinPicking = buildPickingItems(takkyubinOrderList);
        const nekoposPicking = buildPickingItems(nekoposOrderList);

        const result: ParsedData = {
          takkyubin: {
            label: "ヤマト宅急便",
            orders: takkyubinOrderList,
            pickingItems: takkyubinPicking,
            totalPickingQty: takkyubinPicking.reduce((s, i) => s + i.totalQty, 0),
            totalOrders: takkyubinOrderList.length,
          },
          nekopos: {
            label: "ヤマトネコポス",
            orders: nekoposOrderList,
            pickingItems: nekoposPicking,
            totalPickingQty: nekoposPicking.reduce((s, i) => s + i.totalQty, 0),
            totalOrders: nekoposOrderList.length,
          },
        };

        console.log(
          `[parsers] パース完了: 宅急便 ${result.takkyubin.totalOrders}件(ピッキング${result.takkyubin.pickingItems.length}種), ` +
          `ネコポス ${result.nekopos.totalOrders}件(ピッキング${result.nekopos.pickingItems.length}種)`
        );

        resolve(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[parsers] パースエラー:", msg);
        reject(new Error(msg));
      }
    };

    reader.readAsArrayBuffer(file);
  });
}