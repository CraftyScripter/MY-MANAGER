"use client";
import React from "react";
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
  value: CustomCell<StatusCellData>;
}> = ({ onChange, value }) => {
  const data = value.data;
  return (
    <select
      className="w-full h-full bg-zinc-900 text-white text-sm px-2 border-none outline-none"
      autoFocus
      defaultValue={data.status}
      onChange={(e) => {
        const opt = STATUS_OPTIONS.find((s) => s.value === e.target.value);
        onChange({
          ...value,
          data: {
            ...data,
            status: e.target.value,
            label: opt?.label || e.target.value,
            color: opt?.hex || "#6b7280",
          },
        });
      }}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
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
