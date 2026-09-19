"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";

interface Environment {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: { variables: number };
}

interface EnvProject {
  id: string;
  name: string;
  description: string | null;
  environments: Environment[];
  createdAt: string;
  updatedAt: string;
}

export default function EnvProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [project, setProject] = useState<EnvProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<Environment | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchProject = useCallback(() => {
    let cancelled = false;
    fetch(`/api/admin/env/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setProject(data.project || null);
      })
      .catch(() => {
        if (!cancelled) setToast({ type: "error", message: "Failed to load project" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => { return fetchProject(); }, [fetchProject]);

  async function handleAddEnvironment() {
    if (!addName.trim()) {
      setToast({ type: "error", message: "Environment name is required" });
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/env/environments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: addName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setToast({ type: "success", message: "Environment created" });
      setShowAddModal(false);
      setAddName("");
      fetchProject();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setAddLoading(false);
    }
  }

  async function handleEditEnvironment() {
    if (!editTarget || !editName.trim()) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/env/environments/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setToast({ type: "success", message: "Environment renamed" });
      setEditTarget(null);
      fetchProject();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteEnvironment() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/env/environments/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setToast({ type: "success", message: "Environment deleted" });
      setDeleteTarget(null);
      setDeleteConfirm("");
      fetchProject();
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed" });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6">
        <Breadcrumbs items={[{ label: "ENV Manager", href: "/admin/env" }, { label: "Not Found" }]} />
        <div className="text-center py-20">
          <p className="text-zinc-600">Project not found</p>
          <Link href="/admin/env" className="mt-4 inline-block text-sm text-zinc-400 hover:text-white transition">
            Back to projects
          </Link>
        </div>
      </div>
    );
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


      <Breadcrumbs items={[{ label: "ENV Manager", href: "/admin/env" }, { label: project.name }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{project.name}</h1>
          {project.description && <p className="text-zinc-500 text-sm">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditTarget(project as unknown as Environment); setEditName(project.name); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl transition cursor-pointer shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => { setDeleteTarget(project as unknown as Environment); setDeleteConfirm(""); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-xl transition cursor-pointer shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Environments</h2>
        <button
          onClick={() => { setAddName(""); setShowAddModal(true); }}
          className="btn-primary gap-2 px-4 py-2.5 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Environment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {project.environments.map((env) => (
          <Link
            key={env.id}
            href={`/admin/env/${projectId}/${env.id}`}
            className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-600 transition group relative shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-700/50 border border-zinc-200 dark:border-transparent flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setEditTarget(env);
                    setEditName(env.name);
                  }}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget(env);
                    setDeleteConfirm("");
                  }}
                  className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
            <h3 className="text-zinc-900 dark:text-white font-medium mb-1 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition">{env.name}</h3>
            <div className="flex items-center gap-1 text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              {env._count.variables} variable{env._count.variables !== 1 ? "s" : ""}
            </div>
          </Link>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Add Environment</h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Environment Name *</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. QA, UAT, Production"
                  className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddEnvironment(); }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleAddEnvironment} disabled={addLoading} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {addLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Rename Environment</h2>
              <button onClick={() => setEditTarget(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Environment Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition"
                  onKeyDown={(e) => { if (e.key === "Enter") handleEditEnvironment(); }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleEditEnvironment} disabled={editLoading} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {editLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Delete Environment</h2>
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition text-xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Are you sure you want to delete <span className="font-semibold text-zinc-900 dark:text-white">{deleteTarget.name}</span>?
                All variables in this environment will be deleted.
              </p>
              <div>
                <label className="text-zinc-600 dark:text-zinc-400 block mb-1 text-sm font-medium">Type DELETE to confirm:</label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-zinc-700 transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
              <button onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); }} className="px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition cursor-pointer">Cancel</button>
              <button
                onClick={handleDeleteEnvironment}
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
