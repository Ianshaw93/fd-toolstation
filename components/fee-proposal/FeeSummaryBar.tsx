'use client';

interface Props {
  totalFee: number;
  onGenerate: () => void;
  isGenerating: boolean;
}

export default function FeeSummaryBar({ totalFee, onGenerate, isGenerating }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-500">Total Fee</span>
          <p className="text-2xl font-bold text-gray-900">
            £{totalFee.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="px-8 py-3 bg-black hover:bg-gray-800 disabled:bg-gray-400 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            'Generate Proposal'
          )}
        </button>
      </div>
    </div>
  );
}
