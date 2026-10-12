// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// The files chip — the read-out strip's way into the files this session's
// agent edited. A control, not a stat: no preference hides it; it is absent
// only while there is nothing to open. It lists files and never counts
// lines: a change is counted only on the edit that reported it (the tool
// card's ±), because a file the agent writes itself leaves patchbay no
// trustworthy "before" to measure a session's worth of change against. A
// row opens the file.
//
// Rows group by the root that holds them — workspace folders, then the
// session's added roots, then whatever lies outside every root — so what
// changed in the project never interleaves with what changed elsewhere.
// A list wholly inside a single-folder workspace reads as a plain list: a
// header earns its row only once there is a second place to tell apart.
// A row reads relative to its workspace folder and by its full path
// anywhere else, an added root included — as every path in the view reads,
// so one file never reads two ways.
import { Fragment, type RefObject } from "react";
import type { OpenEditorView } from "../../shared/protocol";
import { useActions } from "../shared/actions";
import { Icon } from "../shared/icon";
import { basename, groupByRoot, splitPath } from "../shared/path";
import { count } from "../../shared/count";
import { ReadoutPanel } from "./readout-panel";

export function FilesChip({
  files,
  openEditors,
  workspaceRoots,
  contextRoots,
  open,
  onOpenChange,
  anchor,
}: {
  files: readonly string[];
  openEditors: readonly OpenEditorView[];
  workspaceRoots: readonly string[];
  /** The session's added roots. */
  contextRoots: readonly string[];
  open: boolean;
  onOpenChange(open: boolean): void;
  anchor: RefObject<HTMLDivElement | null>;
}) {
  const send = useActions();
  const groups = groupByRoot(files, [...workspaceRoots, ...contextRoots]);
  const headed = !(groups.length === 1 && workspaceRoots.length === 1 && groups[0]!.root === workspaceRoots[0]);
  return (
    <ReadoutPanel
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      className="files-panel"
      title={<>{count(files.length, "file")} edited this session</>}
      chip={
        <button type="button" className={`chip files ${open ? "active" : ""}`}>
          <Icon name="edit" /> {count(files.length, "file")} edited
        </button>
      }
    >
      {groups.map(({ root, paths }) => (
        <Fragment key={root ?? ""}>
          {headed && (
            <div className="group-head" title={root ?? undefined}>
              <Icon name={root !== null ? "root-folder" : "folder"} />{" "}
              {root !== null ? basename(root.replace(/[/\\]+$/, "")) || root : "Outside the roots"}
            </div>
          )}
          {paths.map((path) => {
            const { base, dir } = splitPath(path, workspaceRoots);
            // Editor reality, not a stored flag: with agent writes landing
            // in the open buffer, dirty here means the
            // user's own unsaved edits sit on an agent-touched file.
            const dirty = openEditors.some((e) => e.file === path && e.dirty);
            return (
              <div key={path} className="file-row" title={path} onClick={() => send({ kind: "openFile", path })}>
                <Icon name="file" /> <span className="base">{base}</span>
                {dir !== "" && <span className="dir">{dir}</span>}
                {dirty && (
                  <span className="right">
                    <span className="dirty" title="unsaved changes in editor" />
                  </span>
                )}
              </div>
            );
          })}
        </Fragment>
      ))}
    </ReadoutPanel>
  );
}
