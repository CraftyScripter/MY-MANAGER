import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastToFile } from "@/lib/sync-events";
import * as XLSX from "xlsx";

function detectHeaderRow(rawData: (string | number | null)[][]): number {
  if (rawData.length === 0) return 0;
  const maxScan = Math.min(rawData.length, 10);
  let bestRow = 0;
  let bestScore = 0;

  for (let i = 0; i < maxScan; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;
    let nonEmpty = 0;
    let textCells = 0;
    for (const cell of row) {
      const str = String(cell ?? "").trim();
      if (str !== "") {
        nonEmpty++;
        if (/^[a-zA-Z\s\-&.]+$/.test(str)) textCells++;
      }
    }
    const score = nonEmpty * 2 + textCells;
    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
    }
  }

  return bestRow;
}

async function importSheet(
  sheetData: (string | number | null)[][],
  tabId: string,
  leadFile: { id: string; columns: { name: string; sortOrder: number }[] }
) {
  if (sheetData.length === 0) return 0;

  const headerRowIndex = detectHeaderRow(sheetData);
  const headers = (sheetData[headerRowIndex] || []).map((h) =>
    h != null ? String(h).trim() : ""
  );

  const validHeaders: { name: string; index: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const name = headers[i] || `Column ${i + 1}`;
    validHeaders.push({ name, index: i });
  }

  if (validHeaders.length === 0) return 0;

  const existingColumnNames = new Set(
    leadFile.columns.map((c) => c.name.toLowerCase())
  );
  const newColumns: { name: string; fileId: string; sortOrder: number }[] = [];
  let maxSortOrder =
    leadFile.columns.length > 0
      ? Math.max(...leadFile.columns.map((c) => c.sortOrder))
      : -1;

  for (const h of validHeaders) {
    if (!existingColumnNames.has(h.name.toLowerCase())) {
      maxSortOrder++;
      newColumns.push({
        name: h.name,
        fileId: leadFile.id,
        sortOrder: maxSortOrder,
      });
      existingColumnNames.add(h.name.toLowerCase());
    }
  }

  if (newColumns.length > 0) {
    await prisma.leadColumn.createMany({ data: newColumns });
  }

  const leads: Array<{
    businessName: string;
    customFields: Record<string, string> | null;
  }> = [];

  for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
    const row = sheetData[i] as (string | number | null)[];
    const customFields: Record<string, string> = {};
    let hasData = false;

    for (const h of validHeaders) {
      const value = row[h.index];
      if (value === null || value === undefined) continue;
      const str = String(value).trim();
      if (str === "") continue;
      hasData = true;
      customFields[h.name] = str;
    }

    if (!hasData) continue;

    const firstColName = validHeaders[0].name;
    const firstColValue = customFields[firstColName] || "";

    leads.push({
      businessName: firstColValue,
      customFields:
        Object.keys(customFields).length > 0 ? customFields : null,
    });
  }

  if (leads.length === 0) return 0;

  const result = await prisma.lead.createMany({
    data: leads.map((lead) => ({
      tabId,
      businessName: lead.businessName,
      phone: null,
      email: null,
      address: null,
      website: null,
      category: null,
      rating: null,
      reviews: null,
      sourceUrl: null,
      status: "new",
      notes: null,
      customFields: lead.customFields,
    })),
  });

  return result.count;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const tabId = formData.get("tabId") as string | null;
    const importMode = formData.get("importMode") as string | null;

    if (!tabId) {
      return NextResponse.json({ error: "tabId is required" }, { status: 400 });
    }

    const tab = await prisma.leadTab.findUnique({ where: { id: tabId } });
    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a .csv file" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const leadFile = await prisma.leadFile.findUnique({
      where: { id: tab.fileId },
      include: { columns: true },
    });

    if (!leadFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (importMode === "multi" && workbook.SheetNames.length > 1) {
      const results: { name: string; count: number }[] = [];
      let totalImported = 0;

      const existingTabs = await prisma.leadTab.findMany({
        where: { fileId: tab.fileId },
        orderBy: { sortOrder: "asc" },
      });
      let maxSortOrder =
        existingTabs.length > 0
          ? Math.max(...existingTabs.map((t) => t.sortOrder))
          : -1;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
          header: 1,
          defval: null,
        });

        if (rawData.length < 1) continue;

        let targetTab = existingTabs.find(
          (t) => t.name.toLowerCase() === sheetName.toLowerCase()
        );
        if (!targetTab) {
          maxSortOrder++;
          targetTab = await prisma.leadTab.create({
            data: {
              fileId: tab.fileId,
              name: sheetName,
              sortOrder: maxSortOrder,
            },
          });
        }

        const currentLeadFile = await prisma.leadFile.findUnique({
          where: { id: tab.fileId },
          include: { columns: true },
        });

        const count = await importSheet(
          rawData,
          targetTab.id,
          currentLeadFile || leadFile
        );
        results.push({ name: sheetName, count });
        totalImported += count;
      }

      await logActivity({
        action: "import_leads_multi",
        section: "leads",
        user,
        details: { totalImported, fileName: file.name, tabId },
        req: request,
      });

      broadcastToFile(leadFile.id, "columns_changed", { fileId: leadFile.id, action: "import" });
      broadcastToFile(leadFile.id, "leads_imported", { fileId: leadFile.id });

      return NextResponse.json({
        success: true,
        imported: totalImported,
        sheets: results,
        multiSheet: true,
      });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
    });

    if (rawData.length < 1) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    const imported = await importSheet(rawData, tabId, leadFile);

    await logActivity({
      action: "import_leads",
      section: "leads",
      user,
      details: { imported, totalRows: rawData.length, fileName: file.name, tabId },
      req: request,
    });

    broadcastToFile(leadFile.id, "columns_changed", { fileId: leadFile.id, action: "import" });
    broadcastToFile(leadFile.id, "leads_imported", { fileId: leadFile.id, tabId });

    return NextResponse.json({
      success: true,
      imported,
      totalRows: rawData.length,
    });

  } catch (error) {
    console.error("Import leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
