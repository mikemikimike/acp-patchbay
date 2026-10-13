// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Composer knobs — the user's current working knob combination, per agent.
// This is what the composer's knob pills show on *entry* (a fresh session,
// or a history session attached with no live combination in hand) under the
// "knobs start from: last used" preference (stores/preferences.ts). Written
// only from the user-set path (sessions-store setKnob, after the agent
// confirms) — never at attach time, so loads/reloads that reset agent-side
// state can't pollute it. Machine store: knob ids and offered values only —
// non-sensitive, machine-scoped like the agent configs they belong to.
// Seeding through knobs.ts routing means a stale entry (agent dropped a
// knob, renamed a value) is silently skipped at apply time, exactly like a
// no-longer-offered configured default. The shape is checked on read: an
// agent's combination that isn't one reads as none.
import { z } from "zod";
import type { KnobSeed } from "../../shared/protocol";
import type { KV, StoredEntry } from "./kv";
import type { PatchbayAgentId } from "../../shared/ids";

// Historical key (this store began as "last-used knobs") — kept so existing
// installs carry their combinations across the rename.
const KEY = "acpPatchbay.lastKnobs";

type ComposerKnobsRecord = Readonly<Record<string, KnobSeed>>;

const knobSeedSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));

/** Every agent's combination that reads as one. */
function readStored(stored: unknown): ComposerKnobsRecord {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  const out: Record<string, KnobSeed> = {};
  for (const [patchbayAgentId, seed] of Object.entries(stored)) {
    const parsed = knobSeedSchema.safeParse(seed);
    if (parsed.success) out[patchbayAgentId] = parsed.data;
  }
  return out;
}

export class ComposerKnobsStore implements StoredEntry {
  readonly key = KEY;

  constructor(private readonly kv: KV) {}

  stored(): unknown {
    return this.kv.get(KEY);
  }

  get(patchbayAgentId: PatchbayAgentId): KnobSeed | undefined {
    return this.all()[patchbayAgentId];
  }

  async record(patchbayAgentId: PatchbayAgentId, seed: KnobSeed): Promise<void> {
    await this.kv.update(KEY, { ...this.all(), [patchbayAgentId]: seed });
  }

  /** Agent removal: the combination is a fact about *that* agent, so it
   * leaves with it. */
  async remove(patchbayAgentId: PatchbayAgentId): Promise<void> {
    const all = this.all();
    if (!(patchbayAgentId in all)) return;
    const { [patchbayAgentId]: _, ...rest } = all;
    await this.kv.update(KEY, Object.keys(rest).length > 0 ? rest : undefined);
  }

  /** Data-page inventory: how many agents have a recorded combination. */
  count(): number {
    return Object.keys(this.all()).length;
  }

  private all(): ComposerKnobsRecord {
    return readStored(this.kv.get<unknown>(KEY));
  }

  /** "Disconnect & erase all data". */
  async wipe(): Promise<void> {
    await this.kv.update(KEY, undefined);
  }
}
