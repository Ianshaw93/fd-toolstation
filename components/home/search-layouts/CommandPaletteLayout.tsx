'use client';

import { useEffect, useRef, useState } from 'react';
import { ctaLabel, partLabel } from '../../../lib/tools/catalogue';
import { resolveOpenUrl } from '../../../lib/tools/search';
import type { ToolPart, ToolSearchResult } from '../../../lib/tools/types';
import type { ToolSearchLayoutProps } from './types';

export function paletteItems(result: ToolSearchResult): ToolPart[] {
  if (!result.suggestion) return result.matches;
  const rest = result.matches.filter((item) => item.id !== result.suggestion!.part.id);
  return [result.suggestion.part, ...rest];
}

function kindChip(kind: ToolPart['kind']): string {
  if (kind === 'web') return 'Web';
  if (kind === 'excel') return 'Excel';
  if (kind === 'desktop') return 'Desktop';
  if (kind === 'addin') return 'Word add-in';
  if (kind === 'mobile') return 'Mobile';
  if (kind === 'exe') return 'EXE';
  return 'Dropbox';
}

export default function CommandPaletteLayout(props: ToolSearchLayoutProps) {
  return <CommandPalettePanel key={props.result.query} {...props} />;
}

function CommandPalettePanel({ result, onOpen }: ToolSearchLayoutProps) {
  const items = paletteItems(result);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const activeRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const currentItems = itemsRef.current;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => {
          const next = currentItems.length === 0 ? 0 : Math.min(currentItems.length - 1, index + 1);
          activeIndexRef.current = next;
          return next;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => {
          const next = Math.max(0, index - 1);
          activeIndexRef.current = next;
          return next;
        });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = currentItems[activeIndexRef.current];
        if (item) onOpen(item);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onOpen]);

  const suggestion = result.suggestion;
  const suggestionUrl = suggestion ? resolveOpenUrl(suggestion.part) : undefined;

  return (
    <div className="max-w-xl mx-auto" data-testid="command-palette">
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
        {suggestion && (
          <div className="border-b border-blue-200 bg-blue-50 px-4 py-3" data-testid="tool-suggestion">
            <p className="text-sm text-blue-800 mb-1">You&apos;re likely looking for:</p>
            <h2 className="text-lg font-semibold text-gray-900">{suggestion.label}</h2>
            <p className="text-sm text-gray-600 mt-1">{suggestion.why}</p>
            {suggestion.basedOn && (
              <p className="text-xs text-blue-700 mt-1" data-testid="suggestion-calc-source">
                {suggestion.basedOn}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {suggestionUrl && (
                <button
                  type="button"
                  onClick={() => onOpen(suggestion.part)}
                  className="px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors"
                >
                  {ctaLabel(suggestion.part)}
                </button>
              )}
              {suggestion.part.openHint && !suggestionUrl && (
                <p className="text-sm text-gray-700">{suggestion.part.openHint}</p>
              )}
            </div>
            {suggestionUrl && (
              <a
                href={suggestionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block font-mono text-xs text-gray-700 break-all hover:text-blue-700"
                data-testid="suggestion-open-url"
              >
                {suggestionUrl}
              </a>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-center text-gray-500 py-10 px-4" data-testid="tool-search-empty">
            No tools match that search. Try a tool name, alias, or what you want to do.
          </p>
        ) : (
          <div
            id="tool-search-palette"
            role="listbox"
            aria-label="Matching tools"
            className="max-h-[36rem] overflow-y-auto py-1"
            data-match-count={items.length}
          >
            {items.map((tool, index) => {
              const active = index === activeIndex;
              return (
                <div
                  key={tool.id}
                  ref={active ? activeRef : undefined}
                  role="option"
                  aria-selected={active}
                  data-tool-id={tool.id}
                  id={`tool-palette-option-${tool.id}`}
                  className={`mx-1 flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    active ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-gray-100'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => onOpen(tool)}
                >
                  <span className="text-xl leading-none mt-0.5" aria-hidden>
                    {tool.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{partLabel(tool)}</span>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                        {kindChip(tool.kind)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-gray-600 line-clamp-2">
                      {tool.description}
                    </span>
                    {result.basedOn[tool.id] && (
                      <span
                        className="mt-0.5 block text-xs text-blue-700"
                        data-testid={`calc-source-${tool.id}`}
                      >
                        {result.basedOn[tool.id]}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <span className="text-blue-600 font-medium">Arrow keys</span> to move
          <span className="mx-2 text-gray-300">·</span>
          <span className="text-blue-600 font-medium">Enter</span> to open
          <span className="mx-2 text-gray-300">·</span>
          <span className="text-blue-600 font-medium">Esc</span> to clear
        </div>
      </div>
    </div>
  );
}
