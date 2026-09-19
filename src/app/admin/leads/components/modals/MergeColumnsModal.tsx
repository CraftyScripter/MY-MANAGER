"use client";
import { useState, useMemo } from "react";
import type { LeadColumn } from "../../types";

interface MergeColumnsModalProps {
  columns: LeadColumn[];
  initialSelectedColNames: string[];
  onClose: () => void;
  onMerge: (sourceColumnNames: string[], newColumnName: string, separator: string) => Promise<void>;
}

export default function MergeColumnsModal({
  columns,
  initialSelectedColNames,
  onClose,
  onMerge,
}: MergeColumnsModalProps) {
  const [selectedCols, setSelectedCols] = useState<string[]>(() => {
    if (initialSelectedColNames.length >= 2) return initialSelectedColNames;
    if (initialSelectedColNames.length === 1 && columns.length >= 2) {
      const nextCol = columns.find((c) => c.name !== initialSelectedColNames[0]);
      return nextCol ? [initialSelectedColNames[0], nextCol.name] : initialSelectedColNames;
    }
    return columns.slice(0, 2).map((c) => c.name);
  });

  const [separatorType, setSeparatorType] = useState<string>("space");
  const [customSeparator, setCustomSeparator] = useState<string>("");
  const [newColName, setNewColName] = useState<string>(() => {
    return initialSelectedColNames.length >= 2
      ? initialSelectedColNames.join(" - ")
      : "Merged Column";
  });
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSeparator = useMemo(() => {
    switch (separatorType) {
      case "space":
        return " ";
      case "comma":
        return ", ";
      case "dash":
        return " - ";
      case "slash":
        return " / ";
      case "none":
        return "";
      case "custom":
        return customSeparator;
      default:
        return " ";
    }
  }, [separatorType, customSeparator]);

  const toggleCol = (name: string) => {
    setSelectedCols((prev) => {
      const next = prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name];
      if (next.length >= 2 && (!newColName || newColName === "Merged Column" || newColName === prev.join(" - "))) {
        setNewColName(next.join(" - "));
      }
      return next;
    });
  };

  async function handleMerge() {
    if (selectedCols.length < 2) {
      setError("Please select at least 2 columns to merge.");
      return;
    }
    if (!newColName.trim()) {
      setError("Please enter a name for the merged column.");
      return;
    }

    setMerging(true);
    setError(null);
    try {
      await onMerge(selectedCols, newColName.trim(), effectiveSeparator);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to merge columns";
      setError(msg);
      setMerging(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-zinc-700 dark:text-zinc-300 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#18181b]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-14.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6a2.25 2.25 0 012.25-2.25z" />
            </svg>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Merge Columns</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 rounded px-3 py-2 text-red-600 dark:text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* Select Columns */}
          <div>
            <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1.5">
              Select columns to merge (in order) *
            </label>
            <div className="max-h-36 overflow-y-auto bg-slate-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 space-y-1.5 scrollbar-thin">
              {columns.map((col) => {
                const isChecked = selectedCols.includes(col.name);
                const orderIndex = selectedCols.indexOf(col.name);
                return (
                  <label
                    key={col.id}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                      isChecked ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-2xs" : "hover:bg-slate-200/60 dark:hover:bg-zinc-850 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCol(col.name)}
                        className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="font-mono text-xs">{col.name}</span>
                    </div>
                    {isChecked && (
                      <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono px-1.5 py-0.5 rounded">
                        #{orderIndex + 1}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            <p className="text-zinc-500 text-[11px] mt-1">
              {selectedCols.length} column{selectedCols.length !== 1 ? "s" : ""} selected
            </p>
          </div>

          {/* Separator */}
          <div>
            <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1.5">Separator</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "space", label: "Space (' ')" },
                { id: "comma", label: "Comma (', ')" },
                { id: "dash", label: "Dash (' - ')" },
                { id: "slash", label: "Slash (' / ')" },
                { id: "none", label: "None" },
                { id: "custom", label: "Custom" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSeparatorType(item.id)}
                  className={`px-2 py-1.5 border rounded-lg text-xs text-center transition cursor-pointer ${
                    separatorType === item.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-medium shadow-2xs"
                      : "border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {separatorType === "custom" && (
              <input
                type="text"
                placeholder="Enter custom separator (e.g. | or _)"
                value={customSeparator}
                onChange={(e) => setCustomSeparator(e.target.value)}
                className="w-full mt-2 bg-slate-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
              />
            )}
          </div>

          {/* Merged Column Name */}
          <div>
            <label className="block text-zinc-600 dark:text-zinc-400 font-medium mb-1.5">New Merged Column Name *</label>
            <input
              type="text"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="e.g. Full Name, Address"
              className="w-full bg-slate-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Merge Preview */}
          {selectedCols.length >= 2 && (
            <div className="bg-slate-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Preview</span>
              <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">
                {selectedCols.map((c) => `[${c}]`).join(effectiveSeparator)}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#18181b]">
          <button
            onClick={onClose}
            disabled={merging}
            className="px-3.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-200/80 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={selectedCols.length < 2 || !newColName.trim() || merging}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            {merging ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Merging...</span>
              </>
            ) : (
              <span>Merge Columns</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
