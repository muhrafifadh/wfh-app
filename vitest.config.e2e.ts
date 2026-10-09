import { defineConfig } from "vitest/config";

// Runs against the postgres-test container (docker compose up -d postgres-test).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    fileParallelism: false,
  },
});
