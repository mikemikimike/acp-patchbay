// The fake ACP agent as the suite launches it: the bundle globalSetup builds,
// a launch of it running a script in a folder, and the record it keeps for a
// session it holds.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LaunchSpec } from "../../src/orchestrator/pool";
import type { PatchbayAgentId } from "../../src/shared/ids";
import type { FakeAgentScript } from "../fake-agent/main";
import { storeFile } from "../fake-agent/store";
import type { PackageSource } from "./npm-registry";

/** The bundle test/setup/build-fake-agent.ts builds before the suite. */
export const FAKE_AGENT = join(process.cwd(), "out-test", "fake-agent.mjs");

/** The fake agent, launched in `cwd` to play `script`. */
export function fakeAgent(script: FakeAgentScript, patchbayAgentId: string, cwd: string): LaunchSpec {
  return {
    patchbayAgentId: patchbayAgentId as PatchbayAgentId,
    name: "Fake Agent",
    command: process.execPath,
    args: [FAKE_AGENT],
    env: { FAKE_AGENT_SCRIPT: JSON.stringify(script) },
    cwd,
  };
}

/** The record the fake agent keeps for a session it holds. */
export const fakeSessionRecord = storeFile;

/** A session the fake agent already holds when the test starts — the
 * record it would have written for it. */
export async function heldFakeSession(cwd: string, sessionId: string): Promise<void> {
  const file = storeFile(cwd, sessionId);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, "", "utf8");
}

/** The fake agent as an npm package: its bin starts the bundle above — what
 * a registry agent's `npx -y <package>` launch runs, served by a registry of
 * the test's own (npm-registry.ts). */
export function fakeAgentPackage(): PackageSource {
  return {
    manifest: { bin: { "patchbay-fake-agent": "cli.js" } },
    files: { "cli.js": `#!/usr/bin/env node\nimport(${JSON.stringify(pathToFileURL(FAKE_AGENT).href)});\n` },
  };
}
