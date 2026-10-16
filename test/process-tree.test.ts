// P15 gate (mechanics half): tree-wide kill against real spawned process
// trees, the PID-reuse guard, orphan reaping, and pool.stop's graceful
// ladder against a SIGTERM-ignoring agent that survives stdin EOF — the
// exact process the ladder exists for. Every process here is this Node, so
// each platform's own arm runs: process groups and signals on POSIX,
// taskkill /T and the CIM command line on Windows (where the ladder's
// polite rung is already the forced one).
import { spawn } from "node:child_process";
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { describe, expect, it, vi } from "vitest";
import { stopsAtTestEnd } from "./support/teardown";
import { SETTLE } from "./support/wait-for";
import { commandOf, isAlive, killTree, reapOrphans, treeSpawnOptions } from "../src/orchestrator/process-tree";
import { AgentPool } from "../src/orchestrator/pool";
import { stubFsTerminalHooks } from "./support/stub-hooks";
import type { PatchbayAgentId } from "../src/shared/ids";

/** A process of this Node that idles until killed; `marker` rides its
 * command line, so a read of that line can tell it from any other. */
function idler(marker: string) {
  return spawn(process.execPath, ["-e", IDLE, marker], { stdio: "ignore", ...treeSpawnOptions });
}
const IDLE = "setInterval(() => {}, 1 << 30)";

async function waitUntil(probe: () => boolean, what: string): Promise<void> {
  await vi.waitFor(
    () => {
      if (!probe()) throw new Error(`timed out waiting for ${what}`);
    },
    SETTLE,
  );
}

/** How a grandchild is spawned to outlive its parent on its own — the
 * case a tree kill exists for. On POSIX any child does; on Windows a Node
 * child is held in its Node parent's job and dies with it, so it is spawned
 * outside it — as a .cmd wrapper's node is, which nothing but taskkill /T
 * reaches. */
const SURVIVING_CHILD = JSON.stringify({ stdio: "ignore", detached: process.platform === "win32", windowsHide: true });

/** A leader that reports its idling grandchild's pid on stdout, then
 * idles too — a real two-level tree. */
function spawnTree(): Promise<{ leaderPid: number; grandchildPid: number }> {
  return new Promise((resolve, reject) => {
    const leader = spawn(
      process.execPath,
      ["-e", `const c = require("node:child_process").spawn(process.execPath, ["-e", ${JSON.stringify(IDLE)}], ${SURVIVING_CHILD}); console.log(c.pid); ${IDLE};`],
      { stdio: ["ignore", "pipe", "ignore"], ...treeSpawnOptions },
    );
    leader.once("error", reject);
    leader.stdout.setEncoding("utf8");
    let out = "";
    leader.stdout.on("data", (chunk: string) => {
      out += chunk;
      const line = out.split("\n")[0];
      if (line !== undefined && line.trim() !== "") {
        resolve({ leaderPid: leader.pid!, grandchildPid: Number(line.trim()) });
      }
    });
  });
}

describe("killTree", () => {
  it("ends the whole tree, grandchild included", async () => {
    const { leaderPid, grandchildPid } = await spawnTree();
    expect(isAlive(leaderPid)).toBe(true);
    expect(isAlive(grandchildPid)).toBe(true);

    killTree(leaderPid, "SIGKILL");
    await waitUntil(() => !isAlive(leaderPid) && !isAlive(grandchildPid), "tree death");
  });

  it("is a no-op on an already-dead tree — ESRCH is success", () => {
    expect(() => killTree(99_999_999, "SIGKILL")).not.toThrow();
  });
});

describe("commandOf", () => {
  it("reads a live command line, and \"\" for a gone pid", async () => {
    const child = idler("patchbay-idler");
    await waitUntil(() => child.pid !== undefined, "spawn");
    expect(await commandOf(child.pid!)).toContain("patchbay-idler");
    killTree(child.pid!, "SIGKILL");
    await waitUntil(() => !isAlive(child.pid!), "death");
    expect(await commandOf(child.pid!)).toBe("");
  });
});

describe("reapOrphans", () => {
  it("kills a live record whose command still matches; spares a mismatch (reused pid)", async () => {
    const orphan = idler("patchbay-orphan");
    const bystander = idler("patchbay-bystander");
    await waitUntil(() => orphan.pid !== undefined && bystander.pid !== undefined, "spawn");
    const records = [
      { pid: orphan.pid!, command: await commandOf(orphan.pid!) }, // honest record
      { pid: bystander.pid!, command: "something-entirely-different" }, // "reused" pid
      { pid: 99_999_999, command: "long gone" }, // dead — dropped silently
    ];

    const { killed, spared } = await reapOrphans(records);

    expect(killed.map((r) => r.pid)).toEqual([orphan.pid]);
    expect(spared.map((r) => r.pid)).toEqual([bystander.pid]);
    await waitUntil(() => !isAlive(orphan.pid!), "orphan death");
    expect(isAlive(bystander.pid!)).toBe(true); // never kill what we can't match
    killTree(bystander.pid!, "SIGKILL");
  });
});

// A minimal ACP agent that answers `initialize` correctly, then refuses to
// die politely: ignores SIGTERM, survives stdin EOF, and holds a real
// grandchild — everything the ladder's SIGKILL rung exists for. Inlined so
// this test file is self-contained (the fake agent stays a well-behaved
// citizen; stubbornness is this test's own concern).
const STUBBORN_AGENT = `
process.on("SIGTERM", () => {});
const { spawn } = require("node:child_process");
const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], ${SURVIVING_CHILD});
console.error("grandchild " + grandchild.pid);
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  const lines = buf.split("\\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (line.trim() === "") continue;
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: JSON.parse(process.env.ACP_PROTOCOL_VERSION),
          agentCapabilities: {},
          authMethods: [],
          agentInfo: { name: "stubborn", version: "0.0.0" },
        },
      }) + "\\n");
    }
  }
});
process.stdin.on("end", () => {});
setInterval(() => {}, 1 << 30);
`;

describe("pool.stop ladder", () => {
  it("a SIGTERM-ignoring, EOF-surviving agent still ends up dead — tree and all — and reads \"stopped\"", async () => {
    const statuses: string[] = [];
    const pool = new AgentPool({
      onStatusChanged: (_id, status) => statuses.push(status),
      onDeclaredCaptured: () => {},
      onSessionUpdate: () => {},
      ...stubFsTerminalHooks(),
    });
    stopsAtTestEnd(pool);
    await pool.connect({
      patchbayAgentId: "stubborn" as PatchbayAgentId,
      name: "Stubborn",
      command: process.execPath,
      args: ["-e", STUBBORN_AGENT],
      env: { ACP_PROTOCOL_VERSION: JSON.stringify(PROTOCOL_VERSION) },
      cwd: process.cwd(),
    });

    // The grandchild announces itself on stderr → pool's stderrTail.
    let grandchildPid = 0;
    await waitUntil(() => {
      const line = pool.get("stubborn" as PatchbayAgentId)?.stderrTail.find((l) => l.startsWith("grandchild "));
      if (line === undefined) return false;
      grandchildPid = Number(line.slice("grandchild ".length));
      return true;
    }, "grandchild announcement");
    expect(isAlive(grandchildPid)).toBe(true);

    await pool.stop("stubborn" as PatchbayAgentId, { eofMs: 120, termMs: 250, killMs: 3_000 });

    expect(pool.get("stubborn" as PatchbayAgentId)?.status).toBe("stopped");
    expect(statuses.at(-1)).toBe("stopped");
    await waitUntil(() => !isAlive(grandchildPid), "grandchild death");
  });
});
