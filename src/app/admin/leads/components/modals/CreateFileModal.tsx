"use client";
import { useState } from "react";
import type { LeadFolder, LeadFile } from "../../types";

import DropdownSelect from "@/components/DropdownSelect";

export default function CreateFileModal({ folderId, folders, onClose, onSuccess }: { folderId?: string | null; folders: LeadFolder[]; onClose: () => void; onSuccess: (file: LeadFile) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState(folderId || "");
  const [syncWithGoogleSheet, setSyncWithGoogleSheet] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          folderId: selectedFolderId || null,
          syncWithGoogleSheet,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onSuccess(data.file);
    } catch {
      alert("Failed to create file");
    } finally {
      setSaving(false);
    }
  }

  function getFlatFolders(list: LeadFolder[], depth = 0): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    for (const f of list) {
      result.push({ id: f.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${f.name}` });
      if (f.children && f.children.length > 0) {
        result.push(...getFlatFolders(f.children, depth + 1));
      }
    }
    return result;
  }

  const flatFolders = getFlatFolders(folders);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">New File</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">File Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus placeholder="e.g., Google Maps Leads" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
          </div>
          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
          </div>
          {flatFolders.length > 0 && (
            <div>
              <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Folder (optional)</label>
              <DropdownSelect
                value={selectedFolderId}
                onChange={(val) => setSelectedFolderId(val)}
                options={[
                  { label: "Root (no folder)", value: "" },
                  ...flatFolders.map((f) => ({ label: f.label, value: f.id })),
                ]}
                size="md"
                align="left"
                className="w-full"
              />
            </div>
          )}

          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="syncWithGoogleSheet"
              checked={syncWithGoogleSheet}
              onChange={(e) => setSyncWithGoogleSheet(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="syncWithGoogleSheet" className="cursor-pointer select-none">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Link &amp; Create in Google Workspace
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                Automatically creates this spreadsheet in your connected Google account with real-time sync
              </span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || saving} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-sm">{saving ? "Creating..." : "Create"}</button>
        </div>
      </div>
    </div>
  );
}
