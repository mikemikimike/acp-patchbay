// A folder of a test's own, removed however the test ends — the electron
// suite's home for it, beside test/support's, which runs on vitest's hooks
// where this suite runs on mocha's. The hooks are root ones, registered
// once, serving every suite that makes a folder.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const forTest: string[] = [];
const forRun: string[] = [];

teardown(async () => {
  for (const dir of forTest.splice(0)) await rm(dir, { recursive: true, force: true });
});
suiteTeardown(async () => {
  for (const dir of forRun.splice(0)) await rm(dir, { recursive: true, force: true });
});

/** A folder removed once the test that made it has ended — after the
 * test's own suite teardown, so whatever that closes is closed first. */
export async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  forTest.push(dir);
  return dir;
}

/** A folder for a whole suite's tests, removed once the run has ended. */
export async function runTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  forRun.push(dir);
  return dir;
}
