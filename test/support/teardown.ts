// What a test leaves behind, ended in order. Work registered here runs when
// the test ends — passed or failed — last registered first: a folder is made
// before the agent that runs in it, so the agent stops before its folder
// goes. A failed assertion can't leave a process holding a folder that
// cleanup then fails to remove (on Windows that EBUSY used to bury the real
// failure). Drained by test/setup/teardown.ts.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentPool } from "../../src/orchestrator/pool";

type End = () => Promise<unknown> | unknown;

const testEnds: End[] = [];
const fileEnds: End[] = [];

/** Runs `end` when the current test ends. */
export function atTestEnd(end: End): void {
  testEnds.push(end);
}

/** Runs `end` when the current file's tests are done — for what a whole
 * file shares, made in a `beforeAll`. */
function atFileEnd(end: End): void {
  fileEnds.push(end);
}

/** Runs and empties a stack, last first; every entry runs even when one
 * throws, and the first failure is thrown once all have. */
export async function drain(which: "test" | "file"): Promise<void> {
  const stack = which === "test" ? testEnds : fileEnds;
  let failure: unknown;
  for (let end = stack.pop(); end !== undefined; end = stack.pop()) {
    try {
      await end();
    } catch (err) {
      failure ??= err;
    }
  }
  if (failure !== undefined) throw failure;
}

/** Every agent the pool started, stopped — at the end of the test that
 * built it. A stop asked again returns the same stop, so a test that
 * already stopped its agents loses nothing. */
export function stopsAtTestEnd(pool: AgentPool): void {
  atTestEnd(() => Promise.all(pool.list().map((agent) => pool.stop(agent.spec.patchbayAgentId))));
}

// Retried: on Windows a process that has just ended can still hold its
// folder for a moment (EBUSY).
const removed = (dir: string) => () => rm(dir, { recursive: true, force: true, maxRetries: 10 });

/** A new folder for this test under the OS temp root, removed when the test
 * ends — after whatever was started in it has stopped. */
export async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  atTestEnd(removed(dir));
  return dir;
}

/** A new folder the whole file shares, removed when its tests are done. */
export async function fileTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  atFileEnd(removed(dir));
  return dir;
}
