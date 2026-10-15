import { defineConfig } from "vitest/config";
// @ts-expect-error — plain-JS build script, no declaration.
import { CATALOG_JSON, foldCatalog } from "./scripts/catalog-glyphs.mjs";

export default defineConfig({
  plugins: [
    // The same fold the extension bundle gets (esbuild.mjs): the curated
    // catalog's vendor marks come from data/icons/<id>.svg, so tests load
    // the catalog exactly as it ships — a missing or malformed icon fails
    // here first.
    {
      name: "catalog-glyphs",
      enforce: "pre",
      load(id) {
        if (!CATALOG_JSON.test(id)) return null;
        const { json, files } = foldCatalog(id);
        for (const f of files) this.addWatchFile(f);
        return json;
      },
    },
  ],
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["test/vscode/**"],
    environment: "node",
    globalSetup: ["test/setup/build-fake-agent.ts"],
    setupFiles: ["test/setup/teardown.ts"],
    // A Windows process starts slowly, and the suite starts many at once:
    // a test that spawns the fake agent, ~1.4 s alone there, ran past the
    // default 5 s under the full suite's load.
    testTimeout: process.platform === "win32" ? 20_000 : 5_000,
  },
});
