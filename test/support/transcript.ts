// Reading what a session's transcript shows, the one way every test reads it.
import type { AgentViewState } from "../../src/shared/protocol";

/** What the fake agent echoed back on its latest turn (echoRoots,
 * echoBlocks, echoBlockKinds, a tool's JSON answer): the parsed text of the
 * session's last text block. A session with none fails, naming it — never
 * reads as an empty or false value an expectation could match. */
export function echoed(state: AgentViewState, patchbaySessionId: string): unknown {
  const last = state.transcripts[patchbaySessionId]?.filter((b) => b.kind === "text").at(-1);
  if (last?.kind !== "text") throw new Error(`${patchbaySessionId} shows no text block to read an echo from`);
  return JSON.parse(last.text) as unknown;
}

/** The latest event of `kind` a view was sent, or undefined if none was. */
export function lastEvent<E extends { kind: string }, K extends E["kind"]>(events: readonly E[], kind: K): Extract<E, { kind: K }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (event.kind === kind) return event as Extract<E, { kind: K }>;
  }
  return undefined;
}
