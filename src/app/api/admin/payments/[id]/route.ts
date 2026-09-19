import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteReceipt } from "@/lib/cloudinary";
import { recomputeDashboardStats } from "@/lib/stats";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";


const VALID_TYPES = ["Income", "Expense", "Refund", "Transfer"];
const VALID_STATUSES = ["Pending", "Completed", "Failed", "Cancelled", "Refunded"];
const VALID_METHODS = ["UPI", "Bank Transfer", "Card", "Cash", "Razorpay", "PayPal", "Other"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "finance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({ where: { id } });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error) {
    console.error("Fetch payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "finance", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.payment.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (existing.status === "Completed") {
      if (body.amount !== undefined && parseFloat(body.amount) !== parseFloat(existing.amount)) {
        return NextResponse.json(
          { error: "Cannot modify amount of a completed transaction" },
          { status: 400 }
        );
      }
      if (body.type !== undefined && body.type !== existing.type) {
        return NextResponse.json(
          { error: "Cannot modify type of a completed transaction" },
          { status: 400 }
        );
      }
      if (body.date !== undefined && new Date(body.date).getTime() !== existing.date.getTime()) {
        return NextResponse.json(
          { error: "Cannot modify date of a completed transaction" },
          { status: 400 }
        );
      }
    }

    if (body.type !== undefined && !VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (body.paymentMethod !== undefined && body.paymentMethod && !VALID_METHODS.includes(body.paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    if (body.amount !== undefined) {
      const amt = parseFloat(body.amount);
      if (isNaN(amt) || amt <= 0) {
        return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
      }
    }

    const newStatus = body.status || existing.status;
    if (newStatus === "Completed" && !body.receiptUrl && !existing.receiptUrl) {
      return NextResponse.json(
        { error: "Receipt/proof is required for completed transactions" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const changes: string[] = [];

    if (body.date !== undefined) { updateData.date = new Date(body.date); changes.push("date"); }
    if (body.type !== undefined) { updateData.type = body.type; changes.push("type"); }
    if (body.amount !== undefined) { updateData.amount = parseFloat(body.amount).toFixed(2); changes.push("amount"); }
    if (body.currency !== undefined) { updateData.currency = body.currency; changes.push("currency"); }
    if (body.status !== undefined) { updateData.status = body.status; changes.push("status"); }
    if (body.paymentMethod !== undefined) { updateData.paymentMethod = body.paymentMethod || null; changes.push("paymentMethod"); }
    if (body.paidBy !== undefined) { updateData.paidBy = body.paidBy?.trim() || null; changes.push("paidBy"); }
    if (body.paidTo !== undefined) { updateData.paidTo = body.paidTo?.trim() || null; changes.push("paidTo"); }
    if (body.purposeCategory !== undefined) { updateData.purposeCategory = body.purposeCategory?.trim() || null; changes.push("purposeCategory"); }
    if (body.description !== undefined) { updateData.description = body.description?.trim() || null; changes.push("description"); }
    if (body.referenceNumber !== undefined) { updateData.referenceNumber = body.referenceNumber?.trim() || null; changes.push("referenceNumber"); }
    if (body.notes !== undefined) { updateData.notes = body.notes?.trim() || null; changes.push("notes"); }

    if (body.receiptUrl !== undefined) {
      if (existing.receiptPublicId && body.receiptUrl !== existing.receiptUrl) {
        await deleteReceipt(existing.receiptPublicId);
      }
      updateData.receiptUrl = body.receiptUrl || null;
      updateData.receiptPublicId = body.receiptPublicId || null;
      changes.push("receipt");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await prisma.payment.update({ where: { id }, data: updateData });

    let auditAction = "Updated";
    if (body.status && body.status !== existing.status) {
      auditAction = "StatusChanged";
    }

    await prisma.paymentAuditLog.create({
      data: {
        paymentId: id,
        action: auditAction,
        adminUser: user.name,
        details: changes.join(", "),
      },
    });

    await logActivity({
      action: "update_payment",
      section: "finance",
      user,
      details: {
        paymentId: id,
        transactionId: existing.transactionId,
        changes: changes.join(", "),
      },
      req: request,
    });

    console.log(`Payment updated: ${id} (${changes.join(", ")})`);

    recomputeDashboardStats().catch(console.error);


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
