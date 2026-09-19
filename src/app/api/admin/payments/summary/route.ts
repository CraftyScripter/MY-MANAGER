import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "finance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const completedPayments = await prisma.payment.findMany({
      where: { status: "Completed" },
      select: { type: true, amount: true },
    });

    const pendingPayments = await prisma.payment.findMany({
      where: { status: "Pending" },
      select: { amount: true },
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalRefunds = 0;
    let totalTransfers = 0;
    let pendingAmount = 0;

    for (const p of completedPayments) {
      const amt = parseFloat(p.amount) || 0;
      if (p.type === "Income") totalIncome += amt;
      else if (p.type === "Expense") totalExpenses += amt;
      else if (p.type === "Refund") totalRefunds += amt;
      else if (p.type === "Transfer") totalTransfers += amt;
    }

    for (const p of pendingPayments) {
      pendingAmount += parseFloat(p.amount) || 0;
    }

    const netBalance = totalIncome - totalExpenses - totalRefunds;

    return NextResponse.json({
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      totalRefunds: parseFloat(totalRefunds.toFixed(2)),
      totalTransfers: parseFloat(totalTransfers.toFixed(2)),
      netBalance: parseFloat(netBalance.toFixed(2)),
      pendingAmount: parseFloat(pendingAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Fetch payment summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
