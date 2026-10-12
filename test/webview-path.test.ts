// Display labels for paths (files panel, tool-call file rows): relative to the
// longest containing root, by whole segments only.
import { describe, expect, it } from "vitest";
import { filePathOf, groupByRoot, splitPath } from "../src/webview/shared/path";

describe("splitPath", () => {
  it("relativizes against the longest root that contains the path", () => {
    expect(splitPath("/ws/app/src/a.ts", ["/ws", "/ws/app"])).toEqual({ base: "a.ts", dir: "src" });
  });

  it("a root claims whole segments only — /ws/app never claims /ws/application", () => {
    expect(splitPath("/ws/application/a.ts", ["/ws/app"])).toEqual({ base: "a.ts", dir: "/ws/application" });
  });

  it("a file at a root has no dir; outside every root the dir stays absolute", () => {
    expect(splitPath("/ws/a.ts", ["/ws"])).toEqual({ base: "a.ts", dir: "" });
    expect(splitPath("/tmp/x/a.ts", ["/ws"])).toEqual({ base: "a.ts", dir: "/tmp/x" });
  });

  it("Windows separators and a root given with a trailing separator both work", () => {
    expect(splitPath("C:\\ws\\src\\a.ts", ["C:\\ws"])).toEqual({ base: "a.ts", dir: "src" });
    expect(splitPath("/ws/src/a.ts", ["/ws/"])).toEqual({ base: "a.ts", dir: "src" });
  });
});

// The files panel's groups: what changed in the project never interleaves
// with what changed elsewhere.
describe("groupByRoot", () => {
  it("groups in the roots' order, outside every root last, each keeping first-touch order", () => {
    const files = ["/tmp/x.ts", "/ws/a.ts", "/ext/b.ts", "/ws/src/c.ts", "/home/u/.claude/d.md"];
    expect(groupByRoot(files, ["/ws", "/ext"])).toEqual([
      { root: "/ws", paths: ["/ws/a.ts", "/ws/src/c.ts"] },
      { root: "/ext", paths: ["/ext/b.ts"] },
      { root: null, paths: ["/tmp/x.ts", "/home/u/.claude/d.md"] },
    ]);
  });

  it("a nested root claims its own files; a root holding none has no group", () => {
    expect(groupByRoot(["/ws/app/a.ts", "/ws/b.ts"], ["/ws", "/ws/app", "/empty"])).toEqual([
      { root: "/ws", paths: ["/ws/b.ts"] },
      { root: "/ws/app", paths: ["/ws/app/a.ts"] },
    ]);
  });

  it("a root listed twice is one group", () => {
    expect(groupByRoot(["/ws/a.ts"], ["/ws", "/ws"])).toEqual([{ root: "/ws", paths: ["/ws/a.ts"] }]);
  });
});

describe("filePathOf", () => {
  it("a file URI names its local path, percent-decoded", () => {
    expect(filePathOf("file:///ws/my%20notes.md")).toBe("/ws/my notes.md");
  });

  it("a Windows drive path drops the URI's leading slash", () => {
    expect(filePathOf("file:///C:/ws/a.ts")).toBe("C:/ws/a.ts");
  });

  it("any other scheme names no local file", () => {
    expect(filePathOf("https://example.com/a.ts")).toBeNull();
    expect(filePathOf("zed://file/a.ts")).toBeNull();
  });
});
