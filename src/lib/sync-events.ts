// In-memory Server-Sent Event (SSE) hub for real-time spreadsheet collaboration

export type SyncEventType =
  | "cell_edit"
  | "styling"
  | "lead_added"
  | "lead_deleted"
  | "columns_changed"
  | "tabs_changed"
  | "leads_imported"
  | "file_updated"
  | "file_created"
  | "file_deleted"
  | "folder_created"
  | "folder_deleted"
  | "folder_updated"
  | "explorer_refresh"
  | "workspace_sync"
  | "ping"
  | "connected";

export interface SyncEventPayload {
  type: SyncEventType;
  tabId?: string;
  fileId?: string;
  senderId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

type SyncListener = (event: SyncEventPayload) => void;

export const GLOBAL_WORKSPACE_TARGET = "__global_leads_workspace__";

// Global singleton to survive hot reloading in development
const globalForSync = globalThis as unknown as {
  syncListeners?: Map<string, Set<SyncListener>>;
  fileToTabs?: Map<string, Set<string>>;
};

const listeners = globalForSync.syncListeners ?? new Map<string, Set<SyncListener>>();
const fileTabsMap = globalForSync.fileToTabs ?? new Map<string, Set<string>>();

if (process.env.NODE_ENV !== "production") {
  globalForSync.syncListeners = listeners;
  globalForSync.fileToTabs = fileTabsMap;
}

export function registerTabToFile(tabId: string, fileId: string) {
  if (!tabId || !fileId) return;
  if (!fileTabsMap.has(fileId)) {
    fileTabsMap.set(fileId, new Set());
  }
  fileTabsMap.get(fileId)!.add(tabId);
}

export function subscribeToTarget(targetId: string, listener: SyncListener): () => void {
  if (!listeners.has(targetId)) {
    listeners.set(targetId, new Set());
  }
  const set = listeners.get(targetId)!;
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(targetId);
    }
  };
}

export function subscribeToTab(tabId: string, listener: SyncListener): () => void {
  return subscribeToTarget(tabId, listener);
}

export function subscribeToFile(fileId: string, listener: SyncListener): () => void {
  return subscribeToTarget(fileId, listener);
}

export function subscribeToGlobal(listener: SyncListener): () => void {
  return subscribeToTarget(GLOBAL_WORKSPACE_TARGET, listener);
}

export function broadcastToTab(
  tabId: string,
  type: SyncEventType,
  data?: Record<string, unknown>,
  senderId?: string
) {
  const set = listeners.get(tabId);
  const payload: SyncEventPayload = {
    type,
    tabId,
    senderId,
    timestamp: Date.now(),
    data,
  };

  if (set && set.size > 0) {
    for (const listener of set) {
      try {
        listener(payload);
      } catch (err) {
        console.error("Error dispatching sync event to tab:", err);
      }
    }
  }
}

export function broadcastToFile(
  fileId: string,
  type: SyncEventType,
  data?: Record<string, unknown>,
  senderId?: string
) {
  const payload: SyncEventPayload = {
    type,
    fileId,
    senderId,
    timestamp: Date.now(),
    data,
  };

  // 1. Notify listeners directly on fileId
  const fileSet = listeners.get(fileId);
  if (fileSet && fileSet.size > 0) {
    for (const listener of fileSet) {
      try {
        listener(payload);
      } catch (err) {
        console.error("Error dispatching sync event to file:", err);
      }
    }
  }

  // 2. Also notify all open tabs belonging to this file
  const tabs = fileTabsMap.get(fileId);
  if (tabs && tabs.size > 0) {
    for (const tabId of tabs) {
      const tabSet = listeners.get(tabId);
      if (tabSet && tabSet.size > 0) {
        for (const listener of tabSet) {
          try {
            listener({ ...payload, tabId });
          } catch (err) {
            console.error("Error dispatching file sync event to tab:", err);
          }
        }
      }
    }
  }
}

export function broadcastGlobal(
  type: SyncEventType,
  data?: Record<string, unknown>,
  senderId?: string
) {
  const payload: SyncEventPayload = {
    type,
    senderId,
    timestamp: Date.now(),
    data,
  };

  // 1. Notify global workspace listeners
  const globalSet = listeners.get(GLOBAL_WORKSPACE_TARGET);
  if (globalSet && globalSet.size > 0) {
    for (const listener of globalSet) {
      try {
        listener(payload);
      } catch (err) {
        console.error("Error dispatching global sync event:", err);
      }
    }
  }

  // 2. If data has fileId, also broadcast to that file & its tabs
  if (data?.fileId && typeof data.fileId === "string") {
    broadcastToFile(data.fileId, type, data, senderId);
  }
}
