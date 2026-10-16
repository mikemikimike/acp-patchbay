// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Where the texts VS Code's own diff editor shows are written: it opens two
// files, so a proposed change is put on disk for it — a folder per scope (a
// tool call, or an ask) under one root that erasing all data removes whole.
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DIFFS_DIR = join(tmpdir(), "acp-patchbay-diffs");

/** One scope's folder — its id made safe as a folder name. */
export function diffDir(scope: string): string {
  return join(DIFFS_DIR, scope.replace(/[^a-zA-Z0-9_-]/g, "_"));
}
