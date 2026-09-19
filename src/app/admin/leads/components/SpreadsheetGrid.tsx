"use client";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  DataEditor,
  DataEditorRef,
  GridCell,
  GridCellKind,
  GridColumn,
  Item,
  EditableGridCell,
  GridSelection,
  CompactSelection,
  CustomCell,
  GridMouseCellEventArgs,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { Lead, LeadColumn } from "../types";
import type { SyncStatus } from "../hooks/useLeadsStore";
import ConfirmModal from "./modals/ConfirmModal";
import ChartsModal from "./modals/ChartsModal";
import EditColumnModal from "./modals/EditColumnModal";
import ViewLeadModal from "./modals/ViewLeadModal";
import SheetCommentsSidebar from "./SheetCommentsSidebar";
import { dropdownCellRenderer, DropdownCellData, DropdownOption, getOptionColor } from "./DropdownCellRenderer";
import { STATUS_OPTIONS, BUILT_IN_COLUMNS } from "../constants";
import { useTheme } from "@/components/ThemeProvider";

interface SpreadsheetGridProps {
  leads: Lead[];
  columns: LeadColumn[];
  onCellEdit: (leadId: string, columnKey: string, value: string) => Promise<void>;
  onDeleteLead: (id: string) => void;
  onDeleteLeads: (ids: string[]) => void;
  onDuplicateLead?: (lead: Lead) => void;
  onSelectLead?: (lead: Lead) => void;
  onEditLead?: (lead: Lead) => void;
  onLeadUpdated?: (lead: Lead) => void;
  onRenameColumn: (colId: string, newName: string) => Promise<void>;

  onEditColumn?: (col: LeadColumn) => void;
  onDeleteColumn: (colId: string) => void;
  onRefresh: () => void;
  onAddRow: () => Promise<void>;
  onAddColumn?: () => void;
  sortField: string | null;
  sortOrder: "asc" | "desc";
  onSort: (field: string) => void;
  syncStatus: SyncStatus;
  loading: boolean;
  canWrite?: boolean;
  sheetName?: string;
  tabId?: string;
  fileId?: string;
  initialStyling?: Record<string, unknown>;
}


interface EditHistoryItem {
  leadId: string;
  columnKey: string;
  prevValue: string;
  nextValue: string;
}

export interface CellStyle {
  bg?: string;
  textColor?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
}

interface MergedRange {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

type PersistedMergedRange = MergedRange | [number, number];
type MergedRanges = Record<string, MergedRange>;

interface MergedCellOverlay {
  key: string;
  range: MergedRange;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  bg: string;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
  selected: boolean;
}

const COLOR_SWATCHES = [
  ["#ffffff", "#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa", "#71717a", "#3f3f46", "#27272a", "#18181b", "#09090b"],
  ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a"],
  ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b"],
  ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f"],
  ["#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#7e22ce", "#6b21a8", "#581c87"],
  ["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337"],
];

const ZOOM_PRESETS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5, 2.0];
type DensityMode = "compact" | "standard" | "comfortable" | "spacious";

function getColumnLetter(index: number): string {
  let label = "";
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function getSortIndicator(key: string, sortField: string | null, sortOrder: "asc" | "desc"): string {
  if (sortField !== key) return "";
  return sortOrder === "asc" ? " ▲" : " ▼";
}

function getMergeKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function rangesOverlap(a: MergedRange, b: MergedRange): boolean {
  return a.startCol <= b.endCol && a.endCol >= b.startCol && a.startRow <= b.endRow && a.endRow >= b.startRow;
}

function normalizeMergedRanges(input: unknown): MergedRanges {
  if (!input || typeof input !== "object") return {};
  const normalized: MergedRanges = {};

  for (const [key, value] of Object.entries(input as Record<string, PersistedMergedRange>)) {
    const [, keyRow] = key.split(":").map(Number);
    const startRow = Number.isFinite(keyRow) ? keyRow : 0;

    if (Array.isArray(value)) {
      const [legacyStartCol, legacyEndCol] = value;
      if (Number.isFinite(legacyStartCol) && Number.isFinite(legacyEndCol)) {
        const range: MergedRange = {
          startCol: Math.min(legacyStartCol, legacyEndCol),
          startRow,
          endCol: Math.max(legacyStartCol, legacyEndCol),
          endRow: startRow,
        };
        normalized[getMergeKey(range.startCol, range.startRow)] = range;
      }
      continue;
    }

    if (value && typeof value === "object") {
      const candidate = value as Partial<MergedRange>;
      if (
        Number.isFinite(candidate.startCol) &&
        Number.isFinite(candidate.startRow) &&
        Number.isFinite(candidate.endCol) &&
        Number.isFinite(candidate.endRow)
      ) {
        const range: MergedRange = {
          startCol: Math.min(candidate.startCol!, candidate.endCol!),
          startRow: Math.min(candidate.startRow!, candidate.endRow!),
          endCol: Math.max(candidate.startCol!, candidate.endCol!),
          endRow: Math.max(candidate.startRow!, candidate.endRow!),
        };
        normalized[getMergeKey(range.startCol, range.startRow)] = range;
      }
    }
  }

  return normalized;
}

export default function SpreadsheetGrid({
  leads,
  columns,
  onCellEdit,
  onDeleteLead,
  onDeleteLeads,
  onDuplicateLead,
  onSelectLead,
  onEditLead,
  onRenameColumn,
  onEditColumn,
  onDeleteColumn,
  onRefresh,
  onAddRow,
  onAddColumn,
  sortField,
  sortOrder,
  onSort,
  syncStatus,
  loading,
  canWrite = true,
  sheetName = "Sheet 1",
  tabId,
  fileId,
  initialStyling,
  onLeadUpdated,
}: SpreadsheetGridProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const gridRef = useRef<DataEditorRef>(null);
  const [cols, setCols] = useState<GridColumn[]>([]);
  const [headerMenu, setHeaderMenu] = useState<{ colKey: string; colId: string; x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowIndex: number; x: number; y: number } | null>(null);
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null);
  const [configuringCol, setConfiguringCol] = useState<LeadColumn | null>(null);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [commentsSidebarOpen, setCommentsSidebarOpen] = useState(false);

  // Zoom & Density state
  const [zoom, setZoom] = useState<number>(1.0);
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState(false);
  const [density, setDensity] = useState<DensityMode>("compact");
  const [densityDropdownOpen, setDensityDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Charts state
  const [chartsOpen, setChartsOpen] = useState(false);

  // Cell, Row, and Column Level Color, Style & Merge State
  const [cellFormatting, setCellFormatting] = useState<Record<string, CellStyle>>({});
  const [columnColors, setColumnColors] = useState<Record<string, string>>({});
  const [rowColors, setRowColors] = useState<Record<string, string>>({});
  const [mergedRanges, setMergedRanges] = useState<MergedRanges>({});
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [visibleRegionTick, setVisibleRegionTick] = useState(0);
  const [editingMergedKey, setEditingMergedKey] = useState<string | null>(null);
  const [editingMergedValue, setEditingMergedValue] = useState<string>("");

  // Active floating Excel dropdown menu state (Opens on exactly 1 click)
  const [activeDropdown, setActiveDropdown] = useState<{
    cell: Item;
    leadId: string;
    colKey: string;
    options: DropdownOption[];
    value: string;
    rect: { left: number; top: number; width: number; height: number; direction: "down" | "up" };
  } | null>(null);

  useEffect(() => {
    if (!activeDropdown) return;
    const handleDown = (e: MouseEvent) => {
      const menu = document.getElementById("excel-active-dropdown-menu");
      if (menu && menu.contains(e.target as Node)) return;
      setActiveDropdown(null);
    };
    const handleScroll = () => {
      setActiveDropdown(null);
    };
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [activeDropdown]);

  // Load persisted styling from database or localStorage on tab switch / refresh
  useEffect(() => {
    if (!tabId && !sheetName) return;
    const storageKey = `pm_sheet_styling_${tabId || sheetName}`;
    let loaded = false;
    try {
      if (initialStyling) {
        const anyStyling = initialStyling as {
          cellFormatting?: Record<string, CellStyle>;
          columnColors?: Record<string, string>;
          rowColors?: Record<string, string>;
          mergedRanges?: unknown;
        };
        if (anyStyling.cellFormatting) setCellFormatting(anyStyling.cellFormatting);
        if (anyStyling.columnColors) setColumnColors(anyStyling.columnColors);
        if (anyStyling.rowColors) setRowColors(anyStyling.rowColors);
        if (anyStyling.mergedRanges) setMergedRanges(normalizeMergedRanges(anyStyling.mergedRanges));
        loaded = true;
      }
      if (!loaded && typeof window !== "undefined") {
        const local = localStorage.getItem(storageKey);
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.cellFormatting) setCellFormatting(parsed.cellFormatting);
          if (parsed.columnColors) setColumnColors(parsed.columnColors);
          if (parsed.rowColors) setRowColors(parsed.rowColors);
          if (parsed.mergedRanges) setMergedRanges(normalizeMergedRanges(parsed.mergedRanges));
        }
      }
    } catch (e) {
      console.error("Error restoring sheet styling:", e);
    }
  }, [tabId, sheetName, initialStyling]);

  // Real-Time Live Collaboration (Google Sheets style)
  useEffect(() => {
    if (!tabId || typeof window === "undefined") return;

    // 1. Cross-tab instant synchronization
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`pm_sheet_collab_${tabId}`);
      bc.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === "styling" && msg.styling) {
          const s = msg.styling;
          if (s.cellFormatting) setCellFormatting(s.cellFormatting);
          if (s.columnColors) setColumnColors(s.columnColors);
          if (s.rowColors) setRowColors(s.rowColors);
          if (s.mergedRanges) setMergedRanges(normalizeMergedRanges(s.mergedRanges));
        }
      };
    } catch {}

    // 2. Server-Sent Events (SSE) for remote real-time collaboration
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/admin/leads/sync?tabId=${tabId}`);
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type === "styling" && parsed.data?.styling) {
            const s = parsed.data.styling as {
              cellFormatting?: Record<string, CellStyle>;
              columnColors?: Record<string, string>;
              rowColors?: Record<string, string>;
              mergedRanges?: unknown;
            };
            if (s.cellFormatting) setCellFormatting(s.cellFormatting);
            if (s.columnColors) setColumnColors(s.columnColors);
            if (s.rowColors) setRowColors(s.rowColors);
            if (s.mergedRanges) setMergedRanges(normalizeMergedRanges(s.mergedRanges));
          }
        } catch {}
      };
    } catch (err) {
      console.error("SSE connection error in SpreadsheetGrid:", err);
    }

    return () => {
      if (bc) bc.close();
      if (eventSource) eventSource.close();
    };
  }, [tabId]);

  // Persist styling helper (Cloud Save + Local Cache + Real-time Broadcast)
  const persistStyling = useCallback(
    (
      newCellFormatting?: Record<string, CellStyle>,
      newColumnColors?: Record<string, string>,
      newRowColors?: Record<string, string>,
      newMergedRanges?: MergedRanges
    ) => {
      const targetTabId = tabId;
      const storageKey = `pm_sheet_styling_${targetTabId || sheetName}`;
      const payload = {
        cellFormatting: newCellFormatting ?? cellFormatting,
        columnColors: newColumnColors ?? columnColors,
        rowColors: newRowColors ?? rowColors,
        mergedRanges: newMergedRanges ?? mergedRanges,
      };

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(storageKey, JSON.stringify(payload));

          // Broadcast locally across open browser tabs
          try {
            const bc = new BroadcastChannel(`pm_sheet_collab_${targetTabId}`);
            bc.postMessage({ type: "styling", styling: payload });
            bc.close();
          } catch {}
        }
        if (targetTabId) {
          fetch(`/api/admin/leads/tabs/${targetTabId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ styling: payload }),
          }).catch(() => {});
        }
      } catch (e) {
        console.error("Error persisting styling:", e);
      }
    },
    [tabId, sheetName, cellFormatting, columnColors, rowColors, mergedRanges]
  );



  // Formatting popovers
  const [fillColorPickerOpen, setFillColorPickerOpen] = useState(false);
  const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);
  const [customFillHex, setCustomFillHex] = useState("#1e3a8a");
  const [customTextHex, setCustomTextHex] = useState("#ffffff");

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<EditHistoryItem[]>([]);
  const [redoStack, setRedoStack] = useState<EditHistoryItem[]>([]);

  const [gridSelection, setGridSelection] = useState<GridSelection>({
    rows: CompactSelection.empty(),
    columns: CompactSelection.empty(),
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: "danger" | "warning" | "primary";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Delete",
    confirmVariant: "danger",
    onConfirm: () => {},
  });

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 100, y: 100 });

  useEffect(() => {
    const onPointerMove = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onPointerMove, true);
    window.addEventListener("contextmenu", onPointerMove, true);
    return () => {
      window.removeEventListener("mousemove", onPointerMove, true);
      window.removeEventListener("contextmenu", onPointerMove, true);
    };
  }, []);

  const allColumnKeys: string[] = useMemo(() => {
    if (columns.length > 0) {
      return columns.map((c) => c.name);
    }
    const customKeys = new Set<string>();
    for (const lead of leads) {
      if (lead.customFields && typeof lead.customFields === "object") {
        Object.keys(lead.customFields).forEach((k) => customKeys.add(k));
      }
    }
    if (customKeys.size > 0) {
      return Array.from(customKeys);
    }
    return Array.from({ length: 26 }, (_, i) => getColumnLetter(i));
  }, [columns, leads]);

  const findMergedRangeForCell = useCallback(
    (col: number, row: number): MergedRange | undefined => {
      return Object.values(mergedRanges).find(
        (range) => col >= range.startCol && col <= range.endCol && row >= range.startRow && row <= range.endRow
      );
    },
    [mergedRanges]
  );

  const getAnchorCell = useCallback(
    (cell: Item): Item => {
      const [col, row] = cell;
      const range = findMergedRangeForCell(col, row);
      return range ? [range.startCol, range.startRow] : cell;
    },
    [findMergedRangeForCell]
  );

  // Dynamic Row & Header Heights based on Density & Zoom
  const baseRowHeight = density === "compact" ? 24 : density === "comfortable" ? 36 : density === "spacious" ? 46 : 28;
  const calculatedRowHeight = Math.max(22, Math.round(baseRowHeight * zoom));
  const calculatedHeaderHeight = Math.max(24, Math.round(28 * zoom));
  const calculatedFontSize = Math.max(10, Math.round(12 * zoom));
  const calculatedHeaderFontSize = Math.max(10, Math.round(11 * zoom));

  // Compute selected bounding box
  const selectedRange = useMemo(() => {
    const rows = gridSelection.rows.toArray();
    const selectedCols = gridSelection.columns.toArray();
    const current = gridSelection.current;

    let minCol: number | null = null;
    let maxCol: number | null = null;
    let minRow: number | null = null;
    let maxRow: number | null = null;

    if (current && current.range) {
      minCol = current.range.x;
      maxCol = current.range.x + current.range.width - 1;
      minRow = current.range.y;
      maxRow = current.range.y + current.range.height - 1;
    } else if (current && current.cell) {
      minCol = current.cell[0];
      maxCol = current.cell[0];
      minRow = current.cell[1];
      maxRow = current.cell[1];
    } else if (selectedCols.length > 0 && rows.length > 0) {
      minCol = Math.min(...selectedCols);
      maxCol = Math.max(...selectedCols);
      minRow = Math.min(...rows);
      maxRow = Math.max(...rows);
    } else if (selectedCols.length > 0) {
      minCol = Math.min(...selectedCols);
      maxCol = Math.max(...selectedCols);
      minRow = 0;
      maxRow = Math.max(0, leads.length - 1);
    } else if (rows.length > 0) {
      minCol = 0;
      maxCol = Math.max(0, allColumnKeys.length - 1);
      minRow = Math.min(...rows);
      maxRow = Math.max(...rows);
    } else if (activeCell) {
      minCol = activeCell[0];
      maxCol = activeCell[0];
      minRow = activeCell[1];
      maxRow = activeCell[1];
    }

    if (minCol === null || maxCol === null || minRow === null || maxRow === null) {
      return null;
    }

    const cellCount = (maxCol - minCol + 1) * (maxRow - minRow + 1);
    return {
      minCol,
      maxCol,
      minRow,
      maxRow,
      cellCount,
      isMultiple: cellCount > 1,
    };
  }, [gridSelection, leads.length, allColumnKeys.length, activeCell]);

  const isSelectionMerged = useMemo(() => {
    if (!selectedRange) return false;
    const { minCol, maxCol, minRow, maxRow } = selectedRange;
    const selected = { startCol: minCol, startRow: minRow, endCol: maxCol, endRow: maxRow };
    for (const range of Object.values(mergedRanges)) {
      if (rangesOverlap(range, selected)) return true;
    }
    return false;
  }, [selectedRange, mergedRanges]);

  useEffect(() => {
    const list = columns.length > 0 ? columns.map((c) => c.name) : allColumnKeys;
    const custom: GridColumn[] = list.map((colName, i) => {
      const col = columns[i];
      const typeTag = col?.type === "select" ? " ▾" : "";
      const letter = getColumnLetter(i);
      return {
        title: `${letter}${typeTag}${getSortIndicator(colName, sortField, sortOrder)}`,
        width: Math.round(((col?.width) || 180) * zoom),
        id: colName,
      };
    });
    setCols(custom);
  }, [columns, allColumnKeys, sortField, sortOrder, zoom]);

  // Helper to trigger Glide Data Grid canvas redraw
  const repaintCells = useCallback((cells: { cell: [number, number] }[]) => {
    if (gridRef.current && cells.length > 0) {
      gridRef.current.updateCells(cells);
    }
  }, []);

  // Helper to trigger Glide Data Grid canvas redraw for all visible cells
  const repaintAllCells = useCallback(() => {
    if (gridRef.current && leads.length > 0 && allColumnKeys.length > 0) {
      const allCells: { cell: [number, number] }[] = [];
      for (let r = 0; r < leads.length; r++) {
        for (let c = 0; c < allColumnKeys.length; c++) {
          allCells.push({ cell: [c, r] });
        }
      }
      gridRef.current.updateCells(allCells);
    }
  }, [leads.length, allColumnKeys.length]);

  // When leads, columns, cellFormatting, columnColors, or rowColors change, repaint only visible cells
  useEffect(() => {
    if (gridRef.current && leads.length > 0 && allColumnKeys.length > 0) {
      const t = setTimeout(() => {
        gridRef.current?.updateCells([{ cell: [0, 0] }]);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [leads, columns, cellFormatting, columnColors, rowColors, allColumnKeys.length]);


  // Parse column dropdown options
  const getColumnDropdownOptions = useCallback(
    (colName?: string | null): DropdownOption[] | null => {
      if (!colName || typeof colName !== "string") return null;
      const lowerColName = colName.toLowerCase().trim();
      const col = columns.find(
        (c) => c && typeof c.name === "string" && c.name.toLowerCase().trim() === lowerColName
      );
      if (lowerColName === "status" && (!col || !col.options)) {
        return STATUS_OPTIONS.map((s) => ({
          value: s.value,
          label: s.label,
          color: s.hex,
        }));
      }

      if (col && (col.type === "select" || col.options)) {
        if (col.options) {
          const rawList = col.options.includes(",")
            ? col.options.split(",")
            : col.options.split("\n");
          const parsedOptions: DropdownOption[] = [];
          rawList.forEach((item, idx) => {
            const trimmed = (item || "").trim();
            if (trimmed.length > 0) {
              parsedOptions.push({
                value: trimmed,
                label: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
                color: getOptionColor(trimmed, idx),
              });
            }
          });
          return parsedOptions;
        }
        // Default options if none configured
        return [
          { value: "pending", label: "Pending", color: "#f59e0b" },
          { value: "in_progress", label: "In Progress", color: "#3b82f6" },
          { value: "done", label: "Done", color: "#10b981" },
          { value: "verified", label: "Verified", color: "#14b8a6" },
        ];
      }

      return null;
    },
    [columns]
  );

  // Helper to extract clean cell value without exposing internal DB metadata (UUIDs/timestamps)
  const getLeadCellValue = useCallback((lead: Lead, colKey?: string | null): string => {
    if (!lead || !colKey || typeof colKey !== "string") return "";
    const customFields = (lead.customFields as Record<string, unknown>) || {};
    if (customFields && customFields[colKey] !== undefined && customFields[colKey] !== null) {
      return String(customFields[colKey]);
    }

    const lowerKey = colKey.toLowerCase().trim();

    // Check custom fields case-insensitively
    if (customFields) {
      for (const [k, v] of Object.entries(customFields)) {
        if (k.toLowerCase().trim() === lowerKey && v !== undefined && v !== null) {
          return String(v);
        }
      }
    }

    // Strictly block internal database properties from leaking into user columns
    if (
      lowerKey === "id" ||
      lowerKey === "tabid" ||
      lowerKey === "createdat" ||
      lowerKey === "updatedat" ||
      lowerKey === "customfields"
    ) {
      return "";
    }

    const leadObj = lead as unknown as Record<string, unknown>;
    if (leadObj[colKey] !== undefined && leadObj[colKey] !== null) {
      return String(leadObj[colKey]);
    }

    // Check standard fields case-insensitively
    for (const [k, v] of Object.entries(leadObj)) {
      if (k.toLowerCase().trim() === lowerKey && v !== undefined && v !== null && k !== "id" && k !== "tabId" && k !== "createdAt" && k !== "updatedAt" && k !== "customFields") {
        return String(v);
      }
    }

    return "";
  }, []);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const mergedRange = findMergedRangeForCell(colIndex, rowIndex);
      const isMergedAnchor = Boolean(
        mergedRange && colIndex === mergedRange.startCol && rowIndex === mergedRange.startRow
      );
      const isCoveredMergedCell = Boolean(mergedRange && !isMergedAnchor);
      const valueColIndex = mergedRange ? mergedRange.startCol : colIndex;
      const valueRowIndex = mergedRange ? mergedRange.startRow : rowIndex;
      const rowSpan = mergedRange ? mergedRange.endRow - mergedRange.startRow + 1 : 1;
      const cellSpan: [number, number] | undefined = mergedRange
        ? [mergedRange.startCol, mergedRange.endCol]
        : undefined;

      const lead = leads[valueRowIndex];
      if (!lead) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const colKey = allColumnKeys[valueColIndex];
      if (!colKey) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }

      const cellKey = `${valueColIndex}:${valueRowIndex}`;
      const leadCellKey = `${lead.id}:${colKey}`;

      const style = cellFormatting[cellKey] || cellFormatting[leadCellKey];
      const colColor = columnColors[colKey];
      const rowColor = rowColors[lead.id];
      const bg = style?.bg || rowColor || colColor;
      const textColor = style?.textColor;
      const align = style?.align || "left";

      const val = getLeadCellValue(lead, colKey);

      const themeOverride: Record<string, string | number> = {};
      if (bg) {
        themeOverride.bgCell = bg;
        themeOverride.bgCellMedium = bg;
      }
      if (textColor) {
        themeOverride.textDark = textColor;
        themeOverride.textMedium = textColor;
        themeOverride.textLight = textColor;
        themeOverride.textBubble = textColor;
      }
      if (style?.bold) {
        themeOverride.baseFontStyle = `bold ${calculatedFontSize}px`;
      }


      // Covered cells are part of the anchor merge block and should not edit independently.
      if (isCoveredMergedCell) {
        return {
          kind: GridCellKind.Text,
          data: "",
          displayData: "",
          span: cellSpan,
          allowOverlay: false,
          readonly: true,
          themeOverride: Object.keys(themeOverride).length > 0 ? themeOverride : undefined,
        };
      }

      // Subtle indicator for primary merged cell if no custom background exists
      if (cellSpan && !themeOverride.bgCell) {
        themeOverride.bgCell = isDark ? "#161b26" : "#f0f7ff";
      }
      if (cellSpan && rowSpan > 1) {
        themeOverride.cellVerticalPadding = Math.round((calculatedRowHeight * (rowSpan - 1)) / 2 + 3 * zoom);
      }

      const hasTheme = Object.keys(themeOverride).length > 0;
      const dropdownOptions = getColumnDropdownOptions(colKey);

      if (dropdownOptions && dropdownOptions.length > 0) {
        return {
          kind: GridCellKind.Custom,
          data: {
            kind: "dropdown-cell",
            value: String(val),
            options: dropdownOptions,
            onCommit: (newVal: string) => {
              onCellEdit(lead.id, colKey, newVal);
            },
          } as DropdownCellData,
          span: cellSpan,
          allowOverlay: false,
          readonly: true,
          themeOverride: hasTheme ? themeOverride : undefined,
        } as CustomCell<DropdownCellData>;
      }

      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        span: cellSpan,
        contentAlign: align,
        allowOverlay: Boolean(canWrite),
        readonly: !canWrite,
        themeOverride: hasTheme ? themeOverride : undefined,
      };
    },
    [leads, allColumnKeys, cellFormatting, columnColors, rowColors, calculatedFontSize, calculatedRowHeight, zoom, canWrite, isDark, getColumnDropdownOptions, getLeadCellValue, findMergedRangeForCell, onCellEdit]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisibleRegionTick((tick) => tick + 1));
    return () => window.cancelAnimationFrame(frame);
  }, [mergedRanges, cols, calculatedRowHeight, calculatedHeaderHeight, leads, allColumnKeys]);

  const mergedCellOverlays = useMemo<MergedCellOverlay[]>(() => {
    void visibleRegionTick;
    const grid = gridRef.current;
    const container = gridContainerRef.current;
    if (!grid || !container) return [];

    const canvas = container.querySelector("canvas");
    const canvasRect = canvas?.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const selected = selectedRange
      ? { startCol: selectedRange.minCol, startRow: selectedRange.minRow, endCol: selectedRange.maxCol, endRow: selectedRange.maxRow }
      : null;

    const toContainerPoint = (x: number, y: number) => {
      const isAbsolute = canvasRect ? y >= canvasRect.top : false;
      return {
        x: isAbsolute ? x - containerRect.left : (canvasRect ? canvasRect.left - containerRect.left + x : x),
        y: isAbsolute ? y - containerRect.top : (canvasRect ? canvasRect.top - containerRect.top + y : y),
      };
    };

    const overlays: MergedCellOverlay[] = [];
    for (const [key, range] of Object.entries(mergedRanges)) {
      const rowSpan = range.endRow - range.startRow + 1;
      const colSpan = range.endCol - range.startCol + 1;
      if (rowSpan <= 1 && colSpan <= 1) continue;

      const startBounds = grid.getBounds(range.startCol, range.startRow);
      const endRowBounds = grid.getBounds(range.endCol, range.endRow) || grid.getBounds(range.endCol, range.startRow);
      if (!startBounds || !endRowBounds) continue;

      const start = toContainerPoint(startBounds.x, startBounds.y);
      const end = toContainerPoint(endRowBounds.x + endRowBounds.width, endRowBounds.y + endRowBounds.height);

      const lead = leads[range.startRow];
      const colKey = allColumnKeys[range.startCol];
      if (!lead || !colKey) continue;

      const cellKey = `${range.startCol}:${range.startRow}`;
      const leadCellKey = `${lead.id}:${colKey}`;
      const style = cellFormatting[cellKey] || cellFormatting[leadCellKey];
      let text = getLeadCellValue(lead, colKey);
      if (!text) {
        for (let r = range.startRow; r <= range.endRow && !text; r++) {
          const rangeLead = leads[r];
          if (!rangeLead) continue;
          for (let c = range.startCol; c <= range.endCol; c++) {
            const rangeColKey = allColumnKeys[c];
            if (!rangeColKey) continue;
            const candidate = getLeadCellValue(rangeLead, rangeColKey);
            if (candidate) {
              text = candidate;
              break;
            }
          }
        }
      }
      const rowColor = rowColors[lead.id];
      const colColor = columnColors[colKey];
      const isSelected = Boolean(selected && rangesOverlap(range, selected));

      overlays.push({
        key,
        range,
        left: start.x,
        top: start.y,
        width: Math.max(0, end.x - start.x),
        height: Math.max(calculatedRowHeight * rowSpan, end.y - start.y),
        text,
        bg: style?.bg || rowColor || colColor || (isDark ? "#0d0d10" : "#ffffff"),
        color: style?.textColor || (isDark ? "#f4f4f5" : "#0f172a"),
        align: style?.align || "left",
        bold: Boolean(style?.bold),
        selected: isSelected,
      });
    }

    return overlays;
  }, [
    visibleRegionTick,
    mergedRanges,
    selectedRange,
    leads,
    allColumnKeys,
    cellFormatting,
    rowColors,
    columnColors,
    getLeadCellValue,
    calculatedRowHeight,
    isDark,
  ]);

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (!canWrite) return;
      const [colIndex, rowIndex] = getAnchorCell(cell);
      const lead = leads[rowIndex];
      if (!lead) return;
      const key = allColumnKeys[colIndex];
      const prevVal = getLeadCellValue(lead, key);

      let nextVal = "";
      if (newValue.kind === GridCellKind.Text) {
        nextVal = (newValue.data as string) || "";
      } else if (newValue.kind === GridCellKind.Number) {
        nextVal = newValue.data != null ? String(newValue.data) : "";
      } else if (newValue.kind === GridCellKind.Custom && (newValue.data as DropdownCellData)?.kind === "dropdown-cell") {
        nextVal = (newValue.data as DropdownCellData).value || "";
      }

      if (prevVal === nextVal) return;

      setUndoStack((prev) => [...prev, { leadId: lead.id, columnKey: key, prevValue: prevVal, nextValue: nextVal }]);
      setRedoStack([]);

      onCellEdit(lead.id, key, nextVal);
    },
    [leads, allColumnKeys, onCellEdit, canWrite, getLeadCellValue, getAnchorCell]
  );


  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, lastAction]);

    await onCellEdit(lastAction.leadId, lastAction.columnKey, lastAction.prevValue);
  }, [undoStack, onCellEdit]);

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const lastAction = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, lastAction]);

    await onCellEdit(lastAction.leadId, lastAction.columnKey, lastAction.nextValue);
  }, [redoStack, onCellEdit]);

  // Apply Background Fill Color
  const handleApplyFillColor = useCallback(
    (color: string | null, closePicker = false) => {
      if (!canWrite) return;
      const cellsToRedraw: { cell: [number, number] }[] = [];
      let nextCols = columnColors;
      let nextRows = rowColors;
      let nextCells = cellFormatting;

      const selectedCols = gridSelection.columns.toArray();
      if (selectedCols.length > 0 && gridSelection.rows.length === 0) {
        setColumnColors((prev) => {
          const next = { ...prev };
          selectedCols.forEach((cIdx) => {
            const key = allColumnKeys[cIdx];
            if (key) {
              if (color) next[key] = color;
              else delete next[key];
            }
          });
          nextCols = next;
          persistStyling(cellFormatting, next, rowColors);
          return next;
        });
        for (let r = 0; r < leads.length; r++) {
          for (const c of selectedCols) {
            cellsToRedraw.push({ cell: [c, r] });
          }
        }
      }

      const selectedRows = gridSelection.rows.toArray();
      if (selectedRows.length > 0 && selectedCols.length === 0) {
        setRowColors((prev) => {
          const next = { ...prev };
          selectedRows.forEach((rIdx) => {
            const lead = leads[rIdx];
            if (lead) {
              if (color) next[lead.id] = color;
              else delete next[lead.id];
            }
          });
          nextRows = next;
          persistStyling(cellFormatting, columnColors, next);
          return next;
        });
        for (const r of selectedRows) {
          for (let c = 0; c < allColumnKeys.length; c++) {
            cellsToRedraw.push({ cell: [c, r] });
          }
        }
      }

      if (selectedRange) {
        setCellFormatting((prev) => {
          const next = { ...prev };
          for (let r = selectedRange.minRow; r <= selectedRange.maxRow; r++) {
            for (let c = selectedRange.minCol; c <= selectedRange.maxCol; c++) {
              const key = `${c}:${r}`;
              const lead = leads[r];
              const colKey = allColumnKeys[c];
              const leadKey = lead && colKey ? `${lead.id}:${colKey}` : null;

              if (color) {
                next[key] = { ...(next[key] || {}), bg: color };
                if (leadKey) next[leadKey] = { ...(next[leadKey] || {}), bg: color };
              } else {
                if (next[key]) delete next[key].bg;
                if (leadKey && next[leadKey]) delete next[leadKey].bg;
              }
              cellsToRedraw.push({ cell: [c, r] });
            }
          }
          nextCells = next;
          persistStyling(next, columnColors, rowColors);
          return next;
        });
      }

      repaintCells(cellsToRedraw);

      if (closePicker) {
        setFillColorPickerOpen(false);
      }
    },
    [canWrite, gridSelection, selectedRange, allColumnKeys, leads, repaintCells, persistStyling, cellFormatting, columnColors, rowColors]
  );

  // Apply Text Color
  const handleApplyTextColor = useCallback(
    (color: string | null, closePicker = false) => {
      if (!canWrite || !selectedRange) return;
      const cellsToRedraw: { cell: [number, number] }[] = [];

      setCellFormatting((prev) => {
        const next = { ...prev };
        for (let r = selectedRange.minRow; r <= selectedRange.maxRow; r++) {
          for (let c = selectedRange.minCol; c <= selectedRange.maxCol; c++) {
            const key = `${c}:${r}`;
            const lead = leads[r];
            const colKey = allColumnKeys[c];
            const leadKey = lead && colKey ? `${lead.id}:${colKey}` : null;

            if (color) {
              next[key] = { ...(next[key] || {}), textColor: color };
              if (leadKey) next[leadKey] = { ...(next[leadKey] || {}), textColor: color };
            } else {
              if (next[key]) delete next[key].textColor;
              if (leadKey && next[leadKey]) delete next[leadKey].textColor;
            }
            cellsToRedraw.push({ cell: [c, r] });
          }
        }
        persistStyling(next, columnColors, rowColors);
        return next;
      });

      repaintCells(cellsToRedraw);

      if (closePicker) {
        setTextColorPickerOpen(false);
      }
    },
    [canWrite, selectedRange, allColumnKeys, leads, repaintCells, persistStyling, columnColors, rowColors]
  );

  // Alignment Controls
  const handleSetAlignment = useCallback(
    (align: "left" | "center" | "right") => {
      if (!canWrite || !selectedRange) return;
      const cellsToRedraw: { cell: [number, number] }[] = [];

      setCellFormatting((prev) => {
        const next = { ...prev };
        for (let r = selectedRange.minRow; r <= selectedRange.maxRow; r++) {
          for (let c = selectedRange.minCol; c <= selectedRange.maxCol; c++) {
            const key = `${c}:${r}`;
            const lead = leads[r];
            const colKey = allColumnKeys[c];
            const leadKey = lead && colKey ? `${lead.id}:${colKey}` : null;

            next[key] = { ...(next[key] || {}), align };
            if (leadKey) next[leadKey] = { ...(next[leadKey] || {}), align };
            cellsToRedraw.push({ cell: [c, r] });
          }
        }
        persistStyling(next, columnColors, rowColors);
        return next;
      });

      repaintCells(cellsToRedraw);
    },
    [canWrite, selectedRange, allColumnKeys, leads, repaintCells, persistStyling, columnColors, rowColors, mergedRanges]
  );

  // Toggle Merge Cells (Google Sheets style)
  const handleToggleMergeCells = useCallback(() => {
    if (!canWrite || !selectedRange) return;
    const { minCol, maxCol, minRow, maxRow } = selectedRange;
    if (selectedRange.cellCount <= 1 && !isSelectionMerged) return;
    const selectedMerge: MergedRange = { startCol: minCol, startRow: minRow, endCol: maxCol, endRow: maxRow };

    setMergedRanges((prev) => {
      const next = { ...prev };
      if (isSelectionMerged) {
        for (const [key, range] of Object.entries(next)) {
          if (rangesOverlap(range, selectedMerge)) delete next[key];
        }
      } else {
        for (const [key, range] of Object.entries(next)) {
          if (rangesOverlap(range, selectedMerge)) delete next[key];
        }
        next[getMergeKey(minCol, minRow)] = selectedMerge;
      }
      persistStyling(cellFormatting, columnColors, rowColors, next);
      return next;
    });

    repaintAllCells();
  }, [canWrite, selectedRange, isSelectionMerged, cellFormatting, columnColors, rowColors, persistStyling, repaintAllCells]);

  // Toggle Bold
  const handleToggleBold = useCallback(() => {
    if (!canWrite || !selectedRange) return;

    const firstKey = `${selectedRange.minCol}:${selectedRange.minRow}`;
    const isCurrentlyBold = Boolean(cellFormatting[firstKey]?.bold);
    const newBold = !isCurrentlyBold;
    const cellsToRedraw: { cell: [number, number] }[] = [];

    setCellFormatting((prev) => {
      const next = { ...prev };
      for (let r = selectedRange.minRow; r <= selectedRange.maxRow; r++) {
        for (let c = selectedRange.minCol; c <= selectedRange.maxCol; c++) {
          const key = `${c}:${r}`;
          const lead = leads[r];
          const colKey = allColumnKeys[c];
          const leadKey = lead && colKey ? `${lead.id}:${colKey}` : null;

          next[key] = { ...(next[key] || {}), bold: newBold };
          if (leadKey) next[leadKey] = { ...(next[leadKey] || {}), bold: newBold };
          cellsToRedraw.push({ cell: [c, r] });
        }
      }
      persistStyling(next, columnColors, rowColors);
      return next;
    });

    repaintCells(cellsToRedraw);
  }, [canWrite, selectedRange, cellFormatting, allColumnKeys, leads, repaintCells, persistStyling, columnColors, rowColors]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(1))));

  const handleClearFormatting = useCallback(() => {
    if (!canWrite || !selectedRange) return;
    const cellsToRedraw: { cell: [number, number] }[] = [];

    handleApplyFillColor(null);
    handleApplyTextColor(null);

    setCellFormatting((prev) => {
      const next = { ...prev };
      for (let r = selectedRange.minRow; r <= selectedRange.maxRow; r++) {
        for (let c = selectedRange.minCol; c <= selectedRange.maxCol; c++) {
          delete next[`${c}:${r}`];
          const lead = leads[r];
          const colKey = allColumnKeys[c];
          if (lead && colKey) delete next[`${lead.id}:${colKey}`];
          cellsToRedraw.push({ cell: [c, r] });
        }
      }
      persistStyling(next, columnColors, rowColors);
      return next;
    });

    repaintCells(cellsToRedraw);
  }, [canWrite, selectedRange, handleApplyFillColor, handleApplyTextColor, leads, allColumnKeys, repaintCells, persistStyling, columnColors, rowColors]);




  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        handleToggleBold();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        setZoom(1.0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleToggleBold]);

  const onColumnResize = useCallback(
    (column: GridColumn, newSize: number) => {
      setCols((prevCols) =>
        prevCols.map((col) => (col.id === column.id ? { ...col, width: newSize } : col))
      );
    },
    []
  );

  const onCellClicked = useCallback(
    (cell: Item, event?: GridMouseCellEventArgs) => {
      const anchorCell = getAnchorCell(cell);
      const [colIndex, rowIndex] = anchorCell;
      const merge = findMergedRangeForCell(cell[0], cell[1]);
      const range = merge
        ? {
            x: merge.startCol,
            y: merge.startRow,
            width: merge.endCol - merge.startCol + 1,
            height: merge.endRow - merge.startRow + 1,
          }
        : { x: colIndex, y: rowIndex, width: 1, height: 1 };

      setActiveCell([colIndex, rowIndex]);
      setSelectedRow(rowIndex);
      setHeaderMenu(null);
      setRowMenu(null);

      setGridSelection((prev) => ({
        ...prev,
        current: {
          cell: [colIndex, rowIndex],
          range,
          rangeStack: [range],
        },
      }));

      const colKey = allColumnKeys[colIndex];
      const dropdownOptions = getColumnDropdownOptions(colKey);
      const lead = leads[rowIndex];

      if (dropdownOptions && dropdownOptions.length > 0 && lead && canWrite) {
        const bounds = gridRef.current?.getBounds(colIndex, rowIndex);
        if (bounds) {
          const canvas = gridContainerRef.current?.querySelector("canvas");
          const canvasRect = canvas ? canvas.getBoundingClientRect() : gridContainerRef.current?.getBoundingClientRect();

          const isAbsolute = canvasRect ? bounds.y >= canvasRect.top : false;
          const cellLeft = isAbsolute ? bounds.x : (canvasRect ? canvasRect.left + bounds.x : bounds.x);
          const cellTop = isAbsolute ? bounds.y : (canvasRect ? canvasRect.top + bounds.y : bounds.y);
          const cellBottom = cellTop + bounds.height;
          const cellWidth = bounds.width;
          const cellHeight = bounds.height;

          const isNearBottom = cellBottom + 220 > window.innerHeight && cellTop > 220;

          const menuWidth = Math.max(cellWidth, 130);
          let left = cellLeft;
          if (left + menuWidth > window.innerWidth - 12) {
            left = window.innerWidth - menuWidth - 12;
          }
          if (left < 12) {
            left = 12;
          }

          setActiveDropdown({
            cell: anchorCell,
            leadId: lead.id,
            colKey,
            options: dropdownOptions,
            value: getLeadCellValue(lead, colKey),
            rect: {
              left,
              top: isNearBottom ? cellTop : cellBottom,
              width: menuWidth,
              height: cellHeight,
              direction: isNearBottom ? "up" : "down",
            },
          });
          return;
        }
      }

      setActiveDropdown(null);
    },
    [allColumnKeys, getColumnDropdownOptions, leads, canWrite, getLeadCellValue, getAnchorCell, findMergedRangeForCell]
  );

  const onHeaderClicked = useCallback(
    (colIndex: number) => {
      const colKey = allColumnKeys[colIndex];
      if (!colKey) return;
      onSort(colKey);
    },
    [allColumnKeys, onSort]
  );

  const handleGridSelectionChange = useCallback(
    (nextSelection: GridSelection) => {
      const current = nextSelection.current;
      if (!current) {
        setGridSelection(nextSelection);
        return;
      }

      const anchor = getAnchorCell(current.cell);
      let range = {
        x: current.range.x,
        y: current.range.y,
        width: current.range.width,
        height: current.range.height,
      };
      let normalizedCell: Item = anchor;
      let changed = anchor[0] !== current.cell[0] || anchor[1] !== current.cell[1];

      let didExpand = true;
      while (didExpand) {
        didExpand = false;
        const selectedMerge: MergedRange = {
          startCol: range.x,
          startRow: range.y,
          endCol: range.x + range.width - 1,
          endRow: range.y + range.height - 1,
        };

        for (const merge of Object.values(mergedRanges)) {
          if (!rangesOverlap(merge, selectedMerge)) continue;
          const minCol = Math.min(selectedMerge.startCol, merge.startCol);
          const minRow = Math.min(selectedMerge.startRow, merge.startRow);
          const maxCol = Math.max(selectedMerge.endCol, merge.endCol);
          const maxRow = Math.max(selectedMerge.endRow, merge.endRow);
          const expanded = {
            x: minCol,
            y: minRow,
            width: maxCol - minCol + 1,
            height: maxRow - minRow + 1,
          };
          if (
            expanded.x !== range.x ||
            expanded.y !== range.y ||
            expanded.width !== range.width ||
            expanded.height !== range.height
          ) {
            range = expanded;
            normalizedCell = [minCol, minRow];
            changed = true;
            didExpand = true;
          }
        }
      }

      setGridSelection(
        changed
          ? {
              ...nextSelection,
              current: {
                cell: normalizedCell,
                range,
                rangeStack: [range],
              },
            }
          : nextSelection
      );
    },
    [getAnchorCell, mergedRanges]
  );

  const onRowAppended = useCallback(async () => {
    await onAddRow();
    return "bottom" as const;
  }, [onAddRow]);

  const onDelete = useCallback(
    (selection: GridSelection): boolean => {
      if (!canWrite) return false;
      const selectedRowIndices = selection.rows.toArray();
      if (selectedRowIndices.length === 0) return false;

      const idsToDelete = selectedRowIndices
        .map((idx) => leads[idx]?.id)
        .filter(Boolean) as string[];

      if (idsToDelete.length === 0) return false;

      setConfirmDialog({
        isOpen: true,
        title: `Delete ${idsToDelete.length} Row${idsToDelete.length > 1 ? "s" : ""}`,
        message: `Are you sure you want to permanently delete ${idsToDelete.length} row${idsToDelete.length > 1 ? "s" : ""}? This action cannot be undone.`,
        confirmText: "Delete",
        confirmVariant: "danger",
        onConfirm: () => {
          if (idsToDelete.length === 1) {
            onDeleteLead(idsToDelete[0]);
          } else {
            onDeleteLeads(idsToDelete);
          }
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setGridSelection({ rows: CompactSelection.empty(), columns: CompactSelection.empty() });
        },
      });
      return true;
    },
    [canWrite, leads, onDeleteLead, onDeleteLeads]
  );

  // Right-click Context Menus with accurate coordinates at cursor pointer
  const handleHeaderContextMenu = useCallback(
    (colIndex: number, event: { bounds?: { x: number; y: number; height: number }; preventDefault?: () => void }) => {
      event.preventDefault?.();
      const col = columns[colIndex];
      const colKey = col ? col.name : allColumnKeys[colIndex];
      if (!colKey) return;

      const mouseX = lastMousePos.current.x;
      const mouseY = lastMousePos.current.y;

      setHeaderMenu({
        colKey,
        colId: col?.id || "",
        x: Math.min(typeof window !== "undefined" ? window.innerWidth - 210 : mouseX, Math.max(10, mouseX)),
        y: Math.min(typeof window !== "undefined" ? window.innerHeight - 240 : mouseY, Math.max(10, mouseY)),
      });
    },
    [allColumnKeys, columns]
  );

  const handleCellContextMenu = useCallback(
    (cell: Item, event: { bounds?: { x: number; y: number; height: number }; preventDefault?: () => void }) => {
      event.preventDefault?.();
      const [, rowIndex] = getAnchorCell(cell);
      const mouseX = lastMousePos.current.x;
      const mouseY = lastMousePos.current.y;

      setRowMenu({
        rowIndex,
        x: Math.min(typeof window !== "undefined" ? window.innerWidth - 200 : mouseX, Math.max(10, mouseX)),
        y: Math.min(typeof window !== "undefined" ? window.innerHeight - 220 : mouseY, Math.max(10, mouseY)),
      });
    },
    [getAnchorCell]
  );


  const selectedCellName = useMemo(() => {
    if (!selectedRange) return "A1";
    const startColLetter = getColumnLetter(selectedRange.minCol);
    const startRowNumber = selectedRange.minRow + 1;
    if (!selectedRange.isMultiple) {
      return `${startColLetter}${startRowNumber}`;
    }
    const endColLetter = getColumnLetter(selectedRange.maxCol);
    const endRowNumber = selectedRange.maxRow + 1;
    return `${startColLetter}${startRowNumber}:${endColLetter}${endRowNumber}`;
  }, [selectedRange]);

  const selectionStats = useMemo(() => {
    if (!selectedRange || !selectedRange.isMultiple) return null;
    const values: number[] = [];
    let count = 0;

    for (let r = selectedRange.minRow; r <= selectedRange.maxRow; r++) {
      const lead = leads[r];
      if (!lead) continue;
      const custom = (lead.customFields as Record<string, string>) || {};
      for (let c = selectedRange.minCol; c <= selectedRange.maxCol; c++) {
        count++;
        const colKey = allColumnKeys[c];
        const raw = custom[colKey] ?? (lead as unknown as Record<string, string>)?.[colKey];
        if (raw !== undefined && raw !== null && raw !== "") {
          const num = Number(raw);
          if (!isNaN(num)) values.push(num);
        }
      }
    }

    if (count <= 1) return null;
    if (values.length === 0) return { count, sum: null, avg: null, min: null, max: null };

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = Number((sum / values.length).toFixed(2));
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { count, sum, avg, min, max };
  }, [selectedRange, leads, allColumnKeys]);

  const gridTheme = useMemo(() => ({
    accentColor: isDark ? "#3b82f6" : "#2563eb",
    accentFg: "#ffffff",
    accentLight: isDark ? "rgba(59, 130, 246, 0.18)" : "rgba(37, 99, 235, 0.12)",
    textDark: isDark ? "#f4f4f5" : "#0f172a",
    textMedium: isDark ? "#a1a1aa" : "#334155",
    textLight: isDark ? "#71717a" : "#64748b",
    textBubble: isDark ? "#f4f4f5" : "#0f172a",
    bgIconHeader: isDark ? "#27272a" : "#f1f5f9",
    fgIconHeader: isDark ? "#a1a1aa" : "#475569",
    textHeader: isDark ? "#a1a1aa" : "#334155",
    textGroupHeader: isDark ? "#71717a" : "#64748b",
    textHeaderSelected: isDark ? "#ffffff" : "#0f172a",
    bgCell: isDark ? "#0d0d10" : "#ffffff",
    bgCellMedium: isDark ? "#121216" : "#f8fafc",
    bgHeader: isDark ? "#18181b" : "#f1f5f9",
    bgHeaderHasFocus: isDark ? "#27272a" : "#e2e8f0",
    bgHeaderHovered: isDark ? "#27272a" : "#e2e8f0",
    bgBubble: isDark ? "#27272a" : "#f1f5f9",
    bgBubbleSelected: isDark ? "#3f3f46" : "#e2e8f0",
    bgSearchResult: isDark ? "#3b82f633" : "#dbeafe",
    borderColor: isDark ? "#27272a" : "#e2e8f0",
    drilldownBorder: isDark ? "#27272a" : "#cbd5e1",
    linkColor: isDark ? "#60a5fa" : "#2563eb",
    cellHorizontalPadding: Math.round(6 * zoom),
    cellVerticalPadding: Math.round(3 * zoom),
    headerFontStyle: `600 ${calculatedHeaderFontSize}px`,
    headerIconSize: Math.round(14 * zoom),
    baseFontStyle: `${calculatedFontSize}px`,
    markerFontStyle: `600 ${calculatedFontSize}px`,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    editorFontSize: `${calculatedFontSize}px`,
    lineHeight: 1.2,
    roundingRadius: 0,
  }), [isDark, zoom, calculatedFontSize, calculatedHeaderFontSize]);

  const selectedRowRef = useRef(selectedRow);
  selectedRowRef.current = selectedRow;

  const getRowThemeOverride = useCallback((row: number) => {
    if (row === selectedRowRef.current) {
      return {
        bgCell: isDark ? "#1a1a20" : "#eff6ff",
        bgCellMedium: isDark ? "#1a1a20" : "#eff6ff",
      };
    }
    return undefined;
  }, [isDark]);

  const selectMergedRange = useCallback((range: MergedRange) => {
    const selectionRange = {
      x: range.startCol,
      y: range.startRow,
      width: range.endCol - range.startCol + 1,
      height: range.endRow - range.startRow + 1,
    };

    setActiveCell([range.startCol, range.startRow]);
    setSelectedRow(range.startRow);
    setActiveDropdown(null);
    setHeaderMenu(null);
    setRowMenu(null);
    setGridSelection((prev) => ({
      ...prev,
      current: {
        cell: [range.startCol, range.startRow],
        range: selectionRange,
        rangeStack: [selectionRange],
      },
    }));
    gridRef.current?.focus();
  }, []);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`flex flex-col h-full w-full select-none bg-slate-50 dark:bg-[#09090b] text-zinc-900 dark:text-white ${
        isFullscreen ? "fixed inset-0 z-50 bg-slate-50 dark:bg-[#09090b]" : ""
      }`}
    >
      {/* Top Google Sheets-Style Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#121216] border-b border-zinc-200 dark:border-zinc-800/80 gap-2 shrink-0 z-30 relative overflow-visible text-xs shadow-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Active Cell Location Indicator */}
          <div className="px-2.5 py-1 bg-slate-100 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700/80 rounded font-mono text-zinc-800 dark:text-zinc-300 min-w-[70px] text-center font-medium shadow-inner">
            {selectedCellName}
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          {/* Undo / Redo - Only shown in Write mode */}
          {canWrite && (
            <>
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo (Ctrl+Z)"
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo (Ctrl+Y)"
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                </svg>
              </button>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
            </>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700/60 rounded">
            <button
              onClick={handleZoomOut}
              title="Zoom Out (Ctrl -)"
              className="px-1.5 py-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              -
            </button>
            <div className="relative">
              <button
                onClick={() => setZoomDropdownOpen(!zoomDropdownOpen)}
                className="px-2 py-1 font-mono text-zinc-800 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 transition text-[11px] cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              {zoomDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setZoomDropdownOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl py-1 z-[100] min-w-[90px]">
                    {ZOOM_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setZoom(preset);
                          setZoomDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition cursor-pointer ${
                          zoom === preset ? "bg-blue-50 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400 font-bold" : "text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {Math.round(preset * 100)}%
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleZoomIn}
              title="Zoom In (Ctrl +)"
              className="px-1.5 py-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Density Control */}
          <div className="relative">
            <button
              onClick={() => setDensityDropdownOpen(!densityDropdownOpen)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-[#18181b] hover:bg-slate-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded text-zinc-800 dark:text-zinc-300 capitalize font-medium transition cursor-pointer"
            >
              <span>{density}</span>
              <svg className="w-3 h-3 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {densityDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDensityDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl py-1 z-[100] min-w-[120px]">
                  {(["compact", "standard", "comfortable", "spacious"] as DensityMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setDensity(mode);
                        setDensityDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs capitalize transition cursor-pointer ${
                        density === mode ? "bg-blue-50 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400 font-bold" : "text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Text Formatting Controls - ONLY shown in Write Mode */}
          {canWrite ? (
            <>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

              {/* Bold Button */}
              <button
                onClick={handleToggleBold}
                title="Bold (Ctrl+B)"
                className={`p-1.5 rounded transition cursor-pointer font-bold ${
                  selectedRange && cellFormatting[`${selectedRange.minCol}:${selectedRange.minRow}`]?.bold
                    ? "bg-blue-100 dark:bg-blue-600/30 text-blue-600 dark:text-blue-400"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                B
              </button>

              {/* Fill Color Picker Button */}
              <div className="relative">
                <button
                  onClick={() => {
                    setFillColorPickerOpen(!fillColorPickerOpen);
                    setTextColorPickerOpen(false);
                  }}
                  title="Fill Color (Paint Bucket)"
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer flex flex-col items-center justify-center gap-0.5"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
                    <path d="m5 2 5 5" />
                    <path d="M2 13h15" />
                    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
                  </svg>
                  <div
                    className="w-3.5 h-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        selectedRange && cellFormatting[`${selectedRange.minCol}:${selectedRange.minRow}`]?.bg
                          ? cellFormatting[`${selectedRange.minCol}:${selectedRange.minRow}`]?.bg
                          : customFillHex || "#3b82f6",
                    }}
                  />
                </button>

                {fillColorPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFillColorPickerOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl p-3 z-[100] min-w-[240px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">Cell Fill Color</span>
                        <button
                          onClick={() => handleApplyFillColor(null, true)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="grid grid-cols-10 gap-1 mb-3">
                        {COLOR_SWATCHES.flat().map((c, i) => (
                          <button
                            key={i}
                            onClick={() => handleApplyFillColor(c, false)}
                            className="w-4 h-4 rounded-sm border border-zinc-300 dark:border-zinc-700/80 hover:scale-125 transition cursor-pointer"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-1.5 font-medium">Custom Color</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={customFillHex}
                            onChange={(e) => {
                              setCustomFillHex(e.target.value);
                              handleApplyFillColor(e.target.value, false);
                            }}
                            className="w-7 h-7 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            value={customFillHex}
                            onChange={(e) => {
                              setCustomFillHex(e.target.value);
                              if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                handleApplyFillColor(e.target.value, false);
                              }
                            }}
                            className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200 font-mono"
                          />
                          <button
                            onClick={() => setFillColorPickerOpen(false)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium cursor-pointer shadow-xs"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Text Color Picker */}
              <div className="relative">
                <button
                  onClick={() => {
                    setTextColorPickerOpen(!textColorPickerOpen);
                    setFillColorPickerOpen(false);
                  }}
                  title="Text Color"
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="font-bold text-xs leading-none">A</span>
                  <div
                    className="w-3.5 h-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        selectedRange && cellFormatting[`${selectedRange.minCol}:${selectedRange.minRow}`]?.textColor
                          ? cellFormatting[`${selectedRange.minCol}:${selectedRange.minRow}`]?.textColor
                          : customTextHex || (isDark ? "#ffffff" : "#0f172a"),
                    }}
                  />
                </button>

                {textColorPickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setTextColorPickerOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-2xl p-3 z-[100] min-w-[240px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">Text Color</span>
                        <button
                          onClick={() => handleApplyTextColor(null, true)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="grid grid-cols-10 gap-1 mb-3">
                        {COLOR_SWATCHES.flat().map((c, i) => (
                          <button
                            key={i}
                            onClick={() => handleApplyTextColor(c, false)}
                            className="w-4 h-4 rounded-sm border border-zinc-300 dark:border-zinc-700/80 hover:scale-125 transition cursor-pointer"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-1.5 font-medium">Custom Text Color</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={customTextHex}
                            onChange={(e) => {
                              setCustomTextHex(e.target.value);
                              handleApplyTextColor(e.target.value, false);
                            }}
                            className="w-7 h-7 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent cursor-pointer"
                          />
                          <input
                            type="text"
                            value={customTextHex}
                            onChange={(e) => {
                              setCustomTextHex(e.target.value);
                              if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                handleApplyTextColor(e.target.value, false);
                              }
                            }}
                            className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs text-zinc-900 dark:text-zinc-200 font-mono"
                          />
                          <button
                            onClick={() => setTextColorPickerOpen(false)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium cursor-pointer shadow-xs"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

              {/* Horizontal Alignment Controls */}
              <div className="flex items-center bg-slate-100 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700/60 rounded p-0.5">
                <button
                  onClick={() => handleSetAlignment("left")}
                  title="Align Left"
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h10.5m-10.5 5.25h16.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handleSetAlignment("center")}
                  title="Align Center"
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M7.5 12h9m-12.75 5.25h16.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handleSetAlignment("right")}
                  title="Align Right"
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M9.75 12h10.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
              </div>

              {/* Merge Cells Button (Google Sheets style) */}
              <button
                onClick={handleToggleMergeCells}
                title={
                  isSelectionMerged
                    ? "Unmerge Cells"
                    : selectedRange && selectedRange.minCol !== selectedRange.maxCol
                    ? "Merge Selected Cells (Horizontally)"
                    : "Select 2 or more columns to merge"
                }
                disabled={!selectedRange || (!isSelectionMerged && selectedRange.minCol === selectedRange.maxCol)}
                className={`p-1.5 rounded transition cursor-pointer flex items-center gap-1.5 text-xs ${
                  isSelectionMerged
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-semibold border border-blue-300 dark:border-blue-700/60 shadow-xs"
                    : "hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M3.75 9h16.5m-16.5 6h16.5M3 3.75h18A.75.75 0 0121.75 4.5v15a.75.75 0 01-.75.75H3a.75.75 0 01-.75-.75V4.5A.75.75 0 013 3.75z" />
                </svg>
                <span className="text-[11px] font-medium hidden sm:inline">
                  {isSelectionMerged ? "Unmerge" : "Merge"}
                </span>
              </button>

              {/* Clear Formatting */}
              <button
                onClick={handleClearFormatting}
                title="Clear Formatting"
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z"
                  />
                </svg>
              </button>
            </>
          ) : (
            /* View Only Mode Indicator */
            <div className="flex items-center gap-2 ml-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-xs">
                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>View Only</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Tools: Add Row, Add Column, Charts, Discussion, Fullscreen */}
        <div className="flex items-center gap-2 shrink-0">
          {canWrite && (
            <>
              <button
                onClick={onAddRow}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 rounded font-medium transition cursor-pointer shadow-xs"
              >
                + Row
              </button>
              {onAddColumn && (
                <button
                  onClick={onAddColumn}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-600/30 rounded font-medium transition cursor-pointer shadow-xs"
                >
                  + Column
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setChartsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700/60 rounded font-medium shadow-xs transition cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
            Charts
          </button>

          <button
            onClick={() => setCommentsSidebarOpen(!commentsSidebarOpen)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium shadow-xs transition cursor-pointer ${
              commentsSidebarOpen
                ? "bg-blue-600 text-white"
                : "bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30"
            }`}
            title="Open sheet discussion & live comments"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.817-.817 5.972 5.972 0 011.057-3.035C4.03 15.556 3 13.556 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span>Discussion</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Spreadsheet Grid Container */}
      <div ref={gridContainerRef} className="relative flex-1 min-h-0 w-full bg-white dark:bg-[#0d0d10] overflow-hidden">
        {loading && leads.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-zinc-400 font-medium">Sheet is empty</p>
            <p className="text-zinc-600 text-xs mt-1">
              {canWrite
                ? "Add rows using the + Row button above or import CSV/Excel data"
                : "This sheet currently has no records."}
            </p>
            {canWrite && (
              <button
                onClick={onAddRow}
                className="mt-3 px-3 py-1.5 bg-white text-black font-medium text-xs rounded hover:bg-zinc-200 transition cursor-pointer"
              >
                + Add First Row
              </button>
            )}
          </div>
        ) : (
          <DataEditor
            ref={gridRef}
            getCellContent={getCellContent}

            onCellEdited={onCellEdited}
            customRenderers={[dropdownCellRenderer]}
            columns={cols}
            rows={leads.length}
            rowHeight={calculatedRowHeight}
            headerHeight={calculatedHeaderHeight}
            freezeColumns={0}
            rowMarkers="number"
            rangeSelect="multi-rect"
            spanRangeBehavior="default"
            onColumnResize={onColumnResize}
            onCellClicked={onCellClicked}
            onHeaderClicked={onHeaderClicked}
            onDelete={canWrite ? onDelete : undefined}
            onHeaderContextMenu={canWrite ? handleHeaderContextMenu : undefined}
            onCellContextMenu={handleCellContextMenu}
            gridSelection={gridSelection}
            onGridSelectionChange={handleGridSelectionChange}
            onVisibleRegionChanged={() => setVisibleRegionTick((tick) => tick + 1)}
            getCellsForSelection={true}
            onPaste={canWrite}
            width="100%"
            height="100%"
            getRowThemeOverride={getRowThemeOverride}
            theme={gridTheme}
          />

        )}

        {mergedCellOverlays.map((overlay) => {
          const isEditing = editingMergedKey === overlay.key;

          return (
            <div
              key={overlay.key}
              onMouseDown={(e) => {
                if (isEditing) return;
                e.preventDefault();
                e.stopPropagation();
                selectMergedRange(overlay.range);
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectMergedRange(overlay.range);
                if (canWrite) {
                  setEditingMergedKey(overlay.key);
                  setEditingMergedValue(overlay.text);
                }
              }}
              className="absolute z-20 border text-xs overflow-hidden cursor-cell select-none"
              style={{
                left: overlay.left,
                top: overlay.top,
                width: overlay.width,
                height: overlay.height,
                background: overlay.bg,
                color: overlay.color,
                borderColor: overlay.selected ? (isDark ? "#60a5fa" : "#2563eb") : (isDark ? "#27272a" : "#e2e8f0"),
                boxShadow: overlay.selected ? `inset 0 0 0 1px ${isDark ? "#60a5fa" : "#2563eb"}` : "none",
                fontSize: calculatedFontSize,
                fontWeight: overlay.bold ? 700 : 400,
                textAlign: overlay.align,
                padding: `0 ${Math.round(6 * zoom)}px`,
                display: "flex",
                alignItems: "center",
                justifyContent:
                  overlay.align === "center" ? "center" : overlay.align === "right" ? "flex-end" : "flex-start",
                whiteSpace: "nowrap",
              }}
              title={overlay.text}
            >
              {isEditing ? (
                <input
                  autoFocus
                  type="text"
                  value={editingMergedValue}
                  onChange={(e) => setEditingMergedValue(e.target.value)}
                  onBlur={() => {
                    if (canWrite) {
                      const anchorLead = leads[overlay.range.startRow];
                      const colKey = allColumnKeys[overlay.range.startCol];
                      if (anchorLead && colKey && editingMergedValue !== overlay.text) {
                        onCellEdit(anchorLead.id, colKey, editingMergedValue);
                      }
                    }
                    setEditingMergedKey(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    } else if (e.key === "Escape") {
                      setEditingMergedKey(null);
                    }
                  }}
                  className="w-full h-full bg-transparent text-inherit font-inherit text-xs focus:outline-none"
                />
              ) : (
                <span className="truncate pointer-events-none">{overlay.text}</span>
              )}
            </div>
          );
        })}

        {/* Live Selection Quick Stats Pill (Google Sheets style at bottom right) */}
        {selectionStats && (
          <div className="absolute bottom-3 right-3 z-30 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 shadow-2xl px-3 py-1.5 rounded-md text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-3">
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              Count: <strong className="text-zinc-900 dark:text-white font-mono">{selectionStats.count}</strong>
            </span>
            {selectionStats.sum !== null && (
              <>
                <span className="border-l border-zinc-200 dark:border-zinc-700 pl-3 text-zinc-500 dark:text-zinc-400">
                  Sum: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{selectionStats.sum.toLocaleString()}</strong>
                </span>
                <span className="border-l border-zinc-200 dark:border-zinc-700 pl-3 text-zinc-500 dark:text-zinc-400">
                  Avg: <strong className="text-blue-600 dark:text-blue-400 font-mono">{selectionStats.avg}</strong>
                </span>
                <span className="border-l border-zinc-200 dark:border-zinc-700 pl-3 text-zinc-500 dark:text-zinc-400">
                  Min: <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{selectionStats.min}</strong>
                </span>
                <span className="border-l border-zinc-200 dark:border-zinc-700 pl-3 text-zinc-500 dark:text-zinc-400">
                  Max: <strong className="text-zinc-800 dark:text-zinc-200 font-mono">{selectionStats.max}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Header Context Menu */}
      {headerMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setHeaderMenu(null)} />
          <div
            className="fixed z-50 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700/80 rounded-lg shadow-2xl py-1.5 min-w-[190px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: headerMenu.x, top: headerMenu.y }}
          >
            <button
              onClick={() => {
                const colKey = headerMenu.colKey;
                const col = columns.find((c) => c.name === colKey);
                if (col) setConfiguringCol(col);
                setHeaderMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer flex items-center justify-between"
            >
              <span>Edit / Configure Column</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">options</span>
            </button>
            {onAddColumn && (
              <button
                onClick={() => {
                  setHeaderMenu(null);
                  onAddColumn();
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              >
                Add new column
              </button>
            )}
            <button
              onClick={() => {
                onSort(headerMenu.colKey);
                setHeaderMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
            >
              Sort A → Z / Z → A
            </button>
            <button
              onClick={() => {
                const colKey = headerMenu.colKey;
                handleApplyFillColor(isDark ? "#1e3a8a" : "#dbeafe");
                setHeaderMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800/80 transition cursor-pointer"
            >
              Highlight column
            </button>
            <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
            <button
              onClick={() => {
                const targetColId = headerMenu.colId;
                const colKey = headerMenu.colKey;
                const col = columns.find(
                  (c) =>
                    (targetColId && c.id === targetColId) ||
                    (c?.name && colKey && c.name.toLowerCase().trim() === colKey.toLowerCase().trim())
                );
                const colIdToDelete = targetColId || col?.id;
                if (colIdToDelete) {
                  onDeleteColumn(colIdToDelete);
                } else if (colKey) {
                  const fallback = columns.find(
                    (c) => c?.name && c.name.toLowerCase().trim() === colKey.toLowerCase().trim()
                  );
                  if (fallback?.id) onDeleteColumn(fallback.id);
                }
                setHeaderMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer"
            >
              Delete column
            </button>
          </div>
        </>
      )}

      {/* Row Context Menu */}
      {rowMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
          <div
            className="fixed z-50 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700/80 rounded-lg shadow-2xl py-1.5 min-w-[190px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: rowMenu.x, top: rowMenu.y }}
          >
            {/* Row Comments & Discussion (Available for both View Only and Write users) */}
            <button
              onClick={() => {
                const lead = leads[rowMenu.rowIndex];
                if (lead) setViewingLead(lead);
                setRowMenu(null);
              }}
              className="w-full text-left px-3.5 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800/80 hover:text-blue-700 dark:hover:text-blue-300 transition cursor-pointer flex items-center gap-2 font-medium"
            >
              <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.817-.817 5.972 5.972 0 011.057-3.035C4.03 15.556 3 13.556 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <span>💬 Comments & Discussion</span>
            </button>

            {canWrite && (
              <>
                <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
                {(isSelectionMerged || (selectedRange && selectedRange.minCol !== selectedRange.maxCol)) && (
                  <button
                    onClick={() => {
                      handleToggleMergeCells();
                      setRowMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M3.75 9h16.5m-16.5 6h16.5M3 3.75h18A.75.75 0 0121.75 4.5v15a.75.75 0 01-.75.75H3a.75.75 0 01-.75-.75V4.5A.75.75 0 013 3.75z" />
                    </svg>
                    <span>{isSelectionMerged ? "Unmerge Cells" : "Merge Cells"}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const lead = leads[rowMenu.rowIndex];
                    if (lead && onDuplicateLead) onDuplicateLead(lead);
                    setRowMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v2.25A2.25 2.25 0 0113.5 21.75h-7.5A2.25 2.25 0 013.75 19.5V7.5a2.25 2.25 0 012.25-2.25h2.25m9 12h2.25a2.25 2.25 0 002.25-2.25V9.75a2.25 2.25 0 00-2.25-2.25H15m0 12h-6m6 0a2.25 2.25 0 002.25-2.25V9.75" />
                  </svg>
                  <span>Duplicate Row</span>
                </button>
                <button
                  onClick={() => {
                    onAddRow();
                    setRowMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Insert Row</span>
                </button>
                <button
                  onClick={() => {
                    const lead = leads[rowMenu.rowIndex];
                    if (lead) {
                      setRowColors((prev) => {
                        const next = {
                          ...prev,
                          [lead.id]: prev[lead.id] ? "" : (isDark ? "#1e293b" : "#f1f5f9"),
                        };
                        persistStyling(cellFormatting, columnColors, next);
                        return next;
                      });
                      const rowCells: { cell: [number, number] }[] = [];
                      for (let c = 0; c < allColumnKeys.length; c++) {
                        rowCells.push({ cell: [c, rowMenu.rowIndex] });
                      }
                      repaintCells(rowCells);
                    }
                    setRowMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800/80 transition cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3" />
                  </svg>
                  <span>Highlight Row</span>
                </button>
                <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />
                <button
                  onClick={() => {
                    const lead = leads[rowMenu.rowIndex];
                    if (lead) {
                      setConfirmDialog({
                        isOpen: true,
                        title: "Delete Row",
                        message: "Are you sure you want to delete this row? This action cannot be undone.",
                        confirmText: "Delete",
                        confirmVariant: "danger",
                        onConfirm: () => {
                          onDeleteLead(lead.id);
                          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                        },
                      });
                    }
                    setRowMenu(null);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  <span>Delete Row</span>
                </button>
              </>
            )}
          </div>
        </>
      )}




      {/* Excel Active Dropdown Menu (Opens on single click of the cell / arrow) */}
      {activeDropdown && typeof document !== "undefined" && createPortal(
        <div
          id="excel-active-dropdown-menu"
          style={{
            position: "fixed",
            left: `${activeDropdown.rect.left}px`,
            top: activeDropdown.rect.direction === "up" ? undefined : `${activeDropdown.rect.top}px`,
            bottom: activeDropdown.rect.direction === "up" ? `${window.innerHeight - activeDropdown.rect.top}px` : undefined,
            width: `${activeDropdown.rect.width}px`,
            zIndex: 999999,
            filter: "drop-shadow(0 15px 30px rgba(0,0,0,0.95))",
          }}
          className={`bg-white dark:bg-[#18181b] border border-blue-500 shadow-2xl max-h-[240px] overflow-y-auto py-0.5 animate-in fade-in zoom-in-95 duration-75 ${
            activeDropdown.rect.direction === "up" ? "rounded-t border-b-0" : "rounded-b border-t-0"
          }`}
        >
          {/* Empty / Clear Option */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCellEdit(activeDropdown.leadId, activeDropdown.colKey, "");
              setActiveDropdown(null);
              repaintAllCells();
            }}
            className={`px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 italic hover:bg-blue-600 hover:text-white cursor-pointer transition select-none flex items-center justify-between ${
              !activeDropdown.value ? "bg-slate-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200" : ""
            }`}
          >
            <span>-- Empty --</span>
            {!activeDropdown.value && <span className="text-blue-600 dark:text-blue-400 text-[10px]">✓</span>}
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 my-0.5" />

          {/* Options List */}
          {activeDropdown.options.map((opt, i) => {
            const val = opt.value || opt.label;
            const label = opt.label || opt.value;
            const isSelected = (activeDropdown.value || "").toLowerCase().trim() === val.toLowerCase().trim();
            return (
              <div
                key={val || i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCellEdit(activeDropdown.leadId, activeDropdown.colKey, val);
                  setActiveDropdown(null);
                  repaintAllCells();
                }}
                className={`px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 hover:bg-blue-600 hover:text-white cursor-pointer transition select-none flex items-center justify-between ${
                  isSelected ? "bg-blue-50 dark:bg-blue-600/30 text-blue-700 dark:text-white font-medium" : ""
                }`}
              >
                <span className="truncate">{label}</span>
                {isSelected && <span className="text-blue-600 dark:text-blue-400 text-[10px] ml-2 font-bold">✓</span>}
              </div>
            );
          })}
        </div>,
        document.body
      )}

      {/* Configure Column Modal */}
      {configuringCol && (
        <EditColumnModal
          column={configuringCol}
          onClose={() => setConfiguringCol(null)}
          onSuccess={(updated) => {
            setConfiguringCol(null);
            if (onEditColumn) onEditColumn(updated);
            onRefresh();
          }}
        />
      )}

      {/* Modals */}
      {viewingLead && (
        <ViewLeadModal
          lead={viewingLead}
          columns={columns}
          rowIndex={leads.findIndex((l) => l.id === viewingLead.id)}
          onClose={() => setViewingLead(null)}
          onLeadUpdated={(updated) => {
            if (onLeadUpdated) onLeadUpdated(updated);
            setViewingLead(updated);
          }}
        />
      )}

      <ChartsModal
        isOpen={chartsOpen}
        onClose={() => setChartsOpen(false)}
        leads={leads}
        columns={columns}
        sheetName={sheetName}
      />

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        confirmVariant={confirmDialog.confirmVariant}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Sheet-Level Collaboration Discussion / Comments Sidebar */}
      <SheetCommentsSidebar
        isOpen={commentsSidebarOpen}
        onClose={() => setCommentsSidebarOpen(false)}
        fileId={fileId || ""}
        tabId={tabId}
        sheetName={sheetName}
      />
    </div>
  );
}
