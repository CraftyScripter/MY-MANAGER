import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const tabId = searchParams.get("tabId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId parameter is required" }, { status: 400 });
    }

    // Try dedicated sheetComment model if available on runtime
    const client = prisma as unknown as {
      sheetComment?: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          fileId: string;
          tabId: string | null;
          userId: string;
          userName: string;
          userEmail: string;
          userRole: string;
          message: string;
          createdAt: Date;
        }>>;
      };
    };

    if (client.sheetComment && typeof client.sheetComment.findMany === "function") {
      try {
        const comments = await client.sheetComment.findMany({
          where: {
            fileId,
            ...(tabId ? { OR: [{ tabId }, { tabId: null }] } : {}),
          },
          orderBy: { createdAt: "asc" },
        });

        if (comments && comments.length > 0) {
          return NextResponse.json({ comments, success: true });
        }
      } catch (sheetCommentErr) {
        console.warn("sheetComment query fallback to activity logs:", sheetCommentErr);
      }
    }

    // Reliable fallback via ActivityLog
    const logs = await prisma.activityLog.findMany({
      where: {
        section: "leads",
        action: "sheet_comment",
      },
      orderBy: { createdAt: "asc" },
    });

    const comments = logs
      .map((log) => {
        try {
          if (!log.details) return null;
          const parsed = JSON.parse(log.details);
          if (parsed.fileId !== fileId) return null;
          if (tabId && parsed.tabId && parsed.tabId !== tabId) return null;

          return {
            id: log.id,
            fileId: parsed.fileId,
            tabId: parsed.tabId || null,
            userId: parsed.userId || log.userEmail,
            userName: parsed.userName || log.userName || "User",
            userEmail: parsed.userEmail || log.userEmail,
            userRole: parsed.userRole || "member",
            message: parsed.message || "",
            createdAt: log.createdAt.toISOString(),
          };
        } catch {
          return null;
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return NextResponse.json({ comments, success: true });
  } catch (error) {
    console.error("Get sheet comments error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sheet comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { fileId, tabId, message } = body;

    if (!fileId || !message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "fileId and message are required" },
        { status: 400 }
      );
    }

    const payload = {
      fileId: String(fileId),
      tabId: tabId ? String(tabId) : null,
      userId: user.id || "admin",
      userName: user.name || "User",
      userEmail: user.email || "",
      userRole: user.role || "member",
      message: message.trim(),
    };

    // Always create in ActivityLog as rock-solid persistence
    const log = await prisma.activityLog.create({
      data: {
        action: "sheet_comment",
        section: "leads",
        userEmail: user.email || "admin@system.local",
        userName: user.name || "Admin",
        details: JSON.stringify(payload),
      },
    });

    const client = prisma as unknown as {
      sheetComment?: {
        create: (args: unknown) => Promise<unknown>;
      };
    };

    if (client.sheetComment && typeof client.sheetComment.create === "function") {
      try {
        await client.sheetComment.create({
          data: payload,
        });
      } catch (createErr) {
        console.warn("Could not save to sheetComment model:", createErr);
      }
    }

    const comment = {
      id: log.id,
      ...payload,
      createdAt: log.createdAt.toISOString(),
    };

    return NextResponse.json({ comment, success: true }, { status: 201 });
  } catch (error) {
    console.error("Create sheet comment error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create comment" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "read")) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Check in ActivityLog
    const existingLog = await prisma.activityLog.findUnique({ where: { id } });
    if (existingLog) {
      if (user.role !== "admin" && existingLog.userEmail !== user.email) {
        return NextResponse.json({ error: "Unauthorized to delete this comment" }, { status: 403 });
      }
      await prisma.activityLog.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    // Try deleting from sheetComment if present
    const client = prisma as unknown as {
      sheetComment?: {
        delete: (args: unknown) => Promise<unknown>;
      };
    };
    if (client.sheetComment && typeof client.sheetComment.delete === "function") {
      try {
        await client.sheetComment.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  } catch (error) {
    console.error("Delete sheet comment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
