// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// What leaves this machine when the user exports their configuration: the
// machine store's own entries, each under the key it is stored by and as
// stored there, beside the secrets those entries name — the env values and
// header keys their owner typed. An OAuth token never leaves: a provider
// that rotates refresh tokens can revoke the sign-in on both machines once
// the second one refreshes a token the first already spent. The file is
// the user's to keep and move; nothing in it is shaped for anything but
// this extension's own import.
import { chmod, writeFile } from "node:fs/promises";
import type { ExportPart } from "../shared/protocol";
import type { StoredEntry } from "./stores/kv";

type Env = Record<string, string>;

/** Where each part's contents are read from. */
export interface ExportSources {
  agents: {
    entries: readonly StoredEntry[];
    ids(): readonly string[];
    env(id: string): Promise<Env>;
  };
  mcpServers: {
    entries: readonly StoredEntry[];
    ids(): readonly string[];
    env(id: string): Promise<Env>;
    headerKey(id: string): Promise<string | undefined>;
  };
  settings: { entries: readonly StoredEntry[] };
}

export interface ConfigurationFile {
  /** What the file is — the one mark an import knows it by. */
  patchbay: "configuration";
  exportedAt: string;
  /** Machine-store entries by their key, as stored. */
  state: Record<string, unknown>;
  /** By the id of the record they belong to; a record with nothing
   * stored has no row. */
  secrets: {
    agents?: Record<string, { env: Env }>;
    mcpServers?: Record<string, { env?: Env; key?: string }>;
  };
}

export async function exportConfiguration(
  parts: ReadonlySet<ExportPart>,
  sources: ExportSources,
  now: Date = new Date(),
): Promise<ConfigurationFile> {
  const state: Record<string, unknown> = {};
  for (const part of parts) {
    for (const entry of sources[part].entries) {
      const value = entry.stored();
      if (value !== undefined) state[entry.key] = value;
    }
  }
  const secrets: ConfigurationFile["secrets"] = {};
  if (parts.has("agents")) {
    const agents: Record<string, { env: Env }> = {};
    for (const id of sources.agents.ids()) {
      const env = await sources.agents.env(id);
      if (Object.keys(env).length > 0) agents[id] = { env };
    }
    secrets.agents = agents;
  }
  if (parts.has("mcpServers")) {
    const servers: Record<string, { env?: Env; key?: string }> = {};
    for (const id of sources.mcpServers.ids()) {
      const env = await sources.mcpServers.env(id);
      const key = await sources.mcpServers.headerKey(id);
      const row = {
        ...(Object.keys(env).length > 0 ? { env } : {}),
        ...(key !== undefined ? { key } : {}),
      };
      if (Object.keys(row).length > 0) servers[id] = row;
    }
    secrets.mcpServers = servers;
  }
  return { patchbay: "configuration", exportedAt: now.toISOString(), state, secrets };
}

/** The file's text, wherever it is written. */
export function configurationText(file: ConfigurationFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** Readable by its owner only — it holds what their secret storage holds.
 * A file that already existed keeps its mode through a write, hence the
 * chmod after. */
export async function writeConfigurationFile(path: string, file: ConfigurationFile): Promise<void> {
  await writeFile(path, configurationText(file), { mode: 0o600 });
  await chmod(path, 0o600);
}
