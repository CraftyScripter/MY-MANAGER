import { prisma } from "./prisma";
import { getValidGoogleAccount } from "./google";
import type { Prisma } from "@prisma/client";

export interface SheetHeaderMapping {
  businessNameIndex: number;
  phoneIndex: number;
  emailIndex: number;
  addressIndex: number;
  websiteIndex: number;
  categoryIndex: number;
  ratingIndex: number;
  reviewsIndex: number;
  statusIndex: number;
  notesIndex: number;
  headers: string[];
}

interface GoogleGridRange {
  sheetId?: number;
  startRowIndex?: number;
  endRowIndex?: number;
  startColumnIndex?: number;
  endColumnIndex?: number;
}

interface GoogleSheetMetadata {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
  merges: GoogleGridRange[];
}

interface SheetMergedRange {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

/**
 * Converts column 0-based index to Excel/Sheets column letter (0 -> A, 1 -> B, 26 -> AA).
 */
export function getColumnLetter(index: number): string {
  let label = "";
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

/**
 * Parses Google Spreadsheet ID from either full URL or raw ID string.
 */
export function parseSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return "";
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Get spreadsheet details and sheets (tabs) list.
 */
export async function getSpreadsheetMetadata(accessToken: string, spreadsheetId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title,gridProperties),sheets.merges`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch Google Sheet details (${res.status}): ${err}`);
  }

  const data = await res.json();
  const sheets: GoogleSheetMetadata[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId,
    title: s.properties?.title || "Sheet1",
    rowCount: s.properties?.gridProperties?.rowCount || 0,
    columnCount: s.properties?.gridProperties?.columnCount || 0,
    merges: s.merges || [],
  }));

  return {
    title: data.properties?.title || "Untitled Spreadsheet",
    sheets,
  };
}

function buildMergedRangesFromGoogleMerges(merges: GoogleGridRange[] = []) {
  const mergedRanges: Record<string, SheetMergedRange> = {};

  for (const merge of merges) {
    const startRow = merge.startRowIndex ?? 0;
    const startCol = merge.startColumnIndex ?? 0;
    const endRowExclusive = merge.endRowIndex ?? startRow + 1;
    const endColExclusive = merge.endColumnIndex ?? startCol + 1;
    const endRow = endRowExclusive - 1;
    const endCol = endColExclusive - 1;

    if (endRow <= startRow && endCol <= startCol) continue;

    mergedRanges[`${startCol}:${startRow}`] = {
      startCol,
      startRow,
      endCol,
      endRow,
    };
  }

  return mergedRanges;
}

/**
 * Get raw 2D values matrix from a Google Sheet range.
 */
export async function getSpreadsheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to read sheet data (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.values || [];
}

/**
 * Appends a row of values to Google Sheet.
 */
export async function appendSpreadsheetRow(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowValues: any[]
) {
  const range = `${sheetName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values: [rowValues],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to append row to Google Sheet (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Detect column indexes for Lead fields from header row.
 */
export function detectColumnMapping(headers: string[]): SheetHeaderMapping {
  const normalized = headers.map((h) => (h || "").toLowerCase().trim());

  const findIndex = (keywords: string[]) =>
    normalized.findIndex((header) => keywords.some((k) => header.includes(k)));

  const businessNameIndex = findIndex(["business", "company", "name", "lead", "title", "client"]);
  const phoneIndex = findIndex(["phone", "mobile", "tel", "contact", "cell"]);
  const emailIndex = findIndex(["email", "mail", "e-mail"]);
  const addressIndex = findIndex(["address", "location", "city", "street", "place"]);
  const websiteIndex = findIndex(["website", "url", "web", "site", "link"]);
  const categoryIndex = findIndex(["category", "industry", "type", "tag", "niche"]);
  const ratingIndex = findIndex(["rating", "rate", "score", "stars"]);
  const reviewsIndex = findIndex(["review", "count", "num_reviews"]);
  const statusIndex = findIndex(["status", "stage", "state"]);
  const notesIndex = findIndex(["note", "comment", "remark", "description"]);

  return {
    businessNameIndex: businessNameIndex !== -1 ? businessNameIndex : 0,
    phoneIndex,
    emailIndex,
    addressIndex,
    websiteIndex,
    categoryIndex,
    ratingIndex,
    reviewsIndex,
    statusIndex,
    notesIndex,
    headers,
  };
}

/**
 * Standard default headers for MyManager Google Sheet
 */
export const STANDARD_LEAD_HEADERS = [
  "Business Name",
  "Phone",
  "Email",
  "Address",
  "Website",
  "Category",
  "Rating",
  "Reviews",
  "Status",
  "Notes",
];

/**
 * Initializes or ensures standard headers in a blank sheet.
 */
export async function ensureSheetHeaders(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
) {
  const existing = await getSpreadsheetValues(accessToken, spreadsheetId, `${sheetName}!A1:Z1`);
  if (!existing || existing.length === 0 || existing[0].length === 0) {
    // Write standard headers
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${sheetName}!A1:J1`
    )}?valueInputOption=USER_ENTERED`;

    await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: `${sheetName}!A1:J1`,
        majorDimension: "ROWS",
        values: [STANDARD_LEAD_HEADERS],
      }),
    });
  }
}

/**
 * Sync from Google Sheet -> Database LeadFile & LeadTabs.
 * Supports multi-tab sheets, dynamic column detection (ENV tables, custom data, lead records).
 */
export async function syncFromGoogleSheet(userId: string, linkId: string) {
  const account = await getValidGoogleAccount(userId);
  if (!account) {
    throw new Error("Google account not connected");
  }

  const link = await prisma.googleSheetLink.findUnique({
    where: { id: linkId },
  });

  if (!link) {
    throw new Error("Google Sheet link not found");
  }

  // Update status to syncing
  await prisma.googleSheetLink.update({
    where: { id: linkId },
    data: { syncStatus: "syncing", lastError: null },
  });

  // Track the resolved file so the catch block can link it even on partial failure
  let resolvedFile: { id: string } | null = null;

  try {
    // 1. Fetch metadata (all tabs/sheets)
    const metadata = await getSpreadsheetMetadata(account.accessToken, link.spreadsheetId);
    const spreadsheetTitle = metadata.title || link.spreadsheetName || "Google Sheets Leads";

    // 2. Resolve or create LeadFile
    let file = link.fileId
      ? await prisma.leadFile.findUnique({ where: { id: link.fileId } })
      : null;

    // Safety: if the existing file was created for a DIFFERENT spreadsheet,
    // create a new file instead of mixing tabs from different sheets
    if (file) {
      const otherLink = await prisma.googleSheetLink.findFirst({
        where: {
          fileId: file.id,
          id: { not: linkId },
        },
      });
      if (otherLink && otherLink.spreadsheetId !== link.spreadsheetId) {
        file = null;
      }
    }

    if (!file) {
      file = await prisma.leadFile.create({
        data: {
          name: spreadsheetTitle,
          description: `Google Sheet (Live Sync) • ${metadata.sheets.length} tabs`,
        },
      });
    } else {
      file = await prisma.leadFile.update({
        where: { id: file.id },
        data: {
          name: spreadsheetTitle,
          description: `Google Sheet (Live Sync) • ${metadata.sheets.length} tabs`,
        },
      });
    }

    // Immediately link the file so even if sync fails mid-way, the file is associated
    resolvedFile = file;
    if (!link.fileId || link.fileId !== file.id) {
      await prisma.googleSheetLink.update({
        where: { id: linkId },
        data: { fileId: file.id },
      });
    }

    // 3. Existing columns on file
    const existingColumns = await prisma.leadColumn.findMany({
      where: { fileId: file.id },
      orderBy: { sortOrder: "asc" },
    });
    const columnNamesSet = new Set(existingColumns.map((c) => c.name.toLowerCase().trim()));
    let maxColSort = existingColumns.length > 0
      ? Math.max(...existingColumns.map((c) => c.sortOrder))
      : -1;

    let totalImported = 0;
    let totalUpdated = 0;
    let primaryTabId = link.tabId;

    // 4. Sync each tab in the spreadsheet
    const sheetsToSync: GoogleSheetMetadata[] = metadata.sheets.length > 0
      ? metadata.sheets
      : [{ sheetId: 0, title: link.sheetName || "Sheet1", rowCount: 0, columnCount: 0, merges: [] }];

    for (let sheetIdx = 0; sheetIdx < sheetsToSync.length; sheetIdx++) {
      const sheet = sheetsToSync[sheetIdx];
      const sheetTitle = sheet.title;

      // Find or create LeadTab
      let tab = await prisma.leadTab.findFirst({
        where: { fileId: file.id, name: sheetTitle },
      });

      if (!tab) {
        tab = await prisma.leadTab.create({
          data: {
            fileId: file.id,
            name: sheetTitle,
            sortOrder: sheetIdx,
          },
        });
      }

      if (sheetIdx === 0 && !primaryTabId) {
        primaryTabId = tab.id;
      }

      const sheetMergedRanges = buildMergedRangesFromGoogleMerges(sheet.merges || []);
      const existingStyling =
        tab.mergedCells && typeof tab.mergedCells === "object" && !Array.isArray(tab.mergedCells)
          ? (tab.mergedCells as Record<string, unknown>)
          : {};
      const nextStyling = {
        ...existingStyling,
        mergedRanges: sheetMergedRanges,
      };

      tab = await prisma.leadTab.update({
        where: { id: tab.id },
        data: { mergedCells: nextStyling as unknown as Prisma.InputJsonValue },
      });

      // Fetch values for this sheet
      const rawValues = await getSpreadsheetValues(
        account.accessToken,
        link.spreadsheetId,
        `${sheetTitle}!A1:Z1000`
      );

      if (!rawValues || rawValues.length === 0) continue;

      // Determine max columns in this sheet (at least 10 or 26)
      const maxCols = Math.max(...rawValues.map((r) => (r || []).length), 10);

      // Google Sheet standard column headers: A, B, C, D, E, F, G, H...
      const detectedHeaders = Array.from({ length: maxCols }, (_, i) => getColumnLetter(i));

      // Ensure LeadColumn records exist for A, B, C, D, E...
      const newColsToCreate: { fileId: string; name: string; sortOrder: number; width?: number }[] = [];
      for (let i = 0; i < detectedHeaders.length; i++) {
        const colName = detectedHeaders[i];
        if (colName && !columnNamesSet.has(colName.toLowerCase().trim())) {
          maxColSort++;
          columnNamesSet.add(colName.toLowerCase().trim());
          newColsToCreate.push({
            fileId: file.id,
            name: colName,
            sortOrder: maxColSort,
            width: 200,
          });
        }
      }

      if (newColsToCreate.length > 0) {
        await prisma.leadColumn.createMany({ data: newColsToCreate });
      }

      // Fetch existing leads in this tab in created order
      const existingLeads = await prisma.lead.findMany({
        where: { tabId: tab.id },
        orderBy: { createdAt: "asc" },
      });

      // Always start from index 0 so Row 1 of Google Sheets is NEVER skipped!
      for (let r = 0; r < rawValues.length; r++) {
        const row = rawValues[r] || [];
        const hasAnyValue = row.some((c: any) => (c || "").toString().trim() !== "");
        if (!hasAnyValue && r >= rawValues.length - 1) continue;

        const firstNonEmpty = row.find((c: any) => (c || "").toString().trim() !== "");
        const businessName = (row[0] || "").toString().trim() || (firstNonEmpty ? firstNonEmpty.toString().trim() : `Row ${r + 1}`);

        // Populate customFields mapping every column letter (A, B, C...)
        const customFields: Record<string, string> = {};
        for (let cIdx = 0; cIdx < maxCols; cIdx++) {
          const letter = getColumnLetter(cIdx);
          const val = (row[cIdx] || "").toString().trim();
          if (val) {
            customFields[letter] = val;
          }
        }

        if (existingLeads[r]) {
          await prisma.lead.update({
            where: { id: existingLeads[r].id },
            data: {
              businessName,
              phone: (row[1] || "").toString().trim() || null,
              email: (row[2] || "").toString().trim() || null,
              address: (row[3] || "").toString().trim() || null,
              website: (row[4] || "").toString().trim() || null,
              category: (row[5] || "").toString().trim() || null,
              notes: (row[6] || "").toString().trim() || null,
              customFields: Object.keys(customFields).length > 0 ? customFields : null,
              updatedAt: new Date(),
            },
          });
          totalUpdated++;
        } else {
          await prisma.lead.create({
            data: {
              tabId: tab.id,
              businessName,
              phone: (row[1] || "").toString().trim() || null,
              email: (row[2] || "").toString().trim() || null,
              address: (row[3] || "").toString().trim() || null,
              website: (row[4] || "").toString().trim() || null,
              category: (row[5] || "").toString().trim() || null,
              status: "new",
              notes: (row[6] || "").toString().trim() || null,
              customFields: Object.keys(customFields).length > 0 ? customFields : null,
            },
          });
          totalImported++;
        }
      }
    }

    const now = new Date();
    await prisma.googleSheetLink.update({
      where: { id: linkId },
      data: {
        fileId: file.id,
        tabId: primaryTabId,
        spreadsheetName: spreadsheetTitle,
        syncStatus: "success",
        lastSyncedAt: now,
        lastError: null,
      },
    });

    return {
      importedCount: totalImported,
      updatedCount: totalUpdated,
      fileId: file.id,
      tabId: primaryTabId,
    };
  } catch (err: any) {
    console.error("Google Sheets sync error:", err);
    // Ensure fileId is set even on failure — the file was created/linked
    const updateData: Record<string, any> = {
      syncStatus: "error",
      lastError: err?.message || "Sync failed",
    };
    if (resolvedFile) {
      updateData.fileId = resolvedFile.id;
    }
    await prisma.googleSheetLink.update({
      where: { id: linkId },
      data: updateData,
    });
    throw err;
  }
}

/**
 * Safely push a newly created or updated lead to linked Google Sheet (Non-blocking).
 */
export async function pushLeadToGoogleSheet(
  userId: string = "admin",
  tabId: string,
  lead: {
    businessName: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    website?: string | null;
    category?: string | null;
    rating?: number | null;
    reviews?: number | null;
    status?: string | null;
    notes?: string | null;
  }
) {
  try {
    const account = await getValidGoogleAccount(userId);
    if (!account) return;

    // Find if there is a linked sheet for this tab or active sheet
    const link = await prisma.googleSheetLink.findFirst({
      where: {
        userId,
        OR: [{ tabId }, { tabId: null }],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!link) return;

    const sheetName = link.sheetName || "Sheet1";
    await ensureSheetHeaders(account.accessToken, link.spreadsheetId, sheetName);

    const row = [
      lead.businessName || "",
      lead.phone || "",
      lead.email || "",
      lead.address || "",
      lead.website || "",
      lead.category || "",
      lead.rating ?? "",
      lead.reviews ?? "",
      lead.status || "new",
      lead.notes || "",
    ];

    await appendSpreadsheetRow(account.accessToken, link.spreadsheetId, sheetName, row);

    await prisma.googleSheetLink.update({
      where: { id: link.id },
      data: { lastSyncedAt: new Date() },
    });
  } catch (err) {
    // Non-blocking fallback: Log error safely without crashing caller
    console.warn("Failed to push lead to Google Sheet (non-blocking):", err);
  }
}
