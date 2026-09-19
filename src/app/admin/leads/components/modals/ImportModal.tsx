"use client";
import { useState, useEffect, useCallback } from "react";

interface SheetInfo {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: (string | null)[][];
}

interface ImportModalProps {
  tabId: string;
  tabName: string;
  fileName: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function ImportModal({
  tabId,
  tabName,
  fileName,
  onClose,
  onSuccess,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [importAllSheets, setImportAllSheets] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importedSheets, setImportedSheets] = useState<
    { name: string; count: number }[] | null
  >(null);

  const detectFile = useCallback(async (f: File) => {
    setDetecting(true);
    setSheets([]);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const res = await fetch("/api/admin/leads/import/detect", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to detect file");
      setSheets(data.sheets || []);
      if (data.sheetCount <= 1) setImportAllSheets(false);
      setSelectedSheetIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to detect file");
    } finally {
      setDetecting(false);
    }
  }, []);

  useEffect(() => {
    if (file) detectFile(file);
    else {
      setSheets([]);
      setImportAllSheets(false);
    }
  }, [file, detectFile]);

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("tabId", tabId);
    formData.append("importMode", importAllSheets ? "multi" : "single");
    try {
      const res = await fetch("/api/admin/leads/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportedCount(data.imported);
      setImportedSheets(data.sheets || null);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }

  const currentSheet = sheets[selectedSheetIndex] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {done ? "Import Complete" : "Import Spreadsheet"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {done
                ? `${importedCount} rows imported`
                : `Into: ${fileName} > ${tabName}`}
            </p>
          </div>
          <button
            onClick={done ? () => onSuccess(importedCount) : onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Upload state */}
          {!done && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() =>
                  document.getElementById("file-input-import")?.click()
                }
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                  dragActive
                    ? "border-blue-500 bg-blue-50/50 dark:bg-zinc-800/50"
                    : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-slate-50/50 dark:bg-zinc-900/50"
                }`}
              >
                <input
                  id="file-input-import"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <svg
                  className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-500 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                {file ? (
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-300">{file.name}</p>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Drag & drop or click to select a file
                  </p>
                )}
              </div>

              {/* Detecting spinner */}
              {detecting && (
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="w-4 h-4 border-2 border-zinc-400 dark:border-zinc-600 border-t-zinc-700 dark:border-t-zinc-300 rounded-full animate-spin" />
                  <span>Detecting sheets...</span>
                </div>
              )}

              {/* Sheet list */}
              {sheets.length > 0 && !detecting && (
                <div className="bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-800 dark:text-zinc-300 font-medium">
                      {sheets.length === 1
                        ? "1 sheet detected"
                        : `${sheets.length} sheets detected`}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {sheets.map((sheet, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedSheetIndex(i)}
                        className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 cursor-pointer transition ${
                          selectedSheetIndex === i
                            ? "bg-blue-50 dark:bg-white/10 text-blue-700 dark:text-white font-medium"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">
                          {i + 1}
                        </span>
                        <span className="truncate">{sheet.name}</span>
                        <span className="ml-auto shrink-0 text-zinc-400 dark:text-zinc-500">
                          {sheet.rowCount} rows
                        </span>
                      </div>
                    ))}
                  </div>
                  {sheets.length > 1 && (
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={importAllSheets}
                        onChange={(e) => setImportAllSheets(e.target.checked)}
                        className="accent-blue-600 w-4 h-4 rounded cursor-pointer"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Import all sheets as separate tabs
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Detected columns */}
              {currentSheet && !detecting && (
                <div className="bg-slate-50/50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800/50 rounded-xl p-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mb-2">
                    Columns in &quot;{currentSheet.name}&quot;:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentSheet.headers
                      .filter((h) => h)
                      .map((h, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-md bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                        >
                          {h}
                        </span>
                      ))}
                  </div>
                  {currentSheet.sampleRows.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            {currentSheet.headers
                              .filter((h) => h)
                              .map((h, i) => (
                                <th
                                  key={i}
                                  className="px-2 py-1 text-left font-medium text-zinc-500 whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentSheet.sampleRows
                            .slice(0, 3)
                            .map((row, ri) => (
                              <tr
                                key={ri}
                                className="border-b border-zinc-100 dark:border-zinc-800/50"
                              >
                                {currentSheet.headers
                                  .filter((h) => h)
                                  .map((_, ci) => {
                                    const headerIdx =
                                      currentSheet.headers.indexOf(
                                        currentSheet.headers.filter(
                                          (h) => h
                                        )[ci]
                                      );
                                    return (
                                      <td
                                        key={ci}
                                        className="px-2 py-1 text-zinc-600 dark:text-zinc-400 whitespace-nowrap max-w-[150px] truncate"
                                      >
                                        {row[headerIdx] || (
                                          <span className="text-zinc-400 dark:text-zinc-700">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Done state */}
          {done && (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-6 text-center">
                <svg
                  className="w-12 h-12 mx-auto text-emerald-600 dark:text-emerald-400 mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {importedCount} row{importedCount !== 1 ? "s" : ""} imported
                </p>
                {importedSheets && importedSheets.length > 1 && (
                  <div className="mt-3 space-y-1">
                    {importedSheets.map((s, i) => (
                      <p key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
                        {s.name}: {s.count} rows
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          {done ? (
            <button
              onClick={() => onSuccess(importedCount)}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition cursor-pointer shadow-sm"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || uploading || detecting || sheets.length === 0}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-sm"
              >
                {uploading ? "Importing..." : "Import"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
