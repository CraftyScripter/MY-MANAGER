"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CustomCell,
  CustomRenderer,
  GridCellKind,
} from "@glideapps/glide-data-grid";

export interface DropdownOption {
  value: string;
  label: string;
  color?: string;
}

export interface DropdownCellData {
  kind: "dropdown-cell";
  value: string;
  options: DropdownOption[];
  allowCustom?: boolean;
  onCommit?: (newValue: string) => void;
}

const COLOR_PALETTE = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#ef4444", // Red
  "#a855f7", // Violet
];

export function getOptionColor(val?: string | null, index?: number): string {
  if (!val || typeof val !== "string") return "#3b82f6";
  const v = val.toLowerCase().trim();
  if (v === "done" || v === "verified" || v === "converted" || v === "completed" || v === "active" || v === "paid" || v === "yes") {
    return "#10b981"; // Emerald
  }
  if (v === "pending" || v === "in_progress" || v === "in progress" || v === "contacted" || v === "waiting" || v === "medium") {
    return "#f59e0b"; // Amber
  }
  if (v === "new" || v === "qualified" || v === "open" || v === "low") {
    return "#3b82f6"; // Blue
  }
  if (v === "dead" || v === "cancelled" || v === "rejected" || v === "failed" || v === "closed" || v === "no" || v === "high" || v === "urgent") {
    return "#ef4444"; // Red
  }
  if (v === "review" || v === "proposal" || v === "negotiation") {
    return "#8b5cf6"; // Purple
  }

  // Hash-based color
  let hash = 0;
  for (let i = 0; i < v.length; i++) {
    hash = v.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index !== undefined ? index % COLOR_PALETTE.length : idx];
}

const DropdownEditor: React.FC<{
  onChange: (newValue: CustomCell<DropdownCellData>) => void;
  onFinishedEditing?: (newValue?: CustomCell<DropdownCellData>) => void;
  value: CustomCell<DropdownCellData>;
}> = ({ onChange, onFinishedEditing, value }) => {
  const data = value.data;
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const isCommittedRef = useRef(false);
  const [currentVal, setCurrentVal] = useState(data.value || "");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");
  const [isOpen, setIsOpen] = useState(true);
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
      const rect = containerRef.current.getBoundingClientRect();
      const isNearBottom = rect.bottom + 220 > window.innerHeight && rect.top > 220;
      setMenuDirection(isNearBottom ? "up" : "down");

      const menuWidth = Math.max(rect.width, 140);
      let left = rect.left;
      // Clamp horizontally to stay inside viewport
      if (left + menuWidth > window.innerWidth - 16) {
        left = window.innerWidth - menuWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      setCoords({
        left,
        top: isNearBottom ? rect.top : rect.bottom,
        width: menuWidth,
        height: rect.height,
      });
    }
  }, []);

  const handleSelect = (selectedVal: string) => {
    isCommittedRef.current = true;
    setCurrentVal(selectedVal);
    data.onCommit?.(selectedVal);
    const updatedCell: CustomCell<DropdownCellData> = {
      ...value,
      data: {
        ...data,
        value: selectedVal,
      },
    };
    onChange(updatedCell);
    onFinishedEditing?.(updatedCell);
  };

  // Close on outside click safely without reverting
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (isCommittedRef.current) return;
      const target = e.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (portalRef.current && portalRef.current.contains(target)) return;

      onFinishedEditing?.(value);
    };

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [value, onFinishedEditing]);

  const allItems = ["", ...(data.options || []).map((o) => o.value || o.label)];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onFinishedEditing?.(value);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < allItems.length) {
        handleSelect(allItems[highlightedIndex]);
      } else {
        onFinishedEditing?.(value);
      }
    }
  };

  const matchedOpt = (data.options || []).find(
    (o) =>
      (o?.value && (o.value || "").toLowerCase().trim() === (currentVal || "").toLowerCase().trim()) ||
      (o?.label && (o.label || "").toLowerCase().trim() === (currentVal || "").toLowerCase().trim())
  );
  const currentText = matchedOpt?.label || currentVal || "";

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative w-full h-full bg-[#18181b] border-2 border-blue-500 outline-none flex items-center justify-between cursor-pointer select-none box-border z-[9999]"
    >
      {/* Excel Cell Text Display */}
      <div className="flex-1 px-2.5 text-xs text-white truncate font-normal">
        {currentText || <span className="text-zinc-500 italic text-[11px]"></span>}
      </div>

      {/* Excel Square Dropdown Arrow Button on Right */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-6 h-full bg-[#27272a] hover:bg-[#3f3f46] border-l border-zinc-700/80 text-zinc-300 flex items-center justify-center transition cursor-pointer shrink-0"
      >
        <svg className="w-3 h-3 fill-current text-zinc-300" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>

      {/* Excel Dropdown Popup List - Popped Out of Cell via React Portal */}
      {isOpen && coords && typeof document !== "undefined" && createPortal(
        <div
          ref={portalRef}
          style={{
            position: "fixed",
            left: `${coords.left}px`,
            top: menuDirection === "up" ? undefined : `${coords.top}px`,
            bottom: menuDirection === "up" ? `${window.innerHeight - coords.top}px` : undefined,
            width: `${coords.width}px`,
            zIndex: 999999,
            filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.9))",
          }}
          className={`bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 shadow-2xl max-h-[220px] overflow-y-auto py-0.5 animate-in fade-in zoom-in-95 duration-75 ${
            menuDirection === "up" ? "rounded-t border-b-0" : "rounded-b border-t-0"
          }`}
        >
          {/* Empty / Clear Option */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelect("");
            }}
            className={`px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 italic hover:bg-blue-600 hover:text-white cursor-pointer transition select-none flex items-center justify-between ${
              !currentVal || highlightedIndex === 0 ? "bg-blue-50 text-blue-700 dark:bg-zinc-800 dark:text-zinc-200" : ""
            }`}
          >
            <span>-- Empty --</span>
            {!currentVal && <span className="text-blue-500 text-[10px]">✓</span>}
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 my-0.5" />

          {/* Options List */}
          {(data.options || []).map((opt, i) => {
            const val = opt.value || opt.label;
            const label = opt.label || opt.value;
            const isSelected = (currentVal || "").toLowerCase().trim() === val.toLowerCase().trim();
            const isHighlighted = highlightedIndex === i + 1;

            return (
              <div
                key={val || i}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(val);
                }}
                className={`px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 hover:bg-blue-600 hover:text-white cursor-pointer transition select-none flex items-center justify-between ${
                  isSelected ? "bg-blue-50 text-blue-700 dark:bg-blue-600/30 dark:text-white font-medium" : isHighlighted ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white" : ""
                }`}
              >
                <span className="truncate">{label}</span>
                {isSelected && <span className="text-blue-500 text-[10px] ml-2 font-bold">✓</span>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};
DropdownEditor.displayName = "DropdownEditor";

export const dropdownCellRenderer: CustomRenderer<CustomCell<DropdownCellData>> = {
  kind: GridCellKind.Custom,

  isMatch: (cell: CustomCell): cell is CustomCell<DropdownCellData> =>
    (cell.data as DropdownCellData)?.kind === "dropdown-cell",

  draw: (args, cell) => {
    const { ctx, rect, theme } = args;
    const { value, options } = (cell as CustomCell<DropdownCellData>).data;

    // Draw background if cell has background color
    if (theme.bgCell && theme.bgCell !== "#0d0d10" && theme.bgCell !== "#121216") {
      ctx.fillStyle = theme.bgCell;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    const text = value ? String(value).trim() : "";
    if (text) {
      const valLower = text.toLowerCase();
      const matchedOpt = (options || []).find(
        (o) =>
          (o?.value && typeof o.value === "string" && o.value.toLowerCase().trim() === valLower) ||
          (o?.label && typeof o.label === "string" && o.label.toLowerCase().trim() === valLower)
      );
      const label = matchedOpt?.label || text;

      ctx.fillStyle = theme.textDark || "#f4f4f5";
      ctx.font = `400 12px ${theme.fontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, rect.x + 8, rect.y + rect.height / 2, rect.width - 30);
    }

    // Draw Excel dropdown square button on the right
    const btnWidth = 20;
    const btnX = rect.x + rect.width - btnWidth;
    const btnY = rect.y;
    const btnHeight = rect.height;

    ctx.fillStyle = "#27272a";
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);

    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(btnX, btnY);
    ctx.lineTo(btnX, btnY + btnHeight);
    ctx.stroke();

    // Draw down arrow ▼ inside button
    const arrowX = btnX + btnWidth / 2;
    const arrowY = btnY + btnHeight / 2;
    ctx.fillStyle = "#a1a1aa";
    ctx.beginPath();
    ctx.moveTo(arrowX - 3, arrowY - 1.5);
    ctx.lineTo(arrowX + 3, arrowY - 1.5);
    ctx.lineTo(arrowX, arrowY + 2);
    ctx.closePath();
    ctx.fill();

    return true;
  },

  onPaste: (val: string, cellData: DropdownCellData) => {
    if (!val || typeof val !== "string") return cellData;
    const valLower = val.toLowerCase().trim();
    const match = (cellData.options || []).find(
      (s) =>
        (s?.label && typeof s.label === "string" && s.label.toLowerCase().trim() === valLower) ||
        (s?.value && typeof s.value === "string" && s.value.toLowerCase().trim() === valLower)
    );
    if (match) {
      return { ...cellData, value: match.value };
    }
    return { ...cellData, value: val };
  },
};

export default dropdownCellRenderer;
