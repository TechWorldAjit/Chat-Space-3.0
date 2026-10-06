import React from "react";
import toast from "react-hot-toast";

const AISummaryModal = ({ isOpen, onClose, summaryData, isLoading, groupName }) => {
  if (!isOpen) return null;

  const handleCopy = () => {
    if (!summaryData) return;
    const textToCopy = `Group: ${groupName}\n\nSUMMARY:\n${summaryData.summary}\n\nKEY TAKEAWAYS:\n${(
      summaryData.keyTakeaways || []
    )
      .map((k) => `• ${k}`)
      .join("\n")}`;

    navigator.clipboard.writeText(textToCopy);
    toast.success("Summary copied to clipboard!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#282142] border border-violet-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-white flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-purple-900/40 to-violet-900/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <h2 className="font-semibold text-lg leading-tight">Gemini AI Summary</h2>
              <p className="text-xs text-violet-300">
                {groupName ? `Conversation in "${groupName}"` : "Group conversation analysis"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin"></div>
                <span className="absolute inset-0 flex items-center justify-center text-sm">✨</span>
              </div>
              <p className="text-sm text-violet-200 font-medium animate-pulse">
                Gemini is analyzing group conversation...
              </p>
              <p className="text-xs text-gray-400 max-w-xs">
                Extracting key topics, decisions, and action items safely.
              </p>
            </div>
          ) : summaryData ? (
            <>
              {/* Summary Section */}
              <div className="bg-white/5 border border-violet-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-400">
                    📋 Overview Summary
                  </span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed font-light">
                  {summaryData.summary}
                </p>
              </div>

              {/* Key Takeaways Section */}
              {summaryData.keyTakeaways && summaryData.keyTakeaways.length > 0 && (
                <div className="bg-white/5 border border-violet-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-green-400">
                      🎯 Key Takeaways & Action Items
                    </span>
                  </div>
                  <ul className="space-y-2 mt-1">
                    {summaryData.keyTakeaways.map((item, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-200 flex items-start gap-2 leading-snug"
                      >
                        <span className="text-violet-400 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-gray-400 text-sm">
              No summary available.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-[#1e1933] flex items-center justify-between">
          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            <span>Powered by</span>
            <span className="text-violet-300 font-medium">Google Gemini</span>
          </p>
          <div className="flex items-center gap-3">
            {summaryData && !isLoading && (
              <button
                onClick={handleCopy}
                className="px-4 py-1.5 text-xs rounded-full border border-violet-400/50 hover:bg-violet-500/20 text-violet-200 transition-colors cursor-pointer"
              >
                Copy Summary
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-1.5 text-xs rounded-full bg-gradient-to-r from-purple-400 to-violet-600 text-white font-medium hover:opacity-90 transition-opacity cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISummaryModal;
