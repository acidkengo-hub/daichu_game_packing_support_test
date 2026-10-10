// src/imageMapping.ts
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// セット商品画像マッピング（Google Drive → セットID）
// 画像URL: https://lh3.googleusercontent.com/d/{fileId}
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Google DriveファイルIDから画像URLを生成
 */
export function getDriveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/**
 * セット画像ファイル名（拡張子なし）→ Google DriveファイルIDのマッピング。
 * ファイル名はセットIDまたはセットIDに近い名前。
 * findSetDefinition でマッチしたセット定義のIDと照合して画像を取得する。
 */
export const IMAGE_MAP: Record<string, string> = {
  "2023081305": "1fnLCuM2q1_ifjP1BatK0ZkOwyhUF-4Ll",
  "2679-004195": "1-ao1CRHrlF5aMQb3YG8UQA9NqybUBOVN",
  "2dsllsuguasoberu01": "1jPHymgMn0L-IKvubZ4U6TriR7IRWH1cp",
  "3dsllsuguasoberu01": "1xOYHnGf0prwhRzkXSXREWYEesxrw7v2w",
  "3dsllsuguset": "1R0qDt093horEnsbXWwfIwLOnSfLkmSoB",
  "amazon20240822": "1rkRTEzQA8fgRgAa7O9oY2MQ2X1zKDpD-",
  "amazon2024121002": "1bE3wtzWJbSBmgJLy8ySh8UhCw_4Y7w_F",
  "amazon20250502psvita": "1hn4XZPzIQ1GBUXs1dN5PYM93KEqfsHOb",
  "discsystemset01": "1s8Kc1Aj4bXvpW3idaQexvacR_fGkIIfn",
  "dreamcastsuguset": "1SSMbuA1pmJ4FM4Wd2wWM4MZr4NSNzBcE",
  "dsillsuguset001": "1t4m87UGYbxDFhx42sNbDdU4ZbOUdszBR",
  "dsisuguset001": "1z3vBx_Fw_qv9WjNaOZwmxXayvsCVhBBt",
  "dssyokigataset001": "1Gnhl8M6OKhkRIQRWuLvh849sSp1rHEWC",
  "dualshock4doublepack": "1QTrDS_vUWwHFSa3NZi-kuvOxLUzDO0Li",
  "gameboymicrosuguset": "1-VZ4mdsVPynK40k9Z-gQ0Nf79tL1RoZs",
  "gamecubeset": "1-gYvubtjrAodNwyOZ1_xyVu9XB6Bo_AC",
  // 2026-10-09 追加（並び順はファイル名の順にしていないが、照合はキーで行うので影響しない）
  "tatakon-tanpin": "1h9twp2WugM4e6Bs1LCP1-827YFmVCSTY",
  "gbadvsp5color": "1R32X2kuKuN9xMlCxgugpjpDpBIwCIWhN",
  "gbapokesr2set": "1mYBSarhcmFbWCXZ4JK0m7woGEk2YiAwA",
  "gbpokemon4set": "13BtdvwriSJEZL9dn8fTzt0c4rXRygtTl",
  "merukari1000": "1Lg2o3rs8NBLWSTrDQ11li0-U6_Z_cWpo",
  "monhun4set": "1lcrRTtG5ytezoPsTUKSofx2LLPn1WIkW",
  "ps210000_39000_20210925_00001": "1R6VbUjUr5s2y0fmuSjqPN_Lgijy9xSKK",
  "ps210000_39000_mcset": "1jRovMBgA3xCPeUzOOCGTHF6XyRu2TMXr",
  "ps210000_39000_mcset-3": "1SyYIapkd8nIakHN4m3zeqEC__6PsXG7Q",
  "ps220260219001": "1RkmucK_7CwtKllcdzl9djZDuwUndv86C",
  "ps277000pk": "1BZeAoFDx0o6itPnPvz1uDc8D703tRHrl",
  "ps290000_sred_set": "1biocItUA-jbA7jjd3KQL2EZu2z9m2cFl",
  "ps2honntaijunseimem": "1erNyteL62GNQipgwDbAPZ4iUBeqIW53G",
  "ps31tbuppack2022021300001": "1KhrsHudYUeZW-thkqMsmnCpSImUlndf8",
  "ps32000-3000160_00001": "15OtTh8C_m7X4WpP9-JdYHPdu2ZfBOOQL",
  "ps3500gbuppack2022021300001": "1TEr5072oQSn4RqkvlHUVXcK6cZ0ThJlu",
  "ps3500gbuppack2022021300002": "1xqXdZG09WSPWvnUbZkyFHgmwOvUFof53",
  "ps3_4000ds3set2022021300001": "1O7QZRJ7u2Zwpyoq4kU-HC7kSmpdKBK3t",
  "ps3ffset_0001": "1ubqj00EuQ1yws7zhgYRf_xTEvqJ06B9H",
  "ps3syoki3color_001": "1hX14EU1AMRwS-sdygzWTqO2LpuL8wBlk",
  "ps41tbuppack20220528": "1L6V_iJR0eKOTTqO9dfkCVcMyhJT_zC4P",
  "ps4_pro_jyunsei": "1xtW_bfYD8bkrkQVBkoJf45WFHU-QGT7o",
  "ps4_pro_jyunsei-kyu": "1RVg6ykLDnWzwR4U7xxce2DW5Ot7DOjD3",
  "ps4_ssd_1tb": "1dAcGunozLcC40PXKSQeYxwuCUuL6elXG",
  "ps4_ssd_500gb": "120cgDbHQBWILtH2pi6F3HydT8MZJQzLk",
  "ps4cableset_001": "1jWtBPQVgYJ7cprQUzJ3XAiSDWwNEeQbo",
  "ps4gokan2000_20200": "1vqpxDZ53nBh5xe5Wcpqc5LRUHTtaae71",
  "ps4jyunsei1000_1200": "1KDNdwFuVa2NbD-mQWKcNJXiN7roXnibH",
  "ps4jyunsei2000_20200": "1AGVZS8KT04W4IKAZzUigadSHvmRAZ_MF",
  "ps4monohs": "1HHgLXtpKaXUT7-J63wwvSxo80zCfC3AR",
  "psp2000-hontai": "1GPPEjEXMpCs6HCp93F97NtriIi9S__Mx",
  "psp3000-hontai": "13Y0XD3H3UkbOTOEtbyymy-lU4WkyEcgz",
  "psp_batt_daichuoriginal_2": "1ywsvMc2-qB50ViFyO9QQdrPvNLkiUMi-",
  "psp_batt_daichuoriginal_3": "1EMlUCmuLO7ZQm3seGEKJJubgc5BQkryq",
  "pssyoki1090": "1wOTBLBnmjE5Ts6xg0AIjErGMJhGL15Ht",
  "sfc_cont_2": "1Jn8V98JLt_1qNV4CMcaZou8xqm6e2DYL",
  "sfcminisuguasoberu": "15S-DfcmawSDaiyS--Cwa4mIHWfp1ZGzt",
  "sfcsuguasoberu": "1OJDkRmfQ8MAGRVrwnbRsUPZIf4r210Ko",
  "sssiguset2color": "1UnhUN_AxN2X7ewD0QeSA5VQjf-QraP_J",
  "switch-4con-sugu-set": "116cFCMiknNO5NtbdVJcI8rt5cQMOOsXh",
  "switch-sd-sugu-s": "1TM0cECEWE4iJA2gue5xE-ZcFZMMDNC-P",
  "switch-sugu-set": "104prSxkkGamBjzLgsL1n7DtgSNwIi4zk",
  "switch-sugu-setkyu": "1Vl51oc568LmDB9rnRcYC0KlO8PFMZXDr",
  "switch_joyconstrap": "12HBH12YGPiuqz70LmBwcGRZ0ziEaqYbo",
  "switchel-sugu-set": "1lsMVYnU4OXcWEfFLn8krBt4wtMK_qM31",
  "switchnomal0002sd64": "1ocMo06ROQcX4zbJ7l0qqY2PwiXqhJewe",
  "vitatv_whiteset": "1PLJbYaPloYb9quDXQVYbGD3cbvhQeT82",
  "wii-balanceboadset01": "1KLdP0X8ssBwVR-b4Vkq8HRYnREOj01oV",
  "wii_4p_mariopartyset": "17lcpARdVj9JbhgmndrKeD3TPETYlZuFc",
  "wii_4p_momotetsuset": "1_LNfoeahPmwZkA0IBc23bHs2NO28Oiv2",
  "wii_4p_momotetsuset2": "1v3w4UHRdsgZykWjY_uhIl5JBJHcLIFPf",
  "wii_4p_momotetsuset2_1": "1g5Yl9SyB4ZXmqupLp5Ec-NdXlJO2wuMd",
  "wii_4p_momotetsuset2_2": "1P9dnu-iJotqqqiYoYlonXribPYx-Albu",
  "wii_4p_momotetsuset2_3": "1AdPzoxubdp9lGwx4LwZL1JakgGTWIUG7",
  "wii_4p_momotetsuset_1": "1vY11BVlsZcp8y068jsMxmnRwRO8ZMa5N",
  "wii_4p_momotetsuset_2": "1ND_QZUKEnRSub1-nRMOHOdHIJK8KtFQn",
  "wii_4p_momotetsuset_3": "1smEkdpfHsgf-064khALAu3SmYgQDa4dJ",
  "wii_classiccontpro2_smabro": "1LIaA-LM2Xz07-dFnjDUWjy8QYUBujFov",
  "wii_classiccontpro_smabro": "1A420la0hJgwavNs50zyVAkZ2NNWCOlqp",
  "wii_handle_02": "1eJOMhg8Gx8kwswgC9Uo_lI6PTMK0Xqp9",
  "wii_handle_mariiocartset": "1afc5hJVgmNJOJcbgqExaaYIAdgp5Xc-a",
  "wii_handle_mariiocartset_1": "1rUUgOa4DP_HZeWPF964Q8fWWMioKRJJD",
  "wii_handle_mariiocartset_3": "1cg9AaXfkhU_8hU1L2BsTyYZXtpSF1H5J",
  "wii_handle_mariiocartset_4": "1P-jgbTdQgcH-JPTyYV9SilAfVhdzmhxd",
  "wii_huzokuhinset_001": "1kOZ2RqzkGJvUsoZ2uHyFRj4T6NDT3iMh",
  "wii_marioparty9_001": "1YCLbr3NiZg79pUt-wtUwXhOm7tQ7Gm28",
  "wii_marioparty9_002": "14fM9YOKjrcyfLcUlAMuH1RmX1lGgGD1Y",
  "wii_marioparty9_003": "1Hi8Fz4CzWJ2XmdtRKe_ykdI3jssiNWd8",
  "wii_marioparty_001": "19ZcHPzIBgMBDHGgFHAxt_oGXQlrxksQB",
  "wii_marioparty_002": "11Q7vXIUn-8IIR6gneiB4CKXK2e7m1ZVt",
  "wii_marioparty_003": "124_avMqg10y1oYDoLAMmjCuXzCyanW0D",
  "wii_remocon_nunchakuset": "1jLxg2e1LmeSzrmAeHdhLbaa1G81nCbhL",
  "wii_tatakon_2set_chogouka": "1uTim5qytuQkbJfffw04JlDM6ufWPbyQu",
  "wii_tatakon_2set_ketteiban": "1IarkDhBDcfSBk6uBixioFeCRY5X6HA07",
  "wii_tatakon_2set_tokumori": "1RrxlhcrqK5zsVYzSW23N-bFFgLNarXL4",
  "wii_tatakon_2set_tokumori_rimocn": "1STyn52V62VkE6JXSrlK4_Q18JQLDWYBp",
  "wii_tatakon_2set_wii": "1KyBTPgMuvMdceakWXV0v0VGhM8jH-fg3",
  "wiihdmiset001": "1GpsuLDdCjp31H-rW8WIERdumBdj-eL59",
  "wiinomal2pset_0001": "1FKuZg7hTYEHhT-PMC7UrbkCGxR05MqFJ",
  "wiinomal2pset_0001_hutanashi": "1Bw7XHt0RzHuOX851BTYJx7mVpBWgMRcq",
  "wiinomalbattset0001": "1nXCbMXhW6DkQjsa0t3KaLk8nSdO6_bBG",
  "wiinomalset_0001": "1dL_X8k2RiA0zd_L_K1N05vOO4lAnD_rw",
  "wiinomalset_0001_hutanashi": "16c9Z8JD8NG70g8PlLLXPBNb4D7njEwaw",
  "wiiplusset_0001": "1rjy7NZoqEaDokhj37t7qGkW8m9o6gjv3",
  "wiirimokonnomal_3set_shiro_001": "1Rysm0k1Uy-u5WyjKgR9ub_FtJyG8SHiB",
  "wiirimokonsennsa": "1Wm0fcEuFm37AHSQnKxFmGLCai180WpGj",
  "wiisports_rimonunset": "1fAs28UTiV9NBV1o43AMAUWBD2IDw3ftP",
  "wiisportsresort_rimonunset": "18ou8A5r32LwSUfazEG1CyUW1QxNFES8x",
  "wiitt22daime": "15fISjfarVrR5RL95h_s0Q4A3-xa9-6q0",
  "wiiu8gbsuguset": "1diI2w0L--VOZ389VMfTDCDRX3ngi2yCl",
  "wiiu_handle_mariiocart8": "1QX4XWw8bbtEHAuz9NkytaNvxaNKZ008S",
  "wiiu_marioparty10_001": "1hH0EkD4Ux-ySUsFY21a9hsGvjOHdD4u4",
  "wiiu_marioparty10_002": "1E3Vjzf2e_9yNQ2RqyZ2mkQff8IEITY5m",
  "wiiu_marioparty10_003": "1jJ4KFJYDeEvUabCMn8ZmViLHnIn09FEk",
  "wiiu_marioparty10_004": "1P54eg0W9N8MqNK6FKryHeI6Jx4S22wEy",
  "wiiu_premium_suguasoberuset": "1Wz2janlkO_Ic1jLxBhCcEF8bppmD6ZqT",
  "wiiu_smabro_poroconset": "1cPU-PvNEtYqEk0iIhguZWaU62q2WkDIE",
  "wiiu_smabro_poroconset2": "1-paJVXDAI3n6aDcnH40gM7h6J8-u1zOM",
  "wiiu_standset__001": "1A9BaACWskAJ6VPd0voVBfLl4UyLsJaK6",
  "wiiu_syuhenset__001": "1fGFfg-37aSXS5u_C8IMCsMnuFEfSt5L0",

  // === 追加画像（2026-07-06）===
  "2679-002774": "1Dwm7TyJljkS9g6HTyUPigQ5iH2hJsHRz",
  "2679-002901": "1YKA1fklxJ1t3AVFWcYz7pYbhONfGG1zL",
  "2679-004394": "1Byf-xsUM0imyrAzcsv_X6vT2zFpjQTtv",
  "2679-009814": "1mrBKB8T6umsJ-C0yyhOrMWTbGfVwD2Ss",
  "3dscolor6011801": "15VebIWcIhhHdicWKmxJUS-KB_QVweT1d",
  "3dscolor8jyun": "1e-bcbUa_5faAe04Lq-e3kO5SC3syr1To",
  "3dscolor8sdusbsoft": "1dsmC3UWWwjGYjuPivHqQgPdVYrlvvUqY",
  "64asoberuset01": "1t1ccaEp1Hxm1KrjnlgZDbPgx1gAPaew5",
  "dslite8color": "1o1MZ0A5N1EZ1AM93bDLT-CFGyl6vfJ9D",
  "dualshock3200001": "1_VfNU2OCw6ly3CgO_G1_h3zBzoI_TMv2",
  "hajimewii01": "1GxabV-gLe8fonR_CvKWz8VkoGKGP6b41",
  "mcpsmcps2set": "1l6dt1YcU2f31fXjO6DaRvC_zFajsDboZ",
  "new3dscolor21401": "17zjvGDUI9SBfzePcEHGPR3FFw9fSUdNl",
  "new3dslcol621402": "1xk5oSE3N1N-KkhIbYGlo-Kmg6fraraGz",
  "ps21000039000hdmi": "1swfgtTSEDALYopdIIQQInF1kpC5rlM8M",
  "ps2103992003g": "1DpgpJ9mmVqrUKB_NHRmiXV5v4OuGC9Jy",
  "ps2103992503g2": "1bXyEsj6uxvrGzdGan2PycihCyU0PZQ9v",
  "ps2109-3992502": "1XhN4LvcDxH_LgoUp25z9Ru5Xzkot3mFk",
  "ps250101701": "1F1xKWSNMib8d6VT9hsxoeGVSr3sROhwf",
  "ps270-7701": "1vQIBx5JyGSGD7GFaQlRsq5kYP8uqVEA2",
  "ps270-77202": "1BQhj2MKI5YzmGFZlkk05EZX-eeNvcgUQ",
  "ps270-7733": "1oOz_Lm0d9XE2ZlnjGTydwl36Nc4dKF6W",
  "ps27077hdmi": "1QfdJvvPtjNYEExwNTdHHlwYyFQxmMyIU",
  "ps290sug021401": "1l13EBer18isW_rne7AT73Eu2B5qzoECY",
  "ps2mc2sset": "1SH0NZD-9DkB6YZSV8kyIsXN2cTVmmbZN",
  "ps3203012001": "1BvnthWFyPFUuwEcns4U1kLZFHXjAQuH1",
  "ps3500g213001": "1H1VyIALXq1x0V9lhM5bzgNjFXDlzbB4s",
  "ps360gcecha002": "12e_syKmLbhK8l7CqEsL4Od4xnv4PwmTv",
  "wii4pmmt2isn": "1uDqRxYQEPcnHrLedGCv7ojWysjnQUXje",
  // === エイリアス（セット定義IDと画像ファイル名の不一致を解消）===
  "ps210-390001": "1R6VbUjUr5s2y0fmuSjqPN_Lgijy9xSKK",
  "ps3203016101": "15OtTh8C_m7X4WpP9-JdYHPdu2ZfBOOQL",
  "ps3403set213001": "1O7QZRJ7u2Zwpyoq4kU-HC7kSmpdKBK3t",
  "pspbatorig2": "1ywsvMc2-qB50ViFyO9QQdrPvNLkiUMi-",
  "pspbatorig3": "1EMlUCmuLO7ZQm3seGEKJJubgc5BQkryq",
  "wiihandmcset": "1afc5hJVgmNJOJcbgqExaaYIAdgp5Xc-a",
  "wiihandmcset1": "1rUUgOa4DP_HZeWPF964Q8fWWMioKRJJD",
  "wiihandmcset3": "1cg9AaXfkhU_8hU1L2BsTyYZXtpSF1H5J",
  "wiihandmcset4": "1P-jgbTdQgcH-JPTyYV9SilAfVhdzmhxd",
  "wiiclaconsbr": "1A420la0hJgwavNs50zyVAkZ2NNWCOlqp",
  "wiiclacon2sb": "1LIaA-LM2Xz07-dFnjDUWjy8QYUBujFov",
  "wiiremnunset": "1jLxg2e1LmeSzrmAeHdhLbaa1G81nCbhL",
  "wiirimoc3001": "1Rysm0k1Uy-u5WyjKgR9ub_FtJyG8SHiB",
  "wiitatakon2setwii": "1KyBTPgMuvMdceakWXV0v0VGhM8jH-fg3",
  "wiitt2gouka": "1uTim5qytuQkbJfffw04JlDM6ufWPbyQu",
  "wiitt2kettei": "1IarkDhBDcfSBk6uBixioFeCRY5X6HA07",
  "wiittkn2settkmr": "1RrxlhcrqK5zsVYzSW23N-bFFgLNarXL4",
  "wiitt2tokumo": "1STyn52V62VkE6JXSrlK4_Q18JQLDWYBp",
  "wii4pmomotetsuset2": "1v3w4UHRdsgZykWjY_uhIl5JBJHcLIFPf",
  "wii201huta": "1Bw7XHt0RzHuOX851BTYJx7mVpBWgMRcq",
  "1": "16c9Z8JD8NG70g8PlLLXPBNb4D7njEwaw",
  "wiisprimnun01": "18ou8A5r32LwSUfazEG1CyUW1QxNFES8x",
  "wiiuhandlemc8": "1QX4XWw8bbtEHAuz9NkytaNvxaNKZ008S",
  "wiiupresuguset": "1Wz2janlkO_Ic1jLxBhCcEF8bppmD6ZqT",
  "wiiusabpcon2": "1-paJVXDAI3n6aDcnH40gM7h6J8-u1zOM",
};

/**
 * 文字列を正規化: 小文字化、アンダースコア/ハイフン/スペース除去、末尾ゼロ除去。
 * "wii_4p_mariopartyset" と "wii4pmariopartyset" を同一視するため。
 */
function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[-_ ]/g, "").replace(/0+$/, "");
}

/**
 * セット定義IDから画像URLを検索。
 * 正規化マッチ（アンダースコア/ハイフン/大文字小文字の差を吸収）で照合。
 */
export function getSetImageUrl(setId: string): string | null {
  // Phase 1: 完全一致
  if (IMAGE_MAP[setId]) {
    return getDriveImageUrl(IMAGE_MAP[setId]);
  }

  // Phase 2: 正規化マッチ
  const normId = normalizeKey(setId);
  for (const [key, fileId] of Object.entries(IMAGE_MAP)) {
    if (normalizeKey(key) === normId) {
      return getDriveImageUrl(fileId);
    }
  }

  // Phase 3: 部分一致（片方がもう片方で始まる場合）
  for (const [key, fileId] of Object.entries(IMAGE_MAP)) {
    const normKey = normalizeKey(key);
    if (normKey.startsWith(normId) || normId.startsWith(normKey)) {
      return getDriveImageUrl(fileId);
    }
  }

  return null;
}