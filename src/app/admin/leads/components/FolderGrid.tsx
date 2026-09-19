"use client";
import { useState } from "react";
import type { LeadFolder } from "../types";

interface FolderGridProps {
  folders: LeadFolder[];
  onNavigate: (folder: LeadFolder) => void;
  onEdit?: (folder: LeadFolder) => void;
  onDelete?: (folder: LeadFolder) => void;
  onDropFile?: (fileId: string, folderId: string) => void;
  deleting: string | null;
}

export default function FolderGrid({ folders, onNavigate, onEdit, onDelete, onDropFile, deleting }: FolderGridProps) {
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  if (folders.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Folders</h3>
        <span className="text-[11px] text-zinc-400 font-medium">Drag any file and drop here to move</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {folders.map((folder) => {
          const isDragOver = dragOverFolderId === folder.id;
          return (
            <div
              key={folder.id}
              onClick={() => onNavigate(folder)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverFolderId !== folder.id) setDragOverFolderId(folder.id);
              }}
              onDragLeave={() => {
                if (dragOverFolderId === folder.id) setDragOverFolderId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverFolderId(null);
                const fileId = e.dataTransfer.getData("text/plain");
                if (fileId && onDropFile) {
                  onDropFile(fileId, folder.id);
                }
              }}
              className={`group bg-white dark:bg-zinc-900/50 border rounded-2xl p-4 cursor-pointer transition-all shadow-sm relative ${
                isDragOver
                  ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-50/80 dark:bg-blue-950/50 scale-[1.02]"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/30"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: `${folder.color || "#71717a"}20` }}
                >
                  <svg className="w-6 h-6" style={{ color: folder.color || "#71717a" }} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                  </svg>
                </div>
                {(onEdit || onDelete) && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                      <button onClick={(e) => { e.stopPropagation(); onEdit(folder); }} className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(folder); }} disabled={deleting === folder.id} className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition cursor-pointer disabled:opacity-40">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white truncate mb-1">{folder.name}</p>
              <p className="text-xs text-zinc-500">{folder._count.files} files, {folder._count.children} folders</p>
              {isDragOver && (
                <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 rounded-2xl flex items-center justify-center backdrop-blur-2xs">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900 px-3 py-1 rounded-full shadow-md">
                    Drop to move into {folder.name}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
