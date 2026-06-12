'use client';

import { Fragment } from 'react';
import type { TextBlock } from '../../lib/fee-types';

interface Props {
  kind: TextBlock['kind'];
  content: string;
  placeholders: string[];
}

/** Split a template into text + {token} runs, highlighting only known tokens
 *  (the ones replaced at generation time); stray braces stay literal prose. */
function renderTemplate(content: string, placeholders: string[]) {
  const known = new Set(placeholders);
  const parts = content.split(/(\{[^{}]+\})/g);
  return parts.map((part, i) =>
    /^\{[^{}]+\}$/.test(part) && known.has(part.slice(1, -1)) ? (
      <mark key={i} className="rounded bg-amber-100 px-1 font-mono text-amber-800">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * Shows wording the way it renders in the report: bullets as a list, paragraphs
 * as prose, template tokens highlighted (their real values are filled in at
 * generation time). Mirrors the document so editing isn't a guessing game.
 */
export default function TextBlockPreview({ kind, content, placeholders }: Props) {
  if (kind === 'bullet_list') {
    const items = content.split('\n').map((l) => l.trim()).filter(Boolean);
    return (
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  if (kind === 'template') {
    return (
      <p className="whitespace-pre-wrap text-sm text-gray-800">{renderTemplate(content, placeholders)}</p>
    );
  }

  return <p className="whitespace-pre-wrap text-sm text-gray-800">{content}</p>;
}
