// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Solutions Unity

// The prompts chip — the read-out strip's way back to what this session
// was asked. A control, not a stat: no preference hides it; it is absent
// only while nothing has been asked. Its panel lists the prompts newest
// first, each a few lines long: the words go to the prompt in the
// transcript, Copy takes its readable form, Reuse puts it back in the
// composer. Reuse lands only in an empty composer, as taking a held prompt
// back does — merging two messages into one is the user's call, made with
// Copy — and says so rather than hiding.
import type { RefObject } from "react";
import { userPartsText, type UserBlock } from "../../shared/protocol";
import { count } from "../../shared/count";
import { Icon } from "../shared/icon";
import { useCopy } from "../shared/use-copy";
import { COMPOSER_HAS_TEXT } from "./composer/composer-controls";
import { ReadoutPanel } from "./readout-panel";

export function PromptsChip({
  prompts,
  composerEmpty,
  onGoTo,
  onReuse,
  open,
  onOpenChange,
  anchor,
}: {
  /** In the order they were asked. */
  prompts: readonly UserBlock[];
  /** The durable draft is empty — the only state a reuse lands in. */
  composerEmpty: boolean;
  onGoTo(prompt: UserBlock): void;
  onReuse(prompt: UserBlock): void;
  open: boolean;
  onOpenChange(open: boolean): void;
  anchor: RefObject<HTMLDivElement | null>;
}) {
  const take = (act: (prompt: UserBlock) => void) => (prompt: UserBlock) => {
    onOpenChange(false);
    act(prompt);
  };
  return (
    <ReadoutPanel
      open={open}
      onOpenChange={onOpenChange}
      anchor={anchor}
      className="prompts-panel"
      title={<>{count(prompts.length, "prompt")} this session</>}
      chip={
        <button type="button" className={`chip prompts ${open ? "active" : ""}`}>
          <Icon name="comment" /> {count(prompts.length, "prompt")}
        </button>
      }
    >
      {prompts
        .map((prompt, i) => (
          <PromptRow
            key={prompt.id}
            n={i + 1}
            prompt={prompt}
            composerEmpty={composerEmpty}
            onGoTo={take(onGoTo)}
            onReuse={take(onReuse)}
          />
        ))
        .reverse()}
    </ReadoutPanel>
  );
}

function PromptRow(props: {
  n: number;
  prompt: UserBlock;
  composerEmpty: boolean;
  onGoTo(prompt: UserBlock): void;
  onReuse(prompt: UserBlock): void;
}) {
  const { copied, copy } = useCopy();
  const text = userPartsText(props.prompt.parts);
  return (
    <div className="prompt-row" data-prompt-row={props.prompt.id}>
      <span className="n">{props.n}</span>
      <button type="button" className="words" title="Go to this prompt" onClick={() => props.onGoTo(props.prompt)}>
        {text}
      </button>
      <span className="acts">
        <button type="button" className="act" title={copied ? "Copied" : "Copy"} aria-label="Copy" onClick={() => copy(text)}>
          <Icon name={copied ? "check" : "copy"} />
        </button>
        <button
          type="button"
          className="act"
          aria-disabled={!props.composerEmpty}
          title={props.composerEmpty ? "Reuse — put it back in the composer" : COMPOSER_HAS_TEXT}
          aria-label="Reuse"
          onClick={() => {
            if (props.composerEmpty) props.onReuse(props.prompt);
          }}
        >
          <Icon name="reply" />
        </button>
      </span>
    </div>
  );
}
