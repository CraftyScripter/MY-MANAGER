"use client";
import { useState } from "react";
import type { LeadFile } from "../../types";

export default function EditFileModal({ file, onClose, onSuccess }: { file: LeadFile; onClose: () => void; onSuccess: (file: LeadFile) => void }) {
  const [name, setName] = useState(file.name);
  const [description, setDescription] = useState(file.description || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/files/${file.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onSuccess(data.file);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Edit File</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">File Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} autoFocus className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
          </div>
          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-sm">{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
