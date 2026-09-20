"use client";
import type { LeadFile } from "../types";

interface FileListProps {
  files: LeadFile[];
  onClick: (file: LeadFile) => void;
  onEdit?: (file: LeadFile) => void;
  onMove?: (file: LeadFile) => void;
  onDelete?: (file: LeadFile) => void;
  deleting: string | null;
}

export default function FileList({ files, onClick, onEdit, onMove, onDelete, deleting }: FileListProps) {
  if (files.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Files</h3>
        <span className="text-[11px] text-zinc-400 font-medium">Drag any file to a folder above to move it</span>
      </div>
      <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-transparent">
              <th className="text-left px-6 py-3 font-medium text-zinc-600 dark:text-zinc-500">Name</th>
              <th className="text-left px-6 py-3 font-medium text-zinc-600 dark:text-zinc-500">Tabs</th>
              <th className="text-left px-6 py-3 font-medium text-zinc-600 dark:text-zinc-500">Rows</th>
              <th className="text-left px-6 py-3 font-medium text-zinc-600 dark:text-zinc-500">Created</th>
              <th className="text-right px-6 py-3 font-medium text-zinc-600 dark:text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {files.map((file) => {
              const totalLeads = file.tabs.reduce((sum, tab) => sum + tab._count.leads, 0);
              const isGoogleSheet = file.description?.toLowerCase().includes("google sheet");
              return (
                <tr
                  key={file.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", file.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onClick(file)}
                  className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/20 transition-colors cursor-pointer group/row"
                  title="Click to open or drag into a folder"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* Drag Handle indicator */}
                      <div className="text-zinc-300 dark:text-zinc-700 group-hover/row:text-zinc-500 dark:group-hover/row:text-zinc-400 cursor-grab active:cursor-grabbing transition-colors -ml-1">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="8" cy="6" r="1.5" />
                          <circle cx="16" cy="6" r="1.5" />
                          <circle cx="8" cy="12" r="1.5" />
                          <circle cx="16" cy="12" r="1.5" />
                          <circle cx="8" cy="18" r="1.5" />
                          <circle cx="16" cy="18" r="1.5" />
                        </svg>
                      </div>

                      {isGoogleSheet ? (
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                      ) : (
                        <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-900 dark:text-white block">{file.name}</span>
                          {isGoogleSheet && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Live Google Sheet
                            </span>
                          )}
                        </div>
                        {file.description && <span className="text-xs text-zinc-500">{file.description}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{file.tabs.length} tabs</td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{totalLeads} leads</td>
                  <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                    {new Date(file.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={(e) => { e.stopPropagation(); onClick(file); }} className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">
                        Open
                      </button>
                      {onMove && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onMove(file); }}
                          className="text-zinc-700 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Move to another folder"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-.75m-6-6l6-6m0 0v5.25m0-5.25H11.25" />
                          </svg>
                          Move
                        </button>
                      )}
                      {onEdit && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit(file); }} className="text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer">
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(file); }} disabled={deleting === file.id} className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 text-xs bg-slate-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/50 border border-zinc-200 dark:border-zinc-700/60 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-40">
                          {deleting === file.id ? "..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
