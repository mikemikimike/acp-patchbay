// Export: the picked parts of the machine store, read from the real stores
// over one in-memory KV, beside the secrets their records name.
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportConfiguration, writeConfigurationFile, type ExportSources } from "../src/orchestrator/config-export";
import { AgentConfigStore } from "../src/orchestrator/stores/agent-configs";
import { ComposerKnobsStore } from "../src/orchestrator/stores/composer-knobs";
import { MemoryKV } from "../src/orchestrator/stores/kv";
import { McpServerConfigStore } from "../src/orchestrator/stores/mcp-server-configs";
import { MemorySecrets } from "../src/orchestrator/stores/mcp-server-tokens";
import { MachineRulesStore } from "../src/orchestrator/stores/permission-rules";
import { PreferencesStore } from "../src/orchestrator/stores/preferences";
import { SavedRootsStore } from "../src/orchestrator/stores/saved-roots";
import { SecretEnvStore } from "../src/orchestrator/stores/secret-env";
import type { ExportPart } from "../src/shared/protocol";
import type { PatchbayAgentId, PatchbayMcpServerId } from "../src/shared/ids";

async function machine() {
  const kv = new MemoryKV();
  const secrets = new MemorySecrets();
  const agentConfigs = new AgentConfigStore(kv);
  const composerKnobs = new ComposerKnobsStore(kv);
  const mcpServerConfigs = new McpServerConfigStore(kv);
  const preferences = new PreferencesStore(kv);
  const machineRules = new MachineRulesStore(kv);
  const machineRoots = new SavedRootsStore(kv, "machine");
  const workspaceRoots = new SavedRootsStore(new MemoryKV(), "workspace");
  const agentEnv = new SecretEnvStore(secrets, "acpPatchbay.agent");
  const mcpServerEnv = new SecretEnvStore(secrets, "acpPatchbay.integration");
  const keys: Record<string, string> = { keyed: "secret-abc" };

  await agentConfigs.add({
    id: "claude" as PatchbayAgentId,
    name: "Claude",
    command: "npx",
    args: ["claude-agent-acp"],
    autoConnect: true,
    defaults: {},
    registrySource: null,
    lastSeenVersion: "1.2.0",
  });
  await agentConfigs.add({
    id: "bare" as PatchbayAgentId,
    name: "Bare",
    command: "bare-acp",
    args: [],
    autoConnect: false,
    defaults: {},
    registrySource: null,
    lastSeenVersion: null,
  });
  await agentEnv.set("claude", { ANTHROPIC_API_KEY: "sk-1" });
  await composerKnobs.record("claude" as PatchbayAgentId, { mode: "plan" });
  await mcpServerConfigs.add({
    id: "keyed" as PatchbayMcpServerId,
    name: "Keyed",
    source: { kind: "custom-http", url: "https://example.test/mcp", authType: "header", headerName: "Authorization", valuePrefix: "Bearer " },
    routing: "auto",
    active: true,
    transport: "auto",
  });
  await mcpServerConfigs.add({
    id: "local" as PatchbayMcpServerId,
    name: "Local",
    source: { kind: "custom-stdio", command: "tool", args: [] },
    routing: "auto",
    active: true,
    transport: "auto",
  });
  await mcpServerEnv.set("local", { TOKEN: "t-1" });
  await preferences.set({ statsPrompts: false });
  await machineRules.set([{ pattern: "git status", verdict: "allow" }]);
  await machineRoots.add("/home/me/notes");
  await workspaceRoots.add("/home/me/workspace-only");

  const sources: ExportSources = {
    agents: {
      entries: [agentConfigs, composerKnobs],
      ids: () => agentConfigs.list().map((c) => c.id),
      env: (id) => agentEnv.get(id),
    },
    mcpServers: {
      entries: [mcpServerConfigs],
      ids: () => mcpServerConfigs.list().map((c) => c.id),
      env: (id) => mcpServerEnv.get(id),
      headerKey: async (id) => keys[id],
    },
    settings: { entries: [preferences, machineRules, machineRoots] },
  };
  return { kv, sources };
}

const at = new Date("2026-10-13T12:00:00.000Z");
const exported = async (...parts: ExportPart[]) => exportConfiguration(new Set(parts), (await machine()).sources, at);

describe("configuration export", () => {
  it("carries every part as the machine store holds it, under the keys it is stored by, beside the secrets its records name", async () => {
    const { kv, sources } = await machine();
    const file = await exportConfiguration(new Set<ExportPart>(["agents", "mcpServers", "settings"]), sources, at);

    expect(file.patchbay).toBe("configuration");
    expect(file.exportedAt).toBe("2026-10-13T12:00:00.000Z");
    expect(file.state).toEqual({
      "acpPatchbay.agents": kv.get("acpPatchbay.agents"),
      "acpPatchbay.lastKnobs": kv.get("acpPatchbay.lastKnobs"),
      "acpPatchbay.integrations": kv.get("acpPatchbay.integrations"),
      "acpPatchbay.preferences": kv.get("acpPatchbay.preferences"),
      "acpPatchbay.machineCommandRules": kv.get("acpPatchbay.machineCommandRules"),
      "acpPatchbay.machineSavedRoots": kv.get("acpPatchbay.machineSavedRoots"),
    });
    // A record with nothing secret stored has no row.
    expect(file.secrets).toEqual({
      agents: { claude: { env: { ANTHROPIC_API_KEY: "sk-1" } } },
      mcpServers: { keyed: { key: "secret-abc" }, local: { env: { TOKEN: "t-1" } } },
    });
  });

  it("carries only the parts picked — no other part's entries or secrets", async () => {
    const agents = await exported("agents");
    expect(Object.keys(agents.state)).toEqual(["acpPatchbay.agents", "acpPatchbay.lastKnobs"]);
    expect(Object.keys(agents.secrets)).toEqual(["agents"]);

    const servers = await exported("mcpServers");
    expect(Object.keys(servers.state)).toEqual(["acpPatchbay.integrations"]);
    expect(Object.keys(servers.secrets)).toEqual(["mcpServers"]);

    const settings = await exported("settings");
    expect(Object.keys(settings.state)).toEqual([
      "acpPatchbay.preferences",
      "acpPatchbay.machineCommandRules",
      "acpPatchbay.machineSavedRoots",
    ]);
    expect(settings.secrets).toEqual({});
  });

  it("never carries the workspace's own saved roots", async () => {
    const file = await exported("agents", "mcpServers", "settings");
    expect(JSON.stringify(file)).not.toContain("workspace-only");
  });

  it("an entry never written is left out, not carried empty", async () => {
    const empty = new MemoryKV();
    const file = await exportConfiguration(
      new Set<ExportPart>(["settings"]),
      {
        agents: { entries: [], ids: () => [], env: async () => ({}) },
        mcpServers: { entries: [], ids: () => [], env: async () => ({}), headerKey: async () => undefined },
        settings: { entries: [new PreferencesStore(empty), new MachineRulesStore(empty), new SavedRootsStore(empty, "machine")] },
      },
      at,
    );
    expect(file.state).toEqual({});
  });

  it.skipIf(process.platform === "win32")("the file is written readable by its owner only — an existing one too", async () => {
    const dir = await mkdtemp(join(tmpdir(), "patchbay-export-"));
    try {
      const path = join(dir, "config.json");
      await writeFile(path, "old", { mode: 0o644 });
      const file = await exported("agents");
      await writeConfigurationFile(path, file);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(file);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
