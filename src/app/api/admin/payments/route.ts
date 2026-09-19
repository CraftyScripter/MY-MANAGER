import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeDashboardStats } from "@/lib/stats";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";


const VALID_TYPES = ["Income", "Expense", "Refund", "Transfer"];
const VALID_STATUSES = ["Pending", "Completed", "Failed", "Cancelled", "Refunded"];
const VALID_METHODS = ["UPI", "Bank Transfer", "Card", "Cash", "Razorpay", "PayPal", "Other"];

function generateTransactionId(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${dateStr}-${rand}`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "finance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const paymentMethod = searchParams.get("paymentMethod");
    const purposeCategory = searchParams.get("purposeCategory");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sort = searchParams.get("sort") || "date";
    const order = searchParams.get("order") || "desc";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (type && type !== "all") where.type = type;
    if (status && status !== "all") where.status = status;
    if (paymentMethod && paymentMethod !== "all") where.paymentMethod = paymentMethod;
    if (purposeCategory && purposeCategory !== "all") where.purposeCategory = purposeCategory;

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.date = dateFilter;
    }

    if (search) {
      where.OR = [
        { transactionId: { contains: search } },
        { paidBy: { contains: search } },
        { paidTo: { contains: search } },
        { referenceNumber: { contains: search } },
        { purposeCategory: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const orderBy: Record<string, string> = {};
    if (sort === "date") orderBy.date = order === "asc" ? "asc" : "desc";
    else if (sort === "amount") orderBy.amount = order === "asc" ? "asc" : "desc";
    else orderBy.date = "desc";

    const [payments, total, categories] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        select: { purposeCategory: true },
        distinct: ["purposeCategory"],
      }),
    ]);

    return NextResponse.json({
      payments,
      categories: categories
        .map((c) => c.purposeCategory)
        .filter((c): c is string => c !== null && c !== undefined),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "finance", "write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const {
      date, type, amount, currency, status, paymentMethod,
      paidBy, paidTo, purposeCategory, description,
      referenceNumber, receiptUrl, receiptPublicId, notes,
    } = body;

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Valid transaction type is required" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
    }

    if (paymentMethod && !VALID_METHODS.includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    if (status === "Completed" && !receiptUrl) {
      return NextResponse.json(
        { error: "Receipt/proof is required for completed transactions" },
        { status: 400 }
      );
    }

    const transactionId = generateTransactionId();

    const payment = await prisma.payment.create({
      data: {
        transactionId,
        date: new Date(date),
        type,
        amount: amountNum.toFixed(2),
        currency: currency || "INR",
        status,
        paymentMethod: paymentMethod || null,
        paidBy: paidBy?.trim() || null,
        paidTo: paidTo?.trim() || null,
        purposeCategory: purposeCategory?.trim() || null,
        description: description?.trim() || null,
        referenceNumber: referenceNumber?.trim() || null,
        receiptUrl: receiptUrl || null,
        receiptPublicId: receiptPublicId || null,
        notes: notes?.trim() || null,
      },
    });

    await prisma.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        action: "Created",
        adminUser: user.name,
        details: `Payment created with status: ${status}`,
      },
    });

    await logActivity({
      action: "create_payment",
      section: "finance",
      user,
      details: {
        paymentId: payment.id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        type: payment.type,
        status: payment.status,
      },
      req: request,
    });

    // Auto-backup after payment created
    const { on_data_created } = await import("@/lib/autoBackup");
    on_data_created("payment");

    console.log(`Payment created: ${payment.id} (${transactionId})`);

    recomputeDashboardStats().catch(console.error);


    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
