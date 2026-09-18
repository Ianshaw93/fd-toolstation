import { ctaLabel, partLabel } from '../../../lib/tools/catalogue';
import { resolveOpenUrl } from '../../../lib/tools/search';
import ToolCard from '../ToolCard';
import type { ToolSearchLayoutProps } from './types';

/**
 * Suggestion panel + wrapping card grid. Kept as a prototype; command palette is active.
 */
export default function FilterGridLayout({ result, onOpen, cfdStatus = null }: ToolSearchLayoutProps) {
  const suggestionUrl = result.suggestion ? resolveOpenUrl(result.suggestion.part) : undefined;

  return (
    <>
      {result.suggestion && (
        <div
          className="mb-8 max-w-2xl mx-auto rounded-xl border border-blue-200 bg-blue-50 p-5"
          data-testid="tool-suggestion"
        >
          <p className="text-sm text-blue-800 mb-1">You&apos;re likely looking for:</p>
          <h2 className="text-xl font-semibold text-gray-900">{result.suggestion.label}</h2>
          <p className="text-sm text-gray-600 mt-2">{result.suggestion.why}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {suggestionUrl && (
              <button
                type="button"
                onClick={() => onOpen(result.suggestion!.part)}
                className="px-4 py-2 bg-black hover:bg-gray-800 rounded-lg text-white font-medium transition-colors"
              >
                {ctaLabel(result.suggestion.part)}
              </button>
            )}
            {result.suggestion.part.openHint && !suggestionUrl && (
              <p className="text-sm text-gray-700">{result.suggestion.part.openHint}</p>
            )}
          </div>
        </div>
      )}

      {result.matches.length === 0 ? (
        <p className="text-center text-gray-500 py-12" data-testid="tool-search-empty">
          No tools match that search. Try a tool name, alias, or what you want to do.
        </p>
      ) : (
        <div className="flex flex-wrap justify-center gap-6 px-4 pb-4">
          {result.matches.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              cfdStatus={cfdStatus}
              highlighted={result.suggestion?.part.id === tool.id}
              title={partLabel(tool)}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </>
  );
}
