import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchInstagramComments,
  postInstagramComment,
  deleteInstagramComment,
  hideInstagramComment,
} from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("mediaId");
    const accountId = searchParams.get("accountId");

    if (!mediaId) {
      return NextResponse.json({ error: "Media ID is required" }, { status: 400 });
    }

    const account = accountId
      ? await prisma.instagramAccount.findUnique({ where: { id: accountId } })
      : await prisma.instagramAccount.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json({ error: "No connected Instagram account found" }, { status: 404 });
    }

    const comments = await fetchInstagramComments(mediaId, account.accessToken);
    return NextResponse.json({ comments });
  } catch (error: any) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, mediaId, commentId, message } = body;

    if (!message || (!mediaId && !commentId)) {
      return NextResponse.json(
        { error: "Message and either mediaId or commentId are required" },
        { status: 400 }
      );
    }

    const account = accountId
      ? await prisma.instagramAccount.findUnique({ where: { id: accountId } })
      : await prisma.instagramAccount.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json({ error: "No connected Instagram account found" }, { status: 404 });
    }

    const result = await postInstagramComment({
      mediaId,
      commentId,
      message,
      accessToken: account.accessToken,
    });

    return NextResponse.json({ success: true, comment: result });
  } catch (error: any) {
    console.error("Failed to post comment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to post comment to Instagram" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");
    const accountId = searchParams.get("accountId");

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID is required" }, { status: 400 });
    }

    const account = accountId
      ? await prisma.instagramAccount.findUnique({ where: { id: accountId } })
      : await prisma.instagramAccount.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json({ error: "No connected Instagram account found" }, { status: 404 });
    }

    const success = await deleteInstagramComment(commentId, account.accessToken);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("Failed to delete comment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete comment" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { commentId, hide = true, accountId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID is required" }, { status: 400 });
    }

    const account = accountId
      ? await prisma.instagramAccount.findUnique({ where: { id: accountId } })
      : await prisma.instagramAccount.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!account) {
      return NextResponse.json({ error: "No connected Instagram account found" }, { status: 404 });
    }

    const success = await hideInstagramComment(commentId, hide, account.accessToken);
    return NextResponse.json({ success, hidden: hide });
  } catch (error: any) {
    console.error("Failed to update comment visibility:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update comment" },
      { status: 500 }
    );
  }
}
