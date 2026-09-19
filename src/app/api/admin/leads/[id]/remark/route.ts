import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkPermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import crypto from "crypto";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !checkPermission(user, "leads", "read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { commentText, deleteCommentId, remark, notes } = body;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Parse existing comments from notes
    let commentsList: Array<{
      id: string;
      authorId?: string;
      authorName: string;
      authorEmail: string;
      authorRole: string;
      text: string;
      createdAt: string;
    }> = [];

    if (existing.notes) {
      try {
        const parsed = JSON.parse(existing.notes);
        if (Array.isArray(parsed)) {
          commentsList = parsed;
        } else if (typeof existing.notes === "string" && existing.notes.trim()) {
          commentsList = [
            {
              id: "legacy-1",
              authorName: "Admin",
              authorEmail: "admin",
              authorRole: "admin",
              text: existing.notes,
              createdAt: existing.updatedAt.toISOString(),
            },
          ];
        }
      } catch {
        if (existing.notes.trim()) {
          commentsList = [
            {
              id: "legacy-1",
              authorName: "Admin",
              authorEmail: "admin",
              authorRole: "admin",
              text: existing.notes,
              createdAt: existing.updatedAt.toISOString(),
            },
          ];
        }
      }
    }

    if (deleteCommentId) {
      commentsList = commentsList.filter((c) => c.id !== deleteCommentId);
    } else if (commentText && typeof commentText === "string" && commentText.trim()) {
      const newComment = {
        id: crypto.randomUUID(),
        authorId: user.id,
        authorName: user.name,
        authorEmail: user.email,
        authorRole: user.role,
        text: commentText.trim(),
        createdAt: new Date().toISOString(),
      };
      commentsList.push(newComment);

      await logActivity({
        action: "add_comment",
        section: "leads",
        user,
        details: {
          leadId: id,
          businessName: existing.businessName,
          comment: newComment.text,
        },
        req: request,
      });
    } else if (remark !== undefined || notes !== undefined) {
      const newRemark = notes !== undefined ? notes : remark;
      if (typeof newRemark === "string" && newRemark.trim()) {
        const newComment = {
          id: crypto.randomUUID(),
          authorId: user.id,
          authorName: user.name,
          authorEmail: user.email,
          authorRole: user.role,
          text: newRemark.trim(),
          createdAt: new Date().toISOString(),
        };
        commentsList.push(newComment);
      }
    }

    const updatedNotes = commentsList.length > 0 ? JSON.stringify(commentsList) : null;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        notes: updatedNotes,
      },
    });

    return NextResponse.json({ lead, comments: commentsList, success: true });
  } catch (error) {
    console.error("Update lead comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
