// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Permission rules, two layers. Workspace layer (this file's original
// scope): command rules + this workspace's file-write answers in
// workspaceState — per user, per workspace, never repo-shipped; a cloned
// repo must not arrive pre-authorized. Machine layer: command rules
// (MachineRulesStore) and file-write places (write-scope.ts), in the
// machine store — developer-owned defaults for every workspace ("allow
// `npm test` everywhere"). Evaluation order is workspace first, then
// machine, then ask (broker.ts): a workspace can tighten or loosen its own
// floor, and the repo still can't grant anything — the machine layer never
// rides it.
import { z } from "zod";
import type { WriteEntry } from "../../shared/protocol";
import type { KV, StoredEntry } from "./kv";
import { readWriteEntries } from "./write-scope";
import { STORAGE_KEYS } from "./storage-keys";

const ruleVerdictSchema = z.enum(["allow", "ask", "deny"]);
export type RuleVerdict = z.infer<typeof ruleVerdictSchema>;

export interface CommandRule {
  pattern: string; // glob-ish command pattern, e.g. "npm run *"
  verdict: RuleVerdict;
}

const commandRuleSchema = z.object({ pattern: z.string().min(1), verdict: ruleVerdictSchema });

/** The stored rules that are rules: anything else in the list — or a
 * stored value that isn't a list — is skipped, never trusted blind. */
function readRules(stored: unknown): CommandRule[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((rule) => {
    const parsed = commandRuleSchema.safeParse(rule);
    return parsed.success ? [parsed.data] : [];
  });
}

export interface PermissionRules {
  commandRules: CommandRule[];
  /** This workspace's file-write answers — each overrides the machine's
   * for its place (write-scope.ts). */
  writeScope: WriteEntry[];
}

/** Sane defaults: no command pre-allowed, every write place as the
 * machine has it. */
export const DEFAULT_PERMISSION_RULES: PermissionRules = {
  commandRules: [],
  writeScope: [],
};

const KEY = STORAGE_KEYS.permissionRules;

/** The scope a released version stored as one choice per workspace, as
 * this workspace's answers over the machine's defaults: "workspace" was
 * the default and says nothing. */
const LEGACY_SCOPE: ReadonlyMap<unknown, WriteEntry[]> = new Map([
  ["workspace", []],
  ["workspace+temp", [{ location: { kind: "temp" }, on: true }]],
  ["always-ask", [{ location: { kind: "alwaysAsk" }, on: true }]],
]);

export class PermissionRulesStore {
  constructor(private readonly kv: KV) {
    // Once, at construction: a KV applies an update in memory before its
    // write settles, so no read ever sees the old shape. A choice this
    // version doesn't know reads as the default did.
    const stored = kv.get<unknown>(KEY);
    if (typeof stored === "object" && stored !== null && "fileWriteScope" in stored) {
      const { fileWriteScope, ...rest } = stored as Record<string, unknown>;
      void kv.update(KEY, { ...rest, writeScope: LEGACY_SCOPE.get(fileWriteScope) ?? [] });
    }
  }

  /** Each half read on its own: one stored in a shape this version
   * doesn't take reads as its default. */
  get(): PermissionRules {
    const stored = this.kv.get<unknown>(KEY);
    const { commandRules, writeScope } = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
    return {
      commandRules: commandRules === undefined ? DEFAULT_PERMISSION_RULES.commandRules : readRules(commandRules),
      writeScope: readWriteEntries(writeScope),
    };
  }

  async set(rules: PermissionRules): Promise<void> {
    await this.kv.update(KEY, rules);
  }
}

const MACHINE_KEY = STORAGE_KEYS.machineCommandRules;

/** Machine-layer command rules — machine store (developer-owned, every
 * workspace on this machine), consulted only after the workspace layer
 * stays silent. */
export class MachineRulesStore implements StoredEntry {
  readonly key = MACHINE_KEY;

  constructor(private readonly kv: KV) {}

  stored(): unknown {
    return this.kv.get(MACHINE_KEY);
  }

  get(): { commandRules: CommandRule[] } {
    return { commandRules: readRules(this.kv.get<unknown>(MACHINE_KEY)) };
  }

  async set(commandRules: CommandRule[]): Promise<void> {
    await this.kv.update(MACHINE_KEY, commandRules);
  }
}
