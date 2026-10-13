// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// Import/Export: this machine's configuration carried to a file, picked by
// part, and a file carried back in. What is ticked is this page's own
// render state; reading, planning and landing are the host's — an import
// is reviewed here, item by item, before anything moves.
import { useState } from "react";
import { count } from "../../shared/count";
import type { ConfigImportView, ExportPart, ImportItemView, SettingsState } from "../../shared/protocol";
import { Icon } from "../shared/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const PART_LABELS: Readonly<Record<ExportPart, string>> = {
  agents: "Agents",
  mcpServers: "MCP servers",
  settings: "Settings",
};

export function ImportExportSection(props: {
  state: SettingsState;
  onExport(parts: readonly ExportPart[]): void;
  onPickImport(): void;
  onApplyImport(importId: number, take: readonly string[]): void;
  onDismissImport(importId: number): void;
}) {
  const { state } = props;
  const [picked, setPicked] = useState<ReadonlySet<ExportPart>>(new Set(["agents", "mcpServers", "settings"]));
  const parts: readonly { id: ExportPart; detail: string }[] = [
    {
      id: "agents",
      detail: `${count(state.agentConfigs.length, "agent")}, with their env values and composer choices`,
    },
    {
      id: "mcpServers",
      detail: `${count(state.mcpServers.length, "server")}, with their env values and API keys — a server signed in with OAuth needs a fresh connect`,
    },
    {
      id: "settings",
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
              <span className="font-semibold">{PART_LABELS[part.id]}</span>
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

      <div className="card mt-3">
        <h2 className="mt-0">Import</h2>
        {state.configImport === null ? (
          <>
            <div className="note mx-0 mt-0 mb-2.5">
              Reads a file patchbay exported and shows what it would bring, item by item. Nothing changes until you
              apply, and nothing here is ever removed by an import.
            </div>
            <Button size="sm" variant="outline" onClick={props.onPickImport}>
              Import…
            </Button>
          </>
        ) : (
          <ImportStage
            key={state.configImport.id}
            view={state.configImport}
            onPick={props.onPickImport}
            onApply={(take) => props.onApplyImport(state.configImport!.id, take)}
            onDismiss={() => props.onDismissImport(state.configImport!.id)}
          />
        )}
      </div>
    </section>
  );
}

function ImportStage(props: {
  view: ConfigImportView;
  onPick(): void;
  onApply(take: readonly string[]): void;
  onDismiss(): void;
}) {
  const { view } = props;
  switch (view.stage) {
    case "refused":
      return (
        <>
          <div className="nm mb-1">{view.fileName}</div>
          <div className="note mx-0 mt-0 mb-2.5 text-err" data-import-refused>
            <Icon name="error" /> {view.reason}
          </div>
          <div className="row gap-2.5">
            <Button size="sm" variant="outline" onClick={props.onPick}>
              Choose another file…
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onDismiss}>
              Close
            </Button>
          </div>
        </>
      );
    case "review":
      return <ImportReview view={view} onApply={props.onApply} onDismiss={props.onDismiss} />;
    case "applying":
      return (
        <div className="note m-0" data-import-applying>
          Importing {view.fileName} — patchbay is restarting…
        </div>
      );
    case "applied":
      return (
        <>
          <div className="mb-1 text-[12px]" data-import-applied>
            <Icon name="pass" /> Imported {count(view.landed, "item")} from {view.fileName}.
          </div>
          {view.failures.length > 0 && (
            <ul className="mb-2.5 text-[12px] text-warn">
              {view.failures.map((f) => (
                <li key={f}>
                  <Icon name="warning" /> {f}
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" variant="outline" onClick={props.onDismiss}>
            Done
          </Button>
        </>
      );
  }
}

/** The file's items by part: a new one starts ticked, a different one
 * unticked — replacing is the user's call — and an unchanged one has
 * nothing to tick. */
function ImportReview(props: {
  view: Extract<ConfigImportView, { stage: "review" }>;
  onApply(take: readonly string[]): void;
  onDismiss(): void;
}) {
  const { view } = props;
  const [take, setTake] = useState<ReadonlySet<string>>(
    () => new Set(view.items.filter((i) => i.fate === "new").map((i) => i.id)),
  );
  const set = (ids: readonly string[], on: boolean) =>
    setTake((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const written = [
    view.exportedAt === null ? null : `exported ${new Date(view.exportedAt).toLocaleString()}`,
    view.patchbayVersion === null ? null : `by patchbay ${view.patchbayVersion}`,
  ].filter((s) => s !== null);

  return (
    <>
      <div className="nm mb-0.5">{view.fileName}</div>
      {written.length > 0 && <div className="mb-2 text-[12px] text-muted-foreground">{written.join(" ")}</div>}
      {view.newer && (
        <div className="note mx-0 mt-0 mb-2 text-warn" data-import-newer>
          <Icon name="warning" /> Made by patchbay {view.patchbayVersion}, newer than this one — something in it may not
          work here.
        </div>
      )}
      {view.unread.length > 0 && (
        <div className="note mx-0 mt-0 mb-2 text-warn" data-import-unread>
          <Icon name="warning" /> Couldn't be read, so it won't be imported: {view.unread.join("; ")}.
        </div>
      )}
      {view.parts.map((part) => {
        const items = view.items.filter((i) => i.part === part);
        const tickable = items.filter((i) => i.fate !== "unchanged").map((i) => i.id);
        const all = tickable.length > 0 && tickable.every((id) => take.has(id));
        return (
          <div key={part} className="mb-3" data-import-part={part}>
            <label className="mb-1 flex cursor-pointer items-center gap-2 text-[12px] font-semibold">
              <Checkbox checked={all} disabled={tickable.length === 0} onCheckedChange={(on) => set(tickable, on === true)} />
              {PART_LABELS[part]}
            </label>
            {items.length === 0 ? (
              <div className="ml-5.5 text-[12px] text-muted-foreground">nothing in the file</div>
            ) : (
              items.map((item) => (
                <ImportItem key={item.id} item={item} taken={take.has(item.id)} onTake={(on) => set([item.id], on)} />
              ))
            )}
          </div>
        );
      })}
      <div className="note mx-0 mt-0 mb-2.5">
        Applying restarts patchbay: agents and sessions stop, then what was running connects again.
      </div>
      <div className="row gap-2.5">
        <Button size="sm" disabled={take.size === 0} onClick={() => props.onApply([...take])}>
          Apply
        </Button>
        <Button size="sm" variant="ghost" onClick={props.onDismiss}>
          Cancel
        </Button>
      </div>
    </>
  );
}

const FATE_TEXT: Readonly<Record<ImportItemView["fate"], string>> = {
  new: "new",
  unchanged: "same as here",
  differs: "differs",
};

function ImportItem(props: { item: ImportItemView; taken: boolean; onTake(on: boolean): void }) {
  const { item } = props;
  const differs =
    item.kind === "preferences" ? count(item.differs.length, "preference") : item.differs.join(", ");
  return (
    <label
      className="ml-5.5 mb-1 flex cursor-pointer items-start gap-2 text-[12px]"
      data-import-item={item.id}
      data-fate={item.fate}
    >
      <Checkbox
        className="mt-0.5"
        checked={props.taken}
        disabled={item.fate === "unchanged"}
        onCheckedChange={(on) => props.onTake(on === true)}
      />
      <span className="min-w-0 flex-1">
        <span className="break-all">{item.label}</span>{" "}
        <Badge variant={item.fate === "differs" ? "secondary" : "outline"}>{FATE_TEXT[item.fate]}</Badge>
        {item.fate === "differs" && <span className="block text-muted-foreground">differs in {differs}</span>}
        {item.flags.map((flag) => (
          <span key={flag} className="block text-warn">
            <Icon name="warning" /> {flag}
          </span>
        ))}
      </span>
    </label>
  );
}
