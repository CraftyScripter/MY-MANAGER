"use client";
import { useState } from "react";
import type { LeadFile, LeadFolder } from "../../types";

interface MoveFileModalProps {
  file: LeadFile;
  folders: LeadFolder[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function MoveFileModal({ file, folders, onClose, onSuccess }: MoveFileModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>(file.folderId || "root");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flatten folders tree for simple dropdown selection
  function flattenFolders(items: LeadFolder[], depth = 0): { id: string; name: string; depth: number }[] {
    const list: { id: string; name: string; depth: number }[] = [];
    for (const item of items) {
      list.push({ id: item.id, name: item.name, depth });
      if (item.children && item.children.length > 0) {
        list.push(...flattenFolders(item.children, depth + 1));
      }
    }
    return list;
  }

  const flatFolderList = flattenFolders(folders);

  async function handleMove() {
    setMoving(true);
    setError(null);
    try {
      const targetFolderId = selectedFolderId === "root" ? null : selectedFolderId;
      const res = await fetch(`/api/admin/leads/files/${file.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: targetFolderId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to move file");
      }

      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to move file");
      setMoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-.75m-6-6l6-6m0 0v5.25m0-5.25H11.25" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Move File</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{file.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Select Destination Folder
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {/* Root / Main Directory */}
              <label
                onClick={() => setSelectedFolderId("root")}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition cursor-pointer ${
                  selectedFolderId === "root"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-semibold"
                    : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="destination"
                  checked={selectedFolderId === "root"}
                  onChange={() => setSelectedFolderId("root")}
                  className="accent-blue-600"
                />
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                <span className="text-xs">Top Level (Root Leads Directory)</span>
              </label>

              {/* Folder list */}
              {flatFolderList.map((f) => (
                <label
                  key={f.id}
                  onClick={() => setSelectedFolderId(f.id)}
                  style={{ paddingLeft: `${f.depth * 14 + 12}px` }}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition cursor-pointer ${
                    selectedFolderId === f.id
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-semibold"
                      : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="destination"
                    checked={selectedFolderId === f.id}
                    onChange={() => setSelectedFolderId(f.id)}
                    className="accent-blue-600 shrink-0"
                  />
                  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <span className="text-xs truncate">{f.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={moving || (selectedFolderId === "root" ? !file.folderId : selectedFolderId === file.folderId)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            {moving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Moving...</span>
              </>
            ) : (
              <span>Move File</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
