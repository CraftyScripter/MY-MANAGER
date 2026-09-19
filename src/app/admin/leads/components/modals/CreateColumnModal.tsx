"use client";
import { useState } from "react";
import type { LeadColumn } from "../../types";

const OPTION_PRESETS = [
  { label: "Status", options: "Pending, In Progress, Done, Verified" },
  { label: "Priority", options: "Low, Medium, High, Urgent" },
  { label: "Yes / No", options: "Yes, No" },
  { label: "Stages", options: "New, Contacted, Qualified, Converted, Lost" },
];

export default function CreateColumnModal({
  fileId,
  onClose,
  onSuccess,
}: {
  fileId: string;
  onClose: () => void;
  onSuccess: (col: LeadColumn) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "select" | "number">("text");
  const [options, setOptions] = useState("Pending, In Progress, Done, Verified");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/leads/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          fileId,
          type,
          options: type === "select" ? options.trim() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      onSuccess(data.column);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Add Column</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Create a standard text column or dropdown menu</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            &times;
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-zinc-700 dark:text-zinc-300 block mb-1.5 text-sm font-medium">Column Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && type !== "select" && handleCreate()}
              autoFocus
              placeholder="e.g. Status, Priority, Action, Country"
              className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-600 transition"
            />
          </div>

          <div>
            <label className="text-zinc-700 dark:text-zinc-300 block mb-1.5 text-sm font-medium">Column Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType("text")}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer text-center ${
                  type === "text"
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                    : "bg-slate-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setType("select")}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer text-center ${
                  type === "select"
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                    : "bg-slate-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                ▾ Dropdown Menu
              </button>
              <button
                type="button"
                onClick={() => setType("number")}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition cursor-pointer text-center ${
                  type === "number"
                    ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                    : "bg-slate-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800"
                }`}
              >
                Number
              </button>
            </div>
          </div>

          {type === "select" && (
            <div className="space-y-2 bg-slate-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-zinc-800 dark:text-zinc-300 text-xs font-medium">
                  Dropdown Options <span className="text-zinc-500 font-normal">(comma-separated)</span>
                </label>
                <span className="text-[11px] text-zinc-500">Quick presets:</span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                {OPTION_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setOptions(p.options);
                      if (!name) setName(p.label);
                    }}
                    className="px-2 py-1 text-[11px] rounded-md bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700/60 transition cursor-pointer shadow-2xs"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>

              <textarea
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                rows={2}
                placeholder="e.g. Pending, In Progress, Done, Verified"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-600 resize-none font-mono"
              />

              <div className="flex flex-wrap gap-1 pt-1">
                {options
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((opt, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                    >
                      {opt}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl transition cursor-pointer shadow-sm"
          >
            {saving ? "Creating..." : "Add Column"}
          </button>
        </div>
      </div>
    </div>
  );
}
