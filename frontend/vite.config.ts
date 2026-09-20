import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * base（公開URLのパス）は環境変数で切り替える。
 *
 * 本番とテスト用でリポジトリ名が違うため、
 * GitHub Actions 側から VITE_BASE を渡して切り替える。
 * 指定がなければ本番のパスを使う。
 *
 * 手元でテスト用にビルドする場合:
 *   npm run build -- --base=/daichu_game_packing_support_test/
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE ?? "/daichu_game_packing_support/",
});