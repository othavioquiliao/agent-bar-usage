import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: [
      // Uses Bun-native APIs (Bun.listen/Bun.connect) — run with `bun test` instead
      "test/service-runtime.test.ts",
      // Uses Bun-native APIs (Bun.file/Bun.write) — run with `bun test` instead
      "test/settings.test.ts",
    ],
  },
});
