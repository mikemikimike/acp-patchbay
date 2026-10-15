// Where the fake agent keeps each session's record, so session/load
// survives its process dying — read by the agent itself, and by tests that
// seed a session it already holds or check one it wrote.
import { join } from "node:path";

export function storeDir(cwd: string): string {
  return process.env.FAKE_AGENT_STORE ?? join(cwd, ".fake-agent-sessions");
}

export function storeFile(cwd: string, sessionId: string): string {
  return join(storeDir(cwd), `${sessionId}.jsonl`);
}
