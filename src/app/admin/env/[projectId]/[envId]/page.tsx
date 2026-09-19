"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import { parseEnvFile } from "@/lib/envParser";

interface Variable {
  id: string;
  key: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Environment {
  id: string;
  name: string;
  projectId: string;
}

interface EnvProject {
  id: string;
  name: string;
}

interface PasteRow {
  id: string;
  key: string;
  value: string;
  description: string;
}

function generateRowId() {
  return Math.random().toString(36).substring(2, 9);
}

function emptyRow(): PasteRow {
  return { id: generateRowId(), key: "", value: "", description: "" };
}

export default function EnvVariablesPage({
  params,
}: {
  params: Promise<{ projectId: string; envId: string }>;
}) {
  const { projectId, envId } = use(params);

  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const initialLoadDone = useRef(false);

  const [project, setProject] = useState<EnvProject | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Map<string, string>>(
    new Map()
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVar, setEditingVar] = useState<Variable | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formShowValue, setFormShowValue] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [rows, setRows] = useState<PasteRow[]>([emptyRow()]);

  const [deleteTarget, setDeleteTarget] = useState<Variable | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProject = useCallback(() => {
    fetch(`/api/admin/env/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.project) {
          setProject({ id: data.project.id, name: data.project.name });
          const env = data.project.environments?.find(
            (e: { id: string }) => e.id === envId
          );
          if (env) setEnvironment({ id: env.id, name: env.name, projectId });
        }
      })
      .catch(() => {});
  }, [projectId, envId]);

  const fetchVariables = useCallback(() => {
    let cancelled = false;
    if (initialLoadDone.current) setLoading(true);
    const params = new URLSearchParams({ environmentId: envId });
    if (debouncedSearch) params.set("search", debouncedSearch);
    fetch(`/api/admin/env/variables?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setVariables(data.variables || []);
      })
      .catch(() => {
        if (!cancelled)
          setToast({ type: "error", message: "Failed to load variables" });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [envId, debouncedSearch]);

  useEffect(() => {
    fetchProject();
    return fetchVariables();
  }, [fetchProject, fetchVariables]);

  const filteredVariables = variables;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredVariables.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredVariables.map((v) => v.id)));
    }
  }

  function resetForm() {
    setFormKey("");
    setFormValue("");
    setFormDescription("");
    setFormShowValue(false);
  }

  function resetRows() {
    setRows([emptyRow()]);
  }

  function openAddModal() {
    resetForm();
    resetRows();
    setEditingVar(null);
    setShowAddModal(true);
  }

  function handlePasteOnKeyInput(
    e: React.ClipboardEvent<HTMLInputElement>,
    rowId: string
  ) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;

    e.preventDefault();

    const parsed = parseEnvFile(text);
    if (parsed.valid.length === 0) return;

    const existingNonEmpty = rows.filter(
      (r) => r.key.trim() !== "" && r.id !== rowId
    );

    const newRows: PasteRow[] = parsed.valid.map((v) => ({
      id: generateRowId(),
      key: v.key,
      value: v.value,
      description: "",
    }));

    setRows([...existingNonEmpty, ...newRows]);
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => {
      if (prev.length <= 1) return [emptyRow()];
      return prev.filter((r) => r.id !== id);
    });
  }

  function updateRow(
    id: string,
    field: "key" | "value" | "description",
    value: string
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  const rowsValid = rows.filter((r) => r.key.trim() && r.value);
  const existingKeySet = new Set(variables.map((v) => v.key));
  const newCount = rowsValid.filter(
    (r) => !existingKeySet.has(r.key.trim())
  ).length;
  const existingCount = rowsValid.filter((r) =>
    existingKeySet.has(r.key.trim())
  ).length;

  async function handleBulkSave() {
    const toSave = rowsValid.map((r) => ({
      key: r.key.trim(),
      value: r.value,
      description: r.description || undefined,
    }));
    if (toSave.length === 0) {
      setToast({ type: "error", message: "No valid variables to save" });
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/env/variables/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentId: envId, variables: toSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setToast({
        type: "success",
        message: `${data.created} variable${data.created !== 1 ? "s" : ""} created${data.skipped > 0 ? `, ${data.skipped} skipped` : ""}`,
      });
      setShowAddModal(false);
      resetRows();
      fetchVariables();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEditSave() {
    if (!formKey.trim()) {
      setToast({ type: "error", message: "Key is required" });
      return;
    }
    if (!editingVar && !formValue) {
      setToast({ type: "error", message: "Value is required" });
      return;
    }
    setFormLoading(true);
    try {
      const payload: Record<string, unknown> = {
        environmentId: envId,
        key: formKey,
        description: formDescription || undefined,
      };
      if (formValue) payload.value = formValue;
      const url = editingVar
        ? `/api/admin/env/variables/${editingVar.id}`
        : "/api/admin/env/variables";
      const method = editingVar ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setToast({
        type: "success",
        message: editingVar ? "Variable updated" : "Variable created",
      });
      setShowAddModal(false);
      setEditingVar(null);
      resetForm();
      fetchVariables();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeleteVariable() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/env/variables/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setToast({ type: "success", message: "Variable deleted" });
      setDeleteTarget(null);
      setDeleteConfirm("");
      fetchVariables();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDelete() {
    if (bulkDeleteConfirm !== "DELETE") return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/env/variables/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          confirm: "DELETE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setToast({
        type: "success",
        message: `${data.deleted} variable${data.deleted !== 1 ? "s" : ""} deleted`,
      });
      setSelected(new Set());
      setBulkDeleteConfirm("");
      fetchVariables();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleRevealVariable(varId: string) {
    if (revealedValues.has(varId)) {
      setRevealedValues((prev) => {
        const next = new Map(prev);
        next.delete(varId);
        return next;
      });
      return;
    }
    try {
      const res = await fetch(`/api/admin/env/variables/${varId}/reveal`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.value !== undefined) {
        setRevealedValues((prev) => new Map(prev).set(varId, data.value));
      }
    } catch {
      setToast({ type: "error", message: "Failed to reveal value" });
    }
  }

  async function handleCopyVariable(varId: string) {
    try {
      const res = await fetch(`/api/admin/env/variables/${varId}/copy`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.value !== undefined) {
        await navigator.clipboard.writeText(data.value);
        setToast({ type: "success", message: "Value copied to clipboard" });
      }
    } catch {
      setToast({ type: "error", message: "Failed to copy value" });
    }
  }

  async function handleCopySelected() {
    const selectedVars = variables.filter((v) => selected.has(v.id));
    const lines: string[] = [];
    for (const v of selectedVars) {
      let val = revealedValues.get(v.id);
      if (!val) {
        try {
          const res = await fetch(`/api/admin/env/variables/${v.id}/copy`, {
            method: "POST",
          });
          const data = await res.json();
          val = data.value || "";
        } catch {
          val = "";
        }
      }
      lines.push(`${v.key}=${val}`);
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    setToast({
      type: "success",
      message: `${selectedVars.length} variable${selectedVars.length !== 1 ? "s" : ""} copied`,
    });
  }

  async function handleDownloadEnv() {
    try {
      const res = await fetch(`/api/admin/env/export?environmentId=${envId}`);
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `.env.${environment?.name.toLowerCase().replace(/\s+/g, "-") || "export"}`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ type: "success", message: "File downloaded" });
    } catch {
      setToast({ type: "error", message: "Failed to download" });
    }
  }

  async function handleCopyAll() {
    try {
      const res = await fetch(`/api/admin/env/export?environmentId=${envId}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setToast({ type: "success", message: "All variables copied to clipboard" });
    } catch {
      setToast({ type: "error", message: "Failed to copy" });
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 fade-in duration-200 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border border-emerald-500"
              : "bg-red-600 text-white border border-red-500"
          }`}
        >
          {toast.type === "success" ? (
            <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}


      <Breadcrumbs
        items={[
          { label: "ENV Manager", href: "/admin/env" },
          { label: project?.name || "...", href: `/admin/env/${projectId}` },
          { label: environment?.name || "..." },
        ]}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            {environment?.name || "Loading..."}
          </h1>
          <p className="text-zinc-500 text-sm">
            {filteredVariables.length} variable
            {filteredVariables.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={openAddModal}
            className="btn-primary gap-2 px-4 py-2.5 text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Variable
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition cursor-pointer shadow-sm">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              Export
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
              <button
                onClick={handleDownloadEnv}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-t-xl transition cursor-pointer"
              >
                Download .env
              </button>
              <button
                onClick={handleCopyAll}
                className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-b-xl transition cursor-pointer"
              >
                Copy All to Clipboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl shadow-xs">
          <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={handleCopySelected}
            className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg transition cursor-pointer shadow-xs"
          >
            Copy Selected
          </button>
          <button
            onClick={() => setBulkDeleteConfirm("DELETE")}
            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg transition cursor-pointer shadow-xs"
          >
            Delete Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {bulkDeleteConfirm !== "" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Bulk Delete Variables
              </h2>
              <button
                onClick={() => setBulkDeleteConfirm("")}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Delete {selected.size} selected variable
                {selected.size !== 1 ? "s" : ""}? This cannot be undone.
              </p>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">
                  Type DELETE to confirm:
                </label>
                <input
                  type="text"
                  value={bulkDeleteConfirm === "DELETE" ? "DELETE" : ""}
                  onChange={(e) => setBulkDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setBulkDeleteConfirm("")}
                className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting || bulkDeleteConfirm !== "DELETE"}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shadow-sm"
              >
                {bulkDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by key or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition shadow-sm"
          />
        </div>
        <button
          onClick={() => fetchVariables()}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition cursor-pointer shadow-sm"
        >
          <svg
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
            />
          </svg>
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-400 dark:border-zinc-600 border-t-blue-600 dark:border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : filteredVariables.length === 0 ? (
          <div className="text-center py-20">
            <svg
              className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-700 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
              />
            </svg>
            <p className="text-zinc-500 dark:text-zinc-600">No variables found</p>
            <button
              onClick={openAddModal}
              className="mt-4 btn-primary px-4 py-2 text-xs"
            >
              Add your first variable
            </button>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-transparent">
                    <th className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={
                          filteredVariables.length > 0 &&
                          selected.size === filteredVariables.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-4 font-medium text-zinc-600 dark:text-zinc-500">
                      Key
                    </th>
                    <th className="text-left px-4 py-4 font-medium text-zinc-600 dark:text-zinc-500">
                      Value
                    </th>
                    <th className="text-left px-4 py-4 font-medium text-zinc-600 dark:text-zinc-500">
                      Description
                    </th>
                    <th className="text-left px-4 py-4 font-medium text-zinc-600 dark:text-zinc-500">
                      Updated
                    </th>
                    <th className="text-right px-4 py-4 font-medium text-zinc-600 dark:text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {filteredVariables.map((v) => (
                    <tr
                      key={v.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/20 transition-colors ${
                        selected.has(v.id) ? "bg-blue-50/50 dark:bg-zinc-800/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(v.id)}
                          onChange={() => toggleSelect(v.id)}
                          className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-zinc-700 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-emerald-400 text-xs">
                          {v.key}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-zinc-500 text-xs">
                          {revealedValues.get(v.id) || "••••••••"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] truncate">
                        {v.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                        {new Date(v.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRevealVariable(v.id)}
                            className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-2 py-1.5 rounded-lg transition cursor-pointer"
                            title={
                              revealedValues.has(v.id) ? "Hide" : "Reveal"
                            }
                          >
                            {revealedValues.has(v.id) ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleCopyVariable(v.id)}
                            className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-2 py-1.5 rounded-lg transition cursor-pointer"
                            title="Copy"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingVar(v);
                              setFormKey(v.key);
                              setFormValue("");
                              setFormDescription(v.description || "");
                              setFormShowValue(false);
                              setShowAddModal(true);
                            }}
                            className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-2 py-1.5 rounded-lg transition cursor-pointer"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(v);
                              setDeleteConfirm("");
                            }}
                            className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-zinc-200 dark:border-zinc-700/60 px-2 py-1.5 rounded-lg transition cursor-pointer"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {filteredVariables.map((v) => (
                <div
                  key={v.id}
                  className={`p-4 space-y-2 ${
                    selected.has(v.id) ? "bg-blue-50/50 dark:bg-zinc-800/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(v.id)}
                        onChange={() => toggleSelect(v.id)}
                        className="rounded border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        {v.key}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleRevealVariable(v.id)}
                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleCopyVariable(v.id)}
                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setEditingVar(v);
                          setFormKey(v.key);
                          setFormValue("");
                          setFormDescription(v.description || "");
                          setFormShowValue(false);
                          setShowAddModal(true);
                        }}
                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(v);
                          setDeleteConfirm("");
                        }}
                        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="font-mono text-zinc-500 text-xs">
                    {revealedValues.get(v.id) || "••••••••"}
                  </div>
                  {v.description && (
                    <p className="text-zinc-500 text-xs">{v.description}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {editingVar ? "Edit Variable" : "Add Variable"}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingVar(null);
                  resetForm();
                  resetRows();
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                &times;
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              {editingVar ? (
                <>
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">
                      Key
                    </label>
                    <input
                      type="text"
                      value={formKey}
                      disabled
                      className="w-full bg-slate-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">
                      Value
                    </label>
                    <div className="relative">
                      <input
                        type={formShowValue ? "text" : "password"}
                        value={formValue}
                        onChange={(e) => setFormValue(e.target.value)}
                        placeholder="Leave empty to keep current"
                        className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 pr-20 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition font-mono"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          onClick={() => setFormShowValue(!formShowValue)}
                          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs px-2 py-1 rounded transition cursor-pointer font-medium"
                        >
                          {formShowValue ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Optional description..."
                      className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {rowsValid.length} variable{rowsValid.length !== 1 ? "s" : ""}
                      </span>
                      {existingCount > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          {existingCount} already exist
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setRows([emptyRow()])}
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                    >
                      Clear all
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500">
                    Paste multi-line .env content into any Key field to auto-create rows.
                  </p>

                  <div className="space-y-2">
                    {rows.map((row) => {
                      const isExisting = existingKeySet.has(row.key.trim());
                      return (
                        <div
                          key={row.id}
                          className={`flex gap-2 items-start p-2 rounded-xl border ${
                            isExisting
                              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30"
                              : row.key.trim()
                                ? "bg-slate-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700/50"
                                : "bg-slate-50/50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          <input
                            type="text"
                            value={row.key}
                            onChange={(e) =>
                              updateRow(row.id, "key", e.target.value)
                            }
                            onPaste={(e) => handlePasteOnKeyInput(e, row.id)}
                            placeholder="KEY"
                            className={`w-[160px] shrink-0 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg text-xs font-mono px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-700 ${
                              isExisting ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400 font-medium"
                            }`}
                          />
                          <span className="text-zinc-400 shrink-0 py-1.5 text-xs">=</span>
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) =>
                              updateRow(row.id, "value", e.target.value)
                            }
                            placeholder="value"
                            className="flex-1 min-w-0 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg text-xs font-mono px-2.5 py-1.5 text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                          />
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) =>
                              updateRow(
                                row.id,
                                "description",
                                e.target.value
                              )
                            }
                            placeholder="desc"
                            className="w-[100px] shrink-0 bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg text-xs px-2.5 py-1.5 text-zinc-600 dark:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-700"
                          />
                          {isExisting && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-500 uppercase tracking-wider py-1.5 px-1 shrink-0 font-medium">
                              exists
                            </span>
                          )}
                          <button
                            onClick={() => removeRow(row.id)}
                            className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 shrink-0 transition cursor-pointer"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-white transition cursor-pointer font-medium"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    Add row
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingVar(null);
                  resetForm();
                  resetRows();
                }}
                className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              {editingVar ? (
                <button
                  onClick={handleEditSave}
                  disabled={formLoading}
                  className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {formLoading ? "Saving..." : "Update"}
                </button>
              ) : (
                <button
                  onClick={handleBulkSave}
                  disabled={formLoading || newCount === 0}
                  className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {formLoading
                    ? "Saving..."
                    : `Save ${newCount} Variable${newCount !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Delete Variable
              </h2>
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Delete variable{" "}
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {deleteTarget.key}
                </span>
                ?
              </p>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">
                  Type DELETE to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirm === "DELETE" ? "DELETE" : ""}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }}
                className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVariable}
                disabled={deleting || deleteConfirm !== "DELETE"}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition cursor-pointer shadow-sm"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
