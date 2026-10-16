// A stand-in executable for a test: a command that runs a script of the
// test's own under this Node, in the form the platform executes — a
// shebang file on POSIX; on Windows a .cmd shim beside the script, the
// shape an npm global install leaves. Either way the command is
// `join(dir, name)`: an absolute path the product resolves as it resolves a
// real one (on Windows through the PATHEXT variants), and a bare `name` on
// a PATH holding `dir`.
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Writes `name` in `dir`, running `script` (JavaScript); returns its
 * command. */
export async function standIn(dir: string, name: string, script: string): Promise<string> {
  const command = join(dir, name);
  if (process.platform === "win32") {
    await writeFile(`${command}.js`, script);
    await writeFile(`${command}.cmd`, `@"${process.execPath}" "%~dp0${name}.js" %*\r\n`);
  } else {
    await writeFile(command, `#!${process.execPath}\n${script}`);
    await chmod(command, 0o755);
  }
  return command;
}

/** A stand-in that answers every call by printing `output` — a runtime
 * asked its version, say. */
export function answering(dir: string, name: string, output: string): Promise<string> {
  return standIn(dir, name, `console.log(${JSON.stringify(output)});\n`);
}
