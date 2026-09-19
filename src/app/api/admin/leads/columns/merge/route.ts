import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { broadcastToFile } from "@/lib/sync-events";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { fileId, sourceColumnNames, separator, newColumnName } = body;

    if (!fileId || !Array.isArray(sourceColumnNames) || sourceColumnNames.length < 2) {
      return NextResponse.json(
        { error: "fileId and at least 2 sourceColumnNames are required" },
        { status: 400 }
      );
    }

    if (!newColumnName?.trim()) {
      return NextResponse.json(
        { error: "newColumnName is required" },
        { status: 400 }
      );
    }

    const sep = separator ?? " ";

    const leadFile = await prisma.leadFile.findUnique({
      where: { id: fileId },
      include: { columns: true },
    });

    if (!leadFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const sourceColumns = leadFile.columns.filter((c) =>
      sourceColumnNames.includes(c.name)
    );

    if (sourceColumns.length < 2) {
      return NextResponse.json(
        { error: "At least 2 existing columns must be selected" },
        { status: 400 }
      );
    }

    const existingName = leadFile.columns.find(
      (c) => c.name.toLowerCase() === newColumnName.trim().toLowerCase()
    );
    if (existingName) {
      return NextResponse.json(
        { error: "A column with this name already exists" },
        { status: 400 }
      );
    }

    const maxSortOrder =
      leadFile.columns.length > 0
        ? Math.max(...leadFile.columns.map((c) => c.sortOrder))
        : -1;

    const newColumn = await prisma.leadColumn.create({
      data: {
        fileId,
        name: newColumnName.trim(),
        type: "text",
        sortOrder: maxSortOrder + 1,
      },
    });

    const allTabs = await prisma.leadTab.findMany({
      where: { fileId },
    });

    let totalUpdated = 0;

    for (const tab of allTabs) {
      const leads = await prisma.lead.findMany({
        where: { tabId: tab.id },
      });

      for (const lead of leads) {
        const customFields = (lead.customFields as Record<string, string>) || {};
        const parts: string[] = [];

        for (const col of sourceColumns) {
          const value = customFields[col.name] || "";
          if (value.trim()) {
            parts.push(value.trim());
          }
        }

        const mergedValue = parts.length > 0 ? parts.join(sep) : null;
        const updatedCustom: Record<string, string | null> = { ...customFields, [newColumnName.trim()]: mergedValue };

        for (const col of sourceColumns) {
          delete updatedCustom[col.name];
        }

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            customFields: Object.keys(updatedCustom).length > 0 ? updatedCustom : null,
          },
        });

        totalUpdated++;
      }
    }

    for (const col of sourceColumns) {
      await prisma.leadColumn.delete({ where: { id: col.id } });
    }

    broadcastToFile(fileId, "columns_changed", { fileId, action: "merge" });

    return NextResponse.json({
      success: true,
      merged: totalUpdated,
      newColumn: { id: newColumn.id, name: newColumn.name },
    });
  } catch (error) {
    console.error("Merge columns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
