"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface FormProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  useDefaultSchema: boolean;
  isActive: boolean;
  createdAt: string;
  schema: { fields: any[] } | null;
  apiKey: { apiKey: string; isActive: boolean; lastUsed: string | null } | null;
  _count: { submissions: number };
}

export default function FormBridgePage() {
  const [projects, setProjects] = useState<FormProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/forms/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/forms/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewProject({ name: "", description: "" });
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setConfirmDelete({ id, name });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/admin/forms/projects/${confirmDelete.id}`, { method: "DELETE" });
      if (res.ok) fetchProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setConfirmDelete(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.257a4.5 4.5 0 00-6.364-6.364L4.5 7.5l4.5 4.5-1.757 1.757a4.5 4.5 0 006.364 6.364l4.5-4.5a4.5 4.5 0 00-.324-.693z" />
            </svg>
            FormBridge
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Multi-site form aggregation platform — collect submissions from all your websites in one place
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer shadow-sm"
        >
          + New Project
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 font-medium">Total Projects</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{projects.length}</p>
        </div>
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 font-medium">Total Submissions</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
            {projects.reduce((sum, p) => sum + p._count.submissions, 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 font-medium">Active Projects</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">
            {projects.filter((p) => p.isActive).length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
          <p className="text-xs text-zinc-500 font-medium">Custom Schemas</p>
          <p className="text-2xl font-bold text-purple-500 mt-1">
            {projects.filter((p) => !p.useDefaultSchema).length}
          </p>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No projects yet</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-4">Create your first form project to start collecting submissions</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative bg-white dark:bg-[#121216] border border-zinc-200/90 dark:border-zinc-800/80 rounded-2xl p-5 hover:border-blue-500/40 dark:hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              {/* Decorative top accent line */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-75 group-hover:opacity-100 transition-opacity" />

              <div>
                {/* Header with icon, title, slug, and active status pill */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-sm shadow-xs">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/forms/${project.id}`}
                        className="text-base font-bold text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition truncate block tracking-tight"
                      >
                        {project.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">/{project.slug}</span>
                        {project.description && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="text-xs text-zinc-500 truncate max-w-[150px]">{project.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                        project.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${project.isActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
                      {project.isActive ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>

                {/* Stats Cards Row */}
                <div className="grid grid-cols-2 gap-2 mb-4 p-2.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-100 dark:border-zinc-800/60">
                  <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400">Submissions</div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-white leading-none mt-0.5">{project._count.submissions}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-1 border-l border-zinc-200/70 dark:border-zinc-800">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-zinc-400">Schema</div>
                      <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-none mt-0.5 truncate">
                        {project.useDefaultSchema ? "Default" : `${(project.schema?.fields || []).length} Fields`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Endpoint URL Box */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    <span>Webhook Endpoint</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 font-mono font-bold">POST</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-1.5">
                    <code className="flex-1 text-[11px] text-zinc-700 dark:text-zinc-300 truncate font-mono px-2 select-all">
                      /api/forms/{project.slug}/submit
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${window.location.origin}/api/forms/${project.slug}/submit`)}
                      className="p-1.5 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition cursor-pointer shrink-0 shadow-2xs"
                      title="Copy full endpoint URL"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* API Key Box */}
                {project.apiKey && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      <span>API Key</span>
                      <span className="text-[9px] text-zinc-400 font-mono">x-api-key</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/90 dark:border-zinc-800 rounded-xl p-1.5">
                      <code className="flex-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-mono px-2">
                        {project.apiKey.apiKey.substring(0, 10)}••••••••••••
                      </code>
                      <button
                        onClick={() => copyToClipboard(project.apiKey!.apiKey)}
                        className="p-1.5 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition cursor-pointer shrink-0 shadow-2xs"
                        title="Copy API key"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 mt-1">
                <Link
                  href={`/admin/forms/${project.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                >
                  <span>View Details</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <button
                  onClick={() => handleDelete(project.id, project.name)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900/40 transition cursor-pointer"
                  title="Delete Form Project"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="My Website Contact Form"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contact form for my main website"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProject.name.trim()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white text-center mb-2">Delete Project?</h2>
            <p className="text-sm text-zinc-500 text-center mb-6">
              Are you sure you want to delete <strong className="text-zinc-700 dark:text-zinc-300">"{confirmDelete.name}"</strong>? This will permanently remove all submissions and data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAction}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
