"use client";

import { useState, useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import type { Lead, LeadColumn } from "../../types";
import DropdownSelect from "@/components/DropdownSelect";

interface ChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  columns: LeadColumn[];
  sheetName?: string;
}

const PALETTE = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#ef4444", // Red
  "#84cc16", // Lime
  "#a855f7", // Violet
];

type ChartType = "bar" | "bar-horizontal" | "pie" | "donut" | "area";

export default function ChartsModal({
  isOpen,
  onClose,
  leads,
  columns,
  sheetName = "Current Sheet",
}: ChartsModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  // Discover column keys strictly from the current sheet columns
  const allColumnKeys = useMemo(() => {
    if (columns && columns.length > 0) {
      return columns.map((c) => c.name).filter((k) => k && k.trim().length > 0);
    }
    // Fallback if no columns defined in schema: check existing customFields across leads
    const leadCustomKeys = new Set<string>();
    leads.forEach((l) => {
      if (l.customFields && typeof l.customFields === "object") {
        Object.keys(l.customFields).forEach((k) => leadCustomKeys.add(k));
      }
    });
    return Array.from(leadCustomKeys).filter((k) => k.trim().length > 0);
  }, [columns, leads]);

  // Selected column for custom analysis
  const [selectedColumn, setSelectedColumn] = useState<string>(allColumnKeys[0] || "");

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [activeTab, setActiveTab] = useState<"auto" | "custom" | "completeness">("auto");

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalRows = leads.length;
    const totalCols = allColumnKeys.length;
    const totalCells = totalRows * (totalCols || 1);

    let filledCells = 0;
    leads.forEach((l) => {
      const custom = (l.customFields as Record<string, string>) || {};
      allColumnKeys.forEach((key) => {
        const val = custom[key] ?? (l as unknown as Record<string, string>)[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          filledCells++;
        }
      });
    });

    const fillRate = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;

    return {
      totalRows,
      totalCols,
      filledCells,
      fillRate,
    };
  }, [leads, allColumnKeys]);

  // Analyze every column to find candidate distributions
  const columnAnalyses = useMemo(() => {
    return allColumnKeys.map((colKey) => {
      const freqMap: Record<string, number> = {};
      let numericCount = 0;
      let filledCount = 0;

      leads.forEach((l) => {
        const custom = (l.customFields as Record<string, string>) || {};
        const raw = custom[colKey] ?? (l as unknown as Record<string, string>)[colKey];
        const val = raw !== undefined && raw !== null ? String(raw).trim() : "";

        if (val !== "") {
          filledCount++;
          freqMap[val] = (freqMap[val] || 0) + 1;
          if (!isNaN(Number(val))) {
            numericCount++;
          }
        }
      });

      const uniqueCount = Object.keys(freqMap).length;
      const isNumeric = filledCount > 0 && numericCount / filledCount > 0.8;
      const isBoolean =
        uniqueCount <= 3 &&
        Object.keys(freqMap).some((k) =>
          ["yes", "no", "true", "false", "y", "n", "1", "0"].includes(k.toLowerCase())
        );

      const sortedData = Object.entries(freqMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return {
        colKey,
        filledCount,
        fillRate: leads.length > 0 ? Math.round((filledCount / leads.length) * 100) : 0,
        uniqueCount,
        isNumeric,
        isBoolean,
        data: sortedData,
        topData: sortedData.slice(0, 10),
      };
    });
  }, [allColumnKeys, leads]);

  // Candidate columns for Auto Charts (categorical / status / boolean)
  const autoChartCandidates = useMemo(() => {
    return columnAnalyses.filter(
      (c) => c.filledCount > 0 && c.uniqueCount >= 2 && c.uniqueCount <= 20
    );
  }, [columnAnalyses]);

  // Data for active custom column selection
  const customChartData = useMemo(() => {
    const currentKey = selectedColumn || allColumnKeys[0];
    const analysis = columnAnalyses.find((c) => c.colKey === currentKey);
    if (!analysis) return [];
    return analysis.topData;
  }, [selectedColumn, allColumnKeys, columnAnalyses]);

  // Data Completeness chart
  const completenessData = useMemo(() => {
    return columnAnalyses
      .map((c) => ({
        column: c.colKey.length > 15 ? c.colKey.slice(0, 15) + "..." : c.colKey,
        fullColumn: c.colKey,
        filled: c.fillRate,
        empty: 100 - c.fillRate,
      }))
      .sort((a, b) => b.filled - a.filled);
  }, [columnAnalyses]);

  if (!isOpen) return null;

  const tooltipBg = isDark ? "#18181b" : "#ffffff";
  const tooltipBorder = isDark ? "#3f3f46" : "#e2e8f0";
  const tooltipText = isDark ? "#f4f4f5" : "#0f172a";
  const gridStroke = isDark ? "#27272a" : "#e2e8f0";
  const axisStroke = isDark ? "#71717a" : "#94a3b8";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-zinc-800/90 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-3 bg-slate-50 dark:bg-[#16161a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Data Analytics & Charts</span>
                <span className="text-xs font-normal text-zinc-600 dark:text-zinc-400 bg-slate-200 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700/60">
                  {sheetName}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Automated statistical breakdowns, distributions, and interactive visual charts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Tabs */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1">
              <button
                onClick={() => setActiveTab("auto")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                  activeTab === "auto"
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Auto Insights ({autoChartCandidates.length})
              </button>
              <button
                onClick={() => setActiveTab("custom")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                  activeTab === "custom"
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Chart Builder
              </button>
              <button
                onClick={() => setActiveTab("completeness")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
                  activeTab === "completeness"
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                Data Quality
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-[#18181c] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-2xs">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Rows</p>
              <p className="text-xl font-extrabold text-zinc-900 dark:text-white mt-1">{summaryMetrics.totalRows.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#18181c] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-2xs">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Columns Tracked</p>
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">{summaryMetrics.totalCols.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#18181c] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-2xs">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Data Fill Rate</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{summaryMetrics.fillRate}%</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#18181c] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-2xs">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Categorical Insights</p>
              <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{autoChartCandidates.length} Detected</p>
            </div>
          </div>

          {/* TAB 1: AUTO INSIGHTS */}
          {activeTab === "auto" && (
            <div className="space-y-6">
              {autoChartCandidates.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6">
                  <svg className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">No Categorical Columns Found</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                    Add records with distinct categories, statuses, or boolean values, or use the Chart Builder tab to plot any custom column.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {autoChartCandidates.map((candidate, idx) => {
                    const isSmallSet = candidate.data.length <= 5;

                    return (
                      <div
                        key={candidate.colKey}
                        className="bg-slate-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-zinc-800/60 pb-3">
                          <div>
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white capitalize flex items-center gap-2">
                              <span>{candidate.colKey}</span>
                              <span className="text-[10px] font-normal text-zinc-700 dark:text-zinc-400 bg-slate-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                                {candidate.uniqueCount} distinct
                              </span>
                            </h3>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                              {candidate.filledCount} of {leads.length} rows populated ({candidate.fillRate}%)
                            </p>
                          </div>
                        </div>

                        {/* Chart Render */}
                        <div className="h-64 w-full flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            {isSmallSet ? (
                              <PieChart>
                                <Pie
                                  data={candidate.data}
                                  dataKey="count"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={80}
                                  paddingAngle={3}
                                  label={({ name, percent }: { name?: string; percent?: number }) =>
                                    `${name || ""}: ${((percent || 0) * 100).toFixed(0)}%`
                                  }
                                  labelLine={false}
                                >
                                  {candidate.data.map((_, i) => (
                                    <Cell key={`cell-${i}`} fill={PALETTE[i % PALETTE.length]} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: tooltipBg,
                                    border: `1px solid ${tooltipBorder}`,
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    color: tooltipText,
                                  }}
                                />
                                <Legend wrapperStyle={{ fontSize: "11px", color: isDark ? "#a1a1aa" : "#475569" }} />
                              </PieChart>
                            ) : (
                              <BarChart data={candidate.topData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                                <XAxis
                                  dataKey="name"
                                  stroke={axisStroke}
                                  fontSize={10}
                                  interval={0}
                                  angle={-25}
                                  textAnchor="end"
                                />
                                <YAxis stroke={axisStroke} fontSize={10} allowDecimals={false} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: tooltipBg,
                                    border: `1px solid ${tooltipBorder}`,
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    color: tooltipText,
                                  }}
                                />
                                <Bar dataKey="count" fill={PALETTE[idx % PALETTE.length]} radius={[4, 4, 0, 0]} />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CUSTOM CHART BUILDER */}
          {activeTab === "custom" && (
            <div className="space-y-5">
              {/* Controls Bar */}
              <div className="bg-slate-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">
                      Select Column
                    </label>
                    <DropdownSelect
                      value={selectedColumn}
                      onChange={setSelectedColumn}
                      options={allColumnKeys.map((key) => ({ label: key, value: key }))}
                      size="sm"
                      minWidth="180px"
                      className="min-w-[180px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 uppercase tracking-wider">
                      Chart Type
                    </label>
                    <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => setChartType("bar")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer ${
                          chartType === "bar" ? "bg-blue-600 text-white font-semibold shadow-2xs" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        Bar (V)
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType("bar-horizontal")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer ${
                          chartType === "bar-horizontal" ? "bg-blue-600 text-white font-semibold shadow-2xs" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        Bar (H)
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType("donut")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer ${
                          chartType === "donut" ? "bg-blue-600 text-white font-semibold shadow-2xs" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        Donut
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType("area")}
                        className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer ${
                          chartType === "area" ? "bg-blue-600 text-white font-semibold shadow-2xs" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        }`}
                      >
                        Area
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Showing top {customChartData.length} values for <strong className="text-zinc-900 dark:text-white">{selectedColumn || "selected column"}</strong>
                </div>
              </div>

              {/* Custom Chart View */}
              <div className="bg-slate-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
                <div className="h-80 w-full">
                  {customChartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 text-xs">
                      No data values recorded for column "{selectedColumn}"
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={customChartData} margin={{ top: 15, right: 20, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="name" stroke={axisStroke} fontSize={11} interval={0} angle={-25} textAnchor="end" />
                          <YAxis stroke={axisStroke} fontSize={11} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: tooltipBg,
                              border: `1px solid ${tooltipBorder}`,
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: tooltipText,
                            }}
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                            {customChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : chartType === "bar-horizontal" ? (
                        <BarChart
                          data={customChartData}
                          layout="vertical"
                          margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis type="number" stroke={axisStroke} fontSize={11} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" stroke={axisStroke} fontSize={11} width={100} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: tooltipBg,
                              border: `1px solid ${tooltipBorder}`,
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: tooltipText,
                            }}
                          />
                          <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]}>
                            {customChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : chartType === "donut" ? (
                        <PieChart>
                          <Pie
                            data={customChartData}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={3}
                            label={({ name, percent }: { name?: string; percent?: number }) =>
                              `${name || ""}: ${((percent || 0) * 100).toFixed(0)}%`
                            }
                          >
                            {customChartData.map((_, i) => (
                              <Cell key={`cell-${i}`} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: tooltipBg,
                              border: `1px solid ${tooltipBorder}`,
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: tooltipText,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", color: isDark ? "#a1a1aa" : "#475569" }} />
                        </PieChart>
                      ) : (
                        <AreaChart data={customChartData} margin={{ top: 15, right: 20, left: 0, bottom: 40 }}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                          <XAxis dataKey="name" stroke={axisStroke} fontSize={11} interval={0} angle={-25} textAnchor="end" />
                          <YAxis stroke={axisStroke} fontSize={11} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: tooltipBg,
                              border: `1px solid ${tooltipBorder}`,
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: tooltipText,
                            }}
                          />
                          <Area type="monotone" dataKey="count" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCount)" />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA QUALITY & COMPLETENESS */}
          {activeTab === "completeness" && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-[#16161a] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Column Fill Rate (%)</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Percentage of records that have non-empty values across each sheet column.
                  </p>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={completenessData}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis type="number" stroke={axisStroke} fontSize={11} domain={[0, 100]} unit="%" />
                      <YAxis type="category" dataKey="column" stroke={axisStroke} fontSize={11} width={120} />
                      <Tooltip
                        formatter={(val) => [`${val ?? 0}% populated`, "Fill Rate"]}
                        contentStyle={{
                          backgroundColor: tooltipBg,
                          border: `1px solid ${tooltipBorder}`,
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: tooltipText,
                        }}
                      />
                      <Bar dataKey="filled" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-[#16161a] flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <div>
            Total data points analyzed: <strong className="text-zinc-900 dark:text-white">{leads.length * allColumnKeys.length}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-medium transition cursor-pointer shadow-2xs"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
