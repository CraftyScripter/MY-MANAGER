export const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-950/50 text-blue-400 border-blue-800/50", hex: "#3b82f6" },
  { value: "contacted", label: "Contacted", color: "bg-amber-950/50 text-amber-400 border-amber-800/50", hex: "#f59e0b" },
  { value: "qualified", label: "Qualified", color: "bg-purple-950/50 text-purple-400 border-purple-800/50", hex: "#8b5cf6" },
  { value: "converted", label: "Converted", color: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50", hex: "#10b981" },
  { value: "dead", label: "Dead", color: "bg-red-950/50 text-red-400 border-red-800/50", hex: "#ef4444" },
];

export const FOLDER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export const BUILT_IN_COLUMNS = [
  { key: "businessName", title: "Business", width: 220 },
  { key: "phone", title: "Phone", width: 150 },
  { key: "email", title: "Email", width: 200 },
  { key: "category", title: "Category", width: 130 },
  { key: "rating", title: "Rating", width: 100 },
  { key: "status", title: "Status", width: 120 },
] as const;

export const STATUS_STYLE_MAP: Record<string, string> = {
  new: "bg-blue-950/50 text-blue-400 border-blue-800/50",
  contacted: "bg-amber-950/50 text-amber-400 border-amber-800/50",
  qualified: "bg-purple-950/50 text-purple-400 border-purple-800/50",
  converted: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
  dead: "bg-red-950/50 text-red-400 border-red-800/50",
};

export const STATUS_LABEL_MAP: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  dead: "Dead",
};
