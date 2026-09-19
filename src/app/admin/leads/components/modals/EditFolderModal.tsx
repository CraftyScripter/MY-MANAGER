"use client";
import { useState } from "react";
import type { LeadFolder } from "../../types";
import { FOLDER_COLORS } from "../../constants";

import DropdownSelect from "@/components/DropdownSelect";

export default function EditFolderModal({
  folder,
  folders = [],
  onClose,
  onSuccess,
}: {
  folder: LeadFolder;
  folders?: LeadFolder[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color || FOLDER_COLORS[0]);
  const [selectedParentId, setSelectedParentId] = useState(folder.parentId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collect all descendant IDs of the current folder to prevent cycles
  function getDescendantIds(item: LeadFolder): string[] {
    const ids: string[] = [item.id];
    if (item.children) {
      for (const child of item.children) {
        ids.push(...getDescendantIds(child));
      }
    }
    return ids;
  }

  const forbiddenIds = new Set(getDescendantIds(folder));

  function getEligibleFolders(list: LeadFolder[], depth = 0): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    for (const f of list) {
      if (!forbiddenIds.has(f.id)) {
        result.push({ id: f.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}📁 ${f.name}` });
        if (f.children && f.children.length > 0) {
          result.push(...getEligibleFolders(f.children, depth + 1));
        }
      }
    }
    return result;
  }

  const flatFolders = getEligibleFolders(folders);

  async function handleSave() {
    if (!name.trim()) {
      setError("Folder name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/leads/folders/${folder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          parentId: selectedParentId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update folder");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update folder");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Edit Folder</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl">
              {error}
            </div>
          )}
          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Folder Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
              className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition"
            />
          </div>
          {flatFolders.length > 0 && (
            <div>
              <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Location (Parent Folder)</label>
              <DropdownSelect
                value={selectedParentId}
                onChange={(val) => setSelectedParentId(val)}
                options={[
                  { label: "Root (Top Level)", value: "" },
                  ...flatFolders.map((f) => ({ label: f.label, value: f.id })),
                ]}
                size="md"
                align="left"
                className="w-full"
              />
            </div>
          )}
          <div>
            <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Color</label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition cursor-pointer ${
                    color === c ? "ring-2 ring-blue-500 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-zinc-900" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-sm"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
