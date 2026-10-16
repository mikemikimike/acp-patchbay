import * as vscode from "vscode";

/** What a failed wait on VS Code's active editor adds: VS Code moves the
 * active editor only in a focused window, so an unfocused test window is
 * named as the likely cause — and nothing is claimed when it was focused. */
export function focusNote(): string {
  return vscode.window.state.focused ? "" : " — the test window lost focus; these tests need it focused";
}
