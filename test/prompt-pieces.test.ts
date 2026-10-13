// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

import { describe, expect, it } from "vitest";
import { promptPieces } from "../src/webview/agent-view/chat/prompt-pieces";

describe("promptPieces: a sent prompt read back into the composer's vocabulary", () => {
  it("words keep their line breaks; a local mention is a mention again", () => {
    expect(
      promptPieces([
        { kind: "text", text: "look at " },
        { kind: "mention", name: "app.ts", uri: "file:///ws/src/app.ts" },
        { kind: "text", text: " and\n\nfix it" },
      ]),
    ).toEqual([
      { kind: "text", text: "look at " },
      { kind: "mention", path: "/ws/src/app.ts", label: "@app.ts" },
      { kind: "text", text: " and" },
      { kind: "break" },
      { kind: "break" },
      { kind: "text", text: "fix it" },
    ]);
  });

  it("a mention an agent flattened into prose is recovered; a non-file one stays text", () => {
    expect(promptPieces([{ kind: "text", text: "see [@a.ts](file:///ws/a.ts) and [@b](zed://b)" }])).toEqual([
      { kind: "text", text: "see " },
      { kind: "mention", path: "/ws/a.ts", label: "@a.ts" },
      { kind: "text", text: " and " },
      { kind: "text", text: "@b" },
    ]);
    expect(promptPieces([{ kind: "mention", name: "doc", uri: "https://example.com/doc" }])).toEqual([
      { kind: "text", text: "https://example.com/doc" },
    ]);
  });

  it("what rode beside the words is no part of them", () => {
    expect(
      promptPieces([
        { kind: "image", mimeType: "image/png", file: "chip-1.png" },
        { kind: "attachment", name: "notes.txt", path: "/tmp/notes.txt" },
        { kind: "context", label: "Selection a.ts:1-3", text: "x" },
        { kind: "text", text: "hi" },
      ]),
    ).toEqual([{ kind: "text", text: "hi" }]);
  });
});
