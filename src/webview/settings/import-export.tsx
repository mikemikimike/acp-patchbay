// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Import/Export: this machine's configuration carried to a file, picked by
// part. Which parts are ticked is this page's own render state; the export
// itself is the host's, read fresh from the stores and written where the
// user says.
import { useState } from "react";
import { count } from "../../shared/count";
import type { ExportPart, SettingsState } from "../../shared/protocol";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ImportExportSection(props: { state: SettingsState; onExport(parts: readonly ExportPart[]): void }) {
  const { state } = props;
  const [picked, setPicked] = useState<ReadonlySet<ExportPart>>(new Set(["agents", "mcpServers", "settings"]));
  const parts: readonly { id: ExportPart; label: string; detail: string }[] = [
    {
      id: "agents",
      label: "Agents",
      detail: `${count(state.agentConfigs.length, "agent")}, with their env values and composer choices`,
    },
    {
      id: "mcpServers",
      label: "MCP servers",
      detail: `${count(state.mcpServers.length, "server")}, with their env values and API keys — a server signed in with OAuth needs a fresh connect`,
    },
    {
      id: "settings",
      label: "Settings",
      detail: `preferences, ${count(state.machineCommandRules.length, "machine-wide command rule")}, ${count(state.savedRoots.machine.length, "machine-wide saved root")}`,
    },
  ];
  const toggle = (part: ExportPart, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(part);
      else next.delete(part);
      return next;
    });

  return (
    <section className="section">
      <h1>Import/Export</h1>
      <div className="sub">
        Carry this machine's configuration to another one, or keep a copy of it. This workspace's own
        rules and saved roots stay with the workspace.
      </div>

      <div className="card">
        <h2 className="mt-0">Export</h2>
        {parts.map((part) => (
          <label key={part.id} className="mb-2 flex cursor-pointer items-start gap-2 text-[12px]" data-export-part={part.id}>
            <Checkbox
              className="mt-0.5"
              checked={picked.has(part.id)}
              onCheckedChange={(checked) => toggle(part.id, checked === true)}
            />
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{part.label}</span>
              <span className="block text-muted-foreground">{part.detail}</span>
            </span>
          </label>
        ))}
        <div className="note mx-0 mb-2.5">
          The file holds your env values and keys in plain text — keep it as you would a password.
        </div>
        <Button size="sm" disabled={picked.size === 0} onClick={() => props.onExport([...picked])}>
          Export…
        </Button>
      </div>
    </section>
  );
}
