// The test-end stack every harness and temp folder registers with: what was
// made last ends first — an agent stops before the folder it runs in goes —
// and one end failing never skips the rest.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { atTestEnd, drain, tempDir } from "./support/teardown";

describe("test teardown", () => {
  it("ends the last registered first, every one of them, and reports the first failure", async () => {
    const ran: string[] = [];
    atTestEnd(() => ran.push("folder"));
    atTestEnd(() => {
      ran.push("agent");
      throw new Error("agent wouldn't stop");
    });
    atTestEnd(() => ran.push("server"));
    await expect(drain("test")).rejects.toThrow("agent wouldn't stop");
    expect(ran).toEqual(["server", "agent", "folder"]);
    await drain("test"); // emptied: nothing runs twice
    expect(ran).toHaveLength(3);
  });

  it("a test's folder outlives everything started after it", async () => {
    const dir = await tempDir("patchbay-teardown-");
    let sawFolder: boolean | null = null;
    atTestEnd(() => (sawFolder = existsSync(dir)));
    await drain("test");
    expect(sawFolder).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });
});
