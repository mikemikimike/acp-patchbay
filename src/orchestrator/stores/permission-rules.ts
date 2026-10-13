// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Permission rules, two layers. Workspace layer (this file's original
// scope): command rules + file-write scope in workspaceState — per user,
// per workspace, never repo-shipped; a cloned repo must not arrive
// pre-authorized. Machine
// layer (MachineRulesStore): command rules only, in the machine store —
// developer-owned defaults for every workspace ("allow `npm test`
// everywhere"). Evaluation order is workspace first, then machine, then
// ask (broker.ts): a workspace can tighten or loosen its own floor, and
// the repo still can't grant anything — the machine layer never rides it.
import { z } from "zod";
import type { KV, StoredEntry } from "./kv";

const ruleVerdictSchema = z.enum(["allow", "ask", "deny"]);
export type RuleVerdict = z.infer<typeof ruleVerdictSchema>;

export interface CommandRule {
  pattern: string; // glob-ish command pattern, e.g. "npm run *"
  verdict: RuleVerdict;
}

const fileWriteScopeSchema = z.enum(["workspace", "workspace+temp", "always-ask"]);
export type FileWriteScope = z.infer<typeof fileWriteScopeSchema>;

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
  fileWriteScope: FileWriteScope;
}

/** Sane defaults: nothing pre-allowed — everything asks. */
export const DEFAULT_PERMISSION_RULES: PermissionRules = {
  commandRules: [],
  fileWriteScope: "workspace",
};

const KEY = "acpPatchbay.permissionRules";

export class PermissionRulesStore {
  constructor(private readonly kv: KV) {}

  /** Each half read on its own: one stored in a shape this version
   * doesn't take reads as its default. */
  get(): PermissionRules {
    const stored = this.kv.get<unknown>(KEY);
    const { commandRules, fileWriteScope } = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
    const scope = fileWriteScopeSchema.safeParse(fileWriteScope);
    return {
      commandRules: commandRules === undefined ? DEFAULT_PERMISSION_RULES.commandRules : readRules(commandRules),
      fileWriteScope: scope.success ? scope.data : DEFAULT_PERMISSION_RULES.fileWriteScope,
    };
  }

  async set(rules: PermissionRules): Promise<void> {
    await this.kv.update(KEY, rules);
  }
}

const MACHINE_KEY = "acpPatchbay.machineCommandRules";

/** Machine-layer command rules — machine store (developer-owned, every
 * workspace on this machine), consulted only after the workspace layer
 * stays silent. Command rules only: file-write scope stays workspace-level
 * by nature (it's defined relative to the current workspace root). */
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
