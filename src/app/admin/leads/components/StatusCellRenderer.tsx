import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CustomCell,
  CustomRenderer,
  GridCellKind,
} from "@glideapps/glide-data-grid";
import { STATUS_OPTIONS } from "../constants";

export interface StatusCellData {
  kind: "status-cell";
  status: string;
  label: string;
  color: string;
}

const StatusEditor: React.FC<{
  onChange: (newValue: CustomCell<StatusCellData>) => void;
  onFinishedEditing?: (newValue?: CustomCell<StatusCellData>) => void;
  value: CustomCell<StatusCellData>;
}> = ({ onChange, onFinishedEditing, value }) => {
  const data = value.data;
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const isCommittedRef = useRef(false);
  const [currentVal, setCurrentVal] = useState(data.status || "");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");
  const [isOpen, setIsOpen] = useState(true);
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
      const rect = containerRef.current.getBoundingClientRect();
      const isNearBottom = rect.bottom + 260 > window.innerHeight && rect.top > 260;
      setMenuDirection(isNearBottom ? "up" : "down");

      const menuWidth = Math.max(rect.width, 160);
      let left = rect.left;
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
    const opt = STATUS_OPTIONS.find((s) => s.value === selectedVal);
    const updatedCell: CustomCell<StatusCellData> = {
      ...value,
      data: {
        ...data,
        status: selectedVal,
        label: opt?.label || selectedVal,
        color: opt?.hex || "#6b7280",
      },
    };
    onChange(updatedCell);
    onFinishedEditing?.(updatedCell);
  };

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
      setHighlightedIndex((prev) => (prev < STATUS_OPTIONS.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : STATUS_OPTIONS.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < STATUS_OPTIONS.length) {
        handleSelect(STATUS_OPTIONS[highlightedIndex].value);
      } else {
        onFinishedEditing?.(value);
      }
    }
  };

  const currentOpt = STATUS_OPTIONS.find((s) => s.value === currentVal);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative w-full h-full bg-white dark:bg-[#18181b] border-2 border-blue-500 outline-none flex items-center justify-between cursor-pointer select-none box-border z-[9999]"
    >
      <div className="flex-1 px-2.5 text-xs text-zinc-900 dark:text-white truncate font-medium flex items-center gap-1.5">
        {currentOpt && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: currentOpt.hex }}
          />
        )}
        <span>{currentOpt?.label || currentVal}</span>
      </div>

      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-6 h-full bg-zinc-100 dark:bg-[#27272a] hover:bg-zinc-200 dark:hover:bg-[#3f3f46] border-l border-zinc-200 dark:border-zinc-700/80 text-zinc-500 dark:text-zinc-300 flex items-center justify-center transition cursor-pointer shrink-0"
      >
        <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>

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
            filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.2))",
          }}
          className={`bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-700 shadow-2xl max-h-[260px] overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-75 ${
            menuDirection === "up" ? "rounded-t-xl border-b-0" : "rounded-b-xl border-t-0"
          }`}
        >
          {STATUS_OPTIONS.map((opt, i) => {
            const isSelected = opt.value === currentVal;
            const isHighlighted = highlightedIndex === i;

            return (
              <div
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(opt.value);
                }}
                className={`px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 hover:bg-blue-600 hover:text-white cursor-pointer transition select-none flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-600/30 dark:text-white font-semibold"
                    : isHighlighted
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: opt.hex }}
                  />
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <span className="text-blue-500 dark:text-blue-400 text-[10px] font-bold shrink-0">✓</span>}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};
StatusEditor.displayName = "StatusEditor";

const statusCellRenderer: CustomRenderer<CustomCell<StatusCellData>> = {
  kind: GridCellKind.Custom,

  isMatch: (cell: CustomCell): cell is CustomCell<StatusCellData> =>
    (cell.data as StatusCellData)?.kind === "status-cell",

  draw: (args, cell) => {
    const { ctx, rect, theme } = args;
    const { label, color } = (cell as CustomCell<StatusCellData>).data;

    const padding = 10;
    const pillHeight = 22;
    const pillY = rect.y + (rect.height - pillHeight) / 2;
    const text = label || "\u2014";
    ctx.font = `600 12px ${theme.fontFamily}`;

    const textWidth = ctx.measureText(text).width;
    const pillWidth = textWidth + padding * 2;
    const pillX = rect.x + 8;

    ctx.fillStyle = color + "22";
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 11);
    ctx.fill();

    ctx.strokeStyle = color + "55";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 11);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, pillX + pillWidth / 2, pillY + pillHeight / 2);

    return true;
  },

  provideEditor: (cell) => ({
    editor: StatusEditor,
  }),

  onPaste: (val: string, cellData: StatusCellData) => {
    if (!val || typeof val !== "string") return cellData;
    const valLower = val.toLowerCase().trim();
    const match = STATUS_OPTIONS.find(
      (s) =>
        (s?.label && typeof s.label === "string" && s.label.toLowerCase().trim() === valLower) ||
        (s?.value && typeof s.value === "string" && s.value.toLowerCase().trim() === valLower)
    );
    if (match) {
      return { ...cellData, status: match.value, label: match.label, color: match.hex };
    }
    return cellData;
  },
};

export default statusCellRenderer;
