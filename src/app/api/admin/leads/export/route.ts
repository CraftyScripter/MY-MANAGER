import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get("tabId");
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    if (!tabId) {
      return NextResponse.json({ error: "tabId is required" }, { status: 400 });
    }

    const tab = await prisma.leadTab.findUnique({
      where: { id: tabId },
      include: { file: true },
    });
    if (!tab) {
      return NextResponse.json({ error: "Tab not found" }, { status: 404 });
    }

    const where: Record<string, unknown> = { tabId };

    if (status && status !== "all") {
      where.status = status;
    }

    if (category && category !== "all") {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { address: { contains: search } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const customColumns = await prisma.leadColumn.findMany({
      where: { fileId: tab.fileId },
      orderBy: { sortOrder: "asc" },
    });

    const data = leads.map((lead) => {
      const row: Record<string, unknown> = {
        "Business Name": lead.businessName,
        "Phone": lead.phone || "",
        "Email": lead.email || "",
        "Address": lead.address || "",
        "Website": lead.website || "",
        "Category": lead.category || "",
        "Rating": lead.rating || "",
        "Reviews": lead.reviews || "",
        "Status": lead.status,
        "Notes": lead.notes || "",
        "Source URL": lead.sourceUrl || "",
        "Imported At": lead.importedAt.toISOString(),
        "Created At": lead.createdAt.toISOString(),
      };
      const custom = (lead.customFields as Record<string, string>) || {};
      for (const col of customColumns) {
        row[col.name] = custom[col.name] || "";
      }
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tab.name);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const fileName = `${tab.file.name} - ${tab.name}.xlsx`.replace(/[^a-zA-Z0-9\s\-\.]/g, "");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Export leads error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
