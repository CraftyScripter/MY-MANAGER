import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { broadcastToTab } from "@/lib/sync-events";
import { pushLeadToGoogleSheet } from "@/lib/google-sheets";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { businessName, phone, email, address, website, category, rating, reviews, sourceUrl, status, notes, customFields, customField, senderId } = body;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Handle single custom field update (for inline editing)
    let updatedCustomFields = existing.customFields as Record<string, string> | null;
    if (customField) {
      const { columnName, value } = customField;
      if (!updatedCustomFields) updatedCustomFields = {};
      if (value === null || value === undefined || value === "") {
        delete updatedCustomFields[columnName];
        if (Object.keys(updatedCustomFields).length === 0) updatedCustomFields = null;
      } else {
        updatedCustomFields[columnName] = value;
      }
    } else if (customFields !== undefined) {
      updatedCustomFields = customFields;
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        businessName: businessName !== undefined ? businessName : existing.businessName,
        phone: phone !== undefined ? (phone || null) : existing.phone,
        email: email !== undefined ? (email || null) : existing.email,
        address: address !== undefined ? (address || null) : existing.address,
        website: website !== undefined ? (website || null) : existing.website,
        category: category !== undefined ? (category || null) : existing.category,
        rating: rating !== undefined ? (rating ? parseFloat(rating) : null) : existing.rating,
        reviews: reviews !== undefined ? (reviews ? parseInt(reviews) : null) : existing.reviews,
        sourceUrl: sourceUrl !== undefined ? (sourceUrl || null) : existing.sourceUrl,
        status: status !== undefined ? status : existing.status,
        notes: notes !== undefined ? (notes || null) : existing.notes,
        customFields: updatedCustomFields,
      },
    });

    // Determine edited column key and value for instant cell-level sync
    let editedKey: string | undefined = customField ? customField.columnName : undefined;
    let editedVal: unknown = customField ? customField.value : undefined;
    if (!editedKey) {
      const standardKeys = ["businessName", "phone", "email", "address", "website", "category", "rating", "reviews", "sourceUrl", "status", "notes"];
      const matchedKey = standardKeys.find((k) => body[k] !== undefined);
      if (matchedKey) {
        editedKey = matchedKey;
        editedVal = body[matchedKey];
      }
    }

    // Broadcast cell edit to live subscribers in real time
    broadcastToTab(
      existing.tabId,
      "cell_edit",
      {
        leadId: id,
        columnKey: editedKey,
        value: editedVal,
        lead,
      },
      senderId
    );

    // Non-blocking Google Sheet live sync push
    pushLeadToGoogleSheet(user.id, existing.tabId, lead).catch((e) =>
      console.warn("Failed async update push to Google Sheet:", e)
    );

    await logActivity({
      action: customField ? "edit_cell" : "update_lead",
      section: "leads",
      user,
      details: customField
        ? { leadId: id, column: customField.columnName, value: customField.value }
        : { leadId: id, businessName: lead.businessName },
      req: request,
    });

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Update lead error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id } });

    // Broadcast deletion to all subscribers
    broadcastToTab(existing.tabId, "lead_deleted", { leadId: id });

    await logActivity({
      action: "delete_lead",
      section: "leads",
      user,
      details: { leadId: id, businessName: existing.businessName },
      req: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



