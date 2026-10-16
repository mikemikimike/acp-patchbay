// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Saved roots — the folders every new session starts with, beyond the
// workspace's own. One class, two instances by scope: "workspace" over
// workspaceState (per user, per workspace, never repo-shipped) and
// "machine" over the machine store (every workspace on this machine). A
// preference, not a session fact: a session owns its list once born, so
// nothing stored here ever reaches a live session.
import type { SavedRootScope } from "../../shared/protocol";
import type { KV, StoredEntry } from "./kv";
import { STORAGE_KEYS } from "./storage-keys";

const KEYS: Record<SavedRootScope, string> = {
  workspace: STORAGE_KEYS.savedRoots,
  machine: STORAGE_KEYS.machineSavedRoots,
};

export class SavedRootsStore implements StoredEntry {
  readonly key: string;

  constructor(
    private readonly kv: KV,
    scope: SavedRootScope,
  ) {
    this.key = KEYS[scope];
  }

  stored(): unknown {
    return this.kv.get(this.key);
  }

  /** Every stored path that is one: anything else in the list is skipped. */
  list(): string[] {
    const stored = this.kv.get<unknown>(this.key);
    if (!Array.isArray(stored)) return [];
    return stored.filter((p): p is string => typeof p === "string" && p !== "");
  }

  async add(path: string): Promise<void> {
    const current = this.list();
    if (!current.includes(path)) await this.kv.update(this.key, [...current, path]);
  }

  /** In place — the list's order is the user's. */
  async replace(path: string, next: string): Promise<void> {
    const current = this.list();
    await this.kv.update(
      this.key,
      current.includes(next) ? current.filter((p) => p !== path) : current.map((p) => (p === path ? next : p)),
    );
  }

  async remove(path: string): Promise<void> {
    await this.kv.update(
      this.key,
      this.list().filter((p) => p !== path),
    );
  }

  async wipe(): Promise<void> {
    await this.kv.update(this.key, undefined);
  }
}
