/** How long a wait gives its condition, and how often it looks: one budget
 * for every wait in the suite. What a test waits on mostly arrives from a
 * subprocess, which a loaded machine (Windows under the full suite) slows
 * several-fold; a wait that runs out fails the test, so the budget is
 * generous and a met condition still returns at once. */
export const SETTLE = { timeout: 5_000, interval: 10 };

/** Polls until `probe` holds, and returns what it found — the shape every
 * wire test needs when the thing it asserts arrives from a subprocess.
 * `undefined` and `false` both mean "not yet": a probe written as a plain
 * comparison waits, never passes on its first look. */
export async function waitFor<T>(probe: () => T | false | undefined, timeoutMs = SETTLE.timeout): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = probe();
    if (value !== undefined && value !== false) return value as T;
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, SETTLE.interval));
  }
}
