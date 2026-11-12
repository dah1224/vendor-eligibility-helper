// Design Ref: §12.1 — 판정 함수 자동 테스트(Vitest) 설정
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // `import "server-only"`는 Next.js 빌드 안에서만 풀리므로, 테스트에서는 빈 파일로 대신한다.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
