"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type { LeadTab } from "../types";

interface TabBarProps {
  tabs: LeadTab[];
  selectedTab: LeadTab | null;
  onSelectTab: (tab: LeadTab) => void;
  onCreateTab: () => void;
  onDuplicateTab?: (tabId: string) => void;
  onEditTab: (tab: LeadTab) => void;
  onDeleteTab: (tab: LeadTab) => void;
  canWrite?: boolean;
}

export default function TabBar({
  tabs,
  selectedTab,
  onSelectTab,
  onCreateTab,
  onDuplicateTab,
  onEditTab,
  onDeleteTab,
  canWrite = true,
}: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: LeadTab) => {
    e.preventDefault();
    setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
  }, []);

  const handleRenameStart = useCallback((tab: LeadTab) => {
    setRenamingId(tab.id);
    setRenameValue(tab.name);
    setContextMenu(null);
  }, []);

  const handleRenameSubmit = useCallback((tabId: string) => {
    const currentTab = tabsRef.current.find((t) => t.id === tabId);
    if (!currentTab) {
      setRenamingId(null);
      return;
    }
    if (!renameValue.trim() || renameValue === currentTab.name) {
      setRenamingId(null);
      return;
    }
    const updatedTab = { ...currentTab, name: renameValue.trim() };
    onEditTab(updatedTab);
    setRenamingId(null);
  }, [renameValue, onEditTab]);

  const handleDeleteFromContext = useCallback(() => {
    if (contextMenu) {
      const tab = tabsRef.current.find((t) => t.id === contextMenu.tabId);
      if (tab) onDeleteTab(tab);
      setContextMenu(null);
    }
  }, [contextMenu, onDeleteTab]);

  return (
    <>
      <div className="flex items-center border-t border-zinc-200 dark:border-zinc-800 bg-slate-100 dark:bg-[#0d0d10] px-2 py-0 overflow-x-auto scrollbar-thin shrink-0 select-none">
        {/* Add Tab Button */}
        {canWrite && (
          <button
            onClick={onCreateTab}
            className="p-1.5 mr-2 my-1 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition cursor-pointer shrink-0"
            title="Add Sheet"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        )}

        {/* Sheet Tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = selectedTab?.id === tab.id;
            return (
              <div
                key={tab.id}
                onContextMenu={(e) => canWrite && handleContextMenu(e, tab)}
                onClick={() => onSelectTab(tab)}
                className={`px-4 py-2 text-xs transition cursor-pointer flex items-center gap-2 group shrink-0 border-x ${
                  isActive
                    ? "bg-white dark:bg-[#18181b] border-t-2 border-emerald-500 border-x-zinc-200 dark:border-x-zinc-700 text-zinc-900 dark:text-white font-medium shadow-xs"
                    : "bg-slate-200/60 dark:bg-[#101014] hover:bg-slate-200 dark:hover:bg-[#141418] border-t-2 border-transparent border-x-zinc-200/80 dark:border-x-zinc-800/80 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {renamingId === tab.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(tab.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRenameSubmit(tab.id);
                      }
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-b border-current outline-none text-xs w-20 px-0 py-0 text-zinc-900 dark:text-white font-mono"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleRenameStart(tab);
                    }}
                    className="truncate max-w-[150px]"
                  >
                    {tab.name}
                  </span>
                )}
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  {tab._count?.leads ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700/80 rounded-lg shadow-2xl py-1.5 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: Math.max(10, contextMenu.y - 120) }}
          >
            <button
              onClick={() => {
                const tab = tabs.find((t) => t.id === contextMenu.tabId);
                if (tab) handleRenameStart(tab);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
            >
              Rename
            </button>
            {onDuplicateTab && (
              <button
                onClick={() => {
                  onDuplicateTab(contextMenu.tabId);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              >
                Duplicate Sheet
              </button>
            )}
            <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
            <button
              onClick={handleDeleteFromContext}
              className="w-full text-left px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-zinc-800/80 hover:text-red-700 dark:hover:text-red-300 transition cursor-pointer"
            >
              Delete Sheet
            </button>
          </div>
        </>
      )}
    </>
  );
}
