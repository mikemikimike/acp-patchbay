// The write scope through the real extension (issues #56, #102): a write is
// judged by where it lands against the places the scope has on. A root
// added to the session asks until Session roots is switched on, then
// auto-accepts; a `..` that climbs out of it asks either way; the process
// cwd standing in for an absent folder is never the workspace — this suite
// runs with no folder open, so that state is live here.
import * as assert from "node:assert";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fakeAgentConfig } from "./fake-agent-config";
import { fakeAgentPath, Patchbay } from "./patchbay";
import { tempDir } from "./temp-dir";

suite("write scope (issues #56, #102)", () => {
  test("a root added to the session asks until Session roots is on, then auto-accepts; a `..` out of it asks; the fallback cwd is not the workspace", async function () {
    this.timeout(45000);
    const pb = await Patchbay.open();
    const dir = await tempDir("patchbay-write-scope-");
    const root = join(dir, "root");
    await mkdir(root);
    const inside = join(root, "inside.txt");
    const escaped = join(dir, "escaped.txt");
    // Rejected on its card below, so nothing ever lands there.
    const inCwd = join(process.cwd(), "patchbay-write-scope-probe.txt");
    try {
      const patchbayAgentId = await pb.addAgent(
        fakeAgentConfig("write-scope-e2e", "Write Scope Fake", fakeAgentPath(), {
          declare: { promptCapabilities: {} },
          // every prompt runs these three writes
          turn: [
            { type: "writeFile", path: inside, content: "in\n" },
            { type: "writeFile", path: `${root}/../escaped.txt`, content: "out\n" },
            { type: "writeFile", path: inCwd, content: "cwd\n" },
          ],
        }),
      );
      await pb.connect(patchbayAgentId);
      const patchbaySessionId = await pb.newSession(patchbayAgentId);
      await pb.addRoot(patchbaySessionId, root);
      const diffs = () => (pb.view.transcripts[patchbaySessionId] ?? []).filter((b) => b.kind === "diff");

      // Session roots off (the default): even inside the root, the user decides.
      let turnDone = pb.prompt(patchbaySessionId, "go");
      const asked = await pb.openCard(patchbaySessionId, "diff");
      assert.strictEqual(asked.id, diffs()[0]!.id, "inside an added root: asks while Session roots is off");
      await pb.answerDiff(patchbaySessionId, asked, false);
      await pb.answerDiff(patchbaySessionId, await pb.openCard(patchbaySessionId, "diff"), false);
      await pb.answerDiff(patchbaySessionId, await pb.openCard(patchbaySessionId, "diff"), false);
      await turnDone;
      await assert.rejects(readFile(inside, "utf8"), "the rejected write never landed");

      // Session roots on: the root auto-accepts, nothing else moves.
      await pb.setMachineWriteSwitch("sessionRoots", true);
      turnDone = pb.prompt(patchbaySessionId, "go");
      const escape = await pb.openCard(patchbaySessionId, "diff");
      assert.deepStrictEqual(diffs()[3]!.resolution, { accepted: true, auto: true }, "inside the root: no card to click");
      assert.strictEqual(escape.id, diffs()[4]!.id, "the `..` escape waits on the user");
      await pb.answerDiff(patchbaySessionId, escape, false);

      const fallback = await pb.openCard(patchbaySessionId, "diff");
      assert.strictEqual(fallback.id, diffs()[5]!.id, "no folder open: the process cwd was never handed to the agent");
      await pb.answerDiff(patchbaySessionId, fallback, false);
      await turnDone;

      assert.strictEqual(await readFile(inside, "utf8"), "in\n");
      await assert.rejects(readFile(escaped, "utf8"), "the rejected write never landed");
      await assert.rejects(readFile(inCwd, "utf8"), "the rejected write never landed");
    } finally {
      await pb.setMachineWriteSwitch("sessionRoots", false);
      await pb.removeAdded();
    }
  });
});
