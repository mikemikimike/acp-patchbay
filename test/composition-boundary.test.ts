// A test reaches a composed component the way the window does: through the
// orchestrator that wires it (support/orchestrator-harness.ts), with only
// its VS Code ports stood in for. A test that builds the component itself
// wires it its own way, and its pass then says nothing about the window's
// wiring. The one exception is a unit test of the component itself — the
// component its subject, its neighbours stand-ins — named below with the
// components it builds; an entry no file needs any more fails too, so the
// list stays the list.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));

/** The components the orchestrator composes. */
const COMPOSED = [
  "Orchestrator",
  "AgentPool",
  "SessionsStore",
  "SessionGates",
  "AgentsStore",
  "AgentGates",
  "CapabilityTracker",
  "McpServersStore",
  "McpServerGates",
  "AsksStore",
  "PermissionBroker",
  "DefaultsEditor",
  "IpcHost",
  "WireLog",
];

/** Who may build which, and why: the harness builds the window; each other
 * file is the unit test of what it builds. */
const BUILDS: Record<string, readonly string[]> = {
  "support/orchestrator-harness.ts": ["Orchestrator"],
  "support/e2e-repair-drive.ts": ["AgentPool"],
  "pool.test.ts": ["AgentPool"],
  "process-tree.test.ts": ["AgentPool"],
  "wire-log.test.ts": ["AgentPool", "WireLog"],
  "agent-gates.test.ts": ["AgentGates"],
  "asks-store.test.ts": ["AsksStore"],
  "broker.test.ts": ["AsksStore", "PermissionBroker"],
  "capability-matrix.test.ts": ["CapabilityTracker"],
  "mcp-servers-store.test.ts": ["McpServerGates", "McpServersStore"],
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** What each test file builds of the composed components, sorted. */
function built(): Record<string, string[]> {
  const construction = new RegExp(`\\bnew (${COMPOSED.join("|")})\\(`, "g");
  return Object.fromEntries(
    walk(TEST_ROOT).flatMap((path) => {
      const names = [...new Set([...readFileSync(path, "utf8").matchAll(construction)].map((m) => m[1]!))].sort();
      return names.length > 0 ? [[relative(TEST_ROOT, path).split("\\").join("/"), names]] : [];
    }),
  );
}

describe("composition boundary", () => {
  it("a composed component is built only by the harness and by its own unit test", () => {
    expect(built()).toEqual(BUILDS);
  });
});
