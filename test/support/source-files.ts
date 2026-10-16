// The source the boundary tests scan: every file under a folder whose name
// a pattern matches, at any depth.
import { readdirSync } from "node:fs";
import { join } from "node:path";

export function filesUnder(dir: string, named: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path, named);
    return named.test(entry.name) ? [path] : [];
  });
}
