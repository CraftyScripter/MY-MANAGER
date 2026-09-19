export interface LeadFolder {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
  createdAt: string;
  _count: { children: number; files: number };
  children?: LeadFolder[];
  files?: LeadFile[];
}

export interface LeadFile {
  id: string;
  folderId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { tabs: number };
  tabs: LeadTab[];
  columns: LeadColumn[];
}

export interface LeadColumn {
  id: string;
  fileId: string;
  name: string;
  type: string;
  options: string | null;
  sortOrder: number;
  createdAt: string;
  width?: number;
}

export interface LeadTab {
  id: string;
  fileId: string;
  name: string;
  sortOrder: number;
  mergedCells?: MergedCell[];
  _count: { leads: number };
}

export interface MergedCell {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  label?: string;
}

export interface Lead {
  id: string;
  tabId: string;
  businessName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  reviews: number | null;
  sourceUrl: string | null;
  status: string;
  notes: string | null;
  customFields: Record<string, string> | null;
  importedAt: string;
  createdAt: string;
}

export interface LeadComment {
  id: string;
  authorId?: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  text: string;
  createdAt: string;
}

export interface Toast {
  type: "success" | "error";
  message: string;
}

export type SortField = "date" | "amount";
export type SortOrder = "asc" | "desc";
