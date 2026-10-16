// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// File-write scope: the places where an agent's writes are approved
// without asking — the workspace's folders, the roots added to a session,
// the system temp dir, folders the user adds — each switched on or off,
// under a mute (always ask) that sets every place aside without forgetting
// it. Two layers, one entry shape: the machine layer (this file's store —
// every workspace on this machine) and the workspace layer
// (permission-rules.ts, beside the command rules), whose answer overrides
// the machine's for that workspace alone, either way — the order the
// command rules keep. A folder belongs to the layer it was added at: the
// machine's reach every workspace, one a workspace added is its own. A
// switch the machine never set answers by its default (the workspace on,
// the rest off).
import { isAbsolute } from "node:path";
import { z } from "zod";
import { sameWriteLocation, type WriteEntry, type WriteLocation, type WriteScopeRowView } from "../../shared/protocol";
import type { KV, StoredEntry } from "./kv";
import { STORAGE_KEYS } from "./storage-keys";

const locationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("alwaysAsk") }),
  z.object({ kind: z.literal("workspace") }),
  z.object({ kind: z.literal("sessionRoots") }),
  z.object({ kind: z.literal("temp") }),
  z.object({ kind: z.literal("path"), path: z.string().refine(isAbsolute) }),
]);
const entrySchema = z.object({ location: locationSchema, on: z.boolean() });

/** The stored entries that are entries, each place once (its first): any
 * other value — or a stored value that isn't a list — is skipped. */
export function readWriteEntries(stored: unknown): WriteEntry[] {
  if (!Array.isArray(stored)) return [];
  const entries: WriteEntry[] = [];
  for (const item of stored) {
    const parsed = entrySchema.safeParse(item);
    if (parsed.success && !entries.some((e) => sameWriteLocation(e.location, parsed.data.location))) entries.push(parsed.data);
  }
  return entries;
}

/** A layer's entries with one place's answer set — in its place when the
 * layer holds it, appended when not; null drops it. */
export function withWriteEntry(entries: readonly WriteEntry[], location: WriteLocation, on: boolean | null): WriteEntry[] {
  const rest = entries.filter((e) => !sameWriteLocation(e.location, location));
  if (on === null) return rest;
  const held = rest.length < entries.length;
  return held ? entries.map((e) => (sameWriteLocation(e.location, location) ? { location, on } : e)) : [...entries, { location, on }];
}

const SWITCHES: readonly WriteLocation[] = [{ kind: "alwaysAsk" }, { kind: "workspace" }, { kind: "sessionRoots" }, { kind: "temp" }];

/** Every place, the switches first, then the machine's folders in its
 * order, then the ones only this workspace added — each with both layers'
 * answers and the one that holds. */
export function writeScopeRows(machine: readonly WriteEntry[], workspace: readonly WriteEntry[]): WriteScopeRowView[] {
  const folders = [...machine, ...workspace]
    .map((e) => e.location)
    .filter((l, i, all) => l.kind === "path" && all.findIndex((o) => sameWriteLocation(o, l)) === i);
  return [...SWITCHES, ...folders].map((location) => {
    const at = (layer: readonly WriteEntry[]) => layer.find((e) => sameWriteLocation(e.location, location))?.on ?? null;
    const machineOn = at(machine) ?? (location.kind === "path" ? null : location.kind === "workspace");
    const workspaceOn = at(workspace);
    return { location, machine: machineOn, workspace: workspaceOn, on: workspaceOn ?? machineOn ?? false };
  });
}

const KEY = STORAGE_KEYS.machineWriteScope;

/** The machine layer — the machine store, every workspace on this
 * machine. Holds only what the user set: defaults are filled in by
 * writeScopeRows, never stored. */
export class MachineWriteScopeStore implements StoredEntry {
  readonly key = KEY;

  constructor(private readonly kv: KV) {}

  stored(): unknown {
    return this.kv.get(KEY);
  }

  get(): WriteEntry[] {
    return readWriteEntries(this.kv.get<unknown>(KEY));
  }

  async set(entries: readonly WriteEntry[]): Promise<void> {
    await this.kv.update(KEY, entries);
  }
}
