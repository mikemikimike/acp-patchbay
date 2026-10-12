// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Path labels for display. Actions always carry the full absolute path; these
// only decide what the user reads.

/** The last segment of a path, either separator — a label, never a lookup. */
export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Absolute path → { base, dir }, dir relative to the root that contains it
 * (`rootOf`). Outside every root, dir stays absolute. */
export function splitPath(path: string, roots: readonly string[]): { base: string; dir: string } {
  const root = rootOf(path, roots);
  const rel = root !== undefined ? path.slice(root.length).replace(/^[/\\]/, "") : path;
  const parts = rel.split(/[/\\]/);
  return { base: parts.pop() ?? rel, dir: parts.join("/") };
}

/** The longest root that contains the path, by whole segments only
 * (`/ws/app` never claims `/ws/application`); undefined outside every root. */
function rootOf(path: string, roots: readonly string[]): string | undefined {
  return roots.filter((r) => contains(r, path)).sort((a, b) => b.length - a.length)[0];
}

/** Paths grouped by the root that contains them (`rootOf`): groups in the
 * roots' order, paths outside every root last under `null`, each group
 * keeping its paths' own order. A root that holds none has no group. */
export function groupByRoot(
  paths: readonly string[],
  roots: readonly string[],
): { root: string | null; paths: string[] }[] {
  const groups = new Map<string | null, string[]>([...roots, null].map((r) => [r, []]));
  for (const p of paths) groups.get(rootOf(p, roots) ?? null)!.push(p);
  return [...groups].filter(([, ps]) => ps.length > 0).map(([root, ps]) => ({ root, paths: ps }));
}

function contains(root: string, path: string): boolean {
  if (!path.startsWith(root)) return false;
  const rest = path.slice(root.length);
  return rest === "" || /[/\\]$/.test(root) || /^[/\\]/.test(rest);
}

/** The local path a `file://` URI names — null for any other scheme, or a
 * URI that doesn't parse. A Windows drive path loses the URI's leading
 * slash (`/C:/ws/a.ts` → `C:/ws/a.ts`). */
export function filePathOf(uri: string): string | null {
  if (!uri.startsWith("file://")) return null;
  try {
    const path = decodeURIComponent(new URL(uri).pathname);
    return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
  } catch {
    return null;
  }
}
